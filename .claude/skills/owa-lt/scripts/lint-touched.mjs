// The lint gate (`npm run lint`) scoped to the files this session touched --
// the `/owa-lt` skill, and the check `/owa-gi` runs before it commits. Same
// tools and flags as the gate's stages, aimed at those files only:
//
//   prettier   lint:pre's patterns (`src/**/*.{js,jsx,ts,tsx,json,css,scss,md}`,
//              `electron/**/*.ts`), `.prettierignore` honoured
//   eslint     lint:es's patterns (`src/**/*.ts*` but src tests,
//              `electron/**/*.ts`), `--max-warnings 0`
//   typecheck  lint:all:error WHOLE (~2 s): TypeScript cannot check a file
//              apart from its callers. An error in a touched file fails; one
//              elsewhere is listed and does not fail -- another session's
//              work in progress, or a caller this change broke, so read them.
//   tests      `vitest related` on the touched files (every test importing
//              them), plus the tests that read files off the disk rather
//              than import them (agent docs, the manual, language packages).
//   build      skipped -- the slowest stage and not scopable -- unless
//              `--build`, or a file that shapes the build was touched.
//
// Every stage runs, then one summary; exit 1 when a stage failed.
//
//   node lint-touched.mjs [--session=<id>] [--list] [--build | --no-build]
//                         [file...]        (files beyond the session's list)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    REPO_ROOT,
    readTouched,
    resolveSessionId,
    toRepoRelative,
} from './touched-files.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const MAX_SHOWN_LINES = 120;

const PRETTIER_RE =
    /^(src\/.*\.(js|jsx|ts|tsx|json|css|scss|md)|electron\/.*\.ts)$/;
const ESLINT_RE = /^(src\/.*\.ts[^/]*|electron\/.*\.ts)$/;
const SRC_TEST_RE = /^src\/.*\.(test|spec)\.ts[^/]*$/;
const TYPECHECK_RE =
    /^(src\/|electron\/|tsconfig[^/]*\.json$|electron\.tsconfig\.json$|package\.json$)/;
const BUILD_SHAPING_RE =
    /^(vite\.config\.ts|vite-plugin-[^/]+\.ts|package\.json|src\/boot\.ts|html\/.+|extra-work\/(check-build|build-lang-plugins)\.mjs)$/;
const CODE_RE =
    /^(src|electron|tools|extra-work|\.claude\/skills)\/.*\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const LANG_PACKAGE_RE = /^src\/lang\/data\/online\/([^/]+)\//;
// What a test can import, so what `vitest related` can trace from.
const IMPORTABLE_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json|css|scss)$/;

const DOC_TESTS = [
    'src/test-setup/agentDocsAudit.test.ts',
    'src/test-setup/manualRecipes.test.ts',
    'src/test-setup/knowledgeIndexLimit.test.ts',
    'tools/owa-devtools-mcp/help.test.mjs',
    'tools/owa-devtools-mcp/questions.test.mjs',
    // Every `[en:tran:…]` label in the knowledge, against each language's
    // dictionary: one wrapped over two lines in a backlog passed this gate
    // and failed the full one (2026-11-13).
    'tools/owa-devtools-mcp/tran.test.mjs',
];
const LANGUAGE_CONFINEMENT_TEST = 'src/lang/languageConfinement.test.ts';
const TRAN_KEY_TEST = 'src/lang/tranKeyCoverage.test.ts';

export function selectPrettierFiles(files) {
    return files.filter((file) => PRETTIER_RE.test(file));
}

export function selectEslintFiles(files) {
    return files.filter((file) => {
        return ESLINT_RE.test(file) && !SRC_TEST_RE.test(file);
    });
}

// The files `vitest related` gets: the importable touched ones and the
// tests that read the rest off the disk. Empty -> the stage is skipped,
// rather than starting vitest to find nothing.
export function selectTestTargets(files, listTests = listTestFilesIn) {
    return [
        ...files.filter((file) => IMPORTABLE_RE.test(file)),
        ...pickDiskReadingTests(files, listTests),
    ];
}

export function checkNeedsTypecheck(files) {
    return files.some((file) => TYPECHECK_RE.test(file));
}

export function selectBuildShapingFiles(files) {
    return files.filter((file) => BUILD_SHAPING_RE.test(file));
}

function listTestFilesIn(dirPath) {
    let entries = [];
    try {
        entries = fs.readdirSync(path.join(REPO_ROOT, dirPath), {
            withFileTypes: true,
        });
    } catch {
        return [];
    }
    return entries.flatMap((entry) => {
        const childPath = `${dirPath}/${entry.name}`;
        if (entry.isDirectory()) {
            return listTestFilesIn(childPath);
        }
        return /\.test\.(ts|tsx|mjs)$/.test(entry.name) ? [childPath] : [];
    });
}

