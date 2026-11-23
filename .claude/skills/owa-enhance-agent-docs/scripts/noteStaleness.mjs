// When a note falls due by commits rather than by the hash of the code it was
// read against: a note never read, or one edited since its read to name other
// files. Pure, so `src/test-setup/agentDocsStaleness.test.ts` can plant a
// ledger entry without touching the real one.
//
// A note with a ledger entry is counted from its STAMP (`AD-42`, 2026-11-19).
// It was counted from its last edit, and an edit is no read: memory
// `background-animation-runtime` kept a "never" that a commit broke through
// two later edits of the note, each of which cleared it, because neither
// edit was about that line. A note never read keeps its last edit -- what
// else is there -- and one stamped AFTER that edit keeps the stamp (the read
// was later still).

/**
 * The time from which commits touching a note's files make it due.
 * @param {{ docMs: number, reviewMs?: number }} times `docMs` the note's last
 *   edit (now, while it is uncommitted); `reviewMs` the commit its ledger
 *   entry was stamped at, 0 or absent when it has none or that commit is gone.
 * @returns {number} 0 when there is nothing to count from.
 */
export function pickNoteSinceMs({ docMs, reviewMs = 0 }) {
    if (reviewMs > 0) {
        return reviewMs;
    }
    return docMs;
}

/**
 * The commits after `sinceMs` that touched a file the note names, and which.
 * @param {{ timeMs: number, fileList: string[] }[]} commitList newest first,
 *   as `git log` gives them.
 * @param {number} sinceMs
 * @param {Set<string>} relPathSet the files the note names.
 */
export function countCommitsTouching(commitList, sinceMs, relPathSet) {
    const movedSet = new Set();
    let commitCount = 0;
    if (sinceMs === 0) {
        return { commitCount, movedSet };
    }
    for (const commit of commitList) {
        if (commit.timeMs <= sinceMs) {
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
    return { commitCount, movedSet };
}

// ---- `package.json`, one name at a time (`AD-45`, 2026-11-20) --------------
//
// `package.json` is a hot file: a dependency bump would make every note that
// names it due, so the staleness check drops it whole. That hid the two notes
// whose subject IS a line of it (memory `npm-12-install-gotchas`,
// `pptx-converter-file-dependency`): `7ee8297c2` made `pptx-to-html-conv` a
// `file:` folder and neither was listed. So a note follows the NAMES it uses
// -- a dependency or a script of `package.json` -- as files of their own,
// `package.json#<name>`, whose content is that name's line.

export const PACKAGE_KEY_MARK = 'package.json#';

/** The file a note-followed path lives in: itself, or `package.json`. */
export function toRealNotePath(relPath) {
    return relPath.startsWith(PACKAGE_KEY_MARK) ? 'package.json' : relPath;
}

/**
 * The dependency and script names of a `package.json` text.
 * @param {string | null} text
 * @returns {Set<string>}
 */
export function readPackageKeySet(text) {
    const keySet = new Set();
    let json = null;
    try {
        json = JSON.parse(text ?? '');
    } catch {
        return keySet;
    }
    for (const field of [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
        'peerDependencies',
        'scripts',
    ]) {
        for (const key of Object.keys(json?.[field] ?? {})) {
            keySet.add(key);
        }
    }
    return keySet;
}

/**
 * The line(s) of a `package.json` text that hold this name, trimmed: what a
 * note naming it is read against.
 */
export function readPackageKeyLines(text, key) {
    if (text === null) {
        return null;
    }
    const needle = `"${key}":`;
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith(needle))
        .join('\n');
}

/**
 * The `package.json` names a note follows, out of its code spans: a span that
 * IS a name, `npm run <script>`, or a `"<name>": …` line. A bare name counts
 * only in a note that names `package.json` itself -- `vite` or `electron` in
 * passing is no claim about a version.
 * @param {string[]} tokenList the note's code spans.
 * @param {Set<string>} keySet `readPackageKeySet`'s.
 */
export function listPackageKeysNamed(tokenList, keySet) {
    const isPackageNamed = tokenList.some((token) => {
        return /^package\.json(?::\d+)?$/.test(token);
    });
    const namedSet = new Set();
    for (const token of tokenList) {
        const runMatch = token.match(/^npm run ([\w:.-]+)/);
        const lineMatch = token.match(/^"([^"]+)"\s*:/);
        const key = runMatch?.[1] ?? lineMatch?.[1] ?? null;
        if (key !== null && keySet.has(key)) {
            namedSet.add(key);
        } else if (isPackageNamed && keySet.has(token)) {
            namedSet.add(token);
        }
    }
    return namedSet;
}

/**
 * Per commit, the `package.json` names whose line it changed, from
 * `git log -p -U0 --format=%x00%h -- package.json`.
 * @returns {Map<string, Set<string>>} short hash -> names.
 */
export function readPackageKeyLog(logText) {
    const changedMap = new Map();
    for (const chunk of logText.split('\0').filter(Boolean)) {
        const [head, ...lineList] = chunk.split('\n');
        const keySet = new Set();
        for (const line of lineList) {
            const match = line.match(/^[+-](?![+-])\s*"([^"]+)"\s*:/);
            if (match) {
                keySet.add(match[1]);
            }
        }
        changedMap.set(head.trim(), keySet);
    }
    return changedMap;
}
