import React, { useEffect } from 'react';
import { TopBar } from './components/shell/TopBar.js';
import { StatusBar } from './components/shell/StatusBar.js';
import { CanvasViewport } from './components/canvas/CanvasViewport.js';
import { InspectorPanel } from './components/inspector/index.js';
import { ToolboxPanel } from './components/toolbox/ToolboxPanel.js';
import { useHistoryShortcuts } from './hooks/useHistoryShortcuts.js';
import { useDocumentShortcuts } from './hooks/useDocumentShortcuts.js';
import { useSessionRecovery } from './hooks/useSessionRecovery.js';
import { UnsavedChangesModal } from './components/modals/UnsavedChangesModal.js';
import { VariablesModal } from './components/modals/VariablesModal.js';
import { DataSourceModal } from './components/modals/DataSourceModal.js';
import { useDataSourceStore } from './store/dataSource/useDataSourceStore.js';

import { PanelResizeHandle } from './components/shell/PanelResizeHandle.js';
import { useUIStore } from './store/useUIStore.js';

export const App: React.FC = () => {
  const toolboxWidth = useUIStore((s) => s.toolboxWidth);
  const setToolboxWidth = useUIStore((s) => s.setToolboxWidth);
  const topBarHeight = useUIStore((s) => s.topBarHeight);
  const setTopBarHeight = useUIStore((s) => s.setTopBarHeight);
  const inspectorWidth = useUIStore((s) => s.inspectorWidth);
  const setInspectorWidth = useUIStore((s) => s.setInspectorWidth);

  useHistoryShortcuts();
  useDocumentShortcuts();
  useSessionRecovery();

  useEffect(() => {
    void useDataSourceStore.getState().hydrateFromStorage();
  }, []);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-studio-bg text-studio-text">
      {/* 1. Header Toolbar with Horizontal Resize Handle at Bottom Edge */}
      <TopBar height={topBarHeight} />
      <PanelResizeHandle
        orientation="horizontal"
        side="top"
        currentHeight={topBarHeight}
        minHeight={48}
        maxHeight={80}
        onResize={setTopBarHeight}
      />

      {/* 2. Main Studio Workspace: Toolbox + Canvas + Right Inspector */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        <ToolboxPanel width={toolboxWidth} />
        <PanelResizeHandle
          side="left"
          currentWidth={toolboxWidth}
          minWidth={72}
          maxWidth={360}
          onResize={setToolboxWidth}
        />
        <main className="flex-1 relative overflow-hidden ml-1">
          <CanvasViewport />
        </main>
        <PanelResizeHandle
          side="right"
          currentWidth={inspectorWidth}
          minWidth={220}
          maxWidth={400}
          onResize={setInspectorWidth}
        />
        <InspectorPanel width={inspectorWidth} />
      </div>

      {/* 3. Bottom Status Bar */}
      <StatusBar />

      {/* 4. Studio Modals */}
      <UnsavedChangesModal />
      <VariablesModal />
      <DataSourceModal />
    </div>
  );
};

export default App;

