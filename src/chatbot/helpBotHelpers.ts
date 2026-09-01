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

import { callTool, parseToolJson } from './mcpClient';

/**
 * The app is two apps in one window, and the same question has two answers:
 * "where is the clear button" means the presenter's, or the reader's. The user
 * says which, and the whole answer follows it -- which page is searched for
 * the control, and which half of the manual is favoured.
 */
export type BotFocusType = 'presenter' | 'reader';

export const BOT_FOCUS_LIST: { key: BotFocusType; label: string }[] = [
    { key: 'presenter', label: 'Presenter' },
    { key: 'reader', label: 'Bible Reader' },
];

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
            args: { manualId: hit.id, page: `${focus}.html`, mode: 'show' },
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
            ask: canAsk
                ? 'Do it for me in the app window' +
                  (topic.length > 0 ? `: ${topic}` : '') +
                  ' — put the demo card up now and press each step for ' +
                  'me, without looking anything else up first.'
                : undefined,
            toolName: 'owa_guide_start',
            args: { manualId: hit.id, page: `${focus}.html`, mode: 'demo' },
        },
    ];
}

const WHERE_IS_PATTERN =
    /^(?:where\s+is|where\s+are|find|show\s+me|point\s+(?:me\s+)?to)\s+(?:the\s+)?(.+?)\s*\??$/i;
const SCREEN_QUESTION_PATTERN =
    /\b(screen|screens|projector|display|displays|showing|on air)\b/i;

function genHitText(hit: HelpHitType) {
    // The id ("W-06") and the section path are how the manual is filed, not
    // something the person asking has any use for.
    return `**${hit.title}**\n\n${hit.excerpt}`;
}

async function answerWhereIs(
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
    const displayCount = state.displays?.displays?.length ?? 0;
    if (showingIds.length === 0) {
        return {
            text:
                'No presentation screen is showing right now. This machine ' +
                `has ${displayCount} display(s) available to present on.`,
        };
    }
    return {
        text:
            `Screen ${showingIds.join(', ')} ` +
            `${showingIds.length === 1 ? 'is' : 'are'} showing right now, on ` +
            `a machine with ${displayCount} display(s).`,
        actions: [
            {
                label: 'Hide every screen',
                toolName: 'owa_hide_screens',
                args: {},
            },
        ],
    };
}

async function answerFromManual(
    question: string,
    focus: BotFocusType,
): Promise<BotAnswerType> {
    // The focus is BOTH a query term and a filter now: a recipe belonging to
    // the other half of the app is not a weaker answer, it is a wrong one --
    // the reader has no Ctrl+B lookup popup, so being told to press it is
    // being told to do something impossible.
    const raw = await callTool('owa_help_search', {
        query: `${question} ${focus}`,
        focus,
        // The manual and nothing else: the internal notes are written for
        // whoever builds the app, and handing one to a volunteer answers their
        // question with a file path.
        kind: 'manual',
    });
    const hits = parseToolJson(raw) as HelpHitType[] | null;
    if (hits === null || !Array.isArray(hits) || hits.length === 0) {
        return {
            text:
                'I could not find that in the app guide. Try naming the ' +
                'button or the thing you want to put on the screen — for ' +
                'example "how do I show a song?" or "where is the clear ' +
                'button?".',
        };
    }
    const [first, ...rest] = hits;
    return {
        text: genHitText(first),
        actions: [
            ...genGuideActions(first, focus, false, question),
            {
                label: 'Read the whole thing',
                toolName: 'owa_help_page',
                args: { id: first.id },
            },
            ...rest.slice(0, 3).map((hit) => {
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
 * Which half of the app the window that opened this one is showing, read at
 * the moment it is needed. The presenter and the reader are one window that
 * navigates, so a chat left open while the user switches tabs would otherwise
 * keep answering about the page they left.
 */
export function detectOpenerFocus(): BotFocusType | null {
    try {
        const pathname = window.opener?.location?.pathname ?? '';
        if (pathname.includes('reader')) {
            return 'reader';
        }
        if (pathname.includes('presenter')) {
            return 'presenter';
        }
        return null;
    } catch (_error) {
        // A cross-origin or closed opener tells us nothing; the switch stands.
        return null;
    }
}

export async function askHelpBot(
    question: string,
    focus: BotFocusType = 'presenter',
): Promise<BotAnswerType> {
    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length === 0) {
        return { text: 'Ask me how to do something in the app.' };
    }
    // "Where is the clear button?" is answered by pointing at the real one,
    // not by quoting a manual page about it.
    const whereIsMatch = WHERE_IS_PATTERN.exec(trimmedQuestion);
    if (whereIsMatch !== null) {
        const answer = await answerWhereIs(whereIsMatch[1], focus);
        if (answer !== null) {
            return answer;
        }
    }
    if (SCREEN_QUESTION_PATTERN.test(trimmedQuestion)) {
        const answer = await answerScreens();
        if (answer !== null) {
            return answer;
        }
    }
    return await answerFromManual(trimmedQuestion, focus);
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

// The control that takes the main window to each of its halves, said the way
// it sits in the window. A walkthrough for the Presenter asked from the Bible
// Reader cannot start (the page is not open), so the answer is to switch
// first -- and the button to do it is outlined, not just named.
const PAGE_SWITCH_HINTS: Record<
    string,
    { pageName: string; find: string; words: string }
> = {
    'presenter.html': {
        pageName: 'the Presenter',
        find: 'Go Back to Presenter',
        words: 'the 🖥️ button at the top right of the app window',
    },
    'reader.html': {
        pageName: 'the Bible Reader',
        find: 'Bible Reader',
        words: 'the 📖 Bible Reader tab at the top of the app window',
    },
};

const NO_OPEN_PAGE_PATTERN = /no open page matching "([^"]+)"/;

async function genPageSwitchAnswer(
    error: any,
    action: BotActionType,
): Promise<BotActionResultType | null> {
    const wantedPage = NO_OPEN_PAGE_PATTERN.exec(error?.message ?? '')?.[1];
    const hint =
        wantedPage === undefined ? undefined : PAGE_SWITCH_HINTS[wantedPage];
    if (hint === undefined) {
        return null;
    }
    // Point at the switch control wherever it is; purely best-effort.
    try {
        await callTool('owa_find_ui', {
            text: hint.find,
            highlight: true,
            anyPage: true,
        });
    } catch (_error) {
        // The words alone still tell them where to press.
    }
    return {
        text:
            `**Go to ${hint.pageName} first.** Click ${hint.words} — I have ` +
            'outlined it in red. When it is showing, come back here and ' +
            "press **I'm there — start it**.",
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
): Promise<BotActionResultType> {
    if (action.toolName === undefined) {
        return { text: 'Done.', isNeedingModel: action.ask !== undefined };
    }
    if (action.toolName === 'owa_guide_start') {
        let status;
        try {
            status = parseToolJson(
                await callTool(action.toolName, action.args ?? {}),
            );
        } catch (error: any) {
            // The focus says Presenter but the window is the Bible Reader:
            // the guide cannot start, so guide THEM across first.
            const switchAnswer = await genPageSwitchAnswer(error, action);
            if (switchAnswer !== null) {
                return switchAnswer;
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
        const isDemoAsked = action.args?.mode === 'demo';
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
