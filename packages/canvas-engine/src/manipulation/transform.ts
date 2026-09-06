/**
 * Translation, movement, grid snapping, and page boundary clamping in physical millimeters.
 */

import type { ElementBounds, Point } from './types.js';

/**
 * Snaps a delta displacement to the physical millimeter grid.
 */
export function calculateSnappedDelta(deltaMm: Point, gridSizeMm?: number): Point {
  if (!gridSizeMm || gridSizeMm <= 0) {
    return deltaMm;
  }
  return {
    x: Math.round(deltaMm.x / gridSizeMm) * gridSizeMm,
    y: Math.round(deltaMm.y / gridSizeMm) * gridSizeMm,
  };
}

/**
 * Calculates new bounds for an element after translation, clamping strictly within page boundaries.
 * Preserves dimensions and rotation.
 */
export function calculateMovedBounds(
  initialBounds: ElementBounds,
  deltaMm: Point,
  pageWidthMm: number,
  pageHeightMm: number,
): ElementBounds {
  const minX = 0;
  const maxX = Math.max(0, pageWidthMm - initialBounds.width);
  const clampedX = Math.min(maxX, Math.max(minX, initialBounds.x + deltaMm.x));

  const minY = 0;
  const maxY = Math.max(0, pageHeightMm - initialBounds.height);
  const clampedY = Math.min(maxY, Math.max(minY, initialBounds.y + deltaMm.y));

  return {
    ...initialBounds,
    x: clampedX,
    y: clampedY,
  };
}

/**
 * Calculates group movement for multiple selected elements, clamping the collective
 * translation so no element leaves the page boundaries and preserving relative positions.
 */
export function calculateMultiElementMove(
  elements: { id: string; initialBounds: ElementBounds }[],
  deltaMm: Point,
  pageWidthMm: number,
  pageHeightMm: number,
): { id: string; bounds: ElementBounds }[] {
  if (elements.length === 0) return [];

  // Compute maximum allowed collective delta across all elements
  let minDeltaX = -Infinity;
  let maxDeltaX = Infinity;
  let minDeltaY = -Infinity;
  let maxDeltaY = Infinity;

  for (const item of elements) {
    const { x, y, width, height } = item.initialBounds;

    // Element must stay >= 0 and <= page
    const allowedMinX = -x;
    const allowedMaxX = Math.max(0, pageWidthMm - (x + width));
    const allowedMinY = -y;
    const allowedMaxY = Math.max(0, pageHeightMm - (y + height));

    minDeltaX = Math.max(minDeltaX, allowedMinX);
    maxDeltaX = Math.min(maxDeltaX, allowedMaxX);
    minDeltaY = Math.max(minDeltaY, allowedMinY);
    maxDeltaY = Math.min(maxDeltaY, allowedMaxY);
  }

  // Ensure min <= max
  if (minDeltaX > maxDeltaX) maxDeltaX = minDeltaX;
  if (minDeltaY > maxDeltaY) maxDeltaY = minDeltaY;

  const effectiveDeltaX = Math.min(maxDeltaX, Math.max(minDeltaX, deltaMm.x));
  const effectiveDeltaY = Math.min(maxDeltaY, Math.max(minDeltaY, deltaMm.y));

  return elements.map((item) => ({
    id: item.id,
    bounds: {
      ...item.initialBounds,
      x: item.initialBounds.x + effectiveDeltaX,
      y: item.initialBounds.y + effectiveDeltaY,
    },
  }));
}
