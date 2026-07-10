'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { OfferResponse } from '@momito/shared';
import { offersApi } from '../../lib/api-client';
import { Card, EmptyState, ErrorBanner, Spinner } from '../../components/ui';

const money = (value: number | null, currency: string) =>
  value === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

export default function OffersPage() {
  const [offers, setOffers] = useState<OfferResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOffers(await offersApi.list());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  // Compare by the normalized annual total, richest first (nulls last).
  const ranked = [...offers].sort((a, b) => (b.normalizedAnnualTotal ?? -1) - (a.normalizedAnnualTotal ?? -1));
  const multiCurrency = new Set(offers.map((offer) => offer.currency)).size > 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Offers</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Compare offers by normalized annual comp (base + bonus + equity ÷ vesting years).
          {multiCurrency && <span className="text-amber-600 dark:text-amber-400"> Totals are shown in each offer&apos;s own currency — no FX conversion.</span>}
        </p>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {offers.length === 0 ? (
        <EmptyState icon="💰" title="No offers yet" description="Add an offer from a job's detail page to compare compensation." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-700">
                <th className="py-2 pr-4">Company</th>
                <th className="py-2 pr-4 text-right">Annual</th>
                <th className="py-2 pr-4 text-right">Base</th>
                <th className="py-2 pr-4 text-right">Bonus</th>
                <th className="py-2 pr-4 text-right">Equity</th>
                <th className="py-2 pr-4">Visa</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((offer) => (
                <tr key={offer.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="py-2 pr-4 font-medium text-zinc-800 dark:text-zinc-100">
                    {offer.jobApplicationId ? <Link href={`/jobs/${offer.jobApplicationId}`} className="hover:text-indigo-600">{offer.company ?? 'Offer'}</Link> : (offer.company ?? 'Offer')}
                  </td>
                  <td className="py-2 pr-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">{money(offer.normalizedAnnualTotal, offer.currency)}</td>
                  <td className="py-2 pr-4 text-right text-zinc-500">{money(offer.baseSalary, offer.currency)}</td>
                  <td className="py-2 pr-4 text-right text-zinc-500">{money(offer.bonus, offer.currency)}</td>
                  <td className="py-2 pr-4 text-right text-zinc-500">{money(offer.equityTotal, offer.currency)}</td>
                  <td className="py-2 pr-4">{offer.visaSponsored === null ? '—' : offer.visaSponsored ? '✅' : '❌'}</td>
                  <td className="py-2 pr-4"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{offer.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
