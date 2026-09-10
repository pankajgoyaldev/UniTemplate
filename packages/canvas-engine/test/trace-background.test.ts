import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  serializeUts,
  parseUts,
  validateTemplateAst,
  type TemplateAst,
  type UtsManifest,
  type UtsPackage,
  type UtsTraceFile,
} from '@uts/core';
import { DEFAULT_A4_TEMPLATE } from '../../../apps/web/src/store/defaultTemplate.js';
import { useTemplateStore } from '../../../apps/web/src/store/useTemplateStore.js';
import { useDocumentStore } from '../../../apps/web/src/store/document/useDocumentStore.js';
import { useHistoryStore, cloneTemplateAst } from '../../../apps/web/src/store/history/index.js';
import {
  renderTraceBackgroundDescriptor,
  renderTraceBackgroundToString,
} from '../src/renderers/image-renderer.js';
import {
  isSupportedImageFile,
  getMimeTypeForImage,
  importBackgroundImage,
  removeTraceBackground,
  setTraceBackgroundOpacity,
  toggleTraceBackgroundVisibility,
  SUPPORTED_BACKGROUND_EXTENSIONS,
  SUPPORTED_BACKGROUND_MIME_TYPES,
} from '../../../apps/web/src/operations/backgroundOperations.js';
import {
  executeNewTemplate,
  executeOpenTemplate,
  createBlankTemplate,
} from '../../../apps/web/src/operations/documentOperations.js';
import {
  saveSessionRecovery,
  loadSessionRecovery,
  restoreSessionRecovery,
  clearSessionRecovery,
} from '../../../apps/web/src/store/recovery/sessionRecovery.js';
import { getRecoveryStorage } from '../../../apps/web/src/store/recovery/recoveryStorage.js';

