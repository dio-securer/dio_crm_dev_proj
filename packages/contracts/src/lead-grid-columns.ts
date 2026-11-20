/** Reviewed lead fields already present in the list response and standard field catalog. */
export const leadGridCandidates = [
  { fieldId: 'lead.address', rowKey: 'address', source: 'basic', fieldKey: 'address' },
  { fieldId: 'lead.keymanSurname', rowKey: 'keyman_name', source: 'keyman', fieldKey: 'keymanName' },
  { fieldId: 'lead.keymanType', rowKey: 'keyman_type', source: 'keyman', fieldKey: 'keymanType' },
  { fieldId: 'lead.keymanMobile', rowKey: 'keyman_mobile', source: 'keyman', fieldKey: 'keymanMobile' },
  { fieldId: 'lead.keymanEmail', rowKey: 'keyman_email', source: 'keyman', fieldKey: 'keymanEmail' },
  { fieldId: 'lead.keymanSchool', rowKey: 'school', source: 'keyman', fieldKey: 'school' },
  { fieldId: 'lead.keymanClassYear', rowKey: 'cohort', source: 'keyman', fieldKey: 'cohort' },
  { fieldId: 'lead.keymanMajor', rowKey: 'major', source: 'keyman', fieldKey: 'major' },
  { fieldId: 'lead.mainSystem', rowKey: 'main_system', source: 'hospital', fieldKey: 'mainSystem' },
  { fieldId: 'lead.subSystem', rowKey: 'sub_system', source: 'hospital', fieldKey: 'subSystem' },
  { fieldId: 'lead.exclusionReason', rowKey: 'contact_exclude_reason', source: 'exclusion', fieldKey: 'contactExcludeReason' }
] as const;

export type LeadGridColumnId = typeof leadGridCandidates[number]['fieldId'];
export const leadBaseColumnIds = ['lead.hospitalName','lead.status','lead.ownerName','lead.phone','lead.businessNo'];
export const leadManagedColumnIds=['lead.hospitalName','lead.status','lead.ownerName','lead.sido','lead.sigungu','lead.phone','lead.businessNo','lead.updatedAt'];
export const leadLegacyDisplayColumns=[{fieldId:'lead.sido',rowKey:'sido',fieldKey:'sido'},{fieldId:'lead.sigungu',rowKey:'sigungu',fieldKey:'sigungu'},{fieldId:'lead.updatedAt',rowKey:'updated_at',fieldKey:'updatedAt'}];
/** Legacy documents retain their five fixed columns plus ordered extras. */
export function resolvedLeadColumnOrder(config:{leadGridColumns?:string[];leadListOrder?:string[]}):string[]{
 return config.leadListOrder??[...leadManagedColumnIds,...config.leadGridColumns??[]];
}
export function validLeadColumnOrder(order:unknown,extras:string[]):boolean{
 const allowed=[...leadBaseColumnIds,...extras];
 const legacy=leadLegacyDisplayColumns.map(c=>c.fieldId);
 return Array.isArray(order)&&new Set(order).size===order.length&&allowed.every(id=>order.includes(id))&&order.every(id=>typeof id==='string'&&(allowed.includes(id)||legacy.includes(id)));
}
export function mergeLeadColumnOrder(previous:string[]|undefined,extras:string[]):string[]{
 const allowed=previous?[...leadBaseColumnIds,...leadLegacyDisplayColumns.map(c=>c.fieldId).filter(id=>previous.includes(id)),...extras]:[...leadManagedColumnIds,...extras];
 return [...(previous??allowed).filter(id=>allowed.includes(id)),...allowed.filter(id=>!previous?.includes(id)&&!!previous)];
}
