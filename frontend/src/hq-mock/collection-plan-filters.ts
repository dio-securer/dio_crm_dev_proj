export type CollectionPlanFilters = {search:string; corrections:boolean; from:string; to:string; sort:'date-asc'|'date-desc'};
type FilterablePlan = {public_id:string; contract_name:string; planned_date:string; correction_required_yn:boolean};
export function filterCollectionPlans<T extends FilterablePlan>(rows:readonly T[], filters:CollectionPlanFilters):T[]{
 if(filters.from&&filters.to&&filters.from>filters.to)return [];
 return rows.filter(row=>(!filters.corrections||row.correction_required_yn)&&row.contract_name.toLocaleLowerCase().includes(filters.search.trim().toLocaleLowerCase())&&(!filters.from||row.planned_date>=filters.from)&&(!filters.to||row.planned_date<=filters.to))
  .sort((a,b)=>(filters.sort==='date-desc'?-1:1)*a.planned_date.localeCompare(b.planned_date)||a.public_id.localeCompare(b.public_id));
}
