'use client';

import { useCallback, useEffect, useState } from 'react';
import { careerApi } from '../../lib/api-client';
import type { CareerGoalResponse, CareerRoleTrack, RoleReadinessResponse } from '@momito/shared';
import { Card, ErrorBanner, Spinner } from '../../components/ui';

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div
        className={`h-full rounded-full ${value >= 75 ? 'bg-green-500' : value >= 45 ? 'bg-amber-500' : 'bg-red-500'}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default function CareerPage() {
  const [tracks, setTracks] = useState<CareerRoleTrack[]>([]);
  const [goals, setGoals] = useState<CareerGoalResponse[]>([]);
  const [readiness, setReadiness] = useState<RoleReadinessResponse[]>([]);
  const [selectedRole, setSelectedRole] = useState('big-tech-swe');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [roleTracks, careerGoals, readinessList] = await Promise.all([
        careerApi.roleTracks(),
        careerApi.goals(),
        careerApi.activeReadiness(),
      ]);
      setTracks(roleTracks);
      setGoals(careerGoals);
      setReadiness(readinessList);
      if (roleTracks[0]) setSelectedRole(roleTracks[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load career plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  async function addGoal() {
    setSaving(true);
    setError('');
    try {
      await careerApi.upsertGoal({ roleTrackId: selectedRole, status: 'active' });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save career goal');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Career Tracks</h1>
          <p className="mt-1 text-sm text-zinc-500">Track role readiness across interview prep, projects, learning, and applications.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>{track.label}</option>
            ))}
          </select>
          <button
            onClick={addGoal}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Activate'}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid gap-4 md:grid-cols-2">
        {tracks.map((track) => {
          const active = goals.some((goal) => goal.roleTrackId === track.id && goal.status === 'active');
          return (
            <Card key={track.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">{track.label}</h2>
                  <p className="mt-1 text-sm text-zinc-500">{track.description}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                  {active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase text-zinc-400">{track.checklist.length} checklist items</p>
            </Card>
          );
        })}
      </div>

      <div className="space-y-4">
        {readiness.map((role) => (
          <Card key={role.roleTrackId}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">{role.roleTrack.label}</h2>
                <p className="text-sm text-zinc-500">{role.overallPercentage}% overall readiness</p>
              </div>
              <span className="text-2xl font-bold text-indigo-600">{role.overallPercentage}%</span>
            </div>
            <Bar value={role.overallPercentage} />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {role.areas.map((area) => (
                <div key={area.area} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{area.area.replaceAll('_', ' ')}</span>
                    <span className="text-xs text-zinc-500">{area.percentage}%</span>
                  </div>
                  <Bar value={area.percentage} />
                </div>
              ))}
            </div>
            {role.topGaps.length > 0 && (
              <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <p className="mb-2 text-xs font-medium uppercase text-zinc-400">Top gaps</p>
                <div className="space-y-2">
                  {role.topGaps.slice(0, 4).map((gap) => (
                    <div key={gap.id} className="text-sm text-zinc-600 dark:text-zinc-400">
                      <span className="font-medium text-zinc-800 dark:text-zinc-100">{gap.title}</span> - {gap.description}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
