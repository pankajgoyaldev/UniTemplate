import type { BoundingBox, PageUnit } from '../ast/types.js';

export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;
export const PT_PER_MM = PT_PER_INCH / MM_PER_INCH; // ~2.8346456692913384
export const DEFAULT_SCREEN_DPI = 96;                // Standard CSS Pixel definition
export const DEFAULT_PRINT_DPI = 300;

/**
 * Rounds a floating point number to a given decimal precision.
 * Prevents floating point accumulation errors (e.g. 0.1 + 0.2 = 0.30000000000000004)
 */
export function roundPrecision(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function mmToIn(mm: number): number {
  return roundPrecision(mm / MM_PER_INCH, 4);
}

export function inToMm(inches: number): number {
  return roundPrecision(inches * MM_PER_INCH, 3);
}

export function mmToPt(mm: number): number {
  return roundPrecision(mm * PT_PER_MM, 3);
}

export function ptToMm(pt: number): number {
  return roundPrecision(pt / PT_PER_MM, 3);
}

export function inToPt(inches: number): number {
  return roundPrecision(inches * PT_PER_INCH, 3);
}

export function ptToIn(pt: number): number {
  return roundPrecision(pt / PT_PER_INCH, 4);
}

/**
 * Converts physical millimeters to display pixels for a given DPI.
 * Standard CSS displays render at 96 CSS px per inch.
 */
export function mmToPx(mm: number, dpi = DEFAULT_SCREEN_DPI): number {
  return (mm / MM_PER_INCH) * dpi;
}

/**
 * Converts display pixels back to physical millimeters.
 */
export function pxToMm(px: number, dpi = DEFAULT_SCREEN_DPI): number {
  return (px / dpi) * MM_PER_INCH;
}

/**
 * Converts typography points (pt) to display pixels.
 */
export function ptToPx(pt: number, dpi = DEFAULT_SCREEN_DPI): number {
  return (pt / PT_PER_INCH) * dpi;
}

/**
 * Converts display pixels to typography points (pt).
 */
export function pxToPt(px: number, dpi = DEFAULT_SCREEN_DPI): number {
  return (px / dpi) * PT_PER_INCH;
}

/**
 * Generic unit converter between mm, in, and pt.
 */
export function convertUnit(value: number, from: PageUnit, to: PageUnit): number {
  if (from === to) return value;

  // Convert to millimeters as base intermediate unit
  let mmValue: number;
  switch (from) {
    case 'mm':
      mmValue = value;
      break;
    case 'in':
      mmValue = value * MM_PER_INCH;
      break;
    case 'pt':
      mmValue = value / PT_PER_MM;
      break;
  }

  // Convert from mm to target unit
  switch (to) {
    case 'mm':
      return roundPrecision(mmValue, 3);
    case 'in':
      return roundPrecision(mmValue / MM_PER_INCH, 4);
    case 'pt':
      return roundPrecision(mmValue * PT_PER_MM, 3);
  }
}

/**
 * Viewport conversion: transforms a physical mm BoundingBox
 * into screen-space pixel coordinates based on zoom, pan, and DPI.
 */
export function boundingBoxMmToPx(
  box: BoundingBox,
  zoom = 1,
  panX = 0,
  panY = 0,
  dpi = DEFAULT_SCREEN_DPI,
): {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
} {
  return {
    left: mmToPx(box.x, dpi) * zoom + panX,
    top: mmToPx(box.y, dpi) * zoom + panY,
    width: mmToPx(box.width, dpi) * zoom,
    height: mmToPx(box.height, dpi) * zoom,
    rotation: box.rotation,
  };
}

/**
 * Inverted viewport conversion: translates a pointer event (screen CSS pixels)
 * back into the template's physical millimeter coordinates.
 */
export function screenPxToCanvasMm(
  screenX: number,
  screenY: number,
  zoom = 1,
  panX = 0,
  panY = 0,
  dpi = DEFAULT_SCREEN_DPI,
): { x: number; y: number } {
  const canvasPxX = (screenX - panX) / zoom;
  const canvasPxY = (screenY - panY) / zoom;
  return {
    x: roundPrecision(pxToMm(canvasPxX, dpi), 3),
    y: roundPrecision(pxToMm(canvasPxY, dpi), 3),
  };
}

