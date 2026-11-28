import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { LOGIC_EVENT_REGISTRY_VERSION, findLogicEvent, listLogicEvents } from '../../packages/contracts/dist/logic-events.js';
import { canonicalConfigJson, resolveCompanyConfig } from '../../packages/contracts/dist/crm-customization.js';

test('lead event descriptors distinguish UI changes and server save/convert; runtime remains unavailable', () => {
  const events = listLogicEvents('HQ_LEAD', LOGIC_EVENT_REGISTRY_VERSION);
  assert.equal(events.length, 5);
  assert.equal(new Set(events.map(e => e.eventId)).size, events.length);
  assert.deepEqual(events.filter(e => e.executionContext === 'screen').map(e => e.variant), ['create', 'detail']);
  assert.deepEqual(events.filter(e => e.executionContext === 'server').map(e => e.target.id), ['LEAD.create', 'LEAD.save', 'LEAD.convert']);
  assert.ok(events.every(e => e.runtimeStatus === 'not-implemented' && e.registryVersion === 1));
  assert.ok(events.filter(e => e.executionContext === 'screen').every(e => e.proposedResults.includes('validation-errors') && e.proposedResults.includes('calculation-proposal') && e.proposedResults.includes('display-proposal')));
  assert.ok(events.filter(e => e.executionContext === 'server').every(e => e.proposedResults.includes('validation-errors')));
});

test('unknown versions, screens and identifiers fail closed without coercion or prototype lookup', () => {
  for (const version of [0, 2, '1', null, undefined, NaN]) {
    assert.equal(findLogicEvent('HQ_LEAD', 'lead.detail.before-save.v1', version), null);
    assert.deepEqual(listLogicEvents('HQ_LEAD', version), []);
  }
  for (const screen of ['HQ_ACCOUNT', '', '__proto__', null, {}, 1]) {
    assert.equal(findLogicEvent(screen, 'lead.detail.before-save.v1', 1), null);
    assert.deepEqual(listLogicEvents(screen, 1), []);
  }
  for (const event of ['', '__proto__', 'constructor', 'lead.detail.before-save.v2', null, {}]) assert.equal(findLogicEvent('HQ_LEAD', event, 1), null);
});

test('returned descriptor copies cannot alter subsequent lookups or enable execution', () => {
  const original = findLogicEvent('HQ_LEAD', 'lead.convert.before-command.v1', 1);
  const changed = listLogicEvents('HQ_LEAD', 1);
  changed[4].target.id = 'LEAD.delete';
  changed[4].runtimeStatus = 'enabled';
  changed[4].proposedInputs.push('all-secrets');
  changed[4].proposedResults.push('direct-sql');
  changed.pop();
  assert.deepEqual(findLogicEvent('HQ_LEAD', 'lead.convert.before-command.v1', 1), original);
  assert.equal(listLogicEvents('HQ_LEAD', 1).length, 5);
});

test('registry lookup does not mutate baseline config, its effective rules or canonical hash', () => {
  const artifact = JSON.parse(readFileSync(new URL('../../packages/contracts/catalogs/hq-customization-baseline.json', import.meta.url), 'utf8'));
  const config = {companyId:'company-A',baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[],activeLocales:['ko-KR'],defaultLocale:'ko-KR',translations:{}};
  const hash = value => createHash('sha256').update(canonicalConfigJson(value)).digest('hex');
  const before = canonicalConfigJson(config), effective = resolveCompanyConfig(artifact.catalog, config), snapshotHash = hash({config, effective});
  for (const event of listLogicEvents('HQ_LEAD', 1)) assert.deepEqual(findLogicEvent('HQ_LEAD', event.eventId, 1), event);
  assert.equal(canonicalConfigJson(config), before);
  assert.deepEqual(resolveCompanyConfig(artifact.catalog, config), effective);
  assert.equal(hash({config, effective:resolveCompanyConfig(artifact.catalog, config)}), snapshotHash);
  assert.equal(Object.hasOwn(config, 'logicEvents'), false);
});
