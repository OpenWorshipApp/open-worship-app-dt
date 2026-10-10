// Copies the agent documents from `.claude/` into their Codex mirror, the way
// AGENTS.md says it is kept:
//
//   .claude/CLAUDE.md -> .codex/project-instructions.md   exact copy
//   .claude/rules/    -> .codex/instructions/             exact copies
//   .claude/memory/   -> .codex/memory/                   exact copies
//   .claude/skills/   -> .agents/skills/                  exact copies, except
//       each SKILL.md: its Codex front matter, `## Codex usage` and
//       `Arguments:` stay; the preserved description and the body are rewritten
//       from the Claude SKILL.md.
//
//   node extra-work/sync-agent-mirror.mjs           copy what differs
//   node extra-work/sync-agent-mirror.mjs --check   change nothing; exit 1 on drift
//   node extra-work/sync-agent-mirror.mjs --prune   also delete mirror files
//                                                   whose source is gone
//   --root=<dir>                                    another checkout (the tests)
//
// `.claude/` is the source of truth, so a mirror file that differs is stale by
// definition and is overwritten, never reconciled. Mirrors drifted before this
// existed -- one fell several revisions and seven memory notes behind -- and
// `src/test-setup/agentDocsMirror.test.ts` now holds the gate to `--check`.
// Line endings are not drift: a Windows checkout hands these over as CRLF.
//
// What it never does: write a Codex preamble for a new skill (that is a
// judgement -- AGENTS.md says what goes in it), rebuild the chatbot's
// knowledge (`node extra-work/build-knowledge.mjs` relaunches a dev app), or
// touch `.codex/config.toml` beyond checking it names every `.mcp.json` server.

import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argList = process.argv.slice(2);
const isCheck = argList.includes('--check');
const isPrune = argList.includes('--prune');
const rootArg = argList
    .find((arg) => arg.startsWith('--root='))
    ?.slice('--root='.length);
const REPO_ROOT = path.resolve(
    rootArg ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
);

const DIR_MAPPING_LIST = [
    ['.claude/rules', '.codex/instructions'],
    ['.claude/memory', '.codex/memory'],
    ['.claude/skills', '.agents/skills'],
];
const SKIPPED_NAME_SET = new Set(['node_modules', '__pycache__', '.DS_Store']);
const TEXT_EXTENSION_PATTERN = /\.(?:md|mjs|cjs|js|ts|json|toml|ya?ml|txt|sh|py)$/;
const SCOPE_HEADING = '### Full workflow scope (preserved from Claude)';
const SKILL_FILE_PATTERN = /^\.claude\/skills\/[^/]+\/SKILL\.md$/;

function toFullPath(relPath) {
    return path.join(REPO_ROOT, ...relPath.split('/'));
}

function listFilesUnder(relDir) {
    const fullDir = toFullPath(relDir);
    if (!existsSync(fullDir)) {
        return [];
    }
    const fileList = [];
    for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
        if (SKIPPED_NAME_SET.has(entry.name)) {
            continue;
        }
        const relPath = `${relDir}/${entry.name}`;
        if (entry.isDirectory()) {
            fileList.push(...listFilesUnder(relPath));
        } else if (entry.isFile()) {
            fileList.push(relPath);
        }
    }
    return fileList;
}

function readBytes(relPath) {
    const fullPath = toFullPath(relPath);
    return existsSync(fullPath) ? readFileSync(fullPath) : null;
}

function toComparable(relPath, bytes) {
    if (!TEXT_EXTENSION_PATTERN.test(relPath)) {
        return bytes.toString('base64');
    }
    return bytes.toString('utf-8').replace(/\r\n/g, '\n');
}

// One YAML scalar on one line, as the SKILL.md front matter writes them.
function readYamlScalar(rawValue) {
    const value = rawValue.trim();
    if (value.startsWith("'") && value.endsWith("'")) {
        return value.slice(1, -1).replace(/''/g, "'");
    }
    if (value.startsWith('"') && value.endsWith('"')) {
        return JSON.parse(value);
    }
    return value;
}

function splitFrontMatter(text) {
    const lineList = text.replace(/\r\n/g, '\n').split('\n');
    if (lineList[0] !== '---') {
        return { fieldMap: {}, body: text.trim() };
    }
    const endIndex = lineList.indexOf('---', 1);
    const fieldMap = {};
    for (const line of lineList.slice(1, endIndex)) {
        const match = line.match(/^([\w-]+):\s?(.*)$/);
        if (match) {
            fieldMap[match[1]] = readYamlScalar(match[2]);
        }
    }
    return {
        fieldMap,
        body: lineList
            .slice(endIndex + 1)
            .join('\n')
            .trim(),
    };
}

/**
 * The mirrored SKILL.md as it should read: its own Codex preamble (with the
 * `Arguments:` line brought in step), then the Claude description and body.
 * Null when the mirror has no preamble to keep.
 */
