// Cheap, read-only LEADS for every area of the app -- what an `/owa-enhance`
// run triages before it decides where to look.
//
//   node .claude/skills/owa-enhance/scripts/triage.mjs
//   node .../triage.mjs --area=security    every hit, with its line numbers
//   node .../triage.mjs --json
//
// A signal is never a finding. A count of HTML sinks says where to read, not
// that one is exploitable; a module with no test may need none. Each signal is
// here because a real defect in this repo once started as that shape.
//
// What it reads: tracked files (`git ls-files`, so nothing ignored or
// generated leaks in), `git log`, the backlogs of this skill and of the three
// AI-subsystem skills, the memory notes, the newest /owa-robot-test run and
// the newest saved /owa-enhance report. What it never does: write a file,
// reach the running app, or use the network -- it works with the app shut and
// costs nothing to re-run.
//
// Exit code: 0, or 2 for an --area it does not know.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts -> owa-enhance -> skills -> .claude|.github -> repo root
const REPO_ROOT = path.join(HERE, '..', '..', '..', '..');

const AREA_LIST = [
    'security',
    'performance',
    'reliability',
    'ui',
    'dev-flow',
    'code-health',
    'docs',
];
// The words SKILL.md's area table answers to.
const AREA_ALIAS_MAP = {
    sec: 'security',
    harden: 'security',
    perf: 'performance',
    memory: 'performance',
    speed: 'performance',
    startup: 'performance',
    bugs: 'reliability',
    correctness: 'reliability',
    data: 'reliability',
    crash: 'reliability',
    ux: 'ui',
    a11y: 'ui',
    i18n: 'ui',
    khmer: 'ui',
    design: 'ui',
    dx: 'dev-flow',
    tooling: 'dev-flow',
    ci: 'dev-flow',
    build: 'dev-flow',
    release: 'dev-flow',
    health: 'code-health',
    architecture: 'code-health',
    refactor: 'code-health',
    deps: 'code-health',
    tests: 'code-health',
    manual: 'docs',
    notes: 'docs',
    mirror: 'docs',
};

const argList = process.argv.slice(2);
const isJson = argList.includes('--json');
const areaArg = argList
    .find((arg) => arg.startsWith('--area='))
    ?.slice('--area='.length);
const focusArea = areaArg ? (AREA_ALIAS_MAP[areaArg] ?? areaArg) : null;
if (focusArea !== null && !AREA_LIST.includes(focusArea)) {
    console.error(`Unknown area "${areaArg}". Areas: ${AREA_LIST.join(', ')}.`);
    process.exit(2);
}
const isFull = focusArea !== null;
// The overview names the first few; an area asked for by name gets them all.
const LIST_LIMIT = 4;

// A Windows checkout can hand these files over with CRLF endings, and `.`
// does not match `\r` -- so every line split tolerates both.
const LINE_BREAK_PATTERN = /\r?\n/;
const CODE_FILE_PATTERN = /\.(?:ts|tsx|mjs|js)$/;
const TEST_FILE_PATTERN =
    /\.(?:test|spec)\.(?:ts|tsx|mjs|js)$|(?:^|\/)(?:e2e|test-setup)\//;
// Dev-only scratch, generated data tables and test scaffolding: not code a
// volunteer's machine runs.
const NOT_APP_CODE_PATTERN =
    /^src\/(?:experiments|lang\/data)\/|^electron\/test[A-Z]/;
// English-only by decision, and owned by their own skills.
const AI_WINDOW_PATTERN = /^src\/(?:chatbot|aichat)\//;
const COMMENT_LINE_PATTERN = /^\s*(?:\/\/|\/\*|\*)/;
const FUNCTION_DEFINITION_PATTERN = /^\s*(?:export\s+)?(?:async\s+)?function\s/;
const LOGIC_MODULE_PATTERN =
    /(?:Helpers|helpers|Utils|utils)\.(?:ts|mjs)$|^tools\/[^/]+\/[^/]+\.mjs$|^electron\/[^/]+\.ts$/;
// A path, not a word that happens to contain a slash: `tools/list` is an MCP
// method. So a file extension, or a trailing slash for a folder.
const NOTE_PATH_PATTERN =
    /^(?:src|electron|tools|extra-work|docs|html|e2e|public)\/[\w@.\-\/]*(?:\.[A-Za-z0-9]+|\/)$/;
