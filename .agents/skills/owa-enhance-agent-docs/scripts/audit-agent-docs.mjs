// What the agent documents CLAIM, checked against what the repo IS -- the
// leads an `/owa-enhance-agent-docs` run starts from.
//
//   node .claude/skills/owa-enhance-agent-docs/scripts/audit-agent-docs.mjs
//   node .../audit-agent-docs.mjs --check=paths,tools   only those checks
//   node .../audit-agent-docs.mjs --doc=.claude/rules/  only claims made there
//   node .../audit-agent-docs.mjs --all                 every hit, not the first few
//   node .../audit-agent-docs.mjs --with-ledgers        also the history ledgers
//   node .../audit-agent-docs.mjs --json
//
// The agent documents are what `extra-work/build-knowledge.mjs` ships as the
// chatbot's internal corpus and what every Claude Code / Codex session reads:
// `.claude/CLAUDE.md`, `.claude/rules/`, `.claude/memory/`, `.claude/skills/`
// (and their Codex mirror, checked for drift only).
//
// A hit is a LEAD, never a finding. A backticked name the code does not hold
// may be a DOM API, a word that only looks like code, or a record of something
// deliberately removed. Every hit is confirmed by reading the code and the
// note before anything is edited -- the skill's checks.md says how per check.
//
// Ledgers -- backlogs, scoreboards, plans, the manual source `user-workflows.md`
// -- are HISTORY: an entry that names a file deleted since is still true about
// the day it was written. They are skipped unless --with-ledgers.
//
// What it reads: the file listing (`git ls-files -co --exclude-standard`, so
// nothing ignored leaks in), the code under it, one `git log`, and the knowledge
// index's timestamp. What it never does: write a file, reach the app, or use
// the network. It works with the app shut and costs nothing to re-run.
//
// A lead a run already confirmed as history or as an external name is listed
// in the skill's `references/killed-leads.json` (check + doc + name, never a
// line number, so an edit above it does not bring it back). The paths and
// symbols checks set those aside, and report an entry whose doc no longer
// names it, so the list cannot rot into a blanket exemption.
//
// Exit code: 0, or 2 for a --check it does not know.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts -> owa-enhance-agent-docs -> skills -> .claude|.agents -> repo root
const REPO_ROOT = path.join(HERE, '..', '..', '..', '..');

const CHECK_LIST = [
    'paths',
    'symbols',
    'tools',
    'scripts',
    'env',
    'ids',
    'memory',
    'rules',
    'skills',
    'mirror',
    'knowledge',
    'budget',
    'coverage',
    'staleness',
    'prose-rules',
];

const argList = process.argv.slice(2);
const isJson = argList.includes('--json');
const isAll = argList.includes('--all');
const isWithLedgers = argList.includes('--with-ledgers');
const readArgValue = (name) => {
    return argList
        .find((arg) => arg.startsWith(`--${name}=`))
        ?.slice(name.length + 3);
};
const checkArg = readArgValue('check');
const docArg = readArgValue('doc')?.replace(/\\/g, '/');
// The checks that read claims doc by doc -- all --doc narrows by default.
const CLAIM_CHECK_LIST = [
    'paths',
    'symbols',
    'tools',
    'scripts',
    'env',
    'ids',
    'memory',
];
const checkSet = new Set(
    checkArg ? checkArg.split(',') : docArg ? CLAIM_CHECK_LIST : CHECK_LIST,
);
const unknownCheckList = [...checkSet].filter((name) => {
    return !CHECK_LIST.includes(name);
});
if (unknownCheckList.length > 0) {
    console.error(
        `Unknown check "${unknownCheckList.join(', ')}". ` +
            `Checks: ${CHECK_LIST.join(', ')}.`,
    );
    process.exit(2);
}
const LIST_LIMIT = isAll || checkArg ? Infinity : 8;

// A Windows checkout can hand these files over with CRLF endings, and `.`
// does not match `\r` -- so every line split tolerates both.
const LINE_BREAK_PATTERN = /\r?\n/;
const MAX_READ_BYTES = 2 * 1024 * 1024;
const CODE_EXTENSION_PATTERN =
    /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|html|scss|css|json|toml|ya?ml|sh)$/;
// Not code: the notes themselves, their mirrors, the manual and generated docs.
const NOT_CODE_ROOT_PATTERN = /^(?:\.claude|\.codex|\.agents|docs)\//;
// Roots a backticked token must start with to be read as a repo path claim.
// Generated and ignored roots (`electron-build/`, `dist/`, `release/`,
// `test-results/`, `node_modules/`) are absent by design and never checked.
const PATH_ROOT_PATTERN =
    /^(?:src|electron|tools|extra-work|docs|html|e2e|public|resources|\.claude|\.codex|\.agents|\.vscode)\//;
const PLACEHOLDER_PATTERN = /[\s*<>{}$|?…]|\.\.\.|^~|^\/|^[A-Za-z]:/;
const FILE_EXTENSION_PATTERN = /\.[A-Za-z0-9]{1,6}$/;
// Code files only: `setting.json`, `index.json`, `.bg.json` are the app's
// runtime data, named on purpose and never in the repo.
const BASENAME_PATTERN = /^[\w@-][\w@.-]*\.(?:ts|tsx|mts|mjs|cjs|js|scss|css)$/;
const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]*/g;
const CHAIN_PATTERN = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
// camelCase with a hump (`genTimeoutAttempt`), PascalCase with two humps
// (`ScreenAppComp`), or SCREAMING_SNAKE (`MAX_TOOL_ROUNDS`). A plain word in
// backticks (`open`, `Status`) is not read as a code claim.
const SYMBOL_SEGMENT_PATTERN =
    /^(?:[a-z_$][a-z0-9_$]*[A-Z][\w$]*|[A-Z][a-z0-9]+[A-Z][\w$]*|[A-Z][A-Z0-9]*_[A-Z0-9_]+)$/;
const MIN_SYMBOL_LENGTH = 6;
const FILE_NAME_TOKEN_PATTERN =
    /\.(?:[cm]?[jt]sx?|md|json|s?css|html|ya?ml|toml|sh|txt)$/;
// Platform names the notes use on purpose that no typing in node_modules
// declares here: Chrome DevTools Protocol methods, Win32 / macOS window APIs,
// React fiber internals, Prettier options, Claude Code's own tools. Grow it
// only with a name a run proved external.
const EXTERNAL_NAME_SET = new Set([
    'BeginMainThreadFrame',
    'bringToFront',
    'callFunctionOn',
    'captureScreenshot',
    'dispatchMouseEvent',
    'getProperties',
    'getResponseBody',
    'getWindowForTarget',
    'ignoreCache',
    'runIfWaitingForDebugger',
    'setWindowBounds',
    'BM_CLICK',
    'CopyFromScreen',
    'EnumWindows',
    'IsIconic',
    'LogonUI',
    'PrintWindow',
    'WM_CLOSE',
    'WM_SETTEXT',
    'kCGWindowIsOnscreen',
    'memoizedProps',
    'endOfLine',
    'ListAgents',
    'WebFetch',
    'WebSearch',
    // Proven external on 2026-10-08: a WMI `Win32_Process` property, a
    // registry value, Chromium's UI Automation root, a VPN adapter's name,
    // and an accessor of the `bible-note` dependency's typings.
    'CreationDate',
    'EnableTransparency',
    'RootView',
    'ProTUN',
    'defaultLang',
    // Also 2026-10-08: npm's config key, open-lyric's own exports, Vite's
    // `_metadata.json` field, a Node `_http_server` internal, the Shape
    // Detection API (no TS lib declares it), a chrome-devtools-mcp parameter.
    'allowScripts',
    'parsePlainText',
    'registerPlugin',
    'browserHash',
    'setupConnectionsTracking',
    'BarcodeDetector',
    'dblClick',
]);
const TOOL_NAME_PATTERN = /\bowa_[a-z][a-z_]*[a-z]\b(?![*_])/g;
const ENV_NAME_PATTERN = /\bOWA_[A-Z0-9_]*[A-Z0-9]\b/g;
const NPM_RUN_PATTERN = /\bnpm\s+run\s+([\w:.-]+)/g;
const ID_PATTERN =
    /\b(EN|EC|MC|AC|AD|UT|W|PM|RD|PL|CM|CB|KB|ST|ED|SP|PR|GL|NAV|PU|XW|SC|AP|EX|MD|LT|PC)-(\d+[a-z]?)\b/g;
