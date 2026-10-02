import React, { useMemo } from 'react';
import { Table as TableIcon, Upload, ExternalLink, Trash2, Download, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { InspectorSection } from './InspectorSection.js';
import { useDataSourceStore } from '../../store/dataSource/useDataSourceStore.js';
import { useTemplateStore } from '../../store/useTemplateStore.js';
import { useUIStore } from '../../store/useUIStore.js';
import { removeDataSource, downloadExcelTemplate, getMappingStatus } from '../../operations/dataSource/index.js';

export const DataSourceSection: React.FC = () => {
  const dataSource = useDataSourceStore((s) => s.dataSource);
  const setDataSourceModalOpen = useUIStore((s) => s.setDataSourceModalOpen);
  const fields = useTemplateStore((s) => s.template.dataSchema?.fields || []);
  const templateTitle = useTemplateStore((s) => s.template.metadata?.title);
  const columnMapping = useTemplateStore((s) => s.template.dataSchema?.columnMapping || {});

  const mappingStatuses = useMemo(() => {
    if (!dataSource) return [];
    return fields.map((f) => getMappingStatus(f.name, columnMapping[f.name], dataSource.columns));
  }, [fields, columnMapping, dataSource]);

  const mappedCount = mappingStatuses.filter((s) => s.status === 'mapped').length;
  const invalidCount = mappingStatuses.filter((s) => s.status === 'invalid').length;

  const badgeText = dataSource ? `${dataSource.rowCount} rows` : undefined;

  const handleRemove = () => {
    if (!dataSource) return;
    if (confirm(`Remove data source "${dataSource.fileName}"?`)) {
      removeDataSource();
    }
  };

  return (
    <InspectorSection
      title="Data Source"
      badge={badgeText}
      defaultOpen={true}
    >
      <div className="py-1 space-y-2 text-xs">
        {!dataSource ? (
          <div className="p-3 rounded-lg border border-dashed border-studio-border/80 text-center bg-zinc-900/30">
            <div className="flex justify-center mb-1.5 text-studio-muted">
              <TableIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-[11px] text-zinc-400 mb-2.5">
              No spreadsheet imported for batch generation.
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setDataSourceModalOpen(true)}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-studio-border text-xs text-emerald-400 hover:text-emerald-300 transition-colors shadow-sm"
              >
                <Upload className="w-3 h-3" />
                <span>Import CSV / Excel</span>
              </button>
              {fields.length > 0 && (
                <button
                  type="button"
                  onClick={() => downloadExcelTemplate(fields, templateTitle)}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded bg-zinc-900/60 hover:bg-zinc-800 border border-studio-border/60 text-[11px] text-zinc-300 hover:text-white transition-colors"
                  title="Download Excel template (.xlsx) with variable headers"
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  <span>Download Excel Template</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-zinc-900/70 border border-studio-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <TableIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-semibold text-studio-text truncate text-xs" title={dataSource.fileName}>
                  {dataSource.fileName}
                </span>
              </div>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                {dataSource.fileType}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 bg-zinc-950/60 px-2 py-1 rounded border border-studio-border/40 font-mono">
              <span>{dataSource.columns.length} columns</span>
              <span>{dataSource.rowCount} rows</span>
            </div>

            {/* Column Mapping Summary */}
            <div className="flex items-center justify-between text-[11px] bg-zinc-950/40 px-2 py-1.5 rounded border border-studio-border/30">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <ArrowRightLeft className="w-3 h-3 text-blue-400" />
                <span>Mapping:</span>
                <span className="font-mono text-zinc-200">
                  {mappedCount}/{fields.length}
                </span>
                {invalidCount > 0 && (
                  <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {invalidCount} missing
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDataSourceModalOpen(true)}
                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors underline"
              >
                Configure
              </button>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <button
                type="button"
                onClick={() => setDataSourceModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>View Data Table</span>
              </button>
              <div className="flex items-center gap-1">
                {fields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => downloadExcelTemplate(fields, templateTitle)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    title="Download Excel Template (.xlsx)"
                    aria-label="Download Excel Template"
                  >
                    <Download className="w-3 h-3 text-emerald-400" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors"
                  title="Remove Data Source"
                  aria-label="Remove Data Source"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </InspectorSection>
  );
};

