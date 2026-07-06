'use client';

import { Button } from '../components/ui';

// A6: precached by public/sw.js at install time so it's always available as a
// fallback for failed navigations while offline — the one page guaranteed to
// render even with zero connectivity.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-zinc-950">
      <span className="text-4xl" aria-hidden="true">
        📡
      </span>
      <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        Momito needs a connection to load your practice data. Reconnect and try again — nothing
        you were working on has been lost.
      </p>
      <Button onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );
}
