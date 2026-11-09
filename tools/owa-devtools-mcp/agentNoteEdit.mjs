// `owa_note_edit`: ONE of the user's Bible notes changed by the help window's
// assistant -- its words changed or translated, tidied into headings and
// lists, verses added from the Bible -- with everything else in it kept
// (2026-11-07, the user, with a note row's menu open: _add `Open in Chatbot`
// for bible-note, to do what `Open in Chatbot` of appdocument … goal: chatbot
// can help modify and answer everything on bible-note_).
//
// A note is the `bible-note` editor's own state: headings, lists, verse
// mentions that carry their words, passages, tables, pictures, drawings,
// sticky notes. `owa_bible_note update` wrote a note back as plain paragraphs
// and lost all of that; here the note is read as numbered BLOCKS in a light
// mark-up and a change names the blocks it is about. The rules are the app's
// (`src/helper/agentNoteBlockHelpers.ts`, pure, and the worker in
// `agentNoteEditHelpers.ts`): the editing HEAD is read, the whole change is
// backed up and goes into the note's editing history as ONE step, unsaved --
// the note window's Save keeps it -- and an open note window shows it at
// once.
//
// Everything the note editor's TOOLBAR does is a field of a change (2026-11-08,
// the user, with a picture of the toolbar: _make chatbot able to use all
// toolbar operations_): font, size, colours, the styles of its ••• menu,
// Clear Formatting, alignment and indent -- for a block, or with `words` for
// those words in it -- every object of its Insert menu as a kind to add, and
// its Undo / Redo as `undo` / `redo` over the note's kept history, a
// drawing from words and the editor's Default Example as kinds, a code
// block's language and theme, Link block text (`linkTo`) and the ¶ view
// (`view`) -- the last two the editor's own keys, not the note's.
//
// Offered to the chatbot's model only in a conversation about an attached
// note (`MODEL_ON_ASK_TOOL_MAP`, kind `note`), where the WINDOW turns the
// note's name into its file and id (`src/chatbot/noteChatHelpers.ts`): a
// model names the note, never a path. An outside agent over stdio gives
// `file` (a whole `.own` path) and `id`; the app checks both again.
//
// Every action runs IN THE NOTE'S OWN WINDOW, through its editor (2026-11-08,
// the user: _it's dangerous to reand and modify wrong file … chatbot should
// work directly on UI, e.g. bible-note chatbot should depend on bible-note UI
// controller_, the goal _chatbot modifying files should work on the fresh
// latest user seen content_, and _only bible-note is an edge case_). The
// window is found among the app's windows by its address
// (`bibleNote.html?file=<name>&id=<id>`), opened from the main window when
// it is not open, and waited for until its editor is up; the window itself
// refuses a note that is not the one it shows, by its WHOLE path -- another
// Bible Notes folder's file of the same name -- and the next window of that
// address is tried.

import { zod as z } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import {
    evaluateInApp,
    evaluateInTarget,
    listTargets,
    requireLivePort,
} from './cdp.mjs';
import { genAgentDataExpression } from './agentData.mjs';

export const NOTE_EDIT_TOOL_NAME = 'owa_note_edit';

export const NOTE_EDIT_ACTIONS = ['read', 'edit', 'undo', 'redo', 'view'];

// What a change may make a block or add (`NOTE_ADD_KIND_LIST` in
// `agentNoteBlockHelpers.ts`; a test holds the two together).
export const NOTE_EDIT_KINDS = [
    'paragraph',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'quote',
    'code',
    'bullet',
    'number',
    'check',
    'passage',
    'rule',
    'section',
    'table',
    'columns',
    'collapsible',
    'page-break',
    'equation',
    'sticky',
    'date',
    'poll',
    'video',
    'website',
    'media',
    'drawing',
    'example',
];

// A whole path: a drive (`C:\` / `C:/`), a share (`\\server`) or a root.
const ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/;
const NOTE_EXTENSION_PATTERN = /\.own$/i;

