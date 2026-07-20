import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, clearToken, setToken } from '../api-client';

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe('api-client', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shapes a non-ok response into an ApiClientError with statusCode/message', async () => {
    mockFetchOnce(400, { statusCode: 400, error: 'Bad Request', message: 'Title is required' });
    const { questionsApi } = await import('../api-client');

    await expect(questionsApi.get('q-1')).rejects.toMatchObject({
      name: 'ApiClientError',
      statusCode: 400,
      message: 'Title is required',
    });
  });

  it('falls back to statusText when the error body is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('not json')),
    }) as unknown as typeof fetch;
    const { questionsApi } = await import('../api-client');

    await expect(questionsApi.get('q-1')).rejects.toBeInstanceOf(ApiClientError);
  });

  it('clears the token and dispatches momito:unauthorized on a mid-session 401', async () => {
    setToken('a-real-session-token');
    mockFetchOnce(401, { statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' });
    const { questionsApi } = await import('../api-client');

    const handler = vi.fn();
    window.addEventListener('momito:unauthorized', handler);

    await expect(questionsApi.get('q-1')).rejects.toBeInstanceOf(ApiClientError);

    expect(localStorage.getItem('momito_token')).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('momito:unauthorized', handler);
  });

  it('does NOT dispatch momito:unauthorized for a login 401 (wrong password is a normal form error)', async () => {
    mockFetchOnce(401, { statusCode: 401, error: 'Unauthorized', message: 'Invalid email or password' });
    const { authApi } = await import('../api-client');

    const handler = vi.fn();
    window.addEventListener('momito:unauthorized', handler);

    await expect(authApi.login({ email: 'a@b.com', password: 'wrong' })).rejects.toBeInstanceOf(ApiClientError);

    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('momito:unauthorized', handler);
  });

  it('sends the bearer token when one is set', async () => {
    setToken('my-token');
    mockFetchOnce(200, { data: [], total: 0, page: 1, limit: 20 });
    const { questionsApi } = await import('../api-client');

    await questionsApi.list();

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-token');
  });

  it('omits the Authorization header when no token is set', async () => {
    clearToken();
    mockFetchOnce(200, { data: [], total: 0, page: 1, limit: 20 });
    const { questionsApi } = await import('../api-client');

    await questionsApi.list();

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});

// MOM-177: Render's free tier sleeps the API after ~15 min idle and takes
// 30–60s to wake. `fetch` has no default timeout, so the first request of the
// morning hung on a bare spinner and, if the browser gave up first, rejected
// with a raw TypeError that is not an ApiClientError — leaving the user reading
// the literal string "Failed to fetch" on the login form.
describe('api-client — cold start', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('turns an unreachable server into a typed ApiNetworkError, not a raw TypeError', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    const { questionsApi } = await import('../api-client');

    const error = await questionsApi.get('q-1').catch((caught: unknown) => caught);

    expect((error as Error).name).toBe('ApiNetworkError');
    expect((error as Error).message).not.toContain('Failed to fetch');
    expect((error as Error).message).toMatch(/Can't reach the server/);
  });

  it('retries a GET once, so a request that woke the server succeeds on the second try', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ id: 'q-1' }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { questionsApi } = await import('../api-client');

    await expect(questionsApi.get('q-1')).resolves.toMatchObject({ id: 'q-1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never retries a mutation, since a timed-out write may already have applied', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { questionsApi } = await import('../api-client');

    await expect(questionsApi.create({ title: 'x' } as never)).rejects.toThrow(/Can't reach the server/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a timeout from a refused connection', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    global.fetch = vi.fn().mockRejectedValue(abort) as unknown as typeof fetch;
    const { questionsApi } = await import('../api-client');

    const error = await questionsApi.get('q-1').catch((caught: unknown) => caught);

    expect((error as { timedOut: boolean }).timedOut).toBe(true);
    expect((error as Error).message).toMatch(/waking up/);
  });

  it('announces the wait so the shell can name it, then clears it', async () => {
    // The banner listens for these. Without them a cold start is a silent
    // spinner, which is indistinguishable from the app being broken.
    vi.useFakeTimers();
    const waking = vi.fn();
    const awake = vi.fn();
    window.addEventListener('momito:api-waking', waking);
    window.addEventListener('momito:api-awake', awake);
    global.fetch = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }), 10_000)),
    ) as unknown as typeof fetch;
    const { questionsApi } = await import('../api-client');

    const pending = questionsApi.get('q-1');
    await vi.advanceTimersByTimeAsync(3_100);
    expect(waking).toHaveBeenCalledTimes(1);
    expect(awake).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(7_000);
    await pending;
    expect(awake).toHaveBeenCalledTimes(1);

    window.removeEventListener('momito:api-waking', waking);
    window.removeEventListener('momito:api-awake', awake);
    vi.useRealTimers();
  });
});
