// Where agent sessions on THIS repo lose time -- read from the local Claude
// Code transcripts, so the agent documents can be aimed at what agents
// actually trip on instead of what someone guessed they would.
//
//   node .claude/skills/owa-enhance-agent-docs/scripts/session-friction.mjs
//   node .../session-friction.mjs --sessions=80        newest 80 (default 40)
//   node .../session-friction.mjs --since=2026-09-01
//   node .../session-friction.mjs --dir=<transcripts>  another project folder
//   node .../session-friction.mjs --all --json
//
// What it reports: tool errors grouped by a MASKED signature and counted by
// how many sessions hit them (one session hitting a wall is a bad day; five
// sessions hitting the same wall is a missing note or a missing tool), tool
// calls the user rejected, interrupts, the files read in the most sessions,
// and the shell commands run in the most sessions.
//
// PRIVACY -- what it never does: print a prompt, an answer or a tool's output
// beyond the masked first line of an error; write a file; use the network.
// Its output stays in the terminal. The agent documents ship in plaintext
// inside the installer, so nothing from a transcript is ever pasted into
// one: a finding is written as the CLASS of trouble ("no python on this
// machine; use node"), never as a quote.
//
// Transcripts live in `~/.claude/projects/<the repo path, every
// non-alphanumeric character a dash>/<session>.jsonl`. Codex keeps its own
// elsewhere and is not read.
//
// Exit code: 0, or 2 when no transcript folder is found.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts -> owa-enhance-agent-docs -> skills -> .claude|.agents -> repo root
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');

const argList = process.argv.slice(2);
const isJson = argList.includes('--json');
const isAll = argList.includes('--all');
const readArgValue = (name) => {
    return argList
        .find((arg) => arg.startsWith(`--${name}=`))
        ?.slice(name.length + 3);
};
const sessionLimit = Number(readArgValue('sessions') ?? 40);
const sinceMs = readArgValue('since') ? Date.parse(readArgValue('since')) : 0;
const LIST_LIMIT = isAll ? Infinity : 12;
const LINE_BREAK_PATTERN = /\r?\n/;
const REJECTED_PATTERN =
    /doesn't want to proceed|tool use was rejected|user denied|permission (?:was )?denied/i;
const INTERRUPTED_PATTERN = /\[Request interrupted by user/;

function findTranscriptDir() {
    const explicitDir = readArgValue('dir');
    if (explicitDir) {
        return explicitDir;
    }
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    const wanted = REPO_ROOT.replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
    let nameList = [];
    try {
        nameList = readdirSync(projectsDir);
    } catch {
        return null;
    }
    const name = nameList.find((one) => one.toLowerCase() === wanted);
    return name ? path.join(projectsDir, name) : null;
}

/**
 * The first line that says what went wrong, with everything personal or
 * volatile masked: paths, numbers, ids, long tokens. Two sessions failing the
 * same way must land on the same signature.
 */
function toSignature(text) {
    const lineList = String(text)
        .split(LINE_BREAK_PATTERN)
        .map((line) => line.trim())
        .filter((line) => line !== '' && !/^Exit code \d+$/.test(line));
    const line = lineList[0] ?? '(empty)';
    return line
        .replace(/<\/?tool_use_error>/g, '')
        .replace(/[A-Za-z]:[\\/][^\s'"`)]+|(?:\/[\w.@-]+){2,}/g, '<path>')
        .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '<id>')
        .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '<tok>')
        .replace(/\d+/g, 'N')
        .slice(0, 110);
}

function toText(content) {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .join('\n');
    }
    return '';
}

function toRepoPath(filePath) {
    if (typeof filePath !== 'string') {
        return null;
    }
    const relPath = path.relative(REPO_ROOT, path.resolve(filePath));
    if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
        return null;
    }
    return relPath.split(path.sep).join('/');
}

