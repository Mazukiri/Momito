import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ResumesPage from '../page';
import { jobsApi, profileScoresApi, resumesApi } from '../../../../lib/api-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// The bullet carries the double spaces a PDF-extracted résumé really has — the exact case in
// which "Accept" used to silently do nothing (MOM-153/154).
const CONTENT_MD = '# Ada\n\n## Experience\n- Wrote  a  Python script to process data.\n- Cut p99 latency 40%.';

const REWRITE = {
  original: 'Wrote  a  Python script to process data.',
  rewritten: 'Built a Python ingestion tool cutting manual triage 80%.',
  rationale: 'Adds scope and a metric.',
};

function version(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rv-1', userId: 'u1', jobApplicationId: null, company: null, label: 'Base résumé',
    targetRoleTrackId: null, contentMd: CONTENT_MD, aiSuggestions: [],
    createdAt: '', updatedAt: '', ...overrides,
  };
}

const NO_DRIFT = { resumeVersionId: 'rv-1', hasSnapshot: true, newSkills: [], newProjects: [], newExperience: [], isStale: false };

function mockPage(overrides: { versions?: unknown[]; drift?: unknown } = {}) {
  vi.spyOn(resumesApi, 'list').mockResolvedValue((overrides.versions ?? [version()]) as never);
  vi.spyOn(resumesApi, 'drift').mockResolvedValue((overrides.drift ?? NO_DRIFT) as never);
  vi.spyOn(jobsApi, 'list').mockResolvedValue([] as never);
  vi.spyOn(jobsApi, 'funnel').mockResolvedValue({ byResumeVersion: [] } as never);
  vi.spyOn(profileScoresApi, 'atsCoverage').mockResolvedValue({} as never);
  return vi.spyOn(resumesApi, 'update').mockResolvedValue(version() as never);
}

describe('ResumesPage — AI suggestions (MOM-153/154)', () => {
  afterEach(() => vi.restoreAllMocks());

  // MOM-154: the rewrites were persisted to the version and the page never read them, so a
  // reload silently threw them away while they sat in the DB.
  it('restores the AI rewrites stored on the version, so a reload does not lose them', async () => {
    mockPage({ versions: [version({ aiSuggestions: [REWRITE] })] });

    render(<ResumesPage />);

    await waitFor(() => expect(screen.getByText(REWRITE.rewritten)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
  });

  // MOM-153/154: accepting must actually change the draft. It used to be a no-op whenever the
  // model's `original` was not a verbatim substring — the suggestion vanished and nothing moved.
  it('accepting a rewrite patches the draft and retires the suggestion', async () => {
    const update = mockPage({ versions: [version({ aiSuggestions: [REWRITE] })] });

    render(<ResumesPage />);
    await waitFor(() => expect(screen.getByText(REWRITE.rewritten)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    const draft = screen.getByDisplayValue(new RegExp(REWRITE.rewritten.slice(0, 20)));
    expect(draft).toBeInTheDocument();
    expect(screen.getByText(/Applied to the draft/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();

    // Saving writes the applied text AND the pruned list in one call — so it cannot come back.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    const body = update.mock.calls[0][1] as { contentMd: string; aiSuggestions: unknown[] };
    expect(body.contentMd).toContain(REWRITE.rewritten);
    expect(body.aiSuggestions).toEqual([]);
  });

  // MOM-154, the user-side half of the silent no-op: the bullet may have been edited away since
  // the rewrite was generated. Say so and KEEP the suggestion — never retire a press that did nothing.
  it('refuses to "accept" a rewrite whose bullet is no longer in the draft, and keeps it', async () => {
    mockPage({ versions: [version({ contentMd: '# Ada\n- A totally different bullet now.', aiSuggestions: [REWRITE] })] });

    render(<ResumesPage />);
    await waitFor(() => expect(screen.getByText(REWRITE.rewritten)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(screen.getByText(/no longer in the draft/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument(); // still offered
  });

  it('rejecting a rewrite persists the dismissal without touching the draft text', async () => {
    const update = mockPage({ versions: [version({ aiSuggestions: [REWRITE] })] });

    render(<ResumesPage />);
    await waitFor(() => expect(screen.getByText(REWRITE.rewritten)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith('rv-1', { aiSuggestions: [] }));
    expect(screen.queryByText(REWRITE.rewritten)).not.toBeInTheDocument();
  });
});

describe('ResumesPage — drift (MOM-155)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns that the profile has moved on, naming what the résumé is missing', async () => {
    mockPage({
      drift: {
        resumeVersionId: 'rv-1', hasSnapshot: true, isStale: true,
        newSkills: ['CUDA'], newProjects: ['GPU Ray Tracer'], newExperience: ['SWE Intern — NVIDIA'],
      },
    });

    render(<ResumesPage />);

    await waitFor(() => expect(screen.getByText(/Your profile has moved on/)).toBeInTheDocument());
    expect(screen.getByText(/GPU Ray Tracer/)).toBeInTheDocument();
    expect(screen.getByText(/SWE Intern — NVIDIA/)).toBeInTheDocument();
    expect(screen.getByText(/CUDA/)).toBeInTheDocument();
  });

  it('stays quiet when the résumé still matches the profile', async () => {
    mockPage();

    render(<ResumesPage />);

    await waitFor(() => expect(screen.getByDisplayValue('Base résumé')).toBeInTheDocument());
    expect(screen.queryByText(/Your profile has moved on/)).not.toBeInTheDocument();
  });
});
