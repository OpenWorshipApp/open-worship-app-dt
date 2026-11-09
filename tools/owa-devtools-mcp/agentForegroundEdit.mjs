// `owa_foreground_edit`: any foreground component CHANGED by the help
// window's assistant -- a session's words and numbers, its look (size,
// colours, place, border, layer, blend, transition), a marquee's speed, a
// countdown's Start and Pause -- and whatever of it is on a screen changed
// with it (2026-11-09, the user: _chatbot can help modify any foreground
// component_, then, with a panel's sessions strip circled: _sessions of
// opening foreground component should be able to attached to the chatbot
// for the chat context_).
//
// The rules are the app's (`src/helper/agentForegroundHelpers.ts` and the
// pure `agentForegroundLookRules.ts`): a session is changed through the very
// settings its panel writes, so the open panel shows the change and its Show
// button puts up the same thing again; every change is backed up first, so
// the answer carries an `undoId` and the help window's **Undo this change**
// puts the panel and the look on the wall back.
//
// Offered to the chatbot's model only in a FOREGROUND conversation
// (`MODEL_ON_ASK_TOOL_MAP`, kind `foreground`): a foreground session
// attached to the chat, or a question that names a component. The ordinary
// question keeps `owa_foreground` (start, stop, check).

import { zod as z } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { evaluateInApp, listTargets, requireLivePort } from './cdp.mjs';
import {
    AGENT_FOREGROUND_WIDGETS,
    formatForegroundResult,
    genForegroundExpression,
} from './agentForeground.mjs';

export const FOREGROUND_EDIT_TOOL_NAME = 'owa_foreground_edit';

// Held in step with `AGENT_FOREGROUND_EDIT_ACTIONS` in the app's worker; a
// test holds the two together.
export const FOREGROUND_EDIT_ACTIONS = [
    'read',
    'set',
    'show',
    'hide',
    'timer',
    'session',
];

// Every component; `all` is `owa_foreground`'s stop alone.
export const FOREGROUND_EDIT_WIDGETS = AGENT_FOREGROUND_WIDGETS.filter(
    (widget) => {
        return widget !== 'all';
    },
);

export const FOREGROUND_TIMER_DOS = ['start', 'pause', 'resume', 'reset'];

export const FOREGROUND_EDIT_DESCRIPTION =
    'Change a foreground component through its own panel: a SESSION of ' +
    'it (a saved set-up: its words and its look). `session`: the one ' +
    "attached or named, else the panel's current one. `read` first: its " +
    'words, look in words and which screens hold it (`open: true` lists the ' +
    'open panels and their sessions). `set` changes the session -- its ' +
    'words (text | texts | ref, minutes | at, seconds, delay, interval, ' +
    'utcOffset | title | is24Hour, sound | volume, preset) and/or `look` ' +
    '{size ("larger"|"smaller"|px), color, background, blur, font, bold, ' +
    'position ("top", "bottom left"...), width %, scale, opacity, round, ' +
    'border, borderWidth, borderColor, shadow, textAlign, italic, ' +
    'underline, uppercase, padding, behind, onTop, blend, transition, ' +
    'speed} -- and what of it is on a screen changes at once. `show` puts ' +
    'the session up on the ticked screens (or `screens`), `hide` takes it ' +
    'off, `timer` start|pause|resume|reset a countdown or stopwatch on the ' +
    'wall, `session` makes a new one (`name`). A verse is `ref`, read from ' +
    'the installed Bible -- never write its words yourself. A field the ' +
    'component lacks is refused with what it takes. Every change keeps a ' +
    'backup owa_undo puts back. Do only what was asked; going UP changes ' +
    'what the congregation sees.';

const LOOK_SCHEMA = z
    .looseObject({
        size: z.union([z.string(), z.number()]).optional(),
        color: z.string().max(40).optional(),
        background: z.string().max(40).optional(),
        position: z.string().max(40).optional(),
    })
    .describe('The look in words; read the description for every field.');

