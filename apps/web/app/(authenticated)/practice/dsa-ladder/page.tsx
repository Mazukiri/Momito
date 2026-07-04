'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { dsaApi } from '../../../lib/api-client';
import type { DsaProgressResponse } from '@momito/shared';
import { Card, Spinner, ErrorBanner, EmptyState } from '../../../components/ui';

const PATTERN_LABELS: Record<string, string> = {
  two_pointers: 'Two Pointers',
  sliding_window: 'Sliding Window',
  fast_slow_pointers: 'Fast & Slow Pointers',
  merge_intervals: 'Merge Intervals',
  cyclic_sort: 'Cyclic Sort',
  binary_search: 'Binary Search',
  tree_bfs: 'Tree BFS',
  tree_dfs: 'Tree DFS',
  graph_traversal: 'Graph Traversal',
  topological_sort: 'Topological Sort',
  union_find: 'Union Find',
  backtracking: 'Backtracking',
  dynamic_programming: 'Dynamic Programming',
  greedy: 'Greedy',
  heap_priority_queue: 'Heap / Priority Queue',
  monotonic_stack: 'Monotonic Stack',
  prefix_sum: 'Prefix Sum',
  bit_manipulation: 'Bit Manipulation',
  trie: 'Trie',
  linked_list_reversal: 'Linked List Reversal',
};

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
            return (
              <Card key={p.pattern}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">
                    {PATTERN_LABELS[p.pattern] ?? p.pattern}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {p.solvedItems}/{p.totalItems} solved
                  </span>
                </div>
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
