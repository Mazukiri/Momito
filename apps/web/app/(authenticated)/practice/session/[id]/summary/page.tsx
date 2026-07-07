'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sessionsApi, type SessionDetailResponse } from '../../../../../lib/api-client';
import { Card, Badge, Spinner, ErrorBanner, EmptyState } from '../../../../../components/ui';
import { MISS_TAG_LABELS } from '../../../../../components/session/ReflectionPanel';
import { Markdown } from '../../../../../components/Markdown';
import type { MissTagReason } from '@momito/shared';

const TYPE_LABELS: Record<string, string> = {
  dsa: 'DSA',
  backend: 'Backend',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  nodejs: 'Node.js',
  database: 'Database',
  os: 'OS',
  networking: 'Networking',
  oop: 'OOP',
  system_design: 'System Design',
  behavioral: 'Behavioral',
};

// Mirrors SELF_RATING_SCALE (1 Again / 2 Hard / 3-4 Good / 5 Easy) plus the
// legacy value 4 from the old star UI.
const RATING_LABELS: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Good', 5: 'Easy' };

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
  abandoned: { label: 'Abandoned', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' },
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
};

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'In progress';
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const minutes = Math.floor((end - start) / 60000);
  const seconds = Math.floor(((end - start) % 60000) / 1000);
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function SessionSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await sessionsApi.get(id);
      setSession(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching on mount
    fetchSession();
  }, [fetchSession]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div>
        <button
          onClick={() => router.push('/questions')}
          className="mb-4 text-sm text-indigo-600 hover:text-indigo-500"
        >
          ← Back to questions
        </button>
        <ErrorBanner message={error} onRetry={fetchSession} />
      </div>
    );
  }

  if (!session) {
    return (
      <EmptyState icon="🔍" title="Session not found" />
    );
  }

  const questions = session.sessionQuestions ?? [];
  const attempts = session.answerAttempts ?? [];
  const attemptMap = new Map(attempts.map((a) => [a.questionId, a]));
  const answeredCount = attemptMap.size;
  const totalCount = questions.length;

  // "Missed" = never answered, or the reveal-phase grade said Again/Hard, or
  // the user tagged what went wrong. These are exactly the items worth an
  // immediate second pass while the gap is fresh.
  const missedQuestionIds = questions
    .filter((q) => {
      const attempt = attemptMap.get(q.questionId);
      if (!attempt) return true;
      if ((attempt.selfRating ?? 0) > 0 && (attempt.selfRating ?? 0) <= 2) return true;
      if ((attempt.missTags?.length ?? 0) > 0) return true;
      return false;
    })
    .map((q) => q.questionId);

  async function handleRetryMissed() {
    if (missedQuestionIds.length === 0 || retrying) return;
    setRetrying(true);
    try {
      const created = await sessionsApi.create({
        sessionType: 'weak_area_review',
        title: `Retry: ${session?.title ?? 'missed questions'}`,
        questionIds: missedQuestionIds,
        questionCount: missedQuestionIds.length,
      });
      router.push(`/practice/session/${created.session.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start retry session');
      setRetrying(false);
    }
  }

  const statusInfo = STATUS_LABELS[session.status] ?? { label: session.status, color: 'bg-zinc-100 text-zinc-700' };

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={() => router.push('/questions')}
        className="mb-4 text-sm text-indigo-600 hover:text-indigo-500"
      >
        ← Back to questions
      </button>

      <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
        {session.title || 'Session Summary'}
      </h1>

      {/* Session stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Status</p>
          <p className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Questions</p>
          <p className="mt-1 text-xl font-bold text-zinc-800 dark:text-zinc-100">{answeredCount}/{totalCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Duration</p>
          <p className="mt-1 text-xl font-bold text-zinc-800 dark:text-zinc-100">
            {formatDuration(session.startedAt, session.endedAt)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Type</p>
          <p className="mt-1 text-sm font-medium text-zinc-700 capitalize dark:text-zinc-300">
            {session.sessionType.replace(/_/g, ' ')}
          </p>
        </Card>
      </div>

      {/* Questions and answers */}
      <h2 className="mt-8 mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Questions &amp; Answers</h2>

      <div className="space-y-4">
        {questions.map((q, i) => {
          const attempt = attemptMap.get(q.questionId);
          return (
            <Card key={q.id}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {i + 1}
                    </span>
                    <h3 className="font-medium text-zinc-800 truncate dark:text-zinc-100">{q.question.title}</h3>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge label={q.question.difficulty} variant={q.question.difficulty} />
                    {q.question.type && (
                      <Badge label={TYPE_LABELS[q.question.type] ?? q.question.type} variant={q.question.type} />
                    )}
                    {q.question.topic && <Badge label={q.question.topic.name} />}
                  </div>
                </div>
                {attempt ? (
                  <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                    Answered
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    Skipped
                  </span>
                )}
              </div>

              {attempt && (
                <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <div className="mb-2">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Your Answer</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                      {attempt.answerText.length > 300
                        ? `${attempt.answerText.slice(0, 300)}...`
                        : attempt.answerText}
                    </p>
                  </div>
                  {typeof attempt.timeSpentSeconds === 'number' && (
                    <p className="mt-2 text-xs text-zinc-400">
                      Time spent: {Math.floor(attempt.timeSpentSeconds / 60)}m {attempt.timeSpentSeconds % 60}s
                    </p>
                  )}
                  {attempt.selfRating && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Recall grade</p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          attempt.selfRating <= 2
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                        }`}
                      >
                        {RATING_LABELS[attempt.selfRating] ?? `${attempt.selfRating}/5`}
                      </span>
                    </div>
                  )}
                  {attempt.missTags && attempt.missTags.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">What happened</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {attempt.missTags.map((tag: MissTagReason) => (
                          <span
                            key={tag}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          >
                            {MISS_TAG_LABELS[tag]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {attempt.reflectionNote && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Reflection</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">{attempt.reflectionNote}</p>
                    </div>
                  )}
                  {q.question.referenceAnswer && (
                    <details className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-900">
                      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Reference answer
                      </summary>
                      <div className="border-t border-emerald-200 px-3 py-2 dark:border-emerald-900">
                        <Markdown className="prose-sm">{q.question.referenceAnswer}</Markdown>
                      </div>
                    </details>
                  )}
                  <div className="mt-2">
                    <button
                      onClick={() => router.push(`/questions/${q.questionId}`)}
                      className="text-xs text-indigo-600 hover:text-indigo-500"
                    >
                      View question →
                    </button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex justify-center gap-4">
        <button
          onClick={() => router.push('/questions')}
          className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Back to Questions
        </button>
        {missedQuestionIds.length > 0 && (
          <button
            onClick={handleRetryMissed}
            disabled={retrying}
            className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {retrying ? 'Starting…' : `Retry ${missedQuestionIds.length} missed →`}
          </button>
        )}
        <button
          onClick={() => router.push('/practice/new')}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New Session
        </button>
      </div>
    </div>
  );
}
