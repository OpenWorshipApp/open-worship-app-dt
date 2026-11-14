import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { beforeAll, describe, expect, test } from 'vitest';

// The `/owa-lt` scoped lint gate and the `/owa-gi` git interval: the pure
// rules that decide which files each stage sees and what a tick commits.
// Imported by path, as `coverageGapRunner.test.ts` does a skill's script.

type TouchedFilesModule = {
    toRepoRelative: (filePath: string, repoRoot?: string) => string | null;
    parseTouchedText: (text: string, repoRoot?: string) => string[];
    checkIsSessionId: (sessionId: unknown) => boolean;
    resolveSessionId: (
        argv: string[],
        env: Record<string, string | undefined>,
    ) => { sessionId: string | null; guessed: boolean };
};

type LintTouchedModule = {
    selectPrettierFiles: (files: string[]) => string[];
    selectEslintFiles: (files: string[]) => string[];
    checkNeedsTypecheck: (files: string[]) => boolean;
    selectBuildShapingFiles: (files: string[]) => string[];
    pickDiskReadingTests: (
        files: string[],
        listTests?: (dirPath: string) => string[],
    ) => string[];
    splitTypecheckErrors: (
        output: string,
        touchedFiles: string[],
    ) => { inTouched: string[]; elsewhere: string[] };
    findUnbumpedLangPackages: (files: string[]) => string[];
    selectTestTargets: (
        files: string[],
        listTests?: (dirPath: string) => string[],
    ) => string[];
};

type GitIntervalModule = {
    git: (
        args: string[],
        options?: { cwd?: string },
    ) => { ok: boolean; stdout: string; output: string };
    parsePorcelainZ: (text: string) => string[];
    parseUntrackedZ: (text: string) => string[];
    buildCommitMessage: (
        files: string[],
        options?: { now?: Date; trailer?: string | null },
    ) => string;
    checkIsProcessAlive: (pid: number) => boolean;
    waitForNextTick: (options: {
        periodMs: number;
        watchMs?: number;
        checkFinishRequested: () => boolean;
        checkSessionAlive: () => boolean;
    }) => Promise<'finish' | 'session-ended' | null>;
};

const SCRIPTS_DIR = resolve('.claude/skills');
let touchedFiles: TouchedFilesModule;
let lintTouched: LintTouchedModule;
let gitInterval: GitIntervalModule;

beforeAll(async () => {
    touchedFiles = await import(
        `${SCRIPTS_DIR}/owa-lt/scripts/touched-files.mjs`
    );
    lintTouched = await import(
        `${SCRIPTS_DIR}/owa-lt/scripts/lint-touched.mjs`
    );
    gitInterval = await import(
        `${SCRIPTS_DIR}/owa-gi/scripts/git-interval.mjs`
    );
});

describe('touched-files', () => {
    const root = resolve('/repo');

    test('keeps repo files as relative POSIX paths and drops the rest', () => {
        expect(touchedFiles.toRepoRelative(`${root}/src/a.ts`, root)).toBe(
            'src/a.ts',
        );
        expect(touchedFiles.toRepoRelative('/elsewhere/a.ts', root)).toBe(null);
        expect(touchedFiles.toRepoRelative(root, root)).toBe(null);
    });

    test('reads a list once per file, in the order first touched', () => {
        const text = [
            `${root}/src/b.ts`,
            '',
            `${root}/src/a.ts`,
            `${root}/src/b.ts`,
            '/tmp/scratch.txt',
        ].join('\n');
        expect(touchedFiles.parseTouchedText(text, root)).toEqual([
            'src/b.ts',
            'src/a.ts',
        ]);
    });

    test('takes no session id that could leave the list folder', () => {
        expect(touchedFiles.checkIsSessionId('6cba498f-3084')).toBe(true);
        expect(touchedFiles.checkIsSessionId('../../etc/passwd')).toBe(false);
        expect(touchedFiles.checkIsSessionId('')).toBe(false);
        expect(touchedFiles.checkIsSessionId(undefined)).toBe(false);
    });

    test('prefers the argument, then the environment', () => {
        const env = { CLAUDE_CODE_SESSION_ID: 'from-env' };
        expect(
            touchedFiles.resolveSessionId(['node', 's', '--session=arg'], env),
        ).toEqual({ sessionId: 'arg', guessed: false });
        expect(touchedFiles.resolveSessionId(['node', 's'], env)).toEqual({
            sessionId: 'from-env',
            guessed: false,
        });
    });
});

