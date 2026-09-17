import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useGlobalization } from './market/globalization-context';
import { AppShell } from './ui/AppShell';
import { filterAppRoutes } from './app/route-config';
import { renderScreen } from './app/screen-registry';
import { getScreenProfile } from './app/screen-profile';
import { resolveScreenProfileCode } from './app/screen-resolver';

export default function App() {
  const { globalization, featureEnabled } = useGlobalization();

  let screenProfileCode: string;
  try {
    screenProfileCode = resolveScreenProfileCode(globalization);
  } catch {
    return <div role="alert">SCREEN_PROFILE_NOT_RESOLVED</div>;
  }

  const screenProfile = getScreenProfile(screenProfileCode);
  if (!screenProfile) return <div role="alert">SCREEN_PROFILE_NOT_REGISTERED</div>;

  const activeRoutes = filterAppRoutes(screenProfile.screens, featureEnabled);

  const links = activeRoutes.map(({ path: _path, slot: _slot, feature: _feature, ...link }) => link);

  return (
    <AppShell links={links}>
      <Routes>
        {activeRoutes.map(route => {
          const screenKey = screenProfile.screens[route.slot];
          if (!screenKey) return null;
          return <Route key={route.path} path={route.path} element={renderScreen(screenKey)} />;
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
