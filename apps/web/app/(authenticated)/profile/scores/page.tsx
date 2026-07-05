'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, profileApi, profileScoresApi } from '../../../lib/api-client';
import {
  ROLE_TEMPLATE_IDS,
  ROLE_TEMPLATES,
  type ProfileScoreResponse,
  type RoleTemplateId,
} from '@momito/shared';
import { Card, EmptyState, ErrorBanner, Spinner } from '../../../components/ui';

const SCORE_FIELDS: Array<[keyof Pick<ProfileScoreResponse, 'skillsMatch' | 'projectQuality' | 'experienceDepth' | 'presentation'>, string]> = [
  ['skillsMatch', 'Skills'],
  ['projectQuality', 'Projects'],
  ['experienceDepth', 'Experience'],
  ['presentation', 'Presentation'],
];

function ScoreBars({ score }: { score: ProfileScoreResponse }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SCORE_FIELDS.map(([field, label]) => {
        const value = score[field];
        return (
          <div key={field}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">{label}</span>
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{Math.round(value * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full ${value >= 0.75 ? 'bg-green-500' : value >= 0.45 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.round(value * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProfileScoresPage() {
  const router = useRouter();
  const [scores, setScores] = useState<ProfileScoreResponse[]>([]);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [role, setRole] = useState<RoleTemplateId>('google-l4-swe');
  const [jdText, setJdText] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profileResult, scoreList] = await Promise.allSettled([
        profileApi.get(),
        profileScoresApi.list(),
      ]);
      if (profileResult.status === 'fulfilled') {
        setHasProfile(true);
      } else if (profileResult.reason instanceof ApiClientError && profileResult.reason.statusCode === 404) {
        setHasProfile(false);
      } else {
        throw profileResult.reason;
      }
      if (scoreList.status === 'fulfilled') {
        setScores(scoreList.value);
      } else {
        throw scoreList.reason;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile scores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching
    fetchData();
  }, [fetchData]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError('');
    try {
      const created = await profileScoresApi.create({
        role,
        jdText: jdText.trim() || null,
      });
      router.push(`/profile/scores/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create profile score');
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Profile Scores</h1>
          <p className="mt-1 text-sm text-zinc-500">Compare your profile against role templates and JDs.</p>
        </div>
        <button
          onClick={() => router.push('/profile')}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Edit Profile
        </button>
      </div>

      {error && <div className="mb-6"><ErrorBanner message={error} onRetry={fetchData} /></div>}

      {!hasProfile ? (
        <Card>
          <EmptyState
            icon="CV"
            title="No profile to score"
            description="Upload or create a profile before running role-template scoring."
            action={
              <button
                onClick={() => router.push('/profile/upload')}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Upload CV
              </button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Role Template
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as RoleTemplateId)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {ROLE_TEMPLATE_IDS.map((id) => (
                    <option key={id} value={id}>{ROLE_TEMPLATES[id].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="jdText" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Job Description
                </label>
                <textarea
                  id="jdText"
                  value={jdText}
                  onChange={(event) => setJdText(event.target.value)}
                  rows={7}
                  placeholder="Paste a specific JD to add its skills into the target."
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating && <Spinner className="mr-2 h-4 w-4" />}
                Create Score
              </button>
            </form>
          </Card>

          {scores.length === 0 ? (
            <Card>
              <EmptyState icon="%" title="No scores yet" description="Create your first role-template score." />
            </Card>
          ) : (
            <div className="space-y-3">
              {scores.map((score) => (
                <Card key={score.id} onClick={() => router.push(`/profile/scores/${score.id}`)}>
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">{score.targetLabel}</h2>
                      <p className="text-xs text-zinc-400">
                        {new Date(score.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-zinc-400">View details</span>
                  </div>
                  <ScoreBars score={score} />
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
