'use client';

import { useEffect, useState } from 'react';
import { aiApi, type SuggestedRating } from '../lib/api-client';
import { Button, Card, Spinner } from './ui';
import { Markdown } from './Markdown';

// MOM-168: the grader speaks FSRS ('again'|'hard'|'good'|'easy'); the study loop rates on the
// 1-5 star scale. This is the exact inverse of fsrs-scheduler's SELF_RATING_TO_GRADE
// (1→Again, 2→Hard, 3/4→Good, 5→Easy) — Good maps back to 3 (the representative middle), NOT 4,
// so a tap-through and a manual "Good" schedule identically.
const RATING_FROM_SUGGESTION: Record<SuggestedRating, { value: number; label: string }> = {
  again: { value: 1, label: 'Again' },
  hard: { value: 2, label: 'Hard' },
  good: { value: 3, label: 'Good' },
  easy: { value: 5, label: 'Easy' },
};

// Workstream C: hidden entirely when GET /ai/usage reports available:false (no
// ANTHROPIC_API_KEY configured on the API) — this instance is fully usable on
// self-rating alone, so there is nothing to show, not an error state.
export function AiFeedbackCard({
  attemptId,
  aiScore: initialAiScore,
  aiFeedback: initialAiFeedback,
  onUseSuggested,
  alreadyRated = false,
}: {
  attemptId: string;
  aiScore: number | null;
  aiFeedback: string | null;
  // MOM-168: when provided, a fresh grade offers a one-tap "use the AI's rating" that routes
  // through the reveal panel's normal rate() (missTags/reflection flow identical to a manual tap).
  onUseSuggested?: (rating: number) => void;
  alreadyRated?: boolean;
}) {
  const [available, setAvailable] = useState(false);
  const [checked, setChecked] = useState(false);
  const [aiScore, setAiScore] = useState(initialAiScore);
  const [aiFeedback, setAiFeedback] = useState(initialAiFeedback);
  const [suggestedRating, setSuggestedRating] = useState<SuggestedRating | null>(null);
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
      setSuggestedRating(result.suggestedRating);
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
          {/* MOM-168: the grade becomes schedulable input — one tap sets the FSRS rating. */}
          {suggestedRating && onUseSuggested && !alreadyRated && (
            <button
              onClick={() => onUseSuggested(RATING_FROM_SUGGESTION[suggestedRating].value)}
              className="mt-3 rounded-lg border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
            >
              Rate “{RATING_FROM_SUGGESTION[suggestedRating].label}” — the AI’s suggestion
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
