import { assert, canonical } from './core';
import { OverrideOp, overrideOpSchema } from './versions';
import { parsePayload } from './schemas';
export type Path = OverrideOp['path'];
export const pathKey = (p: Path) => p.map(s => 'property' in s ? s.property : `[${s.itemKey}]`).join('.');
const prefix = (a: Path, b: Path) => a.length <= b.length && a.every((s, i) => canonical(s) === canonical(b[i]));
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
function safe(value: unknown): void { if (value && typeof value === 'object') for (const k of Object.keys(value)) { assert(!unsafe.has(k), 422, 'UNSAFE_PATH'); safe((value as any)[k]); } }
// Registry-defined keys, never array positions. Translation identity is composite.
function itemKey(item: any): string { if (typeof item === 'string') return item; assert(item && typeof item === 'object', 422, 'ITEM_KEY_REQUIRED'); return item.locale && item.termKey ? `${item.termKey}:${item.locale}` : String(item.id ?? item.key ?? item.code ?? item.semanticKey ?? item.eventKey ?? item.roleCode ?? ''); }
export function normalizeOverrides(previous: OverrideOp[], input: OverrideOp[]): OverrideOp[] {
    const parsed = input.map(o => overrideOpSchema.parse(o));
    // An ordinary update replaces the local patch; RESET removes a path from the previous patch.
    let result = parsed.some(o => o.op === 'RESET') ? structuredClone(previous) : [];
    for (const op of parsed) { if (op.op === 'RESET') result = result.filter(o => !prefix(op.path, o.path)); else result.push(op); }
    for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) assert(!prefix(result[i].path, result[j].path) && !prefix(result[j].path, result[i].path), 422, 'OVERRIDE_PATH_CONFLICT');
    return result;
}
export function resolveOverrides(base: Record<string, any>, ops: OverrideOp[], lockedPaths: Path[] = []) {
    const result = structuredClone(base); const provenance: Record<string, string> = {};
    for (const raw of ops) {
        const op = overrideOpSchema.parse(raw); assert(op.op !== 'RESET', 422, 'RESET_NOT_NORMALIZED'); safe(op);
        assert(!lockedPaths.some(p => prefix(p, op.path) || prefix(op.path, p)), 422, 'LOCKED_PATH');
        let parent: any = result;
        op.path.forEach((s, i) => {
            const last = i === op.path.length - 1;
            if ('property' in s) {
                assert(parent && typeof parent === 'object' && !Array.isArray(parent), 422, 'PATH_INVALID');
                assert((last&&op.op==='SET')||Object.prototype.hasOwnProperty.call(parent, s.property), 422, 'PATH_INVALID');
                if (last) { assert(op.op === 'SET', 422, 'ITEM_PATH_REQUIRED'); parent[s.property] = structuredClone(op.value); }
                else parent = parent[s.property];
            } else {
                assert(Array.isArray(parent), 422, 'ARRAY_REQUIRED'); const index = parent.findIndex(x => itemKey(x) === s.itemKey);
                if (last) { if (op.op === 'REMOVE_ITEM') { assert(index >= 0, 422, 'ITEM_NOT_FOUND'); parent.splice(index, 1); } else { assert(itemKey(op.value) === s.itemKey, 422, 'ITEM_KEY_MISMATCH'); if (index < 0) parent.push(structuredClone(op.value)); else parent[index] = structuredClone(op.value); } }
                else { assert(index >= 0, 422, 'ITEM_NOT_FOUND'); parent = parent[index]; }
            }
        }); provenance[pathKey(op.path)] = 'LOCAL';
    }
    return { payload: result, provenance };
}
export function validateResolved(domain: string, payload: unknown) {
    safe(payload); const result = parsePayload(domain, payload);
    function walk(v: any) { if (Array.isArray(v)) { const keyed = v.filter(x => x && typeof x === 'object' && !Array.isArray(x) && itemKey(x)); assert(new Set(keyed.map(itemKey)).size === keyed.length, 422, 'DUPLICATE_ITEM_KEY'); v.forEach(walk); } else if (v && typeof v === 'object') Object.values(v).forEach(walk); }
    walk(result); return result;
}
