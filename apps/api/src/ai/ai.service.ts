import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Rubric } from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetService } from './budget.service';
import { GradeResult } from './dto/grade-result.schema';
import { GradingService } from './grading.service';

function formatFeedback(result: GradeResult): string {
  const lines: string[] = [
    `**Overall score: ${result.overallScore}/100** — suggested rating: **${result.suggestedRating}**`,
    '',
  ];

  if (result.criteriaScores.length) {
    lines.push('| Criterion | Score | Comment |', '|---|---|---|');
    for (const c of result.criteriaScores) {
      lines.push(`| ${c.criterionTitle} | ${c.score}/5 | ${c.comment.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }

  if (result.strengths.length) {
    lines.push('**Strengths**', ...result.strengths.map((s) => `- ${s}`), '');
  }
  if (result.gaps.length) {
    lines.push('**Gaps**', ...result.gaps.map((g) => `- ${g}`), '');
  }
  if (result.followUpQuestions.length) {
    lines.push('**Follow-up questions an interviewer might ask**', ...result.followUpQuestions.map((q) => `- ${q}`));
  }

  return lines.join('\n');
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budget: BudgetService,
    private readonly grading: GradingService,
  ) {}

  isAvailable(): boolean {
    return this.grading.isAvailable();
  }

  async usage(userId: string) {
    const snapshot = await this.budget.getUsage(userId);
    return { available: this.isAvailable(), ...snapshot };
  }

  async gradeAttempt(attemptId: string, userId: string, force: boolean) {
    if (!this.isAvailable()) {
      throw new ServiceUnavailableException('AI grading is not configured on this instance.');
    }

    const attempt = await this.prisma.answerAttempt.findFirst({
      where: { id: attemptId, userId },
      include: { question: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    if (attempt.aiFeedback && !force) {
      return { attemptId: attempt.id, aiScore: attempt.aiScore, aiFeedback: attempt.aiFeedback, cached: true };
    }

    const { allowed, remainingUsd } = await this.budget.checkAndReserve(userId);
    if (!allowed) {
      throw new BadRequestException(`Daily AI grading budget exhausted (remaining $${remainingUsd.toFixed(2)}).`);
    }

    const rubric = attempt.question.rubric as unknown as Rubric | null;
    const outcome = await this.grading.grade({
      questionTitle: attempt.question.title,
      questionPrompt: attempt.question.prompt,
      questionType: attempt.question.type,
      rubric: rubric?.criteria?.length ? rubric : null,
      referenceAnswer: attempt.question.referenceAnswer,
      answerText: attempt.answerText,
    });

    if (!outcome.ok) throw new BadRequestException(outcome.reason);

    await this.budget.record(userId, outcome.model, outcome.inputTokens, outcome.outputTokens);

    const aiScore = outcome.result.overallScore / 100;
    const aiFeedback = formatFeedback(outcome.result);

    await this.prisma.answerAttempt.update({ where: { id: attempt.id }, data: { aiScore, aiFeedback } });

    return { attemptId: attempt.id, aiScore, aiFeedback, cached: false };
  }
}
