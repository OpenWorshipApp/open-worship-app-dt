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
    answerLyricTitle,
    answerWhereIs,
    type BotActionType,
    type BotAnswerType,
} from './helpBotHelpers';
import { readSongAddress, readSongTitleArgument } from './lyricDraftHelpers';
import { callTool, parseToolJson } from './mcpClient';
import { checkIsChatTipHidden, pickChatTip, showChatTips } from './tipHelpers';
import { fillWords, tran, tranLabel } from './chatTranHelpers';
import {
    checkIsMainWindowUrl,
    getCurrentWindowAim,
    toFocusOfUrl,
} from './windowAimHelpers';
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
// it, so the answer can teach the shortcut for next time. `what` is read
// when the answer is written, in the app's language.
const CLEAR_MAP = {
    'clear-all': {
        label: 'Clear All',
        key: 'F6',
        what: () => tran('everything'),
    },
    'clear-background': {
        label: 'Clear Background',
        key: 'F7',
        what: () => tran('the background'),
    },
    'clear-slide': {
        label: 'Clear Slide',
        key: 'F8',
        what: () => tran('the slide'),
    },
    // `LT` on the bar: the layer a Bible passage and a Long Text Show's
    // text are both drawn in. The command keeps the name people type.
    'clear-bible': {
        label: 'Clear Long Text',
        key: 'F9',
        what: () => tran('the Bible passage or long text'),
    },
    'clear-foreground': {
        label: 'Clear Foreground',
        key: 'F10',
        what: () => tran('the foreground (countdown, marquee, clock)'),
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
                    ' ' +
                    fillWords(
                        tran(
                            'Screen {id} already holds {held}, so turning it ' +
                                'on shows that.',
                        ),
                        { id: screenId, held: entry.held },
                    )
                );
            })
            .join('');
        const count = { count: state.displayCount };
        return (
            (state.displayCount === 0
                ? tran(
                      '**Nothing is showing on the projector.** The screen ' +
                          'is off.',
                  )
                : state.displayCount === 1
                  ? fillWords(
                        tran(
                            '**Nothing is showing on the projector.** The ' +
                                'screen is off, and this computer has ' +
                                '{count} display to put it on.',
                        ),
                        count,
                    )
                  : fillWords(
                        tran(
                            '**Nothing is showing on the projector.** The ' +
                                'screen is off, and this computer has ' +
                                '{count} displays to put it on.',
                        ),
                        count,
                    )) + heldWhileOff
        );
    }
    const ids = state.showingScreenIds;
    const held = ids
        .map((screenId) => {
            const entry = state.heldById.get(screenId);
            if (entry === undefined) {
                return '';
            }
            return (
                ' ' +
                fillWords(tran('Screen {id} shows {held}.'), {
                    id: screenId,
                    held: entry.held,
                })
            );
        })
        .join('');
    const shown = { ids: ids.join(', ') };
    return (
        (ids.length === 1
            ? fillWords(
                  tran(
                      '**Screen {ids} is showing right now** -- the ' +
                          'projector has the app on it.',
                  ),
                  shown,
              )
            : fillWords(
                  tran(
                      '**Screen {ids} are showing right now** -- the ' +
                          'projector has the app on it.',
                  ),
                  shown,
              )) + held
    );
}

async function runScreenStatus({ report }: BuiltinRunContextType) {
    const finish = report(tran('Checking the projector screens'));
    try {
        const state = await readScreens();
        if (state === null) {
            return { text: tran(COULD_NOT_REACH_APP) };
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
    const finish = report(tran('Turning the screen on'));
    try {
        const before = await readScreens();
        if (before === null) {
            return { text: tran(COULD_NOT_REACH_APP) };
        }
        if (before.isAnyShowing) {
            return {
                text: fillWords(
                    tran(
                        '**The screen is already on** -- screen {ids} is ' +
                            'showing.',
                    ),
                    { ids: before.showingScreenIds.join(', ') },
                ),
                actions: genScreenActions(before),
            };
        }
        try {
            await callTool('owa_click', { find: SCREEN_TOGGLE_LABEL });
        } catch (error) {
            appError(error, 'builtin /screen-show');
            return {
                text: tran(
                    'I could not find the screen button in this window. It ' +
                        'is the leftmost icon on the screen preview card in ' +
                        'the **Presenter** (or press **F5** there).',
                ),
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
                    fillWords(
                        tran(
                            '**The screen is on now** -- screen {ids} is ' +
                                'showing.',
                        ),
                        { ids: after.showingScreenIds.join(', ') },
                    ) +
                    ' ' +
                    fillWords(tran(NEXT_TIME_KEY_TEXT), { key: 'F5' }),
                actions: genScreenActions(after),
            };
        }
        return {
            text: tran(
                'I pressed the screen button, but the app still reports ' +
                    'nothing showing. Look at the screen preview card in the ' +
                    'Presenter: its leftmost icon turns the output on, and ' +
                    'the **Display** button under it says which display it ' +
                    'goes to.',
            ),
            actions: [genCommandAction('Check again', '/screen')],
        };
    } finally {
        finish();
    }
}

async function runScreenHide({ report }: BuiltinRunContextType) {
    const finish = report(tran('Turning every screen off'));
    try {
        const before = await readScreens();
        if (before === null) {
            return { text: tran(COULD_NOT_REACH_APP) };
        }
        if (!before.isAnyShowing) {
            return {
                text: tran(
                    '**The screen is already off** -- nothing is showing.',
                ),
                actions: genScreenActions(before),
            };
        }
        await callTool('owa_hide_screens', {});
        await sleep(SCREEN_SETTLE_MS);
        const after = await readScreens();
        if (after !== null && !after.isAnyShowing) {
            return {
                text: tran(
                    '**Every screen is off now.** The projector shows ' +
                        'nothing from the app.',
                ),
                actions: genScreenActions(after),
            };
        }
        return {
            text: tran(
                'I asked the app to hide its screens, but one still reports ' +
                    'showing. The leftmost icon on its preview card in the ' +
                    'Presenter turns it off (or **F5**).',
            ),
            actions: [genCommandAction('Check again', '/screen')],
        };
    } finally {
        finish();
    }
}

// The shortcut for next time, said under a press that did it by hand.
const NEXT_TIME_KEY_TEXT =
    'Next time, **{key}** in the Presenter does the same.';

function genClearRunner(name: keyof typeof CLEAR_MAP) {
    const { label, key } = CLEAR_MAP[name];
    return async ({ report }: BuiltinRunContextType) => {
        const what = CLEAR_MAP[name].what();
        // The button by the words on it in the app's language.
        const shownLabel = tranLabel(label);
        const finish = report(fillWords(tran('Clearing {what}'), { what }));
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
                    text: tran(
                        '**The screen is off**, so there is nothing to clear ' +
                            '-- the projector shows nothing from the app.',
                    ),
                    actions: genScreenActions(screens),
                };
            }
            const offNote =
                screens !== null && !screens.isAnyShowing
                    ? ' ' +
                      tran(
                          'The screen is off, so this only emptied what it ' +
                              'was holding.',
                      )
                    : '';
            let pressed: any = null;
            try {
                pressed = parseToolJson(
                    await callTool('owa_click', { find: label }),
                );
            } catch (error) {
                appError(error, `builtin /${name}`);
                return {
                    text: fillWords(
                        tran(
                            'I could not find the **{label}** button in this ' +
                                'window. It is on the screen preview card in ' +
                                'the **Presenter**, or press **{key}** there.',
                        ),
                        { label: shownLabel, key },
                    ),
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
                        text: fillWords(
                            tran(
                                'I pressed **{label}**, and the button looks ' +
                                    'the same afterwards -- it is only lit ' +
                                    'while there is {what} to clear, so there ' +
                                    'may have been nothing on that layer. ' +
                                    'Next time, **{key}** does the same.',
                            ),
                            { label: shownLabel, what, key },
                        ),
                        actions: [
                            genCommandAction('Check the screen', '/screen'),
                        ],
                    };
                }
            }
            return {
                text:
                    fillWords(tran('**Cleared {what}.**'), { what }) +
                    offNote +
                    ' ' +
                    fillWords(tran(NEXT_TIME_KEY_TEXT), { key }),
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
            text: tran(
                'Tell me the words written on the control -- for example ' +
                    '`/find Clear Long Text` -- and I will outline it in the ' +
                    'app window.',
            ),
        };
    }
    const finish = report(
        fillWords(tran('Looking for “{words}”'), { words: argument }),
    );
    try {
        const answer = await answerWhereIs(argument, focus);
        if (answer !== null) {
            return answer;
        }
        return {
            text: fillWords(
                tran(
                    'I could not find anything on screen reading "{words}". ' +
                        'Try the exact words written on the button, or open ' +
                        'the panel it belongs to first.',
                ),
                { words: argument },
            ),
        };
    } catch (error) {
        appError(error, 'builtin /find');
        return {
            text: fillWords(
                tran(
                    'I could not look for "{words}" just now -- the app ' +
                        'window may be busy. Try again in a moment.',
                ),
                { words: argument },
            ),
        };
    } finally {
        finish();
    }
}

