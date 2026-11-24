export type AccountEditorState = { dirty: boolean; busy: boolean };

export function hasRestrictedAccountChanges(form: Record<string, unknown>, baseline: Record<string, unknown>, writable: (key: string) => boolean): boolean {
  return Object.keys(form).some(key => form[key] !== baseline[key] && !writable(key));
}

export function canLeaveAccountEditor(state: AccountEditorState, confirmDiscard: () => boolean): boolean {
  if (state.busy) return false;
  return !state.dirty || confirmDiscard();
}

export function accountSystemOptions(current: string): string[] {
  return [...new Set(['', '디오', '오스템', '덴티움', '메가젠', '덴티스', '네오', 'IBS', '기타', ...(current ? [current] : [])])];
}

export function decideAccountHistoryChange(current: unknown, next: unknown, allow: () => boolean): { restore?: number } {
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(next) || current === next) return {};
  return allow() ? {} : { restore: Number(current) - Number(next) };
}

const historyGuards = new Set<() => boolean>();
let historyIndex: unknown;
let restoring = false;
// Register before BrowserRouter mounts so a rejected pop never reaches route consumers.
if (typeof window !== 'undefined') window.addEventListener('popstate', event => {
  if (restoring) { restoring = false; event.stopImmediatePropagation(); return; }
  if (!historyGuards.size) return;
  const decision = decideAccountHistoryChange(historyIndex, event.state?.idx, () => [...historyGuards].every(allow => allow()));
  if (decision.restore !== undefined) {
    event.stopImmediatePropagation(); restoring = true; window.history.go(decision.restore);
  } else historyIndex = event.state?.idx;
}, true);

export function activateAccountHistoryGuard(allow: () => boolean): () => void {
  if (typeof window === 'undefined') return () => {};
  historyIndex = window.history.state?.idx;
  historyGuards.add(allow);
  return () => { historyGuards.delete(allow); };
}
