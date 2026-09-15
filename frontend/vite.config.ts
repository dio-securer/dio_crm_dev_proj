import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  resolve: {
    alias: {
      '@dio-crm/contracts': path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/contracts/src/index.ts')
    }
  }
});
