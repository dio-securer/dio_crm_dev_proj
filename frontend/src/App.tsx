import { HqCollectionPlansPage } from './hq-mock/HqCollectionPlansPage';
import {MANAGED_EXTRA_ROUTES} from './customization/managed-routes';
import {useConfiguredNavigation} from './customization/navigation';
import {isGlobalExecutiveDemoMode} from './demo/demo-mode';
import {useTranslation} from 'react-i18next';
import {leadUiText} from './customization/labels';
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useGlobalization } from './market/globalization-context';
import { AppShell } from './ui/AppShell';
import { APP_ROUTES } from './app/route-config';
import { renderScreen } from './app/screen-registry';
import { getScreenProfile } from './app/screen-profile';
import { resolveScreenProfileCode } from './app/screen-resolver';
import { HqMockControls } from './hq-mock/HqMockControls';
import { useHqMock } from './hq-mock/HqMockProvider';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from './api';
import type { ScreenKey } from './app/screen-profile';

type HqMenu = { screenKey?: string; path?: string; label: string; labelKey: string };
const hqAdminRoutes: Array<{ screenKey: ScreenKey; path: string; icon: string }> = [
  { screenKey: 'HQ_CONTRACT', path: '/collection-plans', icon: 'ledger' },
  { screenKey: 'HQ_HOME', path: '/', icon: 'analytics' },
  { screenKey: 'HQ_ADMIN_USERS', path: '/hq-admin/users', icon: 'account' },
  { screenKey: 'HQ_ADMIN_PERMISSIONS', path: '/hq-admin/permissions', icon: 'ops' },
  { screenKey: 'HQ_ADMIN_CODES', path: '/hq-admin/codes', icon: 'ledger' },
  { screenKey: 'HQ_ADMIN_INTERFACES', path: '/hq-admin/interfaces', icon: 'ops' },
  { screenKey: 'HQ_ADMIN_AUDIT', path: '/hq-admin/audit', icon: 'report' }
];

export default function App() {
  const { globalization, featureEnabled } = useGlobalization();
  const hq = useHqMock();
  const navigation=useConfiguredNavigation(!hq.enabled&&!isGlobalExecutiveDemoMode());
  const {i18n}=useTranslation(),text=leadUiText(i18n.language);
  const menu = useQuery<HqMenu[]>({ queryKey: ['hq-menu', hq.session?.user.loginId], queryFn: () => apiGet('/api/hq/menu'), enabled: hq.enabled && !!hq.session });

  let screenProfileCode: string;
  try {
    screenProfileCode = resolveScreenProfileCode(globalization);
  } catch {
    return <div role="alert">SCREEN_PROFILE_NOT_RESOLVED</div>;
  }

  const screenProfile = getScreenProfile(screenProfileCode);
  if (!screenProfile) return <div role="alert">SCREEN_PROFILE_NOT_REGISTERED</div>;

  const activeRoutes = APP_ROUTES.filter(route => {
    if (route.feature && !featureEnabled(route.feature)) return false;
    const screen=screenProfile.screens[route.slot];return !!screen&&navigation.allowed(screen);
  }).sort((a,b)=>navigation.order(screenProfile.screens[a.slot]!)-navigation.order(screenProfile.screens[b.slot]!));

  const hqRoutes = [...APP_ROUTES.map(route => ({ screenKey: screenProfile.screens[route.slot], path: route.slot === 'lead' ? '/leads' : route.path,
    icon: route.icon, mobilePrimary: route.mobilePrimary, end: route.end })), ...hqAdminRoutes.map(route => ({...route,mobilePrimary:false,end:false}))].filter((route): route is typeof route & { screenKey: ScreenKey } => !!route.screenKey);
  const collectionRouteIndex=hqRoutes.findIndex(route=>route.path==='/collection-plans');
  if(collectionRouteIndex>=0){const [collectionRoute]=hqRoutes.splice(collectionRouteIndex,1);hqRoutes.splice(hqRoutes.findIndex(route=>route.path==='/contracts')+1,0,collectionRoute);}
  const permitted = new Set(menu.data?.map(item => item.screenKey));
  const links = hq.enabled ? hqRoutes.filter(route => permitted.has(route.screenKey)).map(route => {
    const definition = menu.data?.find(item => item.screenKey === route.screenKey);
    return { to: route.path, labelKey: definition?.labelKey ?? route.screenKey, label: route.path === '/collection-plans' ? '수금계획' : definition?.label, icon: route.icon, mobilePrimary: route.mobilePrimary, end: route.end };
  }) : activeRoutes.map(({ path: _path, slot: _slot, feature: _feature, ...link }) => ({...link,...(navigation.label(screenProfile.screens[_slot]!)?{label:navigation.label(screenProfile.screens[_slot]!)}:{})}));

  if(navigation.managed)for(const route of MANAGED_EXTRA_ROUTES.filter(r=>navigation.allowed(r.screen)))links.push({to:route.path,labelKey:route.screen,label:navigation.label(route.screen),icon:route.icon,mobilePrimary:false,end:false});
  if(navigation.managed){const screenFor=(to:string)=>MANAGED_EXTRA_ROUTES.find(r=>r.path===to)?.screen??screenProfile.screens[APP_ROUTES.find(r=>r.to===to)!.slot]!;links.sort((a,b)=>navigation.order(screenFor(a.to))-navigation.order(screenFor(b.to)));}
  if(navigation.pending)return <main role="status">{text('loading')}</main>;
  if(navigation.error)return <main role="alert">{text('error')} <button onClick={navigation.refresh}>{text('retry')}</button></main>;
  if (hq.enabled && menu.isPending) return <main role="status">메뉴를 불러오는 중…</main>;
  if (hq.enabled && menu.error) return <main role="alert">{menu.error instanceof Error ? menu.error.message : String(menu.error)}</main>;

  return (
    <AppShell links={links}>
      <HqMockControls />
      <Routes>
        {navigation.managed&&MANAGED_EXTRA_ROUTES.filter(r=>navigation.allowed(r.screen)).map(r=><Route key={r.path} path={r.path} element={r.element}/>)}
        {hq.enabled ? hqRoutes.map(route => <Route key={route.path} path={route.path}
          element={permitted.has(route.screenKey) ? (route.path === '/collection-plans' ? <HqCollectionPlansPage /> : renderScreen(route.screenKey)) : <main role="alert">SCREEN_ACCESS_DENIED</main>} />) : activeRoutes.map(route => {
          const screenKey = screenProfile.screens[route.slot];
          if (!screenKey) return null;
          return <Route key={route.path} path={route.path} element={renderScreen(screenKey)} />;
        })}
        <Route path="*" element={hq.enabled||navigation.managed ? <main role="alert">{text('denied')}</main> : <Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
