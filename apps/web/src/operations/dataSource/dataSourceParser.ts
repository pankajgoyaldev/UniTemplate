import * as XLSX from 'xlsx';
import type {
  SupportedDataSourceType,
  ImportedDataSource,
  DataSourceParseResult,
} from './dataSourceTypes.js';

/**
 * Supported file extensions for data source imports.
 */
export const SUPPORTED_DATA_SOURCE_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;

/**
 * Detects whether the given filename has a supported tabular data source extension.
 * Returns the normalized format ('csv' | 'xlsx' | 'xls') or null if unsupported.
 */
export function detectDataSourceFileType(filename: string): SupportedDataSourceType | null {
  if (!filename || typeof filename !== 'string') return null;
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.xls')) return 'xls';
  return null;
}

/**
 * Deterministically normalizes an array of raw column headers:
 * - Empty or whitespace-only headers are converted to `Column_${index + 1}`.
 * - Duplicate headers are disambiguated by appending `_2`, `_3`, etc., avoiding data loss.
 * - Whitespace is trimmed and original casing is preserved.
 */
export function normalizeHeaders(rawHeaders: unknown[]): string[] {
  if (!Array.isArray(rawHeaders)) return [];

  const normalized: string[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < rawHeaders.length; i++) {
    const raw = rawHeaders[i];
    let name = '';

    if (raw !== null && raw !== undefined) {
      name = String(raw).trim();
    }

    if (!name) {
      name = `Column_${i + 1}`;
    }

    let finalName = name;
    const lower = name.toLowerCase();

    if (seen.has(lower)) {
      let count = seen.get(lower)! + 1;
      finalName = `${name}_${count}`;
      while (seen.has(finalName.toLowerCase())) {
        count++;
        finalName = `${name}_${count}`;
      }
      seen.set(lower, count);
      seen.set(finalName.toLowerCase(), 1);
    } else {
      seen.set(lower, 1);
    }

    normalized.push(finalName);
  }

  return normalized;
}

/**
 * Checks if a row is completely blank (all cells null, undefined, or empty strings).
 */
function isRowBlank(row: unknown[]): boolean {
  if (!row || !Array.isArray(row) || row.length === 0) return true;
  return row.every((cell) => {
    if (cell === null || cell === undefined) return true;
    if (typeof cell === 'string' && cell.trim() === '') return true;
    return false;
  });
}

/**
 * Parses binary data or a string representing a CSV, XLSX, or XLS file into a normalized ImportedDataSource.
 *
 * Rules:
 * - Never throws uncaught exceptions; always returns a structured DataSourceParseResult.
 * - First worksheet of an Excel workbook is used.
 * - First non-blank row is treated as column headers.
 * - Subsequent non-blank rows are converted into records.
 * - Handles numbers, booleans, dates, and strings safely.
 * - Empty cells are converted to null.
 */
export function parseDataSourceBuffer(
  data: ArrayBuffer | Uint8Array | string,
  filename: string,
): DataSourceParseResult {
  const fileType = detectDataSourceFileType(filename);
  if (!fileType) {
    return {
      success: false,
      error: 'Unsupported file format. Please select CSV, XLSX or XLS.',
    };
  }

  try {
    const isStringInput = typeof data === 'string';
    const workbook = isStringInput
      ? XLSX.read(data, { type: 'string', cellDates: true })
      : XLSX.read(data instanceof Uint8Array ? data : new Uint8Array(data), {
          type: 'array',
          cellDates: true,
        });

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        error: 'Unable to read this file. Please verify that the file contains a valid table.',
      };
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      return {
        success: false,
        error: 'The first worksheet in this workbook could not be loaded.',
      };
    }

    // Convert sheet to 2D array of rows
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (!rawRows || rawRows.length === 0) {
      return {
        success: false,
        error: 'The file is empty.',
      };
    }

    // Find first non-blank row for headers
    let headerRowIndex = -1;
    for (let r = 0; r < rawRows.length; r++) {
      if (!isRowBlank(rawRows[r])) {
        headerRowIndex = r;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return {
        success: false,
        error: 'The file is empty.',
      };
    }

    const rawHeaders = rawRows[headerRowIndex];
    // Filter out trailing completely empty headers if any
    let lastValidHeaderIndex = rawHeaders.length - 1;
    while (
      lastValidHeaderIndex >= 0 &&
      (rawHeaders[lastValidHeaderIndex] === null ||
        rawHeaders[lastValidHeaderIndex] === undefined ||
        String(rawHeaders[lastValidHeaderIndex]).trim() === '')
    ) {
      lastValidHeaderIndex--;
    }

    // If all headers were empty, treat up to rawHeaders.length as Column_1, etc.
    const effectiveHeaders =
      lastValidHeaderIndex >= 0
        ? rawHeaders.slice(0, lastValidHeaderIndex + 1)
        : rawHeaders;

    const columns = normalizeHeaders(effectiveHeaders);
    if (columns.length === 0) {
      return {
        success: false,
        error: 'The file does not contain a valid header row.',
      };
    }

    // Process data rows
    const rawDataRows = rawRows.slice(headerRowIndex + 1);
    const rows: Record<string, unknown>[] = [];

    for (const rawRow of rawDataRows) {
      if (isRowBlank(rawRow)) continue;

      const record: Record<string, unknown> = {};
      for (let c = 0; c < columns.length; c++) {
        const colName = columns[c];
        const cell = rawRow[c];

        if (cell === undefined || cell === null) {
          record[colName] = null;
        } else if (cell instanceof Date) {
          record[colName] = isNaN(cell.getTime()) ? null : cell.toISOString().split('T')[0];
        } else if (typeof cell === 'number') {
          record[colName] = Number.isFinite(cell) ? cell : null;
        } else if (typeof cell === 'boolean') {
          record[colName] = cell;
        } else {
          const str = String(cell).trim();
          record[colName] = str;
        }
      }
      rows.push(record);
    }

    if (rows.length === 0) {
      return {
        success: false,
        error: 'The file contains headers but no data rows.',
      };
    }

    const dataSource: ImportedDataSource = {
      fileName: filename,
      fileType,
      columns,
      rows,
      rowCount: rows.length,
      importedAt: new Date().toISOString(),
    };

    return {
      success: true,
      dataSource,
    };
  } catch (_err) {
    return {
      success: false,
      error: 'Unable to read this file. Please verify that the file contains a valid table.',
    };
  }
}

