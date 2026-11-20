export function filterReports<T extends {report_date?:unknown;status?:unknown;organization_id?:unknown;owner_user_id?:unknown;reporter_user_id?:unknown}>(rows:T[],filters:{from:string;to:string;status:string;organization:string;owner:string}):T[] {
  if(filters.from&&filters.to&&filters.from>filters.to)return [];
  return rows.filter(row=>{const date=String(row.report_date??'');return (!filters.from||date>=filters.from)&&(!filters.to||date<=filters.to)&&(!filters.status||row.status===filters.status)&&(!filters.organization||String(row.organization_id??'')===filters.organization)&&(!filters.owner||String(row.reporter_user_id??row.owner_user_id??'')===filters.owner)}).sort((a,b)=>String(b.report_date??'').localeCompare(String(a.report_date??'')));
}
