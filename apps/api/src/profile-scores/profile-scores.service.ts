import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Profile, ProfileScore } from '@prisma/client';
import {
  AtsCoverageResponse,
  ProfileExperienceItem,
  ProfileProjectItem,
  ProfileScoreResponse,
  ROLE_TEMPLATES,
  RoleTemplate,
  RoleTemplateId,
} from '@momito/shared';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfileScoreDto } from './dto/create-profile-score.dto';

type ScoreResult = {
  skillsMatch: number;
  projectQuality: number;
  experienceDepth: number;
  presentation: number;
  skillsGaps: string[];
  projectGaps: string[];
  experienceGaps: string[];
  presentationGaps: string[];
  suggestions: string[];
};

const METRIC_PATTERN = /\d+[%x]|\d+\s?(ms|seconds?|users?|requests?|gb|tb|mb|k|m)\b/gi;
const ACTION_VERBS = new Set([
  'built',
  'designed',
  'led',
  'implemented',
  'optimized',
  'reduced',
  'increased',
  'developed',
  'architected',
  'scaled',
  'delivered',
  'launched',
  'created',
]);

@Injectable()
export class ProfileScoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProfileScoreDto, userId: string): Promise<ProfileScoreResponse> {
    const template = ROLE_TEMPLATES[dto.role];
    if (!template) throw new BadRequestException('Unknown role template');

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('No profile yet. Upload your CV first.');

    const jdText = dto.jdText?.trim() || null;
    const jdSkills = jdText ? this.extractJdSkills(jdText) : undefined;
    const result = this.computeScore(profile, template, jdSkills);
    const targetId = jdText ? `jd:${createHash('sha256').update(jdText).digest('hex').slice(0, 12)}` : dto.role;
    const targetLabel = jdText ? `${template.label} (custom JD)` : template.label;

    const score = await this.prisma.profileScore.create({
      data: {
        userId,
        profileId: profile.id,
        targetId,
        targetLabel,
        roleTemplate: dto.role,
        jdText,
        skillsMatch: result.skillsMatch,
        projectQuality: result.projectQuality,
        experienceDepth: result.experienceDepth,
        presentation: result.presentation,
        skillsGaps: result.skillsGaps,
        projectGaps: result.projectGaps,
        experienceGaps: result.experienceGaps,
        presentationGaps: result.presentationGaps,
        suggestions: result.suggestions,
      },
    });

