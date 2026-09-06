import type { TemplateElement } from '@uts/core';
import type { RenderContext, SvgElementDescriptor } from './types.js';
import { renderTextElement } from './text-renderer.js';
import { renderShapeElement } from './shape-renderer.js';
import { renderImageElement } from './image-renderer.js';
import { renderBarcodeElement } from './barcode-renderer.js';
import { svgDescriptorToString } from './types.js';

/**
 * Dispatches any TemplateElement to its specific SVG renderer.
 */
export function renderElement(
  element: TemplateElement,
  context: RenderContext,
): SvgElementDescriptor {
  if (!element.isVisible) {
    return {
      tag: 'g',
      attrs: {
        display: 'none',
        'data-element-id': element.id,
      },
    };
  }

  switch (element.type) {
    case 'text':
      return renderTextElement(element, context);
    case 'shape':
      return renderShapeElement(element, context);
    case 'image':
      return renderImageElement(element, context);
    case 'barcode':
      return renderBarcodeElement(element, context);
    default:
      return {
        tag: 'g',
        attrs: {
          'data-unsupported-type': (element as any).type,
        },
      };
  }
}

/**
 * Converts a TemplateElement to a clean SVG XML string.
 */
export function renderElementToString(
  element: TemplateElement,
  context: RenderContext,
): string {
  return svgDescriptorToString(renderElement(element, context));
}

/**
 * Renders an array of elements sorted by zIndex ascending.
 */
export function renderTemplateElements(
  elements: TemplateElement[],
  context: RenderContext,
): SvgElementDescriptor[] {
  // Sort elements by zIndex ascending (lower zIndex rendered first, higher on top)
  const sorted = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  return sorted.map((el) => renderElement(el, context));
}

/**
 * Renders multiple elements directly to an SVG fragment string.
 */
export function renderTemplateElementsToString(
  elements: TemplateElement[],
  context: RenderContext,
): string {
  return renderTemplateElements(elements, context)
    .map(svgDescriptorToString)
    .join('\n');
}

