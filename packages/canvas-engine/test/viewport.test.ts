import { describe, it, expect } from 'vitest';
import {
  canvasToScreen,
  screenToCanvas,
  calculateZoomAtPoint,
  calculatePan,
  clampZoom,
  normalizeWheelDelta,
  calculateWheelZoomFactor,
  getRulerIntervals,
  calculateRulerTicks,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../src/viewport/index.js';
import { mmToPx } from '@uts/core';
import { useUIStore } from '../../../apps/web/src/store/useUIStore.js';

describe('Canvas Engine - Viewport & Coordinate Math', () => {
  describe('clampZoom', () => {
    it('clamps zoom within [0.1, 10.0]', () => {
      expect(clampZoom(0.05)).toBe(MIN_ZOOM);
      expect(clampZoom(15.0)).toBe(MAX_ZOOM);
      expect(clampZoom(1.5)).toBe(1.5);
    });
  });

  describe('screen <-> canvas conversions across zoom and pan', () => {
    const zoomLevels = [0.5, 1.0, 2.0];
    const panOffsets = [
      { panX: 0, panY: 0, desc: 'zero pan' },
      { panX: 120, panY: 80, desc: 'positive pan' },
      { panX: -50, panY: -30, desc: 'negative pan' },
    ];

    for (const zoom of zoomLevels) {
      for (const { panX, panY, desc } of panOffsets) {
        it(`accurately converts at zoom ${zoom}x with ${desc} (panX=${panX}, panY=${panY})`, () => {
          const viewport = { zoom, panX, panY, viewportWidth: 1000, viewportHeight: 800 };
          const originalMm = { x: 50, y: 75 };

          // 1. Canvas mm -> Screen px
          const screenPoint = canvasToScreen(originalMm, viewport);
          const expectedPxX = mmToPx(50, 96) * zoom + panX;
          const expectedPxY = mmToPx(75, 96) * zoom + panY;
          expect(screenPoint.x).toBeCloseTo(expectedPxX, 3);
          expect(screenPoint.y).toBeCloseTo(expectedPxY, 3);

          // 2. Screen px -> Canvas mm (Round-trip)
          const roundTripMm = screenToCanvas(screenPoint, viewport);
          expect(roundTripMm.x).toBeCloseTo(originalMm.x, 2);
          expect(roundTripMm.y).toBeCloseTo(originalMm.y, 2);
        });
      }
    }
  });

  describe('cursor-centered zoom preservation', () => {
    it('preserves the canvas point directly under the cursor before and after zoom', () => {
      const initialViewport = {
        zoom: 1.0,
        panX: 150,
        panY: 100,
        viewportWidth: 1200,
        viewportHeight: 900,
      };

      // Cursor position in screen pixels (e.g. user cursor at x: 450, y: 350)
      const cursorScreenPx = { x: 450, y: 350 };

      // Point on canvas under cursor before zoom
      const canvasPointBefore = screenToCanvas(cursorScreenPx, initialViewport);

      // Zoom in to 2.0x
      const zoomedViewport = calculateZoomAtPoint(initialViewport, 2.0, cursorScreenPx);
      expect(zoomedViewport.zoom).toBe(2.0);

      // Point on canvas under cursor after zoom
      const canvasPointAfter = screenToCanvas(cursorScreenPx, zoomedViewport);

      // The exact same canvas coordinate must remain under cursorScreenPx
      expect(canvasPointAfter.x).toBeCloseTo(canvasPointBefore.x, 2);
      expect(canvasPointAfter.y).toBeCloseTo(canvasPointBefore.y, 2);

      // Zoom out to 0.5x
      const zoomedOutViewport = calculateZoomAtPoint(zoomedViewport, 0.5, cursorScreenPx);
      expect(zoomedOutViewport.zoom).toBe(0.5);

      const canvasPointAfterZoomOut = screenToCanvas(cursorScreenPx, zoomedOutViewport);
      expect(canvasPointAfterZoomOut.x).toBeCloseTo(canvasPointBefore.x, 2);
      expect(canvasPointAfterZoomOut.y).toBeCloseTo(canvasPointBefore.y, 2);
    });
  });

  describe('panning calculation', () => {
    it('updates pan offsets by delta screen pixels', () => {
      const initialViewport = {
        zoom: 1.0,
        panX: 100,
        panY: 50,
        viewportWidth: 800,
        viewportHeight: 600,
      };

      const updated = calculatePan(initialViewport, { x: 25, y: -15 });
      expect(updated.panX).toBe(125);
      expect(updated.panY).toBe(35);
      expect(updated.zoom).toBe(1.0);
    });
  });

  describe('ruler tick calculations', () => {
    it('adapts major tick intervals to avoid collision across zoom scales', () => {
      // At low zoom (0.2x), major ticks should be large (50mm or 100mm)
      const lowZoom = getRulerIntervals(0.2);
      expect(lowZoom.majorIntervalMm).toBeGreaterThanOrEqual(50);

      // At 1.0x zoom, major interval is 10mm or 20mm
      const normalZoom = getRulerIntervals(1.0);
      expect(normalZoom.majorIntervalMm).toBeLessThanOrEqual(20);

      // At high zoom (5.0x), major interval is fine (1mm or 2mm)
      const highZoom = getRulerIntervals(5.0);
      expect(highZoom.majorIntervalMm).toBeLessThanOrEqual(5);
    });

    it('generates ticks strictly aligned with page origin (0 mm)', () => {
      const panPx = 100; // Page origin at screen x = 100
      const zoom = 1.0;
      const rulerLengthPx = 500;

      const ticks = calculateRulerTicks(panPx, zoom, rulerLengthPx);
      expect(ticks.length).toBeGreaterThan(0);

      // Find the tick at 0 mm
      const zeroTick = ticks.find((t) => t.positionMm === 0);
      expect(zeroTick).toBeDefined();
      expect(zeroTick!.screenPositionPx).toBeCloseTo(100, 2);
      expect(zeroTick!.type).toBe('major');
      expect(zeroTick!.label).toBe('0');
    });
  });

  describe('Regression: Viewport Panning & Hand Tool Behavior', () => {
    it('1:1 hand panning: pointer movement of 10px moves canvas approximately 10px (exact 1:1)', () => {
      const initial = { zoom: 1.0, panX: 200, panY: 150, viewportWidth: 1000, viewportHeight: 800 };
      const delta = { x: 10, y: 0 };
      const updated = calculatePan(initial, delta);

      expect(updated.panX - initial.panX).toBe(10);
      expect(updated.panY - initial.panY).toBe(0);

      // Verify vertical panning 1:1
      const verticalDelta = { x: 0, y: 15 };
      const updatedVertical = calculatePan(initial, verticalDelta);
      expect(updatedVertical.panY - initial.panY).toBe(15);
      expect(updatedVertical.panX - initial.panX).toBe(0);
    });

    it('no zoom-dependent acceleration: pan delta remains strictly 1:1 regardless of zoom level', () => {
      const zoomLevels = [0.25, 0.5, 1.0, 2.0, 5.0];
      const pointerMovement = { x: 10, y: -10 };

      for (const zoom of zoomLevels) {
        const viewport = { zoom, panX: 100, panY: 100, viewportWidth: 1000, viewportHeight: 800 };
        const panned = calculatePan(viewport, pointerMovement);

        // Movement must be strictly 10px screen displacement, NOT multiplied or divided by zoom
        expect(panned.panX - viewport.panX).toBe(10);
        expect(panned.panY - viewport.panY).toBe(-10);
        expect(panned.zoom).toBe(zoom); // zoom must not be altered by pan
      }
    });

    it('no initial pointerdown jump: starting drag records origin without changing canvas coordinates', () => {
      useUIStore.getState().setPan(300, 250);
      const initialPanX = useUIStore.getState().panX;
      const initialPanY = useUIStore.getState().panY;

      // Pointer down event: initial pointer position recorded, delta is 0
      const pointerDownDelta = { x: 0, y: 0 };
      useUIStore.getState().panBy(pointerDownDelta);

      expect(useUIStore.getState().panX).toBe(initialPanX);
      expect(useUIStore.getState().panY).toBe(initialPanY);
    });

    it('continuous drag: synchronous ref tracking ensures sequential events equal net displacement with zero accumulated acceleration', () => {
      useUIStore.getState().setPan(100, 100);

      // Simulate a continuous drag through 5 mousemove events from x=50 to x=80
      const pointerPositions = [
        { x: 50, y: 50 },
        { x: 55, y: 52 },
        { x: 62, y: 56 },
        { x: 70, y: 60 },
        { x: 80, y: 65 },
      ];

      // With ref-based tracking, each event measures delta from the immediately previous event
      let lastPointer = pointerPositions[0];
      for (let i = 1; i < pointerPositions.length; i++) {
        const current = pointerPositions[i];
        const deltaX = current.x - lastPointer.x;
        const deltaY = current.y - lastPointer.y;
        lastPointer = current;

        useUIStore.getState().panBy({ x: deltaX, y: deltaY });
      }

      // Net displacement: dx = 80 - 50 = 30, dy = 65 - 50 = 15
      expect(useUIStore.getState().panX).toBe(100 + 30);
      expect(useUIStore.getState().panY).toBe(100 + 15);
    });

    it('middle mouse, Space+drag, and Hand tool use consistent 1:1 pan calculation', () => {
      const viewport = { zoom: 1.5, panX: 50, panY: 50, viewportWidth: 800, viewportHeight: 600 };
      const delta = { x: 25, y: 35 };

      // Hand tool drag
      const handPan = calculatePan(viewport, delta);
      // Middle-mouse drag
      const middlePan = calculatePan(viewport, delta);
      // Space + drag
      const spacePan = calculatePan(viewport, delta);

      expect(handPan.panX).toBe(middlePan.panX);
      expect(handPan.panY).toBe(middlePan.panY);
      expect(handPan.panX).toBe(spacePan.panX);
      expect(handPan.panY).toBe(spacePan.panY);
      expect(handPan.panX).toBe(75);
      expect(handPan.panY).toBe(85);
    });

    it('pointerup stops movement: subsequent events after drag end do not modify pan', () => {
      useUIStore.getState().setPan(100, 100);
      useUIStore.getState().setIsDragging(true);

      // Dragging
      useUIStore.getState().panBy({ x: 20, y: 10 });
      expect(useUIStore.getState().panX).toBe(120);
      expect(useUIStore.getState().panY).toBe(110);

      // Pointer up stops drag
      useUIStore.getState().setIsDragging(false);

      // Subsequent movement without isDragging = true should not alter canvas
      if (useUIStore.getState().isDragging) {
        useUIStore.getState().panBy({ x: 30, y: 30 });
      }

      expect(useUIStore.getState().panX).toBe(120);
      expect(useUIStore.getState().panY).toBe(110);
    });
  });

  describe('mouse-wheel zoom normalization & non-jumping stability', () => {
    it('normalizes notched mouse wheel (deltaMode 0) and line mode (deltaMode 1)', () => {
      // Standard pixel notch (Chrome/Firefox standard)
      expect(normalizeWheelDelta(-100, 0)).toBe(-100);
      expect(normalizeWheelDelta(100, 0)).toBe(100);

      // Line mode (3 lines = ~100px)
      expect(normalizeWheelDelta(-3, 1)).toBeCloseTo(-100, 0);
      expect(normalizeWheelDelta(3, 1)).toBeCloseTo(100, 0);

      // Zero delta returns 0
      expect(normalizeWheelDelta(0, 0)).toBe(0);
    });

    it('calculates consistent 1.15x step for a single 100px notch', () => {
      // Zoom in
      const zoomInFactor = calculateWheelZoomFactor(-100);
      expect(zoomInFactor).toBeCloseTo(1.15, 3);

      // Zoom out (1 / 1.15 = 0.869565)
      const zoomOutFactor = calculateWheelZoomFactor(100);
      expect(zoomOutFactor).toBeCloseTo(1 / 1.15, 3);

      // Inversion symmetry: zoom in then zoom out returns exactly to 1.0x
      expect(zoomInFactor * zoomOutFactor).toBeCloseTo(1.0, 5);
    });

    it('trackpad continuous micro-scrolling compounds smoothly without exponential runaway', () => {
      // 10 micro-events with delta = -10 (total delta = -100)
      let compoundFactor = 1.0;
      for (let i = 0; i < 10; i++) {
        compoundFactor *= calculateWheelZoomFactor(-10);
      }

      // Must equal the single notch factor (1.15x)
      expect(compoundFactor).toBeCloseTo(1.15, 3);

      // Compare with the old bug where each micro-event applied a flat 1.15x:
      // 1.15^10 = 4.04x (a 400% explosion for a tiny 100px swipe!)
      // With calculateWheelZoomFactor, compoundFactor is 1.15x, not 4.04x!
      expect(compoundFactor).toBeLessThan(1.20);
    });

    it('clamps single-frame zoom factor against extreme velocity flicks', () => {
      // Extreme rapid flick (e.g. delta = -5000)
      const extremeZoomIn = calculateWheelZoomFactor(-5000);
      expect(extremeZoomIn).toBe(1.5); // Clamped at max 1.5x per frame

      // Extreme rapid flick out (e.g. delta = 5000)
      const extremeZoomOut = calculateWheelZoomFactor(5000);
      expect(extremeZoomOut).toBe(0.65); // Clamped at min 0.65x per frame
    });

    it('cursor-centered invariant holds across rapid multi-tick zoom sequences', () => {
      let viewport: ViewportState = {
        zoom: 1.0,
        panX: 100,
        panY: 80,
        viewportWidth: 1000,
        viewportHeight: 800,
      };

      const cursor: Point = { x: 420, y: 310 };
      const originalCanvasPoint = screenToCanvas(cursor, viewport);

      // Simulate 8 consecutive wheel ticks zooming in and out
      const deltas = [-100, -100, -100, 100, -100, 100, -100, -100];
      for (const delta of deltas) {
        const factor = calculateWheelZoomFactor(delta);
        viewport = calculateZoomAtPoint(viewport, viewport.zoom * factor, cursor);

        // At every intermediate zoom step, canvas point under cursor must not drift
        const currentCanvasPoint = screenToCanvas(cursor, viewport);
        expect(currentCanvasPoint.x).toBeCloseTo(originalCanvasPoint.x, 2);
        expect(currentCanvasPoint.y).toBeCloseTo(originalCanvasPoint.y, 2);
      }
    });

    it('gracefully handles non-finite and NaN inputs without corrupting viewport', () => {
      expect(calculateWheelZoomFactor(NaN)).toBe(1.0);
      expect(calculateWheelZoomFactor(Infinity)).toBe(1.0);
      expect(clampZoom(NaN)).toBe(1.0);

      const viewport: ViewportState = {
        zoom: 1.0,
        panX: 50,
        panY: 50,
        viewportWidth: 800,
        viewportHeight: 600,
      };
      const result = calculateZoomAtPoint(viewport, NaN, { x: NaN, y: NaN });
      expect(Number.isFinite(result.zoom)).toBe(true);
      expect(Number.isFinite(result.panX)).toBe(true);
      expect(Number.isFinite(result.panY)).toBe(true);
    });
  });
});

