import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActiveSessionPage from '../page';
import { aiApi, attemptsApi, sessionsApi, type SessionDetailResponse } from '../../../../../lib/api-client';

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

function buildQuestion(overrides: { referenceAnswer?: string | null } = {}) {
  return {
    id: 'q-1',
    title: 'Leading without formal authority',
    prompt: 'Describe a time you led without formal authority.',
    type: 'behavioral',
    difficulty: 'hard',
    topicId: 'topic-1',
    referenceAnswer: overrides.referenceAnswer ?? 'Strong answers anchor on influence through credibility and outcomes.',
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
  };
}

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
      { id: 'sq-1', sessionId: 'session-1', questionId: 'q-1', order: 1, question: buildQuestion() },
    ],
    answerAttempts: [],
  } as unknown as SessionDetailResponse;
}

function buildAttempt() {
  return {
    id: 'attempt-1',
    userId: 'user-1',
    sessionId: 'session-1',
    questionId: 'q-1',
    answerText: 'I organized a cross-team migration without direct authority.',
    selfRating: null,
    aiScore: null,
    aiFeedback: null,
    missTags: [],
    reflectionNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mockAiUnavailable() {
  // RevealPanel embeds AiFeedbackCard, which probes /ai/usage on mount — keep
  // tests offline and deterministic.
  vi.spyOn(aiApi, 'usage').mockResolvedValue({ available: false } as never);
}

describe('ActiveSessionPage — answer → reveal → rate lifecycle (plan §7.2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    push.mockClear();
    replace.mockClear();
  });

  it('withholds the reference answer and rating until the answer is submitted, then reveals both', async () => {
    mockAiUnavailable();
    vi.spyOn(sessionsApi, 'get').mockResolvedValue(buildSession());
    const answerSpy = vi.spyOn(sessionsApi, 'answer').mockResolvedValue(buildAttempt() as never);

    render(<ActiveSessionPage />);

    const textarea = await screen.findByLabelText('Your Answer');
    // Answer phase: no reference answer, no rating buttons.
    expect(screen.queryByText(/Strong answers anchor on influence/)).not.toBeInTheDocument();
    expect(screen.queryByText('Again')).not.toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'I organized a cross-team migration without direct authority.' } });
    fireEvent.click(screen.getByText('Submit & reveal answer'));

    await waitFor(() => expect(answerSpy).toHaveBeenCalledTimes(1));
    const [sessionId, payload] = answerSpy.mock.calls[0];
    expect(sessionId).toBe('session-1');
    // The submit carries only the recall — the grade comes after the reveal.
    expect(payload).toMatchObject({
      questionId: 'q-1',
      answerText: 'I organized a cross-team migration without direct authority.',
    });
    expect(payload.selfRating).toBeUndefined();
    expect(typeof payload.timeSpentSeconds).toBe('number');

    // Reveal phase: reference answer, the user's own answer, and the labeled grades.
    expect(await screen.findByText(/Strong answers anchor on influence/)).toBeInTheDocument();
    expect(screen.getByText('I organized a cross-team migration without direct authority.')).toBeInTheDocument();
    for (const label of ['Again', 'Hard', 'Good', 'Easy']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('saves rating with post-reveal reflection through PATCH /attempts/:id', async () => {
    mockAiUnavailable();
    vi.spyOn(sessionsApi, 'get').mockResolvedValue(buildSession());
    vi.spyOn(sessionsApi, 'answer').mockResolvedValue(buildAttempt() as never);
    const updateSpy = vi.spyOn(attemptsApi, 'update').mockResolvedValue({
      ...buildAttempt(),
      selfRating: 3,
      missTags: ['communication_gap'],
      reflectionNote: 'Should have led with the outcome.',
    } as never);

    render(<ActiveSessionPage />);

    fireEvent.change(await screen.findByLabelText('Your Answer'), {
      target: { value: 'I organized a cross-team migration without direct authority.' },
    });
    fireEvent.click(screen.getByText('Submit & reveal answer'));

    // In the reveal, tag a miss reason and add a note *after* seeing the reference.
    fireEvent.click(await screen.findByText('+ Add reflection (optional)'));
    fireEvent.click(screen.getByText('Struggled to explain it'));
    fireEvent.change(screen.getByPlaceholderText('Anything else worth remembering next time?'), {
      target: { value: 'Should have led with the outcome.' },
    });

    fireEvent.click(screen.getByText('Good'));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    const [attemptId, payload] = updateSpy.mock.calls[0];
    expect(attemptId).toBe('attempt-1');
    expect(payload).toMatchObject({
      selfRating: 3,
      missTags: ['communication_gap'],
      reflectionNote: 'Should have led with the outcome.',
    });
    expect(await screen.findByText(/next review scheduled/)).toBeInTheDocument();
  });

  // MOM-168: the AI grade becomes schedulable input — tapping its suggested rating drives the
  // exact same PATCH /attempts/:id path as a manual rating (missTags/reflection included).
  it('lets the AI grade drive the FSRS rating with one tap', async () => {
    vi.spyOn(aiApi, 'usage').mockResolvedValue({ available: true } as never);
    vi.spyOn(aiApi, 'grade').mockResolvedValue({
      attemptId: 'attempt-1', aiScore: 0.6, aiFeedback: 'Solid but under-explained.', suggestedRating: 'good', cached: false,
    } as never);
    vi.spyOn(sessionsApi, 'get').mockResolvedValue(buildSession());
    vi.spyOn(sessionsApi, 'answer').mockResolvedValue(buildAttempt() as never);
    const updateSpy = vi.spyOn(attemptsApi, 'update').mockResolvedValue({ ...buildAttempt(), selfRating: 3 } as never);

    render(<ActiveSessionPage />);

    fireEvent.change(await screen.findByLabelText('Your Answer'), {
      target: { value: 'I organized a cross-team migration without direct authority.' },
    });
    fireEvent.click(screen.getByText('Submit & reveal answer'));

    // In the reveal, grade with AI, then accept its suggested rating.
    fireEvent.click(await screen.findByText('Grade with AI'));
    const suggestBtn = await screen.findByRole('button', { name: /the AI.s suggestion/i });
    fireEvent.click(suggestBtn);

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0][1]).toMatchObject({ selfRating: 3 }); // 'good' → 3
  });

  it('resumes an answered question in the reveal phase instead of asking for a new answer', async () => {
    mockAiUnavailable();
    const session = buildSession();
    (session as unknown as { answerAttempts: unknown[] }).answerAttempts = [buildAttempt()];
    vi.spyOn(sessionsApi, 'get').mockResolvedValue(session);

    render(<ActiveSessionPage />);

    // Loads straight into the reveal for the already-answered question.
    expect(await screen.findByText(/Strong answers anchor on influence/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Your Answer')).not.toBeInTheDocument();
    // And the whole-session completion CTA is available.
    expect(screen.getByText('Complete Session')).toBeInTheDocument();
  });
});
