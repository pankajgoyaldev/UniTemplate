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
  return Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
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
  if (clampedZoom === current.zoom) {
    return current;
  }

  const zoomRatio = clampedZoom / current.zoom;

  // New pan coordinates ensure the canvas point under cursor remains fixed
  const newPanX = cursorScreenPx.x - (cursorScreenPx.x - current.panX) * zoomRatio;
  const newPanY = cursorScreenPx.y - (cursorScreenPx.y - current.panY) * zoomRatio;

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
  return {
    ...current,
    panX: current.panX + deltaScreenPx.x,
    panY: current.panY + deltaScreenPx.y,
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

