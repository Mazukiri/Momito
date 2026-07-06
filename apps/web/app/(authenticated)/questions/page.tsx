'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { questionsApi, topicsApi, type ListQuestionsParams } from '../../lib/api-client';
import type { QuestionResponse, TopicSummary } from '@momito/shared';
import { Card, Badge, Pagination, ListSkeleton, EmptyState, ErrorBanner } from '../../components/ui';

const TYPE_LABELS: Record<string, string> = {
  dsa: 'DSA',
  backend: 'Backend',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  nodejs: 'Node.js',
  database: 'Database',
  os: 'OS',
  networking: 'Networking',
  oop: 'OOP',
  system_design: 'System Design',
  behavioral: 'Behavioral',
};

export default function QuestionsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters — seeded from the URL so filters survive back/forward navigation
  // and relaunching the installed PWA, instead of always resetting to blank.
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [difficultyFilter, setDifficultyFilter] = useState(searchParams.get('difficulty') || '');
  const [topicFilter, setTopicFilter] = useState(searchParams.get('topic') || '');
  const [topics, setTopics] = useState<TopicSummary[]>([]);

  // Data
  const [questions, setQuestions] = useState<QuestionResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 20;

  // Without this, every keystroke fired its own /questions request — typing
  // a 10-character search term meant 10 network round-trips instead of one.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (debouncedSearch) qs.set('search', debouncedSearch);
    if (typeFilter) qs.set('type', typeFilter);
    if (difficultyFilter) qs.set('difficulty', difficultyFilter);
    if (topicFilter) qs.set('topic', topicFilter);
    if (page > 1) qs.set('page', String(page));
    const queryString = qs.toString();
    router.replace(queryString ? `/questions?${queryString}` : '/questions', { scroll: false });
    // router intentionally excluded — Next's router identity isn't stable
    // across renders and including it would re-trigger this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, typeFilter, difficultyFilter, topicFilter, page]);

  const fetchQuestions = useCallback(async (params: ListQuestionsParams) => {
    setLoading(true);
    setError('');
    try {
      const res = await questionsApi.list(params);
      setQuestions(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTopics = useCallback(async () => {
    try {
      const t = await topicsApi.list();
      setTopics(t);
    } catch {
      // topics are non-critical
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching on mount
    fetchTopics();
  }, [fetchTopics]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching on mount/filter change
    fetchQuestions({
      search: debouncedSearch || undefined,
      type: typeFilter || undefined,
      difficulty: difficultyFilter || undefined,
      topic: topicFilter || undefined,
      page,
      limit,
    });
  }, [debouncedSearch, typeFilter, difficultyFilter, topicFilter, page, fetchQuestions]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Questions</h1>
        <button
          onClick={() => router.push("/questions/new")}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New Question
        </button>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          aria-label="Search questions by title"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <select
          aria-label="Filter by question type"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Filter by difficulty"
          value={difficultyFilter}
          onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select
          aria-label="Filter by topic"
          value={topicFilter}
          onChange={(e) => { setTopicFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Search
        </button>
      </form>

      {/* Results */}
      {error && <ErrorBanner message={error} onRetry={() => fetchQuestions({ page, limit })} />}

      {loading ? (
        <ListSkeleton count={6} />
      ) : questions.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No questions found"
          description="Try adjusting your filters or search terms."
        />
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <Card
              key={q.id}
              onClick={() => router.push(`/questions/${q.id}`)}
              className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-zinc-800 truncate dark:text-zinc-100">{q.title}</h3>
                <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{q.prompt}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge label={TYPE_LABELS[q.type] ?? q.type} variant={q.type} />
                  <Badge label={q.difficulty} variant={q.difficulty} />
                  {q.topic && <Badge label={q.topic.name} />}
                </div>
              </div>
            </Card>
          ))}
          <Pagination page={page} limit={limit} total={total} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
