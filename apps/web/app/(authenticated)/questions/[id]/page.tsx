'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { questionsApi } from '../../../lib/api-client';
import type { QuestionResponse } from '@momito/shared';
import { Card, Badge, Spinner, ErrorBanner, EmptyState } from '../../../components/ui';
import { Markdown } from '../../../components/Markdown';

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

export default function QuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = await questionsApi.get(id);
      setQuestion(q);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load question');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching on mount
  useEffect(() => { fetchQuestion(); }, [fetchQuestion]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await questionsApi.delete(id);
      router.push('/questions');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete question');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && !question) {
    return (
      <div>
        <button
          onClick={() => router.push('/questions')}
          className="mb-4 text-sm text-indigo-600 hover:text-indigo-500"
        >
          ← Back to questions
        </button>
        <ErrorBanner message={error} onRetry={fetchQuestion} />
      </div>
    );
  }

  if (!question) {
    return (
      <EmptyState
        icon="🔍"
        title="Question not found"
        action={
          <button
            onClick={() => router.push('/questions')}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to questions
          </button>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => router.push('/questions')}
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          ← Back to questions
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/questions/${id}/edit`)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            Are you sure you want to delete this question? This action cannot be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{question.title}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge label={TYPE_LABELS[question.type] ?? question.type} variant={question.type} />
              <Badge label={question.difficulty} variant={question.difficulty} />
              {question.topic && <Badge label={question.topic.name} />}
            </div>
          </div>
        </div>

        <div className="prose prose-sm max-w-none">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Prompt
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{question.prompt}</p>
        </div>

        {question.companies && question.companies.length > 0 && (
          <div className="mt-4">
            <span className="text-sm font-medium text-zinc-500">Asked at: </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {question.companies.map((c) => (
                <Badge key={c.id} label={c.name} />
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Reference Answer */}
      {question.referenceAnswer && (
        <Card>
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Reference Answer</h2>
            <span className="text-sm text-zinc-400">{showAnswer ? 'Hide' : 'Show'}</span>
          </button>
          {showAnswer && (
            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <Markdown className="prose-sm">{question.referenceAnswer}</Markdown>
            </div>
          )}
        </Card>
      )}

      {/* Practice this question */}
      <Card className="mt-4 border-indigo-200 dark:border-indigo-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Practice This Question</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Start a quick practice session with this question
            </p>
          </div>
          <button
            onClick={async () => {
              const { sessionsApi } = await import('../../../lib/api-client');
              try {
                const res = await sessionsApi.create({
                  sessionType: 'quick_practice',
                  questionCount: 1,
                  questionIds: [id],
                  title: `Practice: ${question.title.slice(0, 40)}`,
                });
                window.location.href = `/practice/session/${res.session.id}`;
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Failed to start session';
                setError(msg);
              }
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Start Practice
          </button>
        </div>
      </Card>

      {/* Notes / Source */}
      {question.notes && (
        <Card className="mt-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{question.notes}</p>
        </Card>
      )}

      {question.sourceUrl && (
        <p className="mt-4 text-sm">
          <span className="text-zinc-500">Source: </span>
          <a
            href={question.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-500 underline"
          >
            {question.sourceUrl}
          </a>
        </p>
      )}
    </div>
  );
}
