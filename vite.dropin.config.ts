import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'AgentWhiteboard',
      formats: ['iife'],
      fileName: () => 'agent-whiteboard.min.js',
    },
    outDir: 'dist/dropin',
    emptyOutDir: true,
    minify: 'terser',
    rollupOptions: {
      external: [],
    },
  },
});
