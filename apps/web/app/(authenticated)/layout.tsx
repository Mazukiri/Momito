'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { LoadingPage } from '../components/ui';
import Link from 'next/link';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) return <LoadingPage />;
  if (!user) return null;

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/questions', label: 'Questions' },
    { href: '/practice/new', label: 'Practice' },
    { href: '/attempts', label: 'History' },
    { href: '/study-plan', label: 'Study Plan' },
    { href: '/settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/questions" className="text-lg font-bold text-indigo-600">
              Momito
            </Link>
            <nav className="hidden sm:flex items-center gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium ${
                    pathname.startsWith(link.href)
                      ? 'text-indigo-600'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">{user.name}</span>
            <button
              onClick={async () => { await logout(); router.push('/login'); }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
