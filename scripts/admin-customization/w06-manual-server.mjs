/** Browser-accessible W06 fixture. Loopback only; no SQL, business writes or external adapters. */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../hq-standard/register.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'frontend/dist');
const { resolveCompanyConfig, validateTranslations } = await import('../../packages/contracts/src/crm-customization.ts');
const baseline = JSON.parse(await readFile(path.join(root, 'packages/contracts/catalogs/hq-customization-baseline.json'), 'utf8'));
const artifact = { ...baseline, publicationReady: true }; // Fixture only; original baseline is unready.
const token = 'W06_SYNTHETIC_ADMIN';
const companyA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const companyB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companies = new Map([[companyA, 'Fixture A'], [companyB, 'Fixture B']]);
const initialConfig = companyId => ({ companyId, baseStandardReleaseId: artifact.catalog.standardReleaseId, patches: [], activeLocales: ['ko-KR', 'en-US'], defaultLocale: 'ko-KR', translations: {} });
const state = new Map([...companies.keys()].map(companyId => [companyId, { activeReleaseId: null, drafts: [{ id: randomUUID(), revision: 1, state: 'DRAFT', config: initialConfig(companyId) }], releases: [], validations: new Map() }]));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const fail = (res, status, code) => json(res, status, { code });
const readBody = async req => {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) throw Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413 }); chunks.push(chunk); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
};
const draftFor = (scope, id) => scope.drafts.find(draft => draft.id === id && ['DRAFT', 'VALIDATED'].includes(draft.state));

