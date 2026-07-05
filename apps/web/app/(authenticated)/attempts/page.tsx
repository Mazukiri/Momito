'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { attemptsApi } from '../../lib/api-client';
import type { AnswerAttemptResponse } from '@momito/shared';
import { Card, Badge, Pagination, Spinner, EmptyState, ErrorBanner } from '../../components/ui';

export default function AttemptsListPage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<AnswerAttemptResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 20;

  const fetchAttempts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await attemptsApi.list({ page, limit });
      setAttempts(res.data);
      setTotal(res.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load attempts');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching
    fetchAttempts();
  }, [fetchAttempts]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-800">Answer History</h1>
        <p className="mt-1 text-sm text-zinc-500">All your past answers across sessions</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchAttempts} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : attempts.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No answers yet"
          description="Start a practice session to see your answers here."
          action={
            <button
              onClick={() => router.push('/practice/new')}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Start Practice
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {attempts.map((a) => (
            <Card
              key={a.id}
              onClick={() => router.push(`/attempts/${a.id}`)}
              className="cursor-pointer hover:border-zinc-300 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">
                    Attempt on {new Date(a.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 line-clamp-2">
                    {a.answerText.slice(0, 200)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.selfRating && (
                      <Badge label={`Rating: ${a.selfRating}/5`} variant="medium" />
                    )}
                    {a.sessionId && (
                      <span className="text-xs text-indigo-500">From a session</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
          <Pagination page={page} limit={limit} total={total} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
