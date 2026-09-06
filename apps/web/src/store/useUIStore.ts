import { create } from 'zustand';
import {
  clampZoom,
  calculateZoomAtPoint,
  calculatePan,
  calculateFitToScreen,
  type Point,
  type ViewportState,
  type GridSizeMm,
  type ResizeHandleType,
} from '@uts/canvas-engine';

export type ToolType = 'select' | 'hand';

interface UIState extends ViewportState {
  activeTool: ToolType;
  isSpacePressed: boolean;
  isDragging: boolean;
  gridVisible: boolean;
  gridSizeMm: GridSizeMm;
  snapToGrid: boolean;
  cursorPosMm: Point | null;

  // Selection & Manipulation State
  selectedElementIds: string[];
  activeHandle: ResizeHandleType | null;
  isDraggingElement: boolean;
  isResizingElement: boolean;

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
  toggleSnapToGrid: () => void;
  setSnapToGrid: (snap: boolean) => void;
  setCursorPosMm: (pos: Point | null) => void;
  fitToScreen: (pageWidthMm: number, pageHeightMm: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  // Selection Actions
  selectElement: (id: string, multi?: boolean) => void;
  selectElements: (ids: string[]) => void;
  clearSelection: () => void;
  toggleElementSelection: (id: string) => void;
  setActiveHandle: (handle: ResizeHandleType | null) => void;
  setIsDraggingElement: (dragging: boolean) => void;
  setIsResizingElement: (resizing: boolean) => void;
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
  snapToGrid: true,
  cursorPosMm: null,

  selectedElementIds: [],
  activeHandle: null,
  isDraggingElement: false,
  isResizingElement: false,

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

  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

  setSnapToGrid: (snap) => set({ snapToGrid: snap }),

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

  selectElement: (id, multi = false) => {
    if (multi) {
      const current = get().selectedElementIds;
      if (current.includes(id)) {
        set({ selectedElementIds: current.filter((item) => item !== id) });
      } else {
        set({ selectedElementIds: [...current, id] });
      }
    } else {
      set({ selectedElementIds: [id] });
    }
  },

  selectElements: (ids) => set({ selectedElementIds: ids }),

  clearSelection: () => set({ selectedElementIds: [], activeHandle: null }),

  toggleElementSelection: (id) => {
    const current = get().selectedElementIds;
    if (current.includes(id)) {
      set({ selectedElementIds: current.filter((item) => item !== id) });
    } else {
      set({ selectedElementIds: [...current, id] });
    }
  },

  setActiveHandle: (handle) => set({ activeHandle: handle }),

  setIsDraggingElement: (dragging) => set({ isDraggingElement: dragging }),

  setIsResizingElement: (resizing) => set({ isResizingElement: resizing }),
}));

