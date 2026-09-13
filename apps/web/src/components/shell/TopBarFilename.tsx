import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  ChevronDown,
  Copy,
  Check,
  X,
  HardDrive,
  CheckCircle2,
} from 'lucide-react';
import { useDocumentStore } from '../../store/document/useDocumentStore.js';

export interface TopBarFilenameProps {
  className?: string;
  filename?: string;
  isDirty?: boolean;
  defaultOpen?: boolean;
}

export const TopBarFilename: React.FC<TopBarFilenameProps> = ({
  className = '',
  filename: propFilename,
  isDirty: propIsDirty,
  defaultOpen = false,
}) => {
  const storeFilename = useDocumentStore((s) => s.filename);
  const storeIsDirty = useDocumentStore((s) => s.isDirty);
  const storeFileHandle = useDocumentStore((s) => s.fileHandle);

  // In SSR / headless test environments where useSyncExternalStore uses getInitialState,
  // resolve from live store state so updates reflect accurately.
  const liveState = typeof window === 'undefined' ? useDocumentStore.getState() : null;
  const filename = propFilename ?? liveState?.filename ?? storeFilename;
  const isDirty = propIsDirty ?? liveState?.isDirty ?? storeIsDirty;
  const fileHandle = liveState?.fileHandle ?? storeFileHandle;

  const [isPopoverOpen, setIsPopoverOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close popover when clicking or touching outside
  useEffect(() => {
    if (!isPopoverOpen) return;

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [isPopoverOpen]);

  // Handle keyboard navigation (Escape to close)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsPopoverOpen(false);
      triggerRef.current?.focus();
    }
  }, []);

  const handleCopyFilename = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(filename);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for non-secure contexts or headless environments
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    },
    [filename],
  );

  const statusTooltip = isDirty ? `${filename} (Unsaved changes)` : `${filename} (Saved)`;

  return (
    <div
      ref={containerRef}
      className={`relative min-w-0 flex-1 max-w-fit ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Compact & Responsive Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsPopoverOpen((prev) => !prev)}
        aria-expanded={isPopoverOpen}
        aria-haspopup="dialog"
        aria-label={`Document: ${filename}${isDirty ? ' (unsaved changes)' : ' (saved)'}. Click for full details.`}
        title={statusTooltip}
        className={`group flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono transition-colors min-w-0 max-w-full text-left focus:outline-none focus:ring-1 focus:ring-blue-500 select-none ${
          isPopoverOpen
            ? 'bg-studio-bg border border-studio-border text-studio-text shadow-sm'
            : 'bg-studio-bg/50 hover:bg-studio-bg border border-transparent hover:border-studio-border text-studio-muted hover:text-studio-text'
        }`}
      >
        {/* Document Icon [📄] */}
        <FileText
          className="w-3.5 h-3.5 text-studio-muted group-hover:text-blue-400 shrink-0 transition-colors"
          aria-hidden="true"
        />

        {/* Truncated / Responsive Filename [filename] */}
        <span className="truncate min-w-0 font-medium">
          {filename}
        </span>

        {/* Status Dot */}
        {isDirty ? (
          <span
            className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"
            title="Unsaved changes"
            aria-label="Unsaved changes"
          />
        ) : (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500/70 shrink-0"
            title="All changes saved"
            aria-label="Saved"
          />
        )}

        {/* Dropdown Indicator [▼] */}
        <ChevronDown
          className={`w-3 h-3 text-studio-muted/70 group-hover:text-studio-text shrink-0 transition-transform duration-150 ${
            isPopoverOpen ? 'rotate-180 text-blue-400' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Popover Card */}
      {isPopoverOpen && (
        <div
          role="dialog"
          aria-label="Document details"
          className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-studio-panel border border-studio-border rounded-lg shadow-2xl p-3 z-50 font-sans animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-studio-border/70">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs font-semibold text-studio-text">Document Details</span>
            </div>
            <button
              type="button"
              onClick={() => setIsPopoverOpen(false)}
              className="text-studio-muted hover:text-studio-text p-1 rounded hover:bg-studio-bg transition-colors"
              aria-label="Close document details"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-2.5 text-xs">
            {/* Full Filename Box with Copy */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-studio-muted mb-1 font-medium">
                <span>Complete Filename</span>
                <button
                  type="button"
                  onClick={handleCopyFilename}
                  className="flex items-center gap-1 text-[10px] text-studio-muted hover:text-studio-text hover:underline transition-colors focus:outline-none"
                  title="Copy full filename to clipboard"
                  aria-label="Copy full filename"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div
                className="font-mono text-xs text-studio-text bg-studio-bg border border-studio-border/80 rounded p-2 break-all select-all selection:bg-blue-600/40"
                title={filename}
              >
                {filename}
              </div>
            </div>

            {/* Document Status */}
            <div className="flex items-center justify-between pt-1 border-t border-studio-border/40 text-[11px]">
              <span className="text-studio-muted">Status</span>
              {isDirty ? (
                <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Unsaved changes
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  All changes saved
                </span>
              )}
            </div>

            {/* Storage Target */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-studio-muted">Storage</span>
              <span className="flex items-center gap-1 font-mono text-studio-text">
                <HardDrive className="w-3 h-3 text-studio-muted" />
                {fileHandle ? 'Local File System' : 'Browser Session (Virtual)'}
              </span>
            </div>

            {/* Format Info */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-studio-muted">Format</span>
              <span className="font-mono text-studio-text">Universe Template (.uts)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
