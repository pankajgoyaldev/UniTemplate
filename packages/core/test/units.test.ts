import { describe, it, expect } from 'vitest';
import {
  mmToIn,
  inToMm,
  mmToPt,
  ptToMm,
  inToPt,
  ptToIn,
  mmToPx,
  pxToMm,
  ptToPx,
  pxToPt,
  convertUnit,
  roundPrecision,
  boundingBoxMmToPx,
  screenPxToCanvasMm,
  DEFAULT_SCREEN_DPI,
  DEFAULT_PRINT_DPI,
} from '../src/math/units.js';

describe('Unit Conversion Math', () => {
  it('accurately converts between millimeters and inches', () => {
    expect(mmToIn(25.4)).toBe(1);
    expect(inToMm(1)).toBe(25.4);
    expect(mmToIn(210)).toBe(8.2677); // A4 width
    expect(mmToIn(297)).toBe(11.6929); // A4 height
  });

  it('accurately converts between millimeters and points', () => {
    expect(mmToPt(25.4)).toBe(72);
    expect(ptToMm(72)).toBe(25.4);
  });

  it('accurately converts between inches and points', () => {
    expect(inToPt(1)).toBe(72);
    expect(ptToIn(72)).toBe(1);
  });

  it('accurately converts millimeters to screen pixels at 96 DPI', () => {
    // 25.4mm = 1 inch = 96 CSS pixels
    expect(mmToPx(25.4, DEFAULT_SCREEN_DPI)).toBe(96);
    expect(pxToMm(96, DEFAULT_SCREEN_DPI)).toBe(25.4);
  });

  it('accurately converts millimeters to print dots at 300 DPI', () => {
    // 25.4mm = 1 inch = 300 print dots
    expect(mmToPx(25.4, DEFAULT_PRINT_DPI)).toBe(300);
    expect(pxToMm(300, DEFAULT_PRINT_DPI)).toBe(25.4);
  });

  it('accurately converts typography points to screen pixels', () => {
    // 72pt = 1 inch = 96px
    expect(ptToPx(72)).toBe(96);
    expect(pxToPt(96)).toBe(72);
    // Standard 12pt font = 16px
    expect(ptToPx(12)).toBe(16);
    expect(pxToPt(16)).toBe(12);
  });

  it('handles generic convertUnit across all unit combinations', () => {
    expect(convertUnit(100, 'mm', 'mm')).toBe(100);
    expect(convertUnit(1, 'in', 'mm')).toBe(25.4);
    expect(convertUnit(25.4, 'mm', 'in')).toBe(1);
    expect(convertUnit(72, 'pt', 'in')).toBe(1);
    expect(convertUnit(1, 'in', 'pt')).toBe(72);
  });

  it('handles floating point precision rounding correctly', () => {
    expect(roundPrecision(0.1 + 0.2, 3)).toBe(0.3);
    expect(roundPrecision(1.2345678, 2)).toBe(1.23);
    expect(roundPrecision(1.2345678, 4)).toBe(1.2346);
  });

  it('correctly maps viewport mm to screen pixels and back', () => {
    const box = { x: 10, y: 20, width: 50, height: 30, rotation: 0 };
    const zoom = 1.5;
    const panX = 100;
    const panY = 50;

    const screenBox = boundingBoxMmToPx(box, zoom, panX, panY, 96);
    expect(screenBox.left).toBeCloseTo(mmToPx(10, 96) * zoom + panX, 2);
    expect(screenBox.top).toBeCloseTo(mmToPx(20, 96) * zoom + panY, 2);

    // Invert point back to mm
    const backToMm = screenPxToCanvasMm(screenBox.left, screenBox.top, zoom, panX, panY, 96);
    expect(backToMm.x).toBeCloseTo(10, 2);
    expect(backToMm.y).toBeCloseTo(20, 2);
  });
});

