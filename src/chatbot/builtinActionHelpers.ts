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
    answerLyricLink,
    answerLyricPaste,
    answerWhereIs,
    type BotActionType,
    type BotAnswerType,
} from './helpBotHelpers';
import { readSongAddress } from './lyricDraftHelpers';
import { callTool, parseToolJson } from './mcpClient';
import {
    genProgressReporter,
    toSiteName,
    type BotProgressCallbackType,
} from './progressHelpers';
import {
    describeUsageInFull,
    toCostLabel,
    toCompactCount,
    toTotalTokens,
    type ChatUsageType,
} from './usageHelpers';
import {
    MAX_SPEND_ROUNDS_PER_HOUR,
    SPEND_ALLOW_LABEL,
    SPEND_ALLOW_TOOL_NAME,
    SPEND_LIMIT_CHOICE_LIST,
    allowMoreSpending,
    describeSpendGuard,
    getSpendState,
    parseSpendLimitValue,
    setSpendLimitUsd,
    toSpendLimitLabel,
} from './spendGuardHelpers';
import { describeScreenContent } from '../../tools/owa-devtools-mcp/agentScreens.mjs';
import { describePresentedBible } from '../../tools/owa-devtools-mcp/agentBible.mjs';
import { describeForeground } from '../../tools/owa-devtools-mcp/agentForeground.mjs';
import {
    describeRunSheet,
    describeSelectedDocument,
    type AgentSelectedDocumentType,
} from '../../tools/owa-devtools-mcp/agentPresenter.mjs';

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
    // What the tab that typed the command has spent so far. The one thing a
    // command answers that no tool can read -- the total lives in the window
    // -- so the window hands it in. Unset means nothing has been spent.
    usage?: ChatUsageType;
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
    // One sentence per screen about what it HOLDS, keyed by id -- read off
    // the same tool answer, so the command can say "showing verse 2 of
    // Amazing Grace" where "screen 0 is showing" said nothing checkable.
    heldById: Map<number, { held: string; isBlank: boolean }>;
    // The Clear buttons that have something to clear on some screen, by the
    // words on them with the [key] taken off -- a layer is held whether or
    // not the screen is showing, and shows the moment it is turned on.
    clearable: Set<string>;
};

