import {
  roundPrecision,
  type TemplateElement,
  type TextElement,
  type ShapeElement,
  BarcodeElement,
  type ImageElement,
  type PageSettings,
} from '@uts/core';
import { screenToCanvas, type ViewportState } from '@uts/canvas-engine';

export type InsertableElementType =
  | 'text'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'ellipse'
  | 'line'
  | 'barcode'
  | 'qr'
  | 'image';

export interface PlacementOptions {
  pageSettings: PageSettings;
  viewport?: Pick<
    ViewportState,
    'zoom' | 'panX' | 'panY' | 'viewportWidth' | 'viewportHeight'
  >;
  existingElements?: TemplateElement[];
  snapToGrid?: boolean;
  gridSizeMm?: number;
}

export const PLACEHOLDER_IMAGE_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><rect width="100" height="80" fill="%23f1f5f9" stroke="%23cbd5e1" stroke-width="2"/><path d="M15 65 L35 35 L55 55 L70 40 L85 65 Z" fill="%2394a3b8"/><circle cx="30" cy="25" r="8" fill="%2394a3b8"/></svg>';

let elementCounter = 1;

export function generateElementId(prefix: string): string {
  return `el_${prefix}_${Date.now()}_${elementCounter++}`;
}

/**
 * Calculates a sensible placement for a new element within the visible canvas.
 * Centers the element within the visible viewport (if available) and strictly
 * clamps it to page boundaries / margins.
 */
export function calculateInitialBounds(
  width: number,
  height: number,
  options: PlacementOptions,
): { x: number; y: number; width: number; height: number; rotation: number } {
  const {
    pageSettings,
    viewport,
    existingElements = [],
    snapToGrid = false,
    gridSizeMm = 10,
  } = options;

  let candidateX: number;
  let candidateY: number;

  if (
    viewport &&
    viewport.viewportWidth > 0 &&
    viewport.viewportHeight > 0 &&
    Number.isFinite(viewport.zoom) &&
    viewport.zoom > 0
  ) {
    const centerScreenPx = {
      x: viewport.viewportWidth / 2,
      y: viewport.viewportHeight / 2,
    };
    const centerMm = screenToCanvas(centerScreenPx, viewport);

    // If center of viewport is within reasonable page proximity, use it; otherwise fallback to page center
    const isNearby =
      centerMm.x >= -50 &&
      centerMm.x <= pageSettings.width + 50 &&
      centerMm.y >= -50 &&
      centerMm.y <= pageSettings.height + 50;

    if (isNearby) {
      candidateX = centerMm.x - width / 2;
      candidateY = centerMm.y - height / 2;
    } else {
      candidateX = (pageSettings.width - width) / 2;
      candidateY = (pageSettings.height - height) / 2;
    }
  } else {
    candidateX = (pageSettings.width - width) / 2;
    candidateY = (pageSettings.height - height) / 2;
  }

  // Strictly clamp inside page margins or page bounds
  const minX = Math.max(0, pageSettings.margins?.left ?? 10);
  const maxX = Math.max(
    minX,
    pageSettings.width - (pageSettings.margins?.right ?? 10) - width,
  );
  const minY = Math.max(0, pageSettings.margins?.top ?? 10);
  const maxY = Math.max(
    minY,
    pageSettings.height - (pageSettings.margins?.bottom ?? 10) - height,
  );

  let x = Math.max(minX, Math.min(maxX, candidateX));
  let y = Math.max(minY, Math.min(maxY, candidateY));

  // Stagger slightly if an existing element is already at this exact position
  const isOccupied = existingElements.some(
    (el) => Math.abs(el.bounds.x - x) < 2 && Math.abs(el.bounds.y - y) < 2,
  );
  if (isOccupied) {
    if (x + 5 <= maxX) x += 5;
    if (y + 5 <= maxY) y += 5;
  }

  if (snapToGrid && gridSizeMm && gridSizeMm > 0) {
    x = Math.round(x / gridSizeMm) * gridSizeMm;
    y = Math.round(y / gridSizeMm) * gridSizeMm;
    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));
  } else {
    // Continuous sub-millimeter precision without forced rounding
    x = roundPrecision(x, 3);
    y = roundPrecision(y, 3);
  }

  return {
    x,
    y,
    width,
    height,
    rotation: 0,
  };
}

function getNextZIndex(existingElements: TemplateElement[] = []): number {
  if (existingElements.length === 0) return 1;
  return Math.max(0, ...existingElements.map((e) => e.zIndex ?? 0)) + 1;
}

