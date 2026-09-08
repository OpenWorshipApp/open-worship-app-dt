/**
 * Built-in actions: things the help window can DO without asking a model.
 *
 * A volunteer standing in a back room thirty seconds before a service does
 * not want an assistant. They want the screen on. Measured against the
 * standing question corpus on 2026-09-02, "Turn off the screen for me" cost a
 * paid model two rounds and nine seconds to answer that nothing was showing --
 * and on the same afternoon two of the four providers answered NOTHING at all
 * (ChatGPT out of credit, the free pool rate-limited), so the same request
 * fell through to the offline bot, which reported the screen state and
 * offered no way to change it.
 *
 * So the ask box takes COMMANDS: a line starting with `/` is matched here,
 * run through the app's own MCP tools, and answered on the spot -- no model,
 * no key, no internet, a few hundred milliseconds. Typing `/` alone lists them
 * in the same suggestion list the questions use, so nobody has to remember one.
 *
 * Three rules hold for every command in the list:
 *
 * 1. **It reports what CHANGED, never what it pressed.** A screen command
 *    reads the screens back after the press (`owa_click` already does the
 *    same for the control), because "I pressed the button" to a room with
 *    nothing on the wall is the exact failure `EC-76` was about.
 * 2. **Typing the command IS the consent.** The prompt rule that anything
 *    changing what the congregation sees must be offered first is about the
 *    MODEL deciding to act; a person who typed `/screen-hide` has decided.
 *    Nothing here is ever run because a model chose it -- a command comes
 *    out of the ask box or off a button under one of these answers, and the
 *    button carries the command text, so the transcript shows it as if typed.
 * 3. **A tool's own error text never reaches the user.** Each command says in
 *    its own words what it could not do; the reason goes to the log.
 */

import type { BotFocusType } from '../../tools/owa-devtools-mcp/botFocus.d.mts';
import { BOT_FOCUS_LIST } from '../../tools/owa-devtools-mcp/botFocus.mjs';
import { appError } from '../helper/loggerHelpers';
import {
    BUILTIN_TOOL_NAME,
    answerFromManual,
    answerWhereIs,
    type BotActionType,
    type BotAnswerType,
} from './helpBotHelpers';
import { callTool, parseToolJson } from './mcpClient';
import {
    genProgressReporter,
    type BotProgressCallbackType,
} from './progressHelpers';

// The pseudo tool name a button under one of these answers carries -- see
// `helpBotHelpers`, which declares it. Caught in the window's `handleActing`
// exactly like the report's Send button: the server never registers it, so
// nothing outside this window -- no model, no agent -- can fire a command in
// the user's name. The button's `args.command` is the command line, asked as
// though typed.
export { BUILTIN_TOOL_NAME };

export type BuiltinActionType = {
    /** The word after the slash. Lower case, dashes, no spaces. */
    name: string;
    /** Other spellings that reach the same command, including the one the
     * user first asked for (`presenter-screen-show`). */
    aliases: string[];
    /** One line, shown beside the command in the suggestion list. */
    hint: string;
    /** Whether the command takes words after it (`/find Clear All`). */
    takesArgument: boolean;
    /** Whether it changes what the congregation sees. Said in the answer. */
    isActing: boolean;
    run: (context: BuiltinRunContextType) => Promise<BotAnswerType>;
};

export type BuiltinRunContextType = {
    argument: string;
    focus: BotFocusType;
    report: ReturnType<typeof genProgressReporter>;
};

const SCREEN_TOGGLE_LABEL = 'Toggle showing screen';

// The five clear buttons on every mini screen, by the words written on them.
// The label is what `owa_click` finds; the key is what the manual says beside
// it, so the answer can teach the shortcut for next time.
const CLEAR_MAP = {
    'clear-all': { label: 'Clear All', key: 'F6', what: 'everything' },
    'clear-background': {
        label: 'Clear Background',
        key: 'F7',
        what: 'the background',
    },
    'clear-slide': { label: 'Clear Slide', key: 'F8', what: 'the slide' },
    'clear-bible': { label: 'Clear Bible', key: 'F9', what: 'the Bible text' },
    'clear-foreground': {
        label: 'Clear Foreground',
        key: 'F10',
        what: 'the foreground (countdown, marquee, clock)',
    },
} as const;

