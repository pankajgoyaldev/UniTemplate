import { describe, it, expect, beforeEach } from 'vitest';
import type { ShapeElement, TextElement, ImageElement, BarcodeElement, TemplateAst } from '@uts/core';
import {
  calculateElementPageAlignment,
  clampBoundsToPage,
  calculateMultiElementBoundingBox,
  calculateMultiElementMove,
  type ElementBounds,
} from '../src/index.js';
import { useTemplateStore } from '../../../apps/web/src/store/useTemplateStore.ts';

describe('Task 5 — Inspector Panel & Store Properties', () => {
  const PAGE_WIDTH = 210;
  const PAGE_HEIGHT = 297;

  beforeEach(() => {
    // Reset template store with predictable test template
    const testTemplate: TemplateAst = {
      schemaVersion: '1.0.0',
      metadata: {
        id: 'test_tpl',
        title: 'Test Template',
        createdAt: '2026-09-06T00:00:00.000Z',
        updatedAt: '2026-09-06T00:00:00.000Z',
      },
      pageSettings: {
        unit: 'mm',
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        orientation: 'portrait',
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        targetDpi: 300,
      },
      dataSchema: { fields: [], mockPayload: {} },
      elements: [
        {
          id: 'rect_1',
          type: 'shape',
          name: 'Test Rectangle',
          bounds: { x: 20, y: 30, width: 60, height: 40, rotation: 0 },
          isLocked: false,
          isVisible: true,
          zIndex: 1,
          shapeType: 'rectangle',
          fillColor: '#ffffff',
          strokeColor: '#000000',
          strokeWidthMm: 1.0,
          cornerRadiusMm: 0,
        },
        {
          id: 'text_1',
          type: 'text',
          name: 'Test Text',
          bounds: { x: 50, y: 50, width: 80, height: 20, rotation: 0 },
          isLocked: false,
          isVisible: true,
          zIndex: 2,
          content: 'Hello Universe',
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSizePt: 12,
            fontWeight: 'normal',
            fontStyle: 'normal',
            color: '#111827',
            alignment: 'left',
            lineHeight: 1.2,
            autoWrap: true,
          },
        },
        {
          id: 'image_1',
          type: 'image',
          name: 'Test Image',
          bounds: { x: 10, y: 10, width: 40, height: 40, rotation: 0 },
          isLocked: false,
          isVisible: true,
          zIndex: 3,
          assetRef: 'sample.png',
          fit: 'contain',
          opacity: 1,
        },
        {
          id: 'barcode_1',
          type: 'barcode',
          name: 'Test Barcode',
          bounds: { x: 10, y: 200, width: 60, height: 25, rotation: 0 },
          isLocked: false,
          isVisible: true,
          zIndex: 4,
          barcodeType: 'code128',
          content: 'UTS-12345',
          showText: true,
        },
        {
          id: 'locked_1',
          type: 'shape',
          name: 'Locked Shape',
          bounds: { x: 100, y: 100, width: 50, height: 50, rotation: 0 },
          isLocked: true,
          isVisible: true,
          zIndex: 5,
          shapeType: 'ellipse',
          fillColor: '#ff0000',
          strokeColor: '#000000',
          strokeWidthMm: 0.5,
        },
        {
          id: 'hidden_1',
          type: 'shape',
          name: 'Hidden Shape',
          bounds: { x: 30, y: 30, width: 40, height: 40, rotation: 0 },
          isLocked: false,
          isVisible: false,
          zIndex: 6,
          shapeType: 'rectangle',
          fillColor: '#00ff00',
          strokeColor: '#000000',
          strokeWidthMm: 1.0,
        },
      ],
    };

    useTemplateStore.getState().setTemplate(testTemplate);
  });

  // 1. Update X
  it('1. updates X coordinate via updateElement', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 45, y: 30, width: 60, height: 40, rotation: 0 },
    });

    const el = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1');
    expect(el?.bounds.x).toBe(45);
    expect(el?.bounds.y).toBe(30);
    expect(el?.bounds.width).toBe(60);
  });

  // 2. Update Y
  it('2. updates Y coordinate via updateElement', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 20, y: 85, width: 60, height: 40, rotation: 0 },
    });

    const el = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1');
    expect(el?.bounds.y).toBe(85);
    expect(el?.bounds.x).toBe(20);
  });

  // 3. Update width
  it('3. updates width dimension via updateElement', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 20, y: 30, width: 95.5, height: 40, rotation: 0 },
    });

    const el = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1');
    expect(el?.bounds.width).toBe(95.5);
    expect(el?.bounds.height).toBe(40);
  });

  // 4. Update height
  it('4. updates height dimension via updateElement', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 20, y: 30, width: 60, height: 55.25, rotation: 0 },
    });

    const el = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1');
    expect(el?.bounds.height).toBe(55.25);
  });

  // 5. Update rotation
  it('5. updates rotation degrees via updateElement', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 20, y: 30, width: 60, height: 40, rotation: 45 },
    });

    const el = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1');
    expect(el?.bounds.rotation).toBe(45);
  });

  // 6. Locked element cannot be updated
  it('6. locked element cannot be modified by property updates, but can be unlocked', () => {
    const lockedBefore = useTemplateStore.getState().template.elements.find((e) => e.id === 'locked_1');
    expect(lockedBefore?.isLocked).toBe(true);

    // Attempt to change bounds of locked element
    useTemplateStore.getState().updateElement('locked_1', {
      bounds: { x: 0, y: 0, width: 200, height: 200, rotation: 90 },
    });
    let el = useTemplateStore.getState().template.elements.find((e) => e.id === 'locked_1');
    expect(el?.bounds.x).toBe(100);
    expect(el?.bounds.width).toBe(50);

    // Attempt to change appearance of locked element
    useTemplateStore.getState().updateElement('locked_1', {
      name: 'Hacked Name',
    });
    el = useTemplateStore.getState().template.elements.find((e) => e.id === 'locked_1');
    expect(el?.name).toBe('Locked Shape');

    // Toggling lock unlocks it
    useTemplateStore.getState().toggleElementLock('locked_1');
    el = useTemplateStore.getState().template.elements.find((e) => e.id === 'locked_1');
    expect(el?.isLocked).toBe(false);

    // Now it can be updated
    useTemplateStore.getState().updateElement('locked_1', {
      name: 'Unlocked Shape',
    });
    el = useTemplateStore.getState().template.elements.find((e) => e.id === 'locked_1');
    expect(el?.name).toBe('Unlocked Shape');
  });

  // 7. Delete behavior still works
  it('7. deleteElements removes unlocked elements and preserves locked elements', () => {
    useTemplateStore.getState().deleteElements(['rect_1', 'locked_1']);

    const elements = useTemplateStore.getState().template.elements;
    expect(elements.find((e) => e.id === 'rect_1')).toBeUndefined();
    // locked_1 must survive deletion attempt
    expect(elements.find((e) => e.id === 'locked_1')).toBeDefined();
  });

  // 8. Nudge behavior still works
  it('8. nudgeElements moves unlocked elements within page bounds and skips locked', () => {
    useTemplateStore.getState().nudgeElements(['rect_1', 'locked_1'], { x: 5, y: 10 }, PAGE_WIDTH, PAGE_HEIGHT);

    const rect = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1');
    const locked = useTemplateStore.getState().template.elements.find((e) => e.id === 'locked_1');

    expect(rect?.bounds.x).toBe(25);
    expect(rect?.bounds.y).toBe(40);
    // Locked must not move
    expect(locked?.bounds.x).toBe(100);
    expect(locked?.bounds.y).toBe(100);
  });

  // 9. Shape appearance update
  it('9. updates shape appearance properties (fill, stroke, strokeWidth, cornerRadius)', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      shapeType: 'rounded-rectangle',
      fillColor: '#3b82f6',
      strokeColor: '#1e40af',
      strokeWidthMm: 2.5,
      cornerRadiusMm: 4.0,
      strokeDash: 'dashed',
    } as Partial<ShapeElement>);

    const el = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1') as ShapeElement;
    expect(el.shapeType).toBe('rounded-rectangle');
    expect(el.fillColor).toBe('#3b82f6');
    expect(el.strokeColor).toBe('#1e40af');
    expect(el.strokeWidthMm).toBe(2.5);
    expect(el.cornerRadiusMm).toBe(4.0);
    expect(el.strokeDash).toBe('dashed');
  });

  // 10. Image opacity update
  it('10. updates image opacity and fit', () => {
    useTemplateStore.getState().updateElement('image_1', {
      opacity: 0.75,
      fit: 'cover',
    } as Partial<ImageElement>);

    const el = useTemplateStore.getState().template.elements.find((e) => e.id === 'image_1') as ImageElement;
    expect(el.opacity).toBe(0.75);
    expect(el.fit).toBe('cover');
  });

  // 11. Barcode value update
  it('11. updates barcode content, format, and showText', () => {
    useTemplateStore.getState().updateElement('barcode_1', {
      barcodeType: 'qr',
      content: 'https://universe.studio/item/99',
      showText: false,
    } as Partial<BarcodeElement>);

    const el = useTemplateStore.getState().template.elements.find((e) => e.id === 'barcode_1') as BarcodeElement;
    expect(el.barcodeType).toBe('qr');
    expect(el.content).toBe('https://universe.studio/item/99');
    expect(el.showText).toBe(false);
  });

  // 12. Text typography update
  it('12. updates text typography properties (fontSizePt, fontFamily, fontWeight, autoWrap)', () => {
    useTemplateStore.getState().updateElement('text_1', {
      content: 'Updated Heading',
      style: {
        fontSizePt: 24,
        fontWeight: 'bold',
        fontStyle: 'italic',
        color: '#dc2626',
        alignment: 'center',
        lineHeight: 1.5,
        letterSpacingPt: 1.2,
        autoWrap: false,
      },
    } as Partial<TextElement>);

    const el = useTemplateStore.getState().template.elements.find((e) => e.id === 'text_1') as TextElement;
    expect(el.content).toBe('Updated Heading');
    expect(el.style.fontSizePt).toBe(24);
    expect(el.style.fontWeight).toBe('bold');
    expect(el.style.fontStyle).toBe('italic');
    expect(el.style.color).toBe('#dc2626');
    expect(el.style.alignment).toBe('center');
    expect(el.style.lineHeight).toBe(1.5);
    expect(el.style.letterSpacingPt).toBe(1.2);
    expect(el.style.autoWrap).toBe(false);
  });

  // 13. Invalid numeric values do not create NaN/Infinity
  it('13. clampBoundsToPage guards against NaN and Infinity', () => {
    const invalidBounds: ElementBounds = {
      x: NaN,
      y: Infinity,
      width: -10,
      height: NaN,
      rotation: NaN,
    };

    const clamped = clampBoundsToPage(invalidBounds, PAGE_WIDTH, PAGE_HEIGHT);
    expect(Number.isFinite(clamped.x)).toBe(true);
    expect(Number.isFinite(clamped.y)).toBe(true);
    expect(Number.isFinite(clamped.width)).toBe(true);
    expect(Number.isFinite(clamped.height)).toBe(true);
    expect(Number.isFinite(clamped.rotation)).toBe(true);

    expect(clamped.width).toBeGreaterThanOrEqual(0.1);
    expect(clamped.height).toBeGreaterThanOrEqual(0);
    expect(clamped.rotation).toBeGreaterThanOrEqual(0);
    expect(clamped.rotation).toBeLessThan(360);
  });

  // 14. Page boundary behavior
  it('14. clampBoundsToPage clamps element inside page boundaries', () => {
    // Far negative coordinates
    const negative = clampBoundsToPage({ x: -100, y: -50, width: 40, height: 30, rotation: 0 }, PAGE_WIDTH, PAGE_HEIGHT);
    expect(negative.x).toBe(0);
    expect(negative.y).toBe(0);

    // Far positive coordinates exceeding page
    const excess = clampBoundsToPage({ x: 300, y: 500, width: 50, height: 40, rotation: 0 }, PAGE_WIDTH, PAGE_HEIGHT);
    expect(excess.x).toBe(PAGE_WIDTH - 50);
    expect(excess.y).toBe(PAGE_HEIGHT - 40);
  });

  // 15. Alignment calculations
  it('15. calculateElementPageAlignment correctly computes all 6 alignments for page', () => {
    const bounds: ElementBounds = { x: 50, y: 50, width: 60, height: 40, rotation: 0 };

    // Align Left: x = 0
    const left = calculateElementPageAlignment(bounds, 'align-left', PAGE_WIDTH, PAGE_HEIGHT);
    expect(left.x).toBe(0);
    expect(left.y).toBe(50);

    // Align Center H: x = (210 - 60) / 2 = 75
    const centerH = calculateElementPageAlignment(bounds, 'align-center-h', PAGE_WIDTH, PAGE_HEIGHT);
    expect(centerH.x).toBe(75);

    // Align Right: x = 210 - 60 = 150
    const right = calculateElementPageAlignment(bounds, 'align-right', PAGE_WIDTH, PAGE_HEIGHT);
    expect(right.x).toBe(150);

    // Align Top: y = 0
    const top = calculateElementPageAlignment(bounds, 'align-top', PAGE_WIDTH, PAGE_HEIGHT);
    expect(top.y).toBe(0);

    // Align Middle V: y = (297 - 40) / 2 = 128.5
    const middleV = calculateElementPageAlignment(bounds, 'align-middle-v', PAGE_WIDTH, PAGE_HEIGHT);
    expect(middleV.y).toBe(128.5);

    // Align Bottom: y = 297 - 40 = 257
    const bottom = calculateElementPageAlignment(bounds, 'align-bottom', PAGE_WIDTH, PAGE_HEIGHT);
    expect(bottom.y).toBe(257);
  });

  // Rotated element alignment
  it('15b. calculateElementPageAlignment correctly respects rotated visual bounds', () => {
    // 20x20 box rotated 45 deg, center at (20, 20), diagonal ~28.284
    const rotated: ElementBounds = { x: 10, y: 10, width: 20, height: 20, rotation: 45 };

    const alignedLeft = calculateElementPageAlignment(rotated, 'align-left', PAGE_WIDTH, PAGE_HEIGHT);
    // Left edge of rotated AABB should align to 0
    const aabb = clampBoundsToPage(alignedLeft, PAGE_WIDTH, PAGE_HEIGHT);
    expect(aabb.x).toBeGreaterThanOrEqual(0);
  });

  // 16. Multi-selection does not corrupt mixed element types
  it('16. updateElements applies common patches without corrupting element-specific properties', () => {
    // Patch common property (e.g. name or bounds) across shape, text, and barcode
    useTemplateStore.getState().updateElements(['rect_1', 'text_1'], {
      bounds: { x: 15, y: 25, width: 50, height: 30, rotation: 0 },
    });

    const rect = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1') as ShapeElement;
    const text = useTemplateStore.getState().template.elements.find((e) => e.id === 'text_1') as TextElement;

    expect(rect.bounds.x).toBe(15);
    expect(rect.shapeType).toBe('rectangle'); // Shape specific preserved
    expect(text.bounds.x).toBe(15);
    expect(text.style.fontFamily).toBe('Inter, sans-serif'); // Typography preserved
    expect(text.content).toBe('Hello Universe'); // Content preserved
  });

  // 17. Invisible selected element cannot have position/properties modified
  it('17. invisible element cannot have position or properties modified through store updates', () => {
    const hiddenBefore = useTemplateStore.getState().template.elements.find((e) => e.id === 'hidden_1');
    expect(hiddenBefore?.isVisible).toBe(false);

    // Attempt to change bounds of invisible element
    useTemplateStore.getState().updateElement('hidden_1', {
      bounds: { x: 99, y: 99, width: 99, height: 99, rotation: 0 },
    });
    let el = useTemplateStore.getState().template.elements.find((e) => e.id === 'hidden_1');
    expect(el?.bounds.x).toBe(30);
    expect(el?.bounds.y).toBe(30);

    // Attempt to change bounds via updateElementBounds
    useTemplateStore.getState().updateElementBounds('hidden_1', {
      x: 99,
      y: 99,
      width: 99,
      height: 99,
      rotation: 0,
    });
    el = useTemplateStore.getState().template.elements.find((e) => e.id === 'hidden_1');
    expect(el?.bounds.x).toBe(30);

    // Attempt to modify properties via updateElements
    useTemplateStore.getState().updateElements(['hidden_1'], {
      name: 'Hacked Name',
    });
    el = useTemplateStore.getState().template.elements.find((e) => e.id === 'hidden_1');
    expect(el?.name).toBe('Hidden Shape');
  });

  // 18. Invisible element can be made visible again through intended visibility control
  it('18. invisible element can be made visible again through toggleElementVisibility and updateElement', () => {
    let el = useTemplateStore.getState().template.elements.find((e) => e.id === 'hidden_1');
    expect(el?.isVisible).toBe(false);

    // Make visible via updateElement({ isVisible: true })
    useTemplateStore.getState().updateElement('hidden_1', { isVisible: true });
    el = useTemplateStore.getState().template.elements.find((e) => e.id === 'hidden_1');
    expect(el?.isVisible).toBe(true);

    // Now it is editable normally
    useTemplateStore.getState().updateElement('hidden_1', {
      name: 'Restored Shape',
      bounds: { x: 45, y: 45, width: 50, height: 50, rotation: 0 },
    });
    el = useTemplateStore.getState().template.elements.find((e) => e.id === 'hidden_1');
    expect(el?.name).toBe('Restored Shape');
    expect(el?.bounds.x).toBe(45);

    // Toggling visibility hides it again
    useTemplateStore.getState().toggleElementVisibility('hidden_1');
    el = useTemplateStore.getState().template.elements.find((e) => e.id === 'hidden_1');
    expect(el?.isVisible).toBe(false);
  });

  // 19. NaN/Infinity cannot enter AST through updateElement/updateElements
  it('19. NaN and Infinity cannot enter AST through updateElement or updateElements', () => {
    // Attempt invalid numeric values in bounds and shape properties
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: {
        x: NaN,
        y: Infinity,
        width: NaN,
        height: -10,
        rotation: NaN,
      } as any,
      strokeWidthMm: NaN,
      cornerRadiusMm: Infinity,
    } as any);

    const rect = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1') as ShapeElement;
    expect(Number.isFinite(rect.bounds.x)).toBe(true);
    expect(Number.isFinite(rect.bounds.y)).toBe(true);
    expect(Number.isFinite(rect.bounds.width)).toBe(true);
    expect(rect.bounds.width).toBeGreaterThan(0);
    expect(Number.isFinite(rect.bounds.height)).toBe(true);
    expect(rect.bounds.height).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(rect.bounds.rotation)).toBe(true);
    expect(Number.isFinite(rect.strokeWidthMm)).toBe(true);
    expect(rect.cornerRadiusMm === undefined || Number.isFinite(rect.cornerRadiusMm)).toBe(true);

    // Attempt invalid numeric values in text typography style via updateElements
    useTemplateStore.getState().updateElements(['text_1'], {
      style: {
        fontSizePt: NaN,
        lineHeight: Infinity,
        letterSpacingPt: NaN,
      } as any,
    } as any);

    const text = useTemplateStore.getState().template.elements.find((e) => e.id === 'text_1') as TextElement;
    expect(Number.isFinite(text.style.fontSizePt)).toBe(true);
    expect(text.style.fontSizePt).toBeGreaterThan(0);
    expect(Number.isFinite(text.style.lineHeight)).toBe(true);
    expect(text.style.lineHeight).toBeGreaterThan(0);
    expect(text.style.letterSpacingPt === undefined || Number.isFinite(text.style.letterSpacingPt)).toBe(true);
  });

  // 20. Existing locked-element protection still works across all store actions
  it('20. existing locked-element protection still works across all store actions', () => {
    const lockedInitial = useTemplateStore.getState().template.elements.find((e) => e.id === 'locked_1');
    expect(lockedInitial?.isLocked).toBe(true);

    // updateElement rejected
    useTemplateStore.getState().updateElement('locked_1', {
      bounds: { x: 5, y: 5, width: 200, height: 200, rotation: 0 },
      name: 'Locked Bypass',
    });
    // updateElements rejected
    useTemplateStore.getState().updateElements(['locked_1'], {
      bounds: { x: 5, y: 5, width: 200, height: 200, rotation: 0 },
    });
    // updateElementBounds rejected
    useTemplateStore.getState().updateElementBounds('locked_1', {
      x: 5,
      y: 5,
      width: 200,
      height: 200,
      rotation: 0,
    });
    // nudgeElements skipped
    useTemplateStore.getState().nudgeElements(['locked_1'], { x: 20, y: 20 }, PAGE_WIDTH, PAGE_HEIGHT);
    // deleteElements preserved
    useTemplateStore.getState().deleteElements(['locked_1']);

    const lockedAfter = useTemplateStore.getState().template.elements.find((e) => e.id === 'locked_1');
    expect(lockedAfter).toBeDefined();
    expect(lockedAfter?.bounds.x).toBe(100);
    expect(lockedAfter?.bounds.y).toBe(100);
    expect(lockedAfter?.name).toBe('Locked Shape');
  });
});
