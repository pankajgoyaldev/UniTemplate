/**
 * Proportional multi-element resize engine in physical millimeters for Universe Template Studio.
 * Scales multiple selected elements relative to their common bounding box while
 * strictly enforcing member minimum dimensions, relative positions, and page boundaries.
 */

import type { ElementBounds, BoundingBoxMm, ResizeHandleType, Point } from './types.js';
import { calculateResizedBounds } from './resize.js';

export interface MultiResizeElementItem {
  id: string;
  initialBounds: ElementBounds;
  type?: string;
  isLocked?: boolean;
}

export interface MultiResizeParams {
  elements: MultiResizeElementItem[];
  initialGroupBounds: BoundingBoxMm;
  handle: ResizeHandleType;
  deltaMm: Point;
  keepAspectRatio?: boolean;
  minElementSizeMm?: number;
  pageWidthMm?: number;
  pageHeightMm?: number;
}

export interface MultiResizeResult {
  groupBounds: BoundingBoxMm;
  elementBounds: { id: string; bounds: ElementBounds }[];
}

export function calculateMultiElementResize(params: MultiResizeParams): MultiResizeResult {
  const {
    elements,
    initialGroupBounds,
    handle,
    deltaMm,
    keepAspectRatio = false,
    minElementSizeMm = 2.0,
    pageWidthMm,
    pageHeightMm,
  } = params;

  const { x: x0, y: y0, width: w0, height: h0 } = initialGroupBounds;

  if (elements.length === 0 || w0 <= 0 || h0 <= 0) {
    return {
      groupBounds: initialGroupBounds,
      elementBounds: elements.map((el) => ({ id: el.id, bounds: el.initialBounds })),
    };
  }

  // Calculate required minimum group dimensions so that no individual member element
  // shrinks below minElementSizeMm on non-zero dimensions
  let maxScaleFactorW = 0;
  let maxScaleFactorH = 0;

  for (const el of elements) {
    if (el.initialBounds.width > 0) {
      maxScaleFactorW = Math.max(maxScaleFactorW, minElementSizeMm / el.initialBounds.width);
    }
    if (el.initialBounds.height > 0) {
      maxScaleFactorH = Math.max(maxScaleFactorH, minElementSizeMm / el.initialBounds.height);
    }
  }

  const minGroupWidth = Math.max(minElementSizeMm, w0 * maxScaleFactorW);
  const minGroupHeight = Math.max(minElementSizeMm, h0 * maxScaleFactorH);

  // Resize common bounding box with page boundary and minimum size clamping
  const newGroupBounds = calculateResizedBounds({
    initialBounds: {
      x: x0,
      y: y0,
      width: w0,
      height: h0,
      rotation: 0,
    },
    handle,
    deltaMm,
    keepAspectRatio,
    minWidthMm: minGroupWidth,
    minHeightMm: minGroupHeight,
    pageWidthMm,
    pageHeightMm,
  });

  const scaleX = w0 > 0 ? newGroupBounds.width / w0 : 1;
  const scaleY = h0 > 0 ? newGroupBounds.height / h0 : 1;

  // Scale each element's position and size relative to the common bounding box
  const elementBounds = elements.map((item) => {
    const b = item.initialBounds;
    const relX = b.x - x0;
    const relY = b.y - y0;

    const newX = newGroupBounds.x + relX * scaleX;
    const newY = newGroupBounds.y + relY * scaleY;
    const newW = b.width > 0 ? Math.max(minElementSizeMm, b.width * scaleX) : 0;
    const newH = b.height > 0 ? Math.max(minElementSizeMm, b.height * scaleY) : 0;

    return {
      id: item.id,
      bounds: {
        x: newX,
        y: newY,
        width: newW,
        height: newH,
        rotation: b.rotation ?? 0,
      },
    };
  });

  return {
    groupBounds: {
      x: newGroupBounds.x,
      y: newGroupBounds.y,
      width: newGroupBounds.width,
      height: newGroupBounds.height,
    },
    elementBounds,
  };
}

