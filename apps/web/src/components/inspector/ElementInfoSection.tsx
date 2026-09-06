import React from 'react';
import type { TemplateElement } from '@uts/core';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { InspectorSection } from './InspectorSection.js';

export interface ElementInfoSectionProps {
  element: TemplateElement;
  onUpdateName: (name: string) => void;
  onToggleLock: () => void;
  onToggleVisibility: () => void;
}

export const ElementInfoSection: React.FC<ElementInfoSectionProps> = ({
  element,
  onUpdateName,
  onToggleLock,
  onToggleVisibility,
}) => {
  return (
    <InspectorSection
      title="Element Info"
      action={
        <div className="flex items-center gap-1">
          {/* Lock / Unlock Toggle */}
          <button
            type="button"
            onClick={onToggleLock}
            title={element.isLocked ? 'Unlock Element' : 'Lock Element'}
            className={`p-1 rounded transition-colors ${
              element.isLocked
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {element.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>

          {/* Visibility Toggle */}
          <button
            type="button"
            disabled={element.isLocked}
            onClick={onToggleVisibility}
            title={element.isVisible ? 'Hide Element' : 'Show Element'}
            className={`p-1 rounded transition-colors ${
              !element.isVisible
                ? 'bg-zinc-800 text-zinc-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            } disabled:opacity-40`}
          >
            {element.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      }
    >
      {/* Name (Editable if unlocked) */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Name
        </span>
        <input
          type="text"
          disabled={element.isLocked}
          value={element.name}
          onChange={(e) => onUpdateName(e.target.value)}
          className="bg-zinc-900 border border-studio-border rounded px-2 py-1 text-studio-text text-xs focus:outline-none focus:border-blue-500 max-w-[160px] flex-1 disabled:opacity-40"
          placeholder="Element name..."
        />
      </div>

      {/* Type (Read-only) */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Type
        </span>
        <span className="px-2 py-0.5 rounded bg-zinc-800 border border-studio-border text-zinc-300 font-mono text-[11px] uppercase tracking-wider">
          {element.type}
        </span>
      </div>

      {/* Element ID (Read-only) */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          ID
        </span>
        <span
          className="text-zinc-500 font-mono text-[11px] truncate max-w-[160px]"
          title={element.id}
        >
          {element.id}
        </span>
      </div>

      {/* Z-Index (Read-only) */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Z-Index
        </span>
        <span className="font-mono text-zinc-400 text-xs">
          {element.zIndex}
        </span>
      </div>

      {/* Prominent Locked Warning when locked */}
      {element.isLocked && (
        <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs">
          <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>This element is locked. Unlock it to edit its properties.</span>
        </div>
      )}
    </InspectorSection>
  );
};

