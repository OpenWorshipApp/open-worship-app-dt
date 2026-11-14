// The git interval -- the `/owa-gi <minutes>` skill. Every N minutes one
// tick: commit THIS session's changed files when the scoped lint gate
// (`/owa-lt`) passes on them, pull, push. A tick costs no model turn and
// comes on time.
//
// The loop runs DETACHED from the session: starting it returns at once, so it
// is no task the session waits on, keeps open at its end or is woken by when
// it exits. It stops after one LAST tick when the session will change nothing
// more -- `--finish` (the session says so; it returns at once and the tick
// runs in the loop, so the session is not held while the gate runs) or the
// session's Claude Code process gone (`CLAUDE_PID`, looked at every few
// seconds) -- so it never outlives the session. Asked for on 2026-11-13: _when
// nothing will be changed by the session then stop the interval_, and _make
// sure the interval [is] not preventing the session to stop [or] pause the
// session too long_; three intervals had ticked "nothing of this session
// changed" all night.
//
//   commit  only files on this session's touched list that git sees changed
//           (another session's half-done work in the same worktree is never
//           swept in), all or nothing: a failing gate holds the whole set
//           back to the next tick. `git commit --only -- <files>`, so what
//           another session staged stays out of it. Hooks run; never
//           --no-verify.
//   pull    fetch, then a fast-forward; a diverged branch merges, and a merge
//           that conflicts or would overwrite a dirty file is aborted --
//           nothing is stashed, so no other session's edits are juggled.
//   push    to the upstream, never forced. A rejection waits for the next
//           tick's pull.
//
// It refuses `main`/`master` (unless --allow-main), a detached HEAD and a
// merge or rebase in progress, and takes a lock so two sessions' ticks never
// run git at once. State and log: `node_modules/.cache/owa-git-interval/`.
//
//   node git-interval.mjs --every=<minutes> [--trailer="Name <mail>"]  start
//   node git-interval.mjs --finish            a last tick, then it stops
//   node git-interval.mjs --once [--trailer=...]   one tick, in the foreground
//   node git-interval.mjs --stop | --status
//   (`--loop` is the detached process itself.)

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runScopedGate } from '../../owa-lt/scripts/lint-touched.mjs';
import {
    CACHE_DIR,
    REPO_ROOT,
    pruneOldFiles,
    readArgValue,
    readTouched,
    resolveSessionId,
} from '../../owa-lt/scripts/touched-files.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const STATE_DIR = path.join(CACHE_DIR, 'owa-git-interval');
const TICK_LOCK_PATH = path.join(STATE_DIR, 'tick.lock');
const TICK_LOCK_STALE_MS = 15 * 60 * 1000;
const TICK_LOCK_RETRY_MS = 2000;
// How often the sleeping loop looks for a `--finish` and for the session:
// one file check and one signal-0 a slice, nothing spawned.
const WATCH_MS = 5000;
const PROTECTED_BRANCHES = new Set(['main', 'master']);
const MAX_LISTED_FILES = 10;

function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function git(args, { retries = 5, cwd = REPO_ROOT } = {}) {
    for (let attempt = 0; ; attempt++) {
        const result = spawnSync('git', args, {
            cwd,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        });
        const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
        // Another session's git holds the index: wait it out, briefly.
        if (
            result.status !== 0 &&
            output.includes('index.lock') &&
            attempt < retries
        ) {
            sleepSync(2000);
            continue;
        }
        return {
            ok: result.status === 0,
            // trimEnd, never trim: `git status --porcelain` lines start with
            // a space (' M file'), and a trimmed one lost its first letter.
            stdout: (result.stdout ?? '').trimEnd(),
            output: output.trim(),
        };
    }
}

// `git status --porcelain=v1 -z` -> the paths it reports, renames by their
// new name.
export function parsePorcelainZ(text) {
    const paths = [];
    const parts = text.split('\0');
    for (let i = 0; i < parts.length; i++) {
        const entry = parts[i];
        if (entry.length < 4) {
            continue;
        }
        paths.push(entry.slice(3));
        if (entry[0] === 'R' || entry[0] === 'C') {
            i++;
        }
    }
    return paths;
}

export function parseUntrackedZ(text) {
    return text
        .split('\0')
        .filter((entry) => entry.startsWith('?? '))
        .map((entry) => entry.slice(3));
}

