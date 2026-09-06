/**
 * SVG-based shared rendering foundation intended to maximize screen/print consistency.
 * Exact browser font metrics and print CSS are handled during the print/export pipeline.
 */

import {
  mmToPx,
  DEFAULT_SCREEN_DPI,
  type ShapeElement,
} from '@uts/core';
import {
  svgDescriptorToString,
  type RenderContext,
  type SvgElementDescriptor,
} from './types.js';

export function getStrokeDashArray(
  dashType: 'solid' | 'dashed' | 'dotted' | undefined,
  strokeWidthPx: number,
): string | undefined {
  if (!dashType || dashType === 'solid' || strokeWidthPx <= 0) return undefined;
  if (dashType === 'dashed') {
    return `${Math.max(4, strokeWidthPx * 4)} ${Math.max(2, strokeWidthPx * 2)}`;
  }
  if (dashType === 'dotted') {
    return `${Math.max(1, strokeWidthPx)} ${Math.max(2, strokeWidthPx * 2)}`;
  }
  return undefined;
}

export function renderShapeElement(
  element: ShapeElement,
  context: RenderContext,
): SvgElementDescriptor {
  const dpi = context.dpi ?? DEFAULT_SCREEN_DPI;
  const zoom = context.zoom;

  const xPx = mmToPx(element.bounds.x, dpi) * zoom;
  const yPx = mmToPx(element.bounds.y, dpi) * zoom;
  const widthPx = Math.max(0, mmToPx(element.bounds.width, dpi) * zoom);
  const heightPx = Math.max(0, mmToPx(element.bounds.height, dpi) * zoom);

  const strokeWidthPx = Math.max(0, mmToPx(element.strokeWidthMm, dpi) * zoom);
  const maxCornerRadius = Math.min(widthPx, heightPx) / 2;
  const rawCornerRadiusPx = mmToPx(element.cornerRadiusMm ?? 0, dpi) * zoom;
  const cornerRadiusPx = Math.max(0, Math.min(rawCornerRadiusPx, maxCornerRadius));
  const strokeDasharray = getStrokeDashArray(element.strokeDash, strokeWidthPx);

  const commonAttrs: Record<string, string | number | undefined> = {
    fill: element.fillColor,
    stroke: strokeWidthPx > 0 ? element.strokeColor : 'none',
    'stroke-width': strokeWidthPx,
    'stroke-dasharray': strokeDasharray,
    'data-element-id': element.id,
    'data-element-type': 'shape',
    'data-shape-type': element.shapeType,
  };

  let shapeNode: SvgElementDescriptor;

  switch (element.shapeType) {
    case 'rectangle':
      shapeNode = {
        tag: 'rect',
        attrs: {
          x: xPx,
          y: yPx,
          width: widthPx,
          height: heightPx,
          ...commonAttrs,
        },
      };
      break;

    case 'rounded-rectangle':
      shapeNode = {
        tag: 'rect',
        attrs: {
          x: xPx,
          y: yPx,
          width: widthPx,
          height: heightPx,
          rx: cornerRadiusPx,
          ry: cornerRadiusPx,
          ...commonAttrs,
        },
      };
      break;

    case 'ellipse':
      shapeNode = {
        tag: 'ellipse',
        attrs: {
          cx: xPx + widthPx / 2,
          cy: yPx + heightPx / 2,
          rx: Math.max(0, widthPx / 2),
          ry: Math.max(0, heightPx / 2),
          ...commonAttrs,
        },
      };
      break;

    case 'line':
      shapeNode = {
        tag: 'line',
        attrs: {
          x1: xPx,
          y1: yPx,
          x2: xPx + widthPx,
          y2: yPx + heightPx,
          ...commonAttrs,
        },
      };
      break;
  }

  if (element.bounds.rotation && element.bounds.rotation % 360 !== 0) {
    const centerX = xPx + widthPx / 2;
    const centerY = yPx + heightPx / 2;
    return {
      tag: 'g',
      attrs: {
        transform: `rotate(${element.bounds.rotation} ${centerX} ${centerY})`,
      },
      children: [shapeNode],
    };
  }

  return shapeNode;
}

export function renderShapeElementToString(
  element: ShapeElement,
  context: RenderContext,
): string {
  return svgDescriptorToString(renderShapeElement(element, context));
}


