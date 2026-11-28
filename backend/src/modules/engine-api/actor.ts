// The caller of the automatic API, from the verified access token. Team members have no source yet, so a `members`
// rule opens nothing (closed by default); the actor's organization is its only unit.
import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../../security/security';
import type { Caller } from './engine-records';

// F2-7: deliberately not wired to the org chart or to permission grants. Adding withHierarchy(actor, chart) here
// would let unit heads see their subordinates' rows, i.e. it WIDENS row access compared with today; it needs a P6
// declaration in guard-raises.json or the owner's explicit approval, and a settings source for the chart and grants,
// which waits on the metamodel change (packages/contracts/src/metadata) the owner has not approved yet.
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
