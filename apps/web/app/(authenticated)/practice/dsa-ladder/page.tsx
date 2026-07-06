'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { dsaApi } from '../../../lib/api-client';
import { DSA_PATTERN_META, type DsaPattern, type DsaProgressResponse } from '@momito/shared';
import { Card, Spinner, ErrorBanner, EmptyState } from '../../../components/ui';

// A4: pattern name/whenToUse now come from the shared DSA_PATTERN_META (one
// source of truth instead of a page-local label map) so the ladder teaches
// when to reach for each pattern, not just its name.
function patternMeta(pattern: string) {
  return DSA_PATTERN_META[pattern as DsaPattern];
}

export default function DsaLadderPage() {
  const [progress, setProgress] = useState<DsaProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProgress(await dsaApi.progress());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load DSA progress');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !progress) {
    return <ErrorBanner message={error || 'No progress data'} onRetry={load} />;
  }

  if (progress.totalDsaItems === 0) {
    return (
      <EmptyState
        icon="🧩"
        title="No DSA items seeded yet"
        description="Seed the database to see the DSA pattern ladder."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">DSA Ladder</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {progress.totalSolved} solved / {progress.totalAttempted} attempted of {progress.totalDsaItems}{' '}
          total DSA items, across {progress.patterns.length} patterns.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {progress.patterns
          .filter((p) => p.totalItems > 0)
          .sort((a, b) => b.totalItems - a.totalItems)
          .map((p) => {
            const solvedPct = p.totalItems > 0 ? Math.round((p.solvedItems / p.totalItems) * 100) : 0;
            const meta = patternMeta(p.pattern);
            return (
              <Card key={p.pattern}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">
                    {meta?.name ?? p.pattern}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {p.solvedItems}/{p.totalItems} solved
                  </span>
                </div>
                {meta && (
                  <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-medium text-zinc-600 dark:text-zinc-300">When to use: </span>
                    {meta.whenToUse}
                  </p>
                )}
                <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${
                      solvedPct >= 80 ? 'bg-green-500' : solvedPct >= 30 ? 'bg-amber-500' : 'bg-zinc-400'
                    }`}
                    style={{ width: `${solvedPct}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{p.attemptedItems} attempted</span>
                  <Link
                    href={`/practice/new?pattern=${p.pattern}&mode=quick_practice`}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Practice →
                  </Link>
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
