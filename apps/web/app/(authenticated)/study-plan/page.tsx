'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { tasksApi, topicsApi } from '../../lib/api-client';
import type { TaskResponse, TopicSummary } from '@momito/shared';
import { Card, Badge, Spinner, ErrorBanner, EmptyState } from '../../components/ui';

// MOM-075/076/077: this page used to be backed by the standalone StudyPlanItem
// model/API; that model has been merged into the consolidated Task model
// (type: 'study'). The UI/UX below is unchanged — only the data layer moved.
const STATUS_ORDER = ['todo', 'in_progress', 'done'] as const;
const STATUS_LABELS: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900',
  done: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900',
};

function getDueDateInfo(dueDate: string): { label: string; className: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dueDate);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return { label: `Overdue by ${days} day${days !== 1 ? 's' : ''}`, className: 'text-red-500 font-medium dark:text-red-400' };
  }
  if (diffDays === 0) {
    return { label: 'Due today!', className: 'text-amber-600 font-medium dark:text-amber-400' };
  }
  if (diffDays <= 3) {
    return { label: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`, className: 'text-amber-600 dark:text-amber-400' };
  }
  return null;
}

/** Inline edit form for a single study task */
function EditForm({
  item,
  topics,
  onSave,
  onCancel,
  saving,
}: {
  item: TaskResponse;
  topics: TopicSummary[];
  onSave: (data: { title: string; topicId?: string; notes: string; dueDate: string }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(item.title);
  const [topicId, setTopicId] = useState(item.topicId ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [dueDate, setDueDate] = useState(item.dueDate ? item.dueDate.slice(0, 10) : '');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setError('');
    await onSave({
      title: title.trim(),
      topicId: topicId || undefined,
      notes: notes.trim(),
      dueDate,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-zinc-100 pt-3 mt-3 dark:border-zinc-800">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1 dark:text-zinc-400">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          maxLength={200}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1 dark:text-zinc-400">Topic</label>
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">No topic</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1 dark:text-zinc-400">Target Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1 dark:text-zinc-400">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder="Any notes or resources..."
          maxLength={2000}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Inline delete confirmation */
function DeleteConfirm({
  onConfirm,
  onCancel,
  deleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 mt-2 dark:border-red-900 dark:bg-red-950">
      <p className="text-xs font-medium text-red-800 dark:text-red-300">Delete this task? This cannot be undone.</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onConfirm}
          disabled={deleting}
          className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function StudyPlanPage() {
  // List state
  const [items, setItems] = useState<TaskResponse[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<string>('todo');

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formTopicId, setFormTopicId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit state – tracks which item is being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tasks, t] = await Promise.all([
        tasksApi.list({ type: 'study' }),
        topicsApi.list(),
      ]);
      setItems(tasks);
      setTopics(t);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load study plan');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filteredItems = items.filter((i) => i.status === activeTab);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setFormSubmitting(true);
    setFormError('');
    try {
      await tasksApi.create({
        title: formTitle.trim(),
        type: 'study',
        topicId: formTopicId || undefined,
        notes: formNotes.trim() || undefined,
        dueDate: formTargetDate || undefined,
      });
      setShowForm(false);
      setFormTitle('');
      setFormTopicId('');
      setFormNotes('');
      setFormTargetDate('');
      await fetchItems();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create item');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleStatusUpdate(id: string, newStatus: string) {
    try {
      await tasksApi.update(id, { status: newStatus as TaskResponse['status'] });
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: newStatus as typeof i.status } : i))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function handleEditSave(id: string, data: { title: string; topicId?: string; notes: string; dueDate: string }) {
    setSavingEdit(true);
    try {
      const updated = await tasksApi.update(id, {
        title: data.title,
        topicId: data.topicId,
        notes: data.notes || null,
        dueDate: data.dueDate || null,
      });
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await tasksApi.remove(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && items.length === 0) {
    return <ErrorBanner message={error} onRetry={fetchItems} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Study Plan</h1>
          <p className="mt-1 text-sm text-zinc-500">Track your learning goals</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : '+ Add Task'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-zinc-800 mb-4 dark:text-zinc-100">New Study Task</h2>
          {formError && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="taskTitle" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Title
              </label>
              <input
                id="taskTitle"
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="e.g. Review Database Indexing"
                maxLength={200}
              />
            </div>
            <div>
              <label htmlFor="taskTopic" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Topic <span className="text-zinc-400">(optional)</span>
              </label>
              <select
                id="taskTopic"
                value={formTopicId}
                onChange={(e) => setFormTopicId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">No topic</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="taskNotes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Notes <span className="text-zinc-400">(optional)</span>
              </label>
              <textarea
                id="taskNotes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="Any notes or resources..."
                maxLength={2000}
              />
            </div>
            <div>
              <label htmlFor="taskTargetDate" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Target Date <span className="text-zinc-400">(optional)</span>
              </label>
              <input
                id="taskTargetDate"
                type="date"
                value={formTargetDate}
                onChange={(e) => setFormTargetDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={formSubmitting || !formTitle.trim()}
              className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {formSubmitting && <Spinner className="mr-2 h-4 w-4" />}
              Add Task
            </button>
          </form>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            onClick={() => setActiveTab(status)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === status
                ? 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {STATUS_LABELS[status]}
            <span className="ml-1.5 text-xs text-zinc-400">
              ({items.filter((i) => i.status === status).length})
            </span>
          </button>
        ))}
      </div>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No tasks"
          description={activeTab === 'todo' ? 'Add a task to get started.' : 'No tasks in this status.'}
          action={
            activeTab === 'todo' ? (
              <button
                onClick={() => setShowForm(true)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Add Task
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const dueDateInfo = item.dueDate ? getDueDateInfo(item.dueDate) : null;
            return (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-zinc-800 dark:text-zinc-100">{item.title}</h3>
                      {item.topic && <Badge label={item.topic.name} />}
                    </div>
                    {item.notes && (
                      <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{item.notes}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                      {dueDateInfo && (
                        <span className={`text-xs ${dueDateInfo.className}`}>
                          {dueDateInfo.label}
                        </span>
                      )}
                      {item.dueDate && !dueDateInfo && (
                        <span className="text-xs text-zinc-400">
                          Due: {new Date(item.dueDate).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </span>
                      )}
                      <span className="text-xs text-zinc-400">
                        Created {new Date(item.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {item.status === 'todo' && (
                      <button
                        onClick={() => handleStatusUpdate(item.id, 'in_progress')}
                        className="rounded border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950"
                      >
                        Start
                      </button>
                    )}
                    {item.status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusUpdate(item.id, 'done')}
                        className="rounded border border-green-300 px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950"
                      >
                        Done
                      </button>
                    )}
                    {item.status === 'done' && (
                      <button
                        onClick={() => handleStatusUpdate(item.id, 'todo')}
                        className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Reopen
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingId(editingId === item.id ? null : item.id);
                        setConfirmDeleteId(null);
                      }}
                      className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setConfirmDeleteId(confirmDeleteId === item.id ? null : item.id);
                        setEditingId(null);
                      }}
                      className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Inline edit form */}
                {editingId === item.id && (
                  <EditForm
                    item={item}
                    topics={topics}
                    onSave={(data) => handleEditSave(item.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={savingEdit}
                  />
                )}

                {/* Inline delete confirmation */}
                {confirmDeleteId === item.id && (
                  <DeleteConfirm
                    onConfirm={() => handleDelete(item.id)}
                    onCancel={() => setConfirmDeleteId(null)}
                    deleting={deletingId === item.id}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
