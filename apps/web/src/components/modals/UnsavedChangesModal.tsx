import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useDocumentStore } from '../../store/document/useDocumentStore.js';
import { executeSaveTemplate } from '../../operations/documentOperations.js';

export const UnsavedChangesModal: React.FC = () => {
  const isOpen = useDocumentStore((s) => s.isUnsavedModalOpen);
  const filename = useDocumentStore((s) => s.filename);
  const pendingAction = useDocumentStore((s) => s.pendingAction);
  const setUnsavedModalOpen = useDocumentStore((s) => s.setUnsavedModalOpen);
  const setPendingAction = useDocumentStore((s) => s.setPendingAction);

  if (!isOpen) return null;

  const handleCancel = () => {
    setUnsavedModalOpen(false);
    setPendingAction(null);
  };

  const handleDiscard = async () => {
    setUnsavedModalOpen(false);
    if (pendingAction) {
      const action = pendingAction;
      setPendingAction(null);
      await action();
    }
  };

  const handleSaveFirst = async () => {
    const saved = await executeSaveTemplate();
    if (saved) {
      setUnsavedModalOpen(false);
      if (pendingAction) {
        const action = pendingAction;
        setPendingAction(null);
        await action();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-md bg-studio-panel border border-studio-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-studio-border flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-studio-text">Unsaved Changes</h3>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-studio-muted hover:text-studio-text p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 text-xs text-zinc-300 space-y-2 leading-relaxed">
          <p>
            You have unsaved changes in <span className="font-semibold text-white font-mono">{filename}</span>.
          </p>
          <p className="text-zinc-400">
            If you proceed without saving, your recent modifications will be permanently lost.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-studio-border flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 rounded bg-zinc-900 border border-studio-border text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            className="px-3 py-1.5 rounded bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 hover:text-red-200 transition-colors font-medium"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={handleSaveFirst}
            className="px-3.5 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 shadow-sm font-medium transition-colors"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

