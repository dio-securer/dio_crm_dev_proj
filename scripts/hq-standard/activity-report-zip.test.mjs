import test from 'node:test';
import assert from 'node:assert/strict';
import {startHqServer} from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
async function setup(t){
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>{server.server.closeAllConnections();return server.close()});
 async function client(loginId){const token=await(await fetch(server.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId,password:'HQ-DEMO'})})).json();return async(method,url,body)=>{const r=await fetch(server.url+url,{method,headers:{authorization:`Bearer ${token.accessToken}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()}}}
 const sales=await client('hq-sales'),branch=await client('hq-branch');
 const a=await sales('POST','/api/activities/plans',{relatedType:'ACCOUNT',relatedPublicId:seedIDs.approvedAccount,plannedAt:'2026-12-01T09:00:00+09:00',visitPurpose:'상담'});assert.equal(a.status,200);
 server.app.repository('HQ_DEMO').transact(d=>{const row=d.collections.activities.find(x=>x.public_id===a.body.activityPublicId);row.status='COMPLETED';row.consultation_content='원래 상담';row.in_at='2026-12-01T00:00:00Z';row.out_at='2026-12-01T01:00:00Z'});
 const prepared=await sales('POST','/api/activity-reports/prepare',{reportDate:'2026-12-01'});assert.equal(prepared.status,200);return {server,sales,branch,report:prepared.body,activityId:a.body.activityPublicId};
}
test('submission snapshots, replays, locked pending edits, and separate resubmission versions',async t=>{
 const {server,sales,branch,report,activityId}=await setup(t);const url=`/api/activity-reports/${report.public_id}`;
 const submitted=await sales('POST',url+'/request-approval',{expectedVersion:report.version,idempotencyKey:'report-first'});assert.equal(submitted.status,200,JSON.stringify(submitted.body));
 const committed=server.app.repository('HQ_DEMO').read();assert.deepEqual(await sales('POST',url+'/request-approval',{expectedVersion:report.version,idempotencyKey:'report-first'}),submitted);assert.deepEqual(server.app.repository('HQ_DEMO').read(),committed);
 const first=await sales('GET',url);assert.equal(first.body.submission_snapshots.length,1);assert.equal(first.body.submission_snapshots[0].items[0].consultation_snapshot,'원래 상담');assert.equal(first.body.submission_snapshots[0].branch_approver_user_id,3);assert.equal(first.body.submission_snapshots[0].division_approver_user_id,4);assert.notEqual(first.body.submission_snapshots[0].standard_version,undefined);assert.equal(first.body.submission_snapshots[0].timezone,'Asia/Seoul');
 assert.equal((await sales('PATCH',url+'/items/1',{consultationContent:'승인 대기 변경'})).status,409);
 server.app.repository('HQ_DEMO').transact(d=>{d.collections.activities.find(a=>a.public_id===activityId).consultation_content='원본 나중 변경'});
 assert.equal((await sales('GET',url)).body.submission_snapshots[0].items[0].consultation_snapshot,'원래 상담');
 assert.equal((await branch('POST',url+'/reject/branch',{comment:'수정 요청'})).status,200);
 const rejected=(await sales('GET',url)).body;
 const edited=await sales('PATCH',url+'/items/1',{consultationContent:'반려 후 수정',expectedVersion:rejected.version,idempotencyKey:'report-edit'});assert.equal(edited.status,200,JSON.stringify(edited.body));
 const afterEdit=(await sales('GET',url)).body;assert.equal((await sales('POST',url+'/request-approval',{expectedVersion:afterEdit.version,idempotencyKey:'report-second'})).status,200);
 const final=(await sales('GET',url)).body;assert.equal(final.submission_snapshots.length,2);assert.equal(final.submission_snapshots[0].items[0].consultation_snapshot,'원래 상담');assert.equal(final.submission_snapshots[1].items[0].consultation_snapshot,'반려 후 수정');
});
test('stale version and conflicting replay never modify report state',async t=>{
 const {server,sales,report}=await setup(t),url=`/api/activity-reports/${report.public_id}`;const before=server.app.repository('HQ_DEMO').read();
 assert.equal((await sales('POST',url+'/request-approval',{expectedVersion:report.version+1,idempotencyKey:'stale'})).status,409);assert.deepEqual(server.app.repository('HQ_DEMO').read(),before);
 const submitted=await sales('POST',url+'/request-approval',{expectedVersion:report.version,idempotencyKey:'same'});assert.equal(submitted.status,200);
 assert.equal((await sales('POST',url+'/request-approval',{expectedVersion:report.version+1,idempotencyKey:'same'})).status,409);
});
test('submitted snapshots never disclose hidden source details',async t=>{
 const {server,sales,report}=await setup(t),url=`/api/activity-reports/${report.public_id}`;
 assert.equal((await sales('POST',url+'/request-approval',{expectedVersion:report.version,idempotencyKey:'mask-test'})).status,200);
 server.app.standard.screens.find(s=>s.screenKey==='HQ_ACCOUNT').enabled=false;
 const result=await sales('GET',url);assert.equal(result.status,200);assert.deepEqual(result.body.items,[]);assert.deepEqual(result.body.submission_snapshots[0].items,[]);assert.equal(JSON.stringify(result.body).includes('원래 상담'),false);
});
test('report follow-ups require access to both opportunity and source activity target',async t=>{
 const {server,sales}=await setup(t),opp=seedIDs.pendingOpportunity;
 const follow=await sales('POST',`/api/opportunities/${opp}/follow-ups`,{title:'연계 후속조치',dueDate:'2026-12-04'});assert.equal(follow.status,200);
 const activity=await sales('POST','/api/activities/plans',{relatedType:'OPPORTUNITY',relatedPublicId:opp,plannedAt:'2026-12-02T09:00:00+09:00',visitPurpose:'기회 방문'});assert.equal(activity.status,200);
 const prepared=await sales('POST','/api/activity-reports/prepare',{reportDate:'2026-12-01'});assert.equal(prepared.status,200);
 const url=`/api/activity-reports/${prepared.body.public_id}`,visible=await sales('GET',url);assert.equal(visible.body.followUps[0].public_id,follow.body.public_id);
 server.app.standard.screens.find(s=>s.screenKey==='HQ_OPPORTUNITY').enabled=false;
 const hidden=await sales('GET',url);assert.equal(hidden.status,200);assert.deepEqual(hidden.body.followUps,[]);assert.equal(JSON.stringify(hidden.body).includes('연계 후속조치'),false);
});
test('HQ activity timestamps use Seoul local dates across UTC midnight and naive input',async t=>{
 const {sales}=await setup(t);
 const utc=await sales('POST','/api/activities/plans',{relatedType:'ACCOUNT',relatedPublicId:seedIDs.pendingAccount,plannedAt:'2026-12-01T23:30:00Z'});assert.equal(utc.status,200);
 const utcRow=await sales('GET',`/api/activities/${utc.body.activityPublicId}`);assert.equal(utcRow.body.planned_date,'2026-12-02');
 const local=await sales('POST','/api/activities/plans',{relatedType:'ACCOUNT',relatedPublicId:seedIDs.duplicateAccount,plannedAt:'2026-12-02T09:00'});assert.equal(local.status,200);
 const localRow=await sales('GET',`/api/activities/${local.body.activityPublicId}`);assert.equal(localRow.body.planned_at,'2026-12-02T00:00:00.000Z');assert.equal(localRow.body.planned_date,'2026-12-02');
 const report=await sales('POST','/api/activity-reports/prepare',{reportDate:'2026-12-01'});assert(report.body.items.some(row=>row.activity_public_id===utc.body.activityPublicId&&row.item_type==='PLAN'));
});
test('visit account count resolves opportunity to its account and counts each account once',async t=>{
 const {sales,server}=await setup(t);
 const activity=await sales('POST','/api/activities/plans',{relatedType:'OPPORTUNITY',relatedPublicId:seedIDs.pendingOpportunity,plannedAt:'2026-12-01T10:00:00+09:00'});assert.equal(activity.status,200);
 server.app.repository('HQ_DEMO').transact(d=>{const row=d.collections.activities.find(x=>x.public_id===activity.body.activityPublicId);row.status='COMPLETED';row.in_at='2026-12-01T01:00:00Z';row.out_at='2026-12-01T02:00:00Z'});
 const report=await sales('POST','/api/activity-reports/prepare',{reportDate:'2026-12-01'});assert.equal(report.status,200);assert.equal(report.body.visit_account_count,2);
});
test('HQ mock five-day plan includes D+5, excludes D+6 and cancelled activities',async t=>{
 const {sales,server}=await setup(t);const create=async(account,date)=>{const r=await sales('POST','/api/activities/plans',{relatedType:'ACCOUNT',relatedPublicId:account,plannedAt:`${date}T09:00:00+09:00`});assert.equal(r.status,200);return r.body.activityPublicId};
 const day5=await create(seedIDs.pendingAccount,'2026-12-06');const day6=await create(seedIDs.duplicateAccount,'2026-12-07');const cancelled=await create(seedIDs.approvedAccount,'2026-12-04');
 server.app.repository('HQ_DEMO').transact(d=>{d.collections.activities.find(a=>a.public_id===cancelled).status='CANCELLED'});
 const report=await sales('POST','/api/activity-reports/prepare',{reportDate:'2026-12-01'});assert.equal(report.status,200);
 const ids=report.body.items.map(row=>row.activity_public_id);assert(ids.includes(day5));assert(!ids.includes(day6));assert(!ids.includes(cancelled));
});
test('report server filters date, status, organization and owner within existing authorization scope',async t=>{
 const {sales,report}=await setup(t);
 const result=await sales('GET','/api/activity-reports?from=2026-12-01&to=2026-12-01&status=DRAFT&organizationId=10&ownerUserId=1');assert.equal(result.status,200);assert(result.body.some(row=>row.public_id===report.public_id));
 const hidden=await sales('GET','/api/activity-reports?from=2026-12-02&ownerUserId=1');assert.equal(hidden.status,200);assert(!hidden.body.some(row=>row.public_id===report.public_id));
 assert.equal((await sales('GET','/api/activity-reports?from=2026-02-30')).status,400);
 assert.equal((await sales('GET','/api/activity-reports?from=2026-12-10&to=2026-12-01')).status,400);
 assert.equal((await sales('GET','/api/activity-reports?companyId=2')).status,403);
});
test('only the current assigned approver can record accompaniment on a plan without changing submitted snapshot',async t=>{
 const {sales,branch,report}=await setup(t),url=`/api/activity-reports/${report.public_id}`;
 const plan=await sales('POST','/api/activities/plans',{relatedType:'ACCOUNT',relatedPublicId:seedIDs.pendingAccount,plannedAt:'2026-12-02T09:00:00+09:00'});assert.equal(plan.status,200);
 const prepared=(await sales('POST','/api/activity-reports/prepare',{reportDate:'2026-12-01'})).body;const item=prepared.items.find(row=>row.item_type==='PLAN');assert(item);
 assert.equal((await sales('POST',url+'/request-approval',{expectedVersion:prepared.version,idempotencyKey:'accompany-submit'})).status,200);
 const after=(await sales('GET',url)).body;const endpoint=`${url}/items/${item.report_item_id}/accompany/branch`;
 assert.equal((await sales('POST',endpoint,{accompany:true,expectedVersion:after.version})).status,403);
 const updated=await branch('POST',endpoint,{accompany:true,expectedVersion:after.version,idempotencyKey:'accompany-1'});assert.equal(updated.status,200,JSON.stringify(updated.body));assert.deepEqual(await branch('POST',endpoint,{accompany:true,expectedVersion:after.version,idempotencyKey:'accompany-1'}),updated);
 const current=(await sales('GET',url)).body;assert.equal(current.items.find(row=>row.report_item_id===item.report_item_id).branch_accompany_yn,true);assert.equal(current.submission_snapshots[0].items.find(row=>row.report_item_id===item.report_item_id).branch_accompany_yn,undefined);
 assert.equal((await branch('POST',`${url}/items/1/accompany/branch`,{accompany:true,expectedVersion:current.version})).status,400);
});
test('re-preparing an existing draft keeps saved report edits and item identity',async t=>{
 const {sales,report}=await setup(t),url=`/api/activity-reports/${report.public_id}`;
 const saved=await sales('PATCH',url+'/items/1',{visitPurpose:'수정한 목적',consultationContent:'저장한 상담',expectedVersion:report.version,idempotencyKey:'draft-saved'});assert.equal(saved.status,200);
 const refreshed=await sales('POST','/api/activity-reports/prepare',{reportDate:'2026-12-01'});assert.equal(refreshed.status,200);const item=refreshed.body.items.find(row=>row.report_item_id===1);
 assert.equal(item.visit_purpose_snapshot,'수정한 목적');assert.equal(item.consultation_snapshot,'저장한 상담');
});
test('a known report item id cannot mutate a source the actor can no longer read',async t=>{
 const {server,sales,report}=await setup(t),url=`/api/activity-reports/${report.public_id}`;
 server.app.standard.screens.find(s=>s.screenKey==='HQ_ACCOUNT').enabled=false;const before=server.app.repository('HQ_DEMO').read();
 const result=await sales('PATCH',url+'/items/1',{consultationContent:'무단 변경',expectedVersion:report.version,idempotencyKey:'hidden-item'});assert.equal(result.status,404);assert.deepEqual(server.app.repository('HQ_DEMO').read(),before);
});
test('re-preparing while a source is hidden does not erase the stored draft',async t=>{
 const {server,sales,report}=await setup(t),url=`/api/activity-reports/${report.public_id}`;
 const screen=server.app.standard.screens.find(s=>s.screenKey==='HQ_ACCOUNT');screen.enabled=false;
 const hidden=await sales('POST','/api/activity-reports/prepare',{reportDate:'2026-12-01'});assert.equal(hidden.status,200);assert.deepEqual(hidden.body.items,[]);
 assert.equal((await sales('POST',url+'/request-approval',{})).status,409);
 screen.enabled=true;const restored=await sales('GET',url);assert.equal(restored.body.items.length,1);assert.equal(restored.body.items[0].consultation_snapshot,'원래 상담');
});
test('re-preparing a retargeted activity cannot leak its now-hidden original snapshot',async t=>{
 const {server,sales,report,activityId}=await setup(t);
 server.app.repository('HQ_DEMO').transact(d=>{d.collections.accounts.find(a=>a.public_id===seedIDs.approvedAccount).owner_user_id=2;const activity=d.collections.activities.find(a=>a.public_id===activityId);activity.related_public_id=seedIDs.pendingAccount;activity.related_name_snapshot='새 거래처'});
 const refreshed=await sales('POST','/api/activity-reports/prepare',{reportDate:'2026-12-01'});assert.equal(refreshed.status,200);assert.equal(JSON.stringify(refreshed.body).includes('원래 상담'),false);assert.deepEqual(refreshed.body.items,[]);
 const stored=server.app.repository('HQ_DEMO').read().collections.reports.find(row=>row.public_id===report.public_id);assert.equal(stored.items[0].consultation_snapshot,'원래 상담');
 assert.equal((await sales('POST',`/api/activity-reports/${report.public_id}/request-approval`,{})).status,409);
});
test('failed dataset persistence rolls back report state, snapshot and receipt, allowing retry',async t=>{
 const {server,sales,report}=await setup(t),repo=server.app.repository('HQ_DEMO'),before=repo.read(),path=`/api/activity-reports/${report.public_id}/request-approval`;
 const originalSave=repo.options.save;repo.options.save=()=>{throw Error('injected persistence failure')};
 const payload={expectedVersion:report.version,idempotencyKey:'persistence-retry'};const failed=await sales('POST',path,payload);assert.equal(failed.status,500);assert.deepEqual(repo.read(),before);
 repo.options.save=originalSave;const recovered=await sales('POST',path,payload);assert.equal(recovered.status,200);assert.equal((await sales('GET',`/api/activity-reports/${report.public_id}`)).body.submission_snapshots.length,1);
});
test('revoked action rejects even an identical submission replay',async t=>{
 const {server,sales,report}=await setup(t),path=`/api/activity-reports/${report.public_id}/request-approval`,payload={expectedVersion:report.version,idempotencyKey:'replay-disabled'};
 assert.equal((await sales('POST',path,payload)).status,200);server.app.standard.actions.find(a=>a.actionKey==='REP.request').enabled=false;
 assert.notEqual((await sales('POST',path,payload)).status,200);
});
