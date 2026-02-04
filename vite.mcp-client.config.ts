import { defineConfig } from 'vite';

export default defineConfig({
  root: 'mcp-client',
  build: {
    outDir: '../mcp-server-go/mcp-client-dist',
    emptyOutDir: true,
  },
});