// `git status --porcelain` -> `git status`; `node .claude/x/y.mjs --a` ->
// `node .claude/x/y.mjs`. Arguments are masked, the verb is kept.
function toCommandHead(command) {
    const firstLine = String(command).trim().split(LINE_BREAK_PATTERN)[0];
    const wordList = firstLine
        .replace(/^(?:cd\s+\S+\s*&&\s*)/, '')
        .replace(/^(?:env\s+(?:-u\s+\S+\s+)?)/, '')
        .split(/\s+/);
    const [first = '', second = ''] = wordList;
    if (['node', 'npx', 'npm', 'git', 'gh'].includes(first)) {
        return `${first} ${second.replace(/^-.*/, '')}`.trim();
    }
    return first;
}

function bump(map, key, sessionId, extra = {}) {
    if (!map.has(key)) {
        map.set(key, { key, count: 0, sessionSet: new Set(), ...extra });
    }
    const row = map.get(key);
    row.count++;
    row.sessionSet.add(sessionId);
    return row;
}

function readSession(filePath, state) {
    const sessionId = path.basename(filePath, '.jsonl');
    const toolUseMap = new Map();
    let text;
    try {
        text = readFileSync(filePath, 'utf-8');
    } catch {
        return;
    }
    for (const line of text.split(LINE_BREAK_PATTERN)) {
        if (line === '') {
            continue;
        }
        let entry;
        try {
            entry = JSON.parse(line);
        } catch {
            continue;
        }
        const partList = Array.isArray(entry.message?.content)
            ? entry.message.content
            : [];
        if (entry.type === 'assistant') {
            for (const part of partList) {
                if (part?.type !== 'tool_use') {
                    continue;
                }
                toolUseMap.set(part.id, part);
                bump(state.toolMap, part.name, sessionId);
                const input = part.input ?? {};
                if (part.name === 'Read') {
                    const relPath = toRepoPath(input.file_path);
                    if (relPath) {
                        bump(state.readMap, relPath, sessionId);
                    }
                }
                if (['Bash', 'PowerShell'].includes(part.name)) {
                    bump(
                        state.commandMap,
                        toCommandHead(input.command),
                        sessionId,
                    );
                }
            }
            continue;
        }
        if (entry.type !== 'user') {
            continue;
        }
        if (
            typeof entry.message?.content === 'string' &&
            INTERRUPTED_PATTERN.test(entry.message.content)
        ) {
            bump(state.interruptMap, 'interrupted', sessionId);
        }
        for (const part of partList) {
            if (part?.type === 'text' && INTERRUPTED_PATTERN.test(part.text)) {
                bump(state.interruptMap, 'interrupted', sessionId);
            }
            if (part?.type !== 'tool_result') {
                continue;
            }
            const toolUse = toolUseMap.get(part.tool_use_id);
            const toolName = toolUse?.name ?? '?';
            const resultText = toText(part.content);
            if (REJECTED_PATTERN.test(resultText)) {
                const what =
                    toolName === 'Bash' || toolName === 'PowerShell'
                        ? `${toolName}: ${toCommandHead(toolUse?.input?.command)}`
                        : toolName;
                bump(state.rejectMap, what, sessionId);
                continue;
            }
            if (part.is_error) {
                bump(state.toolErrorMap, toolName, sessionId);
                bump(
                    state.errorMap,
                    `${toolName} · ${toSignature(resultText)}`,
                    sessionId,
                );
            }
        }
    }
}

function toRows(map, { minSessions = 1 } = {}) {
    return [...map.values()]
        .filter((row) => row.sessionSet.size >= minSessions)
        .map((row) => ({
            key: row.key,
            sessions: row.sessionSet.size,
            count: row.count,
        }))
        .sort((one, other) => {
            return other.sessions - one.sessions || other.count - one.count;
        });
}