const MEMORY_REF_PATTERN =
    /\bmemor(?:y|ies)\s+((?:`[a-z0-9][a-z0-9-]*`(?:\s*(?:,|and|\+|·|or|\/)\s*)?)+)/g;
const WIKI_LINK_PATTERN = /\[\[([a-z0-9][a-z0-9-]*)\]\]/g;
const MARKDOWN_LINK_PATTERN = /\]\(([^)\s]+)\)/g;
const IMPERATIVE_PATTERN =
    /\b(?:must|MUST|never|Never|NEVER|always|Always|ALWAYS)\b|SAME change|same change/;
// A prose rule that names its enforcer -- a test, a script, the gate -- is
// already machinery; the rest are held by a reader remembering them.
const ENFORCER_PATTERN =
    /\.test\.|scripts\/|\.mjs\b|\blint\b|\bgate\b|\bhook\b|\bthrows?\b|\bTHROWS\b|\brefuses?\b/;
const MEMORY_TYPE_SET = new Set(['user', 'feedback', 'project', 'reference']);
const ID_OWNER_MAP = {
    EN: '.claude/skills/owa-enhance/references/backlog.md',
    EC: '.claude/skills/owa-enhance-chatbot/references/backlog.md',
    MC: '.claude/skills/owa-enhance-mcp/references/backlog.md',
    AC: '.claude/skills/owa-enhance-aichat/references/backlog.md',
    AD: '.claude/skills/owa-enhance-agent-docs/references/backlog.md',
    UT: '.claude/skills/owa-upgrade-unit-test/references/plan.md',
    W: '.claude/skills/owa-robot-test/references/user-workflows.md',
};
const MATRIX_PATH = 'docs/test-paths/coverage-matrix.md';
// History, not claims about now -- see the header.
const LEDGER_NAME_SET = new Set([
    'backlog.md',
    'scoreboard.md',
    'plan.md',
    'baseline.md',
    'user-workflows.md',
]);
// Research artifacts their own README declares frozen at a past sweep.
const FROZEN_DOC_PATTERN =
    /^owa-robot-test\/coverage-expansion\/(?!README\.md$)/;
// Files nearly every commit touches: a note naming one is not "behind" it.
const HOT_FILE_PATTERN =
    /^src\/lang\/data\/|^package(?:-lock)?\.json$|^docs\/test-manifest\.json$/;
const STALENESS_WINDOW_DAYS = 180;
const CHURN_WINDOW_DAYS = 60;
// What Claude Code puts in front of every session: the instructions file and
// the head of the memory index.
const MEMORY_INDEX_LOADED_LINES = 200;
// The skill listing a session chooses skills from cuts each description off
// with "…" -- measured 2026-10-08 at ~1 535 characters on five skills. A
// trigger phrase past it is never read when the skill is picked.
const LISTING_CUT_CHARS = 1530;

// ---- reading the repo -------------------------------------------------------

