/** Actual pure TS execution; supplements, never replaces, tsc/Vitest/browser/HTTP/ERP checks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as hq from '../../packages/contracts/src/hq-standard.ts';
import { ACCOUNT_INTERFACE_FIELDS } from '../../packages/contracts/src/account-interface.ts';
import { MARKET_FEATURE_KEYS } from '../../packages/contracts/src/globalization.ts';
import { APP_ROUTES } from '../../frontend/src/app/route-config.ts';
import { HQ_SCREEN_PROFILE, GLOBAL_SCREEN_PROFILE } from '../../frontend/src/app/screen-profile.ts';
import { HQ_SCREEN_KEYS } from '../../frontend/src/market/templates/hq/hq-screen-manifest.ts';
import { HQ_ACCOUNT_FIELD_PROFILE } from '../../frontend/src/market/field-profiles/HQ_ACCOUNT.ts';
import { createHqStandardRegistry, HQ_CATALOG_IDS } from '../../frontend/src/app/hq-standard-registry.ts';

const screenBindings = APP_ROUTES.map(r => ({ screenKey: HQ_SCREEN_PROFILE.screens[r.slot], routeKey: r.slot, path: r.path }));
const caps = { screens: screenBindings, catalogIds: HQ_CATALOG_IDS, featureKeys: MARKET_FEATURE_KEYS };
const deps = { screenBindings, accountInterfaceFields: ACCOUNT_INTERFACE_FIELDS, accountFieldProfile: HQ_ACCOUNT_FIELD_PROFILE, featureKeys: MARKET_FEATURE_KEYS };
const fixture = () => createHqStandardRegistry(deps);
const copy = value => structuredClone(value);
const find = (rows, key, value) => { const item = rows.find(row => row[key] === value); assert.ok(item, `Missing fixture ${key}=${value}`); return item; };
const field = (s, key) => find(s.fields, 'fieldKey', key);
function valid(s) { const r = hq.validateHqStandard(s, caps); assert.equal(r.valid, true, JSON.stringify(r.errors, null, 2)); assert.deepEqual(r.errors, []); }
function invalid(s) {
  const r = hq.validateHqStandard(s, caps); assert.equal(r.valid, false, 'Invalid registry was accepted'); assert.ok(r.errors.length);
  for (const e of r.errors) { assert.ok(typeof e.code === 'string' && e.code); assert.equal(typeof e.path, 'string'); assert.ok(typeof e.message === 'string' && e.message); }
  return r;
}
function sample(f) {
  if (f.defaultValue !== undefined) return f.defaultValue;
  if (f.valueRule.options?.length) return f.valueRule.options[0];
  switch (f.valueRule.type) { case 'number': return Math.max(1, f.valueRule.min ?? 0); case 'boolean': return false; case 'rows': return [{}]; case 'date': return '2026-10-22'; case 'reference': return '00000000-0000-4000-8000-000000000001'; default: return 'Sample value'.slice(0, f.valueRule.maxLength ?? 12).padEnd(f.valueRule.minLength ?? 0, 'A'); }
}
function context(s, changes = {}) {
  return { activeProcesses: s.processes.filter(x => x.enabled).map(x => x.processKey), permissions: [...new Set([...s.processes, ...s.screens, ...s.menus, ...s.actions].flatMap(x => x.permissions).concat(s.fields.flatMap(x => [...x.readPermissions, ...x.writePermissions])))], features: [...MARKET_FEATURE_KEYS], values: Object.fromEntries(s.fields.map(x => [x.fieldKey, sample(x)])), device: 'desktop', ...changes };
}
const override = (s, patches, extra = {}) => ({ overrideKey: 'H01.TEST.COUNTRY', parentStandardKey: s.standardKey, parentVersion: s.version, patches, ...extra });
async function mutations(t, cases) { for (const [name, mutate] of cases) await t.test(name, () => { const s = fixture(); mutate(s); assert.doesNotThrow(() => invalid(s)); }); }

test('01 actual catalog, additional OPS, existing 14 routes and explicit planned coverage', async () => {
  const s = fixture(); valid(s);
  const text = await readFile(new URL('../../spec/screens/P0-08_screen_menu_catalog.md', import.meta.url), 'utf8');
  const ids = [...new Set(text.match(/SCR-[A-Z]+-\d{3}/g))].sort();
  assert.equal(ids.length, 34); assert.deepEqual([...HQ_CATALOG_IDS].sort(), ids);
  assert.deepEqual(s.coverage.filter(x => x.origin === 'catalog').map(x => x.catalogId).sort(), ids);
  assert.deepEqual(s.coverage.filter(x => x.origin === 'additional').map(x => x.catalogId), ['HQ-OPS-ENTRY']);
  assert.deepEqual(s.screens.map(x => x.screenKey).sort(), [...HQ_SCREEN_KEYS].sort()); assert.equal(s.screens.length, 14);
  assert.equal(s.screens.find(x => x.path === '/').screenKey, 'HQ_LEAD');
  for (const x of s.coverage.filter(x => x.planned)) { assert.equal(x.enabled, false); assert.equal(x.screenKeys.length, 0); }
});
test('02 factory is isolated and does not change original HQ/GLOBAL assets', () => {
  const before = copy({ deps, GLOBAL_SCREEN_PROFILE }); const a = fixture(); const b = fixture();
  a.screens[0].label = 'Edited'; assert.notEqual(a.screens[0].label, b.screens[0].label);
  assert.deepEqual({ deps, GLOBAL_SCREEN_PROFILE }, before); assert.equal(Object.values(GLOBAL_SCREEN_PROFILE.screens).length, 7);
});
test('03 duplicates are rejected for every stable entity ID', async t => {
  for (const name of ['processes','screens','menus','tabs','sections','fields','actions','transitions','evidence','coverage']) await t.test(name, () => { const s = fixture(); assert.ok(s[name].length); s[name].push(copy(s[name][0])); invalid(s); });
});
test('04 renderer and route mismatches', t => mutations(t, [
  ['unknown renderer', s => { s.screens[0].screenKey = 'HQ_UNKNOWN'; }], ['GLOBAL renderer', s => { s.screens[0].screenKey = 'GLOBAL_LEAD'; }],
  ['duplicate route', s => { s.screens[1].path = s.screens[0].path; }], ['wrong route key', s => { s.screens[0].routeKey = s.screens[1].routeKey; }], ['wrong path', s => { s.screens[0].path = '/unknown'; }]
]));
test('05 dangling references across metadata graph', t => mutations(t, [
  ['menu screen', s => { s.menus.find(x => x.screenKey).screenKey = 'MISSING'; }], ['process screen', s => { s.processes[0].screenKeys.push('MISSING'); }],
  ['process dependency', s => { s.processes[0].dependsOn.push('MISSING'); }], ['screen tab', s => { s.screens[0].tabKeys.push('MISSING'); }],
  ['screen section', s => { s.screens[0].sectionKeys.push('MISSING'); }], ['section field', s => { s.sections[0].fieldKeys.push('MISSING'); }],
  ['screen action', s => { s.screens[0].actionKeys.push('MISSING'); }], ['action input', s => { s.actions[0].inputFieldKeys.push('MISSING'); }],
  ['required action input', s => { s.actions[0].requiredFieldKeys.push('MISSING'); }],
  ['action process', s => { s.actions[0].processKey = 'MISSING'; }], ['transition state', s => { s.transitions[0].stateFieldKey = 'MISSING'; }],
  ['transition input', s => { s.transitions[0].requiredFieldKeys.push('MISSING'); }], ['evidence', s => { s.fields[0].evidenceKeys.push('MISSING'); }],
  ['condition field', s => { s.actions[0].condition = { kind: 'present', fieldKey: 'MISSING' }; }]
]));
test('06 parent references, menu cycles and cross-screen section ownership', t => mutations(t, [
  ['missing parent', s => { s.menus[0].parentKey = 'MISSING'; }], ['self parent', s => { s.menus[0].parentKey = s.menus[0].menuKey; }],
  ['cycle', s => { s.menus[0].parentKey = s.menus[1].menuKey; s.menus[1].parentKey = s.menus[0].menuKey; }],
  ['foreign section', s => { s.sections[0].screenKey = s.screens.find(x => x.screenKey !== s.sections[0].screenKey).screenKey; }]
]));
test('07 shared screen activation uses any owning active process', () => {
  const s = fixture(); const screen = find(s.screens, 'screenKey', 'HQ_CONTRACT'); const p = hq.createHqPolicy(s, caps); const c = context(s);
  assert.ok(screen.processKeys.includes('HQ.CONTRACT') && screen.processKeys.includes('HQ.COLLECTION'));
  assert.equal(p.screenAllowed(screen.screenKey, c), true);
  assert.equal(p.screenAllowed(screen.screenKey, { ...c, activeProcesses: c.activeProcesses.filter(x => x !== 'HQ.COLLECTION') }), true);
  assert.equal(p.screenAllowed(screen.screenKey, { ...c, activeProcesses: c.activeProcesses.filter(x => !screen.processKeys.includes(x)) }), false);
});
test('08 screen/menu permissions, feature and device conditions require all gates', () => {
  const s = fixture(); const screen = find(s.screens, 'screenKey', 'HQ_DIRECT_WORK'); screen.permissions = ['H01.TEST.READ']; screen.features = ['DIRECT_WORK']; screen.devices = ['desktop']; valid(s);
  const p = hq.createHqPolicy(s, caps); const c = context(s); const menu = s.menus.find(x => x.screenKey === screen.screenKey);
  assert.equal(p.screenAllowed(screen.screenKey, c), true); assert.equal(p.menuVisible(menu.menuKey, c), true);
  for (const denied of [{ ...c, permissions: c.permissions.filter(x => x !== 'H01.TEST.READ') }, { ...c, features: c.features.filter(x => x !== 'DIRECT_WORK') }, { ...c, device: 'mobile' }, { ...c, activeProcesses: [] }]) { assert.equal(p.screenAllowed(screen.screenKey, denied), false); assert.equal(p.menuVisible(menu.menuKey, denied), false); }
  assert.equal(p.screenAllowed('MISSING', c), false); assert.equal(p.menuVisible('MISSING', c), false);
});
test('09 shared-screen access does not grant an inactive owning process action', () => {
  const s = fixture(); const a = find(s.actions, 'actionKey', 'COL.planChange'); a.condition = copy(hq.HQ_TRUE); a.enabled = true; a.permissions = ['H01.ACTION.WRITE']; a.features = ['MONTHLY_STATEMENT']; valid(s);
  const p = hq.createHqPolicy(s, caps); const c = context(s); assert.equal(p.actionAllowed(a.actionKey, c), true);
  const limited = { ...c, activeProcesses: c.activeProcesses.filter(x => x !== 'HQ.COLLECTION') };
  assert.equal(p.screenAllowed('HQ_CONTRACT', limited), true); assert.equal(p.actionAllowed(a.actionKey, limited), false);
  assert.equal(p.actionAllowed(a.actionKey, { ...c, permissions: c.permissions.filter(x => x !== 'H01.ACTION.WRITE') }), false);
  assert.equal(p.actionAllowed(a.actionKey, { ...c, features: c.features.filter(x => x !== 'MONTHLY_STATEMENT') }), false);
  assert.equal(p.actionAllowed('MISSING', c), false); assert.equal(p.transitionAllowed('MISSING', c), false);
});
test('10 condition evaluation preserves zero/false and rejects malformed rules', () => {
  for (const x of [0, false, '0']) assert.equal(hq.evaluateHqCondition({ kind: 'present', fieldKey: 'x' }, { x }), true);
  for (const x of [undefined, null, '', '   ']) assert.equal(hq.evaluateHqCondition({ kind: 'present', fieldKey: 'x' }, { x }), false);
  assert.equal(hq.evaluateHqCondition({ kind: 'equals', fieldKey: 'x', value: 0 }, { x: '0' }), false);
  assert.equal(hq.evaluateHqCondition({ kind: 'oneOf', fieldKey: 'x', values: ['A','B'] }, { x: 'B' }), true);
  assert.equal(hq.evaluateHqCondition({ kind: 'all', conditions: [hq.HQ_TRUE,hq.HQ_FALSE] }, {}), false);
  assert.equal(hq.evaluateHqCondition({ kind: 'any', conditions: [hq.HQ_TRUE,hq.HQ_FALSE] }, {}), true);
  assert.equal(hq.evaluateHqCondition({ kind: 'not', condition: hq.HQ_FALSE }, {}), true);
  for (const rule of [null, {}, { kind: 'unknown' }, { kind: 'constant', value: 'true' }]) assert.equal(hq.evaluateHqCondition(rule, {}), false);
});
test('11 observation versus executable requirement and current support versus target policy', () => {
  const s = fixture(); assert.equal(field(s, 'lead.keymanNote').current.write, false);
  const f = copy(field(s, 'lead.hospitalName')); f.observedRequired = true; f.requiredRule = copy(hq.HQ_FALSE);
  assert.deepEqual(hq.validateHqFieldValue(f, undefined, false), []); f.observedRequired = 'unknown'; f.requiredRule = copy(hq.HQ_TRUE); assert.ok(hq.validateHqFieldValue(f, undefined, true).length);
  const name = field(s, 'account.erp.cust_nm'); assert.equal(name.current.write, true); assert.equal(name.readOnly, true);
  assert.ok(s.actions.some(x => x.actionKey === 'OPP.saveNegotiation'));
});
test('12 hiding required field or its owner section is rejected', async t => {
  for (const owner of ['field','section']) await t.test(owner, () => { const s = fixture(); const f = field(s, 'lead.hospitalName'); f.requiredRule = copy(hq.HQ_TRUE); delete f.hiddenFallback; if (owner === 'field') f.visible = false; else find(s.sections, 'sectionKey', f.sectionKey).enabled = false; invalid(s); });
});
test('13 transition-required fields cannot be hidden or removed', () => {
  const s = fixture(); const tr = s.transitions.find(x => x.requiredFieldKeys.length); assert.ok(tr); const f = field(s, tr.requiredFieldKeys[0]); f.visible = false; delete f.hiddenFallback; invalid(s);
  const removed = fixture(); removed.fields = removed.fields.filter(x => x.fieldKey !== f.fieldKey); invalid(removed);
});
test('14 hidden defaults must satisfy type/range; zero is not absence', () => {
  const s = fixture(); const f = field(s, 'opportunity.successProbability'); f.requiredRule = copy(hq.HQ_TRUE); f.visible = false; f.hiddenFallback = { kind: 'default', value: 0 }; valid(s);
  for (const value of [-1, '', '0']) { f.hiddenFallback = { kind: 'default', value }; invalid(s); }
});
test('15 missing fallback references and cycles do not satisfy required inputs', () => {
  const s = fixture(); const a = field(s, 'lead.hospitalName'); const b = field(s, 'lead.phone'); a.requiredRule = copy(hq.HQ_TRUE); a.visible = false; a.hiddenFallback = { kind: 'field', fieldKey: 'MISSING' }; invalid(s);
  a.hiddenFallback = { kind: 'field', fieldKey: b.fieldKey }; b.visible = false; b.hiddenFallback = { kind: 'field', fieldKey: a.fieldKey }; invalid(s);
});
test('16 read/write permissions, masking and conditional state locks are separate', () => {
  const s = fixture(); const f = field(s, 'lead.hospitalName'); f.readPermissions = ['H01.FIELD.READ']; f.writePermissions = ['H01.FIELD.WRITE']; f.readOnly = false; f.readOnlyWhen = { kind: 'equals', fieldKey: 'lead.status', value: 'CONVERTED' }; f.masking = 'last4'; f.unmaskPermission = 'H01.FIELD.UNMASK'; valid(s);
  const p = hq.createHqPolicy(s, caps); const c = context(s); c.values[f.fieldKey] = 'Confidential1234'; c.values['lead.status'] = 'NEW';
  assert.equal(p.fieldVisible(f.fieldKey, c), true); assert.equal(p.fieldWritable(f.fieldKey, c), true);
  const masked = p.readField(f.fieldKey, c); assert.equal(typeof masked, 'string'); assert.ok(masked.endsWith('1234')); assert.equal(masked.includes('Confidential'), false);
  assert.equal(p.readField(f.fieldKey, { ...c, permissions: [...c.permissions, 'H01.FIELD.UNMASK'] }), 'Confidential1234');
  const noRead = { ...c, permissions: c.permissions.filter(x => x !== 'H01.FIELD.READ') }; assert.equal(p.fieldVisible(f.fieldKey, noRead), false); assert.equal(p.readField(f.fieldKey, noRead), undefined);
  assert.equal(p.fieldWritable(f.fieldKey, { ...c, permissions: c.permissions.filter(x => x !== 'H01.FIELD.WRITE') }), false);
  assert.equal(p.fieldWritable(f.fieldKey, { ...c, values: { ...c.values, 'lead.status': 'CONVERTED' } }), false);
  assert.equal(p.fieldVisible('MISSING', c), false); assert.equal(p.fieldWritable('MISSING', c), false); assert.equal(p.readField('MISSING', c), undefined);
});
test('17 actual field constraints validate numeric/string boundary values', () => {
  const s = fixture(); const probability = field(s, 'opportunity.successProbability'); for (const v of [0,100]) assert.deepEqual(hq.validateHqFieldValue(probability, v, true), []); for (const v of [-1,101,NaN,Infinity,'50']) assert.ok(hq.validateHqFieldValue(probability, v, true).length);
  const quantity = field(s, 'opportunity.quantity'); for (const v of [1,9999]) assert.deepEqual(hq.validateHqFieldValue(quantity, v, true), []); for (const v of [0,10000,1.5]) assert.ok(hq.validateHqFieldValue(quantity, v, true).length);
  const name = field(s, 'opportunity.name'); assert.deepEqual(hq.validateHqFieldValue(name, 'A'.repeat(200), true), []); assert.ok(hq.validateHqFieldValue(name, 'A'.repeat(201), true).length);
});
test('18 override identity, schema, target, duplicate and parent-version checks', async t => {
  const s = fixture(); const key = s.screens[0].screenKey; const patch = changes => ({ target: 'screen', key, changes });
  const cases = [ ['wrong parent', override(s, [], { parentStandardKey: 'MISSING' })], ['stale version', override(s, [], { parentVersion: 'STALE' })], ['unknown target', override(s, [{ target: 'unknown', key, changes: { label: 'X' } }])], ['unknown ID', override(s, [{ target: 'screen', key: 'MISSING', changes: { label: 'X' } }])], ['unknown property', override(s, [patch({ mystery: true })])], ['ID change', override(s, [patch({ screenKey: 'NEW' })])], ['route change', override(s, [patch({ path: '/other' })])], ['duplicate patch', override(s, [patch({ label: 'X' }),patch({ label: 'Y' })])] ];
  for (const [name, request] of cases) await t.test(name, () => { const before = copy(s); const r = hq.applyHqOverride(s, request, caps); assert.equal(r.valid, false); assert.ok(r.errors.length); assert.equal(r.standard, undefined); assert.deepEqual(s, before); });
});
test('19 protected fields reject policy relaxation', async t => {
  const s = fixture(); const f = field(s, 'account.erp.cust_cd'); f.masking = 'redact';
  for (const [name, changes] of [['lock',{ locked:false }],['policy',{ overridePolicy:'presentation' }],['read-only',{ readOnly:false }],['required',{ requiredRule:copy(hq.HQ_FALSE) }],['mask',{ masking:'none' }],['source',{ source:'CRM' }]]) await t.test(name, () => { const r = hq.applyHqOverride(s, override(s, [{ target:'field',key:f.fieldKey,changes }]), caps); assert.equal(r.valid, false); assert.equal(r.standard, undefined); });
});
test('20 presentation override pins parent and isolates snapshot from future HQ edits', () => {
  const s = fixture(); const before = copy(s); const r = hq.applyHqOverride(s, override(s, [{ target:'screen',key:s.screens[0].screenKey,changes:{ label:'Country presentation' } }]), caps);
  assert.equal(r.valid, true, JSON.stringify(r.errors)); assert.ok(r.standard); assert.deepEqual(s, before); assert.deepEqual(r.standard.parent, { standardKey:s.standardKey,version:s.version,overrideKey:'H01.TEST.COUNTRY' }); assert.equal(r.standard.screens[0].label, 'Country presentation'); s.screens[0].label = 'Later HQ edit'; assert.equal(r.standard.screens[0].label, 'Country presentation'); valid(r.standard);
});
test('21 overrides revalidate mandatory-field graph', () => {
  const s = fixture(); const f = field(s, 'lead.hospitalName'); f.locked = false; f.overridePolicy = 'restrict'; f.requiredRule = copy(hq.HQ_TRUE); delete f.hiddenFallback; valid(s);
  const r = hq.applyHqOverride(s, override(s, [{ target:'field',key:f.fieldKey,changes:{visible:false} }]), caps); assert.equal(r.valid, false); assert.ok(r.errors.length); assert.equal(r.standard, undefined);
});
test('22 malformed untrusted input fails closed without traversal exceptions', async t => {
  for (const [i,input] of [null,false,4,'registry',[],{},{schemaVersion:1}].entries()) await t.test(`shape ${i}`, () => { assert.doesNotThrow(() => invalid(input)); assert.throws(() => hq.createHqPolicy(input,caps)); });
  await mutations(t, [['collection',s=>{s.fields=null;}],['null row',s=>{s.fields[0]=null;}],['wrong boolean',s=>{s.screens[0].enabled='true';}],['blank ID',s=>{s.fields[0].fieldKey='';}],['condition',s=>{s.fields[0].requiredRule={kind:'eval',code:'true'};}],['range',s=>{s.fields[0].valueRule={type:'number',min:100,max:1};}],['feature',s=>{s.screens[0].features=['UNKNOWN_FEATURE'];}],['missing catalog coverage',s=>{s.coverage=s.coverage.filter(x=>x.catalogId!==HQ_CATALOG_IDS[0]);}]]);
});

test('23 transition permission is separate from screen access and requires valid state and values', () => {
  const s = fixture();
  const tr = s.transitions.find(x => x.requiredFieldKeys.length && find(s.actions, 'actionKey', x.actionKey).support !== 'planned');
  assert.ok(tr); tr.condition = copy(hq.HQ_TRUE);
  const action = find(s.actions, 'actionKey', tr.actionKey); action.enabled = true; action.condition = copy(hq.HQ_TRUE);
  valid(s); const p = hq.createHqPolicy(s, caps); const c = context(s); c.values[tr.stateFieldKey] = tr.fromStates[0];
  const targetKey = tr.stateFieldKey === 'lead.status' ? 'lead.targetStatus' : tr.stateFieldKey === 'opportunity.stage' ? 'opportunity.targetStage' : null;
  if (targetKey && s.fields.some(x => x.fieldKey === targetKey)) c.values[targetKey] = tr.toState;
  assert.equal(p.transitionAllowed(tr.transitionKey, c), true);
  assert.equal(p.transitionAllowed(tr.transitionKey, { ...c, values: { ...c.values, [tr.stateFieldKey]: 'INVALID_CURRENT_STATE' } }), false);
  assert.equal(p.transitionAllowed(tr.transitionKey, { ...c, values: { ...c.values, [tr.requiredFieldKeys[0]]: null } }), false);
  assert.equal(p.transitionAllowed(tr.transitionKey, { ...c, activeProcesses: c.activeProcesses.filter(x => x !== tr.processKey) }), false);
});

test('24 missing additional current-screen coverage and process dependency cycles are rejected', t => mutations(t, [
  ['additional OPS', s => { s.coverage = s.coverage.filter(x => x.catalogId !== 'HQ-OPS-ENTRY'); }],
  ['process self-cycle', s => { const p = s.processes.find(x => x.enabled); p.dependsOn.push(p.processKey); }]
]));

test('25 malformed exported conditions cannot succeed on missing operands or extra properties', () => {
  for (const rule of [
    { kind:'equals',fieldKey:'x' }, { kind:'present',fieldKey:'' },
    { kind:'constant',value:true,unexpected:1 }, { kind:'not',condition:{kind:'present',fieldKey:''} }
  ]) assert.equal(hq.evaluateHqCondition(rule, { x:undefined, '':1 }), false);
  const s = fixture(); s.fields[0].requiredRule = { kind:'constant',value:true,typo:true }; invalid(s);
});

test('26 malformed non-JSON override input is rejected without stringify exceptions', async t => {
  const s = fixture(); const cyclic = {}; cyclic.self = cyclic;
  const cases = [
    ['cyclic value', override(s, [{target:'field',key:'account.erp.cust_cd',changes:{label:cyclic}}])],
    ['undefined value', override(s, [{target:'field',key:'account.erp.cust_cd',changes:{label:undefined}}])],
    ['null patch', override(s, [null])],
    ['wrong changes', override(s, [{target:'screen',key:s.screens[0].screenKey,changes:null}])]
  ];
  for (const [name,request] of cases) await t.test(name, () => {
    const before=copy(s); let result;
    assert.doesNotThrow(()=>{result=hq.applyHqOverride(s,request,caps);});
    assert.equal(result.valid,false); assert.equal(result.standard,undefined); assert.deepEqual(s,before);
  });
});

test('27 ancestor menu gates and immutable policy snapshots are enforced', () => {
  const s=fixture(); const leaf=s.menus.find(x=>x.screenKey==='HQ_DIRECT_WORK');
  const parent={...copy(leaf),menuKey:'menu.test.parent',parentKey:null,permissions:['H01.MENU.PARENT']}; delete parent.screenKey;
  leaf.parentKey=parent.menuKey; s.menus.push(parent); valid(s);
  const policy=hq.createHqPolicy(s,caps); const c=context(s);
  assert.equal(policy.menuVisible(leaf.menuKey,c),true);
  assert.equal(policy.menuVisible(leaf.menuKey,{...c,permissions:c.permissions.filter(x=>x!=='H01.MENU.PARENT')}),false);
  parent.enabled=false; valid(s);
  assert.equal(policy.menuVisible(leaf.menuKey,c),true,'existing policy retains its validated snapshot');
  assert.equal(hq.createHqPolicy(s,caps).menuVisible(leaf.menuKey,c),false);
});

test('28 ERP account request has thirteen action-specific mandatory inputs', () => {
  const s=fixture(); const action=find(s.actions,'actionKey','ACC.erpRequest');
  action.condition=copy(hq.HQ_TRUE); action.enabled=true;
  const expected=ACCOUNT_INTERFACE_FIELDS.filter(x=>x.requiredOut).map(x=>`account.erp.${x.code}`).sort();
  assert.equal(expected.length,13); assert.deepEqual([...action.requiredFieldKeys].sort(),expected); valid(s);
  const policy=hq.createHqPolicy(s,caps); const c=context(s);
  assert.equal(policy.actionAllowed(action.actionKey,c),true);
  for(const key of expected.filter(x=>x!=='account.erp.co_cd')) {
    assert.equal(policy.actionAllowed(action.actionKey,{...c,values:{...c.values,[key]:null}}),false,`mandatory ${key}`);
  }
  const target=field(s,'account.erp.U_Key'); target.requiredRule=copy(hq.HQ_FALSE); target.visible=false; delete target.hiddenFallback;
  invalid(s);
});

test('29 stable references survive array reordering and display-label changes', () => {
  const s=fixture();
  for(const collection of ['processes','screens','menus','tabs','sections','fields','actions','transitions','evidence','coverage']) s[collection].reverse();
  const name=field(s,'lead.hospitalName'); name.label='Renamed display only'; valid(s);
  assert.equal(hq.createHqPolicy(s,caps).screenAllowed('HQ_CONTRACT',context(s)),true);
  assert.equal(field(s,'lead.hospitalName').label,'Renamed display only');
});

test('30 B-H01 transition state declarations reject unregistered values and unrelated fields', t => mutations(t, [
  ['unregistered destination',s=>{find(s.transitions,'transitionKey','LEAD.firstVisit').toState='NOT_REGISTERED';}],
  ['unregistered origin',s=>{find(s.transitions,'transitionKey','LEAD.firstVisit').fromStates=['NOT_REGISTERED'];}],
  ['non-state phone field',s=>{find(s.transitions,'transitionKey','LEAD.firstVisit').stateFieldKey='lead.phone';}],
  ['foreign-process state field',s=>{const tr=find(s.transitions,'transitionKey','LEAD.firstVisit');tr.stateFieldKey='opportunity.stage';tr.fromStates=['NEEDS_ANALYSIS'];tr.toState='PROPOSAL';delete tr.targetFieldKey;}],
  ['state not readable',s=>{field(s,'lead.status').current.read=false;}],
  ['state not read-only',s=>{field(s,'lead.status').readOnly=false;}],
  ['state has no registered values',s=>{delete field(s,'lead.status').valueRule.options;}],
  ['target reference missing',s=>{find(s.transitions,'transitionKey','LEAD.firstVisit').targetFieldKey='MISSING';}],
  ['target is not required input',s=>{find(s.transitions,'transitionKey','LEAD.firstVisit').targetFieldKey='lead.phone';}]
]));

test('31 B-H01 transition binds requested target to destination even when both are valid enum members', () => {
  const s=fixture();const tr=find(s.transitions,'transitionKey','LEAD.firstVisit');
  assert.equal(tr.targetFieldKey,'lead.targetStatus');tr.toState='KEYMAN_MEETING';tr.condition=copy(hq.HQ_TRUE);valid(s);
  const p=hq.createHqPolicy(s,caps);const c=context(s);c.values['lead.status']='NEW';c.values['lead.targetStatus']='FIRST_VISIT';
  assert.equal(p.transitionAllowed(tr.transitionKey,c),false);
  c.values['lead.targetStatus']='KEYMAN_MEETING';assert.equal(p.transitionAllowed(tr.transitionKey,c),true);
});

test('32 B-H01 direct-work input permissions follow the eligible approval action and current step', () => {
  const s=fixture();const comment=field(s,'directWork.comment');const decision=field(s,'directWork.decision');
  for(const f of [comment,decision])assert.deepEqual([...f.writeActionKeys].sort(),['DW.decision.branch','DW.decision.division']);
  valid(s);const p=hq.createHqPolicy(s,caps);const c=context(s,{permissions:['DIRECT_WORK.READ']});
  c.values['directWork.status']='REQUESTED';delete c.values['directWork.decision'];delete c.values['directWork.comment'];
  assert.equal(p.screenAllowed('HQ_DIRECT_WORK',c),true);
  for(const f of [comment,decision]) {
    assert.equal(p.fieldVisible(f.fieldKey,c),true);assert.equal(p.fieldWritable(f.fieldKey,c),false,'read permission is not approval permission');
    const branch={...c,permissions:[...c.permissions,'DIRECT_WORK.APPROVE.BRANCH']};
    assert.equal(p.fieldWritable(f.fieldKey,branch),true,'editing must not require the field to already have a valid submitted value');
    assert.equal(p.fieldWritable(f.fieldKey,{...branch,values:{...branch.values,'directWork.status':'BRANCH_APPROVED'}}),false);
    const division={...c,permissions:[...c.permissions,'DIRECT_WORK.APPROVE.DIVISION']};
    assert.equal(p.fieldWritable(f.fieldKey,division),false);
    assert.equal(p.fieldWritable(f.fieldKey,{...division,values:{...division.values,'directWork.status':'BRANCH_APPROVED'}}),true);
    assert.equal(p.fieldWritable(f.fieldKey,{...branch,features:c.features.filter(x=>x!=='DIRECT_WORK')}),false);
    assert.equal(p.fieldWritable(f.fieldKey,{...branch,activeProcesses:c.activeProcesses.filter(x=>x!=='HQ.DIRECT_WORK')}),false);
  }
});

test('33 B-H01 field write-action references must be present and own that input', t => mutations(t, [
  ['unknown write action',s=>{field(s,'directWork.comment').writeActionKeys=['MISSING'];}],
  ['unrelated write action',s=>{field(s,'directWork.comment').writeActionKeys=['LEAD.search'];}]
]));

function fallbackFixture(targetKey,sourceKey,targetRule,sourceRule) {
  const s=fixture();const target=field(s,targetKey);const source=field(s,sourceKey);
  target.valueRule=copy(targetRule);source.valueRule=copy(sourceRule);delete target.defaultValue;delete source.defaultValue;
  target.requiredRule=copy(hq.HQ_TRUE);source.requiredRule=copy(hq.HQ_TRUE);target.visible=false;source.visible=true;
  target.hiddenFallback={kind:'field',fieldKey:sourceKey};delete source.hiddenFallback;
  return s;
}
test('34 B-H01 numeric fallback domain must be a subset including integer constraints', async t => {
  const target={type:'number',min:1,max:9999,integer:true};
  await t.test('valid numeric subset',()=>valid(fallbackFixture('opportunity.quantity','opportunity.successProbability',target,{type:'number',min:1,max:100,integer:true})));
  for(const [name,rule] of [
    ['zero-only original reproduction',{type:'number',min:0,max:0,integer:true}],
    ['lower bound expansion',{type:'number',min:0,max:100,integer:true}],
    ['upper bound expansion',{type:'number',min:1,max:10000,integer:true}],
    ['integer condition missing',{type:'number',min:1,max:100}],
    ['lower bound unbounded',{type:'number',max:100,integer:true}]
  ])await t.test(name,()=>invalid(fallbackFixture('opportunity.quantity','opportunity.successProbability',target,rule)));
});

test('35 B-H01 string fallback lengths and enumeration values must satisfy both fields', async t => {
  const target={type:'string',minLength:1,maxLength:200};
  await t.test('valid length subset',()=>valid(fallbackFixture('opportunity.name','lead.phone',target,{type:'string',minLength:2,maxLength:100})));
  await t.test('expanded string bound',()=>invalid(fallbackFixture('opportunity.name','lead.phone',target,{type:'string',minLength:1,maxLength:201})));
  await t.test('missing string bound',()=>invalid(fallbackFixture('opportunity.name','lead.phone',target,{type:'string',minLength:1})));
  const enumTarget={type:'string',options:['PIPELINE','COMMIT','OMITTED']};
  await t.test('valid enum subset',()=>valid(fallbackFixture('opportunity.forecastCategory','lead.phone',enumTarget,{type:'string',options:['PIPELINE','COMMIT']})));
  await t.test('enum outside target domain',()=>invalid(fallbackFixture('opportunity.forecastCategory','lead.phone',enumTarget,{type:'string',options:['NOT_REGISTERED']})));
  await t.test('enum violates own source constraint',()=>invalid(fallbackFixture('opportunity.forecastCategory','lead.phone',enumTarget,{type:'string',minLength:20,options:['PIPELINE']})));
  await t.test('numeric options subset',()=>valid(fallbackFixture('opportunity.quantity','opportunity.successProbability',{type:'number',min:1,max:9999,integer:true},{type:'number',options:[1,2]})));
  await t.test('numeric options violate target',()=>invalid(fallbackFixture('opportunity.quantity','opportunity.successProbability',{type:'number',min:1,max:9999,integer:true},{type:'number',options:[0,1]})));
});

test('36 B-H01 merge inputs require primary UUID reference and one or two duplicate references', () => {
  const s=fixture();const a=find(s.actions,'actionKey','ACC.merge');const duplicates=field(s,'merge.duplicatePublicIds');
  assert.equal(field(s,'merge.primaryPublicId').valueRule.type,'reference');
  assert.deepEqual(duplicates.valueRule,{type:'rows',minLength:1,maxLength:2});
  for(const key of ['merge.primaryPublicId','merge.duplicatePublicIds'])assert.ok(a.inputFieldKeys.includes(key)&&a.requiredFieldKeys.includes(key));
  const p=hq.createHqPolicy(s,caps);const c=context(s);c.values['merge.primaryPublicId']='00000000-0000-4000-8000-000000000001';
  const duplicate='00000000-0000-4000-8000-000000000002';c.values['merge.duplicatePublicIds']=[duplicate];
  assert.equal(p.actionAllowed(a.actionKey,c),true);
  assert.equal(p.actionAllowed(a.actionKey,{...c,values:{...c.values,'merge.duplicatePublicIds':[duplicate,'00000000-0000-4000-8000-000000000003']}}),true);
  assert.equal(p.actionAllowed(a.actionKey,{...c,values:{...c.values,'merge.primaryPublicId':null}}),false);
  for(const rows of [[],[duplicate,duplicate,duplicate],null])assert.equal(p.actionAllowed(a.actionKey,{...c,values:{...c.values,'merge.duplicatePublicIds':rows}}),false);
  // API/service UUID syntax, array-member validation and duplicate identity rules are outside this H01 value-domain test.
});

test('37 B-H01 calendar/map queries cannot omit currently required date or coordinate inputs', async t => {
  const s=fixture();const p=hq.createHqPolicy(s,caps);const c=context(s);
  const cases=[['ACT.calendar',['activity.calendarFrom','activity.calendarTo']],['ACT.map',['activity.mapDate','activity.latitude','activity.longitude']]];
  for(const [actionKey,keys] of cases)await t.test(actionKey,()=>{
    const a=find(s.actions,'actionKey',actionKey);for(const key of keys)assert.ok(a.inputFieldKeys.includes(key)&&a.requiredFieldKeys.includes(key));
    c.values['activity.calendarFrom']='2026-10-01';c.values['activity.calendarTo']='2026-10-22';c.values['activity.mapDate']='2026-10-22';c.values['activity.latitude']=0;c.values['activity.longitude']=0;
    assert.equal(p.actionAllowed(actionKey,c),true);
    for(const key of keys)assert.equal(p.actionAllowed(actionKey,{...c,values:{...c.values,[key]:null}}),false,`${actionKey}: ${key}`);
  });
});

test('38 B-H01 direct delivery requires an address, while account delivery may use account address', () => {
  const s=fixture();const p=hq.createHqPolicy(s,caps);const c=context(s);c.values['order.status']='DRAFT';c.values['order.deliveryAddressType']='DIRECT';c.values['order.deliveryAddress']=null;
  assert.equal(p.actionAllowed('ORD.delivery',c),false);
  c.values['order.deliveryAddress']='Mock delivery address';assert.equal(p.actionAllowed('ORD.delivery',c),true);
  assert.equal(p.actionAllowed('ORD.delivery',{...c,values:{...c.values,'order.status':'FAILED'}}),true);
  assert.equal(p.actionAllowed('ORD.delivery',{...c,values:{...c.values,'order.deliveryAddressType':'ACCOUNT','order.deliveryAddress':null}}),true);
  assert.equal(p.actionAllowed('ORD.delivery',{...c,values:{...c.values,'order.status':'REQUESTING'}}),false);
});

test('39 B-H01 ERP account request blocks requesting and successfully approved duplicates', () => {
  const s=fixture();const p=hq.createHqPolicy(s,caps);const c=context(s);
  const cases=[['NOT_REQUESTED',false,true],['FAILED',false,true],['REQUESTING',false,false],['REQUESTING',true,false],['SUCCESS',true,false],['SUCCESS',false,true]];
  for(const [status,approved,expected] of cases)assert.equal(p.actionAllowed('ACC.erpRequest',{...c,values:{...c.values,'account.integrationStatus':status,'account.erpApprovedYn':approved}}),expected,`${status}/${approved}`);
});

test('40 B-H01 evidence maps approval list/detail and training rules to the right screens', async t => {
  const s=fixture();
  const ids=(catalogId,kind)=>find(s.coverage,'catalogId',catalogId).evidenceKeys.flatMap(key=>{const e=find(s.evidence,'evidenceKey',key);return e.kind===kind?e.analysisIds:[];});
  await t.test('S21 is approval target list, not report creation',()=>{assert.ok(ids('SCR-REP-002','observed').includes('S21'));assert.equal(ids('SCR-REP-001','observed').includes('S21'),false);});
  await t.test('S22 is approval detail',()=>assert.ok(ids('SCR-REP-003','observed').includes('S22')));
  await t.test('S525 is collection training',()=>assert.ok(ids('SCR-COL-001','training').includes('S525')));
  await t.test('S527 is order training, not fabricated completion evidence',()=>{for(const key of ['SCR-ORD-001','SCR-ORD-002'])assert.ok(ids(key,'training').includes('S527'));});
});