const transcriptDir = findTranscriptDir();
if (transcriptDir === null) {
    console.error(
        'No Claude Code transcript folder for this repo under ~/.claude/projects. ' +
            'Pass --dir=<folder>.',
    );
    process.exit(2);
}
const sessionFileList = readdirSync(transcriptDir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => {
        const filePath = path.join(transcriptDir, name);
        return { filePath, modifiedMs: statSync(filePath).mtimeMs };
    })
    .filter((one) => one.modifiedMs >= sinceMs)
    .sort((one, other) => other.modifiedMs - one.modifiedMs)
    .slice(0, sessionLimit);

const state = {
    toolMap: new Map(),
    toolErrorMap: new Map(),
    errorMap: new Map(),
    rejectMap: new Map(),
    interruptMap: new Map(),
    readMap: new Map(),
    commandMap: new Map(),
};
for (const { filePath } of sessionFileList) {
    readSession(filePath, state);
}

const sessionCount = sessionFileList.length;
const toolRows = toRows(state.toolMap).map((row) => {
    const errorRow = state.toolErrorMap.get(row.key);
    return {
        ...row,
        errors: errorRow?.count ?? 0,
        errorRate: `${Math.round(((errorRow?.count ?? 0) / row.count) * 100)}%`,
    };
});
const result = {
    transcriptDir,
    sessionCount,
    oldest:
        sessionFileList.length > 0
            ? new Date(sessionFileList.at(-1).modifiedMs)
                  .toISOString()
                  .slice(0, 10)
            : null,
    // A wall more than one session walked into.
    repeatedErrors: toRows(state.errorMap, { minSessions: 2 }),
    rejected: toRows(state.rejectMap),
    interrupts: toRows(state.interruptMap),
    tools: toolRows,
    // Read in many sessions: a summary in a note, or a rule that loads with
    // it, may save every one of those reads.
    hotReads: toRows(state.readMap, { minSessions: 3 }).map((row) => {
        let bytes = null;
        try {
            bytes = statSync(path.join(REPO_ROOT, row.key)).size;
        } catch {}
        return { ...row, bytes };
    }),
    commands: toRows(state.commandMap, { minSessions: 3 }),
};

if (isJson) {
    console.log(JSON.stringify(result, null, 2));
} else {
    const share = (sessions) => {
        return `${sessions}/${sessionCount} sessions`;
    };
    const print = (label, rowList, format) => {
        console.log(`\n== ${label}: ${rowList.length}`);
        for (const row of rowList.slice(0, LIST_LIMIT)) {
            console.log(`    - ${format(row)}`);
        }
        if (rowList.length > LIST_LIMIT) {
            console.log(`    … ${rowList.length - LIST_LIMIT} more (--all)`);
        }
    };
    console.log(
        `Session friction -- ${sessionCount} sessions since ${result.oldest}\n` +
            `  ${transcriptDir}\n` +
            '  Masked signatures only; never paste a transcript into a note.',
    );
    print(
        'errors seen in more than one session',
        result.repeatedErrors,
        (row) => {
            return `${share(row.sessions)} · ×${row.count} · ${row.key}`;
        },
    );
    print('tool calls the user rejected', result.rejected, (row) => {
        return `${share(row.sessions)} · ×${row.count} · ${row.key}`;
    });
    print('interrupts', result.interrupts, (row) => {
        return `${share(row.sessions)} · ×${row.count}`;
    });
    print('tools by use (errors)', result.tools, (row) => {
        return `${row.key} ×${row.count} in ${share(row.sessions)} · ${row.errors} errors (${row.errorRate})`;
    });
    print('files read in 3+ sessions', result.hotReads, (row) => {
        const size =
            row.bytes === null ? 'gone' : `${Math.round(row.bytes / 1024)} KB`;
        return `${share(row.sessions)} · ×${row.count} · ${row.key} (${size})`;
    });
    print('shell commands run in 3+ sessions', result.commands, (row) => {
        return `${share(row.sessions)} · ×${row.count} · ${row.key}`;
    });
}
