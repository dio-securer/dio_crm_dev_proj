import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const script=name=>({id:name,args:['scripts/admin-customization/'+name+'.mjs']});
const plans={
 I03:[{id:'draft-editor',args:['--test','scripts/admin-customization/draft-editor.test.mjs']},script('admin-ui-browser'),script('platform-admin-ui-browser'),script('common-code-admin-ui-browser')],
 I04:[script('lead-ui-browser'),script('records-ui-browser'),script('paging-ui-browser')],
 I05:[script('workflow-ui-browser')],
 I06:[script('inspection-ui-browser')],
 I07:[script('activity-ui-browser'),script('approval-ui-browser')],
 I08:[script('reports-ui-browser'),script('navigation-ui-browser')],
 I09:[script('verify-I02'),{id:'frontend-types',args:['frontend/node_modules/typescript/bin/tsc','--noEmit','-p','frontend/tsconfig.json']},{id:'frontend-build',cwd:'frontend',args:['node_modules/vite/bin/vite.js','build']},script('validate-workflow'),script('standard-readiness')]
};
const requested=process.argv[2],stages=requested==='--all'?Object.keys(plans):[requested];
if(stages.some(stage=>!plans[stage]))throw Error('Use I03 through I09 or --all. This runner never executes SQL or deploys.');
const root=process.cwd(),runId=new Date().toISOString().replace(/[:.]/g,'-'),reports=[];
for(const stage of stages){
 const dir=path.join(root,'docs/admin-platform/customization/implementation/evidence',stage),runDir=path.join(dir,'runs',runId);fs.mkdirSync(runDir,{recursive:true});
 const results=[];
 for(const command of plans[stage]){
  console.log(stage+' '+command.id+' running');
  const run=spawnSync(process.execPath,command.args,{cwd:command.cwd?path.join(root,command.cwd):root,encoding:'utf8',windowsHide:true,timeout:240000});
  fs.writeFileSync(path.join(runDir,command.id+'.log'),(run.stdout??'')+'\n'+(run.stderr??''));
  results.push({id:command.id,status:run.status===0?'PASS':'FAIL',exitCode:run.status,error:run.error?.message??null,command:[process.execPath,...command.args],cwd:command.cwd??'.',log:'runs/'+runId+'/'+command.id+'.log'});
  console.log(stage+' '+command.id+' '+results.at(-1).status);
 }
 const report={stage,runId,status:results.every(r=>r.status==='PASS')?'PARTIAL_PASS':'FAIL',acceptance:'INCOMPLETE',scope:'Local source, synthetic HTTP/browser and fixture checks only. No real DB connection, publication or deployment.',results,remaining:['Actual isolated database and production acceptance deferred by user','HQ-specific workflow migration and complete screen/popup acceptance','External transport, upload provider, locale/output environment and business policy decisions']};
 fs.writeFileSync(path.join(runDir,'stage-checks.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(dir,'stage-checks.json'),JSON.stringify(report,null,2)+'\n');reports.push({stage,status:report.status,checks:results.length});
}
console.log(JSON.stringify({runId,stages:reports,acceptance:'INCOMPLETE',database:'NOT_CONNECTED',deployment:'NOT_PERFORMED'},null,2));if(reports.some(r=>r.status==='FAIL'))process.exitCode=1;
