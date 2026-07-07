import { Injectable } from '@nestjs/common';
import {
  MISS_TAG_LABELS,
  type MissTagReason,
  type WeaknessAreaSummary,
  type WeaknessReasonSummary,
  type WeaknessSummaryResponse,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';

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
