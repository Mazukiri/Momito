'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { dashboardApi, recommendationsApi, remindersApi, reviewsApi } from '../../lib/api-client';
import type { PracticeRecommendationResponse, ReminderResponse, ReviewStateResponse } from '@momito/shared';
import { Card, Badge, ErrorBanner, ListSkeleton } from '../../components/ui';
import { TodayReviewCard } from '../../components/TodayReviewCard';

// MOM-032/033 (Today integration): a single priority-ranked queue (plan §6.1)
// merging due FSRS reviews (MOM-027/029/030/031), real recommendations (interview
// countdowns, weakness repair, overdue tasks, career readiness gaps, job deadlines,
// résumé drift, reading inbox — the same standardized-reason RecommendationsService
// the dashboard uses), and reminders (MOM-080). Each source keeps its own card UI
// (inline re-rating for reviews, dismiss for reminders, navigate for
// recommendations) but they're interleaved by one computed priority instead
// of stacked in separate sections.
const TYPE_LABELS: Record<PracticeRecommendationResponse['type'], string> = {
  practice: 'Practice',
  task: 'Task',
  reading: 'Reading',
  job: 'Job',
  profile: 'Profile',
};

// Due reviews rank above everything by default (spaced-repetition urgency
// compounds the longer an item waits), then scale further with how overdue
// they are. Recommendations keep their own service-computed priority as-is.
// Overdue reminders rank just under fresh due-reviews; reminders not yet due
// sink to the bottom of the queue rather than crowding out anything actionable
// right now, but still surface (nothing is hidden).
function reviewPriority(review: ReviewStateResponse): number {
  const overdueHours = Math.max(0, (Date.now() - new Date(review.due).getTime()) / 3_600_000);
  return 200 + Math.min(overdueHours, 100);
}

function reminderPriority(reminder: ReminderResponse): number {
  const overdueHours = (Date.now() - new Date(reminder.dueAt).getTime()) / 3_600_000;
  return overdueHours >= 0 ? 150 + Math.min(overdueHours, 50) : 30;
}

type QueueEntry =
  | { kind: 'review'; priority: number; data: ReviewStateResponse }
  | { kind: 'recommendation'; priority: number; data: PracticeRecommendationResponse }
  | { kind: 'reminder'; priority: number; data: ReminderResponse };

export default function TodayPage() {
  const router = useRouter();
  const [items, setItems] = useState<PracticeRecommendationResponse[]>([]);
  const [reminders, setReminders] = useState<ReminderResponse[]>([]);
  const [dueReviews, setDueReviews] = useState<ReviewStateResponse[]>([]);
  const [streak, setStreak] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [recommendations, reminderList, due, summary] = await Promise.all([
        recommendationsApi.list(),
        remindersApi.list(),
        reviewsApi.due(),
        dashboardApi.summary(),
      ]);
      setItems(recommendations);
      setReminders(reminderList);
      setDueReviews(due);
      setStreak(summary.streak);
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

  const queue = useMemo<QueueEntry[]>(() => {
    const entries: QueueEntry[] = [
      ...dueReviews.map((data): QueueEntry => ({ kind: 'review', priority: reviewPriority(data), data })),
      ...items.map((data): QueueEntry => ({ kind: 'recommendation', priority: data.priority, data })),
      ...reminders.map((data): QueueEntry => ({ kind: 'reminder', priority: reminderPriority(data), data })),
    ];
    return entries.sort((a, b) => b.priority - a.priority);
  }, [dueReviews, items, reminders]);

  // Removes the item from the queue immediately rather than waiting on a
  // full fetchAll() (recommendations + reminders + due reviews + dashboard
  // summary — four endpoints) round trip before the tap has any visible
  // effect. Rolls back and surfaces an error if the request actually fails.
  async function dismissReminder(id: string) {
    const previous = reminders;
    setReminders((current) => current.filter((r) => r.id !== id));
    try {
      await remindersApi.dismiss(id);
    } catch (err: unknown) {
      setReminders(previous);
      setError(err instanceof Error ? err.message : 'Failed to dismiss reminder');
    }
  }

  // The inline review used to expand into bare rating buttons — a grade with
  // no prompt, no recall attempt, no reveal. TodayReviewCard now runs the real
  // loop (prompt → recall → reveal → grade) in place; this handler just drops
  // the item from the queue once its grade is saved.
  function completeReview(review: ReviewStateResponse) {
    setDueReviews((current) => current.filter((r) => r.objectId !== review.objectId));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Today</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Your single priority queue: due reviews, interview prep, tasks, readiness gaps, career
            deadlines, and reminders, ranked by urgency.
          </p>
        </div>
        {/* A3: consistency streak — consecutive days with >=1 answer attempt.
            Only rendered once loaded so it never flashes 0 before the real value. */}
        {!loading && streak !== null && streak > 0 && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
            title={`${streak} day streak`}
          >
            🔥 {streak}
          </span>
        )}
      </div>

      {loading && <ListSkeleton count={5} />}

      {!loading && error && <ErrorBanner message={error} onRetry={fetchAll} />}

      {!loading && !error && queue.length === 0 && (
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

      {!loading && !error && queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((entry) => {
            if (entry.kind === 'review') {
              const review = entry.data;
              return (
                <TodayReviewCard
                  key={`review:${review.id}`}
                  review={review}
                  onDone={() => completeReview(review)}
                  onError={setError}
                />
              );
            }

            if (entry.kind === 'reminder') {
              const reminder = entry.data;
              return (
                <Card key={`reminder:${reminder.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">{reminder.title}</p>
                      <p className="mt-1 text-xs text-zinc-400">{new Date(reminder.dueAt).toLocaleString()}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge label="Reminder" />
                      <button
                        onClick={() => dismissReminder(reminder.id)}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </Card>
              );
            }

            const item = entry.data;
            return (
              <button
                key={`recommendation:${item.id}`}
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
            );
          })}
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
