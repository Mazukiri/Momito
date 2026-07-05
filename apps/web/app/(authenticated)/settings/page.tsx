'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { topicsApi, companiesApi } from '../../lib/api-client';
import type { TopicSummary, CompanySummary } from '@momito/shared';
import { Card, Spinner, ErrorBanner, EmptyState } from '../../components/ui';

// ── Topics Section ───────────────────────────────
function TopicsManager() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTopic, setEditingTopic] = useState<TopicSummary | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const t = await topicsApi.list();
        setTopics(t);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load topics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function resetForm() {
    setNewName('');
    setNewDescription('');
    setEditingTopic(null);
  }

  function startEdit(t: TopicSummary) {
    setEditingTopic(t);
    setNewName(t.name);
    setNewDescription('');
  }

  async function handleSave() {
    if (!newName.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editingTopic) {
        const updated = await topicsApi.update(editingTopic.id, { name: newName.trim() });
        setTopics((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const created = await topicsApi.create({ name: newName.trim(), description: newDescription.trim() || undefined });
        setTopics((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save topic');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this topic? This action will fail if any questions are currently linked to it.')) return;
    setDeletingId(id);
    try {
      await topicsApi.delete(id);
      setTopics((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete topic');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Topics</h3>
        {!editingTopic && (
          <button
            onClick={() => { resetForm(); setEditingTopic({ id: '', name: '' }); }}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add Topic
          </button>
        )}
      </div>

      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

      {/* Create/Edit form inline when editingTopic is set */}
      {editingTopic && (
        <Card className="mb-4 border-indigo-200 dark:border-indigo-900">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="e.g. System Design"
                maxLength={200}
                autoFocus
              />
            </div>
            {!editingTopic.id && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Description <span className="text-zinc-400">(optional)</span>
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  placeholder="Brief description of the topic..."
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !newName.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingTopic.id ? 'Update' : 'Create'}
              </button>
              <button
                onClick={resetForm}
                className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
      ) : topics.length === 0 ? (
        <EmptyState icon="📂" title="No topics yet" description="Add your first topic to organize questions." />
      ) : (
        <div className="space-y-2">
          {topics.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t.name}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(t)}
                  className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {deletingId === t.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Companies Section ────────────────────────────
function CompaniesManager() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingCompany, setEditingCompany] = useState<CompanySummary | null>(null);
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await companiesApi.list();
        setCompanies(c);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load companies');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function resetForm() {
    setNewName('');
    setNewRegion('');
    setNewNotes('');
    setEditingCompany(null);
  }

  function startEdit(c: CompanySummary) {
    setEditingCompany(c);
    setNewName(c.name);
    setNewRegion('');
    setNewNotes('');
  }

  async function handleSave() {
    if (!newName.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editingCompany) {
        const updated = await companiesApi.update(editingCompany.id, { name: newName.trim() });
        setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await companiesApi.create({ name: newName.trim(), region: newRegion.trim() || undefined, notes: newNotes.trim() || undefined });
        setCompanies((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save company');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this company? Questions associated with it will lose the reference.')) return;
    setDeletingId(id);
    try {
      await companiesApi.delete(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete company');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Companies</h3>
        {!editingCompany && (
          <button
            onClick={() => { resetForm(); setEditingCompany({ id: '', name: '' }); }}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add Company
          </button>
        )}
      </div>

      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

      {editingCompany && (
        <Card className="mb-4 border-indigo-200 dark:border-indigo-900">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="e.g. Google"
                maxLength={200}
                autoFocus
              />
            </div>
            {!editingCompany.id && (
              <>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Region <span className="text-zinc-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    placeholder="e.g. US, Singapore, Global"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Notes <span className="text-zinc-400">(optional)</span>
                  </label>
                  <textarea
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    rows={2}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    placeholder="Any notes about the company..."
                  />
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !newName.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingCompany.id ? 'Update' : 'Create'}
              </button>
              <button
                onClick={resetForm}
                className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
      ) : companies.length === 0 ? (
        <EmptyState icon="🏢" title="No companies yet" description="Add companies to tag interview questions." />
      ) : (
        <div className="space-y-2">
          {companies.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{c.name}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(c)}
                  className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {deletingId === c.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings Page ─────────────────────────────────
export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage topics and companies used across your question bank
        </p>
      </div>

      <div className="space-y-8">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Content Coverage</h2>
              <p className="mt-1 text-sm text-zinc-500">See seed/published question progress toward plan targets.</p>
            </div>
            <Link href="/settings/content" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              View →
            </Link>
          </div>
        </Card>

        <Card>
          <TopicsManager />
        </Card>

        <Card>
          <CompaniesManager />
        </Card>
      </div>
    </div>
  );
}
