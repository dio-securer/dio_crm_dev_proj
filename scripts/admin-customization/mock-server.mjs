/** Local-only administrator editor fixture. No request is forwarded to the real API. */
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../frontend/node_modules/vite/dist/node/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifact = JSON.parse(readFileSync(path.join(root, 'packages/contracts/catalogs/hq-codes-review.json'), 'utf8'));
const companyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const token = 'LOCAL_ADMIN_MOCK_ONLY';
const draftId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const validationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const releases = [];
let draft = { id: draftId, revision: 1, state: 'DRAFT', config: {
  companyId, baseStandardReleaseId: artifact.catalog.standardReleaseId,
  patches: [], activeLocales: ['ko-KR', 'en-US'], defaultLocale: 'ko-KR', translations: {}
} };
let savedConfig = structuredClone(draft.config);
let logic = { revision: 0, items: [] };

function answer(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Admin-Mock': 'true' });
  res.end(JSON.stringify(body));
}
async function bodyOf(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}
const mockApi = {
  name: 'local-admin-mock-api',
  configureServer(server) {
    server.middlewares.use('/api', async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://local.invalid');
        const route = url.pathname;
        const method = req.method ?? 'GET';
        if (route === '/auth/login' && method === 'POST') {
          const input = await bodyOf(req);
          return input.loginId === 'admin' && input.password === '1234'
            ? answer(res, 200, { accessToken: token, user: { loginId: 'admin', name: '목업 관리자' }, mock: true })
            : answer(res, 401, { statusCode: 401, message: 'Invalid credentials' });
        }
        if (req.headers.authorization !== `Bearer ${token}`) return answer(res, 401, { statusCode: 401, message: 'Mock admin login required' });
        if (route === '/auth/logout' && method === 'POST') return answer(res, 200, { success: true });
        if (route === '/admin/companies' && method === 'GET') return answer(res, 200, { items: [{ id: companyId, name: 'DIO 데모 법인' }], nextCursor: null });
        if (route === '/admin/hq/fields' && method === 'GET') return answer(res, 200, { capabilities: { define: false, distribute: false }, definitions: [], target: null });
        if (route === `/admin/companies/${companyId}/extension-fields` && method === 'GET') return answer(res, 200, { definitions: [], target: { companyId, fields: [] } });
        if (route === '/admin/catalogs' && method === 'GET') return answer(res, 200, artifact);
        if (route === '/admin/config/drafts' && method === 'GET') return answer(res, 200, {
          activeReleaseId: releases.at(-1)?.id ?? null,
          capabilities: { edit: true, preview: true, publish: true, placementPresentation: true, accountPlacementPresentation: true, leadGrid: true, leadGridDensity: true, leadGridSort: true, leadColumnWidths: true, leadColumnAlignments: true, popupPresentation: true, buttonPresentation: true },
          drafts: draft ? [draft] : [], releases
        });
        if (route === '/admin/config/drafts' && method === 'POST') {
          if (draft) return answer(res, 409, { code: 'DRAFT_EXISTS' });
          const input = await bodyOf(req);
          draft = { id: randomUUID(), revision: 1, state: 'DRAFT', config: { companyId, baseStandardReleaseId: input.baseStandardReleaseId, patches: [], activeLocales: ['ko-KR', 'en-US'], defaultLocale: 'ko-KR', translations: {} } };
          return answer(res, 200, draft);
        }
        if (route === `/admin/config/drafts/${draft?.id}` && method === 'PATCH') {
          const revision = Number(req.headers['if-match']?.replaceAll('"', ''));
          if (revision !== draft.revision) return answer(res, 409, { code: 'DRAFT_CHANGED' });
          const input = await bodyOf(req);
          draft = { ...draft, revision: draft.revision + 1, config: { ...draft.config, ...input, companyId } };
          return answer(res, 200, draft);
        }
        if (route === '/admin/config/validate' && method === 'POST') return answer(res, 200, { id: validationId, errors: [] });
        if (route === '/admin/config/preview' && method === 'POST') return answer(res, 200, { errors: [], effective: { entries: artifact.catalog.entries } });
        if (route === `/admin/companies/${companyId}/releases` && method === 'POST') {
          if (!draft) return answer(res, 409, { code: 'DRAFT_MISSING' });
          const input = await bodyOf(req);
          const release = { id: randomUUID(), standardReleaseId: draft.config.baseStandardReleaseId, reason: input.reason, createdAt: new Date().toISOString() };
          savedConfig = structuredClone(draft.config);
          releases.push(release);
          draft = null;
          return answer(res, 200, release);
        }
        if (route === `/admin/companies/${companyId}/releases/${releases.at(-1)?.id}` && method === 'GET') return answer(res, 200, { config: savedConfig });
        if (route.endsWith('/rollback') && method === 'POST') {
          draft = { id: randomUUID(), revision: 1, state: 'DRAFT', config: structuredClone(savedConfig) };
          return answer(res, 200, draft);
        }
        if (route === `/admin/config/drafts/${draft?.id}/rebase` && method === 'POST') {
          const input = await bodyOf(req);
          draft = { ...draft, revision: draft.revision + 1, config: { ...draft.config, baseStandardReleaseId: input.targetStandardReleaseId }, rebase: { conflicts: [] } };
          return answer(res, 200, draft);
        }
        if (route === `/admin/config/drafts/${draft?.id}/abandon` && method === 'POST') {
          draft = null;
          return answer(res, 200, { state: 'ABANDONED' });
        }
        if (route === '/admin/logic-drafts' && method === 'GET') return answer(res, 200, {
          companyId, draftId: url.searchParams.get('draftId'), configRevision: draft?.revision ?? 0,
          revision: logic.revision, items: logic.items, runtimeStatus: 'not-implemented', releaseBinding: 'not-connected', capabilities: { edit: true }
        });
        if (route === '/admin/logic-drafts' && method === 'PUT') {
          const input = await bodyOf(req);
          logic = { revision: logic.revision + 1, items: input.items.map(item => ({ ...item, sourceHash: createHash('sha256').update(item.source).digest('hex') })) };
          return answer(res, 200, { companyId, draftId: input.draftId, configRevision: input.configRevision, ...logic, runtimeStatus: 'not-implemented', releaseBinding: 'not-connected', capabilities: { edit: true } });
        }
        return answer(res, 404, { statusCode: 404, code: 'MOCK_ROUTE_UNAVAILABLE', message: route });
      } catch (error) {
        return answer(res, 400, { statusCode: 400, message: error instanceof Error ? error.message : String(error) });
      }
    });
  }
};

const server = await createServer({
  root: path.join(root, 'frontend'),
  configFile: path.join(root, 'frontend/vite.config.ts'),
  cacheDir: path.join(root, 'frontend/.tmp/admin-mock-vite-cache'),
  plugins: [mockApi],
  server: { host: '127.0.0.1', port: 5174, strictPort: true }
});
await server.listen();
server.printUrls();
console.log('LOCAL ADMIN MOCK: admin / 1234; data stays in this process only.');
