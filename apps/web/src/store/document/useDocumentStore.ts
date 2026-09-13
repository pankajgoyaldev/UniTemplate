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
    traceBackgroundFiles: new Map<string, UtsTraceFile>(),
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
        set({ traceBackgroundFile: null });
        return;
      }
      const files = new Map(get().traceBackgroundFiles);
      files.set(traceBackgroundFile.filename, traceBackgroundFile);
      files.set(`background/${traceBackgroundFile.filename}`, traceBackgroundFile);
      set({ traceBackgroundFile, traceBackgroundFiles: files });
    },

    syncTraceBackground: (template: TemplateAst) => {
      const trace = template?.traceBackground;
      if (!trace || !trace.fileRef) {
        if (get().traceBackgroundFile !== null) {
          globalAssetCache.revokeTrace();
          set({ traceBackgroundFile: null });
        }
        return;
      }
      const bareName = trace.fileRef.replace(/^background\//, '');
      const files = get().traceBackgroundFiles;
      const matched = files.get(bareName) || files.get(trace.fileRef);
      if (matched) {
        if (matched !== get().traceBackgroundFile) {
          set({ traceBackgroundFile: matched });
        }
      } else if (get().traceBackgroundFile) {
        if (get().traceBackgroundFile?.filename === bareName) {
          const updatedFiles = new Map(files);
          updatedFiles.set(bareName, get().traceBackgroundFile!);
          updatedFiles.set(trace.fileRef, get().traceBackgroundFile!);
          set({ traceBackgroundFiles: updatedFiles });
        }
      }
    },

    getActiveTraceFile: () => {
      const template = useTemplateStore.getState().template;
      if (!template?.traceBackground) return null;
      const bareName = template.traceBackground.fileRef?.replace(/^background\//, '');
      const files = get().traceBackgroundFiles;
      const current = get().traceBackgroundFile;
      if (current && (!bareName || current.filename === bareName)) {
        return current;
      }
      return (bareName ? (files.get(bareName) || files.get(template.traceBackground.fileRef)) : undefined) ?? current ?? null;
    },

    getTraceBackgroundUrl: () => {
      const activeFile = get().getActiveTraceFile() ?? get().traceBackgroundFile;
      return globalAssetCache.resolveTrace(activeFile);
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
      const files = new Map<string, UtsTraceFile>();
      set({
        filename: normalizeUtsFilename(filename),
        fileHandle: null,
        isDirty: false,
        savedBaseline: cloneTemplateAst(initialTemplate),
        assets: new Map<string, UtsAsset>(),
        traceBackgroundFile: null,
        traceBackgroundFiles: files,
        isUnsavedModalOpen: false,
        pendingAction: null,
        isOperationInProgress: false,
      });
    },
  };
});