/** `{filePath, noteId}` for the note asked about, or `{reason}`. */
export function toNoteEditTarget(file, id) {
    const text = typeof file === 'string' ? file.trim() : '';
    if (text === '' || !Number.isInteger(id) || id < 0) {
        return {
            reason:
                'Name the note (`note`) as it is attached to this ' +
                'conversation.',
        };
    }
    if (
        !ABSOLUTE_PATH_PATTERN.test(text) ||
        !NOTE_EXTENSION_PATTERN.test(text)
    ) {
        return {
            reason: 'Only a Bible notes file (.own) can be changed here.',
        };
    }
    if (
        text.split(/[\\/]/).some((part) => {
            return part === '..';
        })
    ) {
        return {
            reason: 'A notes file path may not step out of its folder with "..".',
        };
    }
    return { filePath: text, noteId: id };
}

export const NOTE_WINDOW_PAGE_NAME = 'bibleNote.html';
// Set by the note window as its editor registers
// (`NOTE_WINDOW_READY_GLOBAL_NAME` in `noteWindowControllerHelpers.ts`, a
// test holds the two together).
export const NOTE_WINDOW_READY_GLOBAL_NAME = '__owaIsNoteWindowReady';
const NOTE_WINDOW_READY_EXPRESSION =
    `typeof globalThis.${NOTE_WINDOW_READY_GLOBAL_NAME} === 'function' && ` +
    `globalThis.${NOTE_WINDOW_READY_GLOBAL_NAME}() === true`;
// The worker's code for a window showing another note -- try the next
// (`noteWindowControllerHelpers.ts`, a test holds the two together).
export const NOTE_WINDOW_OTHER_CODE = 'other-note-window';
// A window takes a few seconds to open and load its names lookup.
const NOTE_WINDOW_OPEN_WAIT_MS = 20000;
const NOTE_WINDOW_POLL_MS = 250;
// Long enough for new verses read from a Bible and a backup.
const NOTE_WORKER_TIMEOUT_MS = 60000;

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/** `Default.own` out of a whole path, either kind of slash. */
function toNoteFileFullName(filePath) {
    return String(filePath ?? '')
        .split(/[\\/]/)
        .pop();
}

/**
 * Whether a window's address is one note's own window -- its file's name
 * and its id in that file, as the note row's Open opens it. Which FOLDER is
 * the window's to say: it refuses another one's file.
 */
export function checkIsNoteWindowUrl(url, fileFullName, noteId) {
    let parsed;
    try {
        parsed = new URL(url, 'http://localhost/');
    } catch (_error) {
        return false;
    }
    return (
        parsed.pathname.split('/').pop() === NOTE_WINDOW_PAGE_NAME &&
        parsed.searchParams.get('file') === fileFullName &&
        parsed.searchParams.get('id') === String(noteId)
    );
}

async function findNoteWindowTargets(port, request, triedIdSet) {
    const fileFullName = toNoteFileFullName(request.filePath);
    return (await listTargets(port)).filter((target) => {
        return (
            !triedIdSet.has(target.id) &&
            checkIsNoteWindowUrl(target.url, fileFullName, request.noteId)
        );
    });
}

async function waitForNoteWindowReady(target) {
    const deadline = Date.now() + NOTE_WINDOW_OPEN_WAIT_MS;
    for (;;) {
        try {
            if (
                (await evaluateInTarget(
                    target,
                    NOTE_WINDOW_READY_EXPRESSION,
                    5000,
                )) === true
            ) {
                return true;
            }
        } catch (_error) {
            // Still loading: its page has no context to evaluate in yet.
        }
        if (Date.now() >= deadline) {
            return false;
        }
        await sleep(NOTE_WINDOW_POLL_MS);
    }
}

/**
 * Opens the note's window from the main window -- the row's own Open -- and
 * waits for it among the app's windows. The app checks the note first.
 */
async function openNoteWindow(port, request, triedIdSet) {
    const { value } = await evaluateInApp(
        genAgentDataExpression('note-window', {
            filePath: request.filePath,
            noteId: request.noteId,
        }),
        { port },
    );
    if (value === null || typeof value !== 'object') {
        return { isError: true, reason: 'The app did not answer.' };
    }
    if (value.isError === true) {
        return value;
    }
    const deadline = Date.now() + NOTE_WINDOW_OPEN_WAIT_MS;
    for (;;) {
        const found = await findNoteWindowTargets(port, request, triedIdSet);
        if (found.length > 0) {
            return { target: found[0] };
        }
        if (Date.now() >= deadline) {
            return {
                isError: true,
                reason:
                    "The note's window did not open. Ask the person to open " +
                    'the note with Open on its row in the Bible Notes panel.',
            };
        }
        await sleep(NOTE_WINDOW_POLL_MS);
    }
}