async function readScreens(): Promise<ScreenStateType | null> {
    const state = parseToolJson(await callTool('owa_list_screens'));
    if (state === null || state.error) {
        return null;
    }
    const heldById = new Map<number, { held: string; isBlank: boolean }>();
    const clearable = new Set<string>();
    for (const screen of Array.isArray(state.screens) ? state.screens : []) {
        heldById.set(screen.screenId, {
            held: describeScreenContent(screen),
            isBlank: screen.isBlank === true,
        });
        for (const clear of screen.controls?.clear ?? []) {
            if (
                clear?.hasSomething === true &&
                typeof clear.label === 'string'
            ) {
                clearable.add(clear.label.replace(/\s*\[[^\]]*\]\s*$/, ''));
            }
        }
    }
    return {
        isAnyShowing: state.isAnyShowing === true,
        showingScreenIds: state.showingScreenIds ?? [],
        displayCount: state.displays?.length ?? 0,
        heldById,
        clearable,
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
        const heldWhileOff = [...state.heldById.entries()]
            .filter(([, entry]) => !entry.isBlank)
            .map(([screenId, entry]) => {
                return (
                    ` Screen ${screenId} already holds ${entry.held}, ` +
                    'so turning it on shows that.'
                );
            })
            .join('');
        return (
            '**Nothing is showing on the projector.** The screen is off' +
            (state.displayCount > 0
                ? `, and this computer has ${state.displayCount} display` +
                  `${state.displayCount === 1 ? '' : 's'} to put it on.`
                : '.') +
            heldWhileOff
        );
    }
    const ids = state.showingScreenIds;
    const held = ids
        .map((screenId) => {
            const entry = state.heldById.get(screenId);
            if (entry === undefined) {
                return '';
            }
            return ` Screen ${screenId} shows ${entry.held}.`;
        })
        .join('');
    return (
        `**Screen ${ids.join(', ')} ${ids.length === 1 ? 'is' : 'are'} ` +
        'showing right now** -- the projector has the app on it.' +
        held
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
            // An off screen still HOLDS its layers, and shows them the moment
            // it is turned on: a countdown left on it after the screen was
            // hidden is exactly what /clear-foreground is typed for. Only a
            // screen that is off AND holds nothing on this layer has nothing
            // to clear (2026-09-11: the command said so with a countdown and
            // a marquee sitting on the hidden screen).
            const isHeld = screens?.clearable.has(label) === true;
            if (screens !== null && !screens.isAnyShowing && !isHeld) {
                return {
                    text:
                        `**The screen is off**, so there is nothing to clear ` +
                        `-- the projector shows nothing from the app.`,
                    actions: genScreenActions(screens),
                };
            }
            const offNote =
                screens !== null && !screens.isAnyShowing
                    ? ' The screen is off, so this only emptied what it was holding.'
                    : '';
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
                // A Clear button is a plain press, so the click itself proves
                // nothing -- the LAYER does. Read the screens back: a layer
                // that held something and holds nothing now was cleared.
                const after = isHeld ? await readScreens() : null;
                const isClearedNow =
                    isHeld && after !== null && !after.clearable.has(label);
                if (!isClearedNow) {
                    return {
                        text:
                            `I pressed **${label}**, and the button looks the same ` +
                            `afterwards -- it is only lit while there is ` +
                            `${what} to clear, so there may have been nothing on ` +
                            `that layer. Next time, **${key}** does the same.`,
                        actions: [
                            genCommandAction('Check the screen', '/screen'),
                        ],
                    };
                }
            }
            return {
                text:
                    `**Cleared ${what}.**${offNote} Next time, **${key}** in ` +
                    'the Presenter does the same.',
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

const APP_LANGUAGE_NAME_MAP: Record<string, string> = {
    en: 'English',
    km: 'Khmer',
    fr: 'French',
};
function languageName(code: string) {
    return APP_LANGUAGE_NAME_MAP[code] ?? code;
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

// What `owa_app_state` says the user is in the middle of on the Presenter:
// the selected document with its slides, the one on a screen and the arrow
// keys' next and previous. Null when the main window is not the Presenter,
// which every command below says in its own words.
type SelectedDocumentType = AgentSelectedDocumentType;

async function readSelectedDocument(): Promise<{
    isPresenter: boolean;
    selected: SelectedDocumentType | null;
} | null> {
    const state = parseToolJson(await callTool('owa_app_state', {}));
    const main = state?.mainWindow;
    if (!main) {
        return null;
    }
    if (main.page !== 'presenter.html') {
        return { isPresenter: false, selected: null };
    }
    return { isPresenter: true, selected: main.selectedDocument ?? null };
}

const NOT_ON_PRESENTER_ACTIONS = [
    genCommandAction('Go to the Presenter', '/goto presenter'),
];

async function runSelected({ report }: BuiltinRunContextType) {
    const finish = report('Checking what is selected');
    try {
        const read = await readSelectedDocument();
        if (read === null) {
            return { text: COULD_NOT_REACH_APP };
        }
        if (!read.isPresenter) {
            return {
                text:
                    '**The main window is not on the Presenter**, and the ' +
                    'selected song lives there.',
                actions: NOT_ON_PRESENTER_ACTIONS,
            };
        }
        const selected = read.selected;
        const actions: BotActionType[] = [];
        if (selected?.next) {
            actions.push(genCommandAction('Show the next slide', '/next'));
        }
        if (selected?.previous) {
            actions.push(genCommandAction('Back one slide', '/previous'));
        }
        return {
            text: `**${describeSelectedDocument(selected)}**`,
            actions,
        };
    } finally {
        finish();
    }
}

/**
 * `/run`: the run sheet, from the ask box -- which presenting flow is open in
 * its run player, the line the run is on and what the next press puts up
 * (EC-132). Read off the same `owa_app_state` answer as `/selected`; it
 * presses nothing, because a step in the run puts something on the
 * congregation's screen and that is the operator's own key.
 */
async function runRunSheet({ report }: BuiltinRunContextType) {
    const finish = report('Reading the run sheet');
    try {
        const state = parseToolJson(await callTool('owa_app_state', {}));
        const main = state?.mainWindow;
        if (!main) {
            return { text: COULD_NOT_REACH_APP };
        }
        if (main.page !== 'presenter.html') {
            return {
                text:
                    '**The main window is not on the Presenter**, and the ' +
                    'run sheet lives there.',
                actions: NOT_ON_PRESENTER_ACTIONS,
            };
        }
        return { text: `**${describeRunSheet(main.runSheet ?? null)}**` };
    } finally {
        finish();
    }
}

/**
 * `/next` and `/previous`: the arrow keys, from the ask box. One read for
 * the card's exact words, one press by them, one read of the screens to say
 * what went up -- what CHANGED, never what was pressed (rule 1 above), and
 * typed by the person whose projector it is (rule 2).
 */
function genSlideStepper(isNext: boolean) {
    const word = isNext ? 'next' : 'previous';
    return async ({ report }: BuiltinRunContextType) => {
        const finish = report(`Putting the ${word} slide on the screen`);
        try {
            const read = await readSelectedDocument();
            if (read === null) {
                return { text: COULD_NOT_REACH_APP };
            }
            if (!read.isPresenter) {
                return {
                    text:
                        '**The main window is not on the Presenter**, so ' +
                        'there is no slide list to step through.',
                    actions: NOT_ON_PRESENTER_ACTIONS,
                };
            }
            const selected = read.selected;
            if (selected === null) {
                return {
                    text:
                        '**Nothing is selected in the Documents list.** Click ' +
                        'a song there first.',
                };
            }
            const target = isNext ? selected.next : selected.previous;
            if (target === null) {
                return {
                    text: isNext
                        ? `**There is no next slide** -- "${selected.name}" ` +
                          'has nothing after this one.'
                        : `**There is no previous slide** -- none of ` +
                          `"${selected.name}" is on a screen yet, so there ` +
                          'is nothing to go back from.',
                    actions: isNext
                        ? []
                        : [genCommandAction('Show its first slide', '/next')],
                };
            }
            try {
                await callTool('owa_click', { find: target.find });
            } catch (error) {
                appError(error, `builtin /${word}`);
                return {
                    text:
                        `I could not find slide ${target.n} of ` +
                        `"${selected.name}" on the screen to press. Click ` +
                        'it in the slide list instead.',
                };
            }
            await sleep(SCREEN_SETTLE_MS);
            const after = await readSelectedDocument();
            const upNow = after?.selected?.onScreen ?? null;
            if (upNow === null || upNow.n !== target.n) {
                return {
                    text:
                        `I pressed slide ${target.n} of "${selected.name}" ` +
                        'but the app does not show it on a screen yet -- ' +
                        'please look at the Mini Screen panel.',
                    actions: [genCommandAction('Is the screen on?', '/screen')],
                };
            }
            const screens = await readScreens();
            const isShowing = screens?.isAnyShowing === true;
            const slideWords = upNow.name
                ? `Slide ${upNow.n} "${upNow.name}"`
                : `Slide ${upNow.n}`;
            const actions: BotActionType[] = [];
            if (after?.selected?.next) {
                actions.push(genCommandAction('Next slide', '/next'));
            }
            if (after?.selected?.previous) {
                actions.push(genCommandAction('Back one', '/previous'));
            }
            if (!isShowing) {
                actions.push(
                    genCommandAction('Turn the screen on', '/screen-show'),
                );
            }
            return {
                text:
                    `**${slideWords} of "${selected.name}" is on the screen ` +
                    'now**' +
                    (upNow.text ? ` -- "${upNow.text}"` : '') +
                    (isShowing
                        ? '.'
                        : '. The screen itself is off, so the projector is ' +
                          'not showing it yet.'),
                actions,
            };
        } finally {
            finish();
        }
    };
}

// The refusals the app writes for a passage are sentences for a person --
// "could not be read as a passage", "No Bible version called", "is locked".
// Anything else that comes back is a tool's own error and stays in the log.
const VERSE_TROUBLE_PATTERN =
    /could not be read as a passage|No Bible version|No screen is chosen|is locked|presented from the Presenter page|Say which passage|longer than a reference/;

/**
 * `/verse John 3:16`: a passage on the projector, from the ask box, through
 * the app's own reference parser and the Bible Lookup's own present path
 * (`owa_present_bible`) -- the one thing the lookup's picker could never be
 * driven to do. Typing it is the consent (rule 2 above); the answer says what
 * CHANGED, read back off the screen: the passage, the version, and whether
 * the screen is on (rule 1).
 */
async function runVerse({ argument, report }: BuiltinRunContextType) {
    const reference = argument.trim();
    if (reference.length === 0) {
        return {
            text:
                '**Say which passage** -- for example `/verse John 3:16` or ' +
                '`/verse Psalm 23:1-6`.',
        };
    }
    const finish = report(`Putting ${reference} on the screen`);
    try {
        let result;
        try {
            result = parseToolJson(
                await callTool('owa_present_bible', { reference }),
            );
        } catch (error: any) {
            appError(error, 'builtin /verse');
            const reason = String(error?.message ?? '');
            return {
                text: VERSE_TROUBLE_PATTERN.test(reason)
                    ? `**${reason}**`
                    : `**I could not put "${reference}" on the screen just ` +
                      'now.** Write it as book, chapter and verse -- ' +
                      '`/verse John 3:16` -- from the Presenter page.',
                actions: NOT_ON_PRESENTER_ACTIONS,
            };
        }
        if (result === null) {
            return { text: COULD_NOT_REACH_APP };
        }
        const actions: BotActionType[] = [];
        if (result.isPresented === true && result.isAnyShowing !== true) {
            actions.push(
                genCommandAction('Turn the screen on', '/screen-show'),
            );
        }
        if (result.isPresented === true) {
            actions.push(genCommandAction('Take it off again', '/clear-bible'));
        }
        return { text: `**${describePresentedBible(result)}**`, actions };
    } finally {
        finish();
    }
}

// The app's own refusals for a foreground extra, worth repeating word for
// word: each names what was wrong with the ask and what to write instead.
const FOREGROUND_TROUBLE_PATTERN =
    /is not a time of day|has already passed today|Say how long|Say the words|Say which extra|is at most|outside that|No screen is chosen|is locked|started from the Presenter page|There is no extra|only stops/;

type CountdownAskType = { minutes: number } | { at: string } | { stop: true };

/**
 * What `/countdown` was given: a number of minutes (`5`, `5 min`, `1.5h`), a
 * clock time (`10:30`, `to 6:45 pm`), or a word that takes it off. Null when
 * it is none of those, which the command answers with its own examples.
 */
export function readCountdownArgument(
    argument: string,
): CountdownAskType | null {
    const words = argument
        .trim()
        .replace(/^(?:for|of)\s+/i, '')
        .replace(/\s+/g, ' ');
    if (words === '') {
        return null;
    }
    if (/^(?:stop|off|hide|clear|end|cancel)$/i.test(words)) {
        return { stop: true };
    }
    const toMatch = /^(?:to|until|till|at)\s+(.+)$/i.exec(words);
    if (toMatch !== null) {
        return { at: toMatch[1].trim() };
    }
    if (
        /^\d{1,2}[:.]\d{2}\s*(?:am|pm)?$/i.test(words) ||
        /^\d{1,2}\s*(?:am|pm)$/i.test(words)
    ) {
        return { at: words };
    }
    const minutesMatch =
        /^(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:m|min|mins|minute|minutes)?$/i.exec(
            words,
        );
    if (minutesMatch !== null) {
        return { minutes: Number(minutesMatch[1]) };
    }
    const hoursMatch =
        /^(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:h|hr|hrs|hour|hours)$/i.exec(words);
    if (hoursMatch !== null) {
        return { minutes: Number(hoursMatch[1]) * 60 };
    }
    return null;
}

/**
 * One foreground call from the ask box, through `owa_foreground`, answered
 * the way `/verse` answers: what CHANGED, read back off the screen, the
 * screen's show button offered when it is off, and the way back off. A tool's
 * own error never reaches the user (rule 3 above); the app's own refusal,
 * written for a person, does.
 */
async function runForegroundCommand(
    { report }: BuiltinRunContextType,
    request: Record<string, unknown>,
    progress: string,
    couldNot: string,
    stopCommand: string,
) {
    const finish = report(progress);
    try {
        let result;
        try {
            result = parseToolJson(await callTool('owa_foreground', request));
        } catch (error: any) {
            appError(error, 'builtin foreground command');
            const reason = String(error?.message ?? '');
            return {
                text: FOREGROUND_TROUBLE_PATTERN.test(reason)
                    ? `**${reason}**`
                    : `**${couldNot}**`,
                actions: NOT_ON_PRESENTER_ACTIONS,
            };
        }
        if (result === null) {
            return { text: COULD_NOT_REACH_APP };
        }
        const actions: BotActionType[] = [];
        if (result.did === 'started' && result.isAnyShowing !== true) {
            actions.push(
                genCommandAction('Turn the screen on', '/screen-show'),
            );
        }
        if (result.did === 'started') {
            actions.push(genCommandAction('Take it off again', stopCommand));
        }
        return { text: `**${describeForeground(result)}**`, actions };
    } finally {
        finish();
    }
}

/**
 * `/countdown 5`: a countdown on the projector, from the ask box, with no
 * model -- the same door the assistant uses (`owa_foreground`). Measured
 * 2026-09-11: asked in words, the assistant's "yes" ran to its round cap
 * hunting the Foreground tab's boxes and started nothing. Typing it is the
 * consent; `/countdown stop` takes it off again.
 */
async function runCountdown(context: BuiltinRunContextType) {
    const ask = readCountdownArgument(context.argument);
    if (ask === null) {
        return {
            text:
                '**Say how long** -- `/countdown 5` for five minutes, ' +
                '`/countdown 10:30` to count down to a time, or ' +
                '`/countdown stop` to take it off.',
        };
    }
    if ('stop' in ask) {
        return await runForegroundCommand(
            context,
            { action: 'stop', widget: 'countdown' },
            'Taking the countdown off the screen',
            'I could not take the countdown off just now. Press F10 (Clear ' +
                'Foreground) on the Presenter page.',
            '/countdown stop',
        );
    }
    const isMinutes = 'minutes' in ask;
    return await runForegroundCommand(
        context,
        isMinutes
            ? { widget: 'countdown', minutes: ask.minutes }
            : { widget: 'countdown', at: ask.at },
        isMinutes
            ? `Starting a ${ask.minutes} minute countdown`
            : `Starting a countdown to ${ask.at}`,
        'I could not start the countdown just now. Try again from the ' +
            'Presenter page -- `/countdown 5`.',
        '/countdown stop',
    );
}

/**
 * `/marquee Please silence your phones`: the words scroll along the bottom
 * (or the top, for `/marquee-top`) of the projector, with no model.
 */
function genMarqueeRunner(
    widget: 'marquee-top' | 'marquee-bottom',
    command: string,
) {
    const where = widget === 'marquee-top' ? 'top' : 'bottom';
    return async (context: BuiltinRunContextType) => {
        const text = context.argument.trim().replace(/\s+/g, ' ');
        if (text === '') {
            return {
                text:
                    `**Say the words to scroll** -- \`/${command} Please ` +
                    `silence your phones\`; \`/${command} stop\` takes it off.`,
            };
        }
        if (/^(?:stop|off|hide|clear|end|cancel)$/i.test(text)) {
            return await runForegroundCommand(
                context,
                { action: 'stop', widget },
                'Taking the scrolling message off the screen',
                'I could not take the message off just now. Press F10 ' +
                    '(Clear Foreground) on the Presenter page.',
                `/${command} stop`,
            );
        }
        return await runForegroundCommand(
            context,
            { widget, text },
            `Putting a scrolling message along the ${where} of the screen`,
            'I could not put the message on the screen just now. Try ' +
                `again from the Presenter page -- \`/${command} <words>\`.`,
            `/${command} stop`,
        );
    };
}

/**
 * A song written out with no model: `/lyric https://…` has the page read
 * there and drafted, `/lyric` over pasted words drafts those. The same
 * drafter, the same two buttons and the same hardened create path as the
 * assistant's own answer -- and the song is only ever OFFERED: nothing is
 * written until Create is pressed, which is what a model asked the same
 * thing was measured NOT to do (2026-09-10: *Create a lyric file from
 * <address>* on Claude drafted the song and created the file in the same
 * breath, 3 rounds and 18 s). This is one command, no rounds, and the file
 * waits on the button.
 */
async function runLyric({ argument, report }: BuiltinRunContextType) {
    const words = argument.trim();
    if (words.length === 0) {
        return {
            text:
                '**Give me the song** -- the address of the page it is on ' +
                '(`/lyric https://…`), or paste its words after the ' +
                'command. I will write it out for the Lyric Editor and ' +
                'offer a button that saves it; nothing is saved until you ' +
                'press it.',
        };
    }
    const address = readSongAddress(words);
    if (address !== null) {
        const site = toSiteName(address) ?? 'the page';
        const finish = report(`Reading ${site} and writing the song out`);
        try {
            return await answerLyricLink(address);
        } finally {
            finish();
        }
    }
    const finish = report('Writing the song out');
    try {
        const answer = await answerLyricPaste(words);
        if (answer !== null) {
            return answer;
        }
        return {
            text:
                'That did not read as the words of a song. Give me the ' +
                'address of the page it is on (`/lyric https://…`), or ' +
                'paste the words themselves, a line each, with a label ' +
                'like *Verse 1* or *Chorus* over each part.',
        };
    } catch (error) {
        appError(error, 'builtin /lyric');
        return {
            text:
                'I could not write that song out just now. Try again in a ' +
                'moment, or paste the words as plain lines.',
        };
    } finally {
        finish();
    }
}

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
        name: 'selected',
        aliases: ['song', 'document', 'slides', 'current'],
        hint: 'Which song is selected, which slide is up, and what is next',
        takesArgument: false,
        isActing: false,
        run: runSelected,
    },
    {
        name: 'run',
        aliases: ['run-sheet', 'running-order', 'flow', 'order'],
        hint: 'Which run sheet is open, where the run is, and what is next',
        takesArgument: false,
        isActing: false,
        run: runRunSheet,
    },
    {
        name: 'next',
        aliases: ['next-slide', 'forward'],
        hint: 'Put the next slide of the selected song on the screen',
        takesArgument: false,
        isActing: true,
        run: genSlideStepper(true),
    },
    {
        name: 'previous',
        aliases: ['prev', 'previous-slide', 'back'],
        hint: 'Go back one slide',
        takesArgument: false,
        isActing: true,
        run: genSlideStepper(false),
    },
    {
        name: 'verse',
        // No `scripture`: `/scr` is the screen, and stays so.
        aliases: ['bible', 'passage', 'present-verse'],
        hint: 'Put a Bible passage on the screen: /verse John 3:16',
        takesArgument: true,
        isActing: true,
        run: runVerse,
    },
    {
        name: 'countdown',
        aliases: ['timer', 'count-down'],
        hint: 'Start a countdown on the screen: /countdown 5, or /countdown 10:30',
        takesArgument: true,
        isActing: true,
        run: runCountdown,
    },
    {
        name: 'marquee',
        // No `scroll-text`: `/scr` is the screen, and stays so.
        aliases: ['ticker', 'marquee-bottom'],
        hint: 'Scroll a message along the bottom: /marquee Silence your phones',
        takesArgument: true,
        isActing: true,
        run: genMarqueeRunner('marquee-bottom', 'marquee'),
    },
    {
        name: 'marquee-top',
        aliases: ['ticker-top'],
        hint: 'Scroll a message along the top of the screen: /marquee-top Welcome',
        takesArgument: true,
        isActing: true,
        run: genMarqueeRunner('marquee-top', 'marquee-top'),
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
        name: 'credit',
        aliases: ['cost', 'usage', 'spent', 'tokens'],
        hint: 'What this chat has cost so far',
        takesArgument: false,
        isActing: false,
        run: runCredit,
    },
    {
        name: 'limit',
        aliases: ['budget', 'spend-limit', 'cap'],
        hint: 'See or set the hourly spending limit: /limit 2, /limit off',
        takesArgument: true,
        isActing: false,
        run: runLimit,
    },
    {
        // `lyric`, the app's own noun for a song file (New Lyric), because
        // `song` is what `/selected` answers to: WHICH song is up.
        name: 'lyric',
        aliases: ['lyrics', 'hymn', 'song-from', 'new-song'],
        hint: 'Write a song out from a web page, or from pasted words',
        takesArgument: true,
        // It reaches OUT (the page is read, rationed and announced in the app
        // window by the firewall) and it never touches the projector; what
        // it writes waits on the Create button.
        isActing: false,
        run: runLyric,
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
 * What this chat has cost, from the tab's own running total. A model asked
 * the same question can only quote the manual's example figure back --
 * measured 2026-09-10, a free model answered "the total so far is about
 * $0.02" off the guide's own sample line -- because no tool reads the
 * window; this reads the number itself, with no model and no round paid.
 */
async function runCredit({ usage }: BuiltinRunContextType) {
    if (usage === undefined || usage.rounds === 0) {
        return {
            text:
                'Nothing has been spent in this chat yet: no question here ' +
                'has been put to an assistant. The figure appears under ' +
                'each answer, and **Credit used** under the pickers at the ' +
                'top keeps the total.',
        };
    }
    return {
        text:
            `**This chat so far: ${toCostLabel(usage)} · ` +
            `${toCompactCount(toTotalTokens(usage))} tokens.**\n\n` +
            describeUsageInFull(usage).replace(/\n/g, '\n\n') +
            '\n\nEach tab keeps its own total; the same figure sits under ' +
            '**Credit used** at the top, and every answer carries its own.' +
            `\n\n${describeSpendGuard(getSpendState())} Type \`/limit\` ` +
            'to change the limit.',
    };
}

/**
 * The spend guard, read and set with no model -- see `spendGuardHelpers`.
 * `/limit` says where the hour stands, `/limit 2` sets the cap, `/limit off`
 * leaves only the pace cap, and `/limit more` is the Allow button by
 * another road. A person typed it, which is the consent the guard asks for;
 * a model cannot reach it (`BUILTIN_TOOL_NAME` is a pseudo tool), so a
 * runaway that learned the word still has nobody to type it.
 */
async function runLimit({ argument }: BuiltinRunContextType) {
    const word = argument.trim().toLowerCase();
    if (word === 'more' || word === 'allow' || word === 'continue') {
        const state = allowMoreSpending();
        return {
            text:
                'Carrying on: the hour starts again from now' +
                (state.limitUsd === null
                    ? ''
                    : `, with ${toSpendLimitLabel(state.limitUsd)} available ` +
                      'before I pause again') +
                '.',
        };
    }
    if (word.length > 0) {
        const limit = parseSpendLimitValue(word);
        if (limit === undefined) {
            return {
                text:
                    `I do not read "${argument.trim()}" as a limit. Say a ` +
                    'number of dollars an hour (`/limit 2`, `/limit 0.50`), ' +
                    '`/limit off` to keep only the pace cap, or `/limit ' +
                    'more` to carry on after a pause.',
            };
        }
        const state = setSpendLimitUsd(limit);
        return {
            text:
                (limit === null
                    ? '**The money cap is off.** The assistant will still ' +
                      `pause after ${MAX_SPEND_ROUNDS_PER_HOUR} model calls ` +
                      'in one hour, which is more than a person asks for.'
                    : `**The limit is now ${toSpendLimitLabel(limit)} an ` +
                      'hour.** At that point the assistant pauses and asks ' +
                      'before spending more.') +
                '\n\n' +
                describeSpendGuard(state),
        };
    }
    const state = getSpendState();
    const choices = SPEND_LIMIT_CHOICE_LIST.map(toSpendLimitLabel).join(', ');
    return {
        text:
            `**Limit: ${toSpendLimitLabel(state.limitUsd)} an hour.** ` +
            `${describeSpendGuard(state)}\n\nChange it with ` +
            '`/limit <dollars>` or the **Limit per hour** picker at the top ' +
            `(${choices}), or \`/limit off\` to keep only the pace cap.`,
        ...(state.isTripped
            ? {
                  actions: [
                      {
                          label: SPEND_ALLOW_LABEL,
                          toolName: SPEND_ALLOW_TOOL_NAME,
                          args: {},
                      },
                  ],
              }
            : {}),
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
    usage?: ChatUsageType,
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
            usage,
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
