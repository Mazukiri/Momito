'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { attemptsApi } from '../../../lib/api-client';
import type { AnswerAttemptResponse, MissTagReason } from '@momito/shared';
import { Card, Spinner, ErrorBanner, EmptyState } from '../../../components/ui';
import { MISS_TAG_LABELS } from '../../../components/session/ReflectionPanel';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AttemptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [attempt, setAttempt] = useState<AnswerAttemptResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAttempt = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const a = await attemptsApi.get(id);
      setAttempt(a);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load attempt');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching
    fetchAttempt();
  }, [fetchAttempt]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && !attempt) {
    return (
      <div>
        <button
          onClick={() => router.push('/attempts')}
          className="mb-4 text-sm text-indigo-600 hover:text-indigo-500"
        >
          ← Back to history
        </button>
        <ErrorBanner message={error} onRetry={fetchAttempt} />
      </div>
    );
  }

  if (!attempt) {
    return (
      <EmptyState icon="🔍" title="Attempt not found" />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => router.push('/attempts')}
        className="mb-4 text-sm text-indigo-600 hover:text-indigo-500"
      >
        ← Back to history
      </button>

      <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Answer Detail</h1>
      <p className="mt-1 text-sm text-zinc-500">{formatDate(attempt.createdAt)}</p>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-2">
          Question
        </h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {attempt.questionId}
        </p>
        <div className="mt-4">
          <button
            onClick={() => router.push(`/questions/${attempt.questionId}`)}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            View question details →
          </button>
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-2">
          Your Answer
        </h2>
        <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{attempt.answerText}</p>
      </Card>

      {attempt.selfRating && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-2">
            Self Rating
          </h2>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((r) => (
              <span
                key={r}
                className={`text-2xl ${
                  r <= attempt.selfRating! ? 'text-indigo-500' : 'text-zinc-200 dark:text-zinc-700'
                }`}
              >
                ★
              </span>
            ))}
          </div>
          <p className="mt-1 text-sm text-zinc-500">{attempt.selfRating} / 5</p>
        </Card>
      )}

      {((attempt.missTags && attempt.missTags.length > 0) || attempt.reflectionNote) && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-2">
            Reflection
          </h2>
          {attempt.missTags && attempt.missTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attempt.missTags.map((tag: MissTagReason) => (
                <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {MISS_TAG_LABELS[tag]}
                </span>
              ))}
            </div>
          )}
          {attempt.reflectionNote && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{attempt.reflectionNote}</p>
          )}
        </Card>
      )}

      {attempt.sessionId && (
        <div className="mt-4">
          <button
            onClick={() => router.push(`/practice/session/${attempt.sessionId}/summary`)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            View Session
          </button>
        </div>
      )}
    </div>
  );
}
