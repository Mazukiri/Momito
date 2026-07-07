'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  SELF_RATING_SCALE,
  type QuestionResponse,
  type ReviewStateResponse,
  type StoryResponse,
} from '@momito/shared';
import { attemptsApi, questionsApi, reviewsApi, storiesApi } from '../lib/api-client';
import { useTimer } from '../lib/use-timer';
import { Badge, Card, Spinner } from './ui';
import { Markdown } from './Markdown';

// A due review on Today used to expand into bare 1-5 buttons — a grade with no
// prompt, no recall, no reveal. That is spaced-repetition theater: FSRS gets a
// grade, the user gets nothing. This card is the real loop inline
// (plan §12.1 Learning Golden Path, 2 taps from Today per UX invariant §2.3.5):
//
//   expand → read the prompt → try to recall (optionally typing it)
//   → reveal the reference → grade Again/Hard/Good/Easy
//
// A typed recall is stored as a real standalone AnswerAttempt (history,
// streak, weakness signals); a mental-only recall records just the review
// grade. Story reviews rehearse the STAR content the same way.
export function TodayReviewCard({
  review,
  onDone,
  onError,
}: {
  review: ReviewStateResponse;
  /** Called after a grade is saved so the queue can drop the item. */
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [phase, setPhase] = useState<'collapsed' | 'recall' | 'revealed'>('collapsed');
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [story, setStory] = useState<StoryResponse | null>(null);
  const [recallText, setRecallText] = useState('');
  const [saving, setSaving] = useState(false);
  // Same interval-based timing as session AnswerForm (MOM-036) — started when
  // the prompt appears, read when the grade is saved.
  const timer = useTimer(false);

  const detailHref = review.objectType === 'story' ? '/stories' : `/questions/${review.objectId}`;

  async function expand() {
    if (phase !== 'collapsed') {
      setPhase('collapsed');
      return;
    }
    setLoading(true);
    try {
      if (review.objectType === 'question') {
        setQuestion(await questionsApi.get(review.objectId));
      } else if (review.objectType === 'story') {
        setStory(await storiesApi.get(review.objectId));
      }
      timer.reset();
      timer.start();
      setPhase('recall');
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to load review item');
    } finally {
      setLoading(false);
    }
  }

  async function grade(selfRating: number) {
    if (saving) return;
    setSaving(true);
    try {
      const timeSpentSeconds = timer.elapsedSeconds > 0 ? timer.elapsedSeconds : undefined;
      if (review.objectType === 'question' && recallText.trim()) {
        // A written recall is a first-class attempt — it schedules the review
        // server-side and counts toward streak/history/weakness signals.
        await attemptsApi.create({
          questionId: review.objectId,
          answerText: recallText.trim(),
          selfRating,
          timeSpentSeconds,
        });
      } else {
        await reviewsApi.record(review.objectType, review.objectId, selfRating);
      }
      onDone();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to record review');
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <Link href={detailHref} className="min-w-0 flex-1 text-left">
          <p className="font-medium text-zinc-800 hover:underline dark:text-zinc-100">
            {review.title ?? 'Review item'}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Due {new Date(review.due).toLocaleString()}</p>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Badge label={review.objectType === 'story' ? 'Story' : 'Review'} />
          <button
            onClick={expand}
            disabled={loading}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {loading ? <Spinner className="h-3 w-3" /> : phase === 'collapsed' ? 'Review now' : 'Collapse'}
          </button>
        </div>
      </div>

      {phase !== 'collapsed' && question && (
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <div className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {question.prompt}
          </div>

          {phase === 'recall' && (
            <>
              <textarea
                value={recallText}
                onChange={(event) => setRecallText(event.target.value)}
                rows={3}
                placeholder="Recall it from memory — type your answer to log a real attempt, or recall silently and reveal."
                className="mt-3 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button
                onClick={() => setPhase('revealed')}
                className="mt-3 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Show answer
              </button>
            </>
          )}

          {phase === 'revealed' && (
            <div className="mt-3">
              {recallText.trim() && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your recall</p>
                  <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 p-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    {recallText}
                  </div>
                </div>
              )}
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Reference answer
              </p>
              {question.referenceAnswer ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <Markdown className="prose-sm">{question.referenceAnswer}</Markdown>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-400 dark:border-zinc-700">
                  No reference answer yet — grade yourself on what you know is required.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {phase !== 'collapsed' && story && (
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {phase === 'recall' && (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Rehearse this story out loud from memory — situation, task, action, result — then reveal it to
                check what you dropped.
              </p>
              <button
                onClick={() => setPhase('revealed')}
                className="mt-3 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Reveal story
              </button>
            </>
          )}
          {phase === 'revealed' && (
            <dl className="space-y-2 text-sm">
              {(
                [
                  ['Situation', story.situation],
                  ['Task', story.task],
                  ['Action', story.action],
                  ['Result', story.result],
                  ['Metrics', story.metrics],
                ] as const
              )
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</dt>
                    <dd className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{value}</dd>
                  </div>
                ))}
            </dl>
          )}
        </div>
      )}

      {phase === 'revealed' && (
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">How was your recall?</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SELF_RATING_SCALE.map((option) => (
              <button
                key={option.value}
                disabled={saving}
                onClick={() => grade(option.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-left transition-colors hover:border-indigo-400 disabled:opacity-50 dark:border-zinc-700"
              >
                <span className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">{option.label}</span>
                <span className="block text-xs text-zinc-400">{option.description}</span>
              </button>
            ))}
          </div>
          {saving && (
            <p className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
              <Spinner className="h-3 w-3" /> Saving…
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
