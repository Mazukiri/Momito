'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { SessionQuestionResponse } from '@momito/shared';
import { Card, Badge, Spinner } from '../ui';
import { Markdown } from '../Markdown';
import { useTimer } from '../../lib/use-timer';
import { TYPE_LABELS } from './question-type-labels';
import { SYSTEM_DESIGN_TEMPLATE } from '../../lib/system-design-template';

// MOM-035: CodeMirror depends on browser-only APIs and its language packs are
// sizable, so it's excluded from SSR and only loaded when a code question is shown.
const CodeEditor = dynamic(() => import('../CodeEditor'), { ssr: false });

export function AnswerForm({
  currentQuestion,
  currentIndex,
  totalQuestions,
  answerText,
  onAnswerTextChange,
  selfRating,
  onSelfRatingChange,
  submitting,
  isAlreadyAnswered,
  onPrevious,
  onSubmit,
}: {
  currentQuestion: SessionQuestionResponse;
  currentIndex: number;
  totalQuestions: number;
  answerText: string;
  onAnswerTextChange: (value: string) => void;
  selfRating: number;
  onSelfRatingChange: (value: number) => void;
  submitting: boolean;
  isAlreadyAnswered: boolean;
  onPrevious: () => void;
  onSubmit: (timeSpentSeconds: number) => void;
}) {
  // MOM-036: timer restarts for each new question so timeSpentSeconds reflects
  // time spent on *this* question, not the whole session.
  const timer = useTimer(true);
  useEffect(() => {
    timer.reset();
    timer.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-run per question
  }, [currentQuestion.questionId]);

  // MOM-057: system design answers follow a fixed 7-section markdown template
  // (plan §7.4). A preview toggle lets the user check formatting before submit.
  const isSystemDesign = currentQuestion.question.type === 'system_design';
  const [showPreview, setShowPreview] = useState(false);

  // MOM-035: DSA/coding answers get a syntax-highlighted code editor instead
  // of a plain textarea; every other question type is unaffected.
  const isCodeAnswer = currentQuestion.question.type === 'dsa' || currentQuestion.question.type === 'cpp';

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-400">
          Question {currentIndex + 1} of {totalQuestions}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-zinc-400" title="Time spent on this question">
            {timer.formatted}
          </span>
          {currentQuestion.question.type && (
            <Badge
              label={TYPE_LABELS[currentQuestion.question.type] ?? currentQuestion.question.type}
              variant={currentQuestion.question.type}
            />
          )}
          <Badge label={currentQuestion.question.difficulty} variant={currentQuestion.question.difficulty} />
          {currentQuestion.question.topic && <Badge label={currentQuestion.question.topic.name} />}
        </div>
      </div>
      <h2 className="mb-3 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
        {currentQuestion.question.title}
      </h2>
      <div className="mb-6 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
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

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="answer" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Your Answer
          </label>
          <div className="flex gap-3">
            {isSystemDesign && !answerText.trim() && (
              <button
                type="button"
                onClick={() => onAnswerTextChange(SYSTEM_DESIGN_TEMPLATE)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
              >
                Insert 7-section template
              </button>
            )}
            {isSystemDesign && (
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            )}
          </div>
        </div>
        {showPreview && isSystemDesign ? (
          <div className="min-h-[12rem] rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700">
            <Markdown className="prose-sm">{answerText || '*Nothing written yet.*'}</Markdown>
          </div>
        ) : isCodeAnswer ? (
          <CodeEditor
            value={answerText}
            onChange={onAnswerTextChange}
            placeholder="Write your code here..."
          />
        ) : (
          <textarea
            id="answer"
            value={answerText}
            onChange={(e) => onAnswerTextChange(e.target.value)}
            rows={8}
            className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder={isSystemDesign ? 'Write your answer in markdown...' : 'Write your answer here...'}
          />
        )}

        <div className="mt-3">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Self Rating <span className="text-zinc-400">(optional)</span>
          </span>
          <div className="mt-1 flex gap-2">
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onSelfRatingChange(selfRating === r ? 0 : r)}
                className={`h-8 w-8 rounded-full text-sm font-medium transition-colors ${
                  selfRating >= r
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
                title={`${r} / 5`}
              >
                {r}
              </button>
            ))}
            <span className="ml-1 self-center text-xs text-zinc-400">1-5</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={onPrevious}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ← Previous
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSubmit(timer.elapsedSeconds)}
            disabled={!answerText.trim() || submitting}
            className="rounded-lg bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? <Spinner className="h-4 w-4" /> : isAlreadyAnswered ? 'Update Answer' : 'Submit Answer'}
          </button>
        </div>
      </div>
    </Card>
  );
}
