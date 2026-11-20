import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const out='docs/admin-platform/customization/implementation/evidence/I02';
fs.mkdirSync(out,{recursive:true});
const results=[];
for(const [id,args] of [['contracts-emit',['frontend/node_modules/typescript/bin/tsc','-p','packages/contracts/tsconfig.json']],['service',['--test','scripts/admin-customization/config-service.test.mjs','scripts/admin-customization/identity-locks.test.mjs','scripts/admin-customization/config-policy.test.mjs','scripts/admin-customization/config-domain.test.mjs','scripts/admin-customization/standard-publication.test.mjs','scripts/admin-customization/lead-commands.test.mjs']],['backend-suite',['backend/node_modules/jest/bin/jest.js','--config','backend/jest.config.cjs','--runInBand']],['backend-types',['backend/node_modules/typescript/bin/tsc','--noEmit','--incremental','false','-p','backend/tsconfig.json']],['route-inventory',['scripts/admin-customization/inventory-managed-routes.mjs']],['sql-integration',['scripts/admin-customization/config-sql-integration.mjs']]]){
 if(id==='sql-integration'&&!process.argv.includes('--with-sql')){fs.writeFileSync(`${out}/${id}.log`,'DEFERRED_EXTERNAL: SQL execution is opt-in; no database connection attempted.\n');results.push({id,status:'DEFERRED_EXTERNAL',exitCode:null,error:null});continue;}
 const run=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,timeout:120000});
 fs.writeFileSync(`${out}/${id}.log`,(run.stdout??'')+'\n'+(run.stderr??''));
 results.push({id,status:id==='sql-integration'&&run.status===2?'BLOCKED':run.status===0?'PASS':'FAIL',exitCode:run.status,error:run.error?.message??null});
}
const inventory=JSON.parse(fs.readFileSync(`${out}/managed-route-inventory.json`,'utf8'));
const report={stage:'I02',status:'INCOMPLETE',scope:'Standard publication and implemented managed CRM adapters, default-deny legacy route boundary, shared transactions and synthetic regression tests; no domain-wide or SQL/production acceptance.',results,atUtc:new Date().toISOString(),remaining:[`${inventory.counts.BLOCKED_NOT_ADAPTED??0} unadapted managed Nest routes and separate HQ runtime`,'Lead UI synthetic browser acceptance passed separately; actual SQL and reviewed artifact publication remain pending','Reviewed publication-ready standard bundle; explicit publisher/membership provisioning','Actual isolated SQL validation of DDL012 through DDL019, restart/fault/concurrency/recovery','Q01/Q02/Q04 policies, actual transport/scheduler binding, upload provider and workflow acceptance']};
fs.writeFileSync(`${out}/verification.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(results.some(x=>x.status==='FAIL'))process.exitCode=1;
