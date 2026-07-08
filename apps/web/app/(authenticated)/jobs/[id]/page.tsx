'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { JOB_APPLICATION_STATUSES, type JobApplicationStatus } from '@momito/shared';
import { jobsApi, missionsApi, remindersApi } from '../../../lib/api-client';
import { Badge, Card, ErrorBanner, Spinner } from '../../../components/ui';
import { InterviewRoundsCard } from '../../../components/InterviewRoundsCard';

type JobDetail = Awaited<ReturnType<typeof jobsApi.get>>;

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [status, setStatus] = useState<JobApplicationStatus>('saved');
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('note');
  const [eventNotes, setEventNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [missionId, setMissionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await jobsApi.get(params.id);
      setJob(data);
      setStatus(data.status);
      const relatedMission = await missionsApi.list();
      setMissionId(relatedMission.find((item) => item.jobApplicationId === params.id)?.id ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  async function updateStatus() {
    setWorking(true);
    try {
      await jobsApi.update(params.id, { status });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update job');
    } finally {
      setWorking(false);
    }
  }

  async function generatePrep() {
    setWorking(true);
    try {
      await jobsApi.generatePrep(params.id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate prep tasks');
    } finally {
      setWorking(false);
    }
  }

  async function scoreProfile() {
    setWorking(true);
    try {
      const score = await jobsApi.scoreProfile(params.id);
      router.push(`/profile/scores/${score.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to score profile');
      setWorking(false);
    }
  }

  async function openMission() {
    setWorking(true);
    try {
      const mission = await missionsApi.createFromJob(params.id);
      router.push(`/missions/${mission.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open mission');
    } finally {
      setWorking(false);
    }
  }

  async function dismissReminder(id: string) {
    setWorking(true);
    try {
      await remindersApi.dismiss(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss reminder');
    } finally {
      setWorking(false);
    }
  }

  async function addEvent(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    try {
      await jobsApi.addEvent(params.id, {
        type: eventType.trim(),
        title: eventTitle.trim(),
        notes: eventNotes.trim() || null,
      });
      setEventTitle('');
      setEventNotes('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add event');
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!job) return error ? <ErrorBanner message={error} onRetry={load} /> : null;

  return (
    <div className="space-y-6">
      <button onClick={() => router.push('/jobs')} className="text-sm font-medium text-indigo-600">Back to jobs</button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{job.company}</h1>
          <p className="mt-1 text-sm text-zinc-500">{job.roleTitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge label={job.status} variant={job.status} />
            {job.deadline && <Badge label={`deadline ${new Date(job.deadline).toLocaleDateString()}`} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openMission} disabled={working} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">{missionId ? 'Open Mission' : 'Create Mission'}</button>
          <button onClick={generatePrep} disabled={working} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">Generate Prep</button>
          <button onClick={scoreProfile} disabled={working} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Score Profile</button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">JD Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">{job.jdText || job.notes || 'No JD text saved yet.'}</p>
            {job.url && <a href={job.url} target="_blank" className="mt-4 inline-block text-sm font-medium text-indigo-600">Open posting</a>}
          </Card>

          <InterviewRoundsCard jobId={params.id} />

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Timeline</h2>
            <form onSubmit={addEvent} className="mb-4 grid gap-3 sm:grid-cols-[120px_1fr]">
              <input value={eventType} onChange={(event) => setEventType(event.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} required placeholder="Event title" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <textarea value={eventNotes} onChange={(event) => setEventNotes(event.target.value)} rows={2} placeholder="Notes" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <button disabled={working || !eventTitle.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2">Add Event</button>
            </form>
            <div className="space-y-3">
              {job.events.length === 0 ? <p className="text-sm text-zinc-500">No events yet.</p> : job.events.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.title}</span>
                    <span className="text-xs text-zinc-400">{new Date(item.eventAt).toLocaleString()}</span>
                  </div>
                  {item.notes && <p className="mt-1 text-sm text-zinc-500">{item.notes}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Status</h2>
            <select value={status} onChange={(event) => setStatus(event.target.value as JobApplicationStatus)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              {JOB_APPLICATION_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button onClick={updateStatus} disabled={working || status === job.status} className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Update</button>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Prep Tasks</h2>
            <p className="text-sm text-zinc-500">{job.tasks.length} tasks linked to this job.</p>
            <button onClick={() => router.push(missionId ? `/calendar?missionId=${missionId}` : '/calendar')} className="mt-3 text-sm font-medium text-indigo-600">Open calendar</button>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Reminders</h2>
            <div className="space-y-2">
              {job.reminders.length === 0 ? <p className="text-sm text-zinc-500">No reminders.</p> : job.reminders.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <span>{item.title} - {new Date(item.dueAt).toLocaleDateString()}</span>
                  <button
                    onClick={() => dismissReminder(item.id)}
                    disabled={working}
                    className="shrink-0 rounded-lg border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
