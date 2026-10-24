import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// What the stopped-answer tests hand the bot instead of a real SDK client, and
// what they read back off it. Hoisted because the mock factories below are.
const { fake } = vi.hoisted(() => ({
    fake: {
        anthropic: null as any,
        toolCallList: [] as string[],
        // Each call's arguments as the loop sent them, beside its name.
        toolArgsList: [] as { name: string; args: any }[],
        toolList: [] as { name: string }[],
        // What `callTool` answers, by tool name; unset means an empty string.
        toolResultMap: null as Record<string, string> | null,
        // The pictures `callToolWithPictures` answers with, by tool name.
        toolPicturesMap: null as Record<string, any[]> | null,
        // A fake OpenAI-shaped client, for the stand-in tests; null means the
        // provider is not set up, which is what the module answers then.
        openai: null as any,
        // The same for Amazon Bedrock, which rides the same loop -- and its
        // Claude client, which rides the Anthropic one.
        bedrock: null as any,
        bedrockClaude: null as any,
        // The AWS region Settings names; us-west-2 is the app's default.
        bedrockRegion: 'us-west-2',
        // The user's own servers (usable ones) and the fake client asked for
        // any of them; none by default, the state the app ships in.
        customServers: [] as any[],
        custom: null as any,
        // What LM Studio's own list says about the models, by model id; null
        // is a server that is not LM Studio (or did not answer in time).
        lmStudioInfoMap: null as Map<string, any> | null,
        // The keys `getAISetting` answers with; null means none at all, the
        // state the app ships in and the one most of this file assumes.
        aiSetting: null as Record<string, string> | null,
    },
}));

