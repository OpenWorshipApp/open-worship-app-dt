// A home folder with somebody's account in it, in a document that ships
// (`AD-43`, 2026-11-20). Everything under `.claude/` lands on every
// operator's disk and its notes are the in-app assistant's knowledge, and the
// translated manual is public. Memory `no-user-specific-references-in-notes`
// held this by prose alone: on 2026-11-20 two notes carried a home path with
// an account name, one since 2026-08-30. Pure, so
// `src/test-setup/agentDocsPrivacy.test.ts` can plant a line without writing
// a document.
//
// Shapes: `/Users/<name>/`, `/home/<name>/`, `C:\Users\<name>\` with one or
// two backslashes or forward slashes, and Git Bash's `/c/Users/<name>/`. A
// placeholder for the account is no account: `<you>`, `$USER`, `%USERNAME%`,
// `{user}`, `~`, `…`, `...`, and the few words a doc uses as one (`x`, `you`,
// `name` ...). Write `../<repo>` for a sibling checkout and `$HOME` or `~`
// for the home folder.

const HOME_PATH_PATTERN =
    /(?<![\w.])(?:\/[a-z]\/users|[a-z]:(?:\\\\|\\|\/)users|\/users|\/home)(?:\\\\|\\|\/)([^\s/\\`'"()[\]]+)/gi;
const PLACEHOLDER_ACCOUNT_PATTERN =
    /^(?:[<{$%~*…]|\.\.\.|(?:x|you|me|name|user|username|someone|shared|public|default)$)/i;
const LINE_BREAK_PATTERN = /\r?\n/;

/**
 * Every home path in `text` whose account is a real name, not a placeholder.
 * @param {string} text a document's whole text
 * @returns {{ line: number, path: string }[]} 1-based lines, in order
 */
export function findHomePathsWithAccount(text) {
    const hitList = [];
    text.split(LINE_BREAK_PATTERN).forEach((lineText, index) => {
        for (const match of lineText.matchAll(HOME_PATH_PATTERN)) {
            if (!PLACEHOLDER_ACCOUNT_PATTERN.test(match[1])) {
                hitList.push({ line: index + 1, path: match[0] });
            }
        }
    });
    return hitList;
}
