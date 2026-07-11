// MOM-136/137/138 structured-output schemas for résumé AI. Colocated with the
// service exactly like grade-result.schema.ts (not in @momito/shared) because
// zodOutputFormat() needs zod's v4 API surface, which only the API depends on;
// the web consumes the plain response interfaces exported from @momito/shared.
import * as z from 'zod/v4';

// MOM-136 — per-bullet impact/seniority analysis of a résumé.
export const ResumeAnalysisSchema = z.object({
  overallImpression: z.string().describe('Two or three sentences on the résumé overall, for the target role.'),
  bulletFeedback: z
    .array(
      z.object({
        index: z.number().int().describe('The 0-based number of the enumerated bullet this entry critiques.'),
        original: z.string().describe('The résumé bullet or line being critiqued, verbatim.'),
        impactScore: z.number().min(0).max(5).describe('0-5: how much measurable impact this bullet conveys.'),
        senioritySignal: z
          .enum(['junior', 'mid', 'senior', 'staff'])
          .describe('The seniority this bullet signals to a reader.'),
        issue: z.string().describe('What weakens this bullet (vague verb, no metric, scope unclear, …).'),
        suggestion: z.string().describe('A concrete way to strengthen it.'),
      }),
    )
    .describe('One entry per notable bullet, strongest-issue first.'),
  missingThemes: z.array(z.string()).describe('Themes/keywords the target role expects that the résumé lacks.'),
});
export type ResumeAnalysis = z.infer<typeof ResumeAnalysisSchema>;

// MOM-137 — rewrite weak bullets, tailored to a target JD.
export const BulletRewriteSchema = z.object({
  rewrites: z
    .array(
      z.object({
        original: z.string().describe('The original bullet, verbatim, so the client can match+replace it.'),
        rewritten: z.string().describe('The improved bullet: strong verb, quantified impact, right seniority.'),
        rationale: z.string().describe('One sentence on what changed and why.'),
      }),
    )
    .describe('One rewrite per weak bullet worth improving.'),
});
export type BulletRewrite = z.infer<typeof BulletRewriteSchema>;

// MOM-138 — a first-draft cover letter, with an explicit visa-context paragraph.
export const CoverLetterDraftSchema = z.object({
  draftMarkdown: z.string().describe('The full cover letter as Markdown, addressed generically.'),
  visaFramingParagraph: z
    .string()
    .describe('A standalone paragraph framing visa/sponsorship needs positively, for the candidate to slot in or drop.'),
  wordCount: z.number().int().describe('Approximate word count of draftMarkdown.'),
});
export type CoverLetterDraft = z.infer<typeof CoverLetterDraftSchema>;
