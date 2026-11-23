import { describe, expect, test } from 'vitest';

import {
    countCommitsTouching,
    listPackageKeysNamed,
    PACKAGE_KEY_MARK,
    pickNoteSinceMs,
    readPackageKeyLines,
    readPackageKeyLog,
    readPackageKeySet,
    toRealNotePath,
} from '../../.claude/skills/owa-enhance-agent-docs/scripts/noteStaleness.mjs';

// The agent-docs audit's `staleness` check, for a note it cannot clear by
// hashing: one never read, or one edited to name other files since its read.
// Until 2026-11-19 (`AD-42`) such a note was counted from its last EDIT, so
// an edit about anything at all cleared it -- memory
// `background-animation-runtime` kept a "never" a commit broke, through two
// later edits of the note. A planted ledger entry, never the real ledger.
const DAY_MS = 24 * 60 * 60 * 1000;
const NOTE_FILE_SET = new Set(['src/background/animationCategoryData.ts']);
const STAMPED_MS = 10 * DAY_MS;
const BREAKING_COMMIT = {
    timeMs: 11 * DAY_MS,
    fileList: ['src/background/animationCategoryData.ts'],
};
const NOTE_EDIT_MS = 12 * DAY_MS;
// `git log` order: newest first.
const COMMIT_LIST = [
    { timeMs: 13 * DAY_MS, fileList: ['src/other.ts'] },
    { timeMs: NOTE_EDIT_MS, fileList: ['.claude/memory/note.md'] },
    BREAKING_COMMIT,
    {
        timeMs: 9 * DAY_MS,
        fileList: ['src/background/animationCategoryData.ts'],
    },
];

describe('a reviewed note edited to name other files', () => {
    test('is counted from its stamp, so an edit after a breaking commit does not clear it', () => {
        const sinceMs = pickNoteSinceMs({
            docMs: NOTE_EDIT_MS,
            reviewMs: STAMPED_MS,
        });
        expect(sinceMs).toBe(STAMPED_MS);
        const { commitCount, movedSet } = countCommitsTouching(
            COMMIT_LIST,
            sinceMs,
            NOTE_FILE_SET,
        );
        expect(commitCount).toBe(1);
        expect([...movedSet]).toEqual([
            'src/background/animationCategoryData.ts',
        ]);
    });

    test('counted from the edit, as before, it would have been missed', () => {
        expect(
            countCommitsTouching(COMMIT_LIST, NOTE_EDIT_MS, NOTE_FILE_SET)
                .commitCount,
        ).toBe(0);
    });

    test('an uncommitted edit (now) does not hide it either', () => {
        const sinceMs = pickNoteSinceMs({
            docMs: Date.now(),
            reviewMs: STAMPED_MS,
        });
        expect(
            countCommitsTouching(COMMIT_LIST, sinceMs, NOTE_FILE_SET)
                .commitCount,
        ).toBe(1);
    });
});

describe('a note with no stamp', () => {
    test('is counted from its last edit', () => {
        expect(pickNoteSinceMs({ docMs: NOTE_EDIT_MS })).toBe(NOTE_EDIT_MS);
        expect(pickNoteSinceMs({ docMs: NOTE_EDIT_MS, reviewMs: 0 })).toBe(
            NOTE_EDIT_MS,
        );
    });

    test('with nothing to count from, is never due', () => {
        expect(
            countCommitsTouching(COMMIT_LIST, 0, NOTE_FILE_SET).commitCount,
        ).toBe(0);
    });
});

// `AD-45` (2026-11-20): `package.json` is dropped whole as a hot file, so the
// two notes whose subject was one line of it were never due when `7ee8297c2`
// made `pptx-to-html-conv` a `file:` folder. A note now follows the names it
// uses from it, each as `package.json#<name>`, whose content is that line.
const PACKAGE_TEXT = [
    '{',
    '    "scripts": {',
    '        "i:d": "npm cache clean --force && npm i",',
    '        "lint": "npm run lint:all:error"',
    '    },',
    '    "dependencies": {',
    '        "open-lyric": "^0.1.80",',
    '        "pptx-to-html-conv": "file:../pptx-to-html-conv-dist"',
    '    },',
    '    "devDependencies": { "vite": "^8.0.0" }',
    '}',
].join('\n');

