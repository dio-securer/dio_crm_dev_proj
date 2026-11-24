import fs from 'node:fs';
const baseline=JSON.parse(fs.readFileSync('docs/admin-platform/customization/evidence/baseline.json','utf8')).standard;
const fixtures=fs.readFileSync('frontend/src/customization/visual-preview-fixture.ts','utf8');
// Components are the HQ mock implementations selected by route wrappers; supporting shared components are included where known.
const components={
 HQ_LEAD:['frontend/src/hq-mock/HqLeadsPage.tsx','frontend/src/hq-mock/HqMockControls.tsx'],HQ_ACCOUNT:['frontend/src/AccountsPage.tsx','frontend/src/hq-mock/HqAccountDetail.tsx','frontend/src/hq-mock/HqAccountTools.tsx','frontend/src/hq-mock/HqMockControls.tsx'],
 HQ_ACTIVITY:['frontend/src/hq-mock/HqActivityPages.tsx'],HQ_ACTIVITY_REPORT:['frontend/src/hq-mock/HqActivityPages.tsx'],HQ_DIRECT_WORK:['frontend/src/hq-mock/HqActivityPages.tsx'],
 HQ_OPPORTUNITY:['frontend/src/hq-mock/HqSalesPages.tsx'],HQ_PIPELINE:['frontend/src/hq-mock/HqSalesPages.tsx'],HQ_CONTRACT:['frontend/src/hq-mock/HqSalesPages.tsx'],
 HQ_ORDER:['frontend/src/hq-mock/HqH06Pages.tsx'],HQ_FULFILLMENT:['frontend/src/hq-mock/HqH06Pages.tsx'],HQ_LEDGER:['frontend/src/hq-mock/HqH06Pages.tsx'],HQ_ANALYTICS:['frontend/src/hq-mock/HqH06Pages.tsx'],HQ_ACCOUNT360:['frontend/src/Account360Page.tsx','frontend/src/hq-mock/HqAccountDetail.tsx'],HQ_OPS:['frontend/src/hq-mock/HqH07Pages.tsx'],
 HQ_HOME:['frontend/src/hq-mock/HqH07Pages.tsx'],HQ_ADMIN_USERS:['frontend/src/hq-mock/HqH07Pages.tsx'],HQ_ADMIN_PERMISSIONS:['frontend/src/hq-mock/HqH07Pages.tsx'],HQ_ADMIN_CODES:['frontend/src/hq-mock/HqH07Pages.tsx'],HQ_ADMIN_INTERFACES:['frontend/src/hq-mock/HqH07Pages.tsx'],HQ_ADMIN_AUDIT:['frontend/src/hq-mock/HqH07Pages.tsx']};
const exports={HQ_LEAD:'HqLeadsPage',HQ_ACCOUNT:'HqAccountDetail / account list',HQ_ACTIVITY:'HqActivitiesPage',HQ_ACTIVITY_REPORT:'HqActivityReportsPage',HQ_DIRECT_WORK:'HqDirectWorkPage',HQ_OPPORTUNITY:'HqOpportunitiesPage',HQ_PIPELINE:'HqPipelineView',HQ_CONTRACT:'HqContractsPage',HQ_ORDER:'HqOrdersPage',HQ_FULFILLMENT:'HqFulfillmentView',HQ_LEDGER:'HqLedgerView',HQ_ANALYTICS:'HqAnalyticsView',HQ_ACCOUNT360:'Account360Page',HQ_OPS:'HqMockOpsPage',HQ_HOME:'HqHomePage',HQ_ADMIN_USERS:'HqAdminUsersPage',HQ_ADMIN_PERMISSIONS:'HqAdminPermissionsPage',HQ_ADMIN_CODES:'HqAdminCodesPage',HQ_ADMIN_INTERFACES:'HqAdminInterfacesPage',HQ_ADMIN_AUDIT:'HqAdminAuditPage'};
const all=baseline.screens.map(screen=>{
 const id=screen.screenKey,files=components[id];if(!files||!exports[id])throw Error('Unmapped screen '+id);
 const actions=baseline.actions.filter(x=>x.screenKey===id).map(x=>({id:x.actionKey,endpoint:x.endpoint??null}));
 const coverage=baseline.coverage.filter(x=>x.screenKeys.includes(id));
 const sections=baseline.sections.filter(x=>x.screenKey===id).map(x=>({id:x.sectionKey,fields:x.fieldKeys,actions:x.actionKeys}));
 const tabs=baseline.tabs.filter(x=>x.screenKey===id).map(x=>x.tabKey);
 const source=files.map(file=>({file,exists:fs.existsSync(file),containsAnchor:fs.existsSync(file)&&/configAnchor|data-config-id|configId=/.test(fs.readFileSync(file,'utf8'))}));
 return {screenId:id,label:screen.label,path:screen.path,component:exports[id],source,variantsFromCoverage:coverage.map(x=>({id:x.catalogId,label:x.label,sectionIds:x.sectionKeys})),sections,tabs,actions,fixtureEvidence:actions.map(x=>x.endpoint).filter(Boolean).map(endpoint=>({endpoint,staticFixtureHint:fixtures.includes(endpoint.split(' ').at(-1).split('/:')[0])})),anchorStatus:'source presence is not per-variant or runtime binding proof; inspect component and DOM',scope:'HQ mock / frozen C00 baseline; runtime inspection required'};
});
if(all.length!==20)throw Error('Expected 20 unique baseline screens, found '+all.length);
const result={scope:'20 HQ runtime baseline screens; inventory is not full element-level or popup acceptance',source:'docs/admin-platform/customization/evidence/baseline.json',screenCount:all.length,screens:all};
fs.writeFileSync('docs/admin-platform/customization/evidence/continuous-worker-b/e08-screen-inventory.json',JSON.stringify(result,null,2)+'\n');console.log(`Inventory: ${all.length} screens`);
