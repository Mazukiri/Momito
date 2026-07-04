'use client';

// MOM-084: root-level error boundary. Next.js requires this to render its own
// <html>/<body> since it replaces the entire root layout when a top-level render
// error escapes every nested error.tsx.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center">
          <h1 className="text-xl font-bold text-zinc-800">Something went wrong</h1>
          <p className="max-w-sm text-sm text-zinc-500">
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={reset}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
