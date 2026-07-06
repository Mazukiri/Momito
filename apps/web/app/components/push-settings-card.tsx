'use client';

import { useEffect, useState } from 'react';
import { pushApi } from '../lib/api-client';
import { Button, Card } from './ui';

// ADR-0008: hidden entirely when GET /push/config reports available:false (no
// VAPID keys configured on the API) — same dormant-until-configured pattern
// as AiFeedbackCard. iOS only allows push for a PWA installed to the home
// screen, so a plain Safari tab will hit the permission-denied/unsupported
// copy below rather than actually subscribing.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

type Status = 'unknown' | 'unsupported' | 'denied' | 'off' | 'on';

export function PushSettingsCard() {
  const [available, setAvailable] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState<Status>('unknown');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    pushApi
      .config()
      .then(async (config) => {
        if (cancelled) return;
        setAvailable(config.available);
        setPublicKey(config.publicKey);
        if (!config.available) return;

        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
          setStatus('unsupported');
          return;
        }
        if (Notification.permission === 'denied') {
          setStatus('denied');
          return;
        }
        // getRegistration() resolves immediately (undefined if none) — unlike
        // `.ready`, which never resolves until a service worker is actually
        // registered, and the SW is production-only (sw-register.tsx).
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          setStatus('unsupported');
          return;
        }
        const existing = await registration.pushManager.getSubscription();
        setStatus(existing ? 'on' : 'off');
      })
      .catch(() => setAvailable(false))
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked || !available) return null;

  async function enable() {
    setWorking(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey!) as BufferSource,
      });
      await pushApi.subscribe(subscription.toJSON() as never);
      setStatus('on');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not enable notifications');
    } finally {
      setWorking(false);
    }
  }

  async function disable() {
    setWorking(true);
    setError('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await pushApi.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus('off');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not disable notifications');
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Notifications</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Get a push notification when a reminder is due, even if Momito isn&apos;t open.
          </p>
        </div>
        {status === 'on' && (
          <Button size="sm" onClick={disable} disabled={working}>
            Disable
          </Button>
        )}
        {status === 'off' && (
          <Button size="sm" onClick={enable} disabled={working}>
            Enable notifications
          </Button>
        )}
      </div>

      {status === 'unsupported' && (
        <p className="mt-2 text-sm text-zinc-500">
          Your browser doesn&apos;t support push notifications, or Momito isn&apos;t installed to your home screen yet.
          On iPhone: open this site in Safari, tap Share → Add to Home Screen, then reopen it from there.
        </p>
      )}
      {status === 'denied' && (
        <p className="mt-2 text-sm text-zinc-500">
          Notifications are blocked for Momito. Enable them for this site in your device settings to turn this on.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Card>
  );
}
