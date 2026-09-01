'use strict';
/* eslint-disable */
// Bundles everything the in-app chatbot is allowed to know into
// `electron-build/knowledge/`, which ships inside the app (electron-builder
// takes `electron-build/**/*`, unpacked).
//
// Two corpora, deliberately kept apart:
//
//   manual/   docs/manual-sources/** -- the user-facing manual, generated from
//             the live-verified workflow recipes. What a user asking "how do I
//             ...?" should be answered from.
//   internal/ .claude/** -- CLAUDE.md, the memories and the robot-test skill's
//             references. Deep, accurate, and written for whoever is building
//             the app; the chatbot ranks it BELOW the manual and labels it, so
//             an answer from here is never mistaken for a user instruction.
//
// An index is written beside them so answering a question is ONE file read
// (~300 KB) instead of opening 120 markdown files -- this runs on machines
// where that difference is felt.

import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const REPO_ROOT = resolve('.');
const OUTPUT_DIR = join(REPO_ROOT, 'electron-build', 'knowledge');
// Enough for scoring and an excerpt; the full file is read only when a page is
// actually opened.
const SEARCH_TEXT_LIMIT = 3000;
const HEADINGS_LIMIT = 1500;

const SOURCES = [
    {
        kind: 'manual',
        sourceDir: join(REPO_ROOT, 'docs', 'manual-sources'),
        outputName: 'manual',
    },
    {
        kind: 'internal',
        sourceDir: join(REPO_ROOT, '.claude'),
        outputName: 'internal',
        // An ALLOWLIST, not a denylist. This corpus is copied verbatim into
        // the installer and lands in plaintext on every operator's disk, so
        // what ships has to be decided by what was named -- not by what
        // somebody remembered to exclude. A new note dropped anywhere else
        // under `.claude/` (a scratch file, a worktree, a session log, an
        // agent's own settings) must not ship because nobody updated a list.
        includeDirNames: ['memory', 'skills'],
        includeFileNames: ['CLAUDE.md'],
    },
];

/**
 * Every `.md` under `dirPath`.
 *
 * `includeDirNames`/`includeFileNames`, when given, gate the TOP level only:
 * below a directory that was allowed, everything markdown comes along. That is
 * the shape the two corpora actually have -- `docs/manual-sources` is wanted
 * whole, `.claude` is wanted in named parts.
 */
function listMarkdownFiles(dirPath, { includeDirNames, includeFileNames } = {}) {
    if (!existsSync(dirPath)) {
        return [];
    }
    const filePaths = [];
    for (const entryName of readdirSync(dirPath)) {
        const entryPath = join(dirPath, entryName);
        if (statSync(entryPath).isDirectory()) {
            if (
                includeDirNames !== undefined &&
                !includeDirNames.includes(entryName)
            ) {
                continue;
            }
            filePaths.push(...listMarkdownFiles(entryPath));
        } else if (entryName.endsWith('.md')) {
            if (
                includeFileNames !== undefined &&
                !includeFileNames.includes(entryName)
            ) {
                continue;
            }
            filePaths.push(entryPath);
        }
    }
    return filePaths;
}

function parseFrontMatter(content) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if (match === null) {
        return {};
    }
    const data = {};
    for (const line of match[1].split(/\r?\n/)) {
        const pair = /^([\w-]+):\s*(.*)$/.exec(line);
        if (pair !== null) {
            data[pair[1]] = pair[2].replace(/^["']|["']$/g, '');
        }
    }
    return data;
}

function toBody(content) {
    return content
        .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
        // VitePress QA traceability blocks: true, and meaningless to a user.
        .replace(/:::\s*details[\s\S]*?:::\s*/g, '')
        .trim();
}

// Which half of the two-in-one app a recipe is about, so a question asked from
// the Bible Reader is not answered with the presenter's way of doing it (they
// differ: the presenter has a Ctrl+B lookup popup, the reader does not). Taken
// from what the recipe itself declares -- its `Where:` line and its section --
// and left null when it genuinely applies to both.
function toSurface(body, section) {
    const where = /^\*\*Where:\*\*\s*(.+)$/m.exec(body)?.[1] ?? '';
    const declared = `${where} ${section}`.toLowerCase();
    if (/bible reader|reader\.html|reader window|reader tab/.test(declared)) {
        return 'reader';
    }
    if (/presenter|presenting content|main window/.test(declared)) {
        return 'presenter';
    }
    const readerCount = (body.match(/bible reader/gi) ?? []).length;
    const presenterCount = (body.match(/presenter/gi) ?? []).length;
    if (readerCount >= 2 && readerCount > presenterCount * 2) {
        return 'reader';
    }
    if (presenterCount >= 2 && presenterCount > readerCount * 2) {
        return 'presenter';
    }
    return null;
}

// Kept apart from the body slice on purpose: the two used to be concatenated
// into one field, so every excerpt drawn from it opened by saying the same
// line twice.
function genHeadings(body) {
    return body
        .split(/\r?\n/)
        .filter((line) => {
            return line.startsWith('#') || line.startsWith('**');
        })
        .join('\n')
        .slice(0, HEADINGS_LIMIT);
}

rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

const entries = [];
for (const source of SOURCES) {
    const filePaths = listMarkdownFiles(source.sourceDir, {
        includeDirNames: source.includeDirNames,
        includeFileNames: source.includeFileNames,
    });
    for (const filePath of filePaths) {
        const content = readFileSync(filePath, 'utf-8');
        const frontMatter = parseFrontMatter(content);
        const body = toBody(content);
        const relativePath = relative(source.sourceDir, filePath);
        const outputPath = join(
            OUTPUT_DIR,
            source.outputName,
            relativePath,
        );
        mkdirSync(dirname(outputPath), { recursive: true });
        copyFileSync(filePath, outputPath);
        const fallbackTitle =
            /^#\s+(.+)$/m.exec(body)?.[1] ??
            relativePath.replace(/\.md$/, '').split(sep).join(' / ');
        entries.push({
            id:
                frontMatter.id ??
                `${source.outputName}:${relativePath.split(sep).join('/')}`,
            title: frontMatter.title ?? fallbackTitle,
            section:
                frontMatter.section ??
                relativePath.split(sep).slice(0, -1).join(' / '),
            kind: source.kind,
            surface:
                source.kind === 'manual'
                    ? toSurface(
                          body,
                          frontMatter.section ??
                              relativePath.split(sep).slice(0, -1).join(' '),
                      )
                    : null,
            file: `${source.outputName}/${relativePath.split(sep).join('/')}`,
            headings: genHeadings(body),
            searchText: body.slice(0, SEARCH_TEXT_LIMIT),
        });
    }
}

writeFileSync(
    join(OUTPUT_DIR, 'index.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), entries }),
);

const manualCount = entries.filter((entry) => entry.kind === 'manual').length;
console.log(
    `Knowledge bundled: ${entries.length} documents ` +
        `(${manualCount} manual, ${entries.length - manualCount} internal)`,
);
