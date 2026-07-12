'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CAREER_ROLE_AREA_IDS,
  CAREER_ROLE_TRACKS,
  type LearningHighlightResponse,
} from '@momito/shared';
import { learningApi } from '../../../lib/api-client';
import { Card, EmptyState, ErrorBanner, Spinner } from '../../../components/ui';

export default function LearningInboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<LearningHighlightResponse[]>([]);
  const [roleTrackId, setRoleTrackId] = useState('big-tech-swe');
  const [area, setArea] = useState('cs_fundamentals');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await learningApi.inbox());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reading inbox');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  async function review(id: string, usefulness: string) {
    setWorkingId(id);
    try {
      await learningApi.updateHighlight(id, { roleTrackId, area, reviewed: true, usefulness });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update highlight');
    } finally {
      setWorkingId(null);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button onClick={() => router.push('/learning')} className="mb-3 text-sm font-medium text-indigo-600">Back to ledger</button>
          <h1 className="text-2xl font-bold text-zinc-800">Reading Inbox</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tag a highlight, then <span className="font-medium text-zinc-700">Remember</span> it to drop it into
            your spaced-repetition queue — it will resurface on Today until it sticks. Ignore just files it.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={roleTrackId} onChange={(event) => setRoleTrackId(event.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
            {Object.values(CAREER_ROLE_TRACKS).map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}
          </select>
          <select value={area} onChange={(event) => setArea(event.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
            {CAREER_ROLE_AREA_IDS.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {items.length === 0 ? (
        <EmptyState icon="READ" title="Inbox clear" description="Sync Readwise or add manual evidence when you learn something new." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-800">{item.source?.title ?? 'Untitled source'}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">{item.text}</p>
                  {item.note && <p className="mt-2 text-sm text-zinc-500">Note: {item.note}</p>}
                </div>
                <div className="flex shrink-0 gap-2 sm:flex-col">
                  <button
                    onClick={() => review(item.id, 'useful')}
                    disabled={workingId === item.id}
                    title="File as evidence and add to your spaced-repetition review queue"
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Remember
                  </button>
                  <button
                    onClick={() => review(item.id, 'ignored')}
                    disabled={workingId === item.id}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 disabled:opacity-50"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