// The pages `/goto` accepts, by the words a person would use for them.
const GOTO_MAP: Record<string, { page: string; label: string }> = {
    presenter: { page: 'presenter.html', label: 'Presenter' },
    reader: { page: 'reader.html', label: 'Bible Reader' },
    bible: { page: 'reader.html', label: 'Bible Reader' },
    editor: { page: 'appDocumentEditor.html', label: 'Document Editor' },
    slides: { page: 'appDocumentEditor.html', label: 'Document Editor' },
};

// How long a press is given to reach the screen before it is read back. The
// app re-renders on an event, so reading straight away reports the state
// before the press -- `owa_click` waits ~250ms for the control for the same
// reason; a whole screen window takes a little longer to come up.
const SCREEN_SETTLE_MS = 600;

type ScreenStateType = {
    isAnyShowing: boolean;
    showingScreenIds: number[];
    displayCount: number;
};

async function readScreens(): Promise<ScreenStateType | null> {
    const state = parseToolJson(await callTool('owa_list_screens'));
    if (state === null || state.error) {
        return null;
    }
    return {
        isAnyShowing: state.isAnyShowing === true,
        showingScreenIds: state.showingScreenIds ?? [],
        displayCount: state.displays?.length ?? 0,
    };
}

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/** A button that runs another command, shown in the transcript as typed. */
function genCommandAction(label: string, command: string): BotActionType {
    return { label, toolName: BUILTIN_TOOL_NAME, args: { command } };
}

function genScreenActions(state: ScreenStateType | null): BotActionType[] {
    if (state === null) {
        return [];
    }
    return state.isAnyShowing
        ? [
              genCommandAction('Turn every screen off', '/screen-hide'),
              genCommandAction('Clear everything on it', '/clear-all'),
          ]
        : [genCommandAction('Turn the screen on', '/screen-show')];
}

function describeScreens(state: ScreenStateType) {
    if (!state.isAnyShowing) {
        return (
            '**Nothing is showing on the projector.** The screen is off' +
            (state.displayCount > 0
                ? `, and this computer has ${state.displayCount} display` +
                  `${state.displayCount === 1 ? '' : 's'} to put it on.`
                : '.')
        );
    }
    const ids = state.showingScreenIds;
    return (
        `**Screen ${ids.join(', ')} ${ids.length === 1 ? 'is' : 'are'} ` +
        'showing right now** -- the projector has the app on it.'
    );
}

async function runScreenStatus({ report }: BuiltinRunContextType) {
    const finish = report('Checking the projector screens');
    try {
        const state = await readScreens();
        if (state === null) {
            return { text: COULD_NOT_REACH_APP };
        }
        return {
            text: describeScreens(state),
            actions: genScreenActions(state),
        };
    } finally {
        finish();
    }
}

async function runScreenShow({ report }: BuiltinRunContextType) {
    const finish = report('Turning the screen on');
    try {
        const before = await readScreens();
        if (before === null) {
            return { text: COULD_NOT_REACH_APP };
        }
        if (before.isAnyShowing) {
            return {
                text:
                    '**The screen is already on** -- ' +
                    `screen ${before.showingScreenIds.join(', ')} is showing.`,
                actions: genScreenActions(before),
            };
        }
        try {
            await callTool('owa_click', { find: SCREEN_TOGGLE_LABEL });
        } catch (error) {
            appError(error, 'builtin /screen-show');
            return {
                text:
                    'I could not find the screen button in this window. It ' +
                    'is the leftmost icon on the screen preview card in the ' +
                    '**Presenter** (or press **F5** there).',
                actions: [
                    genCommandAction('Go to the Presenter', '/goto presenter'),
                ],
            };
        }
        await sleep(SCREEN_SETTLE_MS);
        const after = await readScreens();
        if (after?.isAnyShowing) {
            return {
                text:
                    '**The screen is on now** -- ' +
                    `screen ${after.showingScreenIds.join(', ')} is showing. ` +
                    'Next time, **F5** in the Presenter does the same.',
                actions: genScreenActions(after),
            };
        }
        return {
            text:
                'I pressed the screen button, but the app still reports ' +
                'nothing showing. Look at the screen preview card in the ' +
                'Presenter: its leftmost icon turns the output on, and the ' +
                '**Display** button under it says which display it goes to.',
            actions: [genCommandAction('Check again', '/screen')],
        };
    } finally {
        finish();
    }
}

