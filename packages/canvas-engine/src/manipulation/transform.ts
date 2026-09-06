/**
 * Translation, movement, grid snapping, and page boundary clamping in physical millimeters.
 */

import type { ElementBounds, Point } from './types.js';
import { getElementRotatedAABB } from './handles.js';

/**
 * Snaps a target position to the physical millimeter grid and returns the effective delta
 * from the reference position.
 *
 * Example:
 *   initial x = 12mm, target = 14mm, grid = 5mm
 *   snapped target = 15mm
 *   effective delta = +3mm
 */
export function calculatePositionSnappedDelta(
  referencePointMm: Point,
  rawDeltaMm: Point,
  gridSizeMm?: number,
): Point {
  if (!gridSizeMm || gridSizeMm <= 0) {
    return rawDeltaMm;
  }
  const targetX = referencePointMm.x + rawDeltaMm.x;
  const targetY = referencePointMm.y + rawDeltaMm.y;

  const snappedX = Math.round(targetX / gridSizeMm) * gridSizeMm;
  const snappedY = Math.round(targetY / gridSizeMm) * gridSizeMm;

  return {
    x: snappedX - referencePointMm.x,
    y: snappedY - referencePointMm.y,
  };
}

/**
 * Snaps a delta displacement to the physical millimeter grid.
 * @deprecated Prefer calculatePositionSnappedDelta for position-accurate grid alignment.
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
 * Accurately considers the full rotated visual geometry so no part of the element exceeds page bounds.
 * Preserves dimensions and rotation.
 */
export function calculateMovedBounds(
  initialBounds: ElementBounds,
  deltaMm: Point,
  pageWidthMm: number,
  pageHeightMm: number,
): ElementBounds {
  const aabb = getElementRotatedAABB(initialBounds);

  const minDeltaX = -aabb.x;
  const maxDeltaX = Math.max(minDeltaX, pageWidthMm - (aabb.x + aabb.width));
  const clampedDeltaX = Math.min(maxDeltaX, Math.max(minDeltaX, deltaMm.x));

  const minDeltaY = -aabb.y;
  const maxDeltaY = Math.max(minDeltaY, pageHeightMm - (aabb.y + aabb.height));
  const clampedDeltaY = Math.min(maxDeltaY, Math.max(minDeltaY, deltaMm.y));

  return {
    ...initialBounds,
    x: initialBounds.x + clampedDeltaX,
    y: initialBounds.y + clampedDeltaY,
  };
}

/**
 * Calculates group movement for multiple selected elements, clamping the collective
 * translation so no element leaves the page boundaries and preserving exact relative positions.
 * Considers rotated bounds for each element.
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
    const aabb = getElementRotatedAABB(item.initialBounds);

    const allowedMinX = -aabb.x;
    const allowedMaxX = Math.max(allowedMinX, pageWidthMm - (aabb.x + aabb.width));
    const allowedMinY = -aabb.y;
    const allowedMaxY = Math.max(allowedMinY, pageHeightMm - (aabb.y + aabb.height));

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
