import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'docs/admin-platform/customization/implementation/evidence/I01');
fs.mkdirSync(out,{recursive:true});
const checks=[['catalog-build',['scripts/admin-customization/build-catalog.mjs']],['contracts',['--test','scripts/admin-customization/contracts.test.mjs','scripts/admin-customization/catalog.test.mjs']],['contracts-emit',['frontend/node_modules/typescript/bin/tsc','-p','packages/contracts/tsconfig.json']],['exports',['--test','scripts/admin-customization/contracts-export.test.mjs']],['frontend-types',['frontend/node_modules/typescript/bin/tsc','--noEmit','-p','frontend/tsconfig.json']],['backend-types',['backend/node_modules/typescript/bin/tsc','--noEmit','--incremental','false','-p','backend/tsconfig.json']],['frontend-bundle',['node_modules/vite/bin/vite.js','build'],'frontend']];
const results=[];
for(const [id,args,subdir] of checks){const run=spawnSync(process.execPath,args,{cwd:subdir?path.join(root,subdir):root,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:8*1024*1024});const log=(run.stdout??'')+'\n'+(run.stderr??'');fs.writeFileSync(path.join(out,id+'.log'),log);const row={id,command:['node',...args],cwd:subdir??'.',exitCode:run.status,status:run.status===0?'PASS':'FAIL',error:run.error?.message??null,tests:log.match(/(?:#|ℹ) tests (\d+)/)?.[1]??null};results.push(row);console.log(JSON.stringify(row));if(run.status!==0){process.exitCode=1;break;}}
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({stage:'I01',scope:'Contract and baseline artifact implementation; no runtime consumer acceptance',atUtc:new Date().toISOString(),results},null,2)+'\n');
