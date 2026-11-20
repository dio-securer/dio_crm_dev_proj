import {useQuery} from '@tanstack/react-query';import {useTranslation} from 'react-i18next';
import {apiGet,apiGetConfigured} from '../api';import {useConfigurationSession} from './session';
type NavigationConfig={navigation:Array<{id:string;screenId:string;label:string;order:number}>;labels:Record<string,string>;policy:Array<{id:string;readable:boolean}>};
export function useConfiguredNavigation(enabled:boolean){
 const session=useConfigurationSession(),{i18n}=useTranslation();
 const mode=useQuery({queryKey:['navigation-mode',session],queryFn:async()=>(await apiGetConfigured('/api/me/context')).context,enabled,retry:false,gcTime:0,refetchOnWindowFocus:false});
 const config=useQuery({queryKey:['navigation-config',session,i18n.language,mode.data?.releaseId,mode.data?.permissionVersion],queryFn:()=>apiGet<NavigationConfig>('/api/runtime/effective-config?locale='+encodeURIComponent(i18n.language)),enabled:enabled&&!!mode.data,retry:false,gcTime:0,refetchOnWindowFocus:false});
 return {managed:enabled&&!!mode.data,pending:enabled&&(mode.isPending||!!mode.data&&config.isPending),error:enabled&&(mode.isError||!!mode.data&&config.isError),allowed:(screen:string)=>!enabled||!mode.data||config.data?.policy.some(p=>p.id===screen&&p.readable)===true&&config.data.navigation?.some(n=>n.screenId===screen)===true,order:(screen:string)=>config.data?.navigation?.find(n=>n.screenId===screen)?.order??Number.MAX_SAFE_INTEGER,label:(screen:string)=>config.data?.navigation?.find(n=>n.screenId===screen)?.label,refresh:()=>{void mode.refetch();void config.refetch();}};
}
