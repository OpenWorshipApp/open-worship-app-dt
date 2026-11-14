// `owa_screen_edit`: the screens' own controls, changed by the help window's
// assistant the way a Mini Screen card and the Bible text panel change them
// (2026-11-13, the user: _chatbot is very smart to help user control screen_
// -- the size, colour or style of the Bible showing, another version added to
// it, a transition, the display checked, screens grouped, _everything in
// screen control_).
//
// Measured first through the help window on a scratch profile
// (`.claude/skills/owa-enhance-chatbot/references/screen-asks.json`, 27
// asks): not one of the 23 asks to change something was done -- every one
// was answered with the panel's steps, nine of them wrong (EC-611).
//
// The rules are the app's (`src/helper/agentScreenControlHelpers.ts` and the
// pure `agentScreenControlRules.ts`): each control is changed through the
// setter its card presses, everything asked is checked before anything
// changes, and every change is backed up -- the screens are read before and
// after and what differs is what `owa_undo` puts back.
//
// Offered to the chatbot's model only in a SCREEN conversation
// (`MODEL_ON_ASK_TOOL_MAP`, kind `screen`), so the ordinary list and its
// ratchet did not move.

import { zod as z } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { evaluateInApp, listTargets, requireLivePort } from './cdp.mjs';
import { formatForegroundResult } from './agentForeground.mjs';

export const SCREEN_EDIT_TOOL_NAME = 'owa_screen_edit';

// Held in step with the app's worker (`AGENT_SCREEN_SELECT_LIST`,
// `AGENT_SCREEN_CLEAR_LIST`, `AGENT_SCREEN_EDIT_FIELD_LIST`); a test holds
// them together.
export const SCREEN_EDIT_ACTIONS = ['read', 'set'];
export const SCREEN_EDIT_SELECTS = ['only', 'add', 'remove', 'all'];
export const SCREEN_EDIT_CLEARS = [
    'bible',
    'slide',
    'background',
    'foreground',
    'all',
];
export const SCREEN_EDIT_FIELDS = [
    'style',
    'versions',
    'lineSync',
    'transition',
    'display',
    'group',
    'lock',
    'select',
    'stage',
    'show',
    'clear',
    'newScreen',
];

export const SCREEN_EDIT_DESCRIPTION =
    "The screens' own controls, as each Mini Screen card and the Bible " +
    'text panel set them. action "read": per screen on/off, ticked, ' +
    'locked, group, stage, display, transitions, Line Sync and what it ' +
    'shows; the Bible text style; the displays; the installed Bibles. ' +
    'action "set" (taken when a field is sent), many fields in one ' +
    'call: `style` -- the Bible text on EVERY screen: size ' +
    '("larger"|"smaller"|px|"default"), color, bold, italic, shadow ' +
    '(true|"soft"|"deep"|"hard"|false), outline (true|"thin"|"thick"|' +
    "false), outlineColor, glow, glowColor, look (one of read's looks), " +
    'align (left|center|right|justify), lineHeight and letterSpacing ' +
    '("tighter"|"looser"|number), font, backdrop (dark|light), highlight, ' +
    'reset; `versions` {add, remove}: Bibles of the passage up, by key, ' +
    'title or language; `lineSync` (versions lined up verse by verse); ' +
    '`transition` {slide, background, foreground}: none|fade|move|zoom; ' +
    '`display` by name or id; `group` true (the screens named together: ' +
    'grouped screens show the same) | a colour | false; `lock`; `select` ' +
    'only|add|remove|all (what is put up goes to the ticked screens); ' +
    '`stage`; `show` (the screen on or off -- only when asked to turn one ' +
    'on or off); `clear` bible|slide|background|foreground|all; ' +
    '`newScreen` true ALONE adds a screen, off and unticked (the answer ' +
    'names its number). ' +
    '`screens`: the ones they named, else leave it out for the ticked ' +
    'ones. Every change keeps a backup owa_undo puts back. Do only what ' +
    'was asked.';

