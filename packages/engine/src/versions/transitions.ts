// The status machine of a metadata version. Pure: one table, nothing else decides which move is allowed.
import { VersionAction, VersionError, VersionStatus } from './types';

/** action -> the status it starts from -> the status it ends in. A pair not in the table is BAD_STATE. */
export const TRANSITIONS: Readonly<Record<Exclude<VersionAction, 'stage'>, Partial<Record<VersionStatus, VersionStatus>>>> = {
  publish: { staging: 'published' },
  supersede: { published: 'superseded' },
  rollback: { published: 'rolled_back' },
  restore: { superseded: 'published' },
  discard: { staging: 'discarded' },
};

export function nextStatus(action: Exclude<VersionAction, 'stage'>, from: VersionStatus): VersionStatus {
  const to = TRANSITIONS[action][from];
  if (!to) throw new VersionError('BAD_STATE');
  return to;
}
