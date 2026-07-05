'use client';

import { ErrorBanner } from '../components/ui';

// MOM-084 follow-up: (auth) (login/register) had no scoped error boundary,
// so a render error there fell all the way through to global-error.tsx,
// replacing the entire <html> instead of just the auth card content.
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBanner message={error.message || 'Something went wrong.'} onRetry={reset} />;
}
