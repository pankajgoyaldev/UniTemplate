import React from 'react';
import { TopBar } from './components/shell/TopBar.js';
import { StatusBar } from './components/shell/StatusBar.js';
import { CanvasViewport } from './components/canvas/CanvasViewport.js';

export const App: React.FC = () => {
  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-studio-bg text-studio-text">
      {/* 1. Header Toolbar */}
      <TopBar />

      {/* 2. Main Studio Canvas Viewport */}
      <main className="flex-1 relative overflow-hidden">
        <CanvasViewport />
      </main>

      {/* 3. Bottom Status Bar */}
      <StatusBar />
    </div>
  );
};

export default App;

