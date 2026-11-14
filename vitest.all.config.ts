import { defineConfig } from 'vitest/config';

// `npm run test:all`: both suites in ONE run, sharing one pool of workers,
// so the electron files fill cores the renderer suite leaves idle near its
// end instead of starting after it. Measured 2026-11-11: one after the other
// ~64.5 s, at once 57.4 s. A container only -- each project keeps its own
// config, and `coverage-gap.mjs` still runs them one by one.
export default defineConfig({
    test: {
        projects: ['./vitest.config.ts', './vitest.electron.config.ts'],
    },
});
