#!/usr/bin/env node
/**
 * coverage-gap.mjs — the honest unit-test coverage picture, ranked.
 *
 * `npm run test:coverage` measures only the files the tests happen to LOAD.
 * This script measures every source file in the target surface, whether a test
 * reaches it or not, and ranks what is left by how many uncovered lines it
 * holds — which is the order that gets to 99% fastest.
 *
 * It WRITES NOTHING into the repo: the coverage report and the worklist go to
 * `test-results/unit-coverage/`, which .gitignore already covers. It never
 * touches `electron-build/` or `dist/`, so it is safe beside a running app.
 *
 *   node .claude/skills/owa-upgrade-unit-test/scripts/coverage-gap.mjs
 *   ... --surface=src|electron|all   which config(s) to measure (default all)
 *   ... --no-run                     reuse the last report, do not run tests
 *   ... --top=40                     how many rows to print (default 30)
 *   ... --dir=src/presenting-flow    only files under this path
 *   ... --uncovered=<file>           print the uncovered line RANGES of one file
 *   ... --json                       machine-readable, for a resumed session
 *   ... --goal=99                    the coverage target the plan is built for
 */

import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const BACKSLASH = String.fromCharCode(92);
const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
const OUT_DIR = join(REPO_ROOT, 'test-results', 'unit-coverage');

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
    const hit = args.find((one) => one.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => args.includes(`--${name}`);

const GOAL = Number(flag('goal', '99'));
const TOP = Number(flag('top', '30'));
const IS_JSON = has('json');
const SURFACE = flag('surface', 'all');
const DIR_FILTER = flag('dir', null);
const UNCOVERED_OF = flag('uncovered', null);

// Every ** glob is QUOTED when it reaches a shell (lintGateScripts.test.ts's
// rule), but spawnSync with shell:false hands argv straight to the binary, so
// nothing expands them here.
const SURFACE_MAP = {
    src: {
        config: 'vitest.config.ts',
        // `tools/**/*.test.mjs` runs under this config too, so the MCP server's
        // own modules are measured here rather than under electron.
        include: ['src/**/*.ts', 'src/**/*.tsx', 'tools/owa-devtools-mcp/*.mjs'],
        out: 'cov-src',
    },
    electron: {
        config: 'vitest.electron.config.ts',
        include: ['electron/**/*.ts'],
        out: 'cov-electron',
    },
};

const EXCLUDE = [
    '**/*.test.*',
    '**/*.spec.*',
    'src/test-setup/**',
    'src/vite-env.d.ts',
    // Declared non-goals; references/baseline.md carries the reason for each.
    'src/experiments/**',
    'electron/testElectronModule.ts',
    'electron/testUtils.ts',
];

function toPosix(text) {
    return text.split(BACKSLASH).join('/');
}

function toRepoPath(absolute) {
    const posix = toPosix(absolute);
    const root = toPosix(REPO_ROOT);
    return posix.startsWith(root) ? posix.slice(root.length + 1) : posix;
}

function runCoverage(key) {
    const surface = SURFACE_MAP[key];
    const reportDir = join(OUT_DIR, surface.out);
    const argv = [
        'vitest',
        'run',
        '--config',
        surface.config,
        // Instrumenting every file, not just the loaded ones, makes the suite
        // ~2.5x slower and pushes one screen-preview test past the config's
        // 10s testTimeout. Raise it here rather than in the committed config.
        '--testTimeout=60000',
        '--coverage',
        ...surface.include.map((one) => `--coverage.include=${one}`),
        ...EXCLUDE.map((one) => `--coverage.exclude=${one}`),
        '--coverage.reporter=json-summary',
        '--coverage.reporter=json',
        `--coverage.reportsDirectory=${reportDir}`,
    ];
    process.stderr.write(`[coverage-gap] npx ${argv.join(' ')}\n`);
    const started = Date.now();
    const result = spawnSync('npx', argv, {
        cwd: REPO_ROOT,
        stdio: IS_JSON ? ['ignore', 'ignore', 'inherit'] : 'inherit',
        shell: process.platform === 'win32',
    });
    const seconds = Math.round((Date.now() - started) / 1000);
    process.stderr.write(`[coverage-gap] ${key}: ${seconds}s\n`);
    if (!existsSync(join(reportDir, 'coverage-summary.json'))) {
        throw new Error(
            `${key}: no coverage-summary.json. A FAILING TEST stops the ` +
                `report being written — fix the failure first, the gap ` +
                `numbers are meaningless until the suite is green.`,
        );
    }
    return { reportDir, seconds, status: result.status };
}

function readSummary(key) {
    const file = join(OUT_DIR, SURFACE_MAP[key].out, 'coverage-summary.json');
    if (!existsSync(file)) {
        throw new Error(
            `No report for ${key}. Run without --no-run first (${file}).`,
        );
    }
    return JSON.parse(readFileSync(file, 'utf8'));
}

function walk(dir, out = []) {
    if (!existsSync(dir)) {
        return out;
    }
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            walk(full, out);
        } else {
            out.push(toRepoPath(full));
        }
    }
    return out;
}

