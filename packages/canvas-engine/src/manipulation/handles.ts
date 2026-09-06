/**
 * Resize handles and bounding box calculations in physical millimeters.
 */

import type { TemplateElement } from '@uts/core';
import type { ElementBounds, ResizeHandleInfo, ResizeHandleType, BoundingBoxMm } from './types.js';

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
 * Calculates the 8 resize handle coordinates in physical millimeters for an element.
 * Accounts for element rotation around its center point.
 */
export function calculateElementHandles(bounds: ElementBounds): ResizeHandleInfo[] {
  const { x, y, width, height, rotation = 0 } = bounds;

  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const rawHandles: { type: ResizeHandleType; x: number; y: number }[] = [
    { type: 'nw', x, y },
    { type: 'n', x: centerX, y },
    { type: 'ne', x: x + width, y },
    { type: 'e', x: x + width, y: centerY },
    { type: 'se', x: x + width, y: y + height },
    { type: 's', x: centerX, y: y + height },
    { type: 'sw', x, y: y + height },
    { type: 'w', x, y: centerY },
  ];

  if (!rotation || rotation % 360 === 0) {
    return rawHandles.map((h) => ({
      type: h.type,
      positionMm: { x: h.x, y: h.y },
      cursor: getHandleCursor(h.type, 0),
    }));
  }

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return rawHandles.map((h) => {
    const dx = h.x - centerX;
    const dy = h.y - centerY;

    const rotatedX = centerX + (dx * cos - dy * sin);
    const rotatedY = centerY + (dx * sin + dy * cos);

    return {
      type: h.type,
      positionMm: { x: rotatedX, y: rotatedY },
      cursor: getHandleCursor(h.type, rotation),
    };
  });
}

/**
 * Calculates the bounding box enclosing multiple elements in physical millimeters.
 */
export function calculateMultiElementBoundingBox(elements: TemplateElement[]): BoundingBoxMm | null {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const { x, y, width, height, rotation } = el.bounds;

    if (!rotation || rotation % 360 === 0) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    } else {
      // Calculate all 4 rotated corners
      const cx = x + width / 2;
      const cy = y + height / 2;
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const corners = [
        { dx: -width / 2, dy: -height / 2 },
        { dx: width / 2, dy: -height / 2 },
        { dx: width / 2, dy: height / 2 },
        { dx: -width / 2, dy: height / 2 },
      ];

      for (const c of corners) {
        const rx = cx + (c.dx * cos - c.dy * sin);
        const ry = cy + (c.dx * sin + c.dy * cos);
        minX = Math.min(minX, rx);
        minY = Math.min(minY, ry);
        maxX = Math.max(maxX, rx);
        maxY = Math.max(maxY, ry);
      }
    }
  }

  if (minX === Infinity) return null;

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}