/**
 * The request answered by the note's own window: an open one of its
 * address that says it shows that note, else one opened for it.
 */
async function runNoteWorker(request) {
    const port = await requireLivePort();
    const triedIdSet = new Set();
    let isOpened = false;
    for (;;) {
        let [target] = await findNoteWindowTargets(port, request, triedIdSet);
        if (target === undefined) {
            if (isOpened) {
                return {
                    isError: true,
                    reason:
                        'No window of this note would take the request. Ask ' +
                        'the person to close the note windows of that name ' +
                        'and open the note with Open on its row.',
                };
            }
            const opened = await openNoteWindow(port, request, triedIdSet);
            if (opened.isError === true) {
                return opened;
            }
            isOpened = true;
            target = opened.target;
        }
        triedIdSet.add(target.id);
        if (!(await waitForNoteWindowReady(target))) {
            return {
                isError: true,
                reason:
                    "The note's window is still opening. Try again in a " +
                    'moment.',
            };
        }
        const value = await evaluateInTarget(
            target,
            genAgentDataExpression(
                'note-edit',
                request,
                NOTE_WORKER_TIMEOUT_MS,
            ),
            NOTE_WORKER_TIMEOUT_MS + 5000,
        );
        if (value === null || typeof value !== 'object') {
            return { isError: true, reason: 'The app did not answer.' };
        }
        // Another folder's note of the same file name: the next window.
        if (value.code === NOTE_WINDOW_OTHER_CODE) {
            continue;
        }
        return value;
    }
}

