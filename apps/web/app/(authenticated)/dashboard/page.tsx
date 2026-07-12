'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardApi } from '../../lib/api-client';
import type { DashboardSummaryResponse, TopicProgress, WeakTopic } from '@momito/shared';
import { Card, Badge, Spinner, ErrorBanner } from '../../components/ui';

const SESSION_TYPE_LABELS: Record<string, string> = {
  quick_practice: 'Quick Practice',
  topic_practice: 'Topic Practice',
  company_practice: 'Company Practice',
  mixed_mock: 'Mixed Mock',
};

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await dashboardApi.summary();
      setSummary(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching
    fetchSummary();
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <ErrorBanner message={error} onRetry={fetchSummary} />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div>
      {/* Greeting */}
      <h1 className="mb-6 text-2xl font-bold text-zinc-800 dark:text-zinc-100">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Questions Practiced</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{summary.totalQuestionsPracticed}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Sessions Completed</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{summary.totalSessions}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Weak Topics</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{summary.weakTopics.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Topics Covered</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {summary.topicProgress.filter((t) => t.attempted > 0).length}
            <span className="text-sm text-zinc-400">/{summary.topicProgress.length}</span>
          </p>
        </Card>
      </div>

      {Boolean(summary.roleReadiness?.length || summary.recommendations?.length || summary.dueTasks?.length) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Role Readiness</h2>
            {!summary.roleReadiness?.length ? (
              <p className="text-sm text-zinc-500">Activate a career track to see readiness.</p>
            ) : (
              <div className="space-y-4">
                {summary.roleReadiness.map((role) => (
                  <div key={role.roleTrackId}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{role.roleTrack.label}</span>
                      <span className="text-xs text-zinc-500">{role.overallPercentage}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${role.overallPercentage}%` }} />
                    </div>
                    {role.nextActions.length > 0 && (
                      <p className="mt-2 text-xs text-zinc-500">{role.nextActions[0]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Next Actions</h2>
            {!summary.recommendations?.length ? (
              <p className="text-sm text-zinc-500">No recommendations yet.</p>
            ) : (
              <div className="space-y-3">
                {summary.recommendations.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.targetHref)}
                    className="block w-full rounded-lg border border-zinc-200 p-3 text-left hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                  >
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.reason}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {summary.dueTasks?.length ? (
        <Card className="mt-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">This Week</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {summary.dueTasks.slice(0, 6).map((task) => (
              <button
                key={task.id}
                onClick={() => router.push('/calendar')}
                className="rounded-lg border border-zinc-200 p-3 text-left hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              >
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{task.title}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : task.plannedFor ? `Planned ${new Date(task.plannedFor).toLocaleDateString()}` : 'Unscheduled'}
                </p>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Two-column layout for mid section */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Topic Progress */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-zinc-800 mb-4 dark:text-zinc-100">Topic Progress</h2>
          {summary.topicProgress.length === 0 ? (
            <p className="text-sm text-zinc-500">Start practicing to see your progress.</p>
          ) : (
            <div className="space-y-3">
              {summary.topicProgress.map((tp: TopicProgress) => (
                <div key={tp.topicId}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{tp.topicName}</span>
                    <span className="text-xs text-zinc-500">
                      {tp.attempted}/{tp.total} ({Math.round(tp.percentage)}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        tp.percentage >= 80 ? 'bg-green-500' :
                        tp.percentage >= 50 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${tp.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Weak Topics */}
        <Card>
          <h2 className="text-lg font-semibold text-zinc-800 mb-4 dark:text-zinc-100">Weak Areas</h2>
          {summary.weakTopics.length === 0 ? (
            <p className="text-sm text-zinc-500">No weak areas detected. Keep it up!</p>
          ) : (
            <div className="space-y-3">
              {summary.weakTopics.map((wt: WeakTopic) => (
                <div key={wt.topicId} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{wt.topicName}</span>
                  <Badge label={`Avg: ${wt.avgSelfRating.toFixed(1)}/5`} variant="hard" />
                </div>
              ))}
            </div>
          )}
          {summary.suggestedNextTopics.length > 0 && (
            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                Suggested Next Topics
              </p>
              <div className="flex flex-wrap gap-2">
                {summary.suggestedNextTopics.map((t) => (
                  <span
                    key={t.id}
                    className="inline-block rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Recent Sessions */}
        <Card>
          <h2 className="text-lg font-semibold text-zinc-800 mb-4 dark:text-zinc-100">Recent Sessions</h2>
          {summary.recentSessions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-zinc-500">No sessions yet.</p>
              <button
                onClick={() => router.push('/practice/new')}
                className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Start your first session →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {summary.recentSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/practice/session/${s.id}/summary`)}
                  className="flex w-full items-center justify-between rounded-lg border border-zinc-200 p-3 text-left hover:border-zinc-300 transition-colors dark:border-zinc-700 dark:hover:border-zinc-600"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-700 truncate dark:text-zinc-300">
                      {s.title || SESSION_TYPE_LABELS[s.sessionType] || s.sessionType}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {new Date(s.startedAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <Badge label={s.status} variant={s.status} />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
