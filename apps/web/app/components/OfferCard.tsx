'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { OFFER_STATUSES, type OfferResponse, type OfferStatus } from '@momito/shared';
import { offersApi } from '../lib/api-client';
import { Card, Spinner } from './ui';

const money = (value: number | null, currency: string) =>
  value === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

// MOM-114/115: the single offer for a job — capture comp + status, see the
// normalized annual total. One offer per application.
export function OfferCard({ jobId }: { jobId: string }) {
  const [offer, setOffer] = useState<OfferResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [base, setBase] = useState('');
  const [bonus, setBonus] = useState('');
  const [equityTotal, setEquityTotal] = useState('');
  const [equityYears, setEquityYears] = useState('4');
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState<OfferStatus>('received');

  const hydrate = useCallback((data: OfferResponse | null) => {
    setOffer(data);
    setBase(data?.baseSalary != null ? String(data.baseSalary) : '');
    setBonus(data?.bonus != null ? String(data.bonus) : '');
    setEquityTotal(data?.equityTotal != null ? String(data.equityTotal) : '');
    setEquityYears(String(data?.equityYears ?? 4));
    setCurrency(data?.currency ?? 'USD');
    setStatus(data?.status ?? 'received');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      hydrate(await offersApi.getForJob(jobId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load offer');
    } finally {
      setLoading(false);
    }
  }, [jobId, hydrate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const parse = (value: string) => (value.trim() === '' ? null : Number(value));
      const updated = await offersApi.upsertForJob(jobId, {
        baseSalary: parse(base),
        bonus: parse(bonus),
        equityTotal: parse(equityTotal),
        equityYears: Number(equityYears) || 4,
        currency: currency.trim().toUpperCase() || 'USD',
        status,
      });
      hydrate(updated);
      setEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save offer');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setError('');
    try {
      await offersApi.removeForJob(jobId);
      hydrate(null);
      setEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove offer');
    }
  }

  if (loading) return <Card><div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div></Card>;

  const inputCls = 'w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Offer</h2>
        {!editing && <button onClick={() => setEditing(true)} className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{offer ? 'Edit' : '+ Add'}</button>}
      </div>

      {error && <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-500">Base<input value={base} onChange={(e) => setBase(e.target.value)} type="number" min="0" className={inputCls} /></label>
            <label className="text-xs text-zinc-500">Bonus<input value={bonus} onChange={(e) => setBonus(e.target.value)} type="number" min="0" className={inputCls} /></label>
            <label className="text-xs text-zinc-500">Equity (total)<input value={equityTotal} onChange={(e) => setEquityTotal(e.target.value)} type="number" min="0" className={inputCls} /></label>
            <label className="text-xs text-zinc-500">Vesting yrs<input value={equityYears} onChange={(e) => setEquityYears(e.target.value)} type="number" min="1" max="10" className={inputCls} /></label>
            <label className="text-xs text-zinc-500">Currency<input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} className={inputCls} /></label>
            <label className="text-xs text-zinc-500">Status
              <select value={status} onChange={(e) => setStatus(e.target.value as OfferStatus)} className={inputCls}>
                {OFFER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button disabled={saving} className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { hydrate(offer); setEditing(false); }} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">Cancel</button>
            {offer && <button type="button" onClick={remove} className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm text-rose-600 dark:border-rose-800">Delete</button>}
          </div>
        </form>
      ) : offer ? (
        <div className="space-y-1 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-zinc-500">Annual (normalized)</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{money(offer.normalizedAnnualTotal, offer.currency)}</span>
          </div>
          <div className="flex justify-between text-xs text-zinc-500"><span>Base</span><span>{money(offer.baseSalary, offer.currency)}</span></div>
          <div className="flex justify-between text-xs text-zinc-500"><span>Bonus</span><span>{money(offer.bonus, offer.currency)}</span></div>
          <div className="flex justify-between text-xs text-zinc-500"><span>Equity ÷ {offer.equityYears}y</span><span>{money(offer.equityTotal, offer.currency)}</span></div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{offer.status}</span>
            <a href="/offers" className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Compare all →</a>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">No offer recorded.</p>
      )}
    </Card>
  );
}
