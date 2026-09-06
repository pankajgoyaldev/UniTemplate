import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  screenToCanvas,
  hitTestElements,
  calculatePositionSnappedDelta,
  calculateResizedBounds,
  calculateMultiElementMove,
  getElementWorldAnchor,
  type Point,
  type ElementBounds,
  type ResizeHandleType,
} from '@uts/canvas-engine';
import { useUIStore } from '../../store/useUIStore.js';
import { useTemplateStore } from '../../store/useTemplateStore.js';
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
  const activeHandle = useUIStore((s) => s.activeHandle);
  const isDraggingElement = useUIStore((s) => s.isDraggingElement);
  const isResizingElement = useUIStore((s) => s.isResizingElement);

  const panBy = useUIStore((s) => s.panBy);
  const zoomAtPoint = useUIStore((s) => s.zoomAtPoint);
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
  const updateElementBounds = useTemplateStore((s) => s.updateElementBounds);
  const updateMultipleElementBounds = useTemplateStore((s) => s.updateMultipleElementBounds);
  const deleteElements = useTemplateStore((s) => s.deleteElements);
  const nudgeElements = useTemplateStore((s) => s.nudgeElements);

  // Local drag/manipulation references
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [cursorScreenPx, setCursorScreenPx] = useState<Point | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const hasInitializedFit = useRef(false);

  // Drag-to-move state
  const dragOriginPointerMm = useRef<Point>({ x: 0, y: 0 });
  const initialBoundsMap = useRef<Map<string, ElementBounds>>(new Map());

  // Resize state
  const resizeStartPointerMm = useRef<Point>({ x: 0, y: 0 });
  const resizeInitialBounds = useRef<ElementBounds | null>(null);
  const resizingElementId = useRef<string | null>(null);

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

  // Keyboard shortcuts (Delete, Backspace, Arrow keys nudge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
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
        const step = e.shiftKey ? 10 : 1;
        const delta: Point = {
          x: e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0,
          y: e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0,
        };
        nudgeElements(selectedElementIds, delta, pageSettings.width, pageSettings.height);
        return;
      }

      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, deleteElements, clearSelection, nudgeElements, pageSettings.width, pageSettings.height]);

  // Wheel zoom handler
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - RULER_THICKNESS;
      const mouseY = e.clientY - rect.top - RULER_THICKNESS;

      // Sensitivity factor
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const targetZoom = zoom * zoomFactor;

      zoomAtPoint(targetZoom, { x: mouseX, y: mouseY });
    },
    [zoom, zoomAtPoint],
  );

  // Resize handle mouse down
  const handleResizeHandleMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandleType, elementId: string) => {
      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const screenX = e.clientX - rect.left - RULER_THICKNESS;
      const screenY = e.clientY - rect.top - RULER_THICKNESS;

      const pointerMm = screenToCanvas({ x: screenX, y: screenY }, { zoom, panX, panY });
      const targetEl = elements.find((item) => item.id === elementId);
      if (!targetEl || targetEl.isLocked) return;

      setActiveHandle(handle);
      setIsResizingElement(true);
      resizeStartPointerMm.current = pointerMm;
      resizeInitialBounds.current = { ...targetEl.bounds };
      resizingElementId.current = elementId;
    },
    [zoom, panX, panY, elements, setActiveHandle, setIsResizingElement],
  );

  // Canvas Mouse Down: Pan or Select / Drag-to-move
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const isMiddleClick = e.button === 1;
      const isLeftClickWithSpaceOrHand = e.button === 0 && (isSpacePressed || activeTool === 'hand');

      // Viewport Pan handling
      if (isMiddleClick || isLeftClickWithSpaceOrHand) {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Selection & Drag-to-move tool handling
      if (e.button === 0 && activeTool === 'select') {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const screenX = e.clientX - rect.left - RULER_THICKNESS;
        const screenY = e.clientY - rect.top - RULER_THICKNESS;

        const pointMm = screenToCanvas({ x: screenX, y: screenY }, { zoom, panX, panY });
        const hit = hitTestElements(pointMm, elements, 1.0);

        if (hit) {
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
          initialBoundsMap.current = new Map(targets.map((el) => [el.id, { ...el.bounds }]));
          dragOriginPointerMm.current = pointMm;
          setIsDraggingElement(true);
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

  // Mouse Move: Pan, Element Drag, Element Resize, and Coordinate Tracking
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const screenX = e.clientX - rect.left - RULER_THICKNESS;
      const screenY = e.clientY - rect.top - RULER_THICKNESS;

      setCursorScreenPx({ x: screenX, y: screenY });

      // Live update physical millimeter coordinates in store
      const currentPointerMm = screenToCanvas({ x: screenX, y: screenY }, { zoom, panX, panY });
      setCursorPosMm(currentPointerMm);

      // 1. Viewport Panning
      if (isDragging && dragStart) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        panBy({ x: deltaX, y: deltaY });
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // 2. Element Resizing
      if (isResizingElement && resizingElementId.current && resizeInitialBounds.current && activeHandle) {
        const rawDeltaMm: Point = {
          x: currentPointerMm.x - resizeStartPointerMm.current.x,
          y: currentPointerMm.y - resizeStartPointerMm.current.y,
        };

        const referenceHandleMm = getElementWorldAnchor(resizeInitialBounds.current, activeHandle);
        const deltaMm = gridVisible
          ? calculatePositionSnappedDelta(referenceHandleMm, rawDeltaMm, gridSizeMm)
          : rawDeltaMm;

        const newBounds = calculateResizedBounds({
          initialBounds: resizeInitialBounds.current,
          handle: activeHandle,
          deltaMm,
          keepAspectRatio: e.shiftKey,
          pageWidthMm: pageSettings.width,
          pageHeightMm: pageSettings.height,
        });

        updateElementBounds(resizingElementId.current, newBounds);
        return;
      }

      // 3. Element Drag-to-Move
      if (isDraggingElement && initialBoundsMap.current.size > 0) {
        const rawDeltaMm: Point = {
          x: currentPointerMm.x - dragOriginPointerMm.current.x,
          y: currentPointerMm.y - dragOriginPointerMm.current.y,
        };

        const elementsToMove = Array.from(initialBoundsMap.current.entries()).map(([id, initialBounds]) => ({
          id,
          initialBounds,
        }));

        // Reference anchor for position snapping: consistent group reference (first element's origin)
        const referencePointMm = elementsToMove[0].initialBounds;
        const deltaMm = gridVisible
          ? calculatePositionSnappedDelta(referencePointMm, rawDeltaMm, gridSizeMm)
          : rawDeltaMm;

        const moved = calculateMultiElementMove(
          elementsToMove,
          deltaMm,
          pageSettings.width,
          pageSettings.height,
        );

        updateMultipleElementBounds(moved);
      }
    },
    [
      isDragging,
      dragStart,
      isResizingElement,
      activeHandle,
      isDraggingElement,
      zoom,
      panX,
      panY,
      gridVisible,
      gridSizeMm,
      pageSettings.width,
      pageSettings.height,
      panBy,
      setCursorPosMm,
      updateElementBounds,
      updateMultipleElementBounds,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);

    if (isDraggingElement) {
      setIsDraggingElement(false);
      initialBoundsMap.current.clear();
    }

    if (isResizingElement) {
      setIsResizingElement(false);
      setActiveHandle(null);
      resizeInitialBounds.current = null;
      resizingElementId.current = null;
    }
  }, [setIsDragging, isDraggingElement, setIsDraggingElement, isResizingElement, setIsResizingElement, setActiveHandle]);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setCursorScreenPx(null);
    setCursorPosMm(null);

    if (isDraggingElement) {
      setIsDraggingElement(false);
      initialBoundsMap.current.clear();
    }

    if (isResizingElement) {
      setIsResizingElement(false);
      setActiveHandle(null);
      resizeInitialBounds.current = null;
      resizingElementId.current = null;
    }
  }, [setIsDragging, setCursorPosMm, isDraggingElement, setIsDraggingElement, isResizingElement, setIsResizingElement, setActiveHandle]);

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
      className={`relative w-full h-full overflow-hidden bg-studio-canvas ${cursorClass}`}
      onWheel={handleWheel}
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
          selectedElementIds={selectedElementIds}
          onHandleMouseDown={handleResizeHandleMouseDown}
        />
      </div>
    </div>
  );
};


