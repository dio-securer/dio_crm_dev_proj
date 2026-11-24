/** Reviewed mapping between a preview DOM anchor and a stored placement. */
export function placementIdForInstance(screen:string,instance:string|null|undefined):string|undefined{
  if(!instance)return undefined;
  if(screen==='HQ_LEAD')return `lead.${instance}`;
  if(screen==='HQ_ACCOUNT'&&instance==='create.crmName')return 'account.create.basic.crmName';
  return undefined;
}
export function instanceForPlacement(id:string):string|null{
  if(id==='account.create.basic.crmName')return 'create.crmName';
  return id.startsWith('lead.')?id.slice(5):null;
}
