import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findLogicEvent, listLogicEvents } from '../../packages/contracts/dist/logic-events.js';

const artifact = JSON.parse(readFileSync(new URL('../../packages/contracts/catalogs/hq-customization-baseline.json', import.meta.url), 'utf8'));
const byId = new Map(artifact.catalog.entries.map(entry => [entry.id, entry]));
test('registered action targets are actual supported lead catalog actions', () => {
  assert.equal(byId.get('HQ_LEAD').kind, 'SCREEN');
  for (const event of listLogicEvents('HQ_LEAD', 1).filter(e => e.target.kind === 'action')) {
    const entry = byId.get(event.target.id);
    assert.equal(entry?.kind, 'ACTION');
    assert.equal(entry?.screenId, 'HQ_LEAD');
    assert.equal(entry?.support, 'supported');
    assert.equal(event.runtimeStatus, 'not-implemented');
  }
});
test('all events reject altered screen, event or version and descriptor mutation is isolated', () => {
  for (const event of listLogicEvents('HQ_LEAD', 1)) {
    assert.equal(findLogicEvent('HQ_ACCOUNT', event.eventId, 1), null);
    assert.equal(findLogicEvent('HQ_LEAD', event.eventId + '.forged', 1), null);
    assert.equal(findLogicEvent('HQ_LEAD', event.eventId, 2), null);
    const original = findLogicEvent('HQ_LEAD', event.eventId, 1);
    const changed = findLogicEvent('HQ_LEAD', event.eventId, 1);
    changed.target.id = '__proto__'; changed.proposedInputs.splice(0); changed.proposedResults.push('unrestricted'); changed.runtimeStatus = 'enabled';
    assert.deepEqual(findLogicEvent('HQ_LEAD', event.eventId, 1), original);
  }
});
test('registry returns metadata only, not an executor or an authorization grant', async () => {
  const registry = await import('../../packages/contracts/dist/logic-events.js');
  assert.deepEqual(Object.keys(registry).filter(k => !['default', '__esModule', 'module.exports'].includes(k)).sort(), ['LOGIC_EVENT_REGISTRY_VERSION', 'findLogicEvent', 'listLogicEvents']);
  for (const event of listLogicEvents('HQ_LEAD', 1)) {
    assert.equal(event.runtimeStatus, 'not-implemented');
    assert.equal(Object.values(event).some(value => typeof value === 'function'), false);
    assert.equal(Object.hasOwn(event, 'permissions'), false);
  }
});
