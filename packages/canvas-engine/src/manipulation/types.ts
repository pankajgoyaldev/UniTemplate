/**
 * Manipulation types for Universe Template Studio.
 * All spatial coordinates and dimensions are strictly in physical millimeters (mm).
 */

import type { BoundingBox } from '@uts/core';
import type { Point } from '../viewport/types.js';

export type ElementBounds = BoundingBox;
export type { Point };

export type ResizeHandleType =
  | 'nw' // Top-Left
  | 'n'  // Top-Center
  | 'ne' // Top-Right
  | 'e'  // Middle-Right
  | 'se' // Bottom-Right
  | 's'  // Bottom-Center
  | 'sw' // Bottom-Left
  | 'w'; // Middle-Left

export interface ResizeHandleInfo {
  type: ResizeHandleType;
  positionMm: Point;
  cursor: string;
}

export interface BoundingBoxMm {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeParams {
  initialBounds: ElementBounds;
  handle: ResizeHandleType;
  deltaMm: Point;
  keepAspectRatio?: boolean;
  minWidthMm?: number;
  minHeightMm?: number;
  pageWidthMm?: number;
  pageHeightMm?: number;
}
