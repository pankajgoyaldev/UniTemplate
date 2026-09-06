import React from 'react';
import type { ElementBounds, AlignmentType } from '@uts/canvas-engine';
import { calculateElementPageAlignment, clampBoundsToPage } from '@uts/canvas-engine';
import { InspectorSection } from './InspectorSection.js';
import { NumericInput } from './NumericInput.js';

export interface PositionSectionProps {
  bounds: ElementBounds;
  isLocked?: boolean;
  disabled?: boolean;
  pageWidth: number;
  pageHeight: number;
  onChange: (bounds: ElementBounds) => void;
}

export const PositionSection: React.FC<PositionSectionProps> = ({
  bounds,
  isLocked = false,
  disabled = false,
  pageWidth,
  pageHeight,
  onChange,
}) => {
  const isEffectiveDisabled = isLocked || disabled;

  const handleUpdate = (field: keyof ElementBounds, value: number) => {
    if (isEffectiveDisabled) return;
    const updated: ElementBounds = {
      ...bounds,
      [field]: value,
    };
    // Clamp to page boundaries and enforce positive dimensions
    const clamped = clampBoundsToPage(updated, pageWidth, pageHeight);
    onChange(clamped);
  };

  const handleAlign = (alignment: AlignmentType) => {
    if (isEffectiveDisabled) return;
    const aligned = calculateElementPageAlignment(bounds, alignment, pageWidth, pageHeight);
    onChange(aligned);
  };

  return (
    <InspectorSection title="Position & Size">
      {/* 6 Page-Alignment Quick Controls */}
      <div className="mb-2">
        <div className="text-[10px] uppercase font-semibold text-studio-muted mb-1 select-none">
          Align to Page
        </div>
        <div className="grid grid-cols-6 gap-1 bg-zinc-950/60 p-1 rounded border border-studio-border/60">
          {/* Left */}
          <button
            type="button"
            disabled={isEffectiveDisabled}
            onClick={() => handleAlign('align-left')}
            title="Align Left"
            className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
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
            disabled={isEffectiveDisabled}
            onClick={() => handleAlign('align-center-h')}
            title="Align Center Horizontally"
            className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
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
            disabled={isEffectiveDisabled}
            onClick={() => handleAlign('align-right')}
            title="Align Right"
            className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
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
            disabled={isEffectiveDisabled}
            onClick={() => handleAlign('align-top')}
            title="Align Top"
            className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
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
            disabled={isEffectiveDisabled}
            onClick={() => handleAlign('align-middle-v')}
            title="Align Middle Vertically"
            className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
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
            disabled={isEffectiveDisabled}
            onClick={() => handleAlign('align-bottom')}
            title="Align Bottom"
            className="p-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="2" y1="20" x2="22" y2="20" strokeWidth={2.5} />
              <rect x="5" y="4" width="5" height="13" rx="1" fill="currentColor" fillOpacity={0.2} />
              <rect x="14" y="8" width="5" height="9" rx="1" fill="currentColor" fillOpacity={0.2} />
            </svg>
          </button>
        </div>
      </div>

      {/* Coordinate & Size Inputs */}
      <div className="grid grid-cols-2 gap-2">
        <NumericInput
          label="X"
          unit="mm"
          value={bounds.x}
          disabled={isEffectiveDisabled}
          step={1}
          onChange={(v) => handleUpdate('x', v)}
        />
        <NumericInput
          label="Y"
          unit="mm"
          value={bounds.y}
          disabled={isEffectiveDisabled}
          step={1}
          onChange={(v) => handleUpdate('y', v)}
        />
        <NumericInput
          label="W"
          unit="mm"
          min={0.1}
          value={bounds.width}
          disabled={isEffectiveDisabled}
          step={1}
          onChange={(v) => handleUpdate('width', v)}
        />
        <NumericInput
          label="H"
          unit="mm"
          min={0}
          value={bounds.height}
          disabled={isEffectiveDisabled}
          step={1}
          onChange={(v) => handleUpdate('height', v)}
        />
      </div>

      {/* Rotation Input */}
      <div className="pt-1">
        <NumericInput
          label="R"
          unit="°"
          min={0}
          max={359.9}
          value={bounds.rotation ?? 0}
          disabled={isEffectiveDisabled}
          step={1}
          precision={1}
          onChange={(v) => handleUpdate('rotation', v)}
        />
      </div>
    </InspectorSection>
  );
};

