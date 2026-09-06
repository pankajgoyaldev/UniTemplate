import React from 'react';
import {
  mmToPx,
  type TemplateElement,
} from '@uts/core';
import {
  calculateElementHandles,
  type ResizeHandleType,
} from '@uts/canvas-engine';

interface SelectionOverlayProps {
  selectedElementIds: string[];
  elements: TemplateElement[];
  zoom: number;
  onHandleMouseDown?: (e: React.MouseEvent, handle: ResizeHandleType, elementId: string) => void;
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  selectedElementIds,
  elements,
  zoom,
  onHandleMouseDown,
}) => {
  if (selectedElementIds.length === 0) return null;

  const selectedElements = elements.filter(
    (el) => selectedElementIds.includes(el.id) && el.isVisible && !el.isLocked,
  );

  if (selectedElements.length === 0) return null;

  const HANDLE_SIZE = 8; // Constant 8px screen size

  return (
    <g className="selection-overlay-layer">
      {selectedElements.map((element) => {
        const { x, y, width, height, rotation = 0 } = element.bounds;

        const xPx = mmToPx(x, 96) * zoom;
        const yPx = mmToPx(y, 96) * zoom;
        const widthPx = mmToPx(width, 96) * zoom;
        const heightPx = mmToPx(height, 96) * zoom;

        const cxPx = xPx + widthPx / 2;
        const cyPx = yPx + heightPx / 2;

        const isRotated = rotation % 360 !== 0;
        const outlineTransform = isRotated
          ? `rotate(${rotation} ${cxPx} ${cyPx})`
          : undefined;

        // Calculate 8 handles in mm
        const handles = calculateElementHandles(element.bounds);

        // Only show resize handles if single element is selected
        const showHandles = selectedElements.length === 1;

        return (
          <g key={`selection-${element.id}`} className="element-selection">
            {/* 1. Selection Bounding Box Outline */}
            <rect
              x={xPx}
              y={yPx}
              width={widthPx}
              height={heightPx}
              fill="rgba(37, 99, 235, 0.04)"
              stroke="#2563eb"
              strokeWidth="1.5"
              strokeDasharray={selectedElements.length > 1 ? '4 3' : undefined}
              transform={outlineTransform}
              pointerEvents="none"
            />

            {/* 2. 8 Interactive Resize Handles (Rendered for single selection) */}
            {showHandles &&
              handles.map((handle) => {
                const hxPx = mmToPx(handle.positionMm.x, 96) * zoom;
                const hyPx = mmToPx(handle.positionMm.y, 96) * zoom;

                return (
                  <rect
                    key={`handle-${element.id}-${handle.type}`}
                    x={hxPx - HANDLE_SIZE / 2}
                    y={hyPx - HANDLE_SIZE / 2}
                    width={HANDLE_SIZE}
                    height={HANDLE_SIZE}
                    fill="#ffffff"
                    stroke="#2563eb"
                    strokeWidth="1.5"
                    rx={1}
                    className="transition-colors hover:fill-blue-500 hover:stroke-white"
                    style={{ cursor: handle.cursor }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onHandleMouseDown?.(e, handle.type, element.id);
                    }}
                  />
                );
              })}
          </g>
        );
      })}
    </g>
  );
};