export function createTextTemplate(options: PlacementOptions): TextElement {
  const bounds = calculateInitialBounds(60, 15, options);
  return {
    id: generateElementId('text'),
    type: 'text',
    name: 'Text',
    bounds,
    content: 'Text Box',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSizePt: 14,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#0f172a',
      alignment: 'left',
      lineHeight: 1.2,
      autoWrap: true,
    },
    isLocked: false,
    isVisible: true,
    zIndex: getNextZIndex(options.existingElements),
  };
}

export function createRectangleTemplate(options: PlacementOptions): ShapeElement {
  const bounds = calculateInitialBounds(50, 30, options);
  return {
    id: generateElementId('rect'),
    type: 'shape',
    name: 'Rectangle',
    shapeType: 'rectangle',
    bounds,
    fillColor: '#e2e8f0',
    strokeColor: '#475569',
    strokeWidthMm: 0.5,
    strokeDash: 'solid',
    cornerRadiusMm: 0,
    isLocked: false,
    isVisible: true,
    zIndex: getNextZIndex(options.existingElements),
  };
}

export function createRoundedRectangleTemplate(
  options: PlacementOptions,
): ShapeElement {
  const bounds = calculateInitialBounds(50, 30, options);
  return {
    id: generateElementId('rounded_rect'),
    type: 'shape',
    name: 'Rounded Rectangle',
    shapeType: 'rounded-rectangle',
    bounds,
    fillColor: '#e2e8f0',
    strokeColor: '#475569',
    strokeWidthMm: 0.5,
    strokeDash: 'solid',
    cornerRadiusMm: 3,
    isLocked: false,
    isVisible: true,
    zIndex: getNextZIndex(options.existingElements),
  };
}

export function createEllipseTemplate(options: PlacementOptions): ShapeElement {
  const bounds = calculateInitialBounds(35, 35, options);
  return {
    id: generateElementId('ellipse'),
    type: 'shape',
    name: 'Ellipse',
    shapeType: 'ellipse',
    bounds,
    fillColor: '#e2e8f0',
    strokeColor: '#475569',
    strokeWidthMm: 0.5,
    strokeDash: 'solid',
    isLocked: false,
    isVisible: true,
    zIndex: getNextZIndex(options.existingElements),
  };
}

export function createLineTemplate(options: PlacementOptions): ShapeElement {
  const bounds = calculateInitialBounds(60, 0, options);
  return {
    id: generateElementId('line'),
    type: 'shape',
    name: 'Line',
    shapeType: 'line',
    bounds,
    fillColor: 'transparent',
    strokeColor: '#475569',
    strokeWidthMm: 0.5,
    strokeDash: 'solid',
    isLocked: false,
    isVisible: true,
    zIndex: getNextZIndex(options.existingElements),
  };
}

export function createBarcodeTemplate(options: PlacementOptions): BarcodeElement {
  const bounds = calculateInitialBounds(50, 18, options);
  return {
    id: generateElementId('barcode'),
    type: 'barcode',
    name: 'Barcode',
    barcodeType: 'code128',
    bounds,
    content: '12345678',
    showText: true,
    isLocked: false,
    isVisible: true,
    zIndex: getNextZIndex(options.existingElements),
  };
}

export function createQrCodeTemplate(options: PlacementOptions): BarcodeElement {
  const bounds = calculateInitialBounds(25, 25, options);
  return {
    id: generateElementId('qr'),
    type: 'barcode',
    name: 'QR Code',
    barcodeType: 'qr',
    bounds,
    content: 'https://example.com',
    showText: false,
    errorCorrectionLevel: 'M',
    isLocked: false,
    isVisible: true,
    zIndex: getNextZIndex(options.existingElements),
  };
}

export function createImageTemplate(options: PlacementOptions): ImageElement {
  const bounds = calculateInitialBounds(40, 30, options);
  return {
    id: generateElementId('image'),
    type: 'image',
    name: 'Image',
    bounds,
    fit: 'contain',
    opacity: 1,
    assetRef: PLACEHOLDER_IMAGE_SVG,
    isLocked: false,
    isVisible: true,
    zIndex: getNextZIndex(options.existingElements),
  };
}

export function createElementFromTemplate(
  type: InsertableElementType,
  options: PlacementOptions,
): TemplateElement {
  switch (type) {
    case 'text':
      return createTextTemplate(options);
    case 'rectangle':
      return createRectangleTemplate(options);
    case 'rounded-rectangle':
      return createRoundedRectangleTemplate(options);
    case 'ellipse':
      return createEllipseTemplate(options);
    case 'line':
      return createLineTemplate(options);
    case 'barcode':
      return createBarcodeTemplate(options);
    case 'qr':
      return createQrCodeTemplate(options);
    case 'image':
      return createImageTemplate(options);
    default: {
      const _exhaustiveCheck: never = type;
      throw new Error(`Unsupported element type: ${_exhaustiveCheck}`);
    }
  }
}

