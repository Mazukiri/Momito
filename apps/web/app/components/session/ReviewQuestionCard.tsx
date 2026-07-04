import type { SessionQuestionResponse } from '@momito/shared';
import { Card, Badge } from '../ui';

export function ReviewQuestionCard({
  currentQuestion,
  currentIndex,
  totalQuestions,
  onPrevious,
  onNext,
}: {
  currentQuestion: SessionQuestionResponse;
  currentIndex: number;
  totalQuestions: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-400">
          Question {currentIndex + 1} of {totalQuestions}
        </span>
        <div className="flex gap-2">
          <Badge label={currentQuestion.question.difficulty} variant={currentQuestion.question.difficulty} />
          {currentQuestion.question.topic && <Badge label={currentQuestion.question.topic.name} />}
        </div>
      </div>
      <h2 className="mb-3 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
        {currentQuestion.question.title}
      </h2>
      <div className="mb-4 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {currentQuestion.question.prompt}
      </div>
      <div className="flex gap-2">
        {currentIndex > 0 && (
          <button
            onClick={onPrevious}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Previous
          </button>
        )}
        {currentIndex < totalQuestions - 1 && (
          <button
            onClick={onNext}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Next →
          </button>
        )}
      </div>
    </Card>
  );
}
