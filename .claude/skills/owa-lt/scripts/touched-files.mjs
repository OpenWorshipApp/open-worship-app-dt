// The files THIS Claude Code session changed: what the scoped lint gate
// (`/owa-lt`) checks and what the git interval (`/owa-gi`) commits.
//
// A PostToolUse hook in `.claude/settings.json` runs `node <this> hook` after
// every Edit / Write / NotebookEdit and appends the file to
// `node_modules/.cache/owa-touched/<session id>.txt`. The list is per session
// because several sessions share one worktree: a session lints and commits
// its own files, never the half-done ones of another. It sits in the ignored
// `node_modules/.cache` rather than the OS temp dir so the hook and a
// sandboxed shell agree on the path, and nothing in it is ever committed.
// Lists older than two days are pruned whenever one is read.
//
//   node touched-files.mjs hook                  (stdin: the hook's JSON)
//   node touched-files.mjs add <file>...         (a file changed through Bash)
//   node touched-files.mjs list [--session=<id>]
//
// The session id comes from `--session=<id>`, else `CLAUDE_CODE_SESSION_ID`
// (set in every shell Claude Code starts), else the newest list on disk.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '../../../..');
export const CACHE_DIR = path.join(REPO_ROOT, 'node_modules', '.cache');
export const TOUCHED_DIR = path.join(CACHE_DIR, 'owa-touched');
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

export function checkIsSessionId(sessionId) {
    return (
        typeof sessionId === 'string' &&
        /^[A-Za-z0-9_-]{1,100}$/.test(sessionId)
    );
}

export function readArgValue(argv, name) {
    const prefix = `--${name}=`;
    const arg = argv.find((item) => item.startsWith(prefix));
    return arg === undefined ? null : arg.slice(prefix.length);
}

export function getListPath(sessionId) {
    return path.join(TOUCHED_DIR, `${sessionId}.txt`);
}

// A path the session named, as a repo-relative POSIX path; null when it lies
// outside this checkout (a scratchpad file, a memory note, another worktree).
export function toRepoRelative(filePath, repoRoot = REPO_ROOT) {
    const relative = path.relative(repoRoot, path.resolve(repoRoot, filePath));
    if (relative === '' || relative.startsWith('..')) {
        return null;
    }
    if (path.isAbsolute(relative)) {
        return null;
    }
    return relative.split(path.sep).join('/');
}

export function parseTouchedText(text, repoRoot = REPO_ROOT) {
    const seen = new Set();
    for (const line of text.split('\n')) {
        const relative = toRepoRelative(line.trim() || '..', repoRoot);
        if (relative !== null) {
            seen.add(relative);
        }
    }
    return [...seen];
}

export function pruneOldFiles(dirPath, maxAgeMs = MAX_AGE_MS) {
    let entries = [];
    try {
        entries = fs.readdirSync(dirPath);
    } catch {
        return;
    }
    const now = Date.now();
    for (const name of entries) {
        const filePath = path.join(dirPath, name);
        try {
            if (now - fs.statSync(filePath).mtimeMs > maxAgeMs) {
                fs.rmSync(filePath, { force: true });
            }
        } catch {
            // Gone already, or another session holds it: nothing to prune.
        }
    }
}

function findNewestSessionId() {
    let newest = null;
    let names = [];
    try {
        names = fs.readdirSync(TOUCHED_DIR);
    } catch {
        return null;
    }
    for (const name of names) {
        const sessionId = name.replace(/\.txt$/, '');
        if (!name.endsWith('.txt') || !checkIsSessionId(sessionId)) {
            continue;
        }
        const mtimeMs = fs.statSync(path.join(TOUCHED_DIR, name)).mtimeMs;
        if (newest === null || mtimeMs > newest.mtimeMs) {
            newest = { sessionId, mtimeMs };
        }
    }
    return newest?.sessionId ?? null;
}

// { sessionId, guessed }: guessed is true when neither the argument nor the
// environment named it and the newest list on disk was taken instead.
export function resolveSessionId(argv = process.argv, env = process.env) {
    const fromArg = readArgValue(argv, 'session');
    if (checkIsSessionId(fromArg)) {
        return { sessionId: fromArg, guessed: false };
    }
    if (checkIsSessionId(env.CLAUDE_CODE_SESSION_ID)) {
        return { sessionId: env.CLAUDE_CODE_SESSION_ID, guessed: false };
    }
    return { sessionId: findNewestSessionId(), guessed: true };
}

export function appendTouched(sessionId, filePaths) {
    if (!checkIsSessionId(sessionId) || filePaths.length === 0) {
        return;
    }
    fs.mkdirSync(TOUCHED_DIR, { recursive: true });
    const lines = filePaths.map((filePath) => {
        return path.resolve(process.cwd(), filePath);
    });
    fs.appendFileSync(getListPath(sessionId), `${lines.join('\n')}\n`);
}

export function readTouched(sessionId) {
    pruneOldFiles(TOUCHED_DIR);
    if (!checkIsSessionId(sessionId)) {
        return [];
    }
    try {
        return parseTouchedText(
            fs.readFileSync(getListPath(sessionId), 'utf8'),
        );
    } catch {
        return [];
    }
}

async function readStdin() {
    let text = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
        text += chunk;
    }
    return text;
}

// Never fails the tool call it follows: a hook that throws would show an
// error after every edit, so every problem here is swallowed.
async function runHook() {
    try {
        const input = JSON.parse(await readStdin());
        const toolInput = input?.tool_input ?? {};
        const filePath = toolInput.file_path ?? toolInput.notebook_path;
        if (typeof filePath === 'string' && filePath !== '') {
            appendTouched(input.session_id, [filePath]);
        }
    } catch {
        // Not JSON, no session, a read-only cache dir: skip this one edit.
    }
}

async function main() {
    const [command, ...rest] = process.argv.slice(2);
    if (command === 'hook') {
        await runHook();
        return;
    }
    const { sessionId, guessed } = resolveSessionId();
    if (sessionId === null) {
        console.error('No session id: pass --session=<id>.');
        process.exitCode = 1;
        return;
    }
    if (command === 'add') {
        const files = rest.filter((item) => !item.startsWith('--'));
        appendTouched(sessionId, files);
        console.log(`Added ${files.length} file(s) to session ${sessionId}.`);
        return;
    }
    if (command === 'list') {
        if (guessed) {
            console.error(`No session named; the newest list: ${sessionId}`);
        }
        console.log(readTouched(sessionId).join('\n'));
        return;
    }
    console.error(
        'Usage: touched-files.mjs hook | add <file>... | list [--session=<id>]',
    );
    process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
    await main();
}
