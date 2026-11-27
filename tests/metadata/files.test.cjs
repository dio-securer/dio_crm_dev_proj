// bundleFromFiles / filesFromBundle: the on-disk layout of metadata/.
const { test } = require('node:test');
const { m, bundle, variant, obj, assert } = require('./helpers.cjs');
const canonicalFiles = () => m.filesFromBundle(bundle());
const load = files => m.bundleFromFiles(files);
const codesOf = files => load(files).issues.map(i => `${i.code} ${i.path}`);

test('the fixture is written as the documented files', () => {
  const paths = canonicalFiles().map(f => f.path);
  for (const p of ['metadata/menu.json', 'metadata/features.json', 'metadata/deprecations.json', 'metadata/codes/lead_status.json',
    'metadata/terms/semantic.json', 'metadata/terms/ko-KR/lead.json', 'metadata/terms/en-US/menu.json',
    'metadata/objects/lead/object.json', 'metadata/objects/lead/fields.json', 'metadata/objects/lead/screens/create.json',
    'metadata/objects/lead/list-views.json', 'metadata/objects/lead/actions.json', 'metadata/objects/lead/rules.json', 'metadata/objects/lead/workflow.json',
    'metadata/overlays/COMPANY/10000000-0000-4000-8000-000000000002/MENU.json', 'metadata/overlays/COUNTRY/HQ~KR/LIST_VIEW.lead.json',
    'metadata/overlays/TEMPLATE/HQ/FIELD.lead.detail.json']) assert.ok(paths.includes(p), p);
  assert.deepEqual(paths, [...paths].sort());
});

test('round trip is byte-stable and the loaded bundle is clean', () => {
  const files = canonicalFiles();
  const loaded = load(files);
  assert.deepEqual(loaded.issues, []);
  assert.deepEqual(m.filesFromBundle(loaded.bundle), files);
  assert.deepEqual(m.validateBundle(loaded.bundle), []);
  for (const f of files) assert.ok(f.content.endsWith('\n') && f.content.includes('\n  '), f.path);
  const shuffled = [...files].reverse();
  assert.deepEqual(m.filesFromBundle(load(shuffled).bundle), files);
});

test('every file written for the fixture is within 300 lines and 15000 bytes', () => {
  for (const f of canonicalFiles()) {
    assert.ok(m.lineCount(f.content) <= 300, f.path);
    assert.ok(m.byteCount(f.content) <= 15000, f.path);
  }
});

test('many fields are split into fields/NN.json chunks within the limits, and read back the same', () => {
  const big = variant(b => { for (let i = 0; i < 120; i += 1) obj(b, 'account').object.fields.push({ key: `extra_${String(i).padStart(3, '0')}`, type: 'text', labelKey: 'account.name', maxLength: 10 }); });
  const files = m.filesFromBundle(big);
  const chunks = files.filter(f => f.path.startsWith('metadata/objects/account/fields/'));
  assert.ok(chunks.length >= 2);
  assert.equal(files.some(f => f.path === 'metadata/objects/account/fields.json'), false);
  for (const f of chunks) assert.ok(m.fitsLimits(f.content), f.path);
  const loaded = load(files);
  assert.deepEqual(loaded.issues, []);
  assert.deepEqual(m.filesFromBundle(loaded.bundle), files);
});

test('unknown and misplaced files are rejected', () => {
  const add = (path, content) => [...canonicalFiles(), { path, content }];
  assert.deepEqual(codesOf(add('metadata/objects/lead/notes.json', '{}\n')), ['F01_UNKNOWN_FILE metadata/objects/lead/notes.json']);
  assert.deepEqual(codesOf(add('metadata/scripts/run.js', '1')), ['F01_UNKNOWN_FILE metadata/scripts/run.js']);
  assert.deepEqual(codesOf(add('other/menu.json', '{}')), ['F01_UNKNOWN_FILE other/menu.json']);
  assert.deepEqual(codesOf(add('metadata/objects/lead/x.yaml', 'a: 1')), ['F01_UNKNOWN_FILE metadata/objects/lead/x.yaml']);
  assert.deepEqual(codesOf(add('metadata/objects/lead/screens/broken.json', '{')), ['F03_INVALID_JSON metadata/objects/lead/screens/broken.json']);
  const moved = canonicalFiles().map(f => (f.path === 'metadata/objects/lead/screens/create.json' ? { ...f, path: 'metadata/objects/lead/screens/new.json' } : f));
  assert.deepEqual(codesOf(moved), ['F02_MISPLACED_FILE metadata/objects/lead/screens/new.json']);
  const wrongDir = canonicalFiles().map(f => (f.path === 'metadata/codes/lead_status.json' ? { ...f, path: 'metadata/codes/status.json' } : f));
  assert.deepEqual(codesOf(wrongDir), ['F02_MISPLACED_FILE metadata/codes/status.json']);
  assert.deepEqual(codesOf(add('metadata/terms/ko-KR/menu.json', '{"lead.extra": "x"}\n')).map(c => c.split(' ')[0]), ['F02_MISPLACED_FILE']);
  assert.deepEqual(codesOf(add('metadata/terms/fr-FR/menu.json', '{"menu.x": "x"}\n')), ['F02_MISPLACED_FILE metadata/terms/fr-FR/menu.json']);
  assert.deepEqual(codesOf(add('metadata/overlays/REGION/EU/MENU.json', '{"overrides": []}\n')), ['F02_MISPLACED_FILE metadata/overlays/REGION/EU/MENU.json']);
  const noObject = canonicalFiles().filter(f => f.path !== 'metadata/objects/lead/object.json');
  assert.deepEqual(codesOf(noObject), ['F02_MISPLACED_FILE metadata/objects/lead/object.json']);
  assert.deepEqual(codesOf(add('metadata/objects/lead/fields/01.json', '{"fields": []}\n')), ['F02_MISPLACED_FILE metadata/objects/lead/fields.json']);
  assert.deepEqual(codesOf(add('metadata/README.md', '# x')), []);
  assert.deepEqual(codesOf(add('metadata/objects/.gitkeep', '')), []);
});

test('a file over the size limits is reported, and a file content that breaks the schema gives M01', () => {
  const huge = JSON.stringify({ fields: [] }, null, 2) + '\n'.repeat(400);
  assert.ok(codesOf(canonicalFiles().map(f => (f.path === 'metadata/objects/lead/fields.json' ? { ...f, content: huge } : f))).includes('F04_TOO_LARGE metadata/objects/lead/fields.json'));
  const bad = canonicalFiles().map(f => (f.path === 'metadata/menu.json' ? { ...f, content: '{"nodes": [{"id": 1}]}\n' } : f));
  assert.ok(codesOf(bad).every(c => c.startsWith('M01_SCHEMA_INVALID metadata/menu.json#')));
});

test('filesFromBundle refuses a key that would leave its folder', () => {
  assert.throws(() => m.filesFromBundle(variant(b => { obj(b, 'lead').screens[0].screen.screenKey = '../x'; })), /UNSAFE_FILE_NAME/);
});
