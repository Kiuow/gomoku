import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'client'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@': path.resolve(__dirname, 'client/src'),
      '@lark-apaas/client-toolkit/logger': path.resolve(__dirname, 'client/src/lib/logger.ts'),
    },
  },
  define: {
    'process.env.CLIENT_BASE_PATH': JSON.stringify('/'),
  },
  esbuild: { jsx: 'automatic' },
  build: { outDir: '../dist/client', emptyOutDir: true },
});
