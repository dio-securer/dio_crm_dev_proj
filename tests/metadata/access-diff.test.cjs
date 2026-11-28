// diffBundles D05: widening row access is an error; narrowing, keeping and first definition are clean.
const { test } = require('node:test');
const { m, variant, obj, field, assert } = require('./helpers.cjs');
const withRules = rules => variant(b => { obj(b, 'lead').access = { entity: 'lead', rules }; });
const codes = (base, head) => m.diffBundles(base, head).map(i => `${i.code} ${i.path}`);
const own = { kind: 'own', ownerField: 'name' };
const W = i => `D05_ACCESS_WIDENED objects[lead]/access/rules[#${i}]`;
const MERGED = key => `D06_ALIAS_MERGES_FIELDS objects[lead]/object/fields[${key}]/aliases`;
const GONE = key => `D01_REMOVED_WITHOUT_DEPRECATION objects[lead]/object/fields[${key}]`;

test('own -> all, adding a rule, changing the field or kind, dropping a permission are widenings', () => {
  assert.deepEqual(codes(withRules([own]), withRules([{ kind: 'all' }])), [W(0)]);
  assert.deepEqual(codes(withRules([own]), withRules([own, { kind: 'members', ownerField: 'name' }])), [W(1)]);
  assert.deepEqual(codes(withRules([own]), withRules([{ kind: 'own', ownerField: 'phone' }])), [W(0)]);
  assert.deepEqual(codes(withRules([own]), withRules([{ kind: 'unit', unitField: 'name' }])), [W(0)]);
  assert.deepEqual(codes(withRules([{ kind: 'all', permission: 'company.manage' }]), withRules([{ kind: 'all' }])), [W(0)]);
  assert.deepEqual(codes(withRules([{ kind: 'all', permission: 'company.manage' }]), withRules([{ kind: 'all', permission: 'account.read' }])), [W(0)]);
  assert.deepEqual(codes(withRules([{ kind: 'none' }]), withRules([own])), [W(0)]);
});

test('keeping, narrowing, adding a permission, none, and removing access.json are clean', () => {
  assert.deepEqual(codes(withRules([own]), withRules([own])), []);
  assert.deepEqual(codes(withRules([own, { kind: 'all', permission: 'company.manage' }]), withRules([own])), []);
  assert.deepEqual(codes(withRules([own]), withRules([{ ...own, permission: 'account.read' }])), []);
  assert.deepEqual(codes(withRules([{ kind: 'all' }]), withRules([own, { kind: 'unit', unitField: 'company_name' }])), []);
  assert.deepEqual(codes(withRules([{ kind: 'all', permission: 'company.manage' }]), withRules([{ ...own, permission: 'company.manage' }])), []);
  assert.deepEqual(codes(withRules([own]), withRules([{ kind: 'none' }])), []);
  assert.deepEqual(codes(withRules([own]), variant(() => {})), []);
});

test('an existing object without access.json was closed: a first rule set is a widening, none is not', () => {
  assert.deepEqual(codes(variant(() => {}), withRules([{ kind: 'all' }])), [W(0)]);
  assert.deepEqual(codes(variant(() => {}), withRules([own])), [W(0)]);
  assert.deepEqual(codes(variant(() => {}), withRules([{ kind: 'none' }])), []);
});

test('two steps, delete access.json then re-add it as all, are each judged: the second is a widening', () => {
  const step1 = variant(() => {});
  assert.deepEqual(codes(withRules([own]), step1), []);
  assert.deepEqual(codes(step1, withRules([{ kind: 'all' }])), [W(0)]);
});

test('a new object (absent from the base) is a new definition, not compared', () => {
  const head = variant(b => { b.objects.push({ object: { key: 'contact', labelKey: 'lead.label', pluralLabelKey: 'lead.plural', fields: [] }, access: { entity: 'contact', rules: [{ kind: 'all' }] } }); });
  assert.deepEqual(codes(variant(() => {}), head), []);
});

test('changing the ownerField of a members rule is a widening', () => {
  const members = f => ({ kind: 'members', ownerField: f });
  assert.deepEqual(codes(withRules([members('name')]), withRules([members('phone')])), [W(0)]);
});

test('renaming the owner field and keeping the old name as an alias is not a widening; another field under the new name is', () => {
  const rename = rule => variant(b => { const f = field(b, 'lead', 'name'); f.key = 'title'; f.aliases = ['name']; obj(b, 'lead').access = { entity: 'lead', rules: [rule] }; });
  assert.deepEqual(codes(withRules([own]), rename(own)).filter(c => c.startsWith('D05')), []);
  assert.deepEqual(codes(withRules([own]), rename({ kind: 'own', ownerField: 'title' })).filter(c => c.startsWith('D05')), []);
  assert.deepEqual(codes(withRules([own]), rename({ kind: 'own', ownerField: 'phone' })).filter(c => c.startsWith('D05')), [W(0)]);
  assert.deepEqual(codes(withRules([own]), rename({ kind: 'members', ownerField: 'title' })).filter(c => c.startsWith('D05')), [W(0)]);
  // The alias dropped: the head's "name" is no longer known to be the base's field.
  const dropped = variant(b => { const f = field(b, 'lead', 'name'); f.key = 'title'; obj(b, 'lead').access = { entity: 'lead', rules: [{ kind: 'own', ownerField: 'title' }] }; });
  assert.deepEqual(codes(withRules([own]), dropped).filter(c => c.startsWith('D05')), [W(0)]);
});

