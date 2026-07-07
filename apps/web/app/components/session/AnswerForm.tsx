'use client';

import { useEffect } from 'react';
import type { SessionQuestionResponse } from '@momito/shared';
import { Card, Badge, Spinner } from '../ui';
import { useTimer } from '../../lib/use-timer';
import { TYPE_LABELS } from './question-type-labels';
import { TextAnswerPanel } from './answer-panels/TextAnswerPanel';
import { SystemDesignAnswerPanel } from './answer-panels/SystemDesignAnswerPanel';
import { CodeAnswerPanel } from './answer-panels/CodeAnswerPanel';

// Attempt lifecycle (plan §7.2): this form is only the *recall* half —
// read the prompt, write the answer, submit. Self-rating and reflection
// deliberately moved to RevealPanel: they can only be answered honestly after
// the reference answer is on screen (rating blind is guessing; "what did I
// miss" is unanswerable before seeing what a strong answer contains).
export function AnswerForm({
  currentQuestion,
  currentIndex,
  totalQuestions,
  answerText,
  onAnswerTextChange,
  submitting,
  onPrevious,
  onSubmit,
}: {
  currentQuestion: SessionQuestionResponse;
  currentIndex: number;
  totalQuestions: number;
  answerText: string;
  onAnswerTextChange: (value: string) => void;
  submitting: boolean;
  onPrevious?: () => void;
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

  // MOM-038: dispatch to a dedicated answer panel per question type instead of
  // branching inline — system design gets the 7-section template/preview
  // (MOM-057), dsa/cpp get the CodeMirror editor (MOM-035), everything else
  // gets the plain textarea.
  const isSystemDesign = currentQuestion.question.type === 'system_design';
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
        <label htmlFor="answer" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Your Answer
        </label>
        {isSystemDesign ? (
          <SystemDesignAnswerPanel value={answerText} onChange={onAnswerTextChange} />
        ) : isCodeAnswer ? (
          <CodeAnswerPanel value={answerText} onChange={onAnswerTextChange} />
        ) : (
          <TextAnswerPanel value={answerText} onChange={onAnswerTextChange} />
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
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
          <button
            type="button"
            onClick={() => onSubmit(timer.elapsedSeconds)}
            disabled={!answerText.trim() || submitting}
            className="rounded-lg bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? <Spinner className="h-4 w-4" /> : 'Submit & reveal answer'}
          </button>
        </div>
      </div>
    </Card>
  );
}
