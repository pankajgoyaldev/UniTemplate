import {
  mmToPx,
  ptToPx,
  DEFAULT_SCREEN_DPI,
  type TextElement,
} from '@uts/core';
import {
  svgDescriptorToString,
  type RenderContext,
  type SvgElementDescriptor,
} from './types.js';

/**
 * Splits text into lines respecting explicit newlines and optional auto-wrap.
 */
export function breakTextLines(
  text: string,
  maxWidthPx: number,
  approxCharWidthPx: number,
  autoWrap = true,
): string[] {
  if (!text) return [''];

  const rawLines = text.split(/\r?\n/);
  if (!autoWrap || maxWidthPx <= 0) {
    return rawLines;
  }

  const wrappedLines: string[] = [];
  const maxCharsPerLine = Math.max(1, Math.floor(maxWidthPx / approxCharWidthPx));

  for (const rawLine of rawLines) {
    if (rawLine.length <= maxCharsPerLine) {
      wrappedLines.push(rawLine);
      continue;
    }

    const words = rawLine.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        currentLine = word;
      } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
        currentLine += ' ' + word;
      } else {
        wrappedLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      wrappedLines.push(currentLine);
    }
  }

  return wrappedLines.length > 0 ? wrappedLines : [''];
}

export function renderTextElement(
  element: TextElement,
  context: RenderContext,
): SvgElementDescriptor {
  const dpi = context.dpi ?? DEFAULT_SCREEN_DPI;
  const zoom = context.zoom;

  const xPx = mmToPx(element.bounds.x, dpi) * zoom;
  const yPx = mmToPx(element.bounds.y, dpi) * zoom;
  const widthPx = mmToPx(element.bounds.width, dpi) * zoom;
  const heightPx = mmToPx(element.bounds.height, dpi) * zoom;

  const fontSizePx = ptToPx(element.style.fontSizePt, dpi) * zoom;
  const lineHeightPx = fontSizePx * element.style.lineHeight;
  const approxCharWidthPx = fontSizePx * 0.55;

  // Text anchor and base horizontal anchor coordinate
  let textAnchor: 'start' | 'middle' | 'end' = 'start';
  let anchorX = xPx;

  switch (element.style.alignment) {
    case 'center':
      textAnchor = 'middle';
      anchorX = xPx + widthPx / 2;
      break;
    case 'right':
      textAnchor = 'end';
      anchorX = xPx + widthPx;
      break;
    case 'left':
    case 'justify':
    default:
      textAnchor = 'start';
      anchorX = xPx;
      break;
  }

  // Multi-line breaking
  const lines = breakTextLines(
    element.content,
    widthPx,
    approxCharWidthPx,
    element.style.autoWrap,
  );

  // Capital letter ascent baseline
  const firstLineBaseline = yPx + fontSizePx * 0.85;

  const tspans: SvgElementDescriptor[] = lines.map((line, index) => ({
    tag: 'tspan',
    attrs: {
      x: anchorX,
      y: firstLineBaseline + index * lineHeightPx,
    },
    children: [line || ' '],
  }));

  const textNode: SvgElementDescriptor = {
    tag: 'text',
    attrs: {
      'font-family': element.style.fontFamily,
      'font-size': fontSizePx,
      'font-weight': element.style.fontWeight,
      'font-style': element.style.fontStyle,
      fill: element.style.color,
      'text-anchor': textAnchor,
      'letter-spacing': element.style.letterSpacingPt
        ? `${ptToPx(element.style.letterSpacingPt, dpi) * zoom}px`
        : undefined,
      'data-element-id': element.id,
      'data-element-type': 'text',
    },
    children: tspans,
  };

  if (element.bounds.rotation && element.bounds.rotation !== 0) {
    const centerX = xPx + widthPx / 2;
    const centerY = yPx + heightPx / 2;
    return {
      tag: 'g',
      attrs: {
        transform: `rotate(${element.bounds.rotation} ${centerX} ${centerY})`,
      },
      children: [textNode],
    };
  }

  return textNode;
}

export function renderTextElementToString(
  element: TextElement,
  context: RenderContext,
): string {
  return svgDescriptorToString(renderTextElement(element, context));
}

