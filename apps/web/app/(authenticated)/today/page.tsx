'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { recommendationsApi, remindersApi, reviewsApi } from '../../lib/api-client';
import type { PracticeRecommendationResponse, ReminderResponse, ReviewStateResponse } from '@momito/shared';
import { Card, Badge, Spinner, ErrorBanner } from '../../components/ui';

// MOM-032/033 (Today integration): the queue surfaces due FSRS reviews
// (MOM-027/029/030/031's review loop), real recommendations (active missions,
// overdue tasks, career readiness gaps, job deadlines, reading inbox — the
// same standardized-reason RecommendationsService the dashboard uses), and
// pending reminders (MOM-080). This is still not a single unified priority
// queue (plan §6.1's full "Today decision engine") — that would merge all
// three sources with one ranking; for now they're three clearly-labeled
// sections, each already independently useful.
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
  const [dueReviews, setDueReviews] = useState<ReviewStateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [recommendations, reminderList, due] = await Promise.all([
        recommendationsApi.list(),
        remindersApi.list(),
        reviewsApi.due(),
      ]);
      setItems(recommendations);
      setReminders(reminderList);
      setDueReviews(due);
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

  // MOM-032 follow-up: a due item can be re-rated right from Today, without
  // opening a full session — self-rating alone is enough to reschedule its
  // next FSRS review, closing the loop back to "answer -> reflect -> return
  // to Today" without a dedicated review-session UI.
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  async function submitReview(review: ReviewStateResponse, selfRating: number) {
    setWorking(true);
    try {
      await reviewsApi.record(review.objectType, review.objectId, selfRating);
      setExpandedReviewId(null);
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record review');
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

      {!loading && !error && dueReviews.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Due for Review</h2>
          <div className="space-y-2">
            {dueReviews.map((review) => (
              <Card key={review.id}>
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => router.push(`/questions/${review.objectId}`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-medium text-zinc-800 hover:underline dark:text-zinc-100">
                      {review.title ?? 'Review item'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">Due {new Date(review.due).toLocaleString()}</p>
                  </button>
                  <button
                    onClick={() => setExpandedReviewId((current) => (current === review.id ? null : review.id))}
                    disabled={working}
                    className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Review now
                  </button>
                </div>
                {expandedReviewId === review.id && (
                  <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <span className="text-xs text-zinc-500">How did it go?</span>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => submitReview(review, rating)}
                        disabled={working}
                        className="h-8 w-8 rounded-full bg-zinc-100 text-sm font-medium text-zinc-500 hover:bg-indigo-600 hover:text-white disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400"
                        title={`${rating} / 5`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

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

      {!loading && !error && items && items.length === 0 && reminders.length === 0 && dueReviews.length === 0 && (
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
