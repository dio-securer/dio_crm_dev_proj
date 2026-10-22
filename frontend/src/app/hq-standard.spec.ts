import { describe, expect, it, vi } from 'vitest';
import { ACCOUNT_INTERFACE_FIELDS, createHqPolicy, validateHqStandard, type HqContext } from '@dio-crm/contracts';
import { HQ_STANDARD, HQ_CAPABILITIES } from './hq-standard';
import { HQ_CATALOG_IDS } from './hq-standard-registry';
import { APP_ROUTES } from './route-config';
import { GLOBAL_SCREEN_PROFILE, HQ_SCREEN_PROFILE, type ScreenKey } from './screen-profile';
import { getRegisteredScreen } from './screen-registry';
import { HQ_SCREEN_KEYS } from '../market/templates/hq/hq-screen-manifest';

// This suite verifies real registry/component references, not DOM rendering or HTTP.
// Vitest hoists this boundary mock before page imports: production api.ts reads
// window at module load. Keep all renderers real and forbid network/download calls.
vi.mock('../api', () => {
  const forbidden = () => { throw new Error('H01_REGISTRY_TEST_FORBIDS_NETWORK_OR_DOWNLOAD'); };
  return {
    apiGet: forbidden,
    apiPost: forbidden,
    apiPatch: forbidden,
    apiDownload: forbidden,
    apiPostDownload: forbidden,
    saveBlob: forbidden
  };
});

