import type { TemplateAst } from '@uts/core';

export const MAX_HISTORY_STATES = 100;

export interface HistoryTransaction {
  initialSnapshot: TemplateAst;
}

export interface HistoryState {
  past: TemplateAst[];
  future: TemplateAst[];
  transaction: HistoryTransaction | null;
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  init: (template: TemplateAst) => void;
  canUndoNow: () => boolean;
  canRedoNow: () => boolean;
  recordChange: (previousSnapshot: TemplateAst, nextSnapshot: TemplateAst) => void;
  pushState: (previousSnapshot: TemplateAst, nextSnapshot?: TemplateAst) => void;
  beginHistoryTransaction: () => void;
  commitHistoryTransaction: () => boolean;
  cancelHistoryTransaction: () => void;
  undo: () => TemplateAst | null;
  redo: () => TemplateAst | null;
  clearHistory: () => void;
}
