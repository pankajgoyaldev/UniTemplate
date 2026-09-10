/**
 * SVG-based shared rendering foundation intended to maximize screen/print consistency.
 * Exact browser font metrics and print CSS are handled during the print/export pipeline.
 */

import {
  mmToPx,
  DEFAULT_SCREEN_DPI,
  type ImageElement,
  type TraceBackground,
} from '@uts/core';
import {
  svgDescriptorToString,
  type RenderContext,
  type SvgElementDescriptor,
} from './types.js';

export function getSvgPreserveAspectRatio(fit: 'contain' | 'cover' | 'stretch'): string {
  switch (fit) {
    case 'cover':
      return 'xMidYMid slice';
    case 'stretch':
      return 'none';
    case 'contain':
    default:
      return 'xMidYMid meet';
  }
}

export function renderImageElement(
  element: ImageElement,
  context: RenderContext,
): SvgElementDescriptor {
  const dpi = context.dpi ?? DEFAULT_SCREEN_DPI;
  const zoom = context.zoom;

  const xPx = mmToPx(element.bounds.x, dpi) * zoom;
  const yPx = mmToPx(element.bounds.y, dpi) * zoom;
  const widthPx = Math.max(0, mmToPx(element.bounds.width, dpi) * zoom);
  const heightPx = Math.max(0, mmToPx(element.bounds.height, dpi) * zoom);

  // Resolve image source URL from assetRef via context resolver or direct href
  const rawRef = (element.assetRef ?? '').trim();
  let href = rawRef;

  if (context.assetResolver && rawRef) {
    try {
      const resolved = context.assetResolver(rawRef);
      if (resolved !== undefined && resolved !== null) {
        href = resolved;
      }
    } catch {
      // Safe fallback on resolver error
      href = rawRef;
    }
  }

  // Strictly clamp opacity between 0.0 and 1.0, handling NaN
  const rawOpacity = typeof element.opacity === 'number' && Number.isFinite(element.opacity)
    ? element.opacity
    : 1;
  const opacity = Math.max(0, Math.min(1, rawOpacity));

  const preserveAspectRatio = getSvgPreserveAspectRatio(element.fit);

  const imageNode: SvgElementDescriptor = {
    tag: 'image',
    attrs: {
      x: xPx,
      y: yPx,
      width: widthPx,
      height: heightPx,
      href,
      preserveAspectRatio,
      opacity,
      'data-element-id': element.id,
      'data-element-type': 'image',
      'data-asset-ref': element.assetRef,
      'data-fit-mode': element.fit,
    },
  };

  if (element.bounds.rotation && element.bounds.rotation % 360 !== 0) {
    const centerX = xPx + widthPx / 2;
    const centerY = yPx + heightPx / 2;
    return {
      tag: 'g',
      attrs: {
        transform: `rotate(${element.bounds.rotation} ${centerX} ${centerY})`,
      },
      children: [imageNode],
    };
  }

  return imageNode;
}

export function renderImageElementToString(
  element: ImageElement,
  context: RenderContext,
): string {
  return svgDescriptorToString(renderImageElement(element, context));
}

export interface TraceBackgroundRenderOptions {
  traceBackground: TraceBackground;
  traceUrl: string;
  pageWidthMm: number;
  pageHeightMm: number;
  zoom?: number;
  dpi?: number;
}

/**
 * Generates an SVG element descriptor for a trace background layer.
 * The trace background is locked to page dimensions with pointer-events: none.
 */
export function renderTraceBackgroundDescriptor(
  options: TraceBackgroundRenderOptions,
): SvgElementDescriptor | null {
  if (!options.traceBackground.enabled || !options.traceUrl) {
    return null;
  }
  const dpi = options.dpi ?? DEFAULT_SCREEN_DPI;
  const zoom = options.zoom ?? 1.0;
  const scaledWidthPx = mmToPx(options.pageWidthMm, dpi) * zoom;
  const scaledHeightPx = mmToPx(options.pageHeightMm, dpi) * zoom;
  const opacity = Math.max(0, Math.min(1, options.traceBackground.opacity ?? 1));

  return {
    tag: 'image',
    attrs: {
      href: options.traceUrl,
      x: 0,
      y: 0,
      width: scaledWidthPx,
      height: scaledHeightPx,
      preserveAspectRatio: 'xMidYMid meet',
      opacity,
      style: 'pointer-events: none',
    },
    children: [],
  };
}

/**
 * Generates an SVG string representation of a trace background layer.
 */
export function renderTraceBackgroundToString(
  options: TraceBackgroundRenderOptions,
): string {
  const desc = renderTraceBackgroundDescriptor(options);
  return desc ? svgDescriptorToString(desc) : '';
}