async function runScreenHide({ report }: BuiltinRunContextType) {
    const finish = report('Turning every screen off');
    try {
        const before = await readScreens();
        if (before === null) {
            return { text: COULD_NOT_REACH_APP };
        }
        if (!before.isAnyShowing) {
            return {
                text: '**The screen is already off** -- nothing is showing.',
                actions: genScreenActions(before),
            };
        }
        await callTool('owa_hide_screens', {});
        await sleep(SCREEN_SETTLE_MS);
        const after = await readScreens();
        if (after !== null && !after.isAnyShowing) {
            return {
                text: '**Every screen is off now.** The projector shows nothing from the app.',
                actions: genScreenActions(after),
            };
        }
        return {
            text:
                'I asked the app to hide its screens, but one still reports ' +
                'showing. The leftmost icon on its preview card in the ' +
                'Presenter turns it off (or **F5**).',
            actions: [genCommandAction('Check again', '/screen')],
        };
    } finally {
        finish();
    }
}

function genClearRunner(name: keyof typeof CLEAR_MAP) {
    const { label, key, what } = CLEAR_MAP[name];
    return async ({ report }: BuiltinRunContextType) => {
        const finish = report(`Clearing ${what}`);
        try {
            const screens = await readScreens();
            if (screens !== null && !screens.isAnyShowing) {
                return {
                    text:
                        `**The screen is off**, so there is nothing to clear ` +
                        `-- the projector shows nothing from the app.`,
                    actions: genScreenActions(screens),
                };
            }
            let pressed: any = null;
            try {
                pressed = parseToolJson(
                    await callTool('owa_click', { find: label }),
                );
            } catch (error) {
                appError(error, `builtin /${name}`);
                return {
                    text:
                        `I could not find the **${label}** button in this ` +
                        'window. It is on the screen preview card in the ' +
                        `**Presenter**, or press **${key}** there.`,
                };
            }
            if (pressed?.didChange === false || pressed?.unverified) {
                return {
                    text:
                        `I pressed **${label}**, and the button looks the same ` +
                        `afterwards -- it is only lit while there is ` +
                        `${what} to clear, so there may have been nothing on ` +
                        `that layer. Next time, **${key}** does the same.`,
                    actions: [genCommandAction('Check the screen', '/screen')],
                };
            }
            return {
                text:
                    `**Cleared ${what}.** Next time, **${key}** in the ` +
                    'Presenter does the same.',
                actions: [genCommandAction('Check the screen', '/screen')],
            };
        } finally {
            finish();
        }
    };
}

async function runFind({ argument, focus, report }: BuiltinRunContextType) {
    if (argument.length === 0) {
        return {
            text:
                'Tell me the words written on the control -- for example ' +
                '`/find Clear Bible` -- and I will outline it in the app window.',
        };
    }
    const finish = report(`Looking for “${argument}”`);
    try {
        const answer = await answerWhereIs(argument, focus);
        if (answer !== null) {
            return answer;
        }
        return {
            text:
                `I could not find anything on screen reading "${argument}". ` +
                'Try the exact words written on the button, or open the ' +
                'panel it belongs to first.',
        };
    } catch (error) {
        appError(error, 'builtin /find');
        return {
            text:
                `I could not look for "${argument}" just now -- the app ` +
                'window may be busy. Try again in a moment.',
        };
    } finally {
        finish();
    }
}

async function runGoto({ argument, report }: BuiltinRunContextType) {
    const target = GOTO_MAP[argument.toLowerCase()];
    if (target === undefined) {
        return {
            text:
                'Say which page: `/goto presenter`, `/goto reader` or ' +
                '`/goto editor`.',
            actions: [
                genCommandAction('Presenter', '/goto presenter'),
                genCommandAction('Bible Reader', '/goto reader'),
                genCommandAction('Document Editor', '/goto editor'),
            ],
        };
    }
    const finish = report(`Switching to the ${target.label}`);
    try {
        const result = parseToolJson(
            await callTool('owa_goto_page', { page: target.page }),
        );
        if (result?.switched === false) {
            return { text: `**You are already in the ${target.label}.**` };
        }
        return {
            text:
                `**The main window is showing the ${target.label} now.** ` +
                'The projector is untouched.',
        };
    } catch (error) {
        appError(error, 'builtin /goto');
        return {
            text:
                `I could not switch to the ${target.label}. Click its tab ` +
                'in the header of the main window instead.',
        };
    } finally {
        finish();
    }
}

