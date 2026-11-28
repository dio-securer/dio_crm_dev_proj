import { z } from 'zod';
import { findLogicEvent } from '@dio-crm/contracts/logic-events';

/** Contract-only host boundary. This is not a sandbox or an enabled execution route.
 * No module registers a runtime. A future executor must provide OS-level isolation,
 * termination and capability mediation before it can be used with untrusted code. */
export type LogicExecutionErrorCode =
  'LOGIC_INVALID_REQUEST' | 'LOGIC_UNAVAILABLE' | 'LOGIC_FORBIDDEN' |
  'LOGIC_INVALID_CONTEXT' | 'LOGIC_INVALID_RESULT' | 'LOGIC_TIMEOUT' | 'LOGIC_EXECUTION_FAILED';
export class LogicExecutionError extends Error {
  constructor(readonly code: LogicExecutionErrorCode) { super(code); this.name = 'LogicExecutionError'; }
}

const MAX_INPUT_BYTES = 16 * 1024;
const MAX_OUTPUT_BYTES = 16 * 1024;
const MAX_DEADLINE_MS = 1000;
const uuid = z.string().uuid().transform(s => s.toLowerCase());
const id = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  .refine(s => !['__proto__', 'constructor', 'prototype'].includes(s));
const scalar = z.union([z.string().max(4096), z.number().finite(), z.boolean(), z.null()]);
const fields = z.record(id, scalar).refine(v => Object.keys(v).length <= 64);
export const logicInvocationSchema = z.object({
  companyId: uuid, actorId: uuid, releaseId: uuid,
  screenId: id, eventId: id, registryVersion: z.literal(1),
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/),
  input: z.object({ changedFieldId: id.optional(), values: fields }).strict(),
}).strict();

const proposal = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('display-proposal'), fieldId: id, visible: z.boolean() }).strict(),
  z.object({ kind: z.literal('calculation-proposal'), fieldId: id, value: scalar }).strict(),
  z.object({ kind: z.literal('validation-errors'), fieldId: id, code: id }).strict(),
  z.object({ kind: z.literal('command-proposal'), commandId: id, args: fields }).strict(),
]);
const resultSchema = z.object({ proposals: z.array(proposal).max(32) }).strict();
const grantSchema = z.object({
  companyId:uuid, actorId:uuid, releaseId:uuid, eventId:id,
  artifactHash:z.string().regex(/^[a-f0-9]{64}$/), authorized:z.boolean(),
  readableFields:z.array(id).max(128), writableFields:z.array(id).max(128), commandIds:z.array(id).max(64),
}).strict();
export type LogicInvocation = z.infer<typeof logicInvocationSchema>;
export type LogicExecutionResult = z.infer<typeof resultSchema>;

/** Trusted host result, built from current authenticated actor and active release.
 * A caller must not populate it from request claims or the untrusted executor.
 * The host checks it before dispatch AND after the isolated executor returns. */
export interface LogicExecutionGrant {
  companyId: string; actorId: string; releaseId: string; eventId: string; artifactHash: string;
  authorized: boolean;
  readableFields: readonly string[];
  writableFields: readonly string[];
  commandIds: readonly string[];
}
export interface LogicExecutionAuthority {
  /** Must honor cancellation independently; signal alone does not guarantee cleanup. */
  current(invocation: LogicInvocation, options: { signal: AbortSignal }): Promise<LogicExecutionGrant | null>;
}
/** Executor adapter is a transport only. AbortSignal is NOT proof of process termination.
 * Its implementation must enforce termination and resource limits independently. */
export interface LogicIsolatedExecutor {
  run(invocation: LogicInvocation, options: { signal: AbortSignal; deadlineMs: number }): Promise<unknown>;
}

// Only JSON data properties are accepted. Plain and null-prototype objects are both
// supported; custom prototypes, sparse arrays, accessors and hidden properties are not.
// This is not a boundary against hostile in-process Proxy traps; transport must decode
// bounded JSON outside the untrusted process before calling this contract.
function data(value: unknown, code: 'LOGIC_INVALID_REQUEST' | 'LOGIC_INVALID_RESULT', max: number): unknown {
  try {
    const seen = new Set<object>(); let count = 0;
    const copy = (v: unknown, depth: number): unknown => {
      if (++count > 4096 || depth > 16) throw new Error();
      if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v !== 'object') throw new Error();
      if (seen.has(v)) throw new Error();
      seen.add(v);
      const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
      if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new Error();
      const descriptors = Object.getOwnPropertyDescriptors(v);
      if (Object.getOwnPropertySymbols(v).length) throw new Error();
      const keys = Object.keys(descriptors);
      const result: Record<string, unknown> | unknown[] = array ? [] : Object.create(null);
      for (const key of keys) {
        if (array && key === 'length') continue;
        if (['__proto__', 'constructor', 'prototype', 'toJSON'].includes(key)) throw new Error();
        const desc = descriptors[key];
        if (!desc.enumerable || !('value' in desc)) throw new Error();
        if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= (v as unknown[]).length)) throw new Error();
        (result as Record<string, unknown>)[key] = copy(desc.value, depth + 1);
      }
      if (array && keys.length - 1 !== (v as unknown[]).length) throw new Error();
      seen.delete(v);
      return result;
    };
    const clean = copy(value, 0);
    const json = JSON.stringify(clean);
    if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > max) throw new Error();
    return clean;
  } catch { throw new LogicExecutionError(code); }
}
function assertGrant(invocation: LogicInvocation, raw: LogicExecutionGrant | null): LogicExecutionGrant {
  if (!raw) throw new LogicExecutionError('LOGIC_FORBIDDEN');
  const parsed = grantSchema.safeParse(raw);
  if (!parsed.success) throw new LogicExecutionError('LOGIC_INVALID_CONTEXT');
  const grant = parsed.data;
  if (!grant.authorized) throw new LogicExecutionError('LOGIC_FORBIDDEN');
  if (grant.companyId !== invocation.companyId || grant.actorId !== invocation.actorId ||
      grant.releaseId !== invocation.releaseId || grant.eventId !== invocation.eventId ||
      grant.artifactHash !== invocation.artifactHash) throw new LogicExecutionError('LOGIC_INVALID_CONTEXT');
  if (Object.keys(invocation.input.values).some(field => !grant.readableFields.includes(field)) ||
      (invocation.input.changedFieldId && !grant.readableFields.includes(invocation.input.changedFieldId))) {
    throw new LogicExecutionError('LOGIC_FORBIDDEN');
  }
  return grant;
}
async function currentGrant(authority:LogicExecutionAuthority, invocation:LogicInvocation, signal:AbortSignal):Promise<LogicExecutionGrant|null> {
  try { return await authority.current(structuredClone(invocation), {signal}); }
  catch { throw new LogicExecutionError('LOGIC_UNAVAILABLE'); }
}

