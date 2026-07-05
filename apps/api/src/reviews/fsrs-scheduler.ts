import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

// MOM-030 / SPIKE-004: pure FSRS scheduling wrapper. No persistence here — this
// operates on plain state objects shaped exactly like ADR-0002's planned
// ReviewState columns (stability/difficulty/due/state/reps/lapses/lastReviewedAt),
// so MOM-031 can wire it straight to Prisma once the ReviewState migration
// (MOM-027, human-gated per D-004) lands. ts-fsrs's own `State` enum
// (New=0/Learning=1/Review=2/Relearning=3) already matches ADR-0002's planned
// `state: Int` column, so no separate state-code mapping is needed.
export interface ReviewCardState {
  stability: number;
  difficulty: number;
  due: Date;
  state: number;
  reps: number;
  lapses: number;
  lastReviewedAt: Date | null;
}

const scheduler = fsrs();

export function createInitialReviewState(now: Date = new Date()): ReviewCardState {
  const card = createEmptyCard(now);
  return toReviewCardState(card);
}

// The app's self-rating is a 1-5 star scale (CreateAnswerDto: @Min(1) @Max(5)),
// used elsewhere (dashboard averages, DSA/mission positive-attempt checks) and
// left untouched by this mapping. FSRS only has 4 grades, so 3-4 both collapse
// to "Good" — the middle of the star scale is where most self-ratings cluster,
// and splitting 1/2/3-4/5 keeps "Again"/"Easy" reserved for the clear extremes.
const SELF_RATING_TO_GRADE: Record<1 | 2 | 3 | 4 | 5, Grade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Good,
  5: Rating.Easy,
};

export function selfRatingToGrade(selfRating: number): Grade {
  const clamped = Math.min(5, Math.max(1, Math.round(selfRating))) as 1 | 2 | 3 | 4 | 5;
  return SELF_RATING_TO_GRADE[clamped];
}

export function scheduleNextReview(
  current: ReviewCardState,
  selfRating: number,
  now: Date = new Date(),
): ReviewCardState {
  const grade = selfRatingToGrade(selfRating);
  const card = toFsrsCard(current);
  const { card: nextCard } = scheduler.next(card, now, grade);
  return toReviewCardState(nextCard);
}

function toFsrsCard(state: ReviewCardState): Card {
  return {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.lastReviewedAt
      ? Math.max(0, Math.round((state.due.getTime() - state.lastReviewedAt.getTime()) / 86_400_000))
      : 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.lastReviewedAt ?? undefined,
  };
}

function toReviewCardState(card: Card): ReviewCardState {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    due: card.due,
    state: card.state,
    reps: card.reps,
    lapses: card.lapses,
    lastReviewedAt: card.last_review ?? null,
  };
}
