/**
 * Resizing engine in physical millimeters for Universe Template Studio.
 * Supports 8 handles, opposite-anchor preservation, proportional aspect ratio,
 * minimum dimension enforcement, and mathematically exact rotated element resizing.
 */

import type { ElementBounds, ResizeParams } from './types.js';

const DEFAULT_MIN_SIZE_MM = 2.0;

/**
 * Calculates new element bounds after resizing from any of the 8 resize handles.
 */
export function calculateResizedBounds(params: ResizeParams): ElementBounds {
  const {
    initialBounds,
    handle,
    deltaMm,
    keepAspectRatio = false,
    minWidthMm = DEFAULT_MIN_SIZE_MM,
    minHeightMm = DEFAULT_MIN_SIZE_MM,
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
    // Scale proportionally based on the axis with the larger relative change
    const scaleW = wNew / w0;
    const scaleH = hNew / h0;
    const scale = Math.abs(scaleW - 1) > Math.abs(scaleH - 1) ? scaleW : scaleH;

    wNew = w0 * scale;
    hNew = h0 * scale;
  }

  // 4. Enforce minimum dimensions (prevent negative or zero sizes)
  wNew = Math.max(minWidthMm, wNew);
  hNew = Math.max(minHeightMm, hNew);

  // 5. Calculate local anchor point (which does not move during resize)
  let anchorLocalX = x0;
  let anchorLocalY = y0;
  let newLocalCenterX = x0 + wNew / 2;
  let newLocalCenterY = y0 + hNew / 2;

  switch (handle) {
    case 'e': // Anchor: left edge
      anchorLocalX = x0;
      anchorLocalY = y0 + h0 / 2;
      newLocalCenterX = x0 + wNew / 2;
      newLocalCenterY = y0 + h0 / 2;
      hNew = h0; // Height unchanged
      break;
    case 'w': // Anchor: right edge
      anchorLocalX = x0 + w0;
      anchorLocalY = y0 + h0 / 2;
      newLocalCenterX = x0 + w0 - wNew / 2;
      newLocalCenterY = y0 + h0 / 2;
      hNew = h0; // Height unchanged
      break;
    case 's': // Anchor: top edge
      anchorLocalX = x0 + w0 / 2;
      anchorLocalY = y0;
      newLocalCenterX = x0 + w0 / 2;
      newLocalCenterY = y0 + hNew / 2;
      wNew = w0; // Width unchanged
      break;
    case 'n': // Anchor: bottom edge
      anchorLocalX = x0 + w0 / 2;
      anchorLocalY = y0 + h0;
      newLocalCenterX = x0 + w0 / 2;
      newLocalCenterY = y0 + h0 - hNew / 2;
      wNew = w0; // Width unchanged
      break;
    case 'se': // Anchor: top-left corner
      anchorLocalX = x0;
      anchorLocalY = y0;
      newLocalCenterX = x0 + wNew / 2;
      newLocalCenterY = y0 + hNew / 2;
      break;
    case 'sw': // Anchor: top-right corner
      anchorLocalX = x0 + w0;
      anchorLocalY = y0;
      newLocalCenterX = x0 + w0 - wNew / 2;
      newLocalCenterY = y0 + hNew / 2;
      break;
    case 'ne': // Anchor: bottom-left corner
      anchorLocalX = x0;
      anchorLocalY = y0 + h0;
      newLocalCenterX = x0 + wNew / 2;
      newLocalCenterY = y0 + h0 - hNew / 2;
      break;
    case 'nw': // Anchor: bottom-right corner
      anchorLocalX = x0 + w0;
      anchorLocalY = y0 + h0;
      newLocalCenterX = x0 + w0 - wNew / 2;
      newLocalCenterY = y0 + h0 - hNew / 2;
      break;
  }

  // 6. Calculate world coordinates of the fixed anchor
  const cx0 = x0 + w0 / 2;
  const cy0 = y0 + h0 / 2;

  const dxAnchor = anchorLocalX - cx0;
  const dyAnchor = anchorLocalY - cy0;

  const anchorWorldX = cx0 + (dxAnchor * cosRot - dyAnchor * sinRot);
  const anchorWorldY = cy0 + (dxAnchor * sinRot + dyAnchor * cosRot);

  // 7. Vector from local anchor to new local center
  const vLocalX = newLocalCenterX - anchorLocalX;
  const vLocalY = newLocalCenterY - anchorLocalY;

  // 8. Rotate vector to world coordinates
  const vWorldX = vLocalX * cosRot - vLocalY * sinRot;
  const vWorldY = vLocalX * sinRot + vLocalY * cosRot;

  // 9. New world center
  const newWorldCenterX = anchorWorldX + vWorldX;
  const newWorldCenterY = anchorWorldY + vWorldY;

  let finalX = newWorldCenterX - wNew / 2;
  let finalY = newWorldCenterY - hNew / 2;

  // 10. Optional page bounds clamping
  if (pageWidthMm !== undefined && pageHeightMm !== undefined) {
    finalX = Math.max(0, Math.min(pageWidthMm - wNew, finalX));
    finalY = Math.max(0, Math.min(pageHeightMm - hNew, finalY));
  }

  return {
    x: finalX,
    y: finalY,
    width: wNew,
    height: hNew,
    rotation,
  };
}
