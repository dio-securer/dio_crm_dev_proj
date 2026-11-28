// The caller of the automatic API, from the verified access token. Team members have no source yet, so a `members`
// rule opens nothing (closed by default); the actor's organization is its only unit.
import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../../security/security';
import type { Caller } from './engine-records';

export function callerOf(user: JwtPayload | undefined): Caller {
  if (!user || typeof user.publicId !== 'string' || !user.publicId || !Number.isSafeInteger(user.companyId)) {
    throw new ForbiddenException('ENGINE_API_NO_ACTOR');
  }
  const unit = user.organizationId;
  return {
    companyId: user.companyId,
    actor: {
      userId: user.publicId,
      permissions: Array.isArray(user.permissions) ? [...user.permissions] : [],
      unitIds: unit === undefined || unit === null ? [] : [String(unit)],
      memberIds: [],
    },
  };
}
