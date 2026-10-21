const DEV_PWA_RESET_KEY = 'dio-crm:dev-pwa-reset:v1';

async function resetDevPwaState() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  const cacheKeys = 'caches' in window ? await caches.keys() : [];
  const dioCacheKeys = cacheKeys.filter(key => key.startsWith('dio-crm-'));
  const hadDevPwaState = registrations.length > 0 || dioCacheKeys.length > 0;

  await Promise.all(registrations.map(registration => registration.unregister()));
  await Promise.all(dioCacheKeys.map(key => caches.delete(key)));

  if (hadDevPwaState && sessionStorage.getItem(DEV_PWA_RESET_KEY) !== '1') {
    sessionStorage.setItem(DEV_PWA_RESET_KEY, '1');
    window.location.reload();
  }
}

export function registerPwa() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Vite dev is commonly opened from a phone through a LAN IP (for example 192.168.x.x).
  // Never let the production cache-first service worker control that session, otherwise
  // CSS/JS can look unchanged even after the local source has been updated.
  if (import.meta.env.DEV) {
    void resetDevPwaState().catch(error => {
      console.warn('[PWA] development cache cleanup failed', error);
    });
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => {
      console.warn('[PWA] service worker registration failed', error);
    });
  });
}
