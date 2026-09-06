import { describe, it, expect } from 'vitest';
import type {
  TextElement,
  ShapeElement,
  ImageElement,
  BarcodeElement,
  TemplateElement,
} from '@uts/core';
import {
  renderTextElement,
  renderTextElementToString,
  breakTextLines,
} from '../src/renderers/text-renderer.js';
import {
  renderShapeElement,
  renderShapeElementToString,
  getStrokeDashArray,
} from '../src/renderers/shape-renderer.js';
import {
  renderImageElement,
  renderImageElementToString,
  getSvgPreserveAspectRatio,
} from '../src/renderers/image-renderer.js';
import {
  renderBarcodeElement,
  renderBarcodeElementToString,
  generateBarcodeVector,
  mapBarcodeTypeToBcid,
} from '../src/renderers/barcode-renderer.js';
import {
  renderElement,
  renderElementToString,
  renderTemplateElements,
  renderTemplateElementsToString,
} from '../src/renderers/element-renderer.js';

describe('Vector Renderers Engine', () => {
  const defaultContext = {
    zoom: 1.0,
    dpi: 96,
  };

  describe('1. Text Element Renderer', () => {
    const sampleText: TextElement = {
      id: 'txt_01',
      type: 'text',
      name: 'Invoice Header',
      bounds: { x: 20, y: 15, width: 80, height: 20, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 1,
      content: 'TAX INVOICE\nCustomer Copy',
      style: {
        fontFamily: 'Inter',
        fontSizePt: 16,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#1e293b',
        alignment: 'center',
        lineHeight: 1.25,
        autoWrap: true,
      },
    };

    it('accurately calculates millimeter coordinates and font size pt to pixels', () => {
      const descriptor = renderTextElement(sampleText, defaultContext);
      expect(descriptor.tag).toBe('text');
      expect(descriptor.attrs['font-family']).toBe('Inter');
      expect(descriptor.attrs['font-weight']).toBe('bold');
      expect(descriptor.attrs['text-anchor']).toBe('middle');

      // 16pt font at 96 DPI: (16 / 72) * 96 = 21.333px
      expect(descriptor.attrs['font-size']).toBeCloseTo((16 / 72) * 96, 2);
    });

    it('correctly creates tspans for multi-line text', () => {
      const descriptor = renderTextElement(sampleText, defaultContext);
      expect(descriptor.children).toBeDefined();
      expect(descriptor.children).toHaveLength(2); // 2 lines

      const tspan1 = descriptor.children![0] as any;
      expect(tspan1.tag).toBe('tspan');
      expect(tspan1.children![0]).toBe('TAX INVOICE');

      const tspan2 = descriptor.children![1] as any;
      expect(tspan2.tag).toBe('tspan');
      expect(tspan2.children![0]).toBe('Customer Copy');
    });

    it('breaks lines with auto-wrap when line exceeds bounding width', () => {
      const longText = 'The quick brown fox jumps over the lazy dog repeatedly';
      const lines = breakTextLines(longText, 100, 8, true);
      expect(lines.length).toBeGreaterThan(1);
    });

    it('generates valid SVG text markup', () => {
      const svgString = renderTextElementToString(sampleText, defaultContext);
      expect(svgString).toContain('<text');
      expect(svgString).toContain('font-family="Inter"');
      expect(svgString).toContain('TAX INVOICE');
      expect(svgString).toContain('</text>');
    });

    it('applies rotation transform when rotation is non-zero', () => {
      const rotatedText: TextElement = {
        ...sampleText,
        bounds: { ...sampleText.bounds, rotation: 45 },
      };
      const descriptor = renderTextElement(rotatedText, defaultContext);
      expect(descriptor.tag).toBe('g');
      expect(descriptor.attrs.transform).toContain('rotate(45');
    });
  });

  describe('2. Shape Elements Renderer', () => {
    it('renders a rectangle with stroke and fill in physical mm', () => {
      const rect: ShapeElement = {
        id: 'rect_01',
        type: 'shape',
        name: 'Box',
        bounds: { x: 10, y: 10, width: 50, height: 30, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#3b82f6',
        strokeColor: '#1d4ed8',
        strokeWidthMm: 1,
      };

      const descriptor = renderShapeElement(rect, defaultContext);
      expect(descriptor.tag).toBe('rect');
      expect(descriptor.attrs.fill).toBe('#3b82f6');
      expect(descriptor.attrs.stroke).toBe('#1d4ed8');

      // 50mm width at 96 DPI: (50 / 25.4) * 96 = 188.976px
      expect(Number(descriptor.attrs.width)).toBeCloseTo((50 / 25.4) * 96, 2);
    });

    it('renders a rounded-rectangle with rx and ry corner radius', () => {
      const roundedRect: ShapeElement = {
        id: 'rrect_01',
        type: 'shape',
        name: 'Card',
        bounds: { x: 10, y: 10, width: 40, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rounded-rectangle',
        fillColor: 'transparent',
        strokeColor: '#000000',
        strokeWidthMm: 0.5,
        cornerRadiusMm: 4,
      };

      const descriptor = renderShapeElement(roundedRect, defaultContext);
      expect(descriptor.tag).toBe('rect');
      expect(Number(descriptor.attrs.rx)).toBeCloseTo((4 / 25.4) * 96, 2);
      expect(Number(descriptor.attrs.ry)).toBeCloseTo((4 / 25.4) * 96, 2);
    });

    it('renders an ellipse with center and radii', () => {
      const ellipse: ShapeElement = {
        id: 'el_01',
        type: 'shape',
        name: 'Circle',
        bounds: { x: 20, y: 20, width: 30, height: 30, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'ellipse',
        fillColor: '#ef4444',
        strokeColor: 'transparent',
        strokeWidthMm: 0,
      };

      const descriptor = renderShapeElement(ellipse, defaultContext);
      expect(descriptor.tag).toBe('ellipse');
      expect(descriptor.attrs.rx).toBeCloseTo(((30 / 25.4) * 96) / 2, 2);
      expect(descriptor.attrs.ry).toBeCloseTo(((30 / 25.4) * 96) / 2, 2);
    });

    it('renders a line element with x1, y1, x2, y2', () => {
      const line: ShapeElement = {
        id: 'line_01',
        type: 'shape',
        name: 'Separator',
        bounds: { x: 10, y: 50, width: 100, height: 0, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'line',
        fillColor: 'transparent',
        strokeColor: '#64748b',
        strokeWidthMm: 0.5,
      };

      const descriptor = renderShapeElement(line, defaultContext);
      expect(descriptor.tag).toBe('line');
      expect(Number(descriptor.attrs.x1)).toBeCloseTo((10 / 25.4) * 96, 2);
      expect(Number(descriptor.attrs.x2)).toBeCloseTo((110 / 25.4) * 96, 2);
    });

    it('handles dashed and dotted stroke dash arrays', () => {
      expect(getStrokeDashArray('solid', 2)).toBeUndefined();
      expect(getStrokeDashArray('dashed', 2)).toBe('8 4');
      expect(getStrokeDashArray('dotted', 2)).toBe('2 4');
    });
  });

  describe('3. Image Element Renderer', () => {
    const sampleImage: ImageElement = {
      id: 'img_01',
      type: 'image',
      name: 'Logo',
      bounds: { x: 15, y: 15, width: 40, height: 20, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 1,
      assetRef: 'logo_company.png',
      fit: 'contain',
      opacity: 0.85,
    };

    it('maps fit modes to correct SVG preserveAspectRatio values', () => {
      expect(getSvgPreserveAspectRatio('contain')).toBe('xMidYMid meet');
      expect(getSvgPreserveAspectRatio('cover')).toBe('xMidYMid slice');
      expect(getSvgPreserveAspectRatio('stretch')).toBe('none');
    });

    it('renders SVG image element with resolved URL and opacity', () => {
      const contextWithResolver = {
        ...defaultContext,
        assetResolver: (ref: string) => `https://assets.local/${ref}`,
      };

      const descriptor = renderImageElement(sampleImage, contextWithResolver);
      expect(descriptor.tag).toBe('image');
      expect(descriptor.attrs.href).toBe('https://assets.local/logo_company.png');
      expect(descriptor.attrs.preserveAspectRatio).toBe('xMidYMid meet');
      expect(descriptor.attrs.opacity).toBe(0.85);
    });

    it('generates valid SVG image XML string', () => {
      const svg = renderImageElementToString(sampleImage, defaultContext);
      expect(svg).toContain('<image');
      expect(svg).toContain('href="logo_company.png"');
      expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    });
  });

  describe('4. Barcode Element Renderer (bwip-js integration)', () => {
    it('correctly maps BarcodeType to bwip-js bcid', () => {
      expect(mapBarcodeTypeToBcid('code128')).toBe('code128');
      expect(mapBarcodeTypeToBcid('ean13')).toBe('ean13');
      expect(mapBarcodeTypeToBcid('qr')).toBe('qrcode');
    });

    it('renders vector Code128 barcode with viewBox and path content', () => {
      const barcode: BarcodeElement = {
        id: 'bc_code128',
        type: 'barcode',
        name: 'Order Barcode',
        bounds: { x: 10, y: 10, width: 60, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        barcodeType: 'code128',
        content: 'INV-2026-9901',
        showText: true,
      };

      const vector = generateBarcodeVector(barcode);
      expect(vector.rawSvg).toContain('<svg');
      expect(vector.viewBox).toBeDefined();
      expect(vector.innerContent.length).toBeGreaterThan(50);

      const descriptor = renderBarcodeElement(barcode, defaultContext);
      expect(descriptor.tag).toBe('svg');
      expect(descriptor.innerHTML).toContain('path');
    });

    it('renders vector EAN-13 barcode', () => {
      const eanBarcode: BarcodeElement = {
        id: 'bc_ean13',
        type: 'barcode',
        name: 'Product EAN',
        bounds: { x: 10, y: 10, width: 50, height: 25, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        barcodeType: 'ean13',
        content: '590123412345',
        showText: true,
      };

      const descriptor = renderBarcodeElement(eanBarcode, defaultContext);
      expect(descriptor.tag).toBe('svg');
      expect(descriptor.attrs['data-barcode-type']).toBe('ean13');
      expect(descriptor.innerHTML).toBeDefined();
    });

    it('renders vector QR Code with square aspect ratio and error correction', () => {
      const qrBarcode: BarcodeElement = {
        id: 'bc_qr',
        type: 'barcode',
        name: 'Verify QR',
        bounds: { x: 10, y: 10, width: 30, height: 30, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        barcodeType: 'qr',
        content: 'https://universe.studio/verify',
        showText: false,
        errorCorrectionLevel: 'H',
      };

      const descriptor = renderBarcodeElement(qrBarcode, defaultContext);
      expect(descriptor.tag).toBe('svg');
      expect(descriptor.attrs.preserveAspectRatio).toBe('xMidYMid meet');
      expect(descriptor.innerHTML).toBeDefined();
    });

    it('handles barcode encoding errors gracefully without throwing', () => {
      const invalidBarcode: BarcodeElement = {
        id: 'bc_bad',
        type: 'barcode',
        name: 'Bad EAN',
        bounds: { x: 10, y: 10, width: 50, height: 25, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        barcodeType: 'ean13',
        content: 'abc', // Invalid for EAN-13 (requires digits)
        showText: true,
      };

      // Should not throw, should return visual error fallback
      const output = generateBarcodeVector(invalidBarcode);
      expect(output.innerContent).toContain('rect');
    });
  });

  describe('5. Composite Element Renderer & zIndex Sorting', () => {
    const elements: TemplateElement[] = [
      {
        id: 'el_top',
        type: 'text',
        name: 'Foreground Text',
        bounds: { x: 10, y: 10, width: 50, height: 10, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 10,
        content: 'Top Layer',
        style: {
          fontFamily: 'Inter',
          fontSizePt: 12,
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000',
          alignment: 'left',
          lineHeight: 1.2,
          autoWrap: true,
        },
      },
      {
        id: 'el_bottom',
        type: 'shape',
        name: 'Background Box',
        bounds: { x: 5, y: 5, width: 100, height: 50, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#f1f5f9',
        strokeColor: '#cbd5e1',
        strokeWidthMm: 0.5,
      },
      {
        id: 'el_hidden',
        type: 'shape',
        name: 'Hidden Shape',
        bounds: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        isLocked: false,
        isVisible: false,
        zIndex: 5,
        shapeType: 'rectangle',
        fillColor: 'red',
        strokeColor: 'red',
        strokeWidthMm: 1,
      },
    ];

    it('sorts elements by zIndex ascending and hides invisible elements', () => {
      const rendered = renderTemplateElements(elements, defaultContext);
      expect(rendered).toHaveLength(3);

      // First rendered element should be el_bottom (zIndex 1)
      expect(rendered[0].attrs['data-element-id']).toBe('el_bottom');

      // Invisible element should have display: 'none'
      const hiddenNode = rendered.find((n) => n.attrs['data-element-id'] === 'el_hidden');
      expect(hiddenNode?.attrs.display).toBe('none');

      // Last rendered element should be el_top (zIndex 10)
      expect(rendered[2].attrs['data-element-id']).toBe('el_top');
    });

    it('renders entire scene graph to a valid combined SVG string', () => {
      const combinedSvg = renderTemplateElementsToString(elements, defaultContext);
      expect(combinedSvg).toContain('data-element-id="el_bottom"');
      expect(combinedSvg).toContain('Top Layer');
    });
  });
});
