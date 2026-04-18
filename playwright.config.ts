import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    testMatch: ['**/*.spec.ts'],
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: 'list',
    outputDir: 'test-results/playwright',
    use: {
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
});
