'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { storiesApi, companiesApi, reviewsApi } from '../../lib/api-client';
import { STORY_COMPETENCIES, type StoryResponse, type CompanySummary } from '@momito/shared';
import { Card, Badge, Button, Input, Spinner, ErrorBanner, EmptyState } from '../../components/ui';

// MOM-065: frontend for the Story Bank (MOM-063/064 shipped the schema + CRUD API).
// STAR-shaped: Situation/Task/Action/Result/Metrics, plus free-form competency tags,
// linked companies, and follow-up questions a user might get asked about the story.
// MOM-067: "Rehearse" self-rates a story directly (there's no session flow for
// stories the way there is for practice questions), which is what actually
// creates/schedules its ReviewState — the entry point into the FSRS loop that
// then surfaces it on /today when due, same as any other reviewable object.

function tagsToInput(tags: string[]): string {
  return tags.join(', ');
}

function inputToTags(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

interface StoryFormValues {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  metrics: string;
  competencyTags: string;
  followUpQuestions: string;
  companyIds: string[];
}

function emptyForm(): StoryFormValues {
  return {
    title: '',
    situation: '',
    task: '',
    action: '',
    result: '',
    metrics: '',
    competencyTags: '',
    followUpQuestions: '',
    companyIds: [],
  };
}

function storyToForm(story: StoryResponse): StoryFormValues {
  return {
    title: story.title,
    situation: story.situation,
    task: story.task,
    action: story.action,
    result: story.result,
    metrics: story.metrics ?? '',
    competencyTags: tagsToInput(story.competencyTags),
    followUpQuestions: tagsToInput(story.followUpQuestions),
    companyIds: story.companies.map((c) => c.id),
  };
}

/** Shared STAR + tags + companies form, used for both create and inline edit */
function StoryForm({
  values,
  companies,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
  error,
}: {
  values: StoryFormValues;
  companies: CompanySummary[];
  onChange: (values: StoryFormValues) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel?: () => void;
  submitting: boolean;
  submitLabel: string;
  error: string;
}) {
  function toggleCompany(id: string) {
    onChange({
      ...values,
      companyIds: values.companyIds.includes(id)
        ? values.companyIds.filter((c) => c !== id)
        : [...values.companyIds, id],
    });
  }

  // A5: chip picker over the fixed STORY_COMPETENCIES taxonomy. Stores each
  // competency's human-readable name directly in the same comma-separated
  // field the free-text input edits, so a chip toggle and manual typing stay
  // in sync and existing Badge rendering (which displays raw tag strings)
  // needs no change.
  const selectedCompetencyTags = inputToTags(values.competencyTags);
  function toggleCompetency(name: string) {
    const next = selectedCompetencyTags.includes(name)
      ? selectedCompetencyTags.filter((t) => t !== name)
      : [...selectedCompetencyTags, name];
    onChange({ ...values, competencyTags: tagsToInput(next) });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Title</label>
        <Input
          value={values.title}
          onChange={(e) => onChange({ ...values, title: e.target.value })}
          placeholder="e.g. Led a zero-downtime database migration"
          maxLength={200}
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Situation</label>
          <textarea
            value={values.situation}
            onChange={(e) => onChange({ ...values, situation: e.target.value })}
            rows={3}
            maxLength={4000}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="What was the context?"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Task</label>
          <textarea
            value={values.task}
            onChange={(e) => onChange({ ...values, task: e.target.value })}
            rows={3}
            maxLength={4000}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="What were you responsible for?"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Action</label>
          <textarea
            value={values.action}
            onChange={(e) => onChange({ ...values, action: e.target.value })}
            rows={3}
            maxLength={4000}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="What did you specifically do?"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Result</label>
          <textarea
            value={values.result}
            onChange={(e) => onChange({ ...values, result: e.target.value })}
            rows={3}
            maxLength={4000}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="What happened as a result?"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Metrics <span className="text-zinc-400">(optional)</span>
        </label>
        <Input
          value={values.metrics}
          onChange={(e) => onChange({ ...values, metrics: e.target.value })}
          placeholder="e.g. reduced latency by 40%"
          maxLength={1000}
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Competency tags <span className="text-zinc-400">(optional)</span>
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {STORY_COMPETENCIES.map((competency) => {
            const active = selectedCompetencyTags.includes(competency.name);
            return (
              <button
                type="button"
                key={competency.id}
                onClick={() => toggleCompetency(competency.name)}
                title={competency.description}
                className={
                  active
                    ? 'rounded-full border border-indigo-300 bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }
              >
                {competency.name}
              </button>
            );
          })}
        </div>
        <Input
          value={values.competencyTags}
          onChange={(e) => onChange({ ...values, competencyTags: e.target.value })}
          placeholder="Or type your own, comma-separated (e.g. technical depth, mentorship)"
          className="mt-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Follow-up questions <span className="text-zinc-400">(comma-separated, optional)</span>
        </label>
        <Input
          value={values.followUpQuestions}
          onChange={(e) => onChange({ ...values, followUpQuestions: e.target.value })}
          placeholder="e.g. What would you do differently?"
          className="mt-1"
        />
      </div>
      {companies.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Companies <span className="text-zinc-400">(optional)</span>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {companies.map((company) => {
              const active = values.companyIds.includes(company.id);
              return (
                <button
                  type="button"
                  key={company.id}
                  onClick={() => toggleCompany(company.id)}
                  className={
                    active
                      ? 'rounded-full border border-indigo-300 bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }
                >
                  {company.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || !values.title.trim()}>
          {submitting && <Spinner className="mr-1 h-4 w-4" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

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
    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
      <p className="text-xs font-medium text-red-800 dark:text-red-300">Delete this story? This cannot be undone.</p>
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

export default function StoriesPage() {
  const [stories, setStories] = useState<StoryResponse[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<StoryFormValues>(emptyForm());
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<StoryFormValues>(emptyForm());
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rehearsingId, setRehearsingId] = useState<string | null>(null);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [rehearseMessage, setRehearseMessage] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [storyList, companyList] = await Promise.all([storiesApi.list(), companiesApi.list()]);
      setStories(storyList);
      setCompanies(companyList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching
  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!formValues.title.trim()) return;
    setFormSubmitting(true);
    setFormError('');
    try {
      await storiesApi.create({
        title: formValues.title.trim(),
        situation: formValues.situation.trim(),
        task: formValues.task.trim(),
        action: formValues.action.trim(),
        result: formValues.result.trim(),
        metrics: formValues.metrics.trim() || undefined,
        competencyTags: inputToTags(formValues.competencyTags),
        followUpQuestions: inputToTags(formValues.followUpQuestions),
        companyIds: formValues.companyIds,
      });
      setShowForm(false);
      setFormValues(emptyForm());
      await fetchAll();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create story');
    } finally {
      setFormSubmitting(false);
    }
  }

  function startEdit(story: StoryResponse) {
    setEditingId(story.id);
    setEditValues(storyToForm(story));
    setEditError('');
    setConfirmDeleteId(null);
  }

  async function handleEditSave(id: string, e: FormEvent) {
    e.preventDefault();
    setSavingEdit(true);
    setEditError('');
    try {
      const updated = await storiesApi.update(id, {
        title: editValues.title.trim(),
        situation: editValues.situation.trim(),
        task: editValues.task.trim(),
        action: editValues.action.trim(),
        result: editValues.result.trim(),
        metrics: editValues.metrics.trim() || null,
        competencyTags: inputToTags(editValues.competencyTags),
        followUpQuestions: inputToTags(editValues.followUpQuestions),
        companyIds: editValues.companyIds,
      });
      setStories((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setEditingId(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update story');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await storiesApi.remove(id);
      setStories((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete story');
    } finally {
      setDeletingId(null);
    }
  }

  async function submitRehearsal(storyId: string, rating: number) {
    setRatingId(storyId);
    setRehearseMessage(null);
    try {
      await reviewsApi.record('story', storyId, rating);
      setRehearsingId(null);
      setRehearseMessage('Scheduled — this story will resurface on Today when due.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record rehearsal');
    } finally {
      setRatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && stories.length === 0) {
    return <ErrorBanner message={error} onRetry={fetchAll} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Story Bank</h1>
          <p className="mt-1 text-sm text-zinc-500">STAR-formatted stories for behavioral interviews</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); }}>
          {showForm ? 'Cancel' : '+ Add Story'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">New Story</h2>
          <StoryForm
            values={formValues}
            companies={companies}
            onChange={setFormValues}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            submitting={formSubmitting}
            submitLabel="Add Story"
            error={formError}
          />
        </Card>
      )}

      {stories.length === 0 ? (
        <EmptyState
          icon="⭐"
          title="No stories yet"
          description="Add a STAR-formatted story to get started."
          action={
            <Button onClick={() => setShowForm(true)}>Add Story</Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {stories.map((story) => {
            const isExpanded = expandedId === story.id;
            const isEditing = editingId === story.id;
            return (
              <Card key={story.id}>
                {isEditing ? (
                  <div>
                    <h3 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Edit Story</h3>
                    <StoryForm
                      values={editValues}
                      companies={companies}
                      onChange={setEditValues}
                      onSubmit={(e) => handleEditSave(story.id, e)}
                      onCancel={() => setEditingId(null)}
                      submitting={savingEdit}
                      submitLabel="Save"
                      error={editError}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : story.id)}
                          className="text-left font-medium text-zinc-800 hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400"
                        >
                          {story.title}
                        </button>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {story.competencyTags.map((tag) => (
                            <Badge key={tag} label={tag} />
                          ))}
                          {story.companies.map((c) => (
                            <span
                              key={c.id}
                              className="inline-block rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : story.id)}
                          className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </button>
                        <button
                          onClick={() => {
                            setRehearsingId(rehearsingId === story.id ? null : story.id);
                            setRehearseMessage(null);
                          }}
                          className="rounded border border-indigo-300 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400 dark:hover:bg-indigo-950"
                        >
                          Rehearse
                        </button>
                        <button
                          onClick={() => startEdit(story)}
                          className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(confirmDeleteId === story.id ? null : story.id)}
                          className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-3 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
                        <div>
                          <p className="font-medium text-zinc-500 dark:text-zinc-400">Situation</p>
                          <p className="mt-0.5 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{story.situation}</p>
                        </div>
                        <div>
                          <p className="font-medium text-zinc-500 dark:text-zinc-400">Task</p>
                          <p className="mt-0.5 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{story.task}</p>
                        </div>
                        <div>
                          <p className="font-medium text-zinc-500 dark:text-zinc-400">Action</p>
                          <p className="mt-0.5 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{story.action}</p>
                        </div>
                        <div>
                          <p className="font-medium text-zinc-500 dark:text-zinc-400">Result</p>
                          <p className="mt-0.5 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{story.result}</p>
                        </div>
                        {story.metrics && (
                          <div>
                            <p className="font-medium text-zinc-500 dark:text-zinc-400">Metrics</p>
                            <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">{story.metrics}</p>
                          </div>
                        )}
                        {story.followUpQuestions.length > 0 && (
                          <div>
                            <p className="font-medium text-zinc-500 dark:text-zinc-400">Follow-up questions</p>
                            <ul className="mt-1 list-inside list-disc text-zinc-700 dark:text-zinc-300">
                              {story.followUpQuestions.map((q) => (
                                <li key={q}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {rehearsingId === story.id && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                        <span className="text-xs text-zinc-500">
                          Recall the STAR beats out loud, then rate how it went:
                        </span>
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            onClick={() => submitRehearsal(story.id, rating)}
                            disabled={ratingId === story.id}
                            className="h-8 w-8 rounded-full bg-zinc-100 text-sm font-medium text-zinc-500 hover:bg-indigo-600 hover:text-white disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400"
                            title={`${rating} / 5`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    )}

                    {confirmDeleteId === story.id && (
                      <DeleteConfirm
                        onConfirm={() => handleDelete(story.id)}
                        onCancel={() => setConfirmDeleteId(null)}
                        deleting={deletingId === story.id}
                      />
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {rehearseMessage && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          {rehearseMessage}
        </div>
      )}
    </div>
  );
}
