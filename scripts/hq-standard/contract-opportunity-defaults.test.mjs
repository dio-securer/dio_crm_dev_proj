import test from 'node:test';
import assert from 'node:assert/strict';
import { contractOpportunityDefaults } from '../../frontend/src/hq-mock/contract-opportunity-defaults.ts';
import { createHqApplication } from './runtime.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');

test('contract draft retains the chosen opportunity terms and valid product allocations', () => {
  assert.deepEqual(contractOpportunityDefaults({ amount: 400000, special_terms: '테스트 특약', products: [
    { amount: 150000, product_amount: 140000, goods_amount: 10000 },
    { amount: 250000, product_amount: 220000, goods_amount: 30000 },
  ] }), { productAmount: 360000, goodsAmount: 40000, specialTerms: '테스트 특약' });
});

test('selected opportunity defaults survive contract creation in the isolated mock repository', async () => {
  const app = createHqApplication();
  const auth = await app.handle({ method: 'POST', path: '/api/hq/session', body: { loginId: 'hq-sales', password: 'HQ-DEMO' } });
  const call = (method, path, body) => app.handle({ method, path, body, token: auth.body.accessToken });
  const created = await call('POST', '/api/opportunities', { accountPublicId: seedIDs.approvedAccount, opportunityName: 'Synthetic inheritance', expectedCloseDate: '2026-12-01', specialTerms: '기회 특약' });
  assert.equal(created.status, 200);
  const path = `/api/opportunities/${created.body.public_id}`;
  assert.equal((await call('POST', path + '/products', { packagePublicId: seedIDs.product, quantity: 1, proposedUnitPrice: 100000, productAmount: 80000, goodsAmount: 20000 })).status, 200);
  assert.equal((await call('POST', path + '/stage', { toStage: 'CLOSED_WON' })).status, 200);
  const opportunity = await call('GET', path);
  const result = await call('POST', '/api/contracts', { opportunityPublicId: created.body.public_id, ...contractOpportunityDefaults(opportunity.body) });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.special_terms, '기회 특약');
  assert.equal(result.body.product_amount, 80000);
  assert.equal(result.body.goods_amount, 20000);
});

test('missing or inconsistent allocations do not silently become an inaccurate split', () => {
  assert.deepEqual(contractOpportunityDefaults({ amount: 100000, products: [{ amount: 100000, product_amount: 50000 }] }),
    { productAmount: 100000, goodsAmount: 0, specialTerms: '' });
  assert.deepEqual(contractOpportunityDefaults(undefined), { productAmount: 0, goodsAmount: 0, specialTerms: '' });
});
