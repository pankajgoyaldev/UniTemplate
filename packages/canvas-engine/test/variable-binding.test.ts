import { describe, it, expect, beforeEach } from 'vitest';
import {
  type TemplateAst,
  type TextElement,
  type BarcodeElement,
  serializeUts,
  parseUts,
  DEFAULT_SCREEN_DPI,
} from '@uts/core';
import {
  resolveTemplateTokens,
  resolveTextElementContent,
  resolveBarcodeElementContent,
  renderTextElement,
  renderBarcodeElement,
  type RenderContext,
} from '../src/index.js';

// We also test the validation and store logic
import {
  validateVariableName,
  parseSampleValue,
} from '../../../apps/web/src/operations/variableOperations.js';
import { useTemplateStore } from '../../../apps/web/src/store/useTemplateStore.js';
import { useHistoryStore } from '../../../apps/web/src/store/history/useHistoryStore.js';
import { useDocumentStore } from '../../../apps/web/src/store/document/useDocumentStore.js';

function createMockTemplate(): TemplateAst {
  return {
    schemaVersion: '1.0.0',
    metadata: {
      id: 'tmpl-var-test',
      title: 'Variable Binding Test Template',
      createdAt: '2026-09-12T00:00:00.000Z',
      updatedAt: '2026-09-12T00:00:00.000Z',
    },
    pageSettings: {
      width: 210,
      height: 297,
      unit: 'mm',
      orientation: 'portrait',
      margins: { top: 15, right: 15, bottom: 15, left: 15 },
      targetDpi: 300,
    },
    dataSchema: {
      fields: [
        { name: 'customer_name', type: 'string', sampleValue: 'Pankaj Goyal' },
        { name: 'invoice_no', type: 'string', sampleValue: 'INV-2026-001' },
        { name: 'amount', type: 'number', sampleValue: 4999.5 },
        { name: 'is_paid', type: 'boolean', sampleValue: true },
      ],
      mockPayload: {
        customer_name: 'Pankaj Goyal',
        invoice_no: 'INV-2026-001',
        amount: 4999.5,
        is_paid: true,
      },
    },
    elements: [
      {
        id: 'el-text-1',
        name: 'Customer Title',
        type: 'text',
        bounds: { x: 20, y: 30, width: 80, height: 10, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        content: 'Customer:',
        bindingField: 'customer_name',
        style: {
          fontFamily: 'Inter, sans-serif',
          fontSizePt: 12,
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000000',
          alignment: 'left',
          lineHeight: 1.2,
          autoWrap: true,
        },
      },
      {
        id: 'el-text-tokens',
        name: 'Summary Line',
        type: 'text',
        bounds: { x: 20, y: 50, width: 120, height: 12, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 2,
        content: 'Invoice #{{invoice_no}} for {{customer_name}} - Total: ₹{{amount}}',
        style: {
          fontFamily: 'Inter, sans-serif',
          fontSizePt: 11,
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#333333',
          alignment: 'left',
          lineHeight: 1.2,
          autoWrap: true,
        },
      },
      {
        id: 'el-barcode-1',
        name: 'Invoice Barcode',
        type: 'barcode',
        bounds: { x: 20, y: 70, width: 50, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 3,
        barcodeType: 'code128',
        content: 'DEFAULT123',
        bindingField: 'invoice_no',
        showText: true,
      },
    ],
  };
}

describe('Task 9 — Dynamic Field Binding & Variable Management', () => {
  beforeEach(() => {
    useHistoryStore.getState().clearHistory();
    useDocumentStore.getState().resetSession(createMockTemplate(), 'test.uts');
    useTemplateStore.getState().setTemplate(createMockTemplate(), false);
  });

  // --------------------------------------------------------------------------
  // 1. Variable Identifier Validation
  // --------------------------------------------------------------------------
  describe('1. Variable Identifier Validation', () => {
    const existing = [
      { name: 'customer_name', type: 'string' as const },
      { name: 'invoice_no', type: 'string' as const },
    ];

    it('accepts valid identifier names', () => {
      expect(validateVariableName('customer_id', existing).valid).toBe(true);
      expect(validateVariableName('invoiceNo_2026', existing).valid).toBe(true);
      expect(validateVariableName('_private_field', existing).valid).toBe(true);
      expect(validateVariableName('amount', existing).valid).toBe(true);
    });

    it('rejects empty or whitespace-only names', () => {
      expect(validateVariableName('', existing).valid).toBe(false);
      expect(validateVariableName('   ', existing).valid).toBe(false);
    });

    it('rejects names starting with numbers or containing invalid characters', () => {
      expect(validateVariableName('123invoice', existing).valid).toBe(false);
      expect(validateVariableName('customer-name', existing).valid).toBe(false);
      expect(validateVariableName('customer name', existing).valid).toBe(false);
      expect(validateVariableName('price$', existing).valid).toBe(false);
      expect(validateVariableName('user@domain', existing).valid).toBe(false);
    });

    it('rejects duplicate names case-insensitively', () => {
      expect(validateVariableName('customer_name', existing).valid).toBe(false);
      expect(validateVariableName('CUSTOMER_NAME', existing).valid).toBe(false);
      expect(validateVariableName('Invoice_No', existing).valid).toBe(false);
    });

    it('allows keeping current name during edit', () => {
      expect(validateVariableName('customer_name', existing, 'customer_name').valid).toBe(true);
      expect(validateVariableName('CUSTOMER_NAME', existing, 'customer_name').valid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Type & Value Coercion
  // --------------------------------------------------------------------------
  describe('2. Type & Value Coercion', () => {
    it('parses numbers safely with fallback', () => {
      expect(parseSampleValue('number', '123.45')).toBe(123.45);
      expect(parseSampleValue('number', 500)).toBe(500);
      expect(parseSampleValue('number', 'invalid')).toBe(0);
      expect(parseSampleValue('number', '')).toBe(0);
    });

    it('parses booleans cleanly', () => {
      expect(parseSampleValue('boolean', true)).toBe(true);
      expect(parseSampleValue('boolean', 'true')).toBe(true);
      expect(parseSampleValue('boolean', '1')).toBe(true);
      expect(parseSampleValue('boolean', false)).toBe(false);
      expect(parseSampleValue('boolean', 'false')).toBe(false);
      expect(parseSampleValue('boolean', '0')).toBe(false);
    });

    it('parses strings cleanly', () => {
      expect(parseSampleValue('string', 'Pankaj')).toBe('Pankaj');
      expect(parseSampleValue('string', 123)).toBe('123');
      expect(parseSampleValue('string', null)).toBe('');
      expect(parseSampleValue('string', undefined)).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Reusable Token Resolution
  // --------------------------------------------------------------------------
  describe('3. Reusable Token Resolution (resolveTemplateTokens)', () => {
    const payload = {
      name: 'Pankaj',
      company: 'Universe Studio',
      amount: 4500,
      paid: true,
      empty_val: '',
    };

    it('replaces single token with value', () => {
      expect(resolveTemplateTokens('Hello {{name}}', payload)).toBe('Hello Pankaj');
    });

    it('replaces multiple tokens in one string', () => {
      const template = 'Client {{name}} from {{company}} owes ₹{{amount}} (Paid: {{paid}})';
      const result = resolveTemplateTokens(template, payload);
      expect(result).toBe('Client Pankaj from Universe Studio owes ₹4500 (Paid: true)');
    });

    it('preserves unknown tokens without throwing', () => {
      expect(resolveTemplateTokens('User {{unknown_field}} here', payload)).toBe(
        'User {{unknown_field}} here',
      );
    });

    it('handles whitespace inside token braces', () => {
      expect(resolveTemplateTokens('Hello {{   name   }}', payload)).toBe('Hello Pankaj');
      expect(resolveTemplateTokens('Total: {{  amount }}', payload)).toBe('Total: 4500');
    });

    it('handles malformed or partial tokens gracefully', () => {
      expect(resolveTemplateTokens('Broken {{ unclosed', payload)).toBe('Broken {{ unclosed');
      expect(resolveTemplateTokens('Broken }} unmatched', payload)).toBe('Broken }} unmatched');
      expect(resolveTemplateTokens('Empty {{}} braces', payload)).toBe('Empty {{}} braces');
      expect(resolveTemplateTokens('', payload)).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Element Content Resolution (Design vs Preview)
  // --------------------------------------------------------------------------
  describe('4. Text & Barcode Element Content Resolution', () => {
    const payload = {
      customer_name: 'Pankaj Goyal',
      invoice_no: 'INV-2026-001',
    };

    const boundText: TextElement = {
      id: 't1',
      name: 'Text',
      type: 'text',
      bounds: { x: 0, y: 0, width: 50, height: 10, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 1,
      content: 'Pankaj Goyal',
      bindingField: 'customer_name',
      style: {
        fontFamily: 'sans-serif',
        fontSizePt: 12,
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#000',
        alignment: 'left',
        lineHeight: 1.2,
        autoWrap: true,
      },
    };

    const tokenText: TextElement = {
      ...boundText,
      bindingField: undefined,
      content: 'Hello {{customer_name}}!',
    };

    const staticText: TextElement = {
      ...boundText,
      bindingField: undefined,
      content: 'Static Title',
    };

    const boundBarcode: BarcodeElement = {
      id: 'b1',
      name: 'Barcode',
      type: 'barcode',
      bounds: { x: 0, y: 0, width: 50, height: 20, rotation: 0 },
      isLocked: false,
      isVisible: true,
      zIndex: 2,
      barcodeType: 'code128',
      content: 'FALLBACK_STATIC',
      bindingField: 'invoice_no',
      showText: true,
    };

    it('Design View: shows {{bindingField}} for bound text element', () => {
      const designContent = resolveTextElementContent(boundText, payload, false);
      expect(designContent).toBe('{{customer_name}}');
    });

    it('Design View: preserves inline tokens in text content', () => {
      const designContent = resolveTextElementContent(tokenText, payload, false);
      expect(designContent).toBe('Hello {{customer_name}}!');
    });

    it('Design View: preserves static text exactly', () => {
      const designContent = resolveTextElementContent(staticText, payload, false);
      expect(designContent).toBe('Static Title');
    });

    it('Preview View: resolves sample value for bound text element', () => {
      const previewContent = resolveTextElementContent(boundText, payload, true);
      expect(previewContent).toBe('Pankaj Goyal');
    });

    it('Preview View: resolves inline tokens in text content', () => {
      const previewContent = resolveTextElementContent(tokenText, payload, true);
      expect(previewContent).toBe('Hello Pankaj Goyal!');
    });

    it('Preview View: static text remains unchanged', () => {
      const previewContent = resolveTextElementContent(staticText, payload, true);
      expect(previewContent).toBe('Static Title');
    });

    it('Design View: barcode uses content to keep valid barcode syntax', () => {
      const val = resolveBarcodeElementContent(boundBarcode, payload, false);
      expect(val).toBe('FALLBACK_STATIC');
    });

    it('Preview View: barcode resolves dynamic value from mockPayload', () => {
      const val = resolveBarcodeElementContent(boundBarcode, payload, true);
      expect(val).toBe('INV-2026-001');
    });
  });

  // --------------------------------------------------------------------------
  // 5. SVG Renderers with Context
  // --------------------------------------------------------------------------
  describe('5. SVG Renderers with Context', () => {
    const template = createMockTemplate();
    const textEl = template.elements[0] as TextElement;
    const barcodeEl = template.elements[2] as BarcodeElement;

    it('renderTextElement renders token in Design View and sample value in Preview View', () => {
      const designContext: RenderContext = {
        zoom: 1,
        dpi: DEFAULT_SCREEN_DPI,
        previewMode: false,
        mockPayload: template.dataSchema.mockPayload,
      };
      const previewContext: RenderContext = {
        zoom: 1,
        dpi: DEFAULT_SCREEN_DPI,
        previewMode: true,
        mockPayload: template.dataSchema.mockPayload,
      };

      const designSvg = renderTextElement(textEl, designContext);
      const previewSvg = renderTextElement(textEl, previewContext);

      // In design mode, tspans contain {{customer_name}}
      const designTspan = (designSvg.children?.[0] as any)?.children?.[0];
      expect(designTspan).toBe('{{customer_name}}');

      // In preview mode, tspans contain "Pankaj Goyal"
      const previewTspan = (previewSvg.children?.[0] as any)?.children?.[0];
      expect(previewTspan).toBe('Pankaj Goyal');
    });

    it('renderBarcodeElement generates valid barcode in Preview View using dynamic value', () => {
      const previewContext: RenderContext = {
        zoom: 1,
        dpi: DEFAULT_SCREEN_DPI,
        previewMode: true,
        mockPayload: template.dataSchema.mockPayload,
      };

      const barcodeSvg = renderBarcodeElement(barcodeEl, previewContext);
      expect(barcodeSvg.tag).toBe('svg');
      expect(barcodeSvg.innerHTML).toContain('path');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Template Store Variable Actions
  // --------------------------------------------------------------------------
  describe('6. Template Store Variable Actions', () => {
    it('addVariable adds field and populates mockPayload', () => {
      const store = useTemplateStore.getState();
      store.addVariable(
        { name: 'shipping_address', type: 'string', sampleValue: '123 Main St' },
        '123 Main St',
      );

      const state = useTemplateStore.getState();
      const added = state.template.dataSchema.fields.find((f) => f.name === 'shipping_address');
      expect(added).toBeDefined();
      expect(added?.type).toBe('string');
      expect(state.template.dataSchema.mockPayload.shipping_address).toBe('123 Main St');
    });

    it('addVariable rejects duplicate variable silently', () => {
      const store = useTemplateStore.getState();
      const initialCount = store.template.dataSchema.fields.length;
      store.addVariable({ name: 'customer_name', type: 'string' });
      expect(useTemplateStore.getState().template.dataSchema.fields.length).toBe(initialCount);
    });

    it('updateVariable renames variable and updates bound elements', () => {
      const store = useTemplateStore.getState();
      store.updateVariable('customer_name', { name: 'client_name' }, 'Client Corp');

      const state = useTemplateStore.getState();
      expect(state.template.dataSchema.fields.some((f) => f.name === 'client_name')).toBe(true);
      expect(state.template.dataSchema.fields.some((f) => f.name === 'customer_name')).toBe(false);
      expect(state.template.dataSchema.mockPayload.client_name).toBe('Client Corp');
      expect(state.template.dataSchema.mockPayload.customer_name).toBeUndefined();

      // Bound text element should now point to client_name
      const boundEl = state.template.elements.find((e) => e.id === 'el-text-1') as TextElement;
      expect(boundEl.bindingField).toBe('client_name');
    });

    it('deleteVariable removes field, payload, and unbinds elements', () => {
      const store = useTemplateStore.getState();
      store.deleteVariable('customer_name');

      const state = useTemplateStore.getState();
      expect(state.template.dataSchema.fields.some((f) => f.name === 'customer_name')).toBe(false);
      expect(state.template.dataSchema.mockPayload.customer_name).toBeUndefined();

      // Bound text element should now have bindingField removed
      const boundEl = state.template.elements.find((e) => e.id === 'el-text-1') as TextElement;
      expect(boundEl.bindingField).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Undo / Redo Integration
  // --------------------------------------------------------------------------
  describe('7. Undo / Redo Integration', () => {
    it('variable additions and deletions participate in undo/redo history', () => {
      const store = useTemplateStore.getState();
      const history = useHistoryStore.getState();

      expect(history.canUndo).toBe(false);

      // 1. Add variable
      store.addVariable({ name: 'discount_rate', type: 'number', sampleValue: 15 }, 15);
      expect(useHistoryStore.getState().canUndo).toBe(true);
      expect(
        useTemplateStore.getState().template.dataSchema.fields.some((f) => f.name === 'discount_rate'),
      ).toBe(true);

      // 2. Undo addition
      history.undo();
      expect(
        useTemplateStore.getState().template.dataSchema.fields.some((f) => f.name === 'discount_rate'),
      ).toBe(false);

      // 3. Redo addition
      useHistoryStore.getState().redo();
      expect(
        useTemplateStore.getState().template.dataSchema.fields.some((f) => f.name === 'discount_rate'),
      ).toBe(true);
    });

    it('binding element to a variable is undoable', () => {
      const store = useTemplateStore.getState();
      const history = useHistoryStore.getState();

      // Update text element bindingField
      store.updateElement('el-text-1', { bindingField: 'invoice_no' });
      expect((useTemplateStore.getState().template.elements[0] as TextElement).bindingField).toBe(
        'invoice_no',
      );

      // Undo
      history.undo();
      expect((useTemplateStore.getState().template.elements[0] as TextElement).bindingField).toBe(
        'customer_name',
      );

      // Redo
      useHistoryStore.getState().redo();
      expect((useTemplateStore.getState().template.elements[0] as TextElement).bindingField).toBe(
        'invoice_no',
      );
    });
  });

  // --------------------------------------------------------------------------
  // 8. Non-Destructive Preview Invariant
  // --------------------------------------------------------------------------
  describe('8. Non-Destructive Preview Invariant', () => {
    it('resolving preview content does not mutate original AST elements or content', () => {
      const initialTemplate = createMockTemplate();
      const jsonBefore = JSON.stringify(initialTemplate);

      const el = initialTemplate.elements[0] as TextElement;
      const previewText = resolveTextElementContent(
        el,
        initialTemplate.dataSchema.mockPayload,
        true,
      );
      expect(previewText).toBe('Pankaj Goyal');

      // Original template remains strictly identical
      expect(JSON.stringify(initialTemplate)).toBe(jsonBefore);
      expect(el.content).toBe('Customer:');
      expect(el.bindingField).toBe('customer_name');
    });
  });

  // --------------------------------------------------------------------------
  // 9. Persistence (.uts Package Roundtrip)
  // --------------------------------------------------------------------------
  describe('9. Persistence (.uts Package Roundtrip)', () => {
    it('serializes and deserializes dataSchema and element bindingField faithfully', async () => {
      const template = createMockTemplate();
      const zipBytes = await serializeUts({
        template,
        assets: new Map(),
      });

      const parsed = await parseUts(zipBytes);
      expect(parsed.template.dataSchema.fields.length).toBe(4);
      expect(parsed.template.dataSchema.fields[0].name).toBe('customer_name');
      expect(parsed.template.dataSchema.fields[0].type).toBe('string');
      expect(parsed.template.dataSchema.mockPayload.customer_name).toBe('Pankaj Goyal');

      const parsedText = parsed.template.elements.find((e) => e.id === 'el-text-1') as TextElement;
      expect(parsedText.bindingField).toBe('customer_name');

      const parsedBarcode = parsed.template.elements.find((e) => e.id === 'el-barcode-1') as BarcodeElement;
      expect(parsedBarcode.bindingField).toBe('invoice_no');
    });
  });
});
