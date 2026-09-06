import React from 'react';
import {
  mmToPx,
  DEFAULT_SCREEN_DPI,
  type TemplateElement,
} from '@uts/core';
import {
  calculateElementHandles,
  calculateMultiElementBoundingBox,
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

  // Multiple selected elements: render ONE combined group bounding box
  if (selectedElements.length > 1) {
    const groupBbox = calculateMultiElementBoundingBox(selectedElements);
    if (!groupBbox) return null;

    const xPx = mmToPx(groupBbox.x, DEFAULT_SCREEN_DPI) * zoom;
    const yPx = mmToPx(groupBbox.y, DEFAULT_SCREEN_DPI) * zoom;
    const widthPx = mmToPx(groupBbox.width, DEFAULT_SCREEN_DPI) * zoom;
    const heightPx = mmToPx(groupBbox.height, DEFAULT_SCREEN_DPI) * zoom;

    return (
      <g className="selection-overlay-layer">
        <g className="group-selection">
          <rect
            x={xPx}
            y={yPx}
            width={widthPx}
            height={heightPx}
            fill="rgba(37, 99, 235, 0.04)"
            stroke="#2563eb"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        </g>
      </g>
    );
  }

  // Single selected element: show its rotated selection bounding box and 8 resize handles
  const element = selectedElements[0];
  const { x, y, width, height, rotation = 0 } = element.bounds;

  const xPx = mmToPx(x, DEFAULT_SCREEN_DPI) * zoom;
  const yPx = mmToPx(y, DEFAULT_SCREEN_DPI) * zoom;
  const widthPx = mmToPx(width, DEFAULT_SCREEN_DPI) * zoom;
  const heightPx = mmToPx(height, DEFAULT_SCREEN_DPI) * zoom;

  const cxPx = xPx + widthPx / 2;
  const cyPx = yPx + heightPx / 2;

  const isRotated = rotation % 360 !== 0;
  const outlineTransform = isRotated
    ? `rotate(${rotation} ${cxPx} ${cyPx})`
    : undefined;

  const handles = calculateElementHandles(element.bounds);

  return (
    <g className="selection-overlay-layer">
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
          transform={outlineTransform}
          pointerEvents="none"
        />

        {/* 2. 8 Interactive Resize Handles */}
        {handles.map((handle) => {
          const hxPx = mmToPx(handle.positionMm.x, DEFAULT_SCREEN_DPI) * zoom;
          const hyPx = mmToPx(handle.positionMm.y, DEFAULT_SCREEN_DPI) * zoom;

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
    </g>
  );
};

