'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CAREER_ROLE_TRACKS, type CareerRoleTrackId, type MissionResponse } from '@momito/shared';
import { missionsApi } from '../../lib/api-client';
import { Badge, Card, EmptyState, ErrorBanner, Spinner } from '../../components/ui';

export default function MissionsPage() {
  const router = useRouter();
  const [missions, setMissions] = useState<MissionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [roleTrackId, setRoleTrackId] = useState<CareerRoleTrackId>('big-tech-swe');
  const [weeklyHours, setWeeklyHours] = useState(8);
  const [targetDate, setTargetDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMissions(await missionsApi.list());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load missions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  async function createMission(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const mission = await missionsApi.create({
        name: name.trim(),
        summary: summary.trim() || null,
        roleTrackId,
        weeklyHours,
        targetDate: targetDate || null,
      });
      setName('');
      setSummary('');
      setWeeklyHours(8);
      setTargetDate('');
      setShowForm(false);
      router.push(`/missions/${mission.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create mission');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800">Mission</h1>
          <p className="mt-1 text-sm text-zinc-500">Turn a role target or job target into one execution loop with diagnosis, weekly plan, evidence, and review.</p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          {showForm ? 'Close' : 'New Mission'}
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {showForm && (
        <Card>
          <form onSubmit={createMission} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-700">Mission name</label>
              <input value={name} onChange={(event) => setName(event.target.value)} required className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Role track</label>
              <select value={roleTrackId} onChange={(event) => setRoleTrackId(event.target.value as CareerRoleTrackId)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                {Object.values(CAREER_ROLE_TRACKS).map((track) => (
                  <option key={track.id} value={track.id}>{track.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Hours per week</label>
              <input type="number" min={1} max={80} value={weeklyHours} onChange={(event) => setWeeklyHours(Math.max(1, Math.min(80, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Target date</label>
              <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-700">Context</label>
              <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <button disabled={saving || !name.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {saving ? 'Creating...' : 'Create mission'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {missions.length === 0 ? (
        <EmptyState icon="MAP" title="No active mission" description="Create one mission per target role or job so learning, practice, tasks, and evidence stay in one loop." />
      ) : (
        <div className="grid gap-4">
          {missions.map((mission) => (
            <Card key={mission.id} onClick={() => router.push(`/missions/${mission.id}`)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-zinc-800">{mission.name}</h2>
                  <p className="mt-1 text-sm text-zinc-500">{mission.summary || mission.roleTrack.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge label={mission.stage} />
                    <Badge label={mission.roleTrack.label} />
                    <Badge label={`${mission.weeklyHours}h/week`} />
                    {mission.jobApplication && <Badge label={`${mission.jobApplication.company} ${mission.jobApplication.roleTitle}`} />}
                  </div>
                </div>
                <div className="text-right text-sm text-zinc-500">
                  <div>{mission.targetDate ? `Target ${new Date(mission.targetDate).toLocaleDateString()}` : 'No target date'}</div>
                  <div className="mt-2 max-w-xs">{mission.diagnosisSummary || 'No diagnosis yet'}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
