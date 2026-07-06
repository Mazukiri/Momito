import { describe, expect, it } from 'vitest';
import { MissionsService } from '../src/missions/missions.service';

// missions.service.ts has no other test coverage yet (flagged in the
// production-readiness audit as one of the largest untested services). This
// file is scoped narrowly to the one thing motivating it right now: pinning
// the AI grading scale contract (see the matching dsa.service.spec.ts tests)
// against MissionsService.matchesAttempt's positive-attempt threshold.
// `matchesAttempt` is `private` at compile time only — TS privacy doesn't
// exist at runtime, so it's called directly here rather than exercising the
// full mission-evidence pipeline this method is buried inside.
describe('MissionsService.matchesAttempt (aiScore scale contract)', () => {
  function callMatchesAttempt(attempt: Record<string, unknown>) {
    const service = new MissionsService({} as never) as unknown as {
      matchesAttempt: (attempt: unknown, missionId: string, roleTrackId: string, area: string) => boolean;
    };
    return service.matchesAttempt(
      {
        question: { roleTags: [], areaTags: [] },
        session: null,
        selfRating: null,
        correctness: null,
        rubricScore: null,
        ...attempt,
      },
      'mission-1',
      'big-tech-swe',
      'dsa',
    );
  }

  it('does not treat an AI-graded 55/100 (aiScore 0.55) as a positive match', () => {
    expect(callMatchesAttempt({ aiScore: 0.55 })).toBe(false);
  });

  it('treats an AI-graded 65/100 (aiScore 0.65) as a positive match', () => {
    expect(callMatchesAttempt({ aiScore: 0.65 })).toBe(true);
  });
});
