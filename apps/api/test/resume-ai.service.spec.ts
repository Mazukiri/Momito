import Anthropic from '@anthropic-ai/sdk';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResumeAiOrchestrator } from '../src/ai/resume-ai.orchestrator';
import { ResumeAiService } from '../src/ai/resume-ai.service';

// MOM-136/137/138 — every test here is fully mocked; no test may reach the network.
// The live path stays VERIFICATION-BLOCKED until a real ANTHROPIC_API_KEY exists.

const CONTENT_MD = '# Ada\n\n## Experience\n### SWE — Meta\n- Worked on the backend.\n- Cut p99 latency 40% on the payments path.';

const ANALYSIS = {
  overallImpression: 'Solid but under-quantified.',
  bulletFeedback: [
    { index: 0, original: 'Worked on the backend.', impactScore: 1, senioritySignal: 'junior' as const, issue: 'Vague verb, no metric.', suggestion: 'Name the system and the impact.' },
    { index: 1, original: 'Cut p99 latency 40% on the payments path.', impactScore: 4, senioritySignal: 'mid' as const, issue: 'Strong; scope of the system is unstated.', suggestion: 'Add the traffic the path carried.' },
  ],
  missingThemes: ['distributed systems'],
};

const CTX = { targetRoleTrackId: null };

const REWRITES = {
  rewrites: [
    { original: 'Worked on the backend.', rewritten: 'Built the payments backend serving 2M req/day.', rationale: 'Adds scope and a metric.' },
  ],
};

const COVER_LETTER = { draftMarkdown: '# Dear team\n\nI…', visaFramingParagraph: 'I hold F-1 OPT…', wordCount: 240 };

function serviceWithFakeClient(parse: ReturnType<typeof vi.fn>) {
  class FakeResumeAiService extends ResumeAiService {
    protected createClient() {
      return { messages: { parse } } as unknown as Anthropic;
    }
  }
  return new FakeResumeAiService();
}

function okResponse(parsed: unknown) {
  return { parsed_output: parsed, usage: { input_tokens: 400, output_tokens: 200 } };
}

