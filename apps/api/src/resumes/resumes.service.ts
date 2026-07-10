import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CareerRoleTrackId,
  ProfileEducationItem,
  ProfileExperienceItem,
  ProfileProjectItem,
  ResumeVersionResponse,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResumeVersionDto } from './dto/create-resume-version.dto';
import { UpdateResumeVersionDto } from './dto/update-resume-version.dto';

type ResumeRow = Prisma.ResumeVersionGetPayload<{ include: { jobApplication: { select: { company: true } } } }>;
const resumeInclude = { jobApplication: { select: { company: true } } } satisfies Prisma.ResumeVersionInclude;

@Injectable()
export class ResumesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ResumeVersionResponse[]> {
    const versions = await this.prisma.resumeVersion.findMany({ where: { userId }, include: resumeInclude, orderBy: { updatedAt: 'desc' } });
    return versions.map((version) => this.serialize(version));
  }

  async get(id: string, userId: string): Promise<ResumeVersionResponse> {
    const version = await this.prisma.resumeVersion.findFirst({ where: { id, userId }, include: resumeInclude });
    if (!version) throw new NotFoundException('Résumé version not found');
    return this.serialize(version);
  }

  async create(dto: CreateResumeVersionDto, userId: string): Promise<ResumeVersionResponse> {
    if (dto.jobApplicationId) await this.ensureJob(dto.jobApplicationId, userId);
    // Derive contentMd from the master Profile when the caller didn't supply it
    // ("duplicate from profile"); snapshot what it was derived from.
    let contentMd = dto.contentMd;
    let snapshot: Prisma.InputJsonValue | undefined;
    if (contentMd === undefined) {
      const profile = await this.prisma.profile.findUnique({ where: { userId } });
      if (!profile) throw new BadRequestException('No profile to derive a résumé from — add a profile first or pass contentMd.');
      contentMd = this.profileToMarkdown(profile);
      snapshot = {
        name: profile.name,
        email: profile.email,
        skills: profile.skills,
        experience: profile.experience,
        education: profile.education,
        projects: profile.projects,
      } as Prisma.InputJsonValue;
    }
    const version = await this.prisma.resumeVersion.create({
      data: {
        userId,
        label: dto.label.trim(),
        targetRoleTrackId: dto.targetRoleTrackId ?? null,
        jobApplicationId: dto.jobApplicationId ?? null,
        contentMd,
        ...(snapshot !== undefined && { baseProfileSnapshot: snapshot }),
      },
      include: resumeInclude,
    });
    return this.serialize(version);
  }

  async update(id: string, dto: UpdateResumeVersionDto, userId: string): Promise<ResumeVersionResponse> {
    if (dto.jobApplicationId) await this.ensureJob(dto.jobApplicationId, userId);
    const result = await this.prisma.resumeVersion.updateMany({
      where: { id, userId },
      data: {
        ...(dto.label !== undefined && { label: dto.label.trim() }),
        ...(dto.targetRoleTrackId !== undefined && { targetRoleTrackId: dto.targetRoleTrackId }),
        ...(dto.jobApplicationId !== undefined && { jobApplicationId: dto.jobApplicationId }),
        ...(dto.contentMd !== undefined && { contentMd: dto.contentMd }),
      },
    });
    if (result.count === 0) throw new NotFoundException('Résumé version not found');
    return this.get(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.prisma.resumeVersion.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException('Résumé version not found');
  }

  // MOM-132: the master Profile → canonical Markdown. Deterministic; the starting
  // point a version is then tailored from.
  profileToMarkdown(profile: {
    name: string | null;
    email: string | null;
    githubUrl: string | null;
    linkedinUrl: string | null;
    skills: Prisma.JsonValue;
    experience: Prisma.JsonValue;
    education: Prisma.JsonValue;
    projects: Prisma.JsonValue;
  }): string {
    const lines: string[] = [];
    lines.push(`# ${profile.name ?? 'Your Name'}`);
    const contact = [profile.email, profile.githubUrl, profile.linkedinUrl].filter(Boolean);
    if (contact.length > 0) lines.push(contact.join(' · '));

    const skills = this.asStringArray(profile.skills);
    if (skills.length > 0) {
      lines.push('', '## Skills', skills.join(', '));
    }

    const experience = this.asArray<ProfileExperienceItem>(profile.experience);
    if (experience.length > 0) {
      lines.push('', '## Experience');
      for (const item of experience) {
        lines.push(`### ${item.role ?? 'Role'} — ${item.company ?? 'Company'}${item.years ? ` (${item.years}y)` : ''}`);
        if (item.description) lines.push(item.description);
      }
    }

    const projects = this.asArray<ProfileProjectItem>(profile.projects);
    if (projects.length > 0) {
      lines.push('', '## Projects');
      for (const item of projects) {
        const heading = item.url ? `### [${item.name ?? 'Project'}](${item.url})` : `### ${item.name ?? 'Project'}`;
        lines.push(heading);
        if (item.description) lines.push(item.description);
      }
    }

    const education = this.asArray<ProfileEducationItem>(profile.education);
    if (education.length > 0) {
      lines.push('', '## Education');
      for (const item of education) {
        lines.push(`- ${item.degree ?? 'Degree'}, ${item.institution ?? 'Institution'}${item.year ? ` (${item.year})` : ''}`);
      }
    }

    return lines.join('\n');
  }

  private serialize(version: ResumeRow): ResumeVersionResponse {
    return {
      id: version.id,
      userId: version.userId,
      jobApplicationId: version.jobApplicationId,
      company: version.jobApplication?.company ?? null,
      label: version.label,
      targetRoleTrackId: (version.targetRoleTrackId as CareerRoleTrackId | null) ?? null,
      contentMd: version.contentMd,
      aiSuggestions: Array.isArray(version.aiSuggestions) ? (version.aiSuggestions as unknown[]) : [],
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    };
  }

  private asStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private asArray<T>(value: Prisma.JsonValue): T[] {
    return Array.isArray(value) ? (value as unknown as T[]) : [];
  }

  private async ensureJob(jobId: string, userId: string) {
    const job = await this.prisma.jobApplication.findFirst({ where: { id: jobId, userId }, select: { id: true } });
    if (!job) throw new NotFoundException('Job not found');
  }
}
