import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import '../hq-standard/register.mjs';

const { MemoryAdminConfigRepository, emptyConfigState } = await import('../../backend/src/customization/config-store.ts');
const { CompanyConfigurationService, makeStandardArtifact } = await import('../../backend/src/customization/config-service.ts');
const baseline = JSON.parse(await fs.readFile(new URL('../../packages/contracts/catalogs/hq-customization-baseline.json', import.meta.url), 'utf8'));
const companyA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const companyB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const user = '11111111-1111-4111-8111-111111111111';
const actor = { id: user, companyId: companyA };
const permissions = ['config.read', 'config.edit', 'config.preview', 'config.publish'];

test('W06 invalid visual edits block publish; saved revision must be revalidated; only selected company activates', async () => {
  // Test only: the repository baseline is deliberately not publication ready.
  const standard = makeStandardArtifact('w06-published-fixture', baseline.catalog, baseline.translations, true);
  const repository = new MemoryAdminConfigRepository([
    emptyConfigState(companyA, { [user]: { active: true, permissions, denied: [] } }),
    emptyConfigState(companyB, { [user]: { active: true, permissions, denied: [] } })
  ]);
  const service = new CompanyConfigurationService(repository, [standard]);
  const draft = await service.createDraft(actor, standard.catalog.standardReleaseId, null, 'w06-create');
  const invalid = await service.saveDraft(actor, draft.id, 1, {
    patches: [{ targetId: 'lead.hospitalName', property: 'visible', operation: 'set', value: false }],
    activeLocales: ['ko-KR', 'en-US'], defaultLocale: 'ko-KR',
    translations: { 'ko-KR': { 'hq.field.lead.hospitalName': ' ' } }
  }, 'w06-invalid-save');
  const failed = await service.validate(actor, draft.id, invalid.revision);
  for (const code of ['REQUIRED_UNREACHABLE', 'DEPENDENCY_MISSING', 'INVALID_TRANSLATION']) {
    assert.ok(failed.errors.some(issue => issue.code === code), `missing ${code}`);
  }
  await assert.rejects(service.publish(actor, failed.id, null, 'invalid', 'w06-invalid-publish'), error => error.code === 'VALIDATION_FAILED');
  assert.equal(repository.snapshot(companyA).activeReleaseId, null);

  const corrected = await service.saveDraft(actor, draft.id, invalid.revision, {
    patches: [], activeLocales: ['ko-KR', 'en-US'], defaultLocale: 'ko-KR',
    translations: { 'ko-KR': { 'hq.field.lead.hospitalName': 'W06 병원명' } }
  }, 'w06-corrected-save');
  await assert.rejects(service.preview(actor, failed.id), error => error.code === 'DRAFT_CONFLICT');
  await assert.rejects(service.publish(actor, failed.id, null, 'stale', 'w06-stale-publish'), error => error.code === 'DRAFT_CONFLICT');
  const passed = await service.validate(actor, draft.id, corrected.revision);
  assert.deepEqual(passed.errors, []);
  const preview = await service.preview(actor, passed.id);
  assert.equal(preview.sideEffects, false);
  assert.equal(repository.snapshot(companyA).activeReleaseId, null);
  const release = await service.publish(actor, passed.id, null, 'W06 verified', 'w06-publish');
  assert.equal(repository.snapshot(companyA).activeReleaseId, release.id);
  assert.equal(repository.snapshot(companyB).activeReleaseId, null);
  assert.equal(release.config.translations['ko-KR']['hq.field.lead.hospitalName'], 'W06 병원명');
});
