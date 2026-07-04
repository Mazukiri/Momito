'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { sessionsApi } from '../../lib/api-client';
import type { InterviewSessionResponse } from '@momito/shared';
import { Card, Spinner, Badge } from '../../components/ui';

// MOM-041: practice hub — the landing page for the "Practice" primary nav tab.
// Surfaces an in-progress session (if any) plus entry points into every
// practice mode, instead of dropping straight into the session-creation form.
export default function PracticeHubPage() {
  const [activeSessions, setActiveSessions] = useState<InterviewSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await sessionsApi.list({ status: 'active', limit: 3 });
      setActiveSessions(data);
    } catch {
      // Non-critical for the hub — the "start new session" path still works.
      setActiveSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Practice</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Pick up where you left off, or start something new.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-6 w-6" />
        </div>
      ) : activeSessions.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Continue
          </h2>
          {activeSessions.map((session) => (
            <Card key={session.id} onClick={() => {}} className="p-0">
              <Link href={`/practice/session/${session.id}`} className="block p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-800 dark:text-zinc-100">
                      {session.title || 'Practice Session'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {session.sessionType.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <Badge label="active" variant="easy" />
                </div>
              </Link>
            </Card>
          ))}
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Start Practicing
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/practice/new">
            <Card className="h-full">
              <span className="text-2xl">📝</span>
              <h3 className="mt-3 font-semibold text-zinc-800 dark:text-zinc-100">New Session</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Quick practice, topic drills, company sets, or a mixed mock interview.
              </p>
            </Card>
          </Link>
          <Link href="/practice/dsa-ladder">
            <Card className="h-full">
              <span className="text-2xl">🧩</span>
              <h3 className="mt-3 font-semibold text-zinc-800 dark:text-zinc-100">DSA Ladder</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Track your progress across 20 coding-interview patterns.
              </p>
            </Card>
          </Link>
          <Link href="/questions?type=system_design">
            <Card className="h-full">
              <span className="text-2xl">🏗️</span>
              <h3 className="mt-3 font-semibold text-zinc-800 dark:text-zinc-100">System Design</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Practice designing large-scale systems with a 7-section outline.
              </p>
            </Card>
          </Link>
          <Link href="/questions?type=behavioral">
            <Card className="h-full">
              <span className="text-2xl">🗣️</span>
              <h3 className="mt-3 font-semibold text-zinc-800 dark:text-zinc-100">Behavioral</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Rehearse STAR-format answers to common behavioral prompts.
              </p>
            </Card>
          </Link>
        </div>
      </div>

      <div>
        <Link href="/attempts" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          View past attempts →
        </Link>
      </div>
    </div>
  );
}
