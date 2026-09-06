/**
 * Universe Template Studio - Viewport & Coordinate Engine Types
 * All canvas-space coordinates are strictly stored in physical millimeters (mm).
 * All screen-space coordinates are in CSS display pixels (px).
 */

export interface Point {
  x: number;
  y: number;
}

export interface ViewportState {
  zoom: number;            // Scale multiplier (0.1 to 10.0, where 1.0 = 100%)
  panX: number;            // Horizontal screen offset in CSS pixels
  panY: number;            // Vertical screen offset in CSS pixels
  viewportWidth: number;   // Container screen width in CSS pixels
  viewportHeight: number;  // Container screen height in CSS pixels
}

export type RulerTickType = 'major' | 'medium' | 'minor';

export interface RulerTick {
  positionMm: number;      // Position in physical millimeters
  screenPositionPx: number;// Screen pixel coordinate along ruler axis
  type: RulerTickType;     // Tick prominence
  label?: string;          // Formatted number string in mm (e.g. "0", "50", "100")
}

export interface RulerIntervals {
  majorIntervalMm: number;  // Major tick interval with label
  mediumIntervalMm: number; // Intermediate tick
  minorIntervalMm: number;  // Smallest tick
}

export type GridSizeMm = 5 | 10;

export interface GridConfig {
  visible: boolean;
  sizeMm: GridSizeMm;
}

