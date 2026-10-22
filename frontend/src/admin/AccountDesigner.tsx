import React,{useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {canonical} from '@dio-crm/contracts/admin';
import {HttpAdminClient} from './client/admin-client';
import {AdvancedDesigner} from './AdvancedDesigner';
export {ConditionEditor} from './AdvancedDesigner';
import {useDirtyEditor} from './useDirtyEditor';
import {DesignerWorkspace,parentConfig} from './designer/model';
import {FieldGrid} from './designer/FieldGrid';
import {FieldDetailPanel} from './designer/FieldDetailPanel';
import {Lang,text,fieldLabel} from './designer/labels';
import {BulkPanel,GroupPanel,AddFieldPanel} from './designer/EditActions';
import {SyntheticPreview} from './SyntheticPreview';
import './designer/designer.css';
const advancedPaths=['features','menus','rules','conditions','list-views','actions'];
export function AccountDesigner({client,companyId}:{client:HttpAdminClient;companyId:string}){
 const [advanced,setAdvanced]=useState(advancedPaths.some(p=>location.pathname==='/admin/'+p));
 return advanced?<><button onClick={()=>setAdvanced(false)}>←</button><AdvancedDesigner client={client} companyId={companyId}/></>:<DesignerEditor client={client} companyId={companyId} advanced={()=>setAdvanced(true)}/>;
}
function DesignerEditor({client,companyId,advanced}:{client:HttpAdminClient;companyId:string;advanced:()=>void}){
 const w=useMemo(()=>new DesignerWorkspace(client,companyId),[client,companyId]);useSyncExternalStore(w.subscribe,w.snapshot);
 const [lang,setLang]=useState<Lang>('ko-KR'),[group,setGroup]=useState(''),[search,setSearch]=useState(''),[filter,setFilter]=useState('any'),[selected,setSelected]=useState<string[]>([]),[detail,setDetail]=useState(''),[mobile,setMobile]=useState('fields'),[action,setAction]=useState('');const t=text(lang);
 useEffect(()=>{void w.load().catch(e=>w.fail(e));return()=>w.dispose();},[w]);
 useEffect(()=>setSelected([]),[group,search,filter]);
 useDirtyEditor(w.dirty.length>0,()=>w.save(),e=>{w.error=e;w.emit();},w.error);
 const run=async(fn:()=>Promise<any>)=>{try{await fn();}catch(e){w.fail(e);}};
 if(!w.state)return <p role="status">{w.error||t('loading')}</p>;
 const c=w.working,sections=c['SCREEN:account'].sections,fields=c['FIELD:account'].fields,rows=fields.filter((f:any)=>(!group||f.sectionId===group)&&(!search||(f.key+' '+fieldLabel(c,f.labelKey,lang)).toLowerCase().includes(search.toLowerCase()))&&(filter==='any'||filter==='changed'&&canonical(f)!==canonical(w.loaded['FIELD:account'].fields.find((x:any)=>x.key===f.key))||filter=== 'visible'&&f.visible)).sort((a:any,b:any)=>a.order-b.order||a.key.localeCompare(b.key));
 const edit=(n:any)=>{try{w.edit(n);}catch(e){w.fail(e);}};
 return <section className="designer-shell configuration-page"><header className="designer-header"><div><h2>{t('title')}</h2><p className="designer-subtitle">{t('subtitle')}</p><small>{companyId} · {t('version')} {w.state.currentVersionId||'A03_BASELINE'}</small></div><label>{t('locale')}<select value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="ko-KR">{t('korean')}</option><option value="en-US">English</option></select></label></header>
 <div className="designer-toolbar"><button disabled={w.busy||w.blocked||!w.history.length} onClick={()=>w.undo()}>{t('undo')}</button><button disabled={w.busy||w.blocked||!w.future.length} onClick={()=>w.redo()}>{t('redo')}</button><button disabled={!!w.dirty.length} onClick={advanced}>{t('advanced')}</button><button disabled={w.busy||!!w.dirty.length} onClick={()=>void run(()=>w.load())}>{t('reload')}</button></div>
 {w.error&&<div role="alert" className="designer-error">{w.error}</div>}<div role="status" aria-live="polite">{w.dirty.length?t('dirty')+': '+w.dirty.join(', '):t('saved')}</div>
 <nav className="designer-mobile-nav">{['groups','fields','preview'].map(k=><button key={k} aria-pressed={mobile===k} onClick={()=>setMobile(k)}>{t(k)}</button>)}</nav>
 <div className="designer-layout"><aside className={'designer-groups '+(mobile!=='groups'?'mobile-hidden':'')}><h3>{t('groups')}</h3><button disabled={w.busy||w.blocked} onClick={()=>setAction('addGroup')}>{t('addGroup')}</button>{group&&<button disabled={w.busy||w.blocked} onClick={()=>setAction('editGroup')}>{t('editGroup')}</button>}<button aria-pressed={!group} onClick={()=>setGroup('')}>{t('all')} ({fields.length})</button>{sections.map((s:any)=><button key={s.id} aria-pressed={group===s.id} onClick={()=>{setGroup(s.id);setMobile('fields');}}>{fieldLabel(c,s.titleKey,lang)}<small>{s.id} · {fields.filter((f:any)=>f.sectionId===s.id).length}</small></button>)}</aside>
 <div className={'designer-editor '+(mobile!=='fields'?'mobile-hidden':'')}><div className="designer-toolbar"><input aria-label={t('search')} placeholder={t('search')} value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label={t('filter')} value={filter} onChange={e=>setFilter(e.target.value)}>{['any','changed','visible'].map(k=><option key={k} value={k}>{t(k)}</option>)}</select><button disabled={!selected.length||w.busy||w.blocked} onClick={()=>setAction('bulk')}>{t('bulk')}</button><button disabled={w.busy||w.blocked} onClick={()=>setAction('addField')}>{t('addField')}</button><span>{rows.length} · {t('selected')} {selected.length}</span></div><fieldset disabled={w.busy||w.blocked} style={{border:0,padding:0,minWidth:0}}><FieldGrid config={c} loaded={w.loaded} parent={parentConfig(w.state)} rows={rows} selected={selected} setSelected={setSelected} edit={edit} detail={setDetail} group={group} reorderEnabled={!!group&&!search&&filter==='any'} lang={lang}/></fieldset></div>
 <aside className={'designer-preview '+(mobile!=='preview'?'mobile-hidden':'')}><h3>{t('preview')}</h3><p>{t('previewHint')}</p><SyntheticPreview config={c} companyId={companyId}/></aside></div>
 <footer className="designer-footer"><button disabled={w.busy||w.blocked||!w.dirty.length} className="primary" onClick={()=>void run(()=>w.save())}>{t('save')}</button><button disabled={w.busy||w.blocked||!!w.dirty.length} onClick={()=>void run(()=>w.check())}>{t('validate')}</button>{Object.entries(w.statuses).map(([d,s])=><span key={d}>{d}: {t(s)}</span>)}</footer>
 {action==='bulk'&&<BulkPanel config={c} keys={selected} lang={lang} apply={edit} close={()=>setAction('')}/>}
 {['addGroup','editGroup'].includes(action)&&<GroupPanel config={c} id={action==='editGroup'?group:''} lang={lang} apply={n=>{edit(n);if(!n['SCREEN:account'].sections.some((g:any)=>g.id===group))setGroup('');}} close={()=>setAction('')}/>}
 {action==='addField'&&<AddFieldPanel config={c} group={group} lang={lang} apply={edit} close={()=>setAction('')}/>}
 {detail&&<FieldDetailPanel config={c} fieldKey={detail} lang={lang} apply={edit} close={()=>setDetail('')}/>}<details><summary>{t('help')}</summary><p>{t('helpText')}</p></details></section>;
}
