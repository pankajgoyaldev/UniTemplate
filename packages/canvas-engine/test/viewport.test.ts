import { describe, it, expect } from 'vitest';
import {
  canvasToScreen,
  screenToCanvas,
  calculateZoomAtPoint,
  calculatePan,
  clampZoom,
  getRulerIntervals,
  calculateRulerTicks,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../src/viewport/index.js';
import { mmToPx } from '@uts/core';

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
});

