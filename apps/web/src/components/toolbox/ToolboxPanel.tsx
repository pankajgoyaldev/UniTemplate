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

export const ToolboxPanel: React.FC = () => {
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
      className="w-14 shrink-0 bg-studio-panel border-r border-studio-border flex flex-col items-center py-3 gap-1 select-none z-20"
      aria-label="Toolbox"
    >
      <div className="text-[9px] font-semibold uppercase tracking-wider text-studio-muted/70 mb-1">
        Tools
      </div>

      {TOOLS.map((tool, index) => {
        const Icon = tool.icon;
        const prevTool = TOOLS[index - 1];
        const isNewGroup = prevTool && prevTool.group !== tool.group;

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
      })}
    </aside>
  );
};

