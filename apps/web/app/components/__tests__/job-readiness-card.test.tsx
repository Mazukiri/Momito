import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobReadinessCard } from '../JobReadinessCard';
import { careerApi, weaknessesApi } from '../../lib/api-client';
import type { JobReadinessResponse, WeaknessSignalResponse } from '@momito/shared';

function signal(overrides: Partial<WeaknessSignalResponse> = {}): WeaknessSignalResponse {
  return {
    id: 'sig-1',
    signalType: 'area',
    key: 'dsa',
    label: 'DSA depth',
    roleTrackId: 'big-tech-swe',
    area: 'dsa',
    jobApplicationId: 'job-1',
    severity: 0.8,
    occurrences: 2,
    source: 'debrief',
    status: 'open',
    lastSignalAt: new Date().toISOString(),
    ...overrides,
  };
}

function readiness(overrides: Partial<JobReadinessResponse> = {}): JobReadinessResponse {
  return {
    jobApplicationId: 'job-1',
    company: 'Meta',
    roleTitle: 'SWE',
    roleTrackId: 'big-tech-swe',
    roleTrack: {
      id: 'big-tech-swe',
      label: 'Big Tech SWE',
      description: '',
      defaultHorizon: '6_months',
      profileRoleTemplate: 'google-l4-swe',
      checklist: [],
    },
    score: 42,
    status: 'not_ready',
    penalty: 18,
    areas: [],
    weakestAreas: [{ area: 'dsa', percentage: 30 }],
    blockingSignals: [signal()],
    nextActions: [],
    ...overrides,
  };
}

describe('JobReadinessCard — resolve/dismiss + repairing (MOM-167/171)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads readiness and shows the score, status, and flagged signal chips', async () => {
    vi.spyOn(careerApi, 'jobReadiness').mockResolvedValue(readiness() as never);

    render(<JobReadinessCard jobId="job-1" />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('Not ready')).toBeInTheDocument();
    expect(screen.getByText('DSA depth')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark "DSA depth" repaired/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss "DSA depth"/ })).toBeInTheDocument();
  });

  it('marks a signal repaired via the formerly-dead resolve endpoint, optimistically removing it', async () => {
    const load = vi
      .spyOn(careerApi, 'jobReadiness')
      .mockResolvedValueOnce(readiness() as never)
      // post-resolve reload: signal gone, score recovered
      .mockResolvedValueOnce(readiness({ score: 60, penalty: 0, blockingSignals: [] }) as never);
    const resolve = vi.spyOn(weaknessesApi, 'resolveSignal').mockResolvedValue(signal({ status: 'resolved' }) as never);

    render(<JobReadinessCard jobId="job-1" />);
    await screen.findByText('DSA depth');

    fireEvent.click(screen.getByRole('button', { name: /Mark "DSA depth" repaired/ }));

    // Optimistic: chip drops immediately, before the reload settles.
    await waitFor(() => expect(screen.queryByText('DSA depth')).not.toBeInTheDocument());
    expect(resolve).toHaveBeenCalledWith('sig-1');
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('60')).toBeInTheDocument();
  });

  it('dismisses a signal ("not a real weakness") via the dismiss endpoint', async () => {
    vi.spyOn(careerApi, 'jobReadiness')
      .mockResolvedValueOnce(readiness() as never)
      .mockResolvedValueOnce(readiness({ blockingSignals: [], penalty: 0 }) as never);
    const dismiss = vi.spyOn(weaknessesApi, 'dismissSignal').mockResolvedValue(signal({ status: 'dismissed' }) as never);

    render(<JobReadinessCard jobId="job-1" />);
    await screen.findByText('DSA depth');

    fireEvent.click(screen.getByRole('button', { name: /Dismiss "DSA depth"/ }));

    await waitFor(() => expect(dismiss).toHaveBeenCalledWith('sig-1'));
    await waitFor(() => expect(screen.queryByText('DSA depth')).not.toBeInTheDocument());
  });

  it('renders a repairing signal amber with a "repairing" tag (partial evidence, MOM-166)', async () => {
    vi.spyOn(careerApi, 'jobReadiness').mockResolvedValue(
      readiness({ blockingSignals: [signal({ status: 'repairing', label: 'System design' })] }) as never,
    );

    render(<JobReadinessCard jobId="job-1" />);

    expect(await screen.findByText('System design')).toBeInTheDocument();
    expect(screen.getByText('repairing')).toBeInTheDocument();
  });
});
