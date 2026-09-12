const base = (process.env.CRM_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const token = process.env.CRM_ACCESS_TOKEN || '';

async function check(name, path, auth = false) {
  const headers = auth && token ? { Authorization: `Bearer ${token}` } : {};
  const started = performance.now();
  const res = await fetch(`${base}${path}`, { headers });
  const elapsedMs = Math.round(performance.now() - started);
  const body = await res.text();
  const result = { name, path, status: res.status, ok: res.ok, elapsedMs };
  console.log(JSON.stringify(result));
  if (!res.ok) {
    console.error(body.slice(0, 500));
    throw new Error(`${name} failed`);
  }
}

await check('liveness', '/api/health/live');
await check('readiness', '/api/health/ready');
if (token) {
  await check('ops-status', '/api/ops/status', true);
  await check('dashboard', '/api/analytics/dashboard', true);
} else {
  console.log('CRM_ACCESS_TOKEN not set: authenticated smoke checks skipped.');
}
console.log('Pilot smoke checks passed.');
