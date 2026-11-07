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
vi.mock('../../../../../../helper/ai/aiHelpers', () => ({
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
vi.mock('../../../../../../helper/ai/anthropicHelpers', () => ({
    getAnthropicInstance: () => fake.anthropic,
}));
vi.mock('../../../../../../helper/ai/openAIHelpers', () => ({
    getOpenAIInstance: () => fake.openai,
}));
vi.mock('../../../../../../helper/ai/kimiHelpers', () => ({
    getKimiInstance: () => null,
}));
vi.mock('../../../../../../helper/ai/bedrockHelpers', () => ({
    getBedrockInstance: () => fake.bedrock,
}));
vi.mock('../../../../../../helper/ai/bedrockClaudeHelpers', () => ({
    getBedrockClaudeInstance: () => fake.bedrockClaude,
}));
// The user's own servers. The real modules reach the setting store and the
// relay's IPC, neither of which a node-env suite has.
vi.mock('../../../../../../helper/ai/customServerHelpers', () => ({
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
vi.mock('../../../../../../helper/ai/customServerClientHelpers', () => ({
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
vi.mock('../../../../../../helper/ai/freeHelpers', () => ({
    FREE_SERVICE_MAP: {
        // `homeUrl` too: the warning links are built off this map, so a mock
        // without it makes them come back pointing at nothing.
        kilo: { label: 'Kilo', homeUrl: 'https://kilo.ai' },
    },
    getFreeInstance: () => null,
}));
vi.mock('../../../../../../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: () => {},
}));
// Same reason as the four above: `helpBotHelpers`, which this imports, now
// logs a failed button press, and `loggerHelpers` reaches `appProvider` --
// `document` at module scope in a node-env suite (memory
// `appprovider-mock-node-env`).
vi.mock('../../../../../../helper/loggerHelpers', () => ({
    appError: vi.fn(),
}));
vi.mock('../../../../../../chatbot/mcpClient', () => ({
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
import { resetSpendGuardForTests } from '../../../../../../chatbot/spendGuardHelpers';
import {
    askLlmBot,
    pickCheckedAnswer,
    genCompletenessNudge,
    cutRunawayAnswer,
    dropModelTokens,
    findAnswerShapeNudge,
    toAnswerScript,
    findUnreadVerseNudge,
    findMisquoteNudge,
    findNotStatedNudge,
    checkReadsInRecordBible,
    withRecordTurn,
    RECORD_TURN_ACK,
    addQuoteSource,
    toQuoteKey,
    resetReasoningOffMemoryForTests,
    RUNAWAY_ANSWER_NUDGE,
    WORDLESS_ANSWER_NUDGE,
    genToolWatch,
    toGuideRescueAnswer,
    genGeneralAskAction,
    GENERAL_ASK_TOOL_NAME,
} from '../../../../../../chatbot/llmBotHelpers';

// The card is one line of plain text in a shadow root, so whatever the model
// wrote for a chat window has to be flattened before it is drawn there.
describe('toGuideRescueAnswer', () => {
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
});

// The user's own servers (LM Studio and the like): ONE provider key standing
// for all of them, each model `<serverId>/<rowId>`, asked by the server's
// own model id through the main-process relay.
describe('the custom servers', () => {
    const SERVER_ID = '11111111-2222-3333-4444-555555555555';
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

    // EC-460, 2026-11-04, end to end: a Thai question in a Khmer window, the
    // model's first reply wholly in Khmer, is asked for again in Thai, and
    // the Thai reply is the answer.
    test('a reply in the window language to a question in another goes back once', async () => {
        const sent: any[] = [];
        const replies = [
            'ចុចប៊ូតុង ⋯ តូចមួយ នៅផ្នែកខាងក្រោមខាងឆ្វេងនៃអត្ថបទ ដើម្បីបើកផ្ទាំងបញ្ជា។',
            'คลิกปุ่ม ⋯ เล็กๆ ที่มุมล่างซ้ายของข้อความ เพื่อเปิดแถบควบคุม',
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
        const thai = 'ตัวอักษรเล็กมาก จะทำให้ใหญ่ขึ้นได้อย่างไร';
        const answer = await askLlmBot(
            thai,
            'reader',
            'anthropic',
            null,
            [],
            null,
            { appLang: 'km', askedText: thai },
        );
        expect(createMock).toHaveBeenCalledTimes(2);
        expect(answer.text).toBe(replies[1]);
        const handedBack = sent[1][sent[1].length - 1];
        expect(handedBack.role).toBe('user');
        expect(JSON.stringify(handedBack.content)).toContain(
            'they wrote in Thai',
        );
    });

    // EC-459, 2026-11-04, end to end: the Malay for "small" in a Khmer chip,
    // a word the answer above never says, is not offered to press; the
    // chip beside it is.
    test('a chip with a word of a third language the answer never says is not offered', async () => {
        const createMock = vi.fn(async () => {
            return {
                content: [
                    {
                        type: 'text',
                        text:
                            'ដើម្បីធ្វើឱ្យអក្សរធំជាងនេះ សូមរំកិលរបារទំហំតួអក្សរទៅខាងស្ដាំ។\n' +
                            'OPTIONS: តើខ្ញុំធ្វើឱ្យវា Kecil វិញដោយរបៀបណា? | វានៅតែមិនដំណើរការ',
                    },
                ],
            };
        });
        fake.anthropic = { messages: { create: createMock } };
        const khmer = 'តើខ្ញុំធ្វើឱ្យអក្សរធំជាងនេះដោយរបៀបណា?';
        const answer = await askLlmBot(
            khmer,
            'reader',
            'anthropic',
            null,
            [],
            null,
            { appLang: 'km', askedText: khmer },
        );
        expect(createMock).toHaveBeenCalledTimes(1);
        expect(answer.replies).toEqual(['វានៅតែមិនដំណើរការ']);
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

    // EC-460, 2026-11-04: a Thai question in a Khmer window, told to answer
    // in Thai, came back wholly in Khmer. Thai has no package; it is a
    // language a person may type (its `typed.json`, there once installed).
    test('an answer in another script than the one asked goes back once', () => {
        const khmerAnswer =
            'ចុចប៊ូតុង ⋯ តូចមួយ នៅផ្នែកខាងក្រោមខាងឆ្វេងនៃអត្ថបទ ដើម្បីបើកផ្ទាំងបញ្ជា។';
        const watch = genToolWatch();
        watch.answerScript = toAnswerScript('th');
        expect(watch.answerScript?.name).toBe('Thai');
        expect(findAnswerShapeNudge(khmerAnswer, watch)?.nudge).toContain(
            'they wrote in Thai',
        );
        // Asked in Khmer, a Khmer answer is right, and so is one naming an
        // English button among its words.
        watch.answerScript = toAnswerScript('km');
        expect(findAnswerShapeNudge(khmerAnswer, watch)).toBeNull();
        expect(
            findAnswerShapeNudge(`${khmerAnswer} Font Size`, watch),
        ).toBeNull();
        // An English answer to a Khmer question goes back too.
        expect(
            findAnswerShapeNudge(
                'Click the small dots at the bottom left, then drag Font Size.',
                watch,
            )?.nudge,
        ).toContain('they wrote in Khmer');
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
        // In English too, whatever the reader's language.
        expect(
            findNotStatedNudge('The passage does not say how long.', watch),
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
});
