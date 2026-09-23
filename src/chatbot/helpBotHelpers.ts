// Turns a question into MCP tool calls and an answer.
//
// The answers come from the app's own manual (`owa_help_search`), which is
// generated from the live-verified workflow recipes -- so the bot can only
// tell a user something that was observed working in the real app. Nothing is
// invented, and no model or network is involved: this runs on the operator's
// machine, mid-service, possibly offline.
//
// Who is asking matters more than any of that: a volunteer minutes before a
// service, not a programmer. So this half searches the MANUAL only -- the
// internal developer notes are reachable through the tools, and are never what
// a user is shown -- and nothing it prints carries a document id, a file path
// or a code name.
//
// An LLM can be layered on later by handing it the same tools; that is exactly
// what `owa-devtools-mcp` exposes.

import type {
    BotFocusDescriptorType,
    BotFocusType,
} from '../../tools/owa-devtools-mcp/botFocus.d.mts';
import {
    BOT_FOCUS_LIST,
    DEFAULT_BOT_FOCUS,
    detectBotFocus,
    getBotFocus,
    toBotFocus,
} from '../../tools/owa-devtools-mcp/botFocus.mjs';

import { appError } from '../helper/loggerHelpers';
import {
    checkIsBrowserCheckRefusal,
    checkIsLyricPaste,
    keepDraftedLyric,
    LYRIC_COPY_TOOL_NAME,
    LYRIC_CREATE_TOOL_NAME,
    readDraftedLyric,
    readDraftReport,
    readSongLinkAsk,
} from './lyricDraftHelpers';
import { callTool, parseToolJson } from './mcpClient';
import { toSiteName } from './progressHelpers';
import type { AttachRequestType, ShowRefType } from './quickReplyHelpers';
import { describeScreenContent } from '../../tools/owa-devtools-mcp/agentScreens.mjs';
import {
    describeRunSheet,
    describeSelectedDocument,
} from '../../tools/owa-devtools-mcp/agentPresenter.mjs';
import bibleModel from '../helper/bible-helpers/kjvBibleConfig.json';

/**
 * The app is many windows, and the same question has a different answer in
 * each: "where is the clear button" means the presenter's, and there is none at
 * all in the Lyric Editor. The user says which window they are in, and the
 * whole answer follows it -- which page is searched for the control, and which
 * part of the manual is favoured.
 *
 * Declared once, in `tools/owa-devtools-mcp/botFocus.mjs`, because the MCP
 * server's tool schemas and the manual's own focus filter have to agree with
 * this window's picker to the letter: the key is spliced into
 * `page: "<key>.html"` by every tool call an answer makes.
 */
export type { BotFocusDescriptorType, BotFocusType };
export { BOT_FOCUS_LIST, DEFAULT_BOT_FOCUS, getBotFocus, toBotFocus };

export type BotActionType = {
    label: string;
    // An action either calls a tool directly, or -- when only a model can work
    // out what to press -- asks the model a follow-up question in the user's
    // place. `ask` wins when both are set.
    toolName?: string;
    args?: any;
    ask?: string;
};

export type BotAnswerType = {
    text: string;
    actions?: BotActionType[];
    // Short things the user can PRESS instead of typing their next message --
    // written by the model when it wrote the answer. Not tool calls: pressing
    // one asks it as the user's own words. See `quickReplyHelpers`.
    replies?: string[];
    // What the assistant says it needs to SEE before it can answer -- a
    // screenshot, a control pointed at, a file. Each becomes a button that
    // attaches the thing rather than a sentence asking the user to work out
    // how. See `parseAttachRequests`.
    attachRequests?: AttachRequestType[];
    // Things the ANSWER offers to show: a control to ring, a file to
    // open. Drawn as the same chips a question carries, pressed the same
    // way. See `parseAnswerShows`.
    shows?: ShowRefType[];
};

/**
 * One message already in this tab. The window keeps more on each of them; this
 * is every part of one that is worth sending back with the next question, and
 * it lives here rather than beside the tabs because both bots take it.
 */
export type ChatTurnType = {
    author: 'you' | 'bot';
    text: string;
};

type HelpHitType = {
    id: string;
    title: string;
    section: string;
    excerpt: string;
};

// The walkthrough is offered on every manual answer: reading four steps and
// then hunting for four buttons is exactly what this user cannot do while a
// service is starting.
export function genGuideActions(
    hit: { id: string },
    focus: BotFocusType,
    canAsk = false,
    // What the walkthrough is FOR, in the user's own words. Without it the
    // model is handed "do it for me" with no subject and can only ask back
    // what it should demo -- which is the button doing nothing, again.
    topic = '',
): BotActionType[] {
    const isReaderTextTooSmall =
        hit.id === 'W-11' &&
        focus === 'reader' &&
        /(?:(?:small|tiny).*(?:words?|text|font)|(?:words?|text|font).*(?:small|tiny|larger|bigger))/i.test(
            topic,
        );
    return [
        {
            // A recipe can only mark a control by bolding it, and the words
            // it bolds are as often a keystroke or a stressed word. Worse,
            // some controls have no name in ANY sentence: the Bible version
            // dropdown reads "KJV", so "switch the version from the header
            // dropdown" cannot point at it however the matching is done. A
            // step nobody can circle is the one thing a walkthrough must
            // not have -- "do this in the window behind me" is what the user
            // was already stuck on. Only something that can LOOK at the
            // window resolves that, so with a model configured the card is
            // built by the model, and the recipe stays the offline path.
            label: 'Show me step by step',
            ask: canAsk
                ? 'Show me step by step in the app window' +
                  (topic.length > 0 ? `: ${topic}` : '') +
                  ' — put the card up now and circle the control I have ' +
                  'to click for each step.'
                : undefined,
            toolName: 'owa_guide_start',
            args: {
                manualId: hit.id,
                page: `${focus}.html`,
                mode: 'show',
                ...(topic.length > 0 ? { topic } : {}),
            },
        },
        {
            // Same walkthrough, one press per step, each press doing the step
            // instead of describing it. Never more than one: nothing runs
            // ahead of the person watching it.
            //
            // Pressing this used to replay the RECIPE, and a recipe names its
            // controls only by bolding them -- so a page whose steps bold a
            // keystroke ("Tab") or a stressed word ("version") produced a card
            // that could not press a single thing, and every press apologised.
            // A model can do what the recipe cannot: look at the window, find
            // the control that is really there, and write the step around it.
            // So with a model configured this asks it to, and only the offline
            // bot still replays the recipe.
            label: 'Do it for me',
            // Written as a person would say it: it is shown in the chat as
            // the user's own message, so no tool name and no underscores
            // for the markdown renderer to eat.
            ask: isReaderTextTooSmall
                ? undefined
                : canAsk
                  ? 'Do it for me in the app window' +
                    (topic.length > 0 ? `: ${topic}` : '') +
                    ' — use the controls that are on screen, put the demo ' +
                    'card up now, and do NOT press a step yet. The person will ' +
                    'press Do it for one visible step at a time.'
                  : undefined,
            toolName: 'owa_guide_start',
            args: isReaderTextTooSmall
                ? {
                      demoId: 'reader-font-larger',
                  }
                : {
                      manualId: hit.id,
                      page: `${focus}.html`,
                      mode: 'demo',
                      ...(topic.length > 0 ? { topic } : {}),
                  },
        },
    ].filter((_action, index) => {
        // A recipe can point, but its prose cannot safely operate live
        // controls. Without a model to rebuild exact steps, showing a Do it
        // button promises more than the app can deliver.
        return canAsk || index === 0;
    });
}

