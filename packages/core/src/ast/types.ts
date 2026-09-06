/**
 * Universe Template Studio (UTS) - Core AST Types
 * Schema Version: 1.0.0
 *
 * All spatial coordinates in the AST are strictly stored in physical millimeters (mm)
 * to guarantee complete decoupling from canvas libraries (Fabric/Konva),
 * screen resolution, and DPI scaling.
 */

export type PageUnit = 'mm' | 'in' | 'pt';
export type PageOrientation = 'portrait' | 'landscape';

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageSettings {
  unit: PageUnit;
  width: number;
  height: number;
  orientation: PageOrientation;
  margins: PageMargins;
  targetDpi: number;
}

export interface BoundingBox {
  x: number;          // mm from page left
  y: number;          // mm from page top
  width: number;      // mm width (> 0)
  height: number;     // mm height (> 0)
  rotation: number;   // degrees (0 to 359.9)
}

export type ElementType = 'text' | 'image' | 'shape' | 'barcode';

export interface BaseElement {
  id: string;
  type: ElementType;
  name: string;
  bounds: BoundingBox;
  isLocked: boolean;
  isVisible: boolean;
  zIndex: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  style: {
    fontFamily: string;
    fontSizePt: number;
    fontWeight: 'normal' | 'bold' | '500' | '600' | '700';
    fontStyle: 'normal' | 'italic';
    color: string;
    alignment: 'left' | 'center' | 'right' | 'justify';
    lineHeight: number;
    letterSpacingPt?: number;
    autoWrap: boolean;
  };
  bindingField?: string;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  assetRef: string;
  fit: 'contain' | 'cover' | 'stretch';
  opacity: number;
}

export type ShapeType = 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'line';

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: ShapeType;
  fillColor: string;
  strokeColor: string;
  strokeWidthMm: number;
  strokeDash?: 'solid' | 'dashed' | 'dotted';
  cornerRadiusMm?: number;
}

export type BarcodeType = 'code128' | 'ean13' | 'upca' | 'code39' | 'qr' | 'datamatrix';

export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  barcodeType: BarcodeType;
  content: string;
  showText: boolean;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  bindingField?: string;
}

export type TemplateElement = TextElement | ImageElement | ShapeElement | BarcodeElement;

export interface TraceBackground {
  enabled: boolean;
  fileRef: string;
  opacity: number;
  pageIndex: number;
}

export type DataFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface DataField {
  name: string;
  type: DataFieldType;
  sampleValue?: unknown;
}

export interface DataSchema {
  fields: DataField[];
  mockPayload: Record<string, unknown>;
}

export interface TemplateMetadata {
  id: string;
  title: string;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateAst {
  schemaVersion: '1.0.0';
  metadata: TemplateMetadata;
  pageSettings: PageSettings;
  traceBackground?: TraceBackground;
  dataSchema: DataSchema;
  elements: TemplateElement[];
}

export interface UtsManifest {
  format: 'UTS_PACKAGE';
  schemaVersion: '1.0.0';
  id: string;
  title: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  targetDpi: number;
  pageSize: {
    width: number;
    height: number;
    unit: PageUnit;
  };
  assetCount: number;
  hasTraceBackground: boolean;
}

