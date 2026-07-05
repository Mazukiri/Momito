'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { recommendationsApi, remindersApi } from '../../lib/api-client';
import type { PracticeRecommendationResponse, ReminderResponse } from '@momito/shared';
import { Card, Badge, Spinner, ErrorBanner } from '../../components/ui';

// MOM-033 (Today integration half): the queue now surfaces real recommendations
// (active missions, overdue tasks, career readiness gaps, job deadlines, reading
// inbox) from the same standardized-reason RecommendationsService the dashboard
// uses, plus pending reminders (MOM-080's "Today" half — reminders already existed
// as a working query-time feature, just weren't surfaced here yet). Spaced-repetition
// due-reviews (plan §6.1's other queue source) still can't appear here — that needs
// the ReviewState migration (MOM-027, human-approval gated per DECISIONS.md D-004)
// and MOM-032's Today API. This is the "closest currently available path," not the
// final decision-engine queue.
const TYPE_LABELS: Record<PracticeRecommendationResponse['type'], string> = {
  practice: 'Practice',
  task: 'Task',
  reading: 'Reading',
  job: 'Job',
  profile: 'Profile',
};

export default function TodayPage() {
  const router = useRouter();
  const [items, setItems] = useState<PracticeRecommendationResponse[] | null>(null);
  const [reminders, setReminders] = useState<ReminderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [recommendations, reminderList] = await Promise.all([
        recommendationsApi.list(),
        remindersApi.list(),
      ]);
      setItems(recommendations);
      setReminders(reminderList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load today');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching
    fetchAll();
  }, [fetchAll]);

  async function dismissReminder(id: string) {
    setWorking(true);
    try {
      await remindersApi.dismiss(id);
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss reminder');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Today</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your highest-priority missions, tasks, readiness gaps, and career deadlines.
          Spaced-repetition reviews will join this queue once scheduling is implemented.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {!loading && error && <ErrorBanner message={error} onRetry={fetchAll} />}

      {!loading && !error && reminders.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Reminders</h2>
          <div className="space-y-2">
            {reminders.map((reminder) => (
              <Card key={reminder.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-800 dark:text-zinc-100">{reminder.title}</p>
                    <p className="mt-1 text-xs text-zinc-400">{new Date(reminder.dueAt).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => dismissReminder(reminder.id)}
                    disabled={working}
                    className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Dismiss
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && items && items.length === 0 && reminders.length === 0 && (
        <Card>
          <p className="text-sm text-zinc-500">
            Nothing urgent right now. Start a practice session or check your career pipeline.
          </p>
          <div className="mt-3 flex gap-4">
            <Link href="/practice" className="text-sm font-medium text-indigo-600">
              Start practicing →
            </Link>
            <Link href="/jobs" className="text-sm font-medium text-indigo-600">
              View jobs →
            </Link>
          </div>
        </Card>
      )}

      {!loading && !error && items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.targetHref)}
              className="block w-full rounded-lg border border-zinc-200 p-4 text-left hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-800 dark:text-zinc-100">{item.title}</p>
                  <p className="mt-1 text-sm text-zinc-500">{item.reason}</p>
                </div>
                <Badge label={TYPE_LABELS[item.type]} />
              </div>
            </button>
          ))}
        </div>
      )}

      <Card>
        <p className="text-sm text-zinc-500">
          Looking for the full progress dashboard?{' '}
          <Link href="/dashboard" className="font-medium text-indigo-600">
            Go to Dashboard →
          </Link>
        </p>
      </Card>
    </div>
  );
}
