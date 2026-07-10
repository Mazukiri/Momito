'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CAREER_ROLE_TRACKS, JOB_APPLICATION_STATUSES, type AtsCoverageResponse, type CareerRoleTrackId, type CompanyResponse, type JobApplicationResponse, type JobFunnelResponse, type VisaTag } from '@momito/shared';
import { companiesApi, jobsApi, profileScoresApi } from '../../lib/api-client';
import { Badge, Card, EmptyState, ErrorBanner, Spinner } from '../../components/ui';
import { JobFunnelCard } from '../../components/JobFunnelCard';

// MOM-124: a job's sponsorship signal prefers the linked catalog company, falling
// back to the job's own visaTag; null/absent = 'unknown'. Sponsored sorts first.
const jobSponsorship = (job: JobApplicationResponse): VisaTag =>
  job.companyRef?.sponsorshipStatus ?? job.visaTag ?? 'unknown';
const SPONSORSHIP_RANK: Record<VisaTag, number> = { sponsored: 0, unknown: 1, not_sponsoring: 2 };
const SPONSORSHIP_FILTERS: { key: 'all' | VisaTag; label: string }[] = [
  { key: 'all', label: 'All visas' },
  { key: 'sponsored', label: 'Sponsors' },
  { key: 'unknown', label: 'Unknown' },
  { key: 'not_sponsoring', label: 'No sponsorship' },
];

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobApplicationResponse[]>([]);
  const [funnel, setFunnel] = useState<JobFunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [url, setUrl] = useState('');
  const [roleTrackId, setRoleTrackId] = useState<CareerRoleTrackId>('big-tech-swe');
  const [deadline, setDeadline] = useState('');
  const [jdText, setJdText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JobApplicationResponse['status']>('all');
  const [sponsorshipFilter, setSponsorshipFilter] = useState<'all' | VisaTag>('all');
  const [ats, setAts] = useState<AtsCoverageResponse | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);
  // MOM-122: catalog for the company-link datalist. Typing a name that matches a
  // catalog company (case-insensitive) links it; anything else stays free text.
  const [companies, setCompanies] = useState<CompanyResponse[]>([]);

  async function checkAts() {
    if (!jdText.trim()) return;
    setAtsLoading(true);
    try {
      setAts(await profileScoresApi.atsCoverage(jdText.trim()));
    } catch {
      setAts(null);
    } finally {
      setAtsLoading(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [jobList, funnelData, companyList] = await Promise.all([jobsApi.list(), jobsApi.funnel(), companiesApi.list()]);
      setJobs(jobList);
      setFunnel(funnelData);
      setCompanies(companyList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  async function createJob(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      // Link to the catalog when the typed name matches a company exactly (ci).
      const match = companies.find((item) => item.name.trim().toLowerCase() === company.trim().toLowerCase());
      await jobsApi.create({
        company: company.trim(),
        companyId: match?.id ?? null,
        roleTitle: roleTitle.trim(),
        url: url.trim() || null,
        roleTrackId,
        deadline: deadline || null,
        jdText: jdText.trim() || null,
        status: 'saved',
      });
      setCompany('');
      setRoleTitle('');
      setUrl('');
      setDeadline('');
      setJdText('');
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Jobs</h1>
          <p className="mt-1 text-sm text-zinc-500">Track applications, deadlines, JD gaps, and prep work.</p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          {showForm ? 'Close' : 'Add Job'}
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {funnel && funnel.total > 0 && <JobFunnelCard funnel={funnel} />}

      {jobs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            All ({jobs.length})
          </button>
          {JOB_APPLICATION_STATUSES.map((status) => {
            const count = jobs.filter((job) => job.status === status).length;
            if (count === 0) return null;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  statusFilter === status ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {status} ({count})
              </button>
            );
          })}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {SPONSORSHIP_FILTERS.map(({ key, label }) => {
            const count = key === 'all' ? jobs.length : jobs.filter((job) => jobSponsorship(job) === key).length;
            if (key !== 'all' && count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setSponsorshipFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  sponsorshipFilter === key ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {showForm && (
        <Card>
          <form onSubmit={createJob} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Company</label>
                <input value={company} onChange={(event) => setCompany(event.target.value)} required list="company-catalog" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                <datalist id="company-catalog">
                  {companies.map((item) => <option key={item.id} value={item.name} />)}
                </datalist>
                {companies.some((item) => item.name.trim().toLowerCase() === company.trim().toLowerCase()) && (
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">✓ Links to the catalog — sponsorship &amp; focus data will attach.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Role</label>
                <input value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} required className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Role Track</label>
                <select value={roleTrackId} onChange={(event) => setRoleTrackId(event.target.value as CareerRoleTrackId)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                  {Object.values(CAREER_ROLE_TRACKS).map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Deadline</label>
                <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">URL</label>
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Job Description</label>
              <textarea value={jdText} onChange={(event) => { setJdText(event.target.value); setAts(null); }} rows={6} placeholder="Paste the JD to check which keywords your profile is missing…" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <div className="mt-2 flex items-center gap-3">
                <button type="button" onClick={checkAts} disabled={atsLoading || !jdText.trim()} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  {atsLoading ? 'Checking…' : 'Check ATS keyword coverage'}
                </button>
                {ats && (
                  <span className="text-xs text-zinc-500">
                    {Math.round(ats.coveragePct * 100)}% of {ats.jdKeywordCount} JD keyword{ats.jdKeywordCount === 1 ? '' : 's'} in your profile
                  </span>
                )}
              </div>
              {ats && ats.missing.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ats.missing.slice(0, 20).map((keyword) => (
                    <span key={keyword} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button disabled={saving || !company.trim() || !roleTitle.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Job'}
            </button>
          </form>
        </Card>
      )}

      {jobs.length === 0 ? (
        <EmptyState icon="JOB" title="No jobs yet" description="Add a target job to connect JD gaps, prep tasks, and reminders." />
      ) : (
        <div className="grid gap-3">
          {jobs
            .filter((job) => statusFilter === 'all' || job.status === statusFilter)
            .filter((job) => sponsorshipFilter === 'all' || jobSponsorship(job) === sponsorshipFilter)
            .slice()
            .sort((a, b) => SPONSORSHIP_RANK[jobSponsorship(a)] - SPONSORSHIP_RANK[jobSponsorship(b)])
            .map((job) => (
            <Card key={job.id} onClick={() => router.push(`/jobs/${job.id}`)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">{job.company}</h2>
                  <p className="text-sm text-zinc-500">{job.roleTitle}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge label={job.status} variant={job.status} />
                    {job.roleTrackId && <Badge label={CAREER_ROLE_TRACKS[job.roleTrackId].label} />}
                    {job.visaTag && <Badge label={`visa: ${job.visaTag}`} />}
                    {job.isStalled && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400" title="No movement past this stage's threshold">
                        ⏳ Stalled · {job.daysInStage}d
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-zinc-500">
                  {job.deadline ? `Deadline ${new Date(job.deadline).toLocaleDateString()}` : 'No deadline'}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
