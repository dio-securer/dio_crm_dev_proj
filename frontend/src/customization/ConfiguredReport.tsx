import React,{useState} from 'react';import {useQuery} from '@tanstack/react-query';import {useTranslation} from 'react-i18next';
import {apiGet,apiGetConfigured,type ConfigurationContext} from '../api';import {useConfigurationSession} from './session';import {leadUiText} from './labels';import './configured.css';
export type ReportSpec={screen:string;path:string;filters?:Array<{id:string;parameter:string;type:'date'|'text'}>;sections:Array<{key:string;labelId:string;fields:Array<{id:string;column:string;codeField?:string}>}>};
type Effective=ConfigurationContext&{labels:Record<string,string>;policy:Array<{id:string;readable:boolean;writable:boolean;masking:string}>};
export function ReportModeBoundary({spec,legacy,configured}:{spec:ReportSpec;legacy:React.ReactNode;configured?:React.ReactNode}){
 const session=useConfigurationSession(),{i18n}=useTranslation(),t=leadUiText(i18n.language);
 const mode=useQuery({queryKey:['report-mode',session],queryFn:async()=>(await apiGetConfigured('/api/me/context')).context,retry:false,gcTime:0,refetchOnWindowFocus:false});
 if(mode.isPending)return <p role="status">{t('loading')}</p>;
 if(mode.isError)return <p role="alert">{t('error')} <button onClick={()=>void mode.refetch()}>{t('retry')}</button></p>;
 return mode.data?<React.Fragment key={session+spec.path}>{configured??<ConfiguredReport spec={spec}/>}</React.Fragment>:<>{legacy}</>;
}
export function ConfiguredReport({spec}:{spec:ReportSpec}){
 const session=useConfigurationSession(),{i18n}=useTranslation(),t=leadUiText(i18n.language),[epoch,setEpoch]=useState(0),[filters,setFilters]=useState<Record<string,string>>({});
 const config=useQuery({queryKey:['report-effective',session,epoch,i18n.language],queryFn:()=>apiGet<Effective>('/api/runtime/effective-config?locale='+encodeURIComponent(i18n.language)),retry:false,gcTime:0,refetchOnWindowFocus:false});
 const cfg=config.data,p=(id:string)=>cfg?.policy.find(p=>p.id===id),label=(id:string)=>cfg?.labels[id]??id;
 const query=new URLSearchParams();for(const f of spec.filters??[])if(p(f.id)?.writable&&filters[f.parameter])query.set(f.parameter,filters[f.parameter]);
 const report=useQuery({queryKey:['configured-report',session,spec.path,epoch,cfg?.releaseId,cfg?.permissionVersion,query.toString()],queryFn:()=>apiGetConfigured<Record<string,Array<Record<string,unknown>>>>(spec.path+(query.size?(spec.path.includes('?')?'&':'?')+query:'')),enabled:!!cfg&&!!p(spec.screen)?.readable,retry:false,gcTime:0,refetchOnWindowFocus:false});
 if(config.isPending)return <p role="status">{t('loading')}</p>;
 if(config.isError||!cfg)return <p role="alert">{t('error')} <button onClick={()=>void config.refetch()}>{t('retry')}</button></p>;
 if(!p(spec.screen)?.readable)return <p role="alert">{t('denied')}</p>;
 const consistent=report.data?.context?.releaseId===cfg.releaseId&&report.data.context.permissionVersion===cfg.permissionVersion;
 return <section className="workspace-page configured-leads"><h2>{label(spec.screen)}</h2><div className="config-toolbar">{spec.filters?.filter(f=>p(f.id)?.readable).map(f=><label key={f.id}>{label(f.id)}<input type={f.type} value={filters[f.parameter]??''} disabled={!p(f.id)?.writable} onChange={e=>setFilters({...filters,[f.parameter]:e.target.value})}/></label>)}<button onClick={()=>setEpoch(e=>e+1)}>{t('refresh')}</button></div>
 {report.isError?<p role="alert">{t('error')}</p>:report.isPending?<p role="status">{t('loading')}</p>:!consistent?<p role="alert">{t('changed')}</p>:spec.sections.filter(s=>p(s.labelId)?.readable&&Array.isArray(report.data?.data[s.key])).map(s=>{const fields=s.fields.filter(f=>p(f.id)?.readable),rows=report.data!.data[s.key];return fields.length?<section key={s.key}><h3>{label(s.labelId)}</h3><div className="table-scroll"><table><thead><tr>{fields.map(f=><th key={f.id}>{label(f.id)}</th>)}</tr></thead><tbody>{!rows.length&&<tr><td colSpan={fields.length}>{t('empty')}</td></tr>}{rows.map((row,i)=><tr key={i}>{fields.map(f=>{const value=row[f.column],text=cfg.labels['code:'+(f.codeField??f.id)+':'+value]??(value===null||value===undefined?'—':typeof value==='number'?new Intl.NumberFormat(i18n.language).format(value):typeof value==='boolean'?(i18n.language.startsWith('ko')?(value?'예':'아니요'):(value?'Yes':'No')):String(value));return <td key={f.id}>{text}</td>;})}</tr>)}</tbody></table></div></section>:null;})}</section>;
}
