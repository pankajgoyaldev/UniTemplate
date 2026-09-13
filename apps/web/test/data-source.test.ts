import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import {
  detectDataSourceFileType,
  normalizeHeaders,
  parseDataSourceBuffer,
} from '../src/operations/dataSource/dataSourceParser.js';
import { useDataSourceStore } from '../src/store/dataSource/useDataSourceStore.js';
import { useTemplateStore } from '../src/store/useTemplateStore.js';
import { useHistoryStore } from '../src/store/history/useHistoryStore.js';

describe('Task 10 — Excel/CSV Data Source Integration', () => {
  beforeEach(() => {
    useDataSourceStore.getState().clearDataSource();
  });

  // --------------------------------------------------------------------------
  // 1. File Type Detection
  // --------------------------------------------------------------------------
  describe('1. File Type Detection (detectDataSourceFileType)', () => {
    it('detects .csv, .xlsx, and .xls case-insensitively', () => {
      expect(detectDataSourceFileType('students.csv')).toBe('csv');
      expect(detectDataSourceFileType('data.CSV')).toBe('csv');
      expect(detectDataSourceFileType('inventory.xlsx')).toBe('xlsx');
      expect(detectDataSourceFileType('REPORT.XLSX')).toBe('xlsx');
      expect(detectDataSourceFileType('legacy.xls')).toBe('xls');
      expect(detectDataSourceFileType('EXPORT.XLS')).toBe('xls');
    });

    it('rejects unsupported extensions', () => {
      expect(detectDataSourceFileType('document.pdf')).toBeNull();
      expect(detectDataSourceFileType('image.png')).toBeNull();
      expect(detectDataSourceFileType('data.json')).toBeNull();
      expect(detectDataSourceFileType('notes.txt')).toBeNull();
      expect(detectDataSourceFileType('template.uts')).toBeNull();
      expect(detectDataSourceFileType('')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Header Normalization
  // --------------------------------------------------------------------------
  describe('2. Header Normalization (normalizeHeaders)', () => {
    it('preserves valid, unique headers', () => {
      const headers = ['student_name', 'roll_no', 'marks', 'class'];
      expect(normalizeHeaders(headers)).toEqual(['student_name', 'roll_no', 'marks', 'class']);
    });

    it('disambiguates duplicate headers deterministically without data loss', () => {
      const headers = ['Name', 'Name', 'Marks'];
      expect(normalizeHeaders(headers)).toEqual(['Name', 'Name_2', 'Marks']);

      const triple = ['Score', 'Score', 'Score'];
      expect(normalizeHeaders(triple)).toEqual(['Score', 'Score_2', 'Score_3']);
    });

    it('disambiguates case-insensitive duplicate headers', () => {
      const headers = ['Name', 'NAME', 'name'];
      expect(normalizeHeaders(headers)).toEqual(['Name', 'NAME_2', 'name_3']);
    });

    it('fills empty or whitespace headers with deterministic fallback', () => {
      const headers = ['Name', '', 'Marks', '   ', 'Grade'];
      expect(normalizeHeaders(headers)).toEqual(['Name', 'Column_2', 'Marks', 'Column_4', 'Grade']);
    });

    it('trims whitespace on headers', () => {
      const headers = ['  student_id  ', ' total_amount '];
      expect(normalizeHeaders(headers)).toEqual(['student_id', 'total_amount']);
    });

    it('handles non-string headers safely', () => {
      const headers = [101, 202, null, undefined];
      expect(normalizeHeaders(headers)).toEqual(['101', '202', 'Column_3', 'Column_4']);
    });
  });

  // --------------------------------------------------------------------------
  // 3. CSV Parsing
  // --------------------------------------------------------------------------
  describe('3. CSV Parsing', () => {
    it('parses standard CSV with strings and numbers', () => {
      const csv = `student_name,roll_no,marks,class
Pankaj,101,85,10
Rahul,102,91,10
Aman,103,76,10`;

      const result = parseDataSourceBuffer(csv, 'students.csv');
      expect(result.success).toBe(true);
      expect(result.dataSource).toBeDefined();

      const ds = result.dataSource!;
      expect(ds.fileName).toBe('students.csv');
      expect(ds.fileType).toBe('csv');
      expect(ds.columns).toEqual(['student_name', 'roll_no', 'marks', 'class']);
      expect(ds.rowCount).toBe(3);
      expect(ds.rows).toHaveLength(3);

      expect(ds.rows[0]).toEqual({
        student_name: 'Pankaj',
        roll_no: 101,
        marks: 85,
        class: 10,
      });
      expect(ds.rows[1]).toEqual({
        student_name: 'Rahul',
        roll_no: 102,
        marks: 91,
        class: 10,
      });
    });

    it('parses CSV with quoted values containing commas', () => {
      const csv = `id,description,price
1,"Widget, Deluxe",199.99
2,"Gadget, Super",299.50`;

      const result = parseDataSourceBuffer(csv, 'products.csv');
      expect(result.success).toBe(true);
      const ds = result.dataSource!;
      expect(ds.rowCount).toBe(2);
      expect(ds.rows[0].description).toBe('Widget, Deluxe');
      expect(ds.rows[0].price).toBe(199.99);
    });

    it('handles empty cells gracefully by assigning null', () => {
      const csv = `name,email,phone
Alice,alice@example.com,555-1234
Bob,,555-5678
Charlie,charlie@example.com,`;

      const result = parseDataSourceBuffer(csv, 'contacts.csv');
      expect(result.success).toBe(true);
      const ds = result.dataSource!;
      expect(ds.rows[1].email).toBeNull();
      expect(ds.rows[2].phone).toBeNull();
    });

    it('handles duplicate headers in CSV without crashing or data loss', () => {
      const csv = `Name,Name,Score
Alice,Smith,95
Bob,Jones,88`;

      const result = parseDataSourceBuffer(csv, 'scores.csv');
      expect(result.success).toBe(true);
      const ds = result.dataSource!;
      expect(ds.columns).toEqual(['Name', 'Name_2', 'Score']);
      expect(ds.rows[0]).toEqual({
        Name: 'Alice',
        Name_2: 'Smith',
        Score: 95,
      });
    });
  });

  // --------------------------------------------------------------------------
  // 4. Excel (XLSX / XLS) Parsing
  // --------------------------------------------------------------------------
  describe('4. Excel (XLSX / XLS) Parsing', () => {
    it('parses in-memory XLSX workbook correctly', () => {
      const aoa = [
        ['product_code', 'title', 'in_stock', 'unit_price'],
        ['PRD-01', 'Keyboard', true, 45.5],
        ['PRD-02', 'Mouse', false, 25.0],
        ['PRD-03', 'Monitor', true, 199.99],
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const result = parseDataSourceBuffer(buffer, 'inventory.xlsx');
      expect(result.success).toBe(true);
      const ds = result.dataSource!;
      expect(ds.fileName).toBe('inventory.xlsx');
      expect(ds.fileType).toBe('xlsx');
      expect(ds.columns).toEqual(['product_code', 'title', 'in_stock', 'unit_price']);
      expect(ds.rowCount).toBe(3);
      expect(ds.rows[0].product_code).toBe('PRD-01');
      expect(ds.rows[0].in_stock).toBe(true);
      expect(ds.rows[0].unit_price).toBe(45.5);
    });

    it('parses XLS (BIFF8) workbook correctly', () => {
      const aoa = [
        ['invoice_id', 'client', 'amount'],
        ['INV-001', 'Acme Corp', 1500],
        ['INV-002', 'Beta LLC', 2750],
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'biff8' });

      const result = parseDataSourceBuffer(buffer, 'invoices.xls');
      expect(result.success).toBe(true);
      const ds = result.dataSource!;
      expect(ds.fileType).toBe('xls');
      expect(ds.rowCount).toBe(2);
      expect(ds.rows[1].client).toBe('Beta LLC');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Error Handling & Edge Cases
  // --------------------------------------------------------------------------
  describe('5. Error Handling & Edge Cases', () => {
    it('handles empty CSV input safely', () => {
      const result = parseDataSourceBuffer('', 'empty.csv');
      expect(result.success).toBe(false);
      expect(result.error).toBe('The file is empty.');
    });

    it('handles CSV with headers but zero data rows safely', () => {
      const csv = 'col1,col2,col3';
      const result = parseDataSourceBuffer(csv, 'headers_only.csv');
      expect(result.success).toBe(false);
      expect(result.error).toBe('The file contains headers but no data rows.');
    });

    it('handles CSV with only whitespace rows', () => {
      const csv = `col1,col2\n   \n   \n`;
      const result = parseDataSourceBuffer(csv, 'blank_rows.csv');
      expect(result.success).toBe(false);
      expect(result.error).toBe('The file contains headers but no data rows.');
    });

    it('handles unsupported file extension safely', () => {
      const result = parseDataSourceBuffer('test data', 'document.pdf');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported file format');
    });

    it('handles malformed workbook safely without throwing', () => {
      const malformedBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
      const result = parseDataSourceBuffer(malformedBytes, 'corrupted.xlsx');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Data Source Store Behavior
  // --------------------------------------------------------------------------
  describe('6. Data Source Store Behavior', () => {
    it('sets data source, clears errors, and allows removal', () => {
      const store = useDataSourceStore.getState();
      expect(store.dataSource).toBeNull();
      expect(store.error).toBeNull();

      const mockData = {
        fileName: 'test.csv',
        fileType: 'csv' as const,
        columns: ['name', 'age'],
        rows: [{ name: 'Test', age: 30 }],
        rowCount: 1,
        importedAt: new Date().toISOString(),
      };

      store.setDataSource(mockData);
      expect(useDataSourceStore.getState().dataSource).toEqual(mockData);

      store.clearDataSource();
      expect(useDataSourceStore.getState().dataSource).toBeNull();
    });

    it('sets and clears error state cleanly', () => {
      const store = useDataSourceStore.getState();
      store.setError('Sample error');
      expect(useDataSourceStore.getState().error).toBe('Sample error');

      store.setError(null);
      expect(useDataSourceStore.getState().error).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Non-Interference with Task 9 (AST & Undo/Redo Isolation)
  // --------------------------------------------------------------------------
  describe('7. Isolation: Non-Interference with Template AST & History', () => {
    it('importing a data source does NOT mutate template variables or history', () => {
      const templateBefore = useTemplateStore.getState().template;
      const historyBeforeCanUndo = useHistoryStore.getState().canUndo;

      const mockData = {
        fileName: 'students.csv',
        fileType: 'csv' as const,
        columns: ['student_name', 'grade', 'marks'],
        rows: [{ student_name: 'Pankaj', grade: 'A', marks: 95 }],
        rowCount: 1,
        importedAt: new Date().toISOString(),
      };

      // Set data source
      useDataSourceStore.getState().setDataSource(mockData);

      // Template state remains strictly identical
      const templateAfter = useTemplateStore.getState().template;
      expect(templateAfter).toBe(templateBefore);
      expect(templateAfter.dataSchema.fields).toBe(templateBefore.dataSchema.fields);
      expect(templateAfter.dataSchema.mockPayload).toBe(templateBefore.dataSchema.mockPayload);

      // History was NOT touched
      expect(useHistoryStore.getState().canUndo).toBe(historyBeforeCanUndo);

      // Removing data source also does not touch template
      useDataSourceStore.getState().clearDataSource();
      expect(useTemplateStore.getState().template).toBe(templateBefore);
    });
  });
});
