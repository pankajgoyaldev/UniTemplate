import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  serializeUts,
  parseUts,
  type TemplateAst,
  type UtsTraceFile,
  type UtsManifest,
} from '@uts/core';
import { DEFAULT_A4_TEMPLATE } from '../src/store/defaultTemplate.js';
import { useTemplateStore } from '../src/store/useTemplateStore.js';
import { useDocumentStore } from '../src/store/document/useDocumentStore.js';
import { useHistoryStore } from '../src/store/history/useHistoryStore.js';
import { cloneTemplateAst } from '../src/store/history/historyUtils.js';
import {
  importBackgroundImage,
  removeTraceBackground,
  setTraceBackgroundOpacity,
  toggleTraceBackgroundVisibility,
  setTraceBackgroundPageIndex,
} from '../src/operations/backgroundOperations.js';
import {
  executeOpenTemplate,
  executeSaveTemplate,
} from '../src/operations/documentOperations.js';

describe('Background Undo/Redo History Integration', () => {
  const fileAData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02, 0x03, 0x04]);
  const fileBData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x05, 0x06, 0x07, 0x08, 0x09]);

  function createMockFile(name: string, data: Uint8Array, type = 'image/png'): File {
    return {
      name,
      type,
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    } as unknown as File;
  }

  beforeEach(() => {
    const cleanTemplate: TemplateAst = cloneTemplateAst(DEFAULT_A4_TEMPLATE);
    cleanTemplate.traceBackground = undefined;

    useTemplateStore.getState().setTemplate(cleanTemplate);
    useDocumentStore.getState().resetSession(cleanTemplate);
    useHistoryStore.getState().clearHistory();
    vi.restoreAllMocks();
  });

  describe('Scenario A: Add Background -> Undo -> Redo', () => {
    it('correctly reverts and restores background AST and file reference', async () => {
      expect(useTemplateStore.getState().template.traceBackground).toBeUndefined();
      expect(useDocumentStore.getState().traceBackgroundFile).toBeNull();
      expect(useDocumentStore.getState().getTraceBackgroundUrl()).toBeNull();
      expect(useHistoryStore.getState().canUndo).toBe(false);

      // 1. Add Background
      const mockFileA = createMockFile('blueprint_a.png', fileAData);
      const success = await importBackgroundImage(mockFileA);
      expect(success).toBe(true);

      // Verify added
      const templateAfterAdd = useTemplateStore.getState().template;
      expect(templateAfterAdd.traceBackground).toBeDefined();
      expect(templateAfterAdd.traceBackground?.fileRef).toBe('background/blueprint_a.png');
      expect(templateAfterAdd.traceBackground?.enabled).toBe(true);
      expect(useDocumentStore.getState().traceBackgroundFile?.filename).toBe('blueprint_a.png');
      expect(useDocumentStore.getState().getTraceBackgroundUrl()).toBeTruthy();
      expect(useHistoryStore.getState().canUndo).toBe(true);

      // 2. Undo
      useHistoryStore.getState().undo();

      // Expected: No Background in AST, null traceBackgroundFile, null URL
      const templateAfterUndo = useTemplateStore.getState().template;
      expect(templateAfterUndo.traceBackground).toBeUndefined();
      expect(useDocumentStore.getState().traceBackgroundFile).toBeNull();
      expect(useDocumentStore.getState().getTraceBackgroundUrl()).toBeNull();
      expect(useHistoryStore.getState().canRedo).toBe(true);

      // 3. Redo
      useHistoryStore.getState().redo();

      // Expected: Background restored with exact file and URL
      const templateAfterRedo = useTemplateStore.getState().template;
      expect(templateAfterRedo.traceBackground).toBeDefined();
      expect(templateAfterRedo.traceBackground?.fileRef).toBe('background/blueprint_a.png');
      expect(templateAfterRedo.traceBackground?.enabled).toBe(true);
      expect(useDocumentStore.getState().traceBackgroundFile?.filename).toBe('blueprint_a.png');
      expect(useDocumentStore.getState().getTraceBackgroundUrl()).toBeTruthy();
    });
  });

  describe('Scenario B: Remove Background -> Undo -> Redo', () => {
    it('restores previous background file and AST upon undo, and clears on redo', async () => {
      // 1. Setup initial background
      const mockFileA = createMockFile('background_initial.png', fileAData);
      await importBackgroundImage(mockFileA);
      expect(useTemplateStore.getState().template.traceBackground).toBeDefined();

      // Clear history so Remove is the first tracked action in this test
      useHistoryStore.getState().clearHistory();

      // 2. Remove Background
      removeTraceBackground();

      expect(useTemplateStore.getState().template.traceBackground).toBeUndefined();
      expect(useDocumentStore.getState().traceBackgroundFile).toBeNull();
      expect(useDocumentStore.getState().getTraceBackgroundUrl()).toBeNull();
      expect(useHistoryStore.getState().canUndo).toBe(true);

      // 3. Undo
      useHistoryStore.getState().undo();

      // Expected: Background A restored
      const templateRestored = useTemplateStore.getState().template;
      expect(templateRestored.traceBackground).toBeDefined();
      expect(templateRestored.traceBackground?.fileRef).toBe('background/background_initial.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.filename).toBe('background_initial.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.data).toEqual(fileAData);
      expect(useDocumentStore.getState().getTraceBackgroundUrl()).toBeTruthy();

      // 4. Redo
      useHistoryStore.getState().redo();

      // Expected: Background removed again
      expect(useTemplateStore.getState().template.traceBackground).toBeUndefined();
      expect(useDocumentStore.getState().traceBackgroundFile).toBeNull();
      expect(useDocumentStore.getState().getTraceBackgroundUrl()).toBeNull();
    });
  });

  describe('Scenario C: Replace Background -> Undo -> Redo', () => {
    it('restores previous background file upon undo and new background upon redo', async () => {
      // 1. Initial Background A
      const mockFileA = createMockFile('layer_a.png', fileAData);
      await importBackgroundImage(mockFileA);
      expect(useTemplateStore.getState().template.traceBackground?.fileRef).toBe('background/layer_a.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.filename).toBe('layer_a.png');

      // 2. Replace with Background B
      const mockFileB = createMockFile('layer_b.png', fileBData);
      await importBackgroundImage(mockFileB);
      expect(useTemplateStore.getState().template.traceBackground?.fileRef).toBe('background/layer_b.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.filename).toBe('layer_b.png');

      // 3. Undo Replace
      useHistoryStore.getState().undo();

      // Expected: Background A restored (both in AST and in active file)
      expect(useTemplateStore.getState().template.traceBackground?.fileRef).toBe('background/layer_a.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.filename).toBe('layer_a.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.data).toEqual(fileAData);
      expect(useDocumentStore.getState().getActiveTraceFile()?.filename).toBe('layer_a.png');

      // 4. Redo Replace
      useHistoryStore.getState().redo();

      // Expected: Background B restored (both in AST and in active file)
      expect(useTemplateStore.getState().template.traceBackground?.fileRef).toBe('background/layer_b.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.filename).toBe('layer_b.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.data).toEqual(fileBData);
      expect(useDocumentStore.getState().getActiveTraceFile()?.filename).toBe('layer_b.png');
    });
  });

  describe('Scenario D: Background Settings Mutations (Opacity, Visibility, PageIndex)', () => {
    it('supports Undo and Redo for opacity adjustments', async () => {
      const mockFileA = createMockFile('scan.png', fileAData);
      await importBackgroundImage(mockFileA);
      expect(useTemplateStore.getState().template.traceBackground?.opacity).toBe(0.3);

      // Change Opacity to 0.75
      setTraceBackgroundOpacity(0.75);
      expect(useTemplateStore.getState().template.traceBackground?.opacity).toBe(0.75);

      // Undo
      useHistoryStore.getState().undo();
      expect(useTemplateStore.getState().template.traceBackground?.opacity).toBe(0.3);

      // Redo
      useHistoryStore.getState().redo();
      expect(useTemplateStore.getState().template.traceBackground?.opacity).toBe(0.75);
    });

    it('supports Undo and Redo for visibility toggle', async () => {
      const mockFileA = createMockFile('scan.png', fileAData);
      await importBackgroundImage(mockFileA);
      expect(useTemplateStore.getState().template.traceBackground?.enabled).toBe(true);

      // Toggle Hidden
      toggleTraceBackgroundVisibility();
      expect(useTemplateStore.getState().template.traceBackground?.enabled).toBe(false);

      // Undo
      useHistoryStore.getState().undo();
      expect(useTemplateStore.getState().template.traceBackground?.enabled).toBe(true);

      // Redo
      useHistoryStore.getState().redo();
      expect(useTemplateStore.getState().template.traceBackground?.enabled).toBe(false);
    });

    it('supports Undo and Redo for pageIndex changes', async () => {
      const mockFileA = createMockFile('scan.png', fileAData);
      await importBackgroundImage(mockFileA);
      expect(useTemplateStore.getState().template.traceBackground?.pageIndex).toBe(0);

      // Change PageIndex to 2
      setTraceBackgroundPageIndex(2);
      expect(useTemplateStore.getState().template.traceBackground?.pageIndex).toBe(2);

      // Undo
      useHistoryStore.getState().undo();
      expect(useTemplateStore.getState().template.traceBackground?.pageIndex).toBe(0);

      // Redo
      useHistoryStore.getState().redo();
      expect(useTemplateStore.getState().template.traceBackground?.pageIndex).toBe(2);
    });
  });

  describe('Scenario E: History Transaction Batching for Opacity Slider', () => {
    it('groups continuous slider updates into a single history transaction', async () => {
      const mockFileA = createMockFile('scan.png', fileAData);
      await importBackgroundImage(mockFileA);
      useHistoryStore.getState().clearHistory();

      // Simulate dragging slider from 0.30 -> 0.40 -> 0.50 -> 0.60
      useHistoryStore.getState().beginHistoryTransaction();
      setTraceBackgroundOpacity(0.4);
      setTraceBackgroundOpacity(0.5);
      setTraceBackgroundOpacity(0.6);
      useHistoryStore.getState().commitHistoryTransaction();

      expect(useTemplateStore.getState().template.traceBackground?.opacity).toBe(0.6);
      expect(useHistoryStore.getState().past.length).toBe(1);

      // Single Undo reverts back to initial 0.3
      useHistoryStore.getState().undo();
      expect(useTemplateStore.getState().template.traceBackground?.opacity).toBe(0.3);

      // Single Redo restores 0.6
      useHistoryStore.getState().redo();
      expect(useTemplateStore.getState().template.traceBackground?.opacity).toBe(0.6);
    });
  });

  describe('Scenario F: Save and Load Compatibility Across Undo/Redo', () => {
    it('saves the correct restored background after Undo of Replace', async () => {
      // 1. Initial Background A
      const mockFileA = createMockFile('first_ref.png', fileAData);
      await importBackgroundImage(mockFileA);

      // 2. Replace with Background B
      const mockFileB = createMockFile('second_ref.png', fileBData);
      await importBackgroundImage(mockFileB);

      // 3. Undo Replace -> Background A restored
      useHistoryStore.getState().undo();
      expect(useTemplateStore.getState().template.traceBackground?.fileRef).toBe('background/first_ref.png');

      // 4. Save package to binary
      const template = useTemplateStore.getState().template;
      const traceFile = useDocumentStore.getState().getActiveTraceFile();
      expect(traceFile?.filename).toBe('first_ref.png');

      const manifest: UtsManifest = {
        format: 'UTS_PACKAGE',
        schemaVersion: '1.0.0',
        id: template.metadata.id,
        title: template.metadata.title,
        createdAt: template.metadata.createdAt,
        updatedAt: new Date().toISOString(),
        targetDpi: template.pageSettings.targetDpi,
        pageSize: {
          width: template.pageSettings.width,
          height: template.pageSettings.height,
          unit: template.pageSettings.unit,
        },
        assetCount: 0,
        hasTraceBackground: true,
      };

      const archiveBytes = await serializeUts({
        manifest,
        template,
        assets: new Map(),
        traceBackground: traceFile ?? undefined,
      });

      // 5. Open package
      const opened = await executeOpenTemplate(archiveBytes, 'RestoredPackage.uts', null, true);
      expect(opened).toBe(true);

      const openedTemplate = useTemplateStore.getState().template;
      expect(openedTemplate.traceBackground?.fileRef).toBe('background/first_ref.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.filename).toBe('first_ref.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.data).toEqual(fileAData);
    });

    it('saves the correct restored background after Undo of Remove', async () => {
      const mockFileA = createMockFile('saved_ref.png', fileAData);
      await importBackgroundImage(mockFileA);

      // Remove
      removeTraceBackground();
      expect(useTemplateStore.getState().template.traceBackground).toBeUndefined();

      // Undo Remove
      useHistoryStore.getState().undo();
      expect(useTemplateStore.getState().template.traceBackground).toBeDefined();
      expect(useTemplateStore.getState().template.traceBackground?.fileRef).toBe('background/saved_ref.png');

      // Save
      const template = useTemplateStore.getState().template;
      const traceFile = useDocumentStore.getState().getActiveTraceFile();
      expect(traceFile?.filename).toBe('saved_ref.png');

      const manifest: UtsManifest = {
        format: 'UTS_PACKAGE',
        schemaVersion: '1.0.0',
        id: template.metadata.id,
        title: template.metadata.title,
        createdAt: template.metadata.createdAt,
        updatedAt: new Date().toISOString(),
        targetDpi: template.pageSettings.targetDpi,
        pageSize: {
          width: template.pageSettings.width,
          height: template.pageSettings.height,
          unit: template.pageSettings.unit,
        },
        assetCount: 0,
        hasTraceBackground: true,
      };

      const archiveBytes = await serializeUts({
        manifest,
        template,
        assets: new Map(),
        traceBackground: traceFile ?? undefined,
      });

      // Open
      const opened = await executeOpenTemplate(archiveBytes, 'RestoredAfterUndoRemove.uts', null, true);
      expect(opened).toBe(true);

      expect(useTemplateStore.getState().template.traceBackground?.fileRef).toBe('background/saved_ref.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.filename).toBe('saved_ref.png');
      expect(useDocumentStore.getState().traceBackgroundFile?.data).toEqual(fileAData);
    });
  });
});