// "Status: OPEN" is how a memory note says a bug is still there; the bare word
// also names open panes, open runs and a gate that fails open.
const OPEN_NOTE_PATTERN = /Status:\s*\**\s*OPEN\b/;
const STATUS_PATTERN = /\b(?:open|idea|doing|done|wontfix)\b/g;
const MAX_READ_BYTES = 2 * 1024 * 1024;

const BACKLOG_PATH_MAP = {
    EN: '.claude/skills/owa-enhance/references/backlog.md',
    EC: '.claude/skills/owa-enhance-chatbot/references/backlog.md',
    MC: '.claude/skills/owa-enhance-mcp/references/backlog.md',
    AC: '.claude/skills/owa-enhance-aichat/references/backlog.md',
};
// Where the two high-frequency event hooks are DEFINED rather than used.
const EVENT_HOOK_DEFINITION_SET = new Set([
    'src/_screen/managers/screenManagerHooks.ts',
    'src/helper/dirSourceHelpers.ts',
]);
// Where code lands, not notes: `.claude/`, `.github/` and `docs/` move with
// nearly every change and would bury the subsystems a regression comes from.
const CODE_ROOT_SET = new Set([
    'src',
    'electron',
    'tools',
    'html',
    'extra-work',
    'e2e',
]);
const SPLIT_CODE_ROOT_SET = new Set(['src', 'electron', 'tools']);

