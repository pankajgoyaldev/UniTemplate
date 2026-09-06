import { useEffect } from 'react';
import { useHistoryStore } from '../store/history/useHistoryStore.js';

export interface HistoryShortcutEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | { tagName?: string; isContentEditable?: boolean } | null;
  preventDefault?: () => void;
}

/**
 * Pure handler for history keyboard shortcuts.
 * Returns true if the event was handled and prevented, false otherwise.
 */
export function handleHistoryShortcut(
  e: HistoryShortcutEvent,
  actions: { undo: () => void; redo: () => void },
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

  // Redo: Ctrl+Y, Ctrl+Shift+Z, Cmd+Shift+Z
  if ((key === 'y' && !e.shiftKey) || (key === 'z' && e.shiftKey)) {
    e.preventDefault?.();
    actions.redo();
    return true;
  }

  // Undo: Ctrl+Z, Cmd+Z (without Shift)
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault?.();
    actions.undo();
    return true;
  }

  return false;
}

/**
 * Global keyboard shortcuts hook for Undo and Redo.
 *
 * Supported Shortcuts:
 * - Windows/Linux: Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo)
 * - Mac: Cmd+Z (Undo), Cmd+Shift+Z (Redo)
 *
 * Input Safety:
 * If the user is actively typing inside an <input>, <textarea>, or contenteditable
 * container, global shortcuts are bypassed to preserve the native text-field undo/redo.
 */
export function useHistoryShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleHistoryShortcut(e, {
        undo: () => useHistoryStore.getState().undo(),
        redo: () => useHistoryStore.getState().redo(),
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
