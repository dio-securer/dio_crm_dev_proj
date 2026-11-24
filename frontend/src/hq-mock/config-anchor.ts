/** Stable DOM contract shared by the HQ screens and the visual editor. */
export function configAnchor(id: string, instance: string, support: 'mapped' | 'unsupported' = 'mapped') {
  return { 'data-config-id': id, 'data-config-instance': instance, 'data-config-support': support } as const;
}

const leadAliases: Record<string, string> = {
  keymanName: 'keymanSurname', school: 'keymanSchool', cohort: 'keymanClassYear',
  major: 'keymanMajor', contactExcludeReason: 'exclusionReason'
};

export function customerFieldId(entity: 'lead' | 'account' | 'contact', key: string): string {
  return `${entity}.${entity === 'lead' ? leadAliases[key] ?? key : key}`;
}
