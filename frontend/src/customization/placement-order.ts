import {placementRegions,type PlacementOrders} from '@dio-crm/contracts/crm-customization';

/** Reorder only existing slots in their own region; never introduce a denied field. */
export function applyPlacementOrder<T>(items:T[],id:(item:T)=>string,orders:PlacementOrders|undefined,screen:string,variant:'create'|'detail'):T[]{
 const result=[...items];
 for(const region of placementRegions.filter(r=>r.screenId===screen&&r.variant===variant)){
  const order=orders?.[region.id];
  if(!order||new Set(order).size!==order.length||order.some(key=>!region.fieldIds.includes(key)))continue;
  const slots=result.flatMap((item,index)=>region.fieldIds.includes(id(item))?[index]:[]);
  const current=slots.map(index=>result[index]);
  const sorted=[...current].sort((a,b)=>{
   const rank=(item:T)=>{const index=order.indexOf(id(item));return index<0?order.length+current.indexOf(item):index;};
   return rank(a)-rank(b);
  });
  slots.forEach((slot,index)=>{result[slot]=sorted[index];});
 }
 return result;
}