describe('lint-touched stage selection', () => {
    const files = [
        'src/a.tsx',
        'src/a.test.tsx',
        'src/b.css',
        'electron/main.ts',
        'tools/owa-devtools-mcp/x.mjs',
        'docs/page.md',
    ];

    test('prettier sees lint:pre patterns only', () => {
        expect(lintTouched.selectPrettierFiles(files)).toEqual([
            'src/a.tsx',
            'src/a.test.tsx',
            'src/b.css',
            'electron/main.ts',
        ]);
    });

    test('eslint sees lint:es patterns, src tests left out', () => {
        expect(lintTouched.selectEslintFiles(files)).toEqual([
            'src/a.tsx',
            'electron/main.ts',
        ]);
    });

    test('typechecks only when a TypeScript-shaping file changed', () => {
        expect(lintTouched.checkNeedsTypecheck(['docs/page.md'])).toBe(false);
        expect(lintTouched.checkNeedsTypecheck(['electron/main.ts'])).toBe(
            true,
        );
        expect(lintTouched.checkNeedsTypecheck(['tsconfig.json'])).toBe(true);
    });

    test('builds only for a build-shaping file', () => {
        expect(lintTouched.selectBuildShapingFiles(files)).toEqual([]);
        expect(
            lintTouched.selectBuildShapingFiles([
                'vite.config.ts',
                'html/reader.html',
                'src/boot.ts',
                'src/bootHelpers.ts',
            ]),
        ).toEqual(['vite.config.ts', 'html/reader.html', 'src/boot.ts']);
    });
});

describe('lint-touched disk-reading tests', () => {
    test('a doc edit brings the tests that read the docs', () => {
        const picked = lintTouched.pickDiskReadingTests(['.claude/CLAUDE.md']);
        expect(picked).toContain('src/test-setup/agentDocsAudit.test.ts');
        expect(picked).toContain('src/test-setup/manualRecipes.test.ts');
        expect(picked).not.toContain('src/lang/tranKeyCoverage.test.ts');
    });

    test("a language package edit brings that package's own tests", () => {
        const listTests = (dirPath: string) => [`${dirPath}/one.test.mjs`];
        const picked = lintTouched.pickDiskReadingTests(
            ['src/lang/data/online/xx/dictionary.json'],
            listTests,
        );
        expect(picked).toEqual([
            'src/lang/data/online/xx/tests/one.test.mjs',
            'src/lang/tranKeyCoverage.test.ts',
            'src/lang/languageConfinement.test.ts',
        ]);
    });

    test('code anywhere brings the language confinement test', () => {
        expect(
            lintTouched.pickDiskReadingTests(['tools/owa-devtools-mcp/a.mjs']),
        ).toEqual(['src/lang/languageConfinement.test.ts']);
        expect(lintTouched.pickDiskReadingTests(['src/a.tsx'])).toEqual([
            'src/lang/languageConfinement.test.ts',
            'src/lang/tranKeyCoverage.test.ts',
        ]);
    });
});

describe('lint-touched test targets', () => {
    test('relates importable files, never a plain text file', () => {
        expect(lintTouched.selectTestTargets(['notes.txt', 'TODO.md'])).toEqual(
            [],
        );
        expect(
            lintTouched.selectTestTargets(['src/a.json', 'src/b.css']),
        ).toEqual(['src/a.json', 'src/b.css']);
    });
});

describe('lint-touched typecheck split', () => {
    test("fails a touched file's error, lists the rest with its context", () => {
        const output = [
            "src/a.ts(1,7): error TS2322: Type 'string' is not assignable.",
            "src/other.ts(3,8): error TS2345: Argument of type 'x'",
            "  is not assignable to parameter of type 'y'.",
            'error TS5083: Cannot read file tsconfig.base.json.',
        ].join('\n');
        const { inTouched, elsewhere } = lintTouched.splitTypecheckErrors(
            output,
            ['src/a.ts'],
        );
        expect(inTouched).toHaveLength(1);
        expect(elsewhere).toEqual([
            "src/other.ts(3,8): error TS2345: Argument of type 'x'\n" +
                "  is not assignable to parameter of type 'y'.",
            'error TS5083: Cannot read file tsconfig.base.json.',
        ]);
    });

    test('a language package changed without its meta.json is named', () => {
        expect(
            lintTouched.findUnbumpedLangPackages([
                'src/lang/data/online/xx/dictionary.json',
                'src/lang/data/online/yy/dictionary.json',
                'src/lang/data/online/yy/meta.json',
            ]),
        ).toEqual(['xx']);
    });
});

