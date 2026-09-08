import { describe, expect, test, vi } from 'vitest';

// What the stopped-answer tests hand the bot instead of a real SDK client, and
// what they read back off it. Hoisted because the mock factories below are.
const { fake } = vi.hoisted(() => ({
    fake: {
        anthropic: null as any,
        toolCallList: [] as string[],
        toolList: [] as { name: string }[],
    },
}));

// Only `describeLlmError` is under test, and it touches nothing -- but the
// module pulls both SDKs and the setting store in at import time, so they are
// stubbed down to what loading needs.
vi.mock('../helper/ai/aiHelpers', () => ({
    getAISetting: () => ({
        openAIAPIKey: '',
        anthropicAPIKey: '',
        kimiAPIKey: '',
    }),
}));
vi.mock('../helper/ai/anthropicHelpers', () => ({
    getAnthropicInstance: () => fake.anthropic,
}));
vi.mock('../helper/ai/openAIHelpers', () => ({
    getOpenAIInstance: () => null,
}));
vi.mock('../helper/ai/kimiHelpers', () => ({
    getKimiInstance: () => null,
}));
// The fourth of them. Without it the module graph reaches `langHelpers` and
// `toastHelpers`, and this whole file dies at import on `document` -- these
// tests run in the node environment.
vi.mock('../helper/ai/freeHelpers', () => ({
    FREE_SERVICE_MAP: {
        // `homeUrl` too: the warning links are built off this map, so a mock
        // without it makes them come back pointing at nothing.
        llm7: { label: 'LLM7', homeUrl: 'https://llm7.io' },
        kilo: { label: 'Kilo', homeUrl: 'https://kilo.ai' },
    },
    getFreeInstance: () => null,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: () => {},
}));
// Same reason as the four above: `helpBotHelpers`, which this imports, now
// logs a failed button press, and `loggerHelpers` reaches `appProvider` --
// `document` at module scope in a node-env suite (memory
// `appprovider-mock-node-env`).
vi.mock('../helper/loggerHelpers', () => ({
    appError: vi.fn(),
}));
vi.mock('./mcpClient', () => ({
    callTool: async (name: string) => {
        fake.toolCallList.push(name);
        return '';
    },
    listTools: async () => {
        return fake.toolList ?? [];
    },
}));

import { AskCancelledError } from './cancelHelpers';
import { MODEL_HIDDEN_TOOL_MAP } from '../../tools/owa-devtools-mcp/modelTools.mjs';
import {
    applyToolWatch,
    askLlmBot,
    checkIsFreeProvider,
    describeLlmError,
    getAvailableLlmProviders,
    getFreeService,
    getLlmProviderWarning,
    getLlmProviderWarningLinks,
    toCleanToolName,
    genGuideRescueQuestion,
    genGuideRescueSummary,
    genToolWatch,
    toGuideRescueAnswer,
    toHistoryTurns,
    toWatchedManualId,
} from './llmBotHelpers';

// What the window shows when a call fails. The person reading it is a
// volunteer minutes before a service, so every branch has to come back as one
// line they can act on -- never the raw JSON body both SDKs put in `message`.
describe('describeLlmError', () => {
    test('a refused key sends them to the panel that holds it', () => {
        expect(describeLlmError({ status: 401 })).toContain(
            'Settings → Others',
        );
        expect(describeLlmError({ status: 403 })).toContain(
            'Settings → Others',
        );
    });

    test('a missing workspace id names the field to fill in', () => {
        const error = {
            status: 400,
            error: {
                error: {
                    message:
                        'anthropic-workspace-id is required when ' +
                        'authenticating with an identity-linked API key',
                },
            },
        };

        expect(describeLlmError(error)).toContain('workspace id');
        expect(describeLlmError(error)).toContain('Settings → Others');
    });

    test('a rate limit is said in money terms, not in HTTP', () => {
        expect(describeLlmError({ status: 429 })).toBe(
            'the AI account is out of credit or being rate-limited',
        );
    });

    test("the provider's own fault is not blamed on the user", () => {
        expect(describeLlmError({ status: 500 })).toBe(
            'the AI service is having trouble right now',
        );
        expect(describeLlmError({ status: 503 })).toBe(
            'the AI service is having trouble right now',
        );
    });

    // Mid-service on a church machine this is nearly always the real cause.
    test('no status at all reads as the connection, not as a bug', () => {
        expect(describeLlmError(new Error('fetch failed'))).toBe(
            'it could not be reached — the internet may be down',
        );
    });

    // Both SDKs prefix the raw JSON body with the status code. Showing that
    // is frightening, and the markdown renderer eats its underscores.
    test('a raw JSON body is never passed through', () => {
        const message =
            '400 {"type":"error","error":{"type":"invalid_request_error",' +
            '"message":"max_tokens: is too large"}}';

        const said = describeLlmError({ status: 400, message });

        expect(said).not.toContain('{');
        expect(said).toBe('the AI service refused the request (error 400)');
    });

    test('a short plain message is worth passing on as it is', () => {
        expect(
            describeLlmError({ status: 400, message: 'model not found' }),
        ).toBe('model not found');
    });

    test('a message too long for one line falls back to the status', () => {
        expect(
            describeLlmError({ status: 400, message: 'x'.repeat(400) }),
        ).toBe('the AI service refused the request (error 400)');
    });

    test('a status nested under `response` is found too', () => {
        expect(describeLlmError({ response: { status: 429 } })).toBe(
            'the AI account is out of credit or being rate-limited',
        );
    });
});

