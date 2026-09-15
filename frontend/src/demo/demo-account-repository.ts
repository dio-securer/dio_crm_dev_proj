import { DEMO_ACCOUNT_SEED, type DemoAccount, type DemoAccountDraft } from './demo-data';

const STORAGE_KEY = 'dio_crm_demo_accounts_v1';

function cloneSeed(): DemoAccount[] {
  return DEMO_ACCOUNT_SEED.map(row => ({ ...row }));
}

export function loadDemoAccounts(): DemoAccount[] {
  if (typeof window === 'undefined') return cloneSeed();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = cloneSeed();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as DemoAccount[];
    return Array.isArray(parsed) && parsed.length ? parsed : cloneSeed();
  } catch {
    return cloneSeed();
  }
}

export function saveDemoAccounts(rows: DemoAccount[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function resetDemoAccounts(): DemoAccount[] {
  const rows = cloneSeed();
  saveDemoAccounts(rows);
  return rows;
}

export function nextDemoAccountCode(rows: DemoAccount[], country: string): string {
  const prefix = country === 'India' ? 'IN' : country === 'Mexico' ? 'MX' : country === 'United States' ? 'US' : 'GL';
  const max = rows
    .filter(row => row.accountCode.startsWith(`${prefix}-CUST-`))
    .map(row => Number(row.accountCode.split('-').at(-1)))
    .filter(Number.isFinite)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-CUST-${String(max + 1).padStart(4, '0')}`;
}

export function createDemoAccount(rows: DemoAccount[], draft: DemoAccountDraft): DemoAccount[] {
  const account: DemoAccount = {
    ...draft,
    publicId: `acc-demo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    accountCode: nextDemoAccountCode(rows, draft.country)
  };
  const next = [account, ...rows];
  saveDemoAccounts(next);
  return next;
}

export function updateDemoAccount(rows: DemoAccount[], publicId: string, draft: DemoAccountDraft): DemoAccount[] {
  const next = rows.map(row => row.publicId === publicId ? { ...row, ...draft } : row);
  saveDemoAccounts(next);
  return next;
}
