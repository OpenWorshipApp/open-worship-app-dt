import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The branches `llmBotHelpers.test.ts` leaves unrun: the real loops driven
// through fake SDK clients -- the nudges each loop hands back once, the
// salvage round, the tools a model may not press, the asks with a tool of
// their own (a verse search, a lookup record, the Bible Reader) -- and the
// settings the pickers read and write. Its own mock surface rather than the
// sibling's: these tests need a setting store that keeps what is written, a
// tool host that can fail, and clients for every provider.
const { fake, settingMap } = vi.hoisted(() => ({
    fake: {
        anthropic: null as any,
        openai: null as any,
        kimi: null as any,
        bedrock: null as any,
        bedrockClaude: null as any,
        free: null as any,
        custom: null as any,
        bedrockRegion: 'us-west-2',
        customServers: [] as any[],
        // What `readCustomServerModelInfo` answers, in turn.
        serverInfoList: [] as any[],
        aiSetting: null as Record<string, string> | null,
        toolList: [] as { name: string }[],
        // Every call the loop made of the tool host, in order.
        toolCallList: [] as { name: string; args: any }[],
        // What a tool answers, by name, when no `answerTool` is set.
        toolResultMap: {} as Record<string, string>,
        answerTool: null as null | ((name: string, args: any) => string),
        answerPictures: null as
            | null
            | ((name: string, args: any) => { text: string; pictures: any[] }),
    },
    // The setting store, which keeps what is written in it.
    settingMap: new Map<string, string>(),
}));

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
    getKimiInstance: () => fake.kimi,
}));
vi.mock('../helper/ai/bedrockHelpers', () => ({
    getBedrockInstance: () => fake.bedrock,
}));
vi.mock('../helper/ai/bedrockClaudeHelpers', () => ({
    getBedrockClaudeInstance: () => fake.bedrockClaude,
}));
vi.mock('../helper/ai/customServerHelpers', () => ({
    getCustomServers: () => fake.customServers,
    getAllCustomServers: () => fake.customServers,
    getUsableCustomServers: () => fake.customServers,
    readCustomServerModelInfo: async () => {
        return fake.serverInfoList.shift() ?? null;
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
    checkIsToolsRefused: (error: any) => {
        return /not supported|--jinja|does not support tools/i.test(
            String(error?.message ?? ''),
        );
    },
    toCustomServerFailure: (error: any) => {
        return error?.name === 'CustomServerError' ? error : null;
    },
}));
vi.mock('../helper/ai/freeHelpers', () => ({
    FREE_SERVICE_MAP: {
        kilo: { label: 'Kilo', homeUrl: 'https://kilo.ai' },
    },
    getFreeInstance: () => fake.free,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => {
        return settingMap.get(key) ?? null;
    },
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));
// `helpBotHelpers` logs a failed press, and `loggerHelpers` reaches
// `appProvider` -- `document` at module scope, which this node suite has not.
vi.mock('../helper/loggerHelpers', () => ({
    appError: () => {},
}));
vi.mock('./mcpClient', () => ({
    callTool: async (name: string, args?: any) => {
        fake.toolCallList.push({ name, args });
        if (fake.answerTool !== null) {
            return fake.answerTool(name, args);
        }
        return fake.toolResultMap[name] ?? '';
    },
    callToolWithPictures: async (name: string, args?: any) => {
        fake.toolCallList.push({ name, args });
        if (fake.answerPictures !== null) {
            return fake.answerPictures(name, args);
        }
        return { text: fake.toolResultMap[name] ?? '', pictures: [] };
    },
    listTools: async () => {
        return fake.toolList;
    },
    // The real one is a guarded `JSON.parse`; the module it lives in reaches
    // `appProvider`, which this node suite cannot load.
    parseToolJson: (text: string) => {
        try {
            return JSON.parse(text);
        } catch (_error) {
            return null;
        }
    },
}));

import { resetSpendGuardForTests } from './spendGuardHelpers';
import { BUILTIN_TOOL_NAME } from './helpBotHelpers';
import {
    NOTE_BLANK_LESSON_HINT,
    NOTE_LESSON_CHANGE_HINT,
    NOTE_LESSON_REVIEW_HINT,
    toNoteAsk,
    toNoteDocumentText,
} from './noteChatHelpers';
import {
    GENERAL_ASK_LABEL,
    GENERAL_ASK_TOOL_NAME,
    addQuoteSource,
    applyToolWatch,
    askLlmBot,
    checkCanSeeImages,
    checkIsReasoningOffRemembered,
    checkIsRoundTimeout,
    checkIsScreenToggleFind,
    describeLlmError,
    genChangedWithoutAnswer,
    genGeneralAskAction,
    genGuideRescueSummary,
    genLlmModelTitle,
    genToolWatch,
    getFirstImageCapableModel,
    getIsLlmAuto,
    getLlmModel,
    getLlmModelLabel,
    getLlmModelList,
    getLlmModelNotice,
    getLlmProvider,
    listAllLlmModels,
    rememberReasoningOff,
    resetReasoningOffMemoryForTests,
    setIsLlmAuto,
    setLlmModel,
    setLlmProvider,
    toGuideRescueAnswer,
} from './llmBotHelpers';

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
                name: 'Phi 3.1 Mini',
            },
        ],
        ...value,
    };
}

// A copy of what was SENT: the loop keeps pushing into the same array after
// the call, so the request object read later shows the conversation's end.
function snapshotOf(request: any) {
    return JSON.parse(JSON.stringify(request));
}

// An Anthropic client whose rounds are answered in turn by `rounds`; each
// request is kept as it was when it was sent.
function useAnthropic(rounds: any[], key: 'anthropic' | 'bedrockClaude') {
    const sentList: any[] = [];
    const create = vi.fn(async (request: any) => {
        sentList.push(snapshotOf(request));
        const next = rounds.shift();
        if (next instanceof Error || next?.isThrown === true) {
            throw next;
        }
        return next;
    });
    fake[key] = { messages: { create } };
    return { create, sentList };
}

function useOpenAiShaped(
    rounds: any[],
    key: 'openai' | 'kimi' | 'free' | 'custom' | 'bedrock',
) {
    const sentList: any[] = [];
    const create = vi.fn(async (request: any) => {
        sentList.push(snapshotOf(request));
        const next = rounds.shift();
        if (next instanceof Error || next?.isThrown === true) {
            throw next;
        }
        return next;
    });
    fake[key] = { chat: { completions: { create } } };
    return { create, sentList };
}

function anthropicText(text: string, stopReason = 'end_turn') {
    return {
        content: text.length === 0 ? [] : [{ type: 'text', text }],
        stop_reason: stopReason,
        usage: { input_tokens: 10, output_tokens: 5 },
    };
}

function anthropicToolUse(...uses: { name: string; input: any }[]) {
    return {
        content: uses.map((use, index) => {
            return {
                type: 'tool_use',
                id: `tool-${index}`,
                name: use.name,
                input: use.input,
            };
        }),
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 5 },
    };
}

function openAiText(text: string, finishReason = 'stop') {
    return {
        choices: [
            {
                message: { role: 'assistant', content: text },
                finish_reason: finishReason,
            },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
    };
}

function openAiToolCall(name: string, args: Record<string, any> = {}) {
    return {
        choices: [
            {
                message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                        {
                            id: `call-${name}`,
                            type: 'function',
                            function: { name, arguments: JSON.stringify(args) },
                        },
                    ],
                },
                finish_reason: 'tool_calls',
            },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
    };
}

function thrown(status: number | null, message = 'refused') {
    const error: any = new Error(message);
    if (status !== null) {
        error.status = status;
    }
    error.isThrown = true;
    return error;
}

// The tool results a round sent back, by the id of the call they answer.
function readToolResults(sent: any) {
    const last = sent.messages[sent.messages.length - 1];
    return last.content.filter((block: any) => {
        return block.type === 'tool_result';
    });
}

const LIVE_KEYS = {
    openAIAPIKey: 'sk-live',
    anthropicAPIKey: 'sk-ant-live',
    kimiAPIKey: '',
};

beforeEach(() => {
    settingMap.clear();
    fake.anthropic = null;
    fake.openai = null;
    fake.kimi = null;
    fake.bedrock = null;
    fake.bedrockClaude = null;
    fake.free = null;
    fake.custom = null;
    fake.bedrockRegion = 'us-west-2';
    fake.customServers = [];
    fake.serverInfoList = [];
    fake.aiSetting = null;
    fake.toolList = [];
    fake.toolCallList = [];
    fake.toolResultMap = {};
    fake.answerTool = null;
    fake.answerPictures = null;
    resetSpendGuardForTests();
    resetReasoningOffMemoryForTests();
});
afterEach(() => {
    resetSpendGuardForTests();
});

describe('the pickers’ own words and settings', () => {
    test('a model’s hover names its price and what the registry says', () => {
        const title = genLlmModelTitle({
            id: 'shared/row-1',
            wireId: 'gemma-4-12b',
            label: 'Gemma',
            note: 'good answers',
            speed: 'quick',
            price: '$1 / $2',
            notice: 'slow, but it saves us the cost',
        });
        expect(title.split('\n')).toEqual([
            'gemma-4-12b',
            'good answers · quick',
            '$1 / $2 per 1M tokens (in/out)',
            'slow, but it saves us the cost',
        ]);
    });

    test('the registry notice of a model is found by provider and id', () => {
        fake.customServers = [
            genServer({
                note: { en: 'Slow, but free.' },
                models: [
                    {
                        id: 'row-phi',
                        model: 'phi-3.1-mini-128k-instruct',
                        name: 'Phi 3.1 Mini',
                        note: { en: 'On the church PC.' },
                    },
                ],
            }),
        ];
        expect(getLlmModelNotice('custom', PHI_MODEL)).toBe(
            'Slow, but free. On the church PC.',
        );
        expect(getLlmModelNotice('custom', `${SERVER_ID}/row-gone`)).toBe('');
        expect(getLlmModelNotice('anthropic', 'claude-opus-5')).toBe('');
        expect(getLlmModelNotice(null, 'claude-opus-5')).toBe('');
    });

    test('a server is described by where it is and who shares it', () => {
        fake.customServers = [
            genServer({
                id: 'registry-a',
                name: 'Church GPU',
                baseUrl: 'https://shared-server.invalid/v1',
                source: 'registry',
                isFree: true,
            }),
            genServer({
                id: 'registry-b',
                name: 'Paid share',
                baseUrl: 'https://shared-server.invalid/v1',
                source: 'registry',
            }),
            genServer({
                id: 'lan',
                name: 'Hall PC',
                baseUrl: 'http://192.168.1.20:1234/v1',
            }),
            genServer({
                id: 'internet',
                name: 'Hosted',
                baseUrl: 'https://llm.example.com/v1',
                models: [
                    {
                        id: 'row-vision',
                        model: 'gemma-vision',
                        name: '',
                        canSeeImages: true,
                    },
                ],
            }),
        ];
        const noteList = getLlmModelList('custom').map((model) => {
            return model.note;
        });
        expect(noteList).toEqual([
            'Church GPU, shared by openworship.app · free',
            'Paid share, shared by openworship.app',
            'Hall PC, on your network',
            'Hosted · can see pictures',
        ]);
    });

    test('a model is named in the picker’s words, or by its id when gone', () => {
        expect(
            getLlmModelLabel('free', 'nvidia/nemotron-3.5-super-vl:free'),
        ).toBe('Nemotron Super VL');
        expect(getLlmModelLabel('free', 'withdrawn:free')).toBe(
            'withdrawn:free',
        );
    });

    test('the provider chosen is kept while its key is there', () => {
        // Nothing chosen and no key: the keyless one.
        expect(getLlmProvider()).toBe('free');
        setLlmProvider('anthropic');
        expect(settingMap.get('chatbot-llm-provider')).toBe('anthropic');
        // Chosen, but its key is gone: not a provider that can only fail.
        expect(getLlmProvider()).toBe('free');
        fake.aiSetting = LIVE_KEYS;
        expect(getLlmProvider()).toBe('anthropic');
        setLlmProvider('openai');
        expect(getLlmProvider()).toBe('openai');
    });

    test('Auto is remembered as a choice of its own', () => {
        expect(getIsLlmAuto()).toBe(true);
        setIsLlmAuto(false);
        expect(settingMap.get('chatbot-llm-auto')).toBe('false');
        expect(getIsLlmAuto()).toBe(false);
        setIsLlmAuto(true);
        expect(getIsLlmAuto()).toBe(true);
    });

    test('a model picked for one provider is that provider’s alone', () => {
        expect(getLlmModel('openai')).toBe('gpt-5');
        setLlmModel('openai', 'gpt-5-nano');
        expect(settingMap.get('chatbot-llm-model-openai')).toBe('gpt-5-nano');
        expect(getLlmModel('openai')).toBe('gpt-5-nano');
        expect(getLlmModel('anthropic')).toBe('claude-opus-5');
    });

    test('no provider means no eyes and no model that has them', () => {
        expect(checkCanSeeImages(null, 'claude-opus-5')).toBe(false);
        expect(getFirstImageCapableModel(null)).toBeNull();
    });

    test('a model the server could not load is said as that', () => {
        expect(
            describeLlmError({
                status: 400,
                message:
                    'Model loading was stopped due to insufficient system ' +
                    'resources',
            }),
        ).toContain('could not load this model');
    });
});

describe('the catalogue behind More models…', () => {
    test('Anthropic’s own list comes after the built-in one', async () => {
        const list = vi.fn(async () => {
            return {
                data: [
                    { id: 'claude-opus-5', display_name: 'Opus 5' },
                    { id: 'claude-zeta', display_name: 'Zeta' },
                    { id: 'claude-alpha', display_name: '' },
                ],
            };
        });
        fake.anthropic = { models: { list } };

        const models = await listAllLlmModels('anthropic');

        expect(list).toHaveBeenCalledWith({ limit: 100 });
        expect(
            models.map((model) => {
                return model.id;
            }),
        ).toEqual([
            'claude-opus-5',
            'claude-sonnet-5',
            'claude-haiku-4-5',
            // Alphabetical by label, an empty display name read as the id.
            'claude-alpha',
            'claude-zeta',
        ]);
    });

    test('no client is no remote list', async () => {
        const models = await listAllLlmModels('anthropic');
        expect(models).toHaveLength(3);
        expect(await listAllLlmModels('openai')).toHaveLength(3);
    });

    test('ChatGPT’s catalogue is sifted down to chat models', async () => {
        fake.openai = {
            models: {
                list: async () => {
                    return {
                        data: [
                            { id: 'gpt-5' },
                            { id: 'whisper-1' },
                            { id: 'gpt-4o-audio-preview' },
                            { id: 'o3' },
                            { id: 'gpt-4.1' },
                            { id: 'text-embedding-3-small' },
                        ],
                    };
                },
            },
        };

        const models = await listAllLlmModels('openai');

        expect(
            models.slice(3).map((model) => {
                return model.id;
            }),
        ).toEqual(['gpt-4.1', 'o3']);
    });

    test('Kimi’s catalogue is all chat models, kept whole', async () => {
        fake.kimi = {
            models: {
                list: async () => {
                    return { data: [{ id: 'kimi-k3' }, { id: 'moonshot-v1' }] };
                },
            },
        };

        const models = await listAllLlmModels('kimi');

        expect(models.at(-1)?.id).toBe('moonshot-v1');
        expect(models).toHaveLength(4);
    });

    test('the closed lists ask nobody', async () => {
        expect(await listAllLlmModels('free')).toHaveLength(3);
        expect(await listAllLlmModels('bedrock')).toHaveLength(10);
        fake.customServers = [genServer()];
        expect(await listAllLlmModels('custom')).toHaveLength(1);
    });

    test('a refused listing is said as one readable line', async () => {
        fake.openai = {
            models: {
                list: async () => {
                    throw thrown(401);
                },
            },
        };

        await expect(listAllLlmModels('openai')).rejects.toThrow(
            'the API key was refused',
        );
    });
});

describe('the tool watch and the rescue words', () => {
    test('a quote source is only kept in a conversation that keeps them', () => {
        const watch = genToolWatch();
        addQuoteSource(watch, 'In the beginning');
        expect(watch.quoteSources).toBeNull();
        watch.quoteSources = [];
        addQuoteSource(watch, 'In the beginning, God!');
        expect(watch.quoteSources).toEqual(['inthebeginninggod']);
    });

    test('a listed control is proven, a page of verses is found', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_list_ui',
            {},
            JSON.stringify({
                controls: [{ label: 'Show  Screen' }, { label: 7 }, {}],
            }),
        );
        expect([...watch.verifiedControlNames]).toEqual(['show screen']);
        watch.quoteSources = [];
        applyToolWatch(
            watch,
            'owa_find_verse',
            { words: 'love' },
            JSON.stringify({
                bible: 'KJV',
                verses: [{ key: 'MAT 5:44', ref: 'Matthew 5:44' }],
            }),
        );
        expect(watch.foundVerses).toEqual([
            { key: 'MAT 5:44', ref: 'Matthew 5:44', bible: 'KJV' },
        ]);
        // What it returned may be quoted.
        expect(watch.quoteSources).toHaveLength(1);
        expect(watch.toolCallCount).toBe(2);
    });

    test('a Bible check answered in prose leaves no import buttons', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_bible_xml',
            { action: 'check', url: 'https://example.com/x.xml' },
            'That link leads nowhere.',
        );
        expect(watch.bibleImportCheck).toBeNull();
    });

    test('the thinking-off memory forgets the models whose half hour ran out', () => {
        rememberReasoningOff('LM Studio', 'gemma', 0);
        expect(checkIsReasoningOffRemembered('LM Studio', 'gemma', 0)).toBe(
            true,
        );
        // A later write sweeps the gone entries out, not merely past them.
        rememberReasoningOff('Ollama', 'qwen', 31 * 60 * 1000);
        expect(checkIsReasoningOffRemembered('LM Studio', 'gemma', 0)).toBe(
            false,
        );
        expect(
            checkIsReasoningOffRemembered('Ollama', 'qwen', 31 * 60 * 1000),
        ).toBe(true);
    });

    test('a stuck step is summed up with what is known of it', () => {
        expect(
            genGuideRescueSummary({ stepNumber: 3, stepText: 'Press Go' }),
        ).toBe(
            'The walkthrough got stuck on step 3 — "Press Go" — and asked for help.',
        );
        expect(
            genGuideRescueSummary({ title: 'Show a verse', stepText: 'Go' }),
        ).toBe(
            'The walkthrough got stuck on "Show a verse" — "Go" — and asked for help.',
        );
        expect(genGuideRescueSummary({ stepText: 'Go' })).toBe(
            'The walkthrough got stuck — "Go" — and asked for help.',
        );
    });

    test('a long rescue with no sentence end is cut on a word', () => {
        const answer = toGuideRescueAnswer(
            `DO: ${'press the blue button again '.repeat(12)}`,
        );
        expect(answer.endsWith('…')).toBe(true);
        expect(answer.length).toBeLessThanOrEqual(241);
        expect(answer).not.toContain('DO:');
        expect(answer.slice(0, -1).endsWith(' ')).toBe(false);
    });

    test('the general-ask button is offered once', () => {
        const extra = { askedText: 'how much is a kilo of bananas?' };
        const action = genGeneralAskAction(
            { text: 'Type /btw before your question.' },
            extra,
        );
        expect(action?.toolName).toBe(GENERAL_ASK_TOOL_NAME);
        expect(
            genGeneralAskAction(
                {
                    text: 'Type /btw before your question.',
                    actions: [action!],
                },
                extra,
            ),
        ).toBeNull();
    });
});

