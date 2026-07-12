'use client';

import { useCallback, useEffect, useState } from 'react';
import type { JobReadinessResponse, JobReadinessStatus, WeaknessSignalResponse } from '@momito/shared';
import { careerApi, weaknessesApi } from '../lib/api-client';
import { Card } from './ui';

const areaLabel = (id: string) => id.replace(/_/g, ' ');

const STATUS: Record<JobReadinessStatus, { label: string; ring: string; text: string }> = {
  ready: { label: 'Ready', ring: 'text-emerald-600 dark:text-emerald-400', text: 'You are on track' },
  almost: { label: 'Almost', ring: 'text-amber-600 dark:text-amber-400', text: 'Close the gaps below before your interview' },
  not_ready: { label: 'Not ready', ring: 'text-rose-600 dark:text-rose-400', text: 'Focus prep before your interview' },
};

export function JobReadinessCard({ jobId }: { jobId: string }) {
  const [readiness, setReadiness] = useState<JobReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReadiness(await careerApi.jobReadiness(jobId));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  // MOM-167: resolve ("I've repaired this") / dismiss ("not a real weakness") a flagged signal.
  // Optimistic — drop it immediately — then reload so the score/penalty reflect the change.
  const [busy, setBusy] = useState<string | null>(null);
  async function actOnSignal(id: string, action: 'resolve' | 'dismiss') {
    setBusy(id);
    setReadiness((current) =>
      current ? { ...current, blockingSignals: current.blockingSignals.filter((s) => s.id !== id) } : current,
    );
    try {
      await (action === 'resolve' ? weaknessesApi.resolveSignal(id) : weaknessesApi.dismissSignal(id));
      await load();
    } catch {
      await load(); // revert to server truth on failure
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Card><p className="text-sm text-zinc-500">Assessing readiness…</p></Card>;
  if (!readiness) return null;

  const status = STATUS[readiness.status];

  return (
    <Card>
      <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Interview Readiness</h2>
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-bold ${status.ring}`}>{readiness.score}</span>
        <span className="text-sm text-zinc-400">/ 100</span>
        <span className={`ml-auto text-sm font-semibold ${status.ring}`}>{status.label}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {status.text} for {readiness.roleTrack.label}.
      </p>
      {readiness.penalty > 0 && (
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          −{readiness.penalty} from {readiness.blockingSignals.length} interview weakness
          {readiness.blockingSignals.length === 1 ? '' : 'es'} flagged for this job.
        </p>
      )}

      {readiness.weakestAreas.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-zinc-500">Weakest areas</p>
          <div className="space-y-1.5">
            {readiness.weakestAreas.map((area) => (
              <div key={area.area} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-xs capitalize text-zinc-600 dark:text-zinc-300">{areaLabel(area.area)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className={`h-full rounded-full ${area.percentage >= 75 ? 'bg-emerald-500' : area.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.max(4, area.percentage)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs text-zinc-400">{area.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {readiness.blockingSignals.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-zinc-500">Flagged in interviews</p>
          <div className="flex flex-wrap gap-1.5">
            {readiness.blockingSignals.slice(0, 5).map((signal) => (
              <SignalChip key={signal.id} signal={signal} busy={busy === signal.id} onAct={actOnSignal} />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-400">✓ mark repaired · ✕ not a real weakness</p>
        </div>
      )}
    </Card>
  );
}

// MOM-167: a flagged-weakness pill with the two actions that were, until now, dead endpoints.
// A `repairing` signal (partial repair evidence, MOM-166) reads amber instead of rose.
function SignalChip({
  signal,
  busy,
  onAct,
}: {
  signal: WeaknessSignalResponse;
  busy: boolean;
  onAct: (id: string, action: 'resolve' | 'dismiss') => void;
}) {
  const repairing = signal.status === 'repairing';
  const tone = repairing
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
    : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${tone} ${busy ? 'opacity-50' : ''}`}>
      {signal.label}
      {repairing && <span className="text-[10px] uppercase tracking-wide opacity-70">repairing</span>}
      <button
        onClick={() => onAct(signal.id, 'resolve')}
        disabled={busy}
        aria-label={`Mark "${signal.label}" repaired`}
        className="ml-0.5 rounded px-0.5 font-bold hover:text-emerald-600 disabled:opacity-50"
      >
        ✓
      </button>
      <button
        onClick={() => onAct(signal.id, 'dismiss')}
        disabled={busy}
        aria-label={`Dismiss "${signal.label}"`}
        className="rounded px-0.5 font-bold hover:text-zinc-500 disabled:opacity-50"
      >
        ✕
      </button>
    </span>
  );
}
