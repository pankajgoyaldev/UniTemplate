/**
 * SVG-based shared rendering foundation intended to maximize screen/print consistency.
 * Exact browser font metrics and print CSS are handled during the print/export pipeline.
 * Isolated barcode generation engine wrapping bwip-js.
 */

import bwipjs from 'bwip-js';
import {
  mmToPx,
  DEFAULT_SCREEN_DPI,
  type BarcodeElement,
  type BarcodeType,
} from '@uts/core';
import {
  escapeXmlText,
  svgDescriptorToString,
  type RenderContext,
  type SvgElementDescriptor,
} from './types.js';

export interface BarcodeVectorOutput {
  rawSvg: string;
  viewBox: string;
  innerContent: string;
}

/**
 * Lightweight SVG sanitizer ensuring no executable script or malicious handler
 * exists in barcode inner content.
 */
export function sanitizeSvgContent(rawSvg: string): string {
  if (!rawSvg) return '';
  return rawSvg
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/href\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, 'href=""');
}

/**
 * Maps AST BarcodeType to bwip-js barcode format identifier.
 */
export function mapBarcodeTypeToBcid(type: BarcodeType): string {
  switch (type) {
    case 'code128':
      return 'code128';
    case 'ean13':
      return 'ean13';
    case 'upca':
      return 'upca';
    case 'code39':
      return 'code39';
    case 'qr':
      return 'qrcode';
    case 'datamatrix':
      return 'datamatrix';
    default:
      return 'code128';
  }
}

/**
 * Generates an SVG vector barcode representation using bwip-js.
 * Fully isolated behind this function with graceful error fallback and sanitization.
 */
export function generateBarcodeVector(element: BarcodeElement): BarcodeVectorOutput {
  const bcid = mapBarcodeTypeToBcid(element.barcodeType);
  const text = element.content !== undefined && element.content !== null ? String(element.content) : '';

  try {
    const toSvgFn = (bwipjs as any).default?.toSVG || (bwipjs as any).toSVG || (bwipjs as any);

    const is2D = element.barcodeType === 'qr' || element.barcodeType === 'datamatrix';
    const options: Record<string, any> = {
      bcid,
      text: text || '000000',
      scale: 3,
      includetext: !is2D && Boolean(element.showText),
      textxalign: 'center',
    };

    if (element.barcodeType === 'qr' && element.errorCorrectionLevel) {
      options.eclevel = element.errorCorrectionLevel;
    }

    const rawSvg: string = toSvgFn(options);

    // Extract viewBox="x y w h" from raw SVG string
    const viewBoxMatch = rawSvg.match(/viewBox="([^"]+)"/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100';

    // Extract inner content inside <svg ...>...</svg>
    const innerMatch = rawSvg.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const innerContent = sanitizeSvgContent(innerMatch || rawSvg);

    return {
      rawSvg,
      viewBox,
      innerContent,
    };
  } catch (err) {
    // Fallback placeholder on encoding error (e.g. invalid EAN-13 checksum, bad characters)
    const rawError = (err as Error).message || 'Barcode Error';
    const errorMsg = escapeXmlText(rawError);
    const fallbackSvg = `<rect width="100%" height="100%" fill="#fee2e2" stroke="#ef4444" stroke-width="1"/><text x="50%" y="50%" fill="#dc2626" font-size="8" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${errorMsg}</text>`;
    return {
      rawSvg: `<svg viewBox="0 0 100 50">${fallbackSvg}</svg>`,
      viewBox: '0 0 100 50',
      innerContent: fallbackSvg,
    };
  }
}

export function renderBarcodeElement(
  element: BarcodeElement,
  context: RenderContext,
): SvgElementDescriptor {
  const dpi = context.dpi ?? DEFAULT_SCREEN_DPI;
  const zoom = context.zoom;

  const xPx = mmToPx(element.bounds.x, dpi) * zoom;
  const yPx = mmToPx(element.bounds.y, dpi) * zoom;
  const widthPx = Math.max(0, mmToPx(element.bounds.width, dpi) * zoom);
  const heightPx = Math.max(0, mmToPx(element.bounds.height, dpi) * zoom);

  const { viewBox, innerContent } = generateBarcodeVector(element);

  // QR and DataMatrix are always square aspect ratio; 1D barcodes can fill horizontally
  const is2D = element.barcodeType === 'qr' || element.barcodeType === 'datamatrix';
  const preserveAspectRatio = is2D ? 'xMidYMid meet' : 'none';

  const svgNode: SvgElementDescriptor = {
    tag: 'svg',
    attrs: {
      x: xPx,
      y: yPx,
      width: widthPx,
      height: heightPx,
      viewBox,
      preserveAspectRatio,
      'data-element-id': element.id,
      'data-element-type': 'barcode',
      'data-barcode-type': element.barcodeType,
    },
    innerHTML: innerContent,
  };

  if (element.bounds.rotation && element.bounds.rotation % 360 !== 0) {
    const centerX = xPx + widthPx / 2;
    const centerY = yPx + heightPx / 2;
    return {
      tag: 'g',
      attrs: {
        transform: `rotate(${element.bounds.rotation} ${centerX} ${centerY})`,
      },
      children: [svgNode],
    };
  }

  return svgNode;
}

export function renderBarcodeElementToString(
  element: BarcodeElement,
  context: RenderContext,
): string {
  return svgDescriptorToString(renderBarcodeElement(element, context));
}