describe('git-interval', () => {
    test('reads porcelain -z, renames by their new name', () => {
        const text = [
            ' M src/a.ts',
            'R  src/new.ts',
            'src/old.ts',
            ' D src/gone.ts',
            '?? src/fresh.ts',
            '',
        ].join('\0');
        expect(gitInterval.parsePorcelainZ(text)).toEqual([
            'src/a.ts',
            'src/new.ts',
            'src/gone.ts',
            'src/fresh.ts',
        ]);
        expect(gitInterval.parseUntrackedZ(text)).toEqual(['src/fresh.ts']);
    });

    test("reads a modified file's path whole off real git", () => {
        // ' M base.txt' trimmed read as 'ase.txt' (2026-11-12 dry run).
        const cwd = mkdtempSync(join(tmpdir(), 'owa-gi-test-'));
        try {
            const run = (args: string[]) => {
                const result = gitInterval.git(args, { cwd });
                expect(result.ok, result.output).toBe(true);
                return result;
            };
            run(['init', '-q']);
            writeFileSync(join(cwd, 'base.txt'), 'one\n');
            run(['add', 'base.txt']);
            run([
                '-c',
                'user.name=Test',
                '-c',
                'user.email=test@example.com',
                'commit',
                '-qm',
                'base',
            ]);
            writeFileSync(join(cwd, 'base.txt'), 'two\n');
            const status = run(['status', '--porcelain=v1', '-z']);
            expect(gitInterval.parsePorcelainZ(status.stdout)).toEqual([
                'base.txt',
            ]);
        } finally {
            rmSync(cwd, { recursive: true, force: true });
        }
    });

    test('a commit message names its files and carries the trailer', () => {
        const files = Array.from({ length: 12 }, (_, i) => `src/f${i}.ts`);
        const message = gitInterval.buildCommitMessage(files, {
            now: new Date(2026, 10, 12, 9, 5),
            trailer: 'Someone <someone@example.com>',
        });
        const lines = message.split('\n');
        expect(lines[0]).toBe(
            'Autosave 2026-11-12 09:05: 12 file(s) of this session (owa-gi)',
        );
        expect(lines).toContain('- src/f9.ts');
        expect(lines).not.toContain('- src/f10.ts');
        expect(lines).toContain('- ... and 2 more');
        expect(lines.at(-1)).toBe(
            'Co-Authored-By: Someone <someone@example.com>',
        );
    });

    test('no trailer line when none is given', () => {
        const message = gitInterval.buildCommitMessage(['src/a.ts']);
        expect(message).not.toContain('Co-Authored-By');
    });

    // The interval stops once the session will change nothing more, and
    // never makes the session wait for it (2026-11-13).
    test('a --finish is seen within a slice, not at the next tick', async () => {
        const startedAt = Date.now();
        const ended = await gitInterval.waitForNextTick({
            periodMs: 60_000,
            watchMs: 10,
            checkFinishRequested: () => Date.now() - startedAt > 30,
            checkSessionAlive: () => true,
        });
        expect(ended).toBe('finish');
        expect(Date.now() - startedAt).toBeLessThan(5_000);
    });

    test('the session ending is seen the same way', async () => {
        const startedAt = Date.now();
        const ended = await gitInterval.waitForNextTick({
            periodMs: 60_000,
            watchMs: 10,
            checkFinishRequested: () => false,
            checkSessionAlive: () => Date.now() - startedAt < 30,
        });
        expect(ended).toBe('session-ended');
        expect(Date.now() - startedAt).toBeLessThan(5_000);
    });

    test('with neither, the period runs out and the loop ticks', async () => {
        const ended = await gitInterval.waitForNextTick({
            periodMs: 40,
            watchMs: 10,
            checkFinishRequested: () => false,
            checkSessionAlive: () => true,
        });
        expect(ended).toBeNull();
    });

    test('a session process is alive only while it runs', () => {
        expect(gitInterval.checkIsProcessAlive(process.pid)).toBe(true);
        const done = spawnSync(process.execPath, ['-e', '']);
        expect(gitInterval.checkIsProcessAlive(done.pid as number)).toBe(false);
        // 0 would signal this whole process group: never a session.
        expect(gitInterval.checkIsProcessAlive(0)).toBe(false);
        expect(gitInterval.checkIsProcessAlive(Number(undefined))).toBe(false);
    });

    describe('the command line returns at once and starts nothing loose', () => {
        const scriptPath = `${SCRIPTS_DIR}/owa-gi/scripts/git-interval.mjs`;
        const stateDir = resolve('node_modules/.cache/owa-git-interval');
        const sessionId = `owa-gi-test-${process.pid}`;
        const run = (args: string[]) => {
            const env = { ...process.env };
            delete env.CLAUDE_PID;
            return spawnSync(
                process.execPath,
                [scriptPath, `--session=${sessionId}`, ...args],
                { encoding: 'utf8', env, timeout: 20_000 },
            );
        };

        test('no session process to follow, no detached loop', () => {
            const result = run(['--every=10']);
            expect(result.status).toBe(1);
            expect(result.stderr).toContain('no Claude Code process to follow');
            expect(existsSync(join(stateDir, `${sessionId}.json`))).toBe(false);
        });

        test('--finish with no interval running changes nothing', () => {
            const result = run(['--finish']);
            expect(result.status).toBe(0);
            expect(result.stdout).toContain('nothing to finish');
            expect(existsSync(join(stateDir, `${sessionId}.finish`))).toBe(
                false,
            );
        });
    });
});
