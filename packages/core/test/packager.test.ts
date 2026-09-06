import { describe, it, expect } from 'vitest';
import type { UtsPackage } from '../src/packager/types.js';
import type { TemplateAst } from '../src/ast/types.js';
import { serializeUts } from '../src/packager/serializer.js';
import { parseUts } from '../src/packager/parser.js';

describe('.uts Packager Round-Trip (Serialization & Deserialization)', () => {
  const sampleTemplate: TemplateAst = {
    schemaVersion: '1.0.0',
    metadata: {
      id: 'tpl_uts_packager_test',
      title: 'Shipping Label & Invoice',
      author: 'Universe Studio QA',
      createdAt: '2026-09-06T12:00:00.000Z',
      updatedAt: '2026-09-06T12:00:00.000Z',
    },
    pageSettings: {
      unit: 'mm',
      width: 101.6, // 4 inches
      height: 152.4, // 6 inches
      orientation: 'portrait',
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
      targetDpi: 300,
    },
    traceBackground: {
      enabled: true,
      fileRef: 'background/reference_label.pdf',
      opacity: 0.4,
      pageIndex: 0,
    },
    dataSchema: {
      fields: [
        { name: 'trackingNo', type: 'string', sampleValue: 'TRK-98421092' },
        { name: 'recipient', type: 'string', sampleValue: 'Acme Corp, Mumbai' },
      ],
      mockPayload: {
        trackingNo: 'TRK-98421092',
        recipient: 'Acme Corp, Mumbai',
      },
    },
    elements: [
      {
        id: 'el_title',
        type: 'text',
        name: 'Label Title',
        bounds: { x: 5, y: 5, width: 90, height: 10, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        content: 'PRIORITY EXPRESS',
        style: {
          fontFamily: 'Helvetica',
          fontSizePt: 14,
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          alignment: 'center',
          lineHeight: 1.2,
          autoWrap: true,
        },
      },
      {
        id: 'el_barcode',
        type: 'barcode',
        name: 'Tracking Barcode',
        bounds: { x: 10, y: 20, width: 80, height: 25, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 2,
        barcodeType: 'code128',
        content: '{{trackingNo}}',
        showText: true,
        bindingField: 'trackingNo',
      },
      {
        id: 'el_logo',
        type: 'image',
        name: 'Carrier Logo',
        bounds: { x: 70, y: 50, width: 25, height: 15, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 3,
        assetRef: 'carrier_logo.png',
        fit: 'contain',
        opacity: 1,
      },
    ],
  };

  // Create mock binary data
  const mockThumbnail = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
  const mockLogoPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x11, 0x22, 0x33, 0x44]);
  const mockBadgeSvg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>');
  const mockTracePdf = new TextEncoder().encode('%PDF-1.4 mock pdf trace reference');

  it('performs full round-trip serialization and deserialization with 100% fidelity', async () => {
    // 1. Build package
    const assets = new Map();
    assets.set('carrier_logo.png', {
      filename: 'carrier_logo.png',
      mimeType: 'image/png',
      data: mockLogoPng,
    });
    assets.set('badge.svg', {
      filename: 'badge.svg',
      mimeType: 'image/svg+xml',
      data: mockBadgeSvg,
    });

    const originalPackage: UtsPackage = {
      manifest: {
        format: 'UTS_PACKAGE',
        schemaVersion: '1.0.0',
        id: sampleTemplate.metadata.id,
        title: sampleTemplate.metadata.title,
        createdAt: sampleTemplate.metadata.createdAt,
        updatedAt: sampleTemplate.metadata.updatedAt,
        targetDpi: 300,
        pageSize: { width: 101.6, height: 152.4, unit: 'mm' },
        assetCount: 2,
        hasTraceBackground: true,
      },
      template: sampleTemplate,
      thumbnail: mockThumbnail,
      assets,
      traceBackground: {
        filename: 'reference_label.pdf',
        mimeType: 'application/pdf',
        data: mockTracePdf,
      },
    };

    // 2. Serialize to .uts binary
    const utsBuffer = await serializeUts(originalPackage);
    expect(utsBuffer).toBeInstanceOf(Uint8Array);
    expect(utsBuffer.byteLength).toBeGreaterThan(100);

    // 3. Deserialize back from .uts binary
    const parsedPackage = await parseUts(utsBuffer);

    // 4. Verify manifest
    expect(parsedPackage.manifest.format).toBe('UTS_PACKAGE');
    expect(parsedPackage.manifest.schemaVersion).toBe('1.0.0');
    expect(parsedPackage.manifest.id).toBe(sampleTemplate.metadata.id);
    expect(parsedPackage.manifest.assetCount).toBe(2);
    expect(parsedPackage.manifest.hasTraceBackground).toBe(true);

    // 5. Verify template AST
    expect(parsedPackage.template.schemaVersion).toBe('1.0.0');
    expect(parsedPackage.template.metadata.title).toBe('Shipping Label & Invoice');
    expect(parsedPackage.template.pageSettings.width).toBe(101.6);
    expect(parsedPackage.template.elements).toHaveLength(3);
    expect(parsedPackage.template.elements[0].id).toBe('el_title');
    expect(parsedPackage.template.elements[1].id).toBe('el_barcode');

    // 6. Verify binary assets
    expect(parsedPackage.assets.size).toBe(2);
    const loadedLogo = parsedPackage.assets.get('carrier_logo.png');
    expect(loadedLogo).toBeDefined();
    expect(loadedLogo!.mimeType).toBe('image/png');
    expect(Array.from(loadedLogo!.data)).toEqual(Array.from(mockLogoPng));

    const loadedBadge = parsedPackage.assets.get('badge.svg');
    expect(loadedBadge).toBeDefined();
    expect(loadedBadge!.mimeType).toBe('image/svg+xml');
    expect(new TextDecoder().decode(loadedBadge!.data)).toContain('<circle r="10"/>');

    // 7. Verify thumbnail
    expect(parsedPackage.thumbnail).toBeDefined();
    expect(Array.from(parsedPackage.thumbnail!)).toEqual(Array.from(mockThumbnail));

    // 8. Verify trace background
    expect(parsedPackage.traceBackground).toBeDefined();
    expect(parsedPackage.traceBackground!.filename).toBe('reference_label.pdf');
    expect(parsedPackage.traceBackground!.mimeType).toBe('application/pdf');
    expect(new TextDecoder().decode(parsedPackage.traceBackground!.data)).toContain('%PDF-1.4');
  });

  it('throws an error if corrupt or invalid buffer is provided', async () => {
    const corruptBuffer = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    await expect(parseUts(corruptBuffer)).rejects.toThrow();
  });
});

