import { describe, expect, test } from 'vitest';

import packageJson from '../../package.json';

const scripts: Record<string, string> = packageJson.scripts;

// What is left of a script once every quoted argument is taken out -- the part
// the shell expands before the tool starts.
function toShellExpandedText(script: string) {
    return script.replace(/"[^"]*"|'[^']*'/g, '');
}

function listLintStageScripts() {
    return scripts.lint.split('&&').map((stage) => {
        const name = stage.trim().replace(/^npm run /, '');
        return scripts[name] ?? stage.trim();
    });
}

describe('npm run lint', () => {
    test('hands every ** glob to the tool, never to the shell', () => {
        // npm runs scripts with /bin/sh on macOS and Linux, which has no
        // globstar: an unquoted `src/**/*.ts*` became `src/*/*.ts*` there and
        // `lint:es` linted 573 of 952 files, skipping every top-level
        // `electron/*.ts` (EN-13). cmd.exe on Windows expands nothing, so a
        // Windows run could never see it.
        const unquoted = Object.entries(scripts).filter(([, script]) => {
            return toShellExpandedText(script).includes('**');
        });
        expect(unquoted).toEqual([]);
    });

    test('typechecks the electron sources, not only src', () => {
        // tsconfig.json includes `src` alone; without this the only electron
        // typecheck was inside `electron:build` (EN-14).
        expect(scripts['lint:all:error']).toContain(
            'tsc -p electron.tsconfig.json --noEmit',
        );
    });

    test('is safe to run beside a live dev app', () => {
        // `build` deletes `electron-build/`, the running dev app's own main
        // entry, and `prettier --write` rewrites files another session may be
        // half-way through (EN-16). The gate checks; `npm run format` writes.
        for (const script of listLintStageScripts()) {
            expect(script).not.toMatch(
                /--write|rmdir|electron:build|npm run build\b|vite:build/,
            );
        }
        expect(scripts.lint).toContain('npm run lint:build');
        expect(scripts.format).toContain('prettier --write');
    });
});
