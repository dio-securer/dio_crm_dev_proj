// Metadata versions over the memory store: transitions, publish checks, rollback, atomicity.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MetadataVersions, memoryVersionStore, nextStatus, TRANSITIONS, VersionError } = require('../dist');
const { readMetadata, editJson } = require('./metadata-files.cjs');

const ACCESS = 'metadata/objects/lead/access.json';
function setup() {
  let n = 0;
  const store = memoryVersionStore();
  return { store, svc: new MetadataVersions(store, () => `2026-11-28T00:00:${String(n++).padStart(2, '0')}Z`) };
}
const rejects = (p, code) => assert.rejects(p, e => e instanceof VersionError && e.code === code);
const relabel = text => editJson(readMetadata(), 'metadata/terms/en-US/lead.json', d => { d['lead.label'] = text; });

test('the transition table is exactly the agreed list', () => {
  const pairs = Object.entries(TRANSITIONS).flatMap(([a, m]) => Object.entries(m).map(([f, t]) => `${a}:${f}->${t}`)).sort();
  assert.deepEqual(pairs, ['discard:staging->discarded', 'publish:staging->published', 'restore:superseded->published', 'rollback:published->rolled_back', 'supersede:published->superseded']);
});

test('the transition table: only listed moves are allowed', () => {
  assert.equal(nextStatus('publish', 'staging'), 'published');
  assert.equal(nextStatus('restore', 'superseded'), 'published');
  const statuses = ['staging', 'published', 'superseded', 'rolled_back', 'discarded'];
  for (const action of Object.keys(TRANSITIONS)) for (const s of statuses) {
    if (TRANSITIONS[action][s]) continue;
    assert.throws(() => nextStatus(action, s), e => e.code === 'BAD_STATE', `${action} ${s}`);
  }
  for (const s of ['rolled_back', 'discarded']) assert.ok(Object.values(TRANSITIONS).every(t => !t[s]), `${s} is final`);
});

test('stage -> publish -> publish -> rollback -> rollback', async () => {
  const { store, svc } = setup();
  assert.equal(await svc.published(), undefined);
  const v1 = await svc.stage(readMetadata(), 'owner');
  assert.equal((await svc.publish(v1, 'owner')).status, 'published');
  const v2 = await svc.stage(relabel('Prospect'), 'owner', 'rename');
  const p2 = await svc.publish(v2, 'owner');
  assert.equal(p2.previousId, v1);
  assert.equal(store.snapshot().versions.find(v => v.id === v1).status, 'superseded');
  const back = await svc.rollback('owner');
  assert.equal(back.id, v1);
  assert.equal((await svc.published()).id, v1);
  assert.equal(store.snapshot().versions.find(v => v.id === v2).status, 'rolled_back');
  assert.equal(store.snapshot().versions.find(v => v.id === v1).status, 'published');
  assert.equal(back.status, 'published');
  await rejects(svc.rollback('owner'), 'NO_PREVIOUS');
  assert.deepEqual(store.snapshot().events.map(e => `${e.action}:${e.versionId}`),
    ['stage:1', 'publish:1', 'stage:2', 'supersede:1', 'publish:2', 'rollback:2', 'restore:1']);
  await rejects(svc.publish(v2, 'owner'), 'BAD_STATE');
});

test('rollback with nothing published, unknown ids, discard', async () => {
  const { store, svc } = setup();
  await rejects(svc.rollback('owner'), 'NO_PUBLISHED');
  await rejects(svc.publish(99, 'owner'), 'NOT_FOUND');
  const v = await svc.stage(readMetadata(), 'owner');
  await svc.discard(v, 'owner');
  await rejects(svc.publish(v, 'owner'), 'BAD_STATE');
  assert.deepEqual(store.snapshot().events.map(e => `${e.action}:${e.versionId}:${e.actor}`), ['stage:1:owner', 'discard:1:owner']);
  await rejects(svc.discard(v, 'owner'), 'BAD_STATE');
});

