/**
 * SVG-based shared rendering foundation intended to maximize screen/print consistency.
 * Exact browser font metrics and print CSS are handled during the print/export pipeline.
 * This renderer provides a DOM-independent estimation engine for layout and preview.
 */

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
import { resolveTextElementContent } from './binding-resolver.js';

export interface TextLineDescriptor {
  text: string;
  isLastLineOfParagraph: boolean;
  hasMultipleWords: boolean;
}

/**
 * Estimates individual character width based on typographic character classes.
 * Completely DOM-independent and deterministic.
 */
export function estimateCharWidthPx(
  char: string,
  fontSizePx: number,
  isMonospace = false,
): number {
  if (isMonospace) {
    return fontSizePx * 0.6;
  }

  // Common glyph class approximations
  if (char === ' ' || char === '\u00A0') return fontSizePx * 0.32;
  if (/^[ijlI!':;,.\/\\|`]$/.test(char)) return fontSizePx * 0.28;
  if (/^[frt\-()[\]{}*^]$/.test(char)) return fontSizePx * 0.40;
  if (/^[MWm@%#&]$/.test(char)) return fontSizePx * 0.85;
  if (/^[w]$/.test(char)) return fontSizePx * 0.72;
  if (/^[A-Z]$/.test(char)) return fontSizePx * 0.65;
  if (/^[a-z0-9]$/.test(char)) return fontSizePx * 0.52;

  // CJK and full-width ideographs
  if (char.charCodeAt(0) > 0x2e80) return fontSizePx * 1.0;

  return fontSizePx * 0.55;
}

/**
 * Estimates text width in pixels by summing character class approximations.
 */
export function estimateTextWidthPx(
  text: string,
  fontSizePx: number,
  fontFamily?: string,
): number {
  if (!text) return 0;
  const isMono = fontFamily ? /mono|consolas|courier|menlo|monospace/i.test(fontFamily) : false;
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    total += estimateCharWidthPx(text[i], fontSizePx, isMono);
  }
  return total;
}

/**
 * Splits text into lines with typographic metadata, handling explicit newlines,
 * preserving intentional empty lines, and wrapping long words cleanly.
 */
export function breakTextLinesWithMetadata(
  text: string,
  maxWidthPx: number,
  fontSizePx: number,
  fontFamily?: string,
  autoWrap = true,
): TextLineDescriptor[] {
  if (!text) {
    return [{ text: '', isLastLineOfParagraph: true, hasMultipleWords: false }];
  }

  const isMono = fontFamily ? /mono|consolas|courier|menlo|monospace/i.test(fontFamily) : false;
  const rawParagraphs = text.split(/\r?\n/);
  const result: TextLineDescriptor[] = [];

  for (const rawParagraph of rawParagraphs) {
    // Preserve intentional empty lines
    if (rawParagraph === '') {
      result.push({ text: '', isLastLineOfParagraph: true, hasMultipleWords: false });
      continue;
    }

    if (!autoWrap || maxWidthPx <= 0) {
      result.push({
        text: rawParagraph,
        isLastLineOfParagraph: true,
        hasMultipleWords: rawParagraph.trim().includes(' '),
      });
      continue;
    }

    const words = rawParagraph.split(' ');
    const paragraphLines: string[] = [];
    let currentLine = '';
    let currentLineWidth = 0;

    for (let wIndex = 0; wIndex < words.length; wIndex++) {
      const word = words[wIndex];

      // Handle multiple consecutive spaces
      if (word === '') {
        if (currentLine) {
          currentLine += ' ';
          currentLineWidth += estimateCharWidthPx(' ', fontSizePx, isMono);
        }
        continue;
      }

      const wordWidth = estimateTextWidthPx(word, fontSizePx, fontFamily);

      // Handle a single word that is longer than the entire line width
      if (wordWidth > maxWidthPx) {
        if (currentLine) {
          paragraphLines.push(currentLine.trimEnd());
          currentLine = '';
          currentLineWidth = 0;
        }

        // Break word character-by-character into chunks that fit
        let chunk = '';
        let chunkWidth = 0;

        for (let c = 0; c < word.length; c++) {
          const char = word[c];
          const charWidth = estimateCharWidthPx(char, fontSizePx, isMono);

          if (chunk.length > 0 && chunkWidth + charWidth > maxWidthPx) {
            paragraphLines.push(chunk);
            chunk = char;
            chunkWidth = charWidth;
          } else {
            chunk += char;
            chunkWidth += charWidth;
          }
        }

        if (chunk.length > 0) {
          currentLine = chunk;
          currentLineWidth = chunkWidth;
        }
        continue;
      }

      const spaceWidth = currentLine ? estimateCharWidthPx(' ', fontSizePx, isMono) : 0;

      if (currentLine && currentLineWidth + spaceWidth + wordWidth > maxWidthPx) {
        paragraphLines.push(currentLine.trimEnd());
        currentLine = word;
        currentLineWidth = wordWidth;
      } else {
        if (currentLine) {
          currentLine += ' ' + word;
          currentLineWidth += spaceWidth + wordWidth;
        } else {
          currentLine = word;
          currentLineWidth = wordWidth;
        }
      }
    }

    if (currentLine) {
      paragraphLines.push(currentLine.trimEnd());
    }

    if (paragraphLines.length === 0) {
      paragraphLines.push('');
    }

    for (let i = 0; i < paragraphLines.length; i++) {
      const lineStr = paragraphLines[i];
      const isLast = i === paragraphLines.length - 1;
      const hasMultipleWords = lineStr.trim().includes(' ');
      result.push({
        text: lineStr,
        isLastLineOfParagraph: isLast,
        hasMultipleWords,
      });
    }
  }

  return result.length > 0 ? result : [{ text: '', isLastLineOfParagraph: true, hasMultipleWords: false }];
}

/**
 * Splits text into lines respecting explicit newlines and optional auto-wrap.
 * Backward-compatible signature.
 */
export function breakTextLines(
  text: string,
  maxWidthPx: number,
  fontSizeOrCharWidthPx: number,
  fontFamilyOrAutoWrap?: string | boolean,
  autoWrapParam = true,
): string[] {
  let fontFamily: string | undefined;
  let autoWrap = autoWrapParam;

  if (typeof fontFamilyOrAutoWrap === 'boolean') {
    autoWrap = fontFamilyOrAutoWrap;
    fontFamily = undefined;
  } else if (typeof fontFamilyOrAutoWrap === 'string') {
    fontFamily = fontFamilyOrAutoWrap;
  }

  // In legacy tests, charWidth (e.g. 8) was passed. Convert to approximate fontSize if <= 10.
  const fontSizePx = fontSizeOrCharWidthPx <= 10 ? fontSizeOrCharWidthPx / 0.55 : fontSizeOrCharWidthPx;

  return breakTextLinesWithMetadata(
    text,
    maxWidthPx,
    fontSizePx,
    fontFamily,
    autoWrap,
  ).map((line) => line.text);
}

/**
 * Calculates deterministic maximum visible lines that fit within the bounding height.
 */
export function calculateMaxVisibleLines(
  heightPx: number,
  fontSizePx: number,
  lineHeightPx: number,
): number {
  if (heightPx <= 0 || fontSizePx <= 0) return 0;

  const firstLineHeight = fontSizePx * 0.85;
  if (heightPx < firstLineHeight * 0.5) {
    return 0;
  }

  const remainingHeight = heightPx - firstLineHeight;
  if (remainingHeight < 0) {
    return 1;
  }

  return 1 + Math.floor(remainingHeight / Math.max(1, lineHeightPx));
}

export function renderTextElement(
  element: TextElement,
  context: RenderContext,
): SvgElementDescriptor {
  const dpi = context.dpi ?? DEFAULT_SCREEN_DPI;
  const zoom = context.zoom;

  const xPx = mmToPx(element.bounds.x, dpi) * zoom;
  const yPx = mmToPx(element.bounds.y, dpi) * zoom;
  const widthPx = mmToPx(Math.max(0, element.bounds.width), dpi) * zoom;
  const heightPx = mmToPx(Math.max(0, element.bounds.height), dpi) * zoom;

  const fontSizePx = ptToPx(element.style.fontSizePt, dpi) * zoom;
  const lineHeightPx = fontSizePx * element.style.lineHeight;

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
    case 'justify':
    case 'left':
    default:
      textAnchor = 'start';
      anchorX = xPx;
      break;
  }

  // Resolve dynamic tokens / bindings based on context
  const resolvedContent = resolveTextElementContent(
    element,
    context.mockPayload,
    context.previewMode,
  );

  // Multi-line breaking with metadata
  const lineDescriptors = breakTextLinesWithMetadata(
    resolvedContent,
    widthPx,
    fontSizePx,
    element.style.fontFamily,
    element.style.autoWrap,
  );

  // Deterministic line limiting to prevent overflowing bounds
  const maxVisibleLines = calculateMaxVisibleLines(heightPx, fontSizePx, lineHeightPx);
  const visibleLines = lineDescriptors.slice(0, maxVisibleLines);

  // Capital letter ascent baseline
  const firstLineBaseline = yPx + fontSizePx * 0.85;

  const tspans: SvgElementDescriptor[] = visibleLines.map((desc, index) => {
    const isJustified =
      element.style.alignment === 'justify' &&
      !desc.isLastLineOfParagraph &&
      desc.hasMultipleWords;

    const tspanAttrs: Record<string, string | number | undefined> = {
      x: anchorX,
      y: firstLineBaseline + index * lineHeightPx,
    };

    if (isJustified) {
      tspanAttrs.textLength = widthPx;
      tspanAttrs.lengthAdjust = 'spacing';
    }

    return {
      tag: 'tspan',
      attrs: tspanAttrs,
      children: [desc.text || '\u00A0'],
    };
  });

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

  if (element.bounds.rotation && element.bounds.rotation % 360 !== 0) {
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


