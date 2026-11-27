// F1-2: the lead object in metadata/ must match what the existing lead contracts already name, in both directions.
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const m = require('../../packages/contracts/dist/metadata');
const contracts = require('../../packages/contracts/dist');
const grid = require('../../packages/contracts/dist/lead-grid-columns');

const root = path.resolve(__dirname, '..', '..');
function metadataFiles(dir = path.join(root, 'metadata')) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return metadataFiles(full);
    return [{ path: path.relative(root, full).split(path.sep).join('/'), content: fs.readFileSync(full, 'utf8') }];
  });
}
/** Contract column id (lead.hospitalName) -> metadata field key (hospital_name). */
const fieldKey = id => id.replace(/^lead\./, '').replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);

const loaded = m.bundleFromFiles(metadataFiles());
const lead = () => loaded.bundle.objects.find(o => o.object.key === 'lead');

test('the metadata folder loads and validates without errors', () => {
  assert.deepEqual(loaded.issues, []);
  assert.deepEqual(m.validateBundle(loaded.bundle).map(i => `${i.code} ${i.path}`), []);
  assert.ok(lead(), 'metadata/objects/lead is missing');
});

test('lead fields are exactly the column ids of the lead contracts', () => {
  const ids = new Set([
    ...grid.leadGridCandidates.map(c => c.fieldId), ...grid.leadBaseColumnIds, ...grid.leadManagedColumnIds,
    ...grid.leadLegacyDisplayColumns.map(c => c.fieldId), 'lead.updatedAt',
  ]);
  const fromContracts = [...ids].map(fieldKey).sort();
  const fromMetadata = lead().object.fields.map(f => f.key).sort();
  assert.deepEqual(fromMetadata, fromContracts);
});

test('the default list view is the managed column order of the lead grid', () => {
  const view = lead().listViews.views.find(v => v.key === 'hq_default');
  assert.deepEqual(view.columns, grid.leadManagedColumnIds.map(fieldKey));
  // lead-grid-settings.ts allows sorting by lead.updatedAt only, so that field must be comparable.
  const updated = lead().object.fields.find(f => f.key === fieldKey('lead.updatedAt'));
  assert.ok(m.COMPARABLE_TYPES.includes(updated.type));
});

test('the lead_status code group is LeadStatus', () => {
  const status = lead().object.fields.find(f => f.key === 'status');
  assert.equal(status.type, 'enum');
  const group = loaded.bundle.codes.groups.find(g => g.key === status.enumCodeGroup);
  assert.deepEqual(group.values.map(v => v.code), [...contracts.LEAD_STATUSES]);
});
