'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CAREER_ROLE_AREA_IDS,
  CAREER_ROLE_TRACKS,
  TASK_PRIORITIES,
  TASK_TYPES,
  type CareerRoleAreaId,
  type CareerRoleTrackId,
  type ReminderResponse,
  type TaskPriority,
  type TaskResponse,
  type TaskType,
} from '@momito/shared';
import { remindersApi, tasksApi } from '../../lib/api-client';
import { Badge, Card, ErrorBanner, Spinner } from '../../components/ui';

const RANGES = ['today', 'week', 'overdue', 'all'] as const;

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const missionId = searchParams.get('missionId') || undefined;
  const [range, setRange] = useState<(typeof RANGES)[number]>('week');
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [reminders, setReminders] = useState<ReminderResponse[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('study');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [roleTrackId, setRoleTrackId] = useState<CareerRoleTrackId>('big-tech-swe');
  const [area, setArea] = useState<CareerRoleAreaId>('dsa');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [taskList, reminderList] = await Promise.all([
        tasksApi.list({ range, missionId }),
        remindersApi.list(),
      ]);
      setTasks(taskList);
      setReminders(reminderList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [missionId, range]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  async function createTask(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    try {
      await tasksApi.create({
        title: title.trim(),
        type,
        priority,
        roleTrackId,
        area,
        missionId: missionId ?? null,
        dueDate: dueDate || null,
        reminderOffsetMinutes: 24 * 60,
      });
      setTitle('');
      setDueDate('');
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setWorking(false);
    }
  }

  async function complete(id: string) {
    setWorking(true);
    try {
      await tasksApi.complete(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setWorking(false);
    }
  }

  async function snooze(id: string) {
    setWorking(true);
    try {
      await tasksApi.snooze(id, tomorrowIso());
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to snooze task');
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

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Calendar</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {missionId ? 'Scheduled work filtered to one mission.' : 'Scheduled prep work, reminders, and overdue career tasks.'}
          </p>
        </div>
        <button onClick={() => setShowForm((value) => !value)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
          {showForm ? 'Close' : 'Add Task'}
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {RANGES.map((item) => (
          <button
            key={item}
            onClick={() => setRange(item)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${range === item ? 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}
          >
            {item}
          </button>
        ))}
      </div>

      {showForm && (
        <Card>
          <form onSubmit={createTask} className="grid gap-3 sm:grid-cols-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Task title" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            <select value={type} onChange={(event) => setType(event.target.value as TaskType)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              {TASK_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              {TASK_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={roleTrackId} onChange={(event) => setRoleTrackId(event.target.value as CareerRoleTrackId)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              {Object.values(CAREER_ROLE_TRACKS).map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}
            </select>
            <select value={area} onChange={(event) => setArea(event.target.value as CareerRoleAreaId)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              {CAREER_ROLE_AREA_IDS.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
            </select>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            <button disabled={working || !title.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save</button>
          </form>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <Card><p className="text-sm text-zinc-500">No tasks in this range.</p></Card>
          ) : tasks.map((task) => (
            <Card key={task.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">{task.title}</h2>
                  <p className="mt-1 text-sm text-zinc-500">{task.notes}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge label={task.status} />
                    <Badge label={task.priority} />
                    {task.area && <Badge label={task.area.replaceAll('_', ' ')} />}
                    {task.missionId && <Badge label="mission" />}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => snooze(task.id)} disabled={working || task.status === 'done'} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">Snooze</button>
                  <button onClick={() => complete(task.id)} disabled={working || task.status === 'done'} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Done</button>
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-400">
                {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleString()}` : task.plannedFor ? `Planned ${new Date(task.plannedFor).toLocaleString()}` : 'Unscheduled'}
              </p>
            </Card>
          ))}
        </div>

        <aside className="space-y-3">
          <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Reminders</h2>
          {reminders.length === 0 ? (
            <Card><p className="text-sm text-zinc-500">No pending reminders.</p></Card>
          ) : reminders.map((reminder) => (
            <Card key={reminder.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{reminder.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{new Date(reminder.dueAt).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => dismissReminder(reminder.id)}
                  disabled={working}
                  className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Dismiss
                </button>
              </div>
            </Card>
          ))}
        </aside>
      </div>
    </div>
  );
}
