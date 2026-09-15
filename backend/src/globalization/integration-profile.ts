export type IntegrationAdapterKind = 'ERP' | 'MAP' | 'CUSTOMER_MASTER' | 'PRODUCT';
export type IntegrationProfileStatus = 'ACTIVE' | 'BASELINE_ONLY';

export type IntegrationAdapterBinding = {
  kind: IntegrationAdapterKind;
  providerEnvKey: string;
  endpointEnvKey?: string;
};

export type IntegrationProfileDefinition = {
  code: string;
  status: IntegrationProfileStatus;
  adapters: IntegrationAdapterBinding[];
};

const COMMON_ADAPTER_BOUNDARIES: IntegrationAdapterBinding[] = [
  { kind: 'ERP', providerEnvKey: 'ERP_ADAPTER_PROVIDER', endpointEnvKey: 'ERP_ADAPTER_ENDPOINT' },
  { kind: 'MAP', providerEnvKey: 'MAP_ADAPTER_PROVIDER', endpointEnvKey: 'MAP_ADAPTER_ENDPOINT' },
  { kind: 'CUSTOMER_MASTER', providerEnvKey: 'CUSTOMER_MASTER_ADAPTER_PROVIDER', endpointEnvKey: 'CUSTOMER_MASTER_ADAPTER_ENDPOINT' },
  { kind: 'PRODUCT', providerEnvKey: 'PRODUCT_ADAPTER_PROVIDER', endpointEnvKey: 'PRODUCT_ADAPTER_ENDPOINT' }
];

export const HQ_INTEGRATION_PROFILE: IntegrationProfileDefinition = {
  code: 'HQ_INTEGRATION_PROFILE',
  status: 'ACTIVE',
  adapters: COMMON_ADAPTER_BOUNDARIES
};

/**
 * GLOBAL keeps the same adapter boundaries but remains BASELINE_ONLY until
 * US/MX runtime providers and endpoints are approved. No provider is hardcoded.
 */
export const GLOBAL_INTEGRATION_PROFILE: IntegrationProfileDefinition = {
  code: 'GLOBAL_INTEGRATION_PROFILE',
  status: 'BASELINE_ONLY',
  adapters: COMMON_ADAPTER_BOUNDARIES
};

const registry = new Map<string, IntegrationProfileDefinition>([
  [HQ_INTEGRATION_PROFILE.code, HQ_INTEGRATION_PROFILE],
  [GLOBAL_INTEGRATION_PROFILE.code, GLOBAL_INTEGRATION_PROFILE]
]);

export function getIntegrationProfile(code: string): IntegrationProfileDefinition | undefined {
  return registry.get(code);
}

export function resolveIntegrationBindings(
  profile: IntegrationProfileDefinition,
  environment: Record<string, string | undefined>
) {
  return profile.adapters.map(binding => ({
    kind: binding.kind,
    provider: environment[binding.providerEnvKey]?.trim() || null,
    endpoint: binding.endpointEnvKey ? environment[binding.endpointEnvKey]?.trim() || null : null,
    configured: Boolean(environment[binding.providerEnvKey]?.trim())
  }));
}
