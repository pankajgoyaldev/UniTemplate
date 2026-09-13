import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../src/store/useUIStore.js';
import { useTemplateStore } from '../src/store/useTemplateStore.js';
import {
  screenToCanvas,
  calculatePositionSnappedDelta,
  calculateMovedBounds,
  calculateResizedBounds,
  getElementWorldAnchor,
  type Point,
  type ElementBounds,
} from '@uts/canvas-engine';
import {
  calculateInitialBounds,
  createTextTemplate,
  createRectangleTemplate,
} from '../src/components/toolbox/elementTemplates.js';
import type { PageSettings, TemplateAst, TemplateElement } from '@uts/core';

describe('Smooth Canvas Movement & Smooth Element Creation', () => {
  const defaultPageSettings: PageSettings = {
    unit: 'mm',
    width: 210,
    height: 297,
    orientation: 'portrait',
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    targetDpi: 300,
  };

  beforeEach(() => {
    // Reset stores
    useUIStore.setState({
      snapToGrid: false,
      gridSizeMm: 10,
      gridVisible: true,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      selectedElementIds: [],
    });

    const initialTemplate: TemplateAst = {
      schemaVersion: '1.0.0',
      metadata: {
        id: 'smooth_test_tpl',
        title: 'Smooth Test Template',
        createdAt: '2026-09-13T00:00:00.000Z',
        updatedAt: '2026-09-13T00:00:00.000Z',
      },
      pageSettings: defaultPageSettings,
      dataSchema: { fields: [], mockPayload: {} },
      elements: [],
    };
    useTemplateStore.setState({ template: initialTemplate });
  });

  describe('1. Default Store State', () => {
    it('defaults snapToGrid to false for smooth/free manipulation', () => {
      // Create fresh UI store state to check initial default
      const state = useUIStore.getState();
      expect(state.snapToGrid).toBe(false);
    });

    it('allows toggling snapToGrid on and off', () => {
      expect(useUIStore.getState().snapToGrid).toBe(false);

      useUIStore.getState().toggleSnapToGrid();
      expect(useUIStore.getState().snapToGrid).toBe(true);

      useUIStore.getState().toggleSnapToGrid();
      expect(useUIStore.getState().snapToGrid).toBe(false);

      useUIStore.getState().setSnapToGrid(true);
      expect(useUIStore.getState().snapToGrid).toBe(true);
    });
  });

  describe('2. Smooth Pointer-to-Canvas Coordinate Mapping', () => {
    it('converts screen pixels to continuous millimeter coordinates without coarse quantizing', () => {
      // In CSS pixels at 96 DPI, 1 inch = 96px = 25.4mm, so 1px ≈ 0.264583mm
      const viewport = { zoom: 1.0, panX: 0, panY: 0 };
      const screenPoint = { x: 141.42, y: 312.68 };

      const canvasPoint = screenToCanvas(screenPoint, viewport);

      // Verify fractional sub-millimeter precision is preserved (not rounded to whole mm or 5mm/10mm)
      expect(canvasPoint.x).toBeCloseTo((141.42 * 25.4) / 96, 3);
      expect(canvasPoint.y).toBeCloseTo((312.68 * 25.4) / 96, 3);
      expect(canvasPoint.x % 1).not.toBe(0);
      expect(canvasPoint.y % 1).not.toBe(0);
    });
  });

  describe('3. Smooth Element Creation (Default vs Snapped)', () => {
    it('creates elements at continuous coordinates without 1-decimal rounding when snapToGrid is false', () => {
      // Simulate viewport positioned such that the center produces fractional millimeter coordinates:
      // e.g. centerMm = { x: 67.425, y: 92.731 }
      // For width=50, height=30: candidateX = 67.425 - 25 = 42.425, candidateY = 92.731 - 15 = 77.731
      const mmPerPx = 25.4 / 96;
      const targetCenterMm = { x: 67.425, y: 92.731 };
      const centerPx = {
        x: targetCenterMm.x / mmPerPx,
        y: targetCenterMm.y / mmPerPx,
      };

      const viewport = {
        zoom: 1.0,
        panX: 0,
        panY: 0,
        viewportWidth: centerPx.x * 2,
        viewportHeight: centerPx.y * 2,
      };

      const bounds = calculateInitialBounds(50, 30, {
        pageSettings: defaultPageSettings,
        viewport,
        snapToGrid: false,
      });

      // Coordinates preserve 3-decimal precision without being rounded to 42.4 or 77.7
      expect(bounds.x).toBeCloseTo(42.425, 2);
      expect(bounds.y).toBeCloseTo(77.731, 2);
      expect(bounds.width).toBe(50);
      expect(bounds.height).toBe(30);
    });

    it('snaps element creation position to grid when snapToGrid is true', () => {
      const mmPerPx = 25.4 / 96;
      const targetCenterMm = { x: 67.425, y: 92.731 };
      const centerPx = {
        x: targetCenterMm.x / mmPerPx,
        y: targetCenterMm.y / mmPerPx,
      };

      const viewport = {
        zoom: 1.0,
        panX: 0,
        panY: 0,
        viewportWidth: centerPx.x * 2,
        viewportHeight: centerPx.y * 2,
      };

      // When snapToGrid is ON with 10mm grid:
      // Candidate: x = 42.425 -> snapped to 40mm
      // Candidate: y = 77.731 -> snapped to 80mm
      const bounds10 = calculateInitialBounds(50, 30, {
        pageSettings: defaultPageSettings,
        viewport,
        snapToGrid: true,
        gridSizeMm: 10,
      });

      expect(bounds10.x).toBe(40);
      expect(bounds10.y).toBe(80);

      // With 5mm grid:
      // Candidate: x = 42.425 -> snapped to 40mm or 45mm (42.425 / 5 = 8.485 -> 8 * 5 = 40)
      // Candidate: y = 77.731 -> snapped to 80mm (77.731 / 5 = 15.546 -> 16 * 5 = 80)
      const bounds5 = calculateInitialBounds(50, 30, {
        pageSettings: defaultPageSettings,
        viewport,
        snapToGrid: true,
        gridSizeMm: 5,
      });

      expect(bounds5.x).toBe(40);
      expect(bounds5.y).toBe(80);
    });
  });

  describe('4. Smooth Element Drag-to-Move (Default vs Snapped)', () => {
    const initialBounds: ElementBounds = {
      x: 37.42,
      y: 82.73,
      width: 40.0,
      height: 20.0,
      rotation: 0,
    };

    function resolveDragDelta(
      referencePoint: Point,
      rawDelta: Point,
      snapToGrid: boolean,
      gridSizeMm: number,
      bypass: boolean,
    ): Point {
      const shouldSnap = snapToGrid && !bypass;
      return shouldSnap
        ? calculatePositionSnappedDelta(referencePoint, rawDelta, gridSizeMm)
        : rawDelta;
    }

    it('moves smoothly with fractional delta when snapToGrid is false (default)', () => {
      const rawDelta = { x: 3.19, y: -4.56 };

      const delta = resolveDragDelta(
        { x: initialBounds.x, y: initialBounds.y },
        rawDelta,
        false, // snapToGrid OFF
        10,
        false,
      );

      // Exact raw delta preserved without snapping
      expect(delta.x).toBe(3.19);
      expect(delta.y).toBe(-4.56);

      const moved = calculateMovedBounds(initialBounds, delta, 210, 297);
      expect(moved.x).toBeCloseTo(37.42 + 3.19, 4); // 40.61mm
      expect(moved.y).toBeCloseTo(82.73 - 4.56, 4); // 78.17mm
    });

    it('snaps to grid when snapToGrid is true', () => {
      const rawDelta = { x: 3.19, y: -4.56 }; // target: x = 40.61 -> snapped 40; y = 78.17 -> snapped 80

      const delta = resolveDragDelta(
        { x: initialBounds.x, y: initialBounds.y },
        rawDelta,
        true, // snapToGrid ON
        10,   // 10mm grid
        false,
      );

      // Snapped delta = snappedTarget - initial
      // x = 40 - 37.42 = 2.58
      // y = 80 - 82.73 = -2.73
      expect(delta.x).toBeCloseTo(40 - 37.42, 4);
      expect(delta.y).toBeCloseTo(80 - 82.73, 4);

      const moved = calculateMovedBounds(initialBounds, delta, 210, 297);
      expect(moved.x).toBeCloseTo(40.0, 4);
      expect(moved.y).toBeCloseTo(80.0, 4);
    });

    it('bypasses snapping with Alt/Ctrl even when snapToGrid is true', () => {
      const rawDelta = { x: 3.19, y: -4.56 };

      const delta = resolveDragDelta(
        { x: initialBounds.x, y: initialBounds.y },
        rawDelta,
        true, // snapToGrid ON
        10,
        true, // Alt/Ctrl held (bypass)
      );

      // Bypasses snap, returning raw continuous delta
      expect(delta.x).toBe(3.19);
      expect(delta.y).toBe(-4.56);

      const moved = calculateMovedBounds(initialBounds, delta, 210, 297);
      expect(moved.x).toBeCloseTo(37.42 + 3.19, 4);
      expect(moved.y).toBeCloseTo(82.73 - 4.56, 4);
    });
  });

  describe('5. Smooth Element Resizing (Default vs Snapped)', () => {
    const initialBounds: ElementBounds = {
      x: 20.0,
      y: 30.0,
      width: 50.0,
      height: 30.0,
      rotation: 0,
    };

    function resolveResizeDelta(
      handleAnchor: Point,
      rawDelta: Point,
      snapToGrid: boolean,
      gridSizeMm: number,
      bypass: boolean,
    ): Point {
      const shouldSnap = snapToGrid && !bypass;
      return shouldSnap
        ? calculatePositionSnappedDelta(handleAnchor, rawDelta, gridSizeMm)
        : rawDelta;
    }

    it('resizes smoothly with fractional delta when snapToGrid is false (default)', () => {
      const eastAnchor = getElementWorldAnchor(initialBounds, 'e'); // x: 70.0, y: 45.0
      const rawDelta = { x: 2.37, y: 0 };

      const delta = resolveResizeDelta(
        eastAnchor,
        rawDelta,
        false, // snapToGrid OFF
        10,
        false,
      );

      expect(delta).toEqual(rawDelta);

      const resized = calculateResizedBounds({
        initialBounds,
        handle: 'e',
        deltaMm: delta,
        pageWidthMm: 210,
        pageHeightMm: 297,
      });

      expect(resized.x).toBeCloseTo(20.0, 4);
      expect(resized.width).toBeCloseTo(50.0 + 2.37, 4); // 52.37mm
    });

    it('snaps resize edge to grid when snapToGrid is true', () => {
      const eastAnchor = getElementWorldAnchor(initialBounds, 'e'); // x: 70.0, y: 45.0
      const rawDelta = { x: 3.4, y: 0 }; // target x = 73.4 -> snapped 70 (or 75 with 5mm, or 70 with 10mm)

      const delta10 = resolveResizeDelta(
        eastAnchor,
        rawDelta,
        true, // snapToGrid ON
        10,   // 10mm grid
        false,
      );

      // Target = 73.4 -> snapped to 70 -> delta.x = 70 - 70 = 0
      expect(delta10.x).toBeCloseTo(0, 4);

      const delta5 = resolveResizeDelta(
        eastAnchor,
        rawDelta,
        true, // snapToGrid ON
        5,    // 5mm grid
        false,
      );

      // Target = 73.4 -> snapped to 75 -> delta.x = 75 - 70 = +5
      expect(delta5.x).toBeCloseTo(5.0, 4);

      const resized5 = calculateResizedBounds({
        initialBounds,
        handle: 'e',
        deltaMm: delta5,
        pageWidthMm: 210,
        pageHeightMm: 297,
      });

      expect(resized5.x).toBeCloseTo(20.0, 4);
      expect(resized5.width).toBeCloseTo(55.0, 4);
    });

    it('bypasses resize snapping with Alt/Ctrl even when snapToGrid is true', () => {
      const eastAnchor = getElementWorldAnchor(initialBounds, 'e');
      const rawDelta = { x: 3.4, y: 0 };

      const delta = resolveResizeDelta(
        eastAnchor,
        rawDelta,
        true, // snapToGrid ON
        10,
        true, // Alt/Ctrl held (bypass)
      );

      expect(delta).toEqual(rawDelta);

      const resized = calculateResizedBounds({
        initialBounds,
        handle: 'e',
        deltaMm: delta,
        pageWidthMm: 210,
        pageHeightMm: 297,
      });

      expect(resized.width).toBeCloseTo(53.4, 4);
    });
  });
});
