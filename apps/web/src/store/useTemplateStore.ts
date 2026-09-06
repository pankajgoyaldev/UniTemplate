import { create } from 'zustand';
import type { TemplateAst, PageSettings, TemplateElement } from '@uts/core';
import { calculateMultiElementMove, type Point, type ElementBounds } from '@uts/canvas-engine';
import { useHistoryStore } from './history/useHistoryStore.js';
import { useDocumentStore } from './document/useDocumentStore.js';

interface TemplateState {
  template: TemplateAst;
  // Actions
  setTemplate: (template: TemplateAst, skipHistory?: boolean) => void;
  updatePageSettings: (settings: Partial<PageSettings>) => void;
  addElement: (element: TemplateElement) => void;
  updateElement: (id: string, patch: Partial<TemplateElement>) => void;
  updateElements: (ids: string[], patch: Partial<TemplateElement>) => void;
  updateElementBounds: (id: string, bounds: ElementBounds) => void;
  updateMultipleElementBounds: (updates: { id: string; bounds: ElementBounds }[]) => void;
  deleteElements: (ids: string[]) => void;
  nudgeElements: (ids: string[], deltaMm: Point, pageWidthMm: number, pageHeightMm: number) => void;
  toggleElementLock: (id: string) => void;
  toggleElementVisibility: (id: string) => void;
}

import { DEFAULT_A4_TEMPLATE } from './defaultTemplate.js';

function sanitizeBounds(
  patchBounds: Partial<ElementBounds> | undefined,
  fallback: ElementBounds,
): ElementBounds {
  if (!patchBounds) return fallback;

  const x =
    patchBounds.x !== undefined && Number.isFinite(patchBounds.x)
      ? patchBounds.x
      : fallback.x;
  const y =
    patchBounds.y !== undefined && Number.isFinite(patchBounds.y)
      ? patchBounds.y
      : fallback.y;

  const rawWidth =
    patchBounds.width !== undefined &&
    Number.isFinite(patchBounds.width) &&
    patchBounds.width >= 0
      ? patchBounds.width
      : fallback.width;

  const rawHeight =
    patchBounds.height !== undefined &&
    Number.isFinite(patchBounds.height) &&
    patchBounds.height >= 0
      ? patchBounds.height
      : fallback.height;

  // Invariant: at least one dimension must be positive (width > 0 || height > 0), reject 0x0
  const isZeroByZero = rawWidth === 0 && rawHeight === 0;
  let width = isZeroByZero ? fallback.width : rawWidth;
  let height = isZeroByZero ? fallback.height : rawHeight;
  if (width === 0 && height === 0) {
    width = 1;
  }

  const rotation =
    patchBounds.rotation !== undefined && Number.isFinite(patchBounds.rotation)
      ? ((patchBounds.rotation % 360) + 360) % 360
      : fallback.rotation;

  return { x, y, width, height, rotation };
}

function patchElement(el: TemplateElement, patch: Partial<TemplateElement>): TemplateElement {
  const updatedBounds = sanitizeBounds(patch.bounds, el.bounds);

  switch (el.type) {
    case 'text': {
      const textPatch = patch as Partial<typeof el>;
      const existingStyle = el.style;
      const patchStyle = textPatch.style;

      let updatedStyle = existingStyle;
      if (patchStyle) {
        updatedStyle = {
          ...existingStyle,
          ...patchStyle,
          fontSizePt:
            patchStyle.fontSizePt !== undefined &&
            Number.isFinite(patchStyle.fontSizePt) &&
            patchStyle.fontSizePt > 0
              ? patchStyle.fontSizePt
              : existingStyle.fontSizePt,
          lineHeight:
            patchStyle.lineHeight !== undefined &&
            Number.isFinite(patchStyle.lineHeight) &&
            patchStyle.lineHeight > 0
              ? patchStyle.lineHeight
              : existingStyle.lineHeight,
          letterSpacingPt:
            patchStyle.letterSpacingPt !== undefined &&
            Number.isFinite(patchStyle.letterSpacingPt)
              ? patchStyle.letterSpacingPt
              : existingStyle.letterSpacingPt,
        };
      }

      return {
        ...el,
        ...patch,
        bounds: updatedBounds,
        style: updatedStyle,
        type: 'text',
      };
    }
    case 'shape': {
      const shapePatch = patch as Partial<typeof el>;
      const strokeWidthMm =
        shapePatch.strokeWidthMm !== undefined &&
        Number.isFinite(shapePatch.strokeWidthMm) &&
        shapePatch.strokeWidthMm >= 0
          ? shapePatch.strokeWidthMm
          : el.strokeWidthMm;

      const cornerRadiusMm =
        shapePatch.cornerRadiusMm !== undefined
          ? Number.isFinite(shapePatch.cornerRadiusMm) && shapePatch.cornerRadiusMm >= 0
            ? shapePatch.cornerRadiusMm
            : el.cornerRadiusMm
          : el.cornerRadiusMm;

      return {
        ...el,
        ...patch,
        bounds: updatedBounds,
        strokeWidthMm,
        cornerRadiusMm,
        type: 'shape',
      };
    }
    case 'image': {
      const imgPatch = patch as Partial<typeof el>;
      const opacity =
        imgPatch.opacity !== undefined && Number.isFinite(imgPatch.opacity)
          ? Math.max(0, Math.min(1, imgPatch.opacity))
          : el.opacity;

      return {
        ...el,
        ...patch,
        bounds: updatedBounds,
        opacity,
        type: 'image',
      };
    }
    case 'barcode': {
      return {
        ...el,
        ...patch,
        bounds: updatedBounds,
        type: 'barcode',
      };
    }
    default:
      return el;
  }
}

