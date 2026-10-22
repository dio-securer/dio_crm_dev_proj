import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { HqRepository, validateHqDataset } = await import('../../backend/src/hq-mock/repository.ts');
const { createHqSeed, seedIDs } = await import('../../backend/src/hq-mock/seed.ts');
const { HQ_INTERFACE_CODES, newHqId } = await import('../../backend/src/hq-mock/model.ts');
const { HQ_INTERFACE_REGISTRY, enqueueInterface, applyInterfaceResult, advanceInterface, retryInterface } = await import('../../backend/src/hq-mock/interfaces.ts');

const actor = { userId: 99, companyId: 1, organizationId: 10, permissions: ['INTERFACE.MANAGE'], scope: 'SYSTEM' };
const repository = options => new HqRepository({ datasetId: 'H02-FOUNDATION', ...options });
const enqueue = (repo, code, id, key = code + ':' + id, payload = {}, scenario = 'SUCCESS') => repo.transact(d => enqueueInterface(d, actor, { interfaceCode: code, entityType: HQ_INTERFACE_REGISTRY[code].entity, entityPublicId: id, idempotencyKey: key, payload, scenario }));
const advance = (repo, request, scenario) => repo.transact(d => advanceInterface(d, actor, request.requestId, scenario));
const read = (repo, collection, id) => repo.read().collections[collection].find(row => row.public_id === id);
const result = (request, changes = {}) => ({ requestId: request.requestId, resultId: request.requestId + ':custom', interfaceCode: HQ_INTERFACE_REGISTRY[request.interfaceCode].response, datasetId: request.datasetId, generation: request.generation, businessKey: request.businessKey, success: true, payload: { erpCustomerCode: 'MOCK-CUSTOM', approved: true }, version: 1, ...changes });
const rejects = (work, code) => assert.throws(work, error => error.code === code, `Expected ${code}`);

