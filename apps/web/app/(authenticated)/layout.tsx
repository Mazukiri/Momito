'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { LoadingPage } from '../components/ui';
import { Sidebar } from '../components/Sidebar';
import { BottomTabs } from '../components/BottomTabs';
import { ThemeToggle } from '../components/ThemeToggle';
import { ReminderBell } from '../components/ReminderBell';
import Link from 'next/link';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) return <LoadingPage />;
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-2">
            <Link href="/today" className="text-lg font-bold text-indigo-600 lg:hidden">
              Momito
            </Link>
            <div className="flex flex-1 items-center justify-end gap-4">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{user.name}</span>
              <ReminderBell />
              <ThemeToggle />
              <button
                onClick={async () => {
                  await logout();
                  router.push('/login');
                }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        {/* pb-20 keeps content clear of the fixed BottomTabs on phone/tablet widths (UX invariant §2.3.6) */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-6 lg:pb-8">{children}</main>
      </div>
      <BottomTabs />
    </div>
  );
}
