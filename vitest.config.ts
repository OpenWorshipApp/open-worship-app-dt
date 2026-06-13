import { defineConfig } from 'vitest/config';

import { gzBundlePlugin } from './vite-plugin-gz-bundle';

export default defineConfig({
    plugins: [gzBundlePlugin()],
    test: {
        environment: 'node',
        testTimeout: 10000,
        include: [
            'src/**/*.test.ts',
            'src/**/*.test.tsx',
        ],
        clearMocks: true,
        restoreMocks: true,
        mockReset: true,
    },
});