// What goes back to the model with the next question. The bug this answers was
// reported from a real window: the assistant offered to help show a screen,
// the user said "yes", and the reply was "It sounds like you might need help
// or have a question" -- every question was being asked on its own.
describe('toHistoryTurns', () => {
    test('a short exchange goes back whole', () => {
        const turns = toHistoryTurns([
            { author: 'you', text: 'Is any screen showing right now?' },
            { author: 'bot', text: 'No. Would you like help to show one?' },
        ]);
        expect(turns).toEqual([
            { author: 'you', text: 'Is any screen showing right now?' },
            { author: 'bot', text: 'No. Would you like help to show one?' },
        ]);
    });

    test('only the newest exchanges are paid for', () => {
        const turns = toHistoryTurns(
            Array.from({ length: 20 }, (_item, index) => {
                return {
                    author:
                        index % 2 === 0 ? ('you' as const) : ('bot' as const),
                    text: `turn ${index}`,
                };
            }),
        );
        expect(turns).toHaveLength(6);
        expect(turns[0]).toEqual({ author: 'you', text: 'turn 14' });
        expect(turns[5]).toEqual({ author: 'bot', text: 'turn 19' });
    });

    test('the oldest turn is never the assistant', () => {
        // Both providers take the user first, and an answer whose question was
        // left behind reads as the assistant having spoken unprompted.
        const turns = toHistoryTurns([
            { author: 'bot', text: 'Welcome.' },
            { author: 'you', text: 'How do I show a screen?' },
        ]);
        expect(turns).toEqual([
            { author: 'you', text: 'How do I show a screen?' },
        ]);
    });

    test('two of a kind in a row are joined, not dropped', () => {
        // A tab reloaded after the window was closed mid-answer.
        const turns = toHistoryTurns([
            { author: 'you', text: 'first' },
            { author: 'bot', text: 'half one' },
            { author: 'bot', text: 'half two' },
        ]);
        expect(turns).toEqual([
            { author: 'you', text: 'first' },
            { author: 'bot', text: 'half one\nhalf two' },
        ]);
    });

    test('empty turns are left out', () => {
        expect(
            toHistoryTurns([
                { author: 'you', text: 'a question' },
                { author: 'bot', text: '   ' },
            ]),
        ).toEqual([{ author: 'you', text: 'a question' }]);
    });

    test('a long answer keeps its END as well as its opening', () => {
        // The end is where the offer lives, and the offer is what "yes" is
        // answering -- so a head-only clip throws away the needed half.
        const long =
            'step one. '.repeat(200) + 'Would you like me to walk you through?';
        const [turn] = toHistoryTurns([{ author: 'you', text: long }]);
        expect(turn.text.length).toBeLessThan(long.length);
        expect(turn.text).toContain('step one.');
        expect(turn.text).toContain('Would you like me to walk you through?');
    });

    test('the whole history stays within its budget', () => {
        const turns = toHistoryTurns(
            Array.from({ length: 6 }, (_item, index) => {
                return {
                    author:
                        index % 2 === 0 ? ('you' as const) : ('bot' as const),
                    text: `${index} `.repeat(400),
                };
            }),
        );
        const total = turns.reduce((sum, turn) => {
            return sum + turn.text.length;
        }, 0);
        expect(total).toBeLessThanOrEqual(2400);
        // Trimmed from the OLD end: what is left is the most recent exchange,
        // which is the one a follow-up refers to.
        expect(turns[turns.length - 1].text).toContain('5');
        expect(turns[0].author).toBe('you');
    });
});

