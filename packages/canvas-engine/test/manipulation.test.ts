import { describe, it, expect } from 'vitest';
import type { ElementBounds, TemplateElement } from '@uts/core';
import {
  isPointInElementBounds,
  hitTestElements,
} from '../src/manipulation/hit-test.js';
import {
  calculateElementHandles,
  calculateMultiElementBoundingBox,
  getHandleCursor,
  getElementRotatedCorners,
  getElementRotatedAABB,
  getElementWorldAnchor,
} from '../src/manipulation/handles.js';
import {
  calculatePositionSnappedDelta,
  calculateSnappedDelta,
  calculateMovedBounds,
  calculateMultiElementMove,
} from '../src/manipulation/transform.js';
import { calculateResizedBounds } from '../src/manipulation/resize.js';
import { screenToCanvas } from '../src/viewport/index.js';

describe('Manipulation Engine (Hit-Testing, Transforms & Handles)', () => {
  describe('1. Point-in-Bounds Hit Testing', () => {
    const unrotatedBounds: ElementBounds = {
      x: 20,
      y: 30,
      width: 50,
      height: 40,
      rotation: 0,
    };

    it('accurately tests points inside unrotated bounding box', () => {
      expect(isPointInElementBounds({ x: 35, y: 50 }, unrotatedBounds)).toBe(true);
      expect(isPointInElementBounds({ x: 20, y: 30 }, unrotatedBounds)).toBe(true);
      expect(isPointInElementBounds({ x: 70, y: 70 }, unrotatedBounds)).toBe(true);

      expect(isPointInElementBounds({ x: 19, y: 50 }, unrotatedBounds)).toBe(false);
      expect(isPointInElementBounds({ x: 71, y: 50 }, unrotatedBounds)).toBe(false);
      expect(isPointInElementBounds({ x: 35, y: 29 }, unrotatedBounds)).toBe(false);
      expect(isPointInElementBounds({ x: 35, y: 71 }, unrotatedBounds)).toBe(false);
    });

    it('accurately tests points with zero-dimension lines with tolerance', () => {
      const lineBounds: ElementBounds = {
        x: 10,
        y: 50,
        width: 100,
        height: 0,
        rotation: 0,
      };
      expect(isPointInElementBounds({ x: 50, y: 50 }, lineBounds)).toBe(true);
      expect(isPointInElementBounds({ x: 50, y: 50.8 }, lineBounds, 1.0)).toBe(true);
      expect(isPointInElementBounds({ x: 50, y: 53 }, lineBounds, 1.0)).toBe(false);
    });
  });

  describe('2. Rotated Element Hit Testing', () => {
    const rotatedBounds: ElementBounds = {
      x: 50,
      y: 50,
      width: 40,
      height: 20,
      rotation: 90,
    };

    it('detects point at center of rotated element', () => {
      expect(isPointInElementBounds({ x: 70, y: 60 }, rotatedBounds)).toBe(true);
    });

    it('correctly identifies points inside rotated bounds that are outside unrotated bounds', () => {
      expect(isPointInElementBounds({ x: 70, y: 42 }, rotatedBounds)).toBe(true);
    });

    it('correctly rejects points outside rotated bounds that were inside unrotated bounds', () => {
      expect(isPointInElementBounds({ x: 88, y: 60 }, rotatedBounds)).toBe(false);
    });

    it('handles 45-degree rotation accurately', () => {
      const bounds45: ElementBounds = {
        x: 100,
        y: 100,
        width: 40,
        height: 40,
        rotation: 45,
      };
      expect(isPointInElementBounds({ x: 120, y: 120 }, bounds45)).toBe(true);
      expect(isPointInElementBounds({ x: 100, y: 100 }, bounds45)).toBe(false);
    });
  });

  describe('3. Selection & Filtering (Single, Multi, Locked, Invisible, Empty Canvas)', () => {
    const elements: TemplateElement[] = [
      {
        id: 'el_low',
        type: 'shape',
        name: 'Background Card',
        bounds: { x: 10, y: 10, width: 80, height: 60, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#fff',
        strokeColor: '#000',
        strokeWidthMm: 1,
      },
      {
        id: 'el_high',
        type: 'text',
        name: 'Foreground Text',
        bounds: { x: 20, y: 20, width: 40, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 10,
        content: 'Title',
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
        id: 'el_invisible',
        type: 'shape',
        name: 'Hidden Layer',
        bounds: { x: 20, y: 20, width: 40, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: false,
        zIndex: 99,
        shapeType: 'rectangle',
        fillColor: 'red',
        strokeColor: 'red',
        strokeWidthMm: 1,
      },
      {
        id: 'el_locked',
        type: 'shape',
        name: 'Locked Background',
        bounds: { x: 20, y: 20, width: 40, height: 20, rotation: 0 },
        isLocked: true,
        isVisible: true,
        zIndex: 100,
        shapeType: 'rectangle',
        fillColor: 'gray',
        strokeColor: 'gray',
        strokeWidthMm: 1,
      },
    ];

    it('single selection: returns the topmost selectable element by descending zIndex', () => {
      const hit = hitTestElements({ x: 30, y: 30 }, elements);
      expect(hit).toBeDefined();
      expect(hit?.id).toBe('el_high');
    });

    it('invisible elements are ignored during hit testing', () => {
      const hit = hitTestElements({ x: 30, y: 30 }, elements);
      expect(hit?.id).not.toBe('el_invisible');
    });

    it('locked elements cannot be selected via hit testing', () => {
      const hit = hitTestElements({ x: 30, y: 30 }, elements);
      expect(hit?.id).not.toBe('el_locked');
    });

    it('returns lower element when point misses higher element', () => {
      const hit = hitTestElements({ x: 75, y: 55 }, elements);
      expect(hit).toBeDefined();
      expect(hit?.id).toBe('el_low');
    });

    it('empty canvas deselection: returns null when clicking on empty canvas', () => {
      const hit = hitTestElements({ x: 200, y: 200 }, elements);
      expect(hit).toBeNull();
    });
  });

  describe('4. Resize Handles, Rotated Corners & World Anchors', () => {
    const testBounds: ElementBounds = {
      x: 10,
      y: 20,
      width: 40,
      height: 30,
      rotation: 0,
    };

    it('generates all 8 handles with correct unrotated coordinates', () => {
      const handles = calculateElementHandles(testBounds);
      expect(handles).toHaveLength(8);

      const findHandle = (type: string) => handles.find((h) => h.type === type)!;

      expect(findHandle('nw').positionMm).toEqual({ x: 10, y: 20 });
      expect(findHandle('n').positionMm).toEqual({ x: 30, y: 20 });
      expect(findHandle('ne').positionMm).toEqual({ x: 50, y: 20 });
      expect(findHandle('e').positionMm).toEqual({ x: 50, y: 35 });
      expect(findHandle('se').positionMm).toEqual({ x: 50, y: 50 });
      expect(findHandle('s').positionMm).toEqual({ x: 30, y: 50 });
      expect(findHandle('sw').positionMm).toEqual({ x: 10, y: 50 });
      expect(findHandle('w').positionMm).toEqual({ x: 10, y: 35 });
    });

    it('calculates rotated handle positions correctly around center', () => {
      const rotated: ElementBounds = {
        x: 10,
        y: 20,
        width: 40,
        height: 30,
        rotation: 90,
      };
      const handles = calculateElementHandles(rotated);
      expect(handles).toHaveLength(8);

      const nw = handles.find((h) => h.type === 'nw')!;
      expect(nw.positionMm.x).toBeCloseTo(45, 2);
      expect(nw.positionMm.y).toBeCloseTo(15, 2);
    });

    it('calculates correct CSS cursors adjusted for rotation', () => {
      expect(getHandleCursor('n', 0)).toBe('ns-resize');
      expect(getHandleCursor('e', 0)).toBe('ew-resize');
      expect(getHandleCursor('n', 90)).toBe('ew-resize');
      expect(getHandleCursor('e', 90)).toBe('ns-resize');
    });

    it('getElementRotatedCorners returns the 4 world-space corners for rotated bounds', () => {
      const corners = getElementRotatedCorners({
        x: 50,
        y: 50,
        width: 40,
        height: 20,
        rotation: 90,
      });
      expect(corners).toHaveLength(4);

      const minX = Math.min(...corners.map((c) => c.x));
      const maxX = Math.max(...corners.map((c) => c.x));
      const minY = Math.min(...corners.map((c) => c.y));
      const maxY = Math.max(...corners.map((c) => c.y));

      expect(minX).toBeCloseTo(60, 2);
      expect(maxX).toBeCloseTo(80, 2);
      expect(minY).toBeCloseTo(40, 2);
      expect(maxY).toBeCloseTo(80, 2);
    });

    it('getElementRotatedAABB calculates accurate enclosing AABB for rotated elements', () => {
      const aabb = getElementRotatedAABB({
        x: 50,
        y: 50,
        width: 40,
        height: 20,
        rotation: 90,
      });
      expect(aabb.x).toBeCloseTo(60, 2);
      expect(aabb.y).toBeCloseTo(40, 2);
      expect(aabb.width).toBeCloseTo(20, 2);
      expect(aabb.height).toBeCloseTo(40, 2);
    });
  });

  describe('5. Combined Multi-Selection Bounding Box', () => {
    it('calculates enclosing bounding box for multiple unrotated elements', () => {
      const el1: TemplateElement = {
        id: '1',
        type: 'shape',
        name: 'A',
        bounds: { x: 10, y: 10, width: 20, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#000',
        strokeColor: '#000',
        strokeWidthMm: 1,
      };
      const el2: TemplateElement = {
        id: '2',
        type: 'shape',
        name: 'B',
        bounds: { x: 50, y: 40, width: 30, height: 40, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 2,
        shapeType: 'rectangle',
        fillColor: '#000',
        strokeColor: '#000',
        strokeWidthMm: 1,
      };

      const bbox = calculateMultiElementBoundingBox([el1, el2]);
      expect(bbox).toBeDefined();
      expect(bbox?.x).toBe(10);
      expect(bbox?.y).toBe(10);
      expect(bbox?.width).toBe(70);
      expect(bbox?.height).toBe(70);
    });

    it('calculates enclosing bounding box including rotated elements', () => {
      const el1: TemplateElement = {
        id: '1',
        type: 'shape',
        name: 'A',
        bounds: { x: 50, y: 50, width: 40, height: 20, rotation: 90 }, // Visual spans x:[60, 80], y:[40, 80]
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#000',
        strokeColor: '#000',
        strokeWidthMm: 1,
      };
      const el2: TemplateElement = {
        id: '2',
        type: 'shape',
        name: 'B',
        bounds: { x: 100, y: 30, width: 20, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 2,
        shapeType: 'rectangle',
        fillColor: '#000',
        strokeColor: '#000',
        strokeWidthMm: 1,
      };

      const bbox = calculateMultiElementBoundingBox([el1, el2]);
      expect(bbox).toBeDefined();
      expect(bbox?.x).toBeCloseTo(60, 2);
      expect(bbox?.y).toBeCloseTo(30, 2);
      expect(bbox?.width).toBeCloseTo(60, 2);
      expect(bbox?.height).toBeCloseTo(50, 2);
    });

    it('returns null for empty selection', () => {
      expect(calculateMultiElementBoundingBox([])).toBeNull();
    });
  });

  describe('6. Grid Snapping Semantics (Position-Based Alignment)', () => {
    it('snaps resulting position to grid: initial x = 12mm, target = 14mm, grid = 5mm -> effective delta = +3mm, resulting x = 15mm', () => {
      const initialPoint = { x: 12, y: 20 };
      const rawDelta = { x: 2, y: 6 };

      const effectiveDelta = calculatePositionSnappedDelta(initialPoint, rawDelta, 5);

      expect(effectiveDelta.x).toBe(3);
      expect(effectiveDelta.y).toBe(5);

      expect(initialPoint.x + effectiveDelta.x).toBe(15);
      expect(initialPoint.y + effectiveDelta.y).toBe(25);
    });

    it('preserves exact relative spacing in multi-selection when moving by snapped delta', () => {
      const elA = { x: 12, y: 10 };
      const elB = { x: 27, y: 35 };

      const rawDelta = { x: 2, y: 3 };
      const effectiveDelta = calculatePositionSnappedDelta(elA, rawDelta, 5);

      const movedA = { x: elA.x + effectiveDelta.x, y: elA.y + effectiveDelta.y };
      const movedB = { x: elB.x + effectiveDelta.x, y: elB.y + effectiveDelta.y };

      expect(movedA.x).toBe(15);
      expect(movedA.y).toBe(15);

      expect(movedB.x - movedA.x).toBe(elB.x - elA.x);
      expect(movedB.y - movedA.y).toBe(elB.y - elA.y);
    });

    it('returns raw delta unchanged when grid is disabled or 0', () => {
      const point = { x: 12, y: 20 };
      const rawDelta = { x: 2.3, y: 4.7 };
      expect(calculatePositionSnappedDelta(point, rawDelta, 0)).toEqual(rawDelta);
      expect(calculatePositionSnappedDelta(point, rawDelta, undefined)).toEqual(rawDelta);
    });

    it('preserves backward compatibility with calculateSnappedDelta', () => {
      expect(calculateSnappedDelta({ x: 3.4, y: 7.8 }, 10)).toEqual({ x: 0, y: 10 });
    });
  });

  describe('7. Movement & Rotated Page Boundaries', () => {
    const pageWidth = 210;
    const pageHeight = 297;

    it('moves unrotated element and clamps strictly within page bounds', () => {
      const initial: ElementBounds = { x: 10, y: 10, width: 50, height: 30, rotation: 0 };

      const moved = calculateMovedBounds(initial, { x: 15, y: 25 }, pageWidth, pageHeight);
      expect(moved.x).toBe(25);
      expect(moved.y).toBe(35);

      const clampedTopLeft = calculateMovedBounds(initial, { x: -30, y: -40 }, pageWidth, pageHeight);
      expect(clampedTopLeft.x).toBe(0);
      expect(clampedTopLeft.y).toBe(0);

      const clampedBottomRight = calculateMovedBounds(initial, { x: 250, y: 350 }, pageWidth, pageHeight);
      expect(clampedBottomRight.x).toBe(pageWidth - 50);
      expect(clampedBottomRight.y).toBe(pageHeight - 30);
    });

    it('constrains rotated element movement so all rotated corners stay within page boundaries', () => {
      const rotated: ElementBounds = {
        x: 50,
        y: 50,
        width: 40,
        height: 20,
        rotation: 90,
      };

      const movedLeft = calculateMovedBounds(rotated, { x: -200, y: 0 }, pageWidth, pageHeight);
      const leftAABB = getElementRotatedAABB(movedLeft);
      expect(leftAABB.x).toBeGreaterThanOrEqual(-1e-4);
      expect(leftAABB.x).toBeCloseTo(0, 2);

      const movedTop = calculateMovedBounds(rotated, { x: 0, y: -200 }, pageWidth, pageHeight);
      const topAABB = getElementRotatedAABB(movedTop);
      expect(topAABB.y).toBeGreaterThanOrEqual(-1e-4);
      expect(topAABB.y).toBeCloseTo(0, 2);

      const movedRight = calculateMovedBounds(rotated, { x: 500, y: 0 }, pageWidth, pageHeight);
      const rightAABB = getElementRotatedAABB(movedRight);
      expect(rightAABB.x + rightAABB.width).toBeLessThanOrEqual(pageWidth + 1e-4);
      expect(rightAABB.x + rightAABB.width).toBeCloseTo(pageWidth, 2);

      const movedBottom = calculateMovedBounds(rotated, { x: 0, y: 500 }, pageWidth, pageHeight);
      const bottomAABB = getElementRotatedAABB(movedBottom);
      expect(bottomAABB.y + bottomAABB.height).toBeLessThanOrEqual(pageHeight + 1e-4);
      expect(bottomAABB.y + bottomAABB.height).toBeCloseTo(pageHeight, 2);
    });

    it('multi-selection move clamps collectively and preserves relative positions including rotated elements', () => {
      const elements = [
        { id: 'el_1', initialBounds: { x: 20, y: 20, width: 30, height: 20, rotation: 0 } },
        { id: 'el_2', initialBounds: { x: 100, y: 100, width: 40, height: 20, rotation: 90 } },
      ];

      const moved = calculateMultiElementMove(elements, { x: 15, y: 10 }, pageWidth, pageHeight);

      expect(moved[0].bounds.x).toBe(35);
      expect(moved[0].bounds.y).toBe(30);
      expect(moved[1].bounds.x).toBe(115);
      expect(moved[1].bounds.y).toBe(110);

      const originalDeltaX = elements[1].initialBounds.x - elements[0].initialBounds.x;
      const movedDeltaX = moved[1].bounds.x - moved[0].bounds.x;
      expect(movedDeltaX).toBe(originalDeltaX);
    });
  });

  describe('8. 8-Handle Resizing & Opposite Anchor Correctness', () => {
    it('unrotated resize: opposite anchor remains exactly fixed in world coordinates for all 8 handles', () => {
      const initial: ElementBounds = { x: 20, y: 30, width: 50, height: 40, rotation: 0 };
      const delta = { x: 10, y: 15 };

      const handleOpposites: [string, string][] = [
        ['se', 'nw'],
        ['nw', 'se'],
        ['ne', 'sw'],
        ['sw', 'ne'],
        ['e', 'w'],
        ['w', 'e'],
        ['s', 'n'],
        ['n', 's'],
      ];

      for (const [handle, opposite] of handleOpposites) {
        const initialAnchor = getElementWorldAnchor(initial, opposite as any);
        const resized = calculateResizedBounds({
          initialBounds: initial,
          handle: handle as any,
          deltaMm: delta,
        });
        const finalAnchor = getElementWorldAnchor(resized, opposite as any);

        expect(finalAnchor.x).toBeCloseTo(initialAnchor.x, 3);
        expect(finalAnchor.y).toBeCloseTo(initialAnchor.y, 3);
      }
    });

    it('rotated 90° resize: opposite anchor remains strictly fixed in world coordinates', () => {
      const initial: ElementBounds = { x: 50, y: 50, width: 40, height: 20, rotation: 90 };
      const delta = { x: 10, y: 10 };

      const handleOpposites: [string, string][] = [
        ['se', 'nw'],
        ['nw', 'se'],
        ['ne', 'sw'],
        ['sw', 'ne'],
        ['e', 'w'],
        ['w', 'e'],
        ['s', 'n'],
        ['n', 's'],
      ];

      for (const [handle, opposite] of handleOpposites) {
        const initialAnchor = getElementWorldAnchor(initial, opposite as any);
        const resized = calculateResizedBounds({
          initialBounds: initial,
          handle: handle as any,
          deltaMm: delta,
        });
        const finalAnchor = getElementWorldAnchor(resized, opposite as any);

        expect(finalAnchor.x).toBeCloseTo(initialAnchor.x, 3);
        expect(finalAnchor.y).toBeCloseTo(initialAnchor.y, 3);
        expect(resized.rotation).toBe(90);
        expect(resized.width).toBeGreaterThan(0);
        expect(resized.height).toBeGreaterThan(0);
      }
    });

    it('rotated 45° resize: opposite anchor remains strictly fixed in world coordinates', () => {
      const initial: ElementBounds = { x: 80, y: 80, width: 30, height: 30, rotation: 45 };
      const delta = { x: 8, y: -5 };

      const handleOpposites: [string, string][] = [
        ['se', 'nw'],
        ['nw', 'se'],
        ['ne', 'sw'],
        ['sw', 'ne'],
        ['e', 'w'],
        ['w', 'e'],
        ['s', 'n'],
        ['n', 's'],
      ];

      for (const [handle, opposite] of handleOpposites) {
        const initialAnchor = getElementWorldAnchor(initial, opposite as any);
        const resized = calculateResizedBounds({
          initialBounds: initial,
          handle: handle as any,
          deltaMm: delta,
        });
        const finalAnchor = getElementWorldAnchor(resized, opposite as any);

        expect(finalAnchor.x).toBeCloseTo(initialAnchor.x, 3);
        expect(finalAnchor.y).toBeCloseTo(initialAnchor.y, 3);
        expect(resized.rotation).toBe(45);
      }
    });

    it('enforces minimum dimensions (width/height cannot shrink below minWidthMm)', () => {
      const initial: ElementBounds = { x: 20, y: 30, width: 50, height: 40, rotation: 0 };
      const resized = calculateResizedBounds({
        initialBounds: initial,
        handle: 'se',
        deltaMm: { x: -100, y: -100 },
        minWidthMm: 5,
        minHeightMm: 5,
      });
      expect(resized.width).toBe(5);
      expect(resized.height).toBe(5);
    });

    it('supports proportional aspect ratio resizing when keepAspectRatio is true (Shift key)', () => {
      const initial: ElementBounds = { x: 20, y: 30, width: 50, height: 40, rotation: 0 };
      const resized = calculateResizedBounds({
        initialBounds: initial,
        handle: 'se',
        deltaMm: { x: 20, y: 5 },
        keepAspectRatio: true,
      });
      expect(resized.width).toBe(70);
      expect(resized.height).toBe(56);
      expect(resized.width / resized.height).toBeCloseTo(50 / 40, 4);
    });

    it('clamps rotated resize to page boundary while keeping opposite anchor fixed', () => {
      const pageWidth = 210;
      const pageHeight = 297;
      const initial: ElementBounds = { x: 160, y: 50, width: 40, height: 20, rotation: 90 };
      const initialAnchor = getElementWorldAnchor(initial, 'w');

      const resized = calculateResizedBounds({
        initialBounds: initial,
        handle: 'e',
        deltaMm: { x: 50, y: 0 },
        pageWidthMm: pageWidth,
        pageHeightMm: pageHeight,
      });

      const corners = getElementRotatedCorners(resized);
      for (const c of corners) {
        expect(c.x).toBeLessThanOrEqual(pageWidth + 1e-3);
      }

      const finalAnchor = getElementWorldAnchor(resized, 'w');
      expect(finalAnchor.x).toBeCloseTo(initialAnchor.x, 3);
      expect(finalAnchor.y).toBeCloseTo(initialAnchor.y, 3);
    });
  });

  describe('9. Screen-to-MM Drag Calculations', () => {
    it('converts screen pointer coordinates to physical mm across zoom levels and pan offsets', () => {
      const viewport = { zoom: 1.5, panX: 100, panY: 50, viewportWidth: 800, viewportHeight: 600 };

      const mm = screenToCanvas({ x: 250, y: 170 }, viewport);

      expect(mm.x).toBeGreaterThan(0);
      expect(mm.y).toBeGreaterThan(0);

      const mm2 = screenToCanvas({ x: 300, y: 170 }, viewport);
      const deltaMm = mm2.x - mm.x;
      expect(deltaMm).toBeCloseTo(50 / (1.5 * (96 / 25.4)), 2);
    });
  });

  describe('10. Deletion & Keyboard Nudge Semantics', () => {
    it('deleting elements removes only unlocked elements and preserves locked elements', () => {
      const elements: TemplateElement[] = [
        { id: 'el_1', type: 'shape', name: 'A', bounds: { x: 10, y: 10, width: 20, height: 20 }, isLocked: false, isVisible: true, zIndex: 1, shapeType: 'rectangle' },
        { id: 'el_2', type: 'shape', name: 'B', bounds: { x: 30, y: 10, width: 20, height: 20 }, isLocked: true, isVisible: true, zIndex: 2, shapeType: 'rectangle' },
      ];

      const idsToDelete = ['el_1', 'el_2'];
      const remaining = elements.filter((el) => !idsToDelete.includes(el.id) || el.isLocked);

      expect(remaining.map((e) => e.id)).toEqual(['el_2']);
    });

    it('nudges elements by 1mm step and Shift-nudges by 10mm step, clamped to page boundaries', () => {
      const elements = [
        { id: 'el_1', initialBounds: { x: 5, y: 5, width: 20, height: 20, rotation: 0 } },
      ];

      // Normal nudge left: step = -1mm
      const nudge1 = calculateMultiElementMove(elements, { x: -1, y: 0 }, 210, 297);
      expect(nudge1[0].bounds.x).toBe(4);

      // Shift-nudge right: step = +10mm
      const nudge10 = calculateMultiElementMove(elements, { x: 10, y: 0 }, 210, 297);
      expect(nudge10[0].bounds.x).toBe(15);

      // Shift-nudge left clamped to 0 boundary
      const nudgeClamped = calculateMultiElementMove(elements, { x: -10, y: 0 }, 210, 297);
      expect(nudgeClamped[0].bounds.x).toBe(0);
    });
  });
});


