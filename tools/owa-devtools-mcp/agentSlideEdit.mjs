// `owa_slide_edit`: one of the user's slide documents changed by the help
// window's assistant -- its words changed or translated, its boxes restyled,
// slides added after a picture of the ones wanted, copied, moved or removed
// (2026-11-07, the user, with a Documents row's menu open on **Open in
// Chatbot**: _like lyric, add `Open in Chatbot` for AppDocument to let
// chatbot help modify slides_, then _chatbot be the best choice to help
// modify appdocument slides_ and _when user attach a screenshot of example
// slides they want … chatbot should be able to make slides for them_).
//
// The rules are the app's (`src/helper/agentSlideHelpers.ts`, pure, and the
// worker in `agentFileHelpers.ts`): the HEAD is read, every box written is
// checked by the canvas classes, the whole change is backed up and goes into
// the editing history as ONE entry, unsaved. What this tool adds over
// `owa_slide_file`'s slide actions is what a whole-document job needs:
//
//   - `slides` reads every box's words WHOLE (a verse cut at 300 characters
//     cannot be translated);
//   - `update-slides` and `add-slides` change or add MANY slides in one call
//     and one Ctrl+Z -- a translation was one `update-slide` a slide, twelve
//     rounds for a twelve-slide sermon, past every round cap;
//   - `file` takes the document as the help window ATTACHED it, by its whole
//     path, wherever it lives;
//   - `set-background` puts a colour, or a picture or video of the
//     Background panel by name, behind many slides at once (the slide's
//     attached background, `agentSlideBackgroundHelpers.ts`) -- a picture of
//     slides the user liked has a photo behind its words, and no box can be
//     one. `slides` lists what the panel holds.
//
// Offered to the chatbot's model only in a conversation about an attached
// slide document (`MODEL_ON_ASK_TOOL_MAP`, kind `slide`), where the window
// puts the attached file's own path in `file` (`src/chatbot/
// slideChatHelpers.ts`): a model names the document, never a path. An outside
// agent over stdio may give a whole `.ows` path; the app checks it again at
// the disk. `owa_slide_file` stays as it was, for the ordinary question.

import { zod as z } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { evaluateInApp } from './cdp.mjs';
import { genAgentFileExpression } from './agentFile.mjs';
import { checkAgentFileName } from './agentFileName.mjs';

export const SLIDE_EDIT_TOOL_NAME = 'owa_slide_edit';

export const SLIDE_EDIT_ACTIONS = [
    'slides',
    'update-slides',
    'add-slides',
    'update-slide',
    'add-slide',
    'delete-slide',
    'duplicate-slide',
    'move-slide',
    'set-background',
];

// A whole path: a drive (`C:\` / `C:/`), a share (`\\server`) or a root.
const ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/;
const SLIDE_EXTENSION_PATTERN = /\.ows$/i;

/**
 * What `file` names: `{filePath, name}` for a whole path, `{name}` for a
 * slide document in the Documents folder (a trailing `.ows` dropped), or
 * `{reason}` when it is neither.
 */
export function toSlideEditTarget(file) {
    const text = typeof file === 'string' ? file.trim() : '';
    if (text === '') {
        return {
            reason:
                'Name the slide document (`file`): as it is attached, or as ' +
                'it reads in the Documents list.',
        };
    }
    if (ABSOLUTE_PATH_PATTERN.test(text)) {
        if (!SLIDE_EXTENSION_PATTERN.test(text)) {
            return {
                reason: 'Only a slide document (.ows) can be changed here.',
            };
        }
        if (
            text.split(/[\\/]/).some((part) => {
                return part === '..';
            })
        ) {
            return {
                reason:
                    'A slide document path may not step out of its folder ' +
                    'with "..".',
            };
        }
        const name = (text.split(/[\\/]/).pop() ?? '').replace(
            SLIDE_EXTENSION_PATTERN,
            '',
        );
        return { filePath: text, name };
    }
    const name = text.replace(SLIDE_EXTENSION_PATTERN, '');
    const nameReason = checkAgentFileName(name);
    return nameReason === null ? { name } : { reason: nameReason };
}