// The question a stuck walkthrough card asks on the user's behalf. It is a
// user turn rather than another paragraph of the system prompt, so it costs
// nothing on every other question asked in the window.
describe('genGuideRescueQuestion', () => {
    const request = {
        token: 4,
        title: 'Look up and present a Bible verse',
        stepNumber: 3,
        stepCount: 6,
        stepText:
            'The verse renders in the preview panel. Double-click it' +
            ' to present.',
        reason: 'nothing on screen to act on',
        looked: [],
        nearMisses: ['Bible Lookup', 'Clear Bible'],
    };

    test('carries the step, the failure and what is really on screen', () => {
        const asked = genGuideRescueQuestion(request);
        expect(asked).toContain('step 3 of 6');
        expect(asked).toContain('Double-click it to present');
        // NOT the matcher's own words: "nothing on screen to act on" reads as
        // a report that nothing is on the projector, and the system prompt
        // teaches the model to go and diagnose exactly that. Measured live,
        // three rescues in three then answered about displays instead of the
        // step.
        expect(asked).not.toContain('nothing on screen to act on');
        expect(asked).toContain('is not anywhere in the window');
        expect(asked).toContain('not about the projector');
        expect(asked).toContain('Bible Lookup, Clear Bible');
        // A step that named nothing says so, rather than leaving the model to
        // wonder what the card was aiming at.
        expect(asked).toContain('named no control');
    });

    test('names the three shapes a stuck step really takes', () => {
        const asked = genGuideRescueQuestion(request);
        expect(asked).toContain('only something to read');
        expect(asked).toContain('not about the projector');
        expect(asked).toContain('under other words');
        expect(asked).toContain('double-click, a drag');
        // The whole point: never hand back the apology the card could already
        // give on its own.
        expect(asked).toContain('Never say it cannot be done');
    });

    test('holds the answer to what fits on a card', () => {
        const asked = genGuideRescueQuestion(request);
        expect(asked).toContain('ONE or TWO short sentences');
        expect(asked).toContain('220 characters');
        expect(asked).toContain('no ids');
        // The failure this line was written for: an answer that narrated the
        // card back at the person reading it -- "I can see the walkthrough
        // card at the bottom of the Presenter window showing Step 3/6..."
        // The failures these lines were written for: answers that narrated
        // the window back at the person looking at it -- "I can see the
        // walkthrough card...", "The screenshot shows the Presenter window."
        // A frame it has to fill holds where a prohibition did not.
        expect(asked).toContain('DO: <what to do>');
        expect(asked).toContain('starts with the verb');
        // A small model follows an example further than a rule, so it is
        // given one per case rather than a fourth rule.
        expect(asked).toContain(
            'DO: Double-click the verse in the preview panel',
        );
        // Four examples invited copying: one live run answered "Nothing to
        // press on this step" -- an example, verbatim -- on a step that
        // plainly had something to do. Two, and a line saying they are the
        // shape rather than the words.
        expect(asked).not.toContain('DO: Nothing to press on this step');
        expect(asked).toContain('the shape, not the words');
        // The drift this run chased: told to "look at the window", the model
        // reached for owa_list_screens and reported the projector instead.
        expect(asked).toContain('owa_list_ui');
        expect(asked).toContain('use nothing else');
        // ...and the leak that came with sending it there: the model pasted
        // the tool's joined label at the user -- "Bible Lookup Open bible
        // lookup popup [Ctrl+B]" -- which is three names for one button.
        expect(asked).toContain('words a person can READ on it');
    });

    test('survives a request with nothing in it', () => {
        expect(() => {
            return genGuideRescueQuestion({});
        }).not.toThrow();
    });

    // What goes in the transcript is NOT what goes to the model: the question
    // above is machine instruction, and a volunteer reading their own chat
    // must not be shown it.
    test('the transcript gets the human half, not the instructions', () => {
        const shown = genGuideRescueSummary(request);
        expect(shown).toContain('got stuck on step 3');
        expect(shown).toContain('Look up and present a Bible verse');
        expect(shown).toContain('Double-click it to present');
        expect(shown).not.toContain('220 characters');
        expect(shown).not.toContain('owa_find_ui');
        expect(shown.length).toBeLessThan(
            genGuideRescueQuestion(request).length,
        );
    });

    // Every OTHER answer in this window ends with a row of buttons. This one
    // is drawn on a card that has none, so the question says so -- and
    // `toGuideRescueAnswer` strips it anyway, because a rule the model can
    // ignore is not a rule.
    test('it tells the model there are no buttons on the card', () => {
        expect(genGuideRescueQuestion(request)).toContain('no OPTIONS');
    });
});

// The card is one line of plain text in a shadow root, so whatever the model
// wrote for a chat window has to be flattened before it is drawn there.
describe('toGuideRescueAnswer', () => {
    test('drops the markup that would show up as asterisks', () => {
        expect(
            toGuideRescueAnswer(
                'Click **Videos**, then `double-click` the item.',
            ),
        ).toBe('Click Videos, then double-click the item.');
    });

    test('flattens a list the model wrote anyway into one line', () => {
        expect(
            toGuideRescueAnswer('Do this:\n1. Open it\n- then press Next'),
        ).toBe('Do this: Open it then press Next');
    });

    test('cuts on a sentence rather than mid-word', () => {
        const long =
            'Double-click the verse in the preview panel on the left of the ' +
            'window to put it on the screen. That is one of the few steps ' +
            'I cannot press for you, because a double-click is not a click. ' +
            'Press Next when the verse is showing.';
        const cut = toGuideRescueAnswer(long);
        expect(cut.length).toBeLessThanOrEqual(240);
        expect(cut.endsWith('.')).toBe(true);
        expect(cut).toContain('Double-click the verse');
    });

    test('leaves a short answer exactly as it is', () => {
        expect(toGuideRescueAnswer('Nothing to press here — press Next.')).toBe(
            'Nothing to press here — press Next.',
        );
    });

    // Measured live: told not to narrate, a small model narrates anyway. The
    // frame is what the code can hold it to.
    test('takes the instruction out of the narration in front of it', () => {
        expect(
            toGuideRescueAnswer(
                [
                    'I can see the verse "For God so loved the world" in',
                    'the preview area on the right.',
                    'DO: Double-click that verse to present it.',
                ].join('\n'),
            ),
        ).toBe('Double-click that verse to present it.');
    });

    test('survives the marker arriving in markup', () => {
        expect(toGuideRescueAnswer('**DO:** Press Next.')).toBe('Press Next.');
    });

    test('keeps the whole answer when the frame was ignored', () => {
        // Half an answer on the card is worse than a wordy one.
        expect(toGuideRescueAnswer('Double-click the verse.')).toBe(
            'Double-click the verse.',
        );
    });

    // The system prompt asks for an options line on EVERY answer, and this
    // question rides the same prompt. Those options are the chat window's
    // buttons; the card has none, so the line is machinery and it is the
    // code's job to take it off, not the model's to remember.
    test('an options line meant for the chat window never reaches the card', () => {
        expect(
            toGuideRescueAnswer(
                [
                    'DO: Double-click the verse to present it.',
                    'OPTIONS: Yes | No thanks',
                ].join('\n'),
            ),
        ).toBe('Double-click the verse to present it.');
    });
});

