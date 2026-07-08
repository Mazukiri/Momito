'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CAREER_ROLE_AREA_IDS,
  INTERVIEW_ROUND_OUTCOMES,
  INTERVIEW_ROUND_TYPE_LABELS,
  INTERVIEW_ROUND_TYPES,
  MISS_TAG_LABELS,
  MISS_TAG_REASONS,
  type CareerRoleAreaId,
  type InterviewRoundOutcome,
  type InterviewRoundResponse,
  type InterviewRoundType,
  type MissTagReason,
} from '@momito/shared';
import { interviewRoundsApi } from '../lib/api-client';
import { Card } from './ui';

const areaLabel = (id: string) => id.replace(/_/g, ' ');

const OUTCOME_CLASS: Record<InterviewRoundOutcome, string> = {
  pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  passed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  mixed: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  withdrawn: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  unknown: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const inputClass =
  'rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

export function InterviewRoundsCard({ jobId }: { jobId: string }) {
  const [rounds, setRounds] = useState<InterviewRoundResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [roundType, setRoundType] = useState<InterviewRoundType>('technical');
  const [scheduledAt, setScheduledAt] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [openDebrief, setOpenDebrief] = useState<string | null>(null);
  const [prepMessage, setPrepMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRounds(await interviewRoundsApi.list(jobId));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  async function addRound(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await interviewRoundsApi.create(jobId, {
        roundType,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        interviewer: interviewer.trim() || null,
      });
      setScheduledAt('');
      setInterviewer('');
      setShowAdd(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function setOutcome(round: InterviewRoundResponse, outcome: InterviewRoundOutcome) {
    setBusy(true);
    try {
      await interviewRoundsApi.update(jobId, round.id, { outcome });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeRound(id: string) {
    setBusy(true);
    try {
      await interviewRoundsApi.remove(jobId, id);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function generatePrep(id: string) {
    setBusy(true);
    try {
      const { created } = await interviewRoundsApi.generatePrep(jobId, id);
      setPrepMessage(created > 0 ? `Added ${created} prep task${created === 1 ? '' : 's'} — see the calendar.` : 'Prep tasks already exist for this round.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Interview Rounds</h2>
        <button
          onClick={() => setShowAdd((value) => !value)}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {showAdd ? 'Cancel' : 'Add round'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addRound} className="mb-4 grid gap-2 sm:grid-cols-2">
          <select value={roundType} onChange={(event) => setRoundType(event.target.value as InterviewRoundType)} className={inputClass}>
            {INTERVIEW_ROUND_TYPES.map((type) => (
              <option key={type} value={type}>{INTERVIEW_ROUND_TYPE_LABELS[type]}</option>
            ))}
          </select>
          <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className={inputClass} />
          <input value={interviewer} onChange={(event) => setInterviewer(event.target.value)} placeholder="Interviewer (optional)" className={`${inputClass} sm:col-span-2`} />
          <button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2">
            Add round
          </button>
        </form>
      )}

      {prepMessage && (
        <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{prepMessage}</p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading rounds…</p>
      ) : rounds.length === 0 ? (
        <p className="text-sm text-zinc-500">No interview rounds yet. Add one to schedule prep and record how it went.</p>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <div key={round.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{INTERVIEW_ROUND_TYPE_LABELS[round.roundType]}</span>
                  {round.scheduledAt && (
                    <span className="ml-2 text-xs text-zinc-400">{new Date(round.scheduledAt).toLocaleString()}</span>
                  )}
                  {round.interviewer && <span className="ml-2 text-xs text-zinc-400">· {round.interviewer}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={round.outcome}
                    onChange={(event) => setOutcome(round, event.target.value as InterviewRoundOutcome)}
                    disabled={busy}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${OUTCOME_CLASS[round.outcome]}`}
                  >
                    {INTERVIEW_ROUND_OUTCOMES.map((outcome) => (
                      <option key={outcome} value={outcome}>{outcome}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setOpenDebrief((current) => (current === round.id ? null : round.id))}
                    className="text-xs font-medium text-indigo-600"
                  >
                    {openDebrief === round.id ? 'Close' : 'Debrief'}
                  </button>
                  <button onClick={() => generatePrep(round.id)} disabled={busy} className="text-xs font-medium text-indigo-600 disabled:opacity-50">
                    Prep
                  </button>
                  <button onClick={() => removeRound(round.id)} disabled={busy} className="text-xs font-medium text-rose-600 disabled:opacity-50">
                    Delete
                  </button>
                </div>
              </div>

              {round.debrief && openDebrief !== round.id && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-500">{round.debrief}</p>
              )}
              {(round.areasWeak.length > 0 || round.missTags.length > 0) && openDebrief !== round.id && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {round.areasWeak.map((area) => (
                    <span key={area} className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                      {areaLabel(area)}
                    </span>
                  ))}
                  {round.missTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      {MISS_TAG_LABELS[tag]}
                    </span>
                  ))}
                </div>
              )}

              {openDebrief === round.id && (
                <DebriefEditor
                  round={round}
                  busy={busy}
                  onSave={async (payload) => {
                    setBusy(true);
                    try {
                      await interviewRoundsApi.update(jobId, round.id, payload);
                      setOpenDebrief(null);
                      await load();
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DebriefEditor({
  round,
  busy,
  onSave,
}: {
  round: InterviewRoundResponse;
  busy: boolean;
  onSave: (payload: { debrief: string | null; areasWeak: CareerRoleAreaId[]; missTags: MissTagReason[] }) => Promise<void>;
}) {
  const [debrief, setDebrief] = useState(round.debrief ?? '');
  const [areasWeak, setAreasWeak] = useState<CareerRoleAreaId[]>(round.areasWeak as CareerRoleAreaId[]);
  const [missTags, setMissTags] = useState<MissTagReason[]>(round.missTags);

  const toggle = <T,>(list: T[], value: T, set: (next: T[]) => void) =>
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  return (
    <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
      <textarea
        value={debrief}
        onChange={(event) => setDebrief(event.target.value)}
        rows={3}
        placeholder="What happened? What did you miss?"
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <div>
        <p className="mb-1 text-xs font-medium text-zinc-500">Weak areas this round exposed</p>
        <div className="flex flex-wrap gap-1.5">
          {CAREER_ROLE_AREA_IDS.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => toggle(areasWeak, area, setAreasWeak)}
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                areasWeak.includes(area)
                  ? 'bg-rose-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {areaLabel(area)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-zinc-500">What went wrong</p>
        <div className="flex flex-wrap gap-1.5">
          {MISS_TAG_REASONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(missTags, tag, setMissTags)}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                missTags.includes(tag)
                  ? 'bg-amber-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {MISS_TAG_LABELS[tag]}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={() => onSave({ debrief: debrief.trim() || null, areasWeak, missTags })}
        disabled={busy}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Save debrief
      </button>
    </div>
  );
}
