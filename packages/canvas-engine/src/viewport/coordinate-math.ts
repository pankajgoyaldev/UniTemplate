import {
  MM_PER_INCH,
  DEFAULT_SCREEN_DPI,
  roundPrecision,
} from '@uts/core';
import type { Point, ViewportState } from './types.js';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10.0;

/**
 * Clamps zoom level to the supported bounds [0.1, 10.0].
 */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1.0;
  return Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
}

/**
 * Normalizes wheel delta across devices (notched mouse wheel, trackpad, line/page modes).
 */
export function normalizeWheelDelta(deltaY: number, deltaMode = 0): number {
  let delta = Number.isFinite(deltaY) ? deltaY : 0;
  if (deltaMode === 1) {
    // DOM_DELTA_LINE: 1 line is ~33.33px, so standard 3 lines = 100px (1 standard mouse wheel notch)
    delta *= 33.33;
  } else if (deltaMode === 2) {
    // DOM_DELTA_PAGE
    delta *= 100;
  }
  return delta;
}

/**
 * Calculates a smooth, non-jumping zoom factor from a normalized wheel delta.
 * - 100px of wheel delta corresponds to the standard 1.15x notch step.
 * - Smooth continuous trackpad scrolls scale proportionally with zero exponential runaway.
 * - Clamps single-frame zoom factor to [0.65, 1.50] to eliminate high-velocity jumps.
 */
export function calculateWheelZoomFactor(normalizedDelta: number): number {
  if (!Number.isFinite(normalizedDelta) || normalizedDelta === 0) {
    return 1.0;
  }
  const rawFactor = Math.pow(1.15, -normalizedDelta / 100);
  return Math.max(0.65, Math.min(1.5, rawFactor));
}

/**
 * Converts a point from Canvas Space (physical millimeters)
 * to Screen Space (CSS pixels in the viewport container).
 *
 * Formula:
 * screenPx = (canvasMm * (96 / 25.4)) * zoom + pan
 */
export function canvasToScreen(
  pointMm: Point,
  viewport: Pick<ViewportState, 'zoom' | 'panX' | 'panY'>,
  dpi = DEFAULT_SCREEN_DPI,
): Point {
  const pxPerMm = dpi / MM_PER_INCH;
  return {
    x: pointMm.x * pxPerMm * viewport.zoom + viewport.panX,
    y: pointMm.y * pxPerMm * viewport.zoom + viewport.panY,
  };
}

/**
 * Converts a point from Screen Space (CSS pixels in the viewport container)
 * to Canvas Space (physical millimeters).
 *
 * Formula:
 * canvasMm = ((screenPx - pan) / zoom) * (25.4 / 96)
 */
export function screenToCanvas(
  pointPx: Point,
  viewport: Pick<ViewportState, 'zoom' | 'panX' | 'panY'>,
  dpi = DEFAULT_SCREEN_DPI,
): Point {
  const mmPerPx = MM_PER_INCH / dpi;
  const canvasPxX = (pointPx.x - viewport.panX) / viewport.zoom;
  const canvasPxY = (pointPx.y - viewport.panY) / viewport.zoom;
  return {
    x: roundPrecision(canvasPxX * mmPerPx, 3),
    y: roundPrecision(canvasPxY * mmPerPx, 3),
  };
}

/**
 * Calculates a new ViewportState for cursor-centered wheel zoom.
 *
 * The point on the canvas directly beneath the cursor remains invariant
 * (does not move under the user's cursor while zooming).
 */
export function calculateZoomAtPoint(
  current: ViewportState,
  targetZoom: number,
  cursorScreenPx: Point,
): ViewportState {
  const clampedZoom = clampZoom(targetZoom);
  const currentZoom = Number.isFinite(current.zoom) && current.zoom > 0 ? current.zoom : 1.0;
  if (clampedZoom === currentZoom) {
    return current;
  }

  const zoomRatio = clampedZoom / currentZoom;
  const cursorX = Number.isFinite(cursorScreenPx.x) ? cursorScreenPx.x : 0;
  const cursorY = Number.isFinite(cursorScreenPx.y) ? cursorScreenPx.y : 0;
  const currentPanX = Number.isFinite(current.panX) ? current.panX : 0;
  const currentPanY = Number.isFinite(current.panY) ? current.panY : 0;

  // New pan coordinates ensure the canvas point under cursor remains fixed
  const newPanX = cursorX - (cursorX - currentPanX) * zoomRatio;
  const newPanY = cursorY - (cursorY - currentPanY) * zoomRatio;

  return {
    ...current,
    zoom: clampedZoom,
    panX: newPanX,
    panY: newPanY,
  };
}

/**
 * Calculates a new ViewportState when dragging/panning by delta pixels.
 */
export function calculatePan(
  current: ViewportState,
  deltaScreenPx: Point,
): ViewportState {
  const dx = Number.isFinite(deltaScreenPx.x) ? deltaScreenPx.x : 0;
  const dy = Number.isFinite(deltaScreenPx.y) ? deltaScreenPx.y : 0;
  return {
    ...current,
    panX: current.panX + dx,
    panY: current.panY + dy,
  };
}

/**
 * Calculates optimal zoom and pan to fit the page inside the available viewport
 * with comfortable padding.
 */
export function calculateFitToScreen(
  pageWidthMm: number,
  pageHeightMm: number,
  viewportWidth: number,
  viewportHeight: number,
  paddingPx = 40,
  dpi = DEFAULT_SCREEN_DPI,
): ViewportState {
  const pxPerMm = dpi / MM_PER_INCH;
  const pagePxWidth = pageWidthMm * pxPerMm;
  const pagePxHeight = pageHeightMm * pxPerMm;

  const availableWidth = Math.max(viewportWidth - paddingPx * 2, 100);
  const availableHeight = Math.max(viewportHeight - paddingPx * 2, 100);

  const scaleX = availableWidth / pagePxWidth;
  const scaleY = availableHeight / pagePxHeight;
  const fitZoom = clampZoom(Math.min(scaleX, scaleY));

  const scaledPageWidth = pagePxWidth * fitZoom;
  const scaledPageHeight = pagePxHeight * fitZoom;

  const panX = (viewportWidth - scaledPageWidth) / 2;
  const panY = (viewportHeight - scaledPageHeight) / 2;

  return {
    zoom: fitZoom,
    panX,
    panY,
    viewportWidth,
    viewportHeight,
  };
}

