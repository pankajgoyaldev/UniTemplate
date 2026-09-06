import React, { useMemo } from 'react';
import { calculateRulerTicks, type Point } from '@uts/canvas-engine';

export const RULER_THICKNESS = 24; // Thickness of the ruler in screen CSS pixels

interface HorizontalRulerProps {
  panX: number;
  zoom: number;
  width: number;
  cursorPosScreen?: Point | null;
}

export const HorizontalRuler: React.FC<HorizontalRulerProps> = ({
  panX,
  zoom,
  width,
  cursorPosScreen,
}) => {
  const ticks = useMemo(() => {
    return calculateRulerTicks(panX, zoom, width);
  }, [panX, zoom, width]);

  return (
    <svg
      className="absolute top-0 left-0 w-full h-[24px] pointer-events-none select-none bg-studio-panel border-b border-studio-border"
      style={{ width, height: RULER_THICKNESS }}
    >
      {/* Ticks & Labels */}
      {ticks.map((tick, idx) => {
        if (tick.screenPositionPx < 0 || tick.screenPositionPx > width) return null;

        if (tick.type === 'major') {
          return (
            <g key={`htick-${idx}`} transform={`translate(${tick.screenPositionPx}, 0)`}>
              <line x1="0" y1={RULER_THICKNESS - 12} x2="0" y2={RULER_THICKNESS} stroke="#71717a" strokeWidth="1" />
              {tick.label && (
                <text
                  x="3"
                  y="11"
                  fill="#a1a1aa"
                  fontSize="9"
                  fontFamily="Inter, system-ui, sans-serif"
                  textAnchor="start"
                >
                  {tick.label}
                </text>
              )}
            </g>
          );
        }

        if (tick.type === 'medium') {
          return (
            <line
              key={`htick-${idx}`}
              x1={tick.screenPositionPx}
              y1={RULER_THICKNESS - 7}
              x2={tick.screenPositionPx}
              y2={RULER_THICKNESS}
              stroke="#52525b"
              strokeWidth="1"
            />
          );
        }

        return (
          <line
            key={`htick-${idx}`}
            x1={tick.screenPositionPx}
            y1={RULER_THICKNESS - 4}
            x2={tick.screenPositionPx}
            y2={RULER_THICKNESS}
            stroke="#3f3f46"
            strokeWidth="1"
          />
        );
      })}

      {/* Live Cursor Indicator */}
      {cursorPosScreen && cursorPosScreen.x >= 0 && cursorPosScreen.x <= width && (
        <line
          x1={cursorPosScreen.x}
          y1="0"
          x2={cursorPosScreen.x}
          y2={RULER_THICKNESS}
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
};

interface VerticalRulerProps {
  panY: number;
  zoom: number;
  height: number;
  cursorPosScreen?: Point | null;
}

export const VerticalRuler: React.FC<VerticalRulerProps> = ({
  panY,
  zoom,
  height,
  cursorPosScreen,
}) => {
  const ticks = useMemo(() => {
    return calculateRulerTicks(panY, zoom, height);
  }, [panY, zoom, height]);

  return (
    <svg
      className="absolute top-0 left-0 w-[24px] h-full pointer-events-none select-none bg-studio-panel border-r border-studio-border"
      style={{ width: RULER_THICKNESS, height }}
    >
      {/* Ticks & Labels */}
      {ticks.map((tick, idx) => {
        if (tick.screenPositionPx < 0 || tick.screenPositionPx > height) return null;

        if (tick.type === 'major') {
          return (
            <g key={`vtick-${idx}`} transform={`translate(0, ${tick.screenPositionPx})`}>
              <line x1={RULER_THICKNESS - 12} y1="0" x2={RULER_THICKNESS} y2="0" stroke="#71717a" strokeWidth="1" />
              {tick.label && (
                <text
                  x="2"
                  y="-3"
                  fill="#a1a1aa"
                  fontSize="9"
                  fontFamily="Inter, system-ui, sans-serif"
                  transform="rotate(-90 2 -3)"
                  textAnchor="end"
                >
                  {tick.label}
                </text>
              )}
            </g>
          );
        }

        if (tick.type === 'medium') {
          return (
            <line
              key={`vtick-${idx}`}
              x1={RULER_THICKNESS - 7}
              y1={tick.screenPositionPx}
              x2={RULER_THICKNESS}
              y2={tick.screenPositionPx}
              stroke="#52525b"
              strokeWidth="1"
            />
          );
        }

        return (
          <line
            key={`vtick-${idx}`}
            x1={RULER_THICKNESS - 4}
            y1={tick.screenPositionPx}
            x2={RULER_THICKNESS}
            y2={tick.screenPositionPx}
            stroke="#3f3f46"
            strokeWidth="1"
          />
        );
      })}

      {/* Live Cursor Indicator */}
      {cursorPosScreen && cursorPosScreen.y >= 0 && cursorPosScreen.y <= height && (
        <line
          x1="0"
          y1={cursorPosScreen.y}
          x2={RULER_THICKNESS}
          y2={cursorPosScreen.y}
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
};

export const RulerCorner: React.FC = () => (
  <div
    className="absolute top-0 left-0 z-20 flex items-center justify-center bg-studio-panel border-r border-b border-studio-border text-[9px] font-mono text-studio-muted cursor-default"
    style={{ width: RULER_THICKNESS, height: RULER_THICKNESS }}
  >
    mm
  </div>
);
