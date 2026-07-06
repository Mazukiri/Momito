import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PushSettingsCard } from '../push-settings-card';
import * as apiClient from '../../lib/api-client';

describe('PushSettingsCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing while the config check is in flight', () => {
    vi.spyOn(apiClient.pushApi, 'config').mockReturnValue(new Promise(() => {}));
    const { container } = render(<PushSettingsCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the API reports push unavailable (no VAPID keys configured)', async () => {
    vi.spyOn(apiClient.pushApi, 'config').mockResolvedValue({ available: false, publicKey: null });
    const { container } = render(<PushSettingsCard />);

    await waitFor(() => expect(container).not.toHaveTextContent('...loading marker never appears'));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the card when the API reports push available', async () => {
    vi.spyOn(apiClient.pushApi, 'config').mockResolvedValue({ available: true, publicKey: 'test-public-key' });
    render(<PushSettingsCard />);

    expect(await screen.findByText('Notifications')).toBeInTheDocument();
  });

  it('renders nothing when the config request itself fails', async () => {
    vi.spyOn(apiClient.pushApi, 'config').mockRejectedValue(new Error('network error'));
    const { container } = render(<PushSettingsCard />);

    await waitFor(() => expect(container.textContent).toBe(''));
  });
});
