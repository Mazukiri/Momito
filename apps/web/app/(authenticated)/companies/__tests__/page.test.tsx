import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CompaniesPage from '../page';
import { companiesApi } from '../../../lib/api-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function company(name: string, sponsorshipStatus: 'sponsored' | 'unknown' | 'not_sponsoring' | null) {
  return { id: name, name, region: 'Global', notes: null, focusAreas: {}, roleTrackIds: [], interviewProcess: [], sponsorshipStatus, compBand: null, createdAt: '', updatedAt: '' };
}

describe('CompaniesPage — sponsorship filter (MOM-124)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('filters the catalog by sponsorship, bucketing null with explicit unknown', async () => {
    vi.spyOn(companiesApi, 'list').mockResolvedValue([
      company('Stripe', 'sponsored'),
      company('DomesticCo', 'not_sponsoring'),
      company('MysteryCorp', null),
    ] as never);

    render(<CompaniesPage />);

    // All three visible by default.
    await waitFor(() => expect(screen.getByText('Stripe')).toBeInTheDocument());
    expect(screen.getByText('DomesticCo')).toBeInTheDocument();
    expect(screen.getByText('MysteryCorp')).toBeInTheDocument();

    // "No sponsorship" shows only DomesticCo. Match the pill by its count suffix
    // (a company card is itself a <button> whose name includes its badge text).
    fireEvent.click(screen.getByRole('button', { name: /No sponsorship \(\d+\)/ }));
    expect(screen.getByText('DomesticCo')).toBeInTheDocument();
    expect(screen.queryByText('Stripe')).not.toBeInTheDocument();
    expect(screen.queryByText('MysteryCorp')).not.toBeInTheDocument();

    // "Unknown" catches the null-sponsorship company.
    fireEvent.click(screen.getByRole('button', { name: /^Unknown \(\d+\)/ }));
    expect(screen.getByText('MysteryCorp')).toBeInTheDocument();
    expect(screen.queryByText('DomesticCo')).not.toBeInTheDocument();
  });
});
