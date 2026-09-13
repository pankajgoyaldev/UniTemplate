import React from 'react';
import { X, Table as TableIcon } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore.js';
import { DataSourceManager } from '../dataSource/DataSourceManager.js';

export const DataSourceModal: React.FC = () => {
  const isOpen = useUIStore((s) => s.isDataSourceModalOpen);
  const setOpen = useUIStore((s) => s.setDataSourceModalOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-4xl bg-studio-panel border border-studio-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-studio-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400">
            <TableIcon className="w-4 h-4" />
            <h3 className="font-semibold text-sm text-studio-text">Data Source (CSV / Excel)</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-studio-muted hover:text-studio-text p-1 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          <DataSourceManager />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-studio-border bg-zinc-950/40 flex items-center justify-between text-xs text-studio-muted">
          <span>Spreadsheet datasets are stored client-side for dynamic field mapping & batch generation.</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-studio-text font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

