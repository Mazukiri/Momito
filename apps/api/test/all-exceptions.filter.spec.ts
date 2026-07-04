import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

function createHost(request: { method: string; url: string }) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  it('maps a known HttpException to its status and message', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = createHost({ method: 'POST', url: '/api/v1/auth/login' });

    filter.catch(new BadRequestException('Invalid email or password'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'Invalid email or password', path: '/api/v1/auth/login' }),
    );
  });

  it('maps an unknown thrown error to a 500 without leaking a stack trace in the body', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = createHost({ method: 'GET', url: '/api/v1/questions' });

    filter.catch(new Error('db connection refused'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('db connection refused');
    expect(body.stack).toBeUndefined();
  });
});
