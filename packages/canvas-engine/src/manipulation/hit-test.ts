/**
 * Physical millimeter hit testing engine for Universe Template Studio.
 * Evaluates points in physical canvas coordinates (mm) with rotation support.
 */

import type { TemplateElement } from '@uts/core';
import type { ElementBounds, Point } from './types.js';

/**
 * Checks whether a physical millimeter coordinate is within an element's bounding box.
 * Handles unrotated and rotated coordinate spaces mathematically.
 */
export function isPointInElementBounds(
  pointMm: Point,
  bounds: ElementBounds,
  toleranceMm = 0,
): boolean {
  const { x, y, width, height, rotation } = bounds;

  // Handle zero-dimension elements (e.g. thin horizontal or vertical lines) with hit tolerance
  const effectiveWidth = Math.max(width, toleranceMm > 0 ? toleranceMm : (width === 0 ? 2.0 : width));
  const effectiveHeight = Math.max(height, toleranceMm > 0 ? toleranceMm : (height === 0 ? 2.0 : height));
  const effectiveX = width === 0 ? x - effectiveWidth / 2 : x;
  const effectiveY = height === 0 ? y - effectiveHeight / 2 : y;

  const effectiveMinX = effectiveX - toleranceMm;
  const effectiveMaxX = effectiveX + effectiveWidth + toleranceMm;
  const effectiveMinY = effectiveY - toleranceMm;
  const effectiveMaxY = effectiveY + effectiveHeight + toleranceMm;

  if (!rotation || rotation % 360 === 0) {
    return (
      pointMm.x >= effectiveMinX &&
      pointMm.x <= effectiveMaxX &&
      pointMm.y >= effectiveMinY &&
      pointMm.y <= effectiveMaxY
    );
  }

  // Rotate point into element's local unrotated coordinate space around its center
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const dx = pointMm.x - centerX;
  const dy = pointMm.y - centerY;

  const rad = (-rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const localX = centerX + (dx * cos - dy * sin);
  const localY = centerY + (dx * sin + dy * cos);

  return (
    localX >= effectiveMinX &&
    localX <= effectiveMaxX &&
    localY >= effectiveMinY &&
    localY <= effectiveMaxY
  );
}

/**
 * Finds the topmost selectable element at a given physical millimeter coordinate.
 * Filters out invisible elements and locked elements, and evaluates by zIndex descending.
 * Does NOT mutate the input array or element objects.
 */
export function hitTestElements(
  pointMm: Point,
  elements: TemplateElement[],
  toleranceMm = 0,
): TemplateElement | null {
  // Filter selectable elements only: must be visible and not locked
  const selectable = elements.filter((el) => el.isVisible && !el.isLocked);

  // Sort by zIndex descending (higher zIndex on top)
  const sorted = [...selectable].sort(
    (a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0),
  );

  for (const element of sorted) {
    if (isPointInElementBounds(pointMm, element.bounds, toleranceMm)) {
      return element;
    }
  }

  return null;
}