/** No default authority, provider or endpoint: missing dependencies fail closed.
 * Runtime event metadata remains not-implemented; this contract never marks an event runnable.
 * The executor is only a port; production must not wire it before independent sandbox review.
 * No proposal is applied here. At application/commit, the host MUST recheck the actor,
 * target permissions and active release identity atomically in the same transaction as
 * the actual write. A pre-return check alone cannot prevent a concurrent permission change. */
export class LogicExecutionContract {
  constructor(private readonly authority: LogicExecutionAuthority | null = null, private readonly executor: LogicIsolatedExecutor | null = null) {}
  async run(raw: unknown): Promise<LogicExecutionResult> {
    const parsed = logicInvocationSchema.safeParse(data(raw, 'LOGIC_INVALID_REQUEST', MAX_INPUT_BYTES));
    if (!parsed.success) throw new LogicExecutionError('LOGIC_INVALID_REQUEST');
    const invocation = parsed.data;
    const event = findLogicEvent(invocation.screenId, invocation.eventId, invocation.registryVersion);
    if (!event) throw new LogicExecutionError('LOGIC_INVALID_REQUEST');
    if ((event.phase === 'field-change' && !invocation.input.changedFieldId) ||
        (event.phase === 'before-command' && invocation.input.changedFieldId !== undefined)) throw new LogicExecutionError('LOGIC_INVALID_REQUEST');
    if (!this.authority || !this.executor) throw new LogicExecutionError('LOGIC_UNAVAILABLE');
    const authority = this.authority, executor = this.executor;
    const controller = new AbortController();
    const deadlineAt = performance.now() + MAX_DEADLINE_MS;
    const remaining = () => {
      const left = deadlineAt - performance.now();
      if (controller.signal.aborted || left <= 0) { controller.abort(); throw new LogicExecutionError('LOGIC_TIMEOUT'); }
      return Math.max(1, Math.floor(left));
    };
    const checkedGrant = async () => {
      try { return await currentGrant(authority, invocation, controller.signal); }
      finally { remaining(); }
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new LogicExecutionError('LOGIC_TIMEOUT')); }, MAX_DEADLINE_MS);
      });
      const work = (async () => {
        assertGrant(invocation, await checkedGrant());
        const deadlineMs = remaining();
        let rawResult: unknown;
        try { rawResult = await executor.run(structuredClone(invocation), { signal: controller.signal, deadlineMs }); }
        catch { remaining(); throw new LogicExecutionError('LOGIC_EXECUTION_FAILED'); }
        remaining();
        const output = resultSchema.safeParse(data(rawResult, 'LOGIC_INVALID_RESULT', MAX_OUTPUT_BYTES));
        if (!output.success) throw new LogicExecutionError('LOGIC_INVALID_RESULT');
        const latest = assertGrant(invocation, await checkedGrant());
        remaining();
        for (const item of output.data.proposals) {
          if (!event.proposedResults.includes(item.kind)) throw new LogicExecutionError('LOGIC_INVALID_RESULT');
          if (item.kind === 'command-proposal') {
            if (!latest.commandIds.includes(item.commandId) || Object.keys(item.args).some(field => !latest.readableFields.includes(field))) throw new LogicExecutionError('LOGIC_FORBIDDEN');
          } else if (!latest.readableFields.includes(item.fieldId) || (item.kind === 'calculation-proposal' && !latest.writableFields.includes(item.fieldId))) {
            throw new LogicExecutionError('LOGIC_FORBIDDEN');
          }
        }
        // A proposal is never a write, validation bypass, command execution or authorization grant.
        return data(output.data, 'LOGIC_INVALID_RESULT', MAX_OUTPUT_BYTES) as LogicExecutionResult;
      })();
      return await Promise.race([work, timeout]);
    } finally { if (timer) clearTimeout(timer); }
  }
}
