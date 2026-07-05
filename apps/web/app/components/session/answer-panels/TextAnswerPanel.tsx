'use client';

export function TextAnswerPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      id="answer"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={8}
      className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      placeholder="Write your answer here..."
    />
  );
}