describe('the Anthropic loop', () => {
    test('a verse it quotes that no search returned goes back once', async () => {
        const { sentList } = useAnthropic(
            [
                anthropicText('Matthew 5:44 tells you to love them.'),
                anthropicText('I could not read it; search for it below.'),
            ],
            'anthropic',
        );

        const answer = await askLlmBot(
            'love your enemies',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [
                { author: 'you', text: 'Help me find a verse' },
                { author: 'bot', text: 'Which Bible should I search?' },
            ],
            null,
            { verseFind: { bible: 'KJV' } },
        );

        expect(sentList).toHaveLength(2);
        // The verse search has a prompt of its own, and the earlier turns
        // ride in front of the question.
        expect(sentList[0].system[0].text).toContain('owa_find_verse');
        expect(sentList[0].messages.slice(0, 2)).toEqual([
            { role: 'user', content: 'Help me find a verse' },
            { role: 'assistant', content: 'Which Bible should I search?' },
        ]);
        const nudge = sentList[1].messages.at(-1).content;
        expect(nudge).toContain('no search or read returned Matthew 5:44');
        expect(nudge).toContain('bible "KJV"');
        // Nothing named was found: the answer offers another Bible and the
        // web search, the address written out as a link.
        expect(answer.text).toContain('https://www.google.com/search?q=');
        expect(answer.links?.[0]).toContain('bible+verse+love+your+enemies');
        expect(
            answer.actions?.map((action) => {
                return action.label;
            }),
        ).toEqual(['Search another Bible', 'Search Google for it']);
    });

    test('a verse the search found gets its Open button', async () => {
        fake.toolList = [
            { name: 'owa_find_verse' },
            { name: 'owa_help_search' },
        ];
        fake.toolResultMap.owa_find_verse = JSON.stringify({
            bible: 'KJV',
            verses: [{ key: 'MAT 5:44', ref: 'Matthew 5:44' }],
        });
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { words: 'love enemies' },
                }),
                anthropicText('Matthew 5:44 says to love your enemies.'),
            ],
            'anthropic',
        );

        const answer = await askLlmBot(
            'love your enemies',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { verseFind: { bible: 'KJV', canBrowse: true } },
        );

        // A verse search is offered its own tool and nothing of the guide.
        expect(
            sentList[0].tools.map((tool: any) => {
                return tool.name;
            }),
        ).toEqual(['owa_find_verse']);
        expect(answer.actions?.[0]).toMatchObject({
            label: 'Open Matthew 5:44 in Bible Lookup',
            args: { bible: 'KJV', open: 'MAT 5:44' },
        });
        expect(
            answer.actions?.slice(1).map((action) => {
                return action.label;
            }),
        ).toEqual(['Every verse with these words', 'Show in another Bible']);
    });

    test('words quoted as scripture that nothing gave go back, and the record is read in its own Bible', async () => {
        const record = JSON.stringify({
            bible: 'KJV',
            verses: 'And God remembered Noah',
        });
        let lookupCallCount = 0;
        fake.toolList = [{ name: 'owa_lookup_record' }];
        fake.answerTool = (name) => {
            if (name !== 'owa_lookup_record') {
                return '';
            }
            lookupCallCount += 1;
            if (lookupCallCount === 1) {
                // The panel's window has gone.
                throw new Error('no such page');
            }
            return 'But Noah found grace in the eyes of the LORD.';
        };
        const { sentList } = useAnthropic(
            [
                anthropicText(
                    'It says “Noah walked with God and found favour in his ' +
                        'sight”.',
                ),
                anthropicToolUse({
                    name: 'owa_lookup_record',
                    input: { kind: 'verse', ref: 'GEN 6:8' },
                }),
                anthropicText(
                    'Genesis 6:8 says “But Noah found grace in the eyes of ' +
                        'the LORD”.',
                ),
            ],
            'anthropic',
        );

        const answer = await askLlmBot(
            'What does it say of Noah?',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { lookup: { page: 'reader.html?uuid=reader', record } },
        );

        expect(sentList).toHaveLength(3);
        // The record heads the conversation, as its own first turn.
        expect(sentList[0].messages[0].content).toContain(
            'And God remembered Noah',
        );
        const nudge = sentList[1].messages.at(-1).content;
        expect(nudge).toContain('are not in the record');
        expect(nudge).toContain('bible "KJV"');
        // Read in the panel's window first, then anywhere, both times in
        // the record's own Bible.
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_lookup_record',
                args: {
                    kind: 'verse',
                    ref: 'GEN 6:8',
                    bible: 'KJV',
                    page: 'reader.html?uuid=reader',
                },
            },
            {
                name: 'owa_lookup_record',
                args: { kind: 'verse', ref: 'GEN 6:8', bible: 'KJV' },
            },
        ]);
        // A lookup answer is the whole of it: no walkthrough under it.
        expect(answer.text).toContain('Genesis 6:8');
        expect(answer.actions).toBeUndefined();
    });

    test('"the Bible does not say" with nothing read goes back once', async () => {
        const { sentList } = useAnthropic(
            [
                anthropicText('The passage does not say how long it was.'),
                anthropicText('It was one year and ten days.'),
            ],
            'anthropic',
        );

        const answer = await askLlmBot(
            'How long was Noah in the ark?',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { lookup: { page: null } },
        );

        expect(sentList).toHaveLength(2);
        expect(sentList[1].messages.at(-1).content).toContain(
            'you said the Bible does not say it',
        );
        expect(answer.text).toBe('It was one year and ten days.');
    });

    test('a question the window read for is not sent back for saying so', async () => {
        const { create } = useAnthropic(
            [anthropicText('Their names are not stated in this passage.')],
            'anthropic',
        );

        const answer = await askLlmBot(
            'Who is in it?',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { lookup: { page: null, isReadForAsk: true } },
        );

        expect(create).toHaveBeenCalledTimes(1);
        expect(answer.text).toBe('Their names are not stated in this passage.');
    });

    test('said done without the tool that does it goes back once', async () => {
        fake.toolList = [{ name: 'owa_foreground' }];
        fake.toolResultMap.owa_foreground = '{"did":"started"}';
        const { sentList } = useAnthropic(
            [
                anthropicText('Done — the countdown is running.'),
                anthropicToolUse({
                    name: 'owa_foreground',
                    input: { widget: 'countdown', minutes: 5 },
                }),
                anthropicText('Started a 5 minute countdown.'),
            ],
            'anthropic',
        );

        const answer = await askLlmBot(
            'Start a 5 minute countdown',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { knownDoTool: 'owa_foreground' },
        );

        expect(sentList[1].messages.at(-1).content).toContain(
            'you have not called owa_foreground',
        );
        expect(answer.text).toBe('Started a 5 minute countdown.');
        // The ask was done, so no walkthrough of doing it is offered.
        expect(answer.actions).toBeUndefined();
    });

    test('a screen is not turned on in the answer that put something on it (EC-603)', async () => {
        // Seen on Free: a message put up, the screens read, then the
        // show/hide pressed with no one asking -- the projector came on.
        fake.toolList = [
            { name: 'owa_foreground' },
            { name: 'owa_list_screens' },
            { name: 'owa_click' },
        ];
        fake.toolResultMap.owa_foreground = '{"did":"started"}';
        fake.toolResultMap.owa_list_screens = JSON.stringify({
            isAnyShowing: false,
            screens: [
                {
                    screenId: 0,
                    isShowing: false,
                    controls: { showHide: 'Toggle showing screen [F5]' },
                },
            ],
        });
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_foreground',
                    input: { widget: 'message', text: 'Welcome' },
                }),
                anthropicToolUse({ name: 'owa_list_screens', input: {} }),
                anthropicToolUse({
                    name: 'owa_click',
                    input: { find: 'Toggle showing screen [F5]' },
                }),
                anthropicText('The message is ready; the screen is off.'),
            ],
            'anthropic',
        );

        await askLlmBot(
            'Show a message on the screen: Welcome',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
        );

        expect(fake.toolCallList.map((call) => call.name)).not.toContain(
            'owa_click',
        );
        expect(JSON.stringify(sentList[3].messages.at(-1))).toContain(
            'Not pressed: this answer already changed what the screens hold',
        );
    });

    test('a screen asked to come on, nothing changed first, is pressed (EC-603)', async () => {
        fake.toolList = [{ name: 'owa_click' }];
        fake.toolResultMap.owa_click = '{"clicked":{"label":"Toggle"}}';
        useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_click',
                    input: { find: 'Toggle showing screen [F5]' },
                }),
                anthropicText('Screen 0 is on.'),
            ],
            'anthropic',
        );

        await askLlmBot(
            'Yes, turn it on',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
        );

        expect(fake.toolCallList.map((call) => call.name)).toContain(
            'owa_click',
        );
    });

    test('the show/hide is known by the words the screens gave it (EC-603)', () => {
        const watch = genToolWatch();
        // Its English words, with or without the shortcut, before any read.
        expect(checkIsScreenToggleFind('Toggle showing screen', watch)).toBe(
            true,
        );
        expect(
            checkIsScreenToggleFind('toggle showing screen [F5]', watch),
        ).toBe(true);
        expect(checkIsScreenToggleFind('Clear All [F6]', watch)).toBe(false);
        expect(checkIsScreenToggleFind('', watch)).toBe(false);
        // A window in another language: the label its screens' reader gave.
        applyToolWatch(
            watch,
            'owa_list_screens',
            {},
            JSON.stringify({
                screens: [{ controls: { showHide: 'Screen switch [F5]' } }],
            }),
        );
        expect(checkIsScreenToggleFind('Screen switch', watch)).toBe(true);
        expect(checkIsScreenToggleFind('Screen', watch)).toBe(false);
    });

    test('a round that thought its budget away says so', async () => {
        useAnthropic([anthropicText('', 'max_tokens')], 'anthropic');
        const answer = await askLlmBot(
            'Why?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );
        expect(answer.text).toContain('I ran out of room working that out');
    });

    test('a round with no words for any other reason finds no answer', async () => {
        useAnthropic([anthropicText('')], 'anthropic');
        const answer = await askLlmBot(
            'Why?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );
        expect(answer.text).toBe('I could not find an answer for that.');
    });

    test('Claude on Bedrock is refused before a round in a region without it', async () => {
        fake.bedrockRegion = 'ap-south-1';
        const { create } = useAnthropic([], 'bedrockClaude');

        const raised = await askLlmBot(
            'Hello?',
            'presenter',
            'bedrock',
            'global.anthropic.claude-haiku-5-5',
        ).catch((error: any) => {
            return error;
        });

        expect(create).not.toHaveBeenCalled();
        expect(raised.cause.message).toContain('is not offered in ap-south-1');
        expect(raised.cause.status).toBe(400);
    });

    test('an addition typed mid-answer rides once, blanks and repeats dropped', async () => {
        fake.toolList = [{ name: 'owa_help_search' }];
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_help_search',
                    input: { query: 'font' },
                }),
                anthropicText('Use the font size slider.'),
            ],
            'anthropic',
        );
        const takeAdditions = vi.fn(() => {
            return ['  ', 'Also the colour', 'also the COLOUR'];
        });

        await askLlmBot(
            'How do I make the words bigger?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { takeAdditions },
        );

        const lastBlock = sentList[1].messages.at(-1).content.at(-1);
        expect(lastBlock).toEqual({
            type: 'text',
            text:
                'The user has just added this to their question while you ' +
                'were looking things up. Answer both together:\n' +
                'Also the colour',
        });
    });

    test('the tools a model may not press are answered in words', async () => {
        fake.toolList = [{ name: 'owa_bible_xml' }, { name: 'owa_lyric_file' }];
        fake.toolResultMap.owa_lyric_file = '{"undoId":"u-1"}';
        const { sentList } = useAnthropic(
            [
                anthropicToolUse(
                    { name: 'owa_bible_xml', input: { action: 'create-kjv' } },
                    {
                        name: 'owa_lyric_file',
                        input: { action: 'delete', name: 'Old Song' },
                    },
                    {
                        name: 'owa_lyric_file',
                        input: { action: 'delete', name: 'Other Song' },
                    },
                ),
                anthropicText('Old Song is in the trash.'),
            ],
            'anthropic',
        );

        await askLlmBot(
            'Delete my songs',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        const results = readToolResults(sentList[1]);
        expect(results[0].content).toMatch(/^Tool refused: /);
        expect(results[1].content).toBe('{"undoId":"u-1"}');
        expect(results[2].content).toContain('Only ONE thing may be removed');
        // Only the one allowed removal reached the tool host.
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_lyric_file',
                args: { action: 'delete', name: 'Old Song' },
            },
        ]);
    });

    // 2026-11-08, the user: _chatbot should be able to create new bible note
    // (not allow delete), after create should open the note and attach to
    // the chatbot session_.
    test('a Bible note the model makes rides the answer; it may delete none', async () => {
        fake.toolList = [{ name: 'owa_bible_note' }];
        fake.toolResultMap.owa_bible_note = JSON.stringify({
            file: 'Default',
            added: 'Creation',
            id: 8,
            filePath: 'C:\\notes\\Default.own',
            undoId: 'u-8',
        });
        const { sentList } = useAnthropic(
            [
                anthropicToolUse(
                    {
                        name: 'owa_bible_note',
                        input: { action: 'delete', id: 2 },
                    },
                    {
                        name: 'owa_bible_note',
                        input: { action: 'delete-file', file: 'Old' },
                    },
                    {
                        name: 'owa_bible_note',
                        input: {
                            action: 'add',
                            title: 'Creation',
                            text: '## Key verses',
                        },
                    },
                ),
                anthropicText('I made the note "Creation".'),
            ],
            'anthropic',
        );

        const answer = await askLlmBot(
            'Make a Bible note about creation, and delete my old ones',
            'reader',
            'anthropic',
            'claude-sonnet-5',
        );

        const results = readToolResults(sentList[1]);
        expect(results[0].content).toMatch(
            /^Tool refused: Removing a Bible note or a notes file/,
        );
        expect(results[1].content).toMatch(/^Tool refused: /);
        // Only the add reached the tool host.
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_bible_note',
                args: {
                    action: 'add',
                    title: 'Creation',
                    text: '## Key verses',
                },
            },
        ]);
        expect(answer.createdNote).toEqual({
            name: 'Creation',
            filePath: 'C:\\notes\\Default.own',
            noteId: 8,
            undoId: 'u-8',
        });
        expect(answer.actions).toEqual([
            {
                label: 'Undo this change',
                toolName: 'lyric-undo',
                args: { id: 'u-8', name: 'Creation' },
            },
        ]);
        expect(answer.shows).toContainEqual({
            kind: 'control',
            value: 'Bible Notes > Creation',
            name: 'Show it in the list',
        });
    });

    // A note the assistant made is attached, which makes the tab a NOTE
    // conversation: "make another one" is asked there next.
    test('a note conversation makes a new note, and changes its own only with owa_note_edit', async () => {
        fake.toolList = [
            { name: 'owa_note_edit' },
            { name: 'owa_bible_note' },
            { name: 'owa_click' },
        ];
        fake.toolResultMap.owa_bible_note = JSON.stringify({
            file: 'Default',
            added: 'Genesis 3',
            id: 9,
            filePath: 'C:\\notes\\Default.own',
        });
        const { sentList } = useAnthropic(
            [
                anthropicToolUse(
                    {
                        name: 'owa_bible_note',
                        input: { action: 'update', id: 8, text: 'x' },
                    },
                    {
                        name: 'owa_bible_note',
                        input: { action: 'add', title: 'Genesis 3' },
                    },
                ),
                anthropicText('Made "Genesis 3".'),
            ],
            'anthropic',
        );

        const answer = await askLlmBot(
            'Make another note about Genesis 3',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Creation',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 8,
                        },
                    ],
                },
            },
        );

        expect(sentList[0].tools.map((tool: any) => tool.name).sort()).toEqual([
            'owa_bible_note',
            'owa_note_edit',
        ]);
        const results = readToolResults(sentList[1]);
        expect(results[0].content).toMatch(
            /^Tool refused: Here owa_bible_note only makes a NEW note/,
        );
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_bible_note',
                args: { action: 'add', title: 'Genesis 3' },
            },
        ]);
        expect(answer.createdNote).toMatchObject({
            name: 'Genesis 3',
            noteId: 9,
        });
    });

    // 2026-11-10, the goal _chatbot completely smart enough to help prepare
    // a best preaching lesson_: the person made an EMPTY note to hold the
    // lesson, so a new note the model makes is written into it, once.
    test('a lesson made in a conversation about an empty note goes into it', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_bible_note' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'The Good Shepherd',
            isChanged: true,
            undoId: 'u-1',
            summary: 'added 3 blocks',
        });
        const lesson = '[^John 10:11-18]\n## Big idea\nHe gives his life.';
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_bible_note',
                    input: {
                        action: 'add',
                        title: 'The Good Shepherd',
                        text: lesson,
                    },
                }),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );

        await askLlmBot(
            'help me prepare a sermon on John 10:11-18',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon Prep',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );

        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_note_edit',
                args: expect.objectContaining({
                    action: 'edit',
                    title: 'The Good Shepherd',
                    file: 'C:\\notes\\Default.own',
                    id: 4,
                    changes: [
                        { block: 1, remove: true },
                        { after: 0, kind: 'section', text: lesson },
                    ],
                }),
            },
        ]);
        const results = readToolResults(sentList[1]);
        expect(results[0].content).toMatch(/was empty, so the lesson was/);
    });

    // BN-66 (2026-11-10, seen live): the children's lesson button pressed,
    // the model "added" its question with an OPTIONS frame, and the window
    // wrote it into the empty note.
    test('a question for them is never written into the empty note', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_bible_note' }];
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_bible_note',
                    input: {
                        action: 'add',
                        title: 'Lesson',
                        text:
                            'Which passage would you like?\n\nOPTIONS:\n' +
                            '- Luke 15:1-7\n- Jonah 1',
                    },
                }),
                anthropicText('Which passage would you like?'),
            ],
            'anthropic',
        );
        await askLlmBot(
            "Help me prepare a children's lesson",
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(fake.toolCallList).toEqual([]);
        expect(readToolResults(sentList[1])[0].content).toContain(
            'Nothing was written: that is a question for them',
        );
    });

    // BN-67 (2026-11-10, seen live in Spanish): the fill was refused (a
    // book name no installed Bible reads), and the corrected add made a
    // second, new note -- the redirect had been spent on the refusal.
    test('a refused fill leaves the note empty for the next try', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_bible_note' }];
        let editCount = 0;
        fake.answerTool = (name: string) => {
            if (name !== 'owa_note_edit') {
                return '';
            }
            editCount += 1;
            return editCount === 1
                ? 'No installed Bible could read "Salmos 23".'
                : JSON.stringify({ name: 'Sermon Prep', isChanged: true });
        };
        const add = (text: string) => {
            return anthropicToolUse({
                name: 'owa_bible_note',
                input: { action: 'add', title: 'The Shepherd', text },
            });
        };
        useAnthropic(
            [
                add('[^Salmos 23]\n## Big idea\nHe leads.'),
                add('[^Psalm 23]\n## Big idea\nHe leads.'),
                add('[^Psalm 23]\n## Another\nA note of its own.'),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'help me prepare a sermon',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon Prep',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        // Refused, then filled; once in, a new note is a new note again.
        expect(fake.toolCallList.map((call) => call.name)).toEqual([
            'owa_note_edit',
            'owa_note_edit',
            'owa_bible_note',
        ]);
    });

    // BN-76 (2026-11-10, the blind readers): a lesson quoted Psalm 51:13 as
    // "sinners shall return unto thee", the passage it had just read saying
    // "be converted". Refused once, naming the quote; the next goes in.
    test('a lesson misquoting the passage it read is sent back once', async () => {
        fake.toolList = [
            { name: 'owa_note_edit' },
            { name: 'owa_bible_note' },
            { name: 'owa_find_verse' },
        ];
        fake.toolResultMap.owa_find_verse = JSON.stringify({
            bible: 'KJV',
            verses: [
                {
                    ref: 'Psalm 51:13',
                    text:
                        '(13): Then will I teach transgressors thy ways; and ' +
                        'sinners shall be converted unto thee.',
                },
            ],
        });
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Sermon Prep',
            isChanged: true,
        });
        const add = (text: string) => {
            return anthropicToolUse({
                name: 'owa_bible_note',
                input: { action: 'add', title: 'A Clean Heart', text },
            });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Psalm 51:13' },
                }),
                add(
                    '[^Psalm 51]\n## 1. Restored\nHe vows: "sinners shall return unto thee".',
                ),
                add(
                    '[^Psalm 51]\n## 1. Restored\nHe vows: "sinners shall be converted unto thee".',
                ),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'help me prepare a sermon on Psalm 51',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon Prep',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        // Refused before the tool host was asked, and never claimed written.
        const refused = readToolResults(sentList[2])[0].content;
        expect(refused).toContain(
            'the passage as read does not say “sinners shall return unto thee”',
        );
        expect(refused).not.toContain('written INTO it');
        expect(fake.toolCallList.map((call) => call.name)).toEqual([
            'owa_find_verse',
            'owa_note_edit',
        ]);
        expect(JSON.stringify(fake.toolCallList[1].args)).toContain(
            'sinners shall be converted unto thee',
        );
    });

    // BN-274 (2026-11-14, set 5's communion message, both batches): a new
    // lesson written with its passage never read had nothing to hold its
    // quotes to. The window reads the passage before the checks: a modern
    // wording takes the KJV's, a quote from memory is sent back once with
    // the passage's words, and the next goes in.
    test('a new lesson written unread has its passage read by the window', async () => {
        fake.toolList = [
            { name: 'owa_note_edit' },
            { name: 'owa_bible_note' },
            { name: 'owa_find_verse' },
        ];
        fake.answerTool = (name: string, args: any) => {
            if (name !== 'owa_find_verse') {
                return JSON.stringify({ name: 'Sermon Prep', isChanged: true });
            }
            return JSON.stringify({
                bible: 'KJV',
                verses: [
                    {
                        key: '1CO 11:23-26',
                        ref: args.refs,
                        text:
                            '(23): For I have received of the Lord that ' +
                            'which also I delivered unto you, That the Lord ' +
                            'Jesus the same night in which he was betrayed ' +
                            'took bread: (24): And when he had given thanks, ' +
                            'he brake it, and said, Take, eat: this is my ' +
                            'body, which is broken for you: this do in ' +
                            'remembrance of me.',
                    },
                ],
            });
        };
        const add = (words: string) => {
            return anthropicToolUse({
                name: 'owa_bible_note',
                input: {
                    action: 'add',
                    title: 'The Lord’s Table',
                    text:
                        '[^1 Corinthians 11:23-26]\n## 1. Received\nPaul ' +
                        `"received from the Lord" what he passed on: ${words}`,
                },
            });
        };
        const { sentList } = useAnthropic(
            [
                add('"he broke it, and said, Take and eat".'),
                add('"he brake it, and said, Take, eat".'),
                anthropicText('Your message is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'a short message for a communion service, from 1 Corinthians ' +
                `11:23-26
${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon Prep',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        const refused = readToolResults(sentList[1])[0].content;
        expect(refused).toContain(
            'the passage as read does not say “he broke it, and said, Take and eat”',
        );
        expect(refused).toContain(
            'The passage had not been read, so the window read it -- ' +
                '1 Corinthians 11:23-26: (23): For I have received of the Lord',
        );
        // Read once, by the window; then the lesson, the KJV's words in it,
        // and the note read to name its blocks under the change (BN-152).
        expect(fake.toolCallList.map((call) => call.name)).toEqual([
            'owa_find_verse',
            'owa_note_edit',
            'owa_note_edit',
        ]);
        expect(fake.toolCallList[0].args).toEqual({
            refs: '1 Corinthians 11:23-26',
        });
        expect(fake.toolCallList[2].args.action).toBe('read');
        const written = JSON.stringify(fake.toolCallList[1].args);
        expect(written).toContain('received of the Lord');
        expect(written).not.toContain('received from the Lord');
        expect(written).toContain('he brake it, and said, Take, eat');
    });

    // BN-110 (2026-11-11): Matthew 11:28, never read, was quoted as "weary
    // and heavy laden". The window reads the verse a quote names and sends
    // the lesson back once, with the verse; the next goes in.
    test('a quote that is not the verse it names is sent back once', async () => {
        fake.toolList = [
            { name: 'owa_note_edit' },
            { name: 'owa_bible_note' },
            { name: 'owa_find_verse' },
        ];
        fake.answerTool = (name: string, args: any) => {
            if (name !== 'owa_find_verse') {
                return JSON.stringify({ name: 'Sermon Prep', isChanged: true });
            }
            return JSON.stringify({
                bible: 'KJV',
                verses:
                    args.refs === 'Matthew 11:28'
                        ? [
                              {
                                  ref: 'Matthew 11:28',
                                  text:
                                      '(28): Come unto me, all ye that labour ' +
                                      'and are heavy laden, and I will give ' +
                                      'you rest.',
                              },
                          ]
                        : [],
            });
        };
        const add = (quote: string) => {
            return anthropicToolUse({
                name: 'owa_bible_note',
                input: {
                    action: 'add',
                    title: 'Strength for the Weary',
                    text:
                        '[^Isaiah 40:31]\n## Pointing to Jesus\nJesus calls ' +
                        `"${quote}" to come to Him for rest (Matthew 11:28).`,
                },
            });
        };
        const { sentList } = useAnthropic(
            [
                add('weary and heavy laden'),
                add('all ye that labour and are heavy laden'),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'help me prepare a sermon on Isaiah 40:31',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon Prep',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        const refused = readToolResults(sentList[1])[0].content;
        expect(refused).toContain(
            'Matthew 11:28 reads: “Come unto me, all ye that labour and are ' +
                'heavy laden, and I will give you rest.” -- not “weary and ' +
                'heavy laden”',
        );
        // The window read the verse; the lesson went in on the second try.
        expect(
            fake.toolCallList.map((call) => [call.name, call.args?.refs]),
        ).toEqual([
            ['owa_find_verse', 'Matthew 11:28'],
            ['owa_note_edit', undefined],
        ]);
        expect(JSON.stringify(fake.toolCallList[1].args)).toContain(
            'all ye that labour and are heavy laden',
        );
    });

    // BN-148 (2026-11-11): the window read each cited verse in a call of
    // its own, eight at once, and every call is one of the firewall's 25
    // acting calls a minute -- shape30's next lesson was refused. The single
    // verses go in ONE read, matched back by their keys whatever order the
    // read answers in; a range keeps a read of its own.
    // BN-160 (2026-11-12, ab34, Opus: an error): a Revelation 21 funeral
    // message gave its own passage's words to John 4:14. The window reads
    // the verse named and names the verse the words come from.
    test("the passage's own words given another verse's name are named", async () => {
        fake.toolList = [
            { name: 'owa_note_edit' },
            { name: 'owa_bible_note' },
            { name: 'owa_find_verse' },
        ];
        const line =
            'He gives "the water of life freely" (John 4:14) to all who ' +
            'thirst.';
        fake.answerTool = (name: string, args: any) => {
            if (name === 'owa_find_verse') {
                const verseMap: Record<string, any> = {
                    'Revelation 21:1-7': {
                        key: 'REV 21:1-7',
                        ref: 'Revelation 21:1-7',
                        text:
                            '(5): Behold, I make all things new. (6): I will ' +
                            'give unto him that is athirst of the fountain of ' +
                            'the water of life freely. (7): He that overcometh ' +
                            'shall inherit all things.',
                    },
                    'John 4:14': {
                        key: 'JHN 4:14',
                        ref: 'John 4:14',
                        text:
                            '(14): But whosoever drinketh of the water that I ' +
                            'shall give him shall never thirst; but the water ' +
                            'that I shall give him shall be in him a well of ' +
                            'water springing up into everlasting life.',
                    },
                };
                const verse = verseMap[args?.refs];
                return JSON.stringify({
                    bible: 'KJV',
                    verses: verse === undefined ? [] : [verse],
                });
            }
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h2',
                    blocks: [
                        { n: 4, kind: 'h2', text: 'Pointing to Jesus' },
                        { n: 5, kind: 'paragraph', text: line },
                    ],
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Revelation 21:1-7' },
                }),
                anthropicToolUse({
                    name: 'owa_bible_note',
                    input: {
                        action: 'add',
                        title: 'A Message of Hope',
                        text:
                            '[^Revelation 21:1-7]\n## Pointing to Jesus\n' +
                            line,
                    },
                }),
                anthropicText('Your message is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'a message of hope for a funeral, from Revelation 21:1-7',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        const result = readToolResults(sentList[2])[0].content;
        expect(result).toContain(
            `block 5: "${line}" -- "the water of life freely" is ` +
                "Revelation 21:6's words, not John 4:14's",
        );
        // John 4:14 was read, once; the lesson went in as written.
        expect(
            fake.toolCallList.filter((call) => {
                return call.args?.refs === 'John 4:14';
            }),
        ).toHaveLength(1);
    });

    test('the cited single verses are read in one call', async () => {
        fake.toolList = [
            { name: 'owa_note_edit' },
            { name: 'owa_bible_note' },
            { name: 'owa_find_verse' },
        ];
        const verseMap: Record<string, { key: string; text: string }> = {
            'Matthew 11:28': {
                key: 'MAT 11:28',
                text:
                    '(28): Come unto me, all ye that labour and are heavy ' +
                    'laden, and I will give you rest.',
            },
            'John 14:27': {
                key: 'JHN 14:27',
                text:
                    '(27): Peace I leave with you, my peace I give unto you: ' +
                    'not as the world giveth, give I unto you. Let not your ' +
                    'heart be troubled, neither let it be afraid.',
            },
            'Isaiah 40:30-31': {
                key: 'ISA 40:30-31',
                text:
                    '(30): Even the youths shall faint and be weary, and the ' +
                    'young men shall utterly fall: (31): But they that wait ' +
                    'upon the LORD shall renew their strength; they shall ' +
                    'mount up with wings as eagles; they shall run, and not ' +
                    'be weary; and they shall walk, and not faint.',
            },
        };
        fake.answerTool = (name: string, args: any) => {
            if (name !== 'owa_find_verse') {
                return JSON.stringify({ name: 'Sermon Prep', isChanged: true });
            }
            return JSON.stringify({
                bible: 'KJV',
                // Answered last first: matched by key, not by place.
                verses: String(args.refs)
                    .split('; ')
                    .reverse()
                    .flatMap((ref) => {
                        const verse = verseMap[ref];
                        return verse === undefined ? [] : [{ ref, ...verse }];
                    }),
            });
        };
        const add = (quote: string) => {
            return anthropicToolUse({
                name: 'owa_bible_note',
                input: {
                    action: 'add',
                    title: 'Strength for the Weary',
                    text:
                        '[^Isaiah 40:31]\n## Pointing to Jesus\nJesus calls ' +
                        `"${quote}" to come to Him for rest (Matthew 11:28). ` +
                        'He says, "Let not your heart be troubled" (John ' +
                        '14:27). And "they that wait upon the LORD shall ' +
                        'renew their strength" (Isaiah 40:30-31).',
                },
            });
        };
        const { sentList } = useAnthropic(
            [
                add('weary and heavy laden'),
                add('all ye that labour and are heavy laden'),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'help me prepare a sermon on Isaiah 40:31',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon Prep',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        const refused = readToolResults(sentList[1])[0].content;
        expect(refused).toContain(
            'Matthew 11:28 reads: “Come unto me, all ye that labour and are ' +
                'heavy laden, and I will give you rest.” -- not “weary and ' +
                'heavy laden”',
        );
        // The verses quoted rightly are not named.
        expect(refused).not.toContain('John 14:27');
        expect(refused).not.toContain('Isaiah 40:30-31');
        expect(
            fake.toolCallList.map((call) => [call.name, call.args?.refs]),
        ).toEqual([
            ['owa_find_verse', 'Matthew 11:28; John 14:27'],
            ['owa_find_verse', 'Isaiah 40:30-31'],
            ['owa_note_edit', undefined],
        ]);
    });

    // BN-120 (2026-11-11): "finds its fulfillment in Jesus, who [^John
    // 1:14]." -- a token in place of the verse's words is sent back once,
    // with the sentence; the next goes in.
    test('a token standing in for a verse is sent back once', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_bible_note' }];
        fake.answerTool = () => {
            return JSON.stringify({ name: 'Sermon Prep', isChanged: true });
        };
        const add = (christ: string) => {
            return anthropicToolUse({
                name: 'owa_bible_note',
                input: {
                    action: 'add',
                    title: 'A Home Prepared',
                    text: `[^Revelation 21:1-7]\n## Pointing to Jesus\n${christ}`,
                },
            });
        };
        const { sentList } = useAnthropic(
            [
                add('It is fulfilled in Jesus, who [^John 1:14].'),
                add(
                    'It is fulfilled in Jesus, who came to dwell among us [^John 1:14].',
                ),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'a message of hope for a funeral, from Revelation 21:1-7',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon Prep',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        const refused = readToolResults(sentList[1])[0].content;
        expect(refused).toContain(
            '“It is fulfilled in Jesus, who [^John 1:14].” -- a token shows ' +
                'only as its reference',
        );
        expect(fake.toolCallList.map((call) => call.name)).toEqual([
            'owa_note_edit',
        ]);
        expect(JSON.stringify(fake.toolCallList[0].args)).toContain(
            'who came to dwell among us',
        );
    });

    // BN-74 (2026-11-10): a review of their lesson with nothing to press
    // is asked once more, for the fixes it named as buttons.
    test('a lesson review with no fix to press is asked for them', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        const { sentList } = useAnthropic(
            [
                anthropicText(
                    'A strong lesson. The response could gather the big idea.',
                ),
                anthropicText(
                    'A strong lesson.\nOPTIONS: Add a response that ' +
                        'gathers it | Write what verse 3 means',
                ),
            ],
            'anthropic',
        );
        const answer = await askLlmBot(
            `is this a good sermon?\n${NOTE_LESSON_REVIEW_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Zacchaeus',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                },
            },
        );
        expect(sentList).toHaveLength(2);
        expect(JSON.stringify(sentList[1].messages)).toContain(
            'the review offers no change to press',
        );
        expect(answer.text).toBe('A strong lesson.');
        expect(answer.replies).toEqual([
            'Add a response that gathers it',
            'Write what verse 3 means',
        ]);
    });

    // BN-81 (2026-11-10): the children's card pressed, gemma4:cloud wrote
    // its "which passage?" into the empty note with owa_note_edit -- the
    // question guard had been on the add's redirect alone.
    test('a question is never written into an empty note by an edit either', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Lesson',
            isChanged: true,
        });
        const edit = (text: string) => {
            return anthropicToolUse({
                name: 'owa_note_edit',
                input: {
                    action: 'edit',
                    note: 'Lesson',
                    changes: [
                        { block: 1, remove: true },
                        { after: 0, kind: 'section', text },
                    ],
                },
            });
        };
        const { sentList } = useAnthropic(
            [
                edit('Please tell me which Bible passage you would like?'),
                anthropicText(
                    'Which passage would you like?\nOPTIONS: Jonah | Psalm 23',
                ),
            ],
            'anthropic',
        );
        await askLlmBot(
            `Help me prepare a children's lesson\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(readToolResults(sentList[1])[0].content).toContain(
            'that is a question for them, not a lesson',
        );
        expect(fake.toolCallList).toEqual([]);
    });

    // BN-89 (2026-11-11): told to read the verses before the passage, the
    // model did in about half the lessons and made the background up in the
    // rest. A new lesson's first passage read takes them too, once an ask.
    test('a new lesson reads the verses before its passage too', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        // Each read answers its own refs (BN-100: the verses before are a
        // read of their own, so the passage keeps its whole budget).
        fake.answerTool = (_name: string, args: any) => {
            return JSON.stringify({
                bible: 'KJV',
                verses: [
                    {
                        ref: args.refs,
                        text:
                            args.refs === 'Luke 10:25-37'
                                ? '(35): he took out two pence, and gave them…'
                                : '(15): And thou, Capernaum…',
                    },
                ],
            });
        };
        const read = (refs: string) => {
            return anthropicToolUse({
                name: 'owa_find_verse',
                input: { refs },
            });
        };
        const { sentList } = useAnthropic(
            [
                read('Luke 10:25-37'),
                read('Leviticus 19:18'),
                anthropicText('Which way should the lesson go?'),
            ],
            'anthropic',
        );
        await askLlmBot(
            `a sermon on the good samaritan\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(fake.toolCallList.map((call) => call.args.refs)).toEqual([
            'Luke 10:25-37',
            'Luke 10:15-24',
            'Leviticus 19:18',
        ]);
        const firstRead = readToolResults(sentList[1])[0].content;
        expect(firstRead).toMatch(
            /^\(The window also read Luke 10:15-24, the verses just before/,
        );
        // BN-91: the passage's KJV words, explained by Scripture.
        expect(firstRead).toContain(
            "- penny, pence: ONE penny was a labourer's pay for one day",
        );
        const secondRead = readToolResults(sentList[2])[0].content;
        expect(secondRead).not.toContain('The window also read');
        expect(secondRead).not.toContain('as Scripture itself explains');
    });

    // BN-147 (closing BN-122): a psalm's title is in no Bible the app reads,
    // and psalm backgrounds were told from memory ("add the sons of Korah").
    test("a new lesson's psalm read carries its KJV title", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        fake.answerTool = (_name: string, args: any) => {
            return JSON.stringify({
                bible: 'KJV',
                verses: [
                    {
                        ref: args.refs,
                        text: '(1): God is our refuge and strength…',
                    },
                ],
            });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Psalm 46:1-11' },
                }),
                anthropicText('Which way should the devotion go?'),
            ],
            'anthropic',
        );
        await askLlmBot(
            `a short devotion on Psalm 46\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(readToolResults(sentList[1])[0].content).toContain(
            'Psalm 46: "To the chief Musician for the sons of Korah, A Song ' +
                'upon Alamoth."',
        );
    });

    // BN-279 (ab101..ab103): every Psalm 40 lesson read Psalm 39:13 and told
    // it as the setting. The passage read says the psalm before is another
    // psalm, and a read of it says so again.
    test('a psalm from its first verse is told the psalm before is not its setting', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        fake.answerTool = (_name: string, args: any) => {
            return JSON.stringify({
                bible: 'KJV',
                verses: [{ ref: args.refs, text: '(1): I waited patiently…' }],
            });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Psalm 40:1-5' },
                }),
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Psalm 39:13' },
                }),
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Hebrews 10:5-7' },
                }),
                anthropicText('Which way should the sermon go?'),
            ],
            'anthropic',
        );
        await askLlmBot(
            `I am preaching from Psalm 40:1-5 next week\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(readToolResults(sentList[1])[0].content).toContain(
            '(Psalm 40 starts at its first verse: Psalm 39 before it is ' +
                'another psalm, never its setting',
        );
        expect(readToolResults(sentList[2])[0].content).toMatch(
            /^\(Psalm 39 is another psalm, not the setting of Psalm 40/,
        );
        expect(readToolResults(sentList[3])[0].content).not.toContain(
            'another psalm',
        );
    });

    // BN-100 (2026-11-11): a passage starting a chapter had the chapter
    // before read whole with it, cut from its END by the shared budget, and
    // a lesson on Luke 15 told the dinner of 14:1 as what came "just
    // before". Only the chapter's last ten verses are kept now.
    test("a passage starting a chapter reads that chapter's last verses", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        const chapter14 = Array.from({ length: 35 }, (_, index) => {
            return `(${index + 1}): Verse ${index + 1} of Luke 14.`;
        }).join(' ');
        fake.answerTool = (_name: string, args: any) => {
            return JSON.stringify({
                bible: 'KJV',
                verses: [
                    args.refs === 'Luke 14'
                        ? {
                              key: 'LUK 14:1-35',
                              ref: 'Luke 14:1-35',
                              text: chapter14,
                          }
                        : {
                              key: 'LUK 15:1-7',
                              ref: 'Luke 15:1-7',
                              text: '(1): Then drew near…',
                          },
                ],
            });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Luke 15:1-7' },
                }),
                anthropicText('Which way should the lesson go?'),
            ],
            'anthropic',
        );
        await askLlmBot(
            `a sermon on the lost sheep\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(fake.toolCallList.map((call) => call.args.refs)).toEqual([
            'Luke 15:1-7',
            'Luke 14',
        ]);
        const read = readToolResults(sentList[1])[0].content;
        expect(read).toMatch(
            /^\(The window also read Luke 14:26-35, the verses/,
        );
        expect(read).toContain('"key":"LUK 14:26-35"');
        expect(read).toContain('(26): Verse 26 of Luke 14.');
        expect(read).not.toContain('(25): Verse 25');
    });

    // BN-105 (2026-11-11): asked for Proverbs 3:5-6, the model read
    // Proverbs 3 whole, Proverbs 2's last verses were read as "just before",
    // and the lesson told the strange woman of 2:16 as its background.
    test('the verses before are read before the passage they named', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        fake.answerTool = (_name: string, args: any) => {
            return JSON.stringify({
                bible: 'KJV',
                verses: [
                    {
                        key:
                            args.refs === 'Proverbs 3'
                                ? 'PRO 3:1-35'
                                : 'PRO 3:1-4',
                        ref: args.refs,
                        text: '(1): My son, forget not my law…',
                    },
                ],
            });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Proverbs 3' },
                }),
                anthropicText('Which way should the lesson go?'),
            ],
            'anthropic',
        );
        const typed = 'Help me prepare a sermon on Proverbs 3:5-6';
        await askLlmBot(
            `${typed}\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                askedText: typed,
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(fake.toolCallList.map((call) => call.args.refs)).toEqual([
            'Proverbs 3',
            'Proverbs 3:1-4',
        ]);
        expect(readToolResults(sentList[1])[0].content).toMatch(
            /^\(The window also read Proverbs 3:1-4, the verses just before Proverbs 3:5-6, for the Background/,
        );
    });

    // BN-140 (2026-11-11, shape28): a children's Jonah read the whole book,
    // was sent back for its memory verse, searched for a shorter one, and
    // ran out of eight rounds with no lesson written. A new lesson has
    // twelve.
    test('a new lesson still goes in after nine reads', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        fake.answerTool = (name: string) => {
            return name === 'owa_find_verse'
                ? JSON.stringify({
                      bible: 'KJV',
                      verses: [
                          {
                              ref: 'Jonah 2:9',
                              text: 'Salvation is of the LORD.',
                          },
                      ],
                  })
                : JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const reads = Array.from({ length: 9 }, () => {
            return anthropicToolUse({
                name: 'owa_find_verse',
                input: { words: 'mercy' },
            });
        });
        useAnthropic(
            [
                ...reads,
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [{ block: 1, text: '## Big idea' }],
                    },
                }),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            `a sermon on Jonah\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(
            fake.toolCallList.some((call) => {
                return call.args?.action === 'edit';
            }),
        ).toBe(true);
    });

    // BN-133 (2026-11-11, the user: _I asked to translate the whole content
    // into Khmer then bible of translated should into khmer bible_): the
    // edit that puts a note into another language has its verses read from
    // a Bible in it; with none installed, the answer is told so. Made-up
    // codes: the language's own cases are in its package's tests.
    test("a note put into another language reads that language's Bible", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        const ask = async (bibles: { key: string; locale: string }[]) => {
            fake.toolCallList = [];
            fake.answerTool = (name: string, args: any) => {
                if (name === 'owa_find_verse') {
                    return JSON.stringify({ bible: 'KJV', bibles });
                }
                if (args?.action === 'read') {
                    return JSON.stringify({
                        name: 'Lesson',
                        hash: 'h',
                        blocks: [
                            {
                                n: 1,
                                kind: 'passage',
                                text: '(KJV) John 3:16 — (16): For God so loved',
                            },
                            {
                                n: 2,
                                kind: 'paragraph',
                                text: 'Love [^(KJV) John 3:16] given.',
                            },
                        ],
                    });
                }
                return JSON.stringify({ name: 'Lesson', isChanged: true });
            };
            const { sentList } = useAnthropic(
                [
                    anthropicToolUse({
                        name: 'owa_note_edit',
                        input: {
                            action: 'edit',
                            note: 'Lesson',
                            changes: [
                                {
                                    block: 2,
                                    text: 'Xish love [^(KJV) John 3:16] .',
                                },
                            ],
                        },
                    }),
                    anthropicText('It is in Khmer now.'),
                ],
                'anthropic',
            );
            await askLlmBot(
                'Replace the words with Xish',
                'bibleNote',
                'anthropic',
                'claude-sonnet-5',
                [],
                null,
                {
                    note: {
                        files: [
                            {
                                name: 'Lesson',
                                filePath: 'C:\\notes\\Default.own',
                                noteId: 4,
                            },
                        ],
                        translate: { code: 'xx', name: 'Xish' },
                    },
                },
            );
            return sentList;
        };
        await ask([
            { key: 'KJV', locale: 'en' },
            { key: 'XXB', locale: 'xx-YY' },
        ]);
        const edit = fake.toolCallList.find((call) => {
            return call.args?.action === 'edit';
        });
        expect(edit?.args.bible).toBe('XXB');
        expect(edit?.args.changes).toEqual([
            { block: 2, text: 'Xish love [^(XXB) John 3:16] .' },
            { block: 1, ref: '(XXB) John 3:16' },
        ]);
        // No Xish Bible: the words go in as written, and it is said.
        const sentList = await ask([{ key: 'KJV', locale: 'en' }]);
        expect(
            fake.toolCallList.find((call) => call.args?.action === 'edit')?.args
                .changes,
        ).toEqual([{ block: 2, text: 'Xish love [^(KJV) John 3:16] .' }]);
        expect(readToolResults(sentList[1])[0].content).toContain(
            'No Xish Bible is installed here',
        );
    });

    // BN-137 (2026-11-11, the BN-130..132 read, both readers): a lesson on
    // Philippians 4 quoted Philippians 2:7 as "emptied himself" -- a modern
    // translation's words, in a note whose verses are the KJV's.
    test("a verse quoted in a modern wording reaches the note in the KJV's", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.answerTool = (_name: string, args: any) => {
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h',
                    blocks: [
                        {
                            n: 1,
                            kind: 'passage',
                            text: '(KJV) Philippians 4:13 — (13): I can do all things through Christ which strengtheneth me.',
                        },
                        { n: 2, kind: 'paragraph', text: 'Christ.' },
                    ],
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: { action: 'read', note: 'Lesson' },
                }),
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [
                            {
                                block: 2,
                                text: 'Jesus "emptied himself" and took the form of a servant.',
                            },
                        ],
                    },
                }),
                anthropicText('Done.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'say more about Christ',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                },
            },
        );
        const edit = fake.toolCallList.find((call) => {
            return call.args?.action === 'edit';
        });
        expect(edit?.args.changes).toEqual([
            {
                block: 2,
                text: 'Jesus "made himself of no reputation" and took the form of a servant.',
            },
        ]);
        expect(readToolResults(sentList[2])[0].content).toContain(
            '"emptied himself" -> "made himself of no reputation" ' +
                '(Philippians 2:7)',
        );
    });

    // BN-142 (2026-11-11, the blind reads ab27, ab28): "the stone found the
    // only gap in the giant's armour" -- the change is made, and the line
    // named under it for one more edit.
    test("a sermon's detail no verse gives is named under the change", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.answerTool = (_name: string, args: any) => {
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h',
                    blocks: [
                        {
                            n: 1,
                            kind: 'passage',
                            text: '(KJV) 1 Samuel 17:49 — (49): and the stone sunk into his forehead',
                        },
                        { n: 2, kind: 'paragraph', text: 'Goliath.' },
                    ],
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const line =
            "Goliath fell, for the stone found the only gap in the giant's armour.";
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: { action: 'read', note: 'Lesson' },
                }),
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [{ block: 2, text: line }],
                    },
                }),
                anthropicText('Done.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'say more about Goliath',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                },
            },
        );
        // The change goes in as written...
        expect(
            fake.toolCallList.find((call) => {
                return call.args?.action === 'edit';
            })?.args.changes,
        ).toEqual([{ block: 2, text: line }]);
        // ...and the line is named under it.
        const result = readToolResults(sentList[2])[0].content;
        expect(result).toContain(`"${line}"`);
        expect(result).toContain('sunk into his forehead');
        expect(result).toContain('Change ONLY that line with ONE more edit');
    });

    // BN-191 (ab52): the edit after a legend's note fixed other lines and
    // left the named one -- read once more, and named again, once.
    test('a named line the next edit left is named again, once', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        const line =
            "Goliath fell, for the stone found the only gap in the giant's armour.";
        let block2 = 'Goliath.';
        fake.answerTool = (_name: string, args: any) => {
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h',
                    blocks: [
                        {
                            n: 1,
                            kind: 'passage',
                            text: '(KJV) 1 Samuel 17:49 — (49): and the stone sunk into his forehead',
                        },
                        { n: 2, kind: 'paragraph', text: block2 },
                        { n: 3, kind: 'paragraph', text: 'Another line.' },
                    ],
                });
            }
            if (args?.changes?.[0]?.block === 2) {
                block2 = args.changes[0].text;
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: { action: 'read', note: 'Lesson' },
                }),
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [{ block: 2, text: line }],
                    },
                }),
                // The one more edit changes another block and leaves it.
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [{ block: 3, text: 'A better line.' }],
                    },
                }),
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [{ block: 3, text: 'Better still.' }],
                    },
                }),
                anthropicText('Done.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'say more about Goliath',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                },
            },
        );
        const second = readToolResults(sentList[3])[0].content;
        expect(second).toContain('it left a line the window named');
        expect(second).toContain(`block 2: "${line}"`);
        // Said once an ask: the edit after that is not read for it again.
        const third = readToolResults(sentList[4])[0].content;
        expect(third).not.toContain('the window named');
    });

    // BN-163 (ab35, ab36, both readers): a word of the passage, quoted, put
    // on Christ -- "He is the ultimate "river" of living water" -- named
    // under the change like a legend, the passage as the ask read it.
    test('a passage word put on Christ is named under the change', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        fake.answerTool = (name: string, args: any) => {
            if (name === 'owa_find_verse') {
                return JSON.stringify({
                    bible: 'KJV',
                    verses: [
                        {
                            key: 'PSA 46:1-11',
                            ref: 'Psalm 46:1-11',
                            text:
                                '(1): God is our refuge and strength. (4): ' +
                                'There is a river, the streams whereof shall ' +
                                'make glad the city of God.',
                        },
                    ],
                });
            }
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h',
                    blocks: [{ n: 1, kind: 'paragraph', text: 'Psalm 46.' }],
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const line = 'He is the ultimate "river" of living water.';
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Psalm 46:1-11' },
                }),
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [
                            {
                                block: 1,
                                text:
                                    '[^Psalm 46:1-11]\n## Pointing to Jesus\n' +
                                    line,
                            },
                        ],
                    },
                }),
                anthropicText('Done.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'say how Psalm 46 points to Jesus',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                },
            },
        );
        const result = readToolResults(sentList[2])[0].content;
        expect(result).toContain(`"${line}"`);
        expect(result).toContain('"river" is the passage\'s own word');
        expect(result).toContain('Change ONLY that line with ONE more edit');
    });

    // shape38's L-07, as the model wrote it: an empty note, the passage a
    // change of its own kind, the lesson one section of mark-up.
    test('a passage word put on Christ in a lesson written whole', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        fake.answerTool = (name: string, args: any) => {
            if (name === 'owa_find_verse') {
                return JSON.stringify({
                    bible: 'KJV',
                    verses: [
                        {
                            key: 'MAT 18:21-35',
                            ref: 'Matthew 18:21-35',
                            text:
                                '(24): And when he had begun to reckon, one ' +
                                'was brought unto him, which owed him ten ' +
                                'thousand talents.',
                        },
                    ],
                });
            }
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h',
                    blocks: [{ n: 1, kind: 'paragraph', text: '' }],
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const line =
            'This points us to Jesus, who took the "ten thousand talents" of ' +
            'our sin upon himself.';
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Matthew 18:21-35' },
                }),
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        changes: [
                            {
                                after: 0,
                                kind: 'passage',
                                ref: 'Matthew 18:21-35',
                            },
                            {
                                after: 1,
                                kind: 'section',
                                text:
                                    '## Big idea\nForgive as you are ' +
                                    'forgiven.\n\n## Pointing to Jesus\nThe ' +
                                    'big idea is found in the phrase "forgave ' +
                                    `thee all that debt." ${line}`,
                            },
                        ],
                    },
                }),
                anthropicText('Done.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'Help me prepare a preaching lesson',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        const result = readToolResults(sentList[2])[0].content;
        expect(result).toContain('"ten thousand talents" is the passage');
    });

    // BN-154 (2026-11-11, ab31): "Jesus tells His followers that whoever
    // abides in Him will find rest [^Matthew 11:28]" -- a verse of another
    // book told in the model's own words. The window reads it and names the
    // line by its block with the verse's own words.
    test('a verse told without its words in Pointing to Jesus is named', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        const line =
            'In the Gospels, Jesus tells His followers that whoever abides ' +
            'in Him will find rest [^Matthew 11:28].';
        fake.answerTool = (name: string, args: any) => {
            if (name === 'owa_find_verse') {
                return JSON.stringify({
                    bible: 'KJV',
                    verses:
                        args.refs === 'Matthew 11:28'
                            ? [
                                  {
                                      key: 'MAT 11:28',
                                      ref: 'Matthew 11:28',
                                      text:
                                          '(28): Come unto me, all ye that ' +
                                          'labour and are heavy laden, and I ' +
                                          'will give you rest.',
                                  },
                              ]
                            : [],
                });
            }
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h2',
                    blocks: [
                        { n: 8, kind: 'h2', text: 'Pointing to Jesus' },
                        { n: 9, kind: 'paragraph', text: line },
                    ],
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const blank = toNoteDocumentText({
            blockCount: 1,
            hash: 'h',
            blocks: [{ n: 1, kind: 'paragraph', text: '' }],
        });
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [
                            { block: 1, remove: true },
                            {
                                after: 0,
                                kind: 'section',
                                text:
                                    '[^Psalm 46:1-3]\n## Big idea\nGod is our ' +
                                    'refuge.\n## 1. Our refuge\n[^Psalm 46:1]\n' +
                                    '## 2. We will not fear\n[^Psalm 46:2-3]\n' +
                                    `## Pointing to Jesus\n${line}`,
                            },
                        ],
                    },
                }),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            toNoteAsk('help me prepare a sermon on Psalm 46', [
                { name: 'Lesson', text: blank },
            ]),
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                askedText: 'help me prepare a sermon on Psalm 46',
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        const result = readToolResults(sentList[1])[0].content;
        expect(result).toContain(`block 9: "${line}"`);
        expect(result).toContain(
            'Matthew 11:28 reads: "Come unto me, all ye that labour and are ' +
                'heavy laden, and I will give you rest."',
        );
        expect(result).toContain('{block: 9, text:');
        // The passage, read by the window (BN-274: the model read none);
        // then the note and the verse, each read once after the change.
        expect(
            fake.toolCallList.map((call) => {
                return [call.name, call.args?.action ?? call.args?.refs];
            }),
        ).toEqual([
            ['owa_find_verse', 'Psalm 46:1-3'],
            ['owa_note_edit', 'edit'],
            ['owa_note_edit', 'read'],
            ['owa_find_verse', 'Matthew 11:28'],
        ]);
    });

    // BN-153 (2026-11-11, shape32): a lesson written whole, then the rounds
    // run out on the one more edit a note asked for -- the answer had read
    // "could not settle on an answer" over the lesson's own Undo button.
    test('a note changed and then out of rounds says it was changed', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.answerTool = (_name: string, args: any) => {
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h',
                    blocks: [],
                });
            }
            return JSON.stringify({
                name: 'Lesson',
                isChanged: true,
                undoId: 'u1',
            });
        };
        const read = () => {
            return anthropicToolUse({
                name: 'owa_note_edit',
                input: { action: 'read', note: 'Lesson' },
            });
        };
        useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [{ block: 1, text: 'Grace.' }],
                    },
                }),
                ...Array.from({ length: 12 }, read),
            ],
            'anthropic',
        );
        const answer = await askLlmBot(
            'make the first line say Grace',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                },
            },
        );
        expect(answer.text).toContain(
            '“Lesson” was changed, but the assistant stopped before saying ' +
                'what it did.',
        );
        expect(answer.text).not.toContain('could not settle');
    });

    // BN-157 (2026-11-12, ab32, Opus: 23 -> 18): a legend in a story block
    // a dozen sentences long was fixed by sending the block back as that
    // one sentence. The note quotes the block; a fix that leaves it little
    // but the line is refused once; the whole block goes in.
    test('a line fixed inside a longer block keeps the block', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        const story =
            'God told Jonah to go to Nineveh and tell them to stop doing bad ' +
            'things. Jonah did not want to go. He tried to run away on a ' +
            'ship to Tarshish. But God sent a great storm, and a huge fish ' +
            'swallowed Jonah for three days.';
        const fixed = story.replace(
            'tell them to stop doing bad things',
            'say that the city would be overthrown in forty days',
        );
        fake.answerTool = (_name: string, args: any) => {
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h',
                    blocks: [
                        { n: 8, kind: 'h2', text: 'The Story of Jonah' },
                        { n: 9, kind: 'paragraph', text: story },
                    ],
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const edit = (text: string) => {
            return anthropicToolUse({
                name: 'owa_note_edit',
                input: {
                    action: 'edit',
                    note: 'Lesson',
                    changes: [{ block: 9, text }],
                },
            });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: { action: 'read', note: 'Lesson' },
                }),
                edit(story),
                edit(
                    'God told Jonah to go to Nineveh and say that the city ' +
                        'would be overthrown in forty days.',
                ),
                edit(fixed),
                anthropicText('Done.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'write the story of Jonah for the children',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                },
            },
        );
        // The legend is named by its block, the block quoted whole.
        const noted = readToolResults(sentList[2])[0].content;
        expect(noted).toContain('block 9: "God told Jonah');
        expect(noted).toContain(
            `Block 9 holds more than that line; it reads now: "${story}"`,
        );
        // The line alone is refused, with the block...
        const refused = readToolResults(sentList[3])[0].content;
        expect(refused).toContain(
            'Tool refused: Nothing was changed: block 9 holds more than the ' +
                'line to fix',
        );
        // ...and the whole block goes in: the line alone never reached the
        // note.
        const editList = fake.toolCallList
            .filter((call) => {
                return call.args?.action === 'edit';
            })
            .map((call) => {
                return call.args.changes[0].text;
            });
        expect(editList).toEqual([story, fixed]);
    });

    // BN-150 (2026-11-11, ab30): "A woman sits in a hospital waiting room"
    // in six lessons of 32, stock to both blind readers. A NEW lesson's
    // hospital example is named under it for one more edit; a funeral
    // message keeps its scene.
    test('a new lesson set in a hospital is named for one more edit', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        // BN-152 (shape31's L-11): the window reads the note once the change
        // is made and names the block the example is in -- told only its
        // words, the model wrote its new scene over the line above it.
        fake.answerTool = (_name: string, args: any) => {
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h2',
                    blocks: [
                        {
                            n: 6,
                            kind: 'paragraph',
                            text: '**What it means:** God is near when trouble comes.',
                        },
                        {
                            n: 7,
                            kind: 'paragraph',
                            text:
                                '**For example:** A woman sits in a hospital ' +
                                'waiting room, her hands shaking. She prays.',
                        },
                    ],
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const lesson =
            '[^Psalm 46:1-3]\n## Big idea\nGod is our refuge, so we need ' +
            'not fear.\n## 1. Our refuge\n[^Psalm 46:1]\n**What it means:** ' +
            'God is near when trouble comes.\n**For example:** A woman sits ' +
            'in a hospital waiting room, her hands shaking. She prays.\n' +
            '## 2. We will not fear\n[^Psalm 46:2-3]\n**What it means:** ' +
            'Though the earth be removed, we will not fear.';
        const blank = toNoteDocumentText({
            blockCount: 1,
            hash: 'h',
            blocks: [{ n: 1, kind: 'paragraph', text: '' }],
        });
        const ask = async (asked: string) => {
            const { sentList } = useAnthropic(
                [
                    anthropicToolUse({
                        name: 'owa_note_edit',
                        input: {
                            action: 'edit',
                            note: 'Lesson',
                            changes: [
                                { block: 1, remove: true },
                                { after: 0, kind: 'section', text: lesson },
                            ],
                        },
                    }),
                    anthropicText('Your lesson is in the note.'),
                ],
                'anthropic',
            );
            await askLlmBot(
                toNoteAsk(asked, [{ name: 'Lesson', text: blank }]),
                'bibleNote',
                'anthropic',
                'claude-sonnet-5',
                [],
                null,
                {
                    askedText: asked,
                    note: {
                        files: [
                            {
                                name: 'Lesson',
                                filePath: 'C:\\notes\\Default.own',
                                noteId: 4,
                            },
                        ],
                        blankBlockCount: 1,
                    },
                },
            );
            return readToolResults(sentList[1])[0].content;
        };
        const result = await ask('help me prepare a sermon on Psalm 46');
        expect(result).toContain('"isChanged":true');
        expect(result).toContain(
            'block 7: "A woman sits in a hospital waiting room, her hands ' +
                'shaking."',
        );
        expect(result).toContain('With ONE more edit, change ONLY block 7');
        // The passage read by the window (BN-274: the model read none),
        // and the note once, after the change.
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual([undefined, 'edit', 'read']);
        // A funeral message keeps its scene.
        expect(
            await ask('a message of hope for a funeral on Psalm 46'),
        ).not.toContain('hospital');
    });

    // BN-129 (2026-11-11): told twenty words twice, a children's lesson on
    // the lost sheep kept Luke 15:7 (28 words) as its memory verse. The
    // window reads the verse and names it -- twice an ask (BN-132: said
    // once, the model swapped it for 1 John 4:16's 29); a sermon's is not
    // read. BN-143 (shape29): sent back whole, a Lost Sheep lesson searched
    // for a shorter verse until its rounds ran out with nothing written --
    // the lesson goes in now, the line named under it for one more edit.
    test("a child's memory verse too long to say is named under the lesson", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        const verseMap: Record<string, string> = {
            '1 John 4:16':
                '(16): And we have known and believed the love that God ' +
                'hath to us. God is love; and he that dwelleth in love ' +
                'dwelleth in God, and God in him.',
            'Nehemiah 9:31':
                "(31): Nevertheless for thy great mercies' sake thou didst " +
                'not utterly consume them, nor forsake them; for thou art a ' +
                'gracious and merciful God.',
            'Psalm 103:8':
                '(8): The LORD is merciful and gracious, slow to anger, and ' +
                'plenteous in mercy.',
        };
        fake.answerTool = (name: string, args: any) => {
            if (name !== 'owa_find_verse') {
                return JSON.stringify({ name: 'Lesson', isChanged: true });
            }
            return JSON.stringify({
                bible: 'KJV',
                verses: [{ ref: args.refs, text: verseMap[args.refs] }],
            });
        };
        const edit = (memoryRef: string) => {
            return anthropicToolUse({
                name: 'owa_note_edit',
                input: {
                    action: 'edit',
                    note: 'Lesson',
                    changes: [
                        { block: 1, remove: true },
                        {
                            after: 0,
                            kind: 'section',
                            text:
                                '[^Luke 15:4-7]\n## Big idea\nGod looks for ' +
                                'the lost.\n## 1. God looks\n[^Luke 15:4]\n' +
                                '## 2. God rejoices\n[^Luke 15:5-7]\n' +
                                '## Something to show\nA toy sheep.\n' +
                                `## Memory verse\n[^${memoryRef}]`,
                        },
                    ],
                },
            });
        };
        // The question as the window builds it for the passage pressed
        // under the children's card (the shape26 run's miss): the tab's
        // form, the empty note, the answer to its "which passage?".
        const blank = toNoteDocumentText({
            blockCount: 1,
            hash: 'h',
            blocks: [{ n: 1, kind: 'paragraph', text: '' }],
        });
        const ask = async (
            lessonForm: 'children' | null,
            memoryRefList: string[],
        ) => {
            const { sentList } = useAnthropic(
                [
                    ...memoryRefList.map(edit),
                    anthropicText('Your lesson is in the note.'),
                ],
                'anthropic',
            );
            await askLlmBot(
                toNoteAsk(
                    'The Parable of the Lost Sheep (Luke 15:1-7)',
                    [{ name: 'Lesson', text: blank }],
                    null,
                    false,
                    null,
                    null,
                    true,
                    null,
                    lessonForm,
                ),
                'bibleNote',
                'anthropic',
                'claude-sonnet-5',
                [],
                null,
                {
                    note: {
                        files: [
                            {
                                name: 'Lesson',
                                filePath: 'C:\\notes\\Default.own',
                                noteId: 4,
                            },
                        ],
                        blankBlockCount: 1,
                    },
                },
            );
            return sentList;
        };
        const sentList = await ask('children', ['1 John 4:16', 'Psalm 103:8']);
        expect(readToolResults(sentList[1])[0].content).toContain(
            'The lesson is in, but its memory verse, 1 John 4:16, runs 29 ' +
                'words: a child cannot say it.',
        );
        // The edit that changes the line goes in as it is: the note is a
        // lesson now, no longer an empty one.
        expect(readToolResults(sentList[2])[0].content).not.toContain(
            'memory verse',
        );
        expect(
            fake.toolCallList.map((call) => [call.name, call.args?.refs]),
        ).toEqual([
            ['owa_find_verse', '1 John 4:16'],
            // The passage, read by the window (BN-274: the model read none).
            ['owa_find_verse', 'Luke 15:4-7'],
            ['owa_note_edit', undefined],
            // The note read once the lesson is in, for the memory verse's
            // block (BN-175).
            ['owa_note_edit', undefined],
            ['owa_note_edit', undefined],
        ]);
        // A sermon's memory verse is not read, nor sent back: both of its
        // edits go in -- its passage read by the window first (BN-274).
        fake.toolCallList = [];
        const sermonSentList = await ask(null, ['1 John 4:16', 'Psalm 103:8']);
        expect(fake.toolCallList.map((call) => call.name)).toEqual([
            'owa_find_verse',
            'owa_note_edit',
            'owa_note_edit',
        ]);
        expect(readToolResults(sermonSentList[1])[0].content).not.toContain(
            'Tool refused',
        );
    });

    // BN-208 (shape62): a children's Jonah's memory verse named, the model
    // swapped in Jonah 4:2 -- sixty words -- as a block's `ref`, with no
    // Memory verse heading in the change, and it went in unread.
    test("a child's memory verse swapped by ref for a long one is named again", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        const verseMap: Record<string, string> = {
            '1 John 4:16':
                '(16): And we have known and believed the love that God ' +
                'hath to us. God is love; and he that dwelleth in love ' +
                'dwelleth in God, and God in him.',
            'Nehemiah 9:31':
                "(31): Nevertheless for thy great mercies' sake thou didst " +
                'not utterly consume them, nor forsake them; for thou art a ' +
                'gracious and merciful God.',
        };
        fake.answerTool = (name: string, args: any) => {
            if (name !== 'owa_find_verse') {
                return JSON.stringify({ name: 'Lesson', isChanged: true });
            }
            return JSON.stringify({
                bible: 'KJV',
                verses: [{ ref: args.refs, text: verseMap[args.refs] }],
            });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [
                            { block: 1, remove: true },
                            {
                                after: 0,
                                kind: 'section',
                                text:
                                    '[^Luke 15:4-7]\n## Big idea\nGod looks ' +
                                    'for the lost.\n## 1. God looks\n' +
                                    '[^Luke 15:4]\n## 2. God rejoices\n' +
                                    '[^Luke 15:5-7]\n## Something to show\n' +
                                    'A toy sheep.\n## Memory verse\n' +
                                    '[^1 John 4:16]',
                            },
                        ],
                    },
                }),
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [{ block: 12, ref: 'Nehemiah 9:31' }],
                    },
                }),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            toNoteAsk(
                'The Parable of the Lost Sheep (Luke 15:1-7)',
                [
                    {
                        name: 'Lesson',
                        text: toNoteDocumentText({
                            blockCount: 1,
                            hash: 'h',
                            blocks: [{ n: 1, kind: 'paragraph', text: '' }],
                        }),
                    },
                ],
                null,
                false,
                null,
                null,
                true,
                null,
                'children',
            ),
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(readToolResults(sentList[1])[0].content).toContain(
            'its memory verse, 1 John 4:16, runs 29 words',
        );
        expect(readToolResults(sentList[2])[0].content).toContain(
            'its memory verse, Nehemiah 9:31, runs 23 words',
        );
    });

    // BN-83 (2026-11-11): the sower sermon's points stopped at the thorns,
    // never reaching the good ground of 13:23. A new lesson's points that
    // stop before its passage does go back once; a second try goes in.
    test('a new lesson whose points stop short is sent back once', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Lesson',
            isChanged: true,
        });
        const lesson =
            '[^Matthew 13:1-23]\n## Big idea\nHear and bear fruit.\n' +
            '## 1. The hard path\n[^Matthew 13:3-9, 19]\n' +
            '## 2. The stony places\n[^Matthew 13:20-21]\n' +
            '## 3. The thorns\n[^Matthew 13:22]\n## Memory verse\n' +
            '[^Matthew 13:23]';
        const edit = () => {
            return anthropicToolUse({
                name: 'owa_note_edit',
                input: {
                    action: 'edit',
                    note: 'Lesson',
                    changes: [
                        { block: 1, remove: true },
                        { after: 0, kind: 'section', text: lesson },
                    ],
                },
            });
        };
        const { sentList } = useAnthropic(
            [edit(), edit(), anthropicText('Your sermon is in the note.')],
            'anthropic',
        );
        await askLlmBot(
            `help me prepare a sermon on the sower\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        const refused = readToolResults(sentList[1])[0].content;
        expect(refused).toContain(
            'the passage is Matthew 13:1-23, and the points stop at ' +
                'Matthew 13:22',
        );
        expect(refused).toContain('Keep the passage as it is');
        // Once an ask: the same lesson sent again is written -- its
        // passage read by the window first (BN-274: the model read none).
        expect(fake.toolCallList.map((call) => call.name)).toEqual([
            'owa_find_verse',
            'owa_note_edit',
        ]);
    });

    // BN-213 (shape67): Proverbs 3:5 printed under points 1 and 2 of a
    // passage too short for the cover check went in unrefused.
    test('a new lesson that prints one verse for two points is sent back once', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Lesson',
            isChanged: true,
        });
        const lesson =
            '[^Proverbs 3:5-6]\n## Big idea\nTrust him.\n' +
            '## 1. Trust the LORD completely\n[^Proverbs 3:5]\n' +
            '**What it means:** Trust.\n' +
            '## 2. Reject self-reliance\n[^Proverbs 3:5]\n' +
            '**What it means:** Lean not.\n' +
            '## 3. Acknowledge him\n[^Proverbs 3:6]\n' +
            '**What it means:** Acknowledge.\n## Memory verse\n' +
            '[^Proverbs 3:5]';
        const edit = () => {
            return anthropicToolUse({
                name: 'owa_note_edit',
                input: {
                    action: 'edit',
                    note: 'Lesson',
                    changes: [
                        { block: 1, remove: true },
                        { after: 0, kind: 'section', text: lesson },
                    ],
                },
            });
        };
        const { sentList } = useAnthropic(
            [edit(), edit(), anthropicText('Your sermon is in the note.')],
            'anthropic',
        );
        await askLlmBot(
            `Help me prepare a sermon on Proverbs 3:5-6\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(readToolResults(sentList[1])[0].content).toContain(
            'point 2 prints Proverbs 3:5 again, as point 1 does',
        );
    });

    // BN-223 (F-03): a finish wrote over the preacher's own introduction.
    test('a finish that writes over their own words is sent back once', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Bartimaeus',
            isChanged: true,
        });
        const sermon = toNoteDocumentText({
            blockCount: 5,
            file: 'Default',
            hash: 'h',
            blocks: [
                { n: 1, kind: 'h2', text: 'Big idea' },
                { n: 2, kind: 'paragraph', text: 'Jesus stops for the one.' },
                { n: 3, kind: 'h2', text: 'Introduction' },
                {
                    n: 4,
                    kind: 'paragraph',
                    text: 'Have you ever been told to stop asking for help?',
                },
                { n: 5, kind: 'h2', text: '1. He cries out [^Mark 10:47]' },
            ],
        });
        const asked = toNoteAsk('finish my sermon', [
            { name: 'Bartimaeus', text: sermon },
        ]);
        const edit = (text: string) => {
            return anthropicToolUse({
                name: 'owa_note_edit',
                input: {
                    action: 'edit',
                    note: 'Bartimaeus',
                    changes: [{ block: 4, text }],
                },
            });
        };
        const { sentList } = useAnthropic(
            [
                edit('A man sits in the dust by the road.'),
                edit('A man sits in the dust by the road.'),
                anthropicText('Your sermon is finished.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            asked,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Bartimaeus',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                },
            },
        );
        expect(readToolResults(sentList[1])[0].content).toContain(
            'block 4, "Have you ever been told to stop asking for help?"',
        );
        // Once an ask: the second is let through.
        expect(readToolResults(sentList[2])[0].content).not.toContain(
            'Tool refused',
        );
    });

    // BN-227 (held-out H-07): the tool's words to the person and the note
    // still empty -- sent back once; a "which passage?" stands.
    test('a lesson ask that writes nothing and asks nothing goes back once', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        const note = {
            files: [
                {
                    name: 'Lesson',
                    filePath: 'C:\\notes\\Default.own',
                    noteId: 4,
                },
            ],
            blankBlockCount: 1,
        };
        const { sentList } = useAnthropic(
            [
                anthropicText(
                    'FileNotFound: owa_bible_note "add" is not a valid ' +
                        'action for owa_note_edit. I will use owa_note_edit ' +
                        '"edit" to replace the block 1.',
                ),
                anthropicText('Which passage would you like?'),
            ],
            'anthropic',
        );
        await askLlmBot(
            `I need to preach about prayer\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { note },
        );
        expect(JSON.stringify(sentList[1].messages)).toContain(
            'Not yet: their note is still empty',
        );
        // A reply that asks stands.
        const asked = useAnthropic(
            [anthropicText('Which passage would you like to preach on?')],
            'anthropic',
        );
        await askLlmBot(
            `I need to preach about prayer\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { note },
        );
        expect(asked.sentList).toHaveLength(1);
    });

    // BN-226 (the held-out reads): a new lesson read once more, in an ask
    // of its own, against the passage its ask read -- "Jehovahjireh refers
    // to the ram" named under the change for one more edit.
    test("a new lesson's second look names a sentence its verses do not say", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        const slip =
            '**What it means:** The name Jehovahjireh refers to the ram God ' +
            'gave in the place of Isaac.';
        fake.answerTool = (name: string, args: any) => {
            if (name === 'owa_find_verse') {
                return JSON.stringify({
                    bible: 'KJV',
                    verses: [
                        {
                            key: 'GEN 22:1-19',
                            ref: 'Genesis 22:1-19',
                            text:
                                '(13): And Abraham lifted up his eyes, and ' +
                                'looked, and behold behind him a ram (14): ' +
                                'And Abraham called the name of that place ' +
                                'Jehovahjireh',
                        },
                    ],
                });
            }
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h',
                    blocks: [
                        {
                            n: 1,
                            kind: 'passage',
                            text: '(KJV) Genesis 22:1-19 — (14): And Abraham called',
                        },
                        { n: 2, kind: 'h2', text: '1. God provides' },
                        { n: 3, kind: 'paragraph', text: slip },
                    ],
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Genesis 22:1-19' },
                }),
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [
                            { block: 1, remove: true },
                            {
                                after: 0,
                                kind: 'section',
                                text:
                                    '[^Genesis 22:1-19]\n## 1. God provides\n' +
                                    slip,
                            },
                        ],
                    },
                }),
                // The second look, in an ask of its own.
                anthropicText(
                    '[{"sentence": "The name Jehovahjireh refers to the ram ' +
                        'God gave in the place of Isaac.", "verses": ' +
                        '"Genesis 22:14: Abraham called the name of that ' +
                        'place Jehovahjireh"}]',
                ),
                anthropicText('Your sermon is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            `Help me prepare a sermon on Genesis 22\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        // The second look: its own prompt, no tools, the verses and lesson.
        const look = sentList[2];
        expect(JSON.stringify(look.system)).toContain(
            'You check a preaching lesson',
        );
        expect(look.tools ?? []).toEqual([]);
        expect(JSON.stringify(look.messages)).toContain(
            'Abraham called the name of that place Jehovahjireh',
        );
        const result = readToolResults(sentList[3])[0].content;
        expect(result).toContain('block 3:');
        expect(result).toContain('refers to the ram');
        expect(result).toContain(
            'the verses read say: Genesis 22:14: Abraham called the name of ' +
                'that place Jehovahjireh',
        );
    });

    // BN-197 (ab54, shape56): a children's lost sheep ended at its memory
    // verse -- the parts it left out named with the block each goes after.
    test("a new lesson's parts left out are named under it", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        const headingList = [
            'Big idea',
            'Background',
            'Introduction',
            '1. God looks for us',
            '2. God is happy when we return',
            'Memory verse',
        ];
        fake.answerTool = (_name: string, args: any) => {
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h',
                    blocks: headingList.flatMap((heading, index) => {
                        return [
                            { n: index * 2 + 1, kind: 'h2', text: heading },
                            {
                                n: index * 2 + 2,
                                kind: 'paragraph',
                                text: 'Words.',
                            },
                        ];
                    }),
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const lesson = headingList
            .map((heading) => {
                return `## ${heading}\nWords.`;
            })
            .join('\n');
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [
                            { block: 1, remove: true },
                            { after: 0, kind: 'section', text: lesson },
                        ],
                    },
                }),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            `help me prepare a children's lesson on the lost sheep\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        const result = readToolResults(sentList[1])[0].content;
        expect(result).toContain(
            'it lacks Pointing to Jesus; Response; Closing prayer; ' +
                'Questions for discussion',
        );
        // Before the Memory verse heading, block 11 as the note reads.
        expect(result).toContain('after block 10: Pointing to Jesus, then');
    });

    // BN-80 (2026-11-10): a fix to a lesson done as fifteen blocks moved
    // broke its shape. In a fix, a move nobody asked for is refused; the
    // same fix done by adding and rewording goes in.
    test('a lesson fix that moves blocks is sent back to add instead', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'The Sower',
            isChanged: true,
        });
        const edit = (changes: any[]) => {
            return anthropicToolUse({
                name: 'owa_note_edit',
                input: { action: 'edit', note: 'The Sower', changes },
            });
        };
        const { sentList } = useAnthropic(
            [
                edit([
                    { after: 7, kind: 'h2', text: '1. Why parables' },
                    { after: 11, block: 8 },
                ]),
                edit([
                    { after: 7, kind: 'h2', text: '1. Why parables' },
                    { block: 8, text: '2. The hardened heart' },
                ]),
                anthropicText('The point is in.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            `Add a point on why Jesus uses parables\n${NOTE_LESSON_CHANGE_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'The Sower',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    typed: 'Add a point on why Jesus uses parables',
                },
            },
        );
        expect(readToolResults(sentList[1])[0].content).toContain(
            'it moves or takes out no block of it (this named block 8)',
        );
        expect(fake.toolCallList).toHaveLength(1);
        expect(fake.toolCallList[0].args.changes[1]).toEqual({
            block: 8,
            text: '2. The hardened heart',
        });
    });

    // BN-259 (ab91): the model's own edit rewrote a hearer's question and
    // left the answer written for the old one. Sent back once; the same
    // edit with its answer goes in.
    test("a hearer's question rewritten alone is sent back for its answer", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Palm Sunday',
            isChanged: true,
        });
        const question = {
            block: 11,
            text: '**A hearer asks:** What did the prophet say?',
        };
        const answer = {
            block: 12,
            text: '**The passage answers:** "Behold, thy King cometh".',
        };
        const edit = (changes: any[]) => {
            return anthropicToolUse({
                name: 'owa_note_edit',
                input: { action: 'edit', note: 'Palm Sunday', changes },
            });
        };
        const { sentList } = useAnthropic(
            [
                edit([question]),
                edit([question, answer]),
                anthropicText('The question and its answer are in.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'Make the questions better',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Palm Sunday',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    typed: 'Make the questions better',
                },
            },
        );
        expect(readToolResults(sentList[1])[0].content).toContain(
            "block 11 is a hearer's question",
        );
        expect(fake.toolCallList).toHaveLength(1);
        expect(fake.toolCallList[0].args.changes).toEqual([question, answer]);
    });

    // BN-265 (batch NG N-08): read, then the hearer's question rewritten as
    // a bare line -- its label kept, and sent back for its answer.
    test("a hearer's question rewritten bare keeps its label", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        const READ = JSON.stringify({
            name: 'Palm Sunday',
            blocks: [
                { n: 25, kind: 'paragraph', text: '**A hearer asks:** Why?' },
                {
                    n: 26,
                    kind: 'paragraph',
                    text: '**The passage answers:** "a house of prayer"',
                },
            ],
        });
        // Every call reads back the note; a refused edit never reaches it.
        fake.toolResultMap.owa_note_edit = READ;
        const call = (input: any) => {
            return anthropicToolUse({ name: 'owa_note_edit', input });
        };
        const bare = { block: 25, text: 'Why did Jesus overthrow the tables?' };
        const answer = {
            block: 26,
            text: '**The passage answers:** to make it "a house of prayer"',
        };
        const { sentList } = useAnthropic(
            [
                call({ action: 'read', note: 'Palm Sunday' }),
                call({ action: 'edit', note: 'Palm Sunday', changes: [bare] }),
                call({
                    action: 'edit',
                    note: 'Palm Sunday',
                    changes: [bare, answer],
                }),
                anthropicText('Both are in.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            `Make the questions better\n${NOTE_LESSON_CHANGE_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Palm Sunday',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    typed: 'Make the questions better',
                },
            },
        );
        expect(readToolResults(sentList[2])[0].content).toContain(
            "block 25 is a hearer's question",
        );
        const sent = fake.toolCallList.filter((one: any) => {
            return one.args?.action === 'edit';
        });
        expect(sent).toHaveLength(1);
        expect(sent[0].args.changes).toEqual([
            {
                block: 25,
                text: '**A hearer asks:** Why did Jesus overthrow the tables?',
            },
            answer,
        ]);
    });

    // BN-280 (batch PE's Esther): after the window read the note under a
    // new lesson, the model's next edit wrote a statement over each hearer's
    // question. Sent back once with the question; asked again, it goes in.
    test("a statement over a hearer's question goes back once", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.answerTool = (_name: string, args: any) => {
            if (args?.action === 'read') {
                return JSON.stringify({
                    name: 'Lesson',
                    hash: 'h2',
                    blocks: [
                        {
                            n: 6,
                            kind: 'paragraph',
                            text: '**A hearer asks:** Why was Esther afraid?',
                        },
                        {
                            n: 7,
                            kind: 'paragraph',
                            text:
                                '**For example:** A woman sits in a hospital ' +
                                'waiting room, her hands shaking.',
                        },
                    ],
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const lesson =
            '[^Esther 4:10-12]\n## Big idea\nGod places us where we are for ' +
            'His purpose.\n## 1. The risk of the law\n[^Esther 4:10-12]\n' +
            '**A hearer asks:** Why was Esther afraid?\n**For example:** A ' +
            'woman sits in a hospital waiting room, her hands shaking.';
        const blank = toNoteDocumentText({
            blockCount: 1,
            hash: 'h',
            blocks: [{ n: 1, kind: 'paragraph', text: '' }],
        });
        // A new question goes with its answer (BN-259), the block under it.
        const edit = (text: string, answer?: string) => {
            return anthropicToolUse({
                name: 'owa_note_edit',
                input: {
                    action: 'edit',
                    note: 'Lesson',
                    changes: [
                        { block: 6, text },
                        ...(answer === undefined
                            ? []
                            : [{ block: 7, text: answer }]),
                    ],
                },
            });
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Lesson',
                        changes: [
                            { block: 1, remove: true },
                            { after: 0, kind: 'section', text: lesson },
                        ],
                    },
                }),
                edit('The verses say that Esther had not been called.'),
                edit(
                    'What did the law say of going in uncalled?',
                    '**The passage answers:** only one the king held the ' +
                        'golden sceptre out to would live.',
                ),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );
        const asked = 'a sermon on Esther 4:10-12';
        await askLlmBot(
            toNoteAsk(asked, [{ name: 'Lesson', text: blank }]),
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                askedText: asked,
                note: {
                    files: [
                        {
                            name: 'Lesson',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(readToolResults(sentList[2])[0].content).toContain(
            "Tool refused: Nothing was changed: block 6 is a hearer's question",
        );
        const edits = fake.toolCallList.filter((one: any) => {
            return (
                one.args?.action === 'edit' &&
                one.args.changes?.[0]?.block === 6
            );
        });
        expect(edits).toHaveLength(1);
        expect(edits[0].args.changes[0].text).toBe(
            '**A hearer asks:** What did the law say of going in uncalled?',
        );
    });

    // BN-263 (batch NF N-08): a lesson's own edit wrote its labels plain;
    // in a lesson ask they reach the note in bold.
    test("a lesson edit's plain labels go in bold", async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Palm Sunday',
            isChanged: true,
        });
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        note: 'Palm Sunday',
                        changes: [
                            {
                                block: 11,
                                text: 'A hearer asks: Why a colt?',
                            },
                            {
                                block: 12,
                                text: 'The passage answers: "that it might be fulfilled"',
                            },
                        ],
                    },
                }),
                anthropicText('Both are in.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            `Make the questions better\n${NOTE_LESSON_CHANGE_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Palm Sunday',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    typed: 'Make the questions better',
                },
            },
        );
        expect(sentList).toHaveLength(2);
        expect(fake.toolCallList).toHaveLength(1);
        expect(
            fake.toolCallList[0].args.changes.map((change: any) => change.text),
        ).toEqual([
            '**A hearer asks:** Why a colt?',
            '**The passage answers:** "that it might be fulfilled"',
        ]);
    });

    // BN-77: asked once more and still no OPTIONS, the review's own fixes
    // -- each item opening on a change to make -- are its buttons.
    test('a review that names its fixes and offers none has them as buttons', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        const REVIEW =
            'A strong sermon.\n\n1. **Deepen the explanation of verse 3:** ' +
            'the crowd is more than people.\n2. **Strengthen the response:** ' +
            'it repeats the big idea.';
        useAnthropic(
            [anthropicText(REVIEW), anthropicText(REVIEW)],
            'anthropic',
        );
        const answer = await askLlmBot(
            `is this a good sermon?\n${NOTE_LESSON_REVIEW_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Zacchaeus',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                },
            },
        );
        expect(answer.replies).toEqual([
            'Deepen the explanation of verse 3',
            'Strengthen the response',
        ]);
    });

    // BN-67 (2026-11-10): loose lines finished as a lesson go in by the
    // flat add, in their place -- only with every line of theirs in it.
    test('loose lines are made a lesson in their place, none left out', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_bible_note' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Storm',
            isChanged: true,
        });
        const add = (text: string) => {
            return anthropicToolUse({
                name: 'owa_bible_note',
                input: { action: 'add', title: 'Storm', text },
            });
        };
        const { sentList } = useAnthropic(
            [
                add('[^Mark 4:35-41]\n## 1. Jesus asleep in the boat'),
                add(
                    '[^Mark 4:35-41]\n## Introduction\nThe storm.\n' +
                        '## 1. Jesus asleep in the boat\n## 2. Peace be still',
                ),
                anthropicText('Your lesson is in the note.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'finish my sermon',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Storm',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    rewrite: {
                        lines: [
                            'mark 4 storm',
                            'jesus asleep in the boat',
                            'peace be still',
                        ],
                        lineBlocks: [1, 2, 3],
                        blockCount: 3,
                    },
                },
            },
        );
        // The first left two lines out (the storm too: a verse token's
        // words count, its story's do not): refused, nothing changed.
        expect(readToolResults(sentList[1])[0].content).toContain(
            'Nothing was changed: these lines of theirs are not in the ' +
                'lesson -- "mark 4 storm"; "peace be still".',
        );
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_note_edit',
                args: expect.objectContaining({
                    action: 'edit',
                    changes: [
                        { block: 1, remove: true },
                        { block: 2, remove: true },
                        { block: 3, remove: true },
                        expect.objectContaining({ after: 0, kind: 'section' }),
                    ],
                }),
            },
        ]);
    });

    test('changes sent with no action are an edit', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Sermon',
            isChanged: true,
            undoId: 'u-2',
            summary: 'block 12: bold',
        });
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        note: 'Sermon',
                        changes: [{ block: 12, styles: ['bold'] }],
                    },
                }),
                anthropicText(
                    "I've made the headings bold. Undo this change puts it back.",
                ),
            ],
            'anthropic',
        );
        const answer = await askLlmBot(
            'make the point headings bold',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 8,
                        },
                    ],
                },
            },
        );
        expect(fake.toolCallList[0]).toMatchObject({
            name: 'owa_note_edit',
            args: { action: 'edit', id: 8 },
        });
        // Counted as the change it was: no "claimed a change" round, and
        // the press that puts it back is under the answer.
        expect(sentList).toHaveLength(2);
        expect(answer.actions).toEqual([
            expect.objectContaining({ label: 'Undo this change' }),
        ]);
    });

    // BN-203 (shape60): the changes sent under the action's own name, and
    // refused by the tool's schema -- the lesson's named line was left.
    test('changes sent as `edit` with no action are an edit', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Sermon',
            isChanged: true,
            undoId: 'u-3',
            summary: 'block 13: text',
        });
        useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: {
                        note: 'Sermon',
                        edit: [{ block: 13, text: 'For example: a farmer.' }],
                    },
                }),
                anthropicText('I changed the example.'),
            ],
            'anthropic',
        );
        await askLlmBot(
            'change the example in point 1',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 8,
                        },
                    ],
                },
            },
        );
        expect(fake.toolCallList[0]).toMatchObject({
            name: 'owa_note_edit',
            args: {
                action: 'edit',
                id: 8,
                changes: [{ block: 13, text: 'For example: a farmer.' }],
            },
        });
        expect(fake.toolCallList[0].args).not.toHaveProperty('edit');
    });

    // BN-26 (2026-11-08, seen live): asked in another language under a
    // note in it, "add John 1:1 under the first line" read the verse from
    // the KJV the Lookup was on, a Bible in that language installed.
    test('a new verse in a note asked in another language comes from a Bible in it', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        fake.toolResultMap.owa_find_verse = JSON.stringify({
            bible: 'KJV',
            bibles: [
                { key: 'KJV', locale: 'en-US' },
                { key: 'XXB', locale: 'xx-XX' },
            ],
        });
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            isChanged: true,
            summary: 'ok',
        });
        const passage = { after: 1, kind: 'passage', ref: 'John 1:1' };
        useAnthropic(
            [
                anthropicToolUse(
                    {
                        name: 'owa_note_edit',
                        input: { action: 'edit', changes: [passage] },
                    },
                    {
                        name: 'owa_note_edit',
                        input: {
                            action: 'edit',
                            changes: [
                                { block: 2, words: 'love', color: 'red' },
                            ],
                        },
                    },
                    {
                        name: 'owa_note_edit',
                        input: {
                            action: 'edit',
                            bible: 'NIV',
                            changes: [passage],
                        },
                    },
                ),
                anthropicText('Done.'),
            ],
            'anthropic',
        );
        const file = {
            name: 'Grace',
            filePath: 'C:\\notes\\Default.own',
            noteId: 3,
        };

        await askLlmBot(
            'Put John 1:1 under the first line',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { note: { files: [file], verseLang: 'xx' } },
        );

        const target = { file: file.filePath, id: 3, note: 'Grace' };
        expect(fake.toolCallList).toEqual([
            // Looked up once, at the first edit that adds a verse.
            { name: 'owa_find_verse', args: {} },
            {
                name: 'owa_note_edit',
                args: {
                    action: 'edit',
                    changes: [passage],
                    ...target,
                    bible: 'XXB',
                },
            },
            // No verse added: no Bible put in.
            {
                name: 'owa_note_edit',
                args: {
                    action: 'edit',
                    changes: [{ block: 2, words: 'love', color: 'red' }],
                    ...target,
                },
            },
            // A Bible the model named stands.
            {
                name: 'owa_note_edit',
                args: {
                    action: 'edit',
                    bible: 'NIV',
                    changes: [passage],
                    ...target,
                },
            },
        ]);
    });

    test('a new verse in a note asked in English is the Lookup’s, nothing looked up', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({ isChanged: true });
        const passage = { after: 1, kind: 'passage', ref: 'John 1:1' };
        useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_note_edit',
                    input: { action: 'edit', changes: [passage] },
                }),
                anthropicText('Done.'),
            ],
            'anthropic',
        );

        await askLlmBot(
            'Put John 1:1 under the first line',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Grace',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 3,
                        },
                    ],
                },
            },
        );

        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_note_edit',
                args: {
                    action: 'edit',
                    changes: [passage],
                    file: 'C:\\notes\\Default.own',
                    id: 3,
                    note: 'Grace',
                },
            },
        ]);
    });

    test('a failed tool is handed back to the model as words', async () => {
        fake.toolList = [
            { name: 'owa_help_search' },
            { name: 'owa_resource_file' },
        ];
        fake.answerTool = () => {
            throw new Error('the host went quiet');
        };
        fake.answerPictures = () => {
            throw new Error('the PDF could not be drawn');
        };
        const { sentList } = useAnthropic(
            [
                anthropicToolUse(
                    { name: 'owa_help_search', input: { query: 'x' } },
                    {
                        name: 'owa_resource_file',
                        input: { action: 'read', file: 'pdf/MAT.18.pdf' },
                    },
                ),
                anthropicText('I could not read it.'),
            ],
            'anthropic',
        );

        await askLlmBot(
            'What does MAT.18.pdf say?',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { resources: { canSeePictures: true } },
        );

        expect(
            readToolResults(sentList[1]).map((result: any) => {
                return result.content;
            }),
        ).toEqual([
            'Tool error: the host went quiet',
            'Tool error: the PDF could not be drawn',
        ]);
    });

    test('controls it proved are shown, a picture it asked for is asked for', async () => {
        fake.toolList = [{ name: 'owa_find_ui' }];
        fake.toolResultMap.owa_find_ui = JSON.stringify({
            shownCount: 1,
            matches: [{ tier: 0 }],
        });
        useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_ui',
                    input: { text: 'Clear All' },
                }),
                anthropicText(
                    'Press Clear All under the Mini Screen.\n' +
                        'SHOWS: Clear All | Mystery Button\n' +
                        'NEEDS: screenshot',
                ),
            ],
            'anthropic',
        );

        const answer = await askLlmBot(
            'How do I empty the screen?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        expect(answer.text).toBe('Press Clear All under the Mini Screen.');
        expect(answer.attachRequests).toEqual(['screenshot']);
        // Only the control the window was seen to have.
        expect(
            answer.shows?.map((show) => {
                return show.value;
            }),
        ).toEqual(['Clear All']);
    });

    test('a song it drafted is offered to create, one it created is shown', async () => {
        const draft = [
            'Drafted a song from the text.',
            '',
            'Valid Open Lyric. No problems found.',
            '',
            '```ol:Config',
            '- Title: Lantern On The Water',
            '- Structure: V1',
            '```',
            '',
            '```ol:Verse 1',
            'Down by the quiet harbour wall',
            '```',
        ].join('\n');
        fake.toolList = [
            { name: 'owa_lyric_validate' },
            { name: 'owa_lyric_file' },
        ];
        fake.toolResultMap.owa_lyric_validate = draft;
        fake.toolResultMap.owa_lyric_file = JSON.stringify({
            created: 'Lantern On The Water',
            filePath: 'C:\\songs\\Lantern On The Water.owl',
        });
        useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_lyric_validate',
                    input: { mode: 'draft', text: 'Down by the …' },
                }),
                anthropicText('Here is your song.'),
            ],
            'anthropic',
        );

        const drafted = await askLlmBot(
            'Make a song of these words',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        expect(drafted.actions?.[0]?.label).toBe(
            'Create "Lantern On The Water"',
        );
        expect(drafted.actions?.[1]?.label).toBe('Copy song text');
        expect(drafted.actions?.[0]?.args.reference).toBe(
            drafted.actions?.[1]?.args.reference,
        );

        useAnthropic(
            [
                anthropicToolUse(
                    {
                        name: 'owa_lyric_validate',
                        input: { mode: 'draft', text: 'Down by the …' },
                    },
                    {
                        name: 'owa_lyric_file',
                        input: {
                            action: 'create',
                            name: 'Lantern On The Water',
                        },
                    },
                ),
                anthropicText('Done! The song has been created.'),
            ],
            'anthropic',
        );

        const created = await askLlmBot(
            'Make a song of these words and save it',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        // No Create: a second press would be a second file.
        expect(created.actions).toEqual([]);
        expect(created.shows).toEqual([
            {
                kind: 'control',
                value: 'Document List > Lantern On The Water',
                name: 'Show it in the list',
            },
            {
                kind: 'file',
                value: 'C:\\songs\\Lantern On The Water.owl',
                name: 'Lantern On The Water',
            },
        ]);
    });

    test('the prompt says which window the tab works in', async () => {
        const { sentList } = useAnthropic(
            [anthropicText('Use the font slider.'), anthropicText('Open it.')],
            'anthropic',
        );

        await askLlmBot(
            'How do I change the font?',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                windowAim: {
                    windowId: 'READER-2',
                    focus: 'reader',
                    isSeparateWindow: true,
                } as any,
            },
        );
        await askLlmBot(
            'Where is the language?',
            'setting',
            'anthropic',
            'claude-sonnet-5',
        );

        expect(sentList[0].system[0].text).toContain(
            'This **Bible Reader** is a window of its own beside the main ' +
                'window',
        );
        expect(sentList[1].system[0].text).toContain(
            '`owa_click` on **Setting**',
        );
    });

    test('a Bible-Reader answer opens the verses it names in the lookup', async () => {
        fake.toolList = [{ name: 'owa_find_verse' }];
        fake.toolResultMap.owa_find_verse = JSON.stringify({
            bible: 'KJV',
            verses: [{ key: 'GEN 3:15', ref: 'Genesis 3:15' }],
        });
        const { sentList } = useAnthropic(
            [
                anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'GEN 3:15' },
                }),
                anthropicText('Genesis 3:15 speaks of the seed.'),
                anthropicText('Genesis has fifty chapters.'),
            ],
            'anthropic',
        );
        const bibleReader = {
            intent: 'reference' as const,
            canSeePictures: false,
        };

        const named = await askLlmBot(
            'genesis 3:15',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { bibleReader },
        );
        const plain = await askLlmBot(
            'how many chapters in genesis',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { bibleReader },
        );

        expect(sentList[0].system[0].text).not.toContain(
            'You are a translator',
        );
        expect(named.actions).toEqual([
            {
                label: 'Open Genesis 3:15 in Bible Lookup',
                toolName: 'owa_find_verse',
                args: { bible: 'KJV', open: 'GEN 3:15' },
            },
        ]);
        // Nothing was looked up: nothing to open, and no walkthrough.
        expect(plain.actions).toBeUndefined();
    });

    test('an answer telling them to type /btw carries the button that does it', async () => {
        useAnthropic(
            [anthropicText('That is not about this app: type /btw before it.')],
            'anthropic',
        );

        const answer = await askLlmBot(
            'how much is a kilo of bananas?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { askedText: 'how much is a kilo of bananas?' },
        );

        expect(answer.actions?.at(-1)).toEqual({
            label: GENERAL_ASK_LABEL,
            toolName: GENERAL_ASK_TOOL_NAME,
            args: { question: 'how much is a kilo of bananas?' },
        });
    });

    test('a stand-in that cannot see the picture is not handed the question', async () => {
        fake.aiSetting = LIVE_KEYS;
        setLlmModel('openai', 'gpt-3.5-turbo');
        useAnthropic([thrown(429)], 'anthropic');
        const { create: openAiCreate } = useOpenAiShaped([], 'openai');

        const raised = await askLlmBot(
            'What is wrong here?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { images: [{ mediaType: 'image/png', data: 'AAAA' }] },
        ).catch((error: any) => {
            return error;
        });

        expect(openAiCreate).not.toHaveBeenCalled();
        expect(raised.message).toBe(
            'the AI account is out of credit or being rate-limited',
        );
        expect(raised.cause.status).toBe(429);
    });
});

