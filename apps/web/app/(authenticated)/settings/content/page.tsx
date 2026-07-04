'use client';

import { useCallback, useEffect, useState } from 'react';
import { contentApi } from '../../../lib/api-client';
import type { ContentCoverageResponse } from '@momito/shared';
import { Card, Spinner, ErrorBanner } from '../../../components/ui';

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div
        className={`h-full rounded-full ${
          percentage >= 90 ? 'bg-green-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
        }`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default function ContentCoveragePage() {
  const [coverage, setCoverage] = useState<ContentCoverageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCoverage(await contentApi.coverage());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load content coverage');
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

  if (error || !coverage) {
    return <ErrorBanner message={error || 'No coverage data'} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Content Coverage</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Progress toward the plan&apos;s full-product data targets (plan §8.2).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Total Questions</p>
          <p className="mt-1 text-xl font-bold text-zinc-800 dark:text-zinc-100">{coverage.totalQuestions}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Companies</p>
          <p className="mt-1 text-xl font-bold text-zinc-800 dark:text-zinc-100">{coverage.companyCount} / 20</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Role Tracks</p>
          <p className="mt-1 text-xl font-bold text-zinc-800 dark:text-zinc-100">{coverage.roleTrackCount} / 8</p>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Domain Targets</h2>
        {coverage.domains.map((domain) => (
          <Card key={domain.label}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">{domain.label}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {domain.count} / {domain.target} ({domain.percentage}%)
              </span>
            </div>
            <ProgressBar percentage={domain.percentage} />
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">By Type</h2>
          <div className="space-y-1 text-sm">
            {Object.entries(coverage.byType).map(([type, count]) => (
              <div key={type} className="flex justify-between text-zinc-600 dark:text-zinc-300">
                <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">By Difficulty</h2>
          <div className="space-y-1 text-sm">
            {Object.entries(coverage.byDifficulty).map(([difficulty, count]) => (
              <div key={difficulty} className="flex justify-between text-zinc-600 dark:text-zinc-300">
                <span className="capitalize">{difficulty}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
