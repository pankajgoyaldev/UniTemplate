import React from 'react';
import type { TextElement } from '@uts/core';
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { InspectorSection } from './InspectorSection.js';
import { ColorInput } from './ColorInput.js';
import { NumericInput } from './NumericInput.js';
import { useTemplateStore } from '../../store/useTemplateStore.js';
import { useUIStore } from '../../store/useUIStore.js';

export interface TypographySectionProps {
  element: TextElement;
  disabled: boolean;
  onUpdate: (patch: Partial<TextElement>) => void;
}

const COMMON_FONTS = [
  'Inter, sans-serif',
  'Roboto, sans-serif',
  'Arial, sans-serif',
  'Times New Roman, serif',
  'Georgia, serif',
  'Courier New, monospace',
  'system-ui, sans-serif',
];

export const TypographySection: React.FC<TypographySectionProps> = ({
  element,
  disabled,
  onUpdate,
}) => {
  const { content, style, bindingField } = element;
  const fields = useTemplateStore((s) => s.template.dataSchema?.fields || []);
  const mockPayload = useTemplateStore((s) => s.template.dataSchema?.mockPayload || {});
  const setVariablesModalOpen = useUIStore((s) => s.setVariablesModalOpen);

  const isBound = Boolean(bindingField && bindingField.trim().length > 0);

  const updateStyle = (patch: Partial<TextElement['style']>) => {
    if (disabled) return;
    onUpdate({
      style: {
        ...style,
        ...patch,
      },
    });
  };

  const isBold = style.fontWeight === 'bold' || style.fontWeight === '700';
  const isItalic = style.fontStyle === 'italic';

  return (
    <InspectorSection title="Typography">
      {/* Content & Field Binding Selector */}
      <div className="py-1 space-y-2 border-b border-studio-border/50 pb-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-studio-muted font-medium select-none">
            Text Mode
          </span>
          <div className="flex items-center gap-0.5 bg-zinc-950 p-0.5 rounded border border-studio-border">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (isBound) {
                  onUpdate({ bindingField: undefined });
                }
              }}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                !isBound
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-zinc-400 hover:text-white'
              } disabled:opacity-40`}
            >
              Static Text
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!isBound) {
                  const defaultField = fields.length > 0 ? fields[0].name : '';
                  if (defaultField) {
                    onUpdate({ bindingField: defaultField });
                  } else {
                    setVariablesModalOpen(true);
                  }
                }
              }}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                isBound
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-zinc-400 hover:text-white'
              } disabled:opacity-40`}
            >
              Dynamic Field
            </button>
          </div>
        </div>

        {/* Dynamic Field Selector */}
        {isBound ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-studio-muted font-medium w-16 shrink-0 select-none">
                Field
              </span>
              <div className="flex items-center gap-1 max-w-[170px] flex-1">
                <select
                  disabled={disabled}
                  value={bindingField || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__add_new__') {
                      setVariablesModalOpen(true);
                    } else {
                      onUpdate({ bindingField: val || undefined });
                    }
                  }}
                  className="bg-zinc-900 border border-studio-border rounded px-2 py-1 text-studio-text text-xs focus:outline-none focus:border-blue-500 flex-1 font-mono disabled:opacity-40 truncate"
                >
                  {fields.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name} ({f.type})
                    </option>
                  ))}
                  <option value="__add_new__">+ New Variable...</option>
                </select>
              </div>
            </div>

            {/* Sample Readout */}
            <div className="flex items-center justify-between text-[11px] bg-zinc-900/60 px-2 py-1 rounded border border-studio-border/50">
              <span className="text-studio-muted">Sample Value:</span>
              <span className="font-mono text-zinc-200 truncate max-w-[140px]">
                {mockPayload[bindingField!] !== undefined
                  ? String(mockPayload[bindingField!])
                  : '—'}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <span className="text-studio-muted font-medium text-xs block mb-1 select-none">
              Text Content
            </span>
            <textarea
              rows={2}
              disabled={disabled}
              value={content}
              onChange={(e) => onUpdate({ content: e.target.value })}
              className="w-full bg-zinc-900 border border-studio-border rounded px-2 py-1.5 text-studio-text text-xs focus:outline-none focus:border-blue-500 font-sans resize-y disabled:opacity-40"
              placeholder="Enter text..."
            />
            <div className="text-[10px] text-zinc-500 mt-1">
              Tip: Use <span className="font-mono text-blue-400">{'{{variable_name}}'}</span> for inline dynamic fields.
            </div>
          </div>
        )}
      </div>

      {/* Font Family */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Font Family
        </span>
        <select
          disabled={disabled}
          value={style.fontFamily}
          onChange={(e) => updateStyle({ fontFamily: e.target.value })}
          className="bg-zinc-900 border border-studio-border rounded px-2 py-1 text-studio-text text-xs focus:outline-none focus:border-blue-500 max-w-[160px] flex-1 disabled:opacity-40 truncate"
        >
          {COMMON_FONTS.map((font) => (
            <option key={font} value={font}>
              {font.split(',')[0]}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size & Weight/Style Controls */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Size & Style
        </span>
        <div className="flex items-center gap-1.5 max-w-[160px] flex-1">
          <NumericInput
            unit="pt"
            min={4}
            max={288}
            step={1}
            precision={1}
            value={style.fontSizePt}
            disabled={disabled}
            onChange={(fontSizePt) => updateStyle({ fontSizePt })}
            className="flex-1"
          />

          {/* Bold Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateStyle({ fontWeight: isBold ? 'normal' : 'bold' })}
            title="Bold"
            className={`p-1 rounded border transition-colors ${
              isBold
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-zinc-900 border-studio-border text-zinc-400 hover:text-white hover:bg-zinc-800'
            } disabled:opacity-40`}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateStyle({ fontStyle: isItalic ? 'normal' : 'italic' })}
            title="Italic"
            className={`p-1 rounded border transition-colors ${
              isItalic
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-zinc-900 border-studio-border text-zinc-400 hover:text-white hover:bg-zinc-800'
            } disabled:opacity-40`}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Text Color */}
      <ColorInput
        label="Color"
        value={style.color}
        disabled={disabled}
        allowTransparent={false}
        onChange={(color) => updateStyle({ color })}
      />

      {/* Text Alignment */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Alignment
        </span>
        <div className="flex items-center gap-0.5 bg-zinc-950/60 p-0.5 rounded border border-studio-border/60 max-w-[160px] flex-1 justify-between">
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateStyle({ alignment: 'left' })}
            title="Align Left"
            className={`p-1 rounded flex-1 flex items-center justify-center transition-colors ${
              style.alignment === 'left'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            } disabled:opacity-40`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateStyle({ alignment: 'center' })}
            title="Align Center"
            className={`p-1 rounded flex-1 flex items-center justify-center transition-colors ${
              style.alignment === 'center'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            } disabled:opacity-40`}
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateStyle({ alignment: 'right' })}
            title="Align Right"
            className={`p-1 rounded flex-1 flex items-center justify-center transition-colors ${
              style.alignment === 'right'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            } disabled:opacity-40`}
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateStyle({ alignment: 'justify' })}
            title="Justify"
            className={`p-1 rounded flex-1 flex items-center justify-center transition-colors ${
              style.alignment === 'justify'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            } disabled:opacity-40`}
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Line Height & Letter Spacing */}
      <div className="grid grid-cols-2 gap-2 py-1">
        <NumericInput
          label="LH"
          min={0.5}
          max={4}
          step={0.1}
          precision={2}
          value={style.lineHeight}
          disabled={disabled}
          onChange={(lineHeight) => updateStyle({ lineHeight })}
        />
        <NumericInput
          label="LS"
          unit="pt"
          min={-10}
          max={50}
          step={0.5}
          precision={1}
          value={style.letterSpacingPt ?? 0}
          disabled={disabled}
          onChange={(letterSpacingPt) => updateStyle({ letterSpacingPt })}
        />
      </div>

      {/* Auto Wrap Toggle */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Auto Wrap
        </span>
        <label className="flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={disabled}
            checked={style.autoWrap}
            onChange={(e) => updateStyle({ autoWrap: e.target.checked })}
            className="rounded bg-zinc-900 border-studio-border text-blue-600 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer disabled:opacity-40"
          />
        </label>
      </div>
    </InspectorSection>
  );
};