function listSiblingTests() {
    const files = [...walk(join(REPO_ROOT, 'src')), ...walk(join(REPO_ROOT, 'electron'))];
    const tests = new Set();
    for (const file of files) {
        const match = file.match(/^(.*?)(?:\.coverage)?\.(?:test|spec)\.[tj]sx?$/);
        if (match) {
            tests.add(match[1]);
        }
    }
    return tests;
}

function classify(file) {
    if (/Comp\.tsx$/.test(file)) {
        return 'component';
    }
    if (/^src\/[^/]+\.tsx?$/.test(file) || /main\.tsx$/.test(file)) {
        return 'entry';
    }
    if (/Helpers?\.(ts|tsx|mjs)$/.test(file)) {
        return 'helper';
    }
    return 'module';
}

function toRows(summary, siblingTests) {
    return Object.entries(summary)
        .filter(([key]) => key !== 'total')
        .map(([key, value]) => {
            const file = toRepoPath(key);
            return {
                file,
                kind: classify(file),
                lines: value.lines.total,
                covered: value.lines.covered,
                uncovered: value.lines.total - value.lines.covered,
                pct: value.lines.pct,
                branchPct: value.branches.pct,
                funcPct: value.functions.pct,
                hasSiblingTest: siblingTests.has(file.replace(/\.[tj]sx?$/, '')),
            };
        });
}

function readUncoveredRanges(key, wanted) {
    const file = join(OUT_DIR, SURFACE_MAP[key].out, 'coverage-final.json');
    if (!existsSync(file)) {
        return null;
    }
    const final = JSON.parse(readFileSync(file, 'utf8'));
    for (const [path, entry] of Object.entries(final)) {
        if (toRepoPath(path) !== wanted) {
            continue;
        }
        const missed = Object.entries(entry.statementMap)
            .filter(([id]) => entry.s[id] === 0)
            .map(([, loc]) => [loc.start.line, loc.end.line]);
        const merged = [];
        for (const [start, end] of missed.sort((a, b) => a[0] - b[0])) {
            const last = merged[merged.length - 1];
            if (last && start <= last[1] + 1) {
                last[1] = Math.max(last[1], end);
            } else {
                merged.push([start, end]);
            }
        }
        return merged;
    }
    return null;
}

function summarize(rows) {
    const sum = (field) => rows.reduce((total, row) => total + row[field], 0);
    const lines = sum('lines');
    const covered = sum('covered');
    return {
        files: rows.length,
        lines,
        covered,
        pct: lines ? Number(((100 * covered) / lines).toFixed(2)) : 0,
        zeroFiles: rows.filter((row) => row.pct === 0 && row.lines > 0).length,
        fullFiles: rows.filter((row) => row.pct === 100).length,
        linesToGoal: Math.max(0, Math.ceil((GOAL / 100) * lines) - covered),
    };
}

function byKind(rows) {
    const map = {};
    for (const row of rows) {
        const bucket = (map[row.kind] ??= { files: 0, lines: 0, covered: 0 });
        bucket.files++;
        bucket.lines += row.lines;
        bucket.covered += row.covered;
    }
    return Object.entries(map)
        .map(([kind, value]) => ({
            kind,
            ...value,
            pct: value.lines
                ? Number(((100 * value.covered) / value.lines).toFixed(1))
                : 0,
        }))
        .sort((a, b) => b.lines - a.lines);
}

