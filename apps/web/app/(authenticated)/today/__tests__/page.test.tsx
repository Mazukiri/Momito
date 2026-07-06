import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TodayPage from '../page';
import { dashboardApi, recommendationsApi, remindersApi, reviewsApi } from '../../../lib/api-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function mockApis(overrides: {
  recommendations?: unknown[];
  reminders?: unknown[];
  due?: unknown[];
  streak?: number;
} = {}) {
  vi.spyOn(recommendationsApi, 'list').mockResolvedValue((overrides.recommendations ?? []) as never);
  vi.spyOn(remindersApi, 'list').mockResolvedValue((overrides.reminders ?? []) as never);
  vi.spyOn(reviewsApi, 'due').mockResolvedValue((overrides.due ?? []) as never);
  vi.spyOn(dashboardApi, 'summary').mockResolvedValue({ streak: overrides.streak ?? 0 } as never);
}

describe('TodayPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the empty state when nothing is due, recommended, or reminding', async () => {
    mockApis();
    render(<TodayPage />);

    expect(await screen.findByText(/Nothing urgent right now/)).toBeInTheDocument();
  });

  it('ranks a due review above an overdue reminder and a lower-priority recommendation', async () => {
    const now = Date.now();
    mockApis({
      due: [
        { id: 'r1', objectType: 'question', objectId: 'q1', title: 'Two Sum', due: new Date(now - 3_600_000).toISOString() },
      ],
      reminders: [
        { id: 'rem1', title: 'Overdue reminder', dueAt: new Date(now - 3_600_000).toISOString(), status: 'pending' },
      ],
      recommendations: [
        { id: 'rec1', type: 'task', title: 'Low priority task', reason: 'Just a suggestion', priority: 10, targetHref: '/calendar' },
      ],
    });
    const { container } = render(<TodayPage />);

    await waitFor(() => expect(screen.queryByText('Two Sum')).toBeInTheDocument());

    const text = container.textContent ?? '';
    // Due review (priority ~200+) must outrank the overdue reminder (~150+),
    // which must outrank the low-priority recommendation (10).
    expect(text.indexOf('Two Sum')).toBeLessThan(text.indexOf('Overdue reminder'));
    expect(text.indexOf('Overdue reminder')).toBeLessThan(text.indexOf('Low priority task'));
  });

  it('sinks a not-yet-due reminder below active recommendations without hiding it', async () => {
    const now = Date.now();
    mockApis({
      reminders: [
        { id: 'rem1', title: 'Future reminder', dueAt: new Date(now + 24 * 3_600_000).toISOString(), status: 'pending' },
      ],
      recommendations: [
        { id: 'rec1', type: 'task', title: 'Active recommendation', reason: 'Overdue task', priority: 80, targetHref: '/calendar' },
      ],
    });
    const { container } = render(<TodayPage />);

    await waitFor(() => expect(screen.queryByText('Future reminder')).toBeInTheDocument());

    const text = container.textContent ?? '';
    expect(text.indexOf('Active recommendation')).toBeLessThan(text.indexOf('Future reminder'));
  });

  it('shows the streak badge once loaded when the streak is positive', async () => {
    mockApis({ streak: 5 });
    render(<TodayPage />);

    expect(await screen.findByTitle('5 day streak')).toBeInTheDocument();
  });

  it('surfaces an error banner when loading fails', async () => {
    vi.spyOn(recommendationsApi, 'list').mockRejectedValue(new Error('network down'));
    vi.spyOn(remindersApi, 'list').mockResolvedValue([] as never);
    vi.spyOn(reviewsApi, 'due').mockResolvedValue([] as never);
    vi.spyOn(dashboardApi, 'summary').mockResolvedValue({ streak: 0 } as never);

    render(<TodayPage />);

    expect(await screen.findByText('network down')).toBeInTheDocument();
  });
});
