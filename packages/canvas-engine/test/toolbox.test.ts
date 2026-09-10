import { describe, it, expect, beforeEach } from 'vitest';
import {
  templateElementSchema,
  textElementSchema,
  shapeElementSchema,
  barcodeElementSchema,
  imageElementSchema,
  type TemplateAst,
  type PageSettings,
} from '@uts/core';
import {
  createTextTemplate,
  createRectangleTemplate,
  createRoundedRectangleTemplate,
  createEllipseTemplate,
  createLineTemplate,
  createBarcodeTemplate,
  createQrCodeTemplate,
  createImageTemplate,
  createElementFromTemplate,
  calculateInitialBounds,
  PLACEHOLDER_IMAGE_SVG,
  type PlacementOptions,
} from '../../../apps/web/src/components/toolbox/elementTemplates.ts';
import { useTemplateStore } from '../../../apps/web/src/store/useTemplateStore.ts';
import { useHistoryStore } from '../../../apps/web/src/store/history/useHistoryStore.ts';
import { useDocumentStore } from '../../../apps/web/src/store/document/useDocumentStore.ts';
import { useUIStore } from '../../../apps/web/src/store/useUIStore.ts';

describe('UniTemplate Toolbox — Element Insertion & Factories', () => {
  const defaultPageSettings: PageSettings = {
    unit: 'mm',
    width: 210,
    height: 297,
    orientation: 'portrait',
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    targetDpi: 300,
  };

  const defaultViewport = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    viewportWidth: 800,
    viewportHeight: 600,
  };

  beforeEach(() => {
    // Reset stores to a clean baseline
    const initialTemplate: TemplateAst = {
      schemaVersion: '1.0.0',
      metadata: {
        id: 'test_tpl',
        title: 'Toolbox Test Template',
        createdAt: '2026-09-10T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
      },
      pageSettings: defaultPageSettings,
      dataSchema: { fields: [], mockPayload: {} },
      elements: [],
    };

    useTemplateStore.getState().setTemplate(initialTemplate);
    useHistoryStore.getState().clearHistory();
    useDocumentStore.getState().resetSession(initialTemplate, 'test.uts');
    useUIStore.getState().clearSelection();
  });

  describe('1. Element Template Factories & AST Schema Conformance', () => {
    const options: PlacementOptions = {
      pageSettings: defaultPageSettings,
      viewport: defaultViewport,
      existingElements: [],
    };

    it('creates a valid Text element complying with TextElementSchema', () => {
      const text = createTextTemplate(options);
      expect(text.type).toBe('text');
      expect(text.content).toBe('Text Box');
      expect(text.bounds.width).toBeGreaterThan(0);
      expect(text.bounds.height).toBeGreaterThan(0);
      expect(text.style.fontFamily).toBeDefined();
      expect(text.style.fontSizePt).toBe(14);
      expect(text.style.lineHeight).toBe(1.2);

      // Strict Zod parsing
      expect(() => textElementSchema.parse(text)).not.toThrow();
      expect(() => templateElementSchema.parse(text)).not.toThrow();
    });

    it('creates a valid Rectangle element complying with ShapeElementSchema', () => {
      const rect = createRectangleTemplate(options);
      expect(rect.type).toBe('shape');
      expect(rect.shapeType).toBe('rectangle');
      expect(rect.cornerRadiusMm).toBe(0);
      expect(rect.fillColor).toBe('#e2e8f0');
      expect(rect.strokeColor).toBe('#475569');
      expect(rect.strokeWidthMm).toBe(0.5);

      expect(() => shapeElementSchema.parse(rect)).not.toThrow();
      expect(() => templateElementSchema.parse(rect)).not.toThrow();
    });

    it('creates a valid Rounded Rectangle element with corner radius', () => {
      const rounded = createRoundedRectangleTemplate(options);
      expect(rounded.type).toBe('shape');
      expect(rounded.shapeType).toBe('rounded-rectangle');
      expect(rounded.cornerRadiusMm).toBe(3);

      expect(() => shapeElementSchema.parse(rounded)).not.toThrow();
      expect(() => templateElementSchema.parse(rounded)).not.toThrow();
    });

    it('creates a valid Ellipse element complying with ShapeElementSchema', () => {
      const ellipse = createEllipseTemplate(options);
      expect(ellipse.type).toBe('shape');
      expect(ellipse.shapeType).toBe('ellipse');
      expect(ellipse.bounds.width).toBe(35);
      expect(ellipse.bounds.height).toBe(35);

      expect(() => shapeElementSchema.parse(ellipse)).not.toThrow();
      expect(() => templateElementSchema.parse(ellipse)).not.toThrow();
    });

    it('creates a valid horizontal Line element with height 0 and width > 0', () => {
      const line = createLineTemplate(options);
      expect(line.type).toBe('shape');
      expect(line.shapeType).toBe('line');
      expect(line.bounds.width).toBe(60);
      expect(line.bounds.height).toBe(0);
      expect(line.fillColor).toBe('transparent');

      expect(() => shapeElementSchema.parse(line)).not.toThrow();
      expect(() => templateElementSchema.parse(line)).not.toThrow();
    });

    it('creates a valid Barcode element supporting Code 128 format', () => {
      const barcode = createBarcodeTemplate(options);
      expect(barcode.type).toBe('barcode');
      expect(barcode.barcodeType).toBe('code128');
      expect(barcode.content).toBe('12345678');
      expect(barcode.showText).toBe(true);

      expect(() => barcodeElementSchema.parse(barcode)).not.toThrow();
      expect(() => templateElementSchema.parse(barcode)).not.toThrow();
    });

    it('creates a valid QR Code element with QR format and error correction', () => {
      const qr = createQrCodeTemplate(options);
      expect(qr.type).toBe('barcode');
      expect(qr.barcodeType).toBe('qr');
      expect(qr.content).toBe('https://example.com');
      expect(qr.errorCorrectionLevel).toBe('M');
      expect(qr.showText).toBe(false);

      expect(() => barcodeElementSchema.parse(qr)).not.toThrow();
      expect(() => templateElementSchema.parse(qr)).not.toThrow();
    });

    it('creates a valid Image element with safe placeholder SVG data URI', () => {
      const image = createImageTemplate(options);
      expect(image.type).toBe('image');
      expect(image.fit).toBe('contain');
      expect(image.opacity).toBe(1);
      expect(image.assetRef).toBe(PLACEHOLDER_IMAGE_SVG);

      expect(() => imageElementSchema.parse(image)).not.toThrow();
      expect(() => templateElementSchema.parse(image)).not.toThrow();
    });

    it('createElementFromTemplate dispatches all 8 supported types properly', () => {
      const types = [
        'text',
        'rectangle',
        'rounded-rectangle',
        'ellipse',
        'line',
        'barcode',
        'qr',
        'image',
      ] as const;

      types.forEach((type) => {
        const el = createElementFromTemplate(type, options);
        expect(el).toBeDefined();
        expect(el.id).toBeTruthy();
        expect(() => templateElementSchema.parse(el)).not.toThrow();
      });
    });
  });

  describe('2. Placement Calculations & Clamping', () => {
    it('places elements within page margins', () => {
      const bounds = calculateInitialBounds(60, 20, {
        pageSettings: defaultPageSettings,
        viewport: defaultViewport,
      });

      expect(bounds.x).toBeGreaterThanOrEqual(defaultPageSettings.margins.left);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(
        defaultPageSettings.width - defaultPageSettings.margins.right,
      );
      expect(bounds.y).toBeGreaterThanOrEqual(defaultPageSettings.margins.top);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(
        defaultPageSettings.height - defaultPageSettings.margins.bottom,
      );
    });

    it('staggers consecutive insertions when an element exists at same spot', () => {
      const first = calculateInitialBounds(50, 30, {
        pageSettings: defaultPageSettings,
        viewport: defaultViewport,
      });

      const existingElement = createRectangleTemplate({
        pageSettings: defaultPageSettings,
        viewport: defaultViewport,
      });
      existingElement.bounds = first;

      const second = calculateInitialBounds(50, 30, {
        pageSettings: defaultPageSettings,
        viewport: defaultViewport,
        existingElements: [existingElement],
      });

      expect(second.x).toBe(first.x + 5);
      expect(second.y).toBe(first.y + 5);
    });

    it('increments zIndex monotonically with each insertion', () => {
      const first = createTextTemplate({
        pageSettings: defaultPageSettings,
        existingElements: [],
      });
      expect(first.zIndex).toBe(1);

      const second = createRectangleTemplate({
        pageSettings: defaultPageSettings,
        existingElements: [first],
      });
      expect(second.zIndex).toBe(2);
    });
  });

  describe('3. Store Integration, Selection & Undo/Redo', () => {
    it('calling addElement appends element, marks document dirty, and supports undo/redo', () => {
      expect(useTemplateStore.getState().template.elements.length).toBe(0);
      expect(useDocumentStore.getState().isDirty).toBe(false);

      const newEl = createTextTemplate({
        pageSettings: defaultPageSettings,
        existingElements: [],
      });

      // Insert element
      useTemplateStore.getState().addElement(newEl);
      useUIStore.getState().selectElement(newEl.id);

      // Verify element is present and selected
      expect(useTemplateStore.getState().template.elements.length).toBe(1);
      expect(useTemplateStore.getState().template.elements[0].id).toBe(newEl.id);
      expect(useUIStore.getState().selectedElementIds).toEqual([newEl.id]);
      expect(useDocumentStore.getState().isDirty).toBe(true);

      // Undo insertion
      expect(useHistoryStore.getState().canUndo).toBe(true);
      useHistoryStore.getState().undo();

      expect(useTemplateStore.getState().template.elements.length).toBe(0);
      expect(useDocumentStore.getState().isDirty).toBe(false);

      // Redo insertion
      expect(useHistoryStore.getState().canRedo).toBe(true);
      useHistoryStore.getState().redo();

      expect(useTemplateStore.getState().template.elements.length).toBe(1);
      expect(useTemplateStore.getState().template.elements[0].id).toBe(newEl.id);
      expect(useDocumentStore.getState().isDirty).toBe(true);
    });
  });
});

