import fs from 'node:fs';
import assert from 'node:assert/strict';

// Static inventory gate only. Runtime behavior and per-role authorization need
// separate browser and API evidence before Stage 7 can pass.
const source=fs.readFileSync('frontend/src/hq-mock/HqLeadsPage.tsx','utf8');
const preview=fs.readFileSync('frontend/src/customization/visual-preview-fixture.ts','utf8');
const catalog=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-codes-review.json','utf8')).catalog;
const expectedTabs=['basic','keyman','hospital','exclusions','hira','marketing','history','activities'];
const tabExpression=source.match(/tabs=\{\[([^\]]+)\]\.map\(key/);
assert.ok(tabExpression,'Lead detail tab expression absent');
const tabs=[...tabExpression[1].matchAll(/'([^']+)'/g)].map(match=>match[1]);
assert.deepEqual(tabs,expectedTabs,'Lead detail tab inventory changed');
const popups=['POP.LEAD.CREATE','POP.LEAD.OWNER','POP.LEAD.CONVERT'];
const popupEvidence=popups.map(id=>({id,sourceAnchor:source.includes(`configId="${id}"`),catalogEntry:catalog.entries.some(entry=>entry.id===id)}));
const tabEvidence=tabs.map(key=>({key,tabAnchorInCatalog:catalog.entries.some(entry=>entry.id===`tab:HQ_LEAD.${key}`),panelInSource:key==='activities'?source.includes("active === 'activities' && <LeadActivities"):source.includes(`'${key}'`)}));
const fixtureStates={normal:true,empty:preview.includes("fixtureState === 'empty'"),listError:preview.includes("fixtureState === 'error'"),approvalPendingForLead:false,erpPendingForLead:false,longTranslationForLead:false};
const findings=[];
for(const entry of popupEvidence)if(!entry.sourceAnchor||!entry.catalogEntry)findings.push(`popup unmapped: ${entry.id}`);
for(const entry of tabEvidence)if(!entry.tabAnchorInCatalog||!entry.panelInSource)findings.push(`tab unmapped: ${entry.key}`);
if(!source.includes('configAnchor('))findings.push('Lead element anchors absent');
const result={scope:'HQ Lead static source/catalog comparison, not runtime acceptance',tabs:tabEvidence,popups:popupEvidence,fixtureStates,findings,unverified:['all field-to-DOM coordinates','all role/company/locale/device combinations','cancel/retry and permission race in every tab','real DB and external integration','logic release execution']};
fs.writeFileSync('docs/admin-platform/customization/evidence/lead-stage7-inventory.json',JSON.stringify(result,null,2)+'\n');
assert.deepEqual(findings,[]);
console.log(JSON.stringify({tabs:tabs.length,popups:popups.length,fixtureStates,findings}));
