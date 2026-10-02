import { describe, it, expect, beforeEach } from 'vitest';
import type { DataField, TemplateAst } from '@uts/core';
import { validateTemplateAst, serializeUts, parseUts } from '@uts/core';
import {
  normalizeColumnIdentifier,
  autoMatchColumns,
  getMappingStatus,
  buildMappedPayload,
} from '../src/operations/dataSource/columnMapping.js';
import { useTemplateStore } from '../src/store/useTemplateStore.js';
import { useDataSourceStore, getActiveRow } from '../src/store/dataSource/useDataSourceStore.js';
import { resolveTemplateTokens, resolveBarcodeElementContent } from '@uts/canvas-engine';

describe('Phase 2: Excel Column → Template Variable Mapping', () => {
  beforeEach(() => {
    useDataSourceStore.getState().clearDataSource();
  });

  const sampleFields: DataField[] = [
    { name: 'student_name', type: 'string', sampleValue: 'Sample Student' },
    { name: 'father_name', type: 'string', sampleValue: 'Sample Father' },
    { name: 'class', type: 'string', sampleValue: '10th' },
    { name: 'roll_no', type: 'string', sampleValue: '001' },
  ];

  // --------------------------------------------------------------------------
  // A. Normalization
  // --------------------------------------------------------------------------
  describe('A. Normalization (normalizeColumnIdentifier)', () => {
    it('normalizes various casing, spaces, hyphens, and underscores consistently', () => {
      const target = 'studentname';
      expect(normalizeColumnIdentifier('Student Name')).toBe(target);
      expect(normalizeColumnIdentifier('student_name')).toBe(target);
      expect(normalizeColumnIdentifier('student-name')).toBe(target);
      expect(normalizeColumnIdentifier('STUDENT NAME')).toBe(target);
      expect(normalizeColumnIdentifier('  STUDENT   NAME  ')).toBe(target);
      expect(normalizeColumnIdentifier('studentName')).toBe(target);
      expect(normalizeColumnIdentifier('Student_Name')).toBe(target);
      expect(normalizeColumnIdentifier('student--name')).toBe(target);
    });

    it('handles empty or non-string inputs safely', () => {
      expect(normalizeColumnIdentifier('')).toBe('');
      expect(normalizeColumnIdentifier('   ')).toBe('');
      expect(normalizeColumnIdentifier(null as unknown as string)).toBe('');
      expect(normalizeColumnIdentifier(undefined as unknown as string)).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // B. Automatic Exact Matching
  // --------------------------------------------------------------------------
  describe('B. Automatic Exact Matching (autoMatchColumns)', () => {
    it('automatically matches normalized column names to variables', () => {
      const availableColumns = ['Student Name', 'Father Name', 'Class', 'Score'];
      const mapping = autoMatchColumns(sampleFields, availableColumns, {});

      expect(mapping.student_name).toBe('Student Name');
      expect(mapping.father_name).toBe('Father Name');
      expect(mapping.class).toBe('Class');
    });

    it('handles columns with different separator styles (hyphens, spaces, underscores)', () => {
      const availableColumns = ['student-name', 'FATHER_NAME', 'CLASS'];
      const mapping = autoMatchColumns(sampleFields, availableColumns, {});

      expect(mapping.student_name).toBe('student-name');
      expect(mapping.father_name).toBe('FATHER_NAME');
      expect(mapping.class).toBe('CLASS');
    });
  });

  // --------------------------------------------------------------------------
  // C. No Unsafe Fuzzy Matching
  // --------------------------------------------------------------------------
  describe('C. Strict Matching Safety (No Unsafe Fuzzy Matching)', () => {
    it('leaves variables unmapped when no normalized exact match exists', () => {
      // "Roll Number" should NOT automatically map to "roll_no" without an explicit alias
      const availableColumns = ['Student Name', 'Roll Number', 'Grade Level'];
      const mapping = autoMatchColumns(sampleFields, availableColumns, {});

      expect(mapping.student_name).toBe('Student Name');
      expect(mapping.roll_no).toBeUndefined();
      expect(mapping.father_name).toBeUndefined();
      expect(mapping.class).toBeUndefined();
    });

    it('does not map unrelated columns', () => {
      const availableColumns = ['Address', 'City', 'Phone', 'ZipCode'];
      const mapping = autoMatchColumns(sampleFields, availableColumns, {});

      expect(Object.keys(mapping).length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // D. Manual Mapping & Status
  // --------------------------------------------------------------------------
  describe('D. Mapping Statuses (getMappingStatus)', () => {
    const columns = ['Student Name', 'Class'];

    it('reports mapped when column exists in dataset', () => {
      const status = getMappingStatus('student_name', 'Student Name', columns);
      expect(status.status).toBe('mapped');
      expect(status.mappedColumn).toBe('Student Name');
    });

    it('reports unmapped when no column is configured', () => {
      const status1 = getMappingStatus('roll_no', undefined, columns);
      expect(status1.status).toBe('unmapped');
      expect(status1.mappedColumn).toBeNull();

      const status2 = getMappingStatus('roll_no', '', columns);
      expect(status2.status).toBe('unmapped');
      expect(status2.mappedColumn).toBeNull();
    });

    it('reports invalid when mapped column is missing in dataset', () => {
      const status = getMappingStatus('father_name', 'Father Name', columns);
      expect(status.status).toBe('invalid');
      expect(status.mappedColumn).toBe('Father Name');
    });
  });

  // --------------------------------------------------------------------------
  // E & F. Data Source Replacement & Invalid Mapping Preservation
  // --------------------------------------------------------------------------
  describe('E & F. Data Source Replacement & Mapping Preservation', () => {
    it('preserves valid mappings and marks missing columns as invalid without losing user selection', () => {
      const existingMapping = {
        student_name: 'Student Name',
        father_name: 'Father Name',
        class: 'Class',
      };

      // Replacement dataset has Student Name and Class, but Father Name is missing
      const newColumns = ['Student Name', 'Class', 'Roll Number'];
      const updatedMapping = autoMatchColumns(sampleFields, newColumns, existingMapping);

      // Valid mappings preserved
      expect(updatedMapping.student_name).toBe('Student Name');
      expect(updatedMapping.class).toBe('Class');

      // Missing column is retained in mapping so it can be flagged as invalid
      expect(updatedMapping.father_name).toBe('Father Name');
      const fatherStatus = getMappingStatus('father_name', updatedMapping.father_name, newColumns);
      expect(fatherStatus.status).toBe('invalid');
    });

    it('does not overwrite an explicit user mapping with a different column', () => {
      // User explicitly mapped roll_no to "Student ID" previously
      const existingMapping = {
        roll_no: 'Student ID',
      };

      // New dataset contains both "Student ID" and "roll_no"
      const newColumns = ['Student ID', 'roll_no', 'Student Name'];
      const updatedMapping = autoMatchColumns(sampleFields, newColumns, existingMapping);

      // Must keep user's explicit selection "Student ID", NOT overwrite with "roll_no"
      expect(updatedMapping.roll_no).toBe('Student ID');
    });
  });

  // --------------------------------------------------------------------------
  // G. Preview Resolution via Mapping
  // --------------------------------------------------------------------------
  describe('G. Preview Resolution via Column Mapping (buildMappedPayload)', () => {
    it('maps active row columns into variable names correctly', () => {
      const activeRow = {
        'Student Name': 'Rahul Sharma',
        Class: '10th-A',
        'Extra Unmapped Header': 'Ignored Data',
      };

      const mapping = {
        student_name: 'Student Name',
        class: 'Class',
      };

      const mappedPayload = buildMappedPayload(activeRow, sampleFields, mapping);
      expect(mappedPayload.student_name).toBe('Rahul Sharma');
      expect(mappedPayload.class).toBe('10th-A');
      // Unmapped variable is omitted
      expect(mappedPayload.father_name).toBeUndefined();
      // Extra Excel column is omitted
      expect((mappedPayload as Record<string, unknown>)['Extra Unmapped Header']).toBeUndefined();
    });

    it('resolves template tokens in preview using mapped row values', () => {
      const activeRow = {
        'Student Name': 'Rahul Sharma',
        Class: '10th-A',
      };
      const mapping = {
        student_name: 'Student Name',
        class: 'Class',
      };
      const mockPayload = {
        student_name: 'Default Student',
        class: 'Default Class',
        father_name: 'Default Father',
      };

      const mappedPayload = buildMappedPayload(activeRow, sampleFields, mapping);
      const effectivePayload = { ...mockPayload, ...mappedPayload };

      const resolved = resolveTemplateTokens('Name: {{student_name}}, Class: {{class}}', effectivePayload);
      expect(resolved).toBe('Name: Rahul Sharma, Class: 10th-A');
    });
  });

  // --------------------------------------------------------------------------
  // H. Mock Fallback
  // --------------------------------------------------------------------------
  describe('H. Mock Fallback Behavior', () => {
    it('falls back to mockPayload for unmapped variables or missing Excel cells', () => {
      const activeRow = {
        'Student Name': 'Rahul Sharma',
        Class: '', // Empty in Excel row
      };
      const mapping = {
        student_name: 'Student Name',
        class: 'Class',
        // father_name is unmapped
      };
      const mockPayload = {
        student_name: 'Mock Student',
        father_name: 'Mr. Sharma',
        class: 'Class 9',
      };

      const mappedPayload = buildMappedPayload(activeRow, sampleFields, mapping);
      const effectivePayload = { ...mockPayload, ...mappedPayload };

      // student_name: provided by Excel
      expect(effectivePayload.student_name).toBe('Rahul Sharma');
      // father_name: unmapped -> falls back to mock
      expect(effectivePayload.father_name).toBe('Mr. Sharma');
      // class: empty in Excel -> falls back to mock
      expect(effectivePayload.class).toBe('Class 9');
    });

    it('handles null activeRow gracefully with empty mapped payload', () => {
      const mappedPayload = buildMappedPayload(null, sampleFields, {});
      expect(mappedPayload).toEqual({});
    });
  });

  // --------------------------------------------------------------------------
  // I. Extra Columns Safety
  // --------------------------------------------------------------------------
  describe('I. Extra Columns Safety', () => {
    it('does not create variables or inject unmapped Excel columns into the payload', () => {
      const activeRow = {
        'Student Name': 'Alice',
        Phone: '555-1234',
        Address: '123 Main St',
        Age: 16,
      };
      const mapping = {
        student_name: 'Student Name',
      };

      const mappedPayload = buildMappedPayload(activeRow, sampleFields, mapping);
      expect(mappedPayload).toEqual({ student_name: 'Alice' });
      expect((mappedPayload as Record<string, unknown>).Phone).toBeUndefined();
      expect((mappedPayload as Record<string, unknown>).Address).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // J. Template Save / Load & Schema Validation
  // --------------------------------------------------------------------------
  describe('J. Template Serialization & Deserialization with Column Mapping', () => {
    it('validates template with columnMapping via validateTemplateAst', () => {
      const template = useTemplateStore.getState().template;
      const mapping = {
        invoiceNo: 'Invoice Number',
        totalAmount: 'Total Due',
      };

      const withMapping: TemplateAst = {
        ...template,
        dataSchema: {
          ...template.dataSchema,
          columnMapping: mapping,
        },
      };

      const validated = validateTemplateAst(withMapping);
      expect(validated.dataSchema.columnMapping).toEqual(mapping);
    });

    it('preserves columnMapping through serializeUts and deserializeUts packaging', async () => {
      const template = useTemplateStore.getState().template;
      const mapping = {
        invoiceNo: 'Invoice Number',
        totalAmount: 'Grand Total',
      };

      const templateWithMapping: TemplateAst = {
        ...template,
        dataSchema: {
          ...template.dataSchema,
          columnMapping: mapping,
        },
      };

      const pkg = {
        template: templateWithMapping,
        assets: new Map<string, Uint8Array>(),
      };

      const archiveBytes = await serializeUts(pkg);
      expect(archiveBytes).toBeInstanceOf(Uint8Array);

      const restored = await parseUts(archiveBytes);
      expect(restored.template.dataSchema.columnMapping).toEqual(mapping);
    });

    it('defaults columnMapping to empty object for legacy templates without mapping', () => {
      const legacyTemplate = {
        schemaVersion: '1.0.0',
        metadata: {
          id: 'legacy_tpl',
          title: 'Legacy Invoice',
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
          fields: [{ name: 'client', type: 'string' }],
          mockPayload: { client: 'ACME' },
          // No columnMapping property
        },
        elements: [],
      };

      const validated = validateTemplateAst(legacyTemplate);
      expect(validated.dataSchema.columnMapping).toBeDefined();
      expect(validated.dataSchema.columnMapping).toEqual({});
    });
  });

  // --------------------------------------------------------------------------
  // K. Template Store Actions
  // --------------------------------------------------------------------------
  describe('K. useTemplateStore Column Mapping Actions', () => {
    it('sets and updates column mappings cleanly in template store', () => {
      const store = useTemplateStore.getState();

      store.setColumnMapping({ student_name: 'Student Name' });
      expect(useTemplateStore.getState().template.dataSchema.columnMapping?.student_name).toBe('Student Name');

      store.updateColumnMapping('class', 'Class Section');
      expect(useTemplateStore.getState().template.dataSchema.columnMapping?.class).toBe('Class Section');
      expect(useTemplateStore.getState().template.dataSchema.columnMapping?.student_name).toBe('Student Name');

      // Clearing a mapping by passing empty string or null
      store.updateColumnMapping('class', '');
      expect(useTemplateStore.getState().template.dataSchema.columnMapping?.class).toBeUndefined();
    });

    it('migrates columnMapping key when a variable is renamed', () => {
      const store = useTemplateStore.getState();
      store.addVariable({ name: 'old_var', type: 'string' }, 'sample');
      store.updateColumnMapping('old_var', 'Old Column');
      expect(useTemplateStore.getState().template.dataSchema.columnMapping?.old_var).toBe('Old Column');

      store.updateVariable('old_var', { name: 'new_var' });
      const mapping = useTemplateStore.getState().template.dataSchema.columnMapping;
      expect(mapping?.new_var).toBe('Old Column');
      expect(mapping?.old_var).toBeUndefined();
    });

    it('removes variable from columnMapping when variable is deleted', () => {
      const store = useTemplateStore.getState();
      store.addVariable({ name: 'temp_var', type: 'string' }, 'sample');
      store.updateColumnMapping('temp_var', 'Temp Column');
      expect(useTemplateStore.getState().template.dataSchema.columnMapping?.temp_var).toBe('Temp Column');

      store.deleteVariable('temp_var');
      const mapping = useTemplateStore.getState().template.dataSchema.columnMapping;
      expect(mapping?.temp_var).toBeUndefined();
    });
  });
});
