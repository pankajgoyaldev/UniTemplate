import { describe, it, expect } from 'vitest';
import type { TemplateAst } from '../src/ast/types.js';
import {
  validateTemplateAst,
  safeValidateTemplateAst,
  validateUtsManifest,
} from '../src/ast/schemas.js';

describe('Template AST & Zod Validation', () => {
  const createValidTemplate = (): TemplateAst => ({
    schemaVersion: '1.0.0',
    metadata: {
      id: 'tpl_gst_invoice_01',
      title: 'GST Tax Invoice',
      description: 'Standard B2B tax invoice template',
      author: 'Universe Studio',
      createdAt: '2026-09-06T12:00:00.000Z',
      updatedAt: '2026-09-06T12:00:00.000Z',
    },
    pageSettings: {
      unit: 'mm',
      width: 210,
      height: 297,
      orientation: 'portrait',
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      targetDpi: 300,
    },
    traceBackground: {
      enabled: false,
      fileRef: 'background/original_scan.pdf',
      opacity: 0.3,
      pageIndex: 0,
    },
    dataSchema: {
      fields: [
        { name: 'invoiceNo', type: 'string', sampleValue: 'INV-2026-0042' },
        { name: 'totalAmount', type: 'number', sampleValue: 14500 },
      ],
      mockPayload: {
        invoiceNo: 'INV-2026-0042',
        totalAmount: 14500,
      },
    },
    elements: [
      {
        id: 'el_text_hdr',
        type: 'text',
        name: 'Header Title',
        bounds: { x: 15, y: 15, width: 80, height: 12, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        content: 'TAX INVOICE',
        style: {
          fontFamily: 'Inter',
          fontSizePt: 16,
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#111827',
          alignment: 'left',
          lineHeight: 1.2,
          autoWrap: true,
        },
      },
      {
        id: 'el_logo',
        type: 'image',
        name: 'Company Logo',
        bounds: { x: 150, y: 15, width: 45, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 2,
        assetRef: 'logo_company.png',
        fit: 'contain',
        opacity: 1,
      },
      {
        id: 'el_divider',
        type: 'shape',
        name: 'Divider Line',
        bounds: { x: 15, y: 38, width: 180, height: 1, rotation: 0 },
        isLocked: true,
        isVisible: true,
        zIndex: 3,
        shapeType: 'line',
        fillColor: 'transparent',
        strokeColor: '#E5E7EB',
        strokeWidthMm: 0.5,
        strokeDash: 'solid',
      },
      {
        id: 'el_qr',
        type: 'barcode',
        name: 'E-Invoice QR Code',
        bounds: { x: 150, y: 45, width: 35, height: 35, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 4,
        barcodeType: 'qr',
        content: 'https://einvoice1.gst.gov.in/verify?id={{invoiceNo}}',
        showText: false,
        errorCorrectionLevel: 'M',
        bindingField: 'invoiceNo',
      },
      {
        id: 'el_code128',
        type: 'barcode',
        name: 'Tracking Barcode',
        bounds: { x: 15, y: 45, width: 60, height: 18, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 5,
        barcodeType: 'code128',
        content: '{{invoiceNo}}',
        showText: true,
      },
    ],
  });

  it('successfully validates a complete compliant template', () => {
    const template = createValidTemplate();
    const validated = validateTemplateAst(template);
    expect(validated.schemaVersion).toBe('1.0.0');
    expect(validated.elements).toHaveLength(5);
    expect(validated.elements[0].type).toBe('text');
    expect(validated.elements[3].type).toBe('barcode');
  });

  it('rejects invalid schemaVersion', () => {
    const template = createValidTemplate() as any;
    template.schemaVersion = '2.0.0';
    const result = safeValidateTemplateAst(template);
    expect(result.success).toBe(false);
  });

  it('rejects negative page dimensions', () => {
    const template = createValidTemplate();
    template.pageSettings.width = -100;
    expect(() => validateTemplateAst(template)).toThrow(/Page width must be positive/);
  });

  it('rejects invalid barcode type', () => {
    const template = createValidTemplate();
    const barcodeEl = template.elements.find((e) => e.type === 'barcode') as any;
    barcodeEl.barcodeType = 'invalid_barcode';
    const result = safeValidateTemplateAst(template);
    expect(result.success).toBe(false);
  });

  it('validates a correct UTS manifest', () => {
    const manifest = {
      format: 'UTS_PACKAGE' as const,
      schemaVersion: '1.0.0' as const,
      id: 'tpl_test',
      title: 'Test Template',
      createdAt: '2026-09-06T12:00:00.000Z',
      updatedAt: '2026-09-06T12:00:00.000Z',
      targetDpi: 300,
      pageSize: { width: 210, height: 297, unit: 'mm' as const },
      assetCount: 1,
      hasTraceBackground: false,
    };
    const validated = validateUtsManifest(manifest);
    expect(validated.format).toBe('UTS_PACKAGE');
    expect(validated.schemaVersion).toBe('1.0.0');
  });
});

