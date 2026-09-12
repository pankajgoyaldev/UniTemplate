import React from 'react';
import type { ShapeElement, ImageElement, BarcodeElement, BarcodeType, ShapeType } from '@uts/core';
import { InspectorSection } from './InspectorSection.js';
import { ColorInput } from './ColorInput.js';
import { NumericInput } from './NumericInput.js';
import { useTemplateStore } from '../../store/useTemplateStore.js';
import { useUIStore } from '../../store/useUIStore.js';

export interface ShapeAppearanceProps {
  element: ShapeElement;
  disabled: boolean;
  onUpdate: (patch: Partial<ShapeElement>) => void;
}

export const ShapeAppearance: React.FC<ShapeAppearanceProps> = ({ element, disabled, onUpdate }) => {
  const isLine = element.shapeType === 'line';
  const showCornerRadius = element.shapeType === 'rounded-rectangle' || element.shapeType === 'rectangle';

  return (
    <>
      {/* Shape Type Selector */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Shape Type
        </span>
        <select
          disabled={disabled}
          value={element.shapeType}
          onChange={(e) => onUpdate({ shapeType: e.target.value as ShapeType })}
          className="bg-zinc-900 border border-studio-border rounded px-2 py-1 text-studio-text text-xs focus:outline-none focus:border-blue-500 max-w-[160px] flex-1 disabled:opacity-40"
        >
          <option value="rectangle">Rectangle</option>
          <option value="rounded-rectangle">Rounded Rectangle</option>
          <option value="ellipse">Ellipse</option>
          <option value="line">Line</option>
        </select>
      </div>

      {/* Fill Color (not for lines) */}
      {!isLine && (
        <ColorInput
          label="Fill"
          value={element.fillColor}
          disabled={disabled}
          onChange={(fillColor) => onUpdate({ fillColor })}
        />
      )}

      {/* Stroke Color */}
      <ColorInput
        label="Stroke"
        value={element.strokeColor}
        disabled={disabled}
        onChange={(strokeColor) => onUpdate({ strokeColor })}
      />

      {/* Stroke Width */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Stroke Width
        </span>
        <div className="flex-1 max-w-[160px]">
          <NumericInput
            unit="mm"
            min={0}
            max={50}
            step={0.1}
            precision={2}
            value={element.strokeWidthMm}
            disabled={disabled}
            onChange={(strokeWidthMm) => onUpdate({ strokeWidthMm })}
          />
        </div>
      </div>

      {/* Corner Radius (for rectangles) */}
      {showCornerRadius && (
        <div className="flex items-center justify-between text-xs py-1">
          <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
            Radius
          </span>
          <div className="flex-1 max-w-[160px]">
            <NumericInput
              unit="mm"
              min={0}
              max={100}
              step={0.5}
              precision={2}
              value={element.cornerRadiusMm ?? 0}
              disabled={disabled}
              onChange={(cornerRadiusMm) => onUpdate({ cornerRadiusMm })}
            />
          </div>
        </div>
      )}

      {/* Stroke Dash */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Stroke Dash
        </span>
        <select
          disabled={disabled}
          value={element.strokeDash ?? 'solid'}
          onChange={(e) => onUpdate({ strokeDash: e.target.value as 'solid' | 'dashed' | 'dotted' })}
          className="bg-zinc-900 border border-studio-border rounded px-2 py-1 text-studio-text text-xs focus:outline-none focus:border-blue-500 max-w-[160px] flex-1 disabled:opacity-40"
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </div>
    </>
  );
};

export interface ImageAppearanceProps {
  element: ImageElement;
  disabled: boolean;
  onUpdate: (patch: Partial<ImageElement>) => void;
}

export const ImageAppearance: React.FC<ImageAppearanceProps> = ({ element, disabled, onUpdate }) => {
  const opacityPercent = Math.round((element.opacity ?? 1) * 100);

  return (
    <>
      {/* Fit Selector */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Fit
        </span>
        <select
          disabled={disabled}
          value={element.fit}
          onChange={(e) => onUpdate({ fit: e.target.value as 'contain' | 'cover' | 'stretch' })}
          className="bg-zinc-900 border border-studio-border rounded px-2 py-1 text-studio-text text-xs focus:outline-none focus:border-blue-500 max-w-[160px] flex-1 disabled:opacity-40"
        >
          <option value="contain">Contain</option>
          <option value="cover">Cover</option>
          <option value="stretch">Stretch</option>
        </select>
      </div>

      {/* Opacity */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Opacity
        </span>
        <div className="flex-1 max-w-[160px]">
          <NumericInput
            unit="%"
            min={0}
            max={100}
            step={5}
            precision={0}
            value={opacityPercent}
            disabled={disabled}
            onChange={(val) => {
              const clamped = Math.max(0, Math.min(100, val));
              onUpdate({ opacity: Number((clamped / 100).toFixed(2)) });
            }}
          />
        </div>
      </div>
    </>
  );
};

export interface BarcodeAppearanceProps {
  element: BarcodeElement;
  disabled: boolean;
  onUpdate: (patch: Partial<BarcodeElement>) => void;
}

export const BarcodeAppearance: React.FC<BarcodeAppearanceProps> = ({ element, disabled, onUpdate }) => {
  const fields = useTemplateStore((s) => s.template.dataSchema?.fields || []);
  const mockPayload = useTemplateStore((s) => s.template.dataSchema?.mockPayload || {});
  const setVariablesModalOpen = useUIStore((s) => s.setVariablesModalOpen);

  const isBound = Boolean(element.bindingField && element.bindingField.trim().length > 0);

  return (
    <>
      {/* Barcode Type / Format */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
          Format
        </span>
        <select
          disabled={disabled}
          value={element.barcodeType}
          onChange={(e) => onUpdate({ barcodeType: e.target.value as BarcodeType })}
          className="bg-zinc-900 border border-studio-border rounded px-2 py-1 text-studio-text text-xs focus:outline-none focus:border-blue-500 max-w-[160px] flex-1 disabled:opacity-40 font-mono"
        >
          <option value="code128">Code 128</option>
          <option value="ean13">EAN-13</option>
          <option value="upca">UPC-A</option>
          <option value="code39">Code 39</option>
          <option value="qr">QR Code</option>
          <option value="datamatrix">Data Matrix</option>
        </select>
      </div>

      {/* Value Mode (Static vs Dynamic Field) */}
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-studio-muted font-medium select-none">
          Value Mode
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
            Static
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
            Dynamic
          </button>
        </div>
      </div>

      {/* Dynamic Field Selector OR Static Value Input */}
      {isBound ? (
        <div className="space-y-1.5 py-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-studio-muted font-medium w-16 shrink-0 select-none">
              Field
            </span>
            <div className="flex items-center gap-1 max-w-[160px] flex-1">
              <select
                disabled={disabled}
                value={element.bindingField || ''}
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

          <div className="flex items-center justify-between text-[11px] bg-zinc-900/60 px-2 py-1 rounded border border-studio-border/50">
            <span className="text-studio-muted">Sample:</span>
            <span className="font-mono text-zinc-200 truncate max-w-[140px]">
              {mockPayload[element.bindingField!] !== undefined
                ? String(mockPayload[element.bindingField!])
                : '—'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs py-1">
          <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
            Value
          </span>
          <input
            type="text"
            disabled={disabled}
            value={element.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            className="bg-zinc-900 border border-studio-border rounded px-2 py-1 text-studio-text text-xs font-mono focus:outline-none focus:border-blue-500 max-w-[160px] flex-1 disabled:opacity-40"
          />
        </div>
      )}

      {/* Show Text Toggle */}
      {element.barcodeType !== 'qr' && element.barcodeType !== 'datamatrix' && (
        <div className="flex items-center justify-between text-xs py-1">
          <span className="text-studio-muted font-medium w-20 shrink-0 select-none">
            Show Text
          </span>
          <label className="flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={disabled}
              checked={element.showText}
              onChange={(e) => onUpdate({ showText: e.target.checked })}
              className="rounded bg-zinc-900 border-studio-border text-blue-600 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer disabled:opacity-40"
            />
          </label>
        </div>
      )}
    </>
  );
};

export interface AppearanceSectionProps {
  element: ShapeElement | ImageElement | BarcodeElement;
  disabled: boolean;
  onUpdate: (patch: any) => void;
}

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({ element, disabled, onUpdate }) => {
  return (
    <InspectorSection title="Appearance">
      {element.type === 'shape' && (
        <ShapeAppearance element={element} disabled={disabled} onUpdate={onUpdate} />
      )}
      {element.type === 'image' && (
        <ImageAppearance element={element} disabled={disabled} onUpdate={onUpdate} />
      )}
      {element.type === 'barcode' && (
        <BarcodeAppearance element={element} disabled={disabled} onUpdate={onUpdate} />
      )}
    </InspectorSection>
  );
};