function composeMirroredSkill(sourceText, mirrorText) {
    const mirrorLineList = mirrorText.replace(/\r\n/g, '\n').split('\n');
    const scopeIndex = mirrorLineList.indexOf(SCOPE_HEADING);
    if (scopeIndex < 0) {
        return null;
    }
    const { fieldMap, body } = splitFrontMatter(sourceText);
    const hint = fieldMap['argument-hint'];
    const preambleLineList = mirrorLineList
        .slice(0, scopeIndex + 1)
        .map((line) => {
            return hint && line.startsWith('Arguments: ')
                ? `Arguments: ${hint}`
                : line;
        });
    return [
        ...preambleLineList,
        '',
        fieldMap.description ?? '',
        '',
        body,
        '',
    ].join('\n');
}

function collectPairList() {
    const pairList = [['.claude/CLAUDE.md', '.codex/project-instructions.md']];
    for (const [sourceDir, mirrorDir] of DIR_MAPPING_LIST) {
        for (const sourcePath of listFilesUnder(sourceDir)) {
            pairList.push([
                sourcePath,
                `${mirrorDir}${sourcePath.slice(sourceDir.length)}`,
            ]);
        }
    }
    return pairList;
}

function listOrphans(pairList) {
    const mirrorPathSet = new Set(pairList.map(([, mirrorPath]) => mirrorPath));
    return DIR_MAPPING_LIST.flatMap(([, mirrorDir]) => {
        return listFilesUnder(mirrorDir);
    }).filter((mirrorPath) => {
        return !mirrorPathSet.has(mirrorPath);
    });
}

function listMissingMcpServers() {
    const mcpBytes = readBytes('.mcp.json');
    if (mcpBytes === null) {
        return [];
    }
    const serverNameList = Object.keys(
        JSON.parse(mcpBytes.toString('utf-8')).mcpServers ?? {},
    );
    const tomlText = readBytes('.codex/config.toml')?.toString('utf-8') ?? '';
    return serverNameList.filter((name) => {
        return !tomlText.includes(`[mcp_servers.${name}]`);
    });
}

function writeFile(relPath, content) {
    mkdirSync(path.dirname(toFullPath(relPath)), { recursive: true });
    writeFileSync(toFullPath(relPath), content);
}

const pairList = collectPairList();
const driftList = [];
const problemList = [];
for (const [sourcePath, mirrorPath] of pairList) {
    const sourceBytes = readBytes(sourcePath);
    const mirrorBytes = readBytes(mirrorPath);
    if (SKILL_FILE_PATTERN.test(sourcePath)) {
        if (mirrorBytes === null) {
            problemList.push(
                `${mirrorPath} -- missing; a new skill's Codex preamble is ` +
                    'written by hand (AGENTS.md says what goes in it)',
            );
            continue;
        }
        const mirrorText = mirrorBytes.toString('utf-8');
        const expected = composeMirroredSkill(
            sourceBytes.toString('utf-8'),
            mirrorText,
        );
        if (expected === null) {
            problemList.push(
                `${mirrorPath} -- has no "${SCOPE_HEADING}" line to keep the ` +
                    'preamble above',
            );
            continue;
        }
        if (mirrorText.replace(/\r\n/g, '\n') !== expected) {
            driftList.push(mirrorPath);
            if (!isCheck) {
                const eol = mirrorText.includes('\r\n') ? '\r\n' : '\n';
                writeFile(mirrorPath, expected.split('\n').join(eol));
            }
        }
        continue;
    }
    if (
        mirrorBytes !== null &&
        toComparable(sourcePath, sourceBytes) ===
            toComparable(mirrorPath, mirrorBytes)
    ) {
        continue;
    }
    driftList.push(mirrorPath);
    if (!isCheck) {
        writeFile(mirrorPath, sourceBytes);
    }
}
const orphanList = listOrphans(pairList);
if (isPrune && !isCheck) {
    for (const orphanPath of orphanList) {
        rmSync(toFullPath(orphanPath));
    }
}
for (const name of listMissingMcpServers()) {
    problemList.push(
        `.codex/config.toml -- does not register the "${name}" server that ` +
            '.mcp.json does (translate it by hand)',
    );
}

const verb = isCheck ? 'out of step' : 'copied';
for (const mirrorPath of driftList) {
    console.log(`${verb}: ${mirrorPath}`);
}
for (const orphanPath of orphanList) {
    console.log(
        `${isPrune && !isCheck ? 'deleted' : 'no source'}: ${orphanPath}`,
    );
}
for (const problem of problemList) {
    console.log(`by hand: ${problem}`);
}
const isOrphanLeft = orphanList.length > 0 && !(isPrune && !isCheck);
const isFailed =
    problemList.length > 0 ||
    isOrphanLeft ||
    (isCheck && driftList.length > 0);
console.log(
    `${pairList.length} files mirrored; ${driftList.length} ${verb}` +
        (orphanList.length > 0 ? `; ${orphanList.length} without a source` : '') +
        (problemList.length > 0 ? `; ${problemList.length} need a hand` : ''),
);
if (isFailed) {
    if (isCheck) {
        console.log('Run: node extra-work/sync-agent-mirror.mjs');
    }
    process.exitCode = 1;
}
