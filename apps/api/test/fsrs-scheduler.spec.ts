import { describe, expect, it } from 'vitest';
import { createInitialReviewState, scheduleNextReview, selfRatingToGrade } from '../src/reviews/fsrs-scheduler';

describe('fsrs-scheduler', () => {
  it('creates an initial New-state card due immediately', () => {
    const now = new Date('2026-07-05T00:00:00.000Z');
    const initial = createInitialReviewState(now);

    expect(initial.state).toBe(0);
    expect(initial.reps).toBe(0);
    expect(initial.lapses).toBe(0);
    expect(initial.lastReviewedAt).toBeNull();
  });

  it('maps the 1-5 self-rating scale onto FSRS Again/Hard/Good/Easy grades', () => {
    expect(selfRatingToGrade(1)).toBe(1); // Again
    expect(selfRatingToGrade(2)).toBe(2); // Hard
    expect(selfRatingToGrade(3)).toBe(3); // Good
    expect(selfRatingToGrade(4)).toBe(3); // Good
    expect(selfRatingToGrade(5)).toBe(4); // Easy
  });

  it('schedules a later due date for a higher self-rating than a lower one', () => {
    const now = new Date('2026-07-05T00:00:00.000Z');
    const initial = createInitialReviewState(now);

    const afterAgain = scheduleNextReview(initial, 1, now);
    const afterEasy = scheduleNextReview(initial, 5, now);

    expect(afterAgain.reps).toBe(1);
    expect(afterEasy.reps).toBe(1);
    expect(afterEasy.due.getTime()).toBeGreaterThan(afterAgain.due.getTime());
    expect(afterEasy.lastReviewedAt?.getTime()).toBe(now.getTime());
  });

  it('increments lapses when a review is graded Again after being in Review state', () => {
    const now = new Date('2026-07-05T00:00:00.000Z');
    let state = createInitialReviewState(now);
    state = scheduleNextReview(state, 5, now); // -> Review state

    const later = new Date(state.due.getTime() + 24 * 60 * 60 * 1000);
    const lapsed = scheduleNextReview(state, 1, later);

    expect(lapsed.lapses).toBe(1);
  });
});