// Only `describeLlmError` is under test, and it touches nothing -- but the
// module pulls both SDKs and the setting store in at import time, so they are
// stubbed down to what loading needs.
vi.mock('../helper/ai/aiHelpers', () => ({
    getAISetting: () => {
        return (
            fake.aiSetting ?? {
                openAIAPIKey: '',
                anthropicAPIKey: '',
                kimiAPIKey: '',
            }
        );
    },
    getBedrockRegion: () => fake.bedrockRegion,
}));
vi.mock('../helper/ai/anthropicHelpers', () => ({
    getAnthropicInstance: () => fake.anthropic,
}));
vi.mock('../helper/ai/openAIHelpers', () => ({
    getOpenAIInstance: () => fake.openai,
}));
vi.mock('../helper/ai/kimiHelpers', () => ({
    getKimiInstance: () => null,
}));
vi.mock('../helper/ai/bedrockHelpers', () => ({
    getBedrockInstance: () => fake.bedrock,
}));
vi.mock('../helper/ai/bedrockClaudeHelpers', () => ({
    getBedrockClaudeInstance: () => fake.bedrockClaude,
}));
// The user's own servers. The real modules reach the setting store and the
// relay's IPC, neither of which a node-env suite has.
vi.mock('../helper/ai/customServerHelpers', () => ({
    getCustomServers: () => fake.customServers,
    getAllCustomServers: () => fake.customServers,
    getUsableCustomServers: () => fake.customServers,
    readCustomServerModelInfo: async () => {
        return fake.lmStudioInfoMap === null
            ? null
            : {
                  kind: 'lm-studio',
                  infoMap: fake.lmStudioInfoMap,
                  commonInfo: null,
              };
    },
    findCustomModelInfo: (info: any, modelId: string) => {
        return info === null
            ? null
            : (info.infoMap.get(modelId) ?? info.commonInfo ?? null);
    },
}));
vi.mock('../helper/ai/customServerClientHelpers', () => ({
    genContextTooSmallText: (loadedContext: number | null) => {
        return `context ${loadedContext} is too small`;
    },
    genContextCutText: (loadedContext: number) => {
        return `answered from a question cut to ${loadedContext}`;
    },
    getCustomServerInstance: () => fake.custom,
    // The real one's patterns, in short: what the loop reads a tools
    // refusal by (GPT4All's server, llama-server without --jinja, a model
    // Ollama did not mark for tools).
    checkIsToolsRefused: (error: any) => {
        return /not supported|--jinja|does not support tools/i.test(
            String(error?.message ?? ''),
        );
    },
    toCustomServerFailure: (error: any) => {
        if (error?.name === 'CustomServerError') {
            return error;
        }
        return error?.cause?.name === 'CustomServerError' ? error.cause : null;
    },
}));
// The fourth of them. Without it the module graph reaches `langHelpers` and
// `toastHelpers`, and this whole file dies at import on `document` -- these
// tests run in the node environment.
vi.mock('../helper/ai/freeHelpers', () => ({
    FREE_SERVICE_MAP: {
        // `homeUrl` too: the warning links are built off this map, so a mock
        // without it makes them come back pointing at nothing.
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
    callTool: async (name: string, args?: any) => {
        fake.toolCallList.push(name);
        fake.toolArgsList.push({ name, args });
        return fake.toolResultMap?.[name] ?? '';
    },
    callToolWithPictures: async (name: string, args?: any) => {
        fake.toolCallList.push(name);
        fake.toolArgsList.push({ name, args });
        return {
            text: fake.toolResultMap?.[name] ?? '',
            pictures: fake.toolPicturesMap?.[name] ?? [],
        };
    },
    listTools: async () => {
        return fake.toolList ?? [];
    },
}));

import { AskCancelledError } from './cancelHelpers';
import { CustomServerError } from '../../electron/customLlmProtocol';
import {
    SpendLimitError,
    allowMoreSpending,
    getSpendState,
    resetSpendGuardForTests,
    setSpendLimitUsd,
} from './spendGuardHelpers';
import { MODEL_HIDDEN_TOOL_MAP } from '../../tools/owa-devtools-mcp/modelTools.mjs';
import {
    AUTO_ASSISTANT_WARNING,
    applyToolWatch,
    askLlmBot,
    checkCanSeeImages,
    checkIsNoCostCustomServer,
    getIsLlmAuto,
    toIsLlmAuto,
    checkHasMoreModels,
    checkIsCustomProvider,
    checkIsFreeProvider,
    getLlmProviderLabel,
    findBedrockRegionProblem,
    listAllLlmModels,
    checkIsProviderFault,
    checkIsStepsWithoutPage,
    checkIsDoneWithoutTool,
    pickCheckedAnswer,
    genCompletenessNudge,
    genDoToolNudge,
    checkIsReasoningOffRemembered,
    cutRunawayAnswer,
    dropModelTokens,
    findAnswerShapeNudge,
    findUnreadVerseNudge,
    findMisquoteNudge,
    findNotStatedNudge,
    checkReadsInRecordBible,
    withRecordTurn,
    RECORD_TURN_ACK,
    addQuoteSource,
    toQuoteKey,
    rememberReasoningOff,
    resetReasoningOffMemoryForTests,
    RUNAWAY_ANSWER_NUDGE,
    WORDLESS_ANSWER_NUDGE,
    getStandInLlmProvider,
    filterVerifiedAnswerShows,
    genOpenPageNudge,
    describeLlmError,
    getAvailableLlmProviders,
    getFirstImageCapableModel,
    getLlmModel,
    getLlmModelList,
    getLlmProviderKeyField,
    getRankedLlmModelList,
    getLlmProviderWarning,
    getLlmProviderWarningLinks,
    toCleanToolName,
    toUsableLlmModel,
    genGuideRescueQuestion,
    genGuideRescueSummary,
    genReplyLanguageLine,
    genToolWatch,
    toGuideRescueAnswer,
    checkIsToolLeftOut,
    filterLocalToolList,
    toGeneralQuestionAsk,
    toHistoryTurns,
    toWatchedManualId,
    genGeneralAskAction,
    GENERAL_ASK_TOOL_NAME,
    checkIsModelRemoval,
    MAX_MODEL_REMOVALS_PER_ASK,
} from './llmBotHelpers';

// What the window shows when a call fails. The person reading it is a
// volunteer minutes before a service, so every branch has to come back as one
// line they can act on -- never the raw JSON body both SDKs put in `message`.
describe('describeLlmError', () => {
    test('a refused key sends them to the panel that holds it', () => {
        expect(describeLlmError({ status: 401 })).toContain(
            'Settings → AI Providers',
        );
        expect(describeLlmError({ status: 403 })).toContain(
            'Settings → AI Providers',
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
        expect(describeLlmError(error)).toContain('Settings → AI Providers');
    });

    test('a rate limit is said in money terms, not in HTTP', () => {
        // A bare 429 could be either, and the line says so.
        expect(describeLlmError({ status: 429 })).toBe(
            'the AI account is out of credit or being rate-limited',
        );
        // One whose body says which is said as that one thing.
        expect(
            describeLlmError({
                status: 429,
                error: { code: 'insufficient_quota', message: 'No credits.' },
            }),
        ).toBe('the AI account is out of credit');
        expect(
            describeLlmError({
                status: 429,
                error: { code: 'rate_limit_exceeded', message: 'Slow down.' },
            }),
        ).toBe(
            'the AI account is being rate-limited (asked too often) — wait ' +
                'a minute and try again',
        );
        expect(describeLlmError({ status: 402 })).toBe(
            'the AI account is out of credit',
        );
    });

    test('a model this account cannot run names the fix, not the HTTP', () => {
        expect(describeLlmError({ status: 404 })).toBe(
            'this model is not available to the account — pick another one ' +
                'in the row above',
        );
        expect(describeLlmError({ status: 529 })).toBe(
            'the AI service is overloaded right now',
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
        // The provider's own sentence is lifted OUT of the body rather than
        // the whole thing being thrown away for a status number.
        expect(said).toBe('max_tokens: is too large');
    });

    test('a body with nothing readable in it falls back to the status', () => {
        const said = describeLlmError({
            status: 400,
            message: '400 {"type":"error","error":{"type":"x"}}',
        });

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
// A window of its own chosen in the window picker: the state read is of THAT
// window, never the Presenter, and says nothing of where the main window is.
describe('applyToolWatch with a window of its own chosen', () => {
    const NEEDS_PRESENTER = '{"mainWindow":{"needsPage":"presenter"}}';

    test('a state read of the chosen window does not offer the Presenter', () => {
        const watch = genToolWatch();
        watch.windowAim = {
            windowId: 'READER-2',
            focus: 'reader',
            isSeparateWindow: true,
        };
        applyToolWatch(watch, 'owa_app_state', {}, NEEDS_PRESENTER);
        expect(watch.needsPage).toBeNull();
        // What is on the projector is still the Presenter's to say.
        applyToolWatch(watch, 'owa_list_screens', {}, NEEDS_PRESENTER);
        expect(watch.needsPage).toBe('presenter');
    });

    test('with the main window, the same read still offers it', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_app_state', {}, NEEDS_PRESENTER);
        expect(watch.needsPage).toBe('presenter');
    });
});

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
        nearMisses: ['Bible Lookup', 'Clear Long Text'],
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
        expect(asked).toContain('Bible Lookup, Clear Long Text');
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

    // Khmer ends a sentence with ។ and needs no space after it; a line with
    // no space at all is cut where a letter ends, never inside a syllable.
    test('cuts a Khmer answer at its own full stop', () => {
        const sentence = 'ចុចពីរដងលើខគម្ពីរនៅក្នុងផ្ទាំងមើលជាមុន។';
        const cut = toGuideRescueAnswer(sentence.repeat(10));
        expect(cut.length).toBeLessThanOrEqual(240);
        expect(cut.endsWith('។')).toBe(true);
    });

    test('never cuts a Khmer word in the middle of a syllable', () => {
        const cut = toGuideRescueAnswer('ព្រះគម្ពីរ'.repeat(40));
        expect(cut.endsWith('…')).toBe(true);
        const kept = cut.slice(0, -1);
        expect(kept.endsWith('\u17D2')).toBe(false);
        expect('ព្រះគម្ពីរ'.repeat(40).slice(kept.length)).not.toMatch(
            /^\p{M}/u,
        );
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

    // Measured 2026-09-10: asked "Create a lyric file from <address>", the
    // model drafted the song and then created the file itself, and the
    // answer still offered Create "<title>" under "Done! The song has been
    // created" -- a second press is a second file.
    test('a file the model created itself is remembered by name and path', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_lyric_validate',
            { mode: 'draft' },
            genDraftResult(true),
        );
        applyToolWatch(
            watch,
            'owa_lyric_file',
            { action: 'create', name: 'Lantern On The Water' },
            JSON.stringify({
                created: 'Lantern On The Water',
                filePath: 'C:\\songs\\Lantern On The Water.owl',
            }),
        );
        expect(watch.createdLyric).toEqual({
            name: 'Lantern On The Water',
            filePath: 'C:\\songs\\Lantern On The Water.owl',
        });
        // The draft is still held: Copy song text is still honest.
        expect(watch.draftedLyric).toContain('Lantern On The Water');
    });

    test('a refused create, or any other file action, creates nothing', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_lyric_file',
            { action: 'create', name: 'Taken' },
            'A song called "Taken" already exists. Use "Taken (1)" instead.',
        );
        expect(watch.createdLyric).toBeNull();
        applyToolWatch(
            watch,
            'owa_lyric_file',
            { action: 'info', name: 'Taken' },
            JSON.stringify({ created: 'Taken', filePath: 'C:\\x.owl' }),
        );
        expect(watch.createdLyric).toBeNull();
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

    // A passage the tool already put on the screen needs no walkthrough of
    // the Bible Lookup under it: that card presses the lookup open and then
    // stops where a person types, with the verse nowhere in it (EC-131).
    test('a passage presented by the tool takes the walkthrough offer away', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_help_search', {}, genSearchResult('W-06'));
        applyToolWatch(
            watch,
            'owa_present_bible',
            { reference: 'John 3:16', action: 'check' },
            JSON.stringify({ isPresented: false, reference: 'John 3:16' }),
        );
        expect(toWatchedManualId(watch)).toBe('W-06');
        applyToolWatch(
            watch,
            'owa_present_bible',
            { reference: 'John 3:16' },
            JSON.stringify({ isPresented: true, reference: 'John 3:16' }),
        );
        expect(toWatchedManualId(watch)).toBeNull();
    });

    // The same for a countdown the tool already started: a W-09 walkthrough
    // under it would offer to do again what was just done. A check and a
    // refusal did nothing, and keep the offer.
    test('a foreground extra started or stopped by the tool takes the offer away', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_help_search', {}, genSearchResult('W-09'));
        applyToolWatch(
            watch,
            'owa_foreground',
            { action: 'check' },
            JSON.stringify({ did: 'checked', screens: [] }),
        );
        applyToolWatch(
            watch,
            'owa_foreground',
            { widget: 'countdown' },
            'Say how long the countdown is (minutes, e.g. 5).',
        );
        expect(toWatchedManualId(watch)).toBe('W-09');
        applyToolWatch(
            watch,
            'owa_foreground',
            { widget: 'countdown', minutes: 5 },
            JSON.stringify({ did: 'started', widget: 'countdown' }),
        );
        expect(toWatchedManualId(watch)).toBeNull();
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

describe('SHOWS controls are proved against the live window', () => {
    const controls = [
        { kind: 'control' as const, value: 'Font Size', name: 'Font Size' },
        {
            kind: 'control' as const,
            value: 'Bible Version buttons',
            name: 'Bible Version buttons',
        },
        {
            kind: 'file' as const,
            value: 'C:\\Pictures\\verse.png',
            name: 'verse.png',
        },
    ];

    test('keeps an exact owa_find_ui label and drops an invented category', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_find_ui',
            { text: 'Font Size' },
            JSON.stringify({
                shownCount: 1,
                matches: [{ label: 'Font Size', tier: 0 }],
            }),
        );
        expect(filterVerifiedAnswerShows(controls, watch)).toEqual([
            controls[0],
            controls[2],
        ]);
    });

    test('does not trust a loose near match, refusal, or model placeholder', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_find_ui',
            { text: 'Bible Version buttons' },
            JSON.stringify({
                shownCount: 1,
                matches: [{ label: 'Add Extra Bible', tier: 3 }],
            }),
        );
        applyToolWatch(watch, 'owa_find_ui', { text: 'none' }, 'not found');
        expect(filterVerifiedAnswerShows(controls, watch)).toEqual([
            controls[2],
        ]);
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

    // 2026-10-17: a Resources PDF the model reads comes back as pictures of
    // its pages, and they are put in front of it after the tool results.
    test('a Resources read puts its pages after the tool results', async () => {
        const sent: any[] = [];
        let round = 0;
        fake.toolList = [
            { name: 'owa_resource_file' },
            { name: 'owa_help_search' },
        ];
        fake.toolPicturesMap = {
            owa_resource_file: [{ mediaType: 'image/png', data: 'UEFHRQ==' }],
        };
        useFakeAnthropic(async (request: any) => {
            sent.push(structuredClone(request));
            round += 1;
            return round === 1
                ? {
                      content: [
                          {
                              type: 'tool_use',
                              id: 'tool-r',
                              name: 'owa_resource_file',
                              input: { action: 'read', file: 'pdf/LUK.7.pdf' },
                          },
                      ],
                  }
                : answerRound;
        });
        try {
            await askLlmBot(
                'and chapter 7?',
                'reader',
                'anthropic',
                'm',
                [],
                null,
                { resources: { canSeePictures: true } },
            );
            // The Resources tool and nothing of the app's own, under a
            // prompt of its own.
            expect(
                sent[0].tools.map((tool: any) => {
                    return tool.name;
                }),
            ).toEqual(['owa_resource_file']);
            expect(JSON.stringify(sent[0].system)).toContain('Resources');
            const last = sent[1].messages[sent[1].messages.length - 1];
            expect(
                last.content.map((block: any) => {
                    return block.type;
                }),
            ).toEqual(['tool_result', 'image']);
            expect(last.content[1].source).toMatchObject({
                media_type: 'image/png',
                data: 'UEFHRQ==',
            });
        } finally {
            fake.toolPicturesMap = null;
            fake.toolList = [];
        }
    });

    // 2026-10-17, the user: _let user to interact with other chapter file_.
    test('a Resources answer offers to ask about another file it read', async () => {
        const askChapterSeven = async (openFiles: string[]) => {
            let round = 0;
            useFakeAnthropic(async () => {
                round += 1;
                return round === 1
                    ? {
                          content: [
                              {
                                  type: 'tool_use',
                                  id: 'tool-r',
                                  name: 'owa_resource_file',
                                  input: {
                                      action: 'read',
                                      file: 'pdf/LUK.7.pdf',
                                  },
                              },
                          ],
                      }
                    : answerRound;
            });
            return await askLlmBot(
                'and chapter 7?',
                'reader',
                'anthropic',
                'm',
                [],
                null,
                { resources: { canSeePictures: true, openFiles } },
            );
        };
        fake.toolList = [{ name: 'owa_resource_file' }];
        fake.toolResultMap = {
            owa_resource_file: '{"file":"pdf/LUK.7.pdf","kind":"pdf"}',
        };
        try {
            expect((await askChapterSeven(['pdf/LUK.6.pdf'])).actions).toEqual([
                {
                    label: 'Ask about LUK.7.pdf',
                    toolName: 'resource-ask',
                    args: { file: 'pdf/LUK.7.pdf' },
                },
            ]);
            // The file the tab already asks about gets no button of its own.
            expect(
                (await askChapterSeven(['pdf/LUK.7.pdf'])).actions ?? [],
            ).toEqual([]);
        } finally {
            fake.toolResultMap = null;
            fake.toolList = [];
        }
    });

    test('a model that cannot see is told the pages were left out', async () => {
        const sent: any[] = [];
        let round = 0;
        fake.toolList = [{ name: 'owa_resource_file' }];
        fake.toolResultMap = { owa_resource_file: '{"kind":"pdf"}' };
        fake.toolPicturesMap = {
            owa_resource_file: [{ mediaType: 'image/png', data: 'UEFHRQ==' }],
        };
        useFakeAnthropic(async (request: any) => {
            sent.push(structuredClone(request));
            round += 1;
            return round === 1
                ? {
                      content: [
                          {
                              type: 'tool_use',
                              id: 'tool-r',
                              name: 'owa_resource_file',
                              input: { action: 'read', file: 'pdf/LUK.7.pdf' },
                          },
                      ],
                  }
                : answerRound;
        });
        try {
            await askLlmBot(
                'and chapter 7?',
                'reader',
                'anthropic',
                'm',
                [],
                null,
                { resources: { canSeePictures: false } },
            );
            const last = sent[1].messages[sent[1].messages.length - 1];
            expect(
                last.content.map((block: any) => {
                    return block.type;
                }),
            ).toEqual(['tool_result']);
            expect(last.content[0].content).toContain('pictures were left out');
        } finally {
            fake.toolPicturesMap = null;
            fake.toolResultMap = null;
            fake.toolList = [];
        }
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

// Which box the help window sends the user to when a provider it lists has no
// key yet, or its key was refused.
describe('getLlmProviderKeyField', () => {
    test('names the box each paid provider takes its key in', () => {
        expect(getLlmProviderKeyField('anthropic')).toBe('anthropicAPIKey');
        expect(getLlmProviderKeyField('openai')).toBe('openAIAPIKey');
        expect(getLlmProviderKeyField('kimi')).toBe('kimiAPIKey');
        expect(getLlmProviderKeyField('bedrock')).toBe('bedrockAPIKey');
    });

    test('is null for the keyless one and for what is not a provider', () => {
        // Asked of whatever a button carries, a hand-edited session included.
        expect(getLlmProviderKeyField('free')).toBeNull();
        expect(getLlmProviderKeyField('toString')).toBeNull();
        expect(getLlmProviderKeyField(undefined)).toBeNull();
        expect(getLlmProviderKeyField(42)).toBeNull();
    });
});

// What a thumb down may call "the next model up" (`answerRatingHelpers`):
// only a list written best first, or the button names a model that is not
// the smarter one.
describe('getRankedLlmModelList', () => {
    test('is the whole list for the three families written best first', () => {
        for (const provider of ['anthropic', 'openai', 'kimi'] as const) {
            expect(getRankedLlmModelList(provider), provider).toEqual(
                getLlmModelList(provider),
            );
            expect(getRankedLlmModelList(provider).length).toBeGreaterThan(1);
        }
    });

    test('is nothing for a list in another order, a server of the user’s own, or no assistant', () => {
        // Bedrock is in the order a volunteer should reach for them, and
        // the keyless three are three different makers' models.
        expect(getRankedLlmModelList('bedrock')).toEqual([]);
        expect(getRankedLlmModelList('free')).toEqual([]);
        expect(getRankedLlmModelList('custom')).toEqual([]);
        expect(getRankedLlmModelList(null)).toEqual([]);
    });
});

// THE KEYLESS PROVIDER. It is what a volunteer gets before anybody has typed an
// API key, so every one of these is about the state the app ships in, not an
// edge case. The mocked `getAISetting` above returns three empty keys, which is
// exactly that state.
describe('what Auto may ask', () => {
    test('a server on this computer or the church network costs nothing', () => {
        expect(
            checkIsNoCostCustomServer({ baseUrl: 'http://localhost:1234/v1' }),
        ).toBe(true);
        expect(
            checkIsNoCostCustomServer({
                baseUrl: 'http://super-computer:1237/v1',
            }),
        ).toBe(true);
    });

    test('a server on the internet costs nothing only when it says so', () => {
        const baseUrl = 'https://abc.trycloudflare.com/v1';
        expect(checkIsNoCostCustomServer({ baseUrl })).toBe(false);
        expect(checkIsNoCostCustomServer({ baseUrl, isFree: false })).toBe(
            false,
        );
        expect(checkIsNoCostCustomServer({ baseUrl, isFree: true })).toBe(true);
    });

    test('a new tab is on Auto until an assistant is picked by name', () => {
        // Nothing stored at all -- a first run: Auto (the mocked settings
        // hold nothing).
        expect(getIsLlmAuto()).toBe(true);
        expect(toIsLlmAuto(null, null)).toBe(true);
        expect(toIsLlmAuto('', '')).toBe(true);
        // A pick is a pick, either way, whatever the other setting holds.
        expect(toIsLlmAuto('false', null)).toBe(false);
        expect(toIsLlmAuto('false', 'openai')).toBe(false);
        expect(toIsLlmAuto('true', 'openai')).toBe(true);
        // An assistant picked by name before Auto existed wrote the
        // provider and nothing else: an update leaves that tab's owner on it.
        expect(toIsLlmAuto(null, 'anthropic')).toBe(false);
    });

    test('the Auto notice names the public service in its FIRST sentence', () => {
        // The first sentence is all a folded notice shows, and it is the
        // one thing that must still be on screen at question ten.
        expect(AUTO_ASSISTANT_WARNING.split('. ')[0]).toContain('Kilo');
        expect(AUTO_ASSISTANT_WARNING).toMatch(/leave this computer/);
    });
});

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
        expect(getLlmProviderWarning('bedrock')).toBeNull();
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
        expect(links.map((one) => one.label)).toEqual(['Kilo']);
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

    test('offers only free models, first choice first', () => {
        // An unsuffixed Kilo id is a PAID model, which refuses an anonymous
        // request -- a name like that in this list is an assistant that
        // answers nobody.
        const modelList = getLlmModelList('free');
        expect(modelList.length).toBeGreaterThan(0);
        for (const one of modelList) {
            expect(one.id.endsWith(':free')).toBe(true);
        }
        // No setting saved (the mock answers null), so the first one asks.
        expect(getLlmModel('free')).toBe(modelList[0].id);
    });

    test('a model a later build dropped is asked as the first choice', () => {
        // Measured 2026-09-12: LLM7 withdrew `gpt-oss`, and every tab saved on
        // it went on posting the name and getting `model_unavailable` back.
        const modelList = getLlmModelList('free');
        const firstModel = modelList[0].id;
        expect(toUsableLlmModel('free', 'gpt-oss')).toBe(firstModel);
        expect(toUsableLlmModel('free', 'minimax-m2.7')).toBe(firstModel);
        expect(toUsableLlmModel('free', '')).toBe(firstModel);
        expect(toUsableLlmModel('free', null)).toBe(firstModel);
        const lastModel = modelList[modelList.length - 1].id;
        expect(toUsableLlmModel('free', lastModel)).toBe(lastModel);
    });

    test('a keyed provider keeps a model off the built-in list', () => {
        // Picked from the key's own live catalogue under More models... -- not
        // in this build's list, and still the user's choice.
        expect(toUsableLlmModel('openai', 'gpt-4.1-mini-2099')).toBe(
            'gpt-4.1-mini-2099',
        );
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

// The request is shaped for the provider's prefix cache: tools and system are
// byte-identical across every round of every question about one window, and
// they are ~15 900 of the ~16 000 tokens a round costs (measured 2026-09-08,
// 44 rounds, all billed at full price). These pin the shape, not the saving --
// the saving is only ever proven by `usage.cache_read_input_tokens` on a live
// call, and a later edit that puts a date or the screen state into the system
// prompt would pass every test here and still lose it.
describe('the request is cache-shaped', () => {
    function useFakeAnthropic(create: (...args: any[]) => any) {
        fake.toolCallList = [];
        fake.anthropic = { messages: { create } };
    }

    test('the system prompt is one marked block and the request carries the moving marker', async () => {
        const createMock = vi.fn(async (_body: any) => {
            return { content: [{ type: 'text', text: 'press F5' }] };
        });
        useFakeAnthropic(createMock);

        await askLlmBot('how do I show a screen?', 'presenter', 'anthropic');

        const body = createMock.mock.calls[0][0];
        expect(body.cache_control).toEqual({ type: 'ephemeral' });
        expect(Array.isArray(body.system)).toBe(true);
        expect(body.system).toHaveLength(1);
        expect(body.system[0].type).toBe('text');
        expect(body.system[0].text).toContain('Open Worship App');
        expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
        expect(body.tool_choice).toBeUndefined();
    });

    // Reported with two pictures: asked to change the Bible text colour the
    // assistant named a card that is not there, and told so it named it again
    // and ringed a button shut behind a panel's three dots.
    test('told an answer was wrong, it looks before it says it again', async () => {
        const createMock = vi.fn(async (_body: any) => {
            return { content: [{ type: 'text', text: 'ok' }] };
        });
        useFakeAnthropic(createMock);

        await askLlmBot('I do not see Appearance', 'presenter', 'anthropic');

        const prompt = createMock.mock.calls[0][0].system[0].text;
        expect(prompt).toContain('never\n  say it again');
        // What is shut behind another control is opened by pressing that one.
        expect(prompt).toContain('`revealBy`');
        expect(prompt).toContain('say to press THAT first');
        // Then a picture of the window, which is the person's to send...
        expect(prompt).toContain('Ask for a picture of their window');
        // ...and the page's newest copy, the one web read about this app.
        expect(prompt).toContain('read the copy at the address');
        // ...which is the newer one only when its day is later.
        expect(prompt).toContain('when its day is later');
        expect(prompt).toContain('The one exception is the');
    });

    test('gives Reader users short, mouse-first help without talking down to them', async () => {
        const createMock = vi.fn(async (_body: any) => {
            return {
                content: [{ type: 'text', text: 'Use the box at the top.' }],
            };
        });
        useFakeAnthropic(createMock);

        await askLlmBot(
            'The words are too small. Help me.',
            'reader',
            'anthropic',
        );

        const prompt = createMock.mock.calls[0][0].system[0].text;
        expect(prompt).toContain('AN OLDER PERSON WHO IS NEW TO COMPUTERS');
        expect(prompt).toContain('Be respectful, never childish');
        expect(prompt).toContain('easiest mouse or touch route');
        expect(prompt).toContain('no more than THREE numbered steps');
        expect(prompt).toContain('at the bottom left');
        expect(prompt).toContain('press and hold, move, then let go');
        expect(prompt).toContain('history or recovery route');
        expect(prompt).toContain('Do not repeat a step that failed');
        expect(prompt).toContain('safest workable alternative');
        expect(prompt).toContain('relevant recovery choice');
        expect(prompt).toContain('Never offer generic "No thanks"');
        expect(prompt).toContain('Renumber the steps you actually give from 1');
    });

    // A supported question goes out with its guide page under it, and the
    // Reader's pages say "non-English" beside a reference of their own. The
    // book-button answer read the whole ask: seventeen of the Reader's
    // supported questions were answered with how to open John 3:16, by no
    // model, whichever assistant the tab was on (2026-10-12).
    test('the book-button answer is read off what was typed, not the page under it', async () => {
        const createMock = vi.fn(async (_body: any) => {
            return {
                content: [{ type: 'text', text: 'Use the A+ button.' }],
            };
        });
        useFakeAnthropic(createMock);
        const typed = 'The words are too small. Can you help me?';
        const asked =
            `${typed}\n\n(This is one of the app's supported questions.)\n` +
            'A non-English Bible lists its books under their own names: ' +
            'type John 3:16 or press the book buttons.';

        const answer = await askLlmBot(
            asked,
            'reader',
            'anthropic',
            null,
            [],
            null,
            { askedText: typed },
        );

        expect(createMock).toHaveBeenCalledTimes(1);
        expect(answer.text).toBe('Use the A+ button.');
    });

    test('the book-button answer still takes a question that asks for it', async () => {
        const createMock = vi.fn(async (_body: any) => {
            return { content: [{ type: 'text', text: 'Type it.' }] };
        });
        useFakeAnthropic(createMock);
        const typed =
            'My Khmer Bible will not take John 3:16. Use the book buttons.';

        const answer = await askLlmBot(
            `${typed}\n\n(This is one of the app's supported questions.)`,
            'reader',
            'anthropic',
            null,
            [],
            null,
            { askedText: typed },
        );

        expect(createMock).not.toHaveBeenCalled();
        expect(answer.text).toContain('do not need to type');
    });

    test('does not impose the Reader-specific answer shape on the Presenter', async () => {
        const createMock = vi.fn(async (_body: any) => {
            return { content: [{ type: 'text', text: 'Press F5.' }] };
        });
        useFakeAnthropic(createMock);

        await askLlmBot('how do I show a screen?', 'presenter', 'anthropic');

        const prompt = createMock.mock.calls[0][0].system[0].text;
        expect(prompt).not.toContain('AN OLDER PERSON WHO IS NEW TO COMPUTERS');
    });

    // The last round used to drop the tool list to stop the model calling
    // one more -- which changed the prefix at byte zero and forfeited the
    // cache on the round that already carries the most context. The tools
    // stay; `tool_choice: none` is what forbids the call.
    test('the last round keeps the tools and forbids the call instead', async () => {
        let calls = 0;
        const createMock = vi.fn(async (body: any) => {
            calls += 1;
            if (body.tool_choice?.type === 'none') {
                return { content: [{ type: 'text', text: 'that is it' }] };
            }
            return {
                content: [
                    {
                        type: 'tool_use',
                        id: `tool-${calls}`,
                        name: 'owa_app_state',
                        input: {},
                    },
                ],
            };
        });
        useFakeAnthropic(createMock);

        const answer = await askLlmBot('what is on?', 'presenter', 'anthropic');

        expect(answer.text).toBe('that is it');
        expect(calls).toBe(10);
        for (const [body] of createMock.mock.calls.slice(0, 9)) {
            expect(body.tool_choice).toBeUndefined();
            expect(Array.isArray(body.tools)).toBe(true);
        }
        const last = createMock.mock.calls[9][0];
        expect(last.tool_choice).toEqual({ type: 'none' });
        expect(Array.isArray(last.tools)).toBe(true);
        expect(last.system).toEqual(createMock.mock.calls[0][0].system);
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

// Steps written off a search excerpt go back to the model ONCE. The rule was
// in the prompt and on the top hit, and "How do I edit a slide?" asked from
// the Bible Reader was still answered from the excerpt three runs out of four
// -- each time starting "in the Documents list", which the Reader has not got.
describe('steps written without opening the page', () => {
    const SEARCH_HITS = JSON.stringify([
        {
            id: 'W-15',
            title: 'Create and edit slides',
            kind: 'manual',
            score: 102,
        },
    ]);
    const STEPS =
        'Not from here.\n\n1. In the **Documents** list, pick it.\n2. Click **Slide Editor**.';

    // The whole list asked in Khmer (EC-325): told to call owa_foreground
    // for "Can you start a 5 minute countdown?", gemma4:cloud wrote that it
    // had started one having called nothing.
    test('an ask to do something that ends without its tool goes back once', () => {
        const watch = genToolWatch();
        expect(checkIsDoneWithoutTool(watch)).toBe(false);
        watch.doTool = 'owa_foreground';
        applyToolWatch(watch, 'owa_help_page', { id: 'W-09' }, '# page');
        expect(checkIsDoneWithoutTool(watch)).toBe(true);
        expect(genDoToolNudge(watch)).toContain(
            'you have not called owa_foreground',
        );
        watch.isDoNudged = true;
        expect(checkIsDoneWithoutTool(watch)).toBe(false);
        // Called -- refused or not -- it is not handed back.
        const called = genToolWatch();
        called.doTool = 'owa_foreground';
        applyToolWatch(
            called,
            'owa_foreground',
            { widget: 'countdown', minutes: 5 },
            '{"did":"refused"}',
        );
        expect(checkIsDoneWithoutTool(called)).toBe(false);
    });

    test('a numbered list after a search with no page opened is caught', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_help_search',
            { query: 'edit' },
            SEARCH_HITS,
        );
        expect(checkIsStepsWithoutPage(STEPS, watch)).toBe(true);
        expect(genOpenPageNudge(watch)).toContain('W-15');
    });

    test('an answer that opened the page, a one-line answer, or a "cannot do that" is not', () => {
        const opened = genToolWatch();
        applyToolWatch(opened, 'owa_help_search', {}, SEARCH_HITS);
        applyToolWatch(opened, 'owa_help_page', { id: 'W-15' }, '# page');
        expect(checkIsStepsWithoutPage(STEPS, opened)).toBe(false);

        const searched = genToolWatch();
        applyToolWatch(searched, 'owa_help_search', {}, SEARCH_HITS);
        expect(
            checkIsStepsWithoutPage('No, it cannot stream anywhere.', searched),
        ).toBe(false);
        expect(checkIsStepsWithoutPage('1. Press **F5**.', searched)).toBe(
            false,
        );

        // A state answer never searched: nothing to open.
        expect(checkIsStepsWithoutPage(STEPS, genToolWatch())).toBe(false);
        // A hit under the floor is not a recipe to open.
        const weak = genToolWatch();
        applyToolWatch(
            weak,
            'owa_help_search',
            {},
            JSON.stringify([{ id: 'W-01', kind: 'manual', score: 2 }]),
        );
        expect(checkIsStepsWithoutPage(STEPS, weak)).toBe(false);
    });

    test('once nudged, the same shape is let through', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_help_search', {}, SEARCH_HITS);
        watch.isPageNudged = true;
        expect(checkIsStepsWithoutPage(STEPS, watch)).toBe(false);
    });

    // The Khmer stress run on gemma4:cloud (2026-10-17): under a pasted
    // story and down a ten-turn chat it wrote every list with no tool called.
    test('steps written with nothing looked up at all are caught too', () => {
        const memory = genToolWatch();
        memory.canSearchGuide = true;
        expect(checkIsStepsWithoutPage(STEPS, memory)).toBe(true);
        expect(genOpenPageNudge(memory)).toContain('written from memory');
        expect(genOpenPageNudge(memory)).toContain('owa_help_search');
        // A state answer read the app first, and keeps its steps.
        const state = genToolWatch();
        state.canSearchGuide = true;
        applyToolWatch(state, 'owa_list_screens', {}, '{"screens":[]}');
        expect(state.toolCallCount).toBe(1);
        expect(checkIsStepsWithoutPage(STEPS, state)).toBe(false);
        // An ask that cannot search the guide -- a verse search, a general
        // question, a translation -- is never told to.
        expect(checkIsStepsWithoutPage(STEPS, genToolWatch())).toBe(false);
    });

    test('the Anthropic loop hands the steps back once and returns the rewrite', async () => {
        fake.toolCallList = [];
        fake.toolList = [
            { name: 'owa_help_search' },
            { name: 'owa_help_page' },
        ];
        fake.toolResultMap = {
            owa_help_search: SEARCH_HITS,
            owa_help_page:
                '# W-15\n1. Select a slide document, then click the **Slide Editor** tab.',
        };
        let calls = 0;
        const createMock = vi.fn(async (body: any) => {
            calls += 1;
            if (calls === 1) {
                return {
                    content: [
                        {
                            type: 'tool_use',
                            id: 't1',
                            name: 'owa_help_search',
                            input: { query: 'edit' },
                        },
                    ],
                };
            }
            if (calls === 2) {
                return { content: [{ type: 'text', text: STEPS }] };
            }
            if (calls === 3) {
                // The nudge arrived as the last user turn.
                const last = body.messages[body.messages.length - 1];
                expect(last.role).toBe('user');
                expect(String(last.content)).toContain('owa_help_page');
                return {
                    content: [
                        {
                            type: 'tool_use',
                            id: 't2',
                            name: 'owa_help_page',
                            input: { id: 'W-15' },
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: '1. Click the **Presenter** tab.\n2. Select the document, then click **Slide Editor**.',
                    },
                ],
            };
        });
        fake.anthropic = { messages: { create: createMock } };
        try {
            const answer = await askLlmBot(
                'How do I edit a slide?',
                'reader',
                'anthropic',
            );
            expect(answer.text).toContain('Presenter');
            expect(calls).toBe(4);
            expect(fake.toolCallList).toEqual([
                'owa_help_search',
                'owa_help_page',
            ]);
        } finally {
            fake.toolResultMap = null;
        }
    });

    test('a model that ignores the nudge is not asked twice', async () => {
        fake.toolCallList = [];
        fake.toolList = [{ name: 'owa_help_search' }];
        fake.toolResultMap = { owa_help_search: SEARCH_HITS };
        let calls = 0;
        const createMock = vi.fn(async () => {
            calls += 1;
            if (calls === 1) {
                return {
                    content: [
                        {
                            type: 'tool_use',
                            id: 't1',
                            name: 'owa_help_search',
                            input: {},
                        },
                    ],
                };
            }
            return { content: [{ type: 'text', text: STEPS }] };
        });
        fake.anthropic = { messages: { create: createMock } };
        try {
            const answer = await askLlmBot(
                'How do I edit a slide?',
                'reader',
                'anthropic',
            );
            expect(answer.text).toBe(STEPS);
            expect(calls).toBe(3);
        } finally {
            fake.toolResultMap = null;
        }
    });
});

// THE STAND-IN KEY. Measured 2026-09-09 through the real window: the tab's
// default provider was a ChatGPT key a week out of credit, and every one of
// the twelve corpus questions posted the same 41 KB request three times,
// waited 3-5 s on `insufficient_quota`, and landed on the offline bot -- with a
// live Claude key one option along in the head row. These hold the rule that
// another key of the user's own answers first, and the two lines it must not
// cross.
describe('checkIsProviderFault', () => {
    test("a refused key, an empty account and a dead service are the provider's", () => {
        expect(checkIsProviderFault({ status: 401 })).toBe(true);
        expect(checkIsProviderFault({ status: 403 })).toBe(true);
        expect(checkIsProviderFault({ status: 429 })).toBe(true);
        expect(checkIsProviderFault({ status: 500 })).toBe(true);
        expect(checkIsProviderFault({ response: { status: 503 } })).toBe(true);
    });

    test('a bad request and no network at all are not', () => {
        // Another key would fail the same way, and the wait would be paid
        // twice for nothing.
        expect(checkIsProviderFault({ status: 400 })).toBe(false);
        expect(checkIsProviderFault({ status: 404 })).toBe(false);
        expect(checkIsProviderFault(new TypeError('fetch failed'))).toBe(false);
        expect(checkIsProviderFault(null)).toBe(false);
    });

    test("an empty account is the provider's whatever status it wears", () => {
        // Anthropic: a 402 now, and a plain 400 saying "credit balance"
        // for as long as anyone has seen it.
        expect(checkIsProviderFault({ status: 402 })).toBe(true);
        expect(
            checkIsProviderFault({
                status: 400,
                error: {
                    type: 'error',
                    error: {
                        type: 'invalid_request_error',
                        message:
                            'Your credit balance is too low to access the ' +
                            'Anthropic API.',
                    },
                },
            }),
        ).toBe(true);
        // The same 400 about anything else is still the request's.
        expect(
            checkIsProviderFault({
                status: 400,
                error: {
                    type: 'error',
                    error: {
                        type: 'invalid_request_error',
                        message: 'max_tokens: is too large',
                    },
                },
            }),
        ).toBe(false);
    });
});

describe('getStandInLlmProvider', () => {
    afterEach(() => {
        fake.aiSetting = null;
    });

    test('is the best OTHER key the user has typed in', () => {
        fake.aiSetting = {
            openAIAPIKey: 'sk-dead',
            anthropicAPIKey: 'sk-live',
            kimiAPIKey: '',
        };
        expect(getStandInLlmProvider('openai')).toBe('anthropic');
        expect(getStandInLlmProvider('anthropic')).toBe('openai');
    });

    test("is never the keyless service on a paid key's behalf", () => {
        // The free tier is a trade the user makes by picking it. A dead
        // paid key must land on the manual, not on a public service.
        fake.aiSetting = {
            openAIAPIKey: 'sk-dead',
            anthropicAPIKey: '',
            kimiAPIKey: '',
        };
        expect(getAvailableLlmProviders()).toEqual(['openai', 'free']);
        expect(getStandInLlmProvider('openai')).toBeNull();
    });

    test("never spends a paid key on the free tier's behalf", () => {
        fake.aiSetting = {
            openAIAPIKey: '',
            anthropicAPIKey: 'sk-live',
            kimiAPIKey: '',
        };
        expect(getStandInLlmProvider('free')).toBeNull();
    });
});

// Amazon Bedrock. Each model's AWS card is the spec these hold the loop to:
// three vendors behind one OpenAI-shaped route, each with its own rules, and
// each served in its own regions.
describe('the Bedrock provider', () => {
    function genToolCallResponse() {
        return {
            choices: [
                {
                    message: {
                        role: 'assistant',
                        content: null,
                        tool_calls: [
                            {
                                id: 'call-1',
                                type: 'function',
                                function: {
                                    name: 'owa_help_search',
                                    arguments: '{"query":"screen"}',
                                },
                            },
                        ],
                    },
                },
            ],
        };
    }
    function genTextResponse() {
        return {
            choices: [{ message: { role: 'assistant', content: 'Press F5.' } }],
        };
    }

    beforeEach(() => {
        fake.toolCallList = [];
        fake.toolList = [{ name: 'owa_help_search' }];
        fake.aiSetting = {
            openAIAPIKey: '',
            anthropicAPIKey: '',
            kimiAPIKey: '',
            bedrockAPIKey: 'ABSKlive',
        };
        resetSpendGuardForTests();
    });
    afterEach(() => {
        fake.aiSetting = null;
        fake.bedrock = null;
        fake.bedrockClaude = null;
        fake.bedrockRegion = 'us-west-2';
    });

    // A tool's pictures cannot ride a `tool` message in this protocol: they
    // come in a user turn of their own, after the tool legs.
    test('a Resources read puts its pages in a user turn after the tool legs', async () => {
        fake.toolList = [{ name: 'owa_resource_file' }];
        fake.toolPicturesMap = {
            owa_resource_file: [{ mediaType: 'image/jpeg', data: 'UEFHRQ==' }],
        };
        const sent: any[] = [];
        let round = 0;
        const create = vi.fn(async (request: any) => {
            sent.push(structuredClone(request));
            round += 1;
            return round === 1
                ? {
                      choices: [
                          {
                              message: {
                                  role: 'assistant',
                                  content: null,
                                  tool_calls: [
                                      {
                                          id: 'call-r',
                                          type: 'function',
                                          function: {
                                              name: 'owa_resource_file',
                                              arguments:
                                                  '{"action":"read","file":"pdf/LUK.7.pdf"}',
                                          },
                                      },
                                  ],
                              },
                          },
                      ],
                  }
                : genTextResponse();
        });
        fake.bedrock = { chat: { completions: { create } } };
        try {
            await askLlmBot(
                'and chapter 7?',
                'reader',
                'bedrock',
                'google.gemma-4-31b',
                [],
                null,
                { resources: { canSeePictures: true } },
            );
            const messages = sent[1].messages;
            const last = messages[messages.length - 1];
            expect(messages[messages.length - 2].role).toBe('tool');
            expect(last.role).toBe('user');
            expect(last.content[0]).toEqual({
                type: 'text',
                text: 'The pictures the tool just returned, in order.',
            });
            expect(last.content[1].image_url.url).toBe(
                'data:image/jpeg;base64,UEFHRQ==',
            );
        } finally {
            fake.toolPicturesMap = null;
        }
    });

    // Asks once and hands back the first request the model was sent.
    async function askFirstRequest(model: string) {
        const create = vi.fn(async () => {
            return genTextResponse();
        });
        fake.bedrock = { chat: { completions: { create } } };
        await askLlmBot(
            'How do I show the screen?',
            'presenter',
            'bedrock',
            model,
        );
        return (create.mock.calls[0] as any[])[0];
    }

    test('is offered once its key is set, ahead of the keyless one', () => {
        expect(getAvailableLlmProviders()).toEqual(['bedrock', 'free']);
    });

    // Its route has no catalogue (`/openai/v1/models` answers 404), so the
    // row would only ever say the listing failed.
    test('offers no More models, like the keyless one', async () => {
        expect(checkHasMoreModels('bedrock')).toBe(false);
        expect(checkHasMoreModels('free')).toBe(false);
        expect(checkHasMoreModels('openai')).toBe(true);
        expect(checkHasMoreModels(null)).toBe(false);
        const listed = await listAllLlmModels('bedrock');
        expect(listed).toEqual(getLlmModelList('bedrock'));
    });

    test('offers every usable model of the catalogue, recommended first', () => {
        const modelList = getLlmModelList('bedrock');
        expect(
            modelList.map((model) => {
                return model.id;
            }),
        ).toEqual([
            'global.anthropic.claude-haiku-5-5',
            'openai.gpt-5.6-terra',
            'openai.gpt-5.6-luna',
            'xai.grok-4.3',
            'xai.grok-4.6',
            'google.gemma-4-31b',
            'openai.gpt-6-astra',
            'openai.gpt-5.4',
            'google.gemma-4-26b-a4b',
            'google.gemma-4-e2b',
        ]);
        // The first is what a fresh install asks with, so it is the pick --
        // Claude Haiku 5.5, the best fit at the lowest cost (2026-10-11,
        // `extra-work/local-llm/aws-bedrock-info.md`), and its label says so
        // because the picker shows the label and nothing else.
        expect(getLlmModel('bedrock')).toBe(
            'global.anthropic.claude-haiku-5-5',
        );
        expect(modelList[0].label).toBe('Claude Haiku 5.5 (best recommended)');
        for (const model of modelList) {
            // A list price on every one, so the cost line never goes quiet,
            // and the regions it is served in, so a wrong one is caught.
            expect(model.price).not.toBe('');
            expect(model.regions?.length).toBeGreaterThan(0);
            // Each card says it takes a picture.
            expect(checkCanSeeImages('bedrock', model.id)).toBe(true);
        }
        // A name off the account's own list is blind until known otherwise.
        expect(checkCanSeeImages('bedrock', 'openai.gpt-oss-120b')).toBe(false);
    });

    // Claude on Bedrock is served on the Anthropic Messages API and never on
    // the OpenAI-shaped route (AWS's Haiku 5.5 card, 2026-10-11), so its row
    // rides the Anthropic loop -- the runtime host's client, the same key,
    // the prompt cached -- while the rest of the list is untouched.
    test('a Claude row rides the Anthropic loop, prompt cached, never the OpenAI one', async () => {
        const openAiCreate = vi.fn(async () => {
            return genTextResponse();
        });
        fake.bedrock = { chat: { completions: { create: openAiCreate } } };
        const create = vi.fn(async () => {
            return {
                content: [{ type: 'text', text: 'Press F5.' }],
                stop_reason: 'end_turn',
                usage: {
                    input_tokens: 10,
                    output_tokens: 5,
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0,
                },
            };
        });
        fake.bedrockClaude = { messages: { create } };

        const answer = await askLlmBot(
            'How do I show the screen?',
            'presenter',
            'bedrock',
            'global.anthropic.claude-haiku-5-5',
        );

        expect(answer.text).toBe('Press F5.');
        expect(openAiCreate).not.toHaveBeenCalled();
        const request: any = (create.mock.calls[0] as any[])[0];
        expect(request.model).toBe('global.anthropic.claude-haiku-5-5');
        // The Anthropic loop's two cache markers and its own tool shape.
        expect(request.cache_control).toEqual({ type: 'ephemeral' });
        expect(request.system[0].cache_control).toEqual({ type: 'ephemeral' });
        expect(request.max_tokens).toBe(6000);
        expect(request.tools[0]).toMatchObject({ name: 'owa_help_search' });
        expect(request.tools[0].input_schema).toBeDefined();
        // Not OpenAI's shape.
        expect(request).not.toHaveProperty('max_completion_tokens');
        expect(request.tools[0]).not.toHaveProperty('function');
    });

    // No Claude client is an error with no status, which `askLlmBot` words
    // as the service being out of reach (memory `bedrock-llm-provider`); what
    // matters here is that the OpenAI-shaped client was never tried for it.
    test('a Claude row with no client fails without touching the OpenAI route', async () => {
        const openAiCreate = vi.fn();
        fake.bedrock = { chat: { completions: { create: openAiCreate } } };
        fake.bedrockClaude = null;
        await expect(
            askLlmBot(
                'Hello?',
                'presenter',
                'bedrock',
                'global.anthropic.claude-haiku-5-5',
            ),
        ).rejects.toThrow();
        expect(openAiCreate).not.toHaveBeenCalled();
    });

    // The Global cross-region id is served from every region the picker
    // offers, so no region refuses it before the round -- Frankfurt included.
    test('the Claude row is asked from any region in the list', () => {
        for (const region of [
            'us-west-2',
            'us-east-1',
            'us-east-2',
            'eu-central-1',
        ]) {
            expect(
                findBedrockRegionProblem(
                    'global.anthropic.claude-haiku-5-5',
                    region,
                ),
            ).toBeNull();
        }
    });

    test('a GPT gets OpenAI budget and a little thinking, and may call several tools', async () => {
        const request = await askFirstRequest('openai.gpt-5.6-terra');
        expect(request).toMatchObject({
            model: 'openai.gpt-5.6-terra',
            max_completion_tokens: 6000,
            reasoning_effort: 'low',
        });
        // OpenAI's reasoning models refuse `max_tokens`.
        expect(request).not.toHaveProperty('max_tokens');
        expect(request).not.toHaveProperty('parallel_tool_calls');
    });

    test("a Grok gets its card's budget name and its own default thinking", async () => {
        const request = await askFirstRequest('xai.grok-4.3');
        expect(request).toMatchObject({ max_completion_tokens: 6000 });
        expect(request).not.toHaveProperty('max_tokens');
        expect(request).not.toHaveProperty('reasoning_effort');
        expect(request).not.toHaveProperty('parallel_tool_calls');
    });

    test('Gemma 4 E2B thinks hard, as AWS advises, so it does not think aloud', async () => {
        const request = await askFirstRequest('google.gemma-4-e2b');
        expect(request).toMatchObject({
            max_tokens: 6000,
            reasoning_effort: 'high',
            parallel_tool_calls: false,
        });
    });

    test('a model the region does not serve is refused before a round is paid for', async () => {
        fake.bedrockRegion = 'us-east-1';
        // A live ChatGPT key too, to show it is NOT handed the question:
        // the fix is a setting, and another key would only hide it.
        fake.aiSetting = { ...fake.aiSetting, openAIAPIKey: 'sk-live' };
        const create = vi.fn(async () => {
            return genTextResponse();
        });
        fake.bedrock = { chat: { completions: { create } } };
        const openAiCreate = vi.fn(async () => {
            return genTextResponse();
        });
        fake.openai = { chat: { completions: { create: openAiCreate } } };

        try {
            await expect(
                askLlmBot('Hello?', 'presenter', 'bedrock', 'xai.grok-4.6'),
            ).rejects.toThrow(
                'Grok 4.6 is not offered in us-east-1 — choose us-west-2 ' +
                    'under Settings → AI Providers → AWS Region',
            );
            expect(create).not.toHaveBeenCalled();
            expect(openAiCreate).not.toHaveBeenCalled();
        } finally {
            fake.openai = null;
        }
    });

    test('names every region that does serve the model', () => {
        expect(
            findBedrockRegionProblem('openai.gpt-5.6-luna', 'eu-central-1'),
        ).toBe(
            'GPT-5.6 Luna is not offered in eu-central-1 — choose ' +
                'us-east-1, us-east-2 or us-west-2 under Settings → AI ' +
                'Providers → AWS Region',
        );
        expect(
            findBedrockRegionProblem('google.gemma-4-31b', 'eu-central-1'),
        ).toBeNull();
        // A model off the account's own list is the service's to answer for.
        expect(
            findBedrockRegionProblem('openai.gpt-oss-120b', 'eu-central-1'),
        ).toBeNull();
    });

    test('asks for one tool call a turn, with the plain budget', async () => {
        const create = vi
            .fn()
            .mockImplementationOnce(async () => {
                return genToolCallResponse();
            })
            .mockImplementationOnce(async () => {
                return genTextResponse();
            });
        fake.bedrock = { chat: { completions: { create } } };

        const answer = await askLlmBot(
            'How do I show the screen?',
            'presenter',
            'bedrock',
            'google.gemma-4-31b',
        );

        expect(answer.text).toBe('Press F5.');
        expect(fake.toolCallList).toEqual(['owa_help_search']);
        const request = create.mock.calls[0][0];
        expect(request).toMatchObject({
            model: 'google.gemma-4-31b',
            max_tokens: 6000,
            parallel_tool_calls: false,
        });
        expect(request.tools.length).toBeGreaterThan(0);
        // Not OpenAI: neither OpenAI's budget name nor a thinking setting.
        expect(request).not.toHaveProperty('max_completion_tokens');
        expect(request).not.toHaveProperty('reasoning_effort');
    });

    test('the last round carries neither tools nor the one-call rule', async () => {
        // OpenAI refuses `parallel_tool_calls` on a request with no tools,
        // and the last round of every question is one.
        const create = vi.fn(async (request: any) => {
            return request.tools ? genToolCallResponse() : genTextResponse();
        });
        fake.bedrock = { chat: { completions: { create } } };

        const answer = await askLlmBot(
            'How do I show the screen?',
            'presenter',
            'bedrock',
            'google.gemma-4-31b',
        );

        expect(answer.text).toBe('Press F5.');
        const lastRequest: any = create.mock.calls.at(-1)?.[0];
        expect(lastRequest).not.toHaveProperty('tools');
        expect(lastRequest).not.toHaveProperty('parallel_tool_calls');
        for (const [request] of create.mock.calls.slice(0, -1)) {
            expect(request).toMatchObject({ parallel_tool_calls: false });
        }
    });
});

// The user's own servers (LM Studio and the like): ONE provider key standing
// for all of them, each model `<serverId>/<rowId>`, asked by the server's
// own model id through the main-process relay.
describe('the custom servers', () => {
    const SERVER_ID = '11111111-2222-3333-4444-555555555555';
    const PHI_MODEL = `${SERVER_ID}/row-phi`;
    function genServer(value: Record<string, any> = {}) {
        return {
            id: SERVER_ID,
            name: 'LM Studio',
            baseUrl: 'http://localhost:1234/v1',
            models: [
                {
                    id: 'row-phi',
                    model: 'phi-3.1-mini-128k-instruct',
                    name: 'Phi 3.1 Mini 128k Instruct',
                },
                { id: 'row-llama', model: 'llama-3.2-3b-instruct', name: '' },
            ],
            ...value,
        };
    }
    function genTextResponse() {
        return {
            choices: [{ message: { role: 'assistant', content: 'Press F5.' } }],
            usage: { prompt_tokens: 900, completion_tokens: 30 },
        };
    }

    beforeEach(() => {
        fake.toolCallList = [];
        fake.toolList = [{ name: 'owa_help_search' }];
        fake.customServers = [genServer()];
        resetSpendGuardForTests();
        resetReasoningOffMemoryForTests();
    });
    afterEach(() => {
        fake.customServers = [];
        fake.custom = null;
        fake.aiSetting = null;
        fake.lmStudioInfoMap = null;
    });

    test('is offered only with a usable server, before the keyless one', () => {
        expect(getAvailableLlmProviders()).toEqual(['custom', 'free']);
        fake.customServers = [];
        expect(getAvailableLlmProviders()).toEqual(['free']);
    });

    test('is neither the keyless provider nor one with a key or a catalogue', () => {
        expect(checkIsCustomProvider('custom')).toBe(true);
        expect(checkIsFreeProvider('custom')).toBe(false);
        expect(getLlmProviderKeyField('custom')).toBeNull();
        expect(getLlmProviderWarning('custom')).toBeNull();
        expect(checkHasMoreModels('custom')).toBe(false);
        expect(checkCanSeeImages('custom', PHI_MODEL)).toBe(false);
    });

    test('lists every row by the name given, the server id behind it', () => {
        const [phi, llama] = getLlmModelList('custom');
        expect(phi).toMatchObject({
            id: PHI_MODEL,
            label: 'Phi 3.1 Mini 128k Instruct',
            wireId: 'phi-3.1-mini-128k-instruct',
            serverId: SERVER_ID,
            note: 'LM Studio, on this computer',
        });
        // No name given: the model id it is asked by.
        expect(llama.label).toBe('llama-3.2-3b-instruct');
        expect(getLlmProviderLabel('custom', PHI_MODEL)).toBe('LM Studio');
        expect(getLlmProviderLabel('openai')).toBe('ChatGPT');
    });

    test('moves a tab off a deleted row, onto the same server first', () => {
        expect(toUsableLlmModel('custom', PHI_MODEL)).toBe(PHI_MODEL);
        expect(toUsableLlmModel('custom', `${SERVER_ID}/row-gone`)).toBe(
            PHI_MODEL,
        );
        expect(toUsableLlmModel('custom', 'other-server/row-x')).toBe(
            PHI_MODEL,
        );
    });

    test('never stands in for a paid key, nor is stood in for', () => {
        fake.aiSetting = {
            openAIAPIKey: 'sk-live',
            anthropicAPIKey: '',
            kimiAPIKey: '',
        };
        expect(getAvailableLlmProviders()).toEqual([
            'openai',
            'custom',
            'free',
        ]);
        expect(getStandInLlmProvider('openai')).toBeNull();
        expect(getStandInLlmProvider('custom')).toBeNull();
    });

    test('asks by the server’s own model id, with the plain budget, at no cost', async () => {
        const create = vi.fn(async () => {
            return genTextResponse();
        });
        fake.custom = { chat: { completions: { create } } };
        const rounds: any[] = [];

        const answer = await askLlmBot(
            'How do I show the screen?',
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
            {
                onUsage: (round) => {
                    rounds.push(round);
                },
            },
        );

        expect(answer.text).toBe('Press F5.');
        const request = (create.mock.calls[0] as any[])[0];
        expect(request).toMatchObject({
            model: 'phi-3.1-mini-128k-instruct',
            max_tokens: 2000,
        });
        // A server that did not say which program it is keeps its own
        // sampling: it may be a gateway that refuses the field.
        expect(request).not.toHaveProperty('temperature');
        // The window's own id stays on the usage, for the price and the log;
        // a server on this computer costs nothing.
        expect(rounds[0]).toMatchObject({
            provider: 'custom',
            model: PHI_MODEL,
            isPricedAtZero: true,
        });
    });

    // EC-211, measured 2026-10-10 on the user's LM Studio: gemma-4-12b spent
    // 697 of 700 completion tokens thinking about a 5.7k-token ask and said
    // nothing; the same ask with reasoning_effort none answered in 14 s.
    test('an answer that was all thinking is asked for once more with thinking off', async () => {
        fake.lmStudioInfoMap = new Map();
        const create = vi.fn(async (request: any) => {
            if (request.reasoning_effort === 'none') {
                return genTextResponse();
            }
            return {
                choices: [
                    {
                        finish_reason: 'length',
                        message: {
                            role: 'assistant',
                            content: '',
                            reasoning_content: 'The user wants to know…',
                        },
                    },
                ],
                usage: {
                    prompt_tokens: 5670,
                    completion_tokens: 700,
                    completion_tokens_details: { reasoning_tokens: 697 },
                },
            };
        });
        fake.custom = { chat: { completions: { create } } };

        const answer = await askLlmBot(
            'How do I cast the virtual display to a TV?',
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
        );

        expect(answer.text).toBe('Press F5.');
        expect(create).toHaveBeenCalledTimes(2);
        const [first, second] = create.mock.calls.map((call: any[]) => {
            return call[0];
        });
        // The tool loop keeps its thinking on; only the retry turns it off.
        expect(first.reasoning_effort).toBeUndefined();
        expect(second).toMatchObject({ reasoning_effort: 'none' });
    });

    // EC-258: asked more than once, a 4B model got about one answer in
    // seven wrong on the dense pages and not the same ones twice -- the
    // program's own default temperature at work.
    test('a local program is asked for the likeliest word every time', async () => {
        fake.lmStudioInfoMap = new Map();
        const create = vi.fn(async () => {
            return genTextResponse();
        });
        fake.custom = { chat: { completions: { create } } };

        await askLlmBot(
            'How do I show the screen?',
            'presenter',
            'custom',
            PHI_MODEL,
        );

        const request = (create.mock.calls[0] as any[])[0];
        expect(request).toMatchObject({ temperature: 0 });
    });

    test('prices a server elsewhere as not known', async () => {
        fake.customServers = [
            genServer({ baseUrl: 'https://llm.example.org/v1' }),
        ];
        fake.custom = {
            chat: {
                completions: {
                    create: vi.fn(async () => {
                        return genTextResponse();
                    }),
                },
            },
        };
        const rounds: any[] = [];
        await askLlmBot('Hello?', 'presenter', 'custom', PHI_MODEL, [], null, {
            onUsage: (round) => {
                rounds.push(round);
            },
        });
        expect(rounds[0].isPricedAtZero).toBeUndefined();
    });

    test('says what the server said about itself, in its own sentence', async () => {
        fake.custom = {
            chat: {
                completions: {
                    create: vi.fn(async () => {
                        const error: any = new Error('Connection error.');
                        error.cause = new CustomServerError(
                            'nothing answered at http://localhost:1234/v1 — ' +
                                'check that its server is running',
                        );
                        throw error;
                    }),
                },
            },
        };
        await expect(
            askLlmBot('Hello?', 'presenter', 'custom', PHI_MODEL),
        ).rejects.toThrow(
            'nothing answered at http://localhost:1234/v1 — check that its ' +
                'server is running',
        );
    });

    test('asks a deleted row’s server by its first model instead', async () => {
        const create = vi.fn(async () => {
            return genTextResponse();
        });
        fake.custom = { chat: { completions: { create } } };
        await askLlmBot(
            'Hello?',
            'presenter',
            'custom',
            `${SERVER_ID}/row-gone`,
        );
        expect((create.mock.calls[0] as any[])[0].model).toBe(
            'phi-3.1-mini-128k-instruct',
        );
    });

    test('a machine on the same network costs nothing too', async () => {
        fake.customServers = [
            genServer({
                name: 'LM Studio super-computer',
                baseUrl: 'http://super-computer:1237/v1',
            }),
        ];
        fake.custom = {
            chat: {
                completions: {
                    create: vi.fn(async () => {
                        return genTextResponse();
                    }),
                },
            },
        };
        expect(getLlmModelList('custom')[0].note).toBe(
            'LM Studio super-computer, on your network',
        );
        const rounds: any[] = [];
        await askLlmBot('Hello?', 'presenter', 'custom', PHI_MODEL, [], null, {
            onUsage: (round) => {
                rounds.push(round);
            },
        });
        expect(rounds[0].isPricedAtZero).toBe(true);
    });

    test('sees a picture only with a row that says it can', () => {
        fake.customServers = [
            genServer({
                models: [
                    { id: 'row-phi', model: 'phi', name: '' },
                    {
                        id: 'row-qwen',
                        model: 'qwen/qwen3.5-9b',
                        name: '',
                        canSeeImages: true,
                    },
                ],
            }),
        ];
        expect(checkCanSeeImages('custom', PHI_MODEL)).toBe(false);
        expect(checkCanSeeImages('custom', `${SERVER_ID}/row-qwen`)).toBe(true);
        // Said on the model picker's hover, as the Free one says it.
        expect(getLlmModelList('custom')[1].note).toBe(
            'LM Studio, on this computer · can see pictures',
        );
        expect(getFirstImageCapableModel('custom')?.id).toBe(
            `${SERVER_ID}/row-qwen`,
        );
    });

    test('says the server is still loading the model, on the first round only', async () => {
        fake.lmStudioInfoMap = new Map([
            [
                'phi-3.1-mini-128k-instruct',
                {
                    isLoaded: false,
                    loadedContext: null,
                    maxContext: 131072,
                    canSeeImages: false,
                },
            ],
        ]);
        let round = 0;
        fake.custom = {
            chat: {
                completions: {
                    create: vi.fn(async () => {
                        round += 1;
                        return round === 1
                            ? {
                                  choices: [
                                      {
                                          message: {
                                              role: 'assistant',
                                              content: null,
                                              tool_calls: [
                                                  {
                                                      id: 'c1',
                                                      type: 'function',
                                                      function: {
                                                          name: 'owa_help_search',
                                                          arguments: '{}',
                                                      },
                                                  },
                                              ],
                                          },
                                      },
                                  ],
                              }
                            : genTextResponse();
                    }),
                },
            },
        };
        const steps: string[] = [];
        await askLlmBot('Hello?', 'presenter', 'custom', PHI_MODEL, [], null, {
            onProgress: (step) => {
                if (!step.isDone) {
                    steps.push(step.text);
                }
            },
        });
        expect(steps).toContain(
            'Waiting for LM Studio to load Phi 3.1 Mini 128k Instruct — ' +
                'the first answer takes longer',
        );
        expect(steps).toContain('Thinking it over (2)');
    });

    test('refuses a model loaded too small, before a round is posted', async () => {
        fake.lmStudioInfoMap = new Map([
            [
                'phi-3.1-mini-128k-instruct',
                {
                    isLoaded: true,
                    loadedContext: 4096,
                    maxContext: 131072,
                    canSeeImages: false,
                },
            ],
        ]);
        const create = vi.fn();
        fake.custom = { chat: { completions: { create } } };
        await expect(
            askLlmBot('Hello?', 'presenter', 'custom', PHI_MODEL),
        ).rejects.toThrow('context 4096 is too small');
        expect(create).not.toHaveBeenCalled();
    });

    // Ollama loads a model on the question at its own default context and
    // cuts a longer question down to fit, without a word: gemma4:e4b at
    // 4 096 answered from 2 051 tokens of ~13 000 (2026-10-16).
    test('says so when the question loaded the model too small and was cut', async () => {
        const genInfo = (isLoaded: boolean, loadedContext: number | null) => {
            return new Map([
                [
                    'phi-3.1-mini-128k-instruct',
                    {
                        isLoaded,
                        loadedContext,
                        maxContext: 131072,
                        canSeeImages: false,
                    },
                ],
            ]);
        };
        for (const [loadedAfter, isRefused] of [
            [4096, true],
            [32768, false],
        ] as const) {
            fake.lmStudioInfoMap = genInfo(false, null);
            const create = vi.fn(async () => {
                // The question is what loads it.
                fake.lmStudioInfoMap = genInfo(true, loadedAfter);
                return {
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: 'An answer.',
                            },
                        },
                    ],
                    usage: { prompt_tokens: 2051, completion_tokens: 30 },
                };
            });
            fake.custom = { chat: { completions: { create } } };
            const asking = askLlmBot(
                'Hello?',
                'presenter',
                'custom',
                PHI_MODEL,
            );
            if (isRefused) {
                await expect(asking).rejects.toThrow(
                    'answered from a question cut to 4096',
                );
            } else {
                await expect(asking).resolves.toBeTruthy();
            }
            expect(create).toHaveBeenCalledTimes(1);
        }
    });

    test('waiting input uses one tool-free JSON round and keeps literal reply text intact', async () => {
        const raw = '{"kind":"help","reply":"OPTIONS: Which language?"}';
        const create = vi.fn(async () => ({
            choices: [
                {
                    finish_reason: 'stop',
                    message: { role: 'assistant', content: raw },
                },
            ],
        }));
        fake.custom = { chat: { completions: { create } } };
        const answer = await askLlmBot(
            'Interpret Thai?',
            'reader',
            'custom',
            PHI_MODEL,
            [],
            null,
            { isWaitingInput: true },
        );
        expect(answer.text).toBe(raw);
        expect(create).toHaveBeenCalledTimes(1);
        const request = (create.mock.calls[0] as any[])[0];
        expect(request).not.toHaveProperty('tools');
        expect(request.messages[0].content).toContain('waiting question');
        expect(request.messages[0].content).toContain('JSON');
    });

    test('a general question goes out framed, with no tools and in one round', async () => {
        const create = vi.fn(async () => {
            return {
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'The Bible is a collection of books.',
                        },
                    },
                ],
                usage: { prompt_tokens: 900, completion_tokens: 30 },
            };
        });
        fake.custom = { chat: { completions: { create } } };
        const steps: string[] = [];
        const answer = await askLlmBot(
            toGeneralQuestionAsk('what is holy bible'),
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
            {
                isGeneral: true,
                onProgress: (step) => {
                    if (!step.isDone) {
                        steps.push(step.text);
                    }
                },
            },
        );
        expect(answer.text).toBe('The Bible is a collection of books.');
        expect(create).toHaveBeenCalledTimes(1);
        const request = (create.mock.calls[0] as any[])[0];
        expect(request).not.toHaveProperty('tools');
        expect(request).not.toHaveProperty('tool_choice');
        // The short system prompt, not the app's: a 4k local model has to
        // hold the question.
        expect(request.messages[0].role).toBe('system');
        expect(request.messages[0].content).toMatch(
            /general question that is NOT about the app/,
        );
        expect(request.messages[0].content.length).toBeLessThan(600);
        const lastMessage = request.messages[request.messages.length - 1];
        expect(lastMessage.role).toBe('user');
        expect(lastMessage.content).toMatch(
            /^what is holy bible\n\n\(This is a general question, not about the Open Worship app\./,
        );
        // The app is never connected to for it.
        expect(steps).not.toContain('Connecting to the app');
    });

    test('a known question keeps its walkthrough buttons when the model opens no page', async () => {
        // The page rode with the ask, so a small model wrote the answer
        // from it and called no tool; the recipe still stands under it.
        const create = vi.fn(async () => {
            return genTextResponse();
        });
        fake.custom = { chat: { completions: { create } } };
        const answer = await askLlmBot(
            'Where do I type John 3:16?',
            'reader',
            'custom',
            PHI_MODEL,
            [],
            null,
            { knownRecipeId: 'W-11' },
        );
        expect(answer.text).toBe('Press F5.');
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'Show me step by step',
            'Do it for me',
        ]);
        expect(answer.actions?.[0].args).toMatchObject({ manualId: 'W-11' });
        // Without it, as before: no page opened, nothing to walk.
        const bare = await askLlmBot(
            'Where do I type John 3:16?',
            'reader',
            'custom',
            PHI_MODEL,
        );
        expect(bare.actions).toBeUndefined();
    });

    // Passes 6-8 of the whole list asked in Khmer of gemma4:cloud (EC-330):
    // ~30 answers stopped before the job's last step with that step quoted.
    test('an answer to a named part is checked once for the steps that finish the job', async () => {
        const first = '1. Open **View**.';
        const replies = [first, 'KEEP'];
        const create = vi.fn(async () => {
            return {
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: replies.shift() ?? '',
                        },
                    },
                ],
                usage: { prompt_tokens: 900, completion_tokens: 10 },
            };
        });
        fake.custom = { chat: { completions: { create } } };
        const extra = {
            knownRecipeId: 'W-31',
            isKnownPageQuoted: true,
            isKnownPartNamed: true,
        };
        const kept = await askLlmBot(
            'How do I put the layout back?',
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
            extra,
        );
        expect(kept.text).toBe(first);
        expect(create).toHaveBeenCalledTimes(2);
        const checked = (create.mock.calls[1] as any[])[0];
        expect(checked.messages[checked.messages.length - 1].content).toContain(
            'reply with only the word KEEP',
        );
        // Written again with the missing step: the new one stands.
        const whole = '1. Open **View**.\n2. Click **Reset Widgets Size**.';
        replies.push(first, whole);
        create.mockClear();
        const rewritten = await askLlmBot(
            'How do I put the layout back?',
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
            extra,
        );
        expect(rewritten.text).toBe(whole);
        // No part named: one round, as before.
        replies.push(first);
        create.mockClear();
        await askLlmBot(
            'How do I put the layout back?',
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
            { knownRecipeId: 'W-31', isKnownPageQuoted: true },
        );
        expect(create).toHaveBeenCalledTimes(1);
    });

    test('the check names the controls of the part it holds the answer against', () => {
        expect(genCompletenessNudge(['ចន្លោះខាងក្នុង', 'ស៊ុម'])).toContain(
            'That part names these controls: **ចន្លោះខាងក្នុង**, **ស៊ុម**',
        );
        expect(genCompletenessNudge()).not.toContain('names these controls');
    });

    test('a reply to the check that says nothing new keeps the first answer', () => {
        const answer = '1. Open View.\n2. Click Reset Widgets Size.';
        expect(pickCheckedAnswer(answer, 'KEEP')).toBe(answer);
        expect(pickCheckedAnswer(answer, '**KEEP**')).toBe(answer);
        expect(pickCheckedAnswer(answer, 'ចម្លើយគឺពេញលេញ។')).toBe(answer);
        const longer = `${answer}\n3. Answer Yes.`;
        expect(pickCheckedAnswer(answer, longer)).toBe(longer);
        expect(pickCheckedAnswer(answer, `${longer}\nKEEP`)).toBe(longer);
    });

    // Pass 17 (2026-10-18): asked whether a step was missing, a why-question
    // came back padded with procedures nobody asked for.
    test('a what-or-why answer is checked for its answer, and may come back shorter', () => {
        const whatNudge = genCompletenessNudge(['ស៊ុម'], true);
        expect(whatNudge).toContain('WHAT something is or WHY it happens');
        expect(whatNudge).toContain('never a procedure it did not ask for');
        expect(whatNudge).not.toContain('names these controls');
        expect(genCompletenessNudge()).not.toContain('WHY it happens');
        const padded =
            '1. Open the ⋮ menu at the right end of the row.\n' +
            '2. It is the same menu a right-click on the row opens.\n' +
            '3. Scroll inside it with the mouse wheel to reach the rest.\n' +
            '4. Press an entry to choose it, or Escape to close the menu.\n' +
            '5. The menu uses the whole window height and scrolls only when ' +
            'it is taller than the window.';
        const focused =
            'A long menu scrolls only when it is taller than the whole window, ' +
            'never before that.';
        // The steps taken out make the rewrite the shorter one: kept.
        expect(pickCheckedAnswer(padded, focused, true)).toBe(focused);
        expect(pickCheckedAnswer(padded, focused)).toBe(padded);
        expect(pickCheckedAnswer(padded, 'KEEP', true)).toBe(padded);
        expect(pickCheckedAnswer(padded, 'ល្អហើយ។', true)).toBe(padded);
    });

    // 2026-10-12, the corpus's first forty-five questions asked of
    // gemma-4-e4b: thirty-six took three rounds or more, because steps
    // written from the page the app had quoted in the ask were handed back
    // as "written from a search excerpt", and the model opened the same
    // page again and wrote the answer a second time.
    test('steps written from a page quoted whole are not handed back', async () => {
        const steps = '1. Open **View**.\n2. Click **Reset Widgets Size**.';
        const create = vi.fn(async () => {
            return {
                choices: [{ message: { role: 'assistant', content: steps } }],
                usage: { prompt_tokens: 900, completion_tokens: 30 },
            };
        });
        fake.custom = { chat: { completions: { create } } };
        const answer = await askLlmBot(
            'How do I put the layout back the way it started?',
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
            { knownRecipeId: 'W-31', isKnownPageQuoted: true },
        );
        expect(answer.text).toContain('Reset Widgets Size');
        expect(create).toHaveBeenCalledTimes(1);
        // The walkthrough still stands under it, on that page.
        expect(answer.actions?.[0].args).toMatchObject({ manualId: 'W-31' });
        // A page that was cut to fit is only a hit: the step that answers
        // may be in the part that did not ride, so those steps go back once.
        create.mockClear();
        await askLlmBot(
            'How do I put the layout back the way it started?',
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
            { knownRecipeId: 'W-31' },
        );
        expect(create).toHaveBeenCalledTimes(2);
        const nudged = (create.mock.calls[1] as any[])[0];
        expect(nudged.messages[nudged.messages.length - 1].content).toMatch(
            /Open the page that fits/,
        );
    });

    test('a general question on LM Studio goes out with its thinking off; an app question keeps it', async () => {
        fake.lmStudioInfoMap = new Map([
            [
                'phi-3.1-mini-128k-instruct',
                {
                    isLoaded: true,
                    loadedContext: 32768,
                    maxContext: 131072,
                    canSeeImages: false,
                },
            ],
        ]);
        const create = vi.fn(async () => {
            return genTextResponse();
        });
        fake.custom = { chat: { completions: { create } } };
        await askLlmBot(
            toGeneralQuestionAsk('what is holy bible'),
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
            { isGeneral: true },
        );
        expect((create.mock.calls[0] as any[])[0]).toMatchObject({
            reasoning_effort: 'none',
        });
        // An app question keeps its reasoning: the tool calls may need it.
        create.mockClear();
        await askLlmBot('Is the screen on?', 'presenter', 'custom', PHI_MODEL);
        expect((create.mock.calls[0] as any[])[0]).not.toHaveProperty(
            'reasoning_effort',
        );
        // A server of a kind not measured to take the field is sent nothing
        // it may refuse. ANOTHER server: this one has said what it is.
        const OTHER_ID = '99999999-2222-3333-4444-555555555555';
        fake.customServers = [genServer({ id: OTHER_ID })];
        fake.lmStudioInfoMap = null;
        create.mockClear();
        await askLlmBot(
            toGeneralQuestionAsk('what is holy bible'),
            'presenter',
            'custom',
            `${OTHER_ID}/row-phi`,
            [],
            null,
            { isGeneral: true },
        );
        const unknownRequest = (create.mock.calls[0] as any[])[0];
        expect(unknownRequest).not.toHaveProperty('reasoning_effort');
        expect(unknownRequest).not.toHaveProperty('temperature');
    });

    // The look at the server is given five seconds in front of every
    // question; the one that runs out must not send that question out
    // sampled. Seen as the one answer in twenty-seven that differed between
    // two askings (2026-10-13).
    test('a server slow to say which program it is this once is still that program', async () => {
        const SLOW_ID = '77777777-2222-3333-4444-555555555555';
        fake.customServers = [genServer({ id: SLOW_ID })];
        const create = vi.fn(async () => {
            return genTextResponse();
        });
        fake.custom = { chat: { completions: { create } } };
        fake.lmStudioInfoMap = new Map();
        await askLlmBot('Hello?', 'presenter', 'custom', `${SLOW_ID}/row-phi`);
        expect((create.mock.calls[0] as any[])[0]).toMatchObject({
            temperature: 0,
        });
        // No answer to the look this time.
        fake.lmStudioInfoMap = null;
        create.mockClear();
        await askLlmBot('Hello?', 'presenter', 'custom', `${SLOW_ID}/row-phi`);
        expect((create.mock.calls[0] as any[])[0]).toMatchObject({
            temperature: 0,
        });
    });

    function genCallResponse(name: string, args: Record<string, any> = {}) {
        return {
            choices: [
                {
                    message: {
                        role: 'assistant',
                        content: null,
                        tool_calls: [
                            {
                                id: `c-${name}`,
                                type: 'function',
                                function: {
                                    name,
                                    arguments: JSON.stringify(args),
                                },
                            },
                        ],
                    },
                },
            ],
            usage: { prompt_tokens: 900, completion_tokens: 30 },
        };
    }

    test('reads a tool call the model wrote as words, runs it, and answers on', async () => {
        fake.toolList = [
            {
                name: 'owa_help_search',
                inputSchema: {
                    type: 'object',
                    properties: { query: { type: 'string' } },
                },
            } as any,
            { name: 'owa_list_screens' },
        ];
        fake.toolResultMap = { owa_list_screens: '{"isAnyShowing": false}' };
        let round = 0;
        const create = vi.fn(async () => {
            round += 1;
            return round === 1
                ? {
                      choices: [
                          {
                              message: {
                                  role: 'assistant',
                                  content:
                                      'Let me look.\n<tool_call>\n' +
                                      '<function=owa_list_screens>\n' +
                                      '</function>\n</tool_call>',
                              },
                          },
                      ],
                      usage: { prompt_tokens: 900, completion_tokens: 30 },
                  }
                : genTextResponse();
        });
        fake.custom = { chat: { completions: { create } } };
        const answer = await askLlmBot(
            'Is the screen on?',
            'presenter',
            'custom',
            PHI_MODEL,
        );
        expect(answer.text).toBe('Press F5.');
        expect(fake.toolCallList).toEqual(['owa_list_screens']);
        // Into the conversation as a real tool call with its words kept,
        // answered by a tool message under the call's own id.
        const second = (create.mock.calls[1] as any[])[0];
        const assistantTurn = second.messages.find((message: any) => {
            return message.role === 'assistant' && message.tool_calls;
        });
        expect(assistantTurn.content).toBe('Let me look.');
        expect(assistantTurn.tool_calls[0].function.name).toBe(
            'owa_list_screens',
        );
        const toolTurn = second.messages.find((message: any) => {
            return message.role === 'tool';
        });
        expect(toolTurn.tool_call_id).toBe('text_call_1');
        expect(toolTurn.content).toContain('isAnyShowing');
        fake.toolResultMap = null;
    });

    test('a tool call written as words on the last step is no answer', async () => {
        fake.toolList = [{ name: 'owa_list_screens' }];
        let round = 0;
        const create = vi.fn(async () => {
            round += 1;
            // Five real calls, then words where the answer should be.
            return round < 6
                ? genCallResponse('owa_list_screens')
                : {
                      choices: [
                          {
                              message: {
                                  role: 'assistant',
                                  content:
                                      '<tool_call>{"name": "owa_list_screens", "arguments": {}}</tool_call>',
                              },
                          },
                      ],
                      usage: { prompt_tokens: 900, completion_tokens: 30 },
                  };
        });
        fake.custom = { chat: { completions: { create } } };
        // Said as what it is, not as the network: a plain error with no
        // status used to read "it could not be reached".
        await expect(
            askLlmBot('Is the screen on?', 'presenter', 'custom', PHI_MODEL),
        ).rejects.toThrow('it wrote no answer this time');
        expect(create).toHaveBeenCalledTimes(6);
    });

    test('an answer written off the Presenter says so and offers the way there', async () => {
        fake.toolList = [{ name: 'owa_list_screens' }];
        fake.toolResultMap = {
            owa_list_screens:
                '{"isAnyShowing":false,"showingScreenIds":[],' +
                '"needsPage":"presenter","note":"What each screen holds …"}',
        };
        let round = 0;
        const create = vi.fn(async () => {
            round += 1;
            return round === 1
                ? genCallResponse('owa_list_screens')
                : genTextResponse();
        });
        fake.custom = { chat: { completions: { create } } };
        const answer = await askLlmBot(
            'Is anything showing on the projector?',
            'reader',
            'custom',
            PHI_MODEL,
        );
        expect(answer.text).toBe(
            'Press F5.\n\nTo see what is on the projector or what is ' +
                'selected, the main window needs to be on the Presenter ' +
                'page — switch to it and ask again.',
        );
        expect(answer.actions).toEqual([
            {
                label: 'Go to the Presenter',
                toolName: 'builtin-command',
                args: { command: '/goto presenter' },
            },
        ]);
        fake.toolResultMap = null;
    });

    // A Bible a model downloads waits for the person to agree to where it
    // came from: the notice goes under the model's words, and a model that
    // tries to install it itself is refused before the tool is called.
    test('a Bible the model downloaded is agreed to by the person, never installed by it', async () => {
        const link =
            'https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBible.xml';
        fake.toolList = [{ name: 'owa_bible_xml' }];
        fake.toolResultMap = {
            owa_bible_xml: JSON.stringify({
                kind: 'xml',
                draftId: 'he10paxbbz64',
                title: 'Khmer Standard Version 1954',
                source: link,
                books: 66,
                chapters: 1189,
                verses: 31102,
                keys: ['KSV'],
                takenKeys: [],
                locales: [],
                nameLists: [],
            }),
        };
        let round = 0;
        const create = vi.fn(async () => {
            round += 1;
            if (round === 1) {
                return genCallResponse('owa_bible_xml', {
                    action: 'check',
                    url: link,
                });
            }
            if (round === 2) {
                return genCallResponse('owa_bible_xml', {
                    action: 'import',
                    draftId: 'he10paxbbz64',
                    key: 'KSV',
                });
            }
            return genTextResponse();
        });
        fake.custom = { chat: { completions: { create } } };
        const answer = await askLlmBot(
            'Install the Khmer Bible from ' + link,
            'presenter',
            'custom',
            PHI_MODEL,
        );
        // The check ran; the install never reached the tool.
        expect(fake.toolCallList).toEqual(['owa_bible_xml']);
        const third = (create.mock.calls[2] as any[])[0];
        const refusal = third.messages.filter((message: any) => {
            return message.role === 'tool';
        })[1];
        expect(refusal.content).toContain('Tool refused: A Bible is installed');
        expect(answer.text).toContain('Press F5.\n\n**Before you install it');
        expect(answer.text).toContain('**It is not from Open Worship.**');
        // The notice's two addresses open; the model's own words carry none.
        expect(answer.links).toEqual([
            'https://github.com/Beblia/Holy-Bible-XML-Format',
            link,
        ]);
        expect(answer.actions?.map((action) => action.label)).toEqual([
            'I agree',
            'Open the website',
            'Cancel',
        ]);
        fake.toolResultMap = null;
    });

    // A state read is also how a model checks where it is, and off the
    // Presenter it always says so: three Reader answers on the free model
    // lost their walkthrough to "Go to the Presenter" (EC-280).
    test('a state read under another question offers no Presenter', async () => {
        fake.toolList = [{ name: 'owa_app_state' }];
        fake.toolResultMap = {
            owa_app_state:
                '{"mainWindow":{"page":"reader.html","needsPage":"presenter"}}',
        };
        for (const [asked, isOffered] of [
            ['How do I share a Bible list with another machine?', false],
            ['Which song is selected?', true],
            ['What is next in my running order?', true],
        ] as const) {
            let round = 0;
            const create = vi.fn(async () => {
                round += 1;
                return round === 1
                    ? genCallResponse('owa_app_state')
                    : genTextResponse();
            });
            fake.custom = { chat: { completions: { create } } };
            const answer = await askLlmBot(
                asked,
                'reader',
                'custom',
                PHI_MODEL,
            );
            expect(answer.text.includes('Presenter page'), asked).toBe(
                isOffered,
            );
            expect(answer.actions?.[0]?.label === 'Go to the Presenter').toBe(
                isOffered,
            );
        }
        fake.toolResultMap = null;
    });

    test('…but not when the model took the window there itself', async () => {
        fake.toolList = [
            { name: 'owa_list_screens' },
            { name: 'owa_goto_page' },
        ];
        fake.toolResultMap = {
            owa_list_screens: '{"isAnyShowing":false,"needsPage":"presenter"}',
            owa_goto_page: '{"page":"presenter.html","isMainWindow":true}',
        };
        let round = 0;
        const create = vi.fn(async () => {
            round += 1;
            if (round === 1) {
                return genCallResponse('owa_list_screens');
            }
            if (round === 2) {
                // The value the tool's own list of pages holds.
                return genCallResponse('owa_goto_page', {
                    page: 'presenter.html',
                });
            }
            return genTextResponse();
        });
        fake.custom = { chat: { completions: { create } } };
        const answer = await askLlmBot(
            'Is anything showing on the projector?',
            'reader',
            'custom',
            PHI_MODEL,
        );
        expect(answer.text).toBe('Press F5.');
        expect(answer.actions).toBeUndefined();
        fake.toolResultMap = null;
    });

    test('sends a local server the essential tools only, and says it is reading them', async () => {
        fake.toolList = [
            { name: 'owa_slide_file' },
            { name: 'owa_help_search' },
            { name: 'owa_bible_xml' },
            { name: 'owa_click' },
            { name: 'owa_read_website' },
            { name: 'owa_list_screens' },
        ];
        fake.lmStudioInfoMap = new Map([
            [
                'phi-3.1-mini-128k-instruct',
                {
                    isLoaded: true,
                    loadedContext: 32768,
                    maxContext: 131072,
                    canSeeImages: false,
                },
            ],
        ]);
        const create = vi.fn(async () => {
            return genTextResponse();
        });
        fake.custom = { chat: { completions: { create } } };
        const steps: string[] = [];
        await askLlmBot(
            'Is the screen on?',
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
            {
                onProgress: (step) => {
                    if (!step.isDone) {
                        steps.push(step.text);
                    }
                },
            },
        );
        const request = (create.mock.calls[0] as any[])[0];
        expect(
            request.tools.map((tool: any) => {
                return tool.function.name;
            }),
        ).toEqual(['owa_help_search', 'owa_click', 'owa_list_screens']);
        expect(steps).toContain(
            'LM Studio is reading the instructions first — the first answer ' +
                'takes longer on a local model',
        );
        expect(filterLocalToolList([{ name: 'owa_undo' }])).toEqual([]);
        // And the window can ask which of a question's tools that leaves out.
        expect(checkIsToolLeftOut('custom', 'owa_undo')).toBe(true);
        expect(checkIsToolLeftOut('custom', 'owa_help_page')).toBe(false);
        // Not a local server: the whole model list goes.
        expect(checkIsToolLeftOut('anthropic', 'owa_undo')).toBe(false);
        expect(checkIsToolLeftOut(null, 'owa_undo')).toBe(false);
        // Withheld from EVERY model is another matter, with its own message.
        expect(checkIsToolLeftOut('custom', 'owa_pick_element')).toBe(false);
    });

    test('a general question is not refused by a context too small for the app', async () => {
        // Ollama's default: the model loaded at 4k (2026-10-10, the user's
        // qwen3.5:4b under `ollama run`). An app question is refused before
        // a round; a general one is small and goes out.
        fake.lmStudioInfoMap = new Map([
            [
                'phi-3.1-mini-128k-instruct',
                {
                    isLoaded: true,
                    loadedContext: 4096,
                    maxContext: 131072,
                    canSeeImages: false,
                },
            ],
        ]);
        const create = vi.fn(async () => {
            return {
                choices: [
                    { message: { role: 'assistant', content: 'A library.' } },
                ],
                usage: { prompt_tokens: 120, completion_tokens: 5 },
            };
        });
        fake.custom = { chat: { completions: { create } } };
        const answer = await askLlmBot(
            toGeneralQuestionAsk('what is the Bible?'),
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
            { isGeneral: true },
        );
        expect(answer.text).toBe('A library.');
        expect(create).toHaveBeenCalledTimes(1);
    });

    test('says the model is gone, without asking anyone, when no server is left', async () => {
        const create = vi.fn();
        fake.custom = { chat: { completions: { create } } };
        fake.customServers = [];
        await expect(
            askLlmBot('Hello?', 'presenter', 'custom', PHI_MODEL),
        ).rejects.toThrow('this model is no longer in Settings');
        expect(create).not.toHaveBeenCalled();
    });
});

describe('askLlmBot, standing in for a dead key', () => {
    // An OpenAI-shaped client that answers every request the way the dead
    // account did, `insufficient_quota` and all.
    function genDeadOpenAi(status = 429) {
        const create = vi.fn(async (..._args: any[]) => {
            const error: any = new Error(
                `${status} {"error":{"message":"You have no credits ` +
                    `remaining.","type":"insufficient_quota"}}`,
            );
            error.status = status;
            throw error;
        });
        return { create, client: { chat: { completions: { create } } } };
    }

    beforeEach(() => {
        fake.toolCallList = [];
        fake.toolList = [{ name: 'owa_help_search' }];
        fake.aiSetting = {
            openAIAPIKey: 'sk-dead',
            anthropicAPIKey: 'sk-live',
            kimiAPIKey: '',
        };
    });
    afterEach(() => {
        fake.aiSetting = null;
        fake.openai = null;
        fake.anthropic = null;
    });

    test('the other key answers, and the answer says who did and why', async () => {
        const dead = genDeadOpenAi();
        fake.openai = dead.client;
        const anthropicCreate = vi.fn(async () => {
            return { content: [{ type: 'text', text: 'Press F5.' }] };
        });
        fake.anthropic = { messages: { create: anthropicCreate } };
        const steps: string[] = [];

        const answer = await askLlmBot(
            'How do I show the screen?',
            'presenter',
            'openai',
            'gpt-5',
            [],
            null,
            {
                onProgress: (step) => {
                    if (!step.isDone) {
                        steps.push(step.text);
                    }
                },
            },
        );

        expect(answer.text).toBe('Press F5.');
        // ONE post to the dead key: no SDK retries on this loop.
        expect(dead.create).toHaveBeenCalledTimes(1);
        expect(dead.create.mock.calls[0][1]).toMatchObject({ maxRetries: 0 });
        expect(anthropicCreate).toHaveBeenCalledTimes(1);
        expect(answer.standIn).toEqual({
            provider: 'anthropic',
            model: expect.any(String),
            failedProvider: 'openai',
            // The body said `insufficient_quota`, so the reason says credit
            // and not "or being rate-limited" -- and the kind is what the
            // window turns into the billing-page button.
            reason: 'the AI account is out of credit',
            issue: 'noCredit',
        });
        // The wait says what happened, in the providers' own names.
        expect(steps).toContain(
            'ChatGPT could not answer — asking Claude instead',
        );
    });

    test('a server that takes no tools is asked once more without them', async () => {
        // GPT4All's API server (2026-10-10): 400 "'tools' is not supported"
        // to the first round. The same model answers the same question with
        // no tools, from the guide text the ask carries, and the answer
        // says what it could not check.
        const create = vi.fn(async (request: any) => {
            if (request.tools !== undefined) {
                const error: any = new Error(
                    '400 {"error":{"message":"\'tools\' is not supported","type":"invalid_request_error"}}',
                );
                error.status = 400;
                throw error;
            }
            return {
                choices: [
                    {
                        finish_reason: 'stop',
                        message: {
                            role: 'assistant',
                            content:
                                'Click **Cast to a TV** on the display card.',
                        },
                    },
                ],
            };
        });
        fake.openai = { chat: { completions: { create } } };
        fake.aiSetting = {
            openAIAPIKey: 'sk-x',
            anthropicAPIKey: '',
            kimiAPIKey: '',
        };

        const answer = await askLlmBot(
            'How do I cast the virtual display to a TV?',
            'presenter',
            'openai',
            'gpt-5',
            [],
            null,
        );

        expect(create).toHaveBeenCalledTimes(2);
        expect(create.mock.calls[0][0].tools).toBeDefined();
        // The second post carries no tools and tells the model so, on the
        // ask itself.
        const retry = create.mock.calls[1][0];
        expect(retry.tools).toBeUndefined();
        const lastUser = [...retry.messages]
            .reverse()
            .find((one: any) => one.role === 'user');
        expect(lastUser.content).toContain(
            'The app’s tools are not available on this server',
        );
        expect(answer.text).toBe(
            'This assistant’s server cannot use the app’s tools, so this comes ' +
                'from the guide text alone and nothing was checked in the ' +
                'window — for presses and live answers, use LM Studio, Ollama ' +
                'or llama.cpp.\n\nClick **Cast to a TV** on the display card.',
        );
        // Not a provider fault, so no other key was asked.
        expect(answer.standIn).toBeUndefined();
    });

    test('a bad REQUEST is not stood in for', async () => {
        // A 400 is the question's fault; another key would refuse it too.
        // A real bad request, not the dead-account body under a 400: a body
        // that SAYS the account is empty is read as that whatever status it
        // arrives under (Anthropic files one under 400).
        const create = vi.fn(async (..._args: any[]) => {
            const error: any = new Error(
                '400 {"error":{"message":"max_tokens: is too large",' +
                    '"type":"invalid_request_error"}}',
            );
            error.status = 400;
            throw error;
        });
        const dead = { create, client: { chat: { completions: { create } } } };
        fake.openai = dead.client;
        const anthropicCreate = vi.fn();
        fake.anthropic = { messages: { create: anthropicCreate } };

        await expect(
            askLlmBot('How do I show the screen?', 'presenter', 'openai'),
        ).rejects.toThrow();
        expect(anthropicCreate).not.toHaveBeenCalled();
    });

    test("with no other key the dead one's own reason comes back", async () => {
        // The caller falls to the offline bot with this line beside it --
        // never to the keyless service.
        fake.aiSetting = {
            openAIAPIKey: 'sk-dead',
            anthropicAPIKey: '',
            kimiAPIKey: '',
        };
        const dead = genDeadOpenAi();
        fake.openai = dead.client;

        await expect(
            askLlmBot('How do I show the screen?', 'presenter', 'openai'),
        ).rejects.toThrow('the AI account is out of credit');
        expect(dead.create).toHaveBeenCalledTimes(1);
    });

    test('an Anthropic account out of credit is stood in for too', async () => {
        // A 402 -- or the older 400 whose only clue is "credit balance" --
        // is not a 401/403/429/5xx, and the first stand-in check took every
        // 400 for the question's own fault: a dead Claude key fell to the
        // manual with a live ChatGPT key one option along.
        fake.aiSetting = {
            openAIAPIKey: 'sk-live',
            anthropicAPIKey: 'sk-dead',
            kimiAPIKey: '',
        };
        const anthropicCreate = vi.fn(async () => {
            const error: any = new Error(
                '400 {"type":"error","error":{"type":"invalid_request_error",' +
                    '"message":"Your credit balance is too low to access the ' +
                    'Anthropic API. Please go to Plans & Billing to upgrade ' +
                    'or purchase credits."}}',
            );
            error.status = 400;
            error.error = {
                type: 'error',
                error: {
                    type: 'invalid_request_error',
                    message:
                        'Your credit balance is too low to access the ' +
                        'Anthropic API. Please go to Plans & Billing to ' +
                        'upgrade or purchase credits.',
                },
            };
            throw error;
        });
        fake.anthropic = { messages: { create: anthropicCreate } };
        const openAiCreate = vi.fn(async () => {
            return {
                choices: [
                    { message: { role: 'assistant', content: 'Press F5.' } },
                ],
            };
        });
        fake.openai = { chat: { completions: { create: openAiCreate } } };

        const answer = await askLlmBot(
            'How do I show the screen?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        expect(answer.text).toBe('Press F5.');
        expect(anthropicCreate).toHaveBeenCalledTimes(1);
        expect(openAiCreate).toHaveBeenCalledTimes(1);
        expect(answer.standIn).toMatchObject({
            provider: 'openai',
            failedProvider: 'anthropic',
            reason: 'the AI account is out of credit',
            issue: 'noCredit',
        });
    });
});

describe('askLlmBot, saying what it spent', () => {
    beforeEach(() => {
        fake.toolCallList = [];
        fake.toolList = [{ name: 'owa_help_search' }];
        fake.aiSetting = {
            openAIAPIKey: 'sk-live',
            anthropicAPIKey: 'sk-live',
            kimiAPIKey: '',
        };
    });
    afterEach(() => {
        fake.aiSetting = null;
        fake.openai = null;
        fake.anthropic = null;
    });

    test('every Anthropic round reports its usage as it lands, split as the provider splits it', async () => {
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
                    usage: {
                        input_tokens: 6,
                        output_tokens: 90,
                        cache_creation_input_tokens: 1641,
                        cache_read_input_tokens: 46901,
                    },
                };
            })
            .mockImplementationOnce(async () => {
                return {
                    content: [{ type: 'text', text: 'Press F5.' }],
                    usage: {
                        input_tokens: 700,
                        output_tokens: 335,
                        cache_creation_input_tokens: null,
                        cache_read_input_tokens: 48542,
                    },
                };
            });
        fake.anthropic = { messages: { create: createMock } };
        const rounds: any[] = [];

        await askLlmBot(
            'how do I add a background?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                onUsage: (round) => {
                    rounds.push(round);
                },
            },
        );

        expect(rounds).toEqual([
            {
                provider: 'anthropic',
                model: 'claude-sonnet-5',
                input: 6,
                cacheRead: 46901,
                cacheWrite: 1641,
                output: 90,
            },
            {
                provider: 'anthropic',
                model: 'claude-sonnet-5',
                input: 700,
                cacheRead: 48542,
                cacheWrite: 0,
                output: 335,
            },
        ]);
    });

    test('an OpenAI-shaped round takes the cached part off the prompt', async () => {
        const create = vi.fn(async () => {
            return {
                choices: [
                    {
                        message: { content: 'Press F5.', tool_calls: [] },
                        finish_reason: 'stop',
                    },
                ],
                usage: {
                    prompt_tokens: 10_000,
                    completion_tokens: 300,
                    prompt_tokens_details: { cached_tokens: 9_000 },
                },
            };
        });
        fake.openai = { chat: { completions: { create } } };
        const rounds: any[] = [];

        await askLlmBot('how?', 'presenter', 'openai', 'gpt-5-mini', [], null, {
            onUsage: (round) => {
                rounds.push(round);
            },
        });

        expect(rounds).toEqual([
            {
                provider: 'openai',
                model: 'gpt-5-mini',
                input: 1_000,
                cacheRead: 9_000,
                cacheWrite: 0,
                output: 300,
            },
        ]);
    });

    test('a round that failed reports nothing, and the stand-in reports under its own name', async () => {
        // The dead key's round never came back, so there is nothing to
        // count; the key that answered is the one the round is priced on.
        const create = vi.fn(async () => {
            const error: any = new Error(
                '429 {"error":{"type":"insufficient_quota"}}',
            );
            error.status = 429;
            throw error;
        });
        fake.openai = { chat: { completions: { create } } };
        fake.anthropic = {
            messages: {
                create: async () => {
                    return {
                        content: [{ type: 'text', text: 'Press F5.' }],
                        usage: { input_tokens: 50, output_tokens: 5 },
                    };
                },
            },
        };
        const rounds: any[] = [];

        const answer = await askLlmBot(
            'how?',
            'presenter',
            'openai',
            'gpt-5',
            [],
            null,
            {
                onUsage: (round) => {
                    rounds.push(round);
                },
            },
        );

        expect(answer.standIn?.provider).toBe('anthropic');
        expect(rounds).toHaveLength(1);
        expect(rounds[0]).toMatchObject({
            provider: 'anthropic',
            input: 50,
            output: 5,
        });
    });
});

