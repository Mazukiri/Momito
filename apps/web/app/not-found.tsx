import Link from 'next/link';

// MOM-084: catch-all 404. Kept outside (authenticated)/ so it also renders for
// unauthenticated/unknown paths, not just inside the authenticated shell.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-zinc-950">
      <span className="text-4xl">🔍</span>
      <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Page not found</h1>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link href="/today" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        Go to Today
      </Link>
    </div>
  );
}
