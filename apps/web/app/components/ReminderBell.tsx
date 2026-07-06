'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { remindersApi } from '../lib/api-client';

// MOM-080: top-bar reminder indicator — the Today page already surfaces
// reminders in the ranked queue, but there was no ambient signal outside
// Today that something is due. Counts pending reminders already at/past
// their `dueAt` (the same predicate the API uses for "due", not merely
// "exists") so the badge only appears when something is actually actionable.
export function ReminderBell() {
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    remindersApi
      .list()
      .then((reminders) => {
        if (cancelled) return;
        const now = Date.now();
        const due = reminders.filter(
          (r) => r.status === 'pending' && new Date(r.dueAt).getTime() <= now,
        ).length;
        setDueCount(due);
      })
      .catch(() => {
        // Ambient indicator only — a failed fetch here shouldn't surface an error banner.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href="/today"
      aria-label={dueCount > 0 ? `${dueCount} reminders due` : 'Reminders'}
      className="relative rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      🔔
      {dueCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
          {dueCount > 9 ? '9+' : dueCount}
        </span>
      )}
    </Link>
  );
}
