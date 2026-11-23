import { describe, expect, test } from 'vitest';

import { findHomePathsWithAccount } from '../../.claude/skills/owa-enhance-agent-docs/scripts/homePathPrivacy.mjs';

// The agent-docs audit's `privacy` check (`AD-43`, 2026-11-20). Everything
// under `.claude/` ships with the app and its notes are the in-app
// assistant's knowledge; the manual is public. On 2026-11-20 two notes carried
// a home path with an account name, one of them since 2026-08-30, held only by
// memory `no-user-specific-references-in-notes`. The account below is made
// up; `agentDocsAudit.test.ts` holds the real tree to none.
describe('a home path naming an account is found', () => {
    test.each([
        [
            'macOS',
            'at `/Users/somebody/Desktop/dev/open-lyric`',
            '/Users/somebody',
        ],
        ['Linux', 'under /home/somebody/projects', '/home/somebody'],
        [
            'Git Bash',
            'fix in /c/Users/somebody/Desktop/dev/x',
            '/c/Users/somebody',
        ],
        ['Windows', 'in C:\\Users\\somebody\\AppData', 'C:\\Users\\somebody'],
        [
            'escaped Windows',
            '"C:\\\\Users\\\\somebody\\\\x"',
            'C:\\\\Users\\\\somebody',
        ],
        [
            'forward-slash Windows',
            'file:///C:/Users/somebody/x',
            'C:/Users/somebody',
        ],
    ])('%s', (_shape, lineText, expected) => {
        expect(findHomePathsWithAccount(`first\n${lineText}`)).toEqual([
            { line: 2, path: expected },
        ]);
    });

    test('a placeholder for the account is no account', () => {
        const text = [
            '`/Users/<you>/Library`, `/home/$USER/x`, `%APPDATA%`',
            '`C:\\Users\\x`, `C:\\Users\\~`, `C:\\Users\\…`, `/C:/Users/...`',
            '"C:\\\\Users\\\\<the account>\\\\x", `/Users/{user}/x`',
            '`$HOME/Desktop/dev/x`, `../open-lyric`, `~/Library/x`',
        ].join('\n');
        expect(findHomePathsWithAccount(text)).toEqual([]);
    });

    test('a word that only ends in "users" is no home path', () => {
        expect(
            findHomePathsWithAccount('see src/users/list.ts and api.users/x'),
        ).toEqual([]);
    });

    test('CRLF lines are counted like LF ones', () => {
        expect(findHomePathsWithAccount('a\r\nb\r\n/Users/somebody/x')).toEqual(
            [{ line: 3, path: '/Users/somebody' }],
        );
    });
});