type ReaderButtonReferenceType = {
    book: string;
    chapter: number;
    verse: number;
};

function readReaderButtonReference(
    question: string,
    focus: BotFocusType,
): ReaderButtonReferenceType | null {
    if (
        focus !== 'reader' ||
        !/(?:book|chapter)\s+buttons?|khmer|non[- ]english|another language/i.test(
            question,
        )
    ) {
        return null;
    }
    const books = Object.values(bibleModel.keyBookMap).sort(
        (left, right) => right.length - left.length,
    );
    for (const book of books) {
        const escaped = book
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\s+/g, '\\s+');
        const match = new RegExp(
            `(?:^|\\b)${escaped}\\s+(\\d{1,3}):(\\d{1,3})\\b`,
            'i',
        ).exec(question);
        if (match !== null) {
            return {
                book,
                chapter: Number(match[1]),
                verse: Number(match[2]),
            };
        }
    }
    return null;
}

/**
 * A guaranteed mouse-first route for a reference typed in English while the
 * selected Bible uses localized book names and numerals. The visible buttons
 * keep their local text; stable English titles let the guide target the exact
 * same book/chapter without asking a senior to copy characters they cannot
 * read.
 */
export function genReaderButtonReferenceAnswer(
    question: string,
    focus: BotFocusType,
): BotAnswerType | null {
    const reference = readReaderButtonReference(question, focus);
    if (reference === null) {
        return null;
    }
    const { book, chapter, verse } = reference;
    const steps = [
        {
            text: 'Clear the current Bible reference to show the book buttons.',
            find: 'Clear input',
            action: 'click',
        },
        {
            text: `Choose ${book} from the book buttons.`,
            find: book,
            action: 'click',
        },
        {
            text: `Choose chapter ${chapter}.`,
            find: `Chapter ${chapter}`,
            action: 'click',
        },
        {
            text: `Choose verse ${verse}.`,
            find: `Verse ${verse}`,
            action: 'click',
        },
    ];
    const title = `Open ${book} ${chapter}:${verse}`;
    return {
        text:
            `You do not need to type the English book name.\n\n` +
            `1. Press **Clear input** to show the Bible's own book buttons.\n` +
            `2. Press the book button for **${book}** in your Bible's own ` +
            `language, then press **Chapter ${chapter}**.\n` +
            `3. Press **Verse ${verse}** to open the passage.\n\n` +
            'If the names use unfamiliar letters, press **Do it for me** ' +
            'below. It will handle one visible button at a time.',
        actions: [
            {
                label: 'Show me step by step',
                toolName: 'owa_guide_start',
                args: { title, page: 'reader.html', mode: 'show', steps },
            },
            {
                label: 'Do it for me',
                toolName: 'owa_guide_start',
                args: { title, page: 'reader.html', mode: 'demo', steps },
            },
        ],
    };
}

// An answer to what the bot just asked, not a question of its own. The bot has
// no memory of what it offered -- it is a lookup, one question at a time -- so
// "yes" used to be SEARCHED, and the manual's best match for the word "yes" is
// the page about resetting the app's panels. Measured, not guessed. A volunteer
// who says yes to "would you like help to show a screen?" and is handed panel
// widths has been failed twice.
const FOLLOW_UP_YES_PATTERN =
    /^(?:y|ya|ye[sa]h?|yep|ok(?:ay)?|sure|please|do\s+it|go\s+(?:on|ahead)|carry\s+on|continue|next|more|how|show\s+me)[\s.!?]*$/i;
const FOLLOW_UP_NO_PATTERN =
    /^(?:n|no|nope|nah|no\s+thanks?|not\s+now|never\s?mind|cancel|stop)[\s.!?]*$/i;

const WHERE_IS_PATTERN =
    /^(?:where\s+is|where\s+are|find|show\s+me|point\s+(?:me\s+)?to)\s+(?:the\s+)?(.+?)\s*\??$/i;
const SCREEN_QUESTION_PATTERN =
    /\b(screen|screens|projector|display|displays|showing|on air)\b/i;
