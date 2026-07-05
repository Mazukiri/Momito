'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { recommendationsApi } from '../../lib/api-client';
import type { PracticeRecommendationResponse } from '@momito/shared';
import { Card, Badge, Spinner, ErrorBanner } from '../../components/ui';

// MOM-033 (Today integration half): the queue now surfaces real recommendations
// (active missions, overdue tasks, career readiness gaps, job deadlines, reading
// inbox) from the same standardized-reason RecommendationsService the dashboard
// uses. Spaced-repetition due-reviews (plan §6.1's other queue source) still can't
// appear here — that needs the ReviewState migration (MOM-027, human-approval
// gated per DECISIONS.md D-004) and MOM-032's Today API. This is the "closest
// currently available path," not the final decision-engine queue.
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await recommendationsApi.list();
      setItems(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load today');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching
    fetchRecommendations();
  }, [fetchRecommendations]);

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

      {!loading && error && <ErrorBanner message={error} onRetry={fetchRecommendations} />}

      {!loading && !error && items && items.length === 0 && (
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
