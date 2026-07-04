import type { SessionQuestionResponse } from '@momito/shared';
import { Card } from '../ui';

export function AllAnsweredPanel({
  questions,
  currentIndex,
  onSelect,
}: {
  questions: SessionQuestionResponse[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <Card className="mb-4 text-center">
      <div className="py-6">
        <span className="text-4xl">🎯</span>
        <h2 className="mt-4 text-xl font-bold text-zinc-800 dark:text-zinc-100">All Questions Answered!</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          You have answered all {questions.length} questions. Ready to finish?
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => onSelect(i)}
              className={`h-8 w-8 rounded-full text-xs font-medium ${
                i === currentIndex
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
              title={q.question.title}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
