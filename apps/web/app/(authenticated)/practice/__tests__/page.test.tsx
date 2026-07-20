import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PracticeHubPage from '../page';
import { questionsApi, sessionsApi, weaknessesApi } from '../../../lib/api-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// MOM-175: the practice hub's four tiles all lead somewhere that needs the
// question bank to be non-empty. On a fresh deployment it is empty until the
// seed is run by hand, and the tiles used to render anyway — so every one of
// them dead-ended on "No questions match the selected filters".
function mockApis(options: { questionCount?: number; questionsFail?: boolean } = {}) {
  vi.spyOn(sessionsApi, 'list').mockResolvedValue({ data: [] } as never);
  vi.spyOn(weaknessesApi, 'summary').mockResolvedValue({
    windowDays: 30,
    totalAttempts: 0,
    totalStruggles: 0,
    reasons: [],
    patterns: [],
    topics: [],
    openSignals: [],
  } as never);

  if (options.questionsFail) {
    vi.spyOn(questionsApi, 'list').mockRejectedValue(new Error('offline'));
    return;
  }
  const data = Array.from({ length: options.questionCount ?? 1 }, (_, index) => ({ id: `q${index}` }));
  vi.spyOn(questionsApi, 'list').mockResolvedValue({ data } as never);
}

describe('PracticeHubPage — empty question bank', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replaces the practice tiles with a way out when the bank is empty', async () => {
    mockApis({ questionCount: 0 });
    render(<PracticeHubPage />);

    expect(await screen.findByText(/No questions yet/)).toBeInTheDocument();
    expect(screen.getByText(/pnpm db:seed/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Write a question/ })).toBeInTheDocument();
    // The tiles must be gone, not merely accompanied by a warning.
    expect(screen.queryByText('New Session')).not.toBeInTheDocument();
    expect(screen.queryByText('DSA Ladder')).not.toBeInTheDocument();
  });

  it('shows the normal tiles once the bank has content', async () => {
    mockApis({ questionCount: 1 });
    render(<PracticeHubPage />);

    expect(await screen.findByText('New Session')).toBeInTheDocument();
    expect(screen.queryByText(/No questions yet/)).not.toBeInTheDocument();
  });

  it('falls back to the tiles when the count itself fails', async () => {
    // A failed lookup means unknown, not empty — never tell someone with a full
    // bank that they have nothing, just because one request dropped.
    mockApis({ questionsFail: true });
    render(<PracticeHubPage />);

    expect(await screen.findByText('New Session')).toBeInTheDocument();
    expect(screen.queryByText(/No questions yet/)).not.toBeInTheDocument();
  });
});
