'use client';

import { useEffect } from 'react';

// A6: registers public/sw.js. Production-only — running a service worker
// during `next dev` would cache dev-server responses (including hot-reloaded
// chunks) and cause confusing stale-code bugs while developing.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  }, []);

  return null;
}
