import fs from 'node:fs';import {createHash} from 'node:crypto';import '../hq-standard/register.mjs';
const {validateCatalog,validateTranslations,canonicalConfigJson}=await import('../../packages/contracts/src/crm-customization.ts');
const artifact=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-codes-review.json','utf8'));
const issues=validateCatalog(artifact.catalog),translations=validateTranslations(artifact.catalog.entries,['ko-KR','en-US'],'ko-KR',artifact.translations,{});
const expected=createHash('sha256').update(canonicalConfigJson({catalog:artifact.catalog,translations:artifact.translations,publicationReady:artifact.publicationReady})).digest('hex');
const codes=new Set();
for(const file of fs.readdirSync('backend/src/customization').filter(f=>f.endsWith('.ts')&&!f.endsWith('.spec.ts'))){
 const source=fs.readFileSync('backend/src/customization/'+file,'utf8');
 for(const match of source.matchAll(/(?:configAssert\([\s\S]*?,\s*\d{3}\s*,|new ConfigError\(\s*\d{3}\s*,)\s*'([A-Z][A-Z0-9_]+)'/g))codes.add(match[1]);
}
const missingErrors=[...codes].sort().flatMap(code=>['ko-KR','en-US'].filter(locale=>!artifact.translations[locale]?.['customization.errors.'+code]).map(locale=>({code,locale})));
const migration=JSON.parse(fs.readFileSync('docs/admin-platform/customization/implementation/evidence/I02/hq-migration-inventory.json','utf8'));
const report={stage:'I02 step 5',status:'NOT_READY',artifactId:artifact.id,contentHash:artifact.contentHash,hashValid:expected===artifact.contentHash,catalogIssues:issues,translationIssues:translations,missingErrorTranslations:missingErrors,migrationIssues:migration.counts.requiresMigration,publicationReady:artifact.publicationReady,blockers:['HQ DTO/workflow migration acceptance','Configured frontend coverage','Complete error translations','Isolated DB validation deferred by user','Whole I02 independent acceptance'],scope:'Preparation audit only. Does not modify artifacts or publication allowlist.'};
fs.writeFileSync('docs/admin-platform/customization/implementation/evidence/I02/standard-readiness.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,hashValid:report.hashValid,catalogIssues:issues.length,translationIssues:translations.length,missingErrorTranslations:missingErrors.length,migrationIssues:report.migrationIssues}));
if(!report.hashValid||issues.length||translations.length||missingErrors.length)process.exitCode=1;