async function runGoto({ argument, report }: BuiltinRunContextType) {
    const target = GOTO_MAP[argument.toLowerCase()];
    if (target === undefined) {
        return {
            text: tran(
                'Say which page: `/goto presenter`, `/goto reader` or ' +
                    '`/goto editor`.',
            ),
            actions: [
                genCommandAction('Presenter', '/goto presenter'),
                genCommandAction('Bible Reader', '/goto reader'),
                genCommandAction('Document Editor', '/goto editor'),
            ],
        };
    }
    const page = { page: tranLabel(target.label) };
    const finish = report(fillWords(tran('Switching to the {page}'), page));
    try {
        const result = parseToolJson(
            await callTool('owa_goto_page', { page: target.page }),
        );
        if (result?.switched === false) {
            return {
                text: fillWords(
                    tran('**You are already in the {page}.**'),
                    page,
                ),
            };
        }
        return {
            text: fillWords(
                tran(
                    '**The main window is showing the {page} now.** The ' +
                        'projector is untouched.',
                ),
                page,
            ),
        };
    } catch (error) {
        appError(error, 'builtin /goto');
        return {
            text: fillWords(
                tran(
                    'I could not switch to the {page}. Click its tab in the ' +
                        'header of the main window instead.',
                ),
                page,
            ),
        };
    } finally {
        finish();
    }
}

