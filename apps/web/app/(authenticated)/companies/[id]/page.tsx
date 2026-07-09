'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CAREER_ROLE_TRACKS, INTERVIEW_ROUND_TYPE_LABELS, type CompanyResponse, type InterviewRoundType } from '@momito/shared';
import { companiesApi } from '../../../lib/api-client';
import { Card, ErrorBanner, Spinner } from '../../../components/ui';

const areaLabel = (id: string) => id.replace(/_/g, ' ');
const roundLabel = (t: string) => INTERVIEW_ROUND_TYPE_LABELS[t as InterviewRoundType] ?? t;
const trackLabel = (id: string) => CAREER_ROLE_TRACKS[id as keyof typeof CAREER_ROLE_TRACKS]?.label ?? id;

function SponsorshipBadge({ status }: { status: CompanyResponse['sponsorshipStatus'] }) {
  if (status === 'sponsored') return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">Sponsors visas</span>;
  if (status === 'not_sponsoring') return <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-400">No sponsorship</span>;
  return <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">Sponsorship unknown</span>;
}

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<CompanyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCompany(await companiesApi.get(params.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load company');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!company) return null;

  const focus = Object.entries(company.focusAreas).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => router.push('/companies')} className="mb-3 text-sm font-medium text-indigo-600 dark:text-indigo-400">← Companies</button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{company.name}</h1>
          <SponsorshipBadge status={company.sponsorshipStatus} />
          {company.region && <span className="text-sm text-zinc-500">{company.region}</span>}
        </div>
        {company.compBand && <p className="mt-1 text-sm text-zinc-500">Comp band: {company.compBand}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Interview focus</h2>
            {focus.length === 0 ? (
              <p className="text-sm text-zinc-500">No focus weights recorded.</p>
            ) : (
              <div className="space-y-2">
                {focus.map(([area, weight]) => (
                  <div key={area} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-sm capitalize text-zinc-600 dark:text-zinc-300">{areaLabel(area)}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(weight / 5) * 100}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs text-zinc-400">{weight}/5</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {company.interviewProcess.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Interview process</h2>
              <ol className="space-y-2">
                {company.interviewProcess.map((stage, index) => (
                  <li key={index} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{index + 1}</span>
                    <div>
                      <span className="font-medium text-zinc-800 dark:text-zinc-100">{stage.label}</span>
                      <span className="ml-2 text-xs text-zinc-400">{roundLabel(stage.roundType)}</span>
                      {stage.notes && <p className="text-zinc-500">{stage.notes}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {company.notes && (
            <Card>
              <h2 className="mb-2 font-semibold text-zinc-800 dark:text-zinc-100">Notes</h2>
              <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{company.notes}</p>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {company.roleTrackIds.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Role tracks</h2>
              <div className="flex flex-wrap gap-1.5">
                {company.roleTrackIds.map((id) => (
                  <span key={id} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{trackLabel(id)}</span>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Linked prep</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{company.linkedQuestionCount ?? 0} tagged question{company.linkedQuestionCount === 1 ? '' : 's'}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{company.linkedStoryCount ?? 0} tagged stor{company.linkedStoryCount === 1 ? 'y' : 'ies'}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
