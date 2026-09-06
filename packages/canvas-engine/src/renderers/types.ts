/**
 * SVG-based shared rendering foundation intended to maximize screen/print consistency.
 * Exact browser font metrics and print CSS are handled during the print/export pipeline.
 */

import type { TemplateElement } from '@uts/core';

export interface RenderContext {
  zoom: number;
  dpi?: number;
  assetResolver?: (assetRef: string) => string | undefined;
}

export interface SvgElementDescriptor {
  tag: 'g' | 'text' | 'tspan' | 'rect' | 'circle' | 'ellipse' | 'line' | 'image' | 'path' | 'svg';
  attrs: Record<string, string | number | undefined>;
  children?: (SvgElementDescriptor | string)[];
  innerHTML?: string;
}

export interface ElementRenderer<T extends TemplateElement = TemplateElement> {
  render(element: T, context: RenderContext): SvgElementDescriptor;
  renderToString(element: T, context: RenderContext): string;
}

/**
 * Safely escapes characters for SVG/XML text nodes.
 */
export function escapeXmlText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Safely escapes characters for SVG/XML attribute values.
 */
export function escapeXmlAttr(val: string | number): string {
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts an SvgElementDescriptor to a valid SVG XML string.
 * Completely independent of React or DOM.
 */
export function svgDescriptorToString(node: SvgElementDescriptor | string): string {
  if (typeof node === 'string') {
    return escapeXmlText(node);
  }

  const { tag, attrs, children, innerHTML } = node;
  const attrEntries = Object.entries(attrs).filter(([, val]) => val !== undefined);
  const attrString = attrEntries
    .map(([key, val]) => `${key}="${escapeXmlAttr(val!)}"`)
    .join(' ');

  const openTag = attrString ? `<${tag} ${attrString}>` : `<${tag}>`;

  if (innerHTML) {
    return `${openTag}${innerHTML}</${tag}>`;
  }

  if (!children || children.length === 0) {
    return attrString ? `<${tag} ${attrString} />` : `<${tag} />`;
  }

  const renderedChildren = children.map(svgDescriptorToString).join('');
  return `${openTag}${renderedChildren}</${tag}>`;
}