describe('the OpenAI-shaped loop', () => {
    test('a provider with no client says so', async () => {
        const raised = await askLlmBot(
            'Hello?',
            'presenter',
            'openai',
            'gpt-5',
        ).catch((error: any) => {
            return error;
        });
        expect(raised.cause.message).toBe('ChatGPT is not available');
    });

    test('Kimi gets its budget, its effort on K3 alone, and the history', async () => {
        const { sentList } = useOpenAiShaped(
            [openAiText('Press F5.'), openAiText('Press F6.')],
            'kimi',
        );
        const history = [
            { author: 'you' as const, text: 'Is a screen on?' },
            { author: 'bot' as const, text: 'No.' },
        ];

        const k3 = await askLlmBot(
            'How do I turn it on?',
            'presenter',
            'kimi',
            'kimi-k3',
            history,
        );
        await askLlmBot('And off?', 'presenter', 'kimi', 'kimi-k2.6', history);

        expect(k3.text).toBe('Press F5.');
        expect(sentList[0]).toMatchObject({
            model: 'kimi-k3',
            max_completion_tokens: 6000,
            reasoning_effort: 'low',
        });
        expect(sentList[1].max_completion_tokens).toBe(6000);
        expect(sentList[1].reasoning_effort).toBeUndefined();
        expect(sentList[0].messages.slice(1, 3)).toEqual([
            { role: 'user', content: 'Is a screen on?' },
            { role: 'assistant', content: 'No.' },
        ]);
    });

    test('a busy free service past round one gets a salvage round with no tools', async () => {
        fake.toolList = [{ name: 'owa_help_search' }];
        const { sentList } = useOpenAiShaped(
            [
                openAiToolCall('owa_help_search', { query: 'screen' }),
                thrown(429, 'Rate limit reached'),
                openAiText('Press Show Screen in the Mini Screen panel.'),
            ],
            'free',
        );

        const answer = await askLlmBot(
            'How do I show the screen?',
            'presenter',
            'free',
            'nvidia/nemotron-3.5-super-vl:free',
        );

        expect(sentList).toHaveLength(3);
        // The free service's own budget, and the tools gone for the salvage.
        expect(sentList[0].max_tokens).toBe(6000);
        expect(sentList[0].tools).toBeDefined();
        expect(sentList[2].tools).toBeUndefined();
        expect(answer.text).toBe('Press Show Screen in the Mini Screen panel.');
    });

    test('a verse quoted from memory goes back once here too', async () => {
        const { sentList } = useOpenAiShaped(
            [
                openAiText('Matthew 5:44 tells you to love them.'),
                openAiText('I could not read it in this Bible.'),
            ],
            'openai',
        );

        await askLlmBot(
            'love your enemies',
            'presenter',
            'openai',
            'gpt-5',
            [],
            null,
            { verseFind: { bible: 'KJV' } },
        );

        expect(sentList[1].messages.slice(-2)).toEqual([
            {
                role: 'assistant',
                content: 'Matthew 5:44 tells you to love them.',
            },
            {
                role: 'user',
                content: expect.stringContaining(
                    'no search or read returned Matthew 5:44',
                ),
            },
        ]);
    });

    test('a misquote, then "not stated" with nothing read, each go back once', async () => {
        const { sentList } = useOpenAiShaped(
            [
                openAiText(
                    'It says “Noah walked with God and found favour in his ' +
                        'sight”.',
                ),
                openAiText('The Bible does not say how long it was.'),
                openAiText('It was one year and ten days.'),
            ],
            'openai',
        );

        const answer = await askLlmBot(
            'How long was Noah in the ark?',
            'reader',
            'openai',
            'gpt-5',
            [],
            null,
            {
                lookup: {
                    page: null,
                    record: JSON.stringify({ bible: 'KJV', ref: 'GEN 8' }),
                },
            },
        );

        expect(sentList).toHaveLength(3);
        expect(sentList[1].messages.at(-1).content).toContain(
            'are not in the record',
        );
        expect(sentList[2].messages.at(-1).content).toContain(
            'you said the Bible does not say it',
        );
        expect(sentList[2].messages.at(-1).content).toContain('bible "KJV"');
        expect(answer.text).toBe('It was one year and ten days.');
    });

    test('a model that says nothing is no answer', async () => {
        useOpenAiShaped([openAiText('   ', 'stop')], 'openai');

        const raised = await askLlmBot(
            'Hello?',
            'presenter',
            'openai',
            'gpt-5',
        ).catch((error: any) => {
            return error;
        });

        expect(raised.message).toContain('it wrote no answer this time');
        expect(raised.cause.message).toBe('ChatGPT returned no answer (stop)');
    });

    // BN-36 (2026-11-08): on Free's Nemotron, three typed lines of twelve
    // went into the note and the answer was "could not answer" -- no word of
    // the change, no button to take it back.
    test('a change made before the model went quiet is said and offered back', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Grace',
            isChanged: true,
            undoId: 'undo-1',
            summary: 'blocks: 1 added -- added paragraph',
        });
        useOpenAiShaped(
            [
                openAiToolCall('owa_note_edit', {
                    action: 'edit',
                    changes: [{ after: 2, text: 'God is love' }],
                }),
                openAiText('', 'stop'),
                openAiText('', 'stop'),
            ],
            'openai',
        );
        const file = {
            name: 'Grace',
            filePath: 'C:\\notes\\Default.own',
            noteId: 3,
        };

        const answer = await askLlmBot(
            'Add a line at the end saying God is love',
            'bibleNote',
            'openai',
            'gpt-5',
            [],
            null,
            { note: { files: [file] } },
        );

        expect(answer.text).toBe(
            '“Grace” was changed, but the assistant stopped before saying ' +
                'what it did. Undo this change puts it back.',
        );
        expect(answer.actions?.map((action) => action.label)).toEqual([
            'Undo this change',
        ]);
        expect(answer.shows?.map((show) => show.name)).toEqual([
            'Show it in the list',
        ]);
    });

    test('nothing changed is no change to say', () => {
        expect(genChangedWithoutAnswer(null)).toBeNull();
        expect(
            genChangedWithoutAnswer({ name: 'Grace', undoId: null })?.actions,
        ).toEqual([]);
    });

    test('a foreground change on screens that are off offers to turn one on (EC-599)', () => {
        // Seen on Free: a Quick Text started twice, the screens read, and
        // then no answer -- the overlay waited on a screen nobody had on.
        const edited = {
            name: 'Welcome',
            undoId: 'u1',
            listName: 'Quick Text',
            isScreenOff: true,
        };
        const answer = genChangedWithoutAnswer(edited);
        expect(answer?.text).toBe(
            '“Welcome” was changed, but the assistant stopped before saying ' +
                'what it did. Undo this change puts it back.\n\n' +
                'The screen itself is off, so the projector is not showing ' +
                'it yet.',
        );
        expect(answer?.actions).toEqual([
            expect.objectContaining({ label: 'Undo this change' }),
            {
                label: 'Turn the screen on',
                toolName: BUILTIN_TOOL_NAME,
                args: { command: '/screen-show' },
            },
        ]);
        // A screen that is on, or a change that said nothing of the
        // screens, offers no such press.
        for (const isScreenOff of [false, undefined]) {
            const shown = genChangedWithoutAnswer({ ...edited, isScreenOff });
            expect(shown?.actions?.map((action) => action.label)).toEqual([
                'Undo this change',
            ]);
            expect(shown?.text).not.toContain('screen itself');
        }
        // Named as its strip reads, not by the bare session (EC-601: seen
        // live as "“Default” was changed" over a clock just put up).
        const clock = genChangedWithoutAnswer({
            ...edited,
            name: 'Default',
            shownName: 'Time › Default',
        });
        expect(clock?.text).toMatch(/^“Time › Default” was changed/);
    });

    test('a reply the server dropped is asked for once more', async () => {
        // A tool call the server could not parse comes back as nothing,
        // tokens and all: the same round asked again answers.
        fake.toolList = [{ name: 'owa_find_ui' }];
        const { sentList } = useOpenAiShaped(
            [openAiText('', 'stop'), openAiText('Here it is.')],
            'openai',
        );

        const answer = await askLlmBot(
            'Where is it?',
            'presenter',
            'openai',
            'gpt-5',
        );

        expect(answer.text).toBe('Here it is.');
        expect(sentList).toHaveLength(2);
        // No note in it: asked again as it was.
        expect(JSON.stringify(sentList[1].messages)).not.toContain(
            'Nothing arrived',
        );
    });

    // BN-61 (2026-11-10): a whole lesson for an empty note, nested in
    // `changes`, is the call the shared server dropped 7 times of 8 -- the
    // retry asks for the flat add the window writes into the note.
    test('a dropped reply about an empty note is asked for flat', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_bible_note' }];
        const { sentList } = useOpenAiShaped(
            [openAiText('', 'stop'), openAiText('Which passage?')],
            'openai',
        );
        await askLlmBot(
            'help me prepare a sermon on John 10:11-18',
            'bibleNote',
            'openai',
            'gpt-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon Prep',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                    blankBlockCount: 1,
                },
            },
        );
        expect(sentList).toHaveLength(2);
        expect(JSON.stringify(sentList[1].messages.at(-1))).toContain(
            'ONE owa_bible_note action \\"add\\"',
        );
        // A note with words in it: the change asked for in smaller parts
        // (BN-67: a finished sermon's one long edit was dropped twice).
        const plain = useOpenAiShaped(
            [openAiText('', 'stop'), openAiText('Done.')],
            'openai',
        );
        await askLlmBot(
            'make the title red',
            'bibleNote',
            'openai',
            'gpt-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon Prep',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                },
            },
        );
        const nudge = JSON.stringify(plain.sentList[1].messages.at(-1));
        expect(nudge).toContain('smaller owa_note_edit edits');
        // In parts, from the end up: an add moves only what comes after it.
        expect(nudge).toContain('FROM THE END OF THE NOTE UP');
    });

    // BN-255 (2026-11-13): the one retry spent on the lesson's long write,
    // the one more edit dropped next had ended the ask "changed, but the
    // assistant stopped". Once before a change, once more after one.
    test('a reply dropped after a change is asked for once more too', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Sermon',
            isChanged: true,
            undoId: 'u-9',
        });
        const editReply = {
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
                                    name: 'owa_note_edit',
                                    arguments: JSON.stringify({
                                        action: 'edit',
                                        note: 'Sermon',
                                        changes: [{ block: 2, text: 'Fixed.' }],
                                    }),
                                },
                            },
                        ],
                    },
                    finish_reason: 'tool_calls',
                },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
        };
        const note = {
            note: {
                files: [
                    {
                        name: 'Sermon',
                        filePath: 'C:\\notes\\Default.own',
                        noteId: 4,
                    },
                ],
            },
        };
        const { sentList } = useOpenAiShaped(
            [
                openAiText('', 'stop'),
                editReply,
                openAiText('', 'stop'),
                openAiText('Done.'),
            ],
            'openai',
        );
        const answer = await askLlmBot(
            'fix the second line',
            'bibleNote',
            'openai',
            'gpt-5',
            [],
            null,
            note,
        );
        expect(answer.text).toContain('Done.');
        expect(sentList).toHaveLength(4);
        // A third empty reply after the change is the model's own: the
        // change is said, never a failure that hides it.
        const third = useOpenAiShaped(
            [
                openAiText('', 'stop'),
                editReply,
                openAiText('', 'stop'),
                openAiText('', 'stop'),
            ],
            'openai',
        );
        const stopped = await askLlmBot(
            'fix the second line',
            'bibleNote',
            'openai',
            'gpt-5',
            [],
            null,
            note,
        );
        expect(third.sentList).toHaveLength(4);
        expect(stopped.text).toContain('stopped before saying what it did');
    });

    // 2026-11-10: _make it fit 15 minutes_ came back as one edit sent twice
    // in one reply; the second was refused and the answer apologised.
    test('the same edit twice in one reply runs once; a press twice, twice', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_click' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({
            name: 'Sermon',
            isChanged: true,
            undoId: 'u-3',
        });
        const edit = {
            id: 'call-1',
            type: 'function',
            function: {
                name: 'owa_note_edit',
                arguments: JSON.stringify({
                    action: 'edit',
                    note: 'Sermon',
                    changes: [{ block: 2, text: 'Shorter.' }],
                }),
            },
        };
        const press = {
            id: 'call-3',
            type: 'function',
            function: {
                name: 'owa_click',
                arguments: JSON.stringify({ find: 'Zoom In' }),
            },
        };
        const { sentList } = useOpenAiShaped(
            [
                {
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: null,
                                tool_calls: [
                                    edit,
                                    { ...edit, id: 'call-2' },
                                    press,
                                    { ...press, id: 'call-4' },
                                ],
                            },
                            finish_reason: 'tool_calls',
                        },
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 5 },
                },
                openAiText('Done.'),
            ],
            'openai',
        );
        await askLlmBot(
            'it is too long, make it fit 15 minutes',
            'bibleNote',
            'openai',
            'gpt-5',
            [],
            null,
            {
                note: {
                    files: [
                        {
                            name: 'Sermon',
                            filePath: 'C:\\notes\\Default.own',
                            noteId: 4,
                        },
                    ],
                },
            },
        );
        expect(
            fake.toolCallList.map((call: any) => {
                return call.name;
            }),
        ).toEqual(['owa_note_edit', 'owa_click', 'owa_click']);
        // Every call still gets its answer, the second edit the first's.
        const toolLegs = sentList[1].messages.filter((message: any) => {
            return message.role === 'tool';
        });
        expect(toolLegs).toHaveLength(4);
        expect(toolLegs[1].content).toBe(toolLegs[0].content);
    });

    test('a second empty reply is the model’s, and pressed nothing', async () => {
        fake.toolList = [{ name: 'owa_find_ui' }];
        const { sentList } = useOpenAiShaped(
            [openAiText('', 'stop'), openAiText('', 'stop')],
            'openai',
        );

        const raised = await askLlmBot(
            'Where is it?',
            'presenter',
            'openai',
            'gpt-5',
        ).catch((error: any) => {
            return error;
        });

        expect(sentList).toHaveLength(2);
        expect(raised.message).toContain('it wrote no answer this time');
        // No tool was called, so Auto may hand the question on.
        expect(raised.cause.isNothingDone).toBe(true);
    });

    test('said done without the tool goes back once here too', async () => {
        fake.toolList = [{ name: 'owa_foreground' }];
        fake.toolResultMap.owa_foreground = '{"did":"started"}';
        const { sentList } = useOpenAiShaped(
            [
                openAiText('Done — the countdown is on.'),
                openAiToolCall('owa_foreground', {
                    widget: 'countdown',
                    minutes: 5,
                }),
                openAiText('Started a 5 minute countdown.'),
            ],
            'openai',
        );

        const answer = await askLlmBot(
            'Start a 5 minute countdown',
            'presenter',
            'openai',
            'gpt-5',
            [],
            null,
            { knownDoTool: 'owa_foreground' },
        );

        expect(sentList[1].messages.at(-1)).toEqual({
            role: 'user',
            content: expect.stringContaining(
                'you have not called owa_foreground',
            ),
        });
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_foreground',
                args: { widget: 'countdown', minutes: 5 },
            },
        ]);
        expect(answer.text).toBe('Started a 5 minute countdown.');
    });

    test('an addition with no pictures is its own user turn', async () => {
        fake.toolList = [{ name: 'owa_help_search' }];
        const { sentList } = useOpenAiShaped(
            [
                openAiToolCall('owa_help_search', { query: 'font' }),
                openAiText('Use the font size slider.'),
            ],
            'openai',
        );

        await askLlmBot(
            'How do I make the words bigger?',
            'presenter',
            'openai',
            'gpt-5',
            [],
            null,
            {
                takeAdditions: () => {
                    return ['on screen 2'];
                },
            },
        );

        expect(sentList[1].messages.at(-1)).toEqual({
            role: 'user',
            content:
                'The user has just added this to their question while you ' +
                'were looking things up. Answer both together:\n' +
                'on screen 2',
        });
    });

    test('a call on the only round leaves it unsettled', async () => {
        useOpenAiShaped(
            [openAiToolCall('owa_help_search', { query: 'bible' })],
            'openai',
        );

        const answer = await askLlmBot(
            'what is the bible',
            'presenter',
            'openai',
            'gpt-5',
            [],
            null,
            { isGeneral: true },
        );

        expect(answer.text).toContain('could not settle on an answer');
    });

    test('a server that refuses the tools is asked again without them, a picture kept', async () => {
        fake.customServers = [genServer()];
        fake.toolList = [{ name: 'owa_help_search' }];
        const { sentList } = useOpenAiShaped(
            [
                thrown(400, "'tools' is not supported"),
                openAiText('From the guide: press Show Screen.'),
            ],
            'custom',
        );

        const answer = await askLlmBot(
            'What is this button?',
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            null,
            { images: [{ mediaType: 'image/png', data: 'AAAA' }] },
        );

        expect(sentList[1].tools).toBeUndefined();
        const [picturedTurn, nudgeTurn] = sentList[1].messages.slice(-2);
        expect(Array.isArray(picturedTurn.content)).toBe(true);
        expect(nudgeTurn.role).toBe('user');
        expect(nudgeTurn.content).toContain(
            'The app’s tools are not available on this server',
        );
        expect(answer.text).toContain('From the guide: press Show Screen.');
        expect(answer.text).toContain('cannot use the app’s tools');
    });

    test('a stop on a server of the user’s own stays a stop', async () => {
        fake.customServers = [genServer()];
        const controller = new AbortController();
        const abortError: any = new Error('Request was aborted.');
        abortError.name = 'APIUserAbortError';
        fake.custom = {
            chat: {
                completions: {
                    create: async () => {
                        controller.abort();
                        throw abortError;
                    },
                },
            },
        };

        const raised = await askLlmBot(
            'Hello?',
            'presenter',
            'custom',
            PHI_MODEL,
            [],
            controller.signal,
        ).catch((error: any) => {
            return error;
        });

        // Not dressed as a failure, and not as the server's own sentence.
        expect(raised).toBe(abortError);
    });

    // EC-524 (2026-11-12): the shared gemma4:cloud did what a foreground ask
    // asked and then said nothing for minutes on the round that writes the
    // answer. The same round goes once more, and a second silence is said.
    class APIConnectionTimeoutError extends Error {
        constructor() {
            super('Request timed out.');
        }
    }
    const SHARED_MODEL = 'registry-owa/row-phi';
    const genSharedServer = () => {
        return genServer({ id: 'registry-owa', name: 'OWA Shared' });
    };
    const useStallingServer = (rounds: any[]) => {
        const sentList: any[] = [];
        const optionList: any[] = [];
        fake.custom = {
            chat: {
                completions: {
                    create: vi.fn(async (request: any, options: any) => {
                        sentList.push(snapshotOf(request));
                        optionList.push(options);
                        const next = rounds.shift();
                        if (next instanceof Error) {
                            throw next;
                        }
                        return next;
                    }),
                },
            },
        };
        return { sentList, optionList };
    };

    test('a shared server that goes quiet on a round is sent the same round once more', async () => {
        fake.customServers = [genSharedServer()];
        const { sentList, optionList } = useStallingServer([
            new APIConnectionTimeoutError(),
            openAiText('The countdown is red now.'),
        ]);

        const answer = await askLlmBot(
            'Make it red',
            'presenter',
            'custom',
            SHARED_MODEL,
        );

        expect(answer.text).toContain('The countdown is red now.');
        expect(sentList).toHaveLength(2);
        expect(sentList[1].messages).toEqual(sentList[0].messages);
        expect(optionList[0].timeout).toBe(90 * 1000);
    });

    test('a second silence is said in words, and nothing is sent a third time', async () => {
        fake.customServers = [genSharedServer()];
        const { sentList } = useStallingServer([
            new APIConnectionTimeoutError(),
            new APIConnectionTimeoutError(),
            openAiText('never asked'),
        ]);

        const raised = await askLlmBot(
            'Make it red',
            'presenter',
            'custom',
            SHARED_MODEL,
        ).catch((error: any) => {
            return error;
        });

        expect(sentList).toHaveLength(2);
        expect(String(raised?.message)).toContain(
            'the server took too long to answer',
        );
    });

    // EC-577 (2026-11-13): the free service went quiet the same way, on 2 of
    // 22 foreground asks, and waited the client's ten minutes.
    const FREE_MODEL = 'nvidia/nemotron-3.5-super-vl:free';
    const useStallingFree = (rounds: any[]) => {
        const sentList: any[] = [];
        const optionList: any[] = [];
        fake.free = {
            chat: {
                completions: {
                    create: vi.fn(async (request: any, options: any) => {
                        sentList.push(snapshotOf(request));
                        optionList.push(options);
                        const next = rounds.shift();
                        if (next instanceof Error) {
                            throw next;
                        }
                        return next;
                    }),
                },
            },
        };
        return { sentList, optionList };
    };

    test('the free service that goes quiet on a round is sent the same round once more', async () => {
        const { sentList, optionList } = useStallingFree([
            new APIConnectionTimeoutError(),
            openAiText('The countdown is off the screen.'),
        ]);

        const answer = await askLlmBot(
            'Take it off the screen',
            'presenter',
            'free',
            FREE_MODEL,
        );

        expect(answer.text).toContain('The countdown is off the screen.');
        expect(sentList).toHaveLength(2);
        expect(sentList[1].messages).toEqual(sentList[0].messages);
        expect(optionList[0].timeout).toBe(90 * 1000);
    });

    test('the free service keeps its own clock for a long write, a translation and a Retry', async () => {
        for (const extra of [
            // A study file is a long write (`askLlmBot` reads it so).
            { study: {} },
            { isTranslation: true },
            { retryAttempt: 1 },
        ]) {
            const { optionList } = useStallingFree([openAiText('Done.')]);

            await askLlmBot(
                'Write it',
                'presenter',
                'free',
                FREE_MODEL,
                [],
                null,
                extra,
            );

            expect(optionList[0].timeout).toBeUndefined();
        }
    });

    test('a server of the user’s own keeps the client’s own clock', async () => {
        fake.customServers = [genServer()];
        const { sentList, optionList } = useStallingServer([
            openAiText('Hello.'),
        ]);

        await askLlmBot('Hello?', 'presenter', 'custom', PHI_MODEL);

        expect(sentList).toHaveLength(1);
        expect(optionList[0].timeout).toBeUndefined();
        expect(checkIsRoundTimeout(new APIConnectionTimeoutError())).toBe(true);
        expect(checkIsRoundTimeout(new Error('Request was aborted.'))).toBe(
            false,
        );
    });
});