// The circuit breaker on the bill (`spendGuardHelpers`), proven where it
// lives: on the loop, whoever the caller is. The user's own ask, 2026-09-10
// -- a runaway that eats the credit must be stopped by something a runaway
// cannot press.
describe('askLlmBot, guarding the bill', () => {
    // A cache-cold round at ~$0.19 on the dearest model.
    const DEAR_USAGE = { input_tokens: 30000, output_tokens: 1500 };

    beforeEach(() => {
        resetSpendGuardForTests();
        fake.toolCallList = [];
        fake.toolList = [{ name: 'owa_help_search' }];
        fake.aiSetting = {
            openAIAPIKey: 'sk-live',
            anthropicAPIKey: 'sk-live',
            kimiAPIKey: '',
        };
    });
    afterEach(() => {
        resetSpendGuardForTests();
        fake.aiSetting = null;
        fake.openai = null;
        fake.anthropic = null;
    });

    test('every round is counted, whether or not the caller asked to be told', async () => {
        fake.anthropic = {
            messages: {
                create: vi
                    .fn()
                    .mockImplementationOnce(async () => ({
                        content: [
                            {
                                type: 'tool_use',
                                id: 't1',
                                name: 'owa_help_search',
                                input: {},
                            },
                        ],
                        usage: DEAR_USAGE,
                    }))
                    .mockImplementationOnce(async () => ({
                        content: [{ type: 'text', text: 'Press F5.' }],
                        usage: DEAR_USAGE,
                    })),
            },
        };

        await askLlmBot('how?', 'presenter', 'anthropic', 'claude-opus-5', []);

        const state = getSpendState();
        expect(state.spentRounds).toBe(2);
        expect(state.spentUsd).toBeGreaterThan(0.3);
    });

    test('the round that would go over the cap is never posted', async () => {
        setSpendLimitUsd(0.25);
        const create = vi.fn(async () => ({
            content: [
                {
                    type: 'tool_use',
                    id: 't1',
                    name: 'owa_help_search',
                    input: {},
                },
            ],
            usage: DEAR_USAGE,
        }));
        fake.anthropic = { messages: { create } };

        const raised = await askLlmBot(
            'how?',
            'presenter',
            'anthropic',
            'claude-opus-5',
            [],
        ).catch((error: any) => error);

        // Two rounds at ~$0.19 reach $0.25; the third is refused before it
        // is bought -- the model kept asking for tools and would have gone
        // round ten times.
        expect(create).toHaveBeenCalledTimes(2);
        expect(raised).toBeInstanceOf(SpendLimitError);
        expect(raised.message).toContain('paused the assistant');
        expect(raised.message).not.toContain('internet');
        expect(getSpendState().isTripped).toBe(true);
    });

    test('once paused, the next question is refused before its first round', async () => {
        setSpendLimitUsd(0.25);
        const create = vi.fn(async () => ({
            content: [{ type: 'text', text: 'Press F5.' }],
            usage: DEAR_USAGE,
        }));
        fake.anthropic = { messages: { create } };
        await askLlmBot('how?', 'presenter', 'anthropic', 'claude-opus-5', []);
        await askLlmBot('how?', 'presenter', 'anthropic', 'claude-opus-5', []);
        expect(create).toHaveBeenCalledTimes(2);

        // Round three of a loop that asks and asks.
        await expect(
            askLlmBot('how?', 'presenter', 'anthropic', 'claude-opus-5', []),
        ).rejects.toBeInstanceOf(SpendLimitError);
        await expect(
            askLlmBot('how?', 'presenter', 'anthropic', 'claude-opus-5', []),
        ).rejects.toBeInstanceOf(SpendLimitError);
        expect(create).toHaveBeenCalledTimes(2);

        // A person pressed the button.
        allowMoreSpending();
        await askLlmBot('how?', 'presenter', 'anthropic', 'claude-opus-5', []);
        expect(create).toHaveBeenCalledTimes(3);
    });

    test('a pause is never handed to the other key to spend', async () => {
        setSpendLimitUsd(0.25);
        const openaiCreate = vi.fn(async () => ({
            choices: [
                {
                    message: { content: 'Press F5.', tool_calls: [] },
                    finish_reason: 'stop',
                },
            ],
            usage: { prompt_tokens: 30000, completion_tokens: 1500 },
        }));
        fake.openai = { chat: { completions: { create: openaiCreate } } };
        const anthropicCreate = vi.fn(async () => ({
            content: [{ type: 'text', text: 'Press F5.' }],
            usage: DEAR_USAGE,
        }));
        fake.anthropic = { messages: { create: anthropicCreate } };

        // gpt-5 at $1.25/M in and $10/M out: ~$0.05 a round; five reach it.
        for (let i = 0; i < 5; i++) {
            await askLlmBot('how?', 'presenter', 'openai', 'gpt-5', []);
        }
        expect(getSpendState().isTripped).toBe(true);

        await expect(
            askLlmBot('how?', 'presenter', 'openai', 'gpt-5', []),
        ).rejects.toBeInstanceOf(SpendLimitError);
        expect(anthropicCreate).not.toHaveBeenCalled();
    });
});

