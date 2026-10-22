/** Real frontend mode/API sources with a fetch boundary double; no React, browser or HTTP claims. */
import './register.mjs';
import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const previousGlobals = new Map(['window', 'localStorage', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const session = new Map();
const legacy = new Map();
const legacySeed = [
  ['dio_crm_access_token', 'LIVE_TOKEN'],
  ['dio_crm_demo_mode', 'global-executive'],
  ['dio_crm_demo_accounts', 'UNCHANGED']
];
const storage = data => ({
  getItem: key => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: key => data.delete(key)
});
const browser = {
  location: { origin: 'http://127.0.0.1:3101', search: '?hq=1' },
  sessionStorage: storage(session),
  localStorage: storage(legacy),
  __DIO_CRM_API_BASE__: 'https://legacy.example'
};
globalThis.window = browser;
globalThis.localStorage = browser.localStorage;
const mode = await import('../../frontend/src/hq-mock/mode.ts');
const api = await import('../../frontend/src/api.ts');
let calls = [];
let reply;
globalThis.fetch = async (...args) => { calls.push(args); return reply(); };
const lastRequest = () => calls.at(-1);
const globalMode = () => { browser.location.search = '?demo=global'; };

describe('H02 frontend explicit mode and transport isolation', { concurrency: false }, () => {
  beforeEach(() => {
    session.clear();
    legacy.clear();
    for (const [key, value] of legacySeed) legacy.set(key, value);
    browser.location.search = '?hq=1';
    mode.isHqMockMode();
    mode.setHqToken(null);
    mode.setHqScenario('SUCCESS');
    calls = [];
    reply = () => new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json', 'X-HQ-Mock': 'true' } });
  });

  after(() => {
    for (const [key, descriptor] of previousGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  test('01 explicit HQ overrides a stored GLOBAL preference', () => {
    assert.equal(mode.isHqMockMode(), true);
    assert.equal(legacy.get('dio_crm_demo_mode'), 'global-executive');
  });
  test('02 HQ requests stay on the same-origin API and ignore normal API_BASE', async () => {
    await api.apiGet('/api/accounts');
    assert.equal(lastRequest()[0], '/api/accounts');
  });
  test('03 HQ requests never send cookies', async () => {
    await api.apiGet('/api/accounts');
    assert.equal(lastRequest()[1].credentials, 'omit');
  });
  test('04 HQ requests reject redirects', async () => {
    await api.apiGet('/api/accounts');
    assert.equal(lastRequest()[1].redirect, 'error');
  });
  test('05 HQ does not borrow a real-server access token', async () => {
    await api.apiGet('/api/accounts');
    assert.equal(lastRequest()[1].headers.Authorization, undefined);
  });
  test('06 HQ sends only its own access token', async () => {
    mode.setHqToken('HQ_TOKEN');
    await api.apiPost('/api/accounts', {});
    assert.equal(lastRequest()[1].headers.Authorization, 'Bearer HQ_TOKEN');
    assert.equal(lastRequest()[1].headers['X-HQ-Mode'], 'HQ_HTTP_MOCK');
  });
  test('07 ERP scenario selection reaches the request header', async () => {
    mode.setHqScenario('DELAY');
    await api.apiPost('/api/accounts', {});
    assert.equal(lastRequest()[1].headers['X-HQ-Scenario'], 'DELAY');
  });
  test('08 POST preserves the JSON request body', async () => {
    await api.apiPost('/api/accounts', { accountName: 'Probe' });
    assert.equal(lastRequest()[1].method, 'POST');
    assert.equal(lastRequest()[1].headers['Content-Type'], 'application/json');
    assert.equal(lastRequest()[1].body, '{"accountName":"Probe"}');
  });

  const blockedPaths = [
    ['09 absolute external URL', 'https://external.invalid/api/accounts'],
    ['10 protocol-relative external URL', '//external.invalid/api/accounts'],
    ['11 path traversal outside API', '/api/../../outside'],
    ['12 encoded path traversal outside API', '/api/%2e%2e/outside'],
    ['13 backslash URL ambiguity', '/api/\\external.invalid']
  ];
  for (const [name, path] of blockedPaths) test(`${name} is rejected before fetch`, async () => {
    await assert.rejects(() => api.apiGet(path), /HQ_MOCK_REQUIRES_SAME_ORIGIN_API/);
    assert.equal(calls.length, 0);
  });

  test('14 missing MOCK marker fails once without retry or another-server fallback', async () => {
    reply = () => new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(() => api.apiGet('/api/accounts'), error => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.errorCode, 'HQ_MOCK_NOT_CONFIRMED');
      return true;
    });
    assert.equal(calls.length, 1);
    assert.equal(lastRequest()[0], '/api/accounts');
  });
  test('15 JSON permission errors preserve status, message and details', async () => {
    reply = () => new Response(JSON.stringify({ error: 'Forbidden', message: 'Permission denied', details: { permission: 'ACCOUNT.WRITE' } }), {
      status: 403, headers: { 'X-HQ-Mock': 'true' }
    });
    await assert.rejects(() => api.apiPatch('/api/accounts/123', {}), error => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.message, 'Permission denied');
      assert.equal(error.errorCode, 'Forbidden');
      assert.deepEqual(error.details, { permission: 'ACCOUNT.WRITE' });
      return true;
    });
  });
  test('16 unsupported scenario cannot replace the active scenario', () => {
    assert.throws(() => mode.setHqScenario('UNREGISTERED'), /HQ_SCENARIO_NOT_REGISTERED/);
    assert.equal(mode.getHqScenario(), 'SUCCESS');
  });
  test('17 DELETE handles an empty 204 response', async () => {
    reply = () => new Response(null, { status: 204, headers: { 'X-HQ-Mock': 'true' } });
    assert.equal(await api.apiDelete('/api/accounts/123'), undefined);
  });
  test('18 DELETE uses the intended method and target', async () => {
    await api.apiDelete('/api/accounts/123');
    assert.equal(lastRequest()[1].method, 'DELETE');
    assert.equal(lastRequest()[0], '/api/accounts/123');
  });
  test('19 explicit GLOBAL selection disables HQ', () => {
    globalMode();
    assert.equal(mode.isHqMockMode(), false);
  });
  test('20 normal mode still uses its configured API_BASE', async () => {
    globalMode();
    reply = () => new Response('{}');
    await api.apiGet('/api/accounts');
    assert.equal(lastRequest()[0], 'https://legacy.example/api/accounts');
  });
  test('21 normal mode still uses its own legacy token', async () => {
    mode.setHqToken('HQ_TOKEN');
    globalMode();
    await api.apiGet('/api/accounts');
    assert.equal(lastRequest()[1].headers.Authorization, 'Bearer LIVE_TOKEN');
  });
  test('22 normal mode receives no HQ headers or credential policy changes', async () => {
    globalMode();
    await api.apiGet('/api/accounts');
    assert.equal(lastRequest()[1].headers['X-HQ-Mode'], undefined);
    assert.equal(lastRequest()[1].headers['X-HQ-Scenario'], undefined);
    assert.equal(lastRequest()[1].credentials, undefined);
    assert.equal(lastRequest()[1].redirect, undefined);
  });
  test('23 switching to GLOBAL preserves all legacy storage', () => {
    globalMode();
    mode.isHqMockMode();
    assert.deepEqual([...legacy], legacySeed);
  });
  test('24 explicit HQ off disables HQ mode', () => {
    browser.location.search = '?hq=off';
    assert.equal(mode.isHqMockMode(), false);
  });
  test('25 exiting HQ clears only the HQ access token', () => {
    mode.setHqToken('HQ_TOKEN');
    browser.location.search = '?hq=off';
    mode.isHqMockMode();
    assert.equal(mode.getHqToken(), null);
    assert.equal(session.has(mode.HQ_TOKEN_KEY), false);
  });
  test('26 exiting HQ preserves the real-server token and GLOBAL data', () => {
    mode.setHqToken('HQ_TOKEN');
    browser.location.search = '?hq=off';
    mode.isHqMockMode();
    assert.deepEqual([...legacy], legacySeed);
  });
});
