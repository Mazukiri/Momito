import { describe, expect, it } from 'vitest';
import {
  getAiDailyBudgetUsd,
  getAnthropicApiKey,
  getAnthropicModel,
  getCorsOrigin,
  getJwtExpiresIn,
  getJwtSecret,
  isAiGradingAvailable,
  isMultiUserRegistrationAllowed,
} from '../src/common/config';

describe('application config', () => {
  it('keeps the development JWT fallback for easy local setup', () => {
    expect(getJwtSecret({ NODE_ENV: 'development' })).toBe(
      'development-only-secret-change-me',
    );
  });

  it('requires a sufficiently long JWT secret in production', () => {
    expect(() => getJwtSecret({ NODE_ENV: 'production' })).toThrow(
      'JWT_SECRET is required when NODE_ENV=production.',
    );
    expect(() =>
      getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'too-short' }),
    ).toThrow('JWT_SECRET must be at least 32 characters in production.');
  });

  it('accepts a production JWT secret with at least 32 characters', () => {
    const secret = 'a-production-secret-with-32-chars';

    expect(getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret })).toBe(secret);
  });

  it('parses a comma-separated CORS allowlist', () => {
    expect(
      getCorsOrigin({
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://momito.example, https://admin.momito.example ',
      }),
    ).toEqual(['https://momito.example', 'https://admin.momito.example']);
  });

  it('allows local development but disables cross-origin requests by default in production', () => {
    expect(getCorsOrigin({ NODE_ENV: 'development' })).toBe(true);
    expect(getCorsOrigin({ NODE_ENV: 'production' })).toBe(false);
  });

  it('locks multi-user registration by default', () => {
    expect(isMultiUserRegistrationAllowed({})).toBe(false);
    expect(isMultiUserRegistrationAllowed({ ALLOW_MULTI_USER_REGISTRATION: 'false' })).toBe(false);
  });

  it('opts into multi-user registration only with an explicit true', () => {
    expect(isMultiUserRegistrationAllowed({ ALLOW_MULTI_USER_REGISTRATION: 'true' })).toBe(true);
  });

  it('defaults JWT expiry to 30d so a phone user is not logged out daily', () => {
    expect(getJwtExpiresIn({})).toBe('30d');
  });

  it('honors an explicit JWT_EXPIRES_IN override', () => {
    expect(getJwtExpiresIn({ JWT_EXPIRES_IN: '7d' })).toBe('7d');
  });

  it('reports AI grading unavailable when no key is set, and available once one is', () => {
    expect(isAiGradingAvailable({})).toBe(false);
    expect(getAnthropicApiKey({})).toBeUndefined();
    expect(isAiGradingAvailable({ ANTHROPIC_API_KEY: 'sk-ant-test' })).toBe(true);
    expect(getAnthropicApiKey({ ANTHROPIC_API_KEY: '  sk-ant-test  ' })).toBe('sk-ant-test');
  });

  it('defaults the AI model and daily budget, honoring overrides', () => {
    expect(getAnthropicModel({})).toBe('claude-opus-4-8');
    expect(getAnthropicModel({ ANTHROPIC_MODEL: 'claude-sonnet-5' })).toBe('claude-sonnet-5');
    expect(getAiDailyBudgetUsd({})).toBe(1.0);
    expect(getAiDailyBudgetUsd({ AI_DAILY_BUDGET_USD: '2.50' })).toBe(2.5);
    expect(getAiDailyBudgetUsd({ AI_DAILY_BUDGET_USD: 'not-a-number' })).toBe(1.0);
  });
});
