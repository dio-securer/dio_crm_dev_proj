import type { GlobalizationContext, ScreenProfileCode } from '@dio-crm/contracts';
import { getScreenProfile, resolveScreenKey, type ScreenKey, type ScreenSlot } from './screen-profile';

export class ScreenResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScreenResolutionError';
  }
}

export function resolveScreenProfileCode(context: GlobalizationContext): ScreenProfileCode {
  if (context.screenProfileCode && getScreenProfile(context.screenProfileCode)) {
    return context.screenProfileCode;
  }

  // Backward compatibility for the approved KR baseline only.
  if (context.countryCode === 'KR' && context.marketProfileCode === 'KR_SALES') {
    return 'HQ_SCREEN_PROFILE';
  }

  throw new ScreenResolutionError('SCREEN_PROFILE_NOT_RESOLVED');
}

export function resolveScreenForSlot(profileCode: ScreenProfileCode, slot: ScreenSlot): ScreenKey {
  const key = resolveScreenKey(profileCode, slot);
  if (!key) throw new ScreenResolutionError(`SCREEN_SLOT_NOT_RESOLVED:${slot}`);
  return key;
}
