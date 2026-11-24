import assert from 'node:assert/strict';
import fs from 'node:fs';

const mapping = JSON.parse(fs.readFileSync('docs/admin-platform/customization/evidence/lead-account-element-map.json', 'utf8'));
const browser = JSON.parse(fs.readFileSync('docs/admin-platform/customization/evidence/w01/results.json', 'utf8'));
assert.equal(mapping.entries.length, 198);
assert.equal(new Set(mapping.entries.map(item => item.id)).size, mapping.entries.length);
assert.equal(Object.values(mapping.w01.summary).reduce((sum, count) => sum + count, 0), 198);
for (const item of mapping.entries) {
  assert.ok(item.w01.disposition, `No W01 disposition: ${item.id}`);
  if (['HQ_VISIBLE', 'UNSUPPORTED_VISIBLE', 'HQ_VISIBLE_OR_QUERY', 'HQ_STRUCTURE', 'ROUTE_REGISTERED'].includes(item.w01.disposition)) {
    assert.ok(item.w01.locations.length, `No source location: ${item.id}`);
    for (const location of item.w01.locations) {
      assert.ok(location.instanceId && location.variant && location.stateFixtureId, `Incomplete location: ${item.id}`);
      assert.equal(location.source?.currentLineMatches, true, `Stale W01 source location: ${item.id}`);
    }
  } else assert.ok(item.w01.reason || item.kind === 'TAB', `No exclusion reason: ${item.id}`);
}
assert.deepEqual(browser.failures, []);
assert.deepEqual(Object.keys(browser.viewports).sort(), ['mobile', 'pc']);
for (const [device, states] of Object.entries(browser.viewports)) {
  for (const state of ['lead-list', 'lead-detail', 'lead-create', 'lead-owner-popup', 'lead-convert-popup', 'account-list', 'account-create', 'account-detail-basic', 'account-bulk-popup', 'account-merge-popup', 'account-contact-popup', 'account-contact-edit-popup']) {
    assert.ok(states[state], `${device}/${state} missing`);
    assert.equal(states[state].configAnchors, 0, `${device}/${state}: W02 anchor unexpectedly present`);
    if (state.includes('popup')) assert.equal(states[state].dialogs.length, 1, `${device}/${state}: dialog absent`);
  }
}
console.log(`W01 mapping checked: ${mapping.entries.length} candidates, ${browser.screenshots.length} screenshots, ${Object.keys(browser.viewports.pc).length} PC and ${Object.keys(browser.viewports.mobile).length} mobile states.`);
