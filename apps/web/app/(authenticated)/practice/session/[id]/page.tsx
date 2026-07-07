'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { attemptsApi, sessionsApi, type SessionDetailResponse } from '../../../../lib/api-client';
import type { AnswerAttemptResponse, MissTagReason, SessionQuestionResponse } from '@momito/shared';
import { Spinner, ErrorBanner } from '../../../../components/ui';
import { SessionHeader } from '../../../../components/session/SessionHeader';
import { AnswerForm } from '../../../../components/session/AnswerForm';
import { AllAnsweredPanel } from '../../../../components/session/AllAnsweredPanel';
import { RevealPanel } from '../../../../components/session/RevealPanel';

// Attempt lifecycle (plan §7.2), now actually in this order:
//
//   read prompt → answer → submit
//   → REVEAL reference/rubric (new)
//   → reflect (moved here — after the reveal, where it can be honest)
//   → rate Again/Hard/Good/Easy (moved here — schedules the FSRS review)
//   → next question
//
// Each question is therefore in one of two phases: 'answer' (no attempt yet)
// or 'reveal' (attempt exists). Navigating back to an answered question
// reopens its reveal, where the rating/reflection can still be revised —
// the PATCH reschedules the review from the newest grade.
export default function ActiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attemptsByQuestion, setAttemptsByQuestion] = useState<Map<string, AnswerAttemptResponse>>(new Map());
  const [completing, setCompleting] = useState(false);
  // Once every question is answered, the same index navigation switches into a
  // browse mode over reveals; this flag keeps the "all answered" banner up.
  const [browseAll, setBrowseAll] = useState(false);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await sessionsApi.get(id);
      // If already completed/abandoned, redirect to summary
      if (s.status !== 'active') {
        router.replace(`/practice/session/${id}/summary`);
        return;
      }
      setSession(s);
      // answerAttempts arrive oldest-first; overwriting keeps the latest per question.
      const byQuestion = new Map<string, AnswerAttemptResponse>();
      for (const attempt of s.answerAttempts) byQuestion.set(attempt.questionId, attempt as AnswerAttemptResponse);
      setAttemptsByQuestion(byQuestion);
      // Resume from the first unanswered question
      if (s.sessionQuestions.length > 0) {
        const firstUnanswered = s.sessionQuestions.findIndex((sq) => !byQuestion.has(sq.questionId));
        setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
        setBrowseAll(firstUnanswered < 0);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching on mount
    fetchSession();
  }, [fetchSession]);

  const questions = useMemo(() => session?.sessionQuestions ?? [], [session]);
  const totalQuestions = questions.length;
  const answeredCount = useMemo(
    () => questions.filter((sq) => attemptsByQuestion.has(sq.questionId)).length,
    [questions, attemptsByQuestion],
  );
  const allAnswered = totalQuestions > 0 && answeredCount >= totalQuestions;
  const currentQuestion: SessionQuestionResponse | null =
    currentIndex >= 0 && currentIndex < totalQuestions ? questions[currentIndex] : null;
  const currentAttempt = currentQuestion ? attemptsByQuestion.get(currentQuestion.questionId) ?? null : null;

  async function handleSubmitAnswer(timeSpentSeconds: number) {
    if (!session || !currentQuestion || !answerText.trim() || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const attempt = await sessionsApi.answer(id, {
        questionId: currentQuestion.questionId,
        answerText: answerText.trim(),
        timeSpentSeconds,
      });
      setAttemptsByQuestion((current) => {
        const next = new Map(current);
        next.set(currentQuestion.questionId, attempt);
        return next;
      });
      setAnswerText('');
      // Stay on this question — the reveal phase renders now that an attempt exists.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRated(
    attempt: AnswerAttemptResponse,
    payload: { selfRating: number; missTags: MissTagReason[]; reflectionNote: string },
  ) {
    const updated = await attemptsApi.update(attempt.id, {
      selfRating: payload.selfRating,
      missTags: payload.missTags,
      reflectionNote: payload.reflectionNote || undefined,
    });
    setAttemptsByQuestion((current) => {
      const next = new Map(current);
      next.set(attempt.questionId, { ...attempt, ...updated });
      return next;
    });
  }

  function goToNext() {
    // Prefer the next unanswered question after the current one, then any
    // unanswered earlier one; when none remain, enter browse-all mode.
    const nextUnanswered = questions.findIndex(
      (sq, i) => i > currentIndex && !attemptsByQuestion.has(sq.questionId),
    );
    if (nextUnanswered >= 0) {
      setCurrentIndex(nextUnanswered);
      return;
    }
    const anyUnanswered = questions.findIndex((sq) => !attemptsByQuestion.has(sq.questionId));
    if (anyUnanswered >= 0) {
      setCurrentIndex(anyUnanswered);
      return;
    }
    setBrowseAll(true);
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      await sessionsApi.complete(id);
      router.push(`/practice/session/${id}/summary`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete session');
    } finally {
      setCompleting(false);
    }
  }

  async function handleAbandon() {
    if (!confirm('Abandon this session? Your answers will be saved but the session will be marked as abandoned.')) return;
    setCompleting(true);
    try {
      await sessionsApi.abandon(id);
      router.push(`/practice/session/${id}/summary`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to abandon session');
    } finally {
      setCompleting(false);
    }
  }

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

  if (!session || totalQuestions === 0) {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <SessionHeader
        title={session.title}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        completing={completing}
        onAbandon={handleAbandon}
      />

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {allAnswered && browseAll && (
        <AllAnsweredPanel questions={questions} currentIndex={currentIndex} onSelect={setCurrentIndex} />
      )}

      {currentQuestion && !currentAttempt && (
        <AnswerForm
          currentQuestion={currentQuestion}
          currentIndex={currentIndex}
          totalQuestions={totalQuestions}
          answerText={answerText}
          onAnswerTextChange={setAnswerText}
          submitting={submitting}
          onPrevious={currentIndex > 0 ? () => setCurrentIndex(currentIndex - 1) : undefined}
          onSubmit={handleSubmitAnswer}
        />
      )}

      {currentQuestion && currentAttempt && (
        <RevealPanel
          key={currentAttempt.id}
          currentQuestion={currentQuestion}
          currentIndex={currentIndex}
          totalQuestions={totalQuestions}
          attempt={currentAttempt}
          onRated={(payload) => handleRated(currentAttempt, payload)}
          onPrevious={currentIndex > 0 ? () => setCurrentIndex(currentIndex - 1) : undefined}
          onNext={allAnswered && currentIndex >= totalQuestions - 1 ? undefined : goToNext}
          nextLabel={allAnswered ? 'Next →' : 'Next question →'}
        />
      )}

      {allAnswered && (
        <div className="flex justify-center">
          <button
            onClick={handleComplete}
            disabled={completing}
            className="rounded-lg bg-green-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {completing ? <Spinner className="h-4 w-4" /> : 'Complete Session'}
          </button>
        </div>
      )}
    </div>
  );
}
