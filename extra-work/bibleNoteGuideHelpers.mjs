'use strict';
// The Bible Note editor's own user guide, read for the chatbot's knowledge.
//
// The note window is the `bible-note` package's editor, and the package ships
// a guide written for the person using it: `knowledge/ui-rag.md`, one chunk
// per `##` heading, each with its metadata in an HTML comment under the
// heading. Asked for 2026-11-07 (the user: _build
// `node_modules/bible-note/knowledge/ui-rag.md` into chatbot knowledge. goal:
// chatbot is can help modify and answer everything on bible-note_).
//
// The package is a devDependency and is NOT in a packaged app, so the guide
// is copied in at BUILD time (`build-knowledge.mjs`), one page per chunk:
// `readHelpPage` reads a page whole, and pointing every chunk at the one
// 160 KB file would hand a model all of it.
//
// What this reads is pure: the text in, the pages out. Three things are
// taken off on the way, because none of them is about the editor:
//   - the front matter and every chunk comment (a model shown the JSON reads
//     the metadata instead of the steps);
//   - every `bible-note@x.y.z`: nothing that changes with a release may ride
//     on a question (`agent-knowledge.md`), and a version in a page re-rolls
//     every answer written from it at temperature 0;
//   - the chunks that are FALSE inside Open Worship (`DROPPED_CHUNK_ID_LIST`).
//
// No `node:fs` here: the test hands it the real file, the build its copy.

import { createRequire } from 'node:module';
import { join } from 'node:path';

export const BIBLE_NOTE_GUIDE_SPECIFIER = 'bible-note/knowledge/ui-rag.md';
/** What every page id of the guide starts with, and the folder it is in. */
export const BIBLE_NOTE_GUIDE_ID_PREFIX = 'bible-note:';
export const BIBLE_NOTE_GUIDE_DIR_NAME = 'bible-note';

// Each is untrue in this app, and a page that says the opposite of the app
// is worse than no page:
//   - the settings panel: the app mounts none, so there is no gear, no Dark
//     Mode switch (the theme follows the app's) and no Reset to Defaults;
//   - Share as Link and Convert From Markdown: hidden in an app
//     (`isOnApp: true`), shown only in a web browser.
export const DROPPED_CHUNK_ID_LIST = [
    'ui/settings/open-the-settings-panel',
    'ui/settings/see-every-settings-switch-and-its-default',
    'ui/settings/display-switches-dark-mode-invisible-characters-and-table-of-contents',
    'ui/settings/writing-switches-autocomplete-brackets-and-retain-selection',
    'ui/settings/use-the-editors-own-right-click-menu',
    'ui/settings/code-and-formatting-switches',
    'ui/settings/reset-to-defaults',
    'ui/import-export-and-print/share-a-note-as-a-link',
    'ui/import-export-and-print/convert-a-note-from-or-to-markdown',
];

// A chunk REWRITTEN for this app, its words taken from W-14 (live-verified),
// rather than dropped: "There is no Save button ... saves automatically" is
// the opposite of the note window here, and with the chunk simply gone, "save
// my note" asked inside a note window was answered from the guide's Word copy
// and back-up pages (measured 2026-11-07) -- the question is asked, so the
// page that answers it has to be there.
export const REWRITTEN_CHUNK_BODY_MAP = {
    'ui/getting-started/how-your-note-is-saved': [
        'In Open Worship the note editor does not write the note file by ' +
            'itself. What you type is kept in an editing history, and the ' +
            'row of buttons at the bottom right of the note window is how ' +
            'you decide what happens to it:',
        '',
        '- **[en:tran:Save]** (**Ctrl+S**) writes it into the note file.',
        '- **[en:tran:Undo Saved Change]** and **[en:tran:Redo Saved Change]** ' +
            'walk that history -- back past a save as well -- and still work ' +
            'after the window has been closed and opened again, so an edit ' +
            'made by mistake can be taken back.',
        '- **[en:tran:Discard changed]** throws the unsaved typing away, with ' +
            'that history, and returns the note to what was last saved.',
        '',
        'The arrows at the TOP of the window are the text editor’s own undo ' +
            'and redo; the ones at the bottom are the note file’s.',
    ].join('\n'),
};

// The guide says the undo history is gone once the editor closes. In this
// app the window keeps a second one, on disk: said under each page that
// would otherwise send somebody away thinking a note is lost.
const SAVE_HISTORY_CHUNK_ID_SET = new Set([
    'ui/getting-started/undo-and-redo-changes',
    'ui/formatting-text/undo-and-redo-changes',
    'ui/import-export-and-print/clear-the-whole-note',
]);
export const SAVE_HISTORY_LINE =
    'In Open Worship the note window also keeps a history of its own, in ' +
    'the buttons at its bottom: **[en:tran:Save]** (Ctrl+S) writes the note to its ' +
    'file, and **[en:tran:Undo Saved Change]** and ' +
    '**[en:tran:Redo Saved Change]** step back and forward through it -- ' +
    'and that history is still there after the window is closed and opened ' +
    'again.';