describe('ResumeAiService (MOM-136/137/138, dormant-until-key)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports unavailable and never calls the network when no key is configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const service = new ResumeAiService();

    expect(service.isAvailable()).toBe(false);
    await expect(service.analyze(CONTENT_MD, CTX)).resolves.toEqual({ ok: false, reason: expect.stringContaining('not configured') });
    await expect(service.rewriteBullets(CONTENT_MD, 'JD')).resolves.toEqual({ ok: false, reason: expect.stringContaining('not configured') });
    await expect(service.draftCoverLetter(CONTENT_MD, 'JD')).resolves.toEqual({ ok: false, reason: expect.stringContaining('not configured') });
  });

  it('parses a successful analysis (MOM-136)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn().mockResolvedValue(okResponse(ANALYSIS));

    const outcome = await serviceWithFakeClient(parse).analyze(CONTENT_MD, { targetRoleTrackId: 'google-l4-swe' });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result).toEqual(ANALYSIS);
      expect(outcome.inputTokens).toBe(400);
      expect(outcome.model).toBe('claude-opus-4-8');
    }
    const call = parse.mock.calls[0][0];
    expect(call.thinking).toEqual({ type: 'adaptive' });
    expect(call.messages[0].content).toContain('google-l4-swe');
    expect(call.messages[0].content).toContain(CONTENT_MD);
  });

  // MOM-147. Cheaper models silently critique only a few bullets when asked to "review the
  // résumé" — Gemini 3.1 Pro covered 3 of 14 on a real CV. Finding the bullets in code and
  // demanding one entry each is what makes coverage model-independent.
  it('extracts bullets deterministically, ignoring prose and headings (MOM-147)', () => {
    const bullets = ResumeAiService.extractBullets(
      '# Ada\n## Experience\nProse line, not a bullet.\n- Built the thing that scaled.\n* Starred bullet counts too.\n- short\n• Unicode bullet counts too.\n',
    );
    expect(bullets).toEqual([
      'Built the thing that scaled.',
      'Starred bullet counts too.',
      'Unicode bullet counts too.',
    ]);
    // "- short" (<= 15 chars) is dropped as noise, and headings/prose never count.
  });

  it('enumerates every bullet and demands one entry each (MOM-147)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn().mockResolvedValue(okResponse(ANALYSIS));

    await serviceWithFakeClient(parse).analyze(CONTENT_MD, CTX);

    const call = parse.mock.calls[0][0];
    expect(call.messages[0].content).toContain('0. Worked on the backend.');
    expect(call.messages[0].content).toContain('1. Cut p99 latency 40% on the payments path.');
    expect(call.messages[0].content).toContain('return exactly 2 entries');
    expect(call.system).toContain('COMPLETENESS IS MANDATORY');
    // PDF-extracted résumés carry mangled spacing; feedback must not be spent on it.
    expect(call.system).toContain('Ignore all formatting');
  });

  it('refuses a résumé with no bullets instead of calling the model (MOM-147)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn();

    const outcome = await serviceWithFakeClient(parse).analyze('# Ada\n\nJust prose, no bullets.', CTX);

    expect(outcome).toEqual({ ok: false, reason: expect.stringContaining('no bullet points') });
    expect(parse).not.toHaveBeenCalled(); // no spend on an un-analysable résumé
  });

  // MOM-148 — the completeness contract is only worth something if we CHECK it. Accepting a
  // short answer silently is precisely what let a cheap model look like a bargain.
  it('repairs an incomplete analysis instead of accepting it silently (MOM-148)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const partial = { ...ANALYSIS, bulletFeedback: [ANALYSIS.bulletFeedback[0]] }; // skipped bullet 1
    const repaired = { ...ANALYSIS, bulletFeedback: [ANALYSIS.bulletFeedback[1]] };
    const parse = vi.fn()
      .mockResolvedValueOnce(okResponse(partial))
      .mockResolvedValueOnce(okResponse(repaired));

    const outcome = await serviceWithFakeClient(parse).analyze(CONTENT_MD, CTX);

    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[1][0].messages[0].content).toContain('You previously skipped these bullets');
    expect(parse.mock.calls[1][0].messages[0].content).toContain('1. Cut p99 latency 40% on the payments path.');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.bulletFeedback.map((b) => b.index)).toEqual([0, 1]); // merged + ordered
      expect(outcome.inputTokens).toBe(800); // both calls are billed, not just the first
      expect(outcome.outputTokens).toBe(400);
    }
  });

  it('keeps the partial audit if the repair pass itself fails (MOM-148)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const partial = { ...ANALYSIS, bulletFeedback: [ANALYSIS.bulletFeedback[0]] };
    const parse = vi.fn()
      .mockResolvedValueOnce(okResponse(partial))
      .mockRejectedValueOnce(new Anthropic.RateLimitError(429, {}, 'slow down', new Headers()));

    const outcome = await serviceWithFakeClient(parse).analyze(CONTENT_MD, CTX);

    // half an audit beats no audit — the user still sees the bullet that was critiqued
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.bulletFeedback).toHaveLength(1);
  });

  // MOM-149 — a critique is only as good as the target it is held against.
  it('judges the résumé against a specific job, JD and company focus areas (MOM-149)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn().mockResolvedValue(okResponse(ANALYSIS));

    await serviceWithFakeClient(parse).analyze(CONTENT_MD, {
      targetRoleTrackId: null,
      job: { company: 'Meta', role: 'Backend Engineer', jdText: 'Go, low-latency payments.', focusAreas: ['system_design', 'dsa'] },
    });

    const content = parse.mock.calls[0][0].messages[0].content;
    expect(content).toContain('Backend Engineer at Meta');
    expect(content).toContain('system_design, dsa');
    expect(content).toContain('Go, low-latency payments.');
    expect(content).toContain('Judge every bullet against THIS job');
  });

  // MOM-150 — the model cannot invent a metric it was never told. Feed it the profile and it can
  // point at a number the candidate already claims instead of emitting a placeholder.
  it('grounds suggestions in the profile evidence (MOM-150)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn().mockResolvedValue(okResponse(ANALYSIS));

    await serviceWithFakeClient(parse).analyze(CONTENT_MD, {
      targetRoleTrackId: null,
      evidence: { skills: ['Go'], projects: ['Ledger — 5,000 RPS sustained'], experience: [] },
    });

    const content = parse.mock.calls[0][0].messages[0].content;
    expect(content).toContain('5,000 RPS sustained');
    expect(content).toContain('prefer a suggestion grounded in the evidence above over a');
    expect(content).toContain('Never invent facts');
  });

  it('parses bullet rewrites and passes the JD through (MOM-137)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn().mockResolvedValue(okResponse(REWRITES));

    const outcome = await serviceWithFakeClient(parse).rewriteBullets(CONTENT_MD, 'We need payments experience.');

    expect(outcome.ok && outcome.result).toEqual(REWRITES);
    expect(parse.mock.calls[0][0].messages[0].content).toContain('We need payments experience.');
  });

  it('parses a cover-letter draft (MOM-138)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const parse = vi.fn().mockResolvedValue(okResponse(COVER_LETTER));

    const outcome = await serviceWithFakeClient(parse).draftCoverLetter(CONTENT_MD, 'JD text');

    expect(outcome.ok && outcome.result).toEqual(COVER_LETTER);
  });

  it('returns a structured failure (never throws) on a schema miss or an API error', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    const unparsed = vi.fn().mockResolvedValue({ parsed_output: null, usage: { input_tokens: 1, output_tokens: 1 } });
    await expect(serviceWithFakeClient(unparsed).analyze(CONTENT_MD, CTX))
      .resolves.toEqual({ ok: false, reason: expect.stringContaining('did not match') });

    const rateLimited = vi.fn().mockRejectedValue(new Anthropic.RateLimitError(429, {}, 'slow down', new Headers()));
    await expect(serviceWithFakeClient(rateLimited).analyze(CONTENT_MD, CTX))
      .resolves.toEqual({ ok: false, reason: expect.stringContaining('rate-limited') });

    const badKey = vi.fn().mockRejectedValue(new Anthropic.AuthenticationError(401, {}, 'bad key', new Headers()));
    await expect(serviceWithFakeClient(badKey).analyze(CONTENT_MD, CTX))
      .resolves.toEqual({ ok: false, reason: expect.stringContaining('misconfigured') });
  });
});

