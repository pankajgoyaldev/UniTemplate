import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import type { DataField, TemplateAst } from '@uts/core';
import {
  useDataSourceStore,
  getActiveRow,
} from '../src/store/dataSource/useDataSourceStore.js';
import {
  generateExcelTemplateWorkbook,
} from '../src/operations/dataSource/excelTemplateExport.js';
import {
  resolveBarcodeElementContent,
  resolveTemplateTokens,
} from '@uts/canvas-engine';

describe('Phase 1: Active Excel Row → Live Template Preview', () => {
  beforeEach(() => {
    useDataSourceStore.getState().clearDataSource();
  });

  const sampleRows = [
    { student_id: 'S001', student_name: 'Alice Smith', grade: 'A', score: 95 },
    { student_id: 'S002', student_name: 'Bob Jones', grade: 'B', score: 82 },
    { student_id: 'S003', student_name: 'Charlie Brown', grade: 'A+', score: 99 },
  ];

  const sampleDataSource = {
    fileName: 'students.xlsx',
    fileType: 'xlsx' as const,
    columns: ['student_id', 'student_name', 'grade', 'score'],
    rows: sampleRows,
    rowCount: 3,
    importedAt: new Date().toISOString(),
  };

  // --------------------------------------------------------------------------
  // 1. Active Row State & Navigation
  // --------------------------------------------------------------------------
  describe('1. Active Row State & Navigation (useDataSourceStore)', () => {
    it('initializes activeRowIndex to 0', () => {
      expect(useDataSourceStore.getState().activeRowIndex).toBe(0);
    });

    it('sets activeRowIndex within valid bounds', () => {
      useDataSourceStore.getState().setDataSource(sampleDataSource);
      const store = useDataSourceStore.getState();

      store.setActiveRowIndex(1);
      expect(useDataSourceStore.getState().activeRowIndex).toBe(1);

      store.setActiveRowIndex(2);
      expect(useDataSourceStore.getState().activeRowIndex).toBe(2);
    });

    it('clamps activeRowIndex when given out-of-bounds index', () => {
      useDataSourceStore.getState().setDataSource(sampleDataSource);
      const store = useDataSourceStore.getState();

      // Negative index clamped to 0
      store.setActiveRowIndex(-5);
      expect(useDataSourceStore.getState().activeRowIndex).toBe(0);

      // Index greater than rowCount - 1 clamped to 2
      store.setActiveRowIndex(100);
      expect(useDataSourceStore.getState().activeRowIndex).toBe(2);
    });

    it('navigates sequentially using nextRow() and prevRow()', () => {
      useDataSourceStore.getState().setDataSource(sampleDataSource);
      const store = useDataSourceStore.getState();

      expect(useDataSourceStore.getState().activeRowIndex).toBe(0);

      // Advance to 1
      store.nextRow();
      expect(useDataSourceStore.getState().activeRowIndex).toBe(1);

      // Advance to 2
      store.nextRow();
      expect(useDataSourceStore.getState().activeRowIndex).toBe(2);

      // Next at boundary stays at 2
      store.nextRow();
      expect(useDataSourceStore.getState().activeRowIndex).toBe(2);

      // Go back to 1
      store.prevRow();
      expect(useDataSourceStore.getState().activeRowIndex).toBe(1);

      // Go back to 0
      store.prevRow();
      expect(useDataSourceStore.getState().activeRowIndex).toBe(0);

      // Prev at boundary stays at 0
      store.prevRow();
      expect(useDataSourceStore.getState().activeRowIndex).toBe(0);
    });

    it('resets activeRowIndex to 0 when new data source is loaded', () => {
      useDataSourceStore.getState().setDataSource(sampleDataSource);
      useDataSourceStore.getState().setActiveRowIndex(2);
      expect(useDataSourceStore.getState().activeRowIndex).toBe(2);

      // Load another data source
      const newSource = {
        ...sampleDataSource,
        fileName: 'second.csv',
      };
      useDataSourceStore.getState().setDataSource(newSource);
      expect(useDataSourceStore.getState().activeRowIndex).toBe(0);
    });

    it('resets activeRowIndex to 0 when data source is removed', () => {
      useDataSourceStore.getState().setDataSource(sampleDataSource);
      useDataSourceStore.getState().setActiveRowIndex(1);

      useDataSourceStore.getState().clearDataSource();
      expect(useDataSourceStore.getState().activeRowIndex).toBe(0);
      expect(useDataSourceStore.getState().dataSource).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 2. getActiveRow Helper
  // --------------------------------------------------------------------------
  describe('2. getActiveRow Helper', () => {
    it('returns the row at activeRowIndex', () => {
      const row0 = getActiveRow(sampleDataSource, 0);
      expect(row0).toEqual(sampleRows[0]);

      const row1 = getActiveRow(sampleDataSource, 1);
      expect(row1).toEqual(sampleRows[1]);

      const row2 = getActiveRow(sampleDataSource, 2);
      expect(row2).toEqual(sampleRows[2]);
    });

    it('clamps index safely within rows length', () => {
      const rowClampHigh = getActiveRow(sampleDataSource, 99);
      expect(rowClampHigh).toEqual(sampleRows[2]);

      const rowClampLow = getActiveRow(sampleDataSource, -5);
      expect(rowClampLow).toEqual(sampleRows[0]);
    });

    it('returns null if dataSource is null or has empty rows', () => {
      expect(getActiveRow(null, 0)).toBeNull();

      const emptySource = {
        ...sampleDataSource,
        rows: [],
        rowCount: 0,
      };
      expect(getActiveRow(emptySource, 0)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Excel Template Export (generateExcelTemplateWorkbook)
  // --------------------------------------------------------------------------
  describe('3. Excel Template Export (generateExcelTemplateWorkbook)', () => {
    it('generates workbook with variable names as column headers in order', () => {
      const fields: DataField[] = [
        { name: 'student_id', type: 'string', sampleValue: 'S001' },
        { name: 'student_name', type: 'string', sampleValue: 'Alice' },
        { name: 'grade', type: 'string', sampleValue: 'A' },
        { name: 'score', type: 'number', sampleValue: 95 },
      ];

      const wb = generateExcelTemplateWorkbook(fields);
      expect(wb.SheetNames).toContain('Template Data');

      const ws = wb.Sheets['Template Data'];
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });

      // First row should be the headers
      expect(data[0]).toEqual(['student_id', 'student_name', 'grade', 'score']);
      // No extra rows added
      expect(data.length).toBe(1);
    });

    it('handles empty fields array gracefully', () => {
      const wb = generateExcelTemplateWorkbook([]);
      expect(wb.SheetNames).toContain('Template Data');

      const ws = wb.Sheets['Template Data'];
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      expect(data.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Live Preview Payload Resolution
  // --------------------------------------------------------------------------
  describe('4. Live Preview Payload Resolution with Active Row', () => {
    const mockPayload = {
      student_id: 'MOCK_ID',
      student_name: 'Mock Student',
      school: 'Universe Academy', // extra field only in mock
    };

    it('merges active row values over mock payload', () => {
      const activeRow = getActiveRow(sampleDataSource, 0); // Alice Smith
      expect(activeRow).toBeDefined();

      const effectivePayload = { ...mockPayload, ...(activeRow || {}) };

      // Overwritten by active row
      expect(effectivePayload.student_id).toBe('S001');
      expect(effectivePayload.student_name).toBe('Alice Smith');
      // Preserved from mock payload if not present in row
      expect(effectivePayload.school).toBe('Universe Academy');
    });

    it('updates resolved text when row changes from Alice to Bob', () => {
      // Row 0: Alice
      const row0 = getActiveRow(sampleDataSource, 0);
      const payload0 = { ...mockPayload, ...(row0 || {}) };
      const resolved0 = resolveTemplateTokens('Hello, {{student_name}}! ID: {{student_id}}', payload0);
      expect(resolved0).toBe('Hello, Alice Smith! ID: S001');

      // Row 1: Bob
      const row1 = getActiveRow(sampleDataSource, 1);
      const payload1 = { ...mockPayload, ...(row1 || {}) };
      const resolved1 = resolveTemplateTokens('Hello, {{student_name}}! ID: {{student_id}}', payload1);
      expect(resolved1).toBe('Hello, Bob Jones! ID: S002');
    });

    it('updates bound barcode content when active row changes', () => {
      const barcodeElement = {
        id: 'el-barcode-1',
        type: 'barcode' as const,
        x: 10,
        y: 10,
        width: 40,
        height: 15,
        rotation: 0,
        opacity: 1,
        isLocked: false,
        barcodeFormat: 'CODE128' as const,
        content: 'DEFAULT_CODE',
        bindingField: 'student_id',
      };

      // In design mode (previewMode = false), keeps static content
      const designVal = resolveBarcodeElementContent(barcodeElement, mockPayload, false);
      expect(designVal).toBe('DEFAULT_CODE');

      // Row 0 preview
      const payload0 = { ...mockPayload, ...(getActiveRow(sampleDataSource, 0) || {}) };
      const boundVal0 = resolveBarcodeElementContent(barcodeElement, payload0, true);
      expect(boundVal0).toBe('S001');

      // Row 2: Charlie preview
      const payload2 = { ...mockPayload, ...(getActiveRow(sampleDataSource, 2) || {}) };
      const boundVal2 = resolveBarcodeElementContent(barcodeElement, payload2, true);
      expect(boundVal2).toBe('S003');
    });
  });
});
