import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// This is an explicit readiness gate, not a fake in-memory SQL acceptance test.
// The real restart/failure/concurrency suite requires provisioned isolated SQL fixtures.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const required=['CRM_CUSTOMIZATION_TEST_DB_SERVER','CRM_CUSTOMIZATION_TEST_DB_NAME','CRM_CUSTOMIZATION_TEST_DB_USER','CRM_CUSTOMIZATION_TEST_DB_PASSWORD'];
const missing=required.filter(key=>!process.env[key]);
const out=path.join(root,'docs/admin-platform/customization/implementation/evidence/I02');fs.mkdirSync(out,{recursive:true});
const result={stage:'I02-SQL',status:'BLOCKED',atUtc:new Date().toISOString(),missingVariableNames:missing,reason:missing.length?'No explicitly provisioned isolated SQL test database. Existing application defaults are not a test database.':'SQL test fixture/rollback provisioning and Q04 approval evidence have not been supplied.',migrationExecuted:false,networkAttempted:false,sourceOnly:['backend/src/customization/sql-config-store.ts','docs/admin-platform/customization/implementation/sql/012_CRM_Customization_DRAFT.sql'],requiredEvidence:['Q04 schema/isolated environment confirmation','Repository restart + committed release/hash retention','Injected transaction failure leaves pointer/audit/outbox/receipt atomic','Two concurrent publishers + business-write/security races','Database backup/restore rehearsal']};
fs.writeFileSync(path.join(out,'sql-readiness.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exitCode=2;
