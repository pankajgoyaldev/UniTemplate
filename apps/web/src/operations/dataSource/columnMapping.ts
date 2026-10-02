import type { DataField } from '@uts/core';

export type MappingStatusType = 'mapped' | 'unmapped' | 'invalid';

export interface VariableMappingStatus {
  variableName: string;
  mappedColumn: string | null;
  status: MappingStatusType;
}

/**
 * Normalizes a variable or column identifier for deterministic automatic matching.
 * Performs lowercase conversion, trimming, and strips all whitespace, underscores, and hyphens.
 *
 * Examples that normalize equivalently:
 * - "Student Name" -> "studentname"
 * - "student_name" -> "studentname"
 * - "student-name" -> "studentname"
 * - "STUDENT   NAME" -> "studentname"
 */
export function normalizeColumnIdentifier(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_\-]+/g, '');
}

/**
 * Determines the mapping status of a single template variable against the currently available columns.
 * - 'mapped': Mapped to a column that currently exists in the dataset.
 * - 'unmapped': No column has been assigned to this variable.
 * - 'invalid': A mapped column name exists in mapping, but does not exist in the active dataset.
 */
export function getMappingStatus(
  variableName: string,
  mappedColumn: string | undefined | null,
  availableColumns: string[],
): VariableMappingStatus {
  if (!mappedColumn || mappedColumn.trim().length === 0) {
    return {
      variableName,
      mappedColumn: null,
      status: 'unmapped',
    };
  }

  if (availableColumns.includes(mappedColumn)) {
    return {
      variableName,
      mappedColumn,
      status: 'mapped',
    };
  }

  return {
    variableName,
    mappedColumn,
    status: 'invalid',
  };
}

/**
 * Computes the column mapping for all template variables against available dataset columns:
 * 1. Preserves explicit user mappings where the source column still exists.
 * 2. Preserves existing mappings even if the column disappeared, so the UI can flag them as invalid
 *    rather than silently remapping them to an unrelated column.
 * 3. For variables without a valid mapping, attempts safe, exact normalized matching against available columns.
 * 4. Leaves variables unmapped if no safe match exists (no unsafe fuzzy matching).
 */
export function autoMatchColumns(
  fields: DataField[],
  availableColumns: string[],
  existingMapping: Record<string, string> = {},
): Record<string, string> {
  const result: Record<string, string> = {};

  // Build normalized lookup map for available dataset columns (first column wins on normalized collision)
  const normalizedLookup = new Map<string, string>();
  for (const col of availableColumns) {
    const norm = normalizeColumnIdentifier(col);
    if (!normalizedLookup.has(norm)) {
      normalizedLookup.set(norm, col);
    }
  }

  for (const field of fields) {
    const varName = field.name;
    const existingCol = existingMapping[varName];

    // Case 1: Existing mapping is still valid in the new/current dataset -> PRESERVE
    if (existingCol && availableColumns.includes(existingCol)) {
      result[varName] = existingCol;
      continue;
    }

    // Case 2: Existing mapping points to a column that disappeared -> KEEP as invalid
    // This prevents unexpectedly overwriting user-configured mappings.
    if (existingCol && existingCol.trim().length > 0) {
      result[varName] = existingCol;
      continue;
    }

    // Case 3: Variable is unmapped -> safe exact normalized match
    const normVar = normalizeColumnIdentifier(varName);
    if (normalizedLookup.has(normVar)) {
      result[varName] = normalizedLookup.get(normVar)!;
    }
  }

  return result;
}

/**
 * Extracts and maps active row data into template variable fields based on the column mapping.
 *
 * Rules:
 * - Only mapped columns become variable payload fields.
 * - Missing or empty Excel values are omitted from the output so the caller can fall back to mockPayload.
 * - Extra unmapped Excel columns are strictly excluded.
 */
export function buildMappedPayload(
  activeRow: Record<string, unknown> | null,
  fields: DataField[],
  columnMapping: Record<string, string> = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (!activeRow) return payload;

  for (const field of fields) {
    const varName = field.name;
    const sourceCol = columnMapping[varName];

    if (sourceCol && Object.prototype.hasOwnProperty.call(activeRow, sourceCol)) {
      const val = activeRow[sourceCol];
      if (val !== undefined && val !== null && val !== '') {
        payload[varName] = val;
      }
    }
  }

  return payload;
}
