import * as XLSX from 'xlsx';
import type { DataField } from '@uts/core';

/**
 * Sanitizes a template title so it is safe to use in filenames across operating systems.
 */
function sanitizeFilename(name: string): string {
  const sanitized = name.trim().replace(/[/\\?%*:|"<>]/g, '_');
  return sanitized.length > 0 ? sanitized : 'template';
}

/**
 * Generates an XLSX workbook pre-populated with column headers corresponding
 * to the template's defined variables (dataSchema.fields) in their defined order.
 */
export function generateExcelTemplateWorkbook(fields: DataField[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const headers = (fields || []).map((f) => f.name);
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Data');
  return workbook;
}

/**
 * Triggers a client-side download of an Excel (.xlsx) file containing variable headers,
 * ready for users to fill in records for batch generation or live preview.
 */
export function downloadExcelTemplate(fields: DataField[], templateTitle?: string): void {
  if (!fields || fields.length === 0) {
    return;
  }

  const workbook = generateExcelTemplateWorkbook(fields);
  const baseName = sanitizeFilename(templateTitle || 'template');
  const fileName = `${baseName}_Data.xlsx`;

  XLSX.writeFile(workbook, fileName);
}
