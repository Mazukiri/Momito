'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { profileScoresApi } from '../../../../lib/api-client';
import type { ProfileScoreResponse } from '@momito/shared';
import { Card, EmptyState, ErrorBanner, Spinner } from '../../../../components/ui';

const CATEGORY_FIELDS: Array<{
  key: keyof Pick<ProfileScoreResponse, 'skillsMatch' | 'projectQuality' | 'experienceDepth' | 'presentation'>;
  label: string;
  gaps: keyof Pick<ProfileScoreResponse, 'skillsGaps' | 'projectGaps' | 'experienceGaps' | 'presentationGaps'>;
}> = [
  { key: 'skillsMatch', label: 'Skills Match', gaps: 'skillsGaps' },
  { key: 'projectQuality', label: 'Project Quality', gaps: 'projectGaps' },
  { key: 'experienceDepth', label: 'Experience Depth', gaps: 'experienceGaps' },
  { key: 'presentation', label: 'Presentation', gaps: 'presentationGaps' },
];

function CategoryCard({
  score,
  field,
}: {
  score: ProfileScoreResponse;
  field: (typeof CATEGORY_FIELDS)[number];
}) {
  const value = score[field.key];
  const gaps = score[field.gaps];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">{field.label}</h2>
        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full ${value >= 0.75 ? 'bg-green-500' : value >= 0.45 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      {gaps.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {gaps.map((gap) => (
            <li key={gap} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              {gap}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-green-600">No major gaps detected in this category.</p>
      )}
    </Card>
  );
}

export default function ProfileScoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [score, setScore] = useState<ProfileScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [taskMsg, setTaskMsg] = useState('');

  async function generateTasks() {
    setGenerating(true);
    setTaskMsg('');
    try {
      const { created } = await profileScoresApi.generateTasks(id);
      setTaskMsg(
        created > 0
          ? `Added ${created} gap task${created === 1 ? '' : 's'} to your study plan.`
          : 'No new tasks — these gaps are already tracked.',
      );
    } catch (err: unknown) {
      setTaskMsg(err instanceof Error ? err.message : 'Could not create tasks');
    } finally {
      setGenerating(false);
    }
  }

  const fetchScore = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await profileScoresApi.get(id);
      setScore(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile score');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching
    fetchScore();
  }, [fetchScore]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && !score) {
    return (
      <div>
        <button
          onClick={() => router.push('/profile/scores')}
          className="mb-4 text-sm text-indigo-600 hover:text-indigo-500"
        >
          Back to scores
        </button>
        <ErrorBanner message={error} onRetry={fetchScore} />
      </div>
    );
  }

  if (!score) {
    return (
      <Card>
        <EmptyState
          icon="?"
          title="Score not found"
          action={
            <button
              onClick={() => router.push('/profile/scores')}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Back to scores
            </button>
          }
        />
      </Card>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push('/profile/scores')}
        className="mb-4 text-sm text-indigo-600 hover:text-indigo-500"
      >
        Back to scores
      </button>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{score.targetLabel}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Created {new Date(score.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <button
            onClick={generateTasks}
            disabled={generating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? 'Adding…' : 'Turn gaps into tasks'}
          </button>
          {taskMsg && <p className="mt-2 text-xs text-zinc-500">{taskMsg}</p>}
        </div>
      </div>

      {score.suggestions.length > 0 && (
        <Card className="mb-6 border-indigo-200 dark:border-indigo-900">
          <h2 className="mb-3 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Suggestions</h2>
          <div className="space-y-2">
            {score.suggestions.map((suggestion) => (
              <div key={suggestion} className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                {suggestion}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {CATEGORY_FIELDS.map((field) => (
          <CategoryCard key={field.key} score={score} field={field} />
        ))}
      </div>

      {score.jdText && (
        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Job Description Used</h2>
          <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">{score.jdText}</p>
        </Card>
      )}
    </div>
  );
}
