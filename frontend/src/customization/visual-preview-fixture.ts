import fixtures from './visual-preview-fixtures.json';
import directWorkFixtures from './visual-preview-direct-work-fixtures.json';
import { visualPreviewAnalyticsDashboard } from './visual-preview-analytics-fixture';
import { visualPreviewOpportunity } from './visual-preview-opportunity-fixture';

type Row = Record<string, unknown> & { public_id: string };
// Fixed, distinct synthetic timestamps make the two supported sort directions visible.
const leads:Row[] = (fixtures.leads as Row[]).map((row,index)=>({...row,updated_at:`2026-10-${String(24-index).padStart(2,'0')}T00:00:00.000Z`}));
const accounts = fixtures.accounts as Row[];
const leadDetails = fixtures.leadDetails as Record<string, unknown>;
const leadHistory = fixtures.leadHistory as Record<string, unknown>;
const conversionOptions = fixtures.leadConversionOptions as Record<string, unknown>;
const accountDetails = fixtures.accountDetails as Record<string, unknown>;

export const visualPreviewActor = fixtures.actor;

/** Responses are made in memory. No browser request is issued by this adapter. */
export function visualPreviewResponse(path: string, init: RequestInit = {}): Response {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET') throw new Error(`VISUAL_PREVIEW_WRITE_BLOCKED:${method}`);
  const url = new URL(path, 'http://fixture.invalid');
  const p = url.pathname;
  const boot = window.__DIO_VISUAL_PREVIEW_BOOT__;
  const listPath = boot?.screen === 'HQ_LEAD' ? '/api/leads' : boot?.screen === 'HQ_ACCOUNT' ? '/api/accounts' : '';
  if (boot?.variant === 'list' && p === listPath && boot.fixtureState === 'error')
    return new Response(JSON.stringify({ error: 'VISUAL_PREVIEW_FIXTURE_ERROR', code: 'FIXTURE_LIST_FAILURE' }), { status: 503, headers: { 'Content-Type': 'application/json', 'X-HQ-Mock': 'true' } });
  let body: unknown;
  if (p === '/api/me/context') body = fixtures.context;
  else if (p === '/api/hq/policy') body = fixtures.policy;
  else if (p === '/api/hq/status') body = fixtures.clock;
  else if (p === '/api/analytics/dashboard' && boot?.screen === 'HQ_ANALYTICS') body = visualPreviewAnalyticsDashboard;
  else if (p === '/api/opportunities' && boot?.screen === 'HQ_OPPORTUNITY') body = [visualPreviewOpportunity];
  else if (p === '/api/product-packages' && boot?.screen === 'HQ_OPPORTUNITY') body = [];
  else if (p === '/api/direct-work/approvers') body = directWorkFixtures.approvers;
  else if (p === '/api/direct-work') body = [boot?.fixtureState === 'approval-branch-approved' ? directWorkFixtures.branchApproved : directWorkFixtures.requested];
  else if (/^\/api\/direct-work\/[^/]+$/.test(p)) body = [directWorkFixtures.requested, directWorkFixtures.branchApproved].find(row => row.public_id === p.split('/')[3]);
  else if (p === '/api/leads/options') body = fixtures.leadOptions;
  else if (p === '/api/leads') {
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    body = boot?.screen === 'HQ_LEAD' && boot.variant === 'list' && boot.fixtureState === 'empty' ? [] : leads.filter(row => !search || String(row.hospital_name ?? '').toLowerCase().includes(search));
  } else if (/^\/api\/leads\/[^/]+\/history$/.test(p)) body = leadHistory[p.split('/')[3]];
  else if (/^\/api\/leads\/[^/]+\/conversion-options$/.test(p)) body = conversionOptions[p.split('/')[3]];
  else if (/^\/api\/leads\/[^/]+$/.test(p)) body = leadDetails[p.split('/')[3]];
  else if (p === '/api/accounts') {
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    body = boot?.screen === 'HQ_ACCOUNT' && boot.variant === 'list' && boot.fixtureState === 'empty' ? [] : accounts.filter(row => !search || String(row.account_name ?? '').toLowerCase().includes(search));
  } else if (/^\/api\/accounts\/[^/]+\/customer-detail$/.test(p)) body = accountDetails[p.split('/')[3]];
  else if (p === '/api/activities') body = fixtures.activities;
  if (body === undefined) return new Response(JSON.stringify({ error: 'VISUAL_PREVIEW_FIXTURE_NOT_FOUND', path: p }), { status: 404, headers: { 'Content-Type': 'application/json', 'X-HQ-Mock': 'true' } });
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'X-HQ-Mock': 'true' } });
}