async function runWhere({ report }: BuiltinRunContextType) {
    const finish = report('Checking which window is in front');
    try {
        const state = parseToolJson(await callTool('owa_app_state', {}));
        const main = state?.mainWindow;
        if (!main) {
            return { text: COULD_NOT_REACH_APP };
        }
        const descriptor = BOT_FOCUS_LIST.find((one) => {
            return one.window === main.page;
        });
        const label = descriptor?.label ?? main.page;
        const extras = (state.windows ?? [])
            .map((one: any) => {
                return BOT_FOCUS_LIST.find((focus) => {
                    return (
                        typeof one?.url === 'string' &&
                        one.url.includes(focus.window) &&
                        focus.window !== main.page
                    );
                })?.label;
            })
            .filter((one: string | undefined) => {
                return one !== undefined;
            });
        const version = state?.instances?.[0]?.version;
        return {
            text:
                `**The main window is on the ${label}**` +
                (main.language ? ` in ${languageName(main.language)}` : '') +
                '.' +
                (extras.length > 0
                    ? ` Also open: ${[...new Set(extras)].join(', ')}.`
                    : '') +
                (version ? `\n\nApp version ${version}.` : ''),
        };
    } finally {
        finish();
    }
}

function languageName(code: string) {
    return code === 'km' ? 'Khmer' : code === 'en' ? 'English' : code;
}

async function runHelp({ argument, focus, report }: BuiltinRunContextType) {
    if (argument.length === 0) {
        return genCommandList();
    }
    const finish = report(`Searching the guide for “${argument}”`);
    try {
        return await answerFromManual(argument, focus);
    } catch (error) {
        appError(error, 'builtin /help');
        return {
            text:
                'I could not search the guide just now. Ask the question in ' +
                'full and I will look it up.',
        };
    } finally {
        finish();
    }
}

const COULD_NOT_REACH_APP =
    'I could not reach the app window just now. Try again in a moment.';

export const BUILTIN_ACTION_LIST: BuiltinActionType[] = [
    {
        name: 'screen',
        aliases: ['screens', 'projector', 'status'],
        hint: 'Is anything showing on the projector?',
        takesArgument: false,
        isActing: false,
        run: runScreenStatus,
    },
    {
        name: 'screen-show',
        aliases: ['presenter-screen-show', 'show-screen', 'screen-on', 'show'],
        hint: 'Turn the presentation screen on',
        takesArgument: false,
        isActing: true,
        run: runScreenShow,
    },
    {
        name: 'screen-hide',
        aliases: [
            'presenter-screen-hide',
            'hide-screen',
            'hide-screens',
            'screen-off',
            'hide',
        ],
        hint: 'Turn every presentation screen off',
        takesArgument: false,
        isActing: true,
        run: runScreenHide,
    },
    {
        name: 'clear-all',
        aliases: ['clear'],
        hint: 'Clear everything off the screen (F6)',
        takesArgument: false,
        isActing: true,
        run: genClearRunner('clear-all'),
    },
    {
        name: 'clear-background',
        aliases: ['clear-bg'],
        hint: 'Clear the background (F7)',
        takesArgument: false,
        isActing: true,
        run: genClearRunner('clear-background'),
    },
    {
        name: 'clear-slide',
        aliases: ['clear-sl'],
        hint: 'Clear the slide (F8)',
        takesArgument: false,
        isActing: true,
        run: genClearRunner('clear-slide'),
    },
    {
        name: 'clear-bible',
        aliases: ['clear-bb', 'clear-verse'],
        hint: 'Clear the Bible text (F9)',
        takesArgument: false,
        isActing: true,
        run: genClearRunner('clear-bible'),
    },
    {
        name: 'clear-foreground',
        aliases: ['clear-fg'],
        hint: 'Clear the countdown, marquee and clock (F10)',
        takesArgument: false,
        isActing: true,
        run: genClearRunner('clear-foreground'),
    },
    {
        name: 'find',
        aliases: ['where', 'point'],
        hint: 'Outline a control in the app: /find Clear Bible',
        takesArgument: true,
        isActing: false,
        run: runFind,
    },
    {
        name: 'goto',
        aliases: ['go', 'page'],
        hint: 'Switch the main window: /goto presenter, reader or editor',
        takesArgument: true,
        isActing: false,
        run: runGoto,
    },
    {
        name: 'here',
        aliases: ['which', 'version'],
        hint: 'Which window is in front, and the app version',
        takesArgument: false,
        isActing: false,
        run: runWhere,
    },
    {
        name: 'help',
        aliases: ['guide', 'manual'],
        hint: 'Search the built-in guide without an assistant: /help clear bible',
        takesArgument: true,
        isActing: false,
        run: runHelp,
    },
    {
        name: 'commands',
        aliases: ['?', 'list'],
        hint: 'List every command',
        takesArgument: false,
        isActing: false,
        run: async () => {
            return genCommandList();
        },
    },
];

