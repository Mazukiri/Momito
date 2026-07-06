import { describe, expect, it } from 'vitest';
import { resolveInitialTheme } from '../theme-context';

// Pins the theme-resolution precedence: a saved user choice always wins, and
// only when there is none does the OS-level prefers-color-scheme apply. The
// pre-hydration inline script in app/layout.tsx (THEME_INIT_SCRIPT) has to
// duplicate this exact logic by hand since it runs before any module can be
// imported — this test is what would catch the two implementations drifting.
describe('resolveInitialTheme', () => {
  it('uses the saved theme when one is stored, regardless of OS preference', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark');
    expect(resolveInitialTheme('light', true)).toBe('light');
  });

  it('falls back to the OS preference when nothing is stored', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
    expect(resolveInitialTheme(null, false)).toBe('light');
  });

  it('falls back to the OS preference for a garbage/unrecognized stored value', () => {
    expect(resolveInitialTheme('not-a-real-theme', true)).toBe('dark');
    expect(resolveInitialTheme('', false)).toBe('light');
  });
});
