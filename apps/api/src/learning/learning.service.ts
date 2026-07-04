import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LearningEvidence, LearningHighlight, LearningSource, Prisma, ReadwiseConnection, ReadwiseSyncRun } from '@prisma/client';
import {
  LearningEvidenceResponse,
  LearningHighlightResponse,
  LearningSourceResponse,
  ReadwiseConnectionResponse,
  ReadwiseSyncRunResponse,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectReadwiseDto } from './dto/connect-readwise.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';

type ReadwiseHighlightPayload = {
  id?: number | string;
  text?: string;
  note?: string | null;
  color?: string | null;
  location?: number | string | null;
  location_type?: string | null;
  highlighted_at?: string | null;
  updated_at?: string | null;
  is_deleted?: boolean;
  is_discard?: boolean;
};

type ReadwiseBookPayload = {
  user_book_id?: number | string;
  id?: number | string;
  title?: string;
  author?: string | null;
  category?: string | null;
  source?: string | null;
  source_url?: string | null;
  cover_image_url?: string | null;
  readwise_url?: string | null;
  summary?: string | null;
  updated?: string | null;
  highlights?: ReadwiseHighlightPayload[];
  is_deleted?: boolean;
};

type ReadwiseExportResponse = {
  results?: ReadwiseBookPayload[];
  nextPageCursor?: string | null;
  next_page_cursor?: string | null;
};

