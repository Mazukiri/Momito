'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sessionsApi, type SessionDetailResponse } from '../../../../lib/api-client';
import type { MissTagReason, SessionQuestionResponse } from '@momito/shared';
import { Spinner, ErrorBanner } from '../../../../components/ui';
import { SessionHeader } from '../../../../components/session/SessionHeader';
import { AnswerForm } from '../../../../components/session/AnswerForm';
import { AllAnsweredPanel } from '../../../../components/session/AllAnsweredPanel';
import { ReviewQuestionCard } from '../../../../components/session/ReviewQuestionCard';

export default function ActiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [selfRating, setSelfRating] = useState<number>(0);
  const [missTags, setMissTags] = useState<MissTagReason[]>([]);
  const [reflectionNote, setReflectionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);

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
      // Pre-populate answered questions from existing attempts
      const answered = new Set(s.answerAttempts.map((a) => a.questionId));
      setAnsweredQuestions(answered);
      // Resume from the first unanswered question
      if (s.sessionQuestions.length > 0) {
        const firstUnanswered = s.sessionQuestions.findIndex(
          (sq) => !answered.has(sq.questionId)
        );
        setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : s.sessionQuestions.length - 1);
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

  async function handleSubmitAnswer(timeSpentSeconds: number) {
    if (!session || !answerText.trim() || submitting) return;
    const currentQuestion = session.sessionQuestions[currentIndex];
    if (!currentQuestion) return;

    setSubmitting(true);
    try {
      await sessionsApi.answer(id, {
        questionId: currentQuestion.questionId,
        answerText: answerText.trim(),
        selfRating: selfRating > 0 ? selfRating : undefined,
        timeSpentSeconds,
        missTags: missTags.length > 0 ? missTags : undefined,
        reflectionNote: reflectionNote.trim() || undefined,
      });
      const newAnswered = new Set(answeredQuestions);
      newAnswered.add(currentQuestion.questionId);
      setAnsweredQuestions(newAnswered);
      setAnswerText('');
      setSelfRating(0);
      setMissTags([]);
      setReflectionNote('');

      // Move to next unanswered question
      const nextUnanswered = session.sessionQuestions.findIndex((sq, i) =>
        i > currentIndex && !newAnswered.has(sq.questionId)
      );
      if (nextUnanswered >= 0) {
        setCurrentIndex(nextUnanswered);
      } else {
        // All answered — prompt completion
        setCurrentIndex(session.sessionQuestions.length); // "all done" state
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
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

  if (!session || session.sessionQuestions.length === 0) {
    return null;
  }

  const questions = session.sessionQuestions;
  const totalQuestions = questions.length;
  const allAnswered = answeredQuestions.size >= totalQuestions;
  const currentQuestion: SessionQuestionResponse | null = currentIndex < totalQuestions ? questions[currentIndex] : null;

  return (
    <div className="mx-auto max-w-3xl">
      <SessionHeader
        title={session.title}
        answeredCount={answeredQuestions.size}
        totalQuestions={totalQuestions}
        completing={completing}
        onAbandon={handleAbandon}
      />

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {currentQuestion && !allAnswered && (
        <AnswerForm
          currentQuestion={currentQuestion}
          currentIndex={currentIndex}
          totalQuestions={totalQuestions}
          answerText={answerText}
          onAnswerTextChange={setAnswerText}
          selfRating={selfRating}
          onSelfRatingChange={setSelfRating}
          missTags={missTags}
          onMissTagsChange={setMissTags}
          reflectionNote={reflectionNote}
          onReflectionNoteChange={setReflectionNote}
          submitting={submitting}
          isAlreadyAnswered={answeredQuestions.has(currentQuestion.questionId)}
          onPrevious={() => setCurrentIndex(currentIndex - 1)}
          onSubmit={handleSubmitAnswer}
        />
      )}

      {allAnswered && (
        <AllAnsweredPanel questions={questions} currentIndex={currentIndex} onSelect={setCurrentIndex} />
      )}

      {currentQuestion && allAnswered && (
        <ReviewQuestionCard
          currentQuestion={currentQuestion}
          currentIndex={currentIndex}
          totalQuestions={totalQuestions}
          onPrevious={() => setCurrentIndex(currentIndex - 1)}
          onNext={() => setCurrentIndex(currentIndex + 1)}
        />
      )}

      <div className="flex justify-center">
        <button
          onClick={handleComplete}
          disabled={completing}
          className="rounded-lg bg-green-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {completing ? <Spinner className="h-4 w-4" /> : 'Complete Session'}
        </button>
      </div>
    </div>
  );
}
