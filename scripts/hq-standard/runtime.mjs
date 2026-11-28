import './register.mjs';
const { installCustomerRoutes } = await import('../../backend/src/hq-mock/customer-routes.ts');
const { installActivityRoutes } = await import('../../backend/src/hq-mock/activity-routes.ts');
const { installSalesRoutes } = await import('../../backend/src/hq-mock/sales-routes.ts');
const { installOrderRoutes } = await import('../../backend/src/hq-mock/order-routes.ts');
const { installAnalyticsRoutes } = await import('../../backend/src/hq-mock/analytics-routes.ts');
import { extendHqRuntimeStandard } from '../../frontend/src/app/hq-runtime-standard.ts';
const [{HqApplication},{HqRepository},{createHqStandardRegistry,HQ_CATALOG_IDS},{ACCOUNT_INTERFACE_FIELDS},{MARKET_FEATURE_KEYS},{APP_ROUTES},{HQ_SCREEN_PROFILE},{HQ_ACCOUNT_FIELD_PROFILE}] = await Promise.all([
  import('../../backend/src/hq-mock/app.ts'), import('../../backend/src/hq-mock/repository.ts'),
  import('../../frontend/src/app/hq-standard-registry.ts'), import('../../packages/contracts/src/account-interface.ts'),
  import('../../packages/contracts/src/globalization.ts'), import('../../frontend/src/app/route-config.ts'),
  import('../../frontend/src/app/screen-profile.ts'), import('../../frontend/src/market/field-profiles/HQ_ACCOUNT.ts')
]);
export {HqApplication,HqRepository};
export function createHqApplication(options = {}) {
  const screenBindings = [
    ...APP_ROUTES.filter(r=>HQ_SCREEN_PROFILE.screens[r.slot]).map(r=>({screenKey:HQ_SCREEN_PROFILE.screens[r.slot],routeKey:r.slot,path:r.slot === 'lead' ? '/leads' : r.path})),
    {screenKey:'HQ_HOME',routeKey:'home',path:'/'},
    ...[['HQ_ADMIN_USERS','adminUsers','/hq-admin/users'],['HQ_ADMIN_PERMISSIONS','adminPermissions','/hq-admin/permissions'],
      ['HQ_ADMIN_CODES','adminCodes','/hq-admin/codes'],['HQ_ADMIN_INTERFACES','adminInterfaces','/hq-admin/interfaces'],
      ['HQ_ADMIN_AUDIT','adminAudit','/hq-admin/audit']].map(([screenKey,routeKey,path])=>({screenKey,routeKey,path}))
  ];
  const capabilities = {screens:screenBindings,catalogIds:HQ_CATALOG_IDS,featureKeys:MARKET_FEATURE_KEYS};
  const standard = createHqStandardRegistry({screenBindings,accountInterfaceFields:ACCOUNT_INTERFACE_FIELDS,accountFieldProfile:HQ_ACCOUNT_FIELD_PROFILE,featureKeys:MARKET_FEATURE_KEYS});
  const app = new HqApplication({standard:extendHqRuntimeStandard(standard),capabilities,...options});
  installCustomerRoutes(app);
  installActivityRoutes(app);
  installSalesRoutes(app);
  installOrderRoutes(app);
  installAnalyticsRoutes(app);
  return app;
}
