import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../../frontend/public/manifest.webmanifest', import.meta.url);
const swPath = new URL('../../frontend/public/sw.js', import.meta.url);
const [manifestRaw, sw] = await Promise.all([readFile(manifestPath, 'utf8'), readFile(swPath, 'utf8')]);
const manifest = JSON.parse(manifestRaw);
const failures = [];

for (const key of ['name','short_name','start_url','scope','display','theme_color','background_color']) {
  if (!manifest[key]) failures.push(`manifest missing ${key}`);
}
if (manifest.display !== 'standalone') failures.push('manifest display must be standalone');
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) failures.push('manifest requires standard and maskable icons');
if (!manifest.icons?.some(icon => String(icon.purpose || '').includes('maskable'))) failures.push('manifest requires a maskable icon');
if (!sw.includes("url.pathname.startsWith('/api/')")) failures.push('service worker must explicitly bypass /api/ requests');
if (!sw.includes("request.method !== 'GET'")) failures.push('service worker must bypass non-GET requests');
if (!sw.includes("request.mode === 'navigate'")) failures.push('service worker must provide a navigation/offline shell strategy');

if (failures.length) {
  console.error('[pwa:check] FAILED');
  failures.forEach(x => console.error(`- ${x}`));
  process.exit(1);
}
console.log('[pwa:check] PASS — manifest, installability baseline and API cache safety checks passed.');
