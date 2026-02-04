import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ include: ['src'] }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'AgentWhiteboard',
      formats: ['es', 'umd'],
      fileName: 'agent-whiteboard',
    },
    rollupOptions: {
      external: [],
    },
  },
});
