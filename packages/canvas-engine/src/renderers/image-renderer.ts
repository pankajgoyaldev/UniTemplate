import {
  mmToPx,
  DEFAULT_SCREEN_DPI,
  type ImageElement,
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
  const widthPx = mmToPx(element.bounds.width, dpi) * zoom;
  const heightPx = mmToPx(element.bounds.height, dpi) * zoom;

  // Resolve image source URL from assetRef via context resolver or direct href
  const href = context.assetResolver
    ? context.assetResolver(element.assetRef) || element.assetRef
    : element.assetRef;

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
      opacity: Math.max(0, Math.min(1, element.opacity)),
      'data-element-id': element.id,
      'data-element-type': 'image',
      'data-asset-ref': element.assetRef,
      'data-fit-mode': element.fit,
    },
  };

  if (element.bounds.rotation && element.bounds.rotation !== 0) {
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

