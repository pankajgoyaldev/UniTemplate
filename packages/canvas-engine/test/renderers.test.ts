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
  breakTextLinesWithMetadata,
  calculateMaxVisibleLines,
  estimateCharWidthPx,
  estimateTextWidthPx,
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
  sanitizeSvgContent,
} from '../src/renderers/barcode-renderer.js';
import {
  renderElement,
  renderElementToString,
  renderTemplateElements,
  renderTemplateElementsToString,
} from '../src/renderers/element-renderer.js';
import {
  escapeXmlText,
  escapeXmlAttr,
  svgDescriptorToString,
} from '../src/renderers/types.js';

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

    it('preserves explicit empty lines in multi-line text', () => {
      const lines = breakTextLines('Line 1\n\nLine 3', 200, 16, false);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('');
      expect(lines[2]).toBe('Line 3');

      const emptyLineElement: TextElement = {
        ...sampleText,
        content: 'Line 1\n\nLine 3',
        bounds: { ...sampleText.bounds, height: 40 },
      };
      const descriptor = renderTextElement(emptyLineElement, defaultContext);
      expect(descriptor.children).toHaveLength(3);
      // Empty line renders non-breaking space for baseline height preservation
      const middleTspan = descriptor.children![1] as any;
      expect(middleTspan.children[0]).toBe('\u00A0');
    });

    it('handles a single word longer than the bounding width by chunking without infinite loop', () => {
      const longWord = 'Supercalifragilisticexpialidocious';
      const lines = breakTextLines(longWord, 60, 16, true);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.join('')).toBe(longWord);
    });

    it('respects autoWrap=false and does not break unwrapped lines', () => {
      const longSentence = 'The quick brown fox jumps over the lazy dog and keeps going endlessly';
      const lines = breakTextLines(longSentence, 50, 16, false);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe(longSentence);
    });

    it('handles multiple consecutive spaces reasonably', () => {
      const textWithSpaces = 'Item    Price    Quantity';
      const lines = breakTextLines(textWithSpaces, 500, 16, true);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('    ');
    });

    it('handles extremely narrow text box gracefully without infinite loop', () => {
      const narrowText = 'Small';
      const lines = breakTextLines(narrowText, 5, 16, true);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.join('')).toBe(narrowText);
    });

    it('limits lines deterministically according to text box height (prevents silent bounds overflow)', () => {
      // 8mm height allows only 1 line of 16pt text (height ~30.2px, line 1 needs ~18px, line 2 needs +26.6px = 44.6px)
      const overflowingText: TextElement = {
        ...sampleText,
        bounds: { ...sampleText.bounds, height: 8 },
        content: 'Line 1\nLine 2\nLine 3\nLine 4',
      };
      const descriptor = renderTextElement(overflowingText, defaultContext);
      expect(descriptor.children).toHaveLength(1);
      const singleTspan = descriptor.children![0] as any;
      expect(singleTspan.children[0]).toBe('Line 1');
    });

    it('calculates max visible lines correctly with calculateMaxVisibleLines', () => {
      expect(calculateMaxVisibleLines(0, 16, 20)).toBe(0);
      expect(calculateMaxVisibleLines(-10, 16, 20)).toBe(0);
      expect(calculateMaxVisibleLines(5, 20, 25)).toBe(0); // 5px < half ascent
      expect(calculateMaxVisibleLines(20, 16, 20)).toBe(1);
      expect(calculateMaxVisibleLines(40, 16, 20)).toBe(2);
    });

    it('applies left, center, and right text alignment with correct text-anchor and anchorX', () => {
      const leftElement: TextElement = { ...sampleText, style: { ...sampleText.style, alignment: 'left' } };
      const centerElement: TextElement = { ...sampleText, style: { ...sampleText.style, alignment: 'center' } };
      const rightElement: TextElement = { ...sampleText, style: { ...sampleText.style, alignment: 'right' } };

      const leftDesc = renderTextElement(leftElement, defaultContext);
      const centerDesc = renderTextElement(centerElement, defaultContext);
      const rightDesc = renderTextElement(rightElement, defaultContext);

      expect(leftDesc.attrs['text-anchor']).toBe('start');
      expect(centerDesc.attrs['text-anchor']).toBe('middle');
      expect(rightDesc.attrs['text-anchor']).toBe('end');

      const xPx = (20 / 25.4) * 96;
      const widthPx = (80 / 25.4) * 96;

      const tspanLeft = leftDesc.children![0] as any;
      const tspanCenter = centerDesc.children![0] as any;
      const tspanRight = rightDesc.children![0] as any;

      expect(tspanLeft.attrs.x).toBeCloseTo(xPx, 2);
      expect(tspanCenter.attrs.x).toBeCloseTo(xPx + widthPx / 2, 2);
      expect(tspanRight.attrs.x).toBeCloseTo(xPx + widthPx, 2);
    });

    it('implements justify alignment with textLength on intermediate lines and un-stretched last line', () => {
      const justifyElement: TextElement = {
        ...sampleText,
        bounds: { ...sampleText.bounds, width: 60, height: 40 },
        content: 'This is a long text paragraph designed to wrap across several lines in justify mode',
        style: {
          ...sampleText.style,
          alignment: 'justify',
          autoWrap: true,
        },
      };

      const descriptor = renderTextElement(justifyElement, defaultContext);
      expect(descriptor.children).toBeDefined();
      expect(descriptor.children!.length).toBeGreaterThan(1);

      // Intermediate lines should have textLength and lengthAdjust
      const firstTspan = descriptor.children![0] as any;
      expect(firstTspan.attrs.textLength).toBeDefined();
      expect(firstTspan.attrs.lengthAdjust).toBe('spacing');

      // Last line of the paragraph must NOT have textLength (normal left-alignment)
      const lastTspan = descriptor.children![descriptor.children!.length - 1] as any;
      expect(lastTspan.attrs.textLength).toBeUndefined();
    });

    it('applies letter spacing attribute when specified', () => {
      const letterSpacedText: TextElement = {
        ...sampleText,
        style: { ...sampleText.style, letterSpacingPt: 2 },
      };
      const descriptor = renderTextElement(letterSpacedText, defaultContext);
      expect(descriptor.attrs['letter-spacing']).toContain('px');
    });

    it('produces deterministic output across repeated calls', () => {
      const desc1 = renderTextElement(sampleText, defaultContext);
      const desc2 = renderTextElement(sampleText, defaultContext);
      expect(JSON.stringify(desc1)).toBe(JSON.stringify(desc2));

      const svg1 = renderTextElementToString(sampleText, defaultContext);
      const svg2 = renderTextElementToString(sampleText, defaultContext);
      expect(svg1).toBe(svg2);
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

    it('generates valid SVG text markup', () => {
      const svgString = renderTextElementToString(sampleText, defaultContext);
      expect(svgString).toContain('<text');
      expect(svgString).toContain('font-family="Inter"');
      expect(svgString).toContain('TAX INVOICE');
      expect(svgString).toContain('</text>');
    });
  });

  describe('2. Shape Elements Renderer & Edge Cases', () => {
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

    it('clamps very large corner radius to half dimensions', () => {
      const largeRadiusRect: ShapeElement = {
        id: 'rrect_large',
        type: 'shape',
        name: 'Pill',
        bounds: { x: 10, y: 10, width: 20, height: 10, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rounded-rectangle',
        fillColor: 'transparent',
        strokeColor: '#000000',
        strokeWidthMm: 0.5,
        cornerRadiusMm: 100, // Excessive corner radius
      };

      const descriptor = renderShapeElement(largeRadiusRect, defaultContext);
      // Max radius should be clamped to height / 2 = 5mm
      const expectedMaxRadiusPx = (5 / 25.4) * 96;
      expect(Number(descriptor.attrs.rx)).toBeCloseTo(expectedMaxRadiusPx, 2);
    });

    it('handles zero dimensions without crashing or generating NaN', () => {
      const zeroRect: ShapeElement = {
        id: 'rect_zero',
        type: 'shape',
        name: 'Zero Box',
        bounds: { x: 10, y: 10, width: 0, height: 0, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#000',
        strokeColor: '#000',
        strokeWidthMm: 1,
      };

      const descriptor = renderShapeElement(zeroRect, defaultContext);
      expect(descriptor.attrs.width).toBe(0);
      expect(descriptor.attrs.height).toBe(0);
      expect(Number.isNaN(descriptor.attrs.width)).toBe(false);
    });

    it('handles very small dimensions (0.01mm) properly', () => {
      const tinyRect: ShapeElement = {
        id: 'rect_tiny',
        type: 'shape',
        name: 'Tiny',
        bounds: { x: 1, y: 1, width: 0.01, height: 0.01, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#000',
        strokeColor: '#000',
        strokeWidthMm: 0.01,
      };

      const descriptor = renderShapeElement(tinyRect, defaultContext);
      expect(Number(descriptor.attrs.width)).toBeGreaterThan(0);
      expect(Number(descriptor.attrs.height)).toBeGreaterThan(0);
    });

    it('handles zero stroke width cleanly with stroke none', () => {
      const zeroStroke: ShapeElement = {
        id: 'rect_no_stroke',
        type: 'shape',
        name: 'No Stroke',
        bounds: { x: 10, y: 10, width: 30, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#3b82f6',
        strokeColor: '#1d4ed8',
        strokeWidthMm: 0,
      };

      const descriptor = renderShapeElement(zeroStroke, defaultContext);
      expect(descriptor.attrs.stroke).toBe('none');
      expect(descriptor.attrs['stroke-width']).toBe(0);
      expect(descriptor.attrs['stroke-dasharray']).toBeUndefined();
    });

    it('handles negative coordinates without error', () => {
      const negRect: ShapeElement = {
        id: 'rect_neg',
        type: 'shape',
        name: 'Negative',
        bounds: { x: -10, y: -5, width: 20, height: 15, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#000',
        strokeColor: '#000',
        strokeWidthMm: 1,
      };

      const descriptor = renderShapeElement(negRect, defaultContext);
      expect(Number(descriptor.attrs.x)).toBeCloseTo((-10 / 25.4) * 96, 2);
      expect(Number(descriptor.attrs.y)).toBeCloseTo((-5 / 25.4) * 96, 2);
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

    it('handles rotation = 0 vs rotation != 0', () => {
      const unrotated: ShapeElement = {
        id: 's_0',
        type: 'shape',
        name: 'Unrotated',
        bounds: { x: 10, y: 10, width: 20, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#000',
        strokeColor: '#000',
        strokeWidthMm: 1,
      };
      const rotated: ShapeElement = {
        ...unrotated,
        bounds: { ...unrotated.bounds, rotation: 90 },
      };

      const descUnrotated = renderShapeElement(unrotated, defaultContext);
      expect(descUnrotated.tag).toBe('rect');

      const descRotated = renderShapeElement(rotated, defaultContext);
      expect(descRotated.tag).toBe('g');
      expect(descRotated.attrs.transform).toContain('rotate(90');
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

    it('falls back safely when assetResolver returns undefined', () => {
      const contextWithNullResolver = {
        ...defaultContext,
        assetResolver: () => undefined,
      };
      const descriptor = renderImageElement(sampleImage, contextWithNullResolver);
      expect(descriptor.attrs.href).toBe('logo_company.png');
    });

    it('falls back safely when assetResolver throws an error', () => {
      const contextWithThrowingResolver = {
        ...defaultContext,
        assetResolver: () => {
          throw new Error('Resolver crashed');
        },
      };
      const descriptor = renderImageElement(sampleImage, contextWithThrowingResolver);
      expect(descriptor.attrs.href).toBe('logo_company.png');
    });

    it('clamps opacity to [0, 1] range and handles invalid values', () => {
      const negativeOpacity: ImageElement = { ...sampleImage, opacity: -0.5 };
      const excessiveOpacity: ImageElement = { ...sampleImage, opacity: 2.5 };
      const nanOpacity: ImageElement = { ...sampleImage, opacity: NaN };

      expect(renderImageElement(negativeOpacity, defaultContext).attrs.opacity).toBe(0);
      expect(renderImageElement(excessiveOpacity, defaultContext).attrs.opacity).toBe(1);
      expect(renderImageElement(nanOpacity, defaultContext).attrs.opacity).toBe(1);
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

    it('handles image rotation with rotate transform group', () => {
      const rotatedImage: ImageElement = {
        ...sampleImage,
        bounds: { ...sampleImage.bounds, rotation: 30 },
      };
      const descriptor = renderImageElement(rotatedImage, defaultContext);
      expect(descriptor.tag).toBe('g');
      expect(descriptor.attrs.transform).toContain('rotate(30');
    });

    it('generates valid SVG image XML string', () => {
      const svg = renderImageElementToString(sampleImage, defaultContext);
      expect(svg).toContain('<image');
      expect(svg).toContain('href="logo_company.png"');
      expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    });
  });

  describe('4. Barcode Element Renderer (bwip-js integration & hardening)', () => {
    it('correctly maps all supported BarcodeType values to bwip-js bcid', () => {
      expect(mapBarcodeTypeToBcid('code128')).toBe('code128');
      expect(mapBarcodeTypeToBcid('ean13')).toBe('ean13');
      expect(mapBarcodeTypeToBcid('upca')).toBe('upca');
      expect(mapBarcodeTypeToBcid('code39')).toBe('code39');
      expect(mapBarcodeTypeToBcid('qr')).toBe('qrcode');
      expect(mapBarcodeTypeToBcid('datamatrix')).toBe('datamatrix');
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

    it('renders vector UPC-A barcode', () => {
      const upcBarcode: BarcodeElement = {
        id: 'bc_upca',
        type: 'barcode',
        name: 'Product UPC',
        bounds: { x: 10, y: 10, width: 50, height: 25, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        barcodeType: 'upca',
        content: '012345678905',
        showText: true,
      };

      const descriptor = renderBarcodeElement(upcBarcode, defaultContext);
      expect(descriptor.tag).toBe('svg');
      expect(descriptor.attrs['data-barcode-type']).toBe('upca');
      expect(descriptor.innerHTML).toBeDefined();
    });

    it('renders vector Code39 barcode', () => {
      const code39Barcode: BarcodeElement = {
        id: 'bc_c39',
        type: 'barcode',
        name: 'Code39 Item',
        bounds: { x: 10, y: 10, width: 60, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        barcodeType: 'code39',
        content: 'ITEM123',
        showText: true,
      };

      const descriptor = renderBarcodeElement(code39Barcode, defaultContext);
      expect(descriptor.tag).toBe('svg');
      expect(descriptor.attrs['data-barcode-type']).toBe('code39');
    });

    it('renders vector DataMatrix 2D barcode', () => {
      const dmBarcode: BarcodeElement = {
        id: 'bc_dm',
        type: 'barcode',
        name: 'DM Barcode',
        bounds: { x: 10, y: 10, width: 25, height: 25, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        barcodeType: 'datamatrix',
        content: 'UTS-DM-001',
        showText: false,
      };

      const descriptor = renderBarcodeElement(dmBarcode, defaultContext);
      expect(descriptor.tag).toBe('svg');
      expect(descriptor.attrs.preserveAspectRatio).toBe('xMidYMid meet');
    });

    it('renders vector QR Code with error correction levels L, M, Q, H', () => {
      const levels: ('L' | 'M' | 'Q' | 'H')[] = ['L', 'M', 'Q', 'H'];
      for (const level of levels) {
        const qr: BarcodeElement = {
          id: `bc_qr_${level}`,
          type: 'barcode',
          name: 'QR',
          bounds: { x: 10, y: 10, width: 30, height: 30, rotation: 0 },
          isLocked: false,
          isVisible: true,
          zIndex: 1,
          barcodeType: 'qr',
          content: 'https://universe.studio',
          showText: false,
          errorCorrectionLevel: level,
        };
        const vector = generateBarcodeVector(qr);
        expect(vector.innerContent).toContain('path');
      }
    });

    it('handles barcode encoding errors gracefully without throwing', () => {
      const invalidEan: BarcodeElement = {
        id: 'bc_bad_ean',
        type: 'barcode',
        name: 'Bad EAN',
        bounds: { x: 10, y: 10, width: 50, height: 25, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        barcodeType: 'ean13',
        content: 'abc', // Non-numeric
        showText: true,
      };

      const output = generateBarcodeVector(invalidEan);
      expect(output.innerContent).toContain('rect');
      expect(output.innerContent).toContain('fill="#fee2e2"');

      // Descriptor rendering should succeed smoothly
      const descriptor = renderBarcodeElement(invalidEan, defaultContext);
      expect(descriptor.tag).toBe('svg');
    });

    it('sanitizes SVG content and prevents executable scripts or handlers', () => {
      const maliciousSvg = '<svg><script>alert("hack")</script><rect width="10" height="10" onerror="alert(1)"/><a href="javascript:void(0)">Link</a></svg>';
      const sanitized = sanitizeSvgContent(maliciousSvg);
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).not.toContain('javascript:');
    });
  });

  describe('5. SVG Safety & XML Escaping', () => {
    it('escapes XML special characters in text nodes', () => {
      const dangerous = 'A & B < C > D "quoted" \'single\'';
      const escaped = escapeXmlText(dangerous);
      expect(escaped).toBe('A &amp; B &lt; C &gt; D "quoted" \'single\'');
    });

    it('escapes XML special characters in attribute values', () => {
      const dangerousAttr = 'name="test" & val<\'x\'>';
      const escaped = escapeXmlAttr(dangerousAttr);
      expect(escaped).toBe('name=&quot;test&quot; &amp; val&lt;&apos;x&apos;&gt;');
    });

    it('safely serializes user text with markup in svgDescriptorToString without executing or corrupting XML', () => {
      const userTextWithMarkup: TextElement = {
        id: 'txt_hack',
        type: 'text',
        name: 'User Input',
        bounds: { x: 10, y: 10, width: 50, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        content: '<script>alert("xss")</script> & <b>Bold</b>',
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
      };

      const svgString = renderTextElementToString(userTextWithMarkup, defaultContext);
      expect(svgString).not.toContain('<script>');
      expect(svgString).toContain('&lt;script&gt;');
      expect(svgString).toContain('&amp;');
    });
  });

  describe('6. Composite Element Renderer & zIndex Sorting', () => {
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
      {
        id: 'el_nan_z',
        type: 'shape',
        name: 'NaN zIndex Shape',
        bounds: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: NaN as any,
        shapeType: 'rectangle',
        fillColor: 'blue',
        strokeColor: 'blue',
        strokeWidthMm: 1,
      },
    ];

    it('sorts elements by zIndex ascending and handles NaN/undefined zIndex gracefully', () => {
      const rendered = renderTemplateElements(elements, defaultContext);
      expect(rendered).toHaveLength(4);

      // el_nan_z has Number(NaN) || 0 = 0, so it renders first
      expect(rendered[0].attrs['data-element-id']).toBe('el_nan_z');

      // el_bottom has zIndex 1
      expect(rendered[1].attrs['data-element-id']).toBe('el_bottom');

      // Invisible element should have display: 'none'
      const hiddenNode = rendered.find((n) => n.attrs['data-element-id'] === 'el_hidden');
      expect(hiddenNode?.attrs.display).toBe('none');

      // Last rendered element should be el_top (zIndex 10)
      expect(rendered[3].attrs['data-element-id']).toBe('el_top');
    });

    it('renders entire scene graph to a valid combined SVG string', () => {
      const combinedSvg = renderTemplateElementsToString(elements, defaultContext);
      expect(combinedSvg).toContain('data-element-id="el_bottom"');
      expect(combinedSvg).toContain('Top Layer');
    });
  });
});

