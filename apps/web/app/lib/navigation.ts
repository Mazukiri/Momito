export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Shown in the mobile bottom tab bar (MOM-009). At most 5 items may be primary. */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/today', label: 'Today', icon: '🏠', primary: true },
  { href: '/practice', label: 'Practice', icon: '📝', primary: true },
  { href: '/jobs', label: 'Jobs', icon: '💼', primary: true },
  { href: '/learning', label: 'Learning', icon: '📚', primary: true },
  { href: '/profile', label: 'Profile', icon: '👤', primary: true },
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/missions', label: 'Mission', icon: '🎯' },
  { href: '/career', label: 'Career', icon: '🚀' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/questions', label: 'Questions', icon: '❓' },
  { href: '/attempts', label: 'History', icon: '🕓' },
  { href: '/study-plan', label: 'Study Plan', icon: '🗂️' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.primary);

if (PRIMARY_NAV_ITEMS.length > 5) {
  throw new Error('NAV_ITEMS: at most 5 items may be flagged primary (mobile bottom tab limit).');
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/today') return pathname === '/today';
  return pathname.startsWith(href);
}
