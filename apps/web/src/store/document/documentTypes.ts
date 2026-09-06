import type { TemplateAst, UtsAsset } from '@uts/core';

export const DEFAULT_DOCUMENT_NAME = 'Untitled.uts';

/**
 * Normalizes a filename to always end with '.uts' without creating '.uts.uts'.
 */
export function normalizeUtsFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return DEFAULT_DOCUMENT_NAME;

  // Remove any trailing .uts extensions repeatedly to avoid foo.uts.uts
  let base = trimmed;
  while (base.toLowerCase().endsWith('.uts')) {
    base = base.slice(0, -4);
  }
  // Sanitize illegal filesystem characters: \ / : * ? " < > |
  base = base.replace(/[/\\?%*:|"<>]/g, '_').trim();

  return `${base || 'Untitled'}.uts`;
}

export interface DocumentSessionState {
  filename: string;
  fileHandle: FileSystemFileHandle | null;
  isDirty: boolean;
  savedBaseline: TemplateAst;
  assets: Map<string, UtsAsset>;
  isUnsavedModalOpen: boolean;
  pendingAction: (() => Promise<void> | void) | null;
  isOperationInProgress: boolean;

  // Actions
  setFilename: (filename: string) => void;
  setFileHandle: (handle: FileSystemFileHandle | null) => void;
  checkDirty: (currentTemplate: TemplateAst) => boolean;
  markClean: (newBaseline?: TemplateAst) => void;
  markDirty: () => void;
  setAssets: (assets: Map<string, UtsAsset>) => void;
  getAssetResolver: () => (assetRef: string) => string | undefined;
  setUnsavedModalOpen: (open: boolean) => void;
  setPendingAction: (action: (() => Promise<void> | void) | null) => void;
  setIsOperationInProgress: (inProgress: boolean) => void;
  resetSession: (initialTemplate: TemplateAst, filename?: string) => void;
}
