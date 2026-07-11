import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CareerRoleTrackId,
  ProfileEducationItem,
  ProfileExperienceItem,
  ProfileProjectItem,
  ResumeBulletRewrite,
  ResumeDriftResponse,
  ResumeVersionResponse,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResumeVersionDto } from './dto/create-resume-version.dto';
import { UpdateResumeVersionDto } from './dto/update-resume-version.dto';
import { resumeMarkdownToPdf } from './resume-pdf.util';

export interface ResumeExport {
  filename: string;
  contentType: string;
  body: Buffer;
}

// MOM-157: the stale-version shape the Today loop ranks on.
export interface ResumeDriftSummary {
  id: string;
  label: string;
  jobApplicationId: string | null;
  missingCount: number;
}

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
        // MOM-154: the user accepting or dismissing a rewrite is what retires it. Persisted
        // with contentMd in the same write, so an applied rewrite can never come back.
        ...(dto.aiSuggestions !== undefined && {
          aiSuggestions: dto.aiSuggestions as unknown as Prisma.InputJsonValue,
        }),
      },
    });
    if (result.count === 0) throw new NotFoundException('Résumé version not found');
    return this.get(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.prisma.resumeVersion.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException('Résumé version not found');
  }

  // MOM-155 — résumé drift. `baseProfileSnapshot` has recorded, since MOM-132, exactly what the
  // Profile looked like when a version was cut. Nothing ever read it. So a version quietly rotted:
  // you ship a new project, and the résumé you keep sending still predates it, with no signal.
  // The diff is by identity (skill string / project name / company+role), not by deep equality —
  // an edited description is not something you need to be nagged about; a *missing project* is.
  async drift(id: string, userId: string): Promise<ResumeDriftResponse> {
    const version = await this.prisma.resumeVersion.findFirst({
      where: { id, userId },
      select: { id: true, baseProfileSnapshot: true },
    });
    if (!version) throw new NotFoundException('Résumé version not found');

    const empty = { resumeVersionId: version.id, newSkills: [], newProjects: [], newExperience: [], isStale: false };
    const snapshot = version.baseProfileSnapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      // Hand-written content: there is no provenance to diff against. Say so, don't guess.
      return { ...empty, hasSnapshot: false };
    }

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) return { ...empty, hasSnapshot: true };

    const snap = snapshot as Record<string, Prisma.JsonValue>;
    const newSkills = this.added(
      this.asStringArray(profile.skills),
      this.asStringArray(snap.skills ?? []),
      (skill) => skill.toLowerCase(),
    );
    const newProjects = this.added(
      this.asArray<ProfileProjectItem>(profile.projects),
      this.asArray<ProfileProjectItem>(snap.projects ?? []),
      (project) => (project.name ?? '').toLowerCase(),
    ).map((project) => project.name ?? 'Untitled project');
    const newExperience = this.added(
      this.asArray<ProfileExperienceItem>(profile.experience),
      this.asArray<ProfileExperienceItem>(snap.experience ?? []),
      (role) => `${role.company ?? ''}|${role.role ?? ''}`.toLowerCase(),
    ).map((role) => `${role.role ?? 'Role'} — ${role.company ?? 'Company'}`);

    return {
      resumeVersionId: version.id,
      hasSnapshot: true,
      newSkills,
      newProjects,
      newExperience,
      isStale: newSkills.length + newProjects.length + newExperience.length > 0,
    };
  }

  private added<T>(current: T[], base: T[], key: (item: T) => string): T[] {
    const seen = new Set(base.map(key));
    return current.filter((item) => key(item) !== '' && !seen.has(key(item)));
  }

  // MOM-157: every stale version in one pass — one profile read, one versions read, diffed in
  // memory. Calling drift() per version would be an N+1 on the Today page, which is the one page
  // that must stay fast.
  async driftSummary(userId: string): Promise<ResumeDriftSummary[]> {
    const [profile, versions] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { skills: true, experience: true, projects: true } }),
      this.prisma.resumeVersion.findMany({
        where: { userId },
        select: { id: true, label: true, jobApplicationId: true, baseProfileSnapshot: true },
      }),
    ]);
    if (!profile) return [];

    const summaries: ResumeDriftSummary[] = [];
    for (const version of versions) {
      const snapshot = version.baseProfileSnapshot;
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) continue; // no provenance
      const snap = snapshot as Record<string, Prisma.JsonValue>;
      const missing =
        this.added(this.asStringArray(profile.skills), this.asStringArray(snap.skills ?? []), (s) => s.toLowerCase()).length +
        this.added(
          this.asArray<ProfileProjectItem>(profile.projects),
          this.asArray<ProfileProjectItem>(snap.projects ?? []),
          (p) => (p.name ?? '').toLowerCase(),
        ).length +
        this.added(
          this.asArray<ProfileExperienceItem>(profile.experience),
          this.asArray<ProfileExperienceItem>(snap.experience ?? []),
          (e) => `${e.company ?? ''}|${e.role ?? ''}`.toLowerCase(),
        ).length;
      if (missing > 0) {
        summaries.push({ id: version.id, label: version.label, jobApplicationId: version.jobApplicationId, missingCount: missing });
      }
    }
    return summaries.sort((left, right) => right.missingCount - left.missingCount);
  }

  // MOM-139: export a version as a downloadable file. Markdown = contentMd as-is;
  // PDF = an ATS-safe single-column render (see resume-pdf.util). No new dependency.
  async export(id: string, userId: string, format: string): Promise<ResumeExport> {
    const version = await this.prisma.resumeVersion.findFirst({ where: { id, userId }, select: { label: true, contentMd: true } });
    if (!version) throw new NotFoundException('Résumé version not found');
    const base = (version.label.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'resume').toLowerCase();
    if (format === 'md') {
      return { filename: `${base}.md`, contentType: 'text/markdown; charset=utf-8', body: Buffer.from(version.contentMd, 'utf-8') };
    }
    if (format === 'pdf') {
      return { filename: `${base}.pdf`, contentType: 'application/pdf', body: resumeMarkdownToPdf(version.contentMd) };
    }
    throw new BadRequestException("format must be 'md' or 'pdf'");
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
      aiSuggestions: this.asRewrites(version.aiSuggestions),
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    };
  }

  // MOM-154. The response type promises ResumeBulletRewrite[]; the column is Json, so the
  // promise is only worth something if we check it. Rows written before this shape existed —
  // or by a future writer — are filtered out rather than shipped to the UI as garbage.
  private asRewrites(value: Prisma.JsonValue): ResumeBulletRewrite[] {
    if (!Array.isArray(value)) return [];
    return (value as unknown[]).filter((item): item is ResumeBulletRewrite => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
      const row = item as Record<string, unknown>;
      return typeof row.original === 'string' && typeof row.rewritten === 'string' && typeof row.rationale === 'string';
    });
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
