import {
  parseUts,
  serializeUts,
  type TemplateAst,
  type UtsManifest,
  type UtsPackage,
} from '@uts/core';
import { useTemplateStore } from '../store/useTemplateStore.js';
import { useDocumentStore } from '../store/document/useDocumentStore.js';
import { useUIStore } from '../store/useUIStore.js';
import { browserFileIO } from '../io/browserFileIO.js';
import {
  DEFAULT_DOCUMENT_NAME,
  normalizeUtsFilename,
} from '../store/document/documentTypes.js';
import { saveSessionRecovery } from '../store/recovery/sessionRecovery.js';

export function createBlankTemplate(): TemplateAst {
  return {
    schemaVersion: '1.0.0',
    metadata: {
      id: `tpl_${Date.now()}`,
      title: 'Blank Template',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    pageSettings: {
      unit: 'mm',
      width: 210,
      height: 297,
      orientation: 'portrait',
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      targetDpi: 300,
    },
    dataSchema: {
      fields: [],
      mockPayload: {},
    },
    elements: [],
  };
}

/**
 * Creates a new template.
 * If there are unsaved changes and confirmed is false, triggers the confirmation modal.
 */
export function executeNewTemplate(confirmed = false): void {
  const docStore = useDocumentStore.getState();

  if (docStore.isDirty && !confirmed) {
    docStore.setPendingAction(() => executeNewTemplate(true));
    docStore.setUnsavedModalOpen(true);
    return;
  }

  docStore.setUnsavedModalOpen(false);
  docStore.setPendingAction(null);

  const blank = createBlankTemplate();
  // setTemplate automatically clears undo/redo history in useHistoryStore
  useTemplateStore.getState().setTemplate(blank);
  docStore.resetSession(blank, DEFAULT_DOCUMENT_NAME);
  useUIStore.getState().clearSelection();

  // Update recovery session to the fresh blank document
  saveSessionRecovery({
    template: blank,
    savedBaseline: blank,
    filename: DEFAULT_DOCUMENT_NAME,
    isDirty: false,
    assets: new Map(),
    hasSavedFile: false,
    traceBackground: null,
  });
}

/**
 * Opens an existing .uts template package.
 * If data is not provided, prompts the user via the browser file picker.
 * On validation failure, catches error and leaves the current document and history 100% untouched.
 */
export async function executeOpenTemplate(
  data?: Uint8Array,
  filename?: string,
  handle?: FileSystemFileHandle | null,
  confirmed = false,
): Promise<boolean> {
  const docStore = useDocumentStore.getState();

  // 1. Guard against unsaved changes
  if (docStore.isDirty && !confirmed) {
    docStore.setPendingAction(async () => {
      await executeOpenTemplate(data, filename, handle, true);
    });
    docStore.setUnsavedModalOpen(true);
    return false;
  }

  docStore.setUnsavedModalOpen(false);
  docStore.setPendingAction(null);

  let rawData = data;
  let rawFilename = filename;
  let rawHandle = handle;

  // 2. If no data provided, prompt user with file picker
  if (!rawData) {
    if (docStore.isOperationInProgress) return false;
    docStore.setIsOperationInProgress(true);
    try {
      const openResult = await browserFileIO.openUts();
      if (!openResult) {
        // Cancelled by user - not an error
        return false;
      }
      rawData = openResult.data;
      rawFilename = openResult.filename;
      rawHandle = openResult.handle;
    } catch (err) {
      alert(`Could not read file: ${(err as Error).message}`);
      return false;
    } finally {
      docStore.setIsOperationInProgress(false);
    }
  }

  // 3. Parse and validate .uts package
  // Any error here will be caught, leaving current document and history completely intact!
  let pkg: UtsPackage;
  try {
    pkg = await parseUts(rawData);
  } catch (err) {
    alert(`Failed to open .uts package: ${(err as Error).message}`);
    return false;
  }

  // 4. Verification succeeded - safely replace document
  useTemplateStore.getState().setTemplate(pkg.template);
  docStore.setAssets(pkg.assets);
  docStore.setTraceBackgroundFile(pkg.traceBackground ?? null);
  const finalFilename = rawFilename || pkg.template.metadata.title || DEFAULT_DOCUMENT_NAME;
  docStore.setFilename(finalFilename);
  docStore.setFileHandle(rawHandle ?? null);
  docStore.markClean(pkg.template);
  useUIStore.getState().clearSelection();

  // Immediately update recovery session with the newly opened document
  saveSessionRecovery({
    template: pkg.template,
    savedBaseline: pkg.template,
    filename: docStore.filename,
    isDirty: false,
    assets: pkg.assets,
    hasSavedFile: true,
    traceBackground: pkg.traceBackground ?? null,
  });

  return true;
}

/**
 * Saves the current template to disk.
 * If untitled or no file handle exists, delegates to saveAs.
 * Does NOT clear Undo/Redo history.
 * On failure, leaves the document dirty.
 */
export async function executeSaveTemplate(): Promise<boolean> {
  const docStore = useDocumentStore.getState();
  if (docStore.isOperationInProgress) return false;

  // If untitled or no existing file handle, redirect to Save As
  if (!docStore.fileHandle || docStore.filename === DEFAULT_DOCUMENT_NAME) {
    return executeSaveTemplateAs();
  }

  docStore.setIsOperationInProgress(true);
  try {
    const template = useTemplateStore.getState().template;
    const assets = docStore.assets;
    const traceFile = template.traceBackground ? docStore.traceBackgroundFile : undefined;
    const hasTrace = Boolean(traceFile && template.traceBackground?.enabled);

    const manifest: UtsManifest = {
      format: 'UTS_PACKAGE',
      schemaVersion: '1.0.0',
      id: template.metadata.id,
      title: template.metadata.title,
      author: template.metadata.author,
      createdAt: template.metadata.createdAt,
      updatedAt: new Date().toISOString(),
      targetDpi: template.pageSettings.targetDpi,
      pageSize: {
        width: template.pageSettings.width,
        height: template.pageSettings.height,
        unit: template.pageSettings.unit,
      },
      assetCount: assets.size,
      hasTraceBackground: hasTrace,
    };

    const buffer = await serializeUts({
      manifest,
      template,
      assets,
      traceBackground: traceFile ?? undefined,
    });

    const result = await browserFileIO.saveUts(buffer, docStore.filename, docStore.fileHandle);
    if (!result || !result.saved) {
      // User cancelled save dialog
      return false;
    }

    // Mark document clean against current AST; history is intentionally preserved
    docStore.markClean(template);
    docStore.setFilename(result.filename);
    if (result.handle) {
      docStore.setFileHandle(result.handle);
    }

    // Update recovery session so saved document becomes current clean baseline
    saveSessionRecovery({
      template,
      savedBaseline: template,
      filename: result.filename,
      isDirty: false,
      assets: docStore.assets,
      hasSavedFile: true,
      traceBackground: traceFile ?? null,
    });

    return true;
  } catch (err) {
    alert(`Failed to save template: ${(err as Error).message}`);
    // Document remains dirty on failure
    return false;
  } finally {
    docStore.setIsOperationInProgress(false);
  }
}

/**
 * Prompts user for target file location and saves the .uts package.
 * Does NOT clear Undo/Redo history.
 * On failure, leaves document dirty.
 */
export async function executeSaveTemplateAs(): Promise<boolean> {
  const docStore = useDocumentStore.getState();
  if (docStore.isOperationInProgress) return false;

  docStore.setIsOperationInProgress(true);
  try {
    const template = useTemplateStore.getState().template;
    const assets = docStore.assets;
    const traceFile = template.traceBackground ? docStore.traceBackgroundFile : undefined;
    const hasTrace = Boolean(traceFile && template.traceBackground?.enabled);

    const manifest: UtsManifest = {
      format: 'UTS_PACKAGE',
      schemaVersion: '1.0.0',
      id: template.metadata.id,
      title: template.metadata.title,
      author: template.metadata.author,
      createdAt: template.metadata.createdAt,
      updatedAt: new Date().toISOString(),
      targetDpi: template.pageSettings.targetDpi,
      pageSize: {
        width: template.pageSettings.width,
        height: template.pageSettings.height,
        unit: template.pageSettings.unit,
      },
      assetCount: assets.size,
      hasTraceBackground: hasTrace,
    };

    const buffer = await serializeUts({
      manifest,
      template,
      assets,
      traceBackground: traceFile ?? undefined,
    });

    const defaultName = normalizeUtsFilename(
      docStore.filename !== DEFAULT_DOCUMENT_NAME ? docStore.filename : template.metadata.title,
    );

    const result = await browserFileIO.saveUtsAs(buffer, defaultName);
    if (!result || !result.saved) {
      // Cancelled by user - document remains dirty
      return false;
    }

    docStore.markClean(template);
    docStore.setFilename(result.filename);
    docStore.setFileHandle(result.handle ?? null);

    // Update recovery session with new filename and clean baseline
    saveSessionRecovery({
      template,
      savedBaseline: template,
      filename: result.filename,
      isDirty: false,
      assets: docStore.assets,
      hasSavedFile: true,
      traceBackground: traceFile ?? null,
    });

    return true;
  } catch (err) {
    alert(`Failed to save template: ${(err as Error).message}`);
    return false;
  } finally {
    docStore.setIsOperationInProgress(false);
  }
}
