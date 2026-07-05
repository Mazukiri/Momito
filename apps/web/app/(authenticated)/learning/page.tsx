'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CAREER_ROLE_AREA_IDS, CAREER_ROLE_TRACKS, type LearningEvidenceResponse, type ReadwiseConnectionResponse } from '@momito/shared';
import { learningApi } from '../../lib/api-client';
import { Card, ErrorBanner, Spinner } from '../../components/ui';

export default function LearningPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const missionId = searchParams.get('missionId') || undefined;
  const [connection, setConnection] = useState<ReadwiseConnectionResponse | null>(null);
  const [ledger, setLedger] = useState<LearningEvidenceResponse[]>([]);
  const [token, setToken] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [roleTrackId, setRoleTrackId] = useState('big-tech-swe');
  const [area, setArea] = useState('cs_fundamentals');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [readwise, evidence] = await Promise.all([
        learningApi.readwiseConnection(),
        learningApi.ledger({ missionId }),
      ]);
      setConnection(readwise);
      setLedger(evidence);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load learning ledger');
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    try {
      await learningApi.connectReadwise(token.trim());
      setToken('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect Readwise');
    } finally {
      setWorking(false);
    }
  }

  async function sync() {
    setWorking(true);
    try {
      await learningApi.syncReadwise();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sync Readwise');
    } finally {
      setWorking(false);
    }
  }

  async function addEvidence(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    try {
      await learningApi.createEvidence({
        type: 'manual_note',
        title: title.trim(),
        body: body.trim() || null,
        roleTrackId,
        area,
        missionId: missionId ?? null,
      });
      setTitle('');
      setBody('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add evidence');
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Learning Ledger</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {missionId ? 'Evidence is filtered to the active mission so learning stays tied to one target.' : 'A permanent record of what you read, practiced, built, and learned.'}
          </p>
        </div>
        <button onClick={() => router.push('/learning/inbox')} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
          Reading Inbox
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Readwise</h2>
            <p className="text-sm text-zinc-500">
              Status: <span className="font-medium text-zinc-700 dark:text-zinc-300">{connection?.status ?? 'not connected'}</span>
            </p>
            {connection?.lastSyncedAt && <p className="mt-1 text-xs text-zinc-400">Last sync {new Date(connection.lastSyncedAt).toLocaleString()}</p>}
            <form onSubmit={connect} className="mt-4 space-y-3">
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Readwise access token"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button disabled={working || !token.trim()} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Connect</button>
            </form>
            <button onClick={sync} disabled={working || !connection?.hasToken} className="mt-3 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
              Sync Now
            </button>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">Add Evidence</h2>
            <form onSubmit={addEvidence} className="space-y-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="What did you learn?" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <select value={roleTrackId} onChange={(event) => setRoleTrackId(event.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                {Object.values(CAREER_ROLE_TRACKS).map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}
              </select>
              <select value={area} onChange={(event) => setArea(event.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                {CAREER_ROLE_AREA_IDS.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
              </select>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} placeholder="Notes" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <button disabled={working || !title.trim()} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Add</button>
            </form>
          </Card>
        </aside>

        <div className="space-y-3">
          {ledger.length === 0 ? (
            <Card><p className="text-sm text-zinc-500">No learning evidence yet.</p></Card>
          ) : ledger.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">{item.title}</h2>
                  <p className="mt-1 text-sm text-zinc-500">{item.type} {item.area ? `- ${item.area.replaceAll('_', ' ')}` : ''}{item.missionId ? ' - mission linked' : ''}</p>
                </div>
                <span className="text-xs text-zinc-400">{new Date(item.occurredAt).toLocaleDateString()}</span>
              </div>
              {item.body && <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-600">{item.body}</p>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