const READWISE_API = 'https://readwise.io/api/v2';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async getReadwiseConnection(userId: string): Promise<ReadwiseConnectionResponse | null> {
    const connection = await this.prisma.readwiseConnection.findUnique({ where: { userId } });
    return connection ? this.serializeConnection(connection) : null;
  }

  async connectReadwise(dto: ConnectReadwiseDto, userId: string): Promise<ReadwiseConnectionResponse> {
    await this.validateReadwiseToken(dto.token);
    const connection = await this.prisma.readwiseConnection.upsert({
      where: { userId },
      update: { token: dto.token, status: 'connected', lastError: null },
      create: { userId, token: dto.token, status: 'connected' },
    });
    return this.serializeConnection(connection);
  }

  async syncReadwise(userId: string): Promise<ReadwiseSyncRunResponse> {
    const connection = await this.prisma.readwiseConnection.findUnique({ where: { userId } });
    if (!connection?.token) throw new BadRequestException('Readwise is not connected');

    const run = await this.prisma.readwiseSyncRun.create({ data: { userId } });
    let booksProcessed = 0;
    let highlightsProcessed = 0;
    let deletedCount = 0;
    let cursor = connection.nextPageCursor;

    try {
      for (let page = 0; page < 20; page += 1) {
        const payload = await this.fetchReadwiseExport(connection.token, connection.lastSyncedAt, cursor);
        for (const book of payload.results ?? []) {
          booksProcessed += 1;
          const source = await this.upsertReadwiseSource(userId, book);
          for (const highlight of book.highlights ?? []) {
            const result = await this.upsertReadwiseHighlight(userId, source.id, highlight);
            if (result.deleted) deletedCount += 1;
            highlightsProcessed += 1;
          }
        }
        cursor = payload.nextPageCursor ?? payload.next_page_cursor ?? null;
        if (!cursor) break;
      }

      const finished = await this.prisma.readwiseSyncRun.update({
        where: { id: run.id },
        data: { status: 'completed', finishedAt: new Date(), booksProcessed, highlightsProcessed, deletedCount },
      });
      await this.prisma.readwiseConnection.update({
        where: { userId },
        data: { status: 'connected', lastSyncedAt: new Date(), nextPageCursor: cursor, lastError: null },
      });
      return this.serializeSyncRun(finished);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Readwise sync failed';
      const failed = await this.prisma.readwiseSyncRun.update({
        where: { id: run.id },
        data: { status: 'failed', finishedAt: new Date(), booksProcessed, highlightsProcessed, deletedCount, error: message },
      });
      await this.prisma.readwiseConnection.update({
        where: { userId },
        data: { status: 'error', lastError: message },
      });
      return this.serializeSyncRun(failed);
    }
  }

  async inbox(userId: string): Promise<LearningHighlightResponse[]> {
    const highlights = await this.prisma.learningHighlight.findMany({
      where: { userId, isDeleted: false, reviewedAt: null },
      include: this.highlightInclude(),
      orderBy: [{ highlightedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return highlights.map((highlight) => this.serializeHighlight(highlight));
  }

  async updateHighlight(id: string, dto: UpdateHighlightDto, userId: string): Promise<LearningHighlightResponse> {
    const existing = await this.prisma.learningHighlight.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Highlight not found');
    const highlight = await this.prisma.learningHighlight.update({
      where: { id },
      data: {
        ...(dto.roleTrackId !== undefined && { roleTrackId: dto.roleTrackId }),
        ...(dto.area !== undefined && { area: dto.area }),
        ...(dto.topicId !== undefined && { topicId: dto.topicId }),
        ...(dto.usefulness !== undefined && { usefulness: dto.usefulness }),
        ...(dto.reviewed !== undefined && { reviewedAt: dto.reviewed ? new Date() : null }),
      },
      include: this.highlightInclude(),
    });
    if (dto.reviewed) await this.ensureHighlightEvidence(highlight);
    return this.serializeHighlight(highlight);
  }

  async createEvidence(dto: CreateEvidenceDto, userId: string): Promise<LearningEvidenceResponse> {
    const evidence = await this.prisma.learningEvidence.create({
      data: {
        userId,
        type: dto.type.trim(),
        title: dto.title.trim(),
        body: this.cleanNullable(dto.body),
        roleTrackId: dto.roleTrackId ?? null,
        area: dto.area ?? null,
        topicId: dto.topicId ?? null,
        sourceId: dto.sourceId ?? null,
        highlightId: dto.highlightId ?? null,
        taskId: dto.taskId ?? null,
        questionId: dto.questionId ?? null,
        jobApplicationId: dto.jobApplicationId ?? null,
        missionId: dto.missionId ?? null,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      },
    });
    return this.serializeEvidence(evidence);
  }

  async ledger(userId: string, roleTrackId?: string, area?: string, missionId?: string): Promise<LearningEvidenceResponse[]> {
    const evidence = await this.prisma.learningEvidence.findMany({
      where: { userId, ...(roleTrackId && { roleTrackId }), ...(area && { area }), ...(missionId && { missionId }) },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
    return evidence.map((item) => this.serializeEvidence(item));
  }

  private async validateReadwiseToken(token: string) {
    const response = await fetch(`${READWISE_API}/auth/`, { headers: { Authorization: `Token ${token}` } });
    if (!response.ok) throw new BadRequestException('Readwise token is invalid');
  }

  private async fetchReadwiseExport(token: string, updatedAfter: Date | null, pageCursor: string | null): Promise<ReadwiseExportResponse> {
    const url = new URL(`${READWISE_API}/export/`);
    url.searchParams.set('includeDeleted', 'true');
    if (updatedAfter && !pageCursor) url.searchParams.set('updatedAfter', updatedAfter.toISOString());
    if (pageCursor) url.searchParams.set('pageCursor', pageCursor);
    const response = await fetch(url, { headers: { Authorization: `Token ${token}` } });
    if (!response.ok) throw new Error(`Readwise export failed: ${response.status}`);
    return response.json() as Promise<ReadwiseExportResponse>;
  }

  private async upsertReadwiseSource(userId: string, book: ReadwiseBookPayload): Promise<LearningSource> {
    const externalId = String(book.user_book_id ?? book.id ?? book.title ?? 'unknown');
    return this.prisma.learningSource.upsert({
      where: { userId_externalId: { userId, externalId } },
      update: {
        title: book.title ?? 'Untitled',
        author: book.author ?? null,
        url: book.source_url ?? null,
        sourceType: book.source ?? book.category ?? 'readwise',
        category: book.category ?? null,
        summary: book.summary ?? null,
        coverImageUrl: book.cover_image_url ?? null,
        readwiseUrl: book.readwise_url ?? null,
        isDeleted: Boolean(book.is_deleted),
      },
      create: {
        userId,
        externalId,
        title: book.title ?? 'Untitled',
        author: book.author ?? null,
        url: book.source_url ?? null,
        sourceType: book.source ?? book.category ?? 'readwise',
        category: book.category ?? null,
        summary: book.summary ?? null,
        coverImageUrl: book.cover_image_url ?? null,
        readwiseUrl: book.readwise_url ?? null,
        isDeleted: Boolean(book.is_deleted),
      },
    });
  }

  private async upsertReadwiseHighlight(userId: string, sourceId: string, highlight: ReadwiseHighlightPayload): Promise<{ deleted: boolean }> {
    const readwiseHighlightId = highlight.id === undefined ? null : Number(highlight.id);
    const deleted = Boolean(highlight.is_deleted ?? highlight.is_discard);
    const data = {
      userId,
      sourceId,
      readwiseHighlightId,
      text: highlight.text ?? '',
      note: highlight.note ?? null,
      color: highlight.color ?? null,
      location: highlight.location === undefined || highlight.location === null ? null : String(highlight.location),
      locationType: highlight.location_type ?? null,
      highlightedAt: highlight.highlighted_at ? new Date(highlight.highlighted_at) : null,
      readwiseUpdatedAt: highlight.updated_at ? new Date(highlight.updated_at) : null,
      isDeleted: deleted,
    };
    if (readwiseHighlightId === null) {
      await this.prisma.learningHighlight.create({ data });
      return { deleted };
    }
    await this.prisma.learningHighlight.upsert({
      where: { userId_readwiseHighlightId: { userId, readwiseHighlightId } },
      update: data,
      create: data,
    });
    return { deleted };
  }

  private async ensureHighlightEvidence(highlight: LearningHighlight & { source: LearningSource | null }) {
    const existing = await this.prisma.learningEvidence.findFirst({
      where: { userId: highlight.userId, highlightId: highlight.id, type: 'highlight_reviewed' },
      select: { id: true },
    });
    if (existing) return;
    await this.prisma.learningEvidence.create({
      data: {
        userId: highlight.userId,
        type: 'highlight_reviewed',
        title: highlight.source?.title ?? 'Reviewed highlight',
        body: highlight.text,
        roleTrackId: highlight.roleTrackId,
        area: highlight.area,
        topicId: highlight.topicId,
        sourceId: highlight.sourceId,
        highlightId: highlight.id,
        missionId: null,
        occurredAt: highlight.reviewedAt ?? new Date(),
      },
    });
  }

  private highlightInclude() {
    return {
      source: true,
      topic: { select: { id: true, name: true } },
    } satisfies Prisma.LearningHighlightInclude;
  }

  private serializeConnection(connection: ReadwiseConnection): ReadwiseConnectionResponse {
    return {
      id: connection.id,
      userId: connection.userId,
      status: connection.status,
      hasToken: Boolean(connection.token),
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
      nextPageCursor: connection.nextPageCursor,
      lastError: connection.lastError,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    };
  }

  private serializeSyncRun(run: ReadwiseSyncRun): ReadwiseSyncRunResponse {
    return {
      id: run.id,
      userId: run.userId,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      status: run.status,
      booksProcessed: run.booksProcessed,
      highlightsProcessed: run.highlightsProcessed,
      deletedCount: run.deletedCount,
      error: run.error,
    };
  }

  private serializeSource(source: LearningSource): LearningSourceResponse {
    return {
      id: source.id,
      userId: source.userId,
      externalId: source.externalId,
      title: source.title,
      author: source.author,
      url: source.url,
      sourceType: source.sourceType,
      category: source.category,
      summary: source.summary,
      coverImageUrl: source.coverImageUrl,
      readwiseUrl: source.readwiseUrl,
      isDeleted: source.isDeleted,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }

  private serializeHighlight(
    highlight: LearningHighlight & { source?: LearningSource | null; topic?: { id: string; name: string } | null },
  ): LearningHighlightResponse {
    return {
      id: highlight.id,
      userId: highlight.userId,
      sourceId: highlight.sourceId,
      source: highlight.source ? this.serializeSource(highlight.source) : null,
      readwiseHighlightId: highlight.readwiseHighlightId,
      text: highlight.text,
      note: highlight.note,
      color: highlight.color,
      location: highlight.location,
      locationType: highlight.locationType,
      highlightedAt: highlight.highlightedAt?.toISOString() ?? null,
      readwiseUpdatedAt: highlight.readwiseUpdatedAt?.toISOString() ?? null,
      isDeleted: highlight.isDeleted,
      reviewedAt: highlight.reviewedAt?.toISOString() ?? null,
      usefulness: highlight.usefulness,
      roleTrackId: highlight.roleTrackId as LearningHighlightResponse['roleTrackId'],
      area: highlight.area as LearningHighlightResponse['area'],
      topicId: highlight.topicId,
      topic: highlight.topic,
      createdAt: highlight.createdAt.toISOString(),
      updatedAt: highlight.updatedAt.toISOString(),
    };
  }

  private serializeEvidence(evidence: LearningEvidence): LearningEvidenceResponse {
    return {
      id: evidence.id,
      userId: evidence.userId,
      type: evidence.type,
      title: evidence.title,
      body: evidence.body,
      roleTrackId: evidence.roleTrackId as LearningEvidenceResponse['roleTrackId'],
      area: evidence.area as LearningEvidenceResponse['area'],
      topicId: evidence.topicId,
      sourceId: evidence.sourceId,
      highlightId: evidence.highlightId,
      taskId: evidence.taskId,
      questionId: evidence.questionId,
      jobApplicationId: evidence.jobApplicationId,
      missionId: evidence.missionId,
      metadata: this.asRecord(evidence.metadata),
      occurredAt: evidence.occurredAt.toISOString(),
      createdAt: evidence.createdAt.toISOString(),
    };
  }

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private cleanNullable(value: string | null | undefined): string | null | undefined {
    if (value === undefined || value === null) return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
