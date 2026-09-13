#!/usr/bin/env node

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => {
  if (!value.startsWith('--')) return [value, true];
  const key = value.slice(2);
  const next = all[index + 1];
  return [key, next && !next.startsWith('--') ? next : true];
}));

const baseUrl = String(args.baseUrl || process.env.CRM_WEB_BASE_URL || '').replace(/\/$/, '');
const apiBaseUrl = String(args.apiBaseUrl || process.env.CRM_API_BASE_URL || baseUrl).replace(/\/$/, '');
const strict = args.strict === true || String(args.strict).toLowerCase() === 'true';

function result(name, ok, detail, required = true) {
  const state = ok ? 'PASS' : required ? 'FAIL' : 'WARN';
  console.log(`${state.padEnd(4)} ${name} - ${detail}`);
  return ok || !required;
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.CRM_SMOKE_TIMEOUT_MS || 10000));
  try {
    return await fetch(url, { redirect: 'follow', signal: controller.signal, ...options });
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log('DIO CRM Mobile/PWA Pilot Readiness');
  console.log(`Web: ${baseUrl || '(not supplied)'}`);
  console.log(`API: ${apiBaseUrl || '(not supplied)'}`);

  if (!baseUrl) {
    result('HTTPS endpoint', false, 'CRM_WEB_BASE_URL or --baseUrl is required for runtime pilot validation', strict);
    if (strict) process.exit(2);
    console.log('INFO Runtime checks skipped. Use --strict with a deployed DEV/UAT HTTPS URL for Pilot Gate.');
    return;
  }

  const checks = [];
  checks.push(result('HTTPS endpoint', baseUrl.startsWith('https://'), baseUrl, true));

  try {
    const home = await request(`${baseUrl}/`);
    checks.push(result('App shell', home.ok, `HTTP ${home.status}`, true));
  } catch (error) {
    checks.push(result('App shell', false, String(error), true));
  }

  try {
    const manifest = await request(`${baseUrl}/manifest.webmanifest`);
    const body = manifest.ok ? await manifest.json() : null;
    checks.push(result('Manifest', manifest.ok && Boolean(body?.name) && Boolean(body?.start_url), `HTTP ${manifest.status}`, true));
  } catch (error) {
    checks.push(result('Manifest', false, String(error), true));
  }

  try {
    const sw = await request(`${baseUrl}/sw.js`, { cache: 'no-store' });
    const text = sw.ok ? await sw.text() : '';
    const apiBypass = text.includes('/api/') || text.includes("startsWith('/api')") || text.includes('startsWith("/api")');
    checks.push(result('Service Worker', sw.ok, `HTTP ${sw.status}`, true));
    checks.push(result('API cache bypass marker', apiBypass, apiBypass ? 'found' : 'not found', true));
  } catch (error) {
    checks.push(result('Service Worker', false, String(error), true));
  }

  try {
    const live = await request(`${apiBaseUrl}/api/health/live`, { cache: 'no-store' });
    checks.push(result('API liveness', live.ok, `HTTP ${live.status}`, true));
  } catch (error) {
    checks.push(result('API liveness', false, String(error), true));
  }

  try {
    const ready = await request(`${apiBaseUrl}/api/health/ready`, { cache: 'no-store' });
    checks.push(result('API readiness', ready.ok, `HTTP ${ready.status}`, true));
  } catch (error) {
    checks.push(result('API readiness', false, String(error), true));
  }

  if (checks.some(ok => !ok)) process.exit(1);
  console.log('PASS Runtime Mobile/PWA readiness checks completed. Physical-device UX/GPS/install checks are still required.');
}

main().catch(error => {
  console.error('FAIL', error);
  process.exit(1);
});
