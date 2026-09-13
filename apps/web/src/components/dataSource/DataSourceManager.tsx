import React, { useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Trash2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Table as TableIcon,
} from 'lucide-react';
import { useDataSourceStore } from '../../store/dataSource/useDataSourceStore.js';
import {
  importDataSourceFile,
  removeDataSource,
  SUPPORTED_DATA_SOURCE_EXTENSIONS,
} from '../../operations/dataSource/index.js';

const PREVIEW_MAX_ROWS = 20;

export const DataSourceManager: React.FC = () => {
  const dataSource = useDataSourceStore((s) => s.dataSource);
  const isLoading = useDataSourceStore((s) => s.isLoading);
  const error = useDataSourceStore((s) => s.error);
  const setError = useDataSourceStore((s) => s.setError);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again if needed
    e.target.value = '';

    await importDataSourceFile(file);
  };

  const handleRemove = () => {
    if (!dataSource) return;
    if (confirm(`Remove data source "${dataSource.fileName}" (${dataSource.rowCount} rows)?`)) {
      removeDataSource();
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'xlsx':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60';
      case 'xls':
        return 'bg-teal-950/60 text-teal-400 border-teal-800/60';
      case 'csv':
      default:
        return 'bg-blue-950/60 text-blue-400 border-blue-800/60';
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_DATA_SOURCE_EXTENSIONS.join(',')}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Error Alert */}
      {error && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-white text-[11px] font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="p-8 rounded-lg bg-zinc-900/60 border border-studio-border flex flex-col items-center justify-center gap-3 text-studio-muted">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          <p className="text-xs text-studio-text font-medium">Parsing spreadsheet data...</p>
          <p className="text-[11px] text-zinc-500">Extracting columns and rows client-side</p>
        </div>
      )}

      {/* Empty State */}
      {!dataSource && !isLoading && (
        <div className="p-8 rounded-xl border border-dashed border-studio-border/80 text-center flex flex-col items-center justify-center bg-zinc-900/20">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-studio-border flex items-center justify-center text-blue-400 mb-3 shadow-sm">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-studio-text mb-1">No data source imported</h4>
          <p className="text-xs text-zinc-400 max-w-sm mb-4">
            Import a CSV or Excel file to inspect tabular records. Columns will be available for dynamic mapping and batch generation.
          </p>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700 text-zinc-300">
              .CSV
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700 text-zinc-300">
              .XLSX
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700 text-zinc-300">
              .XLS
            </span>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV / Excel</span>
          </button>
        </div>
      )}

      {/* Active Data Source Summary & Preview */}
      {dataSource && !isLoading && (
        <div className="space-y-3">
          {/* Header Summary Bar */}
          <div className="p-3 rounded-lg bg-zinc-900/80 border border-studio-border flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/60 flex items-center justify-center text-blue-400 shrink-0">
                <TableIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-studio-text truncate" title={dataSource.fileName}>
                    {dataSource.fileName}
                  </span>
                  <span
                    className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border ${getTypeBadgeColor(
                      dataSource.fileType,
                    )}`}
                  >
                    {dataSource.fileType}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span>
                    <strong className="font-mono text-zinc-200">{dataSource.columns.length}</strong> columns
                  </span>
                  <span>•</span>
                  <span>
                    <strong className="font-mono text-zinc-200">{dataSource.rowCount}</strong> rows
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs transition-colors"
                title="Replace with another file"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs transition-colors"
                title="Remove imported data source"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
            </div>
          </div>

          {/* Table Preview Title & Status */}
          <div className="flex items-center justify-between text-xs px-0.5">
            <span className="text-studio-muted font-medium">Dataset Preview</span>
            <span className="text-[11px] text-zinc-500 font-mono">
              Showing first {Math.min(PREVIEW_MAX_ROWS, dataSource.rowCount)} of {dataSource.rowCount} rows
            </span>
          </div>

          {/* Scrollable Data Table */}
          <div className="border border-studio-border rounded-lg overflow-hidden bg-zinc-950 shadow-inner">
            <div className="max-h-[360px] overflow-x-auto overflow-y-auto">
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead className="sticky top-0 bg-zinc-900 border-b border-studio-border text-zinc-300 select-none shadow-sm">
                  <tr>
                    <th className="py-2 px-3 text-[10px] text-zinc-500 font-normal w-12 text-center border-r border-studio-border/50">
                      #
                    </th>
                    {dataSource.columns.map((col) => (
                      <th
                        key={col}
                        className="py-2 px-3 text-xs font-semibold text-studio-text whitespace-nowrap border-r border-studio-border/50 last:border-r-0"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {dataSource.rows.slice(0, PREVIEW_MAX_ROWS).map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={`hover:bg-zinc-900/80 transition-colors ${
                        rIdx % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/30'
                      }`}
                    >
                      <td className="py-1.5 px-3 text-[10px] text-zinc-500 text-center select-none border-r border-studio-border/30">
                        {rIdx + 1}
                      </td>
                      {dataSource.columns.map((col) => {
                        const cellValue = row[col];
                        const isNull = cellValue === null || cellValue === undefined || cellValue === '';
                        const isNum = typeof cellValue === 'number';

                        return (
                          <td
                            key={col}
                            className={`py-1.5 px-3 whitespace-nowrap border-r border-studio-border/30 last:border-r-0 text-xs ${
                              isNum ? 'text-right' : 'text-left'
                            }`}
                          >
                            {isNull ? (
                              <span className="text-zinc-600 select-none">—</span>
                            ) : (
                              <span className={isNum ? 'text-emerald-400' : 'text-zinc-300'}>
                                {String(cellValue)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Note */}
          {dataSource.rowCount > PREVIEW_MAX_ROWS && (
            <p className="text-[11px] text-zinc-500 text-center italic">
              {dataSource.rowCount - PREVIEW_MAX_ROWS} additional rows not shown in preview. All {dataSource.rowCount} rows are stored for batch operations.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