describe('ResumeAiOrchestrator (MOM-136/137/138)', () => {
  afterEach(() => vi.unstubAllEnvs());

  function build(overrides: { resumeAi?: Partial<ResumeAiService>; prisma?: Record<string, unknown>; allowed?: boolean } = {}) {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      resumeVersion: {
        findFirst: vi.fn().mockResolvedValue({ contentMd: CONTENT_MD, targetRoleTrackId: null, jobApplicationId: null }),
        updateMany,
      },
      jobApplication: {
        findFirst: vi.fn().mockResolvedValue({
          company: 'Meta (free text)',
          roleTitle: 'Backend Engineer',
          jdText: 'Go, Kubernetes, low-latency payments.',
          companyRef: { name: 'Meta', focusAreas: { system_design: 5, dsa: 4 } },
        }),
      },
      profile: {
        findUnique: vi.fn().mockResolvedValue({
          skills: ['Go', 'PostgreSQL'],
          projects: [{ name: 'Ledger', impact: '5,000 RPS sustained' }],
          experience: [],
        }),
      },
      ...overrides.prisma,
    };
    const budget = {
      checkAndReserve: vi.fn().mockResolvedValue({ allowed: overrides.allowed ?? true, remainingUsd: 0 }),
      record: vi.fn().mockResolvedValue(undefined),
    };
    const resumeAi = {
      isAvailable: () => true,
      analyze: vi.fn().mockResolvedValue({ ok: true, result: ANALYSIS, inputTokens: 400, outputTokens: 200, model: 'claude-opus-4-8' }),
      rewriteBullets: vi.fn().mockResolvedValue({ ok: true, result: REWRITES, inputTokens: 400, outputTokens: 200, model: 'claude-opus-4-8' }),
      draftCoverLetter: vi.fn().mockResolvedValue({ ok: true, result: COVER_LETTER, inputTokens: 1, outputTokens: 1, model: 'claude-opus-4-8' }),
      ...overrides.resumeAi,
    };
    const orchestrator = new ResumeAiOrchestrator(prisma as never, budget as never, resumeAi as never);
    return { orchestrator, prisma, budget, resumeAi, updateMany };
  }

  // MOM-149 — a version already records the job it was sent to, so a targeted critique is the
  // DEFAULT, not something the user has to opt into.
  it('falls back to the job the version is already linked to (MOM-149)', async () => {
    const { orchestrator, prisma, resumeAi } = build({
      prisma: {
        resumeVersion: {
          findFirst: vi.fn().mockResolvedValue({ contentMd: CONTENT_MD, targetRoleTrackId: null, jobApplicationId: 'job-9' }),
          updateMany: vi.fn(),
        },
      },
    });

    await orchestrator.analyze('rv-1', 'user-1'); // no jobApplicationId passed

    expect((prisma.jobApplication as { findFirst: ReturnType<typeof vi.fn> }).findFirst)
      .toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'job-9', userId: 'user-1' } }));
    const ctx = (resumeAi.analyze as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(ctx.job).toMatchObject({ company: 'Meta', role: 'Backend Engineer' });
    expect(ctx.job.focusAreas).toEqual(['system_design', 'dsa']);
    expect(ctx.evidence.projects[0]).toContain('5,000 RPS');
  });

  // MOM-151 — findings become study tasks. Deduped, because re-running an analysis must not
  // spam the plan; and no model call, because the findings already exist.
  it('turns missing themes into deduped study tasks without spending on the model (MOM-151)', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const { orchestrator, budget, resumeAi } = build({
      prisma: {
        task: {
          findMany: vi.fn().mockResolvedValue([{ title: 'Résumé gap: CUDA' }]), // already tracked
          createMany,
        },
      },
    });

    const result = await orchestrator.themesToTasks('rv-1', 'user-1', ['CUDA', 'GPU Architecture']);

    expect(result).toEqual({ created: 1 }); // CUDA skipped, GPU Architecture created
    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ title: 'Résumé gap: GPU Architecture', type: 'study', status: 'todo', userId: 'user-1' })],
    });
    expect(resumeAi.analyze).not.toHaveBeenCalled();
    expect(budget.checkAndReserve).not.toHaveBeenCalled(); // no AI spend for a bookkeeping action
  });

  it('is dormant with no key: returns {ok:false} without touching the DB, the budget, or the model', async () => {
    const { orchestrator, prisma, budget, resumeAi } = build({ resumeAi: { isAvailable: () => false } });

    const result = await orchestrator.analyze('rv-1', 'user-1');

    expect(result).toEqual({ ok: false, reason: expect.stringContaining('not configured') });
    expect(prisma.resumeVersion.findFirst).not.toHaveBeenCalled();
    expect(budget.checkAndReserve).not.toHaveBeenCalled();
    expect(resumeAi.analyze).not.toHaveBeenCalled();
  });

  it('records real token usage against the shared daily budget on success', async () => {
    const { orchestrator, budget } = build();

    const result = await orchestrator.analyze('rv-1', 'user-1');

    expect(result).toEqual({ ok: true, result: ANALYSIS });
    expect(budget.record).toHaveBeenCalledWith('user-1', 'claude-opus-4-8', 400, 200);
  });

  it('persists rewrites to the version aiSuggestions (MOM-137)', async () => {
    const { orchestrator, updateMany } = build();

    const result = await orchestrator.rewrite('rv-1', 'user-1', 'JD');

    expect(result).toEqual({ ok: true, result: REWRITES });
    expect(updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'rv-1', userId: 'user-1' },
      data: { aiSuggestions: REWRITES.rewrites },
    });
  });

  it('does not persist suggestions when the model call fails', async () => {
    const { orchestrator, updateMany } = build({
      resumeAi: { rewriteBullets: vi.fn().mockResolvedValue({ ok: false, reason: 'rate-limited' }) as never },
    });

    const result = await orchestrator.rewrite('rv-1', 'user-1', 'JD');

    expect(result).toEqual({ ok: false, reason: 'rate-limited' });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('404s on a foreign version and 400s when the daily budget is exhausted', async () => {
    const missing = build({ prisma: { resumeVersion: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn() } } });
    await expect(missing.orchestrator.analyze('rv-1', 'user-2')).rejects.toBeInstanceOf(NotFoundException);

    const broke = build({ allowed: false });
    await expect(broke.orchestrator.analyze('rv-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
