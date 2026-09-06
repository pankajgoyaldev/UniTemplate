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
  if (!dashType || dashType === 'solid') return undefined;
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
  const widthPx = mmToPx(element.bounds.width, dpi) * zoom;
  const heightPx = mmToPx(element.bounds.height, dpi) * zoom;

  const strokeWidthPx = mmToPx(element.strokeWidthMm, dpi) * zoom;
  const cornerRadiusPx = mmToPx(element.cornerRadiusMm ?? 0, dpi) * zoom;
  const strokeDasharray = getStrokeDashArray(element.strokeDash, strokeWidthPx);

  const commonAttrs: Record<string, string | number | undefined> = {
    fill: element.fillColor,
    stroke: element.strokeColor,
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

  if (element.bounds.rotation && element.bounds.rotation !== 0) {
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

