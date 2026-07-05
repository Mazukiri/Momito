'use client';

import { useState } from 'react';
import { Markdown } from '../../Markdown';
import { SYSTEM_DESIGN_TEMPLATE } from '../../../lib/system-design-template';

// MOM-057: system design answers follow a fixed 7-section markdown template
// (plan §7.4). A preview toggle lets the user check formatting before submit.
export function SystemDesignAnswerPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div>
      <div className="mb-1 flex items-center justify-end gap-3">
        {!value.trim() && (
          <button
            type="button"
            onClick={() => onChange(SYSTEM_DESIGN_TEMPLATE)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            Insert 7-section template
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {showPreview ? 'Edit' : 'Preview'}
        </button>
      </div>
      {showPreview ? (
        <div className="min-h-[12rem] rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700">
          <Markdown className="prose-sm">{value || '*Nothing written yet.*'}</Markdown>
        </div>
      ) : (
        <textarea
          id="answer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder="Write your answer in markdown..."
        />
      )}
    </div>
  );
}