function toTextResult(text) {
    return { content: [{ type: 'text', text }] };
}

function toErrorResult(error) {
    return {
        isError: true,
        content: [{ type: 'text', text: String(error?.message ?? error) }],
    };
}

async function runForegroundWorker(request) {
    // The Presenter page's alone, aimed the way `owa_foreground` aims: with
    // it open, whatever window is in front; without it the main window
    // answers that it is not there.
    const port = await requireLivePort();
    const targets = await listTargets(port);
    const hasPresenter = targets.some((target) => {
        return target.url.includes('presenter.html');
    });
    const { value } = await evaluateInApp(genForegroundExpression(request), {
        port,
        match: hasPresenter ? 'presenter.html' : undefined,
        // A Long Text Show of a long song, or a verse read cold, takes a
        // moment longer than a press.
        timeout: 30000,
    });
    return value;
}

const PASSED_KEY_LIST = [
    'widget',
    'session',
    'text',
    'texts',
    'ref',
    'version',
    'minutes',
    'at',
    'autoStart',
    'seconds',
    'delay',
    'interval',
    'utcOffset',
    'title',
    'is24Hour',
    'file',
    'camera',
    'source',
    'sound',
    'volume',
    'preset',
    'look',
    'timer',
    'screens',
    'open',
    'name',
];

/**
 * One call: the app reads or changes the component and answers. Exported for
 * the tests, which hand it a stand-in for the app.
 */
export async function runForegroundEdit(args, runWorker = runForegroundWorker) {
    const action = args?.action;
    if (!FOREGROUND_EDIT_ACTIONS.includes(action)) {
        return toErrorResult(
            new Error(
                `\`action\` is one of ${FOREGROUND_EDIT_ACTIONS.join(', ')}.`,
            ),
        );
    }
    const request = { action };
    for (const key of PASSED_KEY_LIST) {
        if (args?.[key] !== undefined) {
            request[key] = args[key];
        }
    }
    const formatted = formatForegroundResult(await runWorker(request));
    return formatted.isError
        ? toErrorResult(new Error(formatted.text))
        : toTextResult(formatted.text);
}

export function registerForegroundEditTool(server) {
    server.registerTool(
        FOREGROUND_EDIT_TOOL_NAME,
        {
            description: FOREGROUND_EDIT_DESCRIPTION,
            inputSchema: {
                action: z.enum(FOREGROUND_EDIT_ACTIONS),
                widget: z.enum(FOREGROUND_EDIT_WIDGETS).optional(),
                session: z.string().max(80).optional(),
                text: z.string().max(3000).optional(),
                texts: z.array(z.string().max(1000)).max(20).optional(),
                ref: z.string().max(120).optional(),
                version: z.string().max(60).optional(),
                minutes: z.number().positive().optional(),
                at: z.string().max(20).optional(),
                autoStart: z.boolean().optional(),
                seconds: z.number().positive().optional(),
                delay: z.number().min(0).optional(),
                interval: z.number().positive().optional(),
                utcOffset: z.number().optional(),
                title: z.string().max(40).optional(),
                is24Hour: z.boolean().optional(),
                file: z.string().max(200).optional(),
                camera: z.string().max(120).optional(),
                source: z.number().int().optional(),
                sound: z.boolean().optional(),
                volume: z.number().min(0).max(100).optional(),
                preset: z.string().max(30).optional(),
                look: LOOK_SCHEMA.optional(),
                timer: z.enum(FOREGROUND_TIMER_DOS).optional(),
                screens: z.array(z.number().int().min(0)).max(20).optional(),
                open: z.boolean().optional(),
                name: z.string().max(40).optional(),
            },
        },
        async (args) => {
            try {
                return await runForegroundEdit(args);
            } catch (error) {
                return toErrorResult(error);
            }
        },
    );
}
