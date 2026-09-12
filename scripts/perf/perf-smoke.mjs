const base = (process.env.CRM_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const path = process.env.CRM_PERF_PATH || '/api/health/live';
const total = Math.max(1, Number(process.env.CRM_PERF_REQUESTS || 100));
const concurrency = Math.max(1, Number(process.env.CRM_PERF_CONCURRENCY || 10));
const maxP95 = Math.max(1, Number(process.env.CRM_PERF_MAX_P95_MS || 500));

const timings = [];
let next = 0;
let failed = 0;
async function worker() {
  while (true) {
    const i = next++;
    if (i >= total) return;
    const started = performance.now();
    try {
      const res = await fetch(`${base}${path}`);
      if (!res.ok) failed += 1;
      await res.arrayBuffer();
    } catch {
      failed += 1;
    } finally {
      timings.push(performance.now() - started);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
timings.sort((a,b) => a-b);
const percentile = p => timings[Math.min(timings.length - 1, Math.floor(timings.length * p))] || 0;
const result = {
  url: `${base}${path}`,
  requests: total,
  concurrency,
  failed,
  p50Ms: Math.round(percentile(0.50)),
  p95Ms: Math.round(percentile(0.95)),
  p99Ms: Math.round(percentile(0.99)),
  maxMs: Math.round(timings.at(-1) || 0),
  thresholdP95Ms: maxP95
};
console.log(JSON.stringify(result, null, 2));
if (failed > 0 || result.p95Ms > maxP95) process.exit(1);