function toTextResult(value) {
    return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

function toErrorResult(error) {
    return {
        isError: true,
        content: [{ type: 'text', text: String(error?.message ?? error) }],
    };
}

export const NOTE_EDIT_DESCRIPTION =
    "Change the user's Bible note attached here, in its own window as the " +
    'person sees it. `note`: its name as ' +
    'attached. `read` gives its numbered blocks (n, kind, text), `hash` and ' +
    "`fonts` (the font box's); `from` reads on. `edit` makes every change " +
    'in ONE call (give `hash`), `changes`: {block, text?, kind?, checked?} ' +
    'changes block n -- with a list kind or kind section and its words as ' +
    'lines it becomes a block a line; {block, remove: true} removes it; ' +
    '{block, after} moves ' +
    'it (0 = top); {after, kind, text} adds one; kind section adds many, ' +
    'a block a line of mark-up (# heading, - item, 1. item, > quote, ' +
    '---). Added kinds include the ' +
    "editor's Insert menu: table (a line a row, cells between |, first row " +
    'the headings), columns (between |), collapsible (a title line, then its ' +
    'lines), page-break, equation (KaTeX), sticky (`color` yellow, pink, ' +
    'blue, mint, lavender, peach or sage), date (today or YYYY-MM-DD), poll ' +
    '(the question, then a line a choice), video (YouTube link), website, ' +
    'media (a link or a path), drawing (a line a box, "A -> B" an arrow, a ' +
    'first line "layout: across" / "circle" / "center"; background fills ' +
    'its boxes, color its lines; one in the note takes new lines, size ' +
    'larger/smaller, align), ' +
    "example (the editor's sample note), passage (`ref`). The toolbar, on a " +
    'block or, with `words`, only those words in it: size ("larger", ' +
    '"smaller", px 8-72), font, color and background (a colour, or "none"), ' +
    'styles / stylesOff (bold, italic, underline, strikethrough, code, ' +
    'subscript, superscript, highlight, lowercase, uppercase, capitalize), ' +
    'clear: true (Clear Formatting), align (left, center, right, justify, ' +
    'start, end, none), indent ("more", "less" or 0-10; a list item nests), ' +
    "a code block's language and theme, linkTo: n (Link block text, to " +
    'block n or its `linkToWords`; `linkKind` direction-to …). `undo` / ' +
    "`redo` step the note's kept history; `view` with invisibleCharacters " +
    'true/false is the ¶. `title` renames. Words: **bold**, *italic*, ' +
    '__underline__, ~~strike~~, `code`, [words](url); keep [^…] [@…] [#…] ' +
    'tokens as read; a verse token names its Bible, [^(KJV) John 3:16]; a ' +
    'new one is a verse the app reads from the Bible it names (else `bible`, ' +
    "else the lookup's) -- [^(KJV) Hebrews 11:1] in place of a chip moves it " +
    'to the KJV; the summary says which Bible each new verse came from. A new ' +
    '[@Name] / [#Place] a mention from the names lookup -- never write verse ' +
    'words yourself. A fixed block (table, picture, passage, sticky …) is ' +
    "never given words, a drawing's lines aside. Changes stay UNSAVED for " +
    'Save in the note window; ' +
    'owa_undo puts each back.';

/**
 * One call: the app reads, changes and writes. Exported for the tests, which
 * hand it a stand-in for the app.
 */
export async function runNoteEdit(args, runWorker = runNoteWorker) {
    const target = toNoteEditTarget(args?.file, args?.id);
    if (target.reason !== undefined) {
        return toErrorResult(new Error(target.reason));
    }
    const action = args?.action;
    if (!NOTE_EDIT_ACTIONS.includes(action)) {
        return toErrorResult(
            new Error(`\`action\` is one of ${NOTE_EDIT_ACTIONS.join(', ')}.`),
        );
    }
    const request = {
        action,
        filePath: target.filePath,
        noteId: target.noteId,
    };
    for (const key of [
        'from',
        'hash',
        'title',
        'bible',
        'changes',
        'invisibleCharacters',
    ]) {
        if (args?.[key] !== undefined) {
            request[key] = args[key];
        }
    }
    // Always the note's own window: a `page` given is not where a note is.
    const value = await runWorker(request);
    if (value.isError === true) {
        return toErrorResult(
            new Error(value.reason ?? 'The note could not be read.'),
        );
    }
    // An edit's answer carries `name`, `isChanged` and `undoId`, which the
    // window reads (`readEditedLyric`): the button that puts it back.
    return toTextResult(value);
}

const NOTE_CHANGE_SCHEMA = z.object({
    block: z.number().int().min(1).optional(),
    after: z.number().int().min(0).optional(),
    kind: z.enum(NOTE_EDIT_KINDS).optional(),
    text: z.string().max(20000).optional(),
    checked: z.boolean().optional(),
    remove: z.boolean().optional(),
    // An add whose words another block has: on purpose (BN-44). Taught by
    // the refusal that names the twin, not by the description.
    again: z.boolean().optional(),
    ref: z.string().max(200).optional(),
    size: z
        .union([z.number().min(8).max(72), z.enum(['larger', 'smaller'])])
        .optional(),
    // The toolbar: names and colours are checked by the app, which says
    // what it takes -- a schema enum would be paid for on every round.
    words: z.string().max(500).optional(),
    font: z.string().max(80).optional(),
    color: z.string().max(40).optional(),
    background: z.string().max(40).optional(),
    styles: z.array(z.string().max(20)).max(11).optional(),
    stylesOff: z.array(z.string().max(20)).max(11).optional(),
    clear: z.boolean().optional(),
    align: z.string().max(10).optional(),
    indent: z
        .union([z.number().int().min(0).max(10), z.enum(['more', 'less'])])
        .optional(),
    language: z.string().max(20).optional(),
    theme: z.string().max(30).optional(),
    linkTo: z.number().int().min(1).optional(),
    linkToWords: z.string().max(500).optional(),
    linkKind: z.string().max(30).optional(),
});

export function registerNoteEditTool(server) {
    server.registerTool(
        NOTE_EDIT_TOOL_NAME,
        {
            description: NOTE_EDIT_DESCRIPTION,
            inputSchema: {
                note: z.string().max(400).optional(),
                file: z.string().max(4096).optional(),
                id: z.number().int().min(0).optional(),
                action: z.enum(NOTE_EDIT_ACTIONS),
                from: z.number().int().min(1).optional(),
                hash: z.string().max(40).optional(),
                title: z.string().max(200).optional(),
                bible: z.string().max(40).optional(),
                changes: z.array(NOTE_CHANGE_SCHEMA).max(200).optional(),
                invisibleCharacters: z.boolean().optional(),
                page: z.string().optional(),
            },
        },
        async (args) => {
            try {
                return await runNoteEdit(args);
            } catch (error) {
                return toErrorResult(error);
            }
        },
    );
}