async function runWhere({ report }: BuiltinRunContextType) {
    const finish = report(tran('Checking which window is in front'));
    try {
        const state = parseToolJson(await callTool('owa_app_state', {}));
        const main = state?.mainWindow;
        if (!main) {
            return { text: tran(COULD_NOT_REACH_APP) };
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
        // A window of its own chosen in the window picker: the read above was
        // of THAT window (`windowAimHelpers.ts`), so it is named as the one
        // this tab works with, and the main window is told apart from it.
        if (getCurrentWindowAim() !== null) {
            const mainEntry = (state.windows ?? []).find((one: any) => {
                return (
                    typeof one?.url === 'string' &&
                    checkIsMainWindowUrl(one.url)
                );
            });
            const mainFocus = mainEntry ? toFocusOfUrl(mainEntry.url) : null;
            const mainLabel = BOT_FOCUS_LIST.find((one) => {
                return one.key === mainFocus;
            })?.label;
            const own = {
                window: tranLabel(label),
                language: main.language ? languageName(main.language) : '',
            };
            return {
                text:
                    (main.language
                        ? fillWords(
                              tran(
                                  '**This tab works with the {window}, a ' +
                                      'window of its own** in {language}.',
                              ),
                              own,
                          )
                        : fillWords(
                              tran(
                                  '**This tab works with the {window}, a ' +
                                      'window of its own**.',
                              ),
                              own,
                          )) +
                    (mainLabel
                        ? ' ' +
                          fillWords(
                              tran('The main window is on the {window}.'),
                              {
                                  window: tranLabel(mainLabel),
                              },
                          )
                        : '') +
                    genVersionLine(version),
            };
        }
        const shown = {
            window: tranLabel(label),
            language: main.language ? languageName(main.language) : '',
        };
        return {
            text:
                (main.language
                    ? fillWords(
                          tran(
                              '**The main window is on the {window}** in ' +
                                  '{language}.',
                          ),
                          shown,
                      )
                    : fillWords(
                          tran('**The main window is on the {window}**.'),
                          shown,
                      )) +
                (extras.length > 0
                    ? ' ' +
                      fillWords(tran('Also open: {windows}.'), {
                          windows: [...new Set(extras)]
                              .map((one) => {
                                  return tranLabel(one as string);
                              })
                              .join(', '),
                      })
                    : '') +
                genVersionLine(version),
        };
    } finally {
        finish();
    }
}

function genVersionLine(version: unknown) {
    return version
        ? '\n\n' +
              fillWords(tran('App version {version}.'), {
                  version: String(version),
              })
        : '';
}

function languageName(code: string) {
    switch (code) {
        case 'en':
            return tran('English');
        case 'km':
            return tran('Khmer');
        case 'fr':
            return tran('French');
        default:
            return code;
    }
}

async function runHelp({ argument, focus, report }: BuiltinRunContextType) {
    if (argument.length === 0) {
        return genCommandList(focus);
    }
    const finish = report(
        fillWords(tran('Searching the guide for “{words}”'), {
            words: argument,
        }),
    );
    try {
        return await answerFromManual(argument, focus);
    } catch (error) {
        appError(error, 'builtin /help');
        return {
            text: tran(
                'I could not search the guide just now. Ask the question in ' +
                    'full and I will look it up.',
            ),
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
type SlideSummaryType = SelectedDocumentType['slides'][number];

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
    const finish = report(tran('Checking what is selected'));
    try {
        const read = await readSelectedDocument();
        if (read === null) {
            return { text: tran(COULD_NOT_REACH_APP) };
        }
        if (!read.isPresenter) {
            return {
                text: tran(
                    '**The main window is not on the Presenter**, and the ' +
                        'selected song lives there.',
                ),
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
    const finish = report(tran('Reading the run sheet'));
    try {
        const state = parseToolJson(await callTool('owa_app_state', {}));
        const main = state?.mainWindow;
        if (!main) {
            return { text: tran(COULD_NOT_REACH_APP) };
        }
        if (main.page !== 'presenter.html') {
            return {
                text: tran(
                    '**The main window is not on the Presenter**, and the ' +
                        'run sheet lives there.',
                ),
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
        const finish = report(
            isNext
                ? tran('Putting the next slide on the screen')
                : tran('Putting the previous slide on the screen'),
        );
        try {
            const read = await readSelectedDocument();
            if (read === null) {
                return { text: tran(COULD_NOT_REACH_APP) };
            }
            if (!read.isPresenter) {
                return {
                    text: tran(
                        '**The main window is not on the Presenter**, so ' +
                            'there is no slide list to step through.',
                    ),
                    actions: NOT_ON_PRESENTER_ACTIONS,
                };
            }
            const selected = read.selected;
            if (selected === null) {
                return {
                    text: tran(
                        '**Nothing is selected in the Documents list.** ' +
                            'Click a song there first.',
                    ),
                };
            }
            const target = isNext ? selected.next : selected.previous;
            if (target === null) {
                return {
                    text: isNext
                        ? fillWords(
                              tran(
                                  '**There is no next slide** -- "{name}" ' +
                                      'has nothing after this one.',
                              ),
                              { name: selected.name },
                          )
                        : fillWords(
                              tran(
                                  '**There is no previous slide** -- none ' +
                                      'of "{name}" is on a screen yet, so ' +
                                      'there is nothing to go back from.',
                              ),
                              { name: selected.name },
                          ),
                    actions: isNext
                        ? []
                        : [genCommandAction('Show its first slide', '/next')],
                };
            }
            return await presentSlideAndReport(selected, target, word);
        } finally {
            finish();
        }
    };
}

/**
 * The press and the read-back `/next`, `/previous` and `/slide` share: the
 * card's own words pressed once, the selection read again, the screens read
 * for the sentence -- what CHANGED, never what was pressed.
 */
async function presentSlideAndReport(
    selected: SelectedDocumentType,
    target: SlideSummaryType,
    logName: string,
): Promise<BotAnswerType> {
    try {
        await callTool('owa_click', { find: target.find });
    } catch (error) {
        appError(error, `builtin /${logName}`);
        return {
            text: fillWords(
                tran(
                    'I could not find slide {n} of "{name}" on the screen ' +
                        'to press. Click it in the slide list instead.',
                ),
                { n: target.n, name: selected.name },
            ),
        };
    }
    await sleep(SCREEN_SETTLE_MS);
    const after = await readSelectedDocument();
    const upNow = after?.selected?.onScreen ?? null;
    if (upNow === null || upNow.n !== target.n) {
        return {
            text: fillWords(
                tran(
                    'I pressed slide {n} of "{name}" but the app does not ' +
                        'show it on a screen yet -- please look at the Mini ' +
                        'Screen panel.',
                ),
                { n: target.n, name: selected.name },
            ),
            actions: [genCommandAction('Is the screen on?', '/screen')],
        };
    }
    const screens = await readScreens();
    const isShowing = screens?.isAnyShowing === true;
    const slideWords = genSlideWords(upNow);
    const actions: BotActionType[] = [];
    if (after?.selected?.next) {
        actions.push(genCommandAction('Next slide', '/next'));
    }
    if (after?.selected?.previous) {
        actions.push(genCommandAction('Back one', '/previous'));
    }
    if (!isShowing) {
        actions.push(genCommandAction('Turn the screen on', '/screen-show'));
    }
    return {
        text:
            fillWords(tran('**{slide} of "{name}" is on the screen now**'), {
                slide: slideWords,
                name: selected.name,
            }) +
            (upNow.text ? ` -- "${upNow.text}"` : '') +
            (isShowing
                ? '.'
                : '. ' +
                  tran(
                      'The screen itself is off, so the projector is not ' +
                          'showing it yet.',
                  )),
        actions,
    };
}

// "Slide 3" or "Slide 3 "(1)-Verse 1"", the way the answers name one.
function genSlideWords(slide: SlideSummaryType) {
    return slide.name
        ? fillWords(tran('Slide {n} "{name}"'), {
              n: slide.n,
              name: slide.name,
          })
        : fillWords(tran('Slide {n}'), { n: slide.n });
}

function toSlideKey(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9ក-៿]+/g, ' ')
        .trim();
}

/**
 * The slide a person means by its words: a number ("3", "slide 3"), the
 * card's exact name, a name holding the words ("verse 1" is in
 * "(1)-Verse 1"), or words holding the name. Null when none does.
 */
export function findSlideByWords(
    slides: readonly SlideSummaryType[],
    words: string,
): SlideSummaryType | null {
    const asNumber = /^(?:slide\s+)?(\d{1,3})$/i.exec(words.trim());
    if (asNumber !== null) {
        const n = Number(asNumber[1]);
        return (
            slides.find((slide) => {
                return slide.n === n;
            }) ?? null
        );
    }
    const wanted = toSlideKey(words.replace(/\s+of\s+.*$/i, ''));
    if (wanted.length === 0) {
        return null;
    }
    const named = slides.map((slide) => {
        return { slide, key: toSlideKey(slide.name ?? '') };
    });
    return (
        named.find(({ key }) => key === wanted)?.slide ??
        named.find(({ key }) => key.length > 0 && key.includes(wanted))
            ?.slide ??
        named.find(({ key }) => key.length > 0 && wanted.includes(key))
            ?.slide ??
        null
    );
}

function describeSlideList(selected: SelectedDocumentType) {
    return selected.slides
        .map((slide) => {
            return slide.name ? `${slide.n} "${slide.name}"` : `${slide.n}`;
        })
        .join(', ');
}

function genSlideListLine(selected: SelectedDocumentType) {
    return fillWords(tran('Its slides: {slides}.'), {
        slides: describeSlideList(selected),
    });
}

const NO_SLIDE_LIST_TEXT =
    '**The main window is not on the Presenter**, so there is no slide list to choose from.';
const NOTHING_SELECTED_ASK_AGAIN_TEXT =
    '**Nothing is selected in the Documents list.** Click the song there first, then ask again.';

/**
 * `/slide 3`, `/slide verse 1`: one slide of the selected song on the
 * screen by its number or its words, through the card's own `find`, the way
 * `/next` does. Typing it is the consent (rule 2 above).
 */
async function runSlide({ argument, report }: BuiltinRunContextType) {
    const finish = report(tran('Putting the slide on the screen'));
    try {
        const read = await readSelectedDocument();
        if (read === null) {
            return { text: tran(COULD_NOT_REACH_APP) };
        }
        if (!read.isPresenter) {
            return {
                text: tran(NO_SLIDE_LIST_TEXT),
                actions: NOT_ON_PRESENTER_ACTIONS,
            };
        }
        const selected = read.selected;
        if (selected === null) {
            return {
                text: tran(
                    '**Nothing is selected in the Documents list.** Click a ' +
                        'song there first.',
                ),
            };
        }
        if (argument.length === 0) {
            return {
                text:
                    fillWords(
                        tran(
                            'Say which slide of "{name}": `/slide 2` or ' +
                                '`/slide verse 1`.',
                        ),
                        { name: selected.name },
                    ) +
                    ' ' +
                    genSlideListLine(selected),
            };
        }
        const target = findSlideByWords(selected.slides, argument);
        if (target === null) {
            return {
                text:
                    fillWords(
                        tran('**"{name}" has no slide called "{words}".**'),
                        {
                            name: selected.name,
                            words: argument,
                        },
                    ) +
                    ' ' +
                    genSlideListLine(selected),
            };
        }
        return await presentSlideAndReport(selected, target, 'slide');
    } finally {
        finish();
    }
}

// "show verse 1 on the screen for me", "put slide 3 on the projector",
// "present (1)-Verse 1 on screen". The words between the verb and the
// screen are the slide; "how" anywhere is a how-do-I and not this.
const SLIDE_SHOW_ASK_PATTERN =
    /^(?:please\s+)?(?:can\s+you\s+|could\s+you\s+)?(?:show|put|display|present)\s+(?:me\s+)?(?:the\s+)?(?:slide\s+(?:of\s+)?)?(?!how\b)(.+?)\s+(?:on|onto|up\s+on|to)\s+(?:the\s+)?(?:screen|screens|projector|wall)(?:\s+for\s+me)?(?:\s+please)?[.!?]*$/i;
const SLIDE_SHORT_ASK_PATTERN =
    /^(?:please\s+)?(?:show|put\s+up|display|present)\s+((?:slide|verse|chorus|bridge|intro|outro|tag)\s*\d{1,3}|slide\s+.+?)(?:\s+for\s+me)?[.!?]*$/i;

/**
 * A slide asked for by its words, or null. Measured 2026-10-10 in the user's
 * own tab on qwen3.5-9b at 16k: "show verse 1 on screen for me" and "show
 * (1)-Verse 1 on screen for me" each ran the six rounds (65-71k tokens) and
 * ended in "it wrote no answer this time", when the app knows the card's own
 * words (`selectedDocument.slides[].find`) and one press puts it up.
 */
export function readSlideShowAsk(text: string): string | null {
    const trimmed = text.trim();
    if (/\bhow\b/i.test(trimmed)) {
        return null;
    }
    const match =
        SLIDE_SHOW_ASK_PATTERN.exec(trimmed) ??
        SLIDE_SHORT_ASK_PATTERN.exec(trimmed);
    if (match === null) {
        return null;
    }
    // "verse 1 of lyric file Amazing Grace": the song is the selected one.
    const words = match[1]
        .replace(
            /\s+of\s+(?:the\s+)?(?:lyric\s+file|song|document|lyric)\b.*$/i,
            '',
        )
        .trim();
    return words.length > 0 ? words : null;
}

/**
 * The answer to a slide asked for by its words, with no model: the slide
 * named and ONE button that puts it up (`/slide <n>`, typed by the press),
 * plus the screen's own show button when the screen is off. Null when the
 * selected song has no such slide -- "put John 3:16 on the screen" is a
 * verse, not a slide, and goes on to whoever answers verses.
 */
export async function answerSlideShowAsk(
    words: string,
): Promise<BotAnswerType | null> {
    const read = await readSelectedDocument();
    if (read === null) {
        return null;
    }
    if (!read.isPresenter) {
        return {
            text: tran(NO_SLIDE_LIST_TEXT),
            actions: NOT_ON_PRESENTER_ACTIONS,
        };
    }
    const selected = read.selected;
    if (selected === null) {
        return { text: tran(NOTHING_SELECTED_ASK_AGAIN_TEXT) };
    }
    const target = findSlideByWords(selected.slides, words);
    if (target === null) {
        return null;
    }
    return await genSlideOfferAnswer(selected, target);
}

// The slide named, and the ONE button that puts it up -- shared by a slide
// asked for by its words and by "the next one".
async function genSlideOfferAnswer(
    selected: SelectedDocumentType,
    target: SlideSummaryType,
): Promise<BotAnswerType> {
    const screens = await readScreens();
    const isShowing = screens?.isAnyShowing === true;
    return {
        text:
            fillWords(
                tran(
                    '**{slide} of "{name}"** -- press the button and it goes ' +
                        'on the screen',
                ),
                { slide: genSlideWords(target), name: selected.name },
            ) +
            (target.text ? ` ("${target.text}")` : '') +
            (isShowing
                ? '.'
                : '. ' +
                  tran(
                      'The screen is off, so it holds the slide until you ' +
                          'turn it on.',
                  )),
        actions: [
            // Nothing reads this label back (the press runs `/slide n`), so
            // it is written in the app's language.
            genCommandAction(
                target.name
                    ? fillWords(tran('Put {what} on the screen'), {
                          what: `"${target.name}"`,
                      })
                    : fillWords(tran('Put slide {n} on the screen'), {
                          n: target.n,
                      }),
                `/slide ${target.n}`,
            ),
            ...(isShowing
                ? []
                : [genCommandAction('Turn the screen on', '/screen-show')]),
        ],
    };
}

// "show the next slide", "go to the next slide", "put the next verse up",
// "next slide please", "show the previous slide".
const SLIDE_STEP_ASK_PATTERN =
    /^(?:please\s+)?(?:can\s+you\s+|could\s+you\s+)?(?:(?:show|put\s+up|put|display|present|go\s+to|move\s+(?:on\s+)?to|advance\s+to)\s+(?:me\s+)?)?(?:the\s+)?(next|previous)\s+(?:slide|verse|one)(?:\s+up)?(?:\s+(?:on|onto|to)\s+(?:the\s+)?(?:screens?|projector|wall))?(?:\s+for\s+me)?(?:\s+please)?[.!?]*$/i;

/**
 * The next slide, or the one before, asked for in words -- or null. Asked
 * _Show the next slide?_ on a server of the user's own (gemma-4-e4b,
 * 2026-10-13, at temperature 0 so every time), the model pressed **Slide 1**
 * itself, said nothing of it, and told the volunteer to click **Slide 2**.
 * The app knows which slide is next (`selectedDocument.next`, worked out the
 * arrow keys' way) and one press puts it up. A how-do-I is left alone.
 */
export function readSlideStepAsk(text: string): 'next' | 'previous' | null {
    const trimmed = text.trim();
    if (/\bhow\b/i.test(trimmed)) {
        return null;
    }
    const match = SLIDE_STEP_ASK_PATTERN.exec(trimmed);
    if (match === null) {
        return null;
    }
    return match[1].toLowerCase() === 'next' ? 'next' : 'previous';
}

/**
 * The answer, with no model: which slide that is and the ONE button that
 * puts it up -- a typed sentence is not the consent a press is. Null when
 * the app cannot be read, so the question goes on to whoever answers.
 */
export async function answerSlideStepAsk(
    direction: 'next' | 'previous',
): Promise<BotAnswerType | null> {
    const read = await readSelectedDocument();
    if (read === null) {
        return null;
    }
    if (!read.isPresenter) {
        return {
            text: tran(NO_SLIDE_LIST_TEXT),
            actions: NOT_ON_PRESENTER_ACTIONS,
        };
    }
    const selected = read.selected;
    if (selected === null) {
        return { text: tran(NOTHING_SELECTED_ASK_AGAIN_TEXT) };
    }
    const target = direction === 'next' ? selected.next : selected.previous;
    if (target === null) {
        return {
            text:
                direction === 'next'
                    ? fillWords(
                          tran('**"{name}" has no slide to go on to.**'),
                          {
                              name: selected.name,
                          },
                      )
                    : fillWords(
                          tran(
                              '**No slide of "{name}" is on a screen yet**, ' +
                                  'so there is none before it.',
                          ),
                          { name: selected.name },
                      ) +
                      ' ' +
                      genSlideListLine(selected),
        };
    }
    return await genSlideOfferAnswer(selected, target);
}

// "where is the button for Clear All", "where is the Clear All button",
// "where's Bible Lookup?", "where are the settings".
const WHERE_IS_ASK_PATTERN =
    /^(?:please\s+)?where(?:\s+is|\s+are|'s)\s+(?:the\s+|a\s+|my\s+)?(?:(?:button|control|icon|tab|box|switch|option)s?\s+(?:for|called|named|labell?ed|that\s+says)\s+)?(.+?)[\s.!?]*$/i;
const WHERE_IS_QUOTE_PATTERN = /^["'“”‘’]+|["'“”‘’]+$/g;
// A control's name, not a sentence: "where is the thing that puts the verse
// on the wall" is a question for whoever answers.
const WHERE_IS_MAX_WORDS = 6;
const WHERE_IS_MAX_LENGTH = 48;

/**
 * The control a where-is names, or null. The list's own fill-in, _Where is
 * the button for ..._, finished as _Clear All_ and asked of a local model
 * (gemma-4-e4b, 2026-10-13): four rounds and 42 500 tokens of reading the
 * guide, never a look at the window, and _the Clear All button is located in
 * the header section of the Presenter window_ -- it is in the Mini Screen
 * panel, bottom right. The window can look for itself in a tenth of the
 * time (`answerWhereIsAsk`).
 */
export function readWhereIsAsk(text: string): string | null {
    const match = WHERE_IS_ASK_PATTERN.exec(text.trim());
    if (match === null) {
        return null;
    }
    const target = match[1].replace(WHERE_IS_QUOTE_PATTERN, '').trim();
    if (
        !/[\p{L}\p{N}]/u.test(target) ||
        target.length > WHERE_IS_MAX_LENGTH ||
        target.split(/\s+/).length > WHERE_IS_MAX_WORDS
    ) {
        return null;
    }
    return target;
}

/**
 * The answer, with no model: the control outlined where it is, in the
 * guide's own words (`answerWhereIs`). ONLY when the window has a control
 * CALLED that on show -- an exact name, or the one control the words fit
 * (**Clear All [F6]** for _Clear All_). A looser fit is some other control,
 * and nothing found may be a thing the guide explains: both go on to whoever
 * answers, as does a look that could not be made.
 */
export async function answerWhereIsAsk(
    target: string,
    focus: BotFocusType,
): Promise<BotAnswerType | null> {
    try {
        const found = parseToolJson(
            await callTool('owa_find_ui', {
                text: target,
                page: `${focus}.html`,
            }),
        );
        const matches: any[] = Array.isArray(found?.matches)
            ? found.matches
            : [];
        const visible = matches.filter((match) => {
            return match?.isVisible === true;
        });
        const isNamedSo =
            visible.some((match) => {
                return match.tier === 0;
            }) ||
            (found?.count === 1 &&
                visible.length === 1 &&
                visible[0].tier === 1);
        if (!isNamedSo) {
            return null;
        }
        return await answerWhereIs(target, focus);
    } catch (_error) {
        return null;
    }
}

// "turn the screen off for me", "turn off the projector", "switch the
// screens on", "hide the screen", "screen off".
const SCREEN_OFF_ASK_PATTERN =
    /^(?:please\s+)?(?:can\s+you\s+|could\s+you\s+)?(?:(?:turn|switch|put)\s+(?:the\s+)?(?:screens?|projector)\s+off|(?:turn|switch)\s+off\s+(?:the\s+)?(?:screens?|projector)|hide\s+(?:the\s+)?(?:screens?|projector)|(?:screens?|projector)\s+off)(?:\s+for\s+me)?(?:\s+please)?[.!?]*$/i;
const SCREEN_ON_ASK_PATTERN =
    /^(?:please\s+)?(?:can\s+you\s+|could\s+you\s+)?(?:(?:turn|switch|put)\s+(?:the\s+)?(?:screens?|projector)\s+on|(?:turn|switch)\s+on\s+(?:the\s+)?(?:screens?|projector)|show\s+(?:the\s+)?(?:screens?|projector)|(?:screens?|projector)\s+on)(?:\s+for\s+me)?(?:\s+please)?[.!?]*$/i;

/**
 * A screen asked on or off in words, or null. Measured 2026-10-10 on
 * gemma-4-e4b with every screen already off: "Turn off the screen for me"
 * was answered "First, we need to make sure everything is cleared from the
 * projector. 1. Click the Clear All [F6] button" with a "Yes, clear all"
 * option -- a turn-off read as a clear, which would wipe the verse and
 * background held for the service.
 */
export function readScreenToggleAsk(text: string): 'show' | 'hide' | null {
    const trimmed = text.trim();
    if (SCREEN_OFF_ASK_PATTERN.test(trimmed)) {
        return 'hide';
    }
    return SCREEN_ON_ASK_PATTERN.test(trimmed) ? 'show' : null;
}

/**
 * The answer, with no model: the screens as they are, and the ONE button
 * that does what was asked -- never a Clear. A typed sentence is not the
 * consent a press is (rule 2 above), so the button does it, not the ask.
 */
export async function answerScreenToggleAsk(
    kind: 'show' | 'hide',
): Promise<BotAnswerType> {
    const state = await readScreens();
    if (state === null) {
        return { text: tran(COULD_NOT_REACH_APP) };
    }
    if (kind === 'hide') {
        if (!state.isAnyShowing) {
            return {
                text:
                    tran('**Nothing to turn off.**') +
                    ' ' +
                    describeScreens(state),
                actions: [
                    genCommandAction('Turn the screen on', '/screen-show'),
                ],
            };
        }
        return {
            text:
                describeScreens(state) +
                ' ' +
                tran('Press the button to turn it off.'),
            actions: [
                genCommandAction('Turn every screen off', '/screen-hide'),
            ],
        };
    }
    if (state.isAnyShowing) {
        return {
            text:
                tran('**The screen is already on.**') +
                ' ' +
                describeScreens(state),
            actions: [
                genCommandAction('Turn every screen off', '/screen-hide'),
            ],
        };
    }
    return {
        text:
            describeScreens(state) +
            ' ' +
            tran('Press the button to turn it on.'),
        actions: [genCommandAction('Turn the screen on', '/screen-show')],
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
            text: tran(
                '**Say which passage** -- for example `/verse John 3:16` or ' +
                    '`/verse Psalm 23:1-6`.',
            ),
        };
    }
    const finish = report(
        fillWords(tran('Putting {reference} on the screen'), { reference }),
    );
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
                    : fillWords(
                          tran(
                              '**I could not put "{reference}" on the screen ' +
                                  'just now.** Write it as book, chapter and ' +
                                  'verse -- `/verse John 3:16` -- from the ' +
                                  'Presenter page.',
                          ),
                          { reference },
                      ),
                actions: NOT_ON_PRESENTER_ACTIONS,
            };
        }
        if (result === null) {
            return { text: tran(COULD_NOT_REACH_APP) };
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
            return { text: tran(COULD_NOT_REACH_APP) };
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
            text: tran(
                '**Say how long** -- `/countdown 5` for five minutes, ' +
                    '`/countdown 10:30` to count down to a time, or ' +
                    '`/countdown stop` to take it off.',
            ),
        };
    }
    if ('stop' in ask) {
        return await runForegroundCommand(
            context,
            { action: 'stop', widget: 'countdown' },
            tran('Taking the countdown off the screen'),
            tran(
                'I could not take the countdown off just now. Press F10 ' +
                    '(Clear Foreground) on the Presenter page.',
            ),
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
            ? fillWords(tran('Starting a {minutes} minute countdown'), {
                  minutes: ask.minutes,
              })
            : fillWords(tran('Starting a countdown to {time}'), {
                  time: ask.at,
              }),
        tran(
            'I could not start the countdown just now. Try again from the ' +
                'Presenter page -- `/countdown 5`.',
        ),
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
    const isTop = widget === 'marquee-top';
    return async (context: BuiltinRunContextType) => {
        const text = context.argument.trim().replace(/\s+/g, ' ');
        if (text === '') {
            return {
                text: fillWords(
                    tran(
                        '**Say the words to scroll** -- `/{command} Please ' +
                            'silence your phones`; `/{command} stop` takes ' +
                            'it off.',
                    ),
                    { command },
                ),
            };
        }
        if (/^(?:stop|off|hide|clear|end|cancel)$/i.test(text)) {
            return await runForegroundCommand(
                context,
                { action: 'stop', widget },
                tran('Taking the scrolling message off the screen'),
                tran(
                    'I could not take the message off just now. Press F10 ' +
                        '(Clear Foreground) on the Presenter page.',
                ),
                `/${command} stop`,
            );
        }
        return await runForegroundCommand(
            context,
            { widget, text },
            isTop
                ? tran(
                      'Putting a scrolling message along the top of the screen',
                  )
                : tran(
                      'Putting a scrolling message along the bottom of the ' +
                          'screen',
                  ),
            fillWords(
                tran(
                    'I could not put the message on the screen just now. ' +
                        'Try again from the Presenter page -- `/{command} ' +
                        '<words>`.',
                ),
                { command },
            ),
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
            text: tran(
                '**Give me the song** -- its title (`/lyric Amazing ' +
                    'Grace`), the address of the page it is on ' +
                    '(`/lyric https://…`), or paste its words after the ' +
                    'command. I will write it out for the Lyric Editor and ' +
                    'offer a button that saves it; nothing is saved until ' +
                    'you press it.',
            ),
        };
    }
    const address = readSongAddress(words);
    if (address !== null) {
        const site = toSiteName(address) ?? tran('the page');
        const finish = report(
            fillWords(tran('Reading {site} and writing the song out'), {
                site,
            }),
        );
        try {
            return await answerLyricLink(address);
        } finally {
            finish();
        }
    }
    // One short line is a TITLE: `/lyric Amazing Grace`. A song's words are
    // never one line, so nothing a paste could mean is taken from it.
    const title = readSongTitleArgument(words);
    if (title !== null) {
        const finishLookup = report(
            fillWords(tran('Looking up “{title}”'), { title }),
        );
        try {
            return await answerLyricTitle(title);
        } finally {
            finishLookup();
        }
    }
    const finish = report(tran('Writing the song out'));
    try {
        const answer = await answerLyricPaste(words);
        if (answer !== null) {
            return answer;
        }
        return {
            text: tran(
                'That did not read as the words of a song. Give me the ' +
                    'address of the page it is on (`/lyric https://…`), or ' +
                    'paste the words themselves, a line each, with a label ' +
                    'like *Verse 1* or *Chorus* over each part.',
            ),
        };
    } catch (error) {
        appError(error, 'builtin /lyric');
        return {
            text: tran(
                'I could not write that song out just now. Try again in a ' +
                    'moment, or paste the words as plain lines.',
            ),
        };
    } finally {
        finish();
    }
}

/** The one command that goes to a model: see `readGeneralQuestion`. */
export const GENERAL_QUESTION_COMMAND = 'btw';

/** The one command the WINDOW runs: `/clear` empties the tab in front. */
export const CLEAR_CHAT_COMMAND = 'clear';

/**
 * The commands that act on, or read, what the PRESENTER page alone holds --
 * the screens' show / hide / clear buttons, the selected document and the
 * run sheet, a verse or a countdown put up. Offered and run only where they
 * work (2026-10-10, the user's ask with a picture of `/clear-all` offered
 * under Bible Reader: "commands also have to be picky the page … but because
 * bible reader also part of presenter so it should available in presenter as
 * well"): these on the Presenter, every other command everywhere -- a
 * command of the Reader's own would be filed `['reader', 'presenter']`, the
 * Presenter holding the Reader's lookup too. `/screen` stays everywhere: it
 * says whether a screen is on from any page, and offers the Presenter.
 */
const COMMAND_PAGE_MAP: Record<string, BotFocusType[]> = {
    'screen-show': ['presenter'],
    'screen-hide': ['presenter'],
    'screen-clear-all': ['presenter'],
    'screen-clear-background': ['presenter'],
    'screen-clear-slide': ['presenter'],
    'screen-clear-bible': ['presenter'],
    'screen-clear-foreground': ['presenter'],
    selected: ['presenter'],
    run: ['presenter'],
    next: ['presenter'],
    previous: ['presenter'],
    slide: ['presenter'],
    verse: ['presenter'],
    countdown: ['presenter'],
    marquee: ['presenter'],
    'marquee-top': ['presenter'],
};

/** Whether a command is offered and run for the page a tab is asking about. */
export function checkIsCommandOnPage(
    action: BuiltinActionType,
    focus: BotFocusType | undefined,
) {
    const pages = COMMAND_PAGE_MAP[action.name];
    return pages === undefined || focus === undefined || pages.includes(focus);
}

function toFocusLabel(focus: BotFocusType) {
    return (
        BOT_FOCUS_LIST.find((one) => {
            return one.key === focus;
        })?.label ?? focus
    );
}

/** The refusal for a Presenter command typed under another page. */
function genCommandOffPageAnswer(
    action: BuiltinActionType,
    focus: BotFocusType,
): BotAnswerType {
    return {
        text: fillWords(
            tran(
                '`/{command}` works on the Presenter page, and this chat is ' +
                    'asking about the {window}. Switch the main window to ' +
                    'the Presenter, choose **{presenter}** under ' +
                    '{askingAbout} at the top, and type it again.',
            ),
            {
                command: action.name,
                window: tranLabel(toFocusLabel(focus)),
                presenter: tranLabel('Presenter'),
                // The picker's own caption (`Asking about`), as it reads.
                askingAbout: tranLabel('ASKING ABOUT'),
            },
        ),
        actions: [genCommandAction('Go to the Presenter', '/goto presenter')],
    };
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
    // The clears carry the screen's prefix (2026-10-10, the user's ask:
    // "command should have prefix, e.g. `/clear-all` should be
    // `/screen-clear-all`, add `/clear` to clear the chat session"); the
    // old spellings stay as aliases, so a habit and an old answer's button
    // still work, and the bare `/clear` went to the chat.
    {
        name: 'screen-clear-all',
        aliases: ['clear-all', 'screen-clear'],
        hint: 'Clear everything off the screen (F6)',
        takesArgument: false,
        isActing: true,
        run: genClearRunner('clear-all'),
    },
    {
        name: 'screen-clear-background',
        aliases: ['clear-background', 'clear-bg', 'screen-clear-bg'],
        hint: 'Clear the background (F7)',
        takesArgument: false,
        isActing: true,
        run: genClearRunner('clear-background'),
    },
    {
        name: 'screen-clear-slide',
        aliases: ['clear-slide', 'clear-sl'],
        hint: 'Clear the slide (F8)',
        takesArgument: false,
        isActing: true,
        run: genClearRunner('clear-slide'),
    },
    {
        name: 'screen-clear-bible',
        aliases: [
            'clear-bible',
            'clear-bb',
            'clear-verse',
            'screen-clear-verse',
            // The button reads `LT` / Clear Long Text since 2026-10-13.
            'screen-clear-long-text',
            'clear-long-text',
            'clear-lt',
        ],
        hint: 'Clear the Bible passage or long text (F9)',
        takesArgument: false,
        isActing: true,
        run: genClearRunner('clear-bible'),
    },
    {
        name: 'screen-clear-foreground',
        aliases: ['clear-foreground', 'clear-fg', 'screen-clear-fg'],
        hint: 'Clear the countdown, marquee and clock (F10)',
        takesArgument: false,
        isActing: true,
        run: genClearRunner('clear-foreground'),
    },
    {
        name: CLEAR_CHAT_COMMAND,
        aliases: ['clear-chat', 'chat-clear'],
        hint: 'Clear this chat — every message in this tab',
        takesArgument: false,
        isActing: false,
        // The window itself empties the tab (`ChatbotAppComp`, before any
        // message is written): a command module cannot reach the tabs, and
        // an answer under an emptied tab would be its first message.
        run: async () => {
            return {
                text: tran(
                    'Type `/clear` in the chat window to clear the chat in ' +
                        'front of you.',
                ),
            };
        },
    },
    {
        name: 'find',
        aliases: ['where', 'point'],
        hint: 'Outline a control in the app: /find Clear Long Text',
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
        name: 'slide',
        aliases: ['show-slide', 'slide-show', 'goto-slide'],
        hint: 'Put one slide of the selected song up: /slide 3, /slide verse 1',
        takesArgument: true,
        isActing: true,
        run: runSlide,
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
        hint: 'Write a song out from its title, a web page, or pasted words',
        takesArgument: true,
        // It reaches OUT (the page is read, rationed and announced in the app
        // window by the firewall) and it never touches the projector; what
        // it writes waits on the Create button.
        isActing: false,
        run: runLyric,
    },
    {
        // The one command that DOES go to a model: see `readGeneralQuestion`.
        // Listed here so `/` offers it and `/commands` names it; this `run`
        // only answers the bare `/btw` with how to use it.
        name: GENERAL_QUESTION_COMMAND,
        aliases: ['general', 'anything'],
        hint: 'Ask the assistant a general question, not about this app',
        takesArgument: true,
        isActing: false,
        run: runGeneralUsage,
    },
    {
        name: 'tips',
        aliases: ['tip', 'show-tips'],
        hint: 'Show the tips above the box again, and one of them now',
        takesArgument: false,
        isActing: false,
        run: runTips,
    },
    {
        name: 'commands',
        aliases: ['?', 'list'],
        hint: 'List every command',
        takesArgument: false,
        isActing: false,
        run: async ({ focus }) => {
            return genCommandList(focus);
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
 *
 * The list is for finishing a NAME, so it has nothing to say once there is
 * nothing left of one to finish (2026-10-10, the user's ask, with a picture of
 * `/btw` still offered over `/btw what is`): a space after the name means the
 * words have started, and a name typed in full is not offered back -- though
 * a longer one that starts with it still is (`/screen` leaves `/screen-show`
 * and `/screen-hide`). An ALIAS typed in full keeps its row: `/clear` under
 * the box does not say it means `/clear-all`, and the row is what does.
 */
export function matchBuiltinActions(
    query: string,
    limit = 8,
    focus?: BotFocusType,
) {
    const line = query.trimStart();
    if (!line.startsWith('/')) {
        return [];
    }
    const typed = line.slice(1).toLowerCase();
    if (/\s/.test(typed)) {
        return [];
    }
    return BUILTIN_ACTION_LIST.filter((one) => {
        // Not where it does not work (`COMMAND_PAGE_MAP`): a Presenter
        // command under a Reader tab is a button for a room nobody is in.
        if (one.name === typed || !checkIsCommandOnPage(one, focus)) {
            return false;
        }
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

/**
 * `/btw <words>` -- "by the way" -- is a question that is NOT about this
 * app, put to the assistant as general knowledge (2026-10-10, asked for by
 * the user: _add command `/btw` to let assistant know it about asking general
 * question, e.g. `/btw "what is holy bible"`_). Every other command runs with
 * no model; this one is the opposite, a model with no tools: the words go
 * to the assistant framed as general (`toGeneralQuestionAsk`), in one round,
 * with nothing of the app looked up and no walkthrough offered -- without the
 * frame, the system prompt sends every question to the manual and _what is
 * the Bible?_ comes back as how to open the Bible Reader.
 *
 * The words, with the quotes the example was typed with taken off, or null
 * when the line is not this command or carries no words -- the bare `/btw`
 * then runs as a command and says how to use it (`runGeneralUsage`).
 */
export function readGeneralQuestion(text: string): string | null {
    const parsed = parseBuiltinCommand(text);
    if (parsed === null || parsed.action?.name !== GENERAL_QUESTION_COMMAND) {
        return null;
    }
    const words = parsed.argument
        .replace(/^["'“”‘’]+/, '')
        .replace(/["'“”‘’]+$/, '')
        .trim();
    return words.length > 0 ? words : null;
}

/**
 * A plain follow-up under a general question is a general question too:
 * "in Khmer please" typed under "/btw what is the Bible?" is about the
 * Bible, not about the app -- measured 2026-10-10 on the user's LM Studio
 * (gemma-4-e4b), it went the app road, cost 10.2k tokens, and the model
 * declined it as its helper "for the Open Worship App". The user's ask,
 * with that picture: "the follow up prompt should inherit command from
 * previous, e.g. the previous one is `/btw` then the next should be
 * following".
 *
 * Read off the LAST question in the tab: one typed with `/btw`, or one that
 * inherited it (`isGeneral` on the message), so a chain of follow-ups holds.
 * A slash line of any kind is never inherited -- a command is a new thing to
 * do, and it is also how a tab goes back to app questions -- and nor is an
 * empty box. The words come back as they are; the frame is the caller's.
 */
// The app's own nouns. A follow-up under a `/btw` that names one is an app
// question again, whatever came before it: "How do I cast the virtual
// display to a TV from my phone?" typed under "/btw how do I screen cast my
// screen on my TV?" was answered as general knowledge -- "casting a virtual
// display from your phone isn't typically possible" -- when the app has that
// very button (the user's ask, 2026-10-10, with a picture of it: "it should
// guide through to the casting button … without `/btw` the chatbot should try
// best to provide app guiding"). Words, not the corpus: a paraphrase the
// corpus does not carry still says "display".
const APP_WORD_PATTERN = new RegExp(
    '\\b(?:app|open worship|window|button|menu|setting|settings|tab|panel|' +
        'screen|screens|projector|display|displays|monitor|cast|casting|' +
        'mirror|mirroring|slide|slides|song|songs|lyric|lyrics|hymn|' +
        'bible|verse|verses|passage|chapter|reader|presenter|editor|' +
        'background|foreground|countdown|stopwatch|marquee|clock|' +
        'document|documents|folder|flow|run sheet|presenting|font|theme|' +
        'shortcut|keyboard|camera|pdf|powerpoint|walkthrough)\\b',
    'i',
);

/** Whether a line names something of this app, by its words alone. */
export function checkLooksLikeAppQuestion(text: string) {
    return APP_WORD_PATTERN.test(text);
}

export function readInheritedGeneralQuestion(
    text: string,
    messages: { author: 'you' | 'bot'; text: string; isGeneral?: true }[],
): string | null {
    const trimmed = text.trim();
    if (
        trimmed.length === 0 ||
        trimmed.startsWith('/') ||
        checkLooksLikeAppQuestion(trimmed)
    ) {
        return null;
    }
    const lastQuestion = [...messages].reverse().find((message) => {
        return message.author === 'you';
    });
    if (lastQuestion === undefined) {
        return null;
    }
    const wasGeneral =
        lastQuestion.isGeneral === true ||
        readGeneralQuestion(lastQuestion.text) !== null;
    return wasGeneral ? trimmed : null;
}

async function runGeneralUsage(): Promise<BotAnswerType> {
    return {
        text: tran(
            '**Say the question after /btw** -- `/btw What is the Bible?` ' +
                '-- and the assistant answers it from its own knowledge ' +
                'instead of looking in this app’s guide. It takes an ' +
                'assistant (a key in Settings → Others, or a server of your ' +
                'own): the built-in guide cannot answer a general question.',
        ),
    };
}

function genCommandList(focus?: BotFocusType): BotAnswerType {
    const here = BUILTIN_ACTION_LIST.filter((one) => {
        return checkIsCommandOnPage(one, focus);
    });
    const elsewhere = BUILTIN_ACTION_LIST.filter((one) => {
        return !checkIsCommandOnPage(one, focus);
    });
    const lines = here.map((one) => {
        // A hint is stored in English (the suggestion list draws it too)
        // and is translated where it is shown.
        return `- \`/${one.name}\` -- ${tranLabel(one.hint)}`;
    });
    // The Presenter's own, named so they are not a secret from a Reader tab
    // -- one line, not a second list.
    const elsewhereText =
        elsewhere.length === 0
            ? ''
            : '\n\n' +
              fillWords(
                  tran(
                      '**On the Presenter page** (switch there first): ' +
                          '{commands}.',
                  ),
                  {
                      commands: elsewhere
                          .map((one) => {
                              return `\`/${one.name}\``;
                          })
                          .join(', '),
                  },
              );
    return {
        text:
            tran(
                '**Commands you can type** -- each one runs on the spot, ' +
                    'with no assistant and no internet (except `/btw`, ' +
                    'which puts a general question to the assistant):',
            ) +
            '\n\n' +
            lines.join('\n') +
            elsewhereText +
            '\n\n' +
            tran('Type `/` and the list appears as you type.'),
        actions:
            elsewhere.length === 0
                ? [
                      genCommandAction('Is the screen on?', '/screen'),
                      genCommandAction('Turn the screen on', '/screen-show'),
                  ]
                : [
                      genCommandAction('Is the screen on?', '/screen'),
                      genCommandAction(
                          'Go to the Presenter',
                          '/goto presenter',
                      ),
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
/**
 * `/tips`: the 💡 line back above the box -- put away for 30 days by its ✕,
 * and nothing else brought it back before the month was out -- and one of
 * its tips said here and now.
 */
async function runTips(): Promise<BotAnswerType> {
    const wasHidden = checkIsChatTipHidden();
    showChatTips();
    const tip = pickChatTip(null);
    return {
        text:
            (wasHidden
                ? tran('The tips are back, on the line above the box.')
                : tran('The tips are on the line above the box.')) +
            ' ' +
            tran(
                'Press a tip for another one, or the arrows beside it to go ' +
                    'through them all. Here is one:',
            ) +
            `\n\n💡 ${tranLabel(tip.text)}`,
    };
}

async function runCredit({ usage }: BuiltinRunContextType) {
    // The head row's own caption, as it reads there.
    const credit = { credit: tranLabel('Credit used') };
    if (usage === undefined || usage.rounds === 0) {
        return {
            text: fillWords(
                tran(
                    'Nothing has been spent in this chat yet: no question ' +
                        'here has been put to an assistant. The figure ' +
                        'appears under each answer, and **{credit}** under ' +
                        'the pickers at the top keeps the total.',
                ),
                credit,
            ),
        };
    }
    return {
        text:
            fillWords(tran('**This chat so far: {cost} · {tokens} tokens.**'), {
                cost: toCostLabel(usage),
                tokens: toCompactCount(toTotalTokens(usage)),
            }) +
            '\n\n' +
            describeUsageInFull(usage).replace(/\n/g, '\n\n') +
            '\n\n' +
            fillWords(
                tran(
                    'Each tab keeps its own total; the same figure sits ' +
                        'under **{credit}** at the top, and every answer ' +
                        'carries its own.',
                ),
                credit,
            ) +
            `\n\n${describeSpendGuard(getSpendState())} ` +
            tran('Type `/limit` to change the limit.'),
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
                state.limitUsd === null
                    ? tran('Carrying on: the hour starts again from now.')
                    : fillWords(
                          tran(
                              'Carrying on: the hour starts again from now, ' +
                                  'with {limit} available before I pause ' +
                                  'again.',
                          ),
                          { limit: toSpendLimitLabel(state.limitUsd) },
                      ),
        };
    }
    if (word.length > 0) {
        const limit = parseSpendLimitValue(word);
        if (limit === undefined) {
            return {
                text: fillWords(
                    tran(
                        'I do not read "{words}" as a limit. Say a number of ' +
                            'dollars an hour (`/limit 2`, `/limit 0.50`), ' +
                            '`/limit off` to keep only the pace cap, or ' +
                            '`/limit more` to carry on after a pause.',
                    ),
                    { words: argument.trim() },
                ),
            };
        }
        const state = setSpendLimitUsd(limit);
        return {
            text:
                (limit === null
                    ? fillWords(
                          tran(
                              '**The money cap is off.** The assistant will ' +
                                  'still pause after {count} model calls in ' +
                                  'one hour, which is more than a person ' +
                                  'asks for.',
                          ),
                          { count: MAX_SPEND_ROUNDS_PER_HOUR },
                      )
                    : fillWords(
                          tran(
                              '**The limit is now {limit} an hour.** At that ' +
                                  'point the assistant pauses and asks ' +
                                  'before spending more.',
                          ),
                          { limit: toSpendLimitLabel(limit) },
                      )) +
                '\n\n' +
                describeSpendGuard(state),
        };
    }
    const state = getSpendState();
    const choices = SPEND_LIMIT_CHOICE_LIST.map(toSpendLimitLabel).join(', ');
    return {
        text:
            fillWords(tran('**Limit: {limit} an hour.**'), {
                limit: toSpendLimitLabel(state.limitUsd),
            }) +
            ` ${describeSpendGuard(state)}\n\n` +
            fillWords(
                tran(
                    'Change it with `/limit <dollars>` or the **{picker}** ' +
                        'picker at the top ({choices}), or `/limit off` to ' +
                        'keep only the pace cap.',
                ),
                // The head row's own caption, as it reads there.
                { picker: tranLabel('Limit per hour'), choices },
            ),
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
        const list = genCommandList(focus);
        return {
            ...list,
            text:
                (parsed === null
                    ? ''
                    : fillWords(
                          tran('I do not know a command called `/{name}`.'),
                          { name: parsed.name },
                      ) + '\n\n') + list.text,
        };
    }
    // Typed under a page it does not work on: said, with the way there,
    // rather than a press that finds no button (`COMMAND_PAGE_MAP`).
    if (!checkIsCommandOnPage(parsed.action, focus)) {
        return genCommandOffPageAnswer(parsed.action, focus);
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
            text: fillWords(
                tran(
                    'I could not do `/{name}` just now. Try again in a ' +
                        'moment, or ask me in words and I will find another ' +
                        'way.',
                ),
                { name: parsed.action.name },
            ),
        };
    }
}
