import { defineConfig } from 'vitest/config';

import { gzBundlePlugin } from './vite-plugin-gz-bundle';

export default defineConfig({
    plugins: [gzBundlePlugin()],
    test: {
        environment: 'node',
        testTimeout: 10000,
        server: {
            deps: {
                // Both ship raw `.css` imports; externalized they would be
                // require()d by node directly and crash on the extension —
                // inlined they go through vite, which stubs the css out.
                inline: ['open-lyric', /monaco-editor/],
            },
        },
        setupFiles: ['./src/test-setup/localStoragePolyfill.ts'],
        include: [
            'src/**/*.test.ts',
            'src/**/*.test.tsx',
            'tools/**/*.test.mjs',
        ],
        clearMocks: true,
        restoreMocks: true,
        mockReset: true,
    },
});
