import React,{useState} from 'react';
import {HttpAdminClient} from './client/admin-client';
import {adminText} from './admin-text';
export function DatasetResetPanel({client,onReset}:{client:HttpAdminClient;onReset:()=>Promise<void>}){
 const [preview,setPreview]=useState<any>(),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const path='/api/admin/mock-datasets/ADMIN_DEMO_V1/reset';
 async function run(reset=false){setBusy(true);setError('');try{if(reset){await client.request(path,'POST',{previewId:preview.previewId,expectedRevision:preview.datasetRevision,reason});await onReset();}else setPreview(await client.request(path+'/preview','POST',{}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <details><summary>{adminText('reset_title')}</summary><p>{adminText('reset_description')}</p>{error&&<p role="alert">{error}</p>}<button disabled={busy} onClick={()=>void run()}>{adminText('reset_preview')}</button>{preview&&<><pre aria-label={adminText('reset_counts')}>{JSON.stringify(preview,null,2)}</pre><label>{adminText('reset_reason')}<input aria-label={adminText('reset_reason')} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={busy||!reason.trim()} onClick={()=>void run(true)}>{adminText('reset_execute')}</button></>}</details>;
}