// The app is shown in Khmer for many of the people this window is for, and
// they read only that. The prompt is built per APP language (a cached prefix:
// the language changes only when the window reloads), and the language of a
// QUESTION rides at the end of the ask.
describe('the answer is in their language', () => {
    function useFakeAnthropic() {
        const createMock = vi.fn(async (_body: any) => {
            return { content: [{ type: 'text', text: 'ok' }] };
        });
        fake.toolCallList = [];
        fake.anthropic = { messages: { create: createMock } };
        return createMock;
    }

    function readLastUserText(body: any) {
        const content = body.messages[body.messages.length - 1].content;
        return typeof content === 'string'
            ? content
            : content
                  .filter((block: any) => block.type === 'text')
                  .map((block: any) => block.text)
                  .join('\n');
    }

    test('an English app keeps one English line and no language block', async () => {
        const createMock = useFakeAnthropic();
        await askLlmBot('how do I show a screen?', 'presenter', 'anthropic');
        const body = createMock.mock.calls[0][0];
        const prompt = body.system[0].text;
        expect(prompt).toContain('Answer in English unless the end of their');
        expect(prompt).not.toContain('LANGUAGE. This app is shown in');
        expect(prompt).not.toContain('ALWAYS answer in English');
        expect(prompt).toContain('steps yourself in plain English');
        // Nothing typed is known, so the ask is exactly what was asked.
        expect(readLastUserText(body)).toBe('how do I show a screen?');
    });

    test('a Khmer app is told so, and to search the guide in English', async () => {
        const createMock = useFakeAnthropic();
        await askLlmBot(
            'តើខ្ញុំបង្ហាញខគម្ពីរដោយរបៀបណា?',
            'presenter',
            'anthropic',
            null,
            [],
            null,
            { appLang: 'km', askedText: 'តើខ្ញុំបង្ហាញខគម្ពីរដោយរបៀបណា?' },
        );
        const body = createMock.mock.calls[0][0];
        const prompt = body.system[0].text;
        expect(prompt).toContain('This app is shown in Khmer (ខ្មែរ)');
        expect(prompt).toContain('THE GUIDE IS WRITTEN IN ENGLISH');
        expect(prompt).toContain('ITS PAGES COME TO YOU IN Khmer');
        // The menu bar is English in every language: "Help" written as
        // "ជំនួយ" sent the person to the ? button, which has no tips.
        expect(prompt).toContain(
            'reads File, Edit, View, Tools, Window and Help',
        );
        // `ol:Verse 1` written as `ol:ខគម្ពីរ 1` was a song the editor refused.
        expect(prompt).toContain('is typed as it stands');
        expect(prompt).toContain('never ១. ២. ៣.');
        expect(prompt).toContain('OPTIONS:, SHOWS:, NEEDS:');
        expect(prompt).toContain('steps yourself in plain words, in their');
        expect(prompt).not.toContain('Answer in English unless');
        expect(readLastUserText(body)).toMatch(/\(Answer in Khmer\.\)$/);
    });

    test('one prefix for the window, whatever language a question is in', async () => {
        const createMock = useFakeAnthropic();
        await askLlmBot(
            'How do I show a song on the screen?',
            'presenter',
            'anthropic',
            null,
            [],
            null,
            { appLang: 'km', askedText: 'How do I show a song on the screen?' },
        );
        await askLlmBot('បាទ', 'presenter', 'anthropic', null, [], null, {
            appLang: 'km',
            askedText: 'បាទ',
        });
        const [first, second] = createMock.mock.calls.map((call) => call[0]);
        expect(second.system).toEqual(first.system);
        expect(readLastUserText(first)).toContain(
            'They wrote in English: answer this one in English',
        );
        expect(readLastUserText(second)).toMatch(/\(Answer in Khmer\.\)$/);
    });

    // 2026-10-17, the whole corpus asked in Khmer of gemma4:cloud: handed the
    // English page, it wrote _បើក View on the top menu bar again and click_.
    // A page it opens comes in the language it is answering in; an English
    // ask, and one worked in English behind the scenes, keep the English.
    test('a page the model opens comes in the language it answers in', async () => {
        const askWith = async (question: string, extra: any) => {
            const createMock = vi.fn(async (_body: any) => {
                return createMock.mock.calls.length === 1
                    ? {
                          content: [
                              {
                                  type: 'tool_use',
                                  id: 'tool-1',
                                  name: 'owa_help_page',
                                  input: { id: 'W-31' },
                              },
                          ],
                      }
                    : { content: [{ type: 'text', text: 'ok' }] };
            });
            fake.toolArgsList = [];
            fake.anthropic = { messages: { create: createMock } };
            await askLlmBot(
                question,
                'presenter',
                'anthropic',
                null,
                [],
                null,
                extra,
            );
            return fake.toolArgsList.find((call) => {
                return call.name === 'owa_help_page';
            })?.args;
        };
        const khmer = 'តើខ្ញុំដាក់ការរៀបចំផ្ទាំងឲ្យដូចដើមវិញដោយរបៀបណា?';
        expect(
            await askWith(khmer, { appLang: 'km', askedText: khmer }),
        ).toEqual({ id: 'W-31@km' });
        expect(
            await askWith('How do I reset the layout?', {
                appLang: 'en',
                askedText: 'How do I reset the layout?',
            }),
        ).toEqual({ id: 'W-31' });
        // Their Khmer put into English for the model: the English page.
        expect(
            await askWith('How do I reset the layout?', {
                appLang: 'en',
                replyLang: 'en',
            }),
        ).toEqual({ id: 'W-31' });
    });

    // The same run: _Can you start a 5 minute countdown on the screen?_
    // started one on two screens that were off, and the answer was two chips
    // and no words at all.
    test('a reply of only its options goes back once for the words', async () => {
        const sent: any[] = [];
        const replies = [
            'OPTIONS: បង្ហាញវាលើអេក្រង់ | ឈប់រាប់ថយក្រោយ',
            'ខ្ញុំបានចាប់ផ្តើមរាប់ថយក្រោយ ៥ នាទីហើយ។\n\nOPTIONS: បង្ហាញវាលើអេក្រង់ | ឈប់រាប់ថយក្រោយ',
        ];
        const createMock = vi.fn(async (body: any) => {
            sent.push(structuredClone(body.messages));
            return {
                content: [
                    {
                        type: 'text',
                        text: replies[createMock.mock.calls.length - 1],
                    },
                ],
            };
        });
        fake.anthropic = { messages: { create: createMock } };
        const khmer = 'តើអ្នកអាចចាប់ផ្តើមរាប់ថយក្រោយ ៥ នាទីលើអេក្រង់បានទេ?';
        const answer = await askLlmBot(
            khmer,
            'presenter',
            'anthropic',
            null,
            [],
            null,
            { appLang: 'km', askedText: khmer },
        );
        expect(createMock).toHaveBeenCalledTimes(2);
        expect(answer.text).toBe('ខ្ញុំបានចាប់ផ្តើមរាប់ថយក្រោយ ៥ នាទីហើយ។');
        expect(answer.replies).toEqual(['បង្ហាញវាលើអេក្រង់', 'ឈប់រាប់ថយក្រោយ']);
        const handedBack = sent[1][sent[1].length - 1];
        expect(handedBack.role).toBe('user');
        expect(JSON.stringify(handedBack.content)).toContain(
            'that reply has no words for the person',
        );
        // Once: a second wordless reply is what is shown.
        const watch = genToolWatch();
        expect(findAnswerShapeNudge('OPTIONS: a | b', watch)?.nudge).toBe(
            WORDLESS_ANSWER_NUDGE,
        );
        expect(
            findAnswerShapeNudge('Done.\n\nOPTIONS: a | b', watch),
        ).toBeNull();
        watch.isShapeNudged = true;
        expect(findAnswerShapeNudge('OPTIONS: a | b', watch)).toBeNull();
    });

    // EC-391, 2026-10-22: Bible Find's 🤖 with `shepherd` over the Khmer
    // Bible, and the answer quoted John 10:11 in words of its own, one round,
    // nothing read.
    test('a verse search quoting a verse nothing returned goes back once', () => {
        const watch = genToolWatch();
        // Not a verse search: nothing to check.
        expect(findUnreadVerseNudge('**John 10:11** — I am', watch)).toBeNull();
        watch.verseFindBible = 'ពគប';
        watch.foundVerses = [
            {
                key: 'GEN 49:24',
                ref: 'Genesis 49:24',
                bible: 'ពគប',
                title: 'លោកុប្បត្តិ ៤៩:២៤',
            },
        ];
        const answer =
            '**យ៉ូហាន ១០:១១** — ខ្ញុំ​ជា​អ្នក​គង្វាល​ដ៏​ល្អ\n\n' +
            '**លោកុប្បត្តិ ៤៩:២៤** — ឯ​អ្នក​គង្វាល';
        const nudge = findUnreadVerseNudge(answer, watch);
        expect(nudge).toContain('no search or read returned យ៉ូហាន 10:11');
        expect(nudge).toContain('refs "យ៉ូហាន 10:11"');
        expect(nudge).not.toContain('លោកុប្បត្តិ');
        // Every verse it names was found: nothing to say.
        expect(
            findUnreadVerseNudge(
                '**Genesis 49:24** and លោកុប្បត្តិ ៤៩:២៤',
                watch,
            ),
        ).toBeNull();
        // Once.
        watch.isVerseNudged = true;
        expect(findUnreadVerseNudge(answer, watch)).toBeNull();
    });

    // 2026-10-22: under Noah's card, _where did the ark come to rest?_ was
    // answered with Genesis 8:4 in Khmer words of the model's own and the
    // wrong month; the record held neither the verse nor its words.
    test('a lookup answer quoting words nothing gave goes back once', () => {
        const watch = genToolWatch();
        const madeUp =
            'លោកុប្បត្តិ ៨:៤ ថា «ហើយទូកនោះក៏ចតនៅលើភ្នំអារ៉ារ៉ាត ក្នុងខែទីប្រាំបី»';
        // Not a lookup conversation: nothing to check.
        expect(findMisquoteNudge(madeUp, watch)).toBeNull();
        watch.quoteSources = [
            toQuoteKey(
                'Record: {"bible":"ពគប","quoted":[{"text":"(២៩): ដែល​គាត់​ឲ្យ​ឈ្មោះ​ថា ណូអេ ដោយ​និយាយ​ថា កូន​នេះ​នឹង​កំសាន្ត​ចិត្ត​យើង"}]}',
            ),
        ];
        watch.quoteBible = 'ពគប';
        const nudge = findMisquoteNudge(madeUp, watch);
        expect(nudge).toContain('ហើយទូកនោះក៏ចតនៅលើភ្នំ');
        expect(nudge).toContain('kind "verse", ref, bible "ពគប"');
        // Quoted as it was given -- spaces, verse number and zero-width
        // spaces dropped, a piece cut with an ellipsis -- stands.
        expect(
            findMisquoteNudge(
                'លោកុប្បត្តិ ៥:២៩ ថា «ដែលគាត់ឲ្យឈ្មោះថា ណូអេ … កូននេះនឹងកំសាន្តចិត្តយើង»',
                watch,
            ),
        ).toBeNull();
        // A name or a button in quotes is not a verse.
        expect(findMisquoteNudge('ចុច «ខគម្ពីររបស់វា»', watch)).toBeNull();
        // What a read returned later may be quoted too.
        addQuoteSource(
            watch,
            '{"passages":[{"text":"(៤): ដល់​ថ្ងៃ​១៧ ខែ​ទី​៧ នោះ​ទូក​ធំ​បាន​កឿង​នៅ​លើ​ភ្នំ​អារ៉ារ៉ាត"}]}',
        );
        expect(
            findMisquoteNudge(
                '«ដល់ថ្ងៃ១៧ ខែទី៧ នោះទូកធំបានកឿងនៅលើភ្នំអារ៉ារ៉ាត»',
                watch,
            ),
        ).toBeNull();
        // Once.
        watch.isQuoteNudged = true;
        expect(findMisquoteNudge(madeUp, watch)).toBeNull();
    });

    // 2026-10-23 (EC-418): the record heads the conversation, where a
    // server of the person's own keeps it between questions.
    test('a record heads the history, and the turns still alternate', () => {
        const history = [
            { author: 'you' as const, text: 'q1' },
            { author: 'bot' as const, text: 'a1' },
        ];
        const withRecord = withRecordTurn(history, 'Record: {"bible":"ពគប"}');
        expect(withRecord).toEqual([
            { author: 'you', text: 'Record: {"bible":"ពគប"}' },
            { author: 'bot', text: RECORD_TURN_ACK },
            ...history,
        ]);
        // The same record gives the same head, question after question.
        expect(withRecordTurn([], 'R')[0]).toEqual(
            withRecordTurn(history, 'R')[0],
        );
        expect(withRecordTurn(history, undefined)).toBe(history);
        expect(withRecordTurn(history, '  ')).toBe(history);
    });

    // 2026-10-23: _how long was Noah in the ark?_ under Genesis 8 was
    // answered "the passage does not state it" in one round, nothing read.
    test('"the Bible does not say", with nothing read, goes back once', () => {
        const watch = genToolWatch();
        const khmer =
            'យោងតាមអត្ថបទគម្ពីរ មិនបានបញ្ជាក់ពីចំនួនថ្ងៃសរុបដែលណូអេនៅក្នុងទូកទេ';
        // Not a lookup conversation.
        expect(findNotStatedNudge(khmer, watch)).toBeNull();
        watch.quoteSources = [toQuoteKey('Record: {"bible":"ពគប"}')];
        watch.quoteBible = 'ពគប';
        const nudge = findNotStatedNudge(khmer, watch);
        expect(nudge).toContain('kind "verse", ref, bible "ពគប"');
        // In English and French too, whatever the reader's language.
        expect(
            findNotStatedNudge('The passage does not say how long.', watch),
        ).not.toBeNull();
        expect(
            findNotStatedNudge('Le texte ne précise pas la durée.', watch),
        ).not.toBeNull();
        // An answer that says it.
        expect(
            findNotStatedNudge('He was in the ark about a year.', watch),
        ).toBeNull();
        // Said after a read, it stands; and once.
        watch.toolCallCount = 1;
        expect(findNotStatedNudge(khmer, watch)).toBeNull();
        watch.toolCallCount = 0;
        watch.isNotStatedNudged = true;
        expect(findNotStatedNudge(khmer, watch)).toBeNull();
    });

    // 2026-10-23: under a ពគប passage card, _what did Jesus teach after
    // this?_ read `MAT 18:18-35` with no Bible and quoted the KJV in English.
    test('a passage read in a record conversation goes to the record’s Bible', () => {
        const watch = genToolWatch();
        const read = { kind: 'verse', ref: 'MAT 18:18-35' };
        // Not a lookup conversation.
        expect(checkReadsInRecordBible(watch, 'owa_lookup_record', read)).toBe(
            false,
        );
        watch.quoteSources = [toQuoteKey('Record: {"bible":"ពគប"}')];
        watch.quoteBible = 'ពគប';
        expect(checkReadsInRecordBible(watch, 'owa_lookup_record', read)).toBe(
            true,
        );
        expect(
            checkReadsInRecordBible(watch, 'owa_find_verse', {
                words: 'ណូអេ',
            }),
        ).toBe(true);
        // A Bible asked for on purpose, a person's record and another tool
        // are left alone.
        expect(
            checkReadsInRecordBible(watch, 'owa_lookup_record', {
                ...read,
                bible: 'KJV',
            }),
        ).toBe(false);
        expect(
            checkReadsInRecordBible(watch, 'owa_lookup_record', {
                kind: 'name',
                id: 'x',
            }),
        ).toBe(false);
        expect(checkReadsInRecordBible(watch, 'owa_read_website', {})).toBe(
            false,
        );
    });

    // The same run: _Does the help still work with no internet?_ became
    // _សេវាកម្ម_ and then _ម_ nineteen hundred times, to the round's cap.
    test('a reply that runs away into one letter goes back once, cut', async () => {
        const runaway = `បាទ នៅតែដំណើរការ។ សេវាកម្ម${'ម'.repeat(1900)}`;
        const sent: any[] = [];
        const replies = [runaway, 'បាទ នៅតែដំណើរការ ដោយប្រើសៀវភៅណែនាំ។'];
        const createMock = vi.fn(async (body: any) => {
            sent.push(structuredClone(body.messages));
            return {
                content: [
                    {
                        type: 'text',
                        text: replies[createMock.mock.calls.length - 1],
                    },
                ],
            };
        });
        fake.anthropic = { messages: { create: createMock } };
        const khmer = 'តើជំនួយនៅតែដំណើរការទេ ពេលគ្មានអ៊ីនធឺណិត?';
        const answer = await askLlmBot(
            khmer,
            'presenter',
            'anthropic',
            null,
            [],
            null,
            { appLang: 'km', askedText: khmer },
        );
        expect(answer.text).toBe('បាទ នៅតែដំណើរការ ដោយប្រើសៀវភៅណែនាំ។');
        // What the model reads back is the part before the run.
        const keptTurn = sent[1][sent[1].length - 2];
        expect(keptTurn.role).toBe('assistant');
        expect(keptTurn.content[0].text).toBe('បាទ នៅតែដំណើរការ។ សេវាកម្');
        expect(sent[1][sent[1].length - 1].content).toBe(RUNAWAY_ANSWER_NUDGE);
        // Ordinary words, a few repeats of a sign, and Khmer's own ៗ are not a
        // runaway; a word said twelve times over is.
        expect(cutRunawayAnswer('ជាធម្មតា ម្ដងៗ — ១២៣ ...... !!!!')).toBe(
            'ជាធម្មតា ម្ដងៗ — ១២៣ ...... !!!!',
        );
        expect(cutRunawayAnswer(`ok ${'ha'.repeat(12)}`)).toBe('ok');
    });

    test('a question the window wrote itself is left as it is', async () => {
        const createMock = useFakeAnthropic();
        await askLlmBot(
            'Put these words into English: ព្រះ',
            'presenter',
            'anthropic',
            null,
            [],
            null,
            { appLang: 'km', isGeneral: true },
        );
        expect(readLastUserText(createMock.mock.calls[0][0])).toBe(
            'Put these words into English: ព្រះ',
        );
    });
});

