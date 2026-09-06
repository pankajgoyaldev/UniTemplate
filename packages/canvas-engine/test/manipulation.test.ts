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
} from '../src/manipulation/handles.js';
import {
  calculateSnappedDelta,
  calculateMovedBounds,
  calculateMultiElementMove,
} from '../src/manipulation/transform.js';
import { calculateResizedBounds } from '../src/manipulation/resize.js';

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
      // Inside
      expect(isPointInElementBounds({ x: 35, y: 50 }, unrotatedBounds)).toBe(true);
      // Corners
      expect(isPointInElementBounds({ x: 20, y: 30 }, unrotatedBounds)).toBe(true);
      expect(isPointInElementBounds({ x: 70, y: 70 }, unrotatedBounds)).toBe(true);

      // Outside
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
      // Exactly on line
      expect(isPointInElementBounds({ x: 50, y: 50 }, lineBounds)).toBe(true);
      // Slightly off line within tolerance
      expect(isPointInElementBounds({ x: 50, y: 50.8 }, lineBounds, 1.0)).toBe(true);
      // Far off line
      expect(isPointInElementBounds({ x: 50, y: 53 }, lineBounds, 1.0)).toBe(false);
    });
  });

  describe('2. Rotated Element Hit Testing', () => {
    // 40x20 element centered at (70, 60), rotated 90 degrees
    // Unrotated: x: 50, y: 50, w: 40, h: 20 -> spans x:[50, 90], y:[50, 70]
    // Rotated 90 deg: visual width is 20 (x:[60, 80]), visual height is 40 (y:[40, 80])
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
      // (70, 42) is visually inside the 90-degree rotated box (y spans 40 to 80),
      // but OUTSIDE the unrotated box (unrotated y was 50 to 70)
      expect(isPointInElementBounds({ x: 70, y: 42 }, rotatedBounds)).toBe(true);
    });

    it('correctly rejects points outside rotated bounds that were inside unrotated bounds', () => {
      // (88, 60) was inside unrotated box (x was 50 to 90),
      // but is OUTSIDE rotated box (rotated x spans 60 to 80)
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
      // Center (120, 120) is always inside
      expect(isPointInElementBounds({ x: 120, y: 120 }, bounds45)).toBe(true);
      // Point outside corner
      expect(isPointInElementBounds({ x: 100, y: 100 }, bounds45)).toBe(false);
    });
  });

  describe('3. Topmost zIndex Hit Selection & Filtering', () => {
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

    it('returns the topmost element based on zIndex when multiple elements overlap', () => {
      // Point (30, 30) overlaps el_low, el_high, el_invisible (zIndex 99), and el_locked (zIndex 100).
      // Invisible and locked must be ignored; el_high (zIndex 10) must be returned!
      const hit = hitTestElements({ x: 30, y: 30 }, elements);
      expect(hit).toBeDefined();
      expect(hit?.id).toBe('el_high');
    });

    it('returns lower element when point does not hit higher element', () => {
      // Point (75, 55) is inside el_low (10..90, 10..70), but outside el_high (20..60, 20..40)
      const hit = hitTestElements({ x: 75, y: 55 }, elements);
      expect(hit).toBeDefined();
      expect(hit?.id).toBe('el_low');
    });

    it('returns null when clicking empty canvas', () => {
      const hit = hitTestElements({ x: 200, y: 200 }, elements);
      expect(hit).toBeNull();
    });
  });

  describe('4. Resize Handles Calculation', () => {
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

    it('calculates rotated handle positions correctly', () => {
      const rotated: ElementBounds = {
        x: 10,
        y: 20,
        width: 40,
        height: 30,
        rotation: 90,
      };
      const handles = calculateElementHandles(rotated);
      expect(handles).toHaveLength(8);

      // Center is (30, 35).
      // nw was at (10, 20) -> dx = -20, dy = -15.
      // Rotated 90 deg: rotX = 30 + (-20*0 - -15*1) = 30 + 15 = 45.
      //                 rotY = 35 + (-20*1 + -15*0) = 35 - 20 = 15.
      const nw = handles.find((h) => h.type === 'nw')!;
      expect(nw.positionMm.x).toBeCloseTo(45, 2);
      expect(nw.positionMm.y).toBeCloseTo(15, 2);
    });

    it('calculates correct CSS cursors with rotation', () => {
      expect(getHandleCursor('n', 0)).toBe('ns-resize');
      expect(getHandleCursor('e', 0)).toBe('ew-resize');
      // n rotated by 90 degrees becomes horizontal (ew-resize)
      expect(getHandleCursor('n', 90)).toBe('ew-resize');
    });

    it('calculates enclosing bounding box for multiple elements', () => {
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
      expect(bbox?.width).toBe(70); // 80 - 10
      expect(bbox?.height).toBe(70); // 80 - 10
    });
  });

  describe('5. Translation, Movement & Grid Snapping', () => {
    it('snaps delta to grid increments', () => {
      // 10mm grid
      expect(calculateSnappedDelta({ x: 3.4, y: 7.8 }, 10)).toEqual({ x: 0, y: 10 });
      expect(calculateSnappedDelta({ x: 6.1, y: 14.5 }, 10)).toEqual({ x: 10, y: 10 });
      // 5mm grid
      expect(calculateSnappedDelta({ x: 2.6, y: 8.9 }, 5)).toEqual({ x: 5, y: 10 });
      // Grid disabled (0 or undefined)
      expect(calculateSnappedDelta({ x: 3.4, y: 7.8 }, 0)).toEqual({ x: 3.4, y: 7.8 });
    });

    it('moves element and strictly clamps within page boundaries', () => {
      const initial: ElementBounds = { x: 10, y: 10, width: 50, height: 30, rotation: 0 };
      const pageWidth = 210;
      const pageHeight = 297;

      // Normal valid move
      const moved = calculateMovedBounds(initial, { x: 15, y: 25 }, pageWidth, pageHeight);
      expect(moved.x).toBe(25);
      expect(moved.y).toBe(35);
      expect(moved.width).toBe(50);
      expect(moved.height).toBe(30);

      // Attempt to move beyond left/top margin (< 0)
      const clampedTopLeft = calculateMovedBounds(initial, { x: -30, y: -40 }, pageWidth, pageHeight);
      expect(clampedTopLeft.x).toBe(0);
      expect(clampedTopLeft.y).toBe(0);

      // Attempt to move beyond right/bottom margin
      const clampedBottomRight = calculateMovedBounds(initial, { x: 250, y: 350 }, pageWidth, pageHeight);
      expect(clampedBottomRight.x).toBe(pageWidth - 50); // 160
      expect(clampedBottomRight.y).toBe(pageHeight - 30); // 267
    });

    it('moves multiple elements together preserving exact relative positions and clamping collectively', () => {
      const elements = [
        { id: 'el_1', initialBounds: { x: 20, y: 20, width: 30, height: 20, rotation: 0 } },
        { id: 'el_2', initialBounds: { x: 80, y: 40, width: 40, height: 30, rotation: 0 } },
      ];
      const moved = calculateMultiElementMove(elements, { x: 15, y: 10 }, 210, 297);

      expect(moved[0].bounds.x).toBe(35);
      expect(moved[0].bounds.y).toBe(30);
      expect(moved[1].bounds.x).toBe(95);
      expect(moved[1].bounds.y).toBe(50);

      // Verify relative distance between elements is preserved exactly
      const originalDeltaX = elements[1].initialBounds.x - elements[0].initialBounds.x;
      const movedDeltaX = moved[1].bounds.x - moved[0].bounds.x;
      expect(movedDeltaX).toBe(originalDeltaX);
    });
  });

  describe('6. 8-Handle Resizing Calculations', () => {
    const initialBounds: ElementBounds = {
      x: 20,
      y: 30,
      width: 50,
      height: 40,
      rotation: 0,
    };

    it('resizes from "se" (bottom-right) keeping top-left anchor fixed', () => {
      const resized = calculateResizedBounds({
        initialBounds,
        handle: 'se',
        deltaMm: { x: 10, y: 15 },
      });
      expect(resized.x).toBe(20);
      expect(resized.y).toBe(30);
      expect(resized.width).toBe(60);
      expect(resized.height).toBe(55);
    });

    it('resizes from "nw" (top-left) keeping bottom-right anchor fixed', () => {
      const resized = calculateResizedBounds({
        initialBounds,
        handle: 'nw',
        deltaMm: { x: 5, y: 8 },
      });
      // Moving top-left right/down shrinks box: width: 50 - 5 = 45, height: 40 - 8 = 32
      // Bottom-right was at (70, 70). New top-left: (70 - 45, 70 - 32) = (25, 38)
      expect(resized.x).toBe(25);
      expect(resized.y).toBe(38);
      expect(resized.width).toBe(45);
      expect(resized.height).toBe(32);
    });

    it('resizes horizontally from "e" (right) without changing height or y', () => {
      const resized = calculateResizedBounds({
        initialBounds,
        handle: 'e',
        deltaMm: { x: 20, y: 10 },
      });
      expect(resized.x).toBe(20);
      expect(resized.y).toBe(30);
      expect(resized.width).toBe(70);
      expect(resized.height).toBe(40);
    });

    it('resizes vertically from "s" (bottom) without changing width or x', () => {
      const resized = calculateResizedBounds({
        initialBounds,
        handle: 's',
        deltaMm: { x: 15, y: 25 },
      });
      expect(resized.x).toBe(20);
      expect(resized.y).toBe(30);
      expect(resized.width).toBe(50);
      expect(resized.height).toBe(65);
    });

    it('resizes from "w" (left) keeping right edge fixed', () => {
      const resized = calculateResizedBounds({
        initialBounds,
        handle: 'w',
        deltaMm: { x: 10, y: 0 },
      });
      // Moving left edge by +10 shrinks width from 50 to 40, x moves from 20 to 30
      expect(resized.x).toBe(30);
      expect(resized.y).toBe(30);
      expect(resized.width).toBe(40);
      expect(resized.height).toBe(40);
    });

    it('resizes from "n" (top) keeping bottom edge fixed', () => {
      const resized = calculateResizedBounds({
        initialBounds,
        handle: 'n',
        deltaMm: { x: 0, y: 10 },
      });
      // Moving top edge down by +10 shrinks height from 40 to 30, y moves from 30 to 40
      expect(resized.x).toBe(20);
      expect(resized.y).toBe(40);
      expect(resized.width).toBe(50);
      expect(resized.height).toBe(30);
    });

    it('enforces minimum dimensions (prevents negative or zero size)', () => {
      const resized = calculateResizedBounds({
        initialBounds,
        handle: 'se',
        deltaMm: { x: -100, y: -100 },
        minWidthMm: 5,
        minHeightMm: 5,
      });
      expect(resized.width).toBe(5);
      expect(resized.height).toBe(5);
    });

    it('supports proportional aspect ratio resizing when keepAspectRatio is true', () => {
      // 50 x 40 has aspect ratio 1.25
      const resized = calculateResizedBounds({
        initialBounds,
        handle: 'se',
        deltaMm: { x: 20, y: 5 }, // Dragged more in X
        keepAspectRatio: true,
      });
      // Scale based on X: 70 / 50 = 1.4. New height = 40 * 1.4 = 56.
      expect(resized.width).toBe(70);
      expect(resized.height).toBe(56);
      expect(resized.width / resized.height).toBeCloseTo(50 / 40, 4);
    });

    it('correctly resizes a rotated element keeping opposite anchor in place', () => {
      const rotated: ElementBounds = {
        x: 50,
        y: 50,
        width: 40,
        height: 20,
        rotation: 90,
      };
      // Center is (70, 60).
      // Resizing from 'se' in 90-degree rotated box
      const resized = calculateResizedBounds({
        initialBounds: rotated,
        handle: 'se',
        deltaMm: { x: 0, y: 20 },
      });
      expect(resized.rotation).toBe(90);
      expect(resized.width).toBeGreaterThanOrEqual(40);
      expect(resized.height).toBeGreaterThanOrEqual(20);
    });
  });
});

