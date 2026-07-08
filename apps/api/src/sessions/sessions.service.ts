import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CAREER_ROLE_AREA_IDS } from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';
import { WeaknessesService } from '../weaknesses/weaknesses.service';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionsDto } from './dto/list-sessions.dto';

const questionInclude = {
  question: {
    include: {
      topic: { select: { id: true, name: true } },
      companies: { include: { company: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.SessionQuestionInclude;

type SessionQuestionWithQuestion = Prisma.SessionQuestionGetPayload<{ include: typeof questionInclude }>;

@Injectable()
export class SessionsService {
  private readonly logger = new Logger('SessionsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
    private readonly weaknesses: WeaknessesService,
  ) {}

  async create(dto: CreateSessionDto, userId: string) {
    const { topicId, companyId, difficulty, questionCount, questionIds, roleTrackId, area, pattern, jobApplicationId, missionId, ...sessionData } = dto;
    if (jobApplicationId) await this.ensureJobBelongsToUser(jobApplicationId, userId);
    if (missionId) await this.ensureMissionBelongsToUser(missionId, userId);
    const selected = questionIds
      ? await this.selectExactQuestions(questionIds)
      : sessionData.sessionType === 'spaced_review'
        ? await this.selectDueReviewQuestions(userId, questionCount)
        : sessionData.sessionType === 'weak_area_review'
          ? await this.selectWeaknessQuestions(userId, { topicId, companyId, difficulty, questionCount, roleTrackId, area, pattern })
          : sessionData.sessionType === 'mixed_interview'
            ? await this.selectMixedInterviewQuestions(userId, { topicId, companyId, difficulty, questionCount, roleTrackId, area, pattern })
            : sessionData.sessionType === 'job_prep'
              ? await this.selectJobPrepQuestions(userId, jobApplicationId, { topicId, companyId, difficulty, questionCount, roleTrackId, area, pattern })
              : await this.selectFilteredQuestions({ topicId, companyId, difficulty, questionCount, roleTrackId, area, pattern });

    if (selected.length === 0) throw new BadRequestException('No questions match the selected filters');

    const session = await this.prisma.interviewSession.create({
      data: {
        ...sessionData,
        roleTrackId,
        area,
        practiceMode: sessionData.sessionType,
        jobApplicationId,
        missionId,
        userId,
        sessionQuestions: {
          create: selected.map(({ id: questionId }, index) => ({ questionId, order: index + 1 })),
        },
      },
      include: { sessionQuestions: { include: questionInclude, orderBy: { order: 'asc' } } },
    });
    const { sessionQuestions, ...rest } = session;
    return { session: rest, questions: sessionQuestions.map(this.serializeSessionQuestion) };
  }

  private async selectExactQuestions(questionIds: string[]) {
    const uniqueQuestionIds = [...new Set(questionIds)];
    const candidates = await this.prisma.question.findMany({
      where: { id: { in: uniqueQuestionIds } },
      select: { id: true },
    });
    const existingIds = new Set(candidates.map(({ id }) => id));
    if (questionIds.length === 0 || uniqueQuestionIds.some((id) => !existingIds.has(id))) {
      throw new BadRequestException('One or more selected questions do not exist');
    }
    return uniqueQuestionIds.map((id) => ({ id }));
  }

  private async selectDueReviewQuestions(userId: string, questionCount: number) {
    const states = await this.prisma.reviewState.findMany({
      where: { userId, objectType: 'question', suspended: false, due: { lte: new Date() } },
      orderBy: { due: 'asc' },
      take: questionCount,
      select: { objectId: true },
    });
    const dueQuestionIds = states.map((state) => state.objectId);
    if (dueQuestionIds.length === 0) return [];

    const existingQuestions = await this.prisma.question.findMany({
      where: { id: { in: dueQuestionIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingQuestions.map((question) => question.id));
    return dueQuestionIds.filter((id) => existingIds.has(id)).map((id) => ({ id }));
  }

  // Plan §7.1 weakness_repair: 'weak_area_review' had a label and description
  // in the UI but drew a plain filtered-random set — identical to
  // quick_practice. It now draws from the user's actual weakness signals:
  // 1. Questions they recently struggled on and haven't since repaired (redo).
  // 2. Sibling questions from their weakest patterns/topics they haven't
  //    struggled on yet (drill the pattern, not just the exact item).
  // Falls back to the plain filtered draw when there's no struggle history
  // yet, so the session type always works (UX invariant §2.3.2-style: the
  // feature degrades, it doesn't dead-end).
  private async selectWeaknessQuestions(
    userId: string,
    filters: {
      topicId?: string;
      companyId?: string;
      difficulty?: string;
      roleTrackId?: string;
      area?: string;
      pattern?: string;
      questionCount: number;
    },
  ) {
    const [struggledIds, summary] = await Promise.all([
      this.weaknesses.struggledQuestionIds(userId),
      this.weaknesses.summary(userId),
    ]);

    if (struggledIds.length === 0) {
      return this.selectFilteredQuestions(filters);
    }

    const weakPatterns = summary.patterns.slice(0, 3).map((areaSummary) => areaSummary.key.toLowerCase());
    const weakTopicIds = summary.topics.slice(0, 3).map((areaSummary) => areaSummary.key);

    // Redo items lead the session, capped so at least ~1/3 of slots stay open
    // for pattern siblings whenever any exist.
    const redoCap = Math.max(1, Math.ceil(filters.questionCount * (2 / 3)));
    const redo = struggledIds.slice(0, Math.min(redoCap, filters.questionCount));

    const siblingCandidates =
      weakPatterns.length > 0 || weakTopicIds.length > 0
        ? await this.prisma.question.findMany({
            where: {
              id: { notIn: struggledIds },
              ...(weakTopicIds.length > 0 && { topicId: { in: weakTopicIds } }),
              ...(filters.difficulty && { difficulty: filters.difficulty }),
            },
            select: { id: true, patternTags: true, topicId: true, importance: true },
          })
        : [];
    const siblings = this.shuffle(
      siblingCandidates.filter((question) => {
        if (weakTopicIds.includes(question.topicId)) return true;
        const patternTags = this.asStringArray(question.patternTags).map((tag) => tag.toLowerCase());
        return patternTags.some((tag) => weakPatterns.includes(tag));
      }),
    )
      .sort((left, right) => right.importance - left.importance)
      .map(({ id }) => id);

    const combined = [...redo, ...siblings, ...struggledIds.slice(redo.length)];
    const unique = [...new Set(combined)].slice(0, filters.questionCount);
    if (unique.length === 0) return this.selectFilteredQuestions(filters);
    return unique.map((id) => ({ id }));
  }

  // MOM-127 mixed_interview: a mock-loop draw weighted toward weak spots.
  // Interleaves recently-struggled questions (up to half the slots) with a fresh
  // filtered draw across areas, so the session both re-tests known gaps and
  // exercises breadth like a real onsite. Degrades to a plain filtered draw when
  // there's no struggle history yet (UX invariant: the type never dead-ends).
  private async selectMixedInterviewQuestions(
    userId: string,
    filters: {
      topicId?: string;
      companyId?: string;
      difficulty?: string;
      roleTrackId?: string;
      area?: string;
      pattern?: string;
      questionCount: number;
    },
  ) {
    const struggledIds = await this.weaknesses.struggledQuestionIds(userId);
    const weakSlots = Math.floor(filters.questionCount / 2);
    const weakPicks = struggledIds.slice(0, weakSlots);

    const fresh = await this.selectFilteredQuestions(filters);
    const weakSet = new Set(weakPicks);
    const freshIds = fresh.map(({ id }) => id).filter((id) => !weakSet.has(id));

    const interleaved: string[] = [];
    for (let index = 0; index < Math.max(weakPicks.length, freshIds.length); index += 1) {
      if (index < weakPicks.length) interleaved.push(weakPicks[index]);
      if (index < freshIds.length) interleaved.push(freshIds[index]);
    }
    const unique = [...new Set(interleaved)].slice(0, filters.questionCount);
    if (unique.length === 0) return this.selectFilteredQuestions(filters);
    return unique.map((id) => ({ id }));
  }

  // MOM-128 job_prep: a target-scoped mock — the questions that matter for *this*
  // application. Draws from (1) the target company's linked question bank and
  // (2) this target's exposed weak areas (open WeaknessSignals scoped to the job,
  // fed by the MOM-113 debrief edge), weak-area questions first so a bombed round
  // demonstrably reshapes the next prep set. Company is matched by name until the
  // MOM-122 FK lands. Degrades to the job's role-track filtered draw, then a plain
  // draw, so the type never dead-ends.
  private async selectJobPrepQuestions(
    userId: string,
    jobApplicationId: string | undefined,
    filters: {
      topicId?: string;
      companyId?: string;
      difficulty?: string;
      roleTrackId?: string;
      area?: string;
      pattern?: string;
      questionCount: number;
    },
  ) {
    if (!jobApplicationId) return this.selectFilteredQuestions(filters);
    const job = await this.prisma.jobApplication.findFirst({
      where: { id: jobApplicationId, userId },
      select: { company: true, roleTrackId: true },
    });
    if (!job) return this.selectFilteredQuestions(filters);

    const roleTrackId = filters.roleTrackId ?? job.roleTrackId ?? undefined;

    // Match the free-text company to the catalog to reach its linked question bank.
    const company = job.company
      ? await this.prisma.company.findFirst({
          where: { name: { equals: job.company, mode: 'insensitive' } },
          select: { id: true },
        })
      : null;

    // This target's exposed weak areas (debrief/attempt signals scoped to the job).
    const summary = await this.weaknesses.summary(userId);
    const weakAreas = new Set(
      (summary.openSignals ?? [])
        .filter((signal) => signal.jobApplicationId === jobApplicationId && signal.signalType === 'area' && signal.area)
        .map((signal) => signal.area as string),
    );

    const candidates = await this.prisma.question.findMany({
      where: {
        ...(filters.difficulty && { difficulty: filters.difficulty }),
        ...(company && { companies: { some: { companyId: company.id } } }),
      },
      select: { id: true, roleTags: true, areaTags: true, patternTags: true, importance: true },
    });

    const scored = candidates
      .map((question) => {
        const roleTags = this.asStringArray(question.roleTags);
        const areaTags = this.asStringArray(question.areaTags);
        const roleOk = !roleTrackId || roleTags.length === 0 || roleTags.includes(roleTrackId);
        const hitsWeakArea = areaTags.some((tag) => weakAreas.has(tag));
        return { id: question.id, importance: question.importance, roleOk, hitsWeakArea };
      })
      .filter((question) => question.roleOk);

    // Weak-area questions lead (targeted repair for this job), then the rest,
    // each importance-weighted within a shuffle.
    const weakFirst = this.shuffle(scored.filter((question) => question.hitsWeakArea)).sort((left, right) => right.importance - left.importance);
    const others = this.shuffle(scored.filter((question) => !question.hitsWeakArea)).sort((left, right) => right.importance - left.importance);
    const ordered = [...weakFirst, ...others].map((question) => question.id);
    const unique = [...new Set(ordered)].slice(0, filters.questionCount);
    if (unique.length === 0) return this.selectFilteredQuestions({ ...filters, roleTrackId });
    return unique.map((id) => ({ id }));
  }

  private async selectFilteredQuestions(filters: {
    topicId?: string;
    companyId?: string;
    difficulty?: string;
    roleTrackId?: string;
    area?: string;
    pattern?: string;
    questionCount: number;
  }) {
    const candidates = await this.prisma.question.findMany({
      where: {
        ...(filters.topicId && { topicId: filters.topicId }),
        ...(filters.difficulty && { difficulty: filters.difficulty }),
        ...(filters.companyId && { companies: { some: { companyId: filters.companyId } } }),
      },
      select: { id: true, roleTags: true, areaTags: true, patternTags: true, importance: true },
    });
    const filtered = candidates.filter((question) => {
      const roleTags = this.asStringArray(question.roleTags);
      const areaTags = this.asStringArray(question.areaTags);
      const patternTags = this.asStringArray(question.patternTags);
      return (!filters.roleTrackId || roleTags.length === 0 || roleTags.includes(filters.roleTrackId)) &&
        (!filters.area || areaTags.length === 0 || areaTags.includes(filters.area)) &&
        (!filters.pattern || patternTags.map((tag) => tag.toLowerCase()).includes(filters.pattern.toLowerCase()));
    });
    return this.shuffle(filtered)
      .sort((left, right) => right.importance - left.importance)
      .slice(0, filters.questionCount)
      .map(({ id }) => ({ id }));
  }

  async list(query: ListSessionsDto, userId: string) {
    const where: Prisma.InterviewSessionWhereInput = { userId, ...(query.status && { status: query.status }) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.interviewSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { sessionQuestions: true, answerAttempts: true } } },
      }),
      this.prisma.interviewSession.count({ where }),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }

  async get(id: string, userId: string) {
    const session = await this.prisma.interviewSession.findFirst({
      where: { id, userId },
      include: {
        sessionQuestions: { include: questionInclude, orderBy: { order: 'asc' } },
        answerAttempts: { where: { userId }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return {
      ...session,
      sessionQuestions: session.sessionQuestions.map(this.serializeSessionQuestion),
    };
  }

  async answer(id: string, dto: CreateAnswerDto, userId: string) {
    const session = await this.prisma.interviewSession.findFirst({
      where: { id, userId },
      select: {
        status: true,
        roleTrackId: true,
        area: true,
        sessionQuestions: {
          where: { questionId: dto.questionId },
          select: { id: true, question: { select: { areaTags: true } } },
        },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'active') throw new ConflictException('Session is not active');
    if (session.sessionQuestions.length === 0) {
      throw new BadRequestException('Question is not part of this session');
    }
    // MOM-128: attribute the attempt to a target dimension so per-area readiness
    // (MOM-129/130) can group graded attempts. Area comes from the question that
    // was actually practiced; role track from the session's declared target. Both
    // stay null for untargeted global practice — correct: it isn't attributable.
    const area = this.firstArea(session.sessionQuestions[0]?.question?.areaTags) ?? session.area ?? null;
    const roleTrackId = session.roleTrackId ?? null;
    const attempt = await this.prisma.answerAttempt.create({
      data: { ...dto, sessionId: id, userId, roleTrackId, area },
      include: { question: { select: { id: true, title: true } } },
    });

    // MOM-031: every self-rated answer updates its FSRS review schedule so the
    // Today queue (MOM-032) can eventually surface it when it comes due. Only
    // fires when selfRating is present (it's optional on CreateAnswerDto) since
    // FSRS needs a grade to schedule from. A scheduling failure must never
    // break answer submission — the attempt itself already succeeded.
    if (dto.selfRating !== undefined) {
      try {
        await this.reviews.record(userId, 'question', dto.questionId, dto.selfRating);
      } catch (error) {
        this.logger.warn(`Failed to update review schedule for question ${dto.questionId}: ${error}`);
      }
    }

    return attempt;
  }

  complete(id: string, userId: string) {
    return this.finish(id, userId, 'completed');
  }

  abandon(id: string, userId: string) {
    return this.finish(id, userId, 'abandoned');
  }

  private async finish(id: string, userId: string, status: 'completed' | 'abandoned') {
    const result = await this.prisma.interviewSession.updateMany({
      where: { id, userId, status: 'active' },
      data: { status, endedAt: new Date() },
    });
    if (result.count === 1) {
      return this.prisma.interviewSession.findUniqueOrThrow({ where: { id } });
    }
    const existing = await this.prisma.interviewSession.findFirst({ where: { id, userId }, select: { status: true } });
    if (!existing) throw new NotFoundException('Session not found');
    throw new ConflictException(`Session is already ${existing.status}`);
  }

  private shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapWith = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapWith]] = [result[swapWith], result[index]];
    }
    return result;
  }

  private async ensureJobBelongsToUser(jobApplicationId: string, userId: string) {
    const job = await this.prisma.jobApplication.findFirst({ where: { id: jobApplicationId, userId }, select: { id: true } });
    if (!job) throw new BadRequestException('Job application not found');
  }

  private async ensureMissionBelongsToUser(missionId: string, userId: string) {
    const mission = await this.prisma.mission.findFirst({ where: { id: missionId, userId }, select: { id: true } });
    if (!mission) throw new BadRequestException('Mission not found');
  }

  private asStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  // The question's primary competency area — the first areaTag that is a known
  // CAREER_ROLE_AREA_ID. Used to attribute an attempt for per-area readiness.
  private firstArea(value: Prisma.JsonValue | undefined): string | null {
    const areaIds = CAREER_ROLE_AREA_IDS as readonly string[];
    return this.asStringArray(value ?? []).find((tag) => areaIds.includes(tag)) ?? null;
  }

  private serializeSessionQuestion(item: SessionQuestionWithQuestion) {
    return {
      ...item,
      question: {
        ...item.question,
        companies: item.question.companies.map(({ company }) => company),
      },
    };
  }
}
