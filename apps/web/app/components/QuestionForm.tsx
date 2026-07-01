'use client';

import { useState, useEffect } from 'react';
import { topicsApi, companiesApi } from '../lib/api-client';
import type { TopicSummary, CompanySummary } from '@momito/shared';
import { ErrorBanner } from './ui';

export interface QuestionFormData {
  title: string;
  prompt: string;
  type: string;
  difficulty: string;
  topicId: string;
  subtopic: string;
  referenceAnswer: string;
  notes: string;
  sourceUrl: string;
  companyIds: string[];
}

interface QuestionFormProps {
  initialData?: Partial<QuestionFormData>;
  onSubmit: (data: QuestionFormData) => Promise<void>;
  submitLabel?: string;
  submitting?: boolean;
}

const TYPE_OPTIONS = [
  { value: 'dsa', label: 'DSA' },
  { value: 'backend', label: 'Backend' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'nodejs', label: 'Node.js' },
  { value: 'database', label: 'Database' },
  { value: 'os', label: 'OS' },
  { value: 'networking', label: 'Networking' },
  { value: 'oop', label: 'OOP' },
  { value: 'system_design', label: 'System Design' },
  { value: 'behavioral', label: 'Behavioral' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export default function QuestionForm({
  initialData,
  onSubmit,
  submitLabel = 'Save',
  submitting = false,
}: QuestionFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [prompt, setPrompt] = useState(initialData?.prompt ?? '');
  const [type, setType] = useState(initialData?.type ?? '');
  const [difficulty, setDifficulty] = useState(initialData?.difficulty ?? '');
  const [topicId, setTopicId] = useState(initialData?.topicId ?? '');
  const [subtopic, setSubtopic] = useState(initialData?.subtopic ?? '');
  const [referenceAnswer, setReferenceAnswer] = useState(initialData?.referenceAnswer ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [sourceUrl, setSourceUrl] = useState(initialData?.sourceUrl ?? '');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(initialData?.companyIds ?? []);

  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [error, setError] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [newTopicName, setNewTopicName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [t, c] = await Promise.all([
          topicsApi.list(),
          companiesApi.list(),
        ]);
        setTopics(t);
        setCompanies(c);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load topics/companies');
      } finally {
        setLoadingMeta(false);
      }
    }
    loadMeta();
  }, []);

  async function handleCreateTopic() {
    if (!newTopicName.trim()) return;
    setCreatingTopic(true);
    try {
      const created = await topicsApi.create({ name: newTopicName.trim() });
      setTopics((prev) => [...prev, created]);
      setTopicId(created.id);
      setNewTopicName('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create topic');
    } finally {
      setCreatingTopic(false);
    }
  }

  async function handleCreateCompany() {
    if (!newCompanyName.trim()) return;
    setCreatingCompany(true);
    try {
      const created = await companiesApi.create({ name: newCompanyName.trim() });
      setCompanies((prev) => [...prev, created]);
      setSelectedCompanyIds((prev) => [...prev, created.id]);
      setNewCompanyName('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setCreatingCompany(false);
    }
  }

  function toggleCompany(companyId: string) {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim()) { setError('Title is required'); return; }
    if (!prompt.trim()) { setError('Prompt is required'); return; }
    if (!type) { setError('Type is required'); return; }
    if (!difficulty) { setError('Difficulty is required'); return; }
    if (!topicId) { setError('Topic is required'); return; }

    await onSubmit({
      title: title.trim(),
      prompt: prompt.trim(),
      type,
      difficulty,
      topicId,
      subtopic: subtopic.trim(),
      referenceAnswer: referenceAnswer.trim(),
      notes: notes.trim(),
      sourceUrl: sourceUrl.trim(),
      companyIds: selectedCompanyIds,
    });
  }

  if (loadingMeta) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <ErrorBanner message={error} />}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-zinc-700">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="e.g. Implement a Rate Limiter"
          maxLength={200}
        />
      </div>

      {/* Prompt */}
      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-zinc-700">
          Prompt <span className="text-red-500">*</span>
        </label>
        <textarea
          id="prompt"
          rows={6}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Describe the interview question in detail..."
        />
      </div>

      {/* Type and Difficulty */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-zinc-700">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select type...</option>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="difficulty" className="block text-sm font-medium text-zinc-700">
            Difficulty <span className="text-red-500">*</span>
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select difficulty...</option>
            {DIFFICULTY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Topic */}
      <div>
        <label htmlFor="topic" className="block text-sm font-medium text-zinc-700">
          Topic <span className="text-red-500">*</span>
        </label>
        <select
          id="topic"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Select topic...</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTopic(); } }}
            placeholder="Or create new topic..."
            className="block flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleCreateTopic}
            disabled={creatingTopic || !newTopicName.trim()}
            className="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
          >
            {creatingTopic ? '...' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Subtopic */}
      <div>
        <label htmlFor="subtopic" className="block text-sm font-medium text-zinc-700">
          Subtopic <span className="text-zinc-400">(optional)</span>
        </label>
        <input
          id="subtopic"
          type="text"
          value={subtopic}
          onChange={(e) => setSubtopic(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="e.g. Token Bucket"
          maxLength={150}
        />
      </div>

      {/* Companies */}
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Companies <span className="text-zinc-400">(optional)</span>
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCompany(c.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedCompanyIds.includes(c.id)
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        {companies.length === 0 && (
          <p className="mt-1 text-xs text-zinc-400">No companies yet. Add one below.</p>
        )}
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCompany(); } }}
            placeholder="Or create new company..."
            className="block flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleCreateCompany}
            disabled={creatingCompany || !newCompanyName.trim()}
            className="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
          >
            {creatingCompany ? '...' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Reference Answer */}
      <div>
        <label htmlFor="referenceAnswer" className="block text-sm font-medium text-zinc-700">
          Reference Answer <span className="text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="referenceAnswer"
          rows={8}
          value={referenceAnswer}
          onChange={(e) => setReferenceAnswer(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Write the reference answer or solution..."
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-zinc-700">
          Notes <span className="text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Any additional notes..."
        />
      </div>

      {/* Source URL */}
      <div>
        <label htmlFor="sourceUrl" className="block text-sm font-medium text-zinc-700">
          Source URL <span className="text-zinc-400">(optional)</span>
        </label>
        <input
          id="sourceUrl"
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="https://example.com/question-source"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
