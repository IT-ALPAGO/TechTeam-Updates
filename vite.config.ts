import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * In development Vite serves the UI on :5173 and forwards every /api call
 * to the Express proxy on :8787, which is the only place that ever sees
 * your Jira credentials.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
