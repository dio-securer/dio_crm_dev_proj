#!/usr/bin/env node

const raw = process.argv.slice(2);
const value = name => {
  const i = raw.indexOf(`--${name}`);
  return i >= 0 ? raw[i + 1] : undefined;
};
const has = name => raw.includes(`--${name}`);
const strict = has('strict');

const mapProvider = value('map-provider') || process.env.CRM_MAP_PROVIDER || '';
const mapProbeUrl = value('map-probe-url') || process.env.CRM_MAP_PROBE_URL || '';
const erpBaseUrl = (value('erp-base-url') || process.env.CRM_ERP_BASE_URL || '').replace(/\/$/, '');
const erpHealthPath = value('erp-health-path') || process.env.CRM_ERP_HEALTH_PATH || '';
const erpToken = process.env.CRM_ERP_VALIDATION_TOKEN || '';

function report(name, state, detail) {
  console.log(`${state.padEnd(5)} ${name} - ${detail}`);
  return state !== 'FAIL';
}

async function probe(url, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.CRM_EXTERNAL_TIMEOUT_MS || 10000));
  try {
    return await fetch(url, { method: 'GET', headers, redirect: 'follow', signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timeout);
  }
}

let ok = true;
console.log('DIO CRM External Integration Readiness');

if (!mapProvider) {
  ok = report('Map provider config', strict ? 'FAIL' : 'SKIP', 'CRM_MAP_PROVIDER not configured') && ok;
} else {
  report('Map provider config', 'PASS', mapProvider);
  if (!mapProbeUrl) {
    ok = report('Map provider probe', strict ? 'FAIL' : 'SKIP', 'CRM_MAP_PROBE_URL not configured') && ok;
  } else {
    try {
      const r = await probe(mapProbeUrl);
      ok = report('Map provider probe', r.ok ? 'PASS' : 'FAIL', `HTTP ${r.status} ${mapProbeUrl}`) && ok;
    } catch (error) {
      ok = report('Map provider probe', 'FAIL', String(error)) && ok;
    }
  }
}

if (!erpBaseUrl || !erpHealthPath) {
  ok = report('ERP test endpoint', strict ? 'FAIL' : 'SKIP', 'CRM_ERP_BASE_URL and CRM_ERP_HEALTH_PATH are required') && ok;
} else {
  const headers = erpToken ? { Authorization: `Bearer ${erpToken}` } : {};
  const url = `${erpBaseUrl}${erpHealthPath.startsWith('/') ? '' : '/'}${erpHealthPath}`;
  try {
    const r = await probe(url, headers);
    ok = report('ERP connectivity', r.ok ? 'PASS' : 'FAIL', `HTTP ${r.status} ${url}`) && ok;
  } catch (error) {
    ok = report('ERP connectivity', 'FAIL', String(error)) && ok;
  }
}

if (!ok) process.exit(1);
console.log('INFO Connectivity PASS does not prove business transaction correctness. Validate request/response mappings in UAT using non-production test data.');
