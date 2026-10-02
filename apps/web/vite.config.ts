import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@uts/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@uts/canvas-engine': path.resolve(__dirname, '../../packages/canvas-engine/src/index.ts'),
      '@uts/adapters': path.resolve(__dirname, '../../packages/adapters/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});

