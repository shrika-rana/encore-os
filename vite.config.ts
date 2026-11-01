/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → GitHub Pages build (served from /encore-os/)
// `npm run build:single` → one self-contained HTML file (dist-single/index.html)
export default defineConfig(({ mode }) => ({
  base: mode === 'single' ? './' : '/encore-os/',
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
