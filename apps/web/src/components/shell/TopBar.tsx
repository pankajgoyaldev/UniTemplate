import React from 'react';
import {
  MousePointer,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Magnet,
  Undo2,
  Redo2,
  FilePlus,
  FolderOpen,
  Save,
  Download,
  Image as ImageIcon,
  Database,
  Table as TableIcon,
  Eye,
  Pencil,
  X,
} from 'lucide-react';
import { useRecoveryStore } from '../../store/recovery/useRecoveryStore.js';
import { useUIStore } from '../../store/useUIStore.js';
import { useTemplateStore } from '../../store/useTemplateStore.js';
import { useDataSourceStore } from '../../store/dataSource/useDataSourceStore.js';
import { useHistoryStore } from '../../store/history/useHistoryStore.js';
import { useDocumentStore } from '../../store/document/useDocumentStore.js';
import {
  executeNewTemplate,
  executeOpenTemplate,
  executeSaveTemplate,
  executeSaveTemplateAs,
} from '../../operations/documentOperations.js';
import {
  importBackgroundImage,
  SUPPORTED_BACKGROUND_EXTENSIONS,
} from '../../operations/backgroundOperations.js';
import { TopBarFilename } from './TopBarFilename.js';

export const TopBar: React.FC = () => {
  const zoom = useUIStore((s) => s.zoom);
  const activeTool = useUIStore((s) => s.activeTool);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const setVariablesModalOpen = useUIStore((s) => s.setVariablesModalOpen);
  const setDataSourceModalOpen = useUIStore((s) => s.setDataSourceModalOpen);
  const gridVisible = useUIStore((s) => s.gridVisible);
  const gridSizeMm = useUIStore((s) => s.gridSizeMm);
  const snapToGrid = useUIStore((s) => s.snapToGrid);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const zoomIn = useUIStore((s) => s.zoomIn);
  const zoomOut = useUIStore((s) => s.zoomOut);
  const resetZoom = useUIStore((s) => s.resetZoom);
  const toggleGrid = useUIStore((s) => s.toggleGrid);
  const toggleSnapToGrid = useUIStore((s) => s.toggleSnapToGrid);
  const setGridSizeMm = useUIStore((s) => s.setGridSizeMm);
  const fitToScreen = useUIStore((s) => s.fitToScreen);

  const pageSettings = useTemplateStore((s) => s.template.pageSettings);
  const fields = useTemplateStore((s) => s.template.dataSchema?.fields || []);
  const dataSource = useDataSourceStore((s) => s.dataSource);

  const isOperationInProgress = useDocumentStore((s) => s.isOperationInProgress);

  const recoveryMessage = useRecoveryStore((s) => s.recoveryMessage);
  const dismissRecoveryMessage = useRecoveryStore((s) => s.dismissRecoveryMessage);

  React.useEffect(() => {
    if (recoveryMessage) {
      const timer = setTimeout(() => {
        dismissRecoveryMessage();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [recoveryMessage, dismissRecoveryMessage]);

  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  const bgInputRef = React.useRef<HTMLInputElement>(null);
  const handleBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importBackgroundImage(file);
    }
    if (bgInputRef.current) {
      bgInputRef.current.value = '';
    }
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <header className="h-12 w-full bg-studio-panel border-b border-studio-border flex items-center justify-between px-4 select-none z-30">
      {/* Brand & Document Name Breadcrumb (Flexible, responsive with ellipsis) */}
      <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-2.5 mr-2 sm:mr-3 overflow-hidden">
        {/* Application Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0">
            U
          </div>
          <span className="font-semibold text-sm tracking-tight text-studio-text whitespace-nowrap hidden sm:inline">
            UniTemplate
          </span>
        </div>

        {/* Clean Breadcrumb Separator */}
        <span className="text-studio-muted/60 text-xs shrink-0 select-none hidden sm:inline">/</span>

        {/* Responsive Filename Dropdown & Details Popover */}
        <TopBarFilename />
      </div>

        {recoveryMessage && (
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-sans bg-blue-900/30 text-blue-300 border border-blue-500/30"
            title="Session was restored from local recovery storage"
          >
            <span>{recoveryMessage}</span>
            <button
              type="button"
              onClick={dismissRecoveryMessage}
              className="text-blue-400 hover:text-white ml-0.5"
              title="Dismiss notification"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Center Group: File Operations, Undo/Redo & Tool Selector */}
      <div className="flex items-center gap-2">
        {/* File Actions */}
        <div className="flex items-center bg-studio-bg border border-studio-border rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => executeNewTemplate()}
            disabled={isOperationInProgress}
            className="px-2 py-1 rounded text-xs flex items-center gap-1.5 text-studio-muted hover:text-studio-text hover:bg-studio-panel transition-colors disabled:opacity-40"
            title="New Template (Ctrl+N / Cmd+N)"
            aria-label="New Template"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">New</span>
          </button>
          <button
            type="button"
            onClick={() => void executeOpenTemplate()}
            disabled={isOperationInProgress}
            className="px-2 py-1 rounded text-xs flex items-center gap-1.5 text-studio-muted hover:text-studio-text hover:bg-studio-panel transition-colors disabled:opacity-40"
            title="Open .uts Template (Ctrl+O / Cmd+O)"
            aria-label="Open Template"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Open</span>
          </button>
          <button
            type="button"
            onClick={() => void executeSaveTemplate()}
            disabled={isOperationInProgress}
            className="px-2 py-1 rounded text-xs flex items-center gap-1.5 text-studio-muted hover:text-studio-text hover:bg-studio-panel transition-colors disabled:opacity-40"
            title="Save (Ctrl+S / Cmd+S)"
            aria-label="Save Template"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Save</span>
          </button>
          <button
            type="button"
            onClick={() => void executeSaveTemplateAs()}
            disabled={isOperationInProgress}
            className="px-2 py-1 rounded text-xs flex items-center gap-1.5 text-studio-muted hover:text-studio-text hover:bg-studio-panel transition-colors disabled:opacity-40"
            title="Save As .uts (Ctrl+Shift+S / Cmd+Shift+S)"
            aria-label="Save Template As"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Save As</span>
          </button>
          <button
            type="button"
            onClick={() => bgInputRef.current?.click()}
            disabled={isOperationInProgress}
            className="px-2 py-1 rounded text-xs flex items-center gap-1.5 text-studio-muted hover:text-studio-text hover:bg-studio-panel transition-colors disabled:opacity-40"
            title="Import Background Image (PNG, JPG, WebP, SVG)"
            aria-label="Import Background"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Background</span>
          </button>
          <button
            type="button"
            onClick={() => setVariablesModalOpen(true)}
            disabled={isOperationInProgress}
            className="px-2 py-1 rounded text-xs flex items-center gap-1.5 text-studio-muted hover:text-studio-text hover:bg-studio-panel transition-colors disabled:opacity-40"
            title="Manage Template Variables"
            aria-label="Template Variables"
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden xl:inline">Variables</span>
            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              {fields.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDataSourceModalOpen(true)}
            disabled={isOperationInProgress}
            className="px-2 py-1 rounded text-xs flex items-center gap-1.5 text-studio-muted hover:text-studio-text hover:bg-studio-panel transition-colors disabled:opacity-40"
            title="Import & Inspect Data Source (CSV / Excel)"
            aria-label="Data Source"
          >
            <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xl:inline">Data</span>
            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              {dataSource ? `${dataSource.rowCount}` : '0'}
            </span>
          </button>
          <input
            ref={bgInputRef}
            type="file"
            accept={SUPPORTED_BACKGROUND_EXTENSIONS.join(',') + ',image/png,image/jpeg,image/webp,image/svg+xml'}
            className="hidden"
            onChange={handleBgFileChange}
          />
        </div>
        {/* Undo / Redo Controls */}
        <div className="flex items-center bg-studio-bg border border-studio-border rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => undo()}
            disabled={!canUndo}
            className="px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors text-studio-muted hover:text-studio-text hover:bg-studio-panel disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-studio-muted disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z / Cmd+Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Undo</span>
          </button>
          <button
            type="button"
            onClick={() => redo()}
            disabled={!canRedo}
            className="px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors text-studio-muted hover:text-studio-text hover:bg-studio-panel disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-studio-muted disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Redo</span>
          </button>
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

        {/* View Mode: Design vs Preview */}
        <div className="flex items-center bg-studio-bg border border-studio-border rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('design')}
            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
              viewMode === 'design'
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-studio-muted hover:text-studio-text hover:bg-studio-panel'
            }`}
            title="Design View (Shows template structure and tokens)"
            aria-label="Design View"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Design</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
              viewMode === 'preview'
                ? 'bg-emerald-600 text-white font-medium shadow-sm'
                : 'text-studio-muted hover:text-studio-text hover:bg-studio-panel'
            }`}
            title="Preview View (Renders live sample data from mock payload)"
            aria-label="Preview View"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
        </div>
      </div>


      {/* Viewport & Zoom Controls */}
      <div className="flex items-center gap-3">
        {/* Grid & Snap Controls */}
        <div className="flex items-center gap-1 bg-studio-bg border border-studio-border rounded-md px-1 py-0.5">
          <button
            type="button"
            onClick={toggleGrid}
            className={`p-1 rounded text-xs transition-colors ${
              gridVisible
                ? 'text-blue-400 hover:text-blue-300'
                : 'text-studio-muted hover:text-studio-text'
            }`}
            title={`Toggle Grid Lines (${gridVisible ? 'Visible' : 'Hidden'})`}
            aria-label="Toggle Grid Lines"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Snap to Grid Toggle */}
          <button
            type="button"
            onClick={toggleSnapToGrid}
            className={`px-1.5 py-0.5 rounded text-xs flex items-center gap-1 transition-colors ${
              snapToGrid
                ? 'bg-blue-600/30 text-blue-400 font-medium'
                : 'text-studio-muted hover:text-studio-text'
            }`}
            title={`Snap to Grid (${snapToGrid ? 'ON' : 'OFF'} — Hold Alt or Ctrl while dragging to temporarily bypass)`}
            aria-label="Toggle Snap to Grid"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Snap</span>
          </button>

          <select
            value={gridSizeMm}
            onChange={(e) => setGridSizeMm(Number(e.target.value) as 5 | 10)}
            className="bg-transparent text-[11px] text-studio-muted hover:text-studio-text font-mono border-none outline-none cursor-pointer pr-1"
            title="Grid Spacing"
          >
            <option value="5" className="bg-studio-panel text-studio-text">5 mm</option>
            <option value="10" className="bg-studio-panel text-studio-text">10 mm</option>
          </select>
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

