'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sessionsApi, type SessionDetailResponse } from '../../../../lib/api-client';
import type { SessionQuestionResponse } from '@momito/shared';
import { Card, Badge, Spinner, ErrorBanner } from '../../../../components/ui';

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

  async function handleSubmitAnswer() {
    if (!session || !answerText.trim() || submitting) return;
    const currentQuestion = session.sessionQuestions[currentIndex];
    if (!currentQuestion) return;

    setSubmitting(true);
    try {
      await sessionsApi.answer(id, {
        questionId: currentQuestion.questionId,
        answerText: answerText.trim(),
        selfRating: selfRating > 0 ? selfRating : undefined,
      });
      const newAnswered = new Set(answeredQuestions);
      newAnswered.add(currentQuestion.questionId);
      setAnsweredQuestions(newAnswered);
      setAnswerText('');
      setSelfRating(0);

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
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-800">
              {session.title || 'Practice Session'}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {answeredQuestions.size} of {totalQuestions} answered
            </p>
          </div>
          <button
            onClick={handleAbandon}
            disabled={completing}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Abandon
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${(answeredQuestions.size / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {currentQuestion && !allAnswered && (
        <Card className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <div className="flex gap-2">
              {currentQuestion.question.type && (
                <Badge
                  label={TYPE_LABELS[currentQuestion.question.type] ?? currentQuestion.question.type}
                  variant={currentQuestion.question.type}
                />
              )}
              <Badge label={currentQuestion.question.difficulty} variant={currentQuestion.question.difficulty} />
              {currentQuestion.question.topic && (
                <Badge label={currentQuestion.question.topic.name} />
              )}
            </div>
          </div>
          <h2 className="mb-3 text-lg font-semibold text-zinc-800">
            {currentQuestion.question.title}
          </h2>
          <div className="mb-6 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700">
            {currentQuestion.question.prompt}
          </div>

          {currentQuestion.question.companies && currentQuestion.question.companies.length > 0 && (
            <div className="mb-4">
              <span className="text-xs font-medium text-zinc-400">Asked at: </span>
              {currentQuestion.question.companies.map((c) => (
                <Badge key={c.id} label={c.name} />
              ))}
            </div>
          )}

          {/* Answer form */}
          <div>
            <label htmlFor="answer" className="block text-sm font-medium text-zinc-700 mb-1">
              Your Answer
            </label>
            <textarea
              id="answer"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              rows={8}
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Write your answer here..."
            />

            {/* Self rating */}
            <div className="mt-3">
              <span className="text-sm font-medium text-zinc-700">
                Self Rating <span className="text-zinc-400">(optional)</span>
              </span>
              <div className="mt-1 flex gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelfRating(selfRating === r ? 0 : r)}
                    className={`h-8 w-8 rounded-full text-sm font-medium transition-colors ${
                      selfRating >= r
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                    }`}
                    title={`${r} / 5`}
                  >
                    {r}
                  </button>
                ))}
                <span className="ml-1 text-xs text-zinc-400 self-center">1-5</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-2">
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
                  >
                    ← Previous
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleSubmitAnswer}
                disabled={!answerText.trim() || submitting}
                className="rounded-lg bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? <Spinner className="h-4 w-4" /> : answeredQuestions.has(currentQuestion.questionId) ? 'Update Answer' : 'Submit Answer'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* All answered state — show remaining questions for review or complete */}
      {allAnswered && (
        <Card className="mb-4 text-center">
          <div className="py-6">
            <span className="text-4xl">🎯</span>
            <h2 className="mt-4 text-xl font-bold text-zinc-800">All Questions Answered!</h2>
            <p className="mt-2 text-sm text-zinc-500">
              You have answered all {totalQuestions} questions. Ready to finish?
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`h-8 w-8 rounded-full text-xs font-medium ${
                    i === currentIndex
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                  title={q.question.title}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Navigation between answered questions when all done */}
      {currentQuestion && allAnswered && (
        <Card className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <div className="flex gap-2">
              <Badge label={currentQuestion.question.difficulty} variant={currentQuestion.question.difficulty} />
              {currentQuestion.question.topic && (
                <Badge label={currentQuestion.question.topic.name} />
              )}
            </div>
          </div>
          <h2 className="mb-3 text-lg font-semibold text-zinc-800">
            {currentQuestion.question.title}
          </h2>
          <div className="mb-4 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700">
            {currentQuestion.question.prompt}
          </div>
          <div className="flex gap-2">
            {currentIndex > 0 && (
              <button
                onClick={() => setCurrentIndex(currentIndex - 1)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                ← Previous
              </button>
            )}
            {currentIndex < totalQuestions - 1 && (
              <button
                onClick={() => setCurrentIndex(currentIndex + 1)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Next →
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Complete session button */}
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
