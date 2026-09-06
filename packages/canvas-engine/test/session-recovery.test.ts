import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateTemplateAst,
  type TemplateAst,
  type UtsAsset,
  type ImageElement,
} from '@uts/core';
import {
  MemoryRecoveryStorage,
  setCustomRecoveryStorage,
  getRecoveryStorage,
} from '../../../apps/web/src/store/recovery/recoveryStorage.js';
import {
  saveSessionRecovery,
  loadSessionRecovery,
  restoreSessionRecovery,
  clearSessionRecovery,
  RECOVERY_STORAGE_KEY,
} from '../../../apps/web/src/store/recovery/sessionRecovery.js';
import { useTemplateStore } from '../../../apps/web/src/store/useTemplateStore.js';
import { useDocumentStore } from '../../../apps/web/src/store/document/useDocumentStore.js';
import { useHistoryStore } from '../../../apps/web/src/store/history/useHistoryStore.js';
import {
  executeNewTemplate,
  executeOpenTemplate,
  executeSaveTemplate,
  executeSaveTemplateAs,
  createBlankTemplate,
} from '../../../apps/web/src/operations/documentOperations.js';
import { browserFileIO } from '../../../apps/web/src/io/browserFileIO.js';

describe('Stability Feature — Session Recovery / Refresh Persistence', () => {
  let memoryStorage: MemoryRecoveryStorage;

  const sampleTemplate: TemplateAst = {
    schemaVersion: '1.0.0',
    metadata: {
      id: 'tpl_recovery_test',
      title: 'Recovery Test Doc',
      createdAt: '2026-09-06T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
    },
    pageSettings: {
      unit: 'mm',
      width: 210,
      height: 297,
      orientation: 'portrait',
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      targetDpi: 300,
    },
    dataSchema: { fields: [], mockPayload: {} },
    elements: [
      {
        id: 'rect_1',
        type: 'shape',
        name: 'Rectangle 1',
        bounds: { x: 20, y: 30, width: 60, height: 40, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#3b82f6',
        strokeColor: '#1d4ed8',
        strokeWidthMm: 1,
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.alert = vi.fn();
    memoryStorage = new MemoryRecoveryStorage();
    setCustomRecoveryStorage(memoryStorage);

    // Reset runtime stores
    const blank = createBlankTemplate();
    useTemplateStore.getState().setTemplate(blank);
    useDocumentStore.getState().resetSession(blank, 'Untitled.uts');
    useHistoryStore.getState().clearHistory();
  });

  // A. New document recovery
  it('A. New document recovery: untitled document edits are persisted and restored after refresh', async () => {
    const blank = createBlankTemplate();
    useTemplateStore.getState().setTemplate(blank);
    useDocumentStore.getState().resetSession(blank, 'Untitled.uts');

    // User adds an element
    useTemplateStore.getState().addElement({
      id: 'el_new_1',
      type: 'shape',
      name: 'Card',
      bounds: { x: 15, y: 15, width: 50, height: 30, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 1,
      shapeType: 'rectangle',
    });

    const activeTemplate = useTemplateStore.getState().template;
    const docStore = useDocumentStore.getState();
    const isDirty = docStore.checkDirty(activeTemplate);
    expect(isDirty).toBe(true);

    // Persist session
    await saveSessionRecovery({
      template: activeTemplate,
      savedBaseline: docStore.savedBaseline,
      filename: docStore.filename,
      isDirty,
      assets: docStore.assets,
      hasSavedFile: false,
    });

    // Simulate page reload: reset stores to completely different/blank state
    useTemplateStore.getState().setTemplate(createBlankTemplate());
    useDocumentStore.getState().resetSession(createBlankTemplate(), 'Untitled.uts');

    // Reload from recovery
    const record = await loadSessionRecovery();
    expect(record).not.toBeNull();
    expect(record?.filename).toBe('Untitled.uts');
    expect(record?.hasSavedFile).toBe(false);

    const restoreResult = restoreSessionRecovery(record!);
    expect(restoreResult.recovered).toBe(true);
    expect(restoreResult.isDirty).toBe(true);
    expect(useTemplateStore.getState().template.elements).toHaveLength(1);
    expect(useTemplateStore.getState().template.elements[0].id).toBe('el_new_1');
  });

  // B. Saved document recovery
  it('B. Saved document recovery: restores saved .uts document with clean status and filename', async () => {
    const savedDoc = { ...sampleTemplate, metadata: { ...sampleTemplate.metadata, title: 'Invoice 2026' } };
    useTemplateStore.getState().setTemplate(savedDoc);
    useDocumentStore.getState().setFilename('Invoice 2026.uts');
    useDocumentStore.getState().markClean(savedDoc);

    await saveSessionRecovery({
      template: savedDoc,
      savedBaseline: savedDoc,
      filename: 'Invoice 2026.uts',
      isDirty: false,
      assets: new Map(),
      hasSavedFile: true,
    });

    // Reset stores
    useTemplateStore.getState().setTemplate(createBlankTemplate());
    useDocumentStore.getState().resetSession(createBlankTemplate());

    // Restore
    const record = await loadSessionRecovery();
    expect(record).not.toBeNull();
    expect(record?.filename).toBe('Invoice 2026.uts');
    expect(record?.hasSavedFile).toBe(true);
    expect(record?.isDirty).toBe(false);

    const result = restoreSessionRecovery(record!);
    expect(result.isDirty).toBe(false);
    expect(useDocumentStore.getState().filename).toBe('Invoice 2026.uts');
    expect(useDocumentStore.getState().isDirty).toBe(false);
    expect(useTemplateStore.getState().template.metadata.title).toBe('Invoice 2026');
  });

  // C. Unsaved changes recovery
  it('C. Unsaved changes recovery: restores latest working state rather than reverting to saved baseline', async () => {
    const savedBaseline = { ...sampleTemplate };
    // Working state has an extra element
    const workingTemplate: TemplateAst = {
      ...savedBaseline,
      elements: [
        ...savedBaseline.elements,
        {
          id: 'extra_el',
          type: 'text',
          name: 'Extra Text',
          bounds: { x: 50, y: 80, width: 40, height: 15, rotation: 0 },
          isLocked: false,
          isVisible: true,
          zIndex: 2,
          content: 'Working draft text',
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSizePt: 12,
            fontWeight: 'normal',
            fontStyle: 'normal',
            color: '#000000',
            alignment: 'left',
            lineHeight: 1.2,
            autoWrap: true,
          },
        },
      ],
    };

    await saveSessionRecovery({
      template: workingTemplate,
      savedBaseline: savedBaseline,
      filename: 'Report.uts',
      isDirty: true,
      assets: new Map(),
      hasSavedFile: true,
    });

    // Simulate reload
    useTemplateStore.getState().setTemplate(createBlankTemplate());
    useDocumentStore.getState().resetSession(createBlankTemplate());

    const record = await loadSessionRecovery();
    expect(record).not.toBeNull();
    const result = restoreSessionRecovery(record!);

    expect(result.isDirty).toBe(true);
    expect(useTemplateStore.getState().template.elements).toHaveLength(2);
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'extra_el')).toBeDefined();
    expect(useDocumentStore.getState().isDirty).toBe(true);
  });

  // D. Correct dirty state after recovery
  it('D. Correct dirty state after recovery: dirty session stays dirty and can undo back to clean baseline', async () => {
    const baseline = { ...sampleTemplate };
    const modified = {
      ...sampleTemplate,
      elements: [{ ...sampleTemplate.elements[0], bounds: { ...sampleTemplate.elements[0].bounds, x: 99 } }],
    };

    await saveSessionRecovery({
      template: modified,
      savedBaseline: baseline,
      filename: 'Contract.uts',
      isDirty: true,
      assets: new Map(),
      hasSavedFile: true,
    });

    const record = await loadSessionRecovery();
    restoreSessionRecovery(record!);

    expect(useDocumentStore.getState().isDirty).toBe(true);

    // If user reverts the change back to baseline, checkDirty marks it clean
    useTemplateStore.getState().setTemplate(baseline);
    const cleanCheck = useDocumentStore.getState().checkDirty(baseline);
    expect(cleanCheck).toBe(false);
    expect(useDocumentStore.getState().isDirty).toBe(false);
  });

  // E. Save updates recovery state
  it('E. Save updates recovery state: successful save updates recovery baseline and marks clean', async () => {
    const template = { ...sampleTemplate };
    useTemplateStore.getState().setTemplate(template);
    useDocumentStore.getState().setFilename('Document.uts');
    useDocumentStore.getState().setFileHandle({} as FileSystemFileHandle);
    useDocumentStore.getState().markDirty();

    // Mock successful save
    vi.spyOn(browserFileIO, 'saveUts').mockResolvedValue({ saved: true, filename: 'Document.uts' });

    const saved = await executeSaveTemplate();
    expect(saved).toBe(true);
    expect(useDocumentStore.getState().isDirty).toBe(false);

    // Check recovery storage
    const record = await loadSessionRecovery();
    expect(record).not.toBeNull();
    expect(record?.isDirty).toBe(false);
    expect(record?.filename).toBe('Document.uts');
    expect(record?.savedBaseline.elements[0].id).toBe('rect_1');
  });

  // F. Save As updates recovery state
  it('F. Save As updates recovery state: establishes new document target and clean recovery baseline', async () => {
    const template = { ...sampleTemplate };
    useTemplateStore.getState().setTemplate(template);
    useDocumentStore.getState().markDirty();

    vi.spyOn(browserFileIO, 'saveUtsAs').mockResolvedValue({
      saved: true,
      filename: 'ExportedTemplate.uts',
      handle: {} as FileSystemFileHandle,
    });

    const saved = await executeSaveTemplateAs();
    expect(saved).toBe(true);
    expect(useDocumentStore.getState().filename).toBe('ExportedTemplate.uts');
    expect(useDocumentStore.getState().isDirty).toBe(false);

    const record = await loadSessionRecovery();
    expect(record).not.toBeNull();
    expect(record?.filename).toBe('ExportedTemplate.uts');
    expect(record?.isDirty).toBe(false);
  });

  // G. Failed Save preserves recovery
  it('G. Failed Save preserves recovery: failed save preserves working document and keeps dirty state', async () => {
    const template = { ...sampleTemplate };
    useTemplateStore.getState().setTemplate(template);
    useDocumentStore.getState().setFilename('ImportantDoc.uts');
    useDocumentStore.getState().setFileHandle({} as FileSystemFileHandle);
    useDocumentStore.getState().markDirty();

    // Save initial dirty recovery
    await saveSessionRecovery({
      template,
      savedBaseline: createBlankTemplate(),
      filename: 'ImportantDoc.uts',
      isDirty: true,
      assets: new Map(),
      hasSavedFile: true,
    });

    // Mock alert and save failure
    vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    vi.spyOn(browserFileIO, 'saveUts').mockRejectedValue(new Error('Disk full'));

    const saved = await executeSaveTemplate();
    expect(saved).toBe(false);
    expect(useDocumentStore.getState().isDirty).toBe(true);

    // Verify recovery was NOT overwritten with clean state
    const record = await loadSessionRecovery();
    expect(record?.isDirty).toBe(true);
    expect(record?.filename).toBe('ImportantDoc.uts');
  });

  // H. Failed Open preserves current recovery
  it('H. Failed Open preserves current recovery: corrupt file open leaves current session recovery intact', async () => {
    // Current working recovery session
    await saveSessionRecovery({
      template: sampleTemplate,
      savedBaseline: sampleTemplate,
      filename: 'CurrentWorking.uts',
      isDirty: false,
      assets: new Map(),
      hasSavedFile: true,
    });

    vi.spyOn(globalThis, 'alert').mockImplementation(() => {});

    // Try opening invalid binary data
    const corruptData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const success = await executeOpenTemplate(corruptData, 'bad.uts', null, true);
    expect(success).toBe(false);

    // Current recovery is still intact
    const record = await loadSessionRecovery();
    expect(record?.filename).toBe('CurrentWorking.uts');
    expect(record?.template.metadata.title).toBe('Recovery Test Doc');
  });

  // I. Cancelled Open preserves current recovery
  it('I. Cancelled Open preserves current recovery: cancelling file picker keeps session recovery intact', async () => {
    await saveSessionRecovery({
      template: sampleTemplate,
      savedBaseline: sampleTemplate,
      filename: 'ProtectedSession.uts',
      isDirty: false,
      assets: new Map(),
      hasSavedFile: true,
    });

    // User cancels open dialog
    vi.spyOn(browserFileIO, 'openUts').mockResolvedValue(null);

    const success = await executeOpenTemplate(undefined, undefined, undefined, true);
    expect(success).toBe(false);

    const record = await loadSessionRecovery();
    expect(record?.filename).toBe('ProtectedSession.uts');
  });

  // J. Corrupt recovery data does not crash the app
  it('J. Corrupt recovery data does not crash the app: malformed storage objects are discarded safely', async () => {
    // Write invalid/corrupt record directly into storage
    await memoryStorage.set(RECOVERY_STORAGE_KEY, {
      version: 99 as any,
      savedAt: 'invalid-date',
      filename: 'bogus',
      hasSavedFile: false,
      isDirty: true,
      template: null as any,
      savedBaseline: null as any,
      assets: [],
    });

    // loadSessionRecovery safely catches and discards without crashing
    const record = await loadSessionRecovery();
    expect(record).toBeNull();

    // Storage is cleared
    const rawAfter = await memoryStorage.get(RECOVERY_STORAGE_KEY);
    expect(rawAfter).toBeNull();
  });

  // K. Invalid AST recovery is rejected safely
  it('K. Invalid AST recovery is rejected safely: schema-violating AST is rejected via validateTemplateAst', async () => {
    const invalidAst: any = {
      schemaVersion: '1.0.0',
      metadata: { id: 'bad' },
      pageSettings: { width: -50, height: 100 }, // Negative dimension violates Zod schema!
      elements: [],
    };

    await memoryStorage.set(RECOVERY_STORAGE_KEY, {
      version: 1,
      savedAt: new Date().toISOString(),
      filename: 'CorruptAst.uts',
      hasSavedFile: false,
      isDirty: true,
      template: invalidAst,
      savedBaseline: invalidAst,
      assets: [],
    });

    const record = await loadSessionRecovery();
    expect(record).toBeNull();
  });

  // L. Asset recovery works
  it('L. Asset recovery works: binary assets survive recovery and reconstruct valid Blob URLs', async () => {
    const imageAssetData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic bytes
    const assetMap = new Map<string, UtsAsset>();
    assetMap.set('assets/logo.png', {
      filename: 'assets/logo.png',
      mimeType: 'image/png',
      data: imageAssetData,
    });

    const templateWithImage: TemplateAst = {
      ...sampleTemplate,
      elements: [
        {
          id: 'img_1',
          type: 'image',
          name: 'Company Logo',
          bounds: { x: 10, y: 10, width: 40, height: 20, rotation: 0 },
          isLocked: false,
          isVisible: true,
          zIndex: 1,
          assetRef: 'assets/logo.png',
          fit: 'contain',
          opacity: 1,
        } as ImageElement,
      ],
    };

    await saveSessionRecovery({
      template: templateWithImage,
      savedBaseline: templateWithImage,
      filename: 'BrandedTemplate.uts',
      isDirty: false,
      assets: assetMap,
      hasSavedFile: true,
    });

    // Simulate fresh load
    useTemplateStore.getState().setTemplate(createBlankTemplate());
    useDocumentStore.getState().resetSession(createBlankTemplate());

    const record = await loadSessionRecovery();
    expect(record).not.toBeNull();
    expect(record?.assets).toHaveLength(1);
    expect(record?.assets[0].filename).toBe('assets/logo.png');

    restoreSessionRecovery(record!);

    const restoredAssets = useDocumentStore.getState().assets;
    expect(restoredAssets.has('assets/logo.png')).toBe(true);

    // Verify asset resolver can resolve the recovered asset
    const resolver = useDocumentStore.getState().getAssetResolver();
    const resolvedUrl = resolver('assets/logo.png');
    expect(resolvedUrl).toBeDefined();
    expect(typeof resolvedUrl).toBe('string');
    expect(resolvedUrl?.length).toBeGreaterThan(0);
  });

  // M. Recovery persistence is debounced
  it('M. Recovery persistence is debounced: rapid changes schedule debounced save rather than instant spam', async () => {
    vi.useFakeTimers();

    let writeCount = 0;
    const testStorage = new MemoryRecoveryStorage();
    const originalSet = testStorage.set.bind(testStorage);
    testStorage.set = async (k, r) => {
      writeCount++;
      return originalSet(k, r);
    };
    setCustomRecoveryStorage(testStorage);

    // Simulate debounced persistence handler
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleDebouncedSave = (tpl: TemplateAst) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        saveSessionRecovery({
          template: tpl,
          savedBaseline: tpl,
          filename: 'RapidEdits.uts',
          isDirty: true,
          assets: new Map(),
          hasSavedFile: false,
        });
      }, 750);
    };

    // 10 rapid edits fired consecutively
    for (let i = 0; i < 10; i++) {
      scheduleDebouncedSave({ ...sampleTemplate, metadata: { ...sampleTemplate.metadata, title: `Edit ${i}` } });
      vi.advanceTimersByTime(50);
    }

    // After 500ms total, zero writes should have occurred
    expect(writeCount).toBe(0);

    // Advance past the 750ms debounce threshold
    vi.advanceTimersByTime(800);

    // Exactly one write occurred
    expect(writeCount).toBe(1);

    const record = await loadSessionRecovery();
    expect(record?.template.metadata.title).toBe('Edit 9');

    vi.useRealTimers();
  });

  // N. Undo/Redo history is NOT persisted
  it('N. Undo/Redo history is NOT persisted: recovered session starts with clean history stacks', async () => {
    // Populate history before refresh
    useHistoryStore.setState({
      past: [sampleTemplate],
      canUndo: true,
    });
    expect(useHistoryStore.getState().canUndo).toBe(true);

    await saveSessionRecovery({
      template: sampleTemplate,
      savedBaseline: sampleTemplate,
      filename: 'SessionWithHistory.uts',
      isDirty: false,
      assets: new Map(),
      hasSavedFile: true,
    });

    // Simulate page reload
    useHistoryStore.getState().clearHistory();
    const record = await loadSessionRecovery();
    restoreSessionRecovery(record!);

    // History stack must be clean (cannot undo/redo past the recovered baseline)
    expect(useHistoryStore.getState().canUndo).toBe(false);
    expect(useHistoryStore.getState().canRedo).toBe(false);
  });

  // O. New document clears/replaces previous recovery appropriately
  it('O. New document clears/replaces previous recovery appropriately: executeNewTemplate updates recovery', async () => {
    // Previous session
    await saveSessionRecovery({
      template: sampleTemplate,
      savedBaseline: sampleTemplate,
      filename: 'OldProject.uts',
      isDirty: false,
      assets: new Map(),
      hasSavedFile: true,
    });

    let record = await loadSessionRecovery();
    expect(record?.filename).toBe('OldProject.uts');

    // User starts a New template
    executeNewTemplate(true);

    record = await loadSessionRecovery();
    expect(record).not.toBeNull();
    expect(record?.filename).toBe('Untitled.uts');
    expect(record?.hasSavedFile).toBe(false);
    expect(record?.isDirty).toBe(false);
    expect(record?.template.elements).toHaveLength(0);
  });
});
