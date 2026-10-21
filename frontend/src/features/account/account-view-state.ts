import type { AccountScope } from '../../account-model';
import { EMPTY_ACCOUNT_LIST_FILTERS, type AccountListFilters } from './account-list-model';

export type AccountListPersistedState = {
  filters: AccountListFilters;
  page: number;
  pageSize: number;
  scrollTop: number;
};

export type AccountPagePersistedState<TTab extends string> = {
  scope: AccountScope;
  selectedId: string | null;
  tab: TTab;
  mobileDetailOpen: boolean;
};

export const DEFAULT_ACCOUNT_LIST_STATE: AccountListPersistedState = {
  filters: EMPTY_ACCOUNT_LIST_FILTERS,
  page: 1,
  pageSize: 10,
  scrollTop: 0
};

export function loadAccountListState(storageKey?: string): AccountListPersistedState {
  if (!storageKey) return DEFAULT_ACCOUNT_LIST_STATE;
  try {
    const raw = globalThis.sessionStorage?.getItem(storageKey);
    if (!raw) return DEFAULT_ACCOUNT_LIST_STATE;
    const parsed = JSON.parse(raw) as Partial<AccountListPersistedState>;
    return {
      filters: { ...EMPTY_ACCOUNT_LIST_FILTERS, ...(parsed.filters ?? {}) },
      page: Number(parsed.page) > 0 ? Number(parsed.page) : 1,
      pageSize: [10, 20, 50].includes(Number(parsed.pageSize)) ? Number(parsed.pageSize) : 10,
      scrollTop: Math.max(0, Number(parsed.scrollTop) || 0)
    };
  } catch {
    return DEFAULT_ACCOUNT_LIST_STATE;
  }
}

export function saveAccountListState(storageKey: string | undefined, state: AccountListPersistedState) {
  if (!storageKey) return;
  try {
    globalThis.sessionStorage?.setItem(storageKey, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function loadAccountPageState<TTab extends string>(storageKey: string, defaults: AccountPagePersistedState<TTab>): AccountPagePersistedState<TTab> {
  try {
    const raw = globalThis.sessionStorage?.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AccountPagePersistedState<TTab>>;
    return {
      scope: parsed.scope === 'mine' || parsed.scope === 'all' || parsed.scope === 'managed' ? parsed.scope : defaults.scope,
      selectedId: typeof parsed.selectedId === 'string' ? parsed.selectedId : null,
      tab: (parsed.tab as TTab) || defaults.tab,
      mobileDetailOpen: Boolean(parsed.mobileDetailOpen)
    };
  } catch {
    return defaults;
  }
}

export function saveAccountPageState<TTab extends string>(storageKey: string, state: AccountPagePersistedState<TTab>) {
  try {
    globalThis.sessionStorage?.setItem(storageKey, JSON.stringify(state));
  } catch {
    // ignore
  }
}
