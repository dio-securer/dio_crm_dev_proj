// D07 / D08 (F2-7): editing the org chart or a profile so someone sees or does more is a widening; narrowing is clean.
const { test } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const { m, assert } = require('./helpers.cjs');

const repo = path.resolve(__dirname, '../..');
const read = rel => JSON.parse(fs.readFileSync(path.join(repo, 'metadata', rel), 'utf8'));
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(repo, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel); else files.push({ path: rel, content: fs.readFileSync(path.join(repo, rel), 'utf8') });
  }
})('metadata');
const base = m.bundleFromFiles(files).bundle;
const edit = fn => { const b = structuredClone(base); fn(b); return b; };
const chart = b => b.orgCharts.find(c => c.key === 'virtual_domestic_sales');
const profile = (b, key) => b.profiles.find(p => p.key === key);
const codes = head => m.diffBundles(base, head).map(i => `${i.code} ${i.path}`);

test('the repository settings load and compare clean against themselves', () => {
  assert.ok(base && chart(base));
  assert.ok(read('security/profiles.json').items.length > 0);
  assert.deepEqual(codes(base), []);
});

test('D07: moving v-sales-jongno-1 into br_gangnam widens the gangnam head', () => {
  const head = edit(b => { chart(b).members.find(x => x.userId === 'v-sales-jongno-1').unitId = 'br_gangnam'; });
  assert.ok(codes(head).includes('D07_ORG_WIDENED orgCharts[virtual_domestic_sales]/users[v-br-gangnam-head]'), codes(head).join('\n'));
});

test('D07: making v-sales-gangnam-1 head of br_jongno is caught', () => {
  const head = edit(b => { chart(b).units.find(u => u.id === 'br_jongno').headUserId = 'v-sales-gangnam-1'; });
  assert.ok(codes(head).includes('D07_ORG_WIDENED orgCharts[virtual_domestic_sales]/users[v-sales-gangnam-1]'));
});

test('D08: adding the role ANYONE to the sales profile is caught', () => {
  const head = edit(b => { profile(b, 'sales').roles.push('ANYONE'); });
  assert.deepEqual(codes(head), ['D08_GRANT_WIDENED profiles/roles[ANYONE]']);
});

test('D08: a new grant, a new set on a profile, and a removed restriction are caught', () => {
  assert.deepEqual(codes(edit(b => { b.permissionSets.find(s => s.key === 'lead_sales').objects.lead.delete = true; })), ['D08_GRANT_WIDENED profiles/roles[SALES_REP]']);
  assert.deepEqual(codes(edit(b => { profile(b, 'sales').permissionSets.push('lead_manager'); })), ['D08_GRANT_WIDENED profiles/roles[SALES_REP]']);
  const restricted = edit(b => { b.permissionSets.push({ key: 'no_edit', name: 'n', objects: { lead: { edit: true } }, fields: {} }); profile(b, 'sales').restrictions.push('no_edit'); });
  assert.deepEqual(m.diffBundles(restricted, base).map(i => i.code), ['D08_GRANT_WIDENED']);
});

test('narrowing is clean: removing a member, a head, a role, a grant, or adding a restriction', () => {
  assert.deepEqual(codes(edit(b => { chart(b).members = chart(b).members.filter(x => x.userId !== 'v-sales-jongno-1'); })), []);
  assert.deepEqual(codes(edit(b => { delete chart(b).units.find(u => u.id === 'reg_cap').headUserId; })), []);
  assert.deepEqual(codes(edit(b => { profile(b, 'manager').roles = ['HQ_MANAGER']; })), []);
  assert.deepEqual(codes(edit(b => { delete b.permissionSets.find(s => s.key === 'lead_manager').objects.lead.delete; })), []);
  assert.deepEqual(codes(edit(b => { b.permissionSets.push({ key: 'no_edit', name: 'n', objects: { lead: { edit: true } }, fields: {} }); profile(b, 'sales').restrictions.push('no_edit'); })), []);
  // Moving a salesperson to another branch widens the new head only, never the old one.
  const moved = codes(edit(b => { chart(b).members.find(x => x.userId === 'v-sales-jongno-1').unitId = 'br_gangnam'; }));
  assert.ok(!moved.some(c => c.includes('v-br-jongno-head')));
});

