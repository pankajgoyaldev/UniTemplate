import React from 'react';
import type { TemplateElement } from '@uts/core';
import {
  renderElement,
  type SvgElementDescriptor,
  type RenderContext,
} from '@uts/canvas-engine';

interface ElementRendererProps {
  element: TemplateElement;
  zoom: number;
  assetResolver?: (assetRef: string) => string | undefined;
}

/**
 * Converts an SvgElementDescriptor recursively into React SVG JSX.
 */
function renderDescriptorToJsx(
  node: SvgElementDescriptor | string,
  key: string,
): React.ReactNode {
  if (typeof node === 'string') {
    return node;
  }

  const { tag, attrs, children, innerHTML } = node;

  // Transform attribute names for React SVG JSX (e.g. stroke-width -> strokeWidth)
  const reactProps: Record<string, any> = { key };

  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue;

    if (k === 'stroke-width') reactProps.strokeWidth = v;
    else if (k === 'stroke-dasharray') reactProps.strokeDasharray = v;
    else if (k === 'font-family') reactProps.fontFamily = v;
    else if (k === 'font-size') reactProps.fontSize = v;
    else if (k === 'font-weight') reactProps.fontWeight = v;
    else if (k === 'font-style') reactProps.fontStyle = v;
    else if (k === 'text-anchor') reactProps.textAnchor = v;
    else if (k === 'letter-spacing') reactProps.letterSpacing = v;
    else if (k === 'preserveAspectRatio') reactProps.preserveAspectRatio = v;
    else if (k === 'textLength') reactProps.textLength = v;
    else if (k === 'lengthAdjust') reactProps.lengthAdjust = v;
    else reactProps[k] = v;
  }

  if (innerHTML) {
    reactProps.dangerouslySetInnerHTML = { __html: innerHTML };
    return React.createElement(tag, reactProps);
  }

  const renderedChildren = children?.map((child, index) =>
    renderDescriptorToJsx(child, `${key}-${index}`),
  );

  return React.createElement(tag, reactProps, renderedChildren);
}

export const ElementRenderer: React.FC<ElementRendererProps> = ({
  element,
  zoom,
  assetResolver,
}) => {
  const context: RenderContext = {
    zoom,
    dpi: 96,
    assetResolver,
  };

  const descriptor = renderElement(element, context);
  return <>{renderDescriptorToJsx(descriptor, `el-${element.id}`)}</>;
};