// Said at the top of every page, never searched: an answer written from it
// is about the editor inside a note's window, not about the panel.
export const BIBLE_NOTE_GUIDE_SOURCE_LINE =
    "_(From the Bible Note editor's own guide: the editor inside a Bible " +
    "note's window. Its own buttons are named in English.)_";

const CHUNK_COMMENT_PATTERN = /^<!--\s*chunk\s+(\{.*\})\s*-->\s*$/;
const FENCE_PATTERN = /^\s*(```|~~~)/;
const VERSION_PATTERN = /\s*\(?\bbible-note@\d+\.\d+\.\d+[\w.-]*\)?/g;

function parseFrontMatter(text) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
    if (match === null) {
        return { data: {}, rest: text };
    }
    const data = {};
    for (const line of match[1].split(/\r?\n/)) {
        const pair = /^([\w-]+):\s*(.*)$/.exec(line);
        if (pair !== null) {
            data[pair[1]] = pair[2].trim();
        }
    }
    return { data, rest: text.slice(match[0].length) };
}

/**
 * Every chunk of the guide as written: `{id, section, title, tags, body}`,
 * the body without its heading and comment. A `##` inside a fenced code block
 * is code, not a chunk; a `##` heading with no chunk comment under it is
 * kept with the chunk before it.
 */
export function parseBibleNoteGuide(text) {
    const { data, rest } = parseFrontMatter(
        String(text ?? '').replace(/\r\n?/g, '\n'),
    );
    const lines = rest.split('\n');
    const chunks = [];
    let current = null;
    let isInFence = false;
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (FENCE_PATTERN.test(line)) {
            isInFence = !isInFence;
        }
        if (!isInFence && line.startsWith('## ')) {
            // The comment is the next line that is not blank.
            let next = index + 1;
            while (next < lines.length && lines[next].trim() === '') {
                next++;
            }
            const comment = CHUNK_COMMENT_PATTERN.exec(lines[next] ?? '');
            if (comment !== null) {
                let meta;
                try {
                    meta = JSON.parse(comment[1]);
                } catch (_error) {
                    meta = null;
                }
                if (meta !== null && typeof meta.id === 'string') {
                    current = {
                        id: meta.id,
                        section: String(meta.section ?? ''),
                        title: String(meta.title ?? ''),
                        tags: Array.isArray(meta.tags) ? meta.tags : [],
                        bodyLines: [],
                    };
                    chunks.push(current);
                    index = next;
                    continue;
                }
            }
        }
        if (current !== null) {
            current.bodyLines.push(line);
        }
    }
    return {
        frontMatter: data,
        chunks: chunks.map(({ bodyLines, ...chunk }) => {
            return { ...chunk, body: toCleanBody(bodyLines.join('\n')) };
        }),
    };
}

function toCleanBody(body) {
    return body
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(VERSION_PATTERN, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * The pages the chatbot is given: every chunk but the dropped ones, each
 * with its knowledge id (`bible-note:ui/...`), the history line where the
 * guide would have a note given up for lost.
 */
export function toBibleNoteGuidePages(text) {
    const droppedSet = new Set(DROPPED_CHUNK_ID_LIST);
    return parseBibleNoteGuide(text)
        .chunks.filter((chunk) => {
            return !droppedSet.has(chunk.id);
        })
        .map((chunk) => {
            const ownBody = REWRITTEN_CHUNK_BODY_MAP[chunk.id] ?? chunk.body;
            const body = SAVE_HISTORY_CHUNK_ID_SET.has(chunk.id)
                ? `${ownBody}\n\n${SAVE_HISTORY_LINE}`
                : ownBody;
            return {
                id: `${BIBLE_NOTE_GUIDE_ID_PREFIX}${chunk.id}`,
                chunkId: chunk.id,
                section: chunk.section,
                title: chunk.title,
                tags: chunk.tags,
                body,
            };
        });
}

/** A page as its file holds it: the title, the source line, the body. */
export function genBibleNoteGuideFile(page) {
    return (
        `# ${page.title}\n\n${BIBLE_NOTE_GUIDE_SOURCE_LINE}\n\n` +
        `${page.body}\n`
    );
}

/** Where a page's file goes under the knowledge folder, forward slashes. */
export function toBibleNoteGuideFileName(page) {
    return `${BIBLE_NOTE_GUIDE_DIR_NAME}/${page.chunkId}.md`;
}

/**
 * The guide's path in this checkout, or null when the package is not
 * installed -- through the package's own published subpath, the way its
 * README says to read it.
 */
export function resolveBibleNoteGuidePath(repoRoot) {
    try {
        return createRequire(join(repoRoot, 'package.json')).resolve(
            BIBLE_NOTE_GUIDE_SPECIFIER,
        );
    } catch (_error) {
        return null;
    }
}
