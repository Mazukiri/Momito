'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { MissionCheckInResponse, MissionDetailResponse, MissionTodayResponse } from '@momito/shared';
import { missionsApi } from '../../../lib/api-client';
import { Badge, Card, ErrorBanner, Spinner } from '../../../components/ui';

export default function MissionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [mission, setMission] = useState<MissionDetailResponse | null>(null);
  const [today, setToday] = useState<MissionTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [wins, setWins] = useState('');
  const [blockers, setBlockers] = useState('');
  const [adjustments, setAdjustments] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [detail, missionToday] = await Promise.all([
        missionsApi.get(params.id),
        missionsApi.today(params.id),
      ]);
      setMission(detail);
      setToday(missionToday);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load mission');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  async function runDiagnose() {
    setWorking(true);
    setError('');
    try {
      setMission(await missionsApi.diagnose(params.id));
      setToday(await missionsApi.today(params.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to diagnose mission');
    } finally {
      setWorking(false);
    }
  }

  async function generatePlan() {
    setWorking(true);
    setError('');
    try {
      await missionsApi.generatePlan(params.id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate weekly plan');
    } finally {
      setWorking(false);
    }
  }

  async function reviewPlan(planId: string) {
    setWorking(true);
    setError('');
    try {
      await missionsApi.reviewPlan(planId);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to review plan');
    } finally {
      setWorking(false);
    }
  }

  async function createCheckIn(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError('');
    try {
      await missionsApi.createCheckIn(params.id, {
        summary: checkIn.trim(),
        wins: wins.trim() || null,
        blockers: blockers.trim() || null,
        adjustments: adjustments.trim() || null,
      });
      setCheckIn('');
      setWins('');
      setBlockers('');
      setAdjustments('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create check-in');
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!mission || !today) return error ? <ErrorBanner message={error} onRetry={load} /> : null;

  const activePlan = today.activePlan;
  const recentPlan = mission.plans[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.push('/missions')} className="text-sm font-medium text-indigo-600">Back to missions</button>
        <div className="flex flex-wrap gap-2">
          <button onClick={runDiagnose} disabled={working} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50">Diagnose</button>
          <button onClick={generatePlan} disabled={working} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Generate weekly plan</button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-zinc-800">{mission.name}</h1>
                <p className="mt-2 text-sm text-zinc-500">{mission.summary || mission.roleTrack.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge label={mission.stage} />
                  <Badge label={mission.roleTrack.label} />
                  <Badge label={`${mission.weeklyHours}h/week`} />
                  {mission.targetDate && <Badge label={`target ${new Date(mission.targetDate).toLocaleDateString()}`} />}
                </div>
              </div>
              {mission.jobApplication ? (
                <Link href={`/jobs/${mission.jobApplication.id}`} className="text-sm font-medium text-indigo-600">
                  {mission.jobApplication.company} {mission.jobApplication.roleTitle}
                </Link>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Diagnosis</p>
                <p className="mt-2 text-sm text-zinc-600">{mission.diagnosisSummary || 'Run diagnosis to translate this target into competency gaps.'}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Success Definition</p>
                <p className="mt-2 text-sm text-zinc-600">{mission.successDefinition || 'No explicit success definition yet.'}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-800">Competency State</h2>
              <span className="text-sm text-zinc-500">{mission.competencyStates.length} tracked items</span>
            </div>
            <div className="space-y-3">
              {mission.competencyStates.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{item.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">{item.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge label={item.status} />
                      <Badge label={`${item.currentLevel}/${item.targetLevel}`} />
                      <Badge label={`${item.evidenceCount} evidence`} />
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div className={`h-full rounded-full ${item.status === 'ready' ? 'bg-green-500' : item.status === 'building' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Math.round((item.currentLevel / Math.max(item.targetLevel, 1)) * 100))}%` }} />
                  </div>
                  {item.rationale && <p className="mt-2 text-xs text-zinc-500">{item.rationale}</p>}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-800">Weekly Plan</h2>
              {recentPlan ? (
                <button onClick={() => reviewPlan(recentPlan.id)} disabled={working} className="text-sm font-medium text-indigo-600 disabled:opacity-50">
                  Review latest plan
                </button>
              ) : null}
            </div>
            {!activePlan ? (
              <p className="text-sm text-zinc-500">No active plan yet. Run diagnosis and generate a weekly plan.</p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-zinc-200 p-3">
                  <p className="text-sm font-medium text-zinc-800">{activePlan.focusSummary || 'This week focus'}</p>
                  <p className="mt-1 text-xs text-zinc-500">{activePlan.weekStart} to {activePlan.weekEnd}</p>
                </div>
                {activePlan.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-800">{item.title}</p>
                      <div className="flex gap-2">
                        <Badge label={item.type} />
                        <Badge label={item.status} />
                      </div>
                    </div>
                    {item.description && <p className="mt-1 text-sm text-zinc-500">{item.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                      <span>{item.estimatedMinutes} min</span>
                      <span>{item.scheduledFor ? new Date(item.scheduledFor).toLocaleString() : 'Unscheduled'}</span>
                      {item.expectedArtifact && <span>{item.expectedArtifact}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-zinc-800">Today</h2>
            {!today.dueTasks.length ? (
              <p className="text-sm text-zinc-500">No due mission tasks today.</p>
            ) : (
              <div className="space-y-2">
                {today.dueTasks.map((task) => (
                  <button key={task.id} onClick={() => router.push('/calendar')} className="block w-full rounded-lg border border-zinc-200 p-3 text-left hover:border-zinc-300">
                    <p className="text-sm font-medium text-zinc-800">{task.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{task.dueDate ? new Date(task.dueDate).toLocaleString() : task.plannedFor ? new Date(task.plannedFor).toLocaleString() : 'Unscheduled'}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Link href={`/practice/new?mode=role_drill&roleTrackId=${mission.roleTrackId}`} className="text-sm font-medium text-indigo-600">Practice</Link>
              <Link href={`/learning?missionId=${mission.id}`} className="text-sm font-medium text-indigo-600">Learning</Link>
              <Link href={`/calendar?missionId=${mission.id}`} className="text-sm font-medium text-indigo-600">Calendar</Link>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-zinc-800">Recent Evidence</h2>
            {!today.recentEvidence.length ? (
              <p className="text-sm text-zinc-500">No mission evidence yet.</p>
            ) : (
              <div className="space-y-3">
                {today.recentEvidence.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 p-3">
                    <p className="text-sm font-medium text-zinc-800">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.type} • {new Date(item.occurredAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-zinc-800">Check-in</h2>
            <form onSubmit={createCheckIn} className="space-y-3">
              <textarea value={checkIn} onChange={(event) => setCheckIn(event.target.value)} rows={3} required placeholder="What changed this week?" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
              <textarea value={wins} onChange={(event) => setWins(event.target.value)} rows={2} placeholder="Wins" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
              <textarea value={blockers} onChange={(event) => setBlockers(event.target.value)} rows={2} placeholder="Blockers" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
              <textarea value={adjustments} onChange={(event) => setAdjustments(event.target.value)} rows={2} placeholder="Adjustments" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
              <button disabled={working || !checkIn.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save check-in</button>
            </form>
            {mission.recentCheckIns.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
                {mission.recentCheckIns.map((item: MissionCheckInResponse) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 p-3">
                    <p className="text-sm font-medium text-zinc-800">{item.summary}</p>
                    <p className="mt-1 text-xs text-zinc-500">{new Date(item.checkInAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
