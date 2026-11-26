import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const previewBuild = {
  name: 'visual-preview-build',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/__visual-preview', async (request, response) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (!['GET', 'HEAD'].includes(request.method ?? '') || !(pathname === '/index.html' || /^\/assets\/[\w.-]+\.(js|css)$/.test(pathname))) {
        response.writeHead(404).end();
        return;
      }
      try {
        const contents = await readFile(path.join(frontendDir, 'dist', pathname.slice(1)));
        response.writeHead(200, { 'Content-Type': pathname.endsWith('.html') ? 'text/html; charset=utf-8' : pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : contents);
      } catch {
        response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Build the frontend before opening the visual preview.');
      }
    });
  }
};

export default defineConfig({
  plugins: [react(), previewBuild],
  server: { port: 5173, proxy: process.env.VITE_CRM_EXECUTION_MODE === 'API_MOCK' ? { '/api': { target: process.env.CRM_MOCK_API_URL || 'http://127.0.0.1:3001', changeOrigin: true } } : undefined },
  resolve: {
    alias: [
      {find:'@dio-crm/contracts/logic-events',replacement:path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/contracts/src/logic-events.ts')},
      {find:'@dio-crm/contracts/lead-grid-columns',replacement:path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/contracts/src/lead-grid-columns.ts')},
      {find:'@dio-crm/contracts/crm-customization',replacement:path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/contracts/src/crm-customization.ts')},
      { find: '@dio-crm/contracts/admin', replacement: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/contracts/src/admin/index.ts') },
      {find:'@dio-crm/contracts',replacement:path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/contracts/src/index.ts')}
    ]
  }
});
