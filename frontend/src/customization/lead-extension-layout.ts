import type {LeadExtensionLayout,LeadExtensionRegion} from '@dio-crm/contracts/crm-customization';
import type {ExtensionFieldView} from './ExtensionFieldInputs';

/** A release layout is presentation only. The server still authorizes every field read/write. */
export function placedExtensionFields(fields:ExtensionFieldView[],layout:LeadExtensionLayout|undefined,mode:'create'|'detail',region?:LeadExtensionRegion):ExtensionFieldView[]{
 if(!layout)return fields;
 const placements=new Map(layout.placements.map(item=>[item.fieldId,item]));
 return fields.filter(field=>{
  const placement=placements.get(field.id);
  return !!placement?.visible&&!!(mode==='create'?placement.createRegion:placement.detailRegion)&&(region===undefined||(mode==='create'?placement.createRegion:placement.detailRegion)===region);
 }).map(field=>({...field,writable:field.writable&&!placements.get(field.id)!.readOnly,required:placements.get(field.id)!.required}))
  .sort((a,b)=>((mode==='create'?placements.get(a.id)!.createOrder:placements.get(a.id)!.detailOrder)??0)-((mode==='create'?placements.get(b.id)!.createOrder:placements.get(b.id)!.detailOrder)??0));
}

export function requiredExtensionMissing(fields:ExtensionFieldView[],layout:LeadExtensionLayout|undefined,values:Record<string,unknown>):string[]{
 if(!layout)return [];
 const readable=new Set(fields.filter(field=>field.readable&&field.writable).map(field=>field.id));
 return layout.placements.filter(item=>item.required&&item.visible&&readable.has(item.fieldId)&&[undefined,null,''].includes(values[item.fieldId] as undefined|null|'')).map(item=>item.fieldId);
}