describe('a note naming `package.json` names', () => {
    const keySet = readPackageKeySet(PACKAGE_TEXT);

    test('reads every dependency and script name', () => {
        expect([...keySet].sort()).toEqual([
            'i:d',
            'lint',
            'open-lyric',
            'pptx-to-html-conv',
            'vite',
        ]);
        expect(readPackageKeySet('not json').size).toBe(0);
    });

    test('follows `npm run x` and a quoted line anywhere, a bare name only beside `package.json`', () => {
        expect([
            ...listPackageKeysNamed(
                [
                    'npm run i:d',
                    '"pptx-to-html-conv": "file:../pptx-to-html-conv-dist"',
                    'vite',
                ],
                keySet,
            ),
        ]).toEqual(['i:d', 'pptx-to-html-conv']);
        expect([
            ...listPackageKeysNamed(['package.json', 'open-lyric'], keySet),
        ]).toEqual(['open-lyric']);
        expect(listPackageKeysNamed(['npm run nope'], keySet).size).toBe(0);
    });

    test("hashes a name's own line, so another name's bump is no change", () => {
        expect(readPackageKeyLines(PACKAGE_TEXT, 'pptx-to-html-conv')).toBe(
            '"pptx-to-html-conv": "file:../pptx-to-html-conv-dist"',
        );
        const bumped = PACKAGE_TEXT.replace('^8.0.0', '^8.1.0');
        expect(readPackageKeyLines(bumped, 'pptx-to-html-conv')).toBe(
            readPackageKeyLines(PACKAGE_TEXT, 'pptx-to-html-conv'),
        );
        expect(readPackageKeyLines(null, 'vite')).toBeNull();
        expect(toRealNotePath(`${PACKAGE_KEY_MARK}vite`)).toBe('package.json');
        expect(toRealNotePath('src/a.ts')).toBe('src/a.ts');
    });

    test('a commit is due for the names whose line it changed, not the rest', () => {
        const logText = [
            '\0abc1234',
            '',
            'diff --git a/package.json b/package.json',
            '--- a/package.json',
            '+++ b/package.json',
            '@@ -227 +227 @@',
            '-        "pptx-to-html-conv": "^1.1.0",',
            '+        "pptx-to-html-conv": "file:../pptx-to-html-conv-dist",',
            '\0def5678',
            '',
            '@@ -12 +12 @@',
            '-        "i:d": "npm i",',
            '+        "i:d": "npm cache clean --force && npm i",',
        ].join('\n');
        const changedMap = readPackageKeyLog(logText);
        expect([...(changedMap.get('abc1234') ?? [])]).toEqual([
            'pptx-to-html-conv',
        ]);
        expect([...(changedMap.get('def5678') ?? [])]).toEqual(['i:d']);
        const followed = `${PACKAGE_KEY_MARK}pptx-to-html-conv`;
        const commitList = [
            {
                timeMs: 2 * DAY_MS,
                fileList: [
                    'package.json',
                    ...[...(changedMap.get('def5678') ?? [])].map(
                        (one) => `${PACKAGE_KEY_MARK}${one}`,
                    ),
                ],
            },
            {
                timeMs: DAY_MS,
                fileList: [
                    'package.json',
                    ...[...(changedMap.get('abc1234') ?? [])].map(
                        (one) => `${PACKAGE_KEY_MARK}${one}`,
                    ),
                ],
            },
        ];
        // The note on the converter line: the converter commit, not the script one.
        expect(
            countCommitsTouching(commitList, 1, new Set([followed]))
                .commitCount,
        ).toBe(1);
        // Before `AD-45` it followed nothing in `package.json`: never due.
        expect(
            countCommitsTouching(commitList, 1, new Set<string>()).commitCount,
        ).toBe(0);
    });
});
