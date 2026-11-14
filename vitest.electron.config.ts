import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: 'electron',
        environment: 'node',
        include: ['electron/**/*.test.ts'],
        clearMocks: true,
        restoreMocks: true,
        mockReset: true,
    },
});
