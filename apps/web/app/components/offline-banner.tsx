'use client';

import { useEffect, useState } from 'react';

// A6: ambient connectivity indicator. Mounted globally (root layout) so it
// shows on both the auth pages and the authenticated shell — a thin, dismissible-
// by-reconnecting banner rather than a modal, since being offline shouldn't
// block reading whatever's already on screen.
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser API (navigator.onLine) on mount, not synchronizing React state
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white"
    >
      You&apos;re offline — some data may be out of date until you reconnect.
    </div>
  );
}