const STYLE_SCHEMA = z
    .looseObject({
        size: z.union([z.string().max(40), z.number()]).optional(),
        color: z.string().max(40).optional(),
    })
    .describe(
        'The Bible text look in words; the description names each field.',
    );

// One name is a list of one: `versions: {add: "KJV"}` was sent as often as
// the list (EC-615). A preprocess, so the schema the model is sent is the
// list's alone and costs nothing more.
const NAME_LIST_SCHEMA = z
    .preprocess(
        (value) => {
            return typeof value === 'string' ? [value] : value;
        },
        z.array(z.string().max(80)).max(6),
    )
    .optional();

const TRANSITION_WORD_SCHEMA = z.string().max(20).optional();

// A group named by its screens: _Group screen 0 and screen 1 together_ was
// sent as `group: [0, 1]` six times running, each refused (2026-11-14).
// The list rides as its numbers in words, which `toScreenEditArgs` reads
// back as those screens grouped; a preprocess, so the schema the model is
// sent stays `boolean | colour` and costs nothing more.
const GROUP_SCHEMA = z
    .preprocess(
        (value) => {
            return Array.isArray(value) ? value.join(',') : value;
        },
        z.union([z.boolean(), z.string().max(30)]),
    )
    .optional();

const SCREEN_NUMBER_LIST_PATTERN = /^\s*\d{1,2}(?:\s*[,\s]\s*\d{1,2})*\s*$/;

/** The screens a `group` names by number, else null (a colour, a flag). */
function toGroupScreenList(group) {
    if (Array.isArray(group)) {
        const list = group.map(Number);
        return list.length > 0 &&
            list.every((id) => {
                return Number.isInteger(id) && id >= 0;
            })
            ? list
            : null;
    }
    if (typeof group === 'string' && SCREEN_NUMBER_LIST_PATTERN.test(group)) {
        return group
            .trim()
            .split(/[,\s]+/)
            .map(Number);
    }
    return null;
}

/**
 * The page half: a dependency-free expression that asks the app's worker
 * over the DOM event relay (`owa-agent-screen-edit` in `domHelpers.ts`) and
 * waits for its answer.
 */
export function genScreenEditExpression(request) {
    const payload = JSON.stringify(request ?? {});
    return `(() => {
        const request = Object.assign(${payload}, {
            token: Math.random().toString(36).slice(2),
        });
        return new Promise((resolve, reject) => {
            const onAnswer = (event) => {
                const detail = (event && event.detail) || {};
                if (detail.token !== request.token) {
                    return;
                }
                clearTimeout(timer);
                document.removeEventListener('owa-agent-screen-edit-answer', onAnswer);
                resolve(detail.result);
            };
            const timer = setTimeout(() => {
                document.removeEventListener('owa-agent-screen-edit-answer', onAnswer);
                reject(new Error(
                    'This window did not answer. The screens are changed ' +
                    'from the Presenter page.'
                ));
            }, 25000);
            document.addEventListener('owa-agent-screen-edit-answer', onAnswer);
            document.dispatchEvent(
                new CustomEvent('owa-agent-screen-edit', { detail: request }),
            );
        });
    })()`;
}

function toTextResult(text) {
    return { content: [{ type: 'text', text }] };
}

function toErrorResult(error) {
    return {
        isError: true,
        content: [{ type: 'text', text: String(error?.message ?? error) }],
    };
}

async function runScreenWorker(request) {
    // The Presenter page's alone: it holds the screens. Without it the main
    // window answers that it is not there.
    const port = await requireLivePort();
    const targets = await listTargets(port);
    const hasPresenter = targets.some((target) => {
        return target.url.includes('presenter.html');
    });
    const { value } = await evaluateInApp(genScreenEditExpression(request), {
        port,
        match: hasPresenter ? 'presenter.html' : undefined,
        // A version added reads the passage from the disk.
        timeout: 30000,
    });
    return value;
}

function checkIsPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A call as the model meant it (2026-11-14, EC-615). Through the help
 * window, the shared gemma4:cloud left `action` out of 83 of the 96
 * changes it sent in its first run -- `{"screens": [0], "style": {"size":
 * "larger"}}`, refused for the missing action up to six times running --
 * and eight of the 23 asks for a change ran out of rounds with nothing
 * changed. So a call that names no action is a `set` when it sends a field to change,
 * else a `read`; a `style` sent as a list of looks is one look; a Bible
 * named alone in `versions` is a list of one; a `group` naming screens by
 * number is those screens grouped, added to `screens`. An action it does
 * name is kept, to be refused when it is not one of the two.
 */
export function toScreenEditArgs(args) {
    const read = checkIsPlainObject(args) ? { ...args } : {};
    if (read.action === undefined) {
        read.action = SCREEN_EDIT_FIELDS.some((field) => {
            return read[field] !== undefined;
        })
            ? 'set'
            : 'read';
    }
    if (Array.isArray(read.style)) {
        read.style = Object.assign(
            {},
            ...read.style.filter(checkIsPlainObject),
        );
    }
    if (checkIsPlainObject(read.versions)) {
        const versions = { ...read.versions };
        for (const key of ['add', 'remove']) {
            if (typeof versions[key] === 'string') {
                versions[key] = [versions[key]];
            }
        }
        read.versions = versions;
    }
    const groupScreens = toGroupScreenList(read.group);
    if (groupScreens !== null) {
        const named = Array.isArray(read.screens) ? read.screens : [];
        read.group = true;
        read.screens = [...new Set([...named, ...groupScreens])].sort(
            (a, b) => {
                return a - b;
            },
        );
    }
    return read;
}

/**
 * One call: the app reads or changes the screens and answers. Exported for
 * the tests, which hand it a stand-in for the app.
 */
export async function runScreenEdit(args, runWorker = runScreenWorker) {
    const meant = toScreenEditArgs(args);
    const action = meant.action;
    if (!SCREEN_EDIT_ACTIONS.includes(action)) {
        return toErrorResult(
            new Error(
                `\`action\` is one of ${SCREEN_EDIT_ACTIONS.join(', ')}.`,
            ),
        );
    }
    const request = { action };
    for (const key of ['screens', ...SCREEN_EDIT_FIELDS]) {
        if (meant[key] !== undefined) {
            request[key] = meant[key];
        }
    }
    const formatted = formatForegroundResult(await runWorker(request));
    return formatted.isError
        ? toErrorResult(new Error(formatted.text))
        : toTextResult(formatted.text);
}

export function registerScreenEditTool(server) {
    server.registerTool(
        SCREEN_EDIT_TOOL_NAME,
        {
            description: SCREEN_EDIT_DESCRIPTION,
            inputSchema: {
                // Optional, and a list of looks is one look
                // (`toScreenEditArgs`, EC-615).
                action: z.enum(SCREEN_EDIT_ACTIONS).optional(),
                screens: z.array(z.number().int().min(0)).max(20).optional(),
                style: z
                    .preprocess((value) => {
                        return toScreenEditArgs({ style: value }).style;
                    }, STYLE_SCHEMA)
                    .optional(),
                versions: z
                    .object({ add: NAME_LIST_SCHEMA, remove: NAME_LIST_SCHEMA })
                    .optional(),
                lineSync: z.boolean().optional(),
                transition: z
                    .union([
                        z.string().max(20),
                        z.object({
                            slide: TRANSITION_WORD_SCHEMA,
                            background: TRANSITION_WORD_SCHEMA,
                            foreground: TRANSITION_WORD_SCHEMA,
                        }),
                    ])
                    .optional(),
                display: z
                    .union([z.string().max(80), z.number().int()])
                    .optional(),
                group: GROUP_SCHEMA,
                lock: z.boolean().optional(),
                select: z.enum(SCREEN_EDIT_SELECTS).optional(),
                stage: z.number().int().min(0).max(99).optional(),
                show: z.boolean().optional(),
                clear: z.enum(SCREEN_EDIT_CLEARS).optional(),
                newScreen: z.boolean().optional(),
            },
        },
        async (args) => {
            try {
                return await runScreenEdit(args);
            } catch (error) {
                return toErrorResult(error);
            }
        },
    );
}
