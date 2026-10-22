import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: process.env.VITE_CRM_EXECUTION_MODE === 'API_MOCK' ? { '/api': { target: process.env.CRM_MOCK_API_URL || 'http://127.0.0.1:3001', changeOrigin: true } } : undefined },
  resolve: {
    alias: [
      { find: '@dio-crm/contracts/admin', replacement: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/contracts/src/admin/index.ts') },
      { find: '@dio-crm/contracts', replacement: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/contracts/src/index.ts') }
    ]
  }
});
