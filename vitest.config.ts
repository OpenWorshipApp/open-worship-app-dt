import { defineConfig } from 'vitest/config';

export default defineConfig({
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
