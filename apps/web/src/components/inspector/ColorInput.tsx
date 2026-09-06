import React, { useState, useEffect } from 'react';

export interface ColorInputProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  allowTransparent?: boolean;
}

export const ColorInput: React.FC<ColorInputProps> = ({
  label,
  value,
  onChange,
  disabled = false,
  allowTransparent = true,
}) => {
  const [hexText, setHexText] = useState(value || '#000000');

  useEffect(() => {
    setHexText(value || '#000000');
  }, [value]);

  const isTransparent = hexText.toLowerCase() === 'transparent';
  const displayColor = isTransparent ? '#000000' : hexText;

  const commitHex = () => {
    const trimmed = hexText.trim().toLowerCase();
    if (trimmed === 'transparent' && allowTransparent) {
      onChange('transparent');
      return;
    }

    // Check if valid 3, 6, or 8-digit hex
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
      onChange(trimmed);
      setHexText(trimmed);
    } else {
      // Revert to valid value
      setHexText(value || '#000000');
    }
  };

  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-studio-muted font-medium select-none w-20 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 max-w-[160px]">
        {/* Color Swatch Picker */}
        <label
          className={`relative w-6 h-6 rounded border border-studio-border shrink-0 cursor-pointer overflow-hidden shadow-inner ${
            disabled ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          style={{
            backgroundColor: isTransparent ? 'transparent' : displayColor,
            backgroundImage: isTransparent
              ? 'linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)'
              : 'none',
            backgroundSize: '6px 6px',
            backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0',
          }}
          title={isTransparent ? 'Transparent' : displayColor}
        >
          <input
            type="color"
            disabled={disabled}
            value={isTransparent ? '#ffffff' : displayColor.substring(0, 7)}
            onChange={(e) => {
              const newColor = e.target.value;
              setHexText(newColor);
              onChange(newColor);
            }}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          />
        </label>

        {/* Hex Text Field */}
        <input
          type="text"
          disabled={disabled}
          value={hexText}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setHexText(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitHex();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setHexText(value || '#000000');
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={`w-full bg-zinc-900 border border-studio-border rounded px-2 py-1 text-studio-text font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors ${
            disabled ? 'opacity-40 cursor-not-allowed bg-zinc-950 text-zinc-500' : ''
          }`}
          placeholder="#000000"
        />
      </div>
    </div>
  );
};