// Stopping an answer that is already on its way. What matters is not that the
// window stops LISTENING -- it is that the app stops spending: a tool loop is
// up to ten model calls, and the user who has given up is still being charged
// for every one of them until something says so.
describe('askLlmBot, stopped', () => {
    function useFakeAnthropic(create: (...args: any[]) => any) {
        fake.toolCallList = [];
        fake.anthropic = { messages: { create } };
    }

    test('a stop before the first round is never paid for', async () => {
        const createMock = vi.fn();
        useFakeAnthropic(createMock);
        const controller = new AbortController();
        controller.abort();

        await expect(
            askLlmBot(
                'how do I show a screen?',
                'presenter',
                'anthropic',
                'm',
                [],
                controller.signal,
            ),
        ).rejects.toBeInstanceOf(AskCancelledError);
        expect(createMock).not.toHaveBeenCalled();
    });

    // The loop looked something up, the user gave up while it did, and the
    // round that would have read the result must not be asked for.
    test('a stop mid-lookup does not buy another round', async () => {
        const controller = new AbortController();
        const createMock = vi.fn(async () => {
            // The press lands while the model call is in flight.
            controller.abort();
            return {
                content: [
                    {
                        type: 'tool_use',
                        id: 'tool-1',
                        name: 'owa_help_search',
                        input: {},
                    },
                ],
            };
        });
        useFakeAnthropic(createMock);

        await expect(
            askLlmBot(
                'how do I show a screen?',
                'presenter',
                'anthropic',
                'm',
                [],
                controller.signal,
            ),
        ).rejects.toBeInstanceOf(AskCancelledError);
        expect(createMock).toHaveBeenCalledTimes(1);
    });

    // `describeLlmError` reads an aborted request as an unreachable service.
    // Telling a volunteer their building's internet is down because they
    // pressed Stop is the worst sentence this window could produce.
    test('a stop is never described as the internet being down', async () => {
        const controller = new AbortController();
        useFakeAnthropic(async () => {
            controller.abort();
            const error: any = new Error('Request was aborted.');
            error.name = 'APIUserAbortError';
            throw error;
        });

        const raised = await askLlmBot(
            'how do I show a screen?',
            'presenter',
            'anthropic',
            'm',
            [],
            controller.signal,
        ).catch((error: any) => {
            return error;
        });

        expect(raised.message).not.toContain('internet');
        expect(raised.name).toBe('APIUserAbortError');
    });
});

// Which recipe the two walkthrough buttons under an answer walk through. The
// reported failure: "Is any screen showing right now?" was answered correctly
// about the mini screen, and its "Show me step by step" button started an
// eight-step walkthrough of the keyboard screencast -- because the model's
// first search happened to rank that page first and the id was latched there.
describe('the watch catches a drafted song', () => {
    const genDraftResult = (isValid: boolean) => {
        return [
            'Drafted a song from the text.',
            '',
            isValid
                ? 'Valid Open Lyric. No problems found.'
                : 'Not valid Open Lyric — 1 problem.',
            '',
            'The song itself is below.',
            '```ol:Config',
            '- Title: Lantern On The Water',
            '- Structure: V1',
            '```',
            '',
            '```ol:Verse 1',
            'Down by the quiet harbour wall',
            '```',
        ].join('\n');
    };

    test('lifts the document out of a clean draft', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_lyric_validate',
            { mode: 'draft' },
            genDraftResult(true),
        );
        expect(watch.draftedLyric).toContain('- Title: Lantern On The Water');
        expect(watch.draftedLyric).toContain('ol:Verse 1');
    });

    test('ignores a draft that did not come out valid', () => {
        // Offering "create this file" for a song the editor will refuse is
        // worse than offering nothing.
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_lyric_validate',
            { mode: 'draft' },
            genDraftResult(false),
        );
        expect(watch.draftedLyric).toBeNull();
    });

    test('ignores an ordinary check of a song they already had', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_lyric_validate',
            {},
            'Valid Open Lyric. No problems found.',
        );
        expect(watch.draftedLyric).toBeNull();
    });

    test('a second draft wins, and a failed one does not undo the first', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_lyric_validate',
            { mode: 'draft' },
            genDraftResult(true),
        );
        applyToolWatch(
            watch,
            'owa_lyric_validate',
            { mode: 'draft' },
            genDraftResult(true).replace('Lantern On The Water', 'Second Song'),
        );
        expect(watch.draftedLyric).toContain('Second Song');
        applyToolWatch(
            watch,
            'owa_lyric_validate',
            { mode: 'draft' },
            genDraftResult(false),
        );
        expect(watch.draftedLyric).toContain('Second Song');
    });
});