// The tests `vitest related` cannot find: they read their subject off the
// disk instead of importing it.
export function pickDiskReadingTests(files, listTests = listTestFilesIn) {
    const picked = new Set();
    for (const file of files) {
        if (file.startsWith('.claude/') || file.startsWith('docs/')) {
            for (const test of DOC_TESTS) {
                picked.add(test);
            }
        }
        if (file.startsWith('tools/owa-devtools-mcp/questions/')) {
            picked.add('tools/owa-devtools-mcp/questions.test.mjs');
        }
        const langMatch = LANG_PACKAGE_RE.exec(file);
        if (langMatch !== null) {
            const packageDir = `src/lang/data/online/${langMatch[1]}`;
            for (const test of listTests(`${packageDir}/tests`)) {
                picked.add(test);
            }
        }
        if (file.startsWith('src/lang/data/')) {
            picked.add(TRAN_KEY_TEST);
            picked.add(LANGUAGE_CONFINEMENT_TEST);
        }
        if (CODE_RE.test(file)) {
            picked.add(LANGUAGE_CONFINEMENT_TEST);
            if (file.startsWith('src/')) {
                picked.add(TRAN_KEY_TEST);
            }
        }
    }
    return [...picked];
}

// `file(line,col): error TS...` lines, each with its continuation lines,
// split by whether the file is one the session touched.
export function splitTypecheckErrors(output, touchedFiles) {
    const touchedSet = new Set(touchedFiles);
    const inTouched = [];
    const elsewhere = [];
    let current = null;
    for (const line of output.split(/\r?\n/)) {
        const match = /^(.+?)\(\d+,\d+\): error TS\d+/.exec(line);
        if (match !== null) {
            const file = match[1].split(path.sep).join('/');
            current = touchedSet.has(file) ? inTouched : elsewhere;
            current.push(line);
        } else if (/^error TS\d+/.test(line)) {
            current = elsewhere;
            current.push(line);
        } else if (current !== null && /^\s+\S/.test(line)) {
            current[current.length - 1] += `\n${line}`;
        }
    }
    return { inTouched, elsewhere };
}

// A language package changed without its meta.json: the scanner keeps the
// highest version, so an installed copy would never see the change.
export function findUnbumpedLangPackages(files) {
    const changed = new Set();
    const bumped = new Set();
    for (const file of files) {
        const match = LANG_PACKAGE_RE.exec(file);
        if (match === null) {
            continue;
        }
        if (file === `src/lang/data/online/${match[1]}/meta.json`) {
            bumped.add(match[1]);
        } else {
            changed.add(match[1]);
        }
    }
    return [...changed].filter((code) => !bumped.has(code));
}

