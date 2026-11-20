export function decideOpportunityPop(current: unknown, next: unknown, confirmLeave: () => boolean): { kind: 'allow' } | { kind: 'restore'; delta: number } {
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(next) || current === next) return { kind: 'allow' };
  return confirmLeave() ? { kind: 'allow' } : { kind: 'restore', delta: Number(current) - Number(next) };
}

let active = false;
let allowLeave = () => window.confirm('저장하지 않은 입력을 버리고 이동하시겠습니까?');
let currentIndex: unknown;
let restoring = false;
if (typeof window !== 'undefined') window.addEventListener('popstate', event => {
  if (restoring) { restoring = false; event.stopImmediatePropagation(); return; }
  if (!active) return;
  const decision = decideOpportunityPop(currentIndex, event.state?.idx, allowLeave);
  if (decision.kind === 'restore') { event.stopImmediatePropagation(); restoring = true; window.history.go(decision.delta); }
  else currentIndex = event.state?.idx;
}, true);

export function activateOpportunityNavigationGuard(confirmLeave?: () => boolean): () => void {
  if (typeof window === 'undefined') return () => {};
  currentIndex = window.history.state?.idx;
  allowLeave = confirmLeave ?? (() => window.confirm('저장하지 않은 입력을 버리고 이동하시겠습니까?'));
  active = true;
  return () => { active = false; };
}
