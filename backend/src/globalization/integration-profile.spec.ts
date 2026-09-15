import {
  GLOBAL_INTEGRATION_PROFILE,
  HQ_INTEGRATION_PROFILE,
  getIntegrationProfile,
  resolveIntegrationBindings
} from './integration-profile';

describe('M5 integration profiles', () => {
  it('registers the four required adapter boundaries for HQ', () => {
    const profile = getIntegrationProfile(HQ_INTEGRATION_PROFILE.code);
    expect(profile?.status).toBe('ACTIVE');
    expect(profile?.adapters.map(x => x.kind)).toEqual(['ERP', 'MAP', 'CUSTOMER_MASTER', 'PRODUCT']);
  });

  it('keeps GLOBAL integration profile baseline-only until runtime providers are approved', () => {
    const profile = getIntegrationProfile(GLOBAL_INTEGRATION_PROFILE.code);
    expect(profile?.status).toBe('BASELINE_ONLY');
  });

  it('injects provider and endpoint from environment configuration instead of hardcoding them', () => {
    const bindings = resolveIntegrationBindings(HQ_INTEGRATION_PROFILE, {
      ERP_ADAPTER_PROVIDER: 'test-erp-adapter',
      ERP_ADAPTER_ENDPOINT: 'https://erp.test.example',
      MAP_ADAPTER_PROVIDER: '',
      MAP_ADAPTER_ENDPOINT: ''
    });
    const erp = bindings.find(x => x.kind === 'ERP');
    const map = bindings.find(x => x.kind === 'MAP');
    expect(erp).toEqual(expect.objectContaining({ provider: 'test-erp-adapter', endpoint: 'https://erp.test.example', configured: true }));
    expect(map).toEqual(expect.objectContaining({ provider: null, endpoint: null, configured: false }));
  });

  it('rejects unknown integration profile by returning undefined', () => {
    expect(getIntegrationProfile('UNKNOWN_INTEGRATION_PROFILE')).toBeUndefined();
  });
});
