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

    it('resizes horizontal line (height = 0) without converting it to a box', () => {
      const initial: ElementBounds = { x: 10, y: 20, width: 100, height: 0, rotation: 0 };
      const resized = calculateResizedBounds({
        initialBounds: initial,
        handle: 'e',
        deltaMm: { x: 20, y: 0 },
      });
      expect(resized.width).toBe(120);
      expect(resized.height).toBe(0);
    });

    it('resizes vertical line (width = 0) without converting it to a box', () => {
      const initial: ElementBounds = { x: 10, y: 20, width: 0, height: 100, rotation: 0 };
      const resized = calculateResizedBounds({
        initialBounds: initial,
        handle: 's',
        deltaMm: { x: 0, y: 30 },
      });
      expect(resized.width).toBe(0);
      expect(resized.height).toBe(130);
    });

    it('prevents shrinking line to 0x0 degenerate bounds', () => {
      const initial: ElementBounds = { x: 10, y: 20, width: 10, height: 0, rotation: 0 };
      const resized = calculateResizedBounds({
        initialBounds: initial,
        handle: 'e',
        deltaMm: { x: -100, y: 0 },
      });
      expect(resized.width).toBeGreaterThan(0);
      expect(resized.height).toBe(0);
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

  describe('11. Optional Grid Snapping, Decimal Movement & Modifier Bypass (Word-like fine adjustments)', () => {
    // Helper replicating the Viewport delta dispatch logic
    function resolveEffectiveDelta(
      referencePointMm: Point,
      rawDeltaMm: Point,
      snapToGrid: boolean,
      gridSizeMm: number,
      altOrCtrlPressed: boolean,
    ): Point {
      const shouldSnap = snapToGrid && !altOrCtrlPressed;
      return shouldSnap
        ? calculatePositionSnappedDelta(referencePointMm, rawDeltaMm, gridSizeMm)
        : rawDeltaMm;
    }

    const initialElementBounds: ElementBounds = {
      x: 12.35,
      y: 24.65,
      width: 50.0,
      height: 30.0,
      rotation: 0,
    };

    it('when Snap to Grid is ON (no modifier), element moves snap strictly to grid spacing (5mm)', () => {
      // User moves mouse by raw delta (+2.1mm, +3.2mm) -> target (14.45mm, 27.85mm)
      // Closest 5mm multiples are 15mm and 30mm
      const rawDelta = { x: 2.1, y: 3.2 };
      const effectiveDelta = resolveEffectiveDelta(
        { x: initialElementBounds.x, y: initialElementBounds.y },
        rawDelta,
        true, // snapToGrid ON
        5,    // 5mm grid
        false // no modifier
      );

      // Expected snapped position: (15, 30) -> delta = (15 - 12.35, 30 - 24.65) = (2.65, 5.35)
      expect(effectiveDelta.x).toBeCloseTo(2.65, 4);
      expect(effectiveDelta.y).toBeCloseTo(5.35, 4);

      const moved = calculateMovedBounds(initialElementBounds, effectiveDelta, 210, 297);
      expect(moved.x).toBeCloseTo(15.0, 4);
      expect(moved.y).toBeCloseTo(30.0, 4);
    });

    it('when Snap to Grid is OFF, element moves smoothly with fine decimal mm adjustments (no 5mm jumps)', () => {
      // User moves mouse by small fractional delta (+0.37mm, -0.84mm)
      const rawDelta = { x: 0.37, y: -0.84 };
      const effectiveDelta = resolveEffectiveDelta(
        { x: initialElementBounds.x, y: initialElementBounds.y },
        rawDelta,
        false, // snapToGrid OFF
        5,     // 5mm grid
        false  // no modifier
      );

      // Returns exact raw delta without rounding or snapping
      expect(effectiveDelta).toEqual(rawDelta);

      const moved = calculateMovedBounds(initialElementBounds, effectiveDelta, 210, 297);
      expect(moved.x).toBeCloseTo(12.35 + 0.37, 4); // 12.72mm
      expect(moved.y).toBeCloseTo(24.65 - 0.84, 4); // 23.81mm
    });

    it('when Snap to Grid is ON, holding Alt or Ctrl temporarily disables snapping for fine adjustments', () => {
      const rawDelta = { x: 0.45, y: 0.82 };

      // Alt pressed: snap is bypassed
      const altDelta = resolveEffectiveDelta(
        { x: initialElementBounds.x, y: initialElementBounds.y },
        rawDelta,
        true, // snapToGrid ON
        5,    // 5mm grid
        true  // Alt/Ctrl pressed (modifier bypass)
      );
      expect(altDelta).toEqual(rawDelta);

      const moved = calculateMovedBounds(initialElementBounds, altDelta, 210, 297);
      expect(moved.x).toBeCloseTo(12.8, 4);
      expect(moved.y).toBeCloseTo(25.47, 4);
    });

    it('when Snap to Grid is ON, resizing edge snaps to chosen grid spacing (5mm)', () => {
      const eastHandleAnchor = getElementWorldAnchor(initialElementBounds, 'e'); // x: 62.35, y: 39.65
      const rawResizeDelta = { x: 1.4, y: 0 }; // target x = 63.75mm -> snapped x = 65.0mm (delta = +2.65mm)

      const effectiveDelta = resolveEffectiveDelta(
        eastHandleAnchor,
        rawResizeDelta,
        true, // snapToGrid ON
        5,    // 5mm grid
        false // no modifier
      );

      expect(effectiveDelta.x).toBeCloseTo(2.65, 4);

      const resized = calculateResizedBounds({
        initialBounds: initialElementBounds,
        handle: 'e',
        deltaMm: effectiveDelta,
        pageWidthMm: 210,
        pageHeightMm: 297,
      });

      // Opposite anchor ('w') stays fixed at x = 12.35; right edge snaps to 65.0mm -> width = 65 - 12.35 = 52.65mm
      expect(resized.x).toBeCloseTo(12.35, 4);
      expect(resized.x + resized.width).toBeCloseTo(65.0, 4);
      expect(resized.width).toBeCloseTo(52.65, 4);
    });

    it('when Snap to Grid is OFF, resizing allows smooth decimal mm dimensions with no 5mm jumps', () => {
      const eastHandleAnchor = getElementWorldAnchor(initialElementBounds, 'e');
      const rawResizeDelta = { x: 0.73, y: 0 }; // fine MS Word-like fractional adjustment

      const effectiveDelta = resolveEffectiveDelta(
        eastHandleAnchor,
        rawResizeDelta,
        false, // snapToGrid OFF
        5,
        false
      );

      expect(effectiveDelta).toEqual(rawResizeDelta);

      const resized = calculateResizedBounds({
        initialBounds: initialElementBounds,
        handle: 'e',
        deltaMm: effectiveDelta,
        pageWidthMm: 210,
        pageHeightMm: 297,
      });

      expect(resized.x).toBeCloseTo(12.35, 4);
      expect(resized.width).toBeCloseTo(50.73, 4);
    });

    it('when Snap to Grid is ON, holding Alt/Ctrl during resizing allows smooth decimal adjustments', () => {
      const southHandleAnchor = getElementWorldAnchor(initialElementBounds, 's');
      const rawResizeDelta = { x: 0, y: 1.18 };

      const effectiveDelta = resolveEffectiveDelta(
        southHandleAnchor,
        rawResizeDelta,
        true, // snapToGrid ON
        5,
        true  // Alt/Ctrl held
      );

      expect(effectiveDelta).toEqual(rawResizeDelta);

      const resized = calculateResizedBounds({
        initialBounds: initialElementBounds,
        handle: 's',
        deltaMm: effectiveDelta,
        pageWidthMm: 210,
        pageHeightMm: 297,
      });

      expect(resized.height).toBeCloseTo(31.18, 4);
    });
  });

  describe('10. Drag-to-Move Pointer Stability & Latest-Coordinates-Win Invariants', () => {
    const initialBounds: ElementBounds = {
      x: 25.4,
      y: 30.2,
      width: 50.0,
      height: 25.0,
      rotation: 0,
    };
    const dragOriginPointer: Point = { x: 25.4, y: 30.2 };

    it('continuous decimal mm pointer movement produces smooth, monotonic displacement with zero feedback drift', () => {
      // Simulates 50 consecutive high-frequency pointer move frames with sub-millimeter increments
      let prevX = initialBounds.x;
      let prevY = initialBounds.y;

      for (let i = 1; i <= 50; i++) {
        const step = i * 0.12; // 0.12mm step
        const currentPointer: Point = {
          x: dragOriginPointer.x + step,
          y: dragOriginPointer.y + step * 0.5,
        };

        const rawDelta: Point = {
          x: currentPointer.x - dragOriginPointer.x,
          y: currentPointer.y - dragOriginPointer.y,
        };

        // When snapping is OFF (fine MS Word-like dragging)
        const moved = calculateMultiElementMove(
          [{ id: 'el_1', initialBounds }],
          rawDelta,
          210,
          297,
        );

        const currentPos = moved[0].bounds;
        expect(currentPos.x).toBeGreaterThan(prevX);
        expect(currentPos.y).toBeGreaterThan(prevY);
        expect(currentPos.x).toBeCloseTo(initialBounds.x + step, 5);
        expect(currentPos.y).toBeCloseTo(initialBounds.y + step * 0.5, 5);

        prevX = currentPos.x;
        prevY = currentPos.y;
      }
    });

    it('latest-coordinates-win invariant: RAF frame skipping produces identical deterministic state to direct calculation', () => {
      // High-frequency mousemove events at t1, t2, t3, t4...
      const events: Point[] = [
        { x: dragOriginPointer.x + 1.2, y: dragOriginPointer.y + 0.8 },
        { x: dragOriginPointer.x + 2.5, y: dragOriginPointer.y + 1.9 },
        { x: dragOriginPointer.x + 4.1, y: dragOriginPointer.y + 3.0 },
        { x: dragOriginPointer.x + 7.8, y: dragOriginPointer.y + 5.2 }, // latest pointer event
      ];

      // In RAF batching, only the latest pointer coordinates (events[3]) are evaluated
      const latestPointer = events[events.length - 1];
      const rafBatchedDelta: Point = {
        x: latestPointer.x - dragOriginPointer.x,
        y: latestPointer.y - dragOriginPointer.y,
      };

      const batchedMoved = calculateMultiElementMove(
        [{ id: 'el_1', initialBounds }],
        rafBatchedDelta,
        210,
        297,
      );

      // Direct calculation for latest event
      const directDelta: Point = {
        x: 7.8,
        y: 5.2,
      };
      const directMoved = calculateMultiElementMove(
        [{ id: 'el_1', initialBounds }],
        directDelta,
        210,
        297,
      );

      expect(batchedMoved[0].bounds.x).toBe(directMoved[0].bounds.x);
      expect(batchedMoved[0].bounds.y).toBe(directMoved[0].bounds.y);
      expect(batchedMoved[0].bounds.width).toBe(initialBounds.width);
      expect(batchedMoved[0].bounds.height).toBe(initialBounds.height);
    });

    it('snap-to-grid determinism across continuous sweeps without oscillation or hysteresis', () => {
      const gridSizeMm = 5;
      // Start at x = 10 (already on grid)
      const onGridBounds: ElementBounds = {
        x: 10,
        y: 10,
        width: 40,
        height: 20,
        rotation: 0,
      };
      const origin: Point = { x: 10, y: 10 };

      // Sweep raw delta from 0mm to 12mm in fine 0.1mm increments
      let lastSnappedX = 10;
      for (let offset = 0; offset <= 12; offset += 0.1) {
        const rawDelta: Point = { x: offset, y: 0 };
        const snappedDelta = calculatePositionSnappedDelta(onGridBounds, rawDelta, gridSizeMm);

        const moved = calculateMultiElementMove(
          [{ id: 'el_sweep', initialBounds: onGridBounds }],
          snappedDelta,
          210,
          297,
        );

        const resultX = moved[0].bounds.x;
        // Result must always be an exact multiple of 5mm
        expect(resultX % 5).toBe(0);
        // Snapped position must never decrease during monotonic forward drag
        expect(resultX).toBeGreaterThanOrEqual(lastSnappedX);
        lastSnappedX = resultX;
      }
    });

    it('multi-element group move preserves exact relative distances to decimal precision during continuous drag', () => {
      const el1Bounds: ElementBounds = { x: 20.25, y: 15.5, width: 30, height: 20, rotation: 0 };
      const el2Bounds: ElementBounds = { x: 70.75, y: 45.8, width: 40, height: 25, rotation: 0 };
      const initialDistX = el2Bounds.x - el1Bounds.x;
      const initialDistY = el2Bounds.y - el1Bounds.y;

      const group = [
        { id: 'el_1', initialBounds: el1Bounds },
        { id: 'el_2', initialBounds: el2Bounds },
      ];

      // Simulate 20 continuous drag steps
      for (let s = 1; s <= 20; s++) {
        const delta: Point = { x: s * 1.37, y: s * 0.91 };
        const moved = calculateMultiElementMove(group, delta, 210, 297);

        const movedEl1 = moved.find((e) => e.id === 'el_1')!.bounds;
        const movedEl2 = moved.find((e) => e.id === 'el_2')!.bounds;

        const currentDistX = movedEl2.x - movedEl1.x;
        const currentDistY = movedEl2.y - movedEl1.y;

        expect(currentDistX).toBeCloseTo(initialDistX, 10);
        expect(currentDistY).toBeCloseTo(initialDistY, 10);
      }
    });
  });
});


