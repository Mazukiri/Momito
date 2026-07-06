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
