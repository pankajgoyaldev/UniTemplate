import React from 'react';
import { useUIStore } from '../../store/useUIStore.js';
import { useTemplateStore } from '../../store/useTemplateStore.js';

export const StatusBar: React.FC = () => {
  const cursorPosMm = useUIStore((s) => s.cursorPosMm);
  const zoom = useUIStore((s) => s.zoom);
  const pageSettings = useTemplateStore((s) => s.template.pageSettings);

  const isInsidePage =
    cursorPosMm &&
    cursorPosMm.x >= 0 &&
    cursorPosMm.x <= pageSettings.width &&
    cursorPosMm.y >= 0 &&
    cursorPosMm.y <= pageSettings.height;

  return (
    <footer className="h-6 w-full bg-studio-panel border-t border-studio-border flex items-center justify-between px-3 text-[11px] font-mono text-studio-muted select-none z-30">
      {/* Page Dimension Info */}
      <div className="flex items-center gap-3">
        <span className="text-studio-text">
          {pageSettings.width} × {pageSettings.height} {pageSettings.unit}
        </span>
        <span className="text-studio-border">|</span>
        <span className="capitalize">{pageSettings.orientation}</span>
        <span className="text-studio-border">|</span>
        <span>Margins: {pageSettings.margins.top}mm</span>
      </div>

      {/* Live Physical Millimeter Cursor Coordinates */}
      <div className="flex items-center gap-2">
        {cursorPosMm ? (
          <div className="flex items-center gap-3 font-semibold">
            <span className={isInsidePage ? 'text-blue-400' : 'text-studio-muted'}>
              X: {cursorPosMm.x.toFixed(2)} mm
            </span>
            <span className="text-studio-border">|</span>
            <span className={isInsidePage ? 'text-blue-400' : 'text-studio-muted'}>
              Y: {cursorPosMm.y.toFixed(2)} mm
            </span>
            {isInsidePage ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-900/40 text-blue-300 font-sans">
                On Page
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-sans">
                Canvas
              </span>
            )}
          </div>
        ) : (
          <span className="text-zinc-600">Pointer outside viewport</span>
        )}
      </div>

      {/* Target Resolution & Scale */}
      <div className="flex items-center gap-3">
        <span>Target: {pageSettings.targetDpi} DPI</span>
        <span className="text-studio-border">|</span>
        <span className="text-studio-text">{(zoom * 100).toFixed(0)}%</span>
      </div>
    </footer>
  );
};