describe('toWatchedManualId', () => {
    function genSearchResult(...ids: string[]) {
        return JSON.stringify(
            ids.map((id) => {
                return { id, kind: 'manual', title: id };
            }),
        );
    }

    test('a later search replaces an earlier one', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_help_search', {}, genSearchResult('W-20'));
        applyToolWatch(watch, 'owa_help_search', {}, genSearchResult('W-10'));
        expect(toWatchedManualId(watch)).toBe('W-10');
    });

    test('a page the model OPENED beats every page it merely searched', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_help_search', {}, genSearchResult('W-20'));
        applyToolWatch(watch, 'owa_help_page', { id: 'W-10' }, '# W-10');
        // ...even when a later search ranks something else first again.
        applyToolWatch(watch, 'owa_help_search', {}, genSearchResult('W-05'));
        expect(toWatchedManualId(watch)).toBe('W-10');
    });

    test('the last page opened wins over an earlier one', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_help_page', { id: 'W-19' }, '# W-19');
        applyToolWatch(watch, 'owa_help_page', { id: 'W-10' }, '# W-10');
        expect(toWatchedManualId(watch)).toBe('W-10');
    });

    test('nothing is offered when the model put a card up itself', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_help_page', { id: 'W-06' }, '# W-06');
        applyToolWatch(watch, 'owa_guide_start', { manualId: 'W-06' }, '{}');
        expect(toWatchedManualId(watch)).toBeNull();
    });

    test('nothing is offered when it never looked anything up', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_list_screens', {}, '[]');
        expect(toWatchedManualId(watch)).toBeNull();
    });

    test('an internal-only hit is not a recipe, and prose is not a hit', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_help_search',
            {},
            JSON.stringify([{ id: 'x', kind: 'internal' }]),
        );
        expect(toWatchedManualId(watch)).toBeNull();
        applyToolWatch(watch, 'owa_help_search', {}, 'nothing matches that');
        expect(toWatchedManualId(watch)).toBeNull();
    });

    test('a search that finds nothing does not erase what was found', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_help_search', {}, genSearchResult('W-10'));
        applyToolWatch(watch, 'owa_help_search', {}, JSON.stringify([]));
        expect(toWatchedManualId(watch)).toBe('W-10');
    });
});

