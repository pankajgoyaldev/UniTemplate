/**
 * Resizing engine in physical millimeters for Universe Template Studio.
 * Supports 8 handles, opposite-anchor preservation, proportional aspect ratio,
 * minimum dimension enforcement, and mathematically exact rotated element resizing.
 */

import type { ElementBounds, ResizeParams } from './types.js';
import { getElementRotatedCorners } from './handles.js';

const DEFAULT_MIN_SIZE_MM = 2.0;

/**
 * Calculates new element bounds after resizing from any of the 8 resize handles.
 * Preserves the opposite anchor point in world space for both unrotated and rotated elements.
 * Correctly clamps against page boundaries using rotated corner geometry.
 */
export function calculateResizedBounds(params: ResizeParams): ElementBounds {
  const {
    initialBounds,
    handle,
    deltaMm,
    keepAspectRatio = false,
    minWidthMm = initialBounds.width === 0 ? 0 : DEFAULT_MIN_SIZE_MM,
    minHeightMm = initialBounds.height === 0 ? 0 : DEFAULT_MIN_SIZE_MM,
    pageWidthMm,
    pageHeightMm,
  } = params;

  const { x: x0, y: y0, width: w0, height: h0, rotation = 0 } = initialBounds;

  const rad = (rotation * Math.PI) / 180;
  const cosRot = Math.cos(rad);
  const sinRot = Math.sin(rad);

  // 1. Transform pointer delta into element's local unrotated coordinate space
  const deltaXLocal = deltaMm.x * Math.cos(-rad) - deltaMm.y * Math.sin(-rad);
  const deltaYLocal = deltaMm.x * Math.sin(-rad) + deltaMm.y * Math.cos(-rad);

  let rawDeltaW = 0;
  let rawDeltaH = 0;

  // 2. Determine local width and height changes per handle
  switch (handle) {
    case 'e':
      rawDeltaW = deltaXLocal;
      break;
    case 'w':
      rawDeltaW = -deltaXLocal;
      break;
    case 's':
      rawDeltaH = deltaYLocal;
      break;
    case 'n':
      rawDeltaH = -deltaYLocal;
      break;
    case 'se':
      rawDeltaW = deltaXLocal;
      rawDeltaH = deltaYLocal;
      break;
    case 'sw':
      rawDeltaW = -deltaXLocal;
      rawDeltaH = deltaYLocal;
      break;
    case 'ne':
      rawDeltaW = deltaXLocal;
      rawDeltaH = -deltaYLocal;
      break;
    case 'nw':
      rawDeltaW = -deltaXLocal;
      rawDeltaH = -deltaYLocal;
      break;
  }

  let wNew = w0 + rawDeltaW;
  let hNew = h0 + rawDeltaH;

  // 3. Proportional aspect ratio handling (Shift key)
  const isCorner = handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw';
  if (keepAspectRatio && isCorner && w0 > 0 && h0 > 0) {
    const scaleW = wNew / w0;
    const scaleH = hNew / h0;
    const scale = Math.abs(scaleW - 1) > Math.abs(scaleH - 1) ? scaleW : scaleH;

    wNew = w0 * scale;
    hNew = h0 * scale;
  }

  // 4. Enforce minimum dimensions (prevent negative or zero sizes)
  wNew = Math.max(minWidthMm, wNew);
  hNew = Math.max(minHeightMm, hNew);

  if (wNew === 0 && hNew === 0) {
    if (w0 > 0) {
      wNew = minWidthMm > 0 ? minWidthMm : DEFAULT_MIN_SIZE_MM;
    } else if (h0 > 0) {
      hNew = minHeightMm > 0 ? minHeightMm : DEFAULT_MIN_SIZE_MM;
    } else {
      wNew = DEFAULT_MIN_SIZE_MM;
    }
  }

  // Helper to compute bounds given target width & height while keeping opposite anchor fixed
  const computeBoundsForSize = (w: number, h: number): ElementBounds => {
    let anchorLocalX = x0;
    let anchorLocalY = y0;
    let newLocalCenterX = x0 + w / 2;
    let newLocalCenterY = y0 + h / 2;

    switch (handle) {
      case 'e': // Anchor: left edge
        anchorLocalX = x0;
        anchorLocalY = y0 + h0 / 2;
        newLocalCenterX = x0 + w / 2;
        newLocalCenterY = y0 + h0 / 2;
        h = h0;
        break;
      case 'w': // Anchor: right edge
        anchorLocalX = x0 + w0;
        anchorLocalY = y0 + h0 / 2;
        newLocalCenterX = x0 + w0 - w / 2;
        newLocalCenterY = y0 + h0 / 2;
        h = h0;
        break;
      case 's': // Anchor: top edge
        anchorLocalX = x0 + w0 / 2;
        anchorLocalY = y0;
        newLocalCenterX = x0 + w0 / 2;
        newLocalCenterY = y0 + h / 2;
        w = w0;
        break;
      case 'n': // Anchor: bottom edge
        anchorLocalX = x0 + w0 / 2;
        anchorLocalY = y0 + h0;
        newLocalCenterX = x0 + w0 / 2;
        newLocalCenterY = y0 + h0 - h / 2;
        w = w0;
        break;
      case 'se': // Anchor: top-left corner
        anchorLocalX = x0;
        anchorLocalY = y0;
        newLocalCenterX = x0 + w / 2;
        newLocalCenterY = y0 + h / 2;
        break;
      case 'sw': // Anchor: top-right corner
        anchorLocalX = x0 + w0;
        anchorLocalY = y0;
        newLocalCenterX = x0 + w0 - w / 2;
        newLocalCenterY = y0 + h / 2;
        break;
      case 'ne': // Anchor: bottom-left corner
        anchorLocalX = x0;
        anchorLocalY = y0 + h0;
        newLocalCenterX = x0 + w / 2;
        newLocalCenterY = y0 + h0 - h / 2;
        break;
      case 'nw': // Anchor: bottom-right corner
        anchorLocalX = x0 + w0;
        anchorLocalY = y0 + h0;
        newLocalCenterX = x0 + w0 - w / 2;
        newLocalCenterY = y0 + h0 - h / 2;
        break;
    }

    const cx0 = x0 + w0 / 2;
    const cy0 = y0 + h0 / 2;

    const dxAnchor = anchorLocalX - cx0;
    const dyAnchor = anchorLocalY - cy0;

    const anchorWorldX = cx0 + (dxAnchor * cosRot - dyAnchor * sinRot);
    const anchorWorldY = cy0 + (dxAnchor * sinRot + dyAnchor * cosRot);

    const vLocalX = newLocalCenterX - anchorLocalX;
    const vLocalY = newLocalCenterY - anchorLocalY;

    const vWorldX = vLocalX * cosRot - vLocalY * sinRot;
    const vWorldY = vLocalX * sinRot + vLocalY * cosRot;

    const newWorldCenterX = anchorWorldX + vWorldX;
    const newWorldCenterY = anchorWorldY + vWorldY;

    return {
      x: newWorldCenterX - w / 2,
      y: newWorldCenterY - h / 2,
      width: w,
      height: h,
      rotation,
    };
  };

  // 5. Constrain with Page Boundaries (taking rotated geometry into account)
  if (pageWidthMm !== undefined && pageHeightMm !== undefined) {
    const candidateBounds = computeBoundsForSize(wNew, hNew);
    const isInside = (b: ElementBounds): boolean => {
      const corners = getElementRotatedCorners(b);
      const tol = 1e-4;
      return corners.every(
        (c) =>
          c.x >= -tol &&
          c.x <= pageWidthMm + tol &&
          c.y >= -tol &&
          c.y <= pageHeightMm + tol,
      );
    };

    if (!isInside(candidateBounds)) {
      // If expanding, binary search back toward initial size (w0, h0)
      let low = 0;
      let high = 1;
      for (let i = 0; i < 16; i++) {
        const mid = (low + high) / 2;
        const testW = w0 + mid * (wNew - w0);
        const testH = h0 + mid * (hNew - h0);
        if (isInside(computeBoundsForSize(testW, testH))) {
          low = mid;
        } else {
          high = mid;
        }
      }
      wNew = Math.max(minWidthMm, w0 + low * (wNew - w0));
      hNew = Math.max(minHeightMm, h0 + low * (hNew - h0));
    }
  }

  return computeBoundsForSize(wNew, hNew);
}
