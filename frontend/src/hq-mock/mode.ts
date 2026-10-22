/** HQ HTTP mock is explicit and owns only its own per-tab session keys. */
export const HQ_MODE_KEY = 'dio_crm_hq_mode';
export const HQ_TOKEN_KEY = 'dio_crm_hq_access_token';
export const HQ_SCENARIO_KEY = 'dio_crm_hq_scenario';
export const HQ_SCENARIOS = ['SUCCESS', 'FAILURE', 'DELAY'] as const;
export type HqScenario = typeof HQ_SCENARIOS[number];

const volatile = new Map<string, string>();
function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.sessionStorage.getItem(key) ?? volatile.get(key) ?? null; }
  catch { return volatile.get(key) ?? null; }
}
function write(key: string, value: string | null) {
  if (value === null) volatile.delete(key); else volatile.set(key, value);
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch { /* A blocked session store still permits an in-memory mock session. */ }
}

export function isHqMockMode(): boolean {
  if (typeof window === 'undefined') return false;
  const query = new URLSearchParams(window.location.search);
  const demo = query.get('demo');
  if (demo === 'global' || demo === 'global-executive') {
    write(HQ_MODE_KEY, 'off');
    return false;
  }
  if (query.get('hq') === 'off') {
    write(HQ_MODE_KEY, 'off');
    write(HQ_TOKEN_KEY, null);
    return false;
  }
  if (query.get('hq') === '1') {
    write(HQ_MODE_KEY, 'on');
    return true;
  }
  const saved = read(HQ_MODE_KEY);
  if (saved === 'off') return false;
  if (saved === 'on') return true;
  return (window as Window & { __DIO_CRM_HQ_MOCK__?: boolean }).__DIO_CRM_HQ_MOCK__ === true;
}

export function getHqToken(): string | null { return read(HQ_TOKEN_KEY); }
export function setHqToken(token: string | null) { write(HQ_TOKEN_KEY, token); }
export function getHqScenario(): HqScenario {
  const value = read(HQ_SCENARIO_KEY);
  return HQ_SCENARIOS.includes(value as HqScenario) ? value as HqScenario : 'SUCCESS';
}
export function setHqScenario(scenario: HqScenario) {
  if (!HQ_SCENARIOS.includes(scenario)) throw new Error('HQ_SCENARIO_NOT_REGISTERED');
  write(HQ_SCENARIO_KEY, scenario);
}

export function hqApiPath(path: string): string {
  if (typeof window === 'undefined' || !path.startsWith('/api/') || path.includes('\\')) {
    throw new Error('HQ_MOCK_REQUIRES_SAME_ORIGIN_API');
  }
  const parsed = new URL(path, window.location.origin);
  if (parsed.origin !== window.location.origin || !parsed.pathname.startsWith('/api/')) {
    throw new Error('HQ_MOCK_REQUIRES_SAME_ORIGIN_API');
  }
  return `${parsed.pathname}${parsed.search}`;
}