// The whole corpus asked in Khmer of gemma-4-12b on the user's LM Studio
// (2026-10-17): every question thought its budget away and was asked again
// with thinking off, and one step read _ច<audio|> View_.
describe('a local Gemma 4, round by round', () => {
    test('a model that thought its budget away starts with thinking off, for a while', () => {
        const now = 1_000_000;
        expect(
            checkIsReasoningOffRemembered('Server A', 'gemma-4-12b', now),
        ).toBe(false);
        rememberReasoningOff('Server A', 'gemma-4-12b', now);
        expect(
            checkIsReasoningOffRemembered('Server A', 'gemma-4-12b', now + 1),
        ).toBe(true);
        // Another model, or the same name on another server, is not it.
        expect(
            checkIsReasoningOffRemembered('Server A', 'gemma-4-e4b', now + 1),
        ).toBe(false);
        expect(
            checkIsReasoningOffRemembered('Server B', 'gemma-4-12b', now + 1),
        ).toBe(false);
        // Half an hour on, it is trusted to think again.
        expect(
            checkIsReasoningOffRemembered(
                'Server A',
                'gemma-4-12b',
                now + 30 * 60 * 1000,
            ),
        ).toBe(false);
    });

    test('a printed control token is no part of the answer', () => {
        expect(dropModelTokens('១. ច<audio|> View នៅលើរបារ')).toBe(
            '១. ច View នៅលើរបារ',
        );
        expect(
            dropModelTokens('a<|image|>b<|turn>c<turn|>d<end_of_turn>'),
        ).toBe('abcd');
        // A LaTeX arrow in a menu path is the arrow it meant.
        expect(
            dropModelTokens('View $\\rightarrow$ Widgets, a \\rightarrow b'),
        ).toBe('View → Widgets, a → b');
        // Markdown, an arrow and a comparison are words.
        expect(dropModelTokens('a <b> c -> d | e < f > g')).toBe(
            'a <b> c -> d | e < f > g',
        );
    });
});