async function runSlideWorker(request, page) {
    const { value } = await evaluateInApp(
        genAgentFileExpression({ kind: 'slide', ...request }),
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

export const SLIDE_EDIT_DESCRIPTION =
    "Change one of the user's slide documents. `file`: the document as " +
    'attached, or its name in Documents. `slides` reads every slide: its ' +
    'boxes with id, words, position and style, in pixels on a slide of ' +
    '`width` x `height`. `update-slides` changes MANY slides in one call: ' +
    '`changes` [{slide, items}]; an item with `id` edits that box (text, ' +
    'fontSize, fontFamily, fontWeight, color, backgroundColor, align ' +
    'left|center|right, valign top|center|bottom, left, top, width, height, ' +
    'rotate, round (corner rounding); `remove`: true takes it off), one ' +
    'without `id` adds a text box. ' +
    '`add-slides` adds new slides in one call: `changes` [{items}] (`slide`: ' +
    'where it goes, else at the end), each item a new text box, listed back ' +
    'to front -- a box filling the slide with a backgroundColor and no text ' +
    'is its background. `update-slide` / `add-slide` take `slide` and ' +
    '`items` for one slide; `delete-slide` and `duplicate-slide` `slide`; ' +
    '`move-slide` `slide` and `to`. `set-background` puts `background` (a ' +
    'color, a name from `backgroundChoices`, or "none") behind `slides` ' +
    '(numbers; all when left out): kept at once, no Save. Colors #RRGGBB or ' +
    '#RRGGBBAA. Every other change stays UNSAVED (a * beside the name, ' +
    'Ctrl+Z undoes it) for the user to Save; each keeps a backup owa_undo ' +
    'puts back -- say so. Change only what was asked.';

/**
 * One call: the app reads, changes, checks and writes. Exported for the
 * tests, which hand it a stand-in for the app.
 */
export async function runSlideEdit(args, runWorker = runSlideWorker) {
    const target = toSlideEditTarget(args?.file);
    if (target.reason !== undefined) {
        return toErrorResult(new Error(target.reason));
    }
    const action = args?.action;
    if (!SLIDE_EDIT_ACTIONS.includes(action)) {
        return toErrorResult(
            new Error(`\`action\` is one of ${SLIDE_EDIT_ACTIONS.join(', ')}.`),
        );
    }
    const request = {
        action,
        ...(target.filePath === undefined
            ? { name: target.name }
            : { filePath: target.filePath }),
        ...(action === 'slides' ? { isFullText: true } : {}),
    };
    for (const key of [
        'slide',
        'to',
        'items',
        'changes',
        'background',
        'slides',
    ]) {
        if (args?.[key] !== undefined) {
            request[key] = args[key];
        }
    }
    const value = await runWorker(request, args?.page);
    if (value.isError === true) {
        return toErrorResult(
            new Error(value.reason ?? 'The slide document could not be read.'),
        );
    }
    if (action === 'slides') {
        return toTextResult(value);
    }
    // The window reads `name`, `isChanged` and `undoId` off this answer
    // (`readEditedLyric`): the button that puts the change back.
    const { didChange, ...rest } = value;
    return toTextResult({
        name: target.name,
        isChanged: didChange !== false,
        ...rest,
    });
}

const SLIDE_BOX_SCHEMA = z.object({
    id: z.number().int().optional(),
    text: z.string().optional(),
    remove: z.boolean().optional(),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
    fontWeight: z.string().optional(),
    color: z.string().optional(),
    backgroundColor: z.string().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    valign: z.enum(['top', 'center', 'bottom']).optional(),
    left: z.number().optional(),
    top: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    rotate: z.number().optional(),
    round: z.number().optional(),
});

export function registerSlideEditTool(server) {
    server.registerTool(
        SLIDE_EDIT_TOOL_NAME,
        {
            description: SLIDE_EDIT_DESCRIPTION,
            inputSchema: {
                file: z.string().max(400),
                action: z.enum(SLIDE_EDIT_ACTIONS),
                slide: z.number().int().min(1).optional(),
                to: z.number().int().min(1).optional(),
                items: z.array(SLIDE_BOX_SCHEMA).max(50).optional(),
                changes: z
                    .array(
                        z.object({
                            slide: z.number().int().min(1).optional(),
                            items: z.array(SLIDE_BOX_SCHEMA).max(50),
                        }),
                    )
                    .max(100)
                    .optional(),
                background: z.string().max(200).optional(),
                slides: z.array(z.number().int().min(1)).max(100).optional(),
                page: z.string().optional(),
            },
        },
        async (args) => {
            try {
                return await runSlideEdit(args);
            } catch (error) {
                return toErrorResult(error);
            }
        },
    );
}
