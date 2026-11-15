import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: '/baumgedaechtnis-app/',
  plugins: [react(), {
    name: 'production-content-security-policy',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'none'",
      }, injectTo: 'head-prepend' }];
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  server: { host: '127.0.0.1', watch: { usePolling: true } },
  build: { outDir: 'dist', emptyOutDir: true },
});