describe('genReplyLanguageLine', () => {
    test('English asked in an English app adds nothing', () => {
        expect(genReplyLanguageLine('en', 'en')).toBe('');
    });

    test('the app language is said plainly', () => {
        expect(genReplyLanguageLine('km', 'km')).toBe('(Answer in Khmer.)');
    });

    test('a question in another language than the app’s', () => {
        expect(genReplyLanguageLine('en', 'km')).toContain(
            'They wrote in English',
        );
        const khmerInEnglishApp = genReplyLanguageLine('km', 'en');
        expect(khmerInEnglishApp).toContain('answer in Khmer');
        expect(khmerInEnglishApp).toContain('search it with English words');
        expect(khmerInEnglishApp).toContain('Keep OPTIONS:');
    });

    test('a script nobody here knows is answered in itself', () => {
        expect(genReplyLanguageLine('other', 'km')).toContain(
            'Answer in the language they wrote in',
        );
    });
});

// One removal an answer (2026-10-17, EC-299): the free model moved ten of
// the person's things to the trash under one "yes, really, delete!".
describe('checkIsModelRemoval', () => {
    test('every removing action of the data tools counts', () => {
        for (const action of [
            'delete',
            'delete-file',
            'delete-list',
            'delete-slide',
            'remove',
        ]) {
            expect(checkIsModelRemoval({ action }), action).toBe(true);
        }
        expect(MAX_MODEL_REMOVALS_PER_ASK).toBe(1);
    });

    test('reading, adding and putting back do not', () => {
        for (const action of ['list', 'info', 'create', 'update', 'undo']) {
            expect(checkIsModelRemoval({ action }), action).toBe(false);
        }
        expect(checkIsModelRemoval({})).toBe(false);
        expect(checkIsModelRemoval(null)).toBe(false);
    });
});

