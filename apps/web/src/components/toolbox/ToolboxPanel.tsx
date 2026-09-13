import React from 'react';
import {
  Type,
  Square,
  RectangleHorizontal,
  Circle,
  Minus,
  Barcode,
  QrCode,
  Image as ImageIcon,
} from 'lucide-react';
import { useTemplateStore } from '../../store/useTemplateStore.js';
import { useUIStore } from '../../store/useUIStore.js';
import {
  createElementFromTemplate,
  type InsertableElementType,
} from './elementTemplates.js';

interface ToolItem {
  type: InsertableElementType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'text' | 'shape' | 'code' | 'media';
}

const TOOLS: ToolItem[] = [
  { type: 'text', label: 'Text Box', icon: Type, group: 'text' },
  { type: 'rectangle', label: 'Rectangle', icon: Square, group: 'shape' },
  {
    type: 'rounded-rectangle',
    label: 'Rounded Rectangle',
    icon: RectangleHorizontal,
    group: 'shape',
  },
  { type: 'ellipse', label: 'Ellipse / Circle', icon: Circle, group: 'shape' },
  { type: 'line', label: 'Horizontal Line', icon: Minus, group: 'shape' },
  { type: 'barcode', label: 'Barcode (Code 128)', icon: Barcode, group: 'code' },
  { type: 'qr', label: 'QR Code', icon: QrCode, group: 'code' },
  { type: 'image', label: 'Image (Placeholder)', icon: ImageIcon, group: 'media' },
];

export interface ToolboxPanelProps {
  width?: number;
}

export const ToolboxPanel: React.FC<ToolboxPanelProps> = ({ width }) => {
  const storeWidth = useUIStore((s) => s.toolboxWidth);
  const effectiveWidth = width ?? storeWidth ?? 72;
  const isCompact = effectiveWidth < 160;

  const addElement = useTemplateStore((s) => s.addElement);
  const pageSettings = useTemplateStore((s) => s.template.pageSettings);
  const elements = useTemplateStore((s) => s.template.elements);

  const selectElement = useUIStore((s) => s.selectElement);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const zoom = useUIStore((s) => s.zoom);
  const panX = useUIStore((s) => s.panX);
  const panY = useUIStore((s) => s.panY);
  const viewportWidth = useUIStore((s) => s.viewportWidth);
  const viewportHeight = useUIStore((s) => s.viewportHeight);
  const snapToGrid = useUIStore((s) => s.snapToGrid);
  const gridSizeMm = useUIStore((s) => s.gridSizeMm);

  const handleInsert = (toolType: InsertableElementType) => {
    const newElement = createElementFromTemplate(toolType, {
      pageSettings,
      viewport: {
        zoom,
        panX,
        panY,
        viewportWidth,
        viewportHeight,
      },
      existingElements: elements,
      snapToGrid,
      gridSizeMm,
    });

    // 1. Add element to store (participates in history + dirty state + session recovery)
    addElement(newElement);

    // 2. Select newly created element so handles appear and inspector activates
    selectElement(newElement.id, false);

    // 3. Ensure Select tool is active for immediate manipulation
    setActiveTool('select');
  };

  return (
    <aside
      style={{ width: effectiveWidth }}
      className="shrink-0 bg-studio-panel border-r border-studio-border flex flex-col h-full overflow-hidden select-none z-20"
      aria-label="Toolbox"
    >
      {/* Header */}
      {isCompact ? (
        <div className="py-2.5 flex justify-center border-b border-studio-border/60 shrink-0">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-studio-muted/70">
            Tools
          </span>
        </div>
      ) : (
        <div className="px-3.5 py-3 border-b border-studio-border/60 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-studio-muted font-mono">
            Toolbox
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            {TOOLS.length} items
          </span>
        </div>
      )}

      {/* Tool List */}
      <div className={`flex-1 overflow-x-hidden overflow-y-auto ${isCompact ? 'flex flex-col items-center py-2 gap-1' : 'p-2 space-y-1'}`}>
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          const prevTool = TOOLS[index - 1];
          const isNewGroup = prevTool && prevTool.group !== tool.group;

          if (isCompact) {
            return (
              <React.Fragment key={tool.type}>
                {isNewGroup && (
                  <div className="w-8 h-px bg-studio-border/60 my-1.5" />
                )}
                <button
                  type="button"
                  onClick={() => handleInsert(tool.type)}
                  title={`Insert ${tool.label}`}
                  aria-label={`Insert ${tool.label}`}
                  className="w-10 h-10 rounded-lg flex flex-col items-center justify-center text-studio-muted hover:text-studio-text hover:bg-studio-bg border border-transparent hover:border-studio-border transition-all active:scale-95 group relative"
                >
                  <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                </button>
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={tool.type}>
              {isNewGroup && (
                <div className="my-2 border-t border-studio-border/40" />
              )}
              <button
                type="button"
                onClick={() => handleInsert(tool.type)}
                title={`Insert ${tool.label}`}
                aria-label={`Insert ${tool.label}`}
                className="w-full px-2.5 py-2 rounded-lg flex items-center gap-3 text-studio-muted hover:text-studio-text hover:bg-studio-bg border border-transparent hover:border-studio-border/80 transition-all active:scale-[0.98] group text-xs text-left"
              >
                <div className="w-7 h-7 rounded bg-zinc-900 border border-studio-border/60 flex items-center justify-center shrink-0 group-hover:border-studio-border group-hover:text-blue-400 transition-colors shadow-sm">
                  <Icon className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium truncate text-studio-text group-hover:text-white transition-colors text-xs">
                    {tool.label}
                  </span>
                  <span className="text-[10px] text-studio-muted/70 capitalize truncate">
                    {tool.group}
                  </span>
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </aside>
  );
};