function runGit(gitArgs) {
    try {
        return execFileSync('git', gitArgs, {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            maxBuffer: 256 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return '';
    }
}

function toRepoPath(fullPath) {
    return path.relative(REPO_ROOT, fullPath).split(path.sep).join('/');
}

function readText(relPath, maxBytes = MAX_READ_BYTES) {
    try {
        const fullPath = path.join(REPO_ROOT, relPath);
        if (statSync(fullPath).size > maxBytes) {
            return null;
        }
        return readFileSync(fullPath, 'utf-8');
    } catch {
        return null;
    }
}

function checkExists(relPath) {
    try {
        statSync(path.join(REPO_ROOT, relPath));
        return true;
    } catch {
        return false;
    }
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

function checkIsSameFile(onePath, otherPath) {
    try {
        return readFileSync(onePath).equals(readFileSync(otherPath));
    } catch {
        return false;
    }
}

// Tracked plus untracked-but-not-ignored: a note may name a file another
// session has written and not yet committed.
const repoFileList = runGit(['ls-files', '-co', '--exclude-standard'])
    .split('\n')
    .filter(Boolean);
const repoFileSet = new Set(repoFileList);
const basenameMap = new Map();
for (const relPath of repoFileList) {
    const name = relPath.slice(relPath.lastIndexOf('/') + 1);
    basenameMap.set(name, [...(basenameMap.get(name) ?? []), relPath]);
}
const codeFileList = repoFileList.filter((relPath) => {
    return (
        CODE_EXTENSION_PATTERN.test(relPath) &&
        !NOT_CODE_ROOT_PATTERN.test(relPath) &&
        relPath !== 'package-lock.json'
    );
});
// Names the notes may use without this repo defining them: the skills' own
// scripts, and the platform APIs the code calls (DOM, Electron). Read for
// their names only; a missing one is skipped.
const EXTRA_NAME_SOURCE_LIST = [
    ...repoFileList.filter((relPath) => {
        return /^\.claude\/skills\/[^/]+\/scripts\/.+\.m?js$/.test(relPath);
    }),
    'node_modules/electron/electron.d.ts',
    // TypeScript 7 keeps the JS-world typings under `@typescript/old`; the
    // older layout is kept for a checkout without it.
    ...['typescript', '@typescript/old'].flatMap((packageName) => {
        return ['dom', 'es5', 'esnext.disposable'].map((libName) => {
            return `node_modules/${packageName}/lib/lib.${libName}.d.ts`;
        });
    }),
];
const EXTRA_NAME_SOURCE_SET = new Set(EXTRA_NAME_SOURCE_LIST);

let identifierSetCache = null;
function getIdentifierSet() {
    if (identifierSetCache !== null) {
        return identifierSetCache;
    }
    identifierSetCache = new Set();
    for (const relPath of [...codeFileList, ...EXTRA_NAME_SOURCE_LIST]) {
        // `lib.dom.d.ts` is 2.3 MB: under the cap it was skipped without a
        // word, and every DOM API a note names came back as drift.
        const text = readText(
            relPath,
            EXTRA_NAME_SOURCE_SET.has(relPath) ? Infinity : MAX_READ_BYTES,
        );
        if (text === null) {
            continue;
        }
        for (const match of text.matchAll(IDENTIFIER_PATTERN)) {
            identifierSetCache.add(match[0]);
        }
    }
    return identifierSetCache;
}

/**
 * Every agent document, classified. `kind` decides what is checked: ledgers
 * are history, `historical` memory notes record something fixed (the index
 * line says FIXED) and are reported after the live claims.
 */
function listAgentDocs() {
    const claudeDirPath = path.join(REPO_ROOT, '.claude');
    const memoryIndexText = readText('.claude/memory/MEMORY.md') ?? '';
    const fixedNoteSet = new Set();
    for (const line of memoryIndexText.split(LINE_BREAK_PATTERN)) {
        if (!/FIXED/.test(line)) {
            continue;
        }
        for (const match of line.matchAll(/\]\(([\w.-]+\.md)\)/g)) {
            // A line can list several notes; only the FIXED one's link sits
            // inside the same `[...](...)` as the word.
            const linkStart = line.lastIndexOf('[', match.index);
            if (/FIXED/.test(line.slice(linkStart, match.index))) {
                fixedNoteSet.add(match[1]);
            }
        }
    }
    const docList = [{ relPath: '.claude/CLAUDE.md', kind: 'instructions' }];
    for (const name of listFilesUnder(path.join(claudeDirPath, 'rules'))) {
        if (name.endsWith('.md')) {
            docList.push({ relPath: `.claude/rules/${name}`, kind: 'rule' });
        }
    }
    for (const name of listFilesUnder(path.join(claudeDirPath, 'memory'))) {
        if (!name.endsWith('.md')) {
            continue;
        }
        docList.push({
            relPath: `.claude/memory/${name}`,
            kind:
                name === 'MEMORY.md'
                    ? 'memory-index'
                    : fixedNoteSet.has(name)
                      ? 'historical'
                      : 'memory',
        });
    }
    for (const name of listFilesUnder(path.join(claudeDirPath, 'skills'))) {
        if (!name.endsWith('.md')) {
            continue;
        }
        const baseName = name.slice(name.lastIndexOf('/') + 1);
        docList.push({
            relPath: `.claude/skills/${name}`,
            kind:
                LEDGER_NAME_SET.has(baseName) || FROZEN_DOC_PATTERN.test(name)
                    ? 'ledger'
                    : 'skill',
        });
    }
    return docList;
}

// --doc narrows whose claims are read; the leverage signals (coverage,
// staleness) still weigh every document.
function checkIsInDocArg(doc) {
    return !docArg || doc.relPath.startsWith(docArg);
}

function readDocLines(relPath) {
    return (readText(relPath) ?? '').split(LINE_BREAK_PATTERN);
}

function checkIsAudited(doc) {
    return isWithLedgers || doc.kind !== 'ledger';
}

function skillDirOf(relPath) {
    const match = relPath.match(/^(\.claude\/skills\/[^/]+)\//);
    return match ? match[1] : null;
}

// ---- claims -------------------------------------------------------------------

/**
 * One pass over every audited document: each inline code span and link,
 * with the line it sits on. A link inside a fence or a code span is a
 * template's example and is skipped. The `npm run`, `owa_*`, `OWA_*` and id
 * checks scan every line themselves, fences included.
 */
function collectClaims(docList) {
    const claimList = [];
    for (const doc of docList) {
        if (!checkIsAudited(doc)) {
            continue;
        }
        const lineList = readDocLines(doc.relPath);
        let isInFrontMatter = lineList[0] === '---';
        let isInFence = false;
        lineList.forEach((line, index) => {
            if (index > 0 && isInFrontMatter && line === '---') {
                isInFrontMatter = false;
                return;
            }
            if (isInFrontMatter) {
                return;
            }
            if (/^\s*```/.test(line)) {
                isInFence = !isInFence;
                return;
            }
            for (const match of line.matchAll(/`([^`\n]+)`/g)) {
                claimList.push({
                    doc,
                    line: index + 1,
                    kind: 'span',
                    token: match[1].trim(),
                    lineText: line,
                });
            }
            // A link inside a fence or a code span is a template's example
            // (`[file.ts:120](src/path/file.ts#L120)`), not a link.
            if (isInFence) {
                return;
            }
            const proseText = line.replace(/`[^`\n]*`/g, '');
            for (const match of proseText.matchAll(MARKDOWN_LINK_PATTERN)) {
                claimList.push({
                    doc,
                    line: index + 1,
                    kind: 'link',
                    token: match[1],
                    lineText: line,
                });
            }
        });
    }
    return claimList;
}

/**
 * `src/a.ts:120`, `src/a.ts#L12-L20` -> `{ relPath, lineNumber }`, or null
 * when the token is not a repo path at all.
 */
function parsePathToken(token, doc) {
    const anchorMatch = token.match(/(?::(\d+)(?:-\d+)?|#L(\d+)(?:-L?\d+)?)$/);
    const lineNumber = anchorMatch
        ? Number(anchorMatch[1] ?? anchorMatch[2])
        : null;
    let relPath = anchorMatch ? token.slice(0, anchorMatch.index) : token;
    relPath = relPath.replace(/^\.\//, '');
    if (PLACEHOLDER_PATTERN.test(relPath) || /^https?:/.test(relPath)) {
        return null;
    }
    const skillDir = skillDirOf(doc.relPath);
    if (skillDir && /^(?:scripts|references)\//.test(relPath)) {
        // Its own skill's file, or a sibling skill's it is talking about
        // ("`owa-enhance-mcp`, whose `references/threat-model.md`").
        const ownPath = `${skillDir}/${relPath}`;
        const siblingPath = checkExists(ownPath)
            ? null
            : listNames(path.join(REPO_ROOT, '.claude', 'skills'), {
                  isDirectory: true,
              })
                  .map((name) => `.claude/skills/${name}/${relPath}`)
                  .find(checkExists);
        return { relPath: siblingPath ?? ownPath, lineNumber };
    }
    if (
        PATH_ROOT_PATTERN.test(relPath) &&
        (FILE_EXTENSION_PATTERN.test(relPath) || relPath.endsWith('/'))
    ) {
        return { relPath: relPath.replace(/\/$/, ''), lineNumber };
    }
    return null;
}

function resolveLinkTarget(token, doc) {
    if (/^(?:[a-z]+:|#)/.test(token) || PLACEHOLDER_PATTERN.test(token)) {
        return null;
    }
    const target = token.replace(/#.*$/, '');
    if (target === '') {
        return null;
    }
    const docDir = path.posix.dirname(doc.relPath);
    const relPath = path.posix.normalize(path.posix.join(docDir, target));
    // Claude Code output links from the repo root; some notes do too.
    return checkExists(relPath) || !checkExists(target) ? relPath : target;
}

let lineCountCache = new Map();
function countLines(relPath) {
    if (!lineCountCache.has(relPath)) {
        const text = readText(relPath);
        lineCountCache.set(
            relPath,
            text === null ? null : text.split(LINE_BREAK_PATTERN).length,
        );
    }
    return lineCountCache.get(relPath);
}

// ---- checks -------------------------------------------------------------------

function hit(claim, text, name = null) {
    return {
        at: `${claim.doc.relPath}:${claim.line}`,
        doc: claim.doc.relPath,
        name,
        kind: claim.doc.kind,
        text,
    };
}

// ---- killed leads ------------------------------------------------------------

const KILLED_LEADS_PATH = path.join(
    HERE,
    '..',
    'references',
    'killed-leads.json',
);
let killedLeadListCache = null;
function readKilledLeadList() {
    if (killedLeadListCache === null) {
        try {
            killedLeadListCache = JSON.parse(
                readFileSync(KILLED_LEADS_PATH, 'utf-8'),
            );
        } catch {
            killedLeadListCache = [];
        }
    }
    return killedLeadListCache;
}

/**
 * Sets aside the leads a run already confirmed and filed in
 * `references/killed-leads.json`, and returns the entries that no longer
 * match anything in their doc -- a renamed note, a fixed line -- as hits of
 * their own, so a stale entry is deleted rather than kept forever.
 */
function setKilledLeadsAside(checkName, signalList, targetDocList) {
    const entryList = readKilledLeadList().filter((entry) => {
        return entry.check === checkName;
    });
    const keyOf = (doc, name) => `${doc}\0${name}`;
    const killedKeySet = new Set(
        entryList.map((entry) => {
            return keyOf(entry.doc, entry.name);
        }),
    );
    let setAsideCount = 0;
    for (const signal of signalList) {
        signal.items = signal.items.filter((item) => {
            const isKilled =
                item.name !== null &&
                killedKeySet.has(keyOf(item.doc, item.name));
            setAsideCount += isKilled ? 1 : 0;
            return !isKilled;
        });
    }
    const targetDocSet = new Set(targetDocList.map((doc) => doc.relPath));
    const staleList = entryList
        .filter((entry) => {
            if (!targetDocSet.has(entry.doc)) {
                return false;
            }
            return !(readText(entry.doc) ?? '').includes(entry.name);
        })
        .map((entry) => {
            return {
                at: entry.doc,
                doc: entry.doc,
                name: entry.name,
                kind: 'live',
                text:
                    `${entry.name} -- the doc no longer names it; ` +
                    'delete the entry',
            };
        });
    return [
        ...signalList,
        {
            label: 'killed-leads.json entries whose doc no longer names them',
            text: `${setAsideCount} confirmed leads set aside`,
            items: staleList,
        },
    ];
}

// Live claims first; history after, so a FIXED note's old path never buries a
// rule file's broken one.
function sortHits(hitList) {
    const rank = (kind) => (kind === 'historical' || kind === 'ledger' ? 1 : 0);
    return hitList.sort((one, other) => rank(one.kind) - rank(other.kind));
}

function runPathsCheck(claimList) {
    const gone = [];
    const badAnchor = [];
    const unknownBasename = [];
    for (const claim of claimList) {
        const parsed =
            claim.kind === 'link'
                ? (() => {
                      const relPath = resolveLinkTarget(claim.token, claim.doc);
                      return relPath ? { relPath, lineNumber: null } : null;
                  })()
                : parsePathToken(claim.token, claim.doc);
        if (parsed !== null) {
            if (!checkExists(parsed.relPath)) {
                gone.push(
                    hit(
                        claim,
                        `${parsed.relPath} -- not on disk`,
                        parsed.relPath,
                    ),
                );
            } else if (parsed.lineNumber !== null) {
                const lineCount = countLines(parsed.relPath);
                if (lineCount !== null && parsed.lineNumber > lineCount) {
                    badAnchor.push(
                        hit(
                            claim,
                            `${parsed.relPath}:${parsed.lineNumber} -- ` +
                                `the file has ${lineCount} lines`,
                        ),
                    );
                }
            }
            continue;
        }
        // A bare file name (`boot.ts`, `screen.tsx`) is a claim that SOME file
        // is called that.
        const bareName = claim.token.replace(/:\d+(?:-\d+)?$/, '');
        if (
            claim.kind === 'span' &&
            BASENAME_PATTERN.test(bareName) &&
            !basenameMap.has(bareName) &&
            !checkExists(bareName)
        ) {
            unknownBasename.push(
                hit(claim, `${bareName} -- no file of that name`, bareName),
            );
        }
    }
    return [
        {
            label: 'repo paths and links that are gone',
            items: sortHits(gone),
        },
        {
            label: 'file:line anchors past the end of the file',
            items: sortHits(badAnchor),
        },
        {
            label: 'file names no file carries',
            items: sortHits(unknownBasename),
        },
    ];
}

function runSymbolsCheck(claimList) {
    const identifierSet = getIdentifierSet();
    const missing = [];
    const seenSet = new Set();
    for (const claim of claimList) {
        if (claim.kind !== 'span') {
            continue;
        }
        const token = claim.token
            .replace(/^new\s+/, '')
            .replace(/^<\/?/, '')
            .replace(/\s*\/?>$/, '')
            .replace(/\(.*\)$/, '')
            .replace(/\[\]$/, '');
        // A file name (`managerHelpers.extra.test.tsx`, `PRIVACY_POLICY.md`)
        // is the paths check's to judge, not a chain of code names.
        if (!CHAIN_PATTERN.test(token) || FILE_NAME_TOKEN_PATTERN.test(token)) {
            continue;
        }
        for (const segment of token.split('.')) {
            if (
                segment.length < MIN_SYMBOL_LENGTH ||
                !SYMBOL_SEGMENT_PATTERN.test(segment) ||
                identifierSet.has(segment) ||
                EXTERNAL_NAME_SET.has(segment)
            ) {
                continue;
            }
            const key = `${claim.doc.relPath}\0${segment}`;
            if (seenSet.has(key)) {
                continue;
            }
            seenSet.add(key);
            missing.push(
                hit(claim, `${segment} -- not in any code file`, segment),
            );
        }
    }
    return [
        {
            label: 'code names the code does not hold',
            text: 'renamed, removed -- or a DOM/library API; confirm each',
            items: sortHits(missing),
        },
    ];
}

function readRegisteredTools() {
    const toolSet = new Set();
    for (const relPath of repoFileList) {
        if (
            !/^tools\/owa-devtools-mcp\/[^/]+\.mjs$/.test(relPath) ||
            relPath.endsWith('.test.mjs')
        ) {
            continue;
        }
        const text = readText(relPath) ?? '';
        const pattern =
            /(?:registerTool\(\s*|\bname:\s*)['"](owa_[a-z_]+)['"]/g;
        for (const match of text.matchAll(pattern)) {
            toolSet.add(match[1]);
        }
    }
    return toolSet;
}

// `owa_guide_start` / `_step` / `_status` is how CLAUDE.md lists a family.
function checkMentionsTool(text, toolName) {
    if (text.includes(toolName)) {
        return true;
    }
    const cut = toolName.lastIndexOf('_');
    return (
        text.includes(toolName.slice(0, cut + 1)) &&
        text.includes('`' + toolName.slice(cut) + '`')
    );
}

function runToolsCheck(docList) {
    const registeredSet = readRegisteredTools();
    const identifierSet = getIdentifierSet();
    const unknown = [];
    const seenSet = new Set();
    for (const doc of docList) {
        if (!checkIsAudited(doc)) {
            continue;
        }
        readDocLines(doc.relPath).forEach((line, index) => {
            for (const match of line.matchAll(TOOL_NAME_PATTERN)) {
                const name = match[0];
                const key = `${doc.relPath}\0${name}`;
                if (
                    registeredSet.has(name) ||
                    identifierSet.has(name) ||
                    seenSet.has(key)
                ) {
                    continue;
                }
                seenSet.add(key);
                unknown.push(
                    hit(
                        { doc, line: index + 1 },
                        `${name} -- no tool registers it`,
                    ),
                );
            }
        });
    }
    // The three places a reader looks for "which tools are there".
    const listingDocList = [
        '.claude/CLAUDE.md',
        '.claude/rules/agent-tools.md',
        'tools/owa-devtools-mcp/README.md',
    ].filter((relPath) => checkIsInDocArg({ relPath }));
    const unlisted = [];
    for (const relPath of listingDocList) {
        const text = readText(relPath);
        if (text === null) {
            continue;
        }
        const missingList = [...registeredSet]
            .sort()
            .filter((name) => !checkMentionsTool(text, name));
        if (missingList.length > 0) {
            unlisted.push({ at: relPath, text: missingList.join(', ') });
        }
    }
    return [
        {
            label: 'owa_* names no tool registers',
            items: sortHits(unknown),
        },
        {
            label: `registered owa_* tools (${registeredSet.size}) a listing omits`,
            items: unlisted,
        },
    ];
}

function readPackageScripts() {
    try {
        return JSON.parse(readText('package.json') ?? '{}').scripts ?? {};
    } catch {
        return {};
    }
}

function runScriptsCheck(docList, claimList) {
    const scriptMap = readPackageScripts();
    const unknown = [];
    for (const doc of docList) {
        if (!checkIsAudited(doc)) {
            continue;
        }
        readDocLines(doc.relPath).forEach((line, index) => {
            for (const match of line.matchAll(NPM_RUN_PATTERN)) {
                const name = match[1].replace(/[.:]+$/, '');
                const nextChar = line[match.index + match[0].length] ?? '';
                // `npm run pack:<os>` names a family, not a script.
                if (!(name in scriptMap) && !/[<{*|]/.test(nextChar)) {
                    unknown.push(
                        hit(
                            { doc, line: index + 1 },
                            `npm run ${name} -- no such script`,
                        ),
                    );
                }
            }
        });
    }
    // `node <script>.mjs --flag` in a code span or fence: the flag must be
    // something that script reads.
    const badFlag = [];
    for (const claim of claimList) {
        if (claim.kind !== 'span') {
            continue;
        }
        const match = claim.token.match(/^node\s+(\S+\.m?js)\s+(.*)$/);
        if (!match) {
            continue;
        }
        const parsed = parsePathToken(match[1], claim.doc);
        const scriptText = parsed ? readText(parsed.relPath) : null;
        if (scriptText === null) {
            continue;
        }
        for (const flagMatch of match[2].matchAll(/(?:^|\s)(--[a-z][\w-]*)/g)) {
            if (!scriptText.includes(flagMatch[1])) {
                badFlag.push(
                    hit(
                        claim,
                        `${flagMatch[1]} -- ${parsed.relPath} never reads it`,
                    ),
                );
            }
        }
    }
    return [
        {
            label: '`npm run` scripts that do not exist',
            items: sortHits(unknown),
        },
        {
            label: 'script flags the script does not read',
            items: sortHits(badFlag),
        },
    ];
}

function runEnvCheck(docList) {
    const identifierSet = getIdentifierSet();
    const unknown = [];
    const seenSet = new Set();
    for (const doc of docList) {
        if (!checkIsAudited(doc)) {
            continue;
        }
        readDocLines(doc.relPath).forEach((line, index) => {
            for (const match of line.matchAll(ENV_NAME_PATTERN)) {
                const key = `${doc.relPath}\0${match[0]}`;
                if (identifierSet.has(match[0]) || seenSet.has(key)) {
                    continue;
                }
                seenSet.add(key);
                unknown.push(
                    hit(
                        { doc, line: index + 1 },
                        `${match[0]} -- no code reads it`,
                    ),
                );
            }
        });
    }
    return [
        { label: 'OWA_* variables no code reads', items: sortHits(unknown) },
    ];
}

function runIdsCheck(docList) {
    const ownerTextMap = new Map();
    const readOwnerText = (relPath) => {
        if (!ownerTextMap.has(relPath)) {
            ownerTextMap.set(relPath, readText(relPath));
        }
        return ownerTextMap.get(relPath);
    };
    const unknown = [];
    const seenSet = new Set();
    for (const doc of docList) {
        if (!checkIsAudited(doc)) {
            continue;
        }
        // An id in a fence is an entry template's (`## EN-01 · <the claim>`).
        let isInFence = false;
        readDocLines(doc.relPath).forEach((line, index) => {
            if (/^\s*```/.test(line)) {
                isInFence = !isInFence;
            }
            if (isInFence) {
                return;
            }
            for (const match of line.matchAll(ID_PATTERN)) {
                const [id, prefix] = match;
                const ownerPath = ID_OWNER_MAP[prefix] ?? MATRIX_PATH;
                const key = `${doc.relPath}\0${id}`;
                if (seenSet.has(key) || ownerPath === doc.relPath) {
                    continue;
                }
                seenSet.add(key);
                const ownerText = readOwnerText(ownerPath);
                if (ownerText === null) {
                    continue;
                }
                const isKnown =
                    prefix === 'W'
                        ? new RegExp(`^#{2,4}\\s+${id}\\b`, 'm').test(ownerText)
                        : new RegExp(`\\b${id}\\b`).test(ownerText);
                if (!isKnown) {
                    unknown.push(
                        hit(
                            { doc, line: index + 1 },
                            `${id} -- not in ${ownerPath}`,
                        ),
                    );
                }
            }
        });
    }
    return [
        {
            label: 'ids their own ledger does not hold',
            items: sortHits(unknown),
        },
    ];
}

function parseFrontMatter(text) {
    const lineList = (text ?? '').split(LINE_BREAK_PATTERN);
    if (lineList[0] !== '---') {
        return null;
    }
    const endIndex = lineList.indexOf('---', 1);
    if (endIndex < 0) {
        return null;
    }
    const fieldMap = {};
    let listKey = null;
    for (const line of lineList.slice(1, endIndex)) {
        const listItem = line.match(/^\s+-\s+(.*)$/);
        if (listItem && listKey) {
            fieldMap[listKey].push(listItem[1].replace(/^['"]|['"]$/g, ''));
            continue;
        }
        const field = line.match(/^(\s*)([\w-]+):\s*(.*)$/);
        if (!field) {
            continue;
        }
        // YAML single-quoted scalars write a quote as two.
        const value = field[3]
            .trim()
            .replace(/^'([\s\S]*)'$/, (_, inner) => inner.replace(/''/g, "'"))
            .replace(/^"([\s\S]*)"$/, '$1');
        const key = field[1] ? `metadata.${field[2]}` : field[2];
        if (value === '') {
            fieldMap[key] = [];
            listKey = key;
        } else {
            fieldMap[key] = value;
            listKey = null;
        }
    }
    return { fieldMap, bodyStartLine: endIndex + 1 };
}

function runMemoryCheck(docList) {
    const memoryDirPath = path.join(REPO_ROOT, '.claude', 'memory');
    const indexText = readText('.claude/memory/MEMORY.md') ?? '';
    const indexLineList = indexText.split(LINE_BREAK_PATTERN);
    const linkedSet = new Set();
    const brokenIndex = [];
    indexLineList.forEach((line, index) => {
        for (const match of line.matchAll(/\]\(([\w.-]+\.md)\)/g)) {
            linkedSet.add(match[1]);
            if (!checkExists(`.claude/memory/${match[1]}`)) {
                brokenIndex.push({
                    at: `.claude/memory/MEMORY.md:${index + 1}`,
                    text: `${match[1]} -- no such note`,
                });
            }
        }
    });
    const noteNameList = listNames(memoryDirPath).filter((name) => {
        return name.endsWith('.md') && name !== 'MEMORY.md';
    });
    const unindexed = noteNameList
        .filter((name) => !linkedSet.has(name))
        .map((name) => ({
            at: `.claude/memory/${name}`,
            text: 'not in MEMORY.md -- no session will know to open it',
        }));
    const slugSet = new Set();
    const badFrontMatter = [];
    for (const name of noteNameList) {
        const parsed = parseFrontMatter(readText(`.claude/memory/${name}`));
        const slug = name.replace(/\.md$/, '');
        slugSet.add(slug);
        const problemList = [];
        if (parsed === null) {
            problemList.push('no front matter');
        } else {
            const { fieldMap } = parsed;
            if (fieldMap.name && fieldMap.name !== slug) {
                problemList.push(
                    `name "${fieldMap.name}" is not the file name`,
                );
                slugSet.add(fieldMap.name);
            }
            if (!fieldMap.name) {
                problemList.push('no name');
            }
            if (!fieldMap.description) {
                problemList.push('no description');
            }
            const type = fieldMap['metadata.type'] ?? fieldMap.type;
            if (!MEMORY_TYPE_SET.has(type)) {
                problemList.push(`type "${type ?? ''}" is not one of the four`);
            }
        }
        if (problemList.length > 0) {
            badFrontMatter.push({
                at: `.claude/memory/${name}`,
                text: problemList.join('; '),
            });
        }
    }
    const brokenRef = [];
    for (const doc of docList) {
        readDocLines(doc.relPath).forEach((line, index) => {
            const slugList = [
                ...[...line.matchAll(WIKI_LINK_PATTERN)].map((m) => m[1]),
                ...[...line.matchAll(MEMORY_REF_PATTERN)].flatMap((m) => {
                    return [...m[1].matchAll(/`([^`]+)`/g)].map((one) => {
                        return one[1];
                    });
                }),
            ];
            for (const slug of slugList) {
                if (!slugSet.has(slug)) {
                    brokenRef.push(
                        hit(
                            { doc, line: index + 1 },
                            `memory \`${slug}\` -- no such note`,
                        ),
                    );
                }
            }
        });
    }
    return [
        { label: 'MEMORY.md links to notes that are gone', items: brokenIndex },
        { label: 'memory notes the index never names', items: unindexed },
        { label: 'memory front matter off the schema', items: badFrontMatter },
        {
            label: 'memory references that resolve to nothing',
            items: brokenRef,
        },
    ];
}

function globToRegExp(glob) {
    let pattern = '';
    for (let index = 0; index < glob.length; index++) {
        const char = glob[index];
        if (char === '*' && glob[index + 1] === '*') {
            pattern += glob[index + 2] === '/' ? '(?:.*/)?' : '.*';
            index += glob[index + 2] === '/' ? 2 : 1;
        } else if (char === '*') {
            pattern += '[^/]*';
        } else if (char === '?') {
            pattern += '[^/]';
        } else if (char === '{') {
            const end = glob.indexOf('}', index);
            pattern +=
                '(?:' +
                glob
                    .slice(index + 1, end)
                    .split(',')
                    .map((part) => part.replace(/[.+^$()|[\]\\]/g, '\\$&'))
                    .join('|') +
                ')';
            index = end;
        } else {
            pattern += char.replace(/[.+^$()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${pattern}$`);
}

function readRuleGlobs() {
    const ruleList = [];
    for (const name of listNames(path.join(REPO_ROOT, '.claude', 'rules'))) {
        if (!name.endsWith('.md')) {
            continue;
        }
        const parsed = parseFrontMatter(readText(`.claude/rules/${name}`));
        const globList = Array.isArray(parsed?.fieldMap.paths)
            ? parsed.fieldMap.paths
            : [];
        ruleList.push({ name, globList });
    }
    return ruleList;
}

function runRulesCheck() {
    const claudeText = readText('.claude/CLAUDE.md') ?? '';
    const deadGlob = [];
    const noPaths = [];
    const unnamed = [];
    for (const rule of readRuleGlobs()) {
        if (rule.globList.length === 0) {
            noPaths.push({
                at: `.claude/rules/${rule.name}`,
                text: 'no `paths:` -- it never loads by itself',
            });
        }
        for (const glob of rule.globList) {
            const pattern = globToRegExp(glob);
            // A glob over an ignored folder (`test-results/**`) matches files
            // the listing never shows; its fixed prefix on disk is enough.
            const fixedPrefix = glob.split(/[*?{]/)[0].replace(/\/$/, '');
            if (
                !repoFileList.some((relPath) => pattern.test(relPath)) &&
                !(
                    fixedPrefix !== glob &&
                    fixedPrefix &&
                    checkExists(fixedPrefix)
                )
            ) {
                deadGlob.push({
                    at: `.claude/rules/${rule.name}`,
                    text: `${glob} -- matches no file`,
                });
            }
        }
        if (!claudeText.includes(rule.name)) {
            unnamed.push({
                at: `.claude/rules/${rule.name}`,
                text: 'CLAUDE.md never names it',
            });
        }
    }
    return [
        { label: 'rule `paths:` globs that match nothing', items: deadGlob },
        { label: 'rules with no `paths:`', items: noPaths },
        { label: 'rules CLAUDE.md does not name', items: unnamed },
    ];
}

/**
 * A mirrored SKILL.md is the Claude one with a Codex preamble: its own short
 * description, `## Codex usage`, `Arguments: <argument-hint>` and the full
 * description under `### Full workflow scope (preserved from Claude)`. After
 * that paragraph the body is an exact copy.
 */
function compareMirroredSkill(skillName) {
    const claudeText = readText(`.claude/skills/${skillName}/SKILL.md`);
    const mirrorText = readText(`.agents/skills/${skillName}/SKILL.md`);
    if (claudeText === null || mirrorText === null) {
        return [];
    }
    const problemList = [];
    const claudeFront = parseFrontMatter(claudeText);
    const claudeLineList = claudeText.split(LINE_BREAK_PATTERN);
    const claudeBody = claudeLineList
        .slice(claudeFront?.bodyStartLine ?? 0)
        .join('\n')
        .trim();
    const mirrorLineList = mirrorText.split(LINE_BREAK_PATTERN);
    const scopeIndex = mirrorLineList.findIndex((line) => {
        return line.startsWith('### Full workflow scope');
    });
    if (scopeIndex < 0) {
        return ['no "### Full workflow scope" section'];
    }
    let bodyIndex = scopeIndex + 1;
    while (mirrorLineList[bodyIndex]?.trim() === '') {
        bodyIndex++;
    }
    const mirrorDescription = mirrorLineList[bodyIndex] ?? '';
    const mirrorBody = mirrorLineList
        .slice(bodyIndex + 1)
        .join('\n')
        .trim();
    if (mirrorBody !== claudeBody) {
        problemList.push('body differs from the Claude SKILL.md');
    }
    const description = claudeFront?.fieldMap.description ?? '';
    if (mirrorDescription.trim() !== description.trim()) {
        problemList.push('preserved description differs');
    }
    const hint = claudeFront?.fieldMap['argument-hint'];
    if (hint && !mirrorText.includes(`Arguments: ${hint}`)) {
        problemList.push('Arguments line differs from argument-hint');
    }
    return problemList;
}

function runSkillsCheck() {
    const claudeText = readText('.claude/CLAUDE.md') ?? '';
    const indexText = readText('.claude/rules/project-skills.md') ?? '';
    const problemList = [];
    const descriptionList = [];
    for (const name of listNames(path.join(REPO_ROOT, '.claude', 'skills'), {
        isDirectory: true,
    })) {
        const at = `.claude/skills/${name}`;
        const text = readText(`${at}/SKILL.md`);
        if (text === null) {
            problemList.push({ at, text: 'no SKILL.md' });
            continue;
        }
        const fieldMap = parseFrontMatter(text)?.fieldMap ?? {};
        if (fieldMap.name !== name) {
            problemList.push({
                at,
                text: `front-matter name "${fieldMap.name}" is not the folder`,
            });
        }
        const length = (fieldMap.description ?? '').length;
        descriptionList.push({
            at,
            text:
                `${length} characters` +
                (length > LISTING_CUT_CHARS
                    ? ` -- ${length - LISTING_CUT_CHARS} past the listing cut, ` +
                      'never seen when a skill is chosen'
                    : ''),
            length,
        });
        if (!claudeText.includes(`\`${name}\``)) {
            problemList.push({
                at,
                text: 'CLAUDE.md "Project skills" omits it',
            });
        }
        if (!indexText.includes(`## ${name} skill`)) {
            problemList.push({
                at,
                text: 'rules/project-skills.md has no section for it',
            });
        }
        if (!checkExists(`.agents/skills/${name}/SKILL.md`)) {
            problemList.push({ at, text: 'no Codex mirror' });
        } else {
            for (const problem of compareMirroredSkill(name)) {
                problemList.push({
                    at: `.agents/skills/${name}/SKILL.md`,
                    text: problem,
                });
            }
        }
    }
    return [
        { label: 'skill wiring and mirror problems', items: problemList },
        {
            label: 'skill description lengths (paid in every session listing)',
            items: descriptionList.sort(
                (one, other) => other.length - one.length,
            ),
        },
    ];
}

function readLastCommitMs(relPath) {
    const stamp = runGit(['log', '-1', '--format=%ct', '--', relPath]).trim();
    return stamp ? Number(stamp) * 1000 : 0;
}

/**
 * `.claude/` is the source of truth and the Codex mirror its copy (`AGENTS.md`):
 * `CLAUDE.md` -> `.codex/project-instructions.md`, `rules/` ->
 * `.codex/instructions/`, `memory/` -> `.codex/memory/`, `skills/` ->
 * `.agents/skills/`. A mirror that is NEWER than its source means an edit
 * landed on the wrong side, and is reported as such.
 */
function runMirrorCheck() {
    const drift = [];
    const describe = (claudeRel, mirrorRel) => {
        const claudeMs = Math.max(
            readLastCommitMs(claudeRel),
            statSync(path.join(REPO_ROOT, claudeRel)).mtimeMs,
        );
        const mirrorMs = Math.max(
            readLastCommitMs(mirrorRel),
            statSync(path.join(REPO_ROOT, mirrorRel)).mtimeMs,
        );
        return mirrorMs > claudeMs
            ? 'differs -- the MIRROR is newer (edited on the wrong side?)'
            : 'differs -- re-copy from .claude';
    };
    if (
        !checkIsSameFile(
            path.join(REPO_ROOT, '.claude', 'CLAUDE.md'),
            path.join(REPO_ROOT, '.codex', 'project-instructions.md'),
        )
    ) {
        drift.push({
            at: '.codex/project-instructions.md',
            text: describe(
                '.claude/CLAUDE.md',
                '.codex/project-instructions.md',
            ),
        });
    }
    const compareDirs = (claudeRelDir, mirrorRelDir, isSkill) => {
        const claudeSet = new Set(
            listFilesUnder(path.join(REPO_ROOT, claudeRelDir)),
        );
        const mirrorSet = new Set(
            listFilesUnder(path.join(REPO_ROOT, mirrorRelDir)),
        );
        for (const relPath of [
            ...new Set([...claudeSet, ...mirrorSet]),
        ].sort()) {
            const claudeRel = `${claudeRelDir}/${relPath}`;
            const mirrorRel = `${mirrorRelDir}/${relPath}`;
            if (!mirrorSet.has(relPath)) {
                drift.push({ at: claudeRel, text: 'missing from the mirror' });
            } else if (!claudeSet.has(relPath)) {
                drift.push({ at: mirrorRel, text: 'only in the mirror' });
            } else if (
                !(isSkill && relPath === 'SKILL.md') &&
                !checkIsSameFile(
                    path.join(REPO_ROOT, claudeRel),
                    path.join(REPO_ROOT, mirrorRel),
                )
            ) {
                drift.push({
                    at: mirrorRel,
                    text: describe(claudeRel, mirrorRel),
                });
            }
        }
    };
    compareDirs('.claude/rules', '.codex/instructions', false);
    compareDirs('.claude/memory', '.codex/memory', false);
    const skillNameSet = new Set([
        ...listNames(path.join(REPO_ROOT, '.claude', 'skills'), {
            isDirectory: true,
        }),
        ...listNames(path.join(REPO_ROOT, '.agents', 'skills'), {
            isDirectory: true,
        }),
    ]);
    for (const name of [...skillNameSet].sort()) {
        compareDirs(`.claude/skills/${name}`, `.agents/skills/${name}`, true);
    }
    // The MCP server both agents are told to use.
    const configProblem = [];
    let mcpNameList = [];
    try {
        mcpNameList = Object.keys(
            JSON.parse(readText('.mcp.json') ?? '{}').mcpServers ?? {},
        );
    } catch {
        configProblem.push({ at: '.mcp.json', text: 'does not parse' });
    }
    const codexConfigText = readText('.codex/config.toml') ?? '';
    for (const name of mcpNameList) {
        if (!codexConfigText.includes(`[mcp_servers.${name}]`)) {
            configProblem.push({
                at: '.codex/config.toml',
                text: `${name} -- in .mcp.json, not registered for Codex`,
            });
        }
    }
    return [
        { label: 'mirror drift (.claude -> .codex / .agents)', items: drift },
        { label: 'MCP registration parity', items: configProblem },
    ];
}

function runKnowledgeCheck(docList) {
    const indexRel = 'electron-build/knowledge/index.json';
    let builtAtMs;
    try {
        builtAtMs = statSync(path.join(REPO_ROOT, indexRel)).mtimeMs;
    } catch {
        return [
            {
                label: 'knowledge index',
                text: 'not built -- `npm run dev` builds it',
                items: [],
            },
        ];
    }
    const newer = docList
        .filter((doc) => {
            try {
                return (
                    statSync(path.join(REPO_ROOT, doc.relPath)).mtimeMs >
                    builtAtMs
                );
            } catch {
                return false;
            }
        })
        .map((doc) => ({
            at: doc.relPath,
            text: 'edited after the last build',
        }));
    return [
        {
            label: 'knowledge index older than its sources',
            text: `built ${new Date(builtAtMs).toISOString().slice(0, 16)}`,
            items: newer,
        },
    ];
}

function estimateTokens(byteCount) {
    // English markdown runs ~4 bytes a token; good enough to rank, not to bill.
    return Math.round(byteCount / 4);
}

function readSections(relPath) {
    const sectionList = [];
    let current = null;
    readDocLines(relPath).forEach((line) => {
        if (/^#{1,3}\s/.test(line)) {
            current = { title: line.replace(/^#+\s*/, ''), bytes: 0 };
            sectionList.push(current);
        }
        if (current) {
            current.bytes += Buffer.byteLength(line) + 1;
        }
    });
    return sectionList;
}

function runBudgetCheck() {
    const sizeOf = (relPath) => {
        try {
            return statSync(path.join(REPO_ROOT, relPath)).size;
        } catch {
            return 0;
        }
    };
    const claudeBytes = sizeOf('.claude/CLAUDE.md');
    const indexLineList = readDocLines('.claude/memory/MEMORY.md');
    const indexBytes = sizeOf('.claude/memory/MEMORY.md');
    const alwaysLoaded = [
        {
            at: '.claude/CLAUDE.md',
            text: `${claudeBytes} B ≈ ${estimateTokens(claudeBytes)} tokens, every session`,
        },
        {
            at: '.claude/memory/MEMORY.md',
            text:
                `${indexBytes} B ≈ ${estimateTokens(indexBytes)} tokens, ` +
                `${indexLineList.length} lines (the first ` +
                `${MEMORY_INDEX_LOADED_LINES} are loaded)`,
        },
    ];
    const longIndexLines = indexLineList
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => line.length > 220)
        .map(({ line, index }) => ({
            at: `.claude/memory/MEMORY.md:${index + 1}`,
            text: `${line.length} characters`,
            length: line.length,
        }))
        .sort((one, other) => other.length - one.length);
    const sections = readSections('.claude/CLAUDE.md')
        .sort((one, other) => other.bytes - one.bytes)
        .map((section) => ({
            at: '.claude/CLAUDE.md',
            text: `${section.bytes} B -- ${section.title}`,
        }));
    const rules = listNames(path.join(REPO_ROOT, '.claude', 'rules'))
        .map((name) => ({
            at: `.claude/rules/${name}`,
            bytes: sizeOf(`.claude/rules/${name}`),
        }))
        .sort((one, other) => other.bytes - one.bytes)
        .map((one) => ({
            at: one.at,
            text: `${one.bytes} B ≈ ${estimateTokens(one.bytes)} tokens when its paths match`,
        }));
    return [
        { label: 'loaded into every session', items: alwaysLoaded },
        {
            label: 'CLAUDE.md sections by size (candidates for a paths-scoped rule)',
            items: sections,
        },
        { label: 'MEMORY.md lines over 220 characters', items: longIndexLines },
        { label: 'rule files by size', items: rules },
    ];
}

/**
 * One `git log` for the window, parsed into commits with their files. Both the
 * churn of a code area and the code movement under a note come from it.
 */
let commitListCache = null;
function readCommitList() {
    if (commitListCache !== null) {
        return commitListCache;
    }
    const output = runGit([
        'log',
        `--since=${STALENESS_WINDOW_DAYS}.days`,
        '--name-only',
        // Rename detection costs 20x the rest of the log on this repo.
        '--no-renames',
        '--format=%x00%ct %s',
    ]);
    commitListCache = output
        .split('\0')
        .filter(Boolean)
        .map((chunk) => {
            const [head, ...fileList] = chunk.split('\n');
            const spaceIndex = head.indexOf(' ');
            return {
                timeMs: Number(head.slice(0, spaceIndex)) * 1000,
                subject: head.slice(spaceIndex + 1),
                fileList: fileList.filter(Boolean),
            };
        });
    return commitListCache;
}

// Where an area starts: `src/_screen`, `electron/client`, `tools/owa-devtools-mcp`.
function toAreaName(relPath) {
    const partList = relPath.split('/');
    if (['src', 'tools'].includes(partList[0]) && partList.length > 2) {
        return partList.slice(0, 2).join('/');
    }
    if (partList[0] === 'electron' && partList.length > 2) {
        return partList.slice(0, 2).join('/');
    }
    if (
        ['src', 'electron', 'extra-work', 'html', 'e2e'].includes(partList[0])
    ) {
        return partList.length > 1 ? `${partList[0]}/*` : null;
    }
    return null;
}

function collectDocReferences(docList, claimList) {
    // doc -> set of repo files it names, by path or by a unique file name.
    const referenceMap = new Map();
    for (const claim of claimList) {
        let relPath = null;
        if (claim.kind === 'span') {
            const parsed = parsePathToken(claim.token, claim.doc);
            if (parsed) {
                relPath = parsed.relPath;
            } else {
                const bareName = claim.token.replace(/:\d+(?:-\d+)?$/, '');
                const matchList = basenameMap.get(bareName);
                if (
                    BASENAME_PATTERN.test(bareName) &&
                    matchList?.length === 1
                ) {
                    relPath = matchList[0];
                }
            }
        }
        if (
            relPath === null ||
            NOT_CODE_ROOT_PATTERN.test(relPath) ||
            HOT_FILE_PATTERN.test(relPath)
        ) {
            continue;
        }
        const key = claim.doc.relPath;
        if (!referenceMap.has(key)) {
            referenceMap.set(key, new Set());
        }
        referenceMap.get(key).add(relPath);
    }
    return referenceMap;
}

function runCoverageCheck(docList, claimList) {
    const referenceMap = collectDocReferences(docList, claimList);
    const areaMap = new Map();
    const ensureArea = (name) => {
        if (!areaMap.has(name)) {
            areaMap.set(name, {
                name,
                fileCount: 0,
                docSet: new Set(),
                ruleSet: new Set(),
                commitCount: 0,
                fixCount: 0,
            });
        }
        return areaMap.get(name);
    };
    for (const relPath of codeFileList) {
        const areaName = toAreaName(relPath);
        if (areaName && !/\.test\.|\.d\.m?ts$/.test(relPath)) {
            ensureArea(areaName).fileCount++;
        }
    }
    for (const [docPath, relPathSet] of referenceMap) {
        for (const relPath of relPathSet) {
            const areaName = toAreaName(relPath);
            if (areaName && areaMap.has(areaName)) {
                areaMap.get(areaName).docSet.add(docPath);
            }
        }
    }
    for (const rule of readRuleGlobs()) {
        const patternList = rule.globList.map(globToRegExp);
        for (const relPath of codeFileList) {
            const areaName = toAreaName(relPath);
            if (
                areaName &&
                areaMap.has(areaName) &&
                patternList.some((pattern) => pattern.test(relPath))
            ) {
                areaMap.get(areaName).ruleSet.add(rule.name);
            }
        }
    }
    const sinceMs = Date.now() - CHURN_WINDOW_DAYS * 24 * 3600 * 1000;
    for (const commit of readCommitList()) {
        if (commit.timeMs < sinceMs) {
            continue;
        }
        const touchedSet = new Set(
            commit.fileList.map(toAreaName).filter((name) => areaMap.has(name)),
        );
        for (const name of touchedSet) {
            const area = areaMap.get(name);
            area.commitCount++;
            if (/\bfix/i.test(commit.subject)) {
                area.fixCount++;
            }
        }
    }
    // Blind = busy and barely written about. Ranking, not a verdict.
    const ranked = [...areaMap.values()]
        .filter((area) => area.fileCount >= 3)
        .map((area) => ({
            ...area,
            score:
                (area.commitCount + area.fixCount * 2 + area.fileCount / 5) /
                (1 + area.docSet.size + area.ruleSet.size * 3),
        }))
        .sort((one, other) => other.score - one.score);
    return [
        {
            label: `code areas by blindness (churn ${CHURN_WINDOW_DAYS} d ÷ notes)`,
            items: ranked.map((area) => ({
                at: area.name,
                text:
                    `${area.fileCount} files · ${area.commitCount} commits ` +
                    `(${area.fixCount} fix) · named in ${area.docSet.size} docs · ` +
                    `rules: ${[...area.ruleSet].join(', ') || 'none'}`,
            })),
        },
    ];
}

function runStalenessCheck(docList, claimList) {
    const referenceMap = collectDocReferences(docList, claimList);
    const dirtySet = new Set(
        runGit(['status', '--porcelain'])
            .split('\n')
            .filter(Boolean)
            .map((line) => line.slice(3).replace(/^"|"$/g, '')),
    );
    const commitList = readCommitList();
    const rowList = [];
    for (const doc of docList) {
        if (!checkIsAudited(doc) || doc.kind === 'historical') {
            continue;
        }
        const relPathSet = referenceMap.get(doc.relPath);
        if (!relPathSet || relPathSet.size === 0) {
            continue;
        }
        const docMs = dirtySet.has(doc.relPath)
            ? Date.now()
            : readLastCommitMsFromList(commitList, doc.relPath);
        if (docMs === 0) {
            continue;
        }
        const movedSet = new Set();
        let commitCount = 0;
        for (const commit of commitList) {
            if (commit.timeMs <= docMs) {
                continue;
            }
            const touchedList = commit.fileList.filter((relPath) => {
                return relPathSet.has(relPath);
            });
            if (touchedList.length > 0) {
                commitCount++;
                touchedList.forEach((relPath) => movedSet.add(relPath));
            }
        }
        if (commitCount > 0) {
            rowList.push({
                at: doc.relPath,
                text:
                    `${commitCount} commits since its last edit touched ` +
                    `${movedSet.size} of the ${relPathSet.size} files it names: ` +
                    [...movedSet].slice(0, 3).join(', ') +
                    (movedSet.size > 3 ? ', …' : ''),
                commitCount,
            });
        }
    }
    return [
        {
            label: `notes whose code moved since they were last edited (${STALENESS_WINDOW_DAYS} d)`,
            items: rowList.sort(
                (one, other) => other.commitCount - one.commitCount,
            ),
        },
    ];
}

function readLastCommitMsFromList(commitList, relPath) {
    // `git log` is newest first.
    const commit = commitList.find((one) => one.fileList.includes(relPath));
    return commit ? commit.timeMs : readLastCommitMs(relPath);
}

function runProseRulesCheck(docList) {
    const ruleDocList = docList.filter((doc) => {
        return doc.kind === 'instructions' || doc.kind === 'rule';
    });
    const itemList = [];
    for (const doc of ruleDocList) {
        const lineList = readDocLines(doc.relPath);
        let paragraph = [];
        let startLine = 0;
        const flush = () => {
            const text = paragraph.join(' ');
            if (IMPERATIVE_PATTERN.test(text) && !ENFORCER_PATTERN.test(text)) {
                const sentence =
                    text
                        .split(/(?<=[.!?])\s+/)
                        .find((one) => IMPERATIVE_PATTERN.test(one)) ?? text;
                itemList.push({
                    at: `${doc.relPath}:${startLine}`,
                    text: sentence.trim().slice(0, 140),
                });
            }
            paragraph = [];
        };
        lineList.forEach((line, index) => {
            const isBreak =
                line.trim() === '' || /^\s*(?:[-*]|\d+\.)\s/.test(line);
            if (isBreak || /^#/.test(line)) {
                flush();
            }
            if (line.trim() !== '' && !/^#/.test(line)) {
                if (paragraph.length === 0) {
                    startLine = index + 1;
                }
                paragraph.push(line.trim());
            }
        });
        flush();
    }
    return [
        {
            label: 'rules held only by prose (no test, script or gate named)',
            text: 'candidates for a test, a hook or a script -- leverage lens L3',
            items: itemList,
        },
    ];
}

// ---- running --------------------------------------------------------------------

const docList = listAgentDocs();
const claimList = collectClaims(docList);
const targetDocList = docList.filter(checkIsInDocArg);
const targetClaimList = claimList.filter((claim) => {
    return checkIsInDocArg(claim.doc);
});
const RUNNER_MAP = {
    paths: () => {
        return setKilledLeadsAside(
            'paths',
            runPathsCheck(targetClaimList),
            targetDocList,
        );
    },
    symbols: () => {
        return setKilledLeadsAside(
            'symbols',
            runSymbolsCheck(targetClaimList),
            targetDocList,
        );
    },
    tools: () => runToolsCheck(targetDocList),
    scripts: () => runScriptsCheck(targetDocList, targetClaimList),
    env: () => runEnvCheck(targetDocList),
    ids: () => runIdsCheck(targetDocList),
    memory: () => runMemoryCheck(targetDocList),
    rules: () => runRulesCheck(),
    skills: () => runSkillsCheck(),
    mirror: () => runMirrorCheck(),
    knowledge: () => runKnowledgeCheck(docList),
    budget: () => runBudgetCheck(),
    coverage: () => runCoverageCheck(docList, claimList),
    staleness: () => runStalenessCheck(docList, claimList),
    'prose-rules': () => runProseRulesCheck(docList),
};

const resultMap = {};
for (const name of CHECK_LIST) {
    if (checkSet.has(name)) {
        resultMap[name] = RUNNER_MAP[name]();
    }
}

if (isJson) {
    console.log(JSON.stringify(resultMap, null, 2));
} else {
    const head = runGit(['log', '-1', '--pretty=%h %s']).trim();
    const auditedCount = targetDocList.filter(checkIsAudited).length;
    console.log(
        `Agent-docs audit @ ${head}\n` +
            `  ${auditedCount} documents audited` +
            (isWithLedgers ? ' (ledgers included)' : ' (ledgers skipped)') +
            (docArg ? `, under ${docArg}` : '') +
            `; ${targetClaimList.length} code spans and links read\n` +
            '  Every line is a LEAD -- confirm it in the code before editing.',
    );
    for (const [name, signalList] of Object.entries(resultMap)) {
        console.log(`\n== ${name}`);
        for (const signal of signalList) {
            const count = signal.items.length;
            console.log(
                `  ${signal.label}: ${count}` +
                    (signal.text ? `  (${signal.text})` : ''),
            );
            for (const item of signal.items.slice(0, LIST_LIMIT)) {
                const tag = ['historical', 'ledger'].includes(item.kind)
                    ? ` [${item.kind}]`
                    : '';
                console.log(`    - ${item.at}${tag}  ${item.text}`);
            }
            if (count > LIST_LIMIT) {
                console.log(
                    `    … ${count - LIST_LIMIT} more (--check=${name} lists them all)`,
                );
            }
        }
    }
}
