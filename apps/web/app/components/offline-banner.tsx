'use client';

import { useEffect, useState } from 'react';

// A6: ambient connectivity indicator. Mounted globally (root layout) so it
// shows on both the auth pages and the authenticated shell — a thin, dismissible-
// by-reconnecting banner rather than a modal, since being offline shouldn't
// block reading whatever's already on screen.
//
// MOM-177: it now covers a second state the first one could never detect.
// `navigator.onLine` is true whenever the device has a network association, so
// it stays true while the API itself is asleep — which on Render's free tier is
// every first request after ~15 minutes idle, taking 30–60s to wake. That is
// the single most common slow moment in this app and it used to be invisible:
// a bare spinner, then either content or "Failed to fetch". api-client emits
// momito:api-waking / momito:api-awake around it so the wait can be named.
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser API (navigator.onLine) on mount, not synchronizing React state
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    const startWaking = () => setWaking(true);
    const stopWaking = () => setWaking(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    window.addEventListener('momito:api-waking', startWaking);
    window.addEventListener('momito:api-awake', stopWaking);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('momito:api-waking', startWaking);
      window.removeEventListener('momito:api-awake', stopWaking);
    };
  }, []);

  // Being offline is the more actionable of the two, and it also explains the
  // slow request, so it wins when both are set.
  if (offline) {
    return (
      <div
        role="status"
        className="sticky top-0 z-50 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white"
      >
        You&apos;re offline — some data may be out of date until you reconnect.
      </div>
    );
  }

  if (waking) {
    return (
      <div
        role="status"
        className="sticky top-0 z-50 bg-indigo-600 px-4 py-1.5 text-center text-xs font-medium text-white"
      >
        Waking the server — the first request after a quiet spell takes a moment.
      </div>
    );
  }

  return null;
}
