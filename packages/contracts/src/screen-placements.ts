/** Reviewed placement identities: the same field has independent create/detail locations. */
export type PlacementOrders = Record<string, string[]>;
export type PlacementRegion = { id:string; screenId:string; variant:'detail'|'create'; tab:string; instance:string; fieldIds:string[] };
const leadGroups:Record<string,string[]>={
 basic:['hospitalName','phone','address','businessNo'],
 keyman:['keymanSurname','keymanType','keymanMobile','keymanEmail','keymanSchool','keymanClassYear','keymanMajor','keymanNote'],
 hospital:['hospitalSize','doctorCount','chairCount','mainSystem','subSystem'],
 exclusions:['mapExcluded','hiraExcluded','exclusionReason','exclusionDetail']
};
export const placementRegions:PlacementRegion[] = (['detail','create'] as const).flatMap(variant=>Object.entries(leadGroups).map(([tab,fields])=>({id:`lead.${variant}.${tab}`,screenId:'HQ_LEAD',variant,tab,instance:`${variant}.${tab}`,fieldIds:fields.map(f=>'lead.'+f)})));
/** Never silently accept an unknown region, a missing/duplicated item, or cross-region moves. */
export function placementErrors(orders:unknown, entries:Array<{id:string;support:string;locks:string[];capabilities:string[]}>):Array<{code:string;targetId:string;messageKey:string}> {
 const error=(code:string,targetId:string)=>({code,targetId,messageKey:'customization.errors.'+code});
 if(orders===undefined)return [];
 if(!orders||typeof orders!=='object'||Array.isArray(orders)||Object.keys(orders).length>placementRegions.length)return [error('INVALID_PLACEMENT','placements')];
 const errors=[];
 for(const [key,value] of Object.entries(orders)){
  const region=placementRegions.find(r=>r.id===key);
  if(!region||!Array.isArray(value)||value.length!==region.fieldIds.length||new Set(value).size!==value.length||value.some(id=>typeof id!=='string'||!region.fieldIds.includes(id))){errors.push(error('INVALID_PLACEMENT',key));continue;}
  for(const [index,id] of value.entries()){
   const entry=entries.find(e=>e.id===id);
   if(!entry||entry.support!=='supported'){errors.push(error('INVALID_PLACEMENT',id));continue;}
   if(!entry.capabilities.includes('order')||entry.locks.includes('order')){
    if(index!==region.fieldIds.indexOf(id))errors.push(error('PLACEMENT_LOCKED',id));
   }
  }
 }
 return errors;
}
