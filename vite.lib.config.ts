import { defineConfig } from 'vite';

// Framework-agnostic engine bundle: `npm run build:lib` -> lib/photolyze.{js,umd.cjs}
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Photolyze',
      fileName: 'photolyze',
      formats: ['es', 'umd'],
    },
    outDir: 'lib',
    emptyOutDir: true,
    sourcemap: true,
  },
});
