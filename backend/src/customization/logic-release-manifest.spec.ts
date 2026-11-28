import {prepareLogicReleaseManifest,verifyLogicReleaseManifest} from './logic-release-manifest';

const input={companyId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',configReleaseId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',configRevision:4,logicRevision:2,engineVersion:'lead-js-1',entries:[{screenId:'HQ_LEAD',eventId:'lead.detail.field-change.v1',registryVersion:1 as const,source:'return {proposals:[]};'}]};
describe('logic release manifest preparation, without enabling execution',()=>{
  it('binds code bytes and both revisions to a deterministic immutable snapshot',()=>{
    const manifest=prepareLogicReleaseManifest(input);
    expect(verifyLogicReleaseManifest(manifest)).toBe(true);
    expect(manifest.entries[0].sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prepareLogicReleaseManifest(input)).toEqual(manifest);
    expect(prepareLogicReleaseManifest({...input,logicRevision:3}).contentHash).not.toBe(manifest.contentHash);
    expect(prepareLogicReleaseManifest({...input,configRevision:5}).contentHash).not.toBe(manifest.contentHash);
    expect(verifyLogicReleaseManifest({...manifest,entries:[{...manifest.entries[0],source:'return 1;'}]})).toBe(false);
    expect(verifyLogicReleaseManifest({...manifest,engineVersion:'lead-js-2'})).toBe(false);
    const reordered=Object.fromEntries(Object.entries(manifest).reverse()) as typeof manifest;
    reordered.entries=manifest.entries.map(entry=>Object.fromEntries(Object.entries(entry).reverse()) as typeof entry);
    expect(verifyLogicReleaseManifest(reordered)).toBe(true);
    expect(verifyLogicReleaseManifest({...manifest,unexpected:true} as typeof manifest)).toBe(false);
  });
  it('rejects unknown or duplicate events and malformed text',()=>{
    expect(()=>prepareLogicReleaseManifest({...input,entries:[{...input.entries[0],eventId:'unknown'}]})).toThrow('LOGIC_MANIFEST_INVALID');
    expect(()=>prepareLogicReleaseManifest({...input,entries:[...input.entries,...input.entries]})).toThrow('LOGIC_MANIFEST_INVALID');
    expect(()=>prepareLogicReleaseManifest({...input,entries:[{...input.entries[0],source:'\ud800'}]})).toThrow('LOGIC_MANIFEST_INVALID');
  });
});
