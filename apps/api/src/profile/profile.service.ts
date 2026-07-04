import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Profile as ProfileModel } from '@prisma/client';
import type {
  ProfileEducationItem,
  ProfileExperienceItem,
  ProfileProjectItem,
  ProfileResponse,
} from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PdfParserService } from './pdf-parser.service';

type UploadedCvFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

type ParsedProfile = {
  name: string | null;
  email: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  skills: string[];
  experience: ProfileExperienceItem[];
  education: ProfileEducationItem[];
  projects: ProfileProjectItem[];
  rawCvText: string;
};

type NormalizedProfileData = {
  name?: string | null;
  email?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  skills?: string[];
  experience?: ProfileExperienceItem[];
  education?: ProfileEducationItem[];
  projects?: ProfileProjectItem[];
};

const MAX_CV_BYTES = 5 * 1024 * 1024;

const KNOWN_SKILLS = [
  'Python',
  'JavaScript',
  'TypeScript',
  'Java',
  'Go',
  'C++',
  'C#',
  'SQL',
  'PostgreSQL',
  'MySQL',
  'Redis',
  'Kafka',
  'Kubernetes',
  'Docker',
  'AWS',
  'GCP',
  'Azure',
  'Linux',
  'Node.js',
  'React',
  'Next.js',
  'NestJS',
  'FastAPI',
  'Prisma',
  'GraphQL',
  'gRPC',
  'Protobuf',
  'CUDA',
  'MPI',
  'OpenMP',
  'HPC',
  'Parallel Computing',
  'Performance Optimization',
  'Distributed Systems',
  'System Design',
  'Algorithms',
  'Data Structures',
  'Statistics',
  'Probability',
  'Linear Algebra',
  'Backtesting',
  'Pandas',
  'NumPy',
  'PyTorch',
  'TensorFlow',
  'Machine Learning',
  'Operating Systems',
  'Networking',
];

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfParser: PdfParserService,
  ) {}

  async uploadCv(file: UploadedCvFile | undefined, userId: string): Promise<ProfileResponse> {
    this.validateCvFile(file);
    const rawCvText = await this.pdfParser.extractText(file.buffer as Buffer);
    const parsed = this.parseProfile(rawCvText);
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        name: parsed.name,
        email: parsed.email,
        githubUrl: parsed.githubUrl,
        linkedinUrl: parsed.linkedinUrl,
        skills: this.toJson(parsed.skills),
        experience: this.toJson(parsed.experience),
        education: this.toJson(parsed.education),
        projects: this.toJson(parsed.projects),
        rawCvText: parsed.rawCvText,
      },
      update: {
        name: parsed.name,
        email: parsed.email,
        githubUrl: parsed.githubUrl,
        linkedinUrl: parsed.linkedinUrl,
        skills: this.toJson(parsed.skills),
        experience: this.toJson(parsed.experience),
        education: this.toJson(parsed.education),
        projects: this.toJson(parsed.projects),
        rawCvText: parsed.rawCvText,
      },
    });
    return this.serialize(profile);
  }

  async get(userId: string): Promise<ProfileResponse> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('No profile yet. Upload your CV first.');
    return this.serialize(profile);
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<ProfileResponse> {
    const data = this.normalizeUpdate(dto);
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        name: data.name ?? null,
        email: data.email ?? null,
        githubUrl: data.githubUrl ?? null,
        linkedinUrl: data.linkedinUrl ?? null,
        skills: this.toJson(data.skills ?? []),
        experience: this.toJson(data.experience ?? []),
        education: this.toJson(data.education ?? []),
        projects: this.toJson(data.projects ?? []),
      },
      update: this.toPrismaUpdateData(data),
    });
    return this.serialize(profile);
  }

  private validateCvFile(file: UploadedCvFile | undefined): asserts file is UploadedCvFile & { buffer: Buffer } {
    if (!file?.buffer) throw new BadRequestException('CV PDF file is required.');
    if (file.size && file.size > MAX_CV_BYTES) throw new BadRequestException('CV PDF must be 5MB or smaller.');
    const filename = file.originalname?.toLowerCase() ?? '';
    if (file.mimetype !== 'application/pdf' && !filename.endsWith('.pdf')) {
      throw new BadRequestException('Only PDF CV files are accepted.');
    }
  }

  private parseProfile(rawCvText: string): ParsedProfile {
    const lines = rawCvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      name: this.extractName(lines),
      email: this.firstMatch(rawCvText, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i),
      githubUrl: this.extractUrl(rawCvText, /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_.-]+/i),
      linkedinUrl: this.extractUrl(rawCvText, /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_.-]+\/?/i),
      skills: this.extractSkills(rawCvText),
      experience: this.extractExperience(rawCvText),
      education: this.extractEducation(rawCvText),
      projects: this.extractProjects(rawCvText),
      rawCvText,
    };
  }

  private normalizeUpdate(dto: UpdateProfileDto): NormalizedProfileData {
    return {
      ...(dto.name !== undefined && { name: this.cleanNullable(dto.name) }),
      ...(dto.email !== undefined && { email: this.cleanNullable(dto.email) }),
      ...(dto.githubUrl !== undefined && { githubUrl: this.cleanNullable(dto.githubUrl) }),
      ...(dto.linkedinUrl !== undefined && { linkedinUrl: this.cleanNullable(dto.linkedinUrl) }),
      ...(dto.skills !== undefined && { skills: this.uniqueStrings(dto.skills) }),
      ...(dto.experience !== undefined && { experience: dto.experience.map((item) => this.cleanExperience(item)) }),
      ...(dto.education !== undefined && { education: dto.education.map((item) => this.cleanEducation(item)) }),
      ...(dto.projects !== undefined && { projects: dto.projects.map((item) => this.cleanProject(item)) }),
    };
  }

  private toPrismaUpdateData(data: NormalizedProfileData): Prisma.ProfileUpdateInput {
    return {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.githubUrl !== undefined && { githubUrl: data.githubUrl }),
      ...(data.linkedinUrl !== undefined && { linkedinUrl: data.linkedinUrl }),
      ...(data.skills !== undefined && { skills: this.toJson(data.skills) }),
      ...(data.experience !== undefined && { experience: this.toJson(data.experience) }),
      ...(data.education !== undefined && { education: this.toJson(data.education) }),
      ...(data.projects !== undefined && { projects: this.toJson(data.projects) }),
    };
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private extractName(lines: string[]): string | null {
    const candidate = lines.find((line) =>
      line.length <= 80 &&
      !line.includes('@') &&
      !/https?:\/\//i.test(line) &&
      !/\b(resume|curriculum vitae|cv)\b/i.test(line)
    );
    return candidate ?? null;
  }

  private firstMatch(text: string, pattern: RegExp): string | null {
    return text.match(pattern)?.[0] ?? null;
  }

  private extractUrl(text: string, pattern: RegExp): string | null {
    const match = this.firstMatch(text, pattern);
    if (!match) return null;
    return match.startsWith('http') ? match : `https://${match}`;
  }

  private extractSkills(text: string): string[] {
    const found = KNOWN_SKILLS.filter((skill) => this.skillPattern(skill).test(text));
    return this.uniqueStrings(found);
  }

  private skillPattern(skill: string): RegExp {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (/^[A-Za-z0-9.#+-]+$/.test(skill)) return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, 'i');
    return new RegExp(escaped, 'i');
  }

  private extractExperience(text: string): ProfileExperienceItem[] {
    return this.sectionLines(text, ['experience', 'work experience', 'employment'], ['education', 'projects', 'skills'])
      .slice(0, 4)
      .map((line) => ({
        company: 'Unknown',
        role: line.slice(0, 160),
        years: 0,
        tier: 'Unknown',
        description: line,
      }));
  }

  private extractEducation(text: string): ProfileEducationItem[] {
    return this.sectionLines(text, ['education'], ['experience', 'projects', 'skills'])
      .slice(0, 3)
      .map((line) => ({
        degree: line.slice(0, 160),
        institution: 'Unknown',
        country: '',
        year: this.extractYear(line),
      }));
  }

  private extractProjects(text: string): ProfileProjectItem[] {
    return this.sectionLines(text, ['projects', 'personal projects', 'selected projects'], ['experience', 'education', 'skills'])
      .slice(0, 5)
      .map((line) => ({
        name: line.slice(0, 120),
        url: this.extractUrl(line, /https?:\/\/[^\s)]+/i),
        description: line,
        type: 'unknown',
        githubStars: 0,
      }));
  }

  private sectionLines(text: string, starts: string[], stops: string[]): string[] {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const startIndex = lines.findIndex((line) => starts.some((start) => line.toLowerCase() === start));
    if (startIndex < 0) return [];
    const result: string[] = [];
    for (const line of lines.slice(startIndex + 1)) {
      const lower = line.toLowerCase();
      if (stops.some((stop) => lower === stop)) break;
      if (line.length >= 12 && !starts.includes(lower)) result.push(line);
    }
    return result;
  }

  private extractYear(text: string): number | null {
    const year = Number(text.match(/\b(19|20)\d{2}\b/)?.[0]);
    return Number.isFinite(year) ? year : null;
  }

  private serialize(profile: ProfileModel): ProfileResponse {
    return {
      id: profile.id,
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      githubUrl: profile.githubUrl,
      linkedinUrl: profile.linkedinUrl,
      skills: this.asStringArray(profile.skills),
      experience: this.asExperienceArray(profile.experience),
      education: this.asEducationArray(profile.education),
      projects: this.asProjectArray(profile.projects),
      rawCvText: profile.rawCvText,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private asStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? this.uniqueStrings(value.filter((item): item is string => typeof item === 'string')) : [];
  }

  private asExperienceArray(value: Prisma.JsonValue): ProfileExperienceItem[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => this.cleanExperience(item as Partial<ProfileExperienceItem>));
  }

  private asEducationArray(value: Prisma.JsonValue): ProfileEducationItem[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => this.cleanEducation(item as Partial<ProfileEducationItem>));
  }

  private asProjectArray(value: Prisma.JsonValue): ProfileProjectItem[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => this.cleanProject(item as Partial<ProfileProjectItem>));
  }

  private cleanNullable(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private uniqueStrings(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private cleanExperience(item: Partial<ProfileExperienceItem>): ProfileExperienceItem {
    return {
      company: String(item.company ?? '').trim(),
      role: String(item.role ?? '').trim(),
      years: Number(item.years ?? 0),
      tier: String(item.tier ?? 'Unknown').trim() || 'Unknown',
      description: String(item.description ?? '').trim(),
    };
  }

  private cleanEducation(item: Partial<ProfileEducationItem>): ProfileEducationItem {
    const year = item.year === null || item.year === undefined ? null : Number(item.year);
    return {
      degree: String(item.degree ?? '').trim(),
      institution: String(item.institution ?? '').trim(),
      country: String(item.country ?? '').trim(),
      year: Number.isFinite(year) ? year : null,
    };
  }

  private cleanProject(item: Partial<ProfileProjectItem>): ProfileProjectItem {
    return {
      name: String(item.name ?? '').trim(),
      url: this.cleanNullable(item.url),
      description: String(item.description ?? '').trim(),
      type: String(item.type ?? '').trim(),
      githubStars: Math.max(0, Number(item.githubStars ?? 0)),
    };
  }
}