describe('Trace Background / Background Import Mode', () => {
  const samplePngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
  const sampleSvgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>');

  beforeEach(async () => {
    // Reset stores to a known clean state before each test
    const cleanTemplate = cloneTemplateAst(DEFAULT_A4_TEMPLATE);
    cleanTemplate.traceBackground = undefined;
    useTemplateStore.getState().setTemplate(cleanTemplate);
    useDocumentStore.getState().resetSession(cleanTemplate);
    useHistoryStore.getState().clearHistory();
    await clearSessionRecovery();
    vi.restoreAllMocks();
  });

  describe('1. File Type & Format Support', () => {
    it('accepts valid image extensions: PNG, JPG, JPEG, WebP, SVG', () => {
      expect(isSupportedImageFile({ name: 'mockup.png' })).toBe(true);
      expect(isSupportedImageFile({ name: 'photo.jpg' })).toBe(true);
      expect(isSupportedImageFile({ name: 'scan.jpeg' })).toBe(true);
      expect(isSupportedImageFile({ name: 'drawing.webp' })).toBe(true);
      expect(isSupportedImageFile({ name: 'diagram.svg' })).toBe(true);
      expect(isSupportedImageFile({ name: 'UPPERCASE.PNG' })).toBe(true);
      expect(isSupportedImageFile({ name: 'mixed.SvG' })).toBe(true);
    });

    it('accepts valid MIME types: image/png, image/jpeg, image/webp, image/svg+xml', () => {
      expect(isSupportedImageFile({ name: 'blob', type: 'image/png' })).toBe(true);
      expect(isSupportedImageFile({ name: 'blob', type: 'image/jpeg' })).toBe(true);
      expect(isSupportedImageFile({ name: 'blob', type: 'image/webp' })).toBe(true);
      expect(isSupportedImageFile({ name: 'blob', type: 'image/svg+xml' })).toBe(true);
    });

    it('rejects unsupported files: PDF, GIF, BMP, EXE, TXT', () => {
      expect(isSupportedImageFile({ name: 'document.pdf' })).toBe(false);
      expect(isSupportedImageFile({ name: 'animation.gif' })).toBe(false);
      expect(isSupportedImageFile({ name: 'bitmap.bmp' })).toBe(false);
      expect(isSupportedImageFile({ name: 'executable.exe' })).toBe(false);
      expect(isSupportedImageFile({ name: 'notes.txt' })).toBe(false);
      expect(isSupportedImageFile({ name: 'data.json' })).toBe(false);
      expect(isSupportedImageFile({ name: 'file', type: 'application/pdf' })).toBe(false);
    });

    it('detects correct MIME types for images', () => {
      expect(getMimeTypeForImage('test.png')).toBe('image/png');
      expect(getMimeTypeForImage('test.jpg')).toBe('image/jpeg');
      expect(getMimeTypeForImage('test.jpeg')).toBe('image/jpeg');
      expect(getMimeTypeForImage('test.webp')).toBe('image/webp');
      expect(getMimeTypeForImage('test.svg')).toBe('image/svg+xml');
    });
  });

  describe('2. Template Store & Document Store Mutations', () => {
    it('setTraceBackground updates AST and marks document dirty', () => {
      const docStore = useDocumentStore.getState();
      expect(docStore.isDirty).toBe(false);

      useTemplateStore.getState().setTraceBackground({
        enabled: true,
        fileRef: 'background/blueprint.png',
        opacity: 0.35,
        pageIndex: 0,
      });

      const template = useTemplateStore.getState().template;
      expect(template.traceBackground).toBeDefined();
      expect(template.traceBackground?.fileRef).toBe('background/blueprint.png');
      expect(template.traceBackground?.opacity).toBe(0.35);
      expect(template.traceBackground?.enabled).toBe(true);

      // Verify dirty state updated
      expect(useDocumentStore.getState().isDirty).toBe(true);
    });

    it('updateTraceBackground patches opacity and visibility', () => {
      useTemplateStore.getState().setTraceBackground({
        enabled: true,
        fileRef: 'background/blueprint.png',
        opacity: 0.5,
        pageIndex: 0,
      });

      useTemplateStore.getState().updateTraceBackground({ opacity: 0.75, enabled: false });

      const template = useTemplateStore.getState().template;
      expect(template.traceBackground?.opacity).toBe(0.75);
      expect(template.traceBackground?.enabled).toBe(false);
      expect(template.traceBackground?.fileRef).toBe('background/blueprint.png');
    });

    it('traceBackground mutations support Undo and Redo', () => {
      const initialTrace = useTemplateStore.getState().template.traceBackground;
      expect(initialTrace).toBeUndefined();

      // Commit background
      useTemplateStore.getState().setTraceBackground({
        enabled: true,
        fileRef: 'background/scan.jpg',
        opacity: 0.4,
        pageIndex: 0,
      });

      expect(useTemplateStore.getState().template.traceBackground?.fileRef).toBe('background/scan.jpg');
      expect(useHistoryStore.getState().canUndo).toBe(true);

      // Undo
      useHistoryStore.getState().undo();
      expect(useTemplateStore.getState().template.traceBackground).toBeUndefined();
      expect(useHistoryStore.getState().canRedo).toBe(true);

      // Redo
      useHistoryStore.getState().redo();
      expect(useTemplateStore.getState().template.traceBackground?.fileRef).toBe('background/scan.jpg');
      expect(useTemplateStore.getState().template.traceBackground?.opacity).toBe(0.4);
    });

    it('manages traceBackgroundFile and resolves URL via AssetCache', () => {
      const docStore = useDocumentStore.getState();
      expect(docStore.traceBackgroundFile).toBeNull();
      expect(docStore.getTraceBackgroundUrl()).toBeNull();

      const traceFile: UtsTraceFile = {
        filename: 'reference.png',
        mimeType: 'image/png',
        data: samplePngBytes,
      };

      useDocumentStore.getState().setTraceBackgroundFile(traceFile);
      expect(useDocumentStore.getState().traceBackgroundFile).toEqual(traceFile);

      const url = useDocumentStore.getState().getTraceBackgroundUrl();
      expect(url).toBeTruthy();
      expect(typeof url).toBe('string');
      // In node/test environment, AssetCache generates a data URI fallback
      expect(url?.startsWith('data:image/png;base64,') || url?.startsWith('blob:')).toBe(true);

      // Setting to null clears the trace URL
      useDocumentStore.getState().setTraceBackgroundFile(null);
      expect(useDocumentStore.getState().traceBackgroundFile).toBeNull();
      expect(useDocumentStore.getState().getTraceBackgroundUrl()).toBeNull();
    });
  });

  describe('3. Background Operations Helpers', () => {
    it('importBackgroundImage commits traceFile and templateAST with 30% default opacity', async () => {
      const mockFile = {
        name: 'invoice_template.png',
        type: 'image/png',
        arrayBuffer: async () => samplePngBytes.buffer,
      } as unknown as File;

      const result = await importBackgroundImage(mockFile);
      expect(result).toBe(true);

      const tpl = useTemplateStore.getState().template;
      expect(tpl.traceBackground).toBeDefined();
      expect(tpl.traceBackground?.enabled).toBe(true);
      expect(tpl.traceBackground?.opacity).toBe(0.3);
      expect(tpl.traceBackground?.fileRef).toBe('background/invoice_template.png');

      const docStore = useDocumentStore.getState();
      expect(docStore.traceBackgroundFile?.filename).toBe('invoice_template.png');
      expect(docStore.traceBackgroundFile?.data.byteLength).toBe(samplePngBytes.byteLength);
    });

    it('rejects unsupported files in importBackgroundImage', async () => {
      const alertMock = vi.fn();
      vi.stubGlobal('alert', alertMock);

      const mockPdf = {
        name: 'invoice.pdf',
        type: 'application/pdf',
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as unknown as File;

      const result = await importBackgroundImage(mockPdf);
      expect(result).toBe(false);
      expect(alertMock).toHaveBeenCalled();
    });

    it('setTraceBackgroundOpacity clamps values between 0.05 and 1.0', () => {
      useTemplateStore.getState().setTraceBackground({
        enabled: true,
        fileRef: 'background/art.png',
        opacity: 0.3,
        pageIndex: 0,
      });

      setTraceBackgroundOpacity(0.8);
      expect(useTemplateStore.getState().template.traceBackground?.opacity).toBe(0.8);

      setTraceBackgroundOpacity(1.5);
      expect(useTemplateStore.getState().template.traceBackground?.opacity).toBe(1);

      setTraceBackgroundOpacity(0.01);
      expect(useTemplateStore.getState().template.traceBackground?.opacity).toBe(0.05);
    });

    it('toggleTraceBackgroundVisibility flips enabled flag', () => {
      useTemplateStore.getState().setTraceBackground({
        enabled: true,
        fileRef: 'background/art.png',
        opacity: 0.5,
        pageIndex: 0,
      });

      toggleTraceBackgroundVisibility();
      expect(useTemplateStore.getState().template.traceBackground?.enabled).toBe(false);

      toggleTraceBackgroundVisibility();
      expect(useTemplateStore.getState().template.traceBackground?.enabled).toBe(true);
    });

    it('removeTraceBackground sets traceBackground to undefined', () => {
      useTemplateStore.getState().setTraceBackground({
        enabled: true,
        fileRef: 'background/art.png',
        opacity: 0.5,
        pageIndex: 0,
      });

      removeTraceBackground();
      expect(useTemplateStore.getState().template.traceBackground).toBeUndefined();
    });
  });

  describe('4. .uts Packaging & Round-Trip', () => {
    it('serializes and deserializes a package containing a traceBackground file', async () => {
      const templateWithTrace: TemplateAst = {
        ...cloneTemplateAst(DEFAULT_A4_TEMPLATE),
        traceBackground: {
          enabled: true,
          fileRef: 'background/reference_label.png',
          opacity: 0.45,
          pageIndex: 0,
        },
      };

      const traceFile: UtsTraceFile = {
        filename: 'reference_label.png',
        mimeType: 'image/png',
        data: samplePngBytes,
      };

      const manifest: UtsManifest = {
        format: 'UTS_PACKAGE',
        schemaVersion: '1.0.0',
        id: templateWithTrace.metadata.id,
        title: templateWithTrace.metadata.title,
        createdAt: templateWithTrace.metadata.createdAt,
        updatedAt: new Date().toISOString(),
        targetDpi: templateWithTrace.pageSettings.targetDpi,
        pageSize: {
          width: templateWithTrace.pageSettings.width,
          height: templateWithTrace.pageSettings.height,
          unit: templateWithTrace.pageSettings.unit,
        },
        assetCount: 0,
        hasTraceBackground: true,
      };

      const archiveBytes = await serializeUts({
        manifest,
        template: templateWithTrace,
        assets: new Map(),
        traceBackground: traceFile,
      });

      expect(archiveBytes).toBeInstanceOf(Uint8Array);
      expect(archiveBytes.byteLength).toBeGreaterThan(0);

      // Parse back
      const parsed = await parseUts(archiveBytes);
      expect(parsed.manifest.hasTraceBackground).toBe(true);
      expect(parsed.template.traceBackground).toBeDefined();
      expect(parsed.template.traceBackground?.fileRef).toBe('background/reference_label.png');
      expect(parsed.template.traceBackground?.opacity).toBe(0.45);
      expect(parsed.template.traceBackground?.enabled).toBe(true);
      expect(parsed.traceBackground).toBeDefined();
      expect(parsed.traceBackground?.filename).toBe('reference_label.png');
      expect(parsed.traceBackground?.data).toEqual(samplePngBytes);
    });

    it('preserves trace background when opened via executeOpenTemplate', async () => {
      const templateWithTrace: TemplateAst = {
        ...cloneTemplateAst(DEFAULT_A4_TEMPLATE),
        metadata: {
          ...DEFAULT_A4_TEMPLATE.metadata,
          id: 'test_open_trace',
          title: 'Trace Open Test',
        },
        traceBackground: {
          enabled: true,
          fileRef: 'background/mockup.svg',
          opacity: 0.25,
          pageIndex: 0,
        },
      };

      const traceFile: UtsTraceFile = {
        filename: 'mockup.svg',
        mimeType: 'image/svg+xml',
        data: sampleSvgBytes,
      };

      const manifest: UtsManifest = {
        format: 'UTS_PACKAGE',
        schemaVersion: '1.0.0',
        id: templateWithTrace.metadata.id,
        title: templateWithTrace.metadata.title,
        createdAt: templateWithTrace.metadata.createdAt,
        updatedAt: new Date().toISOString(),
        targetDpi: templateWithTrace.pageSettings.targetDpi,
        pageSize: {
          width: templateWithTrace.pageSettings.width,
          height: templateWithTrace.pageSettings.height,
          unit: templateWithTrace.pageSettings.unit,
        },
        assetCount: 0,
        hasTraceBackground: true,
      };

      const archiveBytes = await serializeUts({
        manifest,
        template: templateWithTrace,
        assets: new Map(),
        traceBackground: traceFile,
      });

      const opened = await executeOpenTemplate(archiveBytes, 'TraceOpen.uts', null, true);
      expect(opened).toBe(true);

      const currentTemplate = useTemplateStore.getState().template;
      expect(currentTemplate.traceBackground?.fileRef).toBe('background/mockup.svg');
      expect(currentTemplate.traceBackground?.opacity).toBe(0.25);

      const docStore = useDocumentStore.getState();
      expect(docStore.traceBackgroundFile?.filename).toBe('mockup.svg');
      expect(docStore.traceBackgroundFile?.data).toEqual(sampleSvgBytes);
    });

    it('clears trace background when executeNewTemplate is called', () => {
      useTemplateStore.getState().setTraceBackground({
        enabled: true,
        fileRef: 'background/old.png',
        opacity: 0.5,
        pageIndex: 0,
      });
      useDocumentStore.getState().setTraceBackgroundFile({
        filename: 'old.png',
        mimeType: 'image/png',
        data: samplePngBytes,
      });

      executeNewTemplate(true);

      expect(useTemplateStore.getState().template.traceBackground).toBeUndefined();
      expect(useDocumentStore.getState().traceBackgroundFile).toBeNull();
      expect(useDocumentStore.getState().getTraceBackgroundUrl()).toBeNull();
    });
  });

  describe('5. Session Recovery Persistence & Restoration', () => {
    it('persists and restores trace background across simulated browser crash/refresh', async () => {
      const templateWithTrace: TemplateAst = {
        ...cloneTemplateAst(DEFAULT_A4_TEMPLATE),
        traceBackground: {
          enabled: true,
          fileRef: 'background/crash_recovery.png',
          opacity: 0.6,
          pageIndex: 0,
        },
      };

      const traceFile: UtsTraceFile = {
        filename: 'crash_recovery.png',
        mimeType: 'image/png',
        data: samplePngBytes,
      };

      // 1. Save session recovery with trace background
      const saved = await saveSessionRecovery({
        template: templateWithTrace,
        savedBaseline: DEFAULT_A4_TEMPLATE,
        filename: 'UnsavedSession.uts',
        isDirty: true,
        assets: new Map(),
        hasSavedFile: false,
        traceBackground: traceFile,
      });
      expect(saved).toBe(true);

      // 2. Clear stores to simulate fresh browser load
      useTemplateStore.getState().setTemplate(createBlankTemplate());
      useDocumentStore.getState().resetSession(createBlankTemplate());
      expect(useTemplateStore.getState().template.traceBackground).toBeUndefined();
      expect(useDocumentStore.getState().traceBackgroundFile).toBeNull();

      // 3. Load recovery record
      const record = await loadSessionRecovery();
      expect(record).not.toBeNull();
      expect(record?.traceBackground).toBeDefined();
      expect(record?.traceBackground?.filename).toBe('crash_recovery.png');

      // 4. Restore session recovery into runtime stores
      const result = restoreSessionRecovery(record!);
      expect(result.recovered).toBe(true);
      expect(result.isDirty).toBe(true);

      // 5. Verify stores are fully restored
      const restoredTemplate = useTemplateStore.getState().template;
      expect(restoredTemplate.traceBackground).toBeDefined();
      expect(restoredTemplate.traceBackground?.fileRef).toBe('background/crash_recovery.png');
      expect(restoredTemplate.traceBackground?.opacity).toBe(0.6);

      const docStore = useDocumentStore.getState();
      expect(docStore.traceBackgroundFile).not.toBeNull();
      expect(docStore.traceBackgroundFile?.filename).toBe('crash_recovery.png');
      expect(docStore.traceBackgroundFile?.data).toEqual(samplePngBytes);
      expect(docStore.getTraceBackgroundUrl()).toBeTruthy();
    });
  });

  describe('6. Canvas Rendering & Isolation', () => {
    it('renders trace background descriptor with pointer-events: none and meet aspect ratio', () => {
      const traceUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const desc = renderTraceBackgroundDescriptor({
        traceBackground: {
          enabled: true,
          fileRef: 'background/mock.png',
          opacity: 0.35,
          pageIndex: 0,
        },
        traceUrl,
        pageWidthMm: 210,
        pageHeightMm: 297,
        zoom: 1,
      });

      expect(desc).not.toBeNull();
      expect(desc?.tag).toBe('image');
      expect(desc?.attrs.href).toBe(traceUrl);
      expect(desc?.attrs.preserveAspectRatio).toBe('xMidYMid meet');
      expect(desc?.attrs.opacity).toBe(0.35);
      expect(desc?.attrs.style).toBe('pointer-events: none');
      expect(desc?.attrs.width).toBeGreaterThan(0);
      expect(desc?.attrs.height).toBeGreaterThan(0);

      const svgString = renderTraceBackgroundToString({
        traceBackground: {
          enabled: true,
          fileRef: 'background/mock.png',
          opacity: 0.35,
          pageIndex: 0,
        },
        traceUrl,
        pageWidthMm: 210,
        pageHeightMm: 297,
        zoom: 1,
      });

      expect(svgString).toContain('<image');
      expect(svgString).toContain('preserveAspectRatio="xMidYMid meet"');
      expect(svgString).toContain('opacity="0.35"');
      expect(svgString).toContain('style="pointer-events: none"');
    });

    it('returns null and empty string when trace background is disabled', () => {
      const traceUrl = 'data:image/png;base64,sample';

      const desc = renderTraceBackgroundDescriptor({
        traceBackground: {
          enabled: false,
          fileRef: 'background/mock.png',
          opacity: 0.35,
          pageIndex: 0,
        },
        traceUrl,
        pageWidthMm: 210,
        pageHeightMm: 297,
      });

      expect(desc).toBeNull();

      const str = renderTraceBackgroundToString({
        traceBackground: {
          enabled: false,
          fileRef: 'background/mock.png',
          opacity: 0.35,
          pageIndex: 0,
        },
        traceUrl,
        pageWidthMm: 210,
        pageHeightMm: 297,
      });

      expect(str).toBe('');
    });

    it('returns null when traceUrl is empty or null', () => {
      const desc = renderTraceBackgroundDescriptor({
        traceBackground: {
          enabled: true,
          fileRef: 'background/mock.png',
          opacity: 0.5,
          pageIndex: 0,
        },
        traceUrl: '',
        pageWidthMm: 210,
        pageHeightMm: 297,
      });

      expect(desc).toBeNull();
    });
  });
});