// `/word rest`. The name is read case-insensitively, the argument keeps its
// case: a control's label is matched by its words.
const COMMAND_PATTERN = /^\/([^\s/]+)(?:\s+([\s\S]*))?$/;

export type ParsedCommandType = {
    action: BuiltinActionType | null;
    name: string;
    argument: string;
};

export function checkIsBuiltinCommand(text: string) {
    return text.trim().startsWith('/');
}

export function parseBuiltinCommand(text: string): ParsedCommandType | null {
    const match = COMMAND_PATTERN.exec(text.trim());
    if (match === null) {
        return null;
    }
    const name = match[1].toLowerCase();
    const argument = (match[2] ?? '').trim();
    const action =
        BUILTIN_ACTION_LIST.find((one) => {
            return one.name === name || one.aliases.includes(name);
        }) ?? null;
    return { action, name, argument };
}

/**
 * The commands to offer for what has been typed so far. `/` alone lists them
 * all; letters after it narrow by name and alias. A command that takes words
 * is offered as `/name ` so the box is ready for them.
 */
export function matchBuiltinActions(query: string, limit = 8) {
    const trimmed = query.trim();
    if (!trimmed.startsWith('/')) {
        return [];
    }
    const typed = trimmed.slice(1).toLowerCase().split(/\s+/)[0] ?? '';
    return BUILTIN_ACTION_LIST.filter((one) => {
        return (
            typed.length === 0 ||
            one.name.startsWith(typed) ||
            one.aliases.some((alias) => {
                return alias.startsWith(typed);
            })
        );
    }).slice(0, limit);
}

/** The text a chosen command puts in the box, or asks as it stands. */
export function toBuiltinCommandText(action: BuiltinActionType) {
    return `/${action.name}${action.takesArgument ? ' ' : ''}`;
}

function genCommandList(): BotAnswerType {
    const lines = BUILTIN_ACTION_LIST.map((one) => {
        return `- \`/${one.name}\` -- ${one.hint}`;
    });
    return {
        text:
            '**Commands you can type** -- each one runs on the spot, with no ' +
            'assistant and no internet:\n\n' +
            lines.join('\n') +
            '\n\nType `/` and the list appears as you type.',
        actions: [
            genCommandAction('Is the screen on?', '/screen'),
            genCommandAction('Turn the screen on', '/screen-show'),
        ],
    };
}

/**
 * Run a command line. Never throws: a command that could not do its thing
 * says so in its own words, and the reason goes to the log.
 */
export async function runBuiltinCommand(
    text: string,
    focus: BotFocusType,
    onProgress?: BotProgressCallbackType,
): Promise<BotAnswerType> {
    const parsed = parseBuiltinCommand(text);
    if (parsed === null || parsed.action === null) {
        const list = genCommandList();
        return {
            ...list,
            text:
                (parsed === null
                    ? ''
                    : `I do not know a command called \`/${parsed.name}\`.\n\n`) +
                list.text,
        };
    }
    const report = genProgressReporter(onProgress);
    try {
        return await parsed.action.run({
            argument: parsed.argument,
            focus,
            report,
        });
    } catch (error) {
        appError(error, `builtin /${parsed.action.name}`);
        return {
            text:
                `I could not do \`/${parsed.action.name}\` just now. Try ` +
                'again in a moment, or ask me in words and I will find ' +
                'another way.',
        };
    }
}