test('H02 seed is deterministic and all business references are valid', () => {
  const one = createHqSeed('same'), two = createHqSeed('same');
  assert.deepEqual(one, two); assert.doesNotThrow(() => validateHqDataset(one));
  assert.equal(one.collections.products.find(row => row.public_id === seedIDs.zeroStockProduct).stock_qty, 0);
  assert.ok(one.collections.products.find(row => row.public_id === seedIDs.negativeStockProduct).stock_qty < 0);
  assert.equal(one.collections.accounts.find(row => row.public_id === seedIDs.noCoordinatesAccount).latitude, null);
  assert.ok(one.collections.leads.some(row => row.company_id === 2));
  assert.ok(one.collections.leads.some(row => row.owner_user_id === 2));
});
test('H02 failed and delayed interface seed cases are immediately visible, executable and resettable', () => {
  const repo = repository(), initial = repo.read();
  const failed = initial.collections.interfaceLogs.find(row => row.businessKey.entityId === seedIDs.failedInterfaceAccount);
  const delayed = initial.collections.interfaceLogs.find(row => row.businessKey.entityId === seedIDs.delayedInterfaceAccount);
  assert.equal(failed.status, 'FAILED'); assert.equal(failed.result.datasetId, initial.datasetId);
  assert.equal(read(repo, 'accounts', seedIDs.failedInterfaceAccount).integration_status, 'FAILED');
  assert.equal(delayed.status, 'REQUESTING'); assert.equal(delayed.scenario, 'DELAYED');
  assert.equal(delayed.result, undefined); assert.ok(delayed.events.some(event => event.kind === 'DELAYED'));
  assert.equal(read(repo, 'accounts', seedIDs.delayedInterfaceAccount).erp_approved_yn, false);
  const retried = repo.transact(d => retryInterface(d, actor, failed.requestId, 'seed-case-retry'));
  advance(repo, retried); advance(repo, delayed, 'SUCCESS');
  assert.equal(read(repo, 'accounts', seedIDs.failedInterfaceAccount).erp_approved_yn, true);
  assert.equal(read(repo, 'accounts', seedIDs.delayedInterfaceAccount).erp_approved_yn, true);
  const reset = repo.reset(); assert.equal(reset.generation, initial.generation + 1);
  assert.equal(reset.collections.interfaceLogs.find(row => row.businessKey.entityId === seedIDs.failedInterfaceAccount).status, 'FAILED');
  assert.equal(reset.collections.interfaceLogs.find(row => row.businessKey.entityId === seedIDs.delayedInterfaceAccount).status, 'REQUESTING');
});
test('H02 detached reads, atomic writes and revision increment', () => {
  const repo = repository(), one = repo.read(); one.collections.accounts[0].account_name = 'external mutation';
  assert.notEqual(repo.read().collections.accounts[0].account_name, 'external mutation');
  const value = repo.transact(d => { d.collections.accounts[0].account_name = 'Saved'; return d.collections.accounts[0]; });
  value.account_name = 'returned mutation';
  assert.equal(repo.read().collections.accounts[0].account_name, 'Saved'); assert.equal(repo.read().revision, 2);
  const before = repo.read(); assert.throws(() => repo.transact(d => { d.collections.accounts[0].account_name = 'rollback'; throw Error('failed'); })); assert.deepEqual(repo.read(), before);
});
test('H02 persistence failure cannot expose a partial commit', () => {
  let stored, fail = false;
  const repo = repository({ save: value => { if (fail) throw Error('disk full'); stored = structuredClone(value); } });
  const before = repo.read(); fail = true;
  assert.throws(() => repo.transact(d => { d.collections.accounts[0].account_name = 'unsaved'; }), /disk full/);
  assert.deepEqual(repo.read(), before); assert.deepEqual(stored, before);
  const resumed = repository({ load: () => stored }); assert.deepEqual(resumed.read(), before);
});
test('H02 corrupt persisted data is rejected rather than silently reset', () => {
  const malformed = createHqSeed('H02-FOUNDATION'); malformed.schemaVersion = 2;
  rejects(() => repository({ load: () => malformed }), 'DATASET_SCHEMA_UNSUPPORTED');
});
test('H02 invalid relationship, financial amount and company mutation roll back', async t => {
  for (const [name, change, code] of [
    ['cross-company contract', d => d.collections.contracts[0].account_public_id = seedIDs.otherCompanyAccount, 'DATASET_REFERENCE_INVALID'],
    ['missing account', d => d.collections.contacts[0].account_public_id = seedIDs.lead, 'DATASET_REFERENCE_INVALID'],
    ['negative amount', d => d.collections.contracts[0].contract_amount = -1, 'DATASET_MONEY_INVALID'],
    ['nonfinite amount', d => d.collections.orders[0].order_amount = NaN, 'DATASET_MONEY_INVALID'],
    ['rekey dataset', d => d.datasetId = 'other', 'DATASET_IDENTITY_IMMUTABLE'],
    ['duplicate ID', d => d.collections.leads[0].public_id = seedIDs.approvedAccount, 'DATASET_DUPLICATE_ID'],
    ['async work', () => Promise.resolve('uncommitted'), 'DATASET_ASYNC_TRANSACTION_FORBIDDEN']
  ]) await t.test(name, () => { const repo = repository(), before = repo.read(); rejects(() => repo.transact(change), code); assert.deepEqual(repo.read(), before); });
});
test('H02 reset restores seed, increments generation, isolates another repository', () => {
  const one = repository(), other = new HqRepository({ datasetId: 'OTHER' });
  one.transact(d => { d.collections.accounts[0].account_name = 'Changed'; }); const otherBefore = other.read();
  const oldId = one.transact(d => newHqId(d)); const oldGeneration = one.read().generation;
  const reset = one.reset(oldGeneration); assert.equal(reset.generation, oldGeneration + 1);
  assert.equal(reset.collections.accounts[0].account_name, '본사 승인 치과'); assert.deepEqual(other.read(), otherBefore);
  const newId = one.transact(d => newHqId(d)); assert.notEqual(newId, oldId);
  rejects(() => one.reset(oldGeneration), 'DATASET_GENERATION_CONFLICT');
});
test('H02 catalog has exactly all 15 registered interfaces', () => {
  assert.equal(HQ_INTERFACE_CODES.length, 15); assert.deepEqual(Object.keys(HQ_INTERFACE_REGISTRY).sort(), [...HQ_INTERFACE_CODES].sort());
  assert.equal(HQ_INTERFACE_REGISTRY['IF-ERP-002'].response, 'IF-ERP-003');
  assert.equal(HQ_INTERFACE_REGISTRY['IF-ERP-004'].response, 'IF-ERP-005');
  assert.equal(HQ_INTERFACE_REGISTRY['IF-ERP-007'].response, 'IF-ERP-008');
  assert.equal(HQ_INTERFACE_REGISTRY['IF-ERP-012'].response, 'IF-ERP-013');
});
test('H02 normal ERP account → contract → order request/result flow updates shared entities', () => {
  const repo = repository();
  const account = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount);
  assert.equal(account.status, 'REQUESTING'); assert.equal(read(repo, 'accounts', seedIDs.pendingAccount).erp_approved_yn, false);
  assert.equal(advance(repo, account).status, 'SUCCESS'); assert.equal(read(repo, 'accounts', seedIDs.pendingAccount).erp_approved_yn, true);
  const contract = enqueue(repo, 'IF-ERP-004', seedIDs.pendingContract); assert.equal(read(repo, 'contracts', seedIDs.pendingContract).status, 'ERP_REQUESTED');
  advance(repo, contract); assert.equal(read(repo, 'contracts', seedIDs.pendingContract).status, 'ERP_APPROVED');
  repo.transact(d => { d.collections.orders.find(row => row.public_id === seedIDs.pendingOrder).delivery_address = '부산 목업 배송지'; });
  const order = enqueue(repo, 'IF-ERP-007', seedIDs.pendingOrder); assert.equal(read(repo, 'orders', seedIDs.pendingOrder).status, 'REQUESTING');
  advance(repo, order); assert.equal(read(repo, 'orders', seedIDs.pendingOrder).status, 'ACCEPTED');
  assert.ok(repo.read().collections.auditLogs.length >= 6);
});
test('H02 inbound account and contract results, fulfillment, collections, sales, plans and returns', () => {
  const repo = repository();
  advance(repo, enqueue(repo, 'IF-ERP-003', seedIDs.pendingAccount));
  advance(repo, enqueue(repo, 'IF-ERP-005', seedIDs.pendingContract));
  advance(repo, enqueue(repo, 'IF-ERP-008', seedIDs.readyOrder));
  assert.equal(read(repo, 'orders', seedIDs.readyOrder).status, 'COMPLETED'); assert.equal(repo.read().collections.deliveries.length, 1);
  advance(repo, enqueue(repo, 'IF-ERP-009', seedIDs.approvedContract));
  assert.equal(repo.read().collections.collections[0].contract_public_id, seedIDs.approvedContract);
  advance(repo, enqueue(repo, 'IF-ERP-010', seedIDs.approvedAccount));
  assert.equal(repo.read().collections.sales[0].account_public_id, seedIDs.approvedAccount);
  repo.transact(d => { const original = d.collections.plans.find(row => row.public_id === seedIDs.unpaidPlan); original.is_current = false; d.collections.plans.push({ ...original, public_id: newHqId(d), plan_version: 2, amount: 900000, is_current: true, adjustment_type: 'ARREARS_REALLOCATION', erp_sync_status: 'NOT_REQUESTED' }); });
  const plan = enqueue(repo, 'IF-ERP-011', seedIDs.approvedContract); advance(repo, plan);
  assert.equal(repo.read().collections.plans.find(row => row.contract_public_id === seedIDs.approvedContract && row.is_current).erp_sync_status, 'SUCCESS');
  advance(repo, enqueue(repo, 'IF-ERP-014', seedIDs.readyOrder));
  assert.equal(repo.read().collections.returns[0].order_public_id, seedIDs.readyOrder);
});
test('H02 HIRA manual fields are preserved and ERP region assignment reaches leads', () => {
  const repo = repository();
  repo.transact(d => { const lead = d.collections.leads.find(row => row.public_id === seedIDs.lead); lead.hospital_name = '사용자 수정'; lead.manual_fields = ['hospital_name']; });
  const encrypted = read(repo, 'leads', seedIDs.lead).encrypted_provider_no;
  const hira = enqueue(repo, 'IF-HIRA-001', seedIDs.lead, 'hira', { hospitals: [{ encryptedProviderNo: encrypted, hospitalName: '외부 값', phone: '051-123-4567', sido: '부산광역시', sigungu: '해운대구' }] });
  advance(repo, hira);
  assert.equal(read(repo, 'leads', seedIDs.lead).hospital_name, '사용자 수정'); assert.equal(read(repo, 'leads', seedIDs.lead).phone, '051-123-4567');
  advance(repo, enqueue(repo, 'IF-ERP-001', seedIDs.region, 'regions', { regions: [{ sido: '부산광역시', sigungu: '해운대구', ownerUserId: 3 }] }));
  assert.equal(read(repo, 'leads', seedIDs.lead).owner_user_id, 3);
});
test('H02 product synchronization updates price, stock and order availability', () => {
  const repo = repository();
  const request = enqueue(repo, 'IF-ERP-006', seedIDs.product, 'products', { products: [{ productPublicId: seedIDs.product, erpItemCode: 'MOCK-P001', itemName: '변경 품목', itemType: 'PRODUCT', unitPrice: 120000, stockQty: -1, orderAvailable: false }] });
  advance(repo, request); const p = read(repo, 'products', seedIDs.product); assert.equal(p.unit_price, 120000); assert.equal(p.stock_qty, -1); assert.equal(p.order_available_yn, false);
});
test('H02 overlapping product batches preserve newer values and still apply older nonoverlapping rows', () => {
  const repo = repository();
  const product = { productPublicId: seedIDs.product, erpItemCode: 'MOCK-P001', itemName: '원천 품목', itemType: 'PRODUCT', unitPrice: 100, stockQty: 1, orderAvailable: false };
  const older = enqueue(repo, 'IF-ERP-006', seedIDs.product, 'product-old', { products: [product, { ...product, productPublicId: seedIDs.zeroStockProduct, erpItemCode: 'MOCK-P002', unitPrice: 300 }] }, 'DELAYED');
  const newer = enqueue(repo, 'IF-ERP-006', seedIDs.zeroStockProduct, 'product-new', { products: [{ ...product, unitPrice: 200, stockQty: 20, orderAvailable: true }] }, 'DELAYED');
  assert.ok(newer.requestRevision > older.requestRevision);
  advance(repo, newer, 'SUCCESS'); const done = advance(repo, older, 'SUCCESS');
  assert.equal(read(repo, 'products', seedIDs.product).unit_price, 200); assert.equal(read(repo, 'products', seedIDs.product).stock_qty, 20);
  assert.equal(read(repo, 'products', seedIDs.product).order_available_yn, true); assert.equal(read(repo, 'products', seedIDs.zeroStockProduct).unit_price, 300);
  assert.ok(done.events.some(event => event.kind === 'STALE'));
  repo.transact(d => applyInterfaceResult(d, actor, result(newer, { resultId: 'product-correction', version: 2, payload: { products: [{ ...product, unitPrice: 250 }] } })));
  assert.equal(read(repo, 'products', seedIDs.product).unit_price, 250);
});
test('H02 overlapping HIRA batches cannot revert lead or linked account data', () => {
  const repo = repository(), encrypted = read(repo, 'leads', seedIDs.lead).encrypted_provider_no;
  repo.transact(d => { d.collections.accounts.find(row => row.public_id === seedIDs.pendingAccount).encrypted_provider_no = encrypted; });
  const hospital = { encryptedProviderNo: encrypted, hospitalName: '이전 병원', phone: '051-111-1111', sido: '부산광역시', sigungu: '해운대구' };
  const older = enqueue(repo, 'IF-HIRA-001', seedIDs.lead, 'hira-old', { hospitals: [hospital, { ...hospital, encryptedProviderNo: 'UNIQUE-OLDER-BATCH' }] }, 'DELAYED');
  const newer = enqueue(repo, 'IF-HIRA-001', seedIDs.duplicateLead, 'hira-new', { hospitals: [{ ...hospital, hospitalName: '최신 병원', phone: '051-222-2222' }] }, 'DELAYED');
  assert.ok(newer.requestRevision > older.requestRevision); advance(repo, newer, 'SUCCESS'); advance(repo, older, 'SUCCESS');
  assert.equal(read(repo, 'leads', seedIDs.lead).hospital_name, '최신 병원'); assert.equal(read(repo, 'leads', seedIDs.lead).phone, '051-222-2222');
  assert.equal(read(repo, 'accounts', seedIDs.pendingAccount).account_name, '최신 병원');
  assert.ok(repo.read().collections.leads.some(row => row.encrypted_provider_no === 'UNIQUE-OLDER-BATCH'));
});
test('H02 overlapping region batches cannot revert assignments on regions or leads', () => {
  const repo = repository(), region = { sido: '부산광역시', sigungu: '해운대구', ownerUserId: 2 };
  const older = enqueue(repo, 'IF-ERP-001', seedIDs.region, 'region-old', { regions: [region, { sido: '울산광역시', sigungu: '남구', ownerUserId: 2 }] }, 'DELAYED');
  const newer = enqueue(repo, 'IF-ERP-001', seedIDs.lead, 'region-new', { regions: [{ ...region, ownerUserId: 3 }] }, 'DELAYED');
  assert.ok(newer.requestRevision > older.requestRevision); advance(repo, newer, 'SUCCESS'); advance(repo, older, 'SUCCESS');
  assert.equal(read(repo, 'regions', seedIDs.region).assigned_user_id, 3); assert.equal(read(repo, 'leads', seedIDs.lead).owner_user_id, 3);
  assert.equal(repo.read().collections.regions.find(row => row.sido === '울산광역시').assigned_user_id, 2);
});
test('H02 direct-work requires approval and OUT; requests and results use separate codes', () => {
  const repo = repository(); rejects(() => enqueue(repo, 'IF-ERP-012', seedIDs.directWork), 'DIRECT_WORK_APPROVAL_AND_OUT_REQUIRED');
  repo.transact(d => { const dw = d.collections.directWorks[0]; dw.status = 'DIVISION_APPROVED'; d.collections.activities[0].status = 'COMPLETED'; d.collections.activities[0].out_at = d.clock; });
  const request = enqueue(repo, 'IF-ERP-012', seedIDs.directWork); advance(repo, request);
  assert.equal(read(repo, 'directWorks', seedIDs.directWork).erp_status, 'APPROVED');
  advance(repo, enqueue(repo, 'IF-ERP-013', seedIDs.directWork, 'dw-response')); assert.ok(read(repo, 'directWorks', seedIDs.directWork).erp_reference_no);
});
test('H02 request idempotency is payload-sensitive and preserves one request', () => {
  const repo = repository(), initialCount = repo.read().collections.interfaceLogs.length, one = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount, 'same');
  const two = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount, 'same'); assert.equal(two.requestId, one.requestId); assert.equal(repo.read().collections.interfaceLogs.length, initialCount + 1);
  rejects(() => enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount, 'same', { accountName: 'Changed' }), 'INTERFACE_IDEMPOTENCY_CONFLICT');
});
test('H02 duplicate response does not duplicate business data; conflicting ID fails', () => {
  const repo = repository(), request = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount); const response = result(request);
  repo.transact(d => applyInterfaceResult(d, actor, response)); const version = read(repo, 'accounts', seedIDs.pendingAccount).version;
  repo.transact(d => applyInterfaceResult(d, actor, response)); assert.equal(read(repo, 'accounts', seedIDs.pendingAccount).version, version);
  rejects(() => repo.transact(d => applyInterfaceResult(d, actor, { ...response, payload: { erpCustomerCode: 'WRONG' } })), 'INTERFACE_RESULT_ID_CONFLICT');
});
test('H02 failed request can retry; old late response cannot overwrite retry', () => {
  const repo = repository(), request = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount);
  advance(repo, request, 'TRANSIENT_FAILURE'); const retried = repo.transact(d => retryInterface(d, actor, request.requestId, 'retry-1'));
  assert.equal(retried.retryOf, request.requestId); assert.equal(retried.attempt, 2); advance(repo, retried);
  const good = read(repo, 'accounts', seedIDs.pendingAccount).erp_customer_code;
  repo.transact(d => applyInterfaceResult(d, actor, result(request, { resultId: 'late', version: 2, payload: { erpCustomerCode: 'WRONG-LATE' } })));
  assert.equal(read(repo, 'accounts', seedIDs.pendingAccount).erp_customer_code, good);
});
test('H02 scenarios delay, timeout, duplicate and out-of-order are deterministic', async t => {
  await t.test('delay', () => { const repo = repository(), request = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount, 'delayed', {}, 'DELAYED'); assert.equal(advance(repo, request).status, 'REQUESTING'); assert.equal(read(repo, 'accounts', seedIDs.pendingAccount).erp_approved_yn, false); assert.equal(advance(repo, request, 'SUCCESS').status, 'SUCCESS'); });
  await t.test('timeout', () => { const repo = repository(), request = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount); assert.equal(advance(repo, request, 'TIMEOUT').status, 'TIMED_OUT'); rejects(() => advance(repo, request), 'INTERFACE_RETRY_REQUIRED'); });
  await t.test('duplicate', () => { const repo = repository(), request = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount); const done = advance(repo, request, 'DUPLICATE'); assert.ok(done.events.some(event => event.kind === 'DUPLICATE')); });
  await t.test('out of order', () => { const repo = repository(), request = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount); const done = advance(repo, request, 'OUT_OF_ORDER'); assert.equal(done.resultVersion, 2); assert.ok(done.events.some(event => event.kind === 'STALE')); });
});
test('H02 result validates dataset, generation, company, business key, response code and exact fields', async t => {
  for (const [name, mutate, code] of [
    ['missing dataset', r => { const copy = { ...r }; delete copy.datasetId; return copy; }, 'INTERFACE_FIELD_REQUIRED'],
    ['wrong dataset', r => ({ ...r, datasetId: 'DIFFERENT-DATASET' }), 'INTERFACE_DATASET_MISMATCH'],
    ['generation', r => ({ ...r, generation: 9 }), 'INTERFACE_GENERATION_MISMATCH'],
    ['business key', r => ({ ...r, businessKey: { ...r.businessKey, entityId: seedIDs.approvedAccount } }), 'INTERFACE_BUSINESS_KEY_MISMATCH'],
    ['response code', r => ({ ...r, interfaceCode: 'IF-ERP-005' }), 'INTERFACE_RESPONSE_CODE_MISMATCH'],
    ['unknown payload field', r => ({ ...r, payload: { ...r.payload, company_id: 2 } }), 'INTERFACE_UNKNOWN_FIELD'],
    ['wrong identity', r => ({ ...r, payload: { ...r.payload, accountPublicId: seedIDs.otherCompanyAccount } }), 'INTERFACE_BUSINESS_KEY_MISMATCH'],
    ['invalid version', r => ({ ...r, version: -1 }), 'INTERFACE_VERSION_INVALID']
  ]) await t.test(name, () => { const repo = repository(), request = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount); const before = repo.read(); rejects(() => repo.transact(d => applyInterfaceResult(d, actor, mutate(result(request)))), code); assert.deepEqual(repo.read(), before); });
  await t.test('company', () => { const repo = repository(), request = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount); rejects(() => repo.transact(d => applyInterfaceResult(d, { ...actor, companyId: 2 }, result(request))), 'INTERFACE_REQUEST_NOT_FOUND'); });
});
test('H02 same-generation requests in two datasets cannot receive each other\'s results', () => {
  const one = repository({ datasetId: 'DATASET-A' }), two = repository({ datasetId: 'DATASET-B' });
  const requestOne = enqueue(one, 'IF-ERP-002', seedIDs.pendingAccount), requestTwo = enqueue(two, 'IF-ERP-002', seedIDs.pendingAccount);
  assert.equal(requestOne.requestId, requestTwo.requestId); assert.equal(requestOne.generation, requestTwo.generation);
  assert.deepEqual(requestOne.businessKey, requestTwo.businessKey);
  const beforeOne = one.read(), beforeTwo = two.read();
  rejects(() => two.transact(d => applyInterfaceResult(d, actor, result(requestOne))), 'INTERFACE_DATASET_MISMATCH');
  rejects(() => one.transact(d => applyInterfaceResult(d, actor, result(requestTwo))), 'INTERFACE_DATASET_MISMATCH');
  assert.deepEqual(one.read(), beforeOne); assert.deepEqual(two.read(), beforeTwo);
  one.transact(d => applyInterfaceResult(d, actor, result(requestOne)));
  assert.equal(read(one, 'accounts', seedIDs.pendingAccount).erp_approved_yn, true);
  assert.equal(read(two, 'accounts', seedIDs.pendingAccount).erp_approved_yn, false);
  const done = advance(two, requestTwo); assert.equal(done.result.datasetId, 'DATASET-B');
  assert.equal(read(two, 'accounts', seedIDs.pendingAccount).erp_approved_yn, true);
});
test('H02 persisted interface results must retain the request dataset identity', () => {
  const repo = repository(), request = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount); advance(repo, request);
  const corrupted = repo.read(); corrupted.collections.interfaceLogs[0].result.datasetId = 'OTHER';
  rejects(() => repository({ load: () => corrupted }), 'DATASET_INTERFACE_RESULT_INVALID');
});
test('H02 reset rejects results from the previous generation', () => {
  const repo = repository(), request = enqueue(repo, 'IF-ERP-002', seedIDs.pendingAccount); repo.reset();
  rejects(() => repo.transact(d => applyInterfaceResult(d, actor, result(request))), 'INTERFACE_GENERATION_MISMATCH');
});
test('H02 collection external keys deduplicate and versioned corrections update a single row', () => {
  const repo = repository(), payload = { rows: [{ erpCollectionNo: 'SAME', amount: 100, collectedAt: '2026-10-22', version: 1 }] };
  advance(repo, enqueue(repo, 'IF-ERP-009', seedIDs.approvedContract, 'collect1', payload));
  advance(repo, enqueue(repo, 'IF-ERP-009', seedIDs.approvedContract, 'collect2', payload)); assert.equal(repo.read().collections.collections.length, 1);
  const conflict = enqueue(repo, 'IF-ERP-009', seedIDs.approvedContract, 'collect3', { rows: [{ ...payload.rows[0], amount: 200 }] });
  rejects(() => advance(repo, conflict), 'INTERFACE_EVENT_VERSION_CONFLICT');
  advance(repo, enqueue(repo, 'IF-ERP-009', seedIDs.approvedContract, 'collect4', { rows: [{ ...payload.rows[0], amount: 300, version: 2 }] }));
  assert.equal(repo.read().collections.collections.length, 1); assert.equal(repo.read().collections.collections[0].amount, 300);
});
test('H02 rejected multi-row result rolls back preceding valid rows', () => {
  const repo = repository();
  advance(repo, enqueue(repo, 'IF-ERP-009', seedIDs.approvedContract, 'existing', { rows: [{ erpCollectionNo: 'FIXED', amount: 100, collectedAt: '2026-10-22' }] }));
  const request = enqueue(repo, 'IF-ERP-009', seedIDs.approvedContract, 'batch', { rows: [{ erpCollectionNo: 'NEW', amount: 50, collectedAt: '2026-10-22' }, { erpCollectionNo: 'FIXED', amount: 200, collectedAt: '2026-10-22' }] });
  const before = repo.read(); rejects(() => advance(repo, request), 'INTERFACE_EVENT_VERSION_CONFLICT'); assert.deepEqual(repo.read(), before);
});
test('H02 input isolation forbids cross-company entities, unknown interfaces and bad amounts', () => {
  const repo = repository();
  rejects(() => enqueue(repo, 'IF-ERP-002', seedIDs.otherCompanyAccount), 'INTERFACE_ENTITY_NOT_FOUND');
  rejects(() => repo.transact(d => enqueueInterface(d, actor, { interfaceCode: 'IF-UNKNOWN', entityType: 'ACCOUNT', entityPublicId: seedIDs.pendingAccount, idempotencyKey: 'x', payload: {} })), 'INTERFACE_NOT_REGISTERED');
  rejects(() => enqueue(repo, 'IF-ERP-009', seedIDs.approvedContract, 'bad', { rows: [{ erpCollectionNo: 'BAD', amount: -1, collectedAt: '2026-10-22' }] }), 'INTERFACE_NUMBER_INVALID');
});
