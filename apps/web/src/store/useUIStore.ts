import { create } from 'zustand';
import {
  clampZoom,
  calculateZoomAtPoint,
  calculatePan,
  calculateFitToScreen,
  type Point,
  type ViewportState,
  type GridSizeMm,
} from '@uts/canvas-engine';

export type ToolType = 'select' | 'hand';

interface UIState extends ViewportState {
  activeTool: ToolType;
  isSpacePressed: boolean;
  isDragging: boolean;
  gridVisible: boolean;
  gridSizeMm: GridSizeMm;
  cursorPosMm: Point | null;

  // Actions
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  panBy: (deltaScreenPx: Point) => void;
  zoomAtPoint: (targetZoom: number, cursorScreenPx: Point) => void;
  setViewportSize: (width: number, height: number) => void;
  setActiveTool: (tool: ToolType) => void;
  setIsSpacePressed: (pressed: boolean) => void;
  setIsDragging: (dragging: boolean) => void;
  toggleGrid: () => void;
  setGridSizeMm: (size: GridSizeMm) => void;
  setCursorPosMm: (pos: Point | null) => void;
  fitToScreen: (pageWidthMm: number, pageHeightMm: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  zoom: 1.0,
  panX: 0,
  panY: 0,
  viewportWidth: 800,
  viewportHeight: 600,
  activeTool: 'select',
  isSpacePressed: false,
  isDragging: false,
  gridVisible: true,
  gridSizeMm: 10,
  cursorPosMm: null,

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),

  setPan: (panX, panY) => set({ panX, panY }),

  panBy: (delta) => {
    const current = get();
    const updated = calculatePan(current, delta);
    set({ panX: updated.panX, panY: updated.panY });
  },

  zoomAtPoint: (targetZoom, cursorScreenPx) => {
    const current = get();
    const updated = calculateZoomAtPoint(current, targetZoom, cursorScreenPx);
    set({ zoom: updated.zoom, panX: updated.panX, panY: updated.panY });
  },

  setViewportSize: (width, height) => set({ viewportWidth: width, viewportHeight: height }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setIsSpacePressed: (pressed) => set({ isSpacePressed: pressed }),

  setIsDragging: (dragging) => set({ isDragging: dragging }),

  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),

  setGridSizeMm: (size) => set({ gridSizeMm: size }),

  setCursorPosMm: (pos) => set({ cursorPosMm: pos }),

  fitToScreen: (pageWidthMm, pageHeightMm) => {
    const { viewportWidth, viewportHeight } = get();
    const fitted = calculateFitToScreen(pageWidthMm, pageHeightMm, viewportWidth, viewportHeight, 48);
    set({
      zoom: fitted.zoom,
      panX: fitted.panX,
      panY: fitted.panY,
    });
  },

  zoomIn: () => {
    const { zoom, viewportWidth, viewportHeight } = get();
    const center = { x: viewportWidth / 2, y: viewportHeight / 2 };
    get().zoomAtPoint(zoom * 1.25, center);
  },

  zoomOut: () => {
    const { zoom, viewportWidth, viewportHeight } = get();
    const center = { x: viewportWidth / 2, y: viewportHeight / 2 };
    get().zoomAtPoint(zoom / 1.25, center);
  },

  resetZoom: () => {
    const { viewportWidth, viewportHeight } = get();
    const center = { x: viewportWidth / 2, y: viewportHeight / 2 };
    get().zoomAtPoint(1.0, center);
  },
}));
