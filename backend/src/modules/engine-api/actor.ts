// The caller of the automatic API, from the verified access token. Team members have no source yet, so a `members`
// rule opens nothing (closed by default); the actor's organization is its only unit.
import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../../security/security';
import type { Caller } from './engine-records';

// F2-7: the token gives the roles; grants and the hierarchy are added from the PUBLISHED settings (metadata/security)
// by EngineRecords (secureActor), never from the request. The hierarchy opens rows only through a `subtree` rule
// declared in an object's access.json, so a widening shows in the settings (D05) and needs a P6 declaration.
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
      roles: Array.isArray(user.roles) ? user.roles.filter(r => typeof r === 'string') : [],
      unitIds: unit === undefined || unit === null ? [] : [String(unit)],
      memberIds: [],
    },
  };
}
