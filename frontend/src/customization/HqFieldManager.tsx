import React,{useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {apiAdminCommand,apiGet,ApiError} from '../api';

type Definition={id:string;version:number;key:string;type:'text'|'number'|'boolean'|'date';labels:Record<string,string>};
type Ref={id:string;version:number};
type HqFieldState={capabilities:{define:boolean;distribute:boolean};definitions:Definition[];target:{companyId:string;hqReleaseId:string|null;fields:Ref[]}|null};
type Pending={kind:'define'|'distribute';key:string;body:Record<string,unknown>};

/** Server-authorized HQ-only field administration. Unknown or disabled providers expose no controls. */
export function HqFieldManager({companyId,companyName,session}:{companyId:string;companyName:string;session:string}){
 const client=useQueryClient();
 const capability=useQuery({queryKey:['hq-fields',session,'capability'],queryFn:()=>apiGet<HqFieldState>('/api/admin/hq/fields'),retry:false,gcTime:0,refetchOnWindowFocus:false});
 const allowed=!capability.isError&&!!capability.data&&(capability.data.capabilities?.define===true||capability.data.capabilities?.distribute===true);
 const target=useQuery({queryKey:['hq-fields',session,companyId],queryFn:()=>apiGet<HqFieldState>('/api/admin/hq/fields?companyId='+encodeURIComponent(companyId)),enabled:allowed&&!!companyId&&capability.data?.capabilities.distribute===true,retry:false,gcTime:0,refetchOnWindowFocus:false});
 const [key,setKey]=useState(''),[type,setType]=useState<'text'|'number'|'boolean'|'date'>('text'),[ko,setKo]=useState(''),[en,setEn]=useState(''),[maxLength,setMaxLength]=useState(''),[min,setMin]=useState(''),[max,setMax]=useState(''),[reason,setReason]=useState(''),[distributionReason,setDistributionReason]=useState(''),[chosen,setChosen]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 React.useEffect(()=>{setChosen([]);setDistributionReason('');},[companyId]);
 const pending=useRef<Pending|null>(null);
 const run=async(command?:Pending)=>{
  if(busy)return;if(command)pending.current=command;if(!pending.current)return;
  const current=pending.current;setBusy(true);setError('');
  try{
   const result=await apiAdminCommand<Definition|{companyId:string;hqReleaseId:string;requiresCompanyPublication:boolean}>(current.kind==='define'?'/api/admin/hq/fields':'/api/admin/hq/fields/distributions','POST',current.body,current.key);
   pending.current=null;setUncertain(false);
   if(current.kind==='define'){const field=result as Definition;setMessage(`필드 정의 생성: ${field.key} · ${field.id} · 버전 ${field.version}. 법인 배포는 별도로 진행합니다.`);setKey('');setKo('');setEn('');setMaxLength('');setMin('');setMax('');setReason('');}
   else {const release=result as {companyId:string;hqReleaseId:string};setMessage(`법인 ${release.companyId}에 본사 필드를 배포했습니다. 본사 배포 ${release.hqReleaseId}. 법인 사용자 적용을 위해 별도 검증·게시가 필요합니다.`);setChosen([]);setDistributionReason('');}
   await client.invalidateQueries({queryKey:['hq-fields',session]});
   if(current.kind==='distribute')await client.invalidateQueries({queryKey:['company-extension-fields',session,companyId]});
  }catch(e){
   const unknown=!(e instanceof ApiError)||e.statusCode>=500;setUncertain(unknown);
   if(!unknown)pending.current=null;
   const conflict=e instanceof ApiError&&current.kind==='distribute'&&['HQ_TARGET_CONFLICT','FIELD_REMOVAL_UNSUPPORTED'].includes(e.errorCode??'');
   setError(unknown?'처리 결과를 확인할 수 없습니다. 같은 요청을 다시 시도하세요.':conflict?'본사 배포 상태가 변경되어 다시 조회합니다. 기존 필드와 선택 내용을 확인한 뒤 다시 시도하세요.':`요청 실패: ${e instanceof ApiError?(e.errorCode??e.message):'오류'}`);
   if(conflict)await client.invalidateQueries({queryKey:['hq-fields',session]});
  }finally{setBusy(false);}
 };
 if(!allowed)return null;
 const locked=busy||uncertain||capability.isFetching;
 const currentTarget=target.data?.target?.companyId===companyId?target.data.target:null;
 const assigned=new Set(currentTarget?.fields.map(field=>field.id)??[]);
 const definitions=target.data?.definitions??[];
 const selectable=definitions.filter(field=>!assigned.has(field.id));
 const define=(event:React.FormEvent)=>{event.preventDefault();if(locked||!capability.data?.capabilities.define)return;const labels={'ko-KR':ko.trim(),'en-US':en.trim()};
  if(!/^x_[a-z][a-z0-9_]{0,60}$/.test(key)||!labels['ko-KR']||!labels['en-US']||/[<>]/.test(ko+en)||!reason.trim()){setError('필드 키, 한국어·영어 명칭과 변경 사유를 확인하세요.');return;}
  const body:Record<string,unknown>={key,type,labels,reason:reason.trim()};
  if(type==='text'&&maxLength){const value=Number(maxLength);if(!Number.isSafeInteger(value)||value<1||value>4000){setError('최대 길이는 1~4000의 정수여야 합니다.');return;}body.maxLength=value;}
  if(type==='number'){const low=min===''?undefined:Number(min),high=max===''?undefined:Number(max);if((low!==undefined&&!Number.isFinite(low))||(high!==undefined&&!Number.isFinite(high))||(low!==undefined&&high!==undefined&&low>high)){setError('숫자 최소·최대 범위를 확인하세요.');return;}if(low!==undefined)body.min=low;if(high!==undefined)body.max=high;}
  void run({kind:'define',key:crypto.randomUUID(),body});
 };
 const distribute=(event:React.FormEvent)=>{event.preventDefault();if(locked||target.isFetching||target.isError||!currentTarget||!target.data?.capabilities.distribute||!distributionReason.trim())return;
  const add=selectable.filter(field=>chosen.includes(field.id)).map(({id,version})=>({id,version}));if(!add.length){setError('추가할 필드를 선택하세요.');return;}
  const fields=[...currentTarget.fields,...add];if(fields.length>100){setError('한 법인에 배포할 필드는 최대 100개입니다.');return;}
  void run({kind:'distribute',key:crypto.randomUUID(),body:{companyId,expectedHqReleaseId:currentTarget.hqReleaseId,fields,reason:distributionReason.trim()}});
 };
 return <details className="hq-field-manager"><summary>본사 신규 필드 정의·법인 배포</summary><p>리드 확장 필드만 지원합니다. 배포 후에도 대상 법인의 검증·게시가 필요하며 사용자 화면에 즉시 적용되지 않습니다.</p>
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}{uncertain&&<p>미확인 요청: {pending.current?.kind} · {String(pending.current?.body.companyId??'본사 정의')} <button type="button" disabled={busy} onClick={()=>void run()}>같은 요청 다시 시도</button></p>}
  {capability.data?.capabilities.define&&<form onSubmit={define}><h3>본사 필드 생성</h3><fieldset disabled={locked}><label>필드 키<input required value={key} placeholder="x_example" maxLength={63} onChange={e=>setKey(e.target.value)}/></label><label>데이터 유형<select value={type} onChange={e=>setType(e.target.value as typeof type)}><option value="text">문자</option><option value="number">숫자</option><option value="boolean">참/거짓</option><option value="date">날짜</option></select></label><label>한국어 명칭<input required maxLength={200} value={ko} onChange={e=>setKo(e.target.value)}/></label><label>영어 명칭<input required maxLength={200} value={en} onChange={e=>setEn(e.target.value)}/></label>{type==='text'&&<label>최대 길이<input type="number" min="1" max="4000" step="1" value={maxLength} onChange={e=>setMaxLength(e.target.value)}/></label>}{type==='number'&&<><label>최소값<input type="number" step="any" value={min} onChange={e=>setMin(e.target.value)}/></label><label>최대값<input type="number" step="any" value={max} onChange={e=>setMax(e.target.value)}/></label></>}<label>생성 사유<input required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button type="submit">필드 정의 생성</button></fieldset></form>}
  {capability.data?.capabilities.distribute&&<form onSubmit={distribute}><h3>대상 법인 배포</h3>{!companyId?<p>먼저 위에서 대상 법인을 선택하세요.</p>:target.isPending||target.isFetching?<p role="status">대상 법인 배포 상태 확인 중…</p>:target.isError||!currentTarget?<p role="alert">대상 법인의 배포 상태·권한을 확인할 수 없어 배포할 수 없습니다. <button type="button" onClick={()=>void target.refetch()}>다시 확인</button></p>:<fieldset disabled={locked}><legend>{companyName||companyId}</legend><p>현재 본사 배포: {currentTarget.hqReleaseId??'없음'} · 기존 필드 {currentTarget.fields.length}개는 유지됩니다.</p>{selectable.length?selectable.map(field=><label key={field.id}><input type="checkbox" checked={chosen.includes(field.id)} onChange={e=>setChosen(old=>e.target.checked?[...old,field.id]:old.filter(id=>id!==field.id))}/>{field.labels['ko-KR']} · {field.key} · {field.id} / v{field.version}</label>):<p>추가할 수 있는 본사 필드가 없습니다.</p>}<label>배포 사유<input required maxLength={2000} value={distributionReason} onChange={e=>setDistributionReason(e.target.value)}/></label><button type="submit" disabled={!chosen.length}>선택 법인에 배포</button></fieldset>}</form>}
 </details>;
}
