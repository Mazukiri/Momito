'use client';

import { ErrorBanner } from '../components/ui';

// MOM-084: scoped error boundary for the authenticated section — a render error
// on one route (e.g. /jobs) no longer takes down the whole app shell.
export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-10">
      <ErrorBanner message={error.message || 'Something went wrong loading this page.'} onRetry={reset} />
    </div>
  );
}