function commitTemplateChange(
  set: (fn: (state: TemplateState) => Partial<TemplateState>) => void,
  calculateNewTemplate: (currentTemplate: TemplateAst) => TemplateAst,
) {
  set((state) => {
    const prevTemplate = state.template;
    const newTemplate = calculateNewTemplate(prevTemplate);
    if (prevTemplate === newTemplate) {
      return state;
    }
    useHistoryStore.getState().recordChange(prevTemplate, newTemplate);
    useDocumentStore.getState().checkDirty(newTemplate);
    return { template: newTemplate };
  });
}

export const useTemplateStore = create<TemplateState>((set) => ({
  template: DEFAULT_A4_TEMPLATE,

  setTemplate: (template, skipHistory = false) => {
    if (!skipHistory) {
      useHistoryStore.getState().clearHistory();
    }
    useDocumentStore.getState().checkDirty(template);
    set({ template });
  },

  updatePageSettings: (settings) =>
    commitTemplateChange(set, (prev) => ({
      ...prev,
      pageSettings: {
        ...prev.pageSettings,
        ...settings,
      },
    })),

  addElement: (element) =>
    commitTemplateChange(set, (prev) => ({
      ...prev,
      elements: [...prev.elements, element],
    })),

  updateElement: (id, patch) =>
    commitTemplateChange(set, (prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        if (el.id !== id) return el;

        // 1. Locked element protection: only unlocking is allowed
        if (el.isLocked) {
          if (patch.isLocked === false) {
            return { ...el, isLocked: false };
          }
          return el;
        }

        // 2. Invisible element protection: cannot modify properties while hidden,
        // only making it visible again (or locking it) is allowed
        if (!el.isVisible) {
          if (patch.isVisible === true) {
            return { ...el, isVisible: true };
          }
          if (patch.isLocked === true) {
            return { ...el, isLocked: true };
          }
          return el;
        }

        return patchElement(el, patch);
      }),
    })),

  updateElements: (ids, patch) =>
    commitTemplateChange(set, (prev) => {
      const idSet = new Set(ids);
      return {
        ...prev,
        elements: prev.elements.map((el) => {
          if (!idSet.has(el.id) || el.isLocked) return el;
          if (!el.isVisible && patch.isVisible !== true) return el;
          return patchElement(el, patch);
        }),
      };
    }),

  updateElementBounds: (id, bounds) =>
    commitTemplateChange(set, (prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id && !el.isLocked && el.isVisible
          ? { ...el, bounds: sanitizeBounds(bounds, el.bounds) }
          : el,
      ),
    })),

  updateMultipleElementBounds: (updates) =>
    commitTemplateChange(set, (prev) => {
      const updateMap = new Map(updates.map((u) => [u.id, u.bounds]));
      return {
        ...prev,
        elements: prev.elements.map((el) => {
          const newBounds = updateMap.get(el.id);
          return newBounds && !el.isLocked && el.isVisible
            ? { ...el, bounds: sanitizeBounds(newBounds, el.bounds) }
            : el;
        }),
      };
    }),

  toggleElementLock: (id) =>
    commitTemplateChange(set, (prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...el, isLocked: !el.isLocked } : el,
      ),
    })),

  toggleElementVisibility: (id) =>
    commitTemplateChange(set, (prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id && !el.isLocked ? { ...el, isVisible: !el.isVisible } : el,
      ),
    })),

  deleteElements: (ids) =>
    commitTemplateChange(set, (prev) => {
      // Only delete unlocked elements
      const targetIds = new Set(
        prev.elements.filter((el) => ids.includes(el.id) && !el.isLocked).map((el) => el.id),
      );
      if (targetIds.size === 0) {
        return prev;
      }
      return {
        ...prev,
        elements: prev.elements.filter((el) => !targetIds.has(el.id)),
      };
    }),

  nudgeElements: (ids, deltaMm, pageWidthMm, pageHeightMm) =>
    commitTemplateChange(set, (prev) => {
      const targetElements = prev.elements.filter(
        (el) => ids.includes(el.id) && !el.isLocked,
      );
      if (targetElements.length === 0) return prev;

      const moved = calculateMultiElementMove(
        targetElements.map((el) => ({ id: el.id, initialBounds: el.bounds })),
        deltaMm,
        pageWidthMm,
        pageHeightMm,
      );

      const moveMap = new Map(moved.map((m) => [m.id, m.bounds]));
      return {
        ...prev,
        elements: prev.elements.map((el) => {
          const newBounds = moveMap.get(el.id);
          return newBounds ? { ...el, bounds: newBounds } : el;
        }),
      };
    }),
}));