// A question can now carry a picture, and can be ADDED TO while it is being
// answered. Both change the one thing this loop is careful about -- the shape
// of `messages` -- so both are asserted on the array the SDK is actually
// handed, not on what the window shows.
describe('askLlmBot, carrying more than words', () => {
    function useFakeAnthropic(create: (...args: any[]) => any) {
        fake.toolCallList = [];
        fake.anthropic = { messages: { create } };
    }
    const answerRound = {
        content: [{ type: 'text', text: 'Press F5.' }],
    };
    const toolRound = {
        content: [
            {
                type: 'tool_use',
                id: 'tool-1',
                name: 'owa_help_search',
                input: {},
            },
        ],
    };

    test('an attached picture rides the question, ahead of its words', async () => {
        const sent: any[] = [];
        useFakeAnthropic(async ({ messages }: any) => {
            sent.push(structuredClone(messages));
            return answerRound;
        });
        await askLlmBot(
            'what is this?',
            'presenter',
            'anthropic',
            'm',
            [],
            null,
            {
                images: [{ mediaType: 'image/png', data: 'AAAA' }],
            },
        );
        const content = sent[0][0].content;
        // Images first, then the words: the order Anthropic's own vision
        // guidance asks for.
        expect(content[0]).toEqual({
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: 'AAAA' },
        });
        expect(content[1]).toEqual({ type: 'text', text: 'what is this?' });
    });

    // The exact refusal this guards: Anthropic rejects the whole request over
    // an empty text block, and `describeLlmError` reads that as an unreachable
    // service -- so a volunteer who sent the screenshot they had just been
    // ASKED for was told the provider was down.
    test('a picture with no words never sends an empty text block', async () => {
        const sent: any[] = [];
        useFakeAnthropic(async ({ messages }: any) => {
            sent.push(structuredClone(messages));
            return answerRound;
        });
        await askLlmBot('   ', 'presenter', 'anthropic', 'm', [], null, {
            images: [{ mediaType: 'image/png', data: 'AAAA' }],
        });
        const content = sent[0][0].content;
        expect(content[0].type).toBe('image');
        expect(content[1].type).toBe('text');
        expect(content[1].text.trim().length).toBeGreaterThan(0);
    });

    // Nothing typed and nothing to look at is not a question. It fails as
    // itself rather than being posted and refused as a broken provider.
    test('an ask with no words and no picture is refused before the call', async () => {
        const create = vi.fn(async () => answerRound);
        useFakeAnthropic(create);
        await expect(
            askLlmBot('   ', 'presenter', 'anthropic', 'm'),
        ).rejects.toThrow(/no question/i);
        expect(create).not.toHaveBeenCalled();
    });

    // The same refusal, arriving several rounds in and after the money has
    // been spent: a round that calls a tool can carry an empty text block
    // beside it, and the loop echoes that content back on the next round.
    test('an empty text block in the model own round is not echoed back', async () => {
        const sent: any[] = [];
        let round = 0;
        useFakeAnthropic(async ({ messages }: any) => {
            sent.push(structuredClone(messages));
            round += 1;
            return round === 1
                ? {
                      content: [
                          { type: 'text', text: '' },
                          ...toolRound.content,
                      ],
                  }
                : answerRound;
        });
        await askLlmBot('why is it blank?', 'presenter', 'anthropic', 'm');
        const assistant = sent[1].find((message: any) => {
            return message.role === 'assistant';
        });
        for (const block of assistant.content) {
            expect(block.type === 'text' && block.text.trim() === '').toBe(
                false,
            );
        }
        // ...and what it was called for is still there.
        expect(assistant.content.length).toBeGreaterThan(0);
    });

    test('a question with no picture stays a plain string', async () => {
        const sent: any[] = [];
        useFakeAnthropic(async ({ messages }: any) => {
            sent.push(structuredClone(messages));
            return answerRound;
        });
        await askLlmBot(
            'how do I show a screen?',
            'presenter',
            'anthropic',
            'm',
        );
        expect(sent[0][0].content).toBe('how do I show a screen?');
    });

    // The shape that matters: tool results FIRST, the addition's text AFTER
    // them, all in ONE user message. Two consecutive user messages would be
    // merged rather than refused, which is worse -- it would look right.
    test('an addition rides the tool-result message, after the results', async () => {
        const sent: any[] = [];
        let round = 0;
        useFakeAnthropic(async ({ messages }: any) => {
            sent.push(structuredClone(messages));
            round += 1;
            return round === 1 ? toolRound : answerRound;
        });
        let isGiven = false;
        await askLlmBot(
            'why is it blank?',
            'presenter',
            'anthropic',
            'm',
            [],
            null,
            {
                takeAdditions: () => {
                    if (isGiven) {
                        return [];
                    }
                    isGiven = true;
                    return ['it is screen 2'];
                },
            },
        );
        const second = sent[1];
        const last = second[second.length - 1];
        expect(last.role).toBe('user');
        expect(last.content[0].type).toBe('tool_result');
        expect(last.content[1]).toEqual({
            type: 'text',
            text: expect.stringContaining('it is screen 2'),
        });
        // Never two user messages in a row.
        for (let index = 1; index < second.length; index++) {
            expect(
                second[index].role === 'user' &&
                    second[index - 1].role === 'user',
            ).toBe(false);
        }
    });

    // The drain sits where the next model call is guaranteed. An answer that
    // needed no tools has no round left to carry an addition, so the queue must
    // come back untouched for the caller to ask on its own.
    test('nothing is drained when the model never called a tool', async () => {
        useFakeAnthropic(async () => {
            return answerRound;
        });
        const takeAdditions = vi.fn(() => []);
        await askLlmBot(
            'how do I show a screen?',
            'presenter',
            'anthropic',
            'm',
            [],
            null,
            {
                takeAdditions,
            },
        );
        expect(takeAdditions).not.toHaveBeenCalled();
    });
});