// An answer that tells them to type /btw carries the button that does it
// (2026-10-17, the elder-persona run).
describe('genGeneralAskAction', () => {
    const answer = (text: string) => {
        return { text } as Parameters<typeof genGeneralAskAction>[0];
    };

    test('a /btw answer gets the question asked as a general one', () => {
        expect(
            genGeneralAskAction(
                answer(
                    'សូមវាយ /btw នៅពីមុខសំណួររបស់អ្នក (ឧទាហរណ៍៖ `/btw តើចេកថ្លៃប៉ុន្មាន?)',
                ),
                { askedText: 'ចេកមួយគីឡូថ្លៃប៉ុន្មាន?' },
            ),
        ).toEqual({
            label: 'Ask it as a general question',
            toolName: GENERAL_ASK_TOOL_NAME,
            args: { question: 'ចេកមួយគីឡូថ្លៃប៉ុន្មាន?' },
        });
    });

    test('nothing when it is already general, a command, or no /btw', () => {
        const btw = answer('Type /btw before your question.');
        expect(
            genGeneralAskAction(btw, { askedText: 'hi', isGeneral: true }),
        ).toBeNull();
        expect(genGeneralAskAction(btw, { askedText: '/screen' })).toBeNull();
        expect(genGeneralAskAction(btw, {})).toBeNull();
        expect(
            genGeneralAskAction(answer('Press F5.'), { askedText: 'how?' }),
        ).toBeNull();
    });
});
