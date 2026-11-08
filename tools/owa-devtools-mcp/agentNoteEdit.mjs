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
// Offered to the chatbot's model only in a conversation about an attached
// note (`MODEL_ON_ASK_TOOL_MAP`, kind `note`), where the WINDOW turns the
// note's name into its file and id (`src/chatbot/noteChatHelpers.ts`): a
// model names the note, never a path. An outside agent over stdio gives
// `file` (a whole `.own` path) and `id`; the app checks both again.

import { zod as z } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { evaluateInApp } from './cdp.mjs';
import { genAgentDataExpression } from './agentData.mjs';

export const NOTE_EDIT_TOOL_NAME = 'owa_note_edit';

export const NOTE_EDIT_ACTIONS = ['read', 'edit'];

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

async function runNoteWorker(request, page) {
    const { value } = await evaluateInApp(
        genAgentDataExpression('note-edit', request),
        { match: page },
    );
    if (value === null || typeof value !== 'object') {
        return { isError: true, reason: 'The app did not answer.' };
    }
    return value;
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
    "Change the user's Bible note attached here. `note`: its name as " +
    'attached. `read` gives its numbered blocks (n, kind, text) and `hash`; ' +
    '`from` reads on. `edit` makes every change in ONE call (give `hash`): ' +
    '`changes` [{block, text?, kind?, checked?, size?}] changes block n ' +
    '(`size`: "larger", "smaller" or px 8-72, its text size); {block, ' +
    'remove: true} removes it; {block, after} moves it after block `after` ' +
    '(0 = top); {after, kind?, text} adds a block (`passage` takes `ref`, a ' +
    'Bible reference). `title` renames the note. Words: **bold**, *italic*, ' +
    '__underline__, ~~strike~~, `code`, [words](url), a line break as a real ' +
    'one; keep [^…] [@…] [#…] tokens as they are; a new [^John 3:16] is a ' +
    "verse the app looks up (in `bible`, else the lookup's) -- never write " +
    'verse words yourself. A fixed block (table, picture, drawing, sticky, ' +
    'passage, rule) can only move or go. Changes stay UNSAVED for the user ' +
    'to Save in the note window; owa_undo puts each back.';

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
    for (const key of ['from', 'hash', 'title', 'bible', 'changes']) {
        if (args?.[key] !== undefined) {
            request[key] = args[key];
        }
    }
    const value = await runWorker(request, args?.page);
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
    ref: z.string().max(200).optional(),
    size: z
        .union([z.number().min(8).max(72), z.enum(['larger', 'smaller'])])
        .optional(),
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
