import React, { useCallback, useRef, useState, useEffect } from 'react';

export interface PanelResizeHandleProps {
  /** Orientation of the resize divider: 'vertical' (default, for columns) or 'horizontal' (for rows) */
  orientation?: 'vertical' | 'horizontal';
  /** Which side the panel is on relative to the handle:
   * For vertical: 'left' (default) | 'right'
   * For horizontal: 'top' (default) | 'bottom'
   */
  side?: 'left' | 'right' | 'top' | 'bottom';
  /** Current panel size (width or height) in pixels */
  currentSize?: number;
  /** Legacy alias for currentSize (width) */
  currentWidth?: number;
  /** Legacy alias for currentSize (height) */
  currentHeight?: number;
  /** Minimum allowable size in pixels */
  minSize?: number;
  minWidth?: number;
  minHeight?: number;
  /** Maximum allowable size in pixels */
  maxSize?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Callback fired with the clamped new size */
  onResize: (newSize: number) => void;
  /** Optional callback fired when resize begins */
  onResizeStart?: () => void;
  /** Optional callback fired when resize ends */
  onResizeEnd?: () => void;
  /** Custom extra classes */
  className?: string;
}

/**
 * Reusable panel resize divider supporting both vertical and horizontal resizing.
 * Features smooth 60fps RAF dragging, subtle hover/active feedback, cursor management,
 * text selection suppression, and full listener cleanup.
 */
export const PanelResizeHandle: React.FC<PanelResizeHandleProps> = ({
  orientation = 'vertical',
  side,
  currentSize,
  currentWidth,
  currentHeight,
  minSize,
  minWidth,
  minHeight,
  maxSize,
  maxWidth,
  maxHeight,
  onResize,
  onResizeStart,
  onResizeEnd,
  className = '',
}) => {
  const isHorizontal = orientation === 'horizontal';
  const effectiveSide = side ?? (isHorizontal ? 'top' : 'left');

  const defaultCurrent = isHorizontal ? 48 : (effectiveSide === 'right' ? 320 : 72);
  const defaultMin = isHorizontal ? 48 : (effectiveSide === 'right' ? 220 : 72);
  const defaultMax = isHorizontal ? 80 : (effectiveSide === 'right' ? 400 : 360);

  const resolvedCurrent = currentSize ?? (isHorizontal ? currentHeight : currentWidth) ?? defaultCurrent;
  const resolvedMin = minSize ?? (isHorizontal ? minHeight : minWidth) ?? defaultMin;
  const resolvedMax = maxSize ?? (isHorizontal ? maxHeight : maxWidth) ?? defaultMax;

  const [isResizing, setIsResizing] = useState(false);
  const startCoordRef = useRef(0);
  const startSizeRef = useRef(resolvedCurrent);
  const rafIdRef = useRef<number | null>(null);
  const latestCoordRef = useRef<number | null>(null);

  // Keep refs up-to-date with latest props
  const propsRef = useRef({
    isHorizontal,
    side: effectiveSide,
    min: resolvedMin,
    max: resolvedMax,
    onResize,
    onResizeStart,
    onResizeEnd,
  });
  propsRef.current = {
    isHorizontal,
    side: effectiveSide,
    min: resolvedMin,
    max: resolvedMax,
    onResize,
    onResizeStart,
    onResizeEnd,
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Left-click only
      e.preventDefault();
      e.stopPropagation();

      const coord = isHorizontal ? e.clientY : e.clientX;
      startCoordRef.current = coord;
      startSizeRef.current = resolvedCurrent;
      setIsResizing(true);
      propsRef.current.onResizeStart?.();

      const resizeCursor = isHorizontal ? 'row-resize' : 'col-resize';
      document.body.style.cursor = resizeCursor;
      document.body.style.userSelect = 'none';

      const updateSize = (currentCoord: number) => {
        const { side: currentSide, min: minLimit, max: maxLimit, onResize: handleResize } = propsRef.current;
        const delta = currentCoord - startCoordRef.current;
        const effectiveDelta = (currentSide === 'left' || currentSide === 'top') ? delta : -delta;
        const rawNewSize = startSizeRef.current + effectiveDelta;
        const clamped = Math.max(minLimit, Math.min(maxLimit, rawNewSize));
        handleResize(Math.round(clamped));
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        latestCoordRef.current = isHorizontal ? moveEvent.clientY : moveEvent.clientX;
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (latestCoordRef.current !== null) {
              updateSize(latestCoordRef.current);
            }
          });
        }
      };

      const handleMouseUp = () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        if (latestCoordRef.current !== null) {
          updateSize(latestCoordRef.current);
          latestCoordRef.current = null;
        }

        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        propsRef.current.onResizeEnd?.();

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('blur', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('blur', handleMouseUp);
    },
    [isHorizontal, resolvedCurrent],
  );

  // Guarantee clean-up if handle unmounts during active drag
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const containerClasses = isHorizontal
    ? `relative h-2 -my-1 shrink-0 z-30 cursor-row-resize select-none flex flex-col items-center justify-center group w-full ${className}`
    : `relative w-2 -mx-1 shrink-0 z-20 cursor-col-resize select-none flex items-center justify-center group ${className}`;

  const lineClasses = isHorizontal
    ? `h-[2px] w-full transition-colors duration-150 ${
        isResizing
          ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
          : 'bg-transparent group-hover:bg-blue-500/70'
      }`
    : `w-[2px] h-full transition-colors duration-150 ${
        isResizing
          ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
          : 'bg-transparent group-hover:bg-blue-500/70'
      }`;

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-valuenow={resolvedCurrent}
      aria-valuemin={resolvedMin}
      aria-valuemax={resolvedMax}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      className={containerClasses}
      title={
        isHorizontal
          ? 'Drag to resize top bar height'
          : effectiveSide === 'right'
            ? 'Drag to resize inspector width'
            : 'Drag to resize toolbox width'
      }
    >
      <div className={lineClasses} />
    </div>
  );
};
