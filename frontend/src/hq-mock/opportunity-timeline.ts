type Activity = {public_id:string; planned_at?:string; visit_purpose?:string; status?:string};
type FollowUp = {public_id:string; due_date:string; title:string; status?:string};
export function opportunityTimeline(activities:Activity[], followUps:FollowUp[]) {
  const visit=activities.map(row=>({id:row.public_id,kind:'activity' as const,date:row.planned_at ? new Date(row.planned_at).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}) : '',title:row.visit_purpose || '활동',status:row.status ?? ''}));
  const follow=followUps.map(row=>({id:row.public_id,kind:'followUp' as const,date:row.due_date,title:row.title,status:row.status ?? ''}));
  return [...visit,...follow].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
