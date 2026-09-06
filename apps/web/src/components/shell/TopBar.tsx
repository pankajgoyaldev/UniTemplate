import React from 'react';
import {
  MousePointer,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore.js';
import { useTemplateStore } from '../../store/useTemplateStore.js';

export const TopBar: React.FC = () => {
  const zoom = useUIStore((s) => s.zoom);
  const activeTool = useUIStore((s) => s.activeTool);
  const gridVisible = useUIStore((s) => s.gridVisible);
  const gridSizeMm = useUIStore((s) => s.gridSizeMm);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const zoomIn = useUIStore((s) => s.zoomIn);
  const zoomOut = useUIStore((s) => s.zoomOut);
  const resetZoom = useUIStore((s) => s.resetZoom);
  const toggleGrid = useUIStore((s) => s.toggleGrid);
  const setGridSizeMm = useUIStore((s) => s.setGridSizeMm);
  const fitToScreen = useUIStore((s) => s.fitToScreen);

  const pageSettings = useTemplateStore((s) => s.template.pageSettings);
  const title = useTemplateStore((s) => s.template.metadata.title);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <header className="h-12 w-full bg-studio-panel border-b border-studio-border flex items-center justify-between px-4 select-none z-30">
      {/* Brand & Document Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-xs text-white shadow-sm">
            U
          </div>
          <span className="font-semibold text-sm tracking-tight text-studio-text">
            Universe Studio
          </span>
        </div>
        <span className="text-studio-muted text-xs">/</span>
        <span className="text-xs font-medium text-studio-muted hover:text-studio-text transition-colors cursor-pointer">
          {title}
        </span>
      </div>

      {/* Tool Selector */}
      <div className="flex items-center bg-studio-bg border border-studio-border rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => setActiveTool('select')}
          className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
            activeTool === 'select'
              ? 'bg-blue-600 text-white font-medium shadow-sm'
              : 'text-studio-muted hover:text-studio-text hover:bg-studio-panel'
          }`}
          title="Select Tool (V)"
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span>Select</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('hand')}
          className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
            activeTool === 'hand'
              ? 'bg-blue-600 text-white font-medium shadow-sm'
              : 'text-studio-muted hover:text-studio-text hover:bg-studio-panel'
          }`}
          title="Hand Tool (H or hold Spacebar)"
        >
          <Hand className="w-3.5 h-3.5" />
          <span>Hand</span>
        </button>
      </div>

      {/* Viewport & Zoom Controls */}
      <div className="flex items-center gap-3">
        {/* Grid Controls */}
        <div className="flex items-center gap-1 bg-studio-bg border border-studio-border rounded-md px-1 py-0.5">
          <button
            type="button"
            onClick={toggleGrid}
            className={`p-1 rounded text-xs transition-colors ${
              gridVisible
                ? 'text-blue-400 hover:text-blue-300'
                : 'text-studio-muted hover:text-studio-text'
            }`}
            title={`Toggle Grid (${gridVisible ? 'Visible' : 'Hidden'})`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
          {gridVisible && (
            <select
              value={gridSizeMm}
              onChange={(e) => setGridSizeMm(Number(e.target.value) as 5 | 10)}
              className="bg-transparent text-[11px] text-studio-muted hover:text-studio-text font-mono border-none outline-none cursor-pointer pr-1"
              title="Grid Spacing"
            >
              <option value="5" className="bg-studio-panel text-studio-text">5 mm</option>
              <option value="10" className="bg-studio-panel text-studio-text">10 mm</option>
            </select>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-studio-bg border border-studio-border rounded-md p-0.5">
          <button
            type="button"
            onClick={zoomOut}
            className="p-1 text-studio-muted hover:text-studio-text rounded hover:bg-studio-panel transition-colors"
            title="Zoom Out (Ctrl -)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={resetZoom}
            className="px-2 py-0.5 text-xs font-mono text-studio-text hover:bg-studio-panel rounded transition-colors"
            title="Click to reset to 100%"
          >
            {zoomPercent}%
          </button>

          <button
            type="button"
            onClick={zoomIn}
            className="p-1 text-studio-muted hover:text-studio-text rounded hover:bg-studio-panel transition-colors"
            title="Zoom In (Ctrl +)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3.5 bg-studio-border mx-0.5" />

          <button
            type="button"
            onClick={() => fitToScreen(pageSettings.width, pageSettings.height)}
            className="p-1 text-studio-muted hover:text-studio-text rounded hover:bg-studio-panel transition-colors"
            title="Fit Page to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

