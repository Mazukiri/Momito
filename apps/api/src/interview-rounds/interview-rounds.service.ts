import { Injectable, NotFoundException } from '@nestjs/common';
import type { InterviewRound } from '@prisma/client';
import {
  InterviewRoundOutcome,
  InterviewRoundResponse,
  InterviewRoundType,
  MissTagReason,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterviewRoundDto } from './dto/create-interview-round.dto';
import { UpdateInterviewRoundDto } from './dto/update-interview-round.dto';

@Injectable()
export class InterviewRoundsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForJob(jobId: string, userId: string): Promise<InterviewRoundResponse[]> {
    await this.ensureJob(jobId, userId);
    const rounds = await this.prisma.interviewRound.findMany({
      where: { jobApplicationId: jobId, userId },
      orderBy: [{ sequence: 'asc' }, { scheduledAt: 'asc' }, { createdAt: 'asc' }],
    });
    return rounds.map((round) => this.serialize(round));
  }

  async create(jobId: string, dto: CreateInterviewRoundDto, userId: string): Promise<InterviewRoundResponse> {
    await this.ensureJob(jobId, userId);
    const round = await this.prisma.interviewRound.create({
      data: {
        userId,
        jobApplicationId: jobId,
        roundType: dto.roundType,
        sequence: dto.sequence ?? 0,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        durationMinutes: dto.durationMinutes ?? null,
        interviewer: dto.interviewer ?? null,
      },
    });
    return this.serialize(round);
  }

  async update(jobId: string, roundId: string, dto: UpdateInterviewRoundDto, userId: string): Promise<InterviewRoundResponse> {
    await this.ensureJob(jobId, userId);
    const result = await this.prisma.interviewRound.updateMany({
      where: { id: roundId, jobApplicationId: jobId, userId },
      data: {
        ...(dto.roundType !== undefined && { roundType: dto.roundType }),
        ...(dto.sequence !== undefined && { sequence: dto.sequence }),
        ...(dto.scheduledAt !== undefined && { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
        ...(dto.interviewer !== undefined && { interviewer: dto.interviewer }),
        ...(dto.outcome !== undefined && { outcome: dto.outcome }),
        ...(dto.debrief !== undefined && { debrief: dto.debrief }),
        ...(dto.areasWeak !== undefined && { areasWeak: dto.areasWeak }),
        ...(dto.missTags !== undefined && { missTags: dto.missTags }),
      },
    });
    if (result.count === 0) throw new NotFoundException('Interview round not found');
    // MOM-113 will hook the debrief→WeaknessSignal edge here, after the write.
    const round = await this.prisma.interviewRound.findUniqueOrThrow({ where: { id: roundId } });
    return this.serialize(round);
  }

  async remove(jobId: string, roundId: string, userId: string): Promise<{ deleted: boolean }> {
    await this.ensureJob(jobId, userId);
    const result = await this.prisma.interviewRound.deleteMany({ where: { id: roundId, jobApplicationId: jobId, userId } });
    if (result.count === 0) throw new NotFoundException('Interview round not found');
    return { deleted: true };
  }

  private async ensureJob(jobId: string, userId: string) {
    const job = await this.prisma.jobApplication.findFirst({ where: { id: jobId, userId }, select: { id: true } });
    if (!job) throw new NotFoundException('Job application not found');
  }

  private serialize(round: InterviewRound): InterviewRoundResponse {
    return {
      id: round.id,
      userId: round.userId,
      jobApplicationId: round.jobApplicationId,
      roundType: round.roundType as InterviewRoundType,
      sequence: round.sequence,
      scheduledAt: round.scheduledAt?.toISOString() ?? null,
      durationMinutes: round.durationMinutes,
      interviewer: round.interviewer,
      outcome: round.outcome as InterviewRoundOutcome,
      debrief: round.debrief,
      areasWeak: round.areasWeak,
      missTags: round.missTags as MissTagReason[],
      createdAt: round.createdAt.toISOString(),
      updatedAt: round.updatedAt.toISOString(),
    };
  }
}
