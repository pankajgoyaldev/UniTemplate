import { describe, it, expect, beforeEach } from 'vitest';
import type { ShapeElement, TextElement, TemplateAst } from '@uts/core';
import { useTemplateStore } from '../../../apps/web/src/store/useTemplateStore.ts';
import {
  useHistoryStore,
  MAX_HISTORY_STATES,
  cloneTemplateAst,
  isTemplateAstEqual,
} from '../../../apps/web/src/store/history/index.ts';
import { useUIStore } from '../../../apps/web/src/store/useUIStore.ts';
import { handleHistoryShortcut } from '../../../apps/web/src/hooks/useHistoryShortcuts.ts';

describe('Task 6 — Undo / Redo History System', () => {
  const testTemplate: TemplateAst = {
    schemaVersion: '1.0.0',
    metadata: {
      id: 'history_test_tpl',
      title: 'History Test Template',
      createdAt: '2026-09-06T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
    },
    pageSettings: {
      unit: 'mm',
      width: 210,
      height: 297,
      orientation: 'portrait',
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      targetDpi: 300,
    },
    dataSchema: { fields: [], mockPayload: {} },
    elements: [
      {
        id: 'rect_1',
        type: 'shape',
        name: 'Rectangle 1',
        bounds: { x: 20, y: 30, width: 60, height: 40, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 1,
        shapeType: 'rectangle',
        fillColor: '#ffffff',
        strokeColor: '#000000',
        strokeWidthMm: 1.0,
      },
      {
        id: 'text_1',
        type: 'text',
        name: 'Text 1',
        bounds: { x: 50, y: 50, width: 80, height: 20, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 2,
        content: 'Hello World',
        style: {
          fontFamily: 'Inter',
          fontSizePt: 12,
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000000',
          alignment: 'left',
          lineHeight: 1.2,
          autoWrap: true,
        },
      },
      {
        id: 'rect_2',
        type: 'shape',
        name: 'Rectangle 2',
        bounds: { x: 100, y: 120, width: 50, height: 30, rotation: 0 },
        isLocked: false,
        isVisible: true,
        zIndex: 3,
        shapeType: 'rectangle',
        fillColor: '#3b82f6',
        strokeColor: '#1d4ed8',
        strokeWidthMm: 0.5,
      },
      {
        id: 'locked_1',
        type: 'shape',
        name: 'Locked Element',
        bounds: { x: 10, y: 10, width: 30, height: 30, rotation: 0 },
        isLocked: true,
        isVisible: true,
        zIndex: 4,
        shapeType: 'rectangle',
        fillColor: '#94a3b8',
        strokeColor: '#64748b',
        strokeWidthMm: 1.0,
      },
    ],
  };

  beforeEach(() => {
    // Reset stores to fresh clean state
    useTemplateStore.getState().setTemplate(cloneTemplateAst(testTemplate));
    useHistoryStore.getState().clearHistory();
    useUIStore.getState().clearSelection();
  });

  // 1. Initial state has no undo
  it('1. initial state has no undo', () => {
    expect(useHistoryStore.getState().canUndo).toBe(false);
    expect(useHistoryStore.getState().canUndoNow()).toBe(false);
    expect(useHistoryStore.getState().past.length).toBe(0);
  });

  // 2. Initial state has no redo
  it('2. initial state has no redo', () => {
    expect(useHistoryStore.getState().canRedo).toBe(false);
    expect(useHistoryStore.getState().canRedoNow()).toBe(false);
    expect(useHistoryStore.getState().future.length).toBe(0);
  });

  // 3. One edit enables undo
  it('3. one edit enables undo', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 25, y: 30, width: 60, height: 40, rotation: 0 },
    });
    expect(useHistoryStore.getState().canUndo).toBe(true);
    expect(useHistoryStore.getState().canUndoNow()).toBe(true);
    expect(useHistoryStore.getState().past.length).toBe(1);
    expect(useHistoryStore.getState().canRedo).toBe(false);
  });

  // 4. Undo restores previous state
  it('4. undo restores previous state', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 25, y: 30, width: 60, height: 40, rotation: 0 },
    });
    useHistoryStore.getState().undo();
    const restored = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1');
    expect(restored?.bounds.x).toBe(20);
    expect(useHistoryStore.getState().canUndo).toBe(false);
  });

  // 5. Undo enables redo
  it('5. undo enables redo', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 25, y: 30, width: 60, height: 40, rotation: 0 },
    });
    useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().canRedo).toBe(true);
    expect(useHistoryStore.getState().canRedoNow()).toBe(true);
    expect(useHistoryStore.getState().future.length).toBe(1);
  });

  // 6. Redo restores edited state
  it('6. redo restores edited state', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 25, y: 30, width: 60, height: 40, rotation: 0 },
    });
    useHistoryStore.getState().undo();
    useHistoryStore.getState().redo();
    const redone = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1');
    expect(redone?.bounds.x).toBe(25);
    expect(useHistoryStore.getState().canUndo).toBe(true);
    expect(useHistoryStore.getState().canRedo).toBe(false);
  });

  // 7. New edit after undo clears redo
  it('7. new edit after undo clears redo', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 25, y: 30, width: 60, height: 40, rotation: 0 },
    });
    useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().canRedo).toBe(true);

    // Make a new distinct edit
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 99, y: 30, width: 60, height: 40, rotation: 0 },
    });
    expect(useHistoryStore.getState().canRedo).toBe(false);
    expect(useHistoryStore.getState().future.length).toBe(0);
    expect(useHistoryStore.getState().canUndo).toBe(true);
  });

  // 8. No-op does not create history
  it('8. no-op does not create history', () => {
    expect(useHistoryStore.getState().past.length).toBe(0);
    // Setting identical bounds should produce no history record
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 20, y: 30, width: 60, height: 40, rotation: 0 },
    });
    expect(useHistoryStore.getState().past.length).toBe(0);
    expect(useHistoryStore.getState().canUndo).toBe(false);
  });

  // 9. Delete can be undone
  it('9. delete can be undone', () => {
    useTemplateStore.getState().deleteElements(['rect_1']);
    expect(useTemplateStore.getState().template.elements.some((e) => e.id === 'rect_1')).toBe(false);

    useHistoryStore.getState().undo();
    const restored = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1');
    expect(restored).toBeDefined();
    expect(restored?.id).toBe('rect_1');
    expect(restored?.bounds.x).toBe(20);
    expect(restored?.bounds.y).toBe(30);
  });

  // 10. Delete can be redone
  it('10. delete can be redone', () => {
    useTemplateStore.getState().deleteElements(['rect_1']);
    useHistoryStore.getState().undo();
    expect(useTemplateStore.getState().template.elements.some((e) => e.id === 'rect_1')).toBe(true);

    useHistoryStore.getState().redo();
    expect(useTemplateStore.getState().template.elements.some((e) => e.id === 'rect_1')).toBe(false);
  });

  // 11. Multi-delete is one history step
  it('11. multi-delete is one history step', () => {
    useTemplateStore.getState().deleteElements(['rect_1', 'text_1']);
    expect(useHistoryStore.getState().past.length).toBe(1);

    useHistoryStore.getState().undo();
    expect(useTemplateStore.getState().template.elements.some((e) => e.id === 'rect_1')).toBe(true);
    expect(useTemplateStore.getState().template.elements.some((e) => e.id === 'text_1')).toBe(true);
  });

  // 12. Multi-move is one history step
  it('12. multi-move is one history step', () => {
    useTemplateStore.getState().updateMultipleElementBounds([
      { id: 'rect_1', bounds: { x: 30, y: 40, width: 60, height: 40, rotation: 0 } },
      { id: 'text_1', bounds: { x: 60, y: 60, width: 80, height: 20, rotation: 0 } },
    ]);
    expect(useHistoryStore.getState().past.length).toBe(1);

    useHistoryStore.getState().undo();
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.bounds.x).toBe(20);
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'text_1')?.bounds.x).toBe(50);
  });

  // 13. Resize is one history step
  it('13. resize is one history step', () => {
    useHistoryStore.getState().beginHistoryTransaction();
    useTemplateStore.getState().updateElementBounds('rect_1', {
      x: 20,
      y: 30,
      width: 70,
      height: 45,
      rotation: 0,
    });
    useTemplateStore.getState().updateElementBounds('rect_1', {
      x: 20,
      y: 30,
      width: 80,
      height: 50,
      rotation: 0,
    });
    useHistoryStore.getState().commitHistoryTransaction();

    expect(useHistoryStore.getState().past.length).toBe(1);
    useHistoryStore.getState().undo();
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.bounds.width).toBe(60);
  });

  // 14. Continuous drag creates one history entry
  it('14. continuous drag creates one history entry', () => {
    useHistoryStore.getState().beginHistoryTransaction();
    for (let i = 1; i <= 15; i++) {
      useTemplateStore.getState().updateElementBounds('rect_1', {
        x: 20 + i,
        y: 30 + i,
        width: 60,
        height: 40,
        rotation: 0,
      });
    }
    useHistoryStore.getState().commitHistoryTransaction();

    expect(useHistoryStore.getState().past.length).toBe(1);
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.bounds.x).toBe(35);

    useHistoryStore.getState().undo();
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.bounds.x).toBe(20);
  });

  // 15. Inspector property edit creates one history entry
  it('15. Inspector property edit creates one history entry', () => {
    useTemplateStore.getState().updateElement('rect_1', { strokeWidthMm: 2.5 });
    expect(useHistoryStore.getState().past.length).toBe(1);

    const modified = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1') as ShapeElement;
    expect(modified.strokeWidthMm).toBe(2.5);

    useHistoryStore.getState().undo();
    const undone = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1') as ShapeElement;
    expect(undone.strokeWidthMm).toBe(1.0);
  });

  // 16. Invalid numeric input creates no bad history state
  it('16. invalid numeric input creates no bad history state', () => {
    const pastBefore = useHistoryStore.getState().past.length;
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: NaN, y: Infinity, width: -10, height: 40, rotation: 0 },
    });
    // No history record should be added for no-op / rejected invalid numbers
    expect(useHistoryStore.getState().past.length).toBe(pastBefore);

    const el = useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')!;
    expect(Number.isFinite(el.bounds.x)).toBe(true);
    expect(el.bounds.x).toBe(20);
    expect(el.bounds.width).toBe(60);
  });

  // 17. Locked element cannot create a modification through protected store paths
  it('17. locked element cannot create a modification through protected store paths', () => {
    const pastBefore = useHistoryStore.getState().past.length;
    useTemplateStore.getState().updateElement('locked_1', {
      bounds: { x: 50, y: 50, width: 30, height: 30, rotation: 0 },
    });
    expect(useHistoryStore.getState().past.length).toBe(pastBefore);
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'locked_1')?.bounds.x).toBe(10);
  });

  // 18. Visibility/lock changes are undoable
  it('18. visibility/lock changes are undoable', () => {
    // Lock toggle
    useTemplateStore.getState().toggleElementLock('rect_1');
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.isLocked).toBe(true);
    useHistoryStore.getState().undo();
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.isLocked).toBe(false);

    // Visibility toggle
    useTemplateStore.getState().toggleElementVisibility('rect_1');
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.isVisible).toBe(false);
    useHistoryStore.getState().undo();
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.isVisible).toBe(true);
  });

  // 19. History limit works
  it('19. history limit works', () => {
    for (let i = 1; i <= 110; i++) {
      useTemplateStore.getState().updateElement('rect_1', {
        bounds: { x: 20 + i, y: 30, width: 60, height: 40, rotation: 0 },
      });
    }
    expect(useHistoryStore.getState().past.length).toBe(MAX_HISTORY_STATES);
    expect(useHistoryStore.getState().past.length).toBe(100);
  });

  // 20. History snapshots are immutable
  it('20. history snapshots are immutable', () => {
    useTemplateStore.getState().updateElement('text_1', { content: 'First Edit' });
    const snapshotInPast = useHistoryStore.getState().past[0];
    const pastTextContent = (snapshotInPast.elements.find((e) => e.id === 'text_1') as TextElement).content;
    expect(pastTextContent).toBe('Hello World');

    // Make second edit
    useTemplateStore.getState().updateElement('text_1', { content: 'Second Edit' });
    // Verify that snapshot from previous edit was not mutated
    expect((snapshotInPast.elements.find((e) => e.id === 'text_1') as TextElement).content).toBe('Hello World');
  });

  // 21. Ctrl+Z triggers undo
  it('21. Ctrl+Z triggers undo', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 55, y: 30, width: 60, height: 40, rotation: 0 },
    });
    const handled = handleHistoryShortcut(
      { key: 'z', ctrlKey: true, shiftKey: false },
      {
        undo: () => useHistoryStore.getState().undo(),
        redo: () => useHistoryStore.getState().redo(),
      },
    );
    expect(handled).toBe(true);
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.bounds.x).toBe(20);
  });

  // 22. Ctrl+Y triggers redo
  it('22. Ctrl+Y triggers redo', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 55, y: 30, width: 60, height: 40, rotation: 0 },
    });
    useHistoryStore.getState().undo();
    const handled = handleHistoryShortcut(
      { key: 'y', ctrlKey: true, shiftKey: false },
      {
        undo: () => useHistoryStore.getState().undo(),
        redo: () => useHistoryStore.getState().redo(),
      },
    );
    expect(handled).toBe(true);
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.bounds.x).toBe(55);
  });

  // 23. Ctrl+Shift+Z triggers redo
  it('23. Ctrl+Shift+Z triggers redo', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 55, y: 30, width: 60, height: 40, rotation: 0 },
    });
    useHistoryStore.getState().undo();
    const handled = handleHistoryShortcut(
      { key: 'z', ctrlKey: true, shiftKey: true },
      {
        undo: () => useHistoryStore.getState().undo(),
        redo: () => useHistoryStore.getState().redo(),
      },
    );
    expect(handled).toBe(true);
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.bounds.x).toBe(55);
  });

  // 24. Cmd+Z triggers undo
  it('24. Cmd+Z triggers undo', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 55, y: 30, width: 60, height: 40, rotation: 0 },
    });
    const handled = handleHistoryShortcut(
      { key: 'z', metaKey: true, shiftKey: false },
      {
        undo: () => useHistoryStore.getState().undo(),
        redo: () => useHistoryStore.getState().redo(),
      },
    );
    expect(handled).toBe(true);
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.bounds.x).toBe(20);
  });

  // 25. Typing in an input does not get broken by global editor undo
  it('25. typing in an input does not get broken by global editor undo', () => {
    useTemplateStore.getState().updateElement('rect_1', {
      bounds: { x: 77, y: 30, width: 60, height: 40, rotation: 0 },
    });
    let undoCalled = false;
    const handled = handleHistoryShortcut(
      { key: 'z', ctrlKey: true, shiftKey: false, target: { tagName: 'INPUT' } },
      {
        undo: () => {
          undoCalled = true;
          useHistoryStore.getState().undo();
        },
        redo: () => useHistoryStore.getState().redo(),
      },
    );
    expect(handled).toBe(false);
    expect(undoCalled).toBe(false);
    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.bounds.x).toBe(77);
  });

  // 26. Selection reconciliation prunes deleted element IDs on undo
  it('26. selection reconciliation prunes invalid IDs without crashing', () => {
    useUIStore.getState().selectElements(['rect_1', 'rect_2']);
    useTemplateStore.getState().deleteElements(['rect_1']);

    // Now rect_1 is deleted, undo will restore it
    useHistoryStore.getState().undo();
    expect(useTemplateStore.getState().template.elements.some((e) => e.id === 'rect_1')).toBe(true);

    // Redo deletion
    useHistoryStore.getState().redo();
    // Selection should prune rect_1 and keep only rect_2
    expect(useUIStore.getState().selectedElementIds).toEqual(['rect_2']);
  });

  // 27. Transaction cancellation restores initial state without history
  it('27. transaction cancel restores initial state and produces no history', () => {
    useHistoryStore.getState().beginHistoryTransaction();
    useTemplateStore.getState().updateElementBounds('rect_1', {
      x: 99,
      y: 99,
      width: 60,
      height: 40,
      rotation: 0,
    });
    useHistoryStore.getState().cancelHistoryTransaction();

    expect(useTemplateStore.getState().template.elements.find((e) => e.id === 'rect_1')?.bounds.x).toBe(20);
    expect(useHistoryStore.getState().past.length).toBe(0);
    expect(useHistoryStore.getState().canUndo).toBe(false);
  });
});

