// Cross-reference checks of the security settings (F2-7): permission sets, profiles, organisation charts. S01..S11.
import { Context, at } from './context';
import { fieldNames } from './field-names';

export function checkSecurity(ctx: Context): void {
  const { permissionSets, profiles, orgCharts } = ctx.bundle;
  const sets = new Set<string>();
  permissionSets.forEach((set, i) => {
    const p = `permissionSets${at(set.key, i)}`;
    if (sets.has(set.key)) ctx.add('S01_DUPLICATE_PERMISSION_SET', p, { key: set.key });
    sets.add(set.key);
    for (const entity of Object.keys(set.objects).sort()) if (!ctx.objects.has(entity)) ctx.add('S03_UNKNOWN_OBJECT', `${p}/objects/${entity}`, { key: set.key, entity });
    for (const entity of Object.keys(set.fields).sort()) {
      const ob = ctx.objects.get(entity);
      if (!ob) { ctx.add('S03_UNKNOWN_OBJECT', `${p}/fields/${entity}`, { key: set.key, entity }); continue; }
      const names = new Set(ob.object.fields.flatMap(f => fieldNames(f)));
      for (const field of Object.keys(set.fields[entity]).sort()) {
        if (field !== '*' && !names.has(field)) ctx.add('S04_UNKNOWN_FIELD', `${p}/fields/${entity}/${field}`, { key: set.key, entity, field });
      }
    }
  });
  const seenProfiles = new Set<string>();
  (profiles ?? []).forEach((profile, i) => {
    const p = `profiles${at(profile.key, i)}`;
    if (seenProfiles.has(profile.key)) ctx.add('S05_DUPLICATE_PROFILE', p, { key: profile.key });
    seenProfiles.add(profile.key);
    for (const prop of ['permissionSets', 'restrictions'] as const) {
      profile[prop].forEach((key, j) => { if (!sets.has(key)) ctx.add('S02_UNKNOWN_PERMISSION_SET', `${p}/${prop}[#${j}]`, { profile: profile.key, key }); });
    }
  });
  const companies = new Set<number>();
  orgCharts.forEach((chart, i) => {
    const p = `orgCharts${at(chart.key, i)}`;
    if (companies.has(chart.companyId)) ctx.add('S06_DUPLICATE_ORG_CHART', p, { companyId: chart.companyId });
    companies.add(chart.companyId);
    const units = new Map<string, string | undefined>();
    chart.units.forEach((u, j) => {
      if (units.has(u.id)) ctx.add('S07_DUPLICATE_UNIT', `${p}/units[#${j}]`, { chart: chart.key, unit: u.id });
      else units.set(u.id, u.parentId);
    });
    for (const [unit, parent] of units) {
      if (parent !== undefined && !units.has(parent)) { ctx.add('S08_UNKNOWN_PARENT', `${p}/units[${unit}]`, { chart: chart.key, unit, parent }); continue; }
      const seen = new Set([unit]);
      for (let q = parent; q !== undefined; q = units.get(q)) {
        if (seen.has(q)) { ctx.add('S09_ORG_CYCLE', `${p}/units[${unit}]`, { chart: chart.key, unit }); break; }
        seen.add(q);
      }
    }
    const users = new Set<string>();
    chart.members.forEach((m, j) => {
      if (!units.has(m.unitId)) ctx.add('S10_UNKNOWN_UNIT', `${p}/members[#${j}]`, { chart: chart.key, user: m.userId, unit: m.unitId });
      if (users.has(m.userId)) ctx.add('S11_DUPLICATE_MEMBER', `${p}/members[#${j}]`, { chart: chart.key, user: m.userId });
      users.add(m.userId);
    });
  });
}
