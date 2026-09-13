import {
  detectDataSourceFileType,
  parseDataSourceBuffer,
  SUPPORTED_DATA_SOURCE_EXTENSIONS,
} from './dataSourceParser.js';
import type { DataSourceParseResult } from './dataSourceTypes.js';
import { useDataSourceStore } from '../../store/dataSource/useDataSourceStore.js';

export const MAX_DATA_SOURCE_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Reads and parses a user-selected CSV or Excel file, updating the active useDataSourceStore.
 */
export async function importDataSourceFile(file: File): Promise<DataSourceParseResult> {
  if (!file) {
    const err = 'No file selected.';
    useDataSourceStore.getState().setError(err);
    return { success: false, error: err };
  }

  const fileType = detectDataSourceFileType(file.name);
  if (!fileType) {
    const err = 'Unsupported file format. Please select CSV, XLSX or XLS.';
    useDataSourceStore.getState().setError(err);
    return { success: false, error: err };
  }

  if (file.size > MAX_DATA_SOURCE_FILE_SIZE_BYTES) {
    const err = `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 15 MB limit.`;
    useDataSourceStore.getState().setError(err);
    return { success: false, error: err };
  }

  useDataSourceStore.getState().setLoading(true);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = parseDataSourceBuffer(arrayBuffer, file.name);

    if (result.success && result.dataSource) {
      useDataSourceStore.getState().setDataSource(result.dataSource);
    } else {
      useDataSourceStore.getState().setError(result.error || 'Failed to parse data source.');
    }

    return result;
  } catch (_err) {
    const err = 'Unable to read this file. Please verify that the file contains a valid table.';
    useDataSourceStore.getState().setError(err);
    return { success: false, error: err };
  }
}

/**
 * Clears the active data source from the store and persistent storage.
 */
export function removeDataSource(): void {
  useDataSourceStore.getState().clearDataSource();
}

export { SUPPORTED_DATA_SOURCE_EXTENSIONS };