test('an existing field that takes the removed owner field\'s name as an alias is another field: D05, and the removal is D01', () => {
  // base: own(name). head: field `name` removed, the existing field `phone` gets aliases ['name']. Ownership would move from name's column to phone's.
  const steal = rule => variant(b => {
    const o = obj(b, 'lead').object; o.fields = o.fields.filter(f => f.key !== 'name');
    field(b, 'lead', 'phone').aliases = ['name'];
    for (const s of obj(b, 'lead').screens) s.fields.fields = s.fields.fields.filter(f => f.key !== 'name');
    obj(b, 'lead').access = { entity: 'lead', rules: [rule] };
  });
  const REMOVED = 'D01_REMOVED_WITHOUT_DEPRECATION objects[lead]/object/fields[name]';
  for (const rule of [own, { kind: 'own', ownerField: 'phone' }]) {
    const found = codes(withRules([own]), steal(rule));
    assert.ok(found.includes(W(0)), `no D05 for ${rule.ownerField}: ${found}`);
    assert.ok(found.includes(REMOVED), `no D01 for ${rule.ownerField}: ${found}`);
    assert.ok(!found.some(c => c.startsWith('D03')), `followed as a rename: ${found}`);
  }
  // Even when the old field was deprecated first (its removal is allowed), the rule does not follow the name to phone.
  const deprecatedBase = variant(b => { field(b, 'lead', 'name').deprecated = { since: '2026-01-01' }; obj(b, 'lead').access = { entity: 'lead', rules: [own] }; });
  assert.deepEqual(codes(deprecatedBase, steal(own)), [W(0), MERGED('phone')]);
  // A head field whose key was an alias in the base is not "new" either.
  const aliasBase = variant(b => { field(b, 'lead', 'phone').aliases = ['tel']; obj(b, 'lead').access = { entity: 'lead', rules: [own] }; });
  const viaAlias = variant(b => {
    const o = obj(b, 'lead').object; o.fields = o.fields.filter(f => f.key !== 'name');
    const p = field(b, 'lead', 'phone'); p.key = 'tel'; p.aliases = ['phone', 'name'];
    for (const s of obj(b, 'lead').screens) s.fields.fields = s.fields.fields.filter(f => f.key !== 'name');
    obj(b, 'lead').access = { entity: 'lead', rules: [own] };
  });
  assert.ok(codes(aliasBase, viaAlias).includes(W(0)));
  // Two new fields both claiming the old name: neither is followed.
  const twice = variant(b => {
    const o = obj(b, 'lead').object, f = field(b, 'lead', 'name'); f.key = 'title'; f.aliases = ['name'];
    o.fields.push({ ...f, key: 'title2', aliases: ['name'] });
    obj(b, 'lead').access = { entity: 'lead', rules: [{ kind: 'own', ownerField: 'title' }] };
  });
  assert.ok(codes(withRules([own]), twice).includes(W(0)));
});

test('a renamed field that also takes a removed field\'s name merges two fields: D06, D01 for the absorbed one, D05 for every rule kind', () => {
  // base: rule on `name`. head: `name` deleted; phone renamed to tel2 with aliases ['phone', 'name']. The storage would
  // give tel2 the column of phone (first recorded name), so a rule that follows `name` would read phone's values.
  const merge = rule => variant(b => {
    const o = obj(b, 'lead').object; o.fields = o.fields.filter(f => f.key !== 'name');
    const p = field(b, 'lead', 'phone'); p.key = 'tel2'; p.aliases = ['phone', 'name'];
    for (const s of obj(b, 'lead').screens) s.fields.fields = s.fields.fields.filter(f => f.key !== 'name');
    obj(b, 'lead').access = { entity: 'lead', rules: [rule] };
  });
  const kinds = { own: n => ({ kind: 'own', ownerField: n }), members: n => ({ kind: 'members', ownerField: n }), unit: n => ({ kind: 'unit', unitField: n }) };
  for (const [kind, make] of Object.entries(kinds)) {
    for (const named of ['tel2', 'name', 'phone']) {
      const found = codes(withRules([make('name')]), merge(make(named)));
      assert.deepEqual(found.filter(c => !c.startsWith('D04')), [W(0), GONE('name'), GONE('phone'), MERGED('tel2')], `${kind} on ${named}: ${found}`);
    }
    // The other way round (aliases ['name', 'phone']) is the same merge.
    const swapped = merge(make('tel2')); field(swapped, 'lead', 'tel2').aliases = ['name', 'phone'];
    assert.ok(codes(withRules([make('name')]), swapped).includes(W(0)), kind);
    // And the rule that was on phone does not follow either: a merged field continues nothing.
    assert.ok(codes(withRules([make('phone')]), merge(make('tel2'))).includes(W(0)), kind);
  }
  assert.deepEqual(m.validateBundle(merge(kinds.own('tel2'))).filter(i => i.severity === 'error' && i.code !== 'R09_REPLACED_BY_MISSING').map(i => i.code), [], 'the head alone is a valid bundle: only the diff can see the merge');
});

