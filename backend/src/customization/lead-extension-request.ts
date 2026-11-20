import { z } from 'zod';
import type { AuthenticatedRequest } from '../security/security';
import { configAssert } from './config-store';
import { writeLeadWithExtensions, readLeadWithExtensions, listLeadExtensionCreateFields, type LeadExtensionActor, type LeadExtensionAtomicPort } from './lead-extension-contract';

/** Trusted deployment code may provide an atomic port. The application default is null. */
export const LEAD_EXTENSION_PORT = Symbol('LEAD_EXTENSION_PORT');
export type LeadExtensionPortFactory = (actor: LeadExtensionActor, userKey: number) => LeadExtensionAtomicPort;

export function hasExtensionPayload(body: unknown): boolean {
  return !!body && typeof body === 'object' && !Array.isArray(body) && Object.hasOwn(body, 'extensions');
}
export function wantsExtensionRead(query: unknown): boolean {
  return !!query && typeof query === 'object' && !Array.isArray(query) && Object.hasOwn(query, 'extensions');
}

const item = z.object({ definitionVersion: z.number().int().positive().max(2147483647), value: z.union([z.string().max(4000), z.number().finite(), z.boolean(), z.null()]) }).strict();
const common = { base: z.record(z.unknown()), extensions: z.record(item) };
const create = z.object(common).strict();
const detail = z.object({ ...common, expectedBaseVersion: z.string().regex(/^0x[0-9a-f]{16}$/i), expectedExtensionRevision: z.number().int().min(0).max(2147483646) }).strict();

/** Only the explicit extension envelope uses this path; no client-supplied company or grants. */
export async function executeLeadExtensionRequest(req: AuthenticatedRequest, actor: LeadExtensionActor, userKey: number, mode: 'create'|'detail', provider?: LeadExtensionPortFactory | null) {
  configAssert(provider, 503, 'EXTENSION_ADAPTER_UNAVAILABLE');
  configAssert(Object.keys(req.query ?? {}).length === 0, 422, 'UNSUPPORTED_QUERY');
  const releaseId = z.string().uuid().parse(req.headers['x-config-release-id']).toLowerCase();
  const permissionVersion = z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version']);
  const key = req.headers['idempotency-key'];
  configAssert(typeof key === 'string', 428, 'IDEMPOTENCY_REQUIRED');
  const input = mode === 'create' ? { mode, ...create.parse(req.body) } : { mode, recordId: z.string().uuid().parse(req.path.replace(/\/$/, '').split('/').at(-1)).toLowerCase(), ...detail.parse(req.body) };
  const result = await writeLeadWithExtensions(provider(actor, userKey), actor, { releaseId, permissionVersion }, key, input);
  return { releaseId: result.releaseId, permissionVersion: result.permissionVersion, data: { public_id: result.recordId, version: result.baseVersion, extensionRevision: result.extensionRevision } };
}

export async function readLeadExtensionRequest(req: AuthenticatedRequest, actor: LeadExtensionActor, userKey: number, mode: 'create'|'detail', provider?: LeadExtensionPortFactory | null) {
  configAssert(provider, 503, 'EXTENSION_ADAPTER_UNAVAILABLE');
  if(mode==='detail')configAssert(Object.keys(req.query??{}).length===1&&req.query.extensions==='1',422,'UNSUPPORTED_QUERY');
  else configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
  const releaseId=z.string().uuid().parse(req.headers['x-config-release-id']).toLowerCase();
  const permissionVersion=z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version']);
  const port=provider(actor,userKey),context={releaseId,permissionVersion};
  if(mode==='create'){const data=await listLeadExtensionCreateFields(port,actor,context);return {...context,data};}
  const id=z.string().uuid().parse(req.path.replace(/\/$/,'').split('/').at(-1));
  const result=await readLeadWithExtensions(port,actor,context,id);
  configAssert(result.base,503,'EXTENSION_BASE_READ_UNAVAILABLE');
  return {...context,data:{...result.base,public_id:result.recordId,version:result.baseVersion,extensionRevision:result.extensionRevision,extensionValues:result.values,extensionFields:result.definitions}};
}
