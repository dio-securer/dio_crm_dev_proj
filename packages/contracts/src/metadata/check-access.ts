// Cross-reference checks of an object's row access rules (access.json, F2-2).
import { Context, checkPermission, useField } from './context';
import { ACCESS_FIELD_TYPES, ObjectBundle } from './schemas';

export function checkAccess(ctx: Context, ob: ObjectBundle, base: string): void {
  const access = ob.access;
  if (!access) return;
  const entity = ob.object.key, p = `${base}/access`;
  if (access.entity !== entity) ctx.add('R01_UNKNOWN_ENTITY', `${p}/entity`, { entity: access.entity });
  if (access.rules.length > 1 && access.rules.some(r => r.kind === 'none')) ctx.add('R11_ACCESS_NONE_MIXED', `${p}/rules`);
  access.rules.forEach((rule, i) => {
    const rp = `${p}/rules[#${i}]`;
    if (rule.kind === 'none') return;
    if (rule.permission !== undefined) checkPermission(ctx, rule.permission, `${rp}/permission`);
    const prop = rule.kind === 'unit' ? 'unitField' : rule.kind === 'all' ? undefined : 'ownerField';
    if (!prop) return;
    const name = (rule as Record<string, string>)[prop];
    const type = useField(ctx, entity, name, `${rp}/${prop}`);
    if (type && !ACCESS_FIELD_TYPES.includes(type)) ctx.add('R11_ACCESS_FIELD_TYPE', `${rp}/${prop}`, { field: name, type });
  });
}
