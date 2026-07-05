'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sessionsApi, topicsApi, companiesApi, reviewsApi } from '../../../lib/api-client';
import { CAREER_ROLE_AREA_IDS, CAREER_ROLE_TRACKS, type TopicSummary, type CompanySummary, type ReviewStateResponse } from '@momito/shared';
import { Spinner } from '../../../components/ui';

const SESSION_TYPE_LABELS: Record<string, string> = {
  quick_practice: 'Quick Practice',
  topic_practice: 'Topic Practice',
  company_practice: 'Company Practice',
  mixed_mock: 'Mixed Mock',
  role_drill: 'Role Drill',
  weak_area_review: 'Weak Area Review',
  daily_mixed_set: 'Daily Mixed Set',
  job_prep: 'Job Prep',
  spaced_review: 'Spaced Review',
};

const SESSION_TYPE_DESCRIPTIONS: Record<string, string> = {
  quick_practice: 'Random questions across all topics',
  topic_practice: 'Focus on a specific topic',
  company_practice: 'Practice questions asked by a specific company',
  mixed_mock: 'Mix of question types and difficulties',
  role_drill: 'Focus on one role track and area',
  weak_area_review: 'Revisit low-confidence areas',
  daily_mixed_set: 'Small balanced set for today',
  job_prep: 'Practice against a target job',
  spaced_review: 'Practice everything currently due for spaced-repetition review',
};

export default function NewPracticePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState(searchParams.get('mode') || 'quick_practice');
  const [topicId, setTopicId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [roleTrackId, setRoleTrackId] = useState(searchParams.get('roleTrackId') || '');
  const [area, setArea] = useState(searchParams.get('area') || '');
  const missionId = searchParams.get('missionId') || undefined;
  const [pattern, setPattern] = useState(searchParams.get('pattern') || '');
  const [questionCount, setQuestionCount] = useState(5);

  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(true);
  const [error, setError] = useState('');

  // MOM-032 follow-up: "Spaced Review" pulls the exact set of currently-due
  // FSRS reviews (MOM-027/029/030/031) instead of a filtered random draw —
  // this is the session-flow half of wiring up a session-type label that,
  // until now, had no backend behavior behind it at all.
  const [dueReviews, setDueReviews] = useState<ReviewStateResponse[] | null>(null);
  const [fetchingDue, setFetchingDue] = useState(false);

  const fetchOptions = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([topicsApi.list(), companiesApi.list()]);
      setTopics(t);
      setCompanies(c);
    } catch {
      // non-critical
    } finally {
      setFetchingOptions(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching on mount
    fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    if (sessionType !== 'spaced_review') return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching on session-type change
    setFetchingDue(true);
    reviewsApi.due()
      .then((due) => { if (!cancelled) setDueReviews(due); })
      .catch(() => { if (!cancelled) setDueReviews([]); })
      .finally(() => { if (!cancelled) setFetchingDue(false); });
    return () => { cancelled = true; };
  }, [sessionType]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const dueQuestionIds = (dueReviews ?? []).filter((r) => r.objectType === 'question').map((r) => r.objectId);
      const res = sessionType === 'spaced_review'
        ? await sessionsApi.create({
            title: title || undefined,
            sessionType,
            missionId,
            questionCount: dueQuestionIds.length,
            questionIds: dueQuestionIds,
          })
        : await sessionsApi.create({
            title: title || undefined,
            sessionType,
            topicId: topicId || undefined,
            companyId: companyId || undefined,
            difficulty: difficulty || undefined,
            roleTrackId: roleTrackId || undefined,
            area: area || undefined,
            pattern: pattern || undefined,
            missionId,
            questionCount,
          });
      router.push(`/practice/session/${res.session.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create session';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (fetchingOptions) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <button
        onClick={() => router.push('/questions')}
        className="mb-4 text-sm text-indigo-600 hover:text-indigo-500"
      >
        ← Back
      </button>

      <h1 className="mb-6 text-2xl font-bold text-zinc-800">New Practice Session</h1>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Session Type */}
        <div>
          <label htmlFor="sessionType" className="block text-sm font-medium text-zinc-700">
            Session Type
          </label>
          <select
            id="sessionType"
            value={sessionType}
            onChange={(e) => { setSessionType(e.target.value); setTopicId(''); setCompanyId(''); }}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {Object.entries(SESSION_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-400">
            {SESSION_TYPE_DESCRIPTIONS[sessionType]}
          </p>
        </div>

        {/* Spaced Review: a fixed set (currently-due FSRS reviews), no filters apply */}
        {sessionType === 'spaced_review' && (
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            {fetchingDue ? (
              <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
            ) : dueReviews && dueReviews.length > 0 ? (
              <>
                <p className="text-sm font-medium text-zinc-700">
                  {dueReviews.length} item{dueReviews.length === 1 ? '' : 's'} due for review
                </p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                  {dueReviews.slice(0, 5).map((r) => (
                    <li key={r.id} className="truncate">{r.title ?? 'Untitled review item'}</li>
                  ))}
                  {dueReviews.length > 5 && <li>+ {dueReviews.length - 5} more</li>}
                </ul>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Nothing due for review right now.</p>
            )}
          </div>
        )}

        {/* Role filters */}
        {['role_drill', 'weak_area_review', 'daily_mixed_set', 'job_prep'].includes(sessionType) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="roleTrackId" className="block text-sm font-medium text-zinc-700">
                Role Track
              </label>
              <select
                id="roleTrackId"
                value={roleTrackId}
                onChange={(e) => setRoleTrackId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Any role</option>
                {Object.values(CAREER_ROLE_TRACKS).map((track) => (
                  <option key={track.id} value={track.id}>{track.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="area" className="block text-sm font-medium text-zinc-700">
                Area
              </label>
              <select
                id="area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Any area</option>
                {CAREER_ROLE_AREA_IDS.map((item) => (
                  <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pattern" className="block text-sm font-medium text-zinc-700">
                Pattern <span className="text-zinc-400">(optional)</span>
              </label>
              <input
                id="pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="e.g. graph, dp, latency"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-700">
            Title <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="e.g. DSA warmup"
            maxLength={200}
          />
        </div>

        {/* Topic (for topic_practice) */}
        {sessionType === 'topic_practice' && (
          <div>
            <label htmlFor="topicId" className="block text-sm font-medium text-zinc-700">
              Topic
            </label>
            <select
              id="topicId"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Company (for company_practice) */}
        {sessionType === 'company_practice' && (
          <div>
            <label htmlFor="companyId" className="block text-sm font-medium text-zinc-700">
              Company
            </label>
            <select
              id="companyId"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Difficulty (optional for all types except Spaced Review, whose set is fixed) */}
        {sessionType !== 'spaced_review' && (
          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-zinc-700">
              Difficulty <span className="text-zinc-400">(optional)</span>
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Any difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        )}

        {/* Question Count */}
        {sessionType !== 'spaced_review' && (
          <div>
            <label htmlFor="questionCount" className="block text-sm font-medium text-zinc-700">
              Number of Questions
            </label>
            <input
              id="questionCount"
              type="number"
              min={1}
              max={100}
              value={questionCount}
              onChange={(e) => setQuestionCount(Math.max(1, Math.min(100, Number(e.target.value))))}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-zinc-400">Choose between 1 and 100 questions</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || fetchingDue || (sessionType === 'spaced_review' && (dueReviews?.length ?? 0) === 0)}
          className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading && <Spinner className="mr-2 h-4 w-4" />}
          Start Session
        </button>
      </form>
    </div>
  );
}
