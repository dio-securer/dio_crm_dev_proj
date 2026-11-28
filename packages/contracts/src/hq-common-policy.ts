import {createHqPolicy,type HqCapabilities,type HqStandard,type HqContext} from './hq-standard.js';
import {resolveActorPolicy,type ConfigResult,type ActorPolicy} from './crm-customization.js';

/** Preserve HQ workflow conditions while applying common company restrictions.
 * The caller supplies a validated committed snapshot and current authenticated grants.
 * Unknown common IDs deny access; the bridge never expands the legacy policy.
 */
export function createHqCommonPolicy(standard:HqStandard,capabilities:HqCapabilities,result:ConfigResult,companyId:string,actor:ActorPolicy){
 const legacy=createHqPolicy(standard,capabilities);
 const effective=JSON.parse(JSON.stringify(result)) as ConfigResult;
 const identity={...actor,allowed:[...actor.allowed],denied:[...actor.denied]};
 const rule=(id:string,c:HqContext)=>resolveActorPolicy(effective,companyId,{...identity,allowed:identity.allowed.filter(p=>c.permissions.includes(p))},c.values).find(p=>p.id===id);
 const screenAllowed=(id:string,c:HqContext)=>!!rule(id,c)?.readable&&legacy.screenAllowed(id,c);
 const fieldVisible=(id:string,c:HqContext)=>!!rule(id,c)?.readable&&legacy.fieldVisible(id,c);
 const actionAllowed=(id:string,c:HqContext)=>{const action=standard.actions.find(a=>a.actionKey===id);return !!action?.screenKey&&screenAllowed(action.screenKey,c)&&!!rule(id,c)?.enabled&&legacy.actionAllowed(id,c);};
 return {
  screenAllowed,
  menuVisible:(id:string,c:HqContext)=>!!rule(id,c)?.readable&&legacy.menuVisible(id,c),
  fieldVisible,
  fieldWritable:(id:string,c:HqContext)=>!!rule(id,c)?.writable&&legacy.fieldWritable(id,c),
  actionAllowed,
  transitionAllowed:(id:string,c:HqContext)=>{const transition=standard.transitions.find(t=>t.transitionKey===id);return !!transition&&actionAllowed(transition.actionKey,c)&&legacy.transitionAllowed(id,c);},
  readField:(id:string,c:HqContext)=>{if(!fieldVisible(id,c))return undefined;const value=legacy.readField(id,c);return rule(id,c)?.masking==='redact'&&value!==undefined&&value!==null?'***':value;}
 };
}
