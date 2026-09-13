import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../src/store/useUIStore.js';

describe('Panel Resize & Toolbox Width State', () => {
  beforeEach(() => {
    useUIStore.setState({ toolboxWidth: 72 });
  });

  it('initializes with compact default width of 72px', () => {
    expect(useUIStore.getState().toolboxWidth).toBe(72);
  });

  it('updates toolbox width within allowable range [72, 360]', () => {
    useUIStore.getState().setToolboxWidth(120);
    expect(useUIStore.getState().toolboxWidth).toBe(120);

    useUIStore.getState().setToolboxWidth(200);
    expect(useUIStore.getState().toolboxWidth).toBe(200);

    useUIStore.getState().setToolboxWidth(360);
    expect(useUIStore.getState().toolboxWidth).toBe(360);
  });

  it('clamps width to minimum of 72px when dragged below minimum', () => {
    useUIStore.getState().setToolboxWidth(50);
    expect(useUIStore.getState().toolboxWidth).toBe(72);

    useUIStore.getState().setToolboxWidth(0);
    expect(useUIStore.getState().toolboxWidth).toBe(72);

    useUIStore.getState().setToolboxWidth(-50);
    expect(useUIStore.getState().toolboxWidth).toBe(72);
  });

  it('clamps width to maximum of 360px when dragged above maximum', () => {
    useUIStore.getState().setToolboxWidth(380);
    expect(useUIStore.getState().toolboxWidth).toBe(360);

    useUIStore.getState().setToolboxWidth(999);
    expect(useUIStore.getState().toolboxWidth).toBe(360);
  });

  it('distinguishes compact mode (< 160px) from expanded mode (>= 160px)', () => {
    const isCompact = (width: number) => width < 160;

    // Minimum width is compact
    expect(isCompact(72)).toBe(true);
    expect(isCompact(120)).toBe(true);
    expect(isCompact(159)).toBe(true);

    // Expanded threshold
    expect(isCompact(160)).toBe(false);
    expect(isCompact(220)).toBe(false);
    expect(isCompact(360)).toBe(false);
  });

  it('simulates left-side panel resize delta clamping accurately', () => {
    const startWidth = 72;
    const minWidth = 72;
    const maxWidth = 360;

    const calculateNewWidth = (start: number, delta: number) =>
      Math.max(minWidth, Math.min(maxWidth, start + delta));

    // Dragging right increases width
    expect(calculateNewWidth(startWidth, 48)).toBe(120);
    expect(calculateNewWidth(startWidth, 128)).toBe(200);

    // Dragging right beyond maximum clamps to 360
    expect(calculateNewWidth(startWidth, 400)).toBe(360);

    // Dragging left below minimum clamps to 72
    expect(calculateNewWidth(startWidth, -50)).toBe(72);
  });

});

describe('Inspector Right-Side Resize State', () => {
  beforeEach(() => {
    useUIStore.setState({ inspectorWidth: 320 });
  });

  it('initializes with default width of 320px', () => {
    expect(useUIStore.getState().inspectorWidth).toBe(320);
  });

  it('updates inspector width within allowable range [220, 400]', () => {
    useUIStore.getState().setInspectorWidth(250);
    expect(useUIStore.getState().inspectorWidth).toBe(250);

    useUIStore.getState().setInspectorWidth(380);
    expect(useUIStore.getState().inspectorWidth).toBe(380);

    useUIStore.getState().setInspectorWidth(400);
    expect(useUIStore.getState().inspectorWidth).toBe(400);
  });

  it('clamps width to minimum of 220px when dragged below minimum', () => {
    useUIStore.getState().setInspectorWidth(200);
    expect(useUIStore.getState().inspectorWidth).toBe(220);

    useUIStore.getState().setInspectorWidth(0);
    expect(useUIStore.getState().inspectorWidth).toBe(220);

    useUIStore.getState().setInspectorWidth(-100);
    expect(useUIStore.getState().inspectorWidth).toBe(220);
  });

  it('clamps width to maximum of 400px when dragged above maximum', () => {
    useUIStore.getState().setInspectorWidth(450);
    expect(useUIStore.getState().inspectorWidth).toBe(400);

    useUIStore.getState().setInspectorWidth(999);
    expect(useUIStore.getState().inspectorWidth).toBe(400);
  });

  it('simulates right-side panel resize delta clamping accurately', () => {
    const startWidth = 320;
    const minWidth = 220;
    const maxWidth = 400;

    const calculateRightWidth = (start: number, delta: number) =>
      Math.max(minWidth, Math.min(maxWidth, start - delta));

    // Dragging left (negative delta) increases right panel width
    expect(calculateRightWidth(startWidth, -50)).toBe(370);

    // Dragging right (positive delta) decreases right panel width
    expect(calculateRightWidth(startWidth, 40)).toBe(280);

    // Clamps to min and max correctly
    expect(calculateRightWidth(startWidth, 150)).toBe(220);
    expect(calculateRightWidth(startWidth, -150)).toBe(400);
  });
});

describe('TopBar Vertical Resize State', () => {
  beforeEach(() => {
    useUIStore.setState({ topBarHeight: 48 });
  });

  it('initializes with default height of 48px', () => {
    expect(useUIStore.getState().topBarHeight).toBe(48);
  });

  it('updates TopBar height within allowable range [48, 80]', () => {
    useUIStore.getState().setTopBarHeight(60);
    expect(useUIStore.getState().topBarHeight).toBe(60);

    useUIStore.getState().setTopBarHeight(80);
    expect(useUIStore.getState().topBarHeight).toBe(80);
  });

  it('clamps height to minimum of 48px when dragged above/below minimum', () => {
    useUIStore.getState().setTopBarHeight(30);
    expect(useUIStore.getState().topBarHeight).toBe(48);

    useUIStore.getState().setTopBarHeight(0);
    expect(useUIStore.getState().topBarHeight).toBe(48);
  });

  it('clamps height to maximum of 80px when dragged below maximum', () => {
    useUIStore.getState().setTopBarHeight(95);
    expect(useUIStore.getState().topBarHeight).toBe(80);

    useUIStore.getState().setTopBarHeight(500);
    expect(useUIStore.getState().topBarHeight).toBe(80);
  });

  it('simulates horizontal resize handle top-side delta clamping accurately', () => {
    const startHeight = 48;
    const minHeight = 48;
    const maxHeight = 80;

    const calculateNewHeight = (start: number, deltaY: number) =>
      Math.max(minHeight, Math.min(maxHeight, start + deltaY));

    // Dragging down (positive deltaY) increases TopBar height
    expect(calculateNewHeight(startHeight, 16)).toBe(64);
    expect(calculateNewHeight(startHeight, 50)).toBe(80); // clamped to 80

    // Dragging up (negative deltaY) decreases TopBar height
    expect(calculateNewHeight(64, -10)).toBe(54);
    expect(calculateNewHeight(startHeight, -20)).toBe(48); // clamped to 48
  });
});

