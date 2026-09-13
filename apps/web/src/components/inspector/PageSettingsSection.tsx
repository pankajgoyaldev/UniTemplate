import React from 'react';
import { PAGE_SIZE_PRESETS, getPageSizePresetId, type PageSizePreset } from '@uts/core';
import { useTemplateStore } from '../../store/useTemplateStore.js';
import { InspectorSection } from './InspectorSection.js';
import { NumericInput } from './NumericInput.js';

export const PageSettingsSection: React.FC = () => {
  const pageSettings = useTemplateStore((s) => s.template.pageSettings);
  const elementsCount = useTemplateStore((s) => s.template.elements.length);
  const updatePageSettings = useTemplateStore((s) => s.updatePageSettings);

  const currentPresetId = getPageSizePresetId(pageSettings.width, pageSettings.height);

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (selectedId === 'custom') {
      return;
    }

    const preset = PAGE_SIZE_PRESETS.find((p: PageSizePreset) => p.id === selectedId);
    if (!preset) return;

    const isLandscape = pageSettings.orientation === 'landscape' || pageSettings.width > pageSettings.height;
    if (isLandscape) {
      updatePageSettings({
        width: Math.max(preset.widthMm, preset.heightMm),
        height: Math.min(preset.widthMm, preset.heightMm),
        orientation: 'landscape',
      });
    } else {
      updatePageSettings({
        width: Math.min(preset.widthMm, preset.heightMm),
        height: Math.max(preset.widthMm, preset.heightMm),
        orientation: 'portrait',
      });
    }
  };

  const handleWidthChange = (newWidth: number) => {
    updatePageSettings({ width: newWidth });
  };

  const handleHeightChange = (newHeight: number) => {
    updatePageSettings({ height: newHeight });
  };

  const handleOrientationChange = (newOrientation: 'portrait' | 'landscape') => {
    if (newOrientation === pageSettings.orientation) return;

    const currentW = pageSettings.width;
    const currentH = pageSettings.height;

    if (newOrientation === 'portrait' && currentW > currentH) {
      updatePageSettings({
        width: currentH,
        height: currentW,
        orientation: 'portrait',
      });
    } else if (newOrientation === 'landscape' && currentW < currentH) {
      updatePageSettings({
        width: currentH,
        height: currentW,
        orientation: 'landscape',
      });
    } else {
      updatePageSettings({ orientation: newOrientation });
    }
  };

  return (
    <InspectorSection
      title="Page Settings"
      badge={`${pageSettings.width} × ${pageSettings.height} mm`}
    >
      <div className="space-y-3 py-1">
        {/* Preset Selector */}
        <div>
          <label className="block text-[10px] uppercase font-semibold text-studio-muted mb-1 select-none">
            Page Preset
          </label>
          <select
            value={currentPresetId}
            onChange={handlePresetChange}
            className="w-full bg-zinc-900 border border-studio-border text-xs text-studio-text rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            aria-label="Page Preset"
          >
            {PAGE_SIZE_PRESETS.map((p: PageSizePreset) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.widthMm} × {p.heightMm} mm)
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Orientation Quick Toggle */}
        <div>
          <label className="block text-[10px] uppercase font-semibold text-studio-muted mb-1 select-none">
            Orientation
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-zinc-950/60 p-1 rounded border border-studio-border/60">
            <button
              type="button"
              onClick={() => handleOrientationChange('portrait')}
              className={`py-1 px-2 rounded text-xs flex items-center justify-center gap-1.5 transition-colors ${
                pageSettings.orientation === 'portrait'
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-studio-muted hover:text-studio-text hover:bg-zinc-800'
              }`}
              title="Portrait Orientation"
              aria-label="Portrait Orientation"
            >
              <span>Portrait</span>
            </button>
            <button
              type="button"
              onClick={() => handleOrientationChange('landscape')}
              className={`py-1 px-2 rounded text-xs flex items-center justify-center gap-1.5 transition-colors ${
                pageSettings.orientation === 'landscape'
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-studio-muted hover:text-studio-text hover:bg-zinc-800'
              }`}
              title="Landscape Orientation"
              aria-label="Landscape Orientation"
            >
              <span>Landscape</span>
            </button>
          </div>
        </div>

        {/* Dimension Inputs (Width & Height) */}
        <div>
          <label className="block text-[10px] uppercase font-semibold text-studio-muted mb-1 select-none">
            Dimensions
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumericInput
              label="W"
              unit="mm"
              value={pageSettings.width}
              min={10}
              max={3000}
              step={1}
              precision={1}
              onChange={handleWidthChange}
              placeholder="Width"
            />
            <NumericInput
              label="H"
              unit="mm"
              value={pageSettings.height}
              min={10}
              max={3000}
              step={1}
              precision={1}
              onChange={handleHeightChange}
              placeholder="Height"
            />
          </div>
        </div>

        {/* Margins & Elements Summary */}
        <div className="pt-2 border-t border-studio-border/50 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-studio-muted">
            <span>Margins</span>
            <span className="font-mono text-zinc-400">
              {pageSettings.margins.top} / {pageSettings.margins.right} / {pageSettings.margins.bottom} / {pageSettings.margins.left} mm
            </span>
          </div>
          <div className="flex items-center justify-between text-studio-muted">
            <span>Elements Count</span>
            <span className="font-mono text-zinc-400">{elementsCount}</span>
          </div>
        </div>
      </div>
    </InspectorSection>
  );
};
