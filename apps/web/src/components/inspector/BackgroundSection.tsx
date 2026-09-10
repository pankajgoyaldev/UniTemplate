import React, { useRef } from 'react';
import { Image as ImageIcon, Eye, EyeOff, Trash2, Upload, Lock, RefreshCw } from 'lucide-react';
import { useTemplateStore } from '../../store/useTemplateStore.js';
import { useDocumentStore } from '../../store/document/useDocumentStore.js';
import {
  importBackgroundImage,
  removeTraceBackground,
  setTraceBackgroundOpacity,
  toggleTraceBackgroundVisibility,
  SUPPORTED_BACKGROUND_EXTENSIONS,
} from '../../operations/backgroundOperations.js';
import { InspectorSection } from './InspectorSection.js';
import { NumericInput } from './NumericInput.js';

export const BackgroundSection: React.FC = () => {
  const traceBackground = useTemplateStore((s) => s.template.traceBackground);
  const traceBackgroundFile = useDocumentStore((s) => s.traceBackgroundFile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importBackgroundImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filename =
    traceBackgroundFile?.filename ||
    traceBackground?.fileRef?.replace(/^background\//, '') ||
    '';

  const opacityPercent = Math.round((traceBackground?.opacity ?? 0.3) * 100);

  return (
    <InspectorSection
      title="Trace Background"
      badge={traceBackground ? (traceBackground.enabled ? 'Active' : 'Hidden') : undefined}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_BACKGROUND_EXTENSIONS.join(',') + ',image/png,image/jpeg,image/webp,image/svg+xml'}
        className="hidden"
        onChange={handleFileChange}
      />

      {!traceBackground ? (
        <div className="space-y-3 py-1">
          <p className="text-[11px] text-studio-muted leading-relaxed">
            Import an existing design (PNG, JPG, WebP, SVG) as a locked reference to trace editable elements over.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-zinc-900 hover:bg-zinc-800 border border-studio-border text-xs font-medium text-studio-text hover:text-white transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Import Background...</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3 py-1">
          {/* File reference & Locked status */}
          <div className="flex items-center justify-between bg-zinc-900/80 px-2.5 py-1.5 rounded border border-studio-border/60">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs font-mono text-zinc-200 truncate" title={filename}>
                {filename || 'Background image'}
              </span>
            </div>
            <span
              className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded shrink-0 ml-2"
              title="Locked to page bounds (cannot be moved accidentally)"
            >
              <Lock className="w-2.5 h-2.5 text-amber-400" />
              <span>Locked</span>
            </span>
          </div>

          {/* Visibility & Actions */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-studio-muted font-medium select-none">
              Visibility
            </span>
            <button
              type="button"
              onClick={toggleTraceBackgroundVisibility}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors ${
                traceBackground.enabled
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
                  : 'bg-zinc-900 border-studio-border text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              title={traceBackground.enabled ? 'Hide background' : 'Show background'}
            >
              {traceBackground.enabled ? (
                <>
                  <Eye className="w-3 h-3 text-blue-400" />
                  <span>Visible</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 text-zinc-500" />
                  <span>Hidden</span>
                </>
              )}
            </button>
          </div>

          {/* Opacity Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-studio-muted font-medium select-none">
                Opacity
              </span>
              <div className="w-24">
                <NumericInput
                  unit="%"
                  min={5}
                  max={100}
                  step={5}
                  precision={0}
                  value={opacityPercent}
                  onChange={(val) => {
                    const clamped = Math.max(5, Math.min(100, val));
                    setTraceBackgroundOpacity(clamped / 100);
                  }}
                />
              </div>
            </div>
            {/* Slider bar for quick mouse adjustment */}
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={opacityPercent}
              onChange={(e) => {
                const val = Number(e.target.value);
                setTraceBackgroundOpacity(val / 100);
              }}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Action buttons: Replace & Remove */}
          <div className="pt-2 border-t border-studio-border/40 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-studio-border text-xs text-zinc-300 hover:text-white transition-colors"
              title="Replace current background image"
            >
              <RefreshCw className="w-3 h-3 text-zinc-400" />
              <span>Replace...</span>
            </button>
            <button
              type="button"
              onClick={removeTraceBackground}
              className="flex items-center justify-center gap-1.5 py-1 px-2.5 rounded bg-zinc-900 hover:bg-red-950/40 border border-studio-border hover:border-red-900/60 text-xs text-red-400 hover:text-red-300 transition-colors"
              title="Remove background image"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      )}
    </InspectorSection>
  );
};
