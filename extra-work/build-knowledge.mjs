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
//   internal/ .claude/** -- CLAUDE.md, its path-scoped rules, the memories and
//             the skills. Deep, accurate, and written for whoever is building
//             the app; the chatbot ranks it BELOW the manual and labels it, so
//             an answer from here is never mistaken for a user instruction.
//
// An index is written beside them so answering a question is ONE file read
// (1.5 MB and 396 entries on 2026-11-07; it was ~300 KB once the manual was
// indexed whole) instead of opening some 400 markdown files -- this runs on
// machines where that difference is felt.
//
// A third corpus is kept OUT of that index on purpose:
//
//   bible-note/ the Bible Note editor's own user guide, from the `bible-note`
//             package (`bibleNoteGuideHelpers.mjs`), one page per chunk and an
//             `index.json` of its own. Its 121 pages are about one window,
//             the note editor; merged into the main index they cost other
//             windows' questions their right page (measured 2026-11-07), and
//             every search would read them. `help.mjs` reads this index only
//             for a question about a note.
//
// ENGLISH ONLY (2026-11-04, the user: _everything related to a language have
// to be loaded from the language data (from language installation catalog),
// must not ship in the app, except english_). A language's dictionary,
// assistant facts, question corpus, translated manual and Bible book names
// travel in its own plugin (`build-lang-plugins.mjs`), and the MCP server
// reads them from the installed one (`tools/owa-devtools-mcp/langPacks.mjs`).
// What this writes for them is the English side: each manual page's `hash`,
// which a translation's `translatedFrom` must equal to be shown.

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

import { readSourceAssistantFacts } from '../tools/owa-devtools-mcp/tran.mjs';
import { hashManualPage } from '../tools/owa-devtools-mcp/manualI18n.mjs';
import {
    BIBLE_NOTE_GUIDE_DIR_NAME,
    genBibleNoteGuideFile,
    resolveBibleNoteGuidePath,
    toBibleNoteGuideFileName,
    toBibleNoteGuidePages,
} from './bibleNoteGuideHelpers.mjs';

const REPO_ROOT = resolve('.');
const OUTPUT_DIR = join(REPO_ROOT, 'electron-build', 'knowledge');
// Enough for scoring and an excerpt of an INTERNAL note; the full file is read
// only when a page is actually opened. The manual is indexed WHOLE (up to the
// page cap below): it is what every answer must come from, and two of its
// pages run to thirty kilobytes -- measured 2026-09-10, "spending limit"
// found nothing in the manual and only an internal note, because the guide
// page that teaches it says so in its step 8, twenty kilobytes past the cap;
// the assistant then answered that the app has no such setting. Whole, the
// manual adds ~90 KB to the index; the internal corpus (185 notes, some of
// them hundreds of kilobytes) stays capped or the index would be megabytes
// read on every search.
//
// The page cap is a ceiling no page may reach, not a size to cut at: the
// help window's own page passed the old 60 000 by itself, and everything
// after that character went out of the search with nothing said --
// measured 2026-10-16, "Can you write the notation for words I paste in?"
// stopped finding its page the day eight lines were added above its answer
// (EC-284). A page cut now is said here, and
// `src/test-setup/knowledgeIndexLimit.test.ts` fails the gate on one.
const SEARCH_TEXT_LIMIT = 3000;
const MANUAL_SEARCH_TEXT_LIMIT = 120000;
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
        includeDirNames: ['rules', 'memory', 'skills'],
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

// The windows a page can be written FOR, most specific first: a recipe whose
// **Where:** line says "Lyric Editor window" must not be claimed by the looser
// "presenter" test below it, and the Document Editor is a tab OF the presenter
// window, so it has to be tried before it too. The keys are `botFocus.mjs`'s.
const SURFACE_PATTERNS = [
    [/lyric editor|lyriceditor\.html/, 'lyricEditor'],
    [/web editor|webeditor\.html/, 'webEditor'],
    [/bible note window|note editor|biblenote\.html/, 'bibleNote'],
    [/local web share|lwshare\.html/, 'lwShare'],
    [/settings window|setting\.html/, 'setting'],
    [
        /slide editor|document editor|appdocumenteditor\.html/,
        'appDocumentEditor',
    ],
    [/bible reader|reader\.html|reader window|reader tab/, 'reader'],
    [/presenter|presenting content|main window/, 'presenter'],
];

