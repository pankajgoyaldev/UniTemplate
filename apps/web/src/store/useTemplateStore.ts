import { create } from 'zustand';
import type { TemplateAst, PageSettings, TemplateElement } from '@uts/core';
import { calculateMultiElementMove, type Point, type ElementBounds } from '@uts/canvas-engine';

interface TemplateState {
  template: TemplateAst;
  // Actions
  setTemplate: (template: TemplateAst) => void;
  updatePageSettings: (settings: Partial<PageSettings>) => void;
  addElement: (element: TemplateElement) => void;
  updateElement: (id: string, patch: Partial<TemplateElement>) => void;
  updateElements: (ids: string[], patch: Partial<TemplateElement>) => void;
  updateElementBounds: (id: string, bounds: ElementBounds) => void;
  updateMultipleElementBounds: (updates: { id: string; bounds: ElementBounds }[]) => void;
  deleteElements: (ids: string[]) => void;
  nudgeElements: (ids: string[], deltaMm: Point, pageWidthMm: number, pageHeightMm: number) => void;
  toggleElementLock: (id: string) => void;
  toggleElementVisibility: (id: string) => void;
}

// Inline sample SVG logo for instant out-of-the-box rendering
const SAMPLE_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40"><rect width="160" height="40" rx="6" fill="%232563eb"/><circle cx="20" cy="20" r="10" fill="white"/><text x="38" y="25" fill="white" font-family="sans-serif" font-size="14" font-weight="bold">UNIVERSE</text></svg>`;

