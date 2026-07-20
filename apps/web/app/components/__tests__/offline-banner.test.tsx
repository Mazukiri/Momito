import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from '../offline-banner';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

function emit(event: string) {
  act(() => {
    window.dispatchEvent(new Event(event));
  });
}

describe('OfflineBanner', () => {
  afterEach(() => {
    setOnline(true);
    vi.restoreAllMocks();
  });

  it('stays out of the way when online and the API is responsive', () => {
    setOnline(true);
    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reports being offline', () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
  });

  // MOM-177: navigator.onLine is true whenever the device has a network
  // association, so it cannot see a sleeping API — which on Render's free tier
  // is every first request after ~15 min idle.
  it('names the cold start, which navigator.onLine cannot detect', () => {
    setOnline(true);
    render(<OfflineBanner />);

    emit('momito:api-waking');
    expect(screen.getByRole('status')).toHaveTextContent(/Waking the server/i);

    emit('momito:api-awake');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('prefers the offline message when both apply, since it is the actionable one', () => {
    setOnline(false);
    render(<OfflineBanner />);

    emit('momito:api-waking');

    expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
    expect(screen.queryByText(/Waking the server/i)).not.toBeInTheDocument();
  });
});