test('alias chains: a field renamed twice is still the same field; a chain that ends in another field is not', () => {
  // base: title (once called name) with the rule on it, written by its old name.
  const chained = rule => variant(b => { const f = field(b, 'lead', 'name'); f.key = 'title'; f.aliases = ['name']; obj(b, 'lead').access = { entity: 'lead', rules: [rule] }; });
  const again = (aliases, rule) => variant(b => { const f = field(b, 'lead', 'name'); f.key = 'subject'; f.aliases = aliases; obj(b, 'lead').access = { entity: 'lead', rules: [rule] }; });
  const d05 = (base, head) => codes(base, head).filter(c => c.startsWith('D05') || c.startsWith('D06') || c.startsWith('D01'));
  for (const baseRule of [own, { kind: 'own', ownerField: 'title' }]) {
    for (const headName of ['subject', 'title', 'name']) assert.deepEqual(d05(chained(baseRule), again(['title', 'name'], { kind: 'own', ownerField: headName })), [], `${baseRule.ownerField} -> ${headName}`);
    assert.deepEqual(d05(chained(baseRule), again(['title'], { kind: 'own', ownerField: 'subject' })), []);
    assert.deepEqual(d05(chained(baseRule), again(['name'], { kind: 'own', ownerField: 'subject' })), []);
    // The chain broken (no old name kept): the field is gone and the rule is on something new.
    assert.ok(d05(chained(baseRule), again([], { kind: 'own', ownerField: 'subject' })).includes(W(0)));
  }
  // A chain into another field: phone's old name `tel` given to the renamed owner field.
  const base = variant(b => { field(b, 'lead', 'phone').aliases = ['tel']; obj(b, 'lead').access = { entity: 'lead', rules: [own] }; });
  const crossed = variant(b => { const f = field(b, 'lead', 'name'); f.key = 'title'; f.aliases = ['name', 'tel']; field(b, 'lead', 'phone').aliases = []; obj(b, 'lead').access = { entity: 'lead', rules: [{ kind: 'own', ownerField: 'title' }] }; });
  assert.deepEqual(d05(base, crossed), [W(0), GONE('name'), MERGED('title')]);
  // Two head fields on one base field (one by key, one by alias): neither continues it.
  const split = variant(b => { const o = obj(b, 'lead').object; o.fields.push({ ...field(b, 'lead', 'name'), key: 'title', aliases: ['name'] }); obj(b, 'lead').access = { entity: 'lead', rules: [{ kind: 'own', ownerField: 'title' }] }; });
  assert.ok(codes(withRules([own]), split).includes(W(0)));
  assert.ok(codes(withRules([own]), variant(b => { split.objects.forEach((o, i) => { b.objects[i] = o; }); obj(b, 'lead').access = { entity: 'lead', rules: [own] }; })).includes(W(0)));
});

test('one bundle: an alias that is another field\'s key, or used twice, is refused by validateBundle', () => {
  const taken = variant(b => { field(b, 'lead', 'phone').aliases = ['name']; });
  const twice = variant(b => { field(b, 'lead', 'phone').aliases = ['old']; field(b, 'lead', 'name').aliases = ['old']; });
  for (const bad of [taken, twice]) assert.ok(m.validateBundle(bad).some(i => i.severity === 'error' && /aliases/.test(i.path)), JSON.stringify(m.validateBundle(bad).map(i => `${i.code} ${i.path}`)));
});

test('resolveByNames: key first, then aliases in order; more than one distinct meaning is ambiguous', () => {
  const f = { key: 'c', aliases: ['b', 'a'] }, known = map => name => map[name];
  assert.deepEqual(m.fieldNames(f), ['c', 'b', 'a']);
  assert.deepEqual(m.resolveByNames(f, known({})), { value: undefined, ambiguous: false });
  assert.deepEqual(m.resolveByNames(f, known({ a: 'x' })), { value: 'x', ambiguous: false });
  assert.deepEqual(m.resolveByNames(f, known({ a: 'x', b: 'x', c: 'x' })), { value: 'x', ambiguous: false });
  assert.deepEqual(m.resolveByNames(f, known({ a: 'x', b: 'y' })), { value: 'y', ambiguous: true });
  assert.deepEqual(m.resolveByNames(f, known({ a: 'x', c: 'z' })), { value: 'z', ambiguous: true });
});

test('a field named by its alias is the same field', () => {
  const head = variant(b => { field(b, 'lead', 'name').aliases = ['title']; obj(b, 'lead').access = { entity: 'lead', rules: [{ kind: 'own', ownerField: 'title' }] }; });
  assert.deepEqual(codes(withRules([own]), head), []);
});
