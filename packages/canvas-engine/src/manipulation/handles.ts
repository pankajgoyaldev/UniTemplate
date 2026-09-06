/**
 * Resize handles and bounding box calculations in physical millimeters.
 */

import type { TemplateElement } from '@uts/core';
import type { ElementBounds, ResizeHandleInfo, ResizeHandleType, BoundingBoxMm, Point } from './types.js';

/**
 * Returns appropriate CSS resize cursor, optionally adjusted for element rotation.
 */
export function getHandleCursor(handle: ResizeHandleType, rotation = 0): string {
  const baseAngles: Record<ResizeHandleType, number> = {
    n: 0,
    ne: 45,
    e: 90,
    se: 135,
    s: 180,
    sw: 225,
    w: 270,
    nw: 315,
  };

  const totalAngle = (baseAngles[handle] + rotation) % 360;
  const normalized = (totalAngle + 360) % 360;

  if ((normalized >= 337.5 || normalized < 22.5) || (normalized >= 157.5 && normalized < 202.5)) {
    return 'ns-resize';
  }
  if ((normalized >= 22.5 && normalized < 67.5) || (normalized >= 202.5 && normalized < 247.5)) {
    return 'nesw-resize';
  }
  if ((normalized >= 67.5 && normalized < 112.5) || (normalized >= 247.5 && normalized < 292.5)) {
    return 'ew-resize';
  }
  return 'nwse-resize';
}

/**
 * Calculates the 4 world-space corners of an element bounds, taking rotation into account.
 * Order: [nw, ne, se, sw].
 */
export function getElementRotatedCorners(bounds: ElementBounds): Point[] {
  const { x, y, width, height, rotation = 0 } = bounds;
  const cx = x + width / 2;
  const cy = y + height / 2;

  if (!rotation || rotation % 360 === 0) {
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const localOffsets = [
    { dx: -width / 2, dy: -height / 2 }, // nw
    { dx: width / 2, dy: -height / 2 },  // ne
    { dx: width / 2, dy: height / 2 },   // se
    { dx: -width / 2, dy: height / 2 },  // sw
  ];

  return localOffsets.map((o) => ({
    x: cx + (o.dx * cos - o.dy * sin),
    y: cy + (o.dx * sin + o.dy * cos),
  }));
}

/**
 * Calculates the world-space axis-aligned bounding box (AABB) enclosing an element,
 * taking its rotation into account.
 */
export function getElementRotatedAABB(bounds: ElementBounds): BoundingBoxMm {
  const corners = getElementRotatedCorners(bounds);
  let minX = corners[0].x;
  let maxX = corners[0].x;
  let minY = corners[0].y;
  let maxY = corners[0].y;

  for (let i = 1; i < corners.length; i++) {
    minX = Math.min(minX, corners[i].x);
    maxX = Math.max(maxX, corners[i].x);
    minY = Math.min(minY, corners[i].y);
    maxY = Math.max(maxY, corners[i].y);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

/**
 * Returns the exact world coordinates of any of the 8 handles/anchors of an element,
 * taking rotation into account.
 */
export function getElementWorldAnchor(bounds: ElementBounds, anchor: ResizeHandleType): Point {
  const { x, y, width, height, rotation = 0 } = bounds;
  const cx = x + width / 2;
  const cy = y + height / 2;

  const localOffsets: Record<ResizeHandleType, { dx: number; dy: number }> = {
    nw: { dx: -width / 2, dy: -height / 2 },
    n: { dx: 0, dy: -height / 2 },
    ne: { dx: width / 2, dy: -height / 2 },
    e: { dx: width / 2, dy: 0 },
    se: { dx: width / 2, dy: height / 2 },
    s: { dx: 0, dy: height / 2 },
    sw: { dx: -width / 2, dy: height / 2 },
    w: { dx: -width / 2, dy: 0 },
  };

  const o = localOffsets[anchor];
  if (!rotation || rotation % 360 === 0) {
    return { x: cx + o.dx, y: cy + o.dy };
  }

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    x: cx + (o.dx * cos - o.dy * sin),
    y: cy + (o.dx * sin + o.dy * cos),
  };
}

/**
 * Calculates the 8 resize handle coordinates in physical millimeters for an element.
 * Accounts for element rotation around its center point.
 */
export function calculateElementHandles(bounds: ElementBounds): ResizeHandleInfo[] {
  const handles: ResizeHandleType[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const rotation = bounds.rotation ?? 0;

  return handles.map((type) => ({
    type,
    positionMm: getElementWorldAnchor(bounds, type),
    cursor: getHandleCursor(type, rotation),
  }));
}

/**
 * Calculates the bounding box enclosing multiple elements in physical millimeters.
 * Accurately encloses the complete visual geometry of both unrotated and rotated elements.
 */
export function calculateMultiElementBoundingBox(elements: TemplateElement[]): BoundingBoxMm | null {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const aabb = getElementRotatedAABB(el.bounds);
    minX = Math.min(minX, aabb.x);
    minY = Math.min(minY, aabb.y);
    maxX = Math.max(maxX, aabb.x + aabb.width);
    maxY = Math.max(maxY, aabb.y + aabb.height);
  }

  if (minX === Infinity) return null;

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}
