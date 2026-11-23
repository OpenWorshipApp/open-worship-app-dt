// A PreToolUse guard for the Bash tool under zsh (`AD-34`, 2026-11-14).
//
// zsh reads an unquoted `*`, `?` or `[` in ANY word as a filename pattern,
// and a pattern that matches nothing aborts the whole command line:
// `grep -rn --include=*.ts* foo src` dies with "no matches found:
// --include=*.ts*" before grep runs. bash passes the word through
// unchanged, which is why the habit survives. Measured before the guard: 3 of
// 27 sessions hit it (x4), and the run that proposed this guard hit it twice.
// A `--flag=value` word is never meant to match files, so this catches
// exactly that shape -- unquoted, under zsh.
//
// Since 2026-11-19 (`AD-35`) it ESCAPES the glob instead of refusing the
// call: the refusal had cost a round trip in 14 of 40 sessions. It answers
// `hookSpecificOutput.updatedInput` with a backslash before each unquoted
// `*`, `?`, `[` of such a word -- not quotes around it, so a brace list,
// a `$VAR` or a `~` in the same word keeps its meaning -- and NO
// `permissionDecision`: Claude Code evaluates the permission rules, the
// auto-mode classifier and any prompt against the rewritten command exactly
// as it would have the original. Never add "allow" here; that would skip the
// person's prompts for every command this rewrites.
//
//   node zsh-glob-guard.mjs hook        (stdin: the hook's JSON)
//
// Exit 0 with JSON on stdout rewrites the call. When a rewrite would not
// come out clean, exit 2 refuses as before and names the quoted form.
// Anything else (another tool, another shell, a quoted glob, a parse it
// cannot follow) exits 0 with nothing. It never fails a call it could not read.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GLOB_CHARACTER_SET = new Set(['*', '?', '[']);
const WORD_BREAK_SET = new Set([' ', '\t', '\n', ';', '|', '&', '(', ')', '<', '>']);

/**
 * The `--flag=value` words of a shell command that hold an unquoted glob
 * character. Quotes and backslashes are followed; the body of a here-document
 * is skipped, since the shell does not glob it.
 */
export function findUnquotedFlagGlobs(command) {
    return scanFlagGlobs(command).found;
}

/**
 * The command with a backslash before every unquoted glob character of
 * those words, and the words found. zsh then passes each word on exactly as
 * bash would have.
 */
export function escapeUnquotedFlagGlobs(command) {
    const { found, globIndexList } = scanFlagGlobs(command);
    let escaped = command;
    for (const index of [...globIndexList].sort((a, b) => b - a)) {
        escaped = `${escaped.slice(0, index)}\\${escaped.slice(index)}`;
    }
    return { found, command: escaped };
}

function scanFlagGlobs(command) {
    const found = [];
    const globIndexList = [];
    let word = '';
    let wordGlobIndexList = [];
    let quote = null;
    const heredocList = [];
    const finishWord = () => {
        if (wordGlobIndexList.length > 0 && /^--[A-Za-z0-9][\w-]*=/.test(word)) {
            found.push(word);
            globIndexList.push(...wordGlobIndexList);
        }
        word = '';
        wordGlobIndexList = [];
    };
    for (let index = 0; index < command.length; index += 1) {
        const char = command[index];
        if (quote === "'") {
            if (char === "'") {
                quote = null;
            } else {
                word += char;
            }
            continue;
        }
        if (quote === '"') {
            if (char === '\\' && index + 1 < command.length) {
                word += command[index + 1];
                index += 1;
            } else if (char === '"') {
                quote = null;
            } else {
                word += char;
            }
            continue;
        }
        if (char === '\\' && index + 1 < command.length) {
            word += command[index + 1];
            index += 1;
            continue;
        }
        if (char === "'" || char === '"') {
            quote = char;
            continue;
        }
        if (char === '#' && word === '') {
            // A comment runs to the end of its line and is never globbed.
            const lineEnd = command.indexOf('\n', index);
            index = (lineEnd === -1 ? command.length : lineEnd) - 1;
            continue;
        }
        if (char === '<' && command[index + 1] === '<' && command[index + 2] !== '<') {
            finishWord();
            const match = command
                .slice(index + 2)
                .match(/^(-?)[ \t]*(['"]?)([A-Za-z_][\w]*)\2/);
            if (match !== null) {
                heredocList.push({ isTabStripped: match[1] === '-', end: match[3] });
                index += 1 + match[0].length;
            } else {
                index += 1;
            }
            continue;
        }
        if (char === '\n' && heredocList.length > 0) {
            finishWord();
            // Skip each pending here-document's body, in order.
            let at = index + 1;
            for (const heredoc of heredocList) {
                for (;;) {
                    const lineEnd = command.indexOf('\n', at);
                    const line = command.slice(at, lineEnd === -1 ? undefined : lineEnd);
                    const bare = heredoc.isTabStripped ? line.replace(/^\t+/, '') : line;
                    at = lineEnd === -1 ? command.length : lineEnd + 1;
                    if (bare === heredoc.end || lineEnd === -1) {
                        break;
                    }
                }
            }
            heredocList.length = 0;
            index = at - 1;
            continue;
        }
        if (WORD_BREAK_SET.has(char)) {
            finishWord();
            continue;
        }
        if (GLOB_CHARACTER_SET.has(char)) {
            wordGlobIndexList.push(index);
        }
        word += char;
    }
    finishWord();
    return { found, globIndexList };
}

function quoteValue(flagWord) {
    const at = flagWord.indexOf('=');
    return `${flagWord.slice(0, at + 1)}'${flagWord.slice(at + 1)}'`;
}

function runHook() {
    let input;
    try {
        input = JSON.parse(readFileSync(0, 'utf-8'));
    } catch {
        return 0;
    }
    if (input?.tool_name !== 'Bash' || !/zsh$/.test(process.env.SHELL ?? '')) {
        return 0;
    }
    const command = input?.tool_input?.command;
    if (typeof command !== 'string') {
        return 0;
    }
    const { found, command: escaped } = escapeUnquotedFlagGlobs(command);
    if (found.length === 0) {
        return 0;
    }
    if (findUnquotedFlagGlobs(escaped).length === 0) {
        process.stdout.write(
            JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    // The whole input object: updatedInput replaces it.
                    updatedInput: { ...input.tool_input, command: escaped },
                },
            }),
        );
        return 0;
    }
    process.stderr.write(
        `zsh would glob ${found.map((one) => `\`${one}\``).join(', ')} and abort the ` +
            'whole line with "no matches found" before the command runs. Quote the ' +
            `value: ${found.map((one) => `\`${quoteValue(one)}\``).join(', ')}.\n`,
    );
    return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    if (process.argv[2] === 'hook') {
        process.exitCode = runHook();
    } else {
        process.stderr.write('Usage: zsh-glob-guard.mjs hook   (stdin: the hook JSON)\n');
        process.exitCode = 1;
    }
}
