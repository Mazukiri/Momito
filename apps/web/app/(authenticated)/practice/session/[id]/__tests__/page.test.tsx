import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActiveSessionPage from '../page';
import { sessionsApi, type SessionDetailResponse } from '../../../../../lib/api-client';

const push = vi.fn();
const replace = vi.fn();
// A stable object reference matters here: fetchSession's useCallback depends
// on `router`, and a mock returning a fresh object every call would change
// that dependency's identity on every render, re-triggering the
// useEffect([fetchSession]) that calls it — an infinite fetch loop that
// flickers between loading and loaded.
const router = { push, replace };
const params = { id: 'session-1' };

vi.mock('next/navigation', () => ({
  useParams: () => params,
  useRouter: () => router,
}));

function buildSession(): SessionDetailResponse {
  return {
    id: 'session-1',
    userId: 'user-1',
    title: null,
    sessionType: 'quick_practice',
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sessionQuestions: [
      {
        id: 'sq-1',
        sessionId: 'session-1',
        questionId: 'q-1',
        order: 1,
        question: {
          id: 'q-1',
          title: 'Leading without formal authority',
          prompt: 'Describe a time you led without formal authority.',
          type: 'behavioral',
          difficulty: 'hard',
          topicId: 'topic-1',
          referenceAnswer: null,
          notes: null,
          sourceUrl: null,
          roleTags: [],
          areaTags: [],
          patternTags: [],
          estimatedMinutes: null,
          rubric: null,
          importance: 1,
          createdByUserId: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          topic: { id: 'topic-1', name: 'Behavioral' },
          companies: [],
        },
      },
    ],
    answerAttempts: [],
  } as unknown as SessionDetailResponse;
}

describe('ActiveSessionPage — answer submit payload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    push.mockClear();
    replace.mockClear();
  });

  it('submits self-rating, miss tags, and reflection note alongside the answer text', async () => {
    vi.spyOn(sessionsApi, 'get').mockResolvedValue(buildSession());
    const answerSpy = vi.spyOn(sessionsApi, 'answer').mockResolvedValue({} as never);

    render(<ActiveSessionPage />);

    const textarea = await screen.findByLabelText('Your Answer');
    fireEvent.change(textarea, { target: { value: 'I organized a cross-team migration without direct authority.' } });

    // Self-rating: click the "4/5" star.
    fireEvent.click(screen.getByTitle('4 / 5'));

    // Expand reflection, tag one miss reason, add a note.
    fireEvent.click(screen.getByText('+ Add reflection (optional)'));
    fireEvent.click(screen.getByText('Struggled to explain it'));
    fireEvent.change(screen.getByPlaceholderText('Anything else worth remembering next time?'), {
      target: { value: 'Should have led with the outcome.' },
    });

    fireEvent.click(screen.getByText('Submit Answer'));

    await waitFor(() => expect(answerSpy).toHaveBeenCalledTimes(1));
    const [sessionId, payload] = answerSpy.mock.calls[0];
    expect(sessionId).toBe('session-1');
    expect(payload).toMatchObject({
      questionId: 'q-1',
      answerText: 'I organized a cross-team migration without direct authority.',
      selfRating: 4,
      missTags: ['communication_gap'],
      reflectionNote: 'Should have led with the outcome.',
    });
    expect(typeof payload.timeSpentSeconds).toBe('number');
  });

  it('omits selfRating/missTags/reflectionNote entirely when left at their defaults', async () => {
    vi.spyOn(sessionsApi, 'get').mockResolvedValue(buildSession());
    const answerSpy = vi.spyOn(sessionsApi, 'answer').mockResolvedValue({} as never);

    render(<ActiveSessionPage />);

    const textarea = await screen.findByLabelText('Your Answer');
    fireEvent.change(textarea, { target: { value: 'A minimal answer with no extras.' } });
    fireEvent.click(screen.getByText('Submit Answer'));

    await waitFor(() => expect(answerSpy).toHaveBeenCalledTimes(1));
    const [, payload] = answerSpy.mock.calls[0];
    expect(payload.selfRating).toBeUndefined();
    expect(payload.missTags).toBeUndefined();
    expect(payload.reflectionNote).toBeUndefined();
  });
});
