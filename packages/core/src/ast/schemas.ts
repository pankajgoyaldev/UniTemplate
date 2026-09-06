import { z } from 'zod';
import type { TemplateAst, UtsManifest } from './types.js';

export const pageUnitSchema = z.enum(['mm', 'in', 'pt']);

export const pageOrientationSchema = z.enum(['portrait', 'landscape']);

export const pageMarginsSchema = z.object({
  top: z.number().min(0),
  right: z.number().min(0),
  bottom: z.number().min(0),
  left: z.number().min(0),
});

export const pageSettingsSchema = z.object({
  unit: pageUnitSchema,
  width: z.number().positive({ message: 'Page width must be positive' }),
  height: z.number().positive({ message: 'Page height must be positive' }),
  orientation: pageOrientationSchema,
  margins: pageMarginsSchema,
  targetDpi: z.number().int().min(72).max(1200).default(300),
});

export const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive({ message: 'Element width must be greater than 0' }),
  height: z.number().positive({ message: 'Element height must be greater than 0' }),
  rotation: z.number().min(0).max(360).default(0),
});

export const elementTypeSchema = z.enum(['text', 'image', 'shape', 'barcode']);

const baseElementProps = {
  id: z.string().min(1, 'Element id is required'),
  name: z.string().default(''),
  bounds: boundingBoxSchema,
  isLocked: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  zIndex: z.number().int().default(0),
};

export const textElementSchema = z.object({
  ...baseElementProps,
  type: z.literal('text'),
  content: z.string().default(''),
  style: z.object({
    fontFamily: z.string().default('Inter, sans-serif'),
    fontSizePt: z.number().positive().default(12),
    fontWeight: z.enum(['normal', 'bold', '500', '600', '700']).default('normal'),
    fontStyle: z.enum(['normal', 'italic']).default('normal'),
    color: z.string().default('#000000'),
    alignment: z.enum(['left', 'center', 'right', 'justify']).default('left'),
    lineHeight: z.number().positive().default(1.2),
    letterSpacingPt: z.number().optional(),
    autoWrap: z.boolean().default(true),
  }),
  bindingField: z.string().optional(),
});

export const imageElementSchema = z.object({
  ...baseElementProps,
  type: z.literal('image'),
  assetRef: z.string().min(1, 'Asset reference filename is required'),
  fit: z.enum(['contain', 'cover', 'stretch']).default('contain'),
  opacity: z.number().min(0).max(1).default(1),
});

export const shapeTypeSchema = z.enum([
  'rectangle',
  'rounded-rectangle',
  'ellipse',
  'line',
]);

export const shapeElementSchema = z.object({
  ...baseElementProps,
  type: z.literal('shape'),
  shapeType: shapeTypeSchema,
  fillColor: z.string().default('transparent'),
  strokeColor: z.string().default('#000000'),
  strokeWidthMm: z.number().min(0).default(0.5),
  strokeDash: z.enum(['solid', 'dashed', 'dotted']).optional(),
  cornerRadiusMm: z.number().min(0).optional(),
});

export const barcodeTypeSchema = z.enum([
  'code128',
  'ean13',
  'upca',
  'code39',
  'qr',
  'datamatrix',
]);

export const barcodeElementSchema = z.object({
  ...baseElementProps,
  type: z.literal('barcode'),
  barcodeType: barcodeTypeSchema,
  content: z.string().default(''),
  showText: z.boolean().default(true),
  errorCorrectionLevel: z.enum(['L', 'M', 'Q', 'H']).optional(),
  bindingField: z.string().optional(),
});

export const templateElementSchema = z.discriminatedUnion('type', [
  textElementSchema,
  imageElementSchema,
  shapeElementSchema,
  barcodeElementSchema,
]);

export const traceBackgroundSchema = z.object({
  enabled: z.boolean().default(false),
  fileRef: z.string(),
  opacity: z.number().min(0).max(1).default(0.3),
  pageIndex: z.number().int().min(0).default(0),
});

export const dataFieldTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'array',
  'object',
]);

export const dataFieldSchema = z.object({
  name: z.string().min(1),
  type: dataFieldTypeSchema,
  sampleValue: z.unknown().optional(),
});

export const dataSchemaSchema = z.object({
  fields: z.array(dataFieldSchema).default([]),
  mockPayload: z.record(z.unknown()).default({}),
});

export const templateMetadataSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Template title is required'),
  description: z.string().optional(),
  author: z.string().optional(),
  createdAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  updatedAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
});

export const templateAstSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  metadata: templateMetadataSchema,
  pageSettings: pageSettingsSchema,
  traceBackground: traceBackgroundSchema.optional(),
  dataSchema: dataSchemaSchema.default({ fields: [], mockPayload: {} }),
  elements: z.array(templateElementSchema).default([]),
});

export const utsManifestSchema = z.object({
  format: z.literal('UTS_PACKAGE'),
  schemaVersion: z.literal('1.0.0'),
  id: z.string().min(1),
  title: z.string().min(1),
  author: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  targetDpi: z.number().int().min(72).max(1200).default(300),
  pageSize: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    unit: pageUnitSchema,
  }),
  assetCount: z.number().int().min(0).default(0),
  hasTraceBackground: z.boolean().default(false),
});

/**
 * Validates untrusted data as a valid TemplateAst
 * Throws detailed ZodError if invalid
 */
export function validateTemplateAst(data: unknown): TemplateAst {
  return templateAstSchema.parse(data) as TemplateAst;
}

/**
 * Safe validation returning success flag and parsed AST or error
 */
export function safeValidateTemplateAst(data: unknown) {
  return templateAstSchema.safeParse(data);
}

/**
 * Validates untrusted data as a valid UtsManifest
 */
export function validateUtsManifest(data: unknown): UtsManifest {
  return utsManifestSchema.parse(data) as UtsManifest;
}

