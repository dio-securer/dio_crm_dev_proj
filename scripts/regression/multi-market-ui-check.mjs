#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const files = {
  route: 'frontend/src/app/route-config.ts',
  profile: 'frontend/src/app/screen-profile.ts',
  registry: 'frontend/src/app/screen-registry.tsx',
  shell: 'frontend/src/ui/AppShell.tsx',
  css: 'frontend/src/styles/global.css',
  hqManifest: 'frontend/src/market/templates/hq/hq-screen-manifest.ts',
  globalManifest: 'frontend/src/market/templates/global/global-screen-manifest.ts'
};

const content = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')])
));

const failures = [];
const pass = [];

function requireMarker(group, source, marker) {
  if (!source.includes(marker)) failures.push(`${group}: missing ${marker}`);
  else pass.push(`${group}: ${marker}`);
}

const hqScreens = [
  'HQ_LEAD','HQ_ACCOUNT','HQ_ACTIVITY','HQ_ACTIVITY_REPORT','HQ_DIRECT_WORK','HQ_OPPORTUNITY','HQ_PIPELINE',
  'HQ_CONTRACT','HQ_ORDER','HQ_FULFILLMENT','HQ_LEDGER','HQ_ACCOUNT360','HQ_ANALYTICS','HQ_OPS'
];
const globalScreens = [
  'GLOBAL_LEAD','GLOBAL_ACCOUNT','GLOBAL_ACTIVITY_MAP','GLOBAL_ACTIVITY_REPORT','GLOBAL_OPPORTUNITY','GLOBAL_CONTRACT','GLOBAL_ORDER'
];
const globalPaths = ['/', '/accounts', '/activities', '/activity-reports', '/opportunities', '/contracts', '/orders'];

for (const key of hqScreens) {
  requireMarker('HQ profile', content.profile, `'${key}'`);
  requireMarker('HQ registry', content.registry, `['${key}',`);
  requireMarker('HQ manifest', content.hqManifest, `'${key}'`);
}
for (const key of globalScreens) {
  requireMarker('GLOBAL profile', content.profile, `'${key}'`);
  requireMarker('GLOBAL registry', content.registry, `['${key}',`);
  requireMarker('GLOBAL manifest', content.globalManifest, `'${key}'`);
}

for (const path of globalPaths) requireMarker('Route contract', content.route, `path: '${path}'`);
for (const forbidden of ['GLOBAL_DIRECT_WORK','GLOBAL_PIPELINE','GLOBAL_FULFILLMENT','GLOBAL_LEDGER','GLOBAL_ACCOUNT360','GLOBAL_ANALYTICS','GLOBAL_OPS']) {
  if (content.globalManifest.includes(`'${forbidden}'`)) failures.push(`GLOBAL scope: unapproved screen exposed ${forbidden}`);
}

const responsiveMarkers = [
  '@media (max-width:1100px)',
  '@media (max-width:920px)',
  '(hover: none) and (pointer: coarse)',
  '@media (max-width:430px)',
  'min-height:44px',
  'env(safe-area-inset-bottom)',
  'env(safe-area-inset-left)',
  'env(safe-area-inset-right)',
  '.mobile-bottom-nav',
  '.mobile-drawer'
];
for (const marker of responsiveMarkers) requireMarker('Responsive CSS', content.css, marker);

const shellMarkers = [
  'links.filter(x => x.mobilePrimary).slice(0, 5)',
  'mobile-bottom-nav',
  'mobile-drawer-backdrop',
  'mobile-drawer-nav',
  'aria-expanded={mobileMenu}'
];
for (const marker of shellMarkers) requireMarker('Mobile navigation', content.shell, marker);

if (failures.length) {
  console.error('[regression:multi-market] FAILED');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`[regression:multi-market] PASS — ${pass.length} source-level architecture/responsive checks passed.`);
console.log('INFO Viewport source matrix covered: Desktop 1440+ default, Laptop <=1100, Tablet <=920/coarse pointer, Android/iOS <=430 + safe-area rules.');
console.log('INFO This gate does not claim physical-device or deployed-runtime validation; those remain DEV/UAT Pilot Gate activities.');