test('no profiles file before narrows nothing, so the first profiles are not a widening; a first chart is', () => {
  const noProfiles = edit(b => { delete b.profiles; });
  assert.deepEqual(m.diffBundles(noProfiles, base).map(i => i.code), []);
  const noChart = edit(b => { b.orgCharts = []; });
  const first = m.diffBundles(noChart, base).map(i => `${i.code} ${i.path}`);
  assert.ok(first.includes('D07_ORG_WIDENED orgCharts[virtual_domestic_sales]/users[v-br-gangnam-head]'), first.join('\n'));
});

test('abuse 1: deleting the profiles file is D08; an empty profiles list is a declaration that denies, not a widening', () => {
  assert.deepEqual(codes(edit(b => { delete b.profiles; })), ['D08_GRANT_WIDENED profiles']);
  assert.deepEqual(codes(edit(b => { b.profiles = []; })), []);
  const files = m.filesFromBundle(edit(b => { b.profiles = []; }));
  const back = m.bundleFromFiles(files).bundle;
  assert.deepEqual(back.profiles, []);
  assert.equal(m.bundleFromFiles(files.filter(f => !f.path.endsWith('profiles.json'))).bundle.profiles, undefined);
});

test('abuse 2: deleting a chart and re-adding it widened is caught on the re-add', () => {
  const gone = edit(b => { b.orgCharts = []; });
  assert.deepEqual(m.diffBundles(base, gone).map(i => i.code), []);
  const widened = edit(b => { chart(b).members.find(x => x.userId === 'v-sales-jongno-1').unitId = 'br_gangnam'; });
  const back = m.diffBundles(gone, widened).map(i => `${i.code} ${i.path}`);
  assert.ok(back.includes('D07_ORG_WIDENED orgCharts[virtual_domestic_sales]/users[v-br-gangnam-head]'));
});

test('abuse 3: moving a chart to another company is a removal plus a widened add for that company', () => {
  const moved = codes(edit(b => { chart(b).companyId = 1; }));
  assert.ok(moved.includes('D07_ORG_WIDENED orgCharts[virtual_domestic_sales]/users[v-br-gangnam-head]'), moved.join('\n'));
});

test('D07 / D08 carry structured data (chart, company, user or role, gained list), not only a message', () => {
  const moved = edit(b => { chart(b).members.find(x => x.userId === 'v-sales-jongno-1').unitId = 'br_gangnam'; });
  const d07 = m.diffBundles(base, moved).find(i => i.code === 'D07_ORG_WIDENED' && i.path.endsWith('[v-br-gangnam-head]'));
  assert.deepEqual(d07.data, { chart: 'virtual_domestic_sales', companyId: -1, user: 'v-br-gangnam-head', gained: ['v-sales-jongno-1'] });
  const role = edit(b => { profile(b, 'sales').roles.push('ANYONE'); });
  const d08 = m.diffBundles(base, role).find(i => i.code === 'D08_GRANT_WIDENED');
  assert.equal(d08.data.role, 'ANYONE');
  assert.ok(Array.isArray(d08.data.gained) && d08.data.gained.length > 0);
});

test('org ids and role names with brackets, commas or spaces are rejected by validation', () => {
  const withFile = (rel, change) => files.map(f => {
    if (f.path !== `metadata/${rel}`) return f;
    const v = JSON.parse(f.content); change(v); return { path: f.path, content: JSON.stringify(v) };
  });
  const ORG = 'security/org/virtual_domestic_sales.json';
  for (const bad of ['zz(evil', 'a)b', 'a, b', 'a b', 'a[b]', '한글']) {
    for (const list of [
      withFile(ORG, v => { v.members.push({ userId: bad, unitId: 'br_gangnam' }); }),
      withFile(ORG, v => { v.units[0].headUserId = bad; }),
      withFile(ORG, v => { v.units.push({ id: bad, name: 'x', parentId: v.units[0].id }); }),
      withFile('security/profiles.json', v => { v.items[0].roles.push(bad); }),
    ]) {
      const out = m.bundleFromFiles(list);
      const issues = out.bundle ? [...out.issues, ...m.validateBundle(out.bundle)] : out.issues;
      assert.ok(issues.some(i => i.severity === 'error'), bad);
    }
  }
});
