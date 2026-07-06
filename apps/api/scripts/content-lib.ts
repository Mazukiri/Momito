import { questions, topics, inferQuestionMetadata, type SeedQuestion } from '../prisma/seed-data';

export interface ContentIssue {
  severity: 'error' | 'warning';
  questionTitle: string;
  message: string;
}

// MOM-024 / D-008: crude heuristics for text that looks pasted from a third-party
// problem statement rather than written for this app. Not a legal guarantee —
// a human should still spot-check `content:sample` output before publishing.
//
// The risk D-008 actually guards against is copying an *external* source's text
// (e.g. a LeetCode problem statement) — that only applies to items that link to
// one via `sourceUrl`. Originally-authored content with no external source (CS
// fundamentals, system design, behavioral) can legitimately be long-form without
// being "copied" from anywhere, so the length check only fires when a sourceUrl
// is present; the marker check (literal LeetCode formatting fingerprints) applies
// everywhere since those specific tokens have no legitimate reason to appear.
const COPIED_STATEMENT_MARKERS = ['Example 1:', 'Example 2:', 'Constraints:', 'Output:', 'Input:'];
const SUSPICIOUS_LENGTH_THRESHOLD = 700;

function looksCopied(text: string, hasSourceUrl: boolean): boolean {
  const markerHits = COPIED_STATEMENT_MARKERS.filter((marker) => text.includes(marker)).length;
  return markerHits >= 2 || (hasSourceUrl && text.length > SUSPICIOUS_LENGTH_THRESHOLD);
}

// A2: the rubric's objectId doesn't matter for a structural validity check —
// only used at seed time to tie a rubric to its real question row.
const VALIDATION_QUESTION_ID = 'content-validate';

function hasUsableRubric(question: SeedQuestion): boolean {
  const rubric = inferQuestionMetadata(question, VALIDATION_QUESTION_ID).rubric;
  if (!Array.isArray(rubric.criteria) || rubric.criteria.length < 3) return false;
  const weightSum = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
  return (
    rubric.criteria.every((c) => c.title.trim().length > 0 && c.description.trim().length > 0 && c.weight > 0) &&
    weightSum === rubric.maxScore
  );
}

export function validateContent(): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const seenTitles = new Set<string>();

  for (const question of questions) {
    if (!question.title.trim() || !question.prompt.trim()) {
      issues.push({ severity: 'error', questionTitle: question.title || '(untitled)', message: 'Missing title or prompt.' });
    }

    if (seenTitles.has(question.title)) {
      issues.push({ severity: 'error', questionTitle: question.title, message: 'Duplicate title.' });
    }
    seenTitles.add(question.title);

    if (question.topic < 0 || question.topic >= topics.length) {
      issues.push({ severity: 'error', questionTitle: question.title, message: `Topic index ${question.topic} is out of range.` });
    }

    const hasReferenceAnswer = Boolean(question.answer?.trim());
    const usableRubric = hasUsableRubric(question);
    if (!hasReferenceAnswer && !usableRubric) {
      issues.push({
        severity: 'error',
        questionTitle: question.title,
        message: 'No reference answer and no usable rubric — not safe to publish (plan §8.1).',
      });
    }
    // A2: every question — not just ones missing a reference answer — must
    // have a well-formed rubric (REDESIGN_PLAN.MD's headline content
    // requirement: "every question gets a 3-5-criterion rubric").
    if (!usableRubric) {
      issues.push({
        severity: 'error',
        questionTitle: question.title,
        message: 'Rubric is missing or malformed (expected >=3 criteria with weights summing to maxScore).',
      });
    }

    const metadata = inferQuestionMetadata(question, VALIDATION_QUESTION_ID);
    const hasTags = metadata.roleTags.length > 0 || metadata.areaTags.length > 0 || metadata.patternTags.length > 0;
    if (!hasTags) {
      issues.push({ severity: 'warning', questionTitle: question.title, message: 'No role/area/pattern tags.' });
    }

    const hasSourceUrl = Boolean(question.sourceUrl);
    if (looksCopied(question.prompt, hasSourceUrl) || (question.answer && looksCopied(question.answer, hasSourceUrl))) {
      issues.push({
        severity: 'error',
        questionTitle: question.title,
        message:
          'Prompt/answer text resembles a copied third-party problem statement (D-008: seeds must use original notes + links only).',
      });
    }
  }

  return issues;
}

export function contentStats() {
  const byType = new Map<string, number>();
  const byDifficulty = new Map<string, number>();

  for (const question of questions) {
    byType.set(question.type, (byType.get(question.type) ?? 0) + 1);
    byDifficulty.set(question.difficulty, (byDifficulty.get(question.difficulty) ?? 0) + 1);
  }

  return {
    total: questions.length,
    byType: Object.fromEntries(byType),
    byDifficulty: Object.fromEntries(byDifficulty),
  };
}

export function sampleContent(count: number): SeedQuestion[] {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
