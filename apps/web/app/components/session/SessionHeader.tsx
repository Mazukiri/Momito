export function SessionHeader({
  title,
  answeredCount,
  totalQuestions,
  completing,
  onAbandon,
}: {
  title: string | null;
  answeredCount: number;
  totalQuestions: number;
  completing: boolean;
  onAbandon: () => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
            {title || 'Practice Session'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {answeredCount} of {totalQuestions} answered
          </p>
        </div>
        <button
          onClick={onAbandon}
          disabled={completing}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Abandon
        </button>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
        />
      </div>
    </div>
  );
}
