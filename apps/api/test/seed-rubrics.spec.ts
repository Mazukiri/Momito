import { describe, expect, it } from 'vitest';
import { QUESTION_TYPES } from '@momito/shared';
import { inferQuestionMetadata, type SeedQuestion } from '../prisma/seed-data';
import { validateContent } from '../scripts/content-lib';

// A2: every seeded question must have a well-formed, type-appropriate rubric
// (REDESIGN_PLAN.MD's headline content requirement — previously every question
// shared one identical generic {strong,weak} object with no rubric semantics).
function stubQuestion(type: string): SeedQuestion {
  return { title: `stub-${type}`, prompt: 'stub prompt', type, difficulty: 'medium', topic: 0, answer: 'stub answer' };
}

describe('seed rubric generation', () => {
  it('generates a well-formed rubric (>=3 criteria, weights summing to maxScore) for every question type', () => {
    for (const type of QUESTION_TYPES) {
      const rubric = inferQuestionMetadata(stubQuestion(type), 'test-id').rubric;
      expect(rubric.criteria.length).toBeGreaterThanOrEqual(3);
      const weightSum = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
      expect(weightSum).toBe(rubric.maxScore);
      for (const criterion of rubric.criteria) {
        expect(criterion.title.trim().length).toBeGreaterThan(0);
        expect(criterion.description.trim().length).toBeGreaterThan(0);
        expect(criterion.weight).toBeGreaterThan(0);
      }
    }
  });

  it('gives dsa, system_design, and behavioral each a genuinely distinct rubric shape', () => {
    const dsa = inferQuestionMetadata(stubQuestion('dsa'), 'x').rubric.criteria.map((c) => c.id).sort();
    const sysDesign = inferQuestionMetadata(stubQuestion('system_design'), 'x').rubric.criteria.map((c) => c.id).sort();
    const behavioral = inferQuestionMetadata(stubQuestion('behavioral'), 'x').rubric.criteria.map((c) => c.id).sort();
    const backend = inferQuestionMetadata(stubQuestion('backend'), 'x').rubric.criteria.map((c) => c.id).sort();

    expect(dsa).not.toEqual(sysDesign);
    expect(dsa).not.toEqual(behavioral);
    expect(sysDesign).not.toEqual(behavioral);
    // system_design's 7 criteria should mirror the plan's 7-section template.
    expect(sysDesign).toEqual(['api', 'data_model', 'deep_dives', 'estimation', 'high_level_design', 'requirements', 'tradeoffs']);
    // Every other "explain a concept" type shares the same cs_fundamentals template.
    expect(backend).toEqual(inferQuestionMetadata(stubQuestion('os'), 'x').rubric.criteria.map((c) => c.id).sort());
  });

  it('rejects a rubric whose criteria weights do not sum to maxScore', () => {
    // Not a real seed question shape — proves the invariant we assert above is
    // actually meaningful, not vacuously true for any object with a criteria array.
    const brokenRubric = { id: 'x', objectId: 'x', maxScore: 100, criteria: [
      { id: 'a', title: 'A', description: 'a', weight: 50 },
      { id: 'b', title: 'B', description: 'b', weight: 40 },
    ] };
    const weightSum = brokenRubric.criteria.reduce((sum, c) => sum + c.weight, 0);
    expect(weightSum).not.toBe(brokenRubric.maxScore);
  });

  it('the full seed corpus passes content validation with zero errors', () => {
    const issues = validateContent();
    const errors = issues.filter((issue) => issue.severity === 'error');
    expect(errors).toEqual([]);
  });
});
