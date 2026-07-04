'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { LoadingPage } from '../components/ui';
import { Sidebar } from '../components/Sidebar';
import { BottomTabs } from '../components/BottomTabs';
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
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-200 bg-white">
          <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-2">
            <Link href="/today" className="text-lg font-bold text-indigo-600 sm:hidden">
              Momito
            </Link>
            <div className="flex flex-1 items-center justify-end gap-4">
              <span className="text-sm text-zinc-500">{user.name}</span>
              <button
                onClick={async () => {
                  await logout();
                  router.push('/login');
                }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        {/* pb-20 keeps content clear of the fixed BottomTabs on phone widths (UX invariant §2.3.6) */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-6 sm:pb-8">{children}</main>
      </div>
      <BottomTabs />
    </div>
  );
}
