export type SupportedDataSourceType = 'csv' | 'xlsx' | 'xls';

export interface ImportedDataSource {
  fileName: string;
  fileType: SupportedDataSourceType;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  importedAt: string; // ISO 8601
}

export interface DataSourceParseResult {
  success: boolean;
  dataSource?: ImportedDataSource;
  error?: string;
}

