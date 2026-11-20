import type { CompanyConfig, ConfigCatalog, ConfigKind, ConfigProperty, ConfigScalar } from '@dio-crm/contracts/crm-customization';

export type PreviewSetting = { id: string; kind: ConfigKind; values: Partial<Record<ConfigProperty, ConfigScalar>>; label?: string };

/** Only explicit, allowed draft overrides cross into the synthetic preview frame. */
export function visualPreviewProjection(catalog: ConfigCatalog, config: CompanyConfig, screen: string, locale: string): PreviewSetting[] {
  const entries = new Map(catalog.entries.filter(entry => entry.id === screen || entry.screenId === screen).map(entry => [entry.id, entry]));
  const projected = new Map<string, PreviewSetting>();
  for (const patch of config.patches) {
    const entry = entries.get(patch.targetId);
    if (!entry || entry.support !== 'supported' || patch.operation !== 'set' || !entry.capabilities.includes(patch.property) || entry.locks.includes(patch.property)) continue;
    const item = projected.get(entry.id) ?? { id: entry.id, kind: entry.kind, values: {} };
    item.values[patch.property] = patch.value;
    projected.set(entry.id, item);
  }
  if (config.activeLocales.includes(locale)) for (const entry of entries.values()) {
    const label = config.translations[locale]?.[entry.labelKey];
    if (!label || entry.support !== 'supported') continue;
    const item = projected.get(entry.id) ?? { id: entry.id, kind: entry.kind, values: {} };
    item.label = label;
    projected.set(entry.id, item);
  }
  return [...projected.values()];
}
