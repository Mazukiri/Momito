'use client';

import { useCallback, useEffect, useState } from 'react';
import { CAREER_ROLE_TRACKS, type AtsCoverageResponse, type CareerRoleTrackId, type CoverLetterDraftResult, type JobApplicationResponse, type ResumeAnalysisResult, type ResumeBulletRewrite, type ResumeVersionResponse } from '@momito/shared';
import { jobsApi, profileScoresApi, resumesApi } from '../../../lib/api-client';
import { Card, EmptyState, ErrorBanner, Spinner } from '../../../components/ui';

export default function ResumesPage() {
  const [versions, setVersions] = useState<ResumeVersionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftLabel, setDraftLabel] = useState('');
  const [saving, setSaving] = useState(false);
  // MOM-134-full: ATS coverage of the selected version's contentMd vs a pasted JD.
  const [jdText, setJdText] = useState('');
  const [ats, setAts] = useState<AtsCoverageResponse | null>(null);
  const [atsBusy, setAtsBusy] = useState(false);
  const [atsMsg, setAtsMsg] = useState('');
  // MOM-136/137/138: résumé AI. `aiReason` holds the dormant-until-key banner
  // ("not configured on this instance") — an expected state, not an error.
  // MOM-149: the application the critique is judged against (JD + company focus areas).
  const [jobs, setJobs] = useState<JobApplicationResponse[]>([]);
  const [targetJobId, setTargetJobId] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiReason, setAiReason] = useState('');
  const [analysis, setAnalysis] = useState<ResumeAnalysisResult | null>(null);
  const [rewrites, setRewrites] = useState<ResumeBulletRewrite[] | null>(null);
  const [coverLetter, setCoverLetter] = useState<CoverLetterDraftResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, jobList] = await Promise.all([resumesApi.list(), jobsApi.list()]);
      setVersions(list);
      setJobs(jobList);
      if (list.length > 0 && selectedId === null) {
        setSelectedId(list[0].id);
        setDraft(list[0].contentMd);
        setDraftLabel(list[0].label);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load résumés');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  function select(version: ResumeVersionResponse) {
    setSelectedId(version.id);
    setDraft(version.contentMd);
    setDraftLabel(version.label);
    setAts(null);
    setAtsMsg('');
    setAnalysis(null);
    setRewrites(null);
    setCoverLetter(null);
    setAiReason('');
  }

  async function checkAts() {
    if (!selectedId || !jdText.trim()) return;
    setAtsBusy(true);
    setAtsMsg('');
    try {
      setAts(await profileScoresApi.atsCoverage(jdText.trim(), selectedId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to check ATS coverage');
    } finally {
      setAtsBusy(false);
    }
  }

  async function generateAtsTasks() {
    if (!selectedId || !jdText.trim()) return;
    setAtsBusy(true);
    try {
      const { created } = await profileScoresApi.atsGenerateTasks(jdText.trim(), selectedId);
      setAtsMsg(created > 0 ? `Added ${created} keyword task${created === 1 ? '' : 's'}.` : 'No new tasks — all missing keywords already tracked.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create tasks');
    } finally {
      setAtsBusy(false);
    }
  }

  async function createFromProfile() {
    if (!newLabel.trim()) return;
    setCreating(true);
    setError('');
    try {
      const created = await resumesApi.create({ label: newLabel.trim() });
      setNewLabel('');
      await load();
      select(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create résumé');
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    setError('');
    try {
      await resumesApi.update(selectedId, { label: draftLabel.trim(), contentMd: draft });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save résumé');
    } finally {
      setSaving(false);
    }
  }

  // MOM-136/137/138. The envelope's ok:false is the dormant-until-key path, so it
  // renders as a banner (setAiReason), not as an error.
  async function runAi(kind: 'analyze' | 'rewrite' | 'cover-letter') {
    if (!selectedId) return;
    if (kind !== 'analyze' && !jdText.trim()) return;
    setAiBusy(true);
    setAiReason('');
    setError('');
    try {
      if (kind === 'analyze') {
        const res = await resumesApi.aiAnalyze(selectedId, targetJobId || undefined);
        if (res.ok) setAnalysis(res.result); else setAiReason(res.reason);
      } else if (kind === 'rewrite') {
        const res = await resumesApi.aiRewrite(selectedId, jdText.trim());
        if (res.ok) setRewrites(res.result.rewrites); else setAiReason(res.reason);
      } else {
        const res = await resumesApi.aiCoverLetter(selectedId, jdText.trim());
        if (res.ok) setCoverLetter(res.result); else setAiReason(res.reason);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setAiBusy(false);
    }
  }

  // Accepting a rewrite is deterministic and local: swap the original bullet for
  // the rewritten one in the draft, then Save persists it.
  function acceptRewrite(rewrite: ResumeBulletRewrite) {
    setDraft((current) => (current.includes(rewrite.original) ? current.replace(rewrite.original, rewrite.rewritten) : current));
    setRewrites((current) => (current ?? []).filter((item) => item.original !== rewrite.original));
  }

  async function download(id: string, format: 'md' | 'pdf') {
    setError('');
    try {
      await resumesApi.download(id, format);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export résumé');
    }
  }

  async function remove(id: string) {
    setError('');
    try {
      await resumesApi.remove(id);
      if (selectedId === id) { setSelectedId(null); setDraft(''); setDraftLabel(''); }
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete résumé');
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  const selected = versions.find((version) => version.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Résumé versions</h1>
        <p className="mt-1 text-sm text-zinc-500">Tailored résumés derived from your profile — one per target, editable in Markdown.</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <Card>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-500">New version label</label>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Google-tailored v1" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          </div>
          <button onClick={createFromProfile} disabled={creating || !newLabel.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {creating ? 'Creating…' : 'Duplicate from profile'}
          </button>
        </div>
      </Card>

      {versions.length === 0 ? (
        <EmptyState icon="📄" title="No résumé versions" description="Create your first version from your profile above." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {versions.map((version) => (
              <button key={version.id} onClick={() => select(version)} className={`w-full rounded-lg border p-3 text-left ${version.id === selectedId ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/40' : 'border-zinc-200 dark:border-zinc-700'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">{version.label}</span>
                  <span onClick={(e) => { e.stopPropagation(); remove(version.id); }} className="text-xs text-zinc-400 hover:text-rose-600" role="button" aria-label={`Delete ${version.label}`}>✕</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
                  {version.targetRoleTrackId && <span>{CAREER_ROLE_TRACKS[version.targetRoleTrackId as CareerRoleTrackId]?.label ?? version.targetRoleTrackId}</span>}
                  {version.company && <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{version.company}</span>}
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <Card>
              <input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={22} spellCheck={false} className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button onClick={save} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={() => download(selected.id, 'md')} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">Export .md</button>
                <button onClick={() => download(selected.id, 'pdf')} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">Export .pdf</button>
                <span className="text-xs text-zinc-400">Markdown · {draft.length} chars</span>
              </div>

              <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <label className="block text-xs font-medium text-zinc-500">ATS keyword coverage — paste a job description</label>
                <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={4} placeholder="Paste the JD to see which keywords this résumé already covers…" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button onClick={checkAts} disabled={atsBusy || !jdText.trim()} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">{atsBusy ? 'Checking…' : 'Check coverage'}</button>
                  {ats && ats.missing.length > 0 && (
                    <button onClick={generateAtsTasks} disabled={atsBusy} className="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300">Add missing to tasks</button>
                  )}
                  {atsMsg && <span className="text-xs text-emerald-600 dark:text-emerald-400">{atsMsg}</span>}
                </div>
                {ats && (
                  <div className="mt-3 space-y-2 text-xs">
                    <p className="font-medium text-zinc-700 dark:text-zinc-200">{Math.round(ats.coveragePct * 100)}% of {ats.jdKeywordCount} JD keywords covered by this résumé</p>
                    {ats.missing.length > 0 && (
                      <div>
                        <span className="text-zinc-500">Missing: </span>
                        {ats.missing.map((kw) => <span key={kw} className="mr-1 mb-1 inline-block rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{kw}</span>)}
                      </div>
                    )}
                    {ats.covered.length > 0 && (
                      <div>
                        <span className="text-zinc-500">Covered: </span>
                        {ats.covered.map((kw) => <span key={kw} className="mr-1 mb-1 inline-block rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{kw}</span>)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <p className="text-xs font-medium text-zinc-500">AI tailoring</p>
                {/* MOM-149: a critique is only as good as the target it's held against. */}
                <label className="mt-2 block text-xs text-zinc-500 dark:text-zinc-400">
                  Judge against a specific application
                  <select
                    value={targetJobId}
                    onChange={(e) => setTargetJobId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">No specific job — generic critique</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.roleTitle} · {j.companyRef?.name ?? j.company}</option>
                    ))}
                  </select>
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button onClick={() => runAi('analyze')} disabled={aiBusy} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">Analyze bullets</button>
                  <button onClick={() => runAi('rewrite')} disabled={aiBusy || !jdText.trim()} title={jdText.trim() ? undefined : 'Paste a JD above first'} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">Rewrite for this JD</button>
                  <button onClick={() => runAi('cover-letter')} disabled={aiBusy || !jdText.trim()} title={jdText.trim() ? undefined : 'Paste a JD above first'} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">Draft cover letter</button>
                  {aiBusy && <Spinner className="h-4 w-4" />}
                </div>

                {aiReason && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{aiReason}</p>
                )}

                {analysis && (
                  <div className="mt-3 space-y-2 text-xs">
                    <p className="text-zinc-700 dark:text-zinc-200">{analysis.overallImpression}</p>
                    {analysis.bulletFeedback.map((item) => (
                      <div key={item.original} className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                        <p className="font-mono text-[11px] text-zinc-500">{item.original}</p>
                        <p className="mt-1 text-zinc-700 dark:text-zinc-200">Impact {item.impactScore}/5 · reads as {item.senioritySignal} — {item.issue}</p>
                        <p className="mt-0.5 text-emerald-700 dark:text-emerald-400">{item.suggestion}</p>
                      </div>
                    ))}
                    {analysis.missingThemes.length > 0 && (
                      <p className="text-zinc-500">Missing themes: {analysis.missingThemes.join(', ')}</p>
                    )}
                  </div>
                )}

                {rewrites && rewrites.length > 0 && (
                  <div className="mt-3 space-y-2 text-xs">
                    {rewrites.map((item) => (
                      <div key={item.original} className="rounded-lg border border-indigo-200 p-2 dark:border-indigo-800">
                        <p className="font-mono text-[11px] text-zinc-500 line-through">{item.original}</p>
                        <p className="mt-1 text-zinc-800 dark:text-zinc-100">{item.rewritten}</p>
                        <p className="mt-0.5 text-zinc-500">{item.rationale}</p>
                        <div className="mt-1.5 flex gap-2">
                          <button onClick={() => acceptRewrite(item)} className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white">Accept</button>
                          <button onClick={() => setRewrites((current) => (current ?? []).filter((r) => r.original !== item.original))} className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">Reject</button>
                        </div>
                      </div>
                    ))}
                    <p className="text-zinc-400">Accepting patches the draft above — press Save to keep it.</p>
                  </div>
                )}

                {coverLetter && (
                  <div className="mt-3 space-y-2 text-xs">
                    <pre className="whitespace-pre-wrap rounded-lg border border-zinc-200 p-2 font-mono text-[11px] text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">{coverLetter.draftMarkdown}</pre>
                    <p className="text-zinc-500">Visa framing (optional): {coverLetter.visaFramingParagraph}</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
