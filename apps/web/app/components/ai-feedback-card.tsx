'use client';

import { useEffect, useState } from 'react';
import { aiApi } from '../lib/api-client';
import { Button, Card, Spinner } from './ui';
import { Markdown } from './Markdown';

// Workstream C: hidden entirely when GET /ai/usage reports available:false (no
// ANTHROPIC_API_KEY configured on the API) — this instance is fully usable on
// self-rating alone, so there is nothing to show, not an error state.
export function AiFeedbackCard({
  attemptId,
  aiScore: initialAiScore,
  aiFeedback: initialAiFeedback,
}: {
  attemptId: string;
  aiScore: number | null;
  aiFeedback: string | null;
}) {
  const [available, setAvailable] = useState(false);
  const [checked, setChecked] = useState(false);
  const [aiScore, setAiScore] = useState(initialAiScore);
  const [aiFeedback, setAiFeedback] = useState(initialAiFeedback);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    aiApi
      .usage()
      .then((usage) => {
        if (!cancelled) setAvailable(usage.available);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked || !available) return null;

  const grade = async (force: boolean) => {
    setGrading(true);
    setError('');
    try {
      const result = await aiApi.grade(attemptId, force);
      setAiScore(result.aiScore);
      setAiFeedback(result.aiFeedback);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI grading failed');
    } finally {
      setGrading(false);
    }
  };

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">AI Feedback</h2>
        {aiFeedback && (
          <button
            onClick={() => grade(true)}
            disabled={grading}
            className="text-xs text-indigo-600 hover:text-indigo-500 disabled:opacity-40"
          >
            Regrade
          </button>
        )}
      </div>

      {!aiFeedback && !grading && (
        <div className="mt-3">
          <Button size="sm" onClick={() => grade(false)}>
            Grade with AI
          </Button>
        </div>
      )}

      {grading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
          <Spinner className="h-4 w-4" /> Grading…
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {aiFeedback && (
        <div className="mt-3">
          {aiScore !== null && (
            <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              AI score: {Math.round(aiScore * 100)}/100
            </p>
          )}
          <Markdown>{aiFeedback}</Markdown>
        </div>
      )}
    </Card>
  );
}