// A TASK that happens to mention the screen is not a question about the
// screen. Measured on the standing corpus (2026-09-02) with every provider
// down: "How do I put a Bible verse on the screen?" was answered "No
// presentation screen is showing right now" -- true, and the wrong page
// entirely. The screen answer is for the state and symptom shapes ("is
// anything showing", "nothing is showing"); a how-do-I goes to the manual.
const TASK_QUESTION_PATTERN = /^(?:how|where|what|which|can\s+i|could\s+i)\b/i;
// What the user is in the MIDDLE of: which song is selected, which slide is
// up, what comes next. A state question, whatever word it starts with --
// "which song is selected" starts like a how-do-I and is not one -- so this
// is checked before the task gate, and a how-do-I ("how do I move to the next
// slide") is still sent to the manual by its first word.
const SELECTION_QUESTION_PATTERN =
    /(?:\b(?:which|what)\b.*\b(?:song|document|slide)\b.*\b(?:selected|chosen|picked|open|up|next|showing)\b|\b(?:next|previous|prev)\s+slide\b|\babout\s+to\s+(?:put|show|present|send)\b|\bwhat(?:'s|\s+is)\s+(?:next|coming\s+(?:up|next))\b)/i;
const HOW_DO_I_PATTERN = /^(?:how|can\s+i|could\s+i)\b/i;
// "What is next in my running order" is about the run sheet, not the
// selected document: `owa_app_state` carries it as `runSheet` (EC-132), and
// a state question naming the sheet is answered from that field.
const RUN_SHEET_PATTERN =
    /\b(?:running\s+order|presenting\s+flow|run\s+sheet|playlist|order\s+of\s+service|service\s+plan)\b/i;
// "Put John 3:16 on the screen": a passage to PRESENT, named by a reference
// with a chapter in it. Only a concrete reference fires it -- "how do I put a
// Bible verse on the screen" has no chapter and goes to the manual, and a
// how-do-I that happens to name one is still a how-do-I. The reference is
// whatever sits between the verb and the "on the screen" tail (or ends the
// sentence): "1 John 1:1-4", "Psalm 23", "john 3 16" -- the app's own parser
// decides what it means, not this pattern.
// A word-and-number that is not a book -- "slide 3", "verse 2" -- is a slide
// ask and goes on to the selection answer, not to the passage parser.
const VERSE_ASK_PATTERN =
    /^(?:please\s+)?(?:put|show|present|display|open|bring)\s+(?:up\s+)?(?:the\s+)?(?!(?:slide|song|page|item|number|line|verse|chorus|stage|screen)s?\s)((?:[1-3]\s*)?[a-z][a-z .]*?\s+\d+(?:\s*[:.]\s*\d+(?:\s*-\s*\d+)?)?)(?:\s+(?:up\s+)?(?:on|onto|to)\s+(?:the\s+)?(?:big\s+)?(?:screen|projector|wall|display))?\s*[.!]?\s*$/i;

/**
 * The pseudo tool name a button carries when pressing it should run one of
 * the window's built-in commands (`builtinActionHelpers`) -- asked as though
 * the user typed it, so the transcript shows the command. Declared here
 * rather than there because this bot offers one under its own answers and
 * the command module imports this one.
 */
export const BUILTIN_TOOL_NAME = 'builtin-command';

/**
 * Below this, a search's top hit is not an answer -- it is the page that
 * happened to share a word. Measured 2026-09-02 over all 258 corpus questions
 * with a recipe: no RIGHT top hit scored under 6, and the three under it were
 * all wrong (a chord question answered with the Bible XML page at 3, "undo"
 * with the drawing page at 4, "make a panel bigger" with the same at 5). The
 * distributions overlap everywhere above it, so this floor catches the
 * garbage and nothing else; "Can it stream to Facebook?" scored the Presenter
 * overview 2 and offered to walk the user through it.
 */
export const MIN_HELP_HIT_SCORE = 6;

function withPrefix(answer: BotAnswerType, prefix: string): BotAnswerType {
    if (prefix.length === 0) {
        return answer;
    }
    return { ...answer, text: `${prefix}${answer.text}` };
}

function genHitText(hit: HelpHitType) {
    // The id ("W-06") and the section path are how the manual is filed, not
    // something the person asking has any use for.
    return `**${hit.title}**\n\n${hit.excerpt}`;
}

/**
 * The words that take the user from a page of the main window back to the
 * Presenter. Named per page because it is not the same control: the Bible
 * Reader has no Presenter tab -- its route is the 🖥️ button at the top
 * right -- and two answers that sent a Reader user to "the Presenter tab"
 * were graded as passing before anybody pressed it. Null on the Presenter
 * itself and in every window of its own. ONE source for the model's prompt
 * and the offline bot, so the two cannot name different buttons.
 */
export function genBackToPresenterRoute(focus: BotFocusType): string | null {
    if (focus === 'reader') {
        return 'click the 🖥️ **Go Back to Presenter** button at the top right';
    }
    if (focus === 'appDocumentEditor') {
        return 'click the **Presenter** tab at the top of the window';
    }
    return null;
}

// The Presenter's panels, as the manual names them. A recipe that uses one
// of these is a Presenter recipe whatever page it was asked from.
const PRESENTER_PANEL_PATTERN =
    /\b(?:Documents?\s+list|Presenting\s+Flows?|Background\s+(?:panel|bar)|Foreground\s+panel|Mini\s+Screen|Bible\s+Lookup|Slide\s+Editor|Ctrl\+B)\b/i;

/**
 * The line to put in FRONT of a manual answer given on a page that has none
 * of the panels it names, or an empty string. Measured 2026-09-09 through the
 * offline bot with every key dead: *How do I edit a slide?* asked from the
 * Bible Reader opened "in the Documents list" -- a panel the Reader page has
 * not got -- with no way across named anywhere. The model is told the same
 * fact in its prompt; this is the offline bot's copy of it.
 */
export function genBackToPresenterLead(focus: BotFocusType, text: string) {
    const route = genBackToPresenterRoute(focus);
    // The manual bolds its control names ("the **Documents** list"), so the
    // emphasis marks come off before the words are looked for.
    const plainText = text.replace(/[*_`]+/g, '');
    if (route === null || !PRESENTER_PANEL_PATTERN.test(plainText)) {
        return '';
    }
    const pageLabel = getBotFocus(focus)?.label ?? focus;
    return (
        `This is done in the Presenter — the ${pageLabel} page has none of ` +
        `these panels. First ${route}, then:\n\n`
    );
}

export async function answerWhereIs(
    target: string,
    focus: BotFocusType,
): Promise<BotAnswerType | null> {
    const found = parseToolJson(
        await callTool('owa_find_ui', {
            text: target,
            highlight: true,
            page: `${focus}.html`,
        }),
    );
    if (found === null || found.count === 0) {
        // The matcher says which labels came closest -- "reference box"
        // finds nothing, but the "Bible Reference" box is right there.
        // Point at the real one rather than answering "I don't know".
        const [closest] = found?.nearMisses ?? [];
        if (found !== null && closest !== undefined) {
            return {
                text:
                    `I could not find "${target}", but there is ` +
                    `**${closest}** on screen — is that the one? ` +
                    'Ask again with those words and I will point it out.',
                actions: [
                    {
                        label: `Highlight "${closest}"`,
                        toolName: 'owa_find_ui',
                        args: {
                            text: closest,
                            highlight: true,
                            page: `${focus}.html`,
                        },
                    },
                ],
            };
        }
        return null;
    }
    const visible = found.matches.filter((match: any) => {
        return match.isVisible;
    });
    if (visible.length === 0) {
        return {
            text:
                `I found "${target}" in the ${focus}, but it is not visible ` +
                'right now. Try opening the panel or tab it belongs to first.',
        };
    }
    const [first] = visible;
    return {
        text:
            `**${first.label}** is on screen now — I have outlined it in red ` +
            `for a few seconds, ${first.where ?? 'in this window'}.` +
            // Only what was actually ringed: the tool outlines the matches it
            // answers with, and says separately how many it found in total.
            (visible.length > 1
                ? `\n\nThere are ${visible.length} things matching ` +
                  `"${target}"; I outlined them all.` +
                  (typeof found.count === 'number' &&
                  found.count > found.matches.length
                      ? ` (${found.count} in all — ask with more of the ` +
                        'words on the control to narrow it down.)'
                      : '')
                : ''),
        actions: [
            {
                label: 'Highlight again',
                toolName: 'owa_find_ui',
                args: { text: target, highlight: true, page: `${focus}.html` },
            },
        ],
    };
}

async function answerScreens(): Promise<BotAnswerType | null> {
    const state = parseToolJson(await callTool('owa_list_screens'));
    if (state === null || state.error) {
        return null;
    }
    const showingIds: number[] = state.showingScreenIds ?? [];
    const displayCount = state.displays?.length ?? 0;
    // What each screen HOLDS, in a sentence a person can check against the
    // wall. "Screen 0 is showing" told them nothing they could look at;
    // "showing verse 2 of Amazing Grace" is something they can see is true.
    const screens: any[] = Array.isArray(state.screens) ? state.screens : [];
    const describeHeld = (screenId: number) => {
        const screen = screens.find((one) => one.screenId === screenId);
        if (screen === undefined) {
            return '';
        }
        const held = describeScreenContent(screen);
        return held ? ` -- ${held}` : '';
    };
    if (showingIds.length === 0) {
        // A hidden screen still holds its layers: say so, because "it is off
        // but already has the song on it" is the whole answer to most panics.
        const heldWhileOff = screens
            .filter((screen) => screen.isBlank !== true)
            .map((screen) => {
                return (
                    `Screen ${screen.screenId} is off but already holds ` +
                    `${describeScreenContent(screen)}, so turning it on ` +
                    'shows that.'
                );
            })
            .join(' ');
        return {
            text:
                'No presentation screen is showing right now. This machine ' +
                `has ${displayCount} display(s) available to present on.` +
                (heldWhileOff ? ` ${heldWhileOff}` : ''),
            // The one thing the person asking this wants next, and the one
            // thing this bot could not offer until the window could do it
            // without a model: a press that turns the screen on and reads it
            // back.
            actions: [
                {
                    label: 'Turn the screen on',
                    toolName: BUILTIN_TOOL_NAME,
                    args: { command: '/screen-show' },
                },
            ],
        };
    }
    return {
        text:
            `Screen ${showingIds.join(', ')} ` +
            `${showingIds.length === 1 ? 'is' : 'are'} showing right now, on ` +
            `a machine with ${displayCount} display(s)` +
            showingIds.map(describeHeld).join('') +
            '.',
        actions: [
            {
                label: 'Hide every screen',
                toolName: 'owa_hide_screens',
                args: {},
            },
        ],
    };
}

/**
 * "Put John 3:16 on the screen", with no model: the reference is checked
 * against the app's own parser first (`owa_present_bible` with `check`, which
 * touches no screen), the answer says what it reads as and quotes its first
 * words, and ONE button puts it up -- the same offered-then-pressed shape the
 * screen answer takes, because a sentence typed at a help window is not the
 * same consent as a button pressed under "John 3:16 (KJV) reads ...". Before
 * this the manual was searched for the reference and the best hit was the
 * page about the Bible Lookup's picker, which no button can drive
 * (2026-09-10). A reference the app cannot read gets the app's own sentence
 * about it and no button; anything else falls through to the manual.
 */
async function answerVerseAsk(
    reference: string,
): Promise<BotAnswerType | null> {
    let result: any;
    try {
        result = parseToolJson(
            await callTool('owa_present_bible', { reference, action: 'check' }),
        );
    } catch (error: any) {
        const reason = String(error?.message ?? '');
        if (/could not be read as a passage/.test(reason)) {
            return { text: reason };
        }
        appError(error, 'offline verse ask');
        return null;
    }
    if (result === null || typeof result.reference !== 'string') {
        return null;
    }
    const words = result.text ? ` -- "${result.text}"` : '';
    return {
        text:
            `**${result.reference} (${result.version})** reads${words}. ` +
            'I can put it on the screen for you' +
            (result.isAnyShowing === true
                ? '.'
                : ' -- the screen is off just now, so it will be loaded ' +
                  'and ready for when it is turned on.'),
        actions: [
            {
                label: `Put ${result.reference} on the screen`,
                toolName: BUILTIN_TOOL_NAME,
                args: { command: `/verse ${result.reference}` },
            },
        ],
    };
}

// A countdown asked for as a thing to DO: a start word, the word countdown
// (or timer), and either a length or a time. "How do I show a countdown"
// keeps going to the manual -- the how-do-I gate is checked by the caller.
const COUNTDOWN_WORD_PATTERN = /\b(?:count\s*-?\s*down|countdown|timer)\b/i;
const START_WORD_PATTERN =
    /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+(?:please\s+)?)?(?:start|put|show|run|begin|set|display|launch|kick\s+off)\b/i;

/**
 * The countdown a sentence asks for -- its minutes, or the clock time it
 * counts down to -- or null when the sentence is not that ask.
 */
export function readCountdownAsk(
    text: string,
): { minutes: number } | { at: string } | null {
    if (
        !COUNTDOWN_WORD_PATTERN.test(text) ||
        !START_WORD_PATTERN.test(text) ||
        HOW_DO_I_PATTERN.test(text)
    ) {
        return null;
    }
    const minutes = /(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:min(?:ute)?s?|m)\b/i.exec(
        text,
    );
    if (minutes !== null) {
        return { minutes: Number(minutes[1]) };
    }
    const hours = /(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:h|hrs?|hours?)\b/i.exec(text);
    if (hours !== null) {
        return { minutes: Number(hours[1]) * 60 };
    }
    const at =
        /\b(?:to|until|till|at)\s+(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\b/i.exec(
            text,
        );
    if (at !== null) {
        return { at: at[1].trim() };
    }
    return null;
}

/**
 * "Start a 5 minute countdown on the screen", with no model: the same
 * offered-then-pressed shape the verse takes -- the screens are read first
 * (`owa_foreground` with `check`, which touches nothing) so the answer can
 * say whether the screen is on, and ONE button starts it, because a sentence
 * typed at a help window is not the consent a pressed button is. Before this
 * the manual was searched and the best hit was the page about the Foreground
 * tab's boxes (2026-09-11).
 */
async function answerCountdownAsk(
    ask: { minutes: number } | { at: string },
): Promise<BotAnswerType | null> {
    let result: any;
    try {
        result = parseToolJson(
            await callTool('owa_foreground', { action: 'check' }),
        );
    } catch (error: any) {
        const reason = String(error?.message ?? '');
        if (/started from the Presenter page/.test(reason)) {
            return { text: reason };
        }
        appError(error, 'offline countdown ask');
        return null;
    }
    if (result === null || typeof result !== 'object') {
        return null;
    }
    const isMinutes = 'minutes' in ask;
    const label = isMinutes
        ? `a ${ask.minutes} minute countdown`
        : `a countdown to ${ask.at}`;
    const command = isMinutes
        ? `/countdown ${ask.minutes}`
        : `/countdown ${ask.at}`;
    return {
        text:
            `**I can start ${label} on the screen for you**` +
            (result.isAnyShowing === true
                ? '.'
                : ' -- the screen is off just now, so it will be loaded ' +
                  'and ready for when it is turned on.'),
        actions: [
            {
                label: `Start ${label}`,
                toolName: BUILTIN_TOOL_NAME,
                args: { command },
            },
        ],
    };
}

/**
 * What is selected, which slide is up and what is next -- from the app, with
 * no model. Measured 2026-09-09 with a model: asked *which song is selected*
 * the assistant named the song on the PROJECTOR, because nothing had told it
 * what was picked; the field it needed now rides `owa_app_state`, and this
 * bot reads the same one. An imperative -- "show the next slide" -- gets the
 * state and a button that does it (`/next`), the same shape the screen
 * answer takes: one press, and the transcript shows the command it ran.
 */
async function answerSelection(): Promise<BotAnswerType | null> {
    const state = parseToolJson(await callTool('owa_app_state', {}));
    const main = state?.mainWindow;
    if (!main) {
        return null;
    }
    if (main.page !== 'presenter.html') {
        return {
            text:
                'The selected song lives in the Presenter, and the main ' +
                'window is not on it right now.',
            actions: [
                {
                    label: 'Go to the Presenter',
                    toolName: BUILTIN_TOOL_NAME,
                    args: { command: '/goto presenter' },
                },
            ],
        };
    }
    const selected = main.selectedDocument ?? null;
    const actions: BotActionType[] = [];
    if (selected?.next) {
        actions.push({
            label: 'Show the next slide',
            toolName: BUILTIN_TOOL_NAME,
            args: { command: '/next' },
        });
    }
    if (selected?.previous) {
        actions.push({
            label: 'Back one slide',
            toolName: BUILTIN_TOOL_NAME,
            args: { command: '/previous' },
        });
    }
    return { text: describeSelectedDocument(selected), actions };
}

/**
 * The run sheet, with no model: which one is open, where the run is, what
 * the next press puts up -- or which sheets there are to open. Nothing here
 * presses anything; advancing a run is the operator's own key.
 */
async function answerRunSheet(): Promise<BotAnswerType | null> {
    const state = parseToolJson(await callTool('owa_app_state', {}));
    const main = state?.mainWindow;
    if (!main) {
        return null;
    }
    if (main.page !== 'presenter.html') {
        return {
            text:
                'The run sheet lives in the Presenter, and the main window ' +
                'is not on it right now.',
            actions: [
                {
                    label: 'Go to the Presenter',
                    toolName: BUILTIN_TOOL_NAME,
                    args: { command: '/goto presenter' },
                },
            ],
        };
    }
    return { text: describeRunSheet(main.runSheet ?? null), actions: [] };
}

/**
 * The words of a song, written out with no model in the loop.
 *
 * The drafter (`owa_lyric_validate`, `mode: "draft"`) asks the app nothing and
 * the network nothing, so the one thing a paste is FOR is available to the
 * offline bot in full -- and the two buttons under the answer are the same
 * two the model's answer carries, through the same pseudo tools, so the
 * hardened create path (a free name, nothing overwritten, the app's own
 * validator) is the only one there is. Measured 2026-09-08: on Kimi's free
 * tier the paste the starter chip invites landed a minute after the chip's
 * own rounds, was refused with a 429, and the manual was searched for sixteen
 * lines of Amazing Grace instead.
 *
 * `null` when the drafter would not call it a song, so the caller falls
 * through to the search it would have done anyway -- an honest "I could not
 * find that" beats a song made of a shopping list.
 */
export async function answerLyricPaste(
    text: string,
): Promise<BotAnswerType | null> {
    const raw = await callTool('owa_lyric_validate', {
        text,
        mode: 'draft',
    });
    return genLyricDraftAnswer(
        raw,
        'I wrote those words out as a song for the Lyric Editor.',
    );
}

/**
 * A song page, read and written out with no model in the loop.
 *
 * The drafter reads the page ITSELF (`owa_lyric_validate` with `url`; the
 * firewall counts it as a network read, rations it and names the site in the
 * app window), so nothing here ever sees the page's words. Measured
 * 2026-09-10 with the assistant paused: *Create a lyric file from https://…*
 * -- the app's own starter chip -- searched the manual for the address and
 * answered with how to make an EMPTY file, offering a walkthrough of that.
 *
 * Never null: a link that could not be read is answered in a sentence, not
 * by a manual search for the address, which is the one thing the manual has
 * no page about. And never the tool's own words -- the reason goes to the log.
 */
export async function answerLyricLink(url: string): Promise<BotAnswerType> {
    const site = toSiteName(url) ?? 'that page';
    let raw: string;
    try {
        raw = await callTool('owa_lyric_validate', { url, mode: 'draft' });
    } catch (error) {
        appError(error, 'offline song link');
        return {
            text:
                `I could not read ${site} just now. Check the address, or ` +
                'copy the words off the page and paste them here and I ' +
                'will write them out.',
        };
    }
    const answer = genLyricDraftAnswer(
        raw,
        `I read ${site} and wrote the song on it out for the Lyric Editor.`,
    );
    if (answer !== null) {
        return answer;
    }
    if (checkIsBrowserCheckRefusal(raw)) {
        // The site answered a bot check instead of its page (measured
        // 2026-09-10 on a hymnal's third read in a row). Said as what it is:
        // "no song on it" would send them to paste words the page has.
        return {
            text:
                `${site} answered with a "checking your browser" page ` +
                'instead of the song. Open the page in your own browser ' +
                'once and try again, or copy the words off it and paste ' +
                'them here.',
        };
    }
    return {
        text:
            `I read ${site} but could not find a song on it. If the words ` +
            'are in front of you, paste them here and I will write them out.',
    };
}

/**
 * The answer under a drafted song: what it is, what had to be guessed, and
 * the two buttons -- the SAME two the model's answer carries, through the same
 * pseudo tools, so the hardened create path (a free name, nothing overwritten,
 * the app's own validator) is the only one there is. Null when the drafter
 * would not call it a song.
 */
function genLyricDraftAnswer(
    raw: string,
    opening: string,
): BotAnswerType | null {
    const content = readDraftedLyric(raw);
    if (content === null) {
        return null;
    }
    const drafted = keepDraftedLyric(content);
    const report = readDraftReport(raw);
    const lines = [
        opening,
        ...[report.song, report.sections, report.playOrder].filter(
            (line): line is string => {
                return line !== null;
            },
        ),
    ];
    if (report.guessed.length > 0) {
        lines.push(
            'The words did not say everything, so I guessed:\n' +
                report.guessed
                    .map((one) => {
                        return `- ${one}`;
                    })
                    .join('\n'),
        );
    }
    lines.push(
        `Press Create "${drafted.name}" to add it to your songs, or Copy ` +
            'song text to paste it into the Lyric Editor yourself.',
    );
    return {
        text: lines.join('\n\n'),
        actions: [
            {
                label: `Create "${drafted.name}"`,
                toolName: LYRIC_CREATE_TOOL_NAME,
                args: { reference: drafted.reference },
            },
            {
                label: 'Copy song text',
                toolName: LYRIC_COPY_TOOL_NAME,
                args: { reference: drafted.reference },
            },
        ],
    };
}

export async function answerFromManual(
    question: string,
    focus: BotFocusType,
): Promise<BotAnswerType> {
    // The focus is a FILTER, not a query term: a recipe belonging to the
    // other half of the app is not a weaker answer, it is a wrong one -- the
    // reader has no Ctrl+B lookup popup, so being told to press it is being
    // told to do something impossible. It used to be appended to the query
    // as a word as well, and the word "presenter" is in the TITLE of the
    // page about understanding the Presenter window, which then outranked
    // the real answer: measured 2026-09-02, "clear the bible presenter"
    // scored that page 83 and the clears page 42, while "clear the bible"
    // alone scored the clears page 69 and first.
    const raw = await callTool('owa_help_search', {
        query: question,
        focus,
        // The manual and nothing else: the internal notes are written for
        // whoever builds the app, and handing one to a volunteer answers their
        // question with a file path.
        kind: 'manual',
    });
    const allHits = parseToolJson(raw) as
        (HelpHitType & { score?: number })[] | null;
    const hits = (Array.isArray(allHits) ? allHits : []).filter((hit) => {
        return typeof hit.score !== 'number' || hit.score >= MIN_HELP_HIT_SCORE;
    });
    if (hits.length === 0) {
        return {
            text:
                'I could not find that in the app guide. Try naming the ' +
                'button or the thing you want to put on the screen — for ' +
                'example "how do I show a song?" or "where is the clear ' +
                'button?".',
        };
    }
    const [first, ...rest] = hits;
    const hitText = genHitText(first);
    return {
        text: genBackToPresenterLead(focus, hitText) + hitText,
        actions: [
            ...genGuideActions(first, focus, false, question),
            {
                label: 'Read the whole thing',
                toolName: 'owa_help_page',
                args: { id: first.id },
            },
            // ONE other place to look, not three. Every answer now also
            // carries a row of things the user can say next
            // (`quickReplyHelpers`), and two walkthroughs plus the whole page
            // plus three near-misses plus those is a wall of buttons under a
            // paragraph -- which is the same dead end as no buttons at all.
            ...rest.slice(0, 1).map((hit) => {
                return {
                    label: hit.title,
                    toolName: 'owa_help_page',
                    args: { id: hit.id },
                };
            }),
        ],
    };
}

/**
 * Which window the one that opened this help is showing, read at the moment it
 * is needed. The presenter, the reader and the document editor are ONE window
 * that navigates, so a chat left open while the user switches tabs would
 * otherwise keep answering about the page they left.
 *
 * Matched on the window's own file name rather than on a word inside it: a
 * bare `includes('presenter')` also matched nothing else while there were two
 * windows, but `setting.html` and `webEditor.html` are one substring away from
 * each other's keys.
 */
export function detectOpenerFocus(): BotFocusType | null {
    try {
        return detectBotFocus(window.opener?.location?.pathname ?? '');
    } catch (_error) {
        // A cross-origin or closed opener tells us nothing; the switch stands.
        return null;
    }
}

export async function askHelpBot(
    question: string,
    focus: BotFocusType = DEFAULT_BOT_FOCUS,
    // What was already said in this tab. Used for one thing only: working out
    // what a bare "yes" is a yes TO.
    priorTurns: ChatTurnType[] = [],
): Promise<BotAnswerType> {
    let trimmedQuestion = question.trim();
    if (trimmedQuestion.length === 0) {
        return { text: 'Ask me how to do something in the app.' };
    }
    const readerButtonAnswer = genReaderButtonReferenceAnswer(
        trimmedQuestion,
        focus,
    );
    if (readerButtonAnswer !== null) {
        return readerButtonAnswer;
    }
    // A song page named by its address -- "Create a lyric file from
    // https://…", the app's own starter chip -- is read and drafted by the
    // tool with no model. Before the manual for the same reason as the paste
    // below it: the manual has no page about an address, and measured
    // (2026-09-10, assistant paused) it answered this with how to make an
    // empty file.
    const songLink = readSongLinkAsk(trimmedQuestion);
    if (songLink !== null) {
        return await answerLyricLink(songLink);
    }
    // Several short lines and no question in them are the words of a song,
    // and a song is a thing to write out, not a thing to look up. First,
    // because nothing below could make anything of it: the manual has no page
    // about the second verse of anything.
    if (checkIsLyricPaste(trimmedQuestion)) {
        const answer = await answerLyricPaste(trimmedQuestion);
        if (answer !== null) {
            return answer;
        }
    }
    let prefix = '';
    if (FOLLOW_UP_NO_PATTERN.test(trimmedQuestion)) {
        return {
            text: 'Alright. Ask me again whenever you need something.',
        };
    }
    if (FOLLOW_UP_YES_PATTERN.test(trimmedQuestion)) {
        // The LAST thing they named themselves. Their own words beat the
        // offer they are agreeing to: measured against this exact
        // conversation, searching "Is any screen showing right now?" finds
        // the page on controlling what the audience sees, while searching
        // the offer -- "help to show a screen" -- finds the one about
        // showing which KEYS you press.
        const lastAsked = priorTurns
            .filter((turn) => {
                return (
                    turn.author === 'you' &&
                    turn.text.trim().length > 0 &&
                    !FOLLOW_UP_YES_PATTERN.test(turn.text.trim()) &&
                    !FOLLOW_UP_NO_PATTERN.test(turn.text.trim())
                );
            })
            .pop();
        if (lastAsked === undefined) {
            return {
                text:
                    'Tell me in a few words what you would like to do and I ' +
                    'will look it up — for example "how do I show a screen".',
            };
        }
        // Said out loud, because this is a guess at their meaning and a
        // volunteer must be able to see it was one.
        trimmedQuestion = lastAsked.text.trim();
        prefix = `Going back to "${trimmedQuestion}" —\n\n`;
    }
    // "Where is the clear button?" is answered by pointing at the real one,
    // not by quoting a manual page about it.
    const whereIsMatch = WHERE_IS_PATTERN.exec(trimmedQuestion);
    if (whereIsMatch !== null) {
        const answer = await answerWhereIs(whereIsMatch[1], focus);
        if (answer !== null) {
            return withPrefix(answer, prefix);
        }
    }
    const verseMatch = VERSE_ASK_PATTERN.exec(trimmedQuestion);
    if (verseMatch !== null && !HOW_DO_I_PATTERN.test(trimmedQuestion)) {
        const answer = await answerVerseAsk(verseMatch[1].trim());
        if (answer !== null) {
            return withPrefix(answer, prefix);
        }
    }
    const countdownAsk = readCountdownAsk(trimmedQuestion);
    if (countdownAsk !== null) {
        const answer = await answerCountdownAsk(countdownAsk);
        if (answer !== null) {
            return withPrefix(answer, prefix);
        }
    }
    if (
        SELECTION_QUESTION_PATTERN.test(trimmedQuestion) &&
        !HOW_DO_I_PATTERN.test(trimmedQuestion)
    ) {
        const answer = RUN_SHEET_PATTERN.test(trimmedQuestion)
            ? await answerRunSheet()
            : await answerSelection();
        if (answer !== null) {
            return withPrefix(answer, prefix);
        }
    }
    if (
        SCREEN_QUESTION_PATTERN.test(trimmedQuestion) &&
        !TASK_QUESTION_PATTERN.test(trimmedQuestion)
    ) {
        const answer = await answerScreens();
        if (answer !== null) {
            return withPrefix(answer, prefix);
        }
    }
    return withPrefix(await answerFromManual(trimmedQuestion, focus), prefix);
}

/**
 * A tool press, and whether the model still has to be asked.
 *
 * The recipe card goes up INSTANTLY, which is the whole reason it is still the
 * first thing tried: a volunteer who presses a button mid-service cannot watch
 * a blank window for the minute a model spends thinking. But a recipe can only
 * mark a control by bolding it, so some cards come up unable to circle
 * anything -- and being shown a step with no ring is what the user was stuck on
 * to begin with. So the card reports whether it landed, and only then, only for
 * the recipes that cannot, is the model asked to build a better one.
 */
export type BotActionResultType = {
    text: string;
    isNeedingModel: boolean;
    // Buttons under the answer -- the page-switch guidance offers "I'm
    // there -- start it" so the walkthrough is one press once the user has
    // changed window.
    actions?: BotActionType[];
};

// A walkthrough of a window that is not up cannot start: nothing in a window
// nobody opened can be circled, pressed or typed into. What the tool says
// about that is true and completely useless to a volunteer -- "The app has no
// open page matching setting.html. The open pages are: chatbot.html?uuid=
// chatbot, presenter.html." -- and it used to be printed at them word for
// word, because the map of windows this understood held two of the eight.
//
// So it does not report the failure at all any more: it OPENS the window and
// gets on with the walkthrough that was asked for. The two ways across are the
// two kinds of window, which `BOT_FOCUS_LIST` already tells apart -- and it is
// read here rather than copied, because the copy is what only knew two.
const NO_OPEN_PAGE_PATTERN = /no open page matching "([^"]+)"/;

// Long enough for a fresh window on a slow machine to appear and put its page
// up. A click returns the moment it has clicked, unlike `owa_goto_page`, which
// waits for the arrival itself.
const PAGE_OPEN_TIMEOUT_MS = 8000;
const PAGE_OPEN_POLL_MS = 300;

/** Whether a window showing this page is up, asked of the app itself. */
async function checkIsPageOpen(page: string): Promise<boolean> {
    try {
        const state = parseToolJson(await callTool('owa_app_state', {}));
        return (state?.windows ?? []).some((item: any) => {
            return typeof item?.url === 'string' && item.url.includes(page);
        });
    } catch (_error) {
        // Cannot tell, so do not claim it arrived.
        return false;
    }
}

async function waitForPage(page: string): Promise<boolean> {
    const startedAt = Date.now();
    for (;;) {
        if (await checkIsPageOpen(page)) {
            return true;
        }
        if (Date.now() - startedAt > PAGE_OPEN_TIMEOUT_MS) {
            return false;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, PAGE_OPEN_POLL_MS);
        });
    }
}

/**
 * Get the user to the window by doing it for them, and say whether it worked.
 *
 * `owa_goto_page` for a page the ONE main window navigates between -- it waits
 * for the arrival, which a click cannot -- and a press of the control that
 * opens it for a window of its own. Four of the eight have no such control at
 * all (three need something selected first, one lives in the native menu bar),
 * and those are the only ones the user is still asked to do it themselves.
 */
async function checkCanOpenWindow(
    descriptor: BotFocusDescriptorType,
): Promise<boolean> {
    try {
        if (descriptor.isMainWindow) {
            await callTool('owa_goto_page', { page: descriptor.window });
            return true;
        }
        if (descriptor.openFind === null) {
            return false;
        }
        await callTool('owa_click', { find: descriptor.openFind });
    } catch (_error) {
        // Whatever went wrong, the user is told where to press instead. The
        // one thing that must not happen is the reason reaching them.
        return false;
    }
    return await waitForPage(descriptor.window);
}

async function genPageOpenAnswer(
    error: any,
    action: BotActionType,
): Promise<BotActionResultType | null> {
    const wantedPage = NO_OPEN_PAGE_PATTERN.exec(error?.message ?? '')?.[1];
    if (wantedPage === undefined) {
        return null;
    }
    const descriptor = getBotFocus(detectBotFocus(wantedPage) ?? '');
    if (descriptor === null) {
        return null;
    }
    if (await checkCanOpenWindow(descriptor)) {
        // The walkthrough they pressed for, on the window that now exists.
        // `false` so a second failure cannot start this over: one attempt to
        // open, then the words.
        const result = await runBotAction(action, false);
        return {
            ...result,
            text: `**Opening ${descriptor.label} for you.**\n\n` + result.text,
        };
    }
    // Point at the control wherever it is; purely best-effort.
    if (descriptor.openFind !== null) {
        try {
            await callTool('owa_find_ui', {
                text: descriptor.openFind,
                highlight: true,
                anyPage: true,
            });
        } catch (_error) {
            // The words alone still tell them where to press.
        }
    }
    return {
        text:
            `**Open ${descriptor.label} first.** It is ${descriptor.howToOpen}` +
            (descriptor.openFind === null
                ? ''
                : ' — I have outlined it in red') +
            '. When it is showing, come back here and press ' +
            "**I'm there — start it**.",
        isNeedingModel: false,
        actions: [
            {
                label: "I'm there — start it",
                toolName: action.toolName,
                args: action.args,
            },
        ],
    };
}

export async function runBotAction(
    action: BotActionType,
    // Whether a walkthrough of a window that is not up may open it and try
    // again. False on that second attempt, so one window that refuses to
    // appear cannot become a loop of opening it.
    canOpenPage = true,
): Promise<BotActionResultType> {
    if (action.toolName === undefined) {
        return { text: 'Done.', isNeedingModel: action.ask !== undefined };
    }
    if (action.toolName === 'owa_guide_start') {
        const isDemoAsked =
            action.args?.mode === 'demo' || action.args?.demoId !== undefined;
        // A manual recipe can point immediately, but it cannot reliably DO
        // the task: it carries prose and bold words, not the live localized
        // labels or values a control needs. While the model builds those
        // exact steps, show the relevant manual step without an ineffective
        // Do it button. The model's guide replaces it when it is ready.
        const isPreparingDemo = isDemoAsked && action.ask !== undefined;
        let status;
        try {
            status = parseToolJson(
                await callTool(action.toolName, {
                    ...(action.args ?? {}),
                    ...(isPreparingDemo ? { mode: 'show' } : {}),
                }),
            );
        } catch (error: any) {
            // The focus says Settings but no Settings window is up: the guide
            // cannot start, so open it for them and start it there.
            const openAnswer = canOpenPage
                ? await genPageOpenAnswer(error, action)
                : null;
            if (openAnswer !== null) {
                return openAnswer;
            }
            throw error;
        }
        if (status === null || status.isRunning !== true) {
            return {
                text:
                    'I could not start the walkthrough for that one. The ' +
                    'written steps above still work.',
                isNeedingModel: action.ask !== undefined,
            };
        }
        if (isPreparingDemo) {
            return {
                text:
                    '**Look at the app window.** I am pointing to the right ' +
                    'place now. Give me a moment to prepare the safe **Do ' +
                    'it** step for the controls on your screen.',
                isNeedingModel: true,
            };
        }
        // What "good enough" means differs: a demo has to be able to PRESS
        // something, a walkthrough has to be able to POINT at something.
        const isGoodEnough = isDemoAsked
            ? status.canDemo !== false
            : status.isTargetFound !== false;
        if (!isGoodEnough && action.ask !== undefined) {
            return {
                text:
                    '**Look at the app window.** A card is up. Some of its ' +
                    'steps are not buttons I can point at, so give me a ' +
                    'moment and I will work out the real ones.',
                isNeedingModel: true,
            };
        }
        if (isDemoAsked && status.canDemo === false) {
            return {
                text:
                    '**Look at the app window.** I cannot press this one for ' +
                    'you — its steps are things to do in the page itself, ' +
                    `not buttons. A card is showing step 1 of ${status.stepCount}; press **Next** on it as you go.`,
                isNeedingModel: false,
            };
        }
        if (status.isDemo === true) {
            return {
                text:
                    '**Look at the app window.** A card is showing step 1 of ' +
                    `${status.stepCount}. Press **Do it** and I will do that ` +
                    'step for you, one step per press — or **Skip** to do it ' +
                    'yourself. **✕** stops.',
                isNeedingModel: false,
            };
        }
        return {
            text:
                '**Look at the app window.** A card is showing step 1 of ' +
                `${status.stepCount}, and the button that step is about is ` +
                'circled in red. Press **Next** on the card when you have ' +
                'done it — or just do it, and the card moves on by itself.',
            isNeedingModel: false,
        };
    }
    const text = await callTool(action.toolName, action.args ?? {});
    return { text: text.length > 0 ? text : 'Done.', isNeedingModel: false };
}

/**
 * What a failed button press says to the person who pressed it.
 *
 * Never the error itself. A tool's own words are written for whoever is
 * DRIVING the app -- page file names, the list of open windows, an id -- and a
 * volunteer handed "The app has no open page matching setting.html" learns
 * nothing they can act on and is told, in effect, that the app is broken. Two
 * of those words are also a file name, which this window may never show them.
 * The reason still goes to the log for whoever is debugging it.
 */
export function describeActionError(error: any, action: BotActionType): string {
    appError(error, `chatbot action ${action.toolName ?? 'unknown'}`);
    return (
        'I could not do that just now. Ask me again, or tell me what you are ' +
        'trying to do and I will find another way.'
    );
}
