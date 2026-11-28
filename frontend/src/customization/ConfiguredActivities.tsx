import React,{useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {apiGet} from '../api';
import {useConfigurationSession} from './session';
import {leadUiText} from './labels';
import {ConfiguredRecords,type RecordSpec} from './ConfiguredRecords';
const day=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function ConfiguredActivities(){
 const session=useConfigurationSession();return <ActivitiesWorkspace key={session} session={session}/>;
}
function ActivitiesWorkspace({session}:{session:string}){
 const {i18n}=useTranslation(),t=leadUiText(i18n.language),[date,setDate]=useState(day);
 const effective=useQuery({queryKey:['activity-calendar-policy',session,i18n.language],queryFn:()=>apiGet<{labels:Record<string,string>;policy:Array<{id:string;enabled:boolean;visible:boolean;readable:boolean;writable:boolean;masking:string}>}>('/api/runtime/effective-config?locale='+encodeURIComponent(i18n.language)),retry:false,gcTime:0});
 const p=(id:string)=>effective.data?.policy.find(item=>item.id===id);
 const calendarAllowed=['HQ_ACTIVITY','ACT.calendar'].every(id=>p(id)?.enabled&&p(id)?.visible&&p(id)?.readable)&&['activity.calendarFrom','activity.calendarTo'].every(id=>p(id)?.enabled&&p(id)?.visible&&p(id)?.readable&&p(id)?.writable)&&p('activity.plannedAt')?.readable&&p('activity.plannedAt')?.masking==='none';
 const spec:RecordSpec={screen:'HQ_ACTIVITY',path:'/api/activities',listPath:'/api/activities/calendar?from='+date+'&to='+date,detailFromList:true,title:{ko:'활동',en:'Activities'},createAction:'ACT.planOne',createSuffix:'/plans',saveAction:'ACT.consultation',saveWhen:{field:'activity.status',column:'status',values:['IN_PROGRESS']},fields:[
  {id:'activity.relatedType',column:'related_type',input:'relatedType',required:true,writeIn:['create'],options:['LEAD','ACCOUNT','OPPORTUNITY']},
  {id:'activity.relatedPublicId',column:'related_public_id',input:'relatedPublicId',required:true,writeIn:['create'],referenceBy:{input:'relatedType',choices:{LEAD:{path:'/api/leads',labelColumn:'hospital_name'},ACCOUNT:{path:'/api/accounts',labelColumn:'account_name'},OPPORTUNITY:{path:'/api/opportunities',labelColumn:'opportunity_name'}}}},
  {id:'activity.subject',column:'subject',input:'subject',required:true,writeIn:['create']},
  {id:'activity.plannedAt',column:'planned_at',input:'plannedAt',type:'datetime-local',required:true,writeIn:['create']},
  {id:'activity.visitPurpose',column:'visit_purpose',input:'visitPurpose',clearValue:''},
  {id:'activity.consultation',column:'consultation_content',input:'consultationContent',clearValue:'',writeIn:['edit']},
  {id:'activity.directWorkType',column:'direct_work_type',input:'directWorkType',writeIn:['create'],options:['DIRECT_WORK','DIRECT_LEAVE']},
  {id:'activity.directWorkReason',column:'direct_work_reason',input:'directWorkReason',writeIn:['create']},
  {id:'activity.relatedName',column:'related_name_snapshot'},{id:'activity.status',column:'status'},{id:'activity.inAt',column:'in_at'},{id:'activity.outAt',column:'out_at'}
 ],commands:[{action:'ACT.checkIn',suffix:'/check-in',method:'POST',captureLocation:true,when:{field:'activity.status',column:'status',values:['PLANNED']},fields:[]},{action:'ACT.checkOut',suffix:'/check-out',method:'POST',captureLocation:true,when:{field:'activity.status',column:'status',values:['IN_PROGRESS']},fields:[]}]};
 spec.toolbarCommands=[{action:'ACT.planBulk',path:'/api/activities/plans/bulk',suffix:'',method:'POST',fields:[],rows:{input:'plans',labelId:'section:activity.bulk',max:100,fields:spec.fields.filter(f=>['activity.relatedType','activity.relatedPublicId','activity.subject','activity.plannedAt'].includes(f.id))}}];
 if(effective.isPending)return <p role="status">{t('loading')}</p>;
 if(effective.isError)return <p role="alert">{t('error')} <button onClick={()=>void effective.refetch()}>{t('retry')}</button></p>;
 if(!calendarAllowed)return <p role="alert">{t('denied')}</p>;
 return <><label>{effective.data?.labels['activity.calendarFrom']} / {effective.data?.labels['activity.calendarTo']}<input type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label><ConfiguredRecords key={date} spec={spec}/></>;
}