describe('H01 actual frontend registration glue', () => {
  it('validates the actual exported HQ metadata through the package public API', () => {
    expect(validateHqStandard(HQ_STANDARD, HQ_CAPABILITIES)).toEqual({ valid: true, errors: [] });
  });

  it('binds the existing fourteen HQ routes to registered React components', () => {
    expect(HQ_STANDARD.screens).toHaveLength(14);
    expect(HQ_STANDARD.screens.map(screen => screen.screenKey).sort()).toEqual([...HQ_SCREEN_KEYS].sort());
    for (const route of APP_ROUTES) {
      const screenKey = HQ_SCREEN_PROFILE.screens[route.slot]!;
      expect(getRegisteredScreen(screenKey)).toBeDefined();
      expect(HQ_CAPABILITIES.screens).toContainEqual({ screenKey, routeKey: route.slot, path: route.path });
      expect(HQ_STANDARD.screens.find(screen => screen.screenKey === screenKey)).toMatchObject({ routeKey: route.slot, path: route.path });
    }
  });

  it('preserves 34 catalog references and the additional operational entry without inventing renderers', () => {
    expect(HQ_CATALOG_IDS).toHaveLength(34);
    expect(HQ_STANDARD.coverage.filter(row => row.origin === 'catalog').map(row => row.catalogId).sort()).toEqual([...HQ_CATALOG_IDS].sort());
    expect(HQ_STANDARD.coverage.filter(row => row.origin === 'additional').map(row => row.catalogId)).toEqual(['HQ-OPS-ENTRY']);
    for (const row of HQ_STANDARD.coverage.filter(row => row.planned)) {
      expect(row.enabled).toBe(false);
      expect(row.screenKeys).toEqual([]);
    }
    expect(HQ_STANDARD.screens.find(screen => screen.path === '/')?.screenKey).toBe('HQ_LEAD');
  });

  it('reuses all 25 account interface stable codes without claiming unsupported fields are writable', () => {
    for (const item of ACCOUNT_INTERFACE_FIELDS) {
      expect(HQ_STANDARD.fields.find(field => field.fieldKey === `account.erp.${item.code}`)).toBeDefined();
    }
    expect(HQ_STANDARD.fields.find(field => field.fieldKey === 'lead.keymanNote')?.current.write).toBe(false);
    expect(HQ_STANDARD.fields.find(field => field.fieldKey === 'account.erp.cust_nm')).toMatchObject({ current: { write: true }, readOnly: true });
    expect(HQ_STANDARD.actions.some(action => action.actionKey === 'OPP.saveNegotiation')).toBe(true);
  });

  it('rejects a route mismatch in the actual registry', () => {
    const changed = structuredClone(HQ_STANDARD);
    changed.screens[0].path = '/not-a-registered-route';
    expect(validateHqStandard(changed, HQ_CAPABILITIES).valid).toBe(false);
    expect(() => createHqPolicy(changed, HQ_CAPABILITIES)).toThrow();
  });

  it('does not treat shared-screen navigation as permission for an inactive process action', () => {
    const policy = createHqPolicy(HQ_STANDARD, HQ_CAPABILITIES);
    const context: HqContext = {
      activeProcesses: HQ_STANDARD.processes.filter(process => process.enabled && process.processKey !== 'HQ.COLLECTION').map(process => process.processKey),
      permissions: [...new Set([...HQ_STANDARD.processes, ...HQ_STANDARD.screens, ...HQ_STANDARD.actions].flatMap(item => item.permissions))],
      features: HQ_CAPABILITIES.featureKeys,
      values: {},
      device: 'desktop'
    };
    expect(policy.screenAllowed('HQ_CONTRACT', context)).toBe(true);
    expect(policy.actionAllowed('COL.planChange', context)).toBe(false);
    expect(policy.screenAllowed('NOT_REGISTERED', context)).toBe(false);
  });

  it('keeps the seven GLOBAL renderer bindings and HQ/GLOBAL separation unchanged', () => {
    const keys = Object.values(GLOBAL_SCREEN_PROFILE.screens);
    expect(keys).toHaveLength(7);
    for (const key of keys) {
      expect(key).toMatch(/^GLOBAL_/);
      expect(getRegisteredScreen(key as ScreenKey)).toBeDefined();
      expect(HQ_STANDARD.screens.some(screen => screen.screenKey === key)).toBe(false);
    }
    expect(GLOBAL_SCREEN_PROFILE.screens.directWork).toBeUndefined();
  });

  it('rejects unregistered transition states and binds the requested target to the actual destination', () => {
    const malformed = structuredClone(HQ_STANDARD);
    malformed.transitions.find(item => item.transitionKey === 'LEAD.firstVisit')!.toState = 'NOT_REGISTERED';
    expect(validateHqStandard(malformed, HQ_CAPABILITIES).valid).toBe(false);
    const changed = structuredClone(HQ_STANDARD);
    const transition = changed.transitions.find(item => item.transitionKey === 'LEAD.firstVisit')!;
    expect(transition.targetFieldKey).toBe('lead.targetStatus');
    transition.toState = 'KEYMAN_MEETING';
    transition.condition = { kind: 'constant', value: true };
    const context: HqContext = {
      activeProcesses: changed.processes.filter(item => item.enabled).map(item => item.processKey),
      permissions: ['LEAD.READ', 'LEAD.WRITE'],
      features: HQ_CAPABILITIES.featureKeys,
      values: { 'lead.status': 'NEW', 'lead.targetStatus': 'FIRST_VISIT' }
    };
    expect(createHqPolicy(changed, HQ_CAPABILITIES).transitionAllowed(transition.transitionKey, context)).toBe(false);
  });

  it('does not expose approval-field write access to direct-work readers', () => {
    const policy = createHqPolicy(HQ_STANDARD, HQ_CAPABILITIES);
    const context: HqContext = {
      activeProcesses: HQ_STANDARD.processes.filter(item => item.enabled).map(item => item.processKey),
      permissions: ['DIRECT_WORK.READ'],
      features: HQ_CAPABILITIES.featureKeys,
      values: { 'directWork.status': 'REQUESTED' }
    };
    expect(policy.screenAllowed('HQ_DIRECT_WORK', context)).toBe(true);
    expect(policy.fieldWritable('directWork.comment', context)).toBe(false);
    expect(policy.fieldWritable('directWork.decision', context)).toBe(false);
    expect(policy.fieldWritable('directWork.comment', {
      ...context, permissions: [...context.permissions, 'DIRECT_WORK.APPROVE.BRANCH']
    })).toBe(true);
  });

  it('registers merge, calendar and map mandatory inputs from current controller contracts', () => {
    const required = (key: string) => HQ_STANDARD.actions.find(item => item.actionKey === key)!.requiredFieldKeys;
    expect(required('ACC.merge')).toEqual(expect.arrayContaining(['merge.primaryPublicId', 'merge.duplicatePublicIds']));
    expect(required('ACT.calendar')).toEqual(expect.arrayContaining(['activity.calendarFrom', 'activity.calendarTo']));
    expect(required('ACT.map')).toEqual(expect.arrayContaining(['activity.mapDate', 'activity.latitude', 'activity.longitude']));
    expect(HQ_STANDARD.fields.find(item => item.fieldKey === 'merge.duplicatePublicIds')?.valueRule).toEqual({ type: 'rows', minLength: 1, maxLength: 2 });
  });

  it('rejects a hidden quantity fallback whose permitted source value is outside quantity bounds', () => {
    const changed = structuredClone(HQ_STANDARD);
    const target = changed.fields.find(item => item.fieldKey === 'opportunity.quantity')!;
    const source = changed.fields.find(item => item.fieldKey === 'opportunity.successProbability')!;
    target.visible = false;
    target.requiredRule = { kind: 'constant', value: true };
    target.hiddenFallback = { kind: 'field', fieldKey: source.fieldKey };
    source.requiredRule = { kind: 'constant', value: true };
    source.valueRule = { type: 'number', min: 0, max: 0, integer: true };
    delete source.defaultValue;
    expect(validateHqStandard(changed, HQ_CAPABILITIES).valid).toBe(false);
  });
});
