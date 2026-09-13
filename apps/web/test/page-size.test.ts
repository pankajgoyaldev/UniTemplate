import { describe, it, expect, beforeEach } from 'vitest';
import {
  serializeUts,
  parseUts,
  PAGE_SIZE_PRESETS,
  getPageSizePresetId,
  type TemplateAst,
  type TextElement,
} from '@uts/core';
import { calculateRulerTicks } from '@uts/canvas-engine';
import { useTemplateStore } from '../src/store/useTemplateStore.js';
import { useHistoryStore } from '../src/store/history/useHistoryStore.js';
import { DEFAULT_A4_TEMPLATE } from '../src/store/defaultTemplate.js';

describe('Page Size Setup Feature', () => {
  beforeEach(() => {
    useHistoryStore.getState().clearHistory();
    // Deep clone default template with empty elements for isolated testing
    const cleanTemplate: TemplateAst = JSON.parse(JSON.stringify(DEFAULT_A4_TEMPLATE));
    cleanTemplate.elements = [];
    useTemplateStore.getState().setTemplate(cleanTemplate);
  });

  describe('1. Standard Presets & Preset Matching', () => {
    it('defines standard presets: A4 (210×297), A5 (148×210), Letter (215.9×279.4)', () => {
      const a4 = PAGE_SIZE_PRESETS.find((p) => p.id === 'a4');
      expect(a4).toBeDefined();
      expect(a4?.widthMm).toBe(210);
      expect(a4?.heightMm).toBe(297);

      const a5 = PAGE_SIZE_PRESETS.find((p) => p.id === 'a5');
      expect(a5).toBeDefined();
      expect(a5?.widthMm).toBe(148);
      expect(a5?.heightMm).toBe(210);

      const letter = PAGE_SIZE_PRESETS.find((p) => p.id === 'letter');
      expect(letter).toBeDefined();
      expect(letter?.widthMm).toBe(215.9);
      expect(letter?.heightMm).toBe(279.4);
    });

    it('correctly matches preset IDs for portrait and landscape', () => {
      expect(getPageSizePresetId(210, 297)).toBe('a4');
      expect(getPageSizePresetId(297, 210)).toBe('a4');

      expect(getPageSizePresetId(148, 210)).toBe('a5');
      expect(getPageSizePresetId(210, 148)).toBe('a5');

      expect(getPageSizePresetId(215.9, 279.4)).toBe('letter');
      expect(getPageSizePresetId(279.4, 215.9)).toBe('letter');

      expect(getPageSizePresetId(100, 150)).toBe('custom');
    });

    it('applies A4 preset to template store', () => {
      useTemplateStore.getState().updatePageSettings({ width: 210, height: 297, orientation: 'portrait' });
      const settings = useTemplateStore.getState().template.pageSettings;
      expect(settings.width).toBe(210);
      expect(settings.height).toBe(297);
      expect(settings.orientation).toBe('portrait');
      expect(getPageSizePresetId(settings.width, settings.height)).toBe('a4');
    });

    it('applies A5 preset to template store', () => {
      useTemplateStore.getState().updatePageSettings({ width: 148, height: 210, orientation: 'portrait' });
      const settings = useTemplateStore.getState().template.pageSettings;
      expect(settings.width).toBe(148);
      expect(settings.height).toBe(210);
      expect(getPageSizePresetId(settings.width, settings.height)).toBe('a5');
    });

    it('applies Letter preset to template store', () => {
      useTemplateStore.getState().updatePageSettings({ width: 215.9, height: 279.4, orientation: 'portrait' });
      const settings = useTemplateStore.getState().template.pageSettings;
      expect(settings.width).toBe(215.9);
      expect(settings.height).toBe(279.4);
      expect(getPageSizePresetId(settings.width, settings.height)).toBe('letter');
    });
  });

  describe('2. Custom Dimensions', () => {
    it('applies custom dimensions 100 × 150 mm', () => {
      useTemplateStore.getState().updatePageSettings({ width: 100, height: 150 });
      const settings = useTemplateStore.getState().template.pageSettings;
      expect(settings.width).toBe(100);
      expect(settings.height).toBe(150);
      expect(getPageSizePresetId(settings.width, settings.height)).toBe('custom');
    });

    it('allows changing width only without modifying height', () => {
      useTemplateStore.getState().updatePageSettings({ width: 160 });
      const settings = useTemplateStore.getState().template.pageSettings;
      expect(settings.width).toBe(160);
      expect(settings.height).toBe(297); // Original A4 height remains untouched
    });

    it('allows changing height only without modifying width', () => {
      useTemplateStore.getState().updatePageSettings({ height: 250 });
      const settings = useTemplateStore.getState().template.pageSettings;
      expect(settings.width).toBe(210); // Original A4 width remains untouched
      expect(settings.height).toBe(250);
    });

    it('sanitizes non-positive width and height inputs', () => {
      useTemplateStore.getState().updatePageSettings({ width: -50, height: 0 });
      const settings = useTemplateStore.getState().template.pageSettings;
      expect(settings.width).toBeGreaterThan(0);
      expect(settings.height).toBeGreaterThan(0);
    });
  });

  describe('3. Orientation Handling', () => {
    it('swapping width and height updates orientation', () => {
      // Start in portrait (210 × 297)
      expect(useTemplateStore.getState().template.pageSettings.orientation).toBe('portrait');

      // Swap to landscape (297 × 210)
      useTemplateStore.getState().updatePageSettings({
        width: 297,
        height: 210,
        orientation: 'landscape',
      });
      const settings = useTemplateStore.getState().template.pageSettings;
      expect(settings.width).toBe(297);
      expect(settings.height).toBe(210);
      expect(settings.orientation).toBe('landscape');
    });
  });

  describe('4. Preservation of Existing Elements', () => {
    it('does not delete or scale elements when page size changes', () => {
      const textEl: TextElement = {
        id: 'test_text_1',
        type: 'text',
        name: 'Heading',
        bounds: { x: 50, y: 75, width: 80, height: 25, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        content: 'Invoice Header',
        style: {
          fontFamily: 'Inter',
          fontSizePt: 16,
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#111827',
          alignment: 'left',
          lineHeight: 1.2,
          autoWrap: true,
        },
      };

      useTemplateStore.getState().addElement(textEl);
      expect(useTemplateStore.getState().template.elements).toHaveLength(1);

      // Change page size to custom 100 × 150 mm
      useTemplateStore.getState().updatePageSettings({ width: 100, height: 150 });

      // Verify element is completely preserved
      const elementsAfter = useTemplateStore.getState().template.elements;
      expect(elementsAfter).toHaveLength(1);
      expect(elementsAfter[0].id).toBe('test_text_1');
      expect(elementsAfter[0].bounds).toEqual({ x: 50, y: 75, width: 80, height: 25, rotation: 0 });
      expect((elementsAfter[0] as TextElement).content).toBe('Invoice Header');
    });

    it('preserves elements even if page size becomes smaller than element coordinates', () => {
      const textEl: TextElement = {
        id: 'out_of_bounds_el',
        type: 'text',
        name: 'Footer',
        bounds: { x: 180, y: 250, width: 30, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        content: 'Page 1 of 1',
        style: {
          fontFamily: 'Inter',
          fontSizePt: 10,
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#6b7280',
          alignment: 'right',
          lineHeight: 1.2,
          autoWrap: true,
        },
      };

      useTemplateStore.getState().addElement(textEl);

      // Shrink page to 100 × 100 mm (smaller than element x=180, y=250)
      useTemplateStore.getState().updatePageSettings({ width: 100, height: 100 });

      // Elements must NOT be deleted or corrupted
      const elements = useTemplateStore.getState().template.elements;
      expect(elements).toHaveLength(1);
      expect(elements[0].id).toBe('out_of_bounds_el');
      expect(elements[0].bounds.x).toBe(180);
      expect(elements[0].bounds.y).toBe(250);
    });
  });

  describe('5. Undo and Redo', () => {
    it('supports undo and redo for page-size changes in the exact history sequence', () => {
      // Step 1: Initial state is A4 (210 × 297)
      expect(useTemplateStore.getState().template.pageSettings.width).toBe(210);
      expect(useTemplateStore.getState().template.pageSettings.height).toBe(297);

      // Step 2: Change to Custom 100 × 150
      useTemplateStore.getState().updatePageSettings({ width: 100, height: 150 });
      expect(useTemplateStore.getState().template.pageSettings.width).toBe(100);
      expect(useTemplateStore.getState().template.pageSettings.height).toBe(150);

      // Step 3: Change to Custom 120 × 180
      useTemplateStore.getState().updatePageSettings({ width: 120, height: 180 });
      expect(useTemplateStore.getState().template.pageSettings.width).toBe(120);
      expect(useTemplateStore.getState().template.pageSettings.height).toBe(180);

      // Step 4: Undo -> should restore 100 × 150
      expect(useHistoryStore.getState().canUndo).toBe(true);
      useHistoryStore.getState().undo();
      expect(useTemplateStore.getState().template.pageSettings.width).toBe(100);
      expect(useTemplateStore.getState().template.pageSettings.height).toBe(150);

      // Step 5: Undo -> should restore original A4 (210 × 297)
      expect(useHistoryStore.getState().canUndo).toBe(true);
      useHistoryStore.getState().undo();
      expect(useTemplateStore.getState().template.pageSettings.width).toBe(210);
      expect(useTemplateStore.getState().template.pageSettings.height).toBe(297);

      // Step 6: Redo -> should restore 100 × 150
      expect(useHistoryStore.getState().canRedo).toBe(true);
      useHistoryStore.getState().redo();
      expect(useTemplateStore.getState().template.pageSettings.width).toBe(100);
      expect(useTemplateStore.getState().template.pageSettings.height).toBe(150);

      // Step 7: Redo -> should restore 120 × 180
      expect(useHistoryStore.getState().canRedo).toBe(true);
      useHistoryStore.getState().redo();
      expect(useTemplateStore.getState().template.pageSettings.width).toBe(120);
      expect(useTemplateStore.getState().template.pageSettings.height).toBe(180);
    });
  });

  describe('6. Save / Load Persistence', () => {
    it('persists custom page dimensions through serializeUts and parseUts', async () => {
      // Set a custom size
      useTemplateStore.getState().updatePageSettings({
        width: 125.5,
        height: 175.5,
        orientation: 'portrait',
      });

      const template = useTemplateStore.getState().template;
      expect(template.pageSettings.width).toBe(125.5);
      expect(template.pageSettings.height).toBe(175.5);

      // Serialize into .uts package
      const pkg = {
        template,
        assets: new Map(),
      };
      const bytes = await serializeUts(pkg);
      expect(bytes.byteLength).toBeGreaterThan(0);

      // Parse package back
      const parsedPkg = await parseUts(bytes);
      expect(parsedPkg.template.pageSettings.width).toBe(125.5);
      expect(parsedPkg.template.pageSettings.height).toBe(175.5);
      expect(parsedPkg.template.pageSettings.unit).toBe('mm');
      expect(parsedPkg.template.pageSettings.orientation).toBe('portrait');
      expect(parsedPkg.manifest.pageSize).toEqual({
        width: 125.5,
        height: 175.5,
        unit: 'mm',
      });
    });
  });

  describe('7. Ruler Metric Integration', () => {
    it('calculates ruler ticks accurately for newly configured page sizes', () => {
      // When page width is 100mm at 1.0x zoom (96 DPI):
      // pxPerMm = (96 / 25.4) * 1.0 ~= 3.7795 px/mm
      // Total screen width for 100mm = 377.95 px
      const pxPerMm = (96 / 25.4);
      const rulerLengthPx = 100 * pxPerMm;

      const ticks = calculateRulerTicks(0, 1.0, rulerLengthPx);
      expect(ticks.length).toBeGreaterThan(0);

      const majorTicks = ticks.filter((t) => t.type === 'major');
      // Major intervals at 1.0x zoom (96 DPI) are every 20mm
      expect(majorTicks.some((t) => t.positionMm === 0)).toBe(true);
      expect(majorTicks.some((t) => t.positionMm === 20)).toBe(true);
      expect(majorTicks.some((t) => t.positionMm === 100)).toBe(true);
    });
  });
});
