import React from 'react';
import { MousePointer, Lock, Trash2, Layers, Sliders, EyeOff } from 'lucide-react';
import { calculateMultiElementBoundingBox, calculateMultiElementMove, type ElementBounds } from '@uts/canvas-engine';
import { useUIStore } from '../../store/useUIStore.js';
import { useTemplateStore } from '../../store/useTemplateStore.js';
import { useHistoryStore } from '../../store/history/useHistoryStore.js';
import { ElementInfoSection } from './ElementInfoSection.js';
import { PositionSection } from './PositionSection.js';
import { AppearanceSection } from './AppearanceSection.js';
import { TypographySection } from './TypographySection.js';
import { InspectorSection } from './InspectorSection.js';
import { BackgroundSection } from './BackgroundSection.js';
import { VariablesSection } from './VariablesSection.js';
import { DataSourceSection } from './DataSourceSection.js';
import { PageSettingsSection } from './PageSettingsSection.js';

export interface InspectorPanelProps {
  width?: number;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ width }) => {
  const storeWidth = useUIStore((s) => s.inspectorWidth);
  const effectiveWidth = width ?? storeWidth ?? 320;

  const selectedElementIds = useUIStore((s) => s.selectedElementIds);
  const elements = useTemplateStore((s) => s.template.elements);
  const pageSettings = useTemplateStore((s) => s.template.pageSettings);

  const updateElement = useTemplateStore((s) => s.updateElement);
  const updateMultipleElementBounds = useTemplateStore((s) => s.updateMultipleElementBounds);
  const deleteElements = useTemplateStore((s) => s.deleteElements);
  const toggleElementLock = useTemplateStore((s) => s.toggleElementLock);
  const toggleElementVisibility = useTemplateStore((s) => s.toggleElementVisibility);

  // Filter selected elements that exist in current template
  const selectedElements = elements.filter((el) => selectedElementIds.includes(el.id));
  const selectionCount = selectedElements.length;

  return (
    <aside
      style={{ width: effectiveWidth }}
      className="shrink-0 bg-studio-panel border-l border-studio-border flex flex-col h-full overflow-y-auto select-none z-20"
    >
      {/* 0 Selected State */}
      {selectionCount === 0 && (
        <div className="flex flex-col h-full divide-y divide-studio-border/60">
          <VariablesSection />
          <DataSourceSection />
          <BackgroundSection />

          <PageSettingsSection />

          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-studio-muted">
            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-studio-border/60 flex items-center justify-center mb-2.5 text-zinc-500">
              <MousePointer className="w-4 h-4" />
            </div>
            <div className="text-xs font-medium text-studio-text mb-1">
              No Element Selected
            </div>
            <div className="text-[11px] text-zinc-400 max-w-[200px] leading-relaxed">
              Select an element on canvas to edit its properties, or add elements from the toolbox.
            </div>
          </div>
        </div>
      )}

      {/* Multiple Elements Selected State */}
      {selectionCount > 1 && (
        <div className="flex flex-col h-full">
          {/* Multi-Selection Header */}
          <div className="px-4 py-3 border-b border-studio-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-studio-text">
                {selectionCount} elements selected
              </span>
            </div>
            <button
              type="button"
              onClick={() => deleteElements(selectedElements.map((e) => e.id))}
              title="Delete Selected Elements"
              className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Group Bounding Box Summary */}
          {(() => {
            const groupBbox = calculateMultiElementBoundingBox(selectedElements);
            if (!groupBbox) return null;

            const allLocked = selectedElements.every((e) => e.isLocked);
            const someLockedOrHidden = selectedElements.some((e) => e.isLocked || !e.isVisible);

            return (
              <div className="divide-y divide-studio-border/60">
                <InspectorSection title="Group Geometry" badge="read-only">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between bg-zinc-900 px-2 py-1 rounded border border-studio-border">
                      <span className="text-studio-muted font-medium">X</span>
                      <span className="font-mono text-zinc-300">{groupBbox.x.toFixed(2)} mm</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-900 px-2 py-1 rounded border border-studio-border">
                      <span className="text-studio-muted font-medium">Y</span>
                      <span className="font-mono text-zinc-300">{groupBbox.y.toFixed(2)} mm</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-900 px-2 py-1 rounded border border-studio-border">
                      <span className="text-studio-muted font-medium">W</span>
                      <span className="font-mono text-zinc-300">{groupBbox.width.toFixed(2)} mm</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-900 px-2 py-1 rounded border border-studio-border">
                      <span className="text-studio-muted font-medium">H</span>
                      <span className="font-mono text-zinc-300">{groupBbox.height.toFixed(2)} mm</span>
                    </div>
                  </div>

                  {/* Group Page Alignment */}
                  <div className="mt-3">
                    <div className="text-[10px] uppercase font-semibold text-studio-muted mb-1">
                      Align Group to Page
                    </div>
                    <div className="grid grid-cols-6 gap-1 bg-zinc-950/60 p-1 rounded border border-studio-border/60">
                      {/* Left */}
                      <button
                        type="button"
                        disabled={someLockedOrHidden}
                        title="Align Group Left"
                        onClick={() => {
                          const deltaX = -groupBbox.x;
                          const moved = calculateMultiElementMove(
                            selectedElements.map((e) => ({ id: e.id, initialBounds: e.bounds })),
                            { x: deltaX, y: 0 },
                            pageSettings.width,
                            pageSettings.height,
                          );
                          updateMultipleElementBounds(moved);
                        }}
                        className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <line x1="4" y1="2" x2="4" y2="22" strokeWidth={2.5} />
                          <rect x="7" y="5" width="13" height="5" rx="1" fill="currentColor" fillOpacity={0.2} />
                          <rect x="7" y="14" width="9" height="5" rx="1" fill="currentColor" fillOpacity={0.2} />
                        </svg>
                      </button>

                      {/* Center H */}
                      <button
                        type="button"
                        disabled={someLockedOrHidden}
                        title="Align Group Center H"
                        onClick={() => {
                          const targetX = (pageSettings.width - groupBbox.width) / 2;
                          const deltaX = targetX - groupBbox.x;
                          const moved = calculateMultiElementMove(
                            selectedElements.map((e) => ({ id: e.id, initialBounds: e.bounds })),
                            { x: deltaX, y: 0 },
                            pageSettings.width,
                            pageSettings.height,
                          );
                          updateMultipleElementBounds(moved);
                        }}
                        className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <line x1="12" y1="2" x2="12" y2="22" strokeWidth={2.5} />
                          <rect x="5" y="5" width="14" height="5" rx="1" fill="currentColor" fillOpacity={0.2} />
                          <rect x="7" y="14" width="10" height="5" rx="1" fill="currentColor" fillOpacity={0.2} />
                        </svg>
                      </button>

                      {/* Right */}
                      <button
                        type="button"
                        disabled={someLockedOrHidden}
                        title="Align Group Right"
                        onClick={() => {
                          const targetX = pageSettings.width - groupBbox.width;
                          const deltaX = targetX - groupBbox.x;
                          const moved = calculateMultiElementMove(
                            selectedElements.map((e) => ({ id: e.id, initialBounds: e.bounds })),
                            { x: deltaX, y: 0 },
                            pageSettings.width,
                            pageSettings.height,
                          );
                          updateMultipleElementBounds(moved);
                        }}
                        className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <line x1="20" y1="2" x2="20" y2="22" strokeWidth={2.5} />
                          <rect x="4" y="5" width="13" height="5" rx="1" fill="currentColor" fillOpacity={0.2} />
                          <rect x="8" y="14" width="9" height="5" rx="1" fill="currentColor" fillOpacity={0.2} />
                        </svg>
                      </button>

                      {/* Top */}
                      <button
                        type="button"
                        disabled={someLockedOrHidden}
                        title="Align Group Top"
                        onClick={() => {
                          const deltaY = -groupBbox.y;
                          const moved = calculateMultiElementMove(
                            selectedElements.map((e) => ({ id: e.id, initialBounds: e.bounds })),
                            { x: 0, y: deltaY },
                            pageSettings.width,
                            pageSettings.height,
                          );
                          updateMultipleElementBounds(moved);
                        }}
                        className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <line x1="2" y1="4" x2="22" y2="4" strokeWidth={2.5} />
                          <rect x="5" y="7" width="5" height="13" rx="1" fill="currentColor" fillOpacity={0.2} />
                          <rect x="14" y="7" width="5" height="9" rx="1" fill="currentColor" fillOpacity={0.2} />
                        </svg>
                      </button>

                      {/* Middle V */}
                      <button
                        type="button"
                        disabled={someLockedOrHidden}
                        title="Align Group Middle V"
                        onClick={() => {
                          const targetY = (pageSettings.height - groupBbox.height) / 2;
                          const deltaY = targetY - groupBbox.y;
                          const moved = calculateMultiElementMove(
                            selectedElements.map((e) => ({ id: e.id, initialBounds: e.bounds })),
                            { x: 0, y: deltaY },
                            pageSettings.width,
                            pageSettings.height,
                          );
                          updateMultipleElementBounds(moved);
                        }}
                        className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <line x1="2" y1="12" x2="22" y2="12" strokeWidth={2.5} />
                          <rect x="5" y="5" width="5" height="14" rx="1" fill="currentColor" fillOpacity={0.2} />
                          <rect x="14" y="7" width="5" height="10" rx="1" fill="currentColor" fillOpacity={0.2} />
                        </svg>
                      </button>

                      {/* Bottom */}
                      <button
                        type="button"
                        disabled={someLockedOrHidden}
                        title="Align Group Bottom"
                        onClick={() => {
                          const targetY = pageSettings.height - groupBbox.height;
                          const deltaY = targetY - groupBbox.y;
                          const moved = calculateMultiElementMove(
                            selectedElements.map((e) => ({ id: e.id, initialBounds: e.bounds })),
                            { x: 0, y: deltaY },
                            pageSettings.width,
                            pageSettings.height,
                          );
                          updateMultipleElementBounds(moved);
                        }}
                        className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <line x1="2" y1="20" x2="22" y2="20" strokeWidth={2.5} />
                          <rect x="5" y="4" width="5" height="13" rx="1" fill="currentColor" fillOpacity={0.2} />
                          <rect x="14" y="8" width="5" height="9" rx="1" fill="currentColor" fillOpacity={0.2} />
                        </svg>
                      </button>
                    </div>
                  </div>
                </InspectorSection>

                {/* Batch Lock & Visibility */}
                <div className="p-3 space-y-2">
                  <div className="text-[10px] uppercase font-semibold text-studio-muted">
                    Batch Actions
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        useHistoryStore.getState().beginHistoryTransaction();
                        selectedElements.forEach((el) => {
                          if (allLocked ? el.isLocked : !el.isLocked) {
                            toggleElementLock(el.id);
                          }
                        });
                        useHistoryStore.getState().commitHistoryTransaction();
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-zinc-900 border border-studio-border text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{allLocked ? 'Unlock All' : 'Lock All'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Single Element Selected State */}
      {selectionCount === 1 && (() => {
        const element = selectedElements[0];
        const isEditable = !element.isLocked && element.isVisible;
        const isDisabled = !isEditable;

        return (
          <div className="flex flex-col divide-y divide-studio-border/60 pb-8">
            {/* Header */}
            <div className="px-3 py-2.5 bg-zinc-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <Sliders className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-semibold text-studio-text truncate">
                  {element.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!element.isVisible && (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                    <EyeOff className="w-2.5 h-2.5" />
                    Hidden
                  </span>
                )}
                {element.isLocked && (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Lock className="w-2.5 h-2.5" />
                    Locked
                  </span>
                )}
              </div>
            </div>

            {/* 1. Element Info */}
            <ElementInfoSection
              element={element}
              disabled={isDisabled}
              onUpdateName={(name) => updateElement(element.id, { name })}
              onToggleLock={() => toggleElementLock(element.id)}
              onToggleVisibility={() => toggleElementVisibility(element.id)}
            />

            {/* 2. Position & Size */}
            <PositionSection
              bounds={element.bounds}
              isLocked={isDisabled}
              disabled={isDisabled}
              pageWidth={pageSettings.width}
              pageHeight={pageSettings.height}
              onChange={(bounds: ElementBounds) => updateElement(element.id, { bounds })}
            />

            {/* 3. Typography (Only for text elements) */}
            {element.type === 'text' && (
              <TypographySection
                element={element}
                disabled={isDisabled}
                onUpdate={(patch) => updateElement(element.id, patch)}
              />
            )}

            {/* 4. Appearance (Shapes, Images, Barcodes) */}
            {(element.type === 'shape' || element.type === 'image' || element.type === 'barcode') && (
              <AppearanceSection
                element={element}
                disabled={isDisabled}
                onUpdate={(patch) => updateElement(element.id, patch)}
              />
            )}
          </div>
        );
      })()}
    </aside>
  );
};

