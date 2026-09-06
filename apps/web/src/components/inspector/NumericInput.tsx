import React, { useState, useEffect, useRef } from 'react';

export interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  label,
  unit,
  min,
  max,
  step = 1,
  precision = 2,
  disabled = false,
  className = '',
  placeholder,
}) => {
  const formatVal = (v: number) => {
    if (!Number.isFinite(v)) return '0.00';
    return Number(v.toFixed(precision)).toString();
  };

  const [text, setText] = useState<string>(() => formatVal(value));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes when not actively editing
  useEffect(() => {
    if (!isFocused) {
      setText(formatVal(value));
    }
  }, [value, isFocused, precision]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === '') {
      // Empty input does not corrupt AST; restores current valid value
      setText(formatVal(value));
      return;
    }

    let parsed = parseFloat(trimmed);
    if (!Number.isFinite(parsed)) {
      // Invalid input restores current valid value
      setText(formatVal(value));
      return;
    }

    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;

    parsed = Number(parsed.toFixed(precision));
    onChange(parsed);
    setText(formatVal(parsed));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Enter') {
      commit();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      // Restore previous valid value
      setText(formatVal(value));
      inputRef.current?.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const multiplier = e.shiftKey ? 10 : 1;
      const current = parseFloat(text);
      const base = Number.isFinite(current) ? current : value;
      let next = base + step * multiplier;
      if (max !== undefined && next > max) next = max;
      next = Number(next.toFixed(precision));
      setText(formatVal(next));
      onChange(next);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const multiplier = e.shiftKey ? 10 : 1;
      const current = parseFloat(text);
      const base = Number.isFinite(current) ? current : value;
      let next = base - step * multiplier;
      if (min !== undefined && next < min) next = min;
      next = Number(next.toFixed(precision));
      setText(formatVal(next));
      onChange(next);
    }
  };

  return (
    <div className={`flex items-center text-xs ${className}`}>
      {label && (
        <span className="text-studio-muted font-medium w-6 shrink-0 select-none">
          {label}
        </span>
      )}
      <div className="relative flex-1 flex items-center">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onFocus={(e) => {
            setIsFocused(true);
            e.target.select();
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            setIsFocused(false);
            commit();
          }}
          onKeyDown={handleKeyDown}
          className={`w-full bg-zinc-900 border border-studio-border rounded px-2 py-1 text-studio-text focus:outline-none focus:border-blue-500 font-mono text-right transition-colors ${
            disabled ? 'opacity-40 cursor-not-allowed bg-zinc-950 text-zinc-500' : ''
          } ${unit ? 'pr-7' : ''}`}
        />
        {unit && (
          <span className="absolute right-2 text-zinc-500 text-[10px] pointer-events-none select-none font-sans">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