function runNode(args, env = process.env) {
    const result = spawnSync(process.execPath, args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env,
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (result.error) {
        return { status: 1, output: `${output}\n${result.error.message}` };
    }
    return { status: result.status ?? 1, output };
}

function tailLines(text, maxLines = MAX_SHOWN_LINES) {
    const lines = text.split(/\r?\n/);
    if (lines.length <= maxLines) {
        return text;
    }
    const cut = lines.length - maxLines;
    return `... (${cut} earlier lines cut)\n${lines.slice(cut).join('\n')}`;
}

const TSC = 'node_modules/@typescript/native/bin/tsc';

function runTypecheck(files) {
    const outputs = [
        runNode([TSC, '--noEmit', '--skipLibCheck', '--pretty', 'false']),
        runNode([
            TSC,
            '-p',
            'electron.tsconfig.json',
            '--noEmit',
            '--pretty',
            'false',
        ]),
    ];
    const { inTouched, elsewhere } = splitTypecheckErrors(
        outputs.map((item) => item.output).join('\n'),
        files,
    );
    const crashed = outputs.some((item) => {
        return item.status !== 0 && !/error TS\d+/.test(item.output);
    });
    if (crashed) {
        return {
            status: 'FAIL',
            note: 'the compiler did not run',
            detail: tailLines(outputs.map((item) => item.output).join('\n')),
        };
    }
    const details = [];
    if (inTouched.length > 0) {
        details.push(`In touched files:\n${inTouched.join('\n')}`);
    }
    if (elsewhere.length > 0) {
        details.push(
            'Outside touched files (another session, or a caller this ' +
                `change broke -- read them):\n${tailLines(elsewhere.join('\n'))}`,
        );
    }
    let status = 'PASS';
    if (inTouched.length > 0) {
        status = 'FAIL';
    } else if (elsewhere.length > 0) {
        status = 'WARN';
    }
    return {
        status,
        note: `${inTouched.length} in touched, ${elsewhere.length} elsewhere`,
        detail: details.join('\n\n'),
    };
}

// vitest's progress dots and the warnings every run repeats: noise around
// the failure the reader is looking for.
export function cleanTestOutput(output) {
    return output
        .split(/\r?\n/)
        .filter((line) => {
            return !(
                /^[\u00b7x*-]{20,}$/.test(line.trim()) ||
                line.includes('ExperimentalWarning: localStorage') ||
                line.includes('node --trace-warnings')
            );
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
}

function toStageResult(result, note, clean = (output) => output) {
    return {
        status: result.status === 0 ? 'PASS' : 'FAIL',
        note,
        detail: result.status === 0 ? '' : tailLines(clean(result.output)),
    };
}

// { ok, lines }: every stage on `files` (repo-relative, existing), the
// summary and the failing stages' output as printable lines.
export function runScopedGate(files, { build = null } = {}) {
    const stages = [];
    const prettierFiles = selectPrettierFiles(files);
    stages.push([
        'prettier',
        prettierFiles.length === 0
            ? { status: 'SKIP', note: 'no file in its patterns' }
            : toStageResult(
                  runNode([
                      'node_modules/prettier/bin/prettier.cjs',
                      '--check',
                      '--end-of-line',
                      'auto',
                      ...prettierFiles,
                  ]),
                  `${prettierFiles.length} file(s)`,
              ),
    ]);
    const eslintFiles = selectEslintFiles(files);
    stages.push([
        'eslint',
        eslintFiles.length === 0
            ? { status: 'SKIP', note: 'no file in its patterns' }
            : toStageResult(
                  runNode([
                      'node_modules/eslint/bin/eslint.js',
                      '--max-warnings',
                      '0',
                      '--no-warn-ignored',
                      ...eslintFiles,
                  ]),
                  `${eslintFiles.length} file(s)`,
              ),
    ]);
    stages.push([
        'typecheck',
        checkNeedsTypecheck(files)
            ? runTypecheck(files)
            : { status: 'SKIP', note: 'no TypeScript-shaping file' },
    ]);
    const testTargets = selectTestTargets(files);
    stages.push([
        'tests',
        testTargets.length === 0
            ? { status: 'SKIP', note: 'no importable file, no disk test' }
            : toStageResult(
                  runNode(
                      [
                          'node_modules/vitest/vitest.mjs',
                          'related',
                          '--run',
                          '--config',
                          'vitest.all.config.ts',
                          '--passWithNoTests',
                          '--reporter=dot',
                          ...testTargets,
                      ],
                      {
                          ...process.env,
                          VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true',
                      },
                  ),
                  'vitest related',
                  cleanTestOutput,
              ),
    ]);
    const shaping = selectBuildShapingFiles(files);
    const shouldBuild = build ?? shaping.length > 0;
    stages.push([
        'build',
        shouldBuild
            ? toStageResult(
                  runNode(['extra-work/check-build.mjs'], {
                      ...process.env,
                      NODE_OPTIONS: '--max-old-space-size=8192',
                  }),
                  shaping.length > 0 ? `shaped by ${shaping.join(', ')}` : '',
              )
            : {
                  status: 'SKIP',
                  note: 'no build-shaping file (--build runs it)',
              },
    ]);
    const lines = [];
    for (const [name, result] of stages) {
        if (result.detail) {
            lines.push(`--- ${name} (${result.status})`, result.detail, '');
        }
    }
    for (const [name, result] of stages) {
        lines.push(
            `  ${name.padEnd(10)} ${result.status.padEnd(5)} ${result.note ?? ''}`,
        );
    }
    const ok = stages.every(([, result]) => result.status !== 'FAIL');
    return { ok, lines };
}

function listNotes(files) {
    const notes = [];
    if (files.some((file) => file.startsWith('.claude/'))) {
        notes.push(
            'A .claude/ file changed: run `node extra-work/build-knowledge.mjs` ' +
                'in this same change (CLAUDE.md).',
        );
    }
    for (const code of findUnbumpedLangPackages(files)) {
        notes.push(
            `Language package ${code} changed without its meta.json: raise ` +
                `its version, then \`npm run lang:pack -- --pack=${code}\`.`,
        );
    }
    return notes;
}

function main() {
    const argv = process.argv.slice(2);
    const { sessionId, guessed } = resolveSessionId(process.argv);
    const extra = argv
        .filter((item) => !item.startsWith('--'))
        .map((item) => toRepoRelative(item))
        .filter((item) => item !== null);
    const named = [...new Set([...readTouched(sessionId), ...extra])];
    const files = named.filter((file) => {
        return fs.existsSync(path.join(REPO_ROOT, file));
    });
    const gone = named.filter((file) => !files.includes(file));
    const sessionLabel = sessionId ?? 'none';
    console.log(
        `owa-lt: ${files.length} touched file(s), session ${sessionLabel}` +
            (guessed ? ' (guessed: the newest list on disk)' : ''),
    );
    files.forEach((file) => console.log(`  ${file}`));
    if (gone.length > 0) {
        console.log(`  (${gone.length} deleted since: ${gone.join(', ')})`);
    }
    if (argv.includes('--list') || files.length === 0) {
        return;
    }
    let build = null;
    if (argv.includes('--build')) {
        build = true;
    } else if (argv.includes('--no-build')) {
        build = false;
    }
    const { ok, lines } = runScopedGate(files, { build });
    console.log(['', ...lines].join('\n'));
    listNotes(named).forEach((note) => console.log(`NOTE: ${note}`));
    console.log(ok ? '\nowa-lt: PASS' : '\nowa-lt: FAIL');
    process.exitCode = ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
    main();
}
