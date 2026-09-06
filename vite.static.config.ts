import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Static, client-only build for GitHub Pages (https://gosubay.github.io/liarsdice).
// vinext targets Cloudflare Workers and emits no index.html, so Pages needs its own
// build. Run with: npm run build:pages
export default defineConfig({
  root: 'static',
  base: '/liarsdice/',
  publicDir: '../public',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  build: {
    outDir: '../dist-pages',
    emptyOutDir: true,
  },
});