function runGit(gitArgs) {
    try {
        return execFileSync('git', gitArgs, {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            maxBuffer: 64 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return '';
    }
}

function toRepoPath(fullPath) {
    return path.relative(REPO_ROOT, fullPath).split(path.sep).join('/');
}

function listNames(dirPath, { isDirectory = false } = {}) {
    try {
        return readdirSync(dirPath, { withFileTypes: true })
            .filter((entry) => {
                return isDirectory ? entry.isDirectory() : entry.isFile();
            })
            .map((entry) => entry.name);
    } catch {
        return [];
    }
}

function listFilesUnder(dirPath) {
    const relPaths = [];
    const walk = (currentPath) => {
        for (const name of listNames(currentPath, { isDirectory: true })) {
            walk(path.join(currentPath, name));
        }
        for (const name of listNames(currentPath)) {
            relPaths.push(
                path
                    .relative(dirPath, path.join(currentPath, name))
                    .split(path.sep)
                    .join('/'),
            );
        }
    };
    walk(dirPath);
    return relPaths.sort();
}

function findNewestFile(dirPath, pattern) {
    let newest = null;
    for (const name of listNames(dirPath)) {
        if (!pattern.test(name)) {
            continue;
        }
        const modifiedMs = statSync(path.join(dirPath, name)).mtimeMs;
        if (newest === null || modifiedMs > newest.modifiedMs) {
            newest = { filePath: path.join(dirPath, name), modifiedMs };
        }
    }
    return newest?.filePath ?? null;
}

function checkIsSameFile(onePath, otherPath) {
    try {
        return readFileSync(onePath).equals(readFileSync(otherPath));
    } catch {
        return false;
    }
}

// Held for this run only: the process ends once the report is printed.
const textMap = new Map();
function readRepoText(relPath) {
    if (!textMap.has(relPath)) {
        let text = null;
        try {
            const fullPath = path.join(REPO_ROOT, relPath);
            if (statSync(fullPath).size <= MAX_READ_BYTES) {
                text = readFileSync(fullPath, 'utf-8');
            }
        } catch {
            // Deleted in the working tree while still in the index.
        }
        textMap.set(relPath, text);
    }
    return textMap.get(relPath);
}

function isCommentLine(line) {
    return COMMENT_LINE_PATTERN.test(line);
}

function isCommentOrDefinitionLine(line) {
    return isCommentLine(line) || FUNCTION_DEFINITION_PATTERN.test(line);
}

/**
 * The lines of `relPaths` matching `pattern` (which carries the g flag),
 * grouped by file, most hits first. Line-based on purpose: the code is
 * prettier-formatted, so every shape looked for sits on one line -- and a line
 * number is what a reader opens next.
 */
function findHits(relPaths, pattern, { skipLine = isCommentLine } = {}) {
    const files = [];
    let total = 0;
    for (const relPath of relPaths) {
        const text = readRepoText(relPath);
        if (text === null) {
            continue;
        }
        const hits = [];
        text.split(LINE_BREAK_PATTERN).forEach((line, index) => {
            if (skipLine !== null && skipLine(line)) {
                return;
            }
            for (const match of line.matchAll(pattern)) {
                hits.push({ line: index + 1, text: match[0] });
            }
        });
        if (hits.length > 0) {
            files.push({ file: relPath, hits });
            total += hits.length;
        }
    }
    files.sort((one, other) => {
        return (
            other.hits.length - one.hits.length ||
            one.file.localeCompare(other.file)
        );
    });
    return { total, files };
}

function toHitSignal(label, found, { withSamples = false } = {}) {
    return {
        label,
        value: found.total,
        fileCount: found.files.length,
        items: found.files.map((one) => {
            return {
                name: one.file,
                count: one.hits.length,
                lines: one.hits.map((hit) => hit.line),
                samples: withSamples
                    ? one.hits.slice(0, 3).map((hit) => hit.text)
                    : undefined,
            };
        }),
    };
}

const trackedFiles = runGit(['ls-files', '-z']).split('\0').filter(Boolean);
const appCodeFiles = trackedFiles.filter((relPath) => {
    return (
        CODE_FILE_PATTERN.test(relPath) &&
        /^(?:src|electron|tools)\//.test(relPath) &&
        !TEST_FILE_PATTERN.test(relPath) &&
        !NOT_APP_CODE_PATTERN.test(relPath)
    );
});
const testFiles = trackedFiles.filter((relPath) => {
    return CODE_FILE_PATTERN.test(relPath) && TEST_FILE_PATTERN.test(relPath);
});
const srcFiles = appCodeFiles.filter((relPath) => relPath.startsWith('src/'));
const electronFiles = appCodeFiles.filter((relPath) => {
    return relPath.startsWith('electron/');
});
const srcAndElectronFiles = [...srcFiles, ...electronFiles];

// ---- the evidence already on disk ------------------------------------------

function readNewestRobotRun() {
    const filePath = findNewestFile(
        path.join(REPO_ROOT, 'test-results', 'robot-test'),
        /^coverage-.*\.json$/,
    );
    if (filePath === null) {
        return null;
    }
    try {
        const run = JSON.parse(readFileSync(filePath, 'utf-8'));
        // A run file keys its rows by id; an array is read the same way.
        const rows = Array.isArray(run.rows)
            ? run.rows
            : Object.entries(run.rows ?? {}).map(([id, value]) => {
                  return value !== null && typeof value === 'object'
                      ? { id, ...value }
                      : { id, status: value };
              });
        return {
            file: toRepoPath(filePath),
            runId: run.runId ?? path.basename(filePath),
            finishedAt: run.finishedAt ?? null,
            rowCount: rows.length,
            notPassing: rows
                .filter((row) => {
                    return !['PASS', 'INFO', 'EXCLUDED'].includes(
                        String(row.status).toUpperCase(),
                    );
                })
                .map((row) => {
                    return {
                        id: row.id,
                        status: row.status,
                        evidence: String(row.evidence ?? '').slice(0, 160),
                    };
                }),
        };
    } catch {
        return null;
    }
}

function listOpenMemoryNotes() {
    const memoryDirPath = path.join(REPO_ROOT, '.claude', 'memory');
    return listNames(memoryDirPath)
        .filter((name) => name.endsWith('.md') && name !== 'MEMORY.md')
        .filter((name) => {
            const text = readFileSync(path.join(memoryDirPath, name), 'utf-8');
            return OPEN_NOTE_PATTERN.test(text);
        })
        .map((name) => name.replace(/\.md$/, ''));
}

/**
 * A backlog's items off its headings. Both shapes in use are read -- `## EC-181
 * · title — `done` date` and `### `MC-01` — title · open` -- and the status is
 * the LAST status word on the line, because a title can say "open" too. Fenced
 * examples are skipped, or a backlog's own entry template counts as an item.
 */
function readBacklog(prefix, relPath) {
    let text;
    try {
        text = readFileSync(path.join(REPO_ROOT, relPath), 'utf-8');
    } catch {
        return null;
    }
    const headingPattern = new RegExp(
        '^#{2,4}\\s+`?(' + prefix + '-\\d+)`?(.*)$',
    );
    const itemMap = new Map();
    let isInFence = false;
    for (const line of text.split(LINE_BREAK_PATTERN)) {
        if (/^\s*```/.test(line)) {
            isInFence = !isInFence;
            continue;
        }
        const match = isInFence ? null : line.match(headingPattern);
        if (match === null || itemMap.has(match[1])) {
            continue;
        }
        const lastStatus = [...match[2].matchAll(STATUS_PATTERN)].at(-1);
        itemMap.set(match[1], {
            id: match[1],
            status: lastStatus?.[0] ?? 'unknown',
            title: (lastStatus
                ? match[2].slice(0, lastStatus.index)
                : match[2]
            ).replace(/^[\s·—–-]+|[\s·—–`(-]+$/g, ''),
        });
    }
    const counts = {};
    for (const item of itemMap.values()) {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return {
        prefix,
        file: relPath,
        counts,
        notDone: [...itemMap.values()].filter((item) => {
            return ['open', 'idea', 'doing'].includes(item.status);
        }),
    };
}

function readContext() {
    const [sha = '?', subject = ''] = runGit(['log', '-1', '--pretty=%h%x00%s'])
        .trim()
        .split('\0');
    const newestReportPath = findNewestFile(
        path.join(REPO_ROOT, 'test-results', 'owa-enhance'),
        /^report-.*\.md$/,
    );
    return {
        head: {
            sha,
            subject,
            changedPathCount: runGit(['status', '--porcelain'])
                .split('\n')
                .filter(Boolean).length,
        },
        robotRun: readNewestRobotRun(),
        newestReport:
            newestReportPath === null ? null : toRepoPath(newestReportPath),
        openMemoryNotes: listOpenMemoryNotes(),
        backlogs: Object.entries(BACKLOG_PATH_MAP)
            .map(([prefix, relPath]) => readBacklog(prefix, relPath))
            .filter(Boolean),
    };
}

// ---- the areas --------------------------------------------------------------

function readSecuritySignals() {
    return [
        toHitSignal(
            'ipcMain handlers',
            findHits(
                electronFiles,
                /\bipcMain\.(?:on|once|handle|handleOnce)\(/g,
            ),
        ),
        toHitSignal(
            'HTML sinks',
            findHits(
                srcAndElectronFiles,
                /\bdangerouslySetInnerHTML\b|\.(?:inner|outer)HTML\s*\+?=(?!=)|\binsertAdjacentHTML\(/g,
            ),
        ),
        // The shell call and every wrapper around it: a renderer reaches the
        // system browser through the wrapper, so that is where input arrives.
        toHitSignal(
            'openExternal* calls',
            findHits(srcAndElectronFiles, /\bopenExternal\w*\(/g, {
                skipLine: isCommentOrDefinitionLine,
            }),
        ),
        toHitSignal(
            'nodeIntegration: true',
            findHits(electronFiles, /\bnodeIntegration:\s*true\b/g),
        ),
        toHitSignal(
            'webSecurity: false',
            findHits(srcAndElectronFiles, /\bwebSecurity:\s*false\b/g),
        ),
    ];
}

function readPerformanceSignals() {
    const hookUserFiles = srcFiles.filter((relPath) => {
        const text = readRepoText(relPath);
        return (
            !EVENT_HOOK_DEFINITION_SET.has(relPath) &&
            text !== null &&
            /\b(?:useScreenUpdateEvents|useFileSourceEvents)\(/.test(text)
        );
    });
    const undebouncedFiles = hookUserFiles.filter((relPath) => {
        return !/\bgenTimeoutAttempt\b/.test(readRepoText(relPath));
    });
    return [
        // Constructed EMPTY at module scope, so filled while the app runs --
        // the shape of an unbounded cache. A `new Set([...])` of constants is
        // not, and is not counted.
        toHitSignal(
            'module-level Map / Set, filled later',
            findHits(
                srcAndElectronFiles,
                /^(?:export\s+)?(?:const|let|var)\s+[\w$]+(?:\s*:.*?)?\s*=\s*new\s+(?:Map|Set)\s*(?:<.*>)?\(\s*\)/g,
            ),
        ),
        {
            label: 'event-hook files, no debounce',
            value: undebouncedFiles.length,
            text: `of ${hookUserFiles.length} using the screen / file-source hooks:`,
            items: undebouncedFiles.map((relPath) => ({ name: relPath })),
        },
        toHitSignal(
            'setInterval calls (src)',
            findHits(srcFiles, /\bsetInterval\(/g),
        ),
        toHitSignal(
            'sync file reads/writes (src)',
            findHits(
                srcFiles,
                /\b(?:fsReadFileSync|fsWriteFileSync|readFileSync|writeFileSync)\(/g,
                { skipLine: isCommentOrDefinitionLine },
            ),
        ),
    ];
}

function readReliabilitySignals() {
    return [
        toHitSignal(
            'empty catch blocks',
            findHits(
                appCodeFiles,
                /\bcatch\s*(?:\(\s*[\w$]*\s*\))?\s*\{\s*\}/g,
            ),
        ),
        toHitSignal(
            'file write calls',
            findHits(
                srcAndElectronFiles,
                /\b(?:fsWriteFileSync|fsWriteFile|writeFileSync|writeFile)\(/g,
                { skipLine: isCommentOrDefinitionLine },
            ),
        ),
    ];
}

function readUiSignals() {
    const tsxFiles = srcFiles.filter((relPath) => {
        return relPath.endsWith('.tsx') && !AI_WINDOW_PATTERN.test(relPath);
    });
    const styleFiles = trackedFiles.filter((relPath) => {
        return (
            /^src\/.*\.s?css$/.test(relPath) &&
            !NOT_APP_CODE_PATTERN.test(relPath) &&
            !AI_WINDOW_PATTERN.test(relPath)
        );
    });
    return [
        toHitSignal(
            'literal English attributes',
            findHits(
                tsxFiles,
                /\b(?:title|aria-label|placeholder|alt)="[^"{}]*[A-Za-z][^"{}]*"/g,
            ),
            { withSamples: true },
        ),
        toHitSignal(
            'hard-coded colours (scss, tsx)',
            findHits([...styleFiles, ...tsxFiles], /(?<![\w&])#[0-9a-fA-F]{3,8}\b/g, {
                // A token being DEFINED is where a colour belongs.
                skipLine: (line) => {
                    return isCommentLine(line) || /^\s*--[\w-]+\s*:/.test(line);
                },
            }),
        ),
    ];
}

function readDevFlowSignals() {
    const workflowNames = listNames(
        path.join(REPO_ROOT, '.github', 'workflows'),
    ).filter((name) => /\.ya?ml$/.test(name));
    const rootCountMap = new Map();
    for (const relPath of testFiles) {
        const root = relPath.split('/')[0];
        rootCountMap.set(root, (rootCountMap.get(root) ?? 0) + 1);
    }
    return [
        {
            label: 'CI workflows',
            value: workflowNames.length,
            text:
                workflowNames.length === 0
                    ? 'none: npm run lint on one machine is the only gate'
                    : '',
            items: workflowNames.map((name) => ({ name })),
        },
        toHitSignal(
            '.only / .skip in tests',
            findHits(testFiles, /\b(?:it|test|describe)\.(?:only|skip)\(/g),
        ),
        toHitSignal(
            'dead debuggerHelpers mocks',
            findHits(
                testFiles,
                /\bvi\.mock\(\s*['"][^'"]*debuggerHelpers['"]/g,
            ),
        ),
        {
            label: 'test files',
            value: testFiles.length,
            text: [...rootCountMap]
                .sort((one, other) => other[1] - one[1])
                .map(([root, count]) => `${root} ${count}`)
                .join(' · '),
        },
    ];
}

function toChurnBucket(relPath) {
    const parts = relPath.split('/');
    if (SPLIT_CODE_ROOT_SET.has(parts[0]) && parts.length > 2) {
        return `${parts[0]}/${parts[1]}`;
    }
    return parts[0];
}

function readChurn() {
    const log = runGit([
        'log',
        '--since=30.days',
        '--name-only',
        '--pretty=format:%x00%h',
    ]);
    const commitCountMap = new Map();
    let commitCount = 0;
    for (const chunk of log.split('\0').slice(1)) {
        const codePaths = chunk
            .split(LINE_BREAK_PATTERN)
            .slice(1)
            .map((line) => line.trim())
            .filter((line) => CODE_ROOT_SET.has(line.split('/')[0]));
        if (codePaths.length === 0) {
            continue;
        }
        commitCount += 1;
        for (const bucket of new Set(codePaths.map(toChurnBucket))) {
            commitCountMap.set(bucket, (commitCountMap.get(bucket) ?? 0) + 1);
        }
    }
    return {
        commitCount,
        buckets: [...commitCountMap]
            .map(([name, count]) => ({ name, count }))
            .sort((one, other) => other.count - one.count),
    };
}

function readCodeHealthSignals() {
    const testBaseSet = new Set(
        testFiles.map((relPath) => {
            return relPath.replace(
                /(?:\.coverage)?\.(?:test|spec)\.(?:ts|tsx|mjs|js)$/,
                '',
            );
        }),
    );
    const sizedFiles = appCodeFiles
        .map((relPath) => {
            const text = readRepoText(relPath);
            return {
                name: relPath,
                count: text === null ? 0 : text.split(LINE_BREAK_PATTERN).length,
            };
        })
        .sort((one, other) => other.count - one.count);
    const bigFiles = sizedFiles.filter((item) => item.count >= 1000);
    const untestedFiles = sizedFiles.filter((item) => {
        return (
            LOGIC_MODULE_PATTERN.test(item.name) &&
            item.count >= 40 &&
            !testBaseSet.has(item.name.replace(CODE_FILE_PATTERN, ''))
        );
    });
    const churn = readChurn();
    return [
        {
            label: 'modules over 1 000 lines',
            value: bigFiles.length,
            items: bigFiles,
        },
        {
            label: 'logic modules with no test',
            value: untestedFiles.length,
            text: 'largest first:',
            items: untestedFiles,
        },
        toHitSignal(
            'TODO / FIXME / HACK markers',
            findHits(appCodeFiles, /\b(?:TODO|FIXME|HACK|XXX)\b/g, {
                skipLine: null,
            }),
        ),
        {
            label: 'commits touching code, 30 days',
            value: churn.commitCount,
            text: 'by where they landed:',
            items: churn.buckets,
        },
    ];
}

/**
 * `.claude/` is the source of truth and `.github/` its Copilot copy. The
 * owa-* skills are mirrored by rule and any other skill already carried over
 * is held to its copy too; the review skills were never mirrored.
 */
function readMirrorDrift() {
    const claudeDirPath = path.join(REPO_ROOT, '.claude');
    const githubDirPath = path.join(REPO_ROOT, '.github');
    const drift = [];
    if (
        !checkIsSameFile(
            path.join(claudeDirPath, 'CLAUDE.md'),
            path.join(githubDirPath, 'copilot-instructions.md'),
        )
    ) {
        drift.push('CLAUDE.md differs from .github/copilot-instructions.md');
    }
    const compareDirs = (subPath) => {
        const claudePath = path.join(claudeDirPath, subPath);
        const githubPath = path.join(githubDirPath, subPath);
        const claudeSet = new Set(listFilesUnder(claudePath));
        const githubSet = new Set(listFilesUnder(githubPath));
        for (const relPath of [...new Set([...claudeSet, ...githubSet])].sort()) {
            if (!githubSet.has(relPath)) {
                drift.push(`${subPath}/${relPath} -- only in .claude`);
            } else if (!claudeSet.has(relPath)) {
                drift.push(`${subPath}/${relPath} -- only in .github`);
            } else if (
                !checkIsSameFile(
                    path.join(claudePath, relPath),
                    path.join(githubPath, relPath),
                )
            ) {
                drift.push(`${subPath}/${relPath} -- differs`);
            }
        }
    };
    compareDirs('memory');
    const skillNameSet = new Set([
        ...listNames(path.join(claudeDirPath, 'skills'), {
            isDirectory: true,
        }).filter((name) => name.startsWith('owa-')),
        ...listNames(path.join(githubDirPath, 'skills'), { isDirectory: true }),
    ]);
    for (const skillName of [...skillNameSet].sort()) {
        compareDirs(`skills/${skillName}`);
    }
    return drift;
}

function listNoteFilePaths() {
    const claudeDirPath = path.join(REPO_ROOT, '.claude');
    return [
        path.join(claudeDirPath, 'CLAUDE.md'),
        ...['memory', 'skills'].flatMap((subName) => {
            const dirPath = path.join(claudeDirPath, subName);
            return listFilesUnder(dirPath)
                .filter((relPath) => relPath.endsWith('.md'))
                .map((relPath) => path.join(dirPath, relPath));
        }),
    ];
}

function readStalePathRefs() {
    const stale = [];
    for (const notePath of listNoteFilePaths()) {
        let text;
        try {
            text = readFileSync(notePath, 'utf-8');
        } catch {
            continue;
        }
        const seenSet = new Set();
        for (const match of text.matchAll(/`([^`\n]+)`/g)) {
            const token = match[1]
                .trim()
                .replace(/#L\d+(?:-L?\d+)?$/, '')
                .replace(/:\d+(?:-\d+)?$/, '');
            if (seenSet.has(token) || !NOTE_PATH_PATTERN.test(token)) {
                continue;
            }
            seenSet.add(token);
            try {
                statSync(path.join(REPO_ROOT, token));
            } catch {
                stale.push({ note: toRepoPath(notePath), token });
            }
        }
    }
    return stale;
}

function readKnowledgeFreshness() {
    const indexPath = path.join(
        REPO_ROOT,
        'electron-build',
        'knowledge',
        'index.json',
    );
    let builtAtMs;
    try {
        builtAtMs = statSync(indexPath).mtimeMs;
    } catch {
        return {
            state: 'not built',
            text: 'npm run dev (electron:build) builds it',
            newer: [],
        };
    }
    const manualDirPath = path.join(REPO_ROOT, 'docs', 'manual-sources');
    const sourcePaths = [
        ...listNoteFilePaths(),
        ...listFilesUnder(manualDirPath)
            .filter((relPath) => relPath.endsWith('.md'))
            .map((relPath) => path.join(manualDirPath, relPath)),
    ];
    const newer = sourcePaths
        .filter((sourcePath) => {
            try {
                return statSync(sourcePath).mtimeMs > builtAtMs;
            } catch {
                return false;
            }
        })
        .map(toRepoPath);
    return {
        state: newer.length === 0 ? 'fresh' : 'stale',
        text:
            `built ${toLocalStamp(new Date(builtAtMs))}` +
            (newer.length === 0 ? '' : `; ${newer.length} sources newer:`),
        newer,
    };
}

function readDocsSignals() {
    const drift = readMirrorDrift();
    const stale = readStalePathRefs();
    const knowledge = readKnowledgeFreshness();
    return [
        {
            label: 'mirror drift (.claude -> .github)',
            value: drift.length,
            items: drift.map((name) => ({ name })),
        },
        {
            label: 'repo paths in notes that are gone',
            value: stale.length,
            items: stale.map((one) => ({ name: `${one.note} -> ${one.token}` })),
        },
        {
            label: 'knowledge index',
            value: knowledge.state,
            text: knowledge.text,
            items: knowledge.newer.map((name) => ({ name })),
        },
    ];
}

const SIGNAL_READER_MAP = {
    security: readSecuritySignals,
    performance: readPerformanceSignals,
    reliability: readReliabilitySignals,
    ui: readUiSignals,
    'dev-flow': readDevFlowSignals,
    'code-health': readCodeHealthSignals,
    docs: readDocsSignals,
};

// ---- printing ---------------------------------------------------------------

function toLocalStamp(date) {
    const pad = (number) => String(number).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
        `${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

function formatRow(label, value, text = '') {
    return `  ${label.padEnd(37)}${String(value).padStart(9)}  ${text}`.trimEnd();
}

function toShortItem(item) {
    return item.count > 1 ? `${item.name} (${item.count})` : item.name;
}

function toFullItem(item) {
    let text = item.name;
    if (item.lines?.length > 0) {
        const shownLines = [...new Set(item.lines)];
        text +=
            ':' +
            shownLines.slice(0, 30).join(',') +
            (shownLines.length > 30 ? ',...' : '');
    } else if (item.count > 1) {
        text += ` (${item.count})`;
    }
    if (item.samples?.length > 0) {
        text +=
            '  ' +
            item.samples
                .map((sample) => {
                    return JSON.stringify(
                        sample.length > 60 ? `${sample.slice(0, 57)}...` : sample,
                    );
                })
                .join(' ');
    }
    return text;
}

function formatSignal(signal) {
    const items = signal.items ?? [];
    const lead =
        signal.text || (signal.fileCount > 0 ? `in ${signal.fileCount} files:` : '');
    if (isFull) {
        return [
            formatRow(signal.label, signal.value, lead),
            ...items.map((item) => `      ${toFullItem(item)}`),
        ];
    }
    const shown = items.slice(0, LIST_LIMIT).map(toShortItem);
    if (items.length > LIST_LIMIT) {
        shown.push(`+${items.length - LIST_LIMIT} more`);
    }
    return [
        formatRow(
            signal.label,
            signal.value,
            [lead, shown.join(' · ')].filter(Boolean).join(' '),
        ),
    ];
}

function formatContext(context) {
    const lines = ['Evidence already on disk'];
    const run = context.robotRun;
    if (run === null) {
        lines.push(formatRow('newest /owa-robot-test run', 'none'));
    } else {
        const shownRows = isFull ? run.notPassing : run.notPassing.slice(0, 6);
        lines.push(
            formatRow(
                'newest /owa-robot-test run',
                run.runId,
                `${run.rowCount} rows, ${run.notPassing.length} not passing`,
            ),
        );
        for (const row of shownRows) {
            lines.push(`      ${row.id} ${row.status} -- ${row.evidence}`);
        }
        if (shownRows.length < run.notPassing.length) {
            lines.push(
                `      +${run.notPassing.length - shownRows.length} more ` +
                    '(any --area lists them all)',
            );
        }
    }
    lines.push(
        formatRow(
            'newest /owa-enhance report',
            context.newestReport === null ? 'none' : '',
            context.newestReport ?? '',
        ),
    );
    lines.push(
        formatRow(
            'memory notes marked OPEN',
            context.openMemoryNotes.length,
            context.openMemoryNotes.join(' · '),
        ),
    );
    const notDoneCount = context.backlogs.reduce((total, backlog) => {
        return total + backlog.notDone.length;
    }, 0);
    lines.push(
        formatRow(
            'backlog items not done',
            notDoneCount,
            context.backlogs
                .map((backlog) => `${backlog.prefix} ${backlog.notDone.length}`)
                .join(' · '),
        ),
    );
    for (const backlog of context.backlogs) {
        if (backlog.notDone.length === 0) {
            continue;
        }
        // The chatbot's backlog alone runs to dozens: name enough to recognise
        // a match, and say where the rest are.
        const shownItems = backlog.notDone.slice(0, isFull ? 12 : 8);
        const restCount = backlog.notDone.length - shownItems.length;
        const restText =
            restCount > 0 ? `+${restCount} more in ${backlog.file}` : '';
        if (isFull) {
            for (const item of shownItems) {
                lines.push(`      ${item.id} ${item.status} -- ${item.title}`);
            }
            if (restText) {
                lines.push(`      ${restText}`);
            }
        } else {
            lines.push(
                '      ' +
                    [shownItems.map((item) => item.id).join(', '), restText]
                        .filter(Boolean)
                        .join(' · '),
            );
        }
    }
    return lines;
}

const context = readContext();
const areaMap = {};
for (const area of isFull ? [focusArea] : AREA_LIST) {
    areaMap[area] = SIGNAL_READER_MAP[area]();
}

if (isJson) {
    console.log(
        JSON.stringify(
            { generatedAt: new Date().toISOString(), ...context, areas: areaMap },
            null,
            2,
        ),
    );
} else {
    const { head } = context;
    const lines = [
        `OWA triage · HEAD ${head.sha} "${head.subject}" · ` +
            (head.changedPathCount === 0
                ? 'clean tree'
                : `${head.changedPathCount} changed paths`) +
            ` · ${toLocalStamp(new Date())}`,
        'Signals are LEADS: each says where to read, never what is wrong.',
        '',
        ...formatContext(context),
    ];
    for (const [area, signals] of Object.entries(areaMap)) {
        lines.push('', area);
        for (const signal of signals) {
            lines.push(...formatSignal(signal));
        }
    }
    console.log(lines.join('\n'));
}
