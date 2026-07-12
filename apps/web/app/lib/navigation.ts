export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Shown in the mobile bottom tab bar (MOM-009). At most 5 items may be primary. */
  primary?: boolean;
  /**
   * MOM-165: sidebar grouping header for secondary items. The 5 primary items carry none
   * (they sit at the top, ungrouped); Settings is a deliberately un-sectioned tail. Items
   * sharing a section must be contiguous in this list — the Sidebar emits a header whenever
   * the section changes.
   */
  section?: string;
}

// MOM-165: primary items first (bottom-tab loop), then the secondary items grouped into
// Pipeline / Prep / Insights, then Settings standalone. Missions was removed in MOM-162.
export const NAV_ITEMS: NavItem[] = [
  { href: '/today', label: 'Today', icon: '🏠', primary: true },
  { href: '/practice', label: 'Practice', icon: '📝', primary: true },
  { href: '/jobs', label: 'Jobs', icon: '💼', primary: true },
  { href: '/learning', label: 'Learning', icon: '📚', primary: true },
  { href: '/profile', label: 'Profile', icon: '👤', primary: true },

  { href: '/companies', label: 'Companies', icon: '🏢', section: 'Pipeline' },
  { href: '/contacts', label: 'Contacts', icon: '👥', section: 'Pipeline' },
  { href: '/offers', label: 'Offers', icon: '💰', section: 'Pipeline' },

  { href: '/questions', label: 'Questions', icon: '❓', section: 'Prep' },
  { href: '/stories', label: 'Story Bank', icon: '⭐', section: 'Prep' },
  { href: '/attempts', label: 'History', icon: '🕓', section: 'Prep' },
  { href: '/study-plan', label: 'Study Plan', icon: '🗂️', section: 'Prep' },

  { href: '/career', label: 'Career', icon: '🚀', section: 'Insights' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊', section: 'Insights' },
  { href: '/calendar', label: 'Calendar', icon: '📅', section: 'Insights' },

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
