import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const localeDir = path.join(root, 'frontend/src/i18n/locales');
const locales = ['ko-KR','en-US'];

function flatten(value, prefix='', out=[]) {
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, next, out);
    else out.push(next);
  }
  return out;
}

const keySets = new Map();
for (const locale of locales) {
  const file = path.join(localeDir, locale, 'common.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  keySets.set(locale, new Set(flatten(parsed)));
}
const baseline = keySets.get(locales[0]);
let failed = false;
for (const locale of locales.slice(1)) {
  const keys = keySets.get(locale);
  const missing = [...baseline].filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !baseline.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`[i18n] ${locale} missing=${missing.join(',') || '-'} extra=${extra.join(',') || '-'}`);
  }
}
if (failed) process.exit(1);
console.log(`[i18n] translation key parity PASS (${baseline.size} keys, ${locales.join(', ')})`);
