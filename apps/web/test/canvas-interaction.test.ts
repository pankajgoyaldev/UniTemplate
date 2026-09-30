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
import { createElementFromTemplate } from '../src/components/toolbox/elementTemplates.js';

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

  describe('8. Locked Groups and Newly Created Element Independence (Regression Tests)', () => {
    // Scenario & Test 1: Create A, B, C -> Group A, B, C -> Lock group -> Create D
    it('Test 1: newly created element D is independent, unlocked, selectable and movable after locking group (A, B, C)', () => {
      const pageSettings = useTemplateStore.getState().template.pageSettings;
      const elA = createElementFromTemplate('text', { pageSettings, existingElements: [] });
      const elB = createElementFromTemplate('text', { pageSettings, existingElements: [elA] });
      const elC = createElementFromTemplate('text', { pageSettings, existingElements: [elA, elB] });

      useTemplateStore.setState((s) => ({
        template: {
          ...s.template,
          elements: [elA, elB, elC],
        },
      }));

      // Multi-select A, B, C as a group
      useUIStore.getState().selectElements([elA.id, elB.id, elC.id]);
      expect(useUIStore.getState().selectedElementIds).toEqual([elA.id, elB.id, elC.id]);

      // Lock the group
      useTemplateStore.getState().updateElements([elA.id, elB.id, elC.id], { isLocked: true });
      const lockedElements = useTemplateStore.getState().template.elements;
      expect(lockedElements.find((e) => e.id === elA.id)?.isLocked).toBe(true);
      expect(lockedElements.find((e) => e.id === elB.id)?.isLocked).toBe(true);
      expect(lockedElements.find((e) => e.id === elC.id)?.isLocked).toBe(true);

      // Now create element D
      const elD = createElementFromTemplate('text', { pageSettings, existingElements: lockedElements });
      useTemplateStore.getState().addElement(elD);
      useUIStore.getState().selectElement(elD.id, false);

      // Assertions for Test 1:
      // 1. D is an independent root-level element in template.elements
      const allElements = useTemplateStore.getState().template.elements;
      const foundD = allElements.find((e) => e.id === elD.id);
      expect(foundD).toBeDefined();
      expect(allElements).toHaveLength(4);

      // 2. D is unlocked
      expect(foundD?.isLocked).toBe(false);

      // 3. D is selectable and selection does not contain the locked group
      expect(useUIStore.getState().selectedElementIds).toEqual([elD.id]);

      // 4. D can be moved while A, B, C remain locked at original positions
      const movedD = calculateMovedBounds(foundD!.bounds, { x: 10, y: 15 }, 210, 297);
      useTemplateStore.getState().updateElementBounds(elD.id, movedD);
      const afterMove = useTemplateStore.getState().template.elements;
      expect(afterMove.find((e) => e.id === elD.id)?.bounds.x).toBe(movedD.x);
      expect(afterMove.find((e) => e.id === elA.id)?.isLocked).toBe(true);
      expect(afterMove.find((e) => e.id === elB.id)?.isLocked).toBe(true);
      expect(afterMove.find((e) => e.id === elC.id)?.isLocked).toBe(true);
    });

    // Test 2: Locked Group A, B, C -> Create D -> Create E
    it('Test 2: multiple newly created elements (D, E) are independent root-level elements with distinct bounds', () => {
      const pageSettings = useTemplateStore.getState().template.pageSettings;
      const elA: TemplateElement = { ...initialElements[0], id: 'grp_a', isLocked: true };
      const elB: TemplateElement = { ...initialElements[1], id: 'grp_b', isLocked: true };
      const elC: TemplateElement = { ...initialElements[3], id: 'grp_c', isLocked: true };
      useTemplateStore.setState((s) => ({
        template: { ...s.template, elements: [elA, elB, elC] },
      }));

      // Create D and E
      const elD = createElementFromTemplate('text', { pageSettings, existingElements: [elA, elB, elC] });
      useTemplateStore.getState().addElement(elD);

      const elE = createElementFromTemplate('text', { pageSettings, existingElements: [elA, elB, elC, elD] });
      useTemplateStore.getState().addElement(elE);

      const current = useTemplateStore.getState().template.elements;
      expect(current).toHaveLength(5);
      expect(elD.isLocked).toBe(false);
      expect(elE.isLocked).toBe(false);
      // D and E must have distinct positions (no identical stacking)
      expect(elD.bounds.x === elE.bounds.x && elD.bounds.y === elE.bounds.y).toBe(false);
    });

    // Test 3: Locked Group A, B, C -> Create D -> Select D
    it('Test 3: selecting D selects only D and does not select the locked group', () => {
      const pageSettings = useTemplateStore.getState().template.pageSettings;
      const elA: TemplateElement = { ...initialElements[0], id: 'grp_a', isLocked: true };
      const elB: TemplateElement = { ...initialElements[1], id: 'grp_b', isLocked: true };
      const elC: TemplateElement = { ...initialElements[3], id: 'grp_c', isLocked: true };
      useTemplateStore.setState((s) => ({
        template: { ...s.template, elements: [elA, elB, elC] },
      }));

      // Prior selection was on locked elements
      useUIStore.getState().selectElements(['grp_a', 'grp_b', 'grp_c']);

      // Create D and select D
      const elD = createElementFromTemplate('text', { pageSettings, existingElements: [elA, elB, elC] });
      useTemplateStore.getState().addElement(elD);
      useUIStore.getState().selectElement(elD.id, false);

      expect(useUIStore.getState().selectedElementIds).toEqual([elD.id]);
      expect(useUIStore.getState().selectedElementIds).not.toContain('grp_a');
      expect(useUIStore.getState().selectedElementIds).not.toContain('grp_b');
      expect(useUIStore.getState().selectedElementIds).not.toContain('grp_c');
    });

    // Test 4: Locked Group A, B, C -> Create D -> Group D with another unlocked element
    it('Test 4: grouping D with another unlocked element contains only explicitly selected elements', () => {
      const pageSettings = useTemplateStore.getState().template.pageSettings;
      const elA: TemplateElement = { ...initialElements[0], id: 'grp_a', isLocked: true };
      const elB: TemplateElement = { ...initialElements[1], id: 'grp_b', isLocked: true };
      const elC: TemplateElement = { ...initialElements[3], id: 'grp_c', isLocked: true };
      useTemplateStore.setState((s) => ({
        template: { ...s.template, elements: [elA, elB, elC] },
      }));

      // Create D and E
      const elD = createElementFromTemplate('text', { pageSettings, existingElements: [elA, elB, elC] });
      const elE = createElementFromTemplate('rectangle', { pageSettings, existingElements: [elA, elB, elC, elD] });
      useTemplateStore.getState().addElement(elD);
      useTemplateStore.getState().addElement(elE);

      // Multi-select D + E
      useUIStore.getState().selectElements([elD.id, elE.id]);
      expect(useUIStore.getState().selectedElementIds).toEqual([elD.id, elE.id]);

      // Move group (D + E)
      const moved = calculateMultiElementMove(
        [
          { id: elD.id, initialBounds: elD.bounds },
          { id: elE.id, initialBounds: elE.bounds },
        ],
        { x: 5, y: 5 },
        pageSettings.width,
        pageSettings.height,
      );
      useTemplateStore.getState().updateMultipleElementBounds(moved);

      // Verify only D and E moved, locked group A, B, C remain untouched
      const current = useTemplateStore.getState().template.elements;
      expect(current.find((e) => e.id === elD.id)?.bounds.x).toBe(elD.bounds.x + 5);
      expect(current.find((e) => e.id === elE.id)?.bounds.x).toBe(elE.bounds.x + 5);
      expect(current.find((e) => e.id === elA.id)?.bounds.x).toBe(elA.bounds.x);
      expect(current.find((e) => e.id === elB.id)?.bounds.x).toBe(elB.bounds.x);
      expect(current.find((e) => e.id === elC.id)?.bounds.x).toBe(elC.bounds.x);
    });

    // Test 5: Locked Group A, B, C -> Unlock group
    it('Test 5: unlocking the group changes only that group lock state', () => {
      const pageSettings = useTemplateStore.getState().template.pageSettings;
      const elA: TemplateElement = { ...initialElements[0], id: 'grp_a', isLocked: true };
      const elB: TemplateElement = { ...initialElements[1], id: 'grp_b', isLocked: true };
      const elC: TemplateElement = { ...initialElements[3], id: 'grp_c', isLocked: true };
      const elD: TemplateElement = { ...initialElements[0], id: 'el_d', isLocked: false };
      useTemplateStore.setState((s) => ({
        template: { ...s.template, elements: [elA, elB, elC, elD] },
      }));

      // Unlock group (A, B, C)
      useTemplateStore.getState().updateElements(['grp_a', 'grp_b', 'grp_c'], { isLocked: false });

      const current = useTemplateStore.getState().template.elements;
      expect(current.find((e) => e.id === 'grp_a')?.isLocked).toBe(false);
      expect(current.find((e) => e.id === 'grp_b')?.isLocked).toBe(false);
      expect(current.find((e) => e.id === 'grp_c')?.isLocked).toBe(false);
      expect(current.find((e) => e.id === 'el_d')?.isLocked).toBe(false);
    });
  });

  describe('9. Locked Groups Selection Lifecycle and Persistent Group ID (Regression Tests)', () => {
    // Test 1: Locked group -> deselect -> click member -> group selected
    it('Test 1: locked group remains selectable after deselect: clicking any member selects the entire group', () => {
      const elA: TemplateElement = {
        ...initialElements[0],
        id: 'grp_m1',
        groupId: 'grp_locked_1',
        bounds: { x: 20, y: 20, width: 30, height: 15, rotation: 0 },
        isLocked: true,
      };
      const elB: TemplateElement = {
        ...initialElements[1],
        id: 'grp_m2',
        groupId: 'grp_locked_1',
        bounds: { x: 60, y: 20, width: 30, height: 15, rotation: 0 },
        isLocked: true,
      };
      const elC: TemplateElement = {
        ...initialElements[3],
        id: 'grp_m3',
        groupId: 'grp_locked_1',
        bounds: { x: 100, y: 20, width: 30, height: 15, rotation: 0 },
        isLocked: true,
      };

      useTemplateStore.setState((s) => ({
        template: { ...s.template, elements: [elA, elB, elC] },
      }));

      // 1. Group was previously selected
      useUIStore.getState().selectElements([elA.id, elB.id, elC.id]);
      expect(useUIStore.getState().selectedElementIds).toEqual(['grp_m1', 'grp_m2', 'grp_m3']);

      // 2. Deselect (click empty canvas)
      useUIStore.getState().clearSelection();
      expect(useUIStore.getState().selectedElementIds).toHaveLength(0);

      // 3. Click member B at (65, 25) with hit testing including locked elements
      const elements = useTemplateStore.getState().template.elements;
      const hit = hitTestElements({ x: 65, y: 25 }, elements, 1.0, { includeLocked: true });
      expect(hit).toBeDefined();
      expect(hit?.id).toBe('grp_m2');
      expect(hit?.groupId).toBe('grp_locked_1');

      // 4. Group resolution: find all members of the group and select them
      const groupMemberIds = elements
        .filter((el) => el.groupId === hit!.groupId && el.isVisible)
        .map((el) => el.id);

      useUIStore.getState().selectElements(groupMemberIds);

      // 5. Entire group is now selected
      expect(useUIStore.getState().selectedElementIds).toEqual(['grp_m1', 'grp_m2', 'grp_m3']);
    });

    // Test 2: Locked group -> refresh -> click member -> group selected
    it('Test 2: locked group persists groupId across save/refresh and clicking member selects entire group', () => {
      const elA: TemplateElement = {
        ...initialElements[0],
        id: 'pers_a',
        groupId: 'persistent_group_42',
        bounds: { x: 25, y: 30, width: 40, height: 20, rotation: 0 },
        isLocked: true,
      };
      const elB: TemplateElement = {
        ...initialElements[1],
        id: 'pers_b',
        groupId: 'persistent_group_42',
        bounds: { x: 75, y: 30, width: 40, height: 20, rotation: 0 },
        isLocked: true,
      };

      useTemplateStore.setState((s) => ({
        template: { ...s.template, elements: [elA, elB] },
      }));

      // Simulate Save / Serialize to JSON (e.g. .uts or session storage)
      const currentTemplate = useTemplateStore.getState().template;
      const serializedJson = JSON.stringify(currentTemplate);

      // Simulate Refresh: reload from serialized JSON
      const refreshedTemplate = JSON.parse(serializedJson);
      useTemplateStore.getState().setTemplate(refreshedTemplate);
      useUIStore.getState().clearSelection();

      expect(useUIStore.getState().selectedElementIds).toHaveLength(0);

      // Hit test on member B after refresh
      const refreshedElements = useTemplateStore.getState().template.elements;
      const hit = hitTestElements({ x: 80, y: 35 }, refreshedElements, 1.0, { includeLocked: true });
      expect(hit).toBeDefined();
      expect(hit?.id).toBe('pers_b');
      expect(hit?.groupId).toBe('persistent_group_42');

      // Rediscover group via persistent groupId
      const groupMembers = refreshedElements
        .filter((el) => el.groupId === hit!.groupId && el.isVisible)
        .map((el) => el.id);

      useUIStore.getState().selectElements(groupMembers);
      expect(useUIStore.getState().selectedElementIds).toEqual(['pers_a', 'pers_b']);
    });

    // Test 3: Selected locked group -> Ctrl+L -> all members unlocked
    it('Test 3: selected locked group unlocks all members on Ctrl+L shortcut action', () => {
      const elA: TemplateElement = {
        ...initialElements[0],
        id: 'lock_a',
        groupId: 'grp_toggle',
        bounds: { x: 10, y: 10, width: 20, height: 10, rotation: 0 },
        isLocked: true,
      };
      const elB: TemplateElement = {
        ...initialElements[1],
        id: 'lock_b',
        groupId: 'grp_toggle',
        bounds: { x: 35, y: 10, width: 20, height: 10, rotation: 0 },
        isLocked: true,
      };

      useTemplateStore.setState((s) => ({
        template: { ...s.template, elements: [elA, elB] },
      }));

      // Select the locked group
      useUIStore.getState().selectElements(['lock_a', 'lock_b']);
      expect(useUIStore.getState().selectedElementIds).toEqual(['lock_a', 'lock_b']);

      // Execute Ctrl+L toggle action
      const selectedIds = useUIStore.getState().selectedElementIds;
      const elements = useTemplateStore.getState().template.elements;
      const anyLocked = elements.some((el) => selectedIds.includes(el.id) && el.isLocked);
      expect(anyLocked).toBe(true);

      // Unlock all members
      useTemplateStore.getState().updateElements(selectedIds, { isLocked: !anyLocked });

      const updated = useTemplateStore.getState().template.elements;
      expect(updated.find((e) => e.id === 'lock_a')?.isLocked).toBe(false);
      expect(updated.find((e) => e.id === 'lock_b')?.isLocked).toBe(false);

      // Group can now move normally
      const moved = calculateMultiElementMove(
        [
          { id: 'lock_a', initialBounds: elA.bounds },
          { id: 'lock_b', initialBounds: elB.bounds },
        ],
        { x: 10, y: 10 },
        210,
        297,
      );
      useTemplateStore.getState().updateMultipleElementBounds(moved);
      const afterMove = useTemplateStore.getState().template.elements;
      expect(afterMove.find((e) => e.id === 'lock_a')?.bounds.x).toBe(20);
      expect(afterMove.find((e) => e.id === 'lock_b')?.bounds.x).toBe(45);
    });

    // Test 4: Group A locked + Group B unlocked -> unlock A -> B unchanged
    it('Test 4: Group A locked + Group B unlocked -> unlocking A leaves Group B unchanged', () => {
      const a1: TemplateElement = { ...initialElements[0], id: 'a1', groupId: 'group_A', isLocked: true };
      const a2: TemplateElement = { ...initialElements[1], id: 'a2', groupId: 'group_A', isLocked: true };
      const b1: TemplateElement = { ...initialElements[2], id: 'b1', groupId: 'group_B', isLocked: false };
      const b2: TemplateElement = { ...initialElements[3], id: 'b2', groupId: 'group_B', isLocked: false };

      useTemplateStore.setState((s) => ({
        template: { ...s.template, elements: [a1, a2, b1, b2] },
      }));

      // Select and unlock Group A
      useUIStore.getState().selectElements(['a1', 'a2']);
      useTemplateStore.getState().updateElements(['a1', 'a2'], { isLocked: false });

      const afterUnlockA = useTemplateStore.getState().template.elements;
      // Group A members are now unlocked
      expect(afterUnlockA.find((e) => e.id === 'a1')?.isLocked).toBe(false);
      expect(afterUnlockA.find((e) => e.id === 'a2')?.isLocked).toBe(false);

      // Group B members remain unchanged (unlocked)
      expect(afterUnlockA.find((e) => e.id === 'b1')?.isLocked).toBe(false);
      expect(afterUnlockA.find((e) => e.id === 'b2')?.isLocked).toBe(false);

      // If Group B was locked, unlocking Group A also leaves Group B locked
      useTemplateStore.getState().updateElements(['b1', 'b2'], { isLocked: true });
      useTemplateStore.getState().updateElements(['a1', 'a2'], { isLocked: false });
      const afterCheck = useTemplateStore.getState().template.elements;
      expect(afterCheck.find((e) => e.id === 'b1')?.isLocked).toBe(true);
      expect(afterCheck.find((e) => e.id === 'b2')?.isLocked).toBe(true);
    });

    // Test 5: Locked Group -> create new element -> new element remains independent
    it('Test 5: creating a new element after locked group keeps the new element independent and unlocked', () => {
      const pageSettings = useTemplateStore.getState().template.pageSettings;
      const elA: TemplateElement = { ...initialElements[0], id: 'g_a', groupId: 'lock_grp', isLocked: true };
      const elB: TemplateElement = { ...initialElements[1], id: 'g_b', groupId: 'lock_grp', isLocked: true };

      useTemplateStore.setState((s) => ({
        template: { ...s.template, elements: [elA, elB] },
      }));

      // Create new element D
      const elD = createElementFromTemplate('text', { pageSettings, existingElements: [elA, elB] });
      useTemplateStore.getState().addElement(elD);

      // Select D
      useUIStore.getState().selectElement(elD.id, false);

      // Assert D is independent
      const elements = useTemplateStore.getState().template.elements;
      const foundD = elements.find((e) => e.id === elD.id);
      expect(foundD).toBeDefined();
      expect(foundD?.isLocked).toBe(false);
      expect(foundD?.groupId).toBeUndefined();

      // Only D is selected
      expect(useUIStore.getState().selectedElementIds).toEqual([elD.id]);

      // D can be moved while group remains locked
      const movedD = calculateMovedBounds(foundD!.bounds, { x: 12, y: 18 }, 210, 297);
      useTemplateStore.getState().updateElementBounds(elD.id, movedD);

      const after = useTemplateStore.getState().template.elements;
      expect(after.find((e) => e.id === elD.id)?.bounds.x).toBe(movedD.x);
      expect(after.find((e) => e.id === 'g_a')?.isLocked).toBe(true);
      expect(after.find((e) => e.id === 'g_b')?.isLocked).toBe(true);
    });
  });
});

