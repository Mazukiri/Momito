import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import JobsPage from '../page';
import { companiesApi, jobsApi } from '../../../lib/api-client';
import type { JobApplicationResponse } from '@momito/shared';

// Stable router mock — JobsPage effects do not depend on router identity, but matching
// the rest of the suite's convention keeps us safe if that ever changes.
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

function job(overrides: Partial<JobApplicationResponse> = {}): JobApplicationResponse {
  return {
    id: 'job-1',
    userId: 'u1',
    company: 'Stripe',
    companyId: null,
    companyRef: null,
    roleTitle: 'SWE',
    url: null,
    location: null,
    status: 'applied',
    roleTrackId: 'big-tech-swe',
    jdText: null,
    appliedDate: null,
    deadline: null,
    source: null,
    visaTag: null,
    notes: null,
    rejectionReason: null,
    daysInStage: 5,
    isStalled: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const EMPTY_FUNNEL = {
  total: 0,
  active: 0,
  offers: 0,
  rejected: 0,
  withdrawn: 0,
  responseRate: 0,
  stages: [],
  bySource: [],
  byVisaTag: [],
  byRejectionReason: [],
  byResumeVersion: [],
};

function mockJobs(list: JobApplicationResponse[]) {
  vi.spyOn(jobsApi, 'list').mockResolvedValue(list as never);
  vi.spyOn(jobsApi, 'funnel').mockResolvedValue(EMPTY_FUNNEL as never);
  vi.spyOn(companiesApi, 'list').mockResolvedValue([] as never);
}

describe('JobsPage — sponsorship filter + stall badge (MOM-124/105/171)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('filters the list by sponsorship, preferring companyRef over the job visaTag', async () => {
    mockJobs([
      job({
        id: 'j1',
        company: 'Stripe',
        companyRef: {
          id: 'c-stripe',
          name: 'Stripe',
          region: 'Global',
          sponsorshipStatus: 'sponsored',
          focusAreas: {},
        },
      }),
      job({
        id: 'j2',
        company: 'DomesticCo',
        visaTag: 'not_sponsoring',
      }),
      job({
        id: 'j3',
        company: 'MysteryCorp',
        // neither companyRef nor visaTag → unknown bucket
      }),
    ]);

    render(<JobsPage />);

    await waitFor(() => expect(screen.getByText('Stripe')).toBeInTheDocument());
    expect(screen.getByText('DomesticCo')).toBeInTheDocument();
    expect(screen.getByText('MysteryCorp')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sponsors \(\d+\)/ }));
    expect(screen.getByText('Stripe')).toBeInTheDocument();
    expect(screen.queryByText('DomesticCo')).not.toBeInTheDocument();
    expect(screen.queryByText('MysteryCorp')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /No sponsorship \(\d+\)/ }));
    expect(screen.getByText('DomesticCo')).toBeInTheDocument();
    expect(screen.queryByText('Stripe')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Unknown \(\d+\)/ }));
    expect(screen.getByText('MysteryCorp')).toBeInTheDocument();
    expect(screen.queryByText('Stripe')).not.toBeInTheDocument();
    expect(screen.queryByText('DomesticCo')).not.toBeInTheDocument();
  });

  it('shows the stalled badge with days-in-stage when the API flags isStalled', async () => {
    mockJobs([
      job({
        id: 'j-stall',
        company: 'QuietCo',
        status: 'applied',
        daysInStage: 21,
        isStalled: true,
      }),
      job({
        id: 'j-ok',
        company: 'MovingCo',
        daysInStage: 3,
        isStalled: false,
      }),
    ]);

    render(<JobsPage />);

    await waitFor(() => expect(screen.getByText('QuietCo')).toBeInTheDocument());
    expect(screen.getByText(/⏳ Stalled · 21d/)).toBeInTheDocument();
    // MovingCo is visible but has no stall badge of its own.
    expect(screen.getByText('MovingCo')).toBeInTheDocument();
    expect(screen.queryByText(/⏳ Stalled · 3d/)).not.toBeInTheDocument();
  });

  it('switches to the board view and groups cards by funnel stage', async () => {
    mockJobs([
      job({ id: 'j1', company: 'SavedCo', status: 'saved' }),
      job({ id: 'j2', company: 'AppliedCo', status: 'applied' }),
    ]);

    render(<JobsPage />);
    await waitFor(() => expect(screen.getByText('SavedCo')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^board$/i }));

    // Both companies still present; board columns show stage headers.
    expect(screen.getByText('SavedCo')).toBeInTheDocument();
    expect(screen.getByText('AppliedCo')).toBeInTheDocument();
    expect(screen.getByText(/^saved$/i)).toBeInTheDocument();
    expect(screen.getByText(/^applied$/i)).toBeInTheDocument();
  });
});
