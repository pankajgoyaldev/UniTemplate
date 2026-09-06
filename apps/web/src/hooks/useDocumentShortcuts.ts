import { useEffect } from 'react';
import {
  executeNewTemplate,
  executeOpenTemplate,
  executeSaveTemplate,
  executeSaveTemplateAs,
} from '../operations/documentOperations.js';

export interface DocumentShortcutEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | { tagName?: string; isContentEditable?: boolean } | null;
  preventDefault?: () => void;
}

export function handleDocumentShortcut(
  e: DocumentShortcutEvent,
  actions: {
    onNew: () => void;
    onOpen: () => void;
    onSave: () => void;
    onSaveAs: () => void;
  },
): boolean {
  const target = e.target as { tagName?: string; isContentEditable?: boolean } | null;
  if (
    target?.tagName === 'INPUT' ||
    target?.tagName === 'TEXTAREA' ||
    target?.isContentEditable
  ) {
    return false;
  }

  const hasModifier = Boolean(e.ctrlKey || e.metaKey);
  if (!hasModifier) return false;

  const key = e.key.toLowerCase();

  // Save As: Ctrl+Shift+S or Cmd+Shift+S
  if (key === 's' && e.shiftKey) {
    e.preventDefault?.();
    actions.onSaveAs();
    return true;
  }

  // Save: Ctrl+S or Cmd+S
  if (key === 's' && !e.shiftKey) {
    e.preventDefault?.();
    actions.onSave();
    return true;
  }

  // Open: Ctrl+O or Cmd+O
  if (key === 'o' && !e.shiftKey) {
    e.preventDefault?.();
    actions.onOpen();
    return true;
  }

  // New: Ctrl+N or Cmd+N (Note: some browsers intercept Ctrl+N for new window, but preventDefault catches it when supported)
  if (key === 'n' && !e.shiftKey) {
    e.preventDefault?.();
    actions.onNew();
    return true;
  }

  return false;
}

export function useDocumentShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleDocumentShortcut(e, {
        onNew: () => executeNewTemplate(),
        onOpen: () => void executeOpenTemplate(),
        onSave: () => void executeSaveTemplate(),
        onSaveAs: () => void executeSaveTemplateAs(),
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

