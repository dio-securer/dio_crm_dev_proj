import { z } from 'zod';
import { uuid, domains } from './core';
import { parsePayload } from './schemas';
const property = z.string().min(1).refine(v => !['__proto__', 'prototype', 'constructor'].includes(v), 'UNSAFE_PATH');
export const pathSegmentSchema = z.union([z.object({ property }).strict(), z.object({ itemKey: z.string().min(1) }).strict()]);
const path = z.array(pathSegmentSchema).min(1).max(20);
export const overrideOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('SET'), path, value: z.unknown().refine(v => v !== undefined, 'VALUE_REQUIRED') }).strict(),
  z.object({ op: z.literal('REMOVE_ITEM'), path: path.refine(v => 'itemKey' in v[v.length - 1], 'ITEM_PATH_REQUIRED') }).strict(),
  z.object({ op: z.literal('RESET'), path }).strict(),
]);
export type OverrideOp = z.infer<typeof overrideOpSchema>;
const scope = z.enum(['COMMON', 'TEMPLATE', 'COUNTRY', 'COMPANY']);
function scopeValid(value: { scope: string; scopeKey: string }) {
  switch (value.scope) {
    case 'COMMON': return value.scopeKey === 'COMMON';
    case 'TEMPLATE': return ['HQ', 'GLOBAL'].includes(value.scopeKey);
    case 'COUNTRY': return /^(HQ|GLOBAL):[A-Z]{2}$/.test(value.scopeKey);
    case 'COMPANY': return uuid.safeParse(value.scopeKey).success;
    default: return false;
  }
}
export const scopeVersionSchema = z.object({
  id: uuid, scope, scopeKey: z.string(), revision: z.number().int().positive(),
  documentVersionIds: z.array(uuid), parentVersionIds: z.array(uuid), contentHash: z.string().min(1),
  createdAt: z.string().datetime(), createdBy: uuid,
}).strict().refine(scopeValid, 'INVALID_SCOPE_KEY');
export type ScopeVersion = z.infer<typeof scopeVersionSchema>;
export const configDocumentBaseSchema = z.object({
  id: uuid, scope, scopeKey: z.string(), domain: z.enum(domains), stableKey: z.string().min(1),
  revision: z.number().int().positive(), parentVersionIds: z.array(uuid),
  payload: z.record(z.unknown()).optional(), overrides: z.array(overrideOpSchema).optional(),
}).strict();
export const configDocumentSchema = configDocumentBaseSchema.superRefine((value, ctx) => {
  if (value.domain === 'COMPANY_PROFILE' && value.scope !== 'COMPANY') ctx.addIssue({code:'custom',message:'COMPANY_SCOPE_REQUIRED'});
  if (!scopeValid(value)) ctx.addIssue({ code: 'custom', message: 'INVALID_SCOPE_KEY' });
  if (value.scope === 'COMMON') {
    if (!value.payload || value.overrides !== undefined) ctx.addIssue({ code: 'custom', message: 'COMMON_PAYLOAD_REQUIRED' });
    else { try { parsePayload(value.domain, value.payload); } catch { ctx.addIssue({ code: 'custom', message: 'INVALID_DOMAIN_PAYLOAD' }); } }
  } else if (value.payload !== undefined || value.overrides === undefined) ctx.addIssue({ code: 'custom', message: 'OVERRIDES_REQUIRED' });
  const ops = value.overrides ?? [];
  for (let i = 0; i < ops.length; i++) {
    for (let j = i + 1; j < ops.length; j++) {
      const a = ops[i].path, b = ops[j].path;
      if (a.slice(0, Math.min(a.length, b.length)).every((part, k) => JSON.stringify(part) === JSON.stringify(b[k]))) ctx.addIssue({ code: 'custom', message: 'OVERRIDE_PATH_CONFLICT' });
    }
  }
});
export type ConfigDocument = z.infer<typeof configDocumentSchema>;
