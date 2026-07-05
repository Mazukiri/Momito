import { Injectable } from '@nestjs/common';
import { DSA_PATTERNS, type DsaPattern, type DsaProgressResponse } from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';

// MOM-050: aggregates the DSA ladder (packages/shared's DSA_PATTERNS) against a
// user's attempt history, cross-referencing each dsa Question's patternTags with
// their AnswerAttempt records. "Solved" reuses the same positive-attempt
// heuristic as missions.service.ts, for consistency across the app.
@Injectable()
export class DsaService {
  constructor(private readonly prisma: PrismaService) {}

  async progress(userId: string): Promise<DsaProgressResponse> {
    const dsaQuestions = await this.prisma.question.findMany({
      where: { type: 'dsa' },
      select: { id: true, patternTags: true },
    });

    const attempts = await this.prisma.answerAttempt.findMany({
      where: { userId, question: { type: 'dsa' } },
      select: {
        questionId: true,
        selfRating: true,
        rubricScore: true,
        aiScore: true,
        correctness: true,
      },
    });

    // A DSA item only counts as solved on a clean/strong signal — 'partial' correctness
    // (a valid, reachable value per CreateAnswerDto's @IsIn(['correct', 'partial',
    // 'incorrect'])) means attempted-but-not-there-yet, not solved. Conflating the two
    // would overstate ladder progress.
    const isSolvedAttempt = (a: (typeof attempts)[number]) =>
      (a.rubricScore ?? 0) >= 0.6 ||
      (a.aiScore ?? 0) >= 0.6 ||
      (a.selfRating ?? 0) >= 3 ||
      ['correct', 'strong'].includes((a.correctness ?? '').toLowerCase());

    const bestAttemptByQuestion = new Map<string, (typeof attempts)[number]>();
    for (const attempt of attempts) {
      const existing = bestAttemptByQuestion.get(attempt.questionId);
      if (!existing || (!isSolvedAttempt(existing) && isSolvedAttempt(attempt))) {
        bestAttemptByQuestion.set(attempt.questionId, attempt);
      }
    }

    const isSolved = (questionId: string): boolean => {
      const best = bestAttemptByQuestion.get(questionId);
      return best ? isSolvedAttempt(best) : false;
    };

    const patterns: DsaProgressResponse['patterns'] = DSA_PATTERNS.map((pattern: DsaPattern) => {
      const itemsWithPattern = dsaQuestions.filter((q) =>
        Array.isArray(q.patternTags) ? (q.patternTags as unknown as string[]).includes(pattern) : false,
      );
      const attemptedItems = itemsWithPattern.filter((q) => bestAttemptByQuestion.has(q.id));
      const solvedItems = itemsWithPattern.filter((q) => isSolved(q.id));

      return {
        pattern,
        totalItems: itemsWithPattern.length,
        attemptedItems: attemptedItems.length,
        solvedItems: solvedItems.length,
      };
    });

    const attemptedQuestionIds = new Set(bestAttemptByQuestion.keys());
    const solvedQuestionIds = new Set(dsaQuestions.filter((q) => isSolved(q.id)).map((q) => q.id));

    return {
      patterns,
      totalDsaItems: dsaQuestions.length,
      totalAttempted: attemptedQuestionIds.size,
      totalSolved: solvedQuestionIds.size,
    };
  }
}
