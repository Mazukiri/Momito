'use client';

import type { JobFunnelResponse } from '@momito/shared';
import { Card } from './ui';

// MOM-101 (CareerOS Track M): the pipeline funnel — where applications sit and
// where they convert. Presentational; the jobs page fetches the data. Honest
// v1 note lives on JobFunnelResponse (current-status snapshot, not stage timing).
function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function JobFunnelCard({ funnel }: { funnel: JobFunnelResponse }) {
  if (funnel.total === 0) return null;
  const baseline = Math.max(funnel.active, 1);
  const topSources = funnel.bySource.filter((row) => row.total > 0).slice(0, 4);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Pipeline funnel</h2>
        <p className="text-xs text-zinc-500">
          {funnel.total} total · {funnel.active} active · {funnel.offers} offer{funnel.offers === 1 ? '' : 's'} ·
          {' '}response rate {pct(funnel.responseRate)}
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        {funnel.stages.map((row) => (
          <div key={row.stage} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs font-medium capitalize text-zinc-600 dark:text-zinc-300">{row.stage}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded bg-indigo-500/80 dark:bg-indigo-500/60"
                style={{ width: `${Math.round((row.reached / baseline) * 100)}%` }}
              />
              <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
                {row.reached}
              </span>
            </div>
            <span className="w-12 shrink-0 text-right text-[11px] text-zinc-400">
              {row.conversionFromPrev === null ? '' : pct(row.conversionFromPrev)}
            </span>
            <span className="w-16 shrink-0 text-right text-[11px] text-zinc-400" title="Median days in this stage">
              {row.medianDaysInStage === null ? '' : `~${row.medianDaysInStage}d`}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1 pl-[76px] text-[10px] uppercase tracking-wide text-zinc-300 dark:text-zinc-600">reached · conv · median time</p>

      {(funnel.rejected > 0 || funnel.withdrawn > 0) && (
        <p className="mt-2 text-xs text-zinc-400">
          Outcomes: {funnel.rejected} rejected · {funnel.withdrawn} withdrawn
        </p>
      )}

      {topSources.length > 0 && (
        <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">By source</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
            {topSources.map((row) => (
              <span key={row.key}>
                <span className="capitalize">{row.key.replace(/_/g, ' ')}</span>{' '}
                <span className="text-zinc-400">
                  {row.total} → {row.offers} offer{row.offers === 1 ? '' : 's'} ({pct(row.conversion)})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
