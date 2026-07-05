'use client';

import { useState } from 'react';
import { MISS_TAG_REASONS, type MissTagReason } from '@momito/shared';

// MOM-039: optional reflection step (plan §5.4's WeaknessSignal.reason taxonomy,
// added to AnswerAttempt by MOM-028). Collapsed by default so it never gets in
// the way of a quick answer — most attempts won't need it.
export const MISS_TAG_LABELS: Record<MissTagReason, string> = {
  misread: 'Misread the question',
  wrong_pattern: 'Used the wrong approach',
  edge_case: 'Missed an edge case',
  time_pressure: 'Ran out of time',
  blank: "Didn't know where to start",
  implementation_bug: 'Implementation bug',
  concept_gap: "Didn't know the concept",
  communication_gap: 'Struggled to explain it',
  tradeoff_gap: 'Missed a tradeoff',
};

export function ReflectionPanel({
  missTags,
  onMissTagsChange,
  reflectionNote,
  onReflectionNoteChange,
}: {
  missTags: MissTagReason[];
  onMissTagsChange: (tags: MissTagReason[]) => void;
  reflectionNote: string;
  onReflectionNoteChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  function toggleTag(tag: MissTagReason) {
    onMissTagsChange(missTags.includes(tag) ? missTags.filter((t) => t !== tag) : [...missTags, tag]);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-500"
      >
        + Add reflection (optional)
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <p className="text-xs font-medium text-zinc-500">What happened? (optional)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {MISS_TAG_REASONS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              missTags.includes(tag)
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {MISS_TAG_LABELS[tag]}
          </button>
        ))}
      </div>
      <textarea
        value={reflectionNote}
        onChange={(e) => onReflectionNoteChange(e.target.value)}
        rows={2}
        placeholder="Anything else worth remembering next time?"
        className="mt-3 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </div>
  );
}
