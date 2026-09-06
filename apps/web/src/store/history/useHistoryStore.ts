import { create } from 'zustand';
import type { TemplateAst } from '@uts/core';
import { MAX_HISTORY_STATES, type HistoryState } from './historyTypes.js';
import { cloneTemplateAst, isTemplateAstEqual } from './historyUtils.js';
import { useTemplateStore } from '../useTemplateStore.js';
import { useUIStore } from '../useUIStore.js';

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  transaction: null,
  canUndo: false,
  canRedo: false,

  init: (_template: TemplateAst) => {
    set({
      past: [],
      future: [],
      transaction: null,
      canUndo: false,
      canRedo: false,
    });
  },

  canUndoNow: () => get().past.length > 0,
  canRedoNow: () => get().future.length > 0,

  beginHistoryTransaction: () => {
    const { transaction } = get();
    if (transaction) {
      // Transaction already in progress; nested calls reuse outermost transaction
      return;
    }
    const currentTemplate = useTemplateStore.getState().template;
    set({
      transaction: {
        initialSnapshot: cloneTemplateAst(currentTemplate),
      },
    });
  },

  commitHistoryTransaction: () => {
    const { transaction, past } = get();
    if (!transaction) return false;

    const currentTemplate = useTemplateStore.getState().template;
    const isUnchanged = isTemplateAstEqual(transaction.initialSnapshot, currentTemplate);

    if (isUnchanged) {
      set({ transaction: null });
      return false;
    }

    const newPast = [...past, transaction.initialSnapshot];
    if (newPast.length > MAX_HISTORY_STATES) {
      newPast.splice(0, newPast.length - MAX_HISTORY_STATES);
    }

    set({
      past: newPast,
      future: [],
      transaction: null,
      canUndo: newPast.length > 0,
      canRedo: false,
    });
    return true;
  },

  cancelHistoryTransaction: () => {
    const { transaction } = get();
    if (!transaction) return;

    // Revert template in useTemplateStore
    useTemplateStore.getState().setTemplate(cloneTemplateAst(transaction.initialSnapshot), true);
    set({ transaction: null });
  },

  recordChange: (previousSnapshot: TemplateAst, nextSnapshot: TemplateAst) => {
    const { transaction, past } = get();
    // If inside an active transaction, skip intermediate snapshot pushes
    if (transaction) {
      return;
    }

    if (isTemplateAstEqual(previousSnapshot, nextSnapshot)) {
      // No-op protection: no document changes occurred
      return;
    }

    const newPast = [...past, cloneTemplateAst(previousSnapshot)];
    if (newPast.length > MAX_HISTORY_STATES) {
      newPast.splice(0, newPast.length - MAX_HISTORY_STATES);
    }

    set({
      past: newPast,
      future: [],
      canUndo: newPast.length > 0,
      canRedo: false,
    });
  },

  pushState: (previousSnapshot: TemplateAst, nextSnapshot?: TemplateAst) => {
    const next = nextSnapshot ?? useTemplateStore.getState().template;
    get().recordChange(previousSnapshot, next);
  },

  undo: () => {
    const { past, future, transaction } = get();
    if (transaction) {
      get().cancelHistoryTransaction();
      return null;
    }

    if (past.length === 0) return null;

    const currentTemplate = useTemplateStore.getState().template;
    const previousSnapshot = past[past.length - 1];
    const newPast = past.slice(0, -1);

    const newFuture = [cloneTemplateAst(currentTemplate), ...future];
    if (newFuture.length > MAX_HISTORY_STATES) {
      newFuture.splice(MAX_HISTORY_STATES);
    }

    // Restore template in useTemplateStore without recording new history
    useTemplateStore.getState().setTemplate(cloneTemplateAst(previousSnapshot), true);

    // Prune invalid selected element IDs if elements were removed in the restored state
    const currentSelectedIds = useUIStore.getState().selectedElementIds;
    const validIds = currentSelectedIds.filter((id) =>
      previousSnapshot.elements.some((el) => el.id === id),
    );
    if (validIds.length !== currentSelectedIds.length) {
      useUIStore.getState().selectElements(validIds);
    }

    set({
      past: newPast,
      future: newFuture,
      canUndo: newPast.length > 0,
      canRedo: newFuture.length > 0,
    });

    return previousSnapshot;
  },

  redo: () => {
    const { past, future, transaction } = get();
    if (transaction) {
      return null;
    }

    if (future.length === 0) return null;

    const currentTemplate = useTemplateStore.getState().template;
    const nextSnapshot = future[0];
    const newFuture = future.slice(1);

    const newPast = [...past, cloneTemplateAst(currentTemplate)];
    if (newPast.length > MAX_HISTORY_STATES) {
      newPast.splice(0, newPast.length - MAX_HISTORY_STATES);
    }

    // Restore template in useTemplateStore without recording new history
    useTemplateStore.getState().setTemplate(cloneTemplateAst(nextSnapshot), true);

    // Prune invalid selected element IDs if elements were removed in the restored state
    const currentSelectedIds = useUIStore.getState().selectedElementIds;
    const validIds = currentSelectedIds.filter((id) =>
      nextSnapshot.elements.some((el) => el.id === id),
    );
    if (validIds.length !== currentSelectedIds.length) {
      useUIStore.getState().selectElements(validIds);
    }

    set({
      past: newPast,
      future: newFuture,
      canUndo: newPast.length > 0,
      canRedo: newFuture.length > 0,
    });

    return nextSnapshot;
  },

  clearHistory: () => {
    set({
      past: [],
      future: [],
      transaction: null,
      canUndo: false,
      canRedo: false,
    });
  },
}));