test('publish refuses invalid metadata and changes nothing', async () => {
  const { store, svc } = setup();
  const bad = await svc.stage(editJson(readMetadata(), ACCESS, d => { d.rules = [{ kind: 'own', ownerField: 'no_such' }]; }), 'owner');
  const before = store.snapshot();
  await assert.rejects(svc.publish(bad, 'owner'), e => e.code === 'INVALID_METADATA' && e.issues.some(i => i.code === 'R02_UNKNOWN_FIELD'));
  assert.deepEqual(store.snapshot(), before);
});

test('publish refuses a change that widens row access or removes a field, and keeps the published version', async () => {
  const { store, svc } = setup();
  const v1 = await svc.publish(await svc.stage(readMetadata(), 'owner'), 'owner');
  const wide = await svc.stage(editJson(readMetadata(), ACCESS, d => { d.rules = [{ kind: 'all' }]; }), 'owner');
  await assert.rejects(svc.publish(wide, 'owner'), e => e.code === 'INCOMPATIBLE' && e.issues.some(i => i.code === 'D05_ACCESS_WIDENED'));
  const before = store.snapshot();
  assert.equal(before.pointer, v1.id);
  assert.equal(before.versions.find(v => v.id === v1.id).status, 'published');
  assert.equal(before.versions.find(v => v.id === wide).status, 'staging');
  const narrow = await svc.stage(editJson(readMetadata(), ACCESS, d => { d.rules = [d.rules[0]]; }), 'owner');
  assert.equal((await svc.publish(narrow, 'owner')).status, 'published');
});

test('a failure inside a transaction leaves the store as it was', async () => {
  const store = memoryVersionStore();
  const svc = new MetadataVersions(store, () => 'T');
  await svc.publish(await svc.stage(readMetadata(), 'owner'), 'owner');
  const before = store.snapshot();
  await assert.rejects(store.transaction(async tx => { await tx.setPointer(undefined); await tx.insert({ status: 'staging', files: [], createdBy: 'x', createdAt: 'T' }); throw new Error('boom'); }));
  assert.deepEqual(store.snapshot(), before);
});

test('concurrent publishes of two staged versions: one wins, the other supersedes it in order', async () => {
  const { store, svc } = setup();
  const a = await svc.stage(readMetadata(), 'a'), b = await svc.stage(relabel('Prospect'), 'b');
  await Promise.all([svc.publish(a, 'a'), svc.publish(b, 'b')]);
  const snap = store.snapshot();
  assert.equal(snap.pointer, b);
  assert.equal(snap.versions.find(v => v.id === b).previousId, a);
  assert.equal(snap.versions.filter(v => v.status === 'published').length, 1);
});

test('every read-then-write operation locks the pointer first', async () => {
  const store = memoryVersionStore(), calls = [];
  const spy = { transaction: work => store.transaction(tx => work(new Proxy(tx, { get: (t, k) => (...a) => { calls.push(k); return t[k](...a); } }))) };
  const svc = new MetadataVersions(spy, () => 'T');
  const firstCall = async fn => { calls.length = 0; await fn(); return calls[0]; };
  const a = await svc.stage(readMetadata(), 'o'), b = await svc.stage(readMetadata(), 'o');
  assert.equal(await firstCall(() => svc.discard(a, 'o')), 'lockPointer');
  assert.equal(await firstCall(() => svc.publish(b, 'o')), 'lockPointer');
  assert.equal(await firstCall(() => svc.published()), 'lockPointer');
});

test('warnings do not block publish', async () => {
  const { svc } = setup();
  let files = editJson(readMetadata(), 'metadata/objects/lead/fields.json', d => { d.fields.find(x => x.key === 'owner_name').aliases = ['owner']; });
  files = editJson(files, ACCESS, d => { d.rules = [{ kind: 'own', ownerField: 'owner' }]; });
  assert.equal((await svc.publish(await svc.stage(files, 'o'), 'o')).status, 'published');
});

test('the service path: lead published without access.json is closed, so adding rules is refused (D05)', async () => {
  const { svc } = setup();
  await svc.publish(await svc.stage(readMetadata().filter(f => f.path !== ACCESS), 'o'), 'o');
  await assert.rejects(svc.publish(await svc.stage(readMetadata(), 'o'), 'o'), e => e.code === 'INCOMPATIBLE' && e.issues.some(i => i.code === 'D05_ACCESS_WIDENED'));
});
