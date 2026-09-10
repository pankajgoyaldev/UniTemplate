import React from 'react';
import { TopBar } from './components/shell/TopBar.js';
import { StatusBar } from './components/shell/StatusBar.js';
import { CanvasViewport } from './components/canvas/CanvasViewport.js';
import { InspectorPanel } from './components/inspector/index.js';
import { ToolboxPanel } from './components/toolbox/ToolboxPanel.js';
import { useHistoryShortcuts } from './hooks/useHistoryShortcuts.js';
import { useDocumentShortcuts } from './hooks/useDocumentShortcuts.js';
import { useSessionRecovery } from './hooks/useSessionRecovery.js';
import { UnsavedChangesModal } from './components/modals/UnsavedChangesModal.js';

export const App: React.FC = () => {
  useHistoryShortcuts();
  useDocumentShortcuts();
  useSessionRecovery();

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-studio-bg text-studio-text">
      {/* 1. Header Toolbar */}
      <TopBar />

      {/* 2. Main Studio Workspace: Toolbox + Canvas + Right Inspector */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        <ToolboxPanel />
        <main className="flex-1 relative overflow-hidden">
          <CanvasViewport />
        </main>
        <InspectorPanel />
      </div>

      {/* 3. Bottom Status Bar */}
      <StatusBar />

      {/* 4. Studio Modals */}
      <UnsavedChangesModal />
    </div>
  );
};

export default App;

