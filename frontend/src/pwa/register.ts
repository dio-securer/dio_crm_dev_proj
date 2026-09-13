export function registerPwa() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => {
      console.warn('[PWA] service worker registration failed', error);
    });
  });
}