const DEFAULT_A4_TEMPLATE: TemplateAst = {
  schemaVersion: '1.0.0',
  metadata: {
    id: 'tpl_default_invoice',
    title: 'Standard Tax Invoice Template',
    description: 'A4 Portrait Tax Invoice with Barcode, QR Code and Vector Shapes',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  pageSettings: {
    unit: 'mm',
    width: 210,
    height: 297,
    orientation: 'portrait',
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    targetDpi: 300,
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
    // 1. Company Logo (Image Element)
    {
      id: 'el_sample_logo',
      type: 'image',
      name: 'Company Logo',
      bounds: { x: 15, y: 15, width: 45, height: 12, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 1,
      assetRef: SAMPLE_LOGO_SVG,
      fit: 'contain',
      opacity: 1,
    },
    // 2. Invoice Title (Text Element)
    {
      id: 'el_title',
      type: 'text',
      name: 'Invoice Heading',
      bounds: { x: 120, y: 15, width: 75, height: 12, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 2,
      content: 'TAX INVOICE',
      style: {
        fontFamily: 'Inter, sans-serif',
        fontSizePt: 18,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#0f172a',
        alignment: 'right',
        lineHeight: 1.2,
        autoWrap: true,
      },
    },
    // 3. Top Divider Line (Shape Element)
    {
      id: 'el_top_line',
      type: 'shape',
      name: 'Header Divider',
      bounds: { x: 15, y: 32, width: 180, height: 0, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 3,
      shapeType: 'line',
      fillColor: 'transparent',
      strokeColor: '#cbd5e1',
      strokeWidthMm: 0.5,
      strokeDash: 'solid',
    },
    // 4. Meta Information (Multi-line Text Element)
    {
      id: 'el_invoice_meta',
      type: 'text',
      name: 'Invoice Details',
      bounds: { x: 120, y: 38, width: 75, height: 25, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 4,
      content: 'Invoice #: INV-2026-0042\nDate: 06-Sep-2026\nDue Date: 20-Sep-2026',
      style: {
        fontFamily: 'Inter, sans-serif',
        fontSizePt: 9.5,
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#475569',
        alignment: 'right',
        lineHeight: 1.4,
        autoWrap: true,
      },
    },
    // 5. Bill To Card (Rounded Rectangle Shape)
    {
      id: 'el_billto_card',
      type: 'shape',
      name: 'Bill-To Container Card',
      bounds: { x: 15, y: 38, width: 85, height: 35, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 5,
      shapeType: 'rounded-rectangle',
      fillColor: '#f8fafc',
      strokeColor: '#e2e8f0',
      strokeWidthMm: 0.4,
      cornerRadiusMm: 2.5,
      strokeDash: 'solid',
    },
    // 6. Bill To Text
    {
      id: 'el_billto_text',
      type: 'text',
      name: 'Bill To Details',
      bounds: { x: 20, y: 43, width: 75, height: 25, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 6,
      content: 'BILLED TO:\nAcme Enterprises Pvt Ltd\n42 Business Bay, Mumbai 400001\nGSTIN: 27AABCU9603R1ZM',
      style: {
        fontFamily: 'Inter, sans-serif',
        fontSizePt: 8.5,
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#1e293b',
        alignment: 'left',
        lineHeight: 1.35,
        autoWrap: true,
      },
    },
    // 7. E-Invoice QR Code (2D Barcode)
    {
      id: 'el_einvoice_qr',
      type: 'barcode',
      name: 'E-Invoice QR Code',
      bounds: { x: 15, y: 235, width: 35, height: 35, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 7,
      barcodeType: 'qr',
      content: 'https://einvoice.gst.gov.in/verify?id=INV-2026-0042',
      showText: false,
      errorCorrectionLevel: 'M',
    },
    // 8. Shipping Tracking 1D Barcode (Code128)
    {
      id: 'el_tracking_code128',
      type: 'barcode',
      name: 'Shipping Tracking Barcode',
      bounds: { x: 65, y: 245, width: 75, height: 22, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 8,
      barcodeType: 'code128',
      content: 'INV-2026-0042',
      showText: true,
    },
  ],
};

function patchElement(el: TemplateElement, patch: Partial<TemplateElement>): TemplateElement {
  const updatedBounds = patch.bounds ? { ...el.bounds, ...patch.bounds } : el.bounds;

  switch (el.type) {
    case 'text': {
      const textPatch = patch as Partial<typeof el>;
      return {
        ...el,
        ...patch,
        bounds: updatedBounds,
        style: textPatch.style ? { ...el.style, ...textPatch.style } : el.style,
        type: 'text',
      };
    }
    case 'shape': {
      return {
        ...el,
        ...patch,
        bounds: updatedBounds,
        type: 'shape',
      };
    }
    case 'image': {
      return {
        ...el,
        ...patch,
        bounds: updatedBounds,
        type: 'image',
      };
    }
    case 'barcode': {
      return {
        ...el,
        ...patch,
        bounds: updatedBounds,
        type: 'barcode',
      };
    }
    default:
      return el;
  }
}

export const useTemplateStore = create<TemplateState>((set) => ({
  template: DEFAULT_A4_TEMPLATE,

  setTemplate: (template) => set({ template }),

  updatePageSettings: (settings) =>
    set((state) => ({
      template: {
        ...state.template,
        pageSettings: {
          ...state.template.pageSettings,
          ...settings,
        },
      },
    })),

  addElement: (element) =>
    set((state) => ({
      template: {
        ...state.template,
        elements: [...state.template.elements, element],
      },
    })),

  updateElement: (id, patch) =>
    set((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) => {
          if (el.id !== id) return el;
          if (el.isLocked) {
            // Locked elements cannot be modified, except unlocking
            if (patch.isLocked === false) {
              return { ...el, isLocked: false };
            }
            return el;
          }
          return patchElement(el, patch);
        }),
      },
    })),

  updateElements: (ids, patch) =>
    set((state) => {
      const idSet = new Set(ids);
      return {
        template: {
          ...state.template,
          elements: state.template.elements.map((el) => {
            if (!idSet.has(el.id) || el.isLocked) return el;
            return patchElement(el, patch);
          }),
        },
      };
    }),

  updateElementBounds: (id, bounds) =>
    set((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) =>
          el.id === id && !el.isLocked ? { ...el, bounds: { ...bounds } } : el,
        ),
      },
    })),

  updateMultipleElementBounds: (updates) =>
    set((state) => {
      const updateMap = new Map(updates.map((u) => [u.id, u.bounds]));
      return {
        template: {
          ...state.template,
          elements: state.template.elements.map((el) => {
            const newBounds = updateMap.get(el.id);
            return newBounds && !el.isLocked ? { ...el, bounds: { ...newBounds } } : el;
          }),
        },
      };
    }),

  toggleElementLock: (id) =>
    set((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) =>
          el.id === id ? { ...el, isLocked: !el.isLocked } : el,
        ),
      },
    })),

  toggleElementVisibility: (id) =>
    set((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) =>
          el.id === id && !el.isLocked ? { ...el, isVisible: !el.isVisible } : el,
        ),
      },
    })),

  deleteElements: (ids) =>
    set((state) => ({
      template: {
        ...state.template,
        // Only delete unlocked elements
        elements: state.template.elements.filter(
          (el) => !ids.includes(el.id) || el.isLocked,
        ),
      },
    })),

  nudgeElements: (ids, deltaMm, pageWidthMm, pageHeightMm) =>
    set((state) => {
      const targetElements = state.template.elements.filter(
        (el) => ids.includes(el.id) && !el.isLocked,
      );
      if (targetElements.length === 0) return state;

      const moved = calculateMultiElementMove(
        targetElements.map((el) => ({ id: el.id, initialBounds: el.bounds })),
        deltaMm,
        pageWidthMm,
        pageHeightMm,
      );

      const moveMap = new Map(moved.map((m) => [m.id, m.bounds]));
      return {
        template: {
          ...state.template,
          elements: state.template.elements.map((el) => {
            const newBounds = moveMap.get(el.id);
            return newBounds ? { ...el, bounds: newBounds } : el;
          }),
        },
      };
    }),
}));
