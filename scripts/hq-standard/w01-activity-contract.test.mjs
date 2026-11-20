import test from 'node:test';
import assert from 'node:assert/strict';
import { HqRepository } from './runtime.mjs';

test('a direct-work record with a valid same-company activity remains writable', () => {
  const repository = new HqRepository({ datasetId: 'W01_VALID_REF' });
  const before = repository.read();
  const direct = before.collections.directWorks[0];
  const activity = before.collections.activities.find(row => row.public_id === direct.activity_public_id);
  assert.ok(activity);
  assert.equal(activity.company_id, direct.company_id);
  repository.transact(draft => { draft.collections.directWorks[0].reason = 'valid reference'; });
  const saved = repository.read().collections.directWorks[0];
  assert.equal(saved.activity_public_id, activity.public_id);
  assert.equal(saved.reason, 'valid reference');
});

test('a direct-work record cannot point to an activity in another company and the failed transaction leaves the dataset unchanged', () => {
  const repository = new HqRepository({ datasetId: 'W01_DIRECT_REF' });
  const otherAccountId = 'f0000000-0000-4000-8000-000000000001';
  const otherActivityId = 'f0000000-0000-4000-8000-000000000002';
  repository.transact(draft => {
    const original = draft.collections.activities[0];
    const customer = draft.collections.accounts.find(row => row.public_id === original.related_public_id);
    assert.ok(customer);
    draft.collections.accounts.push({ ...customer, public_id: otherAccountId, company_id: 999 });
    draft.collections.activities.push({ ...original, public_id: otherActivityId, company_id: 999, related_public_id: otherAccountId });
  });
  const before = repository.read();
  assert.ok(before.collections.directWorks.length > 0);
  assert.equal(before.collections.activities.find(row => row.public_id === otherActivityId)?.company_id, 999);
  assert.throws(() => repository.transact(draft => {
    draft.collections.directWorks[0].activity_public_id = otherActivityId;
  }), error => error.code === 'DATASET_REFERENCE_INVALID');
  assert.deepEqual(repository.read(), before);
});

test('an activity cannot reference a missing customer and the failed transaction is rolled back', () => {
  const repository = new HqRepository({ datasetId: 'W01_ACTIVITY_REF' });
  const before = repository.read();
  assert.ok(before.collections.activities.length > 0);
  assert.throws(() => repository.transact(draft => {
    draft.collections.activities[0].related_public_id = 'f0000000-0000-4000-8000-000000000001';
  }), error => error.code === 'DATASET_REFERENCE_INVALID');
  assert.deepEqual(repository.read(), before);
});

test.todo('report snapshot activity references: decide retention and legacy-data migration before enforcing same-company live references');