async function api(req, res, url) {
  if (req.headers.authorization !== `Bearer ${token}`) return fail(res, 401, 'SYNTHETIC_SESSION_REQUIRED');
  const method = req.method, pathname = url.pathname;
  const readRelease = pathname.match(/^\/api\/admin\/companies\/([^/]+)\/releases\/([^/]+)$/);
  if (method === 'GET' && readRelease) {
    const release = state.get(readRelease[1])?.releases.find(item => item.id === readRelease[2]);
    return release ? json(res, 200, release) : fail(res, 404, 'NOT_FOUND');
  }
  if (method === 'GET' && pathname === '/api/admin/companies') return json(res, 200, { items: [...companies].map(([id, name]) => ({ id, name })), nextCursor: null });
  if (method === 'GET' && pathname === '/api/admin/catalogs') {
    if (!companies.has(url.searchParams.get('companyId')) || url.searchParams.get('standardReleaseId') !== artifact.catalog.standardReleaseId) return fail(res, 404, 'STANDARD_NOT_PUBLISHED');
    return json(res, 200, artifact);
  }
  if (method === 'GET' && pathname === '/api/admin/config/drafts') {
    const scope = state.get(url.searchParams.get('scopeKey'));
    if (!scope) return fail(res, 404, 'NOT_FOUND');
    return json(res, 200, { activeReleaseId: scope.activeReleaseId, capabilities: { edit: true, preview: true, publish: true }, drafts: scope.drafts.filter(draft => ['DRAFT', 'VALIDATED'].includes(draft.state)), releases: scope.releases });
  }
  if (!['POST', 'PATCH'].includes(method) || !req.headers['content-type']?.startsWith('application/json')) return fail(res, 404, 'FIXTURE_ENDPOINT_UNAVAILABLE');
  const body = await readBody(req);
  if (method === 'POST' && pathname === '/api/admin/config/drafts') {
    const scope = state.get(body.companyId);
    if (!scope) return fail(res, 404, 'NOT_FOUND');
    if (body.baseStandardReleaseId !== artifact.catalog.standardReleaseId) return fail(res, 404, 'STANDARD_NOT_PUBLISHED');
    if (scope.activeReleaseId !== body.expectedActiveReleaseId) return fail(res, 409, 'RELEASE_CONFLICT');
    if (scope.drafts.some(draft => ['DRAFT', 'VALIDATED'].includes(draft.state))) return fail(res, 409, 'DRAFT_EXISTS');
    const config = scope.releases.at(-1)?.config ?? initialConfig(body.companyId);
    const draft = { id: randomUUID(), revision: 1, state: 'DRAFT', config: structuredClone(config) };
    scope.drafts.push(draft);
    return json(res, 201, draft);
  }
  const draftMatch = pathname.match(/^\/api\/admin\/config\/drafts\/([^/]+)$/);
  if (method === 'PATCH' && draftMatch) {
    const scope = state.get(body.companyId), draft = scope && draftFor(scope, draftMatch[1]);
    if (!draft) return fail(res, 404, 'NOT_FOUND');
    if (req.headers['if-match'] !== `"${draft.revision}"`) return fail(res, 409, 'DRAFT_CONFLICT');
    if (!Array.isArray(body.patches) || !Array.isArray(body.activeLocales) || typeof body.defaultLocale !== 'string' || !body.translations || typeof body.translations !== 'object') return fail(res, 422, 'INVALID_DRAFT');
    draft.config = { ...draft.config, patches: structuredClone(body.patches), activeLocales: [...body.activeLocales], defaultLocale: body.defaultLocale, translations: structuredClone(body.translations), leadGridColumns: [...(body.leadGridColumns ?? draft.config.leadGridColumns ?? [])], placementOrders: structuredClone(body.placementOrders ?? draft.config.placementOrders ?? {}), leadListOrder: body.leadListOrder ?? draft.config.leadListOrder };
    draft.revision++; draft.state = 'DRAFT';
    return json(res, 200, draft);
  }
  if (method === 'POST' && pathname === '/api/admin/config/validate') {
    const scope = state.get(body.companyId), draft = scope && draftFor(scope, body.draftIds?.[0]);
    if (!draft) return fail(res, 404, 'NOT_FOUND');
    if (draft.revision !== body.revisions?.[0]) return fail(res, 409, 'DRAFT_CONFLICT');
    const effective = resolveCompanyConfig(artifact.catalog, draft.config);
    const errors = [...effective.issues, ...validateTranslations(artifact.catalog.entries, draft.config.activeLocales, draft.config.defaultLocale, artifact.translations, draft.config.translations)];
    const validation = { id: randomUUID(), companyId: body.companyId, draftId: draft.id, revision: draft.revision, activeReleaseId: scope.activeReleaseId, effective, errors };
    scope.validations.set(validation.id, validation);
    draft.state = errors.length ? 'DRAFT' : 'VALIDATED';
    return json(res, 200, validation);
  }
  if (method === 'POST' && pathname === '/api/admin/config/preview') {
    const scope = state.get(body.companyId), validation = scope?.validations.get(body.validationId);
    if (!validation || draftFor(scope, validation.draftId)?.revision !== validation.revision) return fail(res, 409, 'VALIDATION_STALE');
    return json(res, 200, { mode: 'PREVIEW', effective: validation.effective, errors: validation.errors, sideEffects: false });
  }
  const rollback = pathname.match(/^\/api\/admin\/companies\/([^/]+)\/releases\/([^/]+)\/rollback$/);
  if (method === 'POST' && rollback) {
    const scope = state.get(rollback[1]);
    const target = scope?.releases.find(item => item.id === body.targetReleaseId);
    if (!target) return fail(res, 404, 'NOT_FOUND');
    if (scope.activeReleaseId !== rollback[2] || scope.activeReleaseId !== body.expectedReleaseId) return fail(res, 409, 'RELEASE_CONFLICT');
    if (scope.drafts.some(draft => ['DRAFT', 'VALIDATED'].includes(draft.state))) return fail(res, 409, 'DRAFT_EXISTS');
    if (!body.reason?.trim()) return fail(res, 422, 'REASON_REQUIRED');
    const draft = { id: randomUUID(), revision: 1, state: 'DRAFT', config: structuredClone(target.config) };
    scope.drafts.push(draft);
    return json(res, 201, draft);
  }
  const releaseMatch = pathname.match(/^\/api\/admin\/companies\/([^/]+)\/releases$/);
  if (method === 'POST' && releaseMatch) {
    const scope = state.get(releaseMatch[1]), validation = scope?.validations.get(body.validationId);
    const draft = validation && draftFor(scope, validation.draftId);
    if (!draft || draft.revision !== validation.revision || scope.activeReleaseId !== validation.activeReleaseId || scope.activeReleaseId !== body.expectedReleaseId) return fail(res, 409, 'VALIDATION_STALE');
    if (validation.errors.length) return fail(res, 422, 'VALIDATION_FAILED');
    if (typeof body.reason !== 'string' || !body.reason.trim()) return fail(res, 422, 'REASON_REQUIRED');
    const checked = resolveCompanyConfig(artifact.catalog, draft.config);
    if (checked.issues.length || validateTranslations(artifact.catalog.entries, draft.config.activeLocales, draft.config.defaultLocale, artifact.translations, draft.config.translations).length) return fail(res, 422, 'VALIDATION_FAILED');
    const release = { id: randomUUID(), companyId: releaseMatch[1], standardReleaseId: draft.config.baseStandardReleaseId, reason: body.reason, createdAt: new Date().toISOString(), config: structuredClone(draft.config) };
    scope.releases.push(release); scope.activeReleaseId = release.id; draft.state = 'PUBLISHED';
    return json(res, 201, release);
  }
  return fail(res, 404, 'FIXTURE_ENDPOINT_UNAVAILABLE');
}

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host;
    if (!/^127\.0\.0\.1:\d+$/.test(host ?? '') || req.headers.origin && req.headers.origin !== `http://${host}`) return fail(res, 403, 'LOCAL_ONLY');
    const url = new URL(req.url ?? '/', `http://${host}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'METHOD_NOT_ALLOWED');
    let target = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`);
    if (target !== dist && !target.startsWith(`${dist}${path.sep}`)) return fail(res, 403, 'INVALID_PATH');
    if (!(await stat(target).catch(() => null))?.isFile()) target = path.join(dist, 'index.html');
    let content = await readFile(target);
    if (target.endsWith('.html')) {
      const script = `<script>window.__DIO_CRM_HQ_MOCK__=false;localStorage.setItem('dio_crm_access_token','${token}');</script>`;
      content = Buffer.from(content.toString('utf8').replace('</head>', `${script}</head>`));
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    fail(res, error.status ?? 500, error.status ? error.message : 'FIXTURE_ERROR');
  }
});
const port = Number(process.env.W06_FIXTURE_PORT ?? 3211);
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
console.log(`W06 manual fixture: http://127.0.0.1:${port}/admin/customization`);
console.log('Browser에서 위 주소를 여세요. Fixture A/B의 변경은 메모리에만 남으며 Ctrl+C로 서버를 닫습니다. 실제 SQL/운영 게시와 연결되지 않습니다.');
