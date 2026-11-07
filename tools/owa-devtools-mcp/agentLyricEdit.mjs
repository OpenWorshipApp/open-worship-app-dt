// `owa_lyric_edit`: a song changed part by part -- a section added, its words
// changed or translated, chords added or moved to another key -- from WORDS
// the caller gives. The change itself is `openLyricEdit.mjs` (pure, tested
// without an app); this is the tool around it:
//
//   1. the app reads the song's editing head (`owa-agent-file`, `read`) --
//      what the person sees, unsaved edits and all -- with a `hash`;
//   2. the change is made HERE, in node, and checked by the validator;
//   3. the app writes it back into the editing history (`update` with that
//      `hash`), backed up first, left unsaved for the person to Save -- and
//      refused if the song changed in between.
//
// Offered to the chatbot's model only in a conversation about an ATTACHED
// song (`MODEL_ON_ASK_TOOL_MAP`, kind `lyric`), where the window puts the
// attached file's own path in `file` (`src/chatbot/lyricChatHelpers.ts`): a
// model names the song, never a path. An outside agent over stdio may give a
// whole `.owl` path; the app checks it again at the disk.

import { zod as z } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { evaluateInApp } from './cdp.mjs';
import { genAgentFileExpression } from './agentFile.mjs';
import { checkAgentFileName } from './agentFileName.mjs';
import {
    LYRIC_EDIT_ACTIONS,
    applyLyricEdit,
    describeLyricDocument,
} from './openLyricEdit.mjs';

export const LYRIC_EDIT_TOOL_NAME = 'owa_lyric_edit';

// A whole path: a drive (`C:\` / `C:/`), a share (`\\server`) or a root.
const ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/;
const LYRIC_EXTENSION_PATTERN = /\.owl$/i;

/**
 * What `file` names: `{filePath}` for a whole path, `{name}` for a song in the
 * Documents folder (a trailing `.owl` dropped), or `{reason}` when it is
 * neither.
 */
export function toLyricEditTarget(file) {
    const text = typeof file === 'string' ? file.trim() : '';
    if (text === '') {
        return {
            reason:
                'Name the song (`file`): as it is attached, or as it reads in ' +
                'the Documents list.',
        };
    }
    if (ABSOLUTE_PATH_PATTERN.test(text)) {
        if (!LYRIC_EXTENSION_PATTERN.test(text)) {
            return { reason: 'Only a song file (.owl) can be changed here.' };
        }
        if (
            text.split(/[\\/]/).some((part) => {
                return part === '..';
            })
        ) {
            return {
                reason: 'A song path may not step out of its folder with "..".',
            };
        }
        return { filePath: text };
    }
    const name = text.replace(LYRIC_EXTENSION_PATTERN, '');
    const nameReason = checkAgentFileName(name);
    return nameReason === null ? { name } : { reason: nameReason };
}

async function runLyricWorker(request, page) {
    const { value } = await evaluateInApp(
        genAgentFileExpression({ kind: 'lyric', ...request }),
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

export const LYRIC_EDIT_DESCRIPTION =
    "Change one of the user's songs part by part. You give WORDS; the app " +
    'writes the song notation and refuses a change that would break it. ' +
    '`file`: the song as attached, or its name in Documents. `read` first: ' +
    'its parts and lines. `set-lines` replaces the words of `sections` ' +
    '[{part, lines}] (also how a song is translated in place); ' +
    '`add-translation` puts one translation line under each sung line ' +
    '(exactly one per line, "" to skip); both take `config` too, for a ' +
    "translation's Title and Subtitle; `set-chords` gives the same words " +
    'with [G] chords in them; `add-section` adds `part` ("Verse" takes the ' +
    'next number; "Note" is a note for the band, never on the screen) with ' +
    '`lines`, played after `after` (else at the end); `remove-section`; ' +
    '`set-order` ' +
    '["Verse 1", "Chorus x2"]; `set-config` Title Subtitle Artist Copyright ' +
    'Key Tempo Time; `transpose` moves every chord to `key` (`fromKey` when the ' +
    'song has none). `locales` (e.g. ["en-US","es-ES"]) names its ' +
    'languages. Every change stays UNSAVED (a * beside the name, Ctrl+Z ' +
    'undoes it) for the user to Save and keeps a backup owa_undo puts back ' +
    '-- say so. Change only what was asked.';

/**
 * One call: read, change, check, write. Exported for the tests, which hand
 * it a stand-in for the app.
 */
export async function runLyricEdit(args, runWorker = runLyricWorker) {
    const target = toLyricEditTarget(args?.file);
    if (target.reason !== undefined) {
        return toErrorResult(new Error(target.reason));
    }
    const read = await runWorker({ action: 'read', ...target }, args?.page);
    if (read.isError === true) {
        return toErrorResult(new Error(read.reason ?? 'It could not be read.'));
    }
    if (typeof read.content !== 'string') {
        return toErrorResult(new Error('The song could not be read.'));
    }
    if (args?.action === 'read') {
        return toTextResult({
            name: read.name,
            hasUnsavedChanges: read.hasUnsavedChanges === true,
            ...describeLyricDocument(read.content),
        });
    }
    const edited = applyLyricEdit(read.content, args);
    if (edited.isError) {
        return toErrorResult(new Error(edited.reason));
    }
    if (!edited.isChanged) {
        return toTextResult({
            name: read.name,
            isChanged: false,
            note: 'The song already reads that way; nothing was written.',
            ...(edited.warnings.length > 0
                ? { warnings: edited.warnings }
                : {}),
        });
    }
    const written = await runWorker(
        {
            action: 'update',
            filePath: read.filePath,
            content: edited.content,
            expectedHash: read.hash,
            summary: edited.changes.join('; '),
        },
        args?.page,
    );
    if (written.isError === true) {
        return toErrorResult(
            new Error(written.reason ?? 'The change could not be written.'),
        );
    }
    const now = describeLyricDocument(edited.content);
    return toTextResult({
        name: read.name,
        isChanged: true,
        changed: edited.changes,
        ...(edited.warnings.length > 0 ? { warnings: edited.warnings } : {}),
        playOrder: now.playOrder,
        parts: now.parts.map((one) => {
            return one.part;
        }),
        isSaved: false,
        ...(written.undoId === undefined ? {} : { undoId: written.undoId }),
        note: written.note,
    });
}

export function registerLyricEditTool(server) {
    server.registerTool(
        LYRIC_EDIT_TOOL_NAME,
        {
            description: LYRIC_EDIT_DESCRIPTION,
            inputSchema: {
                file: z.string().max(400),
                action: z.enum(LYRIC_EDIT_ACTIONS),
                sections: z
                    .array(
                        z.object({
                            part: z.string(),
                            lines: z.array(z.string()),
                        }),
                    )
                    .max(40)
                    .optional(),
                part: z.string().optional(),
                lines: z.array(z.string()).max(120).optional(),
                after: z.string().optional(),
                order: z.array(z.string()).max(60).optional(),
                config: z.record(z.string()).optional(),
                key: z.string().optional(),
                fromKey: z.string().optional(),
                locales: z.array(z.string()).max(12).optional(),
                page: z.string().optional(),
            },
        },
        async (args) => {
            try {
                return await runLyricEdit(args);
            } catch (error) {
                return toErrorResult(error);
            }
        },
    );
}