export function buildCommitMessage(files, { now = new Date(), trailer } = {}) {
    const pad = (value) => String(value).padStart(2, '0');
    const stamp =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
        `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const listed = files.slice(0, MAX_LISTED_FILES);
    const more = files.length - listed.length;
    const lines = [
        `Autosave ${stamp}: ${files.length} file(s) of this session (owa-gi)`,
        '',
        ...listed.map((file) => `- ${file}`),
    ];
    if (more > 0) {
        lines.push(`- ... and ${more} more`);
    }
    if (trailer) {
        lines.push('', `Co-Authored-By: ${trailer}`);
    }
    return lines.join('\n');
}

function getStatePath(sessionId) {
    return path.join(STATE_DIR, `${sessionId}.json`);
}

function getLogPath(sessionId) {
    return path.join(STATE_DIR, `${sessionId}.log`);
}

// Left by `--finish`, taken by the loop: the request reaches a sleeping loop
// on every platform, where a signal other than SIGTERM does not on Windows.
function getFinishPath(sessionId) {
    return path.join(STATE_DIR, `${sessionId}.finish`);
}

function readState(sessionId) {
    try {
        return JSON.parse(fs.readFileSync(getStatePath(sessionId), 'utf8'));
    } catch {
        return null;
    }
}

// A process that is still there. EPERM is one that is there and not ours to
// signal; 0 and below would signal a whole process group, so they are no pid.
export function checkIsProcessAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error?.code === 'EPERM';
    }
}

function checkIsAlive(pid) {
    if (!checkIsProcessAlive(pid)) {
        return false;
    }
    if (process.platform === 'win32') {
        return true;
    }
    // A pid can be reused: only one still running this script counts.
    const result = spawnSync('ps', ['-p', String(pid), '-o', 'command='], {
        encoding: 'utf8',
    });
    return (result.stdout ?? '').includes('git-interval.mjs');
}

function createLogger(sessionId) {
    return (message) => {
        const now = new Date();
        const line = `[${now.toLocaleTimeString()}] ${message}`;
        console.log(line);
        try {
            fs.appendFileSync(getLogPath(sessionId), `${line}\n`);
        } catch {
            // The log is a convenience; stdout carries the same line.
        }
    };
}

function tryTickLock() {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    try {
        const ageMs = Date.now() - fs.statSync(TICK_LOCK_PATH).mtimeMs;
        if (ageMs > TICK_LOCK_STALE_MS) {
            fs.rmSync(TICK_LOCK_PATH, { force: true });
        }
    } catch {
        // No lock yet.
    }
    try {
        fs.writeFileSync(TICK_LOCK_PATH, String(process.pid), { flag: 'wx' });
        return true;
    } catch {
        return false;
    }
}

// The last tick waits its turn rather than skip: nothing comes after it. It
// waits inside the detached loop, never in the session.
function takeTickLock(waitMs = 0) {
    const deadline = Date.now() + waitMs;
    for (;;) {
        if (tryTickLock()) {
            return true;
        }
        if (Date.now() >= deadline) {
            return false;
        }
        sleepSync(TICK_LOCK_RETRY_MS);
    }
}

function releaseTickLock() {
    fs.rmSync(TICK_LOCK_PATH, { force: true });
}

function checkGitPathExists(name) {
    const result = git(['rev-parse', '--git-path', name]);
    return result.ok && fs.existsSync(path.resolve(REPO_ROOT, result.stdout));
}

function findBlocker(allowMain) {
    const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
    if (!branch.ok) {
        return { stop: true, reason: 'HEAD is detached' };
    }
    if (PROTECTED_BRANCHES.has(branch.stdout) && !allowMain) {
        return {
            stop: true,
            reason: `on ${branch.stdout}: branch first, or pass --allow-main`,
        };
    }
    for (const name of [
        'MERGE_HEAD',
        'CHERRY_PICK_HEAD',
        'REVERT_HEAD',
        'rebase-merge',
        'rebase-apply',
    ]) {
        if (checkGitPathExists(name)) {
            return { stop: false, reason: `${name} in progress` };
        }
    }
    return null;
}

function findChangedSessionFiles(sessionId) {
    const touched = readTouched(sessionId);
    if (touched.length === 0) {
        return { changed: [], untracked: [] };
    }
    const status = git([
        'status',
        '--porcelain=v1',
        '-z',
        '--untracked-files=all',
        '--',
        ...touched,
    ]);
    if (!status.ok) {
        return { changed: [], untracked: [], error: status.output };
    }
    return {
        changed: parsePorcelainZ(status.stdout),
        untracked: parseUntrackedZ(status.stdout),
    };
}

function commitSessionFiles(sessionId, trailer, log) {
    const { changed, untracked, error } = findChangedSessionFiles(sessionId);
    if (error) {
        log(`commit: git status failed: ${error}`);
        return;
    }
    if (changed.length === 0) {
        log('commit: nothing of this session changed');
        return;
    }
    const existing = changed.filter((file) => {
        return fs.existsSync(path.join(REPO_ROOT, file));
    });
    const gate = runScopedGate(existing, {});
    if (!gate.ok) {
        log(
            `commit: HELD BACK ${changed.length} file(s), the scoped gate ` +
                `failed:\n${gate.lines.join('\n')}`,
        );
        return;
    }
    if (untracked.length > 0) {
        const added = git(['add', '--', ...untracked]);
        if (!added.ok) {
            log(`commit: git add failed: ${added.output}`);
            return;
        }
    }
    const message = buildCommitMessage(changed, { trailer });
    const commit = git(['commit', '--only', '-m', message, '--', ...changed]);
    if (!commit.ok) {
        log(`commit: FAILED: ${commit.output}`);
        return;
    }
    const head = git(['log', '-1', '--format=%h']);
    log(`commit: ${head.stdout} ${changed.length} file(s)`);
}

function readUpstream() {
    const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']).stdout;
    const remote = git(['config', `branch.${branch}.remote`]);
    const merge = git(['config', `branch.${branch}.merge`]);
    if (!remote.ok || !merge.ok) {
        return null;
    }
    return { remote: remote.stdout, merge: merge.stdout };
}

function countAheadBehind() {
    const counts = git(['rev-list', '--left-right', '--count', 'HEAD...@{u}']);
    if (!counts.ok) {
        return null;
    }
    const [ahead, behind] = counts.stdout.split(/\s+/).map(Number);
    return { ahead, behind };
}

function pullAndPush(log) {
    const upstream = readUpstream();
    if (upstream === null) {
        log('pull/push: no upstream; set one once with `git push -u`');
        return;
    }
    const fetched = git(['fetch', '--quiet', upstream.remote]);
    if (!fetched.ok) {
        log(`pull: fetch failed: ${fetched.output}`);
        return;
    }
    let counts = countAheadBehind();
    if (counts === null) {
        log('pull: could not compare with the upstream');
        return;
    }
    if (counts.behind > 0) {
        const args =
            counts.ahead === 0
                ? ['merge', '--ff-only', '--quiet', '@{u}']
                : ['merge', '--no-edit', '--quiet', '@{u}'];
        const merged = git(args);
        if (!merged.ok) {
            if (checkGitPathExists('MERGE_HEAD')) {
                git(['merge', '--abort']);
            }
            log(
                `pull: ${counts.behind} incoming commit(s) NOT merged, ` +
                    `push skipped: ${merged.output}`,
            );
            return;
        }
        log(`pull: merged ${counts.behind} commit(s)`);
        counts = countAheadBehind() ?? counts;
    }
    if (counts.ahead === 0) {
        log('push: nothing to push');
        return;
    }
    const pushed = git([
        'push',
        '--quiet',
        upstream.remote,
        `HEAD:${upstream.merge}`,
    ]);
    log(
        pushed.ok
            ? `push: ${counts.ahead} commit(s) to ${upstream.remote}`
            : `push: REJECTED (next tick pulls first): ${pushed.output}`,
    );
}

// false when the interval must stop for good (wrong branch, detached HEAD).
export function runTick(
    { sessionId, trailer, allowMain, log },
    { lockWaitMs = 0 } = {},
) {
    const blocker = findBlocker(allowMain);
    if (blocker !== null) {
        log(`tick skipped: ${blocker.reason}`);
        return !blocker.stop;
    }
    if (!takeTickLock(lockWaitMs)) {
        log('tick skipped: another session is mid-tick');
        return true;
    }
    try {
        commitSessionFiles(sessionId, trailer, log);
        pullAndPush(log);
    } finally {
        releaseTickLock();
    }
    return true;
}

function stopInterval(sessionId) {
    fs.rmSync(getFinishPath(sessionId), { force: true });
    const state = readState(sessionId);
    if (state === null || !checkIsAlive(state.pid)) {
        fs.rmSync(getStatePath(sessionId), { force: true });
        console.log('owa-gi: no interval running for this session.');
        return;
    }
    process.kill(state.pid, 'SIGTERM');
    fs.rmSync(getStatePath(sessionId), { force: true });
    console.log(
        `owa-gi: stopped (pid ${state.pid}, every ${state.every} min).`,
    );
}

// The session will change nothing more. Returns at once: the loop sees the
// request within a slice and runs the last tick itself, so the session is
// not held while the gate, the pull and the push run.
function requestFinish(sessionId) {
    const state = readState(sessionId);
    if (state === null || !checkIsAlive(state.pid)) {
        fs.rmSync(getStatePath(sessionId), { force: true });
        console.log(
            'owa-gi: no interval running for this session -- nothing to finish.',
        );
        return;
    }
    fs.writeFileSync(getFinishPath(sessionId), new Date().toISOString());
    const { changed } = findChangedSessionFiles(sessionId);
    const what =
        changed.length === 0
            ? 'nothing of this session is left to commit'
            : `${changed.length} file(s) of this session are committed ` +
              'if the scoped gate passes';
    console.log(
        `owa-gi: finishing -- within ${WATCH_MS / 1000} s the interval ` +
            `(pid ${state.pid}) runs a last tick in the background (${what}; ` +
            'then pull and push) and stops. `--status` shows how it went.',
    );
}

function printStatus(sessionId) {
    const state = readState(sessionId);
    if (state === null || !checkIsAlive(state.pid)) {
        console.log('owa-gi: not running for this session.');
    } else {
        const finishing = fs.existsSync(getFinishPath(sessionId))
            ? ' Finishing: a last tick, then it stops.'
            : '';
        console.log(
            `owa-gi: running every ${state.every} min since ` +
                `${state.startedAt} (pid ${state.pid}), detached, following ` +
                `session process ${state.sessionPid}.${finishing}`,
        );
    }
    try {
        const lines = fs
            .readFileSync(getLogPath(sessionId), 'utf8')
            .split('\n');
        console.log(lines.slice(-30).join('\n'));
    } catch {
        // No tick logged yet.
    }
}

// Sleeps to the next tick in short slices, so a `--finish` or the session
// ending is seen within seconds rather than at the next tick. Resolves to
// what ended the wait early -- 'finish' or 'session-ended' -- or null when
// the period ran out.
export async function waitForNextTick({
    periodMs,
    watchMs = WATCH_MS,
    checkFinishRequested,
    checkSessionAlive,
}) {
    const until = Date.now() + periodMs;
    for (let left = periodMs; left > 0; left = until - Date.now()) {
        await new Promise((resolve) => {
            setTimeout(resolve, Math.min(watchMs, left));
        });
        if (checkFinishRequested()) {
            return 'finish';
        }
        if (!checkSessionAlive()) {
            return 'session-ended';
        }
    }
    return null;
}

// The detached process: tick, sleep, tick -- until a blocker, a `--finish`,
// the session's end or `--stop`.
async function runLoop(options, minutes, sessionPid) {
    const { sessionId, log } = options;
    const state = readState(sessionId);
    if (
        state !== null &&
        state.pid !== process.pid &&
        checkIsAlive(state.pid)
    ) {
        log(`owa-gi: already running (pid ${state.pid}); this one quits`);
        return;
    }
    const startedAt = new Date().toISOString();
    // Rewritten every tick, so the two-day prune never takes a live one.
    const writeState = () => {
        fs.mkdirSync(STATE_DIR, { recursive: true });
        fs.writeFileSync(
            getStatePath(sessionId),
            JSON.stringify({
                pid: process.pid,
                every: minutes,
                sessionPid,
                startedAt,
                lastTickAt: new Date().toISOString(),
            }),
        );
    };
    writeState();
    const cleanUp = () => {
        const current = readState(sessionId);
        if (current?.pid === process.pid) {
            fs.rmSync(getStatePath(sessionId), { force: true });
            fs.rmSync(getFinishPath(sessionId), { force: true });
        }
        process.exit(0);
    };
    process.on('SIGTERM', cleanUp);
    process.on('SIGINT', cleanUp);
    log(
        `owa-gi: every ${minutes} min, detached, following session process ` +
            `${sessionPid}; first tick now`,
    );
    for (;;) {
        if (!runTick(options)) {
            log('owa-gi: stopped');
            cleanUp();
            return;
        }
        writeState();
        const ended = await waitForNextTick({
            periodMs: minutes * 60_000,
            checkFinishRequested: () => {
                return fs.existsSync(getFinishPath(sessionId));
            },
            checkSessionAlive: () => checkIsProcessAlive(sessionPid),
        });
        if (ended !== null) {
            log(
                ended === 'finish'
                    ? 'owa-gi: the session will change nothing more ' +
                          '(--finish); last tick now'
                    : `owa-gi: the session ended (process ${sessionPid} ` +
                          'gone); last tick now',
            );
            runTick(options, { lockWaitMs: TICK_LOCK_STALE_MS });
            log('owa-gi: stopped');
            cleanUp();
            return;
        }
    }
}

// Starts the loop as a detached process and returns at once: nothing of the
// session waits on it, and its end wakes nobody.
function startInterval(argv, sessionId, minutes) {
    const state = readState(sessionId);
    if (state !== null && checkIsAlive(state.pid)) {
        console.log(
            `owa-gi: already running every ${state.every} min ` +
                `(pid ${state.pid}); --stop it first.`,
        );
        return;
    }
    const sessionPid = Number(
        readArgValue(argv, 'session-pid') ?? process.env.CLAUDE_PID,
    );
    if (!checkIsProcessAlive(sessionPid)) {
        console.error(
            'owa-gi: no Claude Code process to follow (CLAUDE_PID, or ' +
                '--session-pid=<pid>) -- a detached interval would outlive ' +
                'the session, so it does not start.',
        );
        process.exitCode = 1;
        return;
    }
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.rmSync(getFinishPath(sessionId), { force: true });
    const args = [
        SCRIPT_PATH,
        '--loop',
        `--every=${minutes}`,
        `--session=${sessionId}`,
        `--session-pid=${sessionPid}`,
    ];
    const trailer = readArgValue(argv, 'trailer');
    if (trailer) {
        args.push(`--trailer=${trailer}`);
    }
    if (argv.includes('--allow-main')) {
        args.push('--allow-main');
    }
    const child = spawn(process.execPath, args, {
        cwd: REPO_ROOT,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    });
    child.unref();
    // Written here as well as by the loop, so a second start right after
    // this one already sees it running.
    fs.writeFileSync(
        getStatePath(sessionId),
        JSON.stringify({
            pid: child.pid,
            every: minutes,
            sessionPid,
            startedAt: new Date().toISOString(),
        }),
    );
    const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
    const { changed } = findChangedSessionFiles(sessionId);
    console.log(
        `owa-gi: started on ${branch.ok ? branch.stdout : 'a detached HEAD'}, ` +
            `every ${minutes} min, detached (pid ${child.pid}). The first ` +
            `tick runs now in the background with ${changed.length} ` +
            'changed file(s) of this session. It stops after a last tick at ' +
            '`--finish` or when this session ends (process ' +
            `${sessionPid}); \`--status\` shows each tick.`,
    );
}

