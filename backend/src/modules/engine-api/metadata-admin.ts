// Admin work on metadata versions over HTTP (F2-7): stage, publish, rollback, discard. Only admins (engine AdminVersions);
// the future screen editor (F6) goes through these routes. A refused or wrong request is an HTTP answer, never a 500.
import { HttpException } from '@nestjs/common';
import { ADMIN_PERMISSIONS, VersionError } from '@dio-crm/engine';
import type { AdminVersions, VersionActor } from '@dio-crm/engine';
import type { JwtPayload } from '../../security/security';

const STATUS: Record<string, number> = { FORBIDDEN: 403, NOT_FOUND: 404, BAD_STATE: 409, NO_PREVIOUS: 409, NO_PUBLISHED: 409, INVALID_METADATA: 422, INCOMPATIBLE: 422 };
export function versionHttp(error: unknown): unknown {
  if (!(error instanceof VersionError)) return error;
  const status = STATUS[error.code] ?? 400;
  return new HttpException({ statusCode: status, error: error.code, issues: error.issues }, status);
}
const bad = (code: string) => new HttpException({ statusCode: 400, error: code, issues: [] }, 400);

export function versionActorOf(user: JwtPayload | undefined): VersionActor {
  if (!user || typeof user.publicId !== 'string' || !user.publicId) throw new VersionError('FORBIDDEN');
  return { userId: user.publicId, permissions: Array.isArray(user.permissions) ? [...user.permissions] : [] };
}

const ID = /^[1-9][0-9]{0,14}$/;
function idOf(raw: string): number { if (!ID.test(raw)) throw new VersionError('NOT_FOUND'); return Number(raw); }

function filesOf(body: unknown): { files: { path: string; content: string }[]; note?: string } {
  const b = body as { files?: unknown; note?: unknown } | null;
  if (!b || typeof b !== 'object' || !Array.isArray(b.files) || b.files.length === 0) throw bad('BAD_FILES');
  const files = b.files.map(f => {
    if (!f || typeof f.path !== 'string' || typeof f.content !== 'string') throw bad('BAD_FILES');
    return { path: f.path, content: f.content };
  });
  if (b.note !== undefined && (typeof b.note !== 'string' || b.note.length > 500)) throw bad('BAD_NOTE');
  return { files, ...(typeof b.note === 'string' ? { note: b.note } : {}) };
}

export class MetadataAdmin {
  constructor(private readonly versions: AdminVersions) {}
  private async run<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); } catch (error) { throw versionHttp(error); }
  }
  stage(user: JwtPayload | undefined, body: unknown) {
    // The permission is checked before the body is read: a non-admin learns nothing about what a valid body is.
    return this.run(async () => { const actor = versionActorOf(user);
      if (!actor.permissions.includes(ADMIN_PERMISSIONS.edit)) throw new VersionError('FORBIDDEN');
      const { files, note } = filesOf(body); return { id: await this.versions.stage(files, actor, note) }; });
  }
  publish(user: JwtPayload | undefined, id: string) {
    return this.run(async () => { const v = await this.versions.publish(idOf(id), versionActorOf(user)); return { id: v.id, status: v.status }; });
  }
  rollback(user: JwtPayload | undefined) {
    return this.run(async () => { const v = await this.versions.rollback(versionActorOf(user)); return { id: v.id, status: v.status }; });
  }
  discard(user: JwtPayload | undefined, id: string) {
    return this.run(async () => { await this.versions.discard(idOf(id), versionActorOf(user)); return { id: Number(id), status: 'discarded' }; });
  }
}