function byDir(rows, depth = 2) {
    const map = {};
    for (const row of rows) {
        const dir = row.file.split('/').slice(0, depth).join('/');
        const bucket = (map[dir] ??= { files: 0, lines: 0, covered: 0, zero: 0 });
        bucket.files++;
        bucket.lines += row.lines;
        bucket.covered += row.covered;
        if (row.pct === 0) {
            bucket.zero++;
        }
    }
    return Object.entries(map)
        .map(([dir, value]) => ({
            dir,
            ...value,
            uncovered: value.lines - value.covered,
            pct: value.lines
                ? Number(((100 * value.covered) / value.lines).toFixed(1))
                : 0,
        }))
        .sort((a, b) => b.uncovered - a.uncovered);
}

function pad(text, width) {
    return String(text).padStart(width);
}

function main() {
    mkdirSync(OUT_DIR, { recursive: true });
    const surfaces =
        SURFACE === 'all' ? ['src', 'electron'] : SURFACE.split(',');
    for (const key of surfaces) {
        if (!SURFACE_MAP[key]) {
            throw new Error(`Unknown surface "${key}". Use src, electron or all.`);
        }
    }
    if (!has('no-run')) {
        for (const key of surfaces) {
            runCoverage(key);
        }
    }

    if (UNCOVERED_OF) {
        for (const key of surfaces) {
            const ranges = readUncoveredRanges(key, UNCOVERED_OF);
            if (ranges) {
                const text = ranges
                    .map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`))
                    .join(', ');
                process.stdout.write(
                    IS_JSON
                        ? JSON.stringify({ file: UNCOVERED_OF, ranges }, null, 2)
                        : `${UNCOVERED_OF}\nuncovered lines: ${text}\n`,
                );
                return;
            }
        }
        throw new Error(`${UNCOVERED_OF} is not in any report.`);
    }

    const siblingTests = listSiblingTests();
    let rows = [];
    for (const key of surfaces) {
        rows = rows.concat(toRows(readSummary(key), siblingTests));
    }
    if (DIR_FILTER) {
        rows = rows.filter((row) => row.file.startsWith(DIR_FILTER));
    }
    rows.sort((a, b) => b.uncovered - a.uncovered);

    const report = {
        goal: GOAL,
        measuredAt: new Date().toISOString(),
        surfaces,
        total: summarize(rows),
        byKind: byKind(rows),
        byDir: byDir(rows),
        files: rows,
    };
    // A --dir slice must never clobber the full worklist: that file is what a
    // cleared conversation resumes from, and a slice is a question, not a plan.
    const worklist = join(
        OUT_DIR,
        DIR_FILTER
            ? `slice-${DIR_FILTER.split('/').join('-')}.json`
            : 'worklist.json',
    );
    writeFileSync(worklist, JSON.stringify(report, null, 2));

    if (IS_JSON) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        return;
    }

    const { total } = report;
    const out = [];
    out.push('');
    out.push(`HONEST COVERAGE — every file in the surface, loaded or not`);
    out.push(
        `  ${total.pct}% lines (${total.covered}/${total.lines}) across ` +
            `${total.files} files`,
    );
    out.push(
        `  ${total.zeroFiles} files at 0%   ·   ${total.fullFiles} files at 100%`,
    );
    out.push(
        `  to ${GOAL}%: ${total.linesToGoal} more covered lines needed`,
    );
    out.push('');
    out.push('BY KIND');
    for (const row of report.byKind) {
        out.push(
            `  ${pad(row.pct + '%', 7)}  ${pad(row.files, 4)} files  ` +
                `${pad(row.lines, 6)} lines  ${row.kind}`,
        );
    }
    out.push('');
    out.push(`BIGGEST GAPS — uncovered lines first (top ${TOP})`);
    out.push('   uncov   lines   line%  test?  file');
    for (const row of rows.slice(0, TOP)) {
        out.push(
            `  ${pad(row.uncovered, 6)}  ${pad(row.lines, 6)}  ` +
                `${pad(row.pct + '%', 6)}  ${row.hasSiblingTest ? '  yes' : '   - '}  ` +
                `${row.file}`,
        );
    }
    out.push('');
    out.push(`worklist: ${toRepoPath(worklist)}`);
    out.push('');
    process.stdout.write(out.join('\n'));
}

try {
    main();
} catch (error) {
    process.stderr.write(`[coverage-gap] ${error.message}\n`);
    process.exit(1);
}
