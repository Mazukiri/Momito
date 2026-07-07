import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayReviewCard } from '../TodayReviewCard';
import { attemptsApi, questionsApi, reviewsApi } from '../../lib/api-client';
import type { ReviewStateResponse } from '@momito/shared';

const review: ReviewStateResponse = {
  id: 'rs-1',
  objectType: 'question',
  objectId: 'q-1',
  stability: 1,
  difficulty: 5,
  due: new Date().toISOString(),
  state: 2,
  reps: 3,
  lapses: 0,
  suspended: false,
  lastReviewedAt: null,
  title: 'Two Sum',
};

function mockQuestion() {
  vi.spyOn(questionsApi, 'get').mockResolvedValue({
    id: 'q-1',
    title: 'Two Sum',
    prompt: 'Given an array and a target, return indices of two numbers adding to target.',
    referenceAnswer: 'Use a hash map from value to index for a single O(n) pass.',
    rubric: null,
  } as never);
}

describe('TodayReviewCard — recall → reveal → grade (plan §12.1)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the prompt on expand but withholds the reference and grades until revealed', async () => {
    mockQuestion();
    render(<TodayReviewCard review={review} onDone={vi.fn()} onError={vi.fn()} />);

    fireEvent.click(screen.getByText('Review now'));

    expect(await screen.findByText(/Given an array and a target/)).toBeInTheDocument();
    expect(screen.queryByText(/Use a hash map/)).not.toBeInTheDocument();
    expect(screen.queryByText('Again')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show answer'));

    expect(await screen.findByText(/Use a hash map/)).toBeInTheDocument();
    expect(screen.getByText('Again')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
  });

  it('records a typed recall as a real attempt carrying the grade', async () => {
    mockQuestion();
    const createSpy = vi.spyOn(attemptsApi, 'create').mockResolvedValue({} as never);
    const recordSpy = vi.spyOn(reviewsApi, 'record').mockResolvedValue({} as never);
    const onDone = vi.fn();
    render(<TodayReviewCard review={review} onDone={onDone} onError={vi.fn()} />);

    fireEvent.click(screen.getByText('Review now'));
    fireEvent.change(await screen.findByPlaceholderText(/Recall it from memory/), {
      target: { value: 'Hash map value→index, one pass.' },
    });
    fireEvent.click(screen.getByText('Show answer'));
    fireEvent.click(await screen.findByText('Good'));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: 'q-1', answerText: 'Hash map value→index, one pass.', selfRating: 3 }),
    );
    // The attempt schedules the review server-side — no duplicate grade write.
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it('records only the review grade when the recall was mental-only', async () => {
    mockQuestion();
    const createSpy = vi.spyOn(attemptsApi, 'create').mockResolvedValue({} as never);
    const recordSpy = vi.spyOn(reviewsApi, 'record').mockResolvedValue({} as never);
    const onDone = vi.fn();
    render(<TodayReviewCard review={review} onDone={onDone} onError={vi.fn()} />);

    fireEvent.click(screen.getByText('Review now'));
    fireEvent.click(await screen.findByText('Show answer'));
    fireEvent.click(await screen.findByText('Again'));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(recordSpy).toHaveBeenCalledWith('question', 'q-1', 1);
    expect(createSpy).not.toHaveBeenCalled();
  });
});
