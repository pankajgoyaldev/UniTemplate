import { create } from 'zustand';
import type { TemplateAst, PageSettings } from '@uts/core';

interface TemplateState {
  template: TemplateAst;
  // Actions
  setTemplate: (template: TemplateAst) => void;
  updatePageSettings: (settings: Partial<PageSettings>) => void;
}

const DEFAULT_BLANK_A4_TEMPLATE: TemplateAst = {
  schemaVersion: '1.0.0',
  metadata: {
    id: 'tpl_default_a4',
    title: 'Untitled A4 Template',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  pageSettings: {
    unit: 'mm',
    width: 210,
    height: 297,
    orientation: 'portrait',
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    targetDpi: 300,
  },
  dataSchema: {
    fields: [],
    mockPayload: {},
  },
  elements: [],
};

export const useTemplateStore = create<TemplateState>((set) => ({
  template: DEFAULT_BLANK_A4_TEMPLATE,

  setTemplate: (template) => set({ template }),

  updatePageSettings: (settings) =>
    set((state) => ({
      template: {
        ...state.template,
        pageSettings: {
          ...state.template.pageSettings,
          ...settings,
        },
      },
    })),
}));
