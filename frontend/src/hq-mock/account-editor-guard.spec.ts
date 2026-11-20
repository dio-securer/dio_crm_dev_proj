import { expect, it, vi } from 'vitest';
import { canLeaveAccountEditor, decideAccountHistoryChange, accountSystemOptions, hasRestrictedAccountChanges } from './account-editor-guard';

it('blocks pending writes even when discard is confirmed', () => {
  const confirm = vi.fn(() => true);
  expect(canLeaveAccountEditor({ dirty: true, busy: true }, confirm)).toBe(false);
  expect(confirm).not.toHaveBeenCalled();
});
it('retains drafts on cancel and allows explicit discard or a clean editor', () => {
  expect(canLeaveAccountEditor({ dirty: true, busy: false }, () => false)).toBe(false);
  expect(canLeaveAccountEditor({ dirty: true, busy: false }, () => true)).toBe(true);
  const confirm = vi.fn(() => false);
  expect(canLeaveAccountEditor({ dirty: false, busy: false }, confirm)).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
});

it('restores known history entries on rejected navigation without guessing external history', () => {
  expect(decideAccountHistoryChange(3, 1, () => false)).toEqual({restore:2});
  expect(decideAccountHistoryChange(3, 4, () => false)).toEqual({restore:-1});
  expect(decideAccountHistoryChange(3, 1, () => true)).toEqual({});
  expect(decideAccountHistoryChange(undefined, 1, () => false)).toEqual({});
});
it('retains unregistered system values alongside observed sandbox options', () => {
  expect(accountSystemOptions('LEGACY')).toContain('LEGACY');
  expect(accountSystemOptions('디오').filter(x=>x==='디오')).toHaveLength(1);
  expect(accountSystemOptions('')).toContain('IBS');
});

it('releases global pop handling after editor unmount and leaves unrelated navigation untouched', async () => {
  let listener: (event: any) => void = () => {};
  const go = vi.fn();
  vi.stubGlobal('window', { history: { state: { idx: 3 }, go }, addEventListener: (_: string, fn: any) => { listener = fn; } });
  try {
    vi.resetModules();
    const {activateAccountHistoryGuard} = await import('./account-editor-guard');
    const stop = vi.fn();
    listener({state:{idx:2},stopImmediatePropagation:stop});
    expect(stop).not.toHaveBeenCalled();
    const release=activateAccountHistoryGuard(()=>false);
    listener({state:{idx:2},stopImmediatePropagation:stop});
    expect(go).toHaveBeenCalledWith(1);
    listener({state:{idx:3},stopImmediatePropagation:stop});
    release(); stop.mockClear(); go.mockClear();
    listener({state:{idx:2},stopImmediatePropagation:stop});
    expect(stop).not.toHaveBeenCalled(); expect(go).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});

it('retains a changed field when write access disappears without blocking unchanged read-only fields',()=>{
 expect(hasRestrictedAccountChanges({note:'draft',phone:'123'},{note:'saved',phone:'123'},()=>false)).toBe(true);
 expect(hasRestrictedAccountChanges({note:'saved',phone:'123'},{note:'saved',phone:'123'},()=>false)).toBe(false);
});
