import { Injectable, NotFoundException } from '@nestjs/common';
import type { WeaknessSignal } from '@prisma/client';
import {
  MISS_TAG_LABELS,
  type MissTagReason,
  type WeaknessAreaSummary,
  type WeaknessReasonSummary,
  type WeaknessSignalResponse,
  type WeaknessSignalSource,
  type WeaknessSignalStatus,
  type WeaknessSignalType,
  type WeaknessSummaryResponse,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';

// MOM-127 (ADR-0011): a stored signal's raw severity accrues +1 per event and
// decays exponentially from its last event at read time. Half-life 21 days — a
// debrief weakness you never repair fades over ~3 weeks; each recurrence resets
// the clock and raises the raw value (capped). Below the floor it drops out.
const SEVERITY_HALFLIFE_DAYS = 21;
const SEVERITY_FLOOR = 0.15;
const SEVERITY_CAP = 10;
const OPEN_STATUSES = ['open', 'repairing'] as const;

export interface RecordWeaknessSignalInput {
  signalType: WeaknessSignalType;
  key: string;
  label: string;
  source: WeaknessSignalSource;
  roleTrackId?: string | null;
  area?: string | null;
  jobApplicationId?: string | null;
}

// Plan §5.4 WeaknessSignal + §6.1 queue priority 3 ("Weakness repair items").
// Signals are derived on demand from AnswerAttempt rows — the reflection data
// (missTags, selfRating, correctness) users already record — instead of a
// separate signals table, honoring §2.1.8 "Progress is derived from real
// attempts". A dedicated table can come later if severity decay or manual
// dismissal is ever needed; the response shape wouldn't change.

const DEFAULT_WINDOW_DAYS = 30;
const MAX_LIST = 6;
const MAX_QUESTION_IDS = 10;

interface AttemptRow {
  questionId: string;
  selfRating: number | null;
  correctness: string | null;
  missTags: string[];
  createdAt: Date;
  question: {
    id: string;
    title: string;
    patternTags: unknown;
    topic: { id: string; name: string } | null;
  };
}

// An attempt "struggled" when the user said so in any of the three signals the
// reflection step captures. selfRating <= 2 matches the Again/Hard grades of
// the SELF_RATING_SCALE (and fsrs-scheduler's Again/Hard mapping).
export function isStruggleAttempt(attempt: { selfRating: number | null; correctness: string | null; missTags: string[] }): boolean {
  if (attempt.missTags.length > 0) return true;
  if (attempt.selfRating !== null && attempt.selfRating <= 2) return true;
  if ((attempt.correctness ?? '').toLowerCase() === 'incorrect') return true;
  return false;
}

@Injectable()
export class WeaknessesService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<WeaknessSummaryResponse> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const attempts = (await this.prisma.answerAttempt.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: {
        questionId: true,
        selfRating: true,
        correctness: true,
        missTags: true,
        createdAt: true,
        question: {
          select: {
            id: true,
            title: true,
            patternTags: true,
            topic: { select: { id: true, name: true } },
          },
        },
      },
    })) as AttemptRow[];

    const struggles = attempts.filter(isStruggleAttempt);

    return {
      windowDays,
      totalAttempts: attempts.length,
      totalStruggles: struggles.length,
      reasons: this.aggregateReasons(struggles),
      patterns: this.aggregateAreas(attempts, (attempt) =>
        this.patternsOf(attempt).map((tag) => ({ key: tag, label: tag })),
      ),
      // Topics are keyed by topic id (so a repair session can query questions
      // by topicId) and labeled with the human name.
      topics: this.aggregateAreas(attempts, (attempt) =>
        attempt.question.topic ? [{ key: attempt.question.topic.id, label: attempt.question.topic.name }] : [],
      ),
      openSignals: await this.listOpenSignals(userId),
    };
  }

  // ── Persisted weakness signals (MOM-127) ──────────────────────────────────
  // Event-sourced signals the derived path above can't represent (interview
  // debriefs, manual entries). Called service-to-service by the debrief edge
  // (MOM-113) and, later, a manual-entry endpoint.

  async recordSignal(userId: string, input: RecordWeaknessSignalInput): Promise<WeaknessSignalResponse> {
    const jobApplicationId = input.jobApplicationId ?? null;
    // Accrue onto an existing *live* signal for the same target+key rather than
    // inserting a duplicate; a resolved/dismissed one stays closed and a fresh
    // recurrence opens a new row. Service-layer upsert (not a DB unique) because
    // the nullable jobApplicationId makes a unique index treat NULLs as distinct.
    const existing = await this.prisma.weaknessSignal.findFirst({
      where: {
        userId,
        signalType: input.signalType,
        key: input.key,
        jobApplicationId,
        status: { in: [...OPEN_STATUSES] },
      },
      orderBy: { lastSignalAt: 'desc' },
    });

    const now = new Date();
    const signal = existing
      ? await this.prisma.weaknessSignal.update({
          where: { id: existing.id },
          data: {
            occurrences: existing.occurrences + 1,
            severity: Math.min(SEVERITY_CAP, existing.severity + 1),
            lastSignalAt: now,
            label: input.label,
            source: input.source,
            ...(input.roleTrackId !== undefined && { roleTrackId: input.roleTrackId }),
            ...(input.area !== undefined && { area: input.area }),
          },
        })
      : await this.prisma.weaknessSignal.create({
          data: {
            userId,
            signalType: input.signalType,
            key: input.key,
            label: input.label,
            source: input.source,
            roleTrackId: input.roleTrackId ?? null,
            area: input.area ?? null,
            jobApplicationId,
            lastSignalAt: now,
          },
        });
    return this.serializeSignal(signal);
  }

  async resolveSignal(id: string, userId: string): Promise<WeaknessSignalResponse> {
    return this.setSignalStatus(id, userId, 'resolved');
  }

  async dismissSignal(id: string, userId: string): Promise<WeaknessSignalResponse> {
    return this.setSignalStatus(id, userId, 'dismissed');
  }

  private async setSignalStatus(id: string, userId: string, status: WeaknessSignalStatus): Promise<WeaknessSignalResponse> {
    const result = await this.prisma.weaknessSignal.updateMany({
      where: { id, userId },
      data: { status, resolvedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('Weakness signal not found');
    const signal = await this.prisma.weaknessSignal.findUniqueOrThrow({ where: { id } });
    return this.serializeSignal(signal);
  }

  // Open signals, decayed at read time and sorted strongest-first. Pass a
  // jobApplicationId to scope to one target (MOM-130 job readiness).
  async listOpenSignals(userId: string, jobApplicationId?: string): Promise<WeaknessSignalResponse[]> {
    const signals = await this.prisma.weaknessSignal.findMany({
      where: {
        userId,
        status: { in: [...OPEN_STATUSES] },
        ...(jobApplicationId !== undefined && { jobApplicationId }),
      },
    });
    return signals
      .map((signal) => this.serializeSignal(signal))
      .filter((signal) => signal.severity >= SEVERITY_FLOOR)
      .sort((left, right) => right.severity - left.severity || right.lastSignalAt.localeCompare(left.lastSignalAt));
  }

  // Effective severity = raw severity decayed exponentially from the last event.
  private effectiveSeverity(severity: number, lastSignalAt: Date): number {
    const ageDays = (Date.now() - lastSignalAt.getTime()) / (24 * 60 * 60 * 1000);
    return severity * Math.pow(2, -Math.max(0, ageDays) / SEVERITY_HALFLIFE_DAYS);
  }

  private serializeSignal(signal: WeaknessSignal): WeaknessSignalResponse {
    return {
      id: signal.id,
      signalType: signal.signalType as WeaknessSignalType,
      key: signal.key,
      label: signal.label,
      roleTrackId: signal.roleTrackId,
      area: signal.area,
      jobApplicationId: signal.jobApplicationId,
      severity: Number(this.effectiveSeverity(signal.severity, signal.lastSignalAt).toFixed(3)),
      occurrences: signal.occurrences,
      source: signal.source as WeaknessSignalSource,
      status: signal.status as WeaknessSignalStatus,
      lastSignalAt: signal.lastSignalAt.toISOString(),
    };
  }

  // The question ids a weakness-repair session should draw from: everything
  // the user struggled on recently, most recent first, deduplicated.
  async struggledQuestionIds(userId: string, windowDays = 60): Promise<string[]> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const attempts = await this.prisma.answerAttempt.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { questionId: true, selfRating: true, correctness: true, missTags: true },
    });
    const seen = new Set<string>();
    const struggled: string[] = [];
    const solidLater = new Set<string>();
    for (const attempt of attempts) {
      // Attempts are newest-first: a later clean attempt (rating >= 3 with no
      // miss tags) means the earlier struggle on that question is repaired.
      if (!isStruggleAttempt(attempt) && (attempt.selfRating ?? 0) >= 3) {
        solidLater.add(attempt.questionId);
        continue;
      }
      if (isStruggleAttempt(attempt) && !seen.has(attempt.questionId) && !solidLater.has(attempt.questionId)) {
        seen.add(attempt.questionId);
        struggled.push(attempt.questionId);
      }
    }
    return struggled;
  }

  private aggregateReasons(struggles: AttemptRow[]): WeaknessReasonSummary[] {
    const byReason = new Map<MissTagReason, { count: number; lastAt: Date; titles: string[]; questionIds: string[] }>();
    for (const attempt of struggles) {
      for (const tag of attempt.missTags as MissTagReason[]) {
        if (!(tag in MISS_TAG_LABELS)) continue;
        const entry = byReason.get(tag) ?? { count: 0, lastAt: attempt.createdAt, titles: [], questionIds: [] };
        entry.count += 1;
        if (attempt.createdAt > entry.lastAt) entry.lastAt = attempt.createdAt;
        if (entry.titles.length < 3 && !entry.titles.includes(attempt.question.title)) {
          entry.titles.push(attempt.question.title);
        }
        if (entry.questionIds.length < MAX_QUESTION_IDS && !entry.questionIds.includes(attempt.questionId)) {
          entry.questionIds.push(attempt.questionId);
        }
        byReason.set(tag, entry);
      }
    }
    return [...byReason.entries()]
      .map(([reason, entry]) => ({
        reason,
        label: MISS_TAG_LABELS[reason],
        count: entry.count,
        lastAt: entry.lastAt.toISOString(),
        sampleTitles: entry.titles,
        questionIds: entry.questionIds,
      }))
      .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
      .slice(0, MAX_LIST);
  }

  private aggregateAreas(
    attempts: AttemptRow[],
    keysOf: (attempt: AttemptRow) => Array<{ key: string; label: string }>,
  ): WeaknessAreaSummary[] {
    const byKey = new Map<string, { label: string; struggles: number; attempts: number; lastAt: Date; questionIds: string[] }>();
    for (const attempt of attempts) {
      const struggled = isStruggleAttempt(attempt);
      for (const { key, label } of keysOf(attempt)) {
        const entry = byKey.get(key) ?? { label, struggles: 0, attempts: 0, lastAt: attempt.createdAt, questionIds: [] };
        entry.attempts += 1;
        if (struggled) {
          entry.struggles += 1;
          if (entry.questionIds.length < MAX_QUESTION_IDS && !entry.questionIds.includes(attempt.questionId)) {
            entry.questionIds.push(attempt.questionId);
          }
        }
        if (attempt.createdAt > entry.lastAt) entry.lastAt = attempt.createdAt;
        byKey.set(key, entry);
      }
    }
    return [...byKey.entries()]
      .filter(([, entry]) => entry.struggles > 0)
      .map(([key, entry]) => ({
        key,
        label: entry.label,
        struggles: entry.struggles,
        attempts: entry.attempts,
        lastAt: entry.lastAt.toISOString(),
        questionIds: entry.questionIds,
      }))
      .sort((a, b) => b.struggles - a.struggles || b.lastAt.localeCompare(a.lastAt))
      .slice(0, MAX_LIST);
  }

  private patternsOf(attempt: AttemptRow): string[] {
    const tags = attempt.question.patternTags;
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
  }
}
