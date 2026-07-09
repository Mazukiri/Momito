'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CompanyResponse, VisaTag } from '@momito/shared';
import { companiesApi } from '../../lib/api-client';
import { Badge, Card, EmptyState, ErrorBanner, Spinner } from '../../components/ui';

const areaLabel = (id: string) => id.replace(/_/g, ' ');

// MOM-124: null sponsorship (no data) and explicit 'unknown' share one filter bucket.
const sponsorshipKey = (status: VisaTag | null): VisaTag => status ?? 'unknown';
const SPONSORSHIP_FILTERS: { key: 'all' | VisaTag; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sponsored', label: 'Sponsors visas' },
  { key: 'unknown', label: 'Unknown' },
  { key: 'not_sponsoring', label: 'No sponsorship' },
];

function SponsorshipBadge({ status }: { status: CompanyResponse['sponsorshipStatus'] }) {
  if (status === 'sponsored') return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">Sponsors visas</span>;
  if (status === 'not_sponsoring') return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-400">No sponsorship</span>;
  return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">Sponsorship unknown</span>;
}

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sponsorshipFilter, setSponsorshipFilter] = useState<'all' | VisaTag>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCompanies(await companiesApi.list());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Companies</h1>
        <p className="mt-1 text-sm text-zinc-500">The target catalog — interview focus, sponsorship, and linked prep for each company.</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {companies.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {SPONSORSHIP_FILTERS.map(({ key, label }) => {
            const count = key === 'all' ? companies.length : companies.filter((c) => sponsorshipKey(c.sponsorshipStatus) === key).length;
            if (key !== 'all' && count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setSponsorshipFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  sponsorshipFilter === key ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {companies.length === 0 ? (
        <EmptyState icon="🏢" title="No companies" description="The company catalog is empty." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies
            .filter((company) => sponsorshipFilter === 'all' || sponsorshipKey(company.sponsorshipStatus) === sponsorshipFilter)
            .map((company) => {
            const topAreas = Object.entries(company.focusAreas).sort((a, b) => b[1] - a[1]).slice(0, 3);
            return (
              <button key={company.id} onClick={() => router.push(`/companies/${company.id}`)} className="text-left">
                <Card className="h-full transition-colors hover:border-indigo-400 dark:hover:border-indigo-500">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">{company.name}</h2>
                    {company.region && <Badge label={company.region} />}
                  </div>
                  <div className="mt-2"><SponsorshipBadge status={company.sponsorshipStatus} /></div>
                  {topAreas.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {topAreas.map(([area]) => (
                        <span key={area} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs capitalize text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{areaLabel(area)}</span>
                      ))}
                    </div>
                  )}
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