// Which window of the app a recipe is about, so a question asked from the Bible
// Reader is not answered with the presenter's way of doing it (they differ: the
// presenter has a Ctrl+B lookup popup, the reader does not). Taken from what the
// recipe itself declares -- its `Where:` line and its section -- and left null
// when it genuinely applies everywhere, which is what a page about a window the
// manual has no dedicated recipe for falls back to.
function toSurface(body, section) {
    const where = /^\*\*Where:\*\*\s*(.+)$/m.exec(body)?.[1] ?? '';
    const declared = `${where} ${section}`.toLowerCase();
    for (const [pattern, surface] of SURFACE_PATTERNS) {
        if (pattern.test(declared)) {
            return surface;
        }
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
            // What a translation of this page must say it was made from.
            ...(source.kind === 'manual'
                ? { hash: hashManualPage(content) }
                : {}),
            headings: genHeadings(body),
            searchText: body.slice(
                0,
                source.kind === 'manual'
                    ? MANUAL_SEARCH_TEXT_LIMIT
                    : SEARCH_TEXT_LIMIT,
            ),
        });
        if (source.kind === 'manual' && body.length > MANUAL_SEARCH_TEXT_LIMIT) {
            console.warn(
                `✗ ${relativePath} is cut at ${MANUAL_SEARCH_TEXT_LIMIT} ` +
                    `characters of ${body.length}: the rest cannot be found by ` +
                    'the help search.',
            );
        }
    }
}

writeFileSync(
    join(OUTPUT_DIR, 'index.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), entries }),
);

// The Bible Note editor's own guide, beside the rest and indexed apart (the
// header says why). Copied, not read at run time: the package is a
// devDependency and is not in a packaged app. A checkout without it builds
// everything else and says so.
function writeBibleNoteGuide() {
    const guidePath = resolveBibleNoteGuidePath(REPO_ROOT);
    if (guidePath === null) {
        console.warn(
            '✗ bible-note/knowledge/ui-rag.md was not found: the chatbot ' +
                'will know nothing of the Bible Note editor. Run npm install.',
        );
        return 0;
    }
    const pages = toBibleNoteGuidePages(readFileSync(guidePath, 'utf8'));
    const guideEntries = pages.map((page) => {
        const fileName = toBibleNoteGuideFileName(page);
        const content = genBibleNoteGuideFile(page);
        const outputPath = join(OUTPUT_DIR, ...fileName.split('/'));
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, content);
        return {
            id: page.id,
            title: page.title,
            section: page.section,
            kind: 'manual',
            // The note window's, so a question asked about any other window
            // is never answered with the editor's buttons.
            surface: 'bibleNote',
            source: BIBLE_NOTE_GUIDE_DIR_NAME,
            file: fileName,
            headings: genHeadings(`# ${page.title}\n${page.body}`),
            // The page's own words, without the line saying where it is
            // from: every page carries it, so it would only add the same
            // words to all of them.
            searchText: page.body.slice(0, MANUAL_SEARCH_TEXT_LIMIT),
        };
    });
    writeFileSync(
        join(OUTPUT_DIR, BIBLE_NOTE_GUIDE_DIR_NAME, 'index.json'),
        JSON.stringify({
            generatedAt: new Date().toISOString(),
            entries: guideEntries,
        }),
    );
    return guideEntries.length;
}
const bibleNoteGuideCount = writeBibleNoteGuide();

// The app's own label dictionary, beside the documents that name those labels.
//
// The knowledge is written in English and the buttons it names are not, so a
// document says `[en:tran:Clear Long Text]` and the assistant fills that in with
// whatever the key reads as in the interface language the user is actually
// looking at -- out of that language's installed plugin (`tran.json`). English
// is the key language, so its dictionary is empty by construction: what is
// written here is English itself, with its assistant facts, and its Bible book
// names for the Bible import.
const ENGLISH_DIR = join(REPO_ROOT, 'src', 'lang', 'data', 'en');
const englishBooksFile = join(ENGLISH_DIR, 'bibleBooks.json');
writeFileSync(
    join(OUTPUT_DIR, 'bible-books.json'),
    JSON.stringify(
        existsSync(englishBooksFile)
            ? { en: JSON.parse(readFileSync(englishBooksFile, 'utf8')) }
            : {},
    ),
);
const englishMeta = existsSync(join(ENGLISH_DIR, 'meta.json'))
    ? JSON.parse(readFileSync(join(ENGLISH_DIR, 'meta.json'), 'utf8'))
    : {};
const languages = [
    {
        code: 'en',
        name: englishMeta.name ?? 'English',
        nativeName: englishMeta.nativeName ?? 'English',
        assistant: readSourceAssistantFacts('en'),
    },
];
writeFileSync(
    join(OUTPUT_DIR, 'tran.json'),
    JSON.stringify({ languages, dictionaries: {} }),
);

const manualCount = entries.filter((entry) => entry.kind === 'manual').length;
console.log(
    `Knowledge bundled: ${entries.length} documents ` +
        `(${manualCount} manual, ${entries.length - manualCount} internal), ` +
        `${bibleNoteGuideCount} Bible Note editor guide pages apart, ` +
        'English only (every other language is read from its installed plugin)',
);
