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
 * Converts an SvgElementDescriptor to a valid SVG XML string.
 * Completely independent of React or DOM.
 */
export function svgDescriptorToString(node: SvgElementDescriptor | string): string {
  if (typeof node === 'string') {
    return node;
  }

  const { tag, attrs, children, innerHTML } = node;
  const attrEntries = Object.entries(attrs).filter(([, val]) => val !== undefined);
  const attrString = attrEntries
    .map(([key, val]) => `${key}="${String(val).replace(/"/g, '&quot;')}"`)
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