    return this.serialize(score);
  }

  async list(userId: string): Promise<ProfileScoreResponse[]> {
    const scores = await this.prisma.profileScore.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return scores.map((score) => this.serialize(score));
  }

  async get(id: string, userId: string): Promise<ProfileScoreResponse> {
    const score = await this.prisma.profileScore.findFirst({ where: { id, userId } });
    if (!score) throw new NotFoundException('Profile score not found');
    return this.serialize(score);
  }

  // MOM-134-lite: deterministic ATS keyword coverage of the base profile skills
  // against a pasted JD — which JD keywords are present vs missing. Reuses the
  // same extractJdSkills tokenizer the scorer uses. No persistence, no AI.
  async atsCoverage(jdText: string, userId: string): Promise<AtsCoverageResponse> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const have = new Set(this.asStringArray(profile?.skills ?? []).map((skill) => this.normalize(skill)));
    const jdKeywords = this.extractJdSkills(jdText);
    const covered = jdKeywords.filter((keyword) => have.has(this.normalize(keyword)));
    const missing = jdKeywords.filter((keyword) => !have.has(this.normalize(keyword)));
    return {
      jdKeywordCount: jdKeywords.length,
      covered,
      missing,
      coveragePct: jdKeywords.length ? this.round(covered.length / jdKeywords.length) : 0,
    };
  }

  // MOM-135: turn a score's static gap strings into executable Tasks (the same
  // checklist→Task move as jobs.service.generatePrep), so a diagnosis becomes
  // an action list. Idempotent by title — re-running skips gaps already tasked.
  async generateTasks(id: string, userId: string): Promise<{ created: number }> {
    const score = await this.prisma.profileScore.findFirst({ where: { id, userId } });
    if (!score) throw new NotFoundException('Profile score not found');

    const candidates = this.gapTasks(score);
    if (candidates.length === 0) return { created: 0 };

    const existing = await this.prisma.task.findMany({
      where: { userId, title: { in: candidates.map((task) => task.title) } },
      select: { title: true },
    });
    const existingTitles = new Set(existing.map((task) => task.title));
    const toCreate = candidates.filter((task) => !existingTitles.has(task.title));
    if (toCreate.length === 0) return { created: 0 };

    const notes = `From your "${score.targetLabel}" profile score.`;
    const result = await this.prisma.task.createMany({
      data: toCreate.map((task) => ({
        userId,
        type: 'study',
        status: 'todo',
        priority: task.priority,
        title: task.title,
        notes,
      })),
    });
    return { created: result.count };
  }

  // Gaps in priority order: skills (high) → experience/projects (medium) →
  // presentation (low). Capped so one score can't flood the task list.
  private gapTasks(score: ProfileScore): Array<{ title: string; priority: string }> {
    const tasks: Array<{ title: string; priority: string }> = [];
    const push = (gaps: Prisma.JsonValue, priority: string, take: number) => {
      for (const gap of this.asStringArray(gaps).slice(0, take)) {
        tasks.push({ title: `Résumé gap: ${gap}`.slice(0, 190), priority });
      }
    };
    push(score.skillsGaps, 'high', 3);
    push(score.experienceGaps, 'medium', 2);
    push(score.projectGaps, 'medium', 2);
    push(score.presentationGaps, 'low', 1);
    return tasks.slice(0, 6);
  }

  private computeScore(profile: Profile, template: RoleTemplate, jdSkills?: string[]): ScoreResult {
    const skills = this.asStringArray(profile.skills);
    const projects = this.asProjectArray(profile.projects);
    const experience = this.asExperienceArray(profile.experience);
    const [skillsMatch, skillsGaps] = this.scoreSkills(skills, template, jdSkills);
    const [projectQuality, projectGaps] = this.scoreProjects(projects, template);
    const [experienceDepth, experienceGaps] = this.scoreExperience(experience, template);
    const [presentation, presentationGaps] = this.scorePresentation(profile, skills, projects, experience);

    return {
      skillsMatch,
      projectQuality,
      experienceDepth,
      presentation,
      skillsGaps,
      projectGaps,
      experienceGaps,
      presentationGaps,
      suggestions: this.generateSuggestions({ skillsGaps, projectGaps, experienceGaps, presentationGaps }),
    };
  }

  private scoreSkills(skills: string[], template: RoleTemplate, jdSkills: string[] | undefined): [number, string[]] {
    const have = new Set(skills.map((skill) => this.normalize(skill)));
    const requiredLabels = this.uniqueByNormalized([...(jdSkills ?? []), ...(template.requiredSkills ?? [])]);
    const preferredLabels = this.uniqueByNormalized(template.preferredSkills ?? []);
    const required = new Set(requiredLabels.map(this.normalize));
    const preferred = new Set(preferredLabels.map(this.normalize));
    const reqHits = [...required].filter((skill) => have.has(skill)).length;
    const prefHits = [...preferred].filter((skill) => have.has(skill)).length;
    const reqScore = reqHits / Math.max(required.size, 1);
    const prefScore = preferred.size ? prefHits / preferred.size : 1;
    const gaps = [
      ...requiredLabels.filter((skill) => !have.has(this.normalize(skill))).slice(0, 6).map((skill) => `Missing required skill: ${skill}`),
      ...preferredLabels.filter((skill) => !have.has(this.normalize(skill))).slice(0, 3).map((skill) => `Missing preferred skill: ${skill}`),
    ];
    return [this.round(0.8 * reqScore + 0.2 * prefScore), gaps];
  }

  private scoreProjects(projects: ProfileProjectItem[], template: RoleTemplate): [number, string[]] {
    if (projects.length === 0) return [0, ['No projects found in profile']];

    const projectScore = (project: ProfileProjectItem): number => {
      const text = `${project.name} ${project.description} ${project.type}`.toLowerCase();
      const archetypeHits = template.projectArchetypes.filter((item) => text.includes(item.toLowerCase())).length;
      const archetypeScore = Math.min((archetypeHits / Math.max(template.projectArchetypes.length, 1)) * 3, 1);
      const starScore = Math.min((project.githubStars ?? 0) / 100, 0.3);
      const urlBonus = project.url ? 0.1 : 0;
      return Math.min(archetypeScore + starScore + urlBonus, 1);
    };

    const topProjects = [...projects].sort((left, right) => projectScore(right) - projectScore(left)).slice(0, 3);
    const score = topProjects.reduce((sum, project) => sum + projectScore(project), 0) / Math.max(topProjects.length, 1);
    const matchedArchetypes = new Set<string>();
    for (const project of projects) {
      const text = `${project.name} ${project.description} ${project.type}`.toLowerCase();
      for (const archetype of template.projectArchetypes) {
        if (text.includes(archetype.toLowerCase())) matchedArchetypes.add(archetype);
      }
    }
    const gaps = template.projectArchetypes
      .filter((archetype) => !matchedArchetypes.has(archetype))
      .slice(0, 4)
      .map((archetype) => `No project evidence for: ${archetype}`);
    if (projects.length < 3) gaps.push('Fewer than 3 projects in profile');
    return [this.round(score), gaps];
  }

  private scoreExperience(experience: ProfileExperienceItem[], template: RoleTemplate): [number, string[]] {
    if (experience.length === 0) return [0, ['No work experience found in profile']];
    const weightedYears = experience.reduce(
      (sum, item) => sum + (Number(item.years) || 0) * (template.tierWeights[item.tier] ?? template.tierWeights.Unknown ?? 0.1),
      0,
    );
    const totalYears = experience.reduce((sum, item) => sum + (Number(item.years) || 0), 0);
    const score = Math.min(weightedYears / (template.minYears * 3), 1);
    const gaps: string[] = [];
    if (totalYears < template.minYears) gaps.push(`Experience (${totalYears.toFixed(1)} years) below target (${template.minYears} years)`);
    if (!experience.some((item) => (template.tierWeights[item.tier] ?? 0) >= 0.7)) {
      gaps.push('No high-signal company, lab, or production experience tagged yet');
    }
    return [this.round(score), gaps];
  }

  private scorePresentation(
    profile: Profile,
    skills: string[],
    projects: ProfileProjectItem[],
    experience: ProfileExperienceItem[],
  ): [number, string[]] {
    const gaps: string[] = [];
    let score = 0;

    if (profile.email) score += 0.1;
    if (profile.githubUrl) score += 0.05;
    if (profile.linkedinUrl) score += 0.05;
    if (!profile.githubUrl) gaps.push('No GitHub URL in profile');

    const descriptions = experience.map((item) => item.description).join(' ');
    const metricHits = descriptions.match(METRIC_PATTERN)?.length ?? 0;
    const verbHits = descriptions.toLowerCase().split(/\W+/).filter((word) => ACTION_VERBS.has(word)).length;
    score += Math.min(metricHits / 5, 0.2) + Math.min(verbHits / 10, 0.2);
    if (metricHits < 3) gaps.push('Few quantified metrics in experience descriptions');
    if (verbHits < 5) gaps.push('Use stronger action verbs in experience descriptions');

    score += Math.min(skills.length / 20, 0.2);
    if (skills.length < 8) gaps.push(`Only ${skills.length} skills listed`);

    const projectsWithUrl = projects.filter((project) => Boolean(project.url)).length;
    score += Math.min(projectsWithUrl / 3, 0.2);
    if (projectsWithUrl < 2) gaps.push('Add URLs to at least two projects');

    return [this.round(score), gaps];
  }

  private extractJdSkills(jdText: string): string[] {
    const tokens = jdText.match(/[A-Z][A-Za-z+#.]{1,30}/g) ?? [];
    const stop = new Set(['The', 'We', 'You', 'Our', 'This', 'Must', 'Will', 'And', 'For', 'With']);
    return this.uniqueByNormalized(tokens.filter((token) => !stop.has(token)));
  }

  private generateSuggestions(gaps: {
    skillsGaps: string[];
    projectGaps: string[];
    experienceGaps: string[];
    presentationGaps: string[];
  }): string[] {
    const suggestions: string[] = [];
    if (gaps.skillsGaps.length) suggestions.push(`Prioritize ${gaps.skillsGaps[0].replace(/^Missing required skill: /, '')}.`);
    if (gaps.projectGaps.length) suggestions.push(`Add one project that demonstrates ${gaps.projectGaps[0].replace(/^No project evidence for: /, '')}.`);
    if (gaps.experienceGaps.length) suggestions.push('Rewrite experience bullets with scope, ownership, and measurable impact.');
    if (gaps.presentationGaps.length) suggestions.push('Tighten profile presentation before applying to this target.');
    return suggestions;
  }

  private serialize(score: ProfileScore): ProfileScoreResponse {
    return {
      id: score.id,
      userId: score.userId,
      profileId: score.profileId,
      targetId: score.targetId,
      targetLabel: score.targetLabel,
      roleTemplate: score.roleTemplate as RoleTemplateId,
      jdText: score.jdText,
      skillsMatch: score.skillsMatch,
      projectQuality: score.projectQuality,
      experienceDepth: score.experienceDepth,
      presentation: score.presentation,
      skillsGaps: this.asStringArray(score.skillsGaps),
      projectGaps: this.asStringArray(score.projectGaps),
      experienceGaps: this.asStringArray(score.experienceGaps),
      presentationGaps: this.asStringArray(score.presentationGaps),
      suggestions: this.asStringArray(score.suggestions),
      createdAt: score.createdAt.toISOString(),
    };
  }

  private asStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private asExperienceArray(value: Prisma.JsonValue): ProfileExperienceItem[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      const source = item as Partial<ProfileExperienceItem>;
      return {
        company: String(source.company ?? ''),
        role: String(source.role ?? ''),
        years: Number(source.years ?? 0),
        tier: String(source.tier ?? 'Unknown'),
        description: String(source.description ?? ''),
      };
    });
  }

  private asProjectArray(value: Prisma.JsonValue): ProfileProjectItem[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      const source = item as Partial<ProfileProjectItem>;
      return {
        name: String(source.name ?? ''),
        url: source.url ? String(source.url) : null,
        description: String(source.description ?? ''),
        type: String(source.type ?? ''),
        githubStars: Number(source.githubStars ?? 0),
      };
    });
  }

  private normalize(value: string): string {
    return value.toLowerCase().trim();
  }

  private uniqueByNormalized(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
      const normalized = this.normalize(value);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(value.trim());
    }
    return result;
  }

  private round(value: number): number {
    return Math.round(Math.min(value, 1) * 1000) / 1000;
  }
}
