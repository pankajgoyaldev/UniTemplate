import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  screenToCanvas,
  hitTestElements,
  calculatePositionSnappedDelta,
  calculateResizedBounds,
  calculateMultiElementMove,
  getElementWorldAnchor,
  normalizeWheelDelta,
  calculateWheelZoomFactor,
  type Point,
  type ElementBounds,
  type ResizeHandleType,
} from '@uts/canvas-engine';
import { useUIStore } from '../../store/useUIStore.js';
import { useTemplateStore } from '../../store/useTemplateStore.js';
import { useHistoryStore } from '../../store/history/useHistoryStore.js';
import { useDocumentStore } from '../../store/document/useDocumentStore.js';
import { HorizontalRuler, VerticalRuler, RulerCorner, RULER_THICKNESS } from './MetricRuler.js';
import { PageCanvas } from './PageCanvas.js';

export const CanvasViewport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // UI Store
  const zoom = useUIStore((s) => s.zoom);
  const panX = useUIStore((s) => s.panX);
  const panY = useUIStore((s) => s.panY);
  const activeTool = useUIStore((s) => s.activeTool);
  const isSpacePressed = useUIStore((s) => s.isSpacePressed);
  const isDragging = useUIStore((s) => s.isDragging);
  const gridVisible = useUIStore((s) => s.gridVisible);
  const gridSizeMm = useUIStore((s) => s.gridSizeMm);
  const selectedElementIds = useUIStore((s) => s.selectedElementIds);
  const isDraggingElement = useUIStore((s) => s.isDraggingElement);

  const setViewportSize = useUIStore((s) => s.setViewportSize);
  const setIsSpacePressed = useUIStore((s) => s.setIsSpacePressed);
  const setIsDragging = useUIStore((s) => s.setIsDragging);
  const setCursorPosMm = useUIStore((s) => s.setCursorPosMm);
  const fitToScreen = useUIStore((s) => s.fitToScreen);
  const selectElement = useUIStore((s) => s.selectElement);
  const clearSelection = useUIStore((s) => s.clearSelection);
  const setActiveHandle = useUIStore((s) => s.setActiveHandle);
  const setIsDraggingElement = useUIStore((s) => s.setIsDraggingElement);
  const setIsResizingElement = useUIStore((s) => s.setIsResizingElement);

  // Template Store
  const pageSettings = useTemplateStore((s) => s.template.pageSettings);
  const elements = useTemplateStore((s) => s.template.elements);
  const traceBackground = useTemplateStore((s) => s.template.traceBackground);
  const deleteElements = useTemplateStore((s) => s.deleteElements);
  const nudgeElements = useTemplateStore((s) => s.nudgeElements);

  // Document Store (Asset management & resolver)
  const assets = useDocumentStore((s) => s.assets);
  const traceBackgroundFile = useDocumentStore((s) => s.traceBackgroundFile);
  const getAssetResolver = useDocumentStore((s) => s.getAssetResolver);
  const getTraceBackgroundUrl = useDocumentStore((s) => s.getTraceBackgroundUrl);
  const assetResolver = useMemo(() => getAssetResolver(), [getAssetResolver, assets]);
  const traceBackgroundUrl = useMemo(
    () => getTraceBackgroundUrl(),
    [getTraceBackgroundUrl, traceBackgroundFile],
  );

  // Viewport panning state: tracked in refs with RAF batching for synchronous, 1:1, non-accelerating movement
  const panLastPointerRef = useRef<Point | null>(null);
  const isPanningRef = useRef(false);
  const pendingPanDeltaRef = useRef<Point>({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);
  const [cursorScreenPx, setCursorScreenPx] = useState<Point | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const hasInitializedFit = useRef(false);

  // Cached container origin in screen pixels (left + RULER_THICKNESS, top + RULER_THICKNESS)
  // Measured once at mousedown to prevent layout thrashing and subpixel fluctuation during interactions
  const containerOriginRef = useRef<Point | null>(null);

  // Drag-to-move state
  const isDraggingElementRef = useRef(false);
  const dragOriginPointerMm = useRef<Point>({ x: 0, y: 0 });
  const initialBoundsMap = useRef<Map<string, ElementBounds>>(new Map());
  const latestDragEventRef = useRef<{ clientX: number; clientY: number; altKey: boolean; ctrlKey: boolean } | null>(null);
  const dragRafIdRef = useRef<number | null>(null);

  // Resize state
  const isResizingElementRef = useRef(false);
  const activeHandleRef = useRef<ResizeHandleType | null>(null);
  const resizeStartPointerMm = useRef<Point>({ x: 0, y: 0 });
  const resizeInitialBounds = useRef<ElementBounds | null>(null);
  const resizingElementId = useRef<string | null>(null);
  const latestResizeEventRef = useRef<{ clientX: number; clientY: number; altKey: boolean; ctrlKey: boolean; shiftKey: boolean } | null>(null);
  const resizeRafIdRef = useRef<number | null>(null);

  // Nudge transaction state
  const isNudgingRef = useRef(false);

  // Wheel zoom accumulation and RAF batching
  const pendingWheelDeltaRef = useRef<number>(0);
  const latestWheelAnchorRef = useRef<Point | null>(null);
  const wheelRafIdRef = useRef<number | null>(null);

  // Resize observer to track viewport dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width - RULER_THICKNESS;
        const height = entry.contentRect.height - RULER_THICKNESS;
        setContainerSize({ width, height });
        setViewportSize(width, height);

        // Auto-center template on initial load
        if (!hasInitializedFit.current && width > 200 && height > 200) {
          hasInitializedFit.current = true;
          fitToScreen(pageSettings.width, pageSettings.height);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [setViewportSize, fitToScreen, pageSettings.width, pageSettings.height]);

  // Spacebar hotkey detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && (e.target as HTMLElement)?.tagName !== 'INPUT' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setIsSpacePressed]);

  // Keyboard shortcuts (Delete, Backspace, Arrow keys nudge, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        if (isDraggingElementRef.current || isResizingElementRef.current) {
          if (dragRafIdRef.current !== null) {
            cancelAnimationFrame(dragRafIdRef.current);
            dragRafIdRef.current = null;
          }
          if (resizeRafIdRef.current !== null) {
            cancelAnimationFrame(resizeRafIdRef.current);
            resizeRafIdRef.current = null;
          }
          latestDragEventRef.current = null;
          latestResizeEventRef.current = null;
          isDraggingElementRef.current = false;
          isResizingElementRef.current = false;
          containerOriginRef.current = null;
          activeHandleRef.current = null;
          initialBoundsMap.current.clear();
          resizeInitialBounds.current = null;
          resizingElementId.current = null;
          setIsDraggingElement(false);
          setIsResizingElement(false);
          setActiveHandle(null);
          useHistoryStore.getState().cancelHistoryTransaction();
          return;
        }
        clearSelection();
        return;
      }

      if (selectedElementIds.length === 0) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteElements(selectedElementIds);
        clearSelection();
        return;
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        if (!isNudgingRef.current) {
          isNudgingRef.current = true;
          useHistoryStore.getState().beginHistoryTransaction();
        }
        const step = e.shiftKey ? 10 : 1;
        const delta: Point = {
          x: e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0,
          y: e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0,
        };
        nudgeElements(selectedElementIds, delta, pageSettings.width, pageSettings.height);
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (isNudgingRef.current) {
          isNudgingRef.current = false;
          useHistoryStore.getState().commitHistoryTransaction();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    selectedElementIds,
    deleteElements,
    clearSelection,
    nudgeElements,
    pageSettings.width,
    pageSettings.height,
    setIsDraggingElement,
    setIsResizingElement,
    setActiveHandle,
  ]);


  // Non-passive wheel listener for smooth, non-jumping cursor-centered zoom with RAF batching
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      // Must prevent default to stop native browser-level pinch-zoom and page scrolling
      e.preventDefault();

      // If user is actively dragging or resizing elements, ignore wheel zoom to prevent disorientation
      if (isDraggingElementRef.current || isResizingElementRef.current) {
        return;
      }

      const delta = normalizeWheelDelta(e.deltaY, e.deltaMode);
      if (delta === 0) return;

      const rect = container.getBoundingClientRect();
      const rawX = e.clientX - rect.left - RULER_THICKNESS;
      const rawY = e.clientY - rect.top - RULER_THICKNESS;

      const { viewportWidth, viewportHeight } = useUIStore.getState();
      const currentWidth = viewportWidth > 0 ? viewportWidth : 800;
      const currentHeight = viewportHeight > 0 ? viewportHeight : 600;

      // If cursor is over rulers or corner, anchor zoom to center of visible workspace
      const isOverCanvas = rawX >= 0 && rawY >= 0 && rawX <= currentWidth && rawY <= currentHeight;
      const anchor: Point = isOverCanvas
        ? { x: rawX, y: rawY }
        : { x: currentWidth / 2, y: currentHeight / 2 };

      pendingWheelDeltaRef.current += delta;
      latestWheelAnchorRef.current = anchor;

      if (wheelRafIdRef.current === null) {
        wheelRafIdRef.current = requestAnimationFrame(() => {
          wheelRafIdRef.current = null;
          const accumulatedDelta = pendingWheelDeltaRef.current;
          pendingWheelDeltaRef.current = 0;
          const targetAnchor = latestWheelAnchorRef.current;
          latestWheelAnchorRef.current = null;

          if (accumulatedDelta === 0 || !targetAnchor) return;

          const zoomFactor = calculateWheelZoomFactor(accumulatedDelta);
          const current = useUIStore.getState();
          const targetZoom = current.zoom * zoomFactor;

          current.zoomAtPoint(targetZoom, targetAnchor);
        });
      }
    };

    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelNative);
      if (wheelRafIdRef.current !== null) {
        cancelAnimationFrame(wheelRafIdRef.current);
        wheelRafIdRef.current = null;
      }
    };
  }, []);

  // Drag & Resize execution helpers with latest-coordinates-win invariant
  const applyDragMove = useCallback((clientX: number, clientY: number, altKey: boolean, ctrlKey: boolean) => {
    if (!containerOriginRef.current || initialBoundsMap.current.size === 0) return;

    const { zoom: currentZoom, panX: currentPanX, panY: currentPanY, snapToGrid: currentSnap, gridSizeMm: currentGridSize } = useUIStore.getState();
    const { pageSettings: currentPageSettings } = useTemplateStore.getState().template;

    const screenX = clientX - containerOriginRef.current.x;
    const screenY = clientY - containerOriginRef.current.y;

    setCursorScreenPx({ x: screenX, y: screenY });

    const currentPointerMm = screenToCanvas({ x: screenX, y: screenY }, { zoom: currentZoom, panX: currentPanX, panY: currentPanY });
    useUIStore.getState().setCursorPosMm(currentPointerMm);

    const rawDeltaMm: Point = {
      x: currentPointerMm.x - dragOriginPointerMm.current.x,
      y: currentPointerMm.y - dragOriginPointerMm.current.y,
    };

    const elementsToMove = Array.from(initialBoundsMap.current.entries()).map(([id, initialBounds]) => ({
      id,
      initialBounds,
    }));

    const referencePointMm = elementsToMove[0].initialBounds;
    const isSnapBypassed = altKey || ctrlKey;
    const shouldSnap = currentSnap && !isSnapBypassed;
    const deltaMm = shouldSnap
      ? calculatePositionSnappedDelta(referencePointMm, rawDeltaMm, currentGridSize)
      : rawDeltaMm;

    const moved = calculateMultiElementMove(
      elementsToMove,
      deltaMm,
      currentPageSettings.width,
      currentPageSettings.height,
    );

    useTemplateStore.getState().updateMultipleElementBounds(moved);
  }, []);

  const applyResizeMove = useCallback((clientX: number, clientY: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean) => {
    if (!containerOriginRef.current || !resizeInitialBounds.current || !resizingElementId.current || !activeHandleRef.current) return;

    const { zoom: currentZoom, panX: currentPanX, panY: currentPanY, snapToGrid: currentSnap, gridSizeMm: currentGridSize } = useUIStore.getState();
    const { pageSettings: currentPageSettings } = useTemplateStore.getState().template;

    const screenX = clientX - containerOriginRef.current.x;
    const screenY = clientY - containerOriginRef.current.y;

    setCursorScreenPx({ x: screenX, y: screenY });

    const currentPointerMm = screenToCanvas({ x: screenX, y: screenY }, { zoom: currentZoom, panX: currentPanX, panY: currentPanY });
    useUIStore.getState().setCursorPosMm(currentPointerMm);

    const rawDeltaMm: Point = {
      x: currentPointerMm.x - resizeStartPointerMm.current.x,
      y: currentPointerMm.y - resizeStartPointerMm.current.y,
    };

    const referenceHandleMm = getElementWorldAnchor(resizeInitialBounds.current, activeHandleRef.current);
    const isSnapBypassed = altKey || ctrlKey;
    const shouldSnap = currentSnap && !isSnapBypassed;
    const deltaMm = shouldSnap
      ? calculatePositionSnappedDelta(referenceHandleMm, rawDeltaMm, currentGridSize)
      : rawDeltaMm;

    const newBounds = calculateResizedBounds({
      initialBounds: resizeInitialBounds.current,
      handle: activeHandleRef.current,
      deltaMm,
      keepAspectRatio: shiftKey,
      pageWidthMm: currentPageSettings.width,
      pageHeightMm: currentPageSettings.height,
    });

    useTemplateStore.getState().updateElementBounds(resizingElementId.current, newBounds);
  }, []);

  const stopDraggingElement = useCallback(() => {
    if (!isDraggingElementRef.current) return;

    if (dragRafIdRef.current !== null) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }

    if (latestDragEventRef.current) {
      const { clientX, clientY, altKey, ctrlKey } = latestDragEventRef.current;
      latestDragEventRef.current = null;
      applyDragMove(clientX, clientY, altKey, ctrlKey);
    }

    isDraggingElementRef.current = false;
    containerOriginRef.current = null;
    initialBoundsMap.current.clear();
    setIsDraggingElement(false);
    useHistoryStore.getState().commitHistoryTransaction();
  }, [applyDragMove, setIsDraggingElement]);

  const stopResizingElement = useCallback(() => {
    if (!isResizingElementRef.current) return;

    if (resizeRafIdRef.current !== null) {
      cancelAnimationFrame(resizeRafIdRef.current);
      resizeRafIdRef.current = null;
    }

    if (latestResizeEventRef.current) {
      const { clientX, clientY, altKey, ctrlKey, shiftKey } = latestResizeEventRef.current;
      latestResizeEventRef.current = null;
      applyResizeMove(clientX, clientY, altKey, ctrlKey, shiftKey);
    }

    isResizingElementRef.current = false;
    containerOriginRef.current = null;
    activeHandleRef.current = null;
    resizeInitialBounds.current = null;
    resizingElementId.current = null;
    setIsResizingElement(false);
    setActiveHandle(null);
    useHistoryStore.getState().commitHistoryTransaction();
  }, [applyResizeMove, setIsResizingElement, setActiveHandle]);

  // Resize handle mouse down
  const handleResizeHandleMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandleType, elementId: string) => {
      // If Hand tool or Space is active, do not start resize; let event bubble for canvas panning
      if (activeTool === 'hand' || isSpacePressed) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      containerOriginRef.current = {
        x: rect.left + RULER_THICKNESS,
        y: rect.top + RULER_THICKNESS,
      };

      const screenX = e.clientX - containerOriginRef.current.x;
      const screenY = e.clientY - containerOriginRef.current.y;

      const pointerMm = screenToCanvas({ x: screenX, y: screenY }, { zoom, panX, panY });
      const targetEl = elements.find((item) => item.id === elementId);
      if (!targetEl || targetEl.isLocked) return;

      activeHandleRef.current = handle;
      isResizingElementRef.current = true;
      setActiveHandle(handle);
      setIsResizingElement(true);
      resizeStartPointerMm.current = pointerMm;
      resizeInitialBounds.current = { ...targetEl.bounds };
      resizingElementId.current = elementId;
      useHistoryStore.getState().beginHistoryTransaction();
    },
    [activeTool, isSpacePressed, zoom, panX, panY, elements, setActiveHandle, setIsResizingElement],
  );

  // Canvas Mouse Down: Pan or Select / Drag-to-move
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const isMiddleClick = e.button === 1;
      const isLeftClickWithSpaceOrHand = e.button === 0 && (isSpacePressed || activeTool === 'hand');

      // Viewport Pan handling (Middle-click, Space+Left click, or Hand tool Left click)
      if (isMiddleClick || isLeftClickWithSpaceOrHand) {
        e.preventDefault();
        isPanningRef.current = true;
        panLastPointerRef.current = { x: e.clientX, y: e.clientY };
        pendingPanDeltaRef.current = { x: 0, y: 0 };
        setIsDragging(true);
        return;
      }

      // Selection & Drag-to-move tool handling
      if (e.button === 0 && activeTool === 'select') {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        containerOriginRef.current = {
          x: rect.left + RULER_THICKNESS,
          y: rect.top + RULER_THICKNESS,
        };

        const screenX = e.clientX - containerOriginRef.current.x;
        const screenY = e.clientY - containerOriginRef.current.y;

        const pointMm = screenToCanvas({ x: screenX, y: screenY }, { zoom, panX, panY });
        const hit = hitTestElements(pointMm, elements, 1.0);

        if (hit) {
          e.preventDefault();
          const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey;

          if (isMultiKey) {
            selectElement(hit.id, true);
          } else {
            // If already part of a multi-selection, keep group selected for moving
            if (!selectedElementIds.includes(hit.id)) {
              selectElement(hit.id, false);
            }
          }

          // Prepare drag-to-move
          const activeIds = isMultiKey
            ? (selectedElementIds.includes(hit.id) ? selectedElementIds : [...selectedElementIds, hit.id])
            : (selectedElementIds.includes(hit.id) ? selectedElementIds : [hit.id]);

          const targets = elements.filter((el) => activeIds.includes(el.id) && !el.isLocked);
          if (targets.length > 0) {
            initialBoundsMap.current = new Map(targets.map((el) => [el.id, { ...el.bounds }]));
            dragOriginPointerMm.current = pointMm;
            isDraggingElementRef.current = true;
            setIsDraggingElement(true);
            useHistoryStore.getState().beginHistoryTransaction();
          }
        } else {
          // Empty canvas click clears selection
          clearSelection();
        }
      }
    },
    [
      isSpacePressed,
      activeTool,
      zoom,
      panX,
      panY,
      elements,
      selectedElementIds,
      setIsDragging,
      selectElement,
      clearSelection,
      setIsDraggingElement,
    ],
  );

  // Mouse Move: Coordinate Tracking when hovering
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // If actively panning, dragging, or resizing, the global window listener handles them via RAF
      if (isPanningRef.current || isDraggingElementRef.current || isResizingElementRef.current) {
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const screenX = e.clientX - rect.left - RULER_THICKNESS;
      const screenY = e.clientY - rect.top - RULER_THICKNESS;

      setCursorScreenPx({ x: screenX, y: screenY });

      // Live update physical millimeter coordinates in store
      const currentPointerMm = screenToCanvas({ x: screenX, y: screenY }, { zoom, panX, panY });
      setCursorPosMm(currentPointerMm);
    },
    [zoom, panX, panY, setCursorPosMm],
  );

  const stopPanning = useCallback(() => {
    if (!isPanningRef.current) return;

    isPanningRef.current = false;
    panLastPointerRef.current = null;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Flush any remaining accumulated delta immediately
    const dx = pendingPanDeltaRef.current.x;
    const dy = pendingPanDeltaRef.current.y;
    pendingPanDeltaRef.current = { x: 0, y: 0 };
    if (dx !== 0 || dy !== 0) {
      useUIStore.getState().panBy({ x: dx, y: dy });
    }

    setIsDragging(false);
  }, [setIsDragging]);

  const handleMouseUp = useCallback(() => {
    stopPanning();
    stopResizingElement();
    stopDraggingElement();
  }, [stopPanning, stopResizingElement, stopDraggingElement]);

  const handleMouseLeave = useCallback(() => {
    // If an operation is underway, continue tracking via window listeners without aborting
    if (isPanningRef.current || isDraggingElementRef.current || isResizingElementRef.current) {
      return;
    }
    setCursorScreenPx(null);
    setCursorPosMm(null);
  }, [setCursorPosMm]);

  // Window-level mousemove/mouseup/blur listeners ensure smooth, non-jumping 1:1 panning, dragging, and resizing across any boundaries with RAF batching
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // 1. Viewport Panning
      if (isPanningRef.current) {
        if (e.buttons === 0) {
          stopPanning();
          return;
        }
        if (!panLastPointerRef.current) return;

        const deltaX = e.clientX - panLastPointerRef.current.x;
        const deltaY = e.clientY - panLastPointerRef.current.y;
        panLastPointerRef.current = { x: e.clientX, y: e.clientY };

        pendingPanDeltaRef.current.x += deltaX;
        pendingPanDeltaRef.current.y += deltaY;

        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            const dx = pendingPanDeltaRef.current.x;
            const dy = pendingPanDeltaRef.current.y;
            pendingPanDeltaRef.current = { x: 0, y: 0 };
            if (dx !== 0 || dy !== 0) {
              useUIStore.getState().panBy({ x: dx, y: dy });
            }
          });
        }
        return;
      }

      // 2. Element Resizing
      if (isResizingElementRef.current) {
        if (e.buttons === 0) {
          stopResizingElement();
          return;
        }

        latestResizeEventRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
        };

        if (resizeRafIdRef.current === null) {
          resizeRafIdRef.current = requestAnimationFrame(() => {
            resizeRafIdRef.current = null;
            if (latestResizeEventRef.current) {
              const { clientX, clientY, altKey, ctrlKey, shiftKey } = latestResizeEventRef.current;
              latestResizeEventRef.current = null;
              applyResizeMove(clientX, clientY, altKey, ctrlKey, shiftKey);
            }
          });
        }
        return;
      }

      // 3. Element Drag-to-Move
      if (isDraggingElementRef.current) {
        if (e.buttons === 0) {
          stopDraggingElement();
          return;
        }

        latestDragEventRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
        };

        if (dragRafIdRef.current === null) {
          dragRafIdRef.current = requestAnimationFrame(() => {
            dragRafIdRef.current = null;
            if (latestDragEventRef.current) {
              const { clientX, clientY, altKey, ctrlKey } = latestDragEventRef.current;
              latestDragEventRef.current = null;
              applyDragMove(clientX, clientY, altKey, ctrlKey);
            }
          });
        }
        return;
      }
    };

    const handleGlobalMouseUp = () => {
      if (isPanningRef.current) {
        stopPanning();
      }
      if (isResizingElementRef.current) {
        stopResizingElement();
      }
      if (isDraggingElementRef.current) {
        stopDraggingElement();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('blur', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('blur', handleGlobalMouseUp);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (resizeRafIdRef.current !== null) {
        cancelAnimationFrame(resizeRafIdRef.current);
        resizeRafIdRef.current = null;
      }
      if (dragRafIdRef.current !== null) {
        cancelAnimationFrame(dragRafIdRef.current);
        dragRafIdRef.current = null;
      }
    };
  }, [stopPanning, stopResizingElement, stopDraggingElement, applyResizeMove, applyDragMove]);

  // Determine cursor styling
  let cursorClass = 'cursor-default';
  if (isDragging) {
    cursorClass = 'cursor-grabbing';
  } else if (isSpacePressed || activeTool === 'hand') {
    cursorClass = 'cursor-grab';
  } else if (isDraggingElement) {
    cursorClass = 'cursor-move';
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-studio-canvas select-none ${cursorClass}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* 1. Corner Square */}
      <RulerCorner />

      {/* 2. Horizontal Ruler (Top) */}
      <div
        className="absolute top-0 z-10 overflow-hidden"
        style={{ left: RULER_THICKNESS, right: 0, height: RULER_THICKNESS }}
      >
        <HorizontalRuler
          panX={panX}
          zoom={zoom}
          width={containerSize.width}
          cursorPosScreen={cursorScreenPx}
        />
      </div>

      {/* 3. Vertical Ruler (Left) */}
      <div
        className="absolute left-0 z-10 overflow-hidden"
        style={{ top: RULER_THICKNESS, bottom: 0, width: RULER_THICKNESS }}
      >
        <VerticalRuler
          panY={panY}
          zoom={zoom}
          height={containerSize.height}
          cursorPosScreen={cursorScreenPx}
        />
      </div>

      {/* 4. Infinite Workspace Surface & Page Viewport */}
      <div
        className="absolute overflow-hidden"
        style={{
          top: RULER_THICKNESS,
          left: RULER_THICKNESS,
          width: containerSize.width,
          height: containerSize.height,
        }}
      >
        {/* Workspace Canvas Background Pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(#52525b 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />

        {/* Scaled & Translated Physical Page */}
        <PageCanvas
          pageSettings={pageSettings}
          elements={elements}
          zoom={zoom}
          panX={panX}
          panY={panY}
          gridVisible={gridVisible}
          gridSizeMm={gridSizeMm}
          assetResolver={assetResolver}
          selectedElementIds={selectedElementIds}
          traceBackground={traceBackground}
          traceBackgroundUrl={traceBackgroundUrl}
          onHandleMouseDown={handleResizeHandleMouseDown}
        />
      </div>
    </div>
  );
};


