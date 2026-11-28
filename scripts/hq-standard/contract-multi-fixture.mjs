// Ephemeral, in-memory fixture for manual responsive verification only.
import {startHqServer} from './server.mjs';
import {HqRepository} from './runtime.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const factory=datasetId=>{const repo=new HqRepository({datasetId});if(datasetId==='HQ_DEMO')repo.transact(d=>{const template=d.collections.opportunities.find(x=>x.public_id===seedIDs.approvedOpportunity);for(let i=1;i<=3;i++){const id=`20000000-0000-4000-8000-${String(i).padStart(12,'0')}`;d.collections.opportunities.push({...structuredClone(template),public_id:id,opportunity_name:`CODEX MULTI DEVICE ${i}`,contract_created_yn:false,amount:400000,version:1,products:[{public_id:`30000000-0000-4000-8000-${String(i*2-1).padStart(12,'0')}`,item_name:'테스트 제품 A',amount:150000,quantity:1},{public_id:`30000000-0000-4000-8000-${String(i*2).padStart(12,'0')}`,item_name:'테스트 제품 B',amount:250000,quantity:1}]});}});return repo;};
const server=await startHqServer({port:3259,storageDir:false,autoAdvance:false,application:{repositoryFactory:factory}});
console.log(server.url);
