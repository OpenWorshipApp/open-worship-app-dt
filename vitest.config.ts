import path from 'node:path';

import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

import { gzBundlePlugin } from './vite-plugin-gz-bundle';

// In the app every language but English is a runtime plugin, so
// `src/lang/langSourceFiles.ts` answers nothing; a test runs against the
// language packages of the checkout instead (`langSourceFiles.vitest.ts`).
function langSourceFilesPlugin(): Plugin {
    const sourceFilePath = path.resolve(
        __dirname,
        'src/lang/langSourceFiles.ts',
    );
    return {
        name: 'owa-lang-source-files',
        enforce: 'pre',
        async resolveId(source, importer, options) {
            if (!source.endsWith('langSourceFiles')) {
                return null;
            }
            const resolved = await this.resolve(source, importer, {
                ...options,
                skipSelf: true,
            });
            if (
                resolved !== null &&
                path.resolve(resolved.id) === sourceFilePath
            ) {
                return sourceFilePath.replace(/\.ts$/, '.vitest.ts');
            }
            return null;
        },
    };
}

export default defineConfig({
    plugins: [gzBundlePlugin(), langSourceFilesPlugin()],
    test: {
        name: 'renderer',
        environment: 'node',
        // Worker threads, not forked processes: every file still gets a
        // fresh worker (`isolate` stays on -- the suite depends on it, 49
        // files fail without), and a thread starts far cheaper than a
        // process. Measured 2026-11-11, 1,703 files on 12 cores: forks 55.6
        // / 56.3 / 58.2 s, threads 45.4 / 45.5 / 46.0 s, all green.
        pool: 'threads',
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
            'extra-work/local-llm/**/*.test.mjs',
            'extra-work/mcp-dist/**/*.test.mjs',
            // A language's own tests travel with its package
            // (`src/lang/data/online/<code>/tests/`), the MCP server's and
            // the scripts' among them.
            'src/lang/data/online/*/tests/**/*.test.mjs',
        ],
        clearMocks: true,
        restoreMocks: true,
        mockReset: true,
    },
});
