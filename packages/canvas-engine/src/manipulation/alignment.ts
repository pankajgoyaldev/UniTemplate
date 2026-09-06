/**
 * Element alignment and page boundary clamping in physical millimeters (mm).
 * Supports rotated elements by computing exact visual axis-aligned bounding boxes (AABB).
 */

import type { ElementBounds } from './types.js';
import { getElementRotatedAABB } from './handles.js';

export type AlignmentType =
  | 'align-left'
  | 'align-center-h'
  | 'align-right'
  | 'align-top'
  | 'align-middle-v'
  | 'align-bottom';

/**
 * Calculates aligned bounds for an element relative to the physical page dimensions.
 * For rotated elements, it aligns the visual bounding box edge to the page edge
 * while keeping the element's rotation and dimensions unchanged.
 */
export function calculateElementPageAlignment(
  bounds: ElementBounds,
  alignment: AlignmentType,
  pageWidthMm: number,
  pageHeightMm: number,
): ElementBounds {
  const aabb = getElementRotatedAABB(bounds);
  const dx = bounds.x - aabb.x;
  const dy = bounds.y - aabb.y;

  let newX = bounds.x;
  let newY = bounds.y;

  switch (alignment) {
    case 'align-left':
      newX = 0 + dx;
      break;
    case 'align-center-h':
      newX = (pageWidthMm - aabb.width) / 2 + dx;
      break;
    case 'align-right':
      newX = pageWidthMm - aabb.width + dx;
      break;
    case 'align-top':
      newY = 0 + dy;
      break;
    case 'align-middle-v':
      newY = (pageHeightMm - aabb.height) / 2 + dy;
      break;
    case 'align-bottom':
      newY = pageHeightMm - aabb.height + dy;
      break;
  }

  // Guard against NaN or Infinity
  if (!Number.isFinite(newX)) newX = bounds.x;
  if (!Number.isFinite(newY)) newY = bounds.y;

  return {
    ...bounds,
    x: Number(newX.toFixed(4)),
    y: Number(newY.toFixed(4)),
  };
}

/**
 * Clamps element bounds to stay reasonably within page boundaries,
 * enforces minimum positive dimensions, normalizes rotation, and prevents NaN or Infinity.
 */
export function clampBoundsToPage(
  bounds: ElementBounds,
  pageWidthMm: number,
  pageHeightMm: number,
  minDimensionMm = 0.1,
): ElementBounds {
  // Prevent NaN or Infinity in width and height
  const width = Number.isFinite(bounds.width)
    ? Math.max(minDimensionMm, bounds.width)
    : 10;
  const height = Number.isFinite(bounds.height)
    ? Math.max(0, bounds.height) // lines may have 0 height
    : 10;

  // Normalize rotation to [0, 360)
  const rotation = Number.isFinite(bounds.rotation)
    ? ((bounds.rotation % 360) + 360) % 360
    : 0;

  let x = Number.isFinite(bounds.x) ? bounds.x : 0;
  let y = Number.isFinite(bounds.y) ? bounds.y : 0;

  // Calculate rotated AABB to clamp visually
  const candidateBounds: ElementBounds = { x, y, width, height, rotation };
  const aabb = getElementRotatedAABB(candidateBounds);
  const dx = x - aabb.x;
  const dy = y - aabb.y;

  let clampedAabbX = aabb.x;
  if (aabb.width <= pageWidthMm) {
    clampedAabbX = Math.max(0, Math.min(pageWidthMm - aabb.width, aabb.x));
  } else {
    // If element is wider than page, keep its left edge at 0
    clampedAabbX = 0;
  }

  let clampedAabbY = aabb.y;
  if (aabb.height <= pageHeightMm) {
    clampedAabbY = Math.max(0, Math.min(pageHeightMm - aabb.height, aabb.y));
  } else {
    // If element is taller than page, keep its top edge at 0
    clampedAabbY = 0;
  }

  return {
    x: Number((clampedAabbX + dx).toFixed(4)),
    y: Number((clampedAabbY + dy).toFixed(4)),
    width: Number(width.toFixed(4)),
    height: Number(height.toFixed(4)),
    rotation: Number(rotation.toFixed(2)),
  };
}

