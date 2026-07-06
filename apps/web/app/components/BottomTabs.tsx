'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_NAV_ITEMS, isNavItemActive } from '../lib/navigation';
import { cn } from '../lib/cn';

// MOM-009: fixed bottom tab bar for phone-width viewports. Hidden at `lg` and up,
// where the sidebar (MOM-010) takes over — kept at `lg` (not `sm`) so landscape
// phones and tablets still get the bottom bar instead of a cramped ~224px sidebar.
// `pb-[env(safe-area-inset-bottom)]` keeps tabs clear of iOS home-indicator
// gestures (resolves to a real value now that layout.tsx sets viewportFit:'cover');
// the layout adds matching bottom padding to page content so the bar never covers
// it (UX invariant §2.3.6).
export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-12 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium',
                active ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-lg leading-none" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
