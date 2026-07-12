'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, isNavItemActive } from '../lib/navigation';
import { cn } from '../lib/cn';

// MOM-010: persistent left sidebar for desktop viewports (`lg` and up, matching
// BottomTabs' breakpoint so landscape phones/tablets get the bottom bar instead of
// a cramped ~224px sidebar). On narrower widths the bottom tab bar (MOM-009) is the
// primary navigation instead.
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-14 items-center px-5">
        <Link href="/today" className="text-lg font-bold text-indigo-600">
          Momito
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Primary">
        {NAV_ITEMS.map((item, index) => {
          const active = isNavItemActive(pathname, item.href);
          // MOM-165: emit a section header the first time a new section appears (items sharing
          // a section are contiguous). Primary items and Settings have no section → no header.
          const showHeader = Boolean(item.section) && item.section !== NAV_ITEMS[index - 1]?.section;
          return (
            <div key={item.href}>
              {showHeader && (
                <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  active
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
