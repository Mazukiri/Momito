'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { JobStoryGapResponse } from '@momito/shared';
import { careerApi } from '../lib/api-client';
import { Card } from './ui';

// MOM-131: the behavioral story gap map for this specific target. Which STAR
// competencies the role's behavioral loop expects, and which the user's story
// bank actually covers — the missing ones are the concrete prep gap.
export function StoryGapCard({ jobId }: { jobId: string }) {
  const [gaps, setGaps] = useState<JobStoryGapResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGaps(await careerApi.jobStoryGaps(jobId));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  if (loading) return <Card><p className="text-sm text-zinc-500">Mapping your stories…</p></Card>;
  if (!gaps) return null;

  const missing = gaps.competencies.filter((competency) => !competency.covered);
  const allCovered = missing.length === 0;

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Behavioral Story Coverage</h2>
        <span className="text-sm text-zinc-400">
          {gaps.coveredCount}/{gaps.competencies.length}
        </span>
      </div>

      {gaps.totalStories === 0 ? (
        <p className="text-sm text-zinc-500">
          You have no stories yet. Build a STAR story bank so this target&apos;s behavioral round has
          evidence to draw on —{' '}
          <Link href="/stories" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            add your first story
          </Link>
          .
        </p>
      ) : allCovered ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Every behavioral competency this role expects has at least one story. Rehearse them before the round.
        </p>
      ) : (
        <p className="text-sm text-zinc-500">
          You have a story for {gaps.coveredCount} of {gaps.competencies.length} competencies{' '}
          {gaps.company ? `${gaps.company}'s` : 'this'} behavioral round expects. Missing:{' '}
          <span className="font-medium text-rose-600 dark:text-rose-400">
            {missing.map((competency) => competency.name).join(', ')}
          </span>
          .
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {gaps.competencies.map((competency) => (
          <span
            key={competency.id}
            title={competency.covered ? `${competency.storyCount} story${competency.storyCount === 1 ? '' : 's'}` : 'No story yet'}
            className={
              competency.covered
                ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                : 'rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-400'
            }
          >
            {competency.covered ? '✓ ' : '+ '}
            {competency.name}
          </span>
        ))}
      </div>

      {!allCovered && gaps.totalStories > 0 && (
        <Link
          href="/stories"
          className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Write a story for the gaps →
        </Link>
      )}
    </Card>
  );
}
