import React, { useMemo } from 'react';
import { mmToPx, type PageSettings, type TemplateElement } from '@uts/core';
import { ElementRenderer } from './ElementRenderer.js';

interface PageCanvasProps {
  pageSettings: PageSettings;
  elements: TemplateElement[];
  zoom: number;
  panX: number;
  panY: number;
  gridVisible: boolean;
  gridSizeMm: 5 | 10;
  assetResolver?: (assetRef: string) => string | undefined;
}

export const PageCanvas: React.FC<PageCanvasProps> = ({
  pageSettings,
  elements,
  zoom,
  panX,
  panY,
  gridVisible,
  gridSizeMm,
  assetResolver,
}) => {
  const { width: widthMm, height: heightMm, margins } = pageSettings;

  // Base dimensions in CSS screen pixels at 1.0x zoom (96 DPI)
  const baseWidthPx = mmToPx(widthMm, 96);
  const baseHeightPx = mmToPx(heightMm, 96);

  // Scaled dimensions under current zoom
  const scaledWidthPx = baseWidthPx * zoom;
  const scaledHeightPx = baseHeightPx * zoom;

  // Margins in screen pixels
  const marginTopPx = mmToPx(margins.top, 96) * zoom;
  const marginRightPx = mmToPx(margins.right, 96) * zoom;
  const marginBottomPx = mmToPx(margins.bottom, 96) * zoom;
  const marginLeftPx = mmToPx(margins.left, 96) * zoom;

  // Grid step in scaled pixels
  const gridStepPx = mmToPx(gridSizeMm, 96) * zoom;

  // Sort elements by zIndex ascending
  const sortedElements = useMemo(() => {
    return [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }, [elements]);

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        transform: `translate3d(${panX}px, ${panY}px, 0)`,
        width: scaledWidthPx,
        height: scaledHeightPx,
      }}
    >
      {/* Physical Paper Canvas with Subtle Drop Shadow */}
      <svg
        className="w-full h-full bg-white rounded-[2px]"
        style={{
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
        width={scaledWidthPx}
        height={scaledHeightPx}
        viewBox={`0 0 ${scaledWidthPx} ${scaledHeightPx}`}
      >
        <defs>
          {/* Optional Physical Millimeter Dot Grid */}
          {gridVisible && (
            <pattern
              id="canvas-dot-grid"
              width={gridStepPx}
              height={gridStepPx}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={gridStepPx / 2}
                cy={gridStepPx / 2}
                r={Math.max(0.75 * zoom, 0.5)}
                fill="#cbd5e1"
              />
            </pattern>
          )}
        </defs>

        {/* Grid Layer */}
        {gridVisible && (
          <rect
            width="100%"
            height="100%"
            fill="url(#canvas-dot-grid)"
          />
        )}

        {/* Margin Guide Boundary (Dashed Blue-Gray Line) */}
        <rect
          x={marginLeftPx}
          y={marginTopPx}
          width={Math.max(0, scaledWidthPx - marginLeftPx - marginRightPx)}
          height={Math.max(0, scaledHeightPx - marginTopPx - marginBottomPx)}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity={0.6}
        />

        {/* Rendered Template Elements */}
        <g className="template-elements-layer">
          {sortedElements.map((element) => (
            <ElementRenderer
              key={element.id}
              element={element}
              zoom={zoom}
              assetResolver={assetResolver}
            />
          ))}
        </g>

        {/* Page Center Crosshair / Origin Indicator */}
        <g opacity={0.3} pointerEvents="none">
          <line x1={scaledWidthPx / 2 - 8} y1={scaledHeightPx / 2} x2={scaledWidthPx / 2 + 8} y2={scaledHeightPx / 2} stroke="#64748b" strokeWidth="1" />
          <line x1={scaledWidthPx / 2} y1={scaledHeightPx / 2 - 8} x2={scaledWidthPx / 2} y2={scaledHeightPx / 2 + 8} stroke="#64748b" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
};
