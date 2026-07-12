// The Anthropic SDK's zodOutputFormat() expects zod's v4 API surface (which
// this "zod" v3.25+ package ships under the /v4 subpath) — importing plain
// 'zod' here produces a ZodObject the helper's types reject.
import * as z from 'zod/v4';

export const GradeResultSchema = z.object({
  overallScore: z.number().min(0).max(100).describe('Overall score out of 100, weighted by rubric criteria.'),
  criteriaScores: z
    .array(
      z.object({
        // MOM-161: the 0-based number of the enumerated rubric criterion, so coverage is checkable.
        index: z.number().int().describe('The 0-based number of the rubric criterion this entry scores.'),
        criterionId: z.string(),
        criterionTitle: z.string(),
        score: z.number().min(0).max(5).describe('0-5 against this criterion.'),
        comment: z.string().describe('One or two sentences on why this score.'),
      }),
    )
    .describe('One entry per numbered rubric criterion, carrying its index.'),
  strengths: z.array(z.string()).describe('What the answer did well, 1-4 bullet points.'),
  gaps: z.array(z.string()).describe('What is missing or wrong, 1-4 bullet points.'),
  followUpQuestions: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe('1-3 probing follow-up questions an interviewer might ask next.'),
  suggestedRating: z
    .enum(['again', 'hard', 'good', 'easy'])
    .describe('FSRS-style self-rating this answer would deserve, from the grader perspective.'),
});

export type GradeResult = z.infer<typeof GradeResultSchema>;
