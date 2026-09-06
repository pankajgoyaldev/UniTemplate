import React from 'react';
import type { ShapeElement, ImageElement, BarcodeElement, BarcodeType, ShapeType } from '@uts/core';
import { InspectorSection } from './InspectorSection.js';
import { ColorInput } from './ColorInput.js';
import { NumericInput } from './NumericInput.js';

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

      {/* Value / Content */}
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

