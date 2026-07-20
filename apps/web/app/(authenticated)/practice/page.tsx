'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { questionsApi, sessionsApi, weaknessesApi } from '../../lib/api-client';
import type { InterviewSessionResponse, WeaknessSummaryResponse } from '@momito/shared';
import { Card, Spinner, Badge, EmptyState } from '../../components/ui';

// MOM-041: practice hub — the landing page for the "Practice" primary nav tab.
// Surfaces an in-progress session (if any), the user's current weak spots
// (plan §5.4/§6.1 — the signals their reflections have been feeding), plus
// entry points into every practice mode.
export default function PracticeHubPage() {
  const router = useRouter();
  const [activeSessions, setActiveSessions] = useState<InterviewSessionResponse[]>([]);
  const [weaknesses, setWeaknesses] = useState<WeaknessSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingRepair, setStartingRepair] = useState(false);
  const [repairError, setRepairError] = useState('');
  // MOM-175: null while unknown, so a failed count never flashes the empty
  // state at someone whose bank is actually fine.
  const [hasQuestions, setHasQuestions] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessions, weaknessSummary, questionPage] = await Promise.all([
        sessionsApi.list({ status: 'active', limit: 3 }),
        weaknessesApi.summary().catch(() => null),
        // Every tile below leads somewhere that needs questions to exist. On a
        // fresh deployment the bank is empty until the seed is run by hand, and
        // the tiles used to render regardless — so each one dead-ended on
        // "No questions match the selected filters".
        questionsApi.list({ limit: 1 }).catch(() => null),
      ]);
      setActiveSessions(sessions.data);
      setWeaknesses(weaknessSummary);
      setHasQuestions(questionPage ? questionPage.data.length > 0 : null);
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

  async function startRepairSession() {
    if (startingRepair) return;
    setStartingRepair(true);
    setRepairError('');
    try {
      const created = await sessionsApi.create({
        sessionType: 'weak_area_review',
        title: 'Weakness repair',
        questionCount: 5,
      });
      router.push(`/practice/session/${created.session.id}`);
    } catch (err: unknown) {
      setRepairError(err instanceof Error ? err.message : 'Failed to start repair session');
      setStartingRepair(false);
    }
  }

  const hasWeaknesses = (weaknesses?.totalStruggles ?? 0) > 0;

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

      {!loading && hasWeaknesses && weaknesses && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Weak spots — last {weaknesses.windowDays} days
          </h2>
          <Card>
            <div className="flex flex-wrap gap-2">
              {weaknesses.reasons.slice(0, 3).map((reason) => (
                <span
                  key={reason.reason}
                  className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400"
                  title={reason.sampleTitles.join(' · ')}
                >
                  {reason.label} ×{reason.count}
                </span>
              ))}
              {[...weaknesses.patterns, ...weaknesses.topics]
                .sort((left, right) => right.struggles - left.struggles)
                .slice(0, 3)
                .map((area) => (
                  <span
                    key={area.key}
                    className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                  >
                    {area.label} · {area.struggles}/{area.attempts} struggled
                  </span>
                ))}
            </div>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              A repair session redoes your recent misses and drills sibling questions from the same
              patterns and topics.
            </p>
            <button
              onClick={startRepairSession}
              disabled={startingRepair}
              className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {startingRepair ? 'Starting…' : 'Start repair session →'}
            </button>
            {repairError && <p className="mt-2 text-xs text-red-600">{repairError}</p>}
          </Card>
        </div>
      )}

      {hasQuestions === false ? (
        <Card>
          <EmptyState
            icon="🌱"
            title="No questions yet"
            description="Every practice mode below draws from the question bank, and it's empty — so starting a session would fail. Seed the starter bank, or write your own first question."
            action={
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Link
                  href="/questions/new"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Write a question →
                </Link>
                <code className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  pnpm db:seed
                </code>
              </div>
            }
          />
        </Card>
      ) : (
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
      )}

      <div>
        <Link href="/attempts" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          View past attempts →
        </Link>
      </div>
    </div>
  );
}
