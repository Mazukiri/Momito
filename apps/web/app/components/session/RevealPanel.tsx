'use client';

import { useState } from 'react';
import {
  isRubric,
  SELF_RATING_SCALE,
  type AnswerAttemptResponse,
  type MissTagReason,
  type SessionQuestionResponse,
} from '@momito/shared';
import { Badge, Card, Spinner } from '../ui';
import { Markdown } from '../Markdown';
import { AiFeedbackCard } from '../ai-feedback-card';
import { ReflectionPanel } from './ReflectionPanel';
import { TYPE_LABELS } from './question-type-labels';

// Attempt lifecycle (plan §7.2): Submit → **Reveal reference/rubric** →
// Reflect → Self-rate → Schedule review. This panel is everything after
// Submit. Rating is deliberately withheld until the reference answer is on
// screen — a grade chosen before seeing the reference is a guess, and FSRS
// scheduled from guesses drifts. The Again/Hard/Good/Easy labels mirror
// exactly how fsrs-scheduler maps selfRating (1→Again, 2→Hard, 3→Good,
// 5→Easy). Callers must set key={attempt.id} so navigating between answered
// questions remounts the panel with that attempt's saved reflection state.
export function RevealPanel({
  currentQuestion,
  currentIndex,
  totalQuestions,
  attempt,
  onRated,
  onPrevious,
  onNext,
  nextLabel,
}: {
  currentQuestion: SessionQuestionResponse;
  currentIndex: number;
  totalQuestions: number;
  attempt: AnswerAttemptResponse;
  /** Persist rating + reflection; resolves when saved. */
  onRated: (payload: { selfRating: number; missTags: MissTagReason[]; reflectionNote: string }) => Promise<void>;
  onPrevious?: () => void;
  onNext?: () => void;
  nextLabel?: string;
}) {
  const question = currentQuestion.question;
  const [missTags, setMissTags] = useState<MissTagReason[]>(attempt.missTags ?? []);
  const [reflectionNote, setReflectionNote] = useState(attempt.reflectionNote ?? '');
  const [saving, setSaving] = useState(false);
  const [savedRating, setSavedRating] = useState<number | null>(attempt.selfRating ?? null);
  const [error, setError] = useState('');

  async function rate(selfRating: number) {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onRated({ selfRating, missTags, reflectionNote: reflectionNote.trim() });
      setSavedRating(selfRating);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save rating');
    } finally {
      setSaving(false);
    }
  }

  const rubric = isRubric(question.rubric) ? question.rubric : null;

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-400">
          Question {currentIndex + 1} of {totalQuestions}
        </span>
        <div className="flex items-center gap-2">
          {question.type && (
            <Badge label={TYPE_LABELS[question.type] ?? question.type} variant={question.type} />
          )}
          <Badge label={question.difficulty} variant={question.difficulty} />
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">{question.title}</h2>
      <div className="mb-4 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {question.prompt}
      </div>

      {/* Your answer — kept visible so the comparison is side by side, not from memory. */}
      <div className="mb-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your answer</p>
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
          {attempt.answerText}
        </div>
      </div>

      {/* Reference answer — the reveal. */}
      <div className="mb-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          Reference answer
        </p>
        {question.referenceAnswer ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <Markdown className="prose-sm">{question.referenceAnswer}</Markdown>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-400 dark:border-zinc-700">
            This question has no reference answer yet — grade yourself on correctness and completeness, and
            consider adding one from the question page.
          </p>
        )}
      </div>

      {/* Rubric — what a strong answer must cover. */}
      {rubric && rubric.criteria.length > 0 && (
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Rubric — did your answer cover these?
          </p>
          <ul className="space-y-1.5 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            {rubric.criteria.map((criterion) => (
              <li key={criterion.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">{criterion.title}</span>
                <span className="text-zinc-400"> · {criterion.weight}/{rubric.maxScore}</span>
                <span className="block text-xs text-zinc-500">{criterion.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reflect — now that the gap is visible, tag what actually happened. */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Reflect</p>
        <ReflectionPanel
          missTags={missTags}
          onMissTagsChange={setMissTags}
          reflectionNote={reflectionNote}
          onReflectionNoteChange={setReflectionNote}
        />
      </div>

      {/* Rate — schedules the next FSRS review. */}
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          How was your recall? <span className="normal-case font-normal">(schedules your next review)</span>
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SELF_RATING_SCALE.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={saving}
              onClick={() => rate(option.value)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50 ${
                savedRating === option.value
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-zinc-300 text-zinc-700 hover:border-indigo-400 dark:border-zinc-700 dark:text-zinc-300'
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className={`block text-xs ${savedRating === option.value ? 'text-indigo-100' : 'text-zinc-400'}`}>
                {option.description}
              </span>
            </button>
          ))}
        </div>
        {saving && (
          <p className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
            <Spinner className="h-3 w-3" /> Saving…
          </p>
        )}
        {savedRating !== null && !saving && (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
            Rated — next review scheduled. You can change the rating or add reflection any time before moving on.
          </p>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      {/* Optional AI grade — rubric-grounded second opinion; hides itself when no key is configured.
          MOM-168: its suggested FSRS rating routes through rate(), so a tap-through is identical to a manual rating. */}
      <AiFeedbackCard
        attemptId={attempt.id}
        aiScore={attempt.aiScore}
        aiFeedback={attempt.aiFeedback}
        onUseSuggested={rate}
        alreadyRated={savedRating !== null}
      />

      <div className="mt-4 flex items-center justify-between">
        <div>
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Previous
            </button>
          )}
        </div>
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {nextLabel ?? 'Next question →'}
          </button>
        )}
      </div>
    </Card>
  );
}