// THE KEYLESS PROVIDER. It is what a volunteer gets before anybody has typed an
// API key, so every one of these is about the state the app ships in, not an
// edge case. The mocked `getAISetting` above returns three empty keys, which is
// exactly that state.
describe('the free provider', () => {
    test('answers when no key at all is set', () => {
        // The whole point. Before this existed the list came back empty, the
        // window said "No AI key", and the offline manual search was the only
        // thing a new install could do.
        expect(getAvailableLlmProviders()).toEqual(['free']);
    });

    test('is last, so any real key outranks it', () => {
        // Order is the mechanism, not a coincidence: `getLlmProvider` takes
        // the first available one, so the keyless provider must sort behind
        // every paid one or a user with a key would silently be answered by a
        // public service.
        const available = getAvailableLlmProviders();
        expect(available.at(-1)).toBe('free');
    });

    test('only the keyless one carries a warning', () => {
        // A user paying for their own account is told nothing: they made that
        // arrangement themselves.
        expect(getLlmProviderWarning('anthropic')).toBeNull();
        expect(getLlmProviderWarning('openai')).toBeNull();
        expect(getLlmProviderWarning('kimi')).toBeNull();
        const warning = getLlmProviderWarning('free');
        expect(warning).not.toBeNull();
        // The three facts it exists to state.
        expect(warning).toContain('free public AI service');
        expect(warning).toContain('leave this computer');
        expect(warning).toContain('Settings');
    });

    test('names the services it trusts, with a way to go and read them', () => {
        // A warning that says "a free public AI service" and stops there asks
        // the user to accept a stranger on the app's word. These are the only
        // providers in the window they have no account with.
        const links = getLlmProviderWarningLinks('free');
        expect(links.map((one) => one.label)).toEqual(['LLM7', 'Kilo']);
        for (const link of links) {
            expect(link.url.startsWith('https://')).toBe(true);
        }
        // Nothing to read for a provider the user signed up with themselves.
        expect(getLlmProviderWarningLinks('anthropic')).toEqual([]);
        expect(getLlmProviderWarningLinks(null)).toEqual([]);
    });

    test('knows itself apart from the keyed providers', () => {
        expect(checkIsFreeProvider('free')).toBe(true);
        expect(checkIsFreeProvider('anthropic')).toBe(false);
        expect(checkIsFreeProvider(null)).toBe(false);
    });

    test('sends each free model to the service it actually lives on', () => {
        // The two halves are different hosts. A Kilo model id posted to LLM7
        // is a 400 the window reports as the internet being down.
        expect(getFreeService('gpt-oss')).toBe('llm7');
        expect(getFreeService('minimax-m2.7')).toBe('llm7');
        expect(getFreeService('stepfun/step-3.7-flash:free')).toBe('kilo');
        expect(getFreeService('nvidia/nemotron-3.5-lightning:free')).toBe(
            'kilo',
        );
    });

    test('a model dropped by a later build still gets asked somewhere', () => {
        // A setting written by an older build names a model this one no longer
        // lists. Falling back costs one clear error; refusing to resolve costs
        // the user their assistant.
        expect(getFreeService('some-model-that-went-away')).toBe('llm7');
    });
});

// Free models are open-weight ones behind gateways that did not train them,
// and they misbehave in ways a first-party API never does. Both of these were
// measured against the live free tier before they were fixed.
describe('toCleanToolName', () => {
    test('strips the harmony channel marker a gateway leaked into the name', () => {
        // Measured live: four calls across eight questions came back like
        // this, every one of them a tool that does not exist, every one of
        // them a whole round spent on an error.
        expect(toCleanToolName('owa_list_ui<|channel|>commentary')).toBe(
            'owa_list_ui',
        );
        expect(toCleanToolName('owa_help_page<|channel|>commentary')).toBe(
            'owa_help_page',
        );
    });

    test('leaves a well-behaved name exactly as it is', () => {
        // No real tool name contains `<`, so this is free for every provider
        // that never had the problem.
        expect(toCleanToolName('owa_help_search')).toBe('owa_help_search');
        expect(toCleanToolName('take_snapshot')).toBe('take_snapshot');
    });

    test('survives a model that sent no name at all', () => {
        // Reached with an empty string, which `runMcpTool` reports back to the
        // model as an unknown tool -- a round it can route around, not a throw
        // that loses the whole question.
        expect(toCleanToolName(undefined)).toBe('');
    });
});

// The list the model is sent is the whole tool bill, paid on every round of
// every question, and it is also the list of things it can be talked into
// doing. Both halves are tested here because either alone is a hole.
describe('the tools the model is not offered', () => {
    function useFakeAnthropic(create: (...args: any[]) => any) {
        fake.toolCallList = [];
        fake.anthropic = { messages: { create } };
    }

    test('they never reach the model', async () => {
        fake.toolList = [
            { name: 'owa_find_ui' },
            { name: 'take_screenshot' },
            { name: 'click' },
            { name: 'lighthouse_audit' },
            { name: 'owa_help_search' },
        ];
        const createMock = vi.fn(async (_body: any) => {
            return { content: [{ type: 'text', text: 'press F5' }] };
        });
        useFakeAnthropic(createMock);

        await askLlmBot('how do I show a screen?', 'presenter', 'anthropic');

        const sentList = createMock.mock.calls[0][0].tools.map((one: any) => {
            return one.name;
        });
        expect(sentList).toEqual(['owa_find_ui', 'owa_help_search']);
        fake.toolList = [];
    });

    // The half that makes it true rather than merely cheaper: these tools are
    // named in the app's own manual, which the model can read, so a filtered
    // list is a suggestion until the call is refused too.
    test('naming one anyway does not call it', async () => {
        const createMock = vi
            .fn()
            .mockImplementationOnce(async () => {
                return {
                    content: [
                        {
                            type: 'tool_use',
                            id: 'tool-1',
                            name: 'take_screenshot',
                            input: {},
                        },
                    ],
                };
            })
            .mockImplementationOnce(async () => {
                return { content: [{ type: 'text', text: 'press F5' }] };
            });
        useFakeAnthropic(createMock);

        await askLlmBot('what is on my screen?', 'presenter', 'anthropic');

        expect(fake.toolCallList).not.toContain('take_screenshot');
        // ...and it is told what to do instead, in the same shape the
        // firewall answers with: a sentence, not a failure.
        const secondRound = createMock.mock.calls[1][0].messages;
        expect(JSON.stringify(secondRound)).toContain('send me a picture');
    });

    test('an offered tool is still called', async () => {
        const createMock = vi
            .fn()
            .mockImplementationOnce(async () => {
                return {
                    content: [
                        {
                            type: 'tool_use',
                            id: 'tool-1',
                            name: 'owa_find_ui',
                            input: {},
                        },
                    ],
                };
            })
            .mockImplementationOnce(async () => {
                return { content: [{ type: 'text', text: 'there it is' }] };
            });
        useFakeAnthropic(createMock);

        await askLlmBot(
            'where is the setting button?',
            'presenter',
            'anthropic',
        );

        expect(fake.toolCallList).toContain('owa_find_ui');
    });

    // A refusal the model cannot act on is a round spent on an apology.
    test('every reason says what to do instead', () => {
        for (const [name, reason] of Object.entries(MODEL_HIDDEN_TOOL_MAP)) {
            expect(reason.length, name).toBeGreaterThan(40);
        }
    });

    // The two guarded tools must never end up in here: they are the only way
    // the model can act on a control at all.
    test('the guarded pair stays offered', () => {
        expect(MODEL_HIDDEN_TOOL_MAP.owa_click).toBeUndefined();
        expect(MODEL_HIDDEN_TOOL_MAP.owa_type).toBeUndefined();
    });
});

