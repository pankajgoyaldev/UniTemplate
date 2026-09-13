import { describe, it, expect, beforeEach } from 'vitest';
import type { TemplateElement, TemplateAst } from '@uts/core';
import { useUIStore } from '../src/store/useUIStore.js';
import { useTemplateStore } from '../src/store/useTemplateStore.js';
import { hitTestElements } from '@uts/canvas-engine';
import { calculateMovedBounds } from '@uts/canvas-engine';
import { calculateResizedBounds } from '@uts/canvas-engine';
import {
  calculateMultiElementMove,
  calculateMultiElementResize,
  calculateMultiElementBoundingBox,
} from '@uts/canvas-engine';
import { useHistoryStore } from '../src/store/history/useHistoryStore.js';

describe('Canvas Interaction: Selection, Dragging & Resizing', () => {
  const initialElements: TemplateElement[] = [
    {
      id: 'el_text_1',
      type: 'text',
      name: 'Title Text',
      bounds: { x: 20, y: 30, width: 60, height: 20, rotation: 0 },
      isVisible: true,
      isLocked: false,
      zIndex: 0,
      content: 'Hello World',
      style: {
        fontFamily: 'Inter',
        fontSizePt: 16,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#000000',
        alignment: 'left',
        lineHeight: 1.2,
        autoWrap: true,
      },
    },
    {
      id: 'el_rect_1',
      type: 'shape',
      name: 'Badge Shape',
      bounds: { x: 50, y: 40, width: 40, height: 30, rotation: 0 },
      isVisible: true,
      isLocked: false,
      zIndex: 0,
      shapeType: 'rectangle',
      fillColor: '#3b82f6',
      strokeColor: '#1d4ed8',
      strokeWidthMm: 1,
    },
    {
      id: 'el_locked_1',
      type: 'shape',
      name: 'Locked Background',
      bounds: { x: 10, y: 10, width: 100, height: 80, rotation: 0 },
      isVisible: true,
      isLocked: true,
      zIndex: 0,
      shapeType: 'rectangle',
      fillColor: '#f1f5f9',
      strokeColor: '#cbd5e1',
      strokeWidthMm: 1,
    },
    {
      id: 'el_circle_1',
      type: 'shape',
      name: 'Circle Indicator',
      bounds: { x: 10, y: 70, width: 25, height: 25, rotation: 0 },
      isVisible: true,
      isLocked: false,
      zIndex: 0,
      shapeType: 'circle',
      fillColor: '#10b981',
      strokeColor: '#047857',
      strokeWidthMm: 1,
    },
  ];

  beforeEach(() => {
    useUIStore.getState().clearSelection();
    useTemplateStore.setState({
      template: {
        schemaVersion: '1.0.0',
        metadata: {
          id: 'test_tpl',
          title: 'Test Template',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        pageSettings: {
          unit: 'mm',
          width: 100,
          height: 100,
          orientation: 'portrait',
          margins: { top: 5, right: 5, bottom: 5, left: 5 },
          targetDpi: 300,
        },
        dataSchema: {
          fields: [],
          mockPayload: {},
        },
        elements: JSON.parse(JSON.stringify(initialElements)),
      },
    });
  });

  describe('1. Element Selection', () => {
    it('clicking an element selects it', () => {
      // Simulate clicking on el_text_1 at (30, 35)
      const elements = useTemplateStore.getState().template.elements;
      const hit = hitTestElements({ x: 30, y: 35 }, elements, 1.0);
      expect(hit).toBeDefined();
      expect(hit?.id).toBe('el_text_1');

      useUIStore.getState().selectElement(hit!.id, false);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_text_1']);
    });

    it('only one element is selected at a time (clicking another replaces selection)', () => {
      // First select el_text_1
      useUIStore.getState().selectElement('el_text_1', false);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_text_1']);

      // Then click el_rect_1
      useUIStore.getState().selectElement('el_rect_1', false);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_rect_1']);
      expect(useUIStore.getState().selectedElementIds).toHaveLength(1);
    });

    it('clicking empty canvas clears selection', () => {
      useUIStore.getState().selectElement('el_text_1', false);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_text_1']);

      // Simulate clicking empty canvas at (5, 5)
      const elements = useTemplateStore.getState().template.elements;
      const hit = hitTestElements({ x: 5, y: 5 }, elements, 1.0);
      expect(hit).toBeNull();

      useUIStore.getState().clearSelection();
      expect(useUIStore.getState().selectedElementIds).toEqual([]);
    });

    it('locked elements cannot be selected via hit testing', () => {
      const elements = useTemplateStore.getState().template.elements;
      // Click at (15, 15) which is inside el_locked_1
      const hit = hitTestElements({ x: 15, y: 15 }, elements, 1.0);
      expect(hit).toBeNull();
    });
  });

  describe('2. Hit Testing Overlapping Elements', () => {
    it('respects z-order: visually topmost element receives the hit', () => {
      const elements = useTemplateStore.getState().template.elements;
      // Overlap region between el_text_1 and el_rect_1 at (55, 45)
      // Since el_rect_1 is defined after el_text_1 with same zIndex (0), el_rect_1 is on top
      const hit = hitTestElements({ x: 55, y: 45 }, elements, 1.0);
      expect(hit).toBeDefined();
      expect(hit?.id).toBe('el_rect_1');
    });

    it('explicit zIndex overrides array position', () => {
      // Promote el_text_1 to higher zIndex
      const elements: TemplateElement[] = [
        {
          ...initialElements[0],
          zIndex: 10,
        },
        {
          ...initialElements[1],
          zIndex: 0,
        },
      ];

      const hit = hitTestElements({ x: 55, y: 45 }, elements, 1.0);
      expect(hit).toBeDefined();
      expect(hit?.id).toBe('el_text_1');
    });
  });

  describe('3. Move Elements within Page Bounds', () => {
    it('drags a selected element and updates physical mm bounds', () => {
      const initial = initialElements[0].bounds;
      const moved = calculateMovedBounds(initial, { x: 10, y: 15 }, 100, 100);

      expect(moved.x).toBe(30);
      expect(moved.y).toBe(45);
      expect(moved.width).toBe(60);
      expect(moved.height).toBe(20);

      useTemplateStore.getState().updateElementBounds('el_text_1', moved);
      const updated = useTemplateStore.getState().template.elements.find((el) => el.id === 'el_text_1');
      expect(updated?.bounds.x).toBe(30);
      expect(updated?.bounds.y).toBe(45);
    });

    it('clamps element strictly inside page bounds (cannot drag outside canvas)', () => {
      const initial = initialElements[0].bounds; // x: 20, y: 30, w: 60, h: 20
      // Try to drag far right (deltaX: 100 on a 100mm wide page)
      const clampedRight = calculateMovedBounds(initial, { x: 100, y: 0 }, 100, 100);
      expect(clampedRight.x + clampedRight.width).toBeLessThanOrEqual(100);
      expect(clampedRight.x).toBe(40); // 100 - 60 = 40 max x

      // Try to drag far left (negative delta)
      const clampedLeft = calculateMovedBounds(initial, { x: -50, y: 0 }, 100, 100);
      expect(clampedLeft.x).toBeGreaterThanOrEqual(0);
      expect(clampedLeft.x).toBe(0);

      // Try to drag far bottom
      const clampedBottom = calculateMovedBounds(initial, { x: 0, y: 100 }, 100, 100);
      expect(clampedBottom.y + clampedBottom.height).toBeLessThanOrEqual(100);
      expect(clampedBottom.y).toBe(80); // 100 - 20 = 80 max y
    });
  });

  describe('4. Resize Elements & Minimum Size Enforcement', () => {
    it('resizes text element independently in width and height', () => {
      const initial = initialElements[0].bounds; // 60 x 20
      // Drag east handle +15mm
      const resizedW = calculateResizedBounds({
        initialBounds: initial,
        handle: 'e',
        deltaMm: { x: 15, y: 0 },
        keepAspectRatio: false,
        pageWidthMm: 100,
        pageHeightMm: 100,
      });

      expect(resizedW.width).toBe(75);
      expect(resizedW.height).toBe(20);

      // Drag south handle +10mm
      const resizedH = calculateResizedBounds({
        initialBounds: resizedW,
        handle: 's',
        deltaMm: { x: 0, y: 10 },
        keepAspectRatio: false,
        pageWidthMm: 100,
        pageHeightMm: 100,
      });

      expect(resizedH.width).toBe(75);
      expect(resizedH.height).toBe(30);
    });

    it('enforces minimum width and height (2.0mm)', () => {
      const initial = initialElements[0].bounds; // 60 x 20
      // Try to shrink element to negative or near-zero size
      const shrunk = calculateResizedBounds({
        initialBounds: initial,
        handle: 'se',
        deltaMm: { x: -100, y: -100 },
        keepAspectRatio: false,
        minWidthMm: 2.0,
        minHeightMm: 2.0,
        pageWidthMm: 100,
        pageHeightMm: 100,
      });

      expect(shrunk.width).toBeGreaterThanOrEqual(2.0);
      expect(shrunk.height).toBeGreaterThanOrEqual(2.0);
      expect(shrunk.width).toBe(2.0);
      expect(shrunk.height).toBe(2.0);
    });

    it('preserves aspect ratio when keepAspectRatio is true (e.g. images / QR codes or Shift key)', () => {
      const initial = { x: 10, y: 10, width: 40, height: 20, rotation: 0 }; // 2:1 ratio
      const resized = calculateResizedBounds({
        initialBounds: initial,
        handle: 'se',
        deltaMm: { x: 20, y: 20 },
        keepAspectRatio: true,
        pageWidthMm: 100,
        pageHeightMm: 100,
      });

      const initialRatio = initial.width / initial.height;
      const newRatio = resized.width / resized.height;
      expect(newRatio).toBeCloseTo(initialRatio, 3);
    });
  });

  describe('5. Selection Overlay Isolation from Persisted Document Data', () => {
    it('selection state in useUIStore does not pollute TemplateAst or element objects', () => {
      useUIStore.getState().selectElement('el_text_1', false);
      const template = useTemplateStore.getState().template;

      // Verify template elements contain only pure AST fields
      for (const el of template.elements) {
        expect((el as any).isSelected).toBeUndefined();
        expect((el as any).selectionBox).toBeUndefined();
        expect((el as any).resizeHandles).toBeUndefined();
      }

      // JSON serialization does not contain any selection overlay artifacts
      const json = JSON.stringify(template);
      expect(json).not.toContain('isSelected');
      expect(json).not.toContain('selection-overlay');
      expect(json).not.toContain('resizeHandles');
    });
  });

  describe('6. Multi-Element Selection & Manipulation', () => {
    it('Ctrl/Cmd+Click toggles elements into multi-selection', () => {
      // Toggle el_text_1
      useUIStore.getState().selectElement('el_text_1', true);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_text_1']);

      // Toggle el_rect_1
      useUIStore.getState().selectElement('el_rect_1', true);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_text_1', 'el_rect_1']);

      // Toggle el_text_1 again to deselect it
      useUIStore.getState().selectElement('el_text_1', true);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_rect_1']);
    });

    it('normal click replaces multi-selection with only the clicked element', () => {
      useUIStore.getState().selectElements(['el_text_1', 'el_rect_1']);
      expect(useUIStore.getState().selectedElementIds).toHaveLength(2);

      useUIStore.getState().selectElement('el_rect_1', false);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_rect_1']);
    });

    it('Select All selects all visible unlocked elements on the page', () => {
      const elements = useTemplateStore.getState().template.elements;
      // Filter visible and unlocked elements
      const selectable = elements.filter((el) => el.isVisible && !el.isLocked).map((el) => el.id);
      useUIStore.getState().selectElements(selectable);

      const selected = useUIStore.getState().selectedElementIds;
      expect(selected).toContain('el_text_1');
      expect(selected).toContain('el_rect_1');
      expect(selected).not.toContain('el_locked_1');
    });

    it('calculates combined bounding box for multi-selection', () => {
      const elements = useTemplateStore.getState().template.elements.filter((el) =>
        ['el_text_1', 'el_rect_1'].includes(el.id)
      );
      const bbox = calculateMultiElementBoundingBox(elements);
      expect(bbox).toBeDefined();
      // el_text_1: x: 20, y: 30, w: 60, h: 20 -> right: 80, bottom: 50
      // el_rect_1: x: 50, y: 40, w: 40, h: 30 -> right: 90, bottom: 70
      // Combined: x: 20, y: 30, w: 70, h: 40
      expect(bbox?.x).toBe(20);
      expect(bbox?.y).toBe(30);
      expect(bbox?.width).toBe(70);
      expect(bbox?.height).toBe(40);
    });

    it('multi-element drag moves all selected elements collectively preserving relative positions and clamping', () => {
      const elements = useTemplateStore.getState().template.elements.filter((el) =>
        ['el_text_1', 'el_rect_1'].includes(el.id)
      );
      const items = elements.map((el) => ({ id: el.id, initialBounds: el.bounds }));
      const delta = { x: 5, y: 10 };

      const moved = calculateMultiElementMove(items, delta, 100, 100);
      expect(moved).toHaveLength(2);

      const movedText = moved.find((m) => m.id === 'el_text_1')!.bounds;
      const movedRect = moved.find((m) => m.id === 'el_rect_1')!.bounds;

      expect(movedText.x).toBe(25);
      expect(movedText.y).toBe(40);
      expect(movedRect.x).toBe(55);
      expect(movedRect.y).toBe(50);

      // Relative distance preserved
      expect(movedRect.x - movedText.x).toBe(30);
      expect(movedRect.y - movedText.y).toBe(10);

      useTemplateStore.getState().updateMultipleElementBounds(moved);
      const updatedElements = useTemplateStore.getState().template.elements;
      expect(updatedElements.find((e) => e.id === 'el_text_1')!.bounds.x).toBe(25);
      expect(updatedElements.find((e) => e.id === 'el_rect_1')!.bounds.x).toBe(55);
    });

    it('multi-element resize scales member elements proportionally and respects 2.0mm minimum size', () => {
      const elements = useTemplateStore.getState().template.elements.filter((el) =>
        ['el_text_1', 'el_rect_1'].includes(el.id)
      );
      const groupBbox = calculateMultiElementBoundingBox(elements)!;

      const result = calculateMultiElementResize({
        elements: elements.map((el) => ({ id: el.id, initialBounds: el.bounds })),
        initialGroupBounds: groupBbox,
        handle: 'se',
        deltaMm: { x: 35, y: 20 },
        minElementSizeMm: 2.0,
        pageWidthMm: 100,
        pageHeightMm: 100,
      });

      for (const item of result.elementBounds) {
        expect(item.bounds.width).toBeGreaterThanOrEqual(2.0);
        expect(item.bounds.height).toBeGreaterThanOrEqual(2.0);
      }
    });

    it('multi-element delete deletes only unlocked and visible elements, leaves locked elements intact', () => {
      useUIStore.getState().selectElements(['el_text_1', 'el_rect_1', 'el_locked_1']);
      useTemplateStore.getState().deleteElements(['el_text_1', 'el_rect_1', 'el_locked_1']);

      const remaining = useTemplateStore.getState().template.elements;
      expect(remaining.find((e) => e.id === 'el_text_1')).toBeUndefined();
      expect(remaining.find((e) => e.id === 'el_rect_1')).toBeUndefined();
      expect(remaining.find((e) => e.id === 'el_locked_1')).toBeDefined();
    });

    it('single undo transaction for multi-element move', () => {
      useHistoryStore.getState().clearHistory();
      useHistoryStore.getState().beginHistoryTransaction();

      const elements = useTemplateStore.getState().template.elements.filter((el) =>
        ['el_text_1', 'el_rect_1'].includes(el.id)
      );
      const items = elements.map((el) => ({ id: el.id, initialBounds: el.bounds }));
      const moved = calculateMultiElementMove(items, { x: 5, y: 5 }, 100, 100);
      useTemplateStore.getState().updateMultipleElementBounds(moved);

      useHistoryStore.getState().commitHistoryTransaction();
      expect(useHistoryStore.getState().canUndo).toBe(true);

      // Single undo reverts both elements
      useHistoryStore.getState().undo();
      const reverted = useTemplateStore.getState().template.elements;
      expect(reverted.find((e) => e.id === 'el_text_1')!.bounds.x).toBe(20);
      expect(reverted.find((e) => e.id === 'el_rect_1')!.bounds.x).toBe(50);
    });

    it('selection changes do not create history entries', () => {
      useHistoryStore.getState().clearHistory();
      expect(useHistoryStore.getState().past).toHaveLength(0);

      useUIStore.getState().selectElement('el_text_1', false);
      useUIStore.getState().selectElement('el_rect_1', true);
      useUIStore.getState().clearSelection();

      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(useHistoryStore.getState().canUndo).toBe(false);
    });
  });

  describe('7. Multi-Selection Group Drag & Click vs Drag Disambiguation', () => {
    it('select A+B+C -> pointer down on B -> drag B -> all three move, selection remains A+B+C, relative positions preserved', () => {
      // 1. Select A, B, C
      useUIStore.getState().selectElements(['el_text_1', 'el_rect_1', 'el_circle_1']);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_text_1', 'el_rect_1', 'el_circle_1']);

      // 2. Simulate pointer down on B (el_rect_1) at (60, 50)
      const elements = useTemplateStore.getState().template.elements;
      const hit = hitTestElements({ x: 60, y: 50 }, elements, 1.0);
      expect(hit?.id).toBe('el_rect_1');

      // Pointer down on an already-selected element in multi-selection does NOT collapse selection
      const currentSelected = useUIStore.getState().selectedElementIds;
      expect(currentSelected.includes(hit!.id)).toBe(true);
      expect(currentSelected).toHaveLength(3);

      // Record initial positions
      const initialA = elements.find((e) => e.id === 'el_text_1')!.bounds;
      const initialB = elements.find((e) => e.id === 'el_rect_1')!.bounds;
      const initialC = elements.find((e) => e.id === 'el_circle_1')!.bounds;

      const initialOffsetBA = { x: initialB.x - initialA.x, y: initialB.y - initialA.y };
      const initialOffsetCA = { x: initialC.x - initialA.x, y: initialC.y - initialA.y };

      // 3. Drag with delta { x: 8, y: -10 }
      const itemsToMove = [
        { id: 'el_text_1', initialBounds: initialA },
        { id: 'el_rect_1', initialBounds: initialB },
        { id: 'el_circle_1', initialBounds: initialC },
      ];
      const delta = { x: 8, y: -10 };
      const moved = calculateMultiElementMove(itemsToMove, delta, 100, 100);
      expect(moved).toHaveLength(3);

      // Apply move to template store
      useTemplateStore.getState().updateMultipleElementBounds(moved);

      // 4. Verify all elements moved
      const updatedElements = useTemplateStore.getState().template.elements;
      const updatedA = updatedElements.find((e) => e.id === 'el_text_1')!.bounds;
      const updatedB = updatedElements.find((e) => e.id === 'el_rect_1')!.bounds;
      const updatedC = updatedElements.find((e) => e.id === 'el_circle_1')!.bounds;

      expect(updatedA.x).toBe(initialA.x + 8);
      expect(updatedA.y).toBe(initialA.y - 10);
      expect(updatedB.x).toBe(initialB.x + 8);
      expect(updatedB.y).toBe(initialB.y - 10);
      expect(updatedC.x).toBe(initialC.x + 8);
      expect(updatedC.y).toBe(initialC.y - 10);

      // 5. Verify relative positions are strictly preserved
      expect(updatedB.x - updatedA.x).toBe(initialOffsetBA.x);
      expect(updatedB.y - updatedA.y).toBe(initialOffsetBA.y);
      expect(updatedC.x - updatedA.x).toBe(initialOffsetCA.x);
      expect(updatedC.y - updatedA.y).toBe(initialOffsetCA.y);

      // 6. Verify group selection remains active throughout and after the drag
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_text_1', 'el_rect_1', 'el_circle_1']);
    });

    it('normal click without dragging on an already-selected element collapses selection to that single element', () => {
      // 1. Select A, B, C
      useUIStore.getState().selectElements(['el_text_1', 'el_rect_1', 'el_circle_1']);
      expect(useUIStore.getState().selectedElementIds).toHaveLength(3);

      // 2. Simulate pointer down on B (el_rect_1) -> records pendingSingleSelectId = 'el_rect_1'
      let pendingSingleSelectId: string | null = 'el_rect_1';
      let hasDragged = false;

      // 3. Pointer released without drag movement (hasDragged remains false)
      if (!hasDragged && pendingSingleSelectId !== null) {
        useUIStore.getState().selectElement(pendingSingleSelectId, false);
        pendingSingleSelectId = null;
      }

      // 4. Selection should now be collapsed to only el_rect_1
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_rect_1']);
    });

    it('clicking an unselected element without Ctrl/Cmd replaces selection immediately', () => {
      // 1. Select A and B
      useUIStore.getState().selectElements(['el_text_1', 'el_rect_1']);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_text_1', 'el_rect_1']);

      // 2. Hit test on C (el_circle_1) at (15, 75)
      const elements = useTemplateStore.getState().template.elements;
      const hit = hitTestElements({ x: 15, y: 75 }, elements, 1.0);
      expect(hit?.id).toBe('el_circle_1');

      // 3. Hit element is not in selection -> click replaces selection
      const currentSelected = useUIStore.getState().selectedElementIds;
      expect(currentSelected.includes(hit!.id)).toBe(false);

      useUIStore.getState().selectElement(hit!.id, false);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_circle_1']);
    });

    it('Ctrl/Cmd+click toggles elements into or out of selection without replacing entire selection', () => {
      // 1. Start with A and B selected
      useUIStore.getState().selectElements(['el_text_1', 'el_rect_1']);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_text_1', 'el_rect_1']);

      // 2. Ctrl+click on C (el_circle_1) adds it to selection
      useUIStore.getState().selectElement('el_circle_1', true);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_text_1', 'el_rect_1', 'el_circle_1']);

      // 3. Ctrl+click on B (el_rect_1) removes it from selection
      useUIStore.getState().selectElement('el_rect_1', true);
      expect(useUIStore.getState().selectedElementIds).toEqual(['el_text_1', 'el_circle_1']);
    });
  });
});

