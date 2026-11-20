import fs from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import '../hq-standard/register.mjs';
const out='docs/admin-platform/customization/implementation/evidence/I02/sql-integration.json';
const prefix='CRM_CUSTOMIZATION_TEST_DB_',required=['SERVER','NAME','USER','PASSWORD','COMPANY_ID','ACTOR_ID','ISOLATED'];
const missing=required.filter(k=>!process.env[prefix+k]);
const result={stage:'I02-SQL-INTEGRATION',status:'BLOCKED',atUtc:new Date().toISOString(),networkAttempted:false,migrationExecuted:false,checks:[],missingVariableNames:missing.map(k=>prefix+k),scope:'Synthetic configuration fixtures on explicitly isolated SQL only; not real CRM/UAT or backup recovery acceptance'};
const save=()=>{fs.mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));};
if(missing.length){result.reason='Explicit isolated DB and pre-provisioned fixture identity/company are absent.';save();process.exitCode=2;}else if(process.env[prefix+'ISOLATED']!=='I02_ISOLATED_DATABASE'||!/_customization_test$/i.test(process.env[prefix+'NAME'])){result.reason='Isolated database acknowledgement/name guard failed. No connection attempted.';save();process.exitCode=2;}else{
 const require=createRequire(new URL('../../backend/package.json',import.meta.url)),sql=require('mssql');
 const {SqlAdminConfigRepository}=await import('../../backend/src/customization/sql-config-store.ts');
 const {CompanyConfigurationService,makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
 const {StandardPublicationService}=await import('../../backend/src/customization/standard-service.ts');
 const {SqlStandardRepository}=await import('../../backend/src/customization/sql-standard-store.ts');
 const companyId=process.env[prefix+'COMPANY_ID'].toLowerCase(),id=process.env[prefix+'ACTOR_ID'].toLowerCase(),actor={id,companyId};
 assert.match(companyId,/^[a-f0-9-]{36}$/);assert.match(id,/^[a-f0-9-]{36}$/);
 const options={server:process.env[prefix+'SERVER'],database:process.env[prefix+'NAME'],user:process.env[prefix+'USER'],password:process.env[prefix+'PASSWORD'],connectionTimeout:5000,requestTimeout:10000,options:{encrypt:true,trustServerCertificate:process.env[prefix+'TRUST_CERT']==='true'}};
 let pool,failCommit=false;
 const queryFor=request=>async(text,params={})=>{const req=request();for(const [key,value] of Object.entries(params))req.input(key,value);return req.query(text);};
 const db={transaction:async work=>{const tx=new sql.Transaction(pool);await tx.begin();try{const value=await work(queryFor(()=>new sql.Request(tx)));if(failCommit){failCommit=false;throw Error('INJECTED_COMMIT_FAILURE');}await tx.commit();return value;}catch(error){await tx.rollback();throw error;}}};
 const catalog={schemaVersion:1,standardReleaseId:'sql.synthetic.v1',entries:[{id:'screen',kind:'SCREEN',labelKey:'screen',support:'supported',settings:{enabled:true,visible:true,readOnly:false,required:false,order:0},capabilities:['enabled'],locks:[],dependencies:[],permissions:[],readPermissions:[],writePermissions:[],requiredTranslation:true}]};
 const artifact=makeStandardArtifact('sql.synthetic.artifact',catalog,{'ko-KR':{screen:'테스트'},'en-US':{screen:'Test'}},true),permissions=['config.read','config.edit','config.publish','config.preview','security.manage'];
 const service=()=>new CompanyConfigurationService(new SqlAdminConfigRepository(db),[artifact]);
 const check=async(name,fn)=>{await fn();result.checks.push({name,status:'PASS'});};
 try{
  result.networkAttempted=true;pool=await new sql.ConnectionPool(options).connect();
  // Provisioned schema is mandatory. Never silently run migrations against a discovered DB.
  await db.transaction(async query=>{
   const rows=await query(`SELECT c.company_id,u.user_id FROM dbo.crm_company c JOIN dbo.crm_user u ON u.company_id=c.company_id WHERE c.public_id=@companyId AND u.public_id=@id AND c.is_active=1 AND u.is_active=1 AND u.deleted_yn=0`,{companyId,id});assert.equal(rows.recordset.length,1,'Fixture identity/company missing');
   const {company_id:companyKey,user_id:userKey}=rows.recordset[0];
   const current=await query('SELECT company_id FROM dbo.crm_config_company_state WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey',{companyKey});assert.equal(current.recordset.length,0,'Fixture must be unused; preserve prior evidence and provision another fixture');
   await query('INSERT dbo.crm_config_company_state(company_id) VALUES(@companyKey)',{companyKey});
   await query('INSERT dbo.crm_config_membership(company_id,user_id,payload_json) VALUES(@companyKey,@userKey,@payload)',{companyKey,userKey,payload:JSON.stringify({active:true,permissions,denied:[]})});
   const publishers=await query('SELECT user_id FROM dbo.crm_standard_publisher WHERE user_id=@userKey',{userKey});assert.equal(publishers.recordset.length,0,'Publisher fixture must be unused');
   await query('INSERT dbo.crm_standard_publisher(user_id,can_read,can_publish) VALUES(@userKey,1,1)',{userKey});
  });
  await check('allowlisted standard publication persists without adopting company configuration',async()=>{const publication=new StandardPublicationService(new SqlStandardRepository(db),[artifact]);const head=(await publication.history(id)).catalogHead;const published=await publication.publish(id,{artifactId:artifact.id,expectedCatalogHead:head,reason:'Isolated SQL fixture standard'},'sql-standard');assert.equal(published.artifactHash,artifact.contentHash);assert.equal((await service().read(actor)).activeReleaseId,null);});
  let s=service(),draft=await s.createDraft(actor,catalog.standardReleaseId,null,'create'),validation=await s.validate(actor,draft.id,1),release;
  await check('atomic injected failure preserves draft and no active release',async()=>{failCommit=true;await assert.rejects(s.publish(actor,validation.id,null,'fault','publish-fault'));const state=await s.read(actor);assert.equal(state.activeReleaseId,null);assert.equal(state.releases.length,0);assert.equal(state.drafts[0].state,'VALIDATED');
   const counts=await queryFor(()=>pool.request())(`SELECT (SELECT COUNT(*) FROM dbo.crm_config_outbox o JOIN dbo.crm_company c ON c.company_id=o.company_id WHERE c.public_id=@companyId) outbox_count,(SELECT COUNT(*) FROM dbo.crm_config_event e JOIN dbo.crm_company c ON c.company_id=e.company_id WHERE c.public_id=@companyId AND JSON_VALUE(e.payload_json,'$.operation')='release.publish') publish_events`,{companyId});assert.equal(counts.recordset[0].outbox_count,0);assert.equal(counts.recordset[0].publish_events,0);
  });
  await check('two concurrent publishers commit exactly one release',async()=>{const attempts=await Promise.allSettled([s.publish(actor,validation.id,null,'race one','race1'),s.publish(actor,validation.id,null,'race two','race2')]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);release=attempts.find(x=>x.status==='fulfilled').value;assert.equal((await s.read(actor)).releases.length,1);});
  await check('connection restart and repository reconstruction retain release/hash',async()=>{await pool.close();pool=await new sql.ConnectionPool(options).connect();s=service();const state=await s.read(actor);assert.equal(state.activeReleaseId,release.id);assert.equal(state.releases[0].contentHash,release.contentHash);});
  await check('current permission revocation invalidates previously validated publish',async()=>{draft=await s.createDraft(actor,catalog.standardReleaseId,release.id,'next');validation=await s.validate(actor,draft.id,1);await s.changeMember(actor,id,{active:true,permissions:permissions.filter(p=>p!=='config.publish'),denied:[]},'revoke');await assert.rejects(s.publish(actor,validation.id,release.id,'denied','after-revoke'),e=>e.code==='PERMISSION_DENIED');assert.equal((await s.read(actor)).activeReleaseId,release.id);});
  result.status='PASS';result.reason='Configuration persistence subset passed. Real business concurrency, process crash and backup/restore remain separate gates.';
 }catch(error){result.status='FAIL';result.errorCode=String(error.code??error.name??'ERROR');result.reason='Execution failed; connection details and raw driver errors are intentionally omitted.';process.exitCode=1;}finally{await pool?.close();save();}
}
