'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CAREER_ROLE_TRACKS, type AtsCoverageResponse, type CareerRoleTrackId, type CoverLetterDraftResult, type JobApplicationResponse, type JobFunnelBreakdownRow, type ResumeAnalysisResult, type ResumeBulletRewrite, type ResumeDriftResponse, type ResumeVersionResponse } from '@momito/shared';
import { jobsApi, profileScoresApi, resumesApi } from '../../../lib/api-client';
import { Card, EmptyState, ErrorBanner, Spinner } from '../../../components/ui';

export default function ResumesPage() {
  const wantVersionId = useSearchParams().get('v') ?? undefined; // MOM-157: deep-link target
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
  const [themeMsg, setThemeMsg] = useState('');
  const [rewriteMsg, setRewriteMsg] = useState(''); // MOM-154: accept/reject feedback
  // MOM-155: what the profile has gained since this version was cut from it.
  const [drift, setDrift] = useState<ResumeDriftResponse | null>(null);
  // MOM-152: which résumé actually converts. MOM-145's funnel already computes this per
  // version label — surfacing it here closes the loop: analyse → rewrite → send → measure.
  const [performance, setPerformance] = useState<JobFunnelBreakdownRow[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiReason, setAiReason] = useState('');
  const [analysis, setAnalysis] = useState<ResumeAnalysisResult | null>(null);
  const [rewrites, setRewrites] = useState<ResumeBulletRewrite[] | null>(null);
  const [coverLetter, setCoverLetter] = useState<CoverLetterDraftResult | null>(null);

  // MOM-153: tailoring needs *a* job description — pasted, or already stored on a picked
  // application. (If the picked application has no JD saved, the API says so in its banner.)
  const hasTarget = Boolean(jdText.trim() || targetJobId);

  // MOM-155: silent if it fails — drift is a nice-to-know, never a reason to break the editor.
  const loadDrift = useCallback(async (versionId: string) => {
    try {
      setDrift(await resumesApi.drift(versionId));
    } catch {
      setDrift(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, jobList, funnel] = await Promise.all([resumesApi.list(), jobsApi.list(), jobsApi.funnel()]);
      setVersions(list);
      setJobs(jobList);
      setPerformance(funnel.byResumeVersion);
      if (list.length > 0 && selectedId === null) {
        // MOM-157: a Today drift card deep-links `?v=<id>` to land on the exact stale version;
        // fall back to the first version when the param is absent or points at a deleted one.
        const initial = list.find((v) => v.id === wantVersionId) ?? list[0];
        setSelectedId(initial.id);
        setDraft(initial.contentMd);
        setDraftLabel(initial.label);
        setRewrites(initial.aiSuggestions.length > 0 ? initial.aiSuggestions : null); // MOM-154
        void loadDrift(initial.id); // MOM-155
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load résumés');
    } finally {
      setLoading(false);
    }
  }, [selectedId, loadDrift, wantVersionId]);

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
    // MOM-154: the AI's rewrites are stored on the version (MOM-137 writes them there), so a
    // reload no longer throws them away — outstanding suggestions come back with the résumé.
    setRewrites(version.aiSuggestions.length > 0 ? version.aiSuggestions : null);
    setCoverLetter(null);
    setAiReason('');
    setRewriteMsg('');
    setDrift(null);
    void loadDrift(version.id);
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
      // MOM-154: the applied text and the shrunken suggestion list are one write — so an
      // accepted rewrite can never resurface, and an unsaved one is not lost.
      await resumesApi.update(selectedId, {
        label: draftLabel.trim(),
        contentMd: draft,
        aiSuggestions: rewrites ?? [],
      });
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
    if (kind !== 'analyze' && !hasTarget) return;
    setAiBusy(true);
    setAiReason('');
    setRewriteMsg('');
    setError('');
    try {
      // MOM-153: a rewrite/cover letter takes the pasted JD if there is one, else the JD already
      // stored on the picked application — which also carries its company's focus areas.
      const target = { jdText: jdText.trim() || undefined, jobApplicationId: targetJobId || undefined };
      if (kind === 'analyze') {
        const res = await resumesApi.aiAnalyze(selectedId, targetJobId || undefined);
        if (res.ok) setAnalysis(res.result); else setAiReason(res.reason);
      } else if (kind === 'rewrite') {
        const res = await resumesApi.aiRewrite(selectedId, target);
        if (res.ok) setRewrites(res.result.rewrites); else setAiReason(res.reason);
      } else {
        const res = await resumesApi.aiCoverLetter(selectedId, target);
        if (res.ok) setCoverLetter(res.result); else setAiReason(res.reason);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setAiBusy(false);
    }
  }

  // MOM-151: turn the AI's missing themes into study tasks. No model call — the findings exist.
  async function themesToTasks() {
    if (!selectedId || !analysis) return;
    setAiBusy(true);
    setThemeMsg('');
    try {
      const { created } = await resumesApi.aiThemesToTasks(selectedId, analysis.missingThemes.slice(0, 8));
      setThemeMsg(created > 0 ? `Added ${created} task${created === 1 ? '' : 's'}.` : 'Already tracked.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create tasks');
    } finally {
      setAiBusy(false);
    }
  }

  // Accepting a rewrite is deterministic and local: swap the original bullet for
  // the rewritten one in the draft, then Save persists it.
  // MOM-154: if the bullet is no longer in the draft (the user edited it since), the swap would
  // be a no-op — so say so and KEEP the suggestion, instead of quietly retiring a button press
  // that changed nothing. (MOM-153 fixed the model-side cause; this is the user-side one.)
  function acceptRewrite(rewrite: ResumeBulletRewrite) {
    if (!draft.includes(rewrite.original)) {
      setRewriteMsg('That bullet is no longer in the draft — re-run the rewrite to refresh it.');
      return;
    }
    setDraft(draft.replace(rewrite.original, rewrite.rewritten));
    setRewrites((current) => (current ?? []).filter((item) => item.original !== rewrite.original));
    setRewriteMsg('Applied to the draft — press Save to keep it.');
  }

  // MOM-154: rejecting is a decision, not a UI toggle — persist it, or the suggestion returns
  // on the next load. Only aiSuggestions is sent, so an unsaved draft edit is left alone.
  async function rejectRewrite(rewrite: ResumeBulletRewrite) {
    const next = (rewrites ?? []).filter((item) => item.original !== rewrite.original);
    setRewrites(next.length > 0 ? next : null);
    setRewriteMsg('');
    if (!selectedId) return;
    try {
      await resumesApi.update(selectedId, { aiSuggestions: next });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss the suggestion');
    }
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
                {/* MOM-152: the only feedback that isn't an opinion — did this résumé convert? */}
                {(() => {
                  const row = performance.find((p) => p.key === version.label);
                  if (!row || row.total === 0) return null;
                  return (
                    <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                      <span className="font-medium">{row.total} sent</span> · {row.interviewing} interviewing · {row.offers} offer{row.offers === 1 ? '' : 's'}
                      {' · '}
                      <span className={row.conversion > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'}>
                        {Math.round(row.conversion * 100)}% conversion
                      </span>
                    </p>
                  );
                })()}
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

              {/* MOM-155: a résumé rots quietly — you ship a project and keep sending the version
                  that predates it. baseProfileSnapshot has always known; nothing ever asked. */}
              {drift?.isStale && (
                <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-700 dark:bg-amber-950/30">
                  <p className="font-medium text-amber-900 dark:text-amber-200">Your profile has moved on since this version was cut.</p>
                  {drift.newExperience.length > 0 && (
                    <p className="mt-1 text-amber-800 dark:text-amber-300"><span className="font-medium">New experience:</span> {drift.newExperience.join(' · ')}</p>
                  )}
                  {drift.newProjects.length > 0 && (
                    <p className="mt-1 text-amber-800 dark:text-amber-300"><span className="font-medium">New projects:</span> {drift.newProjects.join(' · ')}</p>
                  )}
                  {drift.newSkills.length > 0 && (
                    <p className="mt-1 text-amber-800 dark:text-amber-300"><span className="font-medium">New skills:</span> {drift.newSkills.join(', ')}</p>
                  )}
                  <p className="mt-1.5 text-amber-700 dark:text-amber-400">Not on this résumé yet — add what matters for the target, or cut a fresh version from your profile.</p>
                </div>
              )}

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
                {/* MOM-149/153: a critique, a rewrite and a cover letter are each only as good as
                    the target they're held against — this select now drives all three. */}
                <label className="mt-2 block text-xs text-zinc-500 dark:text-zinc-400">
                  Tailor against a specific application
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
                  <button onClick={() => runAi('rewrite')} disabled={aiBusy || !hasTarget} title={hasTarget ? undefined : 'Paste a JD above, or pick an application'} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">Rewrite bullets</button>
                  <button onClick={() => runAi('cover-letter')} disabled={aiBusy || !hasTarget} title={hasTarget ? undefined : 'Paste a JD above, or pick an application'} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">Draft cover letter</button>
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
                      // MOM-151: findings are no longer a dead end — they become study tasks.
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-zinc-500">Missing themes: {analysis.missingThemes.join(', ')}</p>
                        <button
                          onClick={themesToTasks}
                          disabled={aiBusy}
                          className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                        >
                          Add {analysis.missingThemes.length} to study plan
                        </button>
                        {themeMsg && <span className="text-xs text-emerald-700 dark:text-emerald-400">{themeMsg}</span>}
                      </div>
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
                          <button onClick={() => rejectRewrite(item)} className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">Reject</button>
                        </div>
                      </div>
                    ))}
                    <p className="text-zinc-400">Accepting patches the draft above — press Save to keep it. Suggestions are stored with the résumé, so they survive a reload.</p>
                  </div>
                )}

                {/* Outside the list on purpose: accepting the LAST suggestion empties it, and that
                    is precisely when the user most needs to be told the draft changed. */}
                {rewriteMsg && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{rewriteMsg}</p>}

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