async function main() {
    const argv = process.argv.slice(2);
    const { sessionId, guessed } = resolveSessionId(process.argv);
    if (sessionId === null || guessed) {
        console.error(
            'owa-gi: no session id -- run it from a Claude Code session, or ' +
                'pass --session=<id>.',
        );
        process.exitCode = 1;
        return;
    }
    pruneOldFiles(STATE_DIR);
    if (argv.includes('--stop')) {
        stopInterval(sessionId);
        return;
    }
    if (argv.includes('--finish')) {
        requestFinish(sessionId);
        return;
    }
    if (argv.includes('--status')) {
        printStatus(sessionId);
        return;
    }
    const options = {
        sessionId,
        trailer: readArgValue(argv, 'trailer'),
        allowMain: argv.includes('--allow-main'),
        log: createLogger(sessionId),
    };
    if (argv.includes('--once')) {
        runTick(options);
        return;
    }
    const minutes = Number(readArgValue(argv, 'every'));
    if (!Number.isFinite(minutes) || minutes < 1) {
        console.error('owa-gi: --every=<minutes>, 1 or more.');
        process.exitCode = 1;
        return;
    }
    if (argv.includes('--loop')) {
        const sessionPid = Number(readArgValue(argv, 'session-pid'));
        await runLoop(options, minutes, sessionPid);
        return;
    }
    startInterval(argv, sessionId, minutes);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
    await main();
}
