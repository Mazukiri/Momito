import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react's auto-cleanup relies on detecting a global
// afterEach from the test framework; make it explicit rather than relying on
// that detection, so a stuck/loading render from one test can't leak into
// the next test's DOM queries.
afterEach(() => {
  cleanup();
});
