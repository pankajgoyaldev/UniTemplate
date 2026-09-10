import { create } from 'zustand';
import type { TemplateAst, UtsAsset, UtsTraceFile } from '@uts/core';
import {
  DEFAULT_DOCUMENT_NAME,
  normalizeUtsFilename,
  type DocumentSessionState,
} from './documentTypes.js';
import { AssetCache } from './assetManager.js';
import { cloneTemplateAst, isTemplateAstEqual } from '../history/historyUtils.js';
import { DEFAULT_A4_TEMPLATE } from '../defaultTemplate.js';
import { useTemplateStore } from '../useTemplateStore.js';

const globalAssetCache = new AssetCache();

export const useDocumentStore = create<DocumentSessionState>((set, get) => {
  return {
    filename: DEFAULT_DOCUMENT_NAME,
    fileHandle: null,
    isDirty: false,
    savedBaseline: cloneTemplateAst(DEFAULT_A4_TEMPLATE),
    assets: new Map<string, UtsAsset>(),
    traceBackgroundFile: null,
    isUnsavedModalOpen: false,
    pendingAction: null,
    isOperationInProgress: false,

    setFilename: (filename: string) => {
      set({ filename: normalizeUtsFilename(filename) });
    },

    setFileHandle: (fileHandle: FileSystemFileHandle | null) => {
      set({ fileHandle });
    },

    checkDirty: (currentTemplate: TemplateAst) => {
      let { savedBaseline } = get();
      if (!savedBaseline || !savedBaseline.schemaVersion) {
        savedBaseline = cloneTemplateAst(currentTemplate);
        set({ savedBaseline, isDirty: false });
        return false;
      }
      const isClean = isTemplateAstEqual(currentTemplate, savedBaseline);
      const isDirty = !isClean;
      if (get().isDirty !== isDirty) {
        set({ isDirty });
      }
      return isDirty;
    },

    markClean: (newBaseline?: TemplateAst) => {
      const templateToSave = newBaseline ?? useTemplateStore.getState().template;
      set({
        savedBaseline: cloneTemplateAst(templateToSave),
        isDirty: false,
      });
    },

    markDirty: () => {
      set({ isDirty: true });
    },

    setAssets: (assets: Map<string, UtsAsset>) => {
      globalAssetCache.revokeAll();
      set({ assets: new Map(assets) });
    },

    getAssetResolver: () => {
      return (assetRef: string) => {
        return globalAssetCache.resolve(assetRef, get().assets);
      };
    },

    setTraceBackgroundFile: (traceBackgroundFile: UtsTraceFile | null) => {
      if (!traceBackgroundFile) {
        globalAssetCache.revokeTrace();
      }
      set({ traceBackgroundFile });
    },

    getTraceBackgroundUrl: () => {
      return globalAssetCache.resolveTrace(get().traceBackgroundFile);
    },

    setUnsavedModalOpen: (isUnsavedModalOpen: boolean) => {
      set({ isUnsavedModalOpen });
    },

    setPendingAction: (pendingAction: (() => Promise<void> | void) | null) => {
      set({ pendingAction });
    },

    setIsOperationInProgress: (isOperationInProgress: boolean) => {
      set({ isOperationInProgress });
    },

    resetSession: (initialTemplate: TemplateAst, filename = DEFAULT_DOCUMENT_NAME) => {
      globalAssetCache.revokeAll();
      set({
        filename: normalizeUtsFilename(filename),
        fileHandle: null,
        isDirty: false,
        savedBaseline: cloneTemplateAst(initialTemplate),
        assets: new Map<string, UtsAsset>(),
        traceBackgroundFile: null,
        isUnsavedModalOpen: false,
        pendingAction: null,
        isOperationInProgress: false,
      });
    },
  };
});
