import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  serializeUts,
  parseUts,
  validateTemplateAst,
  type TemplateAst,
  type UtsManifest,
  type ImageElement,
} from '@uts/core';
import { DEFAULT_A4_TEMPLATE } from '../../../apps/web/src/store/defaultTemplate.js';
import { renderImageElement } from '../src/renderers/image-renderer.js';
import {
  useDocumentStore,
  normalizeUtsFilename,
  AssetCache,
  DEFAULT_DOCUMENT_NAME,
} from '../../../apps/web/src/store/document/index.js';
import { useTemplateStore } from '../../../apps/web/src/store/useTemplateStore.js';
import { useHistoryStore, cloneTemplateAst } from '../../../apps/web/src/store/history/index.js';
import {
  executeNewTemplate,
  executeOpenTemplate,
  createBlankTemplate,
} from '../../../apps/web/src/operations/documentOperations.js';
import { handleDocumentShortcut } from '../../../apps/web/src/hooks/useDocumentShortcuts.js';

describe('Task 7 — .uts Save/Open + Document Lifecycle + Asset Management', () => {
  const baseTestTemplate: TemplateAst = {
    schemaVersion: '1.0.0',
    metadata: {
      id: 'doc_test_tpl',
      title: 'Doc Lifecycle Template',
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
        id: 'img_test_1',
        type: 'image',
        name: 'Header Image',
        bounds: { x: 20, y: 20, width: 40, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        assetRef: 'assets/sample_logo.png',
        fit: 'contain',
        opacity: 1,
      },
    ],
  };

  beforeEach(() => {
    // Reset stores to clean initial state
    useTemplateStore.getState().setTemplate(cloneTemplateAst(baseTestTemplate));
    useDocumentStore.getState().resetSession(cloneTemplateAst(baseTestTemplate), 'test-document.uts');
    useHistoryStore.getState().clearHistory();
    // Stub alert to prevent modal alert blocks during tests
    vi.stubGlobal('alert', vi.fn());
  });

  describe('1. Filename Normalization', () => {
    it('appends .uts extension if missing', () => {
      expect(normalizeUtsFilename('my-invoice')).toBe('my-invoice.uts');
    });

    it('preserves existing .uts extension without duplicating it', () => {
      expect(normalizeUtsFilename('my-invoice.uts')).toBe('my-invoice.uts');
    });

    it('strips redundant duplicate .uts.uts extensions', () => {
      expect(normalizeUtsFilename('my-invoice.uts.uts')).toBe('my-invoice.uts');
      expect(normalizeUtsFilename('invoice.uts.uts.uts')).toBe('invoice.uts');
    });

    it('falls back to default document name if empty or whitespace', () => {
      expect(normalizeUtsFilename('')).toBe(DEFAULT_DOCUMENT_NAME);
      expect(normalizeUtsFilename('   ')).toBe(DEFAULT_DOCUMENT_NAME);
    });

    it('sanitizes illegal file system characters', () => {
      const sanitized = normalizeUtsFilename('invoice:2026/09*final?.uts');
      expect(sanitized).not.toContain(':');
      expect(sanitized).not.toContain('/');
      expect(sanitized).not.toContain('*');
      expect(sanitized).not.toContain('?');
      expect(sanitized.endsWith('.uts')).toBe(true);
    });
  });

  describe('2. Document Session State & Deep Dirty Tracking', () => {
    it('starts with isDirty as false after reset/save', () => {
      expect(useDocumentStore.getState().isDirty).toBe(false);
    });

    it('becomes dirty when an element is added', () => {
      useTemplateStore.getState().addElement({
        id: 'new_rect',
        type: 'shape',
        name: 'New Rect',
        bounds: { x: 50, y: 50, width: 30, height: 30, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 2,
        shapeType: 'rectangle',
        fillColor: '#000000',
        strokeColor: '#000000',
        strokeWidthMm: 1,
      });

      expect(useDocumentStore.getState().isDirty).toBe(true);
    });

    it('becomes dirty when element bounds are modified', () => {
      useTemplateStore.getState().updateElementBounds('img_test_1', {
        x: 25,
        y: 35,
        width: 40,
        height: 20,
        rotation: 0,
      });

      expect(useDocumentStore.getState().isDirty).toBe(true);
    });

    it('dynamically marks clean when undo reverts back to the saved baseline', () => {
      // Modify element
      useTemplateStore.getState().updateElementBounds('img_test_1', {
        x: 50,
        y: 50,
        width: 40,
        height: 20,
        rotation: 0,
      });
      expect(useDocumentStore.getState().isDirty).toBe(true);

      // Undo back to original baseline
      useHistoryStore.getState().undo();
      expect(useDocumentStore.getState().isDirty).toBe(false);

      // Redo away from baseline
      useHistoryStore.getState().redo();
      expect(useDocumentStore.getState().isDirty).toBe(true);
    });

    it('markClean establishes a new baseline and keeps history intact', () => {
      useTemplateStore.getState().updateElementBounds('img_test_1', {
        x: 80,
        y: 80,
        width: 40,
        height: 20,
        rotation: 0,
      });
      expect(useDocumentStore.getState().isDirty).toBe(true);
      expect(useHistoryStore.getState().canUndo).toBe(true);

      // Simulate Save by calling markClean with current template
      const current = useTemplateStore.getState().template;
      useDocumentStore.getState().markClean(current);

      // Document is now clean
      expect(useDocumentStore.getState().isDirty).toBe(false);

      // Save MUST NOT clear history
      expect(useHistoryStore.getState().canUndo).toBe(true);

      // Undoing past the save point makes the document dirty relative to the saved baseline!
      useHistoryStore.getState().undo();
      expect(useDocumentStore.getState().isDirty).toBe(true);

      // Redoing back to the save point makes it clean again!
      useHistoryStore.getState().redo();
      expect(useDocumentStore.getState().isDirty).toBe(false);
    });
  });

  describe('3. Template Package Serialization & Round-Trip', () => {
    it('serializes and parses template and embedded binary assets faithfully', async () => {
      const assetData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const assets = new Map([
        [
          'sample_logo.png',
          {
            id: 'sample_logo.png',
            name: 'sample_logo.png',
            mimeType: 'image/png',
            data: assetData,
          },
        ],
      ]);

      const manifest: UtsManifest = {
        format: 'UTS_PACKAGE',
        schemaVersion: '1.0.0',
        id: 'test_pkg_1',
        title: 'Package Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetDpi: 300,
        pageSize: { width: 210, height: 297, unit: 'mm' },
        assetCount: 1,
        hasTraceBackground: false,
      };

      const serialized = await serializeUts({
        manifest,
        template: baseTestTemplate,
        assets,
      });

      expect(serialized).toBeInstanceOf(Uint8Array);
      expect(serialized.length).toBeGreaterThan(100);

      // Round-trip parse
      const parsed = await parseUts(serialized);
      expect(parsed.manifest.title).toBe('Doc Lifecycle Template');
      expect(parsed.template.metadata.id).toBe(baseTestTemplate.metadata.id);
      expect(parsed.template.elements.length).toBe(baseTestTemplate.elements.length);

      // Assets restored
      expect(parsed.assets.size).toBe(1);
      const restoredAsset = parsed.assets.get('sample_logo.png');
      expect(restoredAsset).toBeDefined();
      expect(restoredAsset?.data.byteLength).toBe(assetData.byteLength);
    });

    it('rejects invalid or corrupt package on parse', async () => {
      const corrupt = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
      await expect(parseUts(corrupt)).rejects.toThrow();
    });
  });

  describe('4. Safe Document Replacement (executeNewTemplate & executeOpenTemplate)', () => {
    it('executeNewTemplate creates a blank template and resets session & history when confirmed', () => {
      executeNewTemplate(true);

      const currentTemplate = useTemplateStore.getState().template;
      expect(currentTemplate.elements.length).toBe(0);
      expect(currentTemplate.metadata.title).toBe('Blank Template');
      expect(useDocumentStore.getState().isDirty).toBe(false);
      expect(useDocumentStore.getState().filename).toBe(DEFAULT_DOCUMENT_NAME);
      expect(useHistoryStore.getState().canUndo).toBe(false);
    });

    it('executeNewTemplate opens unsaved confirmation modal when document is dirty', () => {
      useDocumentStore.getState().markDirty();

      executeNewTemplate(false);

      expect(useDocumentStore.getState().isUnsavedModalOpen).toBe(true);
      expect(typeof useDocumentStore.getState().pendingAction).toBe('function');
      // Document remains untouched
      expect(useTemplateStore.getState().template.metadata.id).toBe('doc_test_tpl');
    });

    it('executeOpenTemplate safely replaces document and resets history on valid package', async () => {
      const openAst: TemplateAst = {
        ...baseTestTemplate,
        metadata: {
          ...baseTestTemplate.metadata,
          id: 'opened_tpl',
          title: 'Opened Invoice',
        },
      };

      const manifest: UtsManifest = {
        format: 'UTS_PACKAGE',
        schemaVersion: '1.0.0',
        id: 'opened_tpl',
        title: 'Opened Invoice',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetDpi: 300,
        pageSize: { width: 210, height: 297, unit: 'mm' },
        assetCount: 0,
        hasTraceBackground: false,
      };

      const packageBytes = await serializeUts({
        manifest,
        template: openAst,
        assets: new Map(),
      });

      const success = await executeOpenTemplate(packageBytes, 'my-invoice.uts', null, true);
      expect(success).toBe(true);

      expect(useTemplateStore.getState().template.metadata.title).toBe('Opened Invoice');
      expect(useDocumentStore.getState().filename).toBe('my-invoice.uts');
      expect(useDocumentStore.getState().isDirty).toBe(false);
      expect(useHistoryStore.getState().canUndo).toBe(false);
    });

    it('executeOpenTemplate leaves existing document & history 100% untouched on corrupt package', async () => {
      const originalTemplate = useTemplateStore.getState().template;
      // Record a history state
      useTemplateStore.getState().addElement({
        id: 'temp_shape',
        type: 'shape',
        name: 'Temp',
        bounds: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#000',
        strokeColor: '#000',
        strokeWidthMm: 1,
      });
      const historyCanUndoBefore = useHistoryStore.getState().canUndo;
      expect(historyCanUndoBefore).toBe(true);

      const corruptBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
      const success = await executeOpenTemplate(corruptBytes, 'corrupted.uts', null, true);

      expect(success).toBe(false);
      // Document is completely preserved
      expect(useTemplateStore.getState().template.elements.some((e) => e.id === 'temp_shape')).toBe(true);
      // History is completely preserved
      expect(useHistoryStore.getState().canUndo).toBe(true);
    });

    it('executeOpenTemplate prompts unsaved modal when document is dirty', async () => {
      useDocumentStore.getState().markDirty();

      const success = await executeOpenTemplate(new Uint8Array([]), 'sample.uts', null, false);
      expect(success).toBe(false);
      expect(useDocumentStore.getState().isUnsavedModalOpen).toBe(true);
    });
  });

  describe('5. Asset Management & Fallback Resolver', () => {
    it('resolves embedded assets correctly by name', () => {
      const cache = new AssetCache();
      const assets = new Map([
        [
          'logo.png',
          {
            id: 'logo.png',
            name: 'logo.png',
            mimeType: 'image/png',
            data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
          },
        ],
      ]);

      // Resolves bare filename
      const uri1 = cache.resolve('logo.png', assets);
      expect(uri1).toBeDefined();

      // Resolves with assets/ prefix
      const uri2 = cache.resolve('assets/logo.png', assets);
      expect(uri2).toBeDefined();

      cache.revokeAll();
    });

    it('returns subtle fallback placeholder for missing/corrupt asset without throwing or deleting', () => {
      const cache = new AssetCache();
      const assets = new Map();

      const uri = cache.resolve('missing_photo.png', assets);
      expect(uri).toBeDefined();
      expect(uri).toContain('data:image/svg+xml');
      expect(uri).toContain('Asset Missing');
    });

    it('passes through inline data URI or web URLs directly', () => {
      const cache = new AssetCache();
      const assets = new Map();

      const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
      expect(cache.resolve(dataUri, assets)).toBe(dataUri);

      const httpUri = 'https://example.com/image.png';
      expect(cache.resolve(httpUri, assets)).toBe(httpUri);
    });

    it('renderImageElement uses assetResolver to resolve image href', () => {
      const element: ImageElement = {
        id: 'img_1',
        type: 'image',
        name: 'Test Image',
        bounds: { x: 10, y: 10, width: 50, height: 30, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        assetRef: 'assets/photo.jpg',
        fit: 'contain',
        opacity: 0.9,
      };

      const mockResolver = vi.fn((ref: string) => `resolved://${ref}`);
      const descriptor = renderImageElement(element, {
        zoom: 1,
        assetResolver: mockResolver,
      });

      expect(mockResolver).toHaveBeenCalledWith('assets/photo.jpg');
      expect(descriptor.attrs.href).toBe('resolved://assets/photo.jpg');
      expect(descriptor.attrs.opacity).toBe(0.9);
    });
  });

  describe('6. Document Keyboard Shortcuts', () => {
    it('dispatches Save on Ctrl+S / Cmd+S', () => {
      const actions = {
        onNew: vi.fn(),
        onOpen: vi.fn(),
        onSave: vi.fn(),
        onSaveAs: vi.fn(),
      };

      const handled = handleDocumentShortcut(
        { key: 's', ctrlKey: true, shiftKey: false, preventDefault: vi.fn() },
        actions,
      );

      expect(handled).toBe(true);
      expect(actions.onSave).toHaveBeenCalled();
      expect(actions.onSaveAs).not.toHaveBeenCalled();
    });

    it('dispatches Save As on Ctrl+Shift+S / Cmd+Shift+S', () => {
      const actions = {
        onNew: vi.fn(),
        onOpen: vi.fn(),
        onSave: vi.fn(),
        onSaveAs: vi.fn(),
      };

      const handled = handleDocumentShortcut(
        { key: 's', ctrlKey: true, shiftKey: true, preventDefault: vi.fn() },
        actions,
      );

      expect(handled).toBe(true);
      expect(actions.onSaveAs).toHaveBeenCalled();
      expect(actions.onSave).not.toHaveBeenCalled();
    });

    it('dispatches Open on Ctrl+O / Cmd+O', () => {
      const actions = {
        onNew: vi.fn(),
        onOpen: vi.fn(),
        onSave: vi.fn(),
        onSaveAs: vi.fn(),
      };

      const handled = handleDocumentShortcut(
        { key: 'o', ctrlKey: true, preventDefault: vi.fn() },
        actions,
      );

      expect(handled).toBe(true);
      expect(actions.onOpen).toHaveBeenCalled();
    });

    it('dispatches New on Ctrl+N / Cmd+N', () => {
      const actions = {
        onNew: vi.fn(),
        onOpen: vi.fn(),
        onSave: vi.fn(),
        onSaveAs: vi.fn(),
      };

      const handled = handleDocumentShortcut(
        { key: 'n', ctrlKey: true, preventDefault: vi.fn() },
        actions,
      );

      expect(handled).toBe(true);
      expect(actions.onNew).toHaveBeenCalled();
    });

    it('ignores shortcuts when typing in an input or textarea', () => {
      const actions = {
        onNew: vi.fn(),
        onOpen: vi.fn(),
        onSave: vi.fn(),
        onSaveAs: vi.fn(),
      };

      const handled = handleDocumentShortcut(
        {
          key: 's',
          ctrlKey: true,
          target: { tagName: 'INPUT' } as any,
          preventDefault: vi.fn(),
        },
        actions,
      );

      expect(handled).toBe(false);
      expect(actions.onSave).not.toHaveBeenCalled();
    });
  });

  describe('7. Unsaved Changes Modal Confirmation Lifecycle', () => {
    it('executing pending action discards changes and proceeds', async () => {
      useDocumentStore.getState().markDirty();
      const mockAction = vi.fn();
      useDocumentStore.getState().setPendingAction(mockAction);
      useDocumentStore.getState().setUnsavedModalOpen(true);

      // User chooses Discard: pending action is invoked, modal closes
      const pending = useDocumentStore.getState().pendingAction;
      useDocumentStore.getState().setUnsavedModalOpen(false);
      useDocumentStore.getState().setPendingAction(null);
      if (pending) await pending();

      expect(mockAction).toHaveBeenCalled();
      expect(useDocumentStore.getState().isUnsavedModalOpen).toBe(false);
      expect(useDocumentStore.getState().pendingAction).toBeNull();
    });

    it('cancelling modal leaves document unchanged and clears pending action', () => {
      useDocumentStore.getState().markDirty();
      const mockAction = vi.fn();
      useDocumentStore.getState().setPendingAction(mockAction);
      useDocumentStore.getState().setUnsavedModalOpen(true);

      // User chooses Cancel: pending action discarded without running
      useDocumentStore.getState().setUnsavedModalOpen(false);
      useDocumentStore.getState().setPendingAction(null);

      expect(mockAction).not.toHaveBeenCalled();
      expect(useDocumentStore.getState().isDirty).toBe(true);
      expect(useDocumentStore.getState().isUnsavedModalOpen).toBe(false);
    });
  });

  describe('8. Store Mutation Coverage & Dirty Tracking Across Actions', () => {
    it('tracks dirty status on deleteElements and cleans on undo', () => {
      expect(useDocumentStore.getState().isDirty).toBe(false);

      useTemplateStore.getState().deleteElements(['img_test_1']);
      expect(useDocumentStore.getState().isDirty).toBe(true);
      expect(useTemplateStore.getState().template.elements.length).toBe(0);

      useHistoryStore.getState().undo();
      expect(useDocumentStore.getState().isDirty).toBe(false);
      expect(useTemplateStore.getState().template.elements.length).toBe(1);
    });

    it('tracks dirty status on toggleElementLock and cleans on undo', () => {
      expect(useDocumentStore.getState().isDirty).toBe(false);

      useTemplateStore.getState().toggleElementLock('img_test_1');
      expect(useDocumentStore.getState().isDirty).toBe(true);
      expect(useTemplateStore.getState().template.elements[0].isLocked).toBe(true);

      useHistoryStore.getState().undo();
      expect(useDocumentStore.getState().isDirty).toBe(false);
      expect(useTemplateStore.getState().template.elements[0].isLocked).toBe(false);
    });

    it('tracks dirty status on toggleElementVisibility and cleans on undo', () => {
      expect(useDocumentStore.getState().isDirty).toBe(false);

      useTemplateStore.getState().toggleElementVisibility('img_test_1');
      expect(useDocumentStore.getState().isDirty).toBe(true);
      expect(useTemplateStore.getState().template.elements[0].isVisible).toBe(false);

      useHistoryStore.getState().undo();
      expect(useDocumentStore.getState().isDirty).toBe(false);
      expect(useTemplateStore.getState().template.elements[0].isVisible).toBe(true);
    });

    it('tracks dirty status on nudgeElements and cleans on undo', () => {
      expect(useDocumentStore.getState().isDirty).toBe(false);

      useTemplateStore.getState().nudgeElements(['img_test_1'], { x: 10, y: 10 }, 210, 297);
      expect(useDocumentStore.getState().isDirty).toBe(true);

      useHistoryStore.getState().undo();
      expect(useDocumentStore.getState().isDirty).toBe(false);
    });

    it('tracks dirty status on updatePageSettings and cleans on undo', () => {
      expect(useDocumentStore.getState().isDirty).toBe(false);

      useTemplateStore.getState().updatePageSettings({ width: 297, height: 210, orientation: 'landscape' });
      expect(useDocumentStore.getState().isDirty).toBe(true);

      useHistoryStore.getState().undo();
      expect(useDocumentStore.getState().isDirty).toBe(false);
      expect(useTemplateStore.getState().template.pageSettings.orientation).toBe('portrait');
    });
  });

  describe('9. Regression: DEFAULT_A4_TEMPLATE Save/Serialization & Line Shape Invariants', () => {
    beforeEach(() => {
      useTemplateStore.getState().setTemplate(cloneTemplateAst(DEFAULT_A4_TEMPLATE));
    });

    it('DEFAULT_A4_TEMPLATE passes validateTemplateAst() with horizontal line (height = 0)', () => {
      expect(() => validateTemplateAst(DEFAULT_A4_TEMPLATE)).not.toThrow();
      const validated = validateTemplateAst(DEFAULT_A4_TEMPLATE);
      const topLine = validated.elements.find((el) => el.id === 'el_top_line');
      expect(topLine).toBeDefined();
      expect(topLine?.bounds.height).toBe(0);
      expect(topLine?.bounds.width).toBe(180);
    });

    it('DEFAULT_A4_TEMPLATE serializes and deserializes successfully via serializeUts() and parseUts()', async () => {
      const manifest: UtsManifest = {
        format: 'UTS_PACKAGE',
        schemaVersion: '1.0.0',
        id: DEFAULT_A4_TEMPLATE.metadata.id,
        title: DEFAULT_A4_TEMPLATE.metadata.title,
        createdAt: DEFAULT_A4_TEMPLATE.metadata.createdAt,
        updatedAt: new Date().toISOString(),
        targetDpi: 300,
        pageSize: {
          width: DEFAULT_A4_TEMPLATE.pageSettings.width,
          height: DEFAULT_A4_TEMPLATE.pageSettings.height,
          unit: DEFAULT_A4_TEMPLATE.pageSettings.unit,
        },
        assetCount: 0,
        hasTraceBackground: false,
      };

      const buffer = await serializeUts({
        manifest,
        template: DEFAULT_A4_TEMPLATE,
        assets: new Map(),
      });

      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.byteLength).toBeGreaterThan(100);

      const parsed = await parseUts(buffer);
      expect(parsed.template.metadata.id).toBe('tpl_default_invoice');
      const topLine = parsed.template.elements.find((el) => el.id === 'el_top_line');
      expect(topLine).toBeDefined();
      expect(topLine?.bounds.height).toBe(0);
      expect(topLine?.bounds.width).toBe(180);
    });

    it('sanitizeBounds allows horizontal line (height = 0, width > 0)', () => {
      useTemplateStore.getState().updateElementBounds('el_top_line', {
        x: 10,
        y: 30,
        width: 150,
        height: 0,
        rotation: 0,
      });

      const element = useTemplateStore.getState().template.elements.find((el) => el.id === 'el_top_line');
      expect(element?.bounds.width).toBe(150);
      expect(element?.bounds.height).toBe(0);
    });

    it('sanitizeBounds allows vertical line (width = 0, height > 0)', () => {
      useTemplateStore.getState().updateElementBounds('el_top_line', {
        x: 10,
        y: 30,
        width: 0,
        height: 80,
        rotation: 0,
      });

      const element = useTemplateStore.getState().template.elements.find((el) => el.id === 'el_top_line');
      expect(element?.bounds.width).toBe(0);
      expect(element?.bounds.height).toBe(80);
    });

    it('sanitizeBounds rejects 0x0 degenerate bounds and keeps fallback dimensions', () => {
      // First ensure element has valid dimensions
      useTemplateStore.getState().updateElementBounds('el_top_line', {
        x: 15,
        y: 32,
        width: 180,
        height: 0,
        rotation: 0,
      });

      // Attempt to set 0x0
      useTemplateStore.getState().updateElementBounds('el_top_line', {
        x: 15,
        y: 32,
        width: 0,
        height: 0,
        rotation: 0,
      });

      const element = useTemplateStore.getState().template.elements.find((el) => el.id === 'el_top_line');
      // Should reject 0x0 and retain fallback width (180)
      expect(element?.bounds.width).toBe(180);
      expect(element?.bounds.height).toBe(0);
    });

    it('G. Save/Save As behavior remains unchanged for normal elements', async () => {
      // Create a template with standard non-zero elements
      const standardTemplate: TemplateAst = {
        schemaVersion: '1.0.0',
        metadata: {
          id: 'tpl_standard_test',
          title: 'Standard Test',
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
        dataSchema: { fields: [], mockPayload: {} },
        elements: [
          {
            id: 'txt_standard',
            type: 'text',
            name: 'Standard Text',
            bounds: { x: 20, y: 30, width: 80, height: 25, rotation: 0 },
            isLocked: false,
            isVisible: true,
            zIndex: 1,
            content: 'Invoice Content',
            style: {
              fontFamily: 'Inter',
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

      const manifest: UtsManifest = {
        format: 'UTS_PACKAGE',
        schemaVersion: '1.0.0',
        id: standardTemplate.metadata.id,
        title: standardTemplate.metadata.title,
        createdAt: standardTemplate.metadata.createdAt,
        updatedAt: new Date().toISOString(),
        targetDpi: 300,
        pageSize: { width: 210, height: 297, unit: 'mm' },
        assetCount: 0,
        hasTraceBackground: false,
      };

      const buffer = await serializeUts({ manifest, template: standardTemplate, assets: new Map() });
      const parsed = await parseUts(buffer);
      expect(parsed.template.metadata.id).toBe('tpl_standard_test');
      expect(parsed.template.elements[0].bounds.width).toBe(80);
      expect(parsed.template.elements[0].bounds.height).toBe(25);
    });

    it('H. sanitizeBounds must not create or reintroduce 0x0 elements under any input', () => {
      // Attempting to set 0x0 on an element
      useTemplateStore.getState().updateElementBounds('el_top_line', {
        x: 10,
        y: 10,
        width: 0,
        height: 0,
        rotation: 0,
      });
      const el = useTemplateStore.getState().template.elements.find((e) => e.id === 'el_top_line');
      expect(el).toBeDefined();
      expect(el!.bounds.width > 0 || el!.bounds.height > 0).toBe(true);
      expect(el!.bounds.width === 0 && el!.bounds.height === 0).toBe(false);
    });
  });
});