// The waiting line is only worth anything if the steps on it are TRUE, which
// means they have to come from the loop as it works rather than be guessed at
// by the window. These assert the seam, not the wording -- the wording is
// `progressHelpers`' own test.
describe('askLlmBot, saying what it is doing', () => {
    function useFakeAnthropic(create: (...args: any[]) => any) {
        fake.toolCallList = [];
        fake.toolList = [{ name: 'owa_help_search' }];
        fake.anthropic = { messages: { create } };
    }

    test('every step is opened and closed, in order, and none is left running', async () => {
        const createMock = vi
            .fn()
            .mockImplementationOnce(async () => {
                return {
                    content: [
                        {
                            type: 'tool_use',
                            id: 'tool-1',
                            name: 'owa_help_search',
                            input: { query: 'background' },
                        },
                    ],
                };
            })
            .mockImplementationOnce(async () => {
                return { content: [{ type: 'text', text: 'Press F5.' }] };
            });
        useFakeAnthropic(createMock);
        const steps: { id: number; text: string; isDone: boolean }[] = [];

        await askLlmBot(
            'how do I add a background?',
            'presenter',
            'anthropic',
            'm',
            [],
            null,
            {
                onProgress: (step) => {
                    steps.push({ ...step });
                },
            },
        );

        const opened = steps.filter((step) => {
            return !step.isDone;
        });
        // Connecting, the first round, the lookup, the second round.
        expect(
            opened.map((step) => {
                return step.text;
            }),
        ).toEqual([
            'Connecting to the app',
            'Thinking about it',
            'Searching the guide for “background”',
            'Thinking it over (2)',
        ]);
        // Nothing may be left spinning: a step with no close is a line that
        // stays breathing under a finished answer.
        for (const step of opened) {
            expect(
                steps.some((one) => {
                    return one.id === step.id && one.isDone;
                }),
                step.text,
            ).toBe(true);
        }
        // Ids are unique per step, or a finish lands on the wrong start.
        const ids = new Set(
            opened.map((step) => {
                return step.id;
            }),
        );
        expect(ids.size).toBe(opened.length);
    });

    test('a step that fails is still closed', async () => {
        // The model round throws. The line must not keep saying it is
        // thinking about a question that has already gone wrong.
        useFakeAnthropic(async () => {
            throw new Error('nope');
        });
        const steps: { id: number; isDone: boolean }[] = [];
        await expect(
            askLlmBot('why?', 'presenter', 'anthropic', 'm', [], null, {
                onProgress: (step) => {
                    steps.push({ id: step.id, isDone: step.isDone });
                },
            }),
        ).rejects.toThrow();
        for (const step of steps.filter((one) => {
            return !one.isDone;
        })) {
            expect(
                steps.some((one) => {
                    return one.id === step.id && one.isDone;
                }),
            ).toBe(true);
        }
    });

    test('asking without one costs nothing and breaks nothing', async () => {
        useFakeAnthropic(async () => {
            return { content: [{ type: 'text', text: 'Press F5.' }] };
        });
        const answer = await askLlmBot('how?', 'presenter', 'anthropic');
        expect(answer.text).toBe('Press F5.');
    });
});

describe('the walkthrough buttons ignore a hit under the floor', () => {
    test('a score-2 page is no recipe; a real one is', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_help_search',
            {},
            JSON.stringify([{ id: 'W-01', kind: 'manual', score: 2 }]),
        );
        expect(toWatchedManualId(watch)).toBeNull();
        applyToolWatch(
            watch,
            'owa_help_search',
            {},
            JSON.stringify([
                { id: 'W-01', kind: 'manual', score: 3 },
                { id: 'W-10', kind: 'manual', score: 40 },
            ]),
        );
        expect(toWatchedManualId(watch)).toBe('W-10');
    });
});
