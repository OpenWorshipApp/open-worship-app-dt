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
import { RUNAWAY_ANSWER_NUDGE } from './llmBotHelpers';
import {
    GENERAL_ASK_LABEL,
    GENERAL_ASK_TOOL_NAME,
    addQuoteSource,
    applyToolWatch,
    askLlmBot,
    checkCanSeeImages,
    checkIsReasoningOffRemembered,
    describeLlmError,
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
            'The walkthrough got stuck of "Show a verse" — "Go" — and asked for help.',
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

    test('a long rescue in a script with no spaces is never cut mid-letter', () => {
        // KA + COENG (the subscript sign) + KA, one letter in front so the
        // 240th character is the sign: a cut there draws half a cluster, and
        // so does a cut with the sign left as the next character.
        const cluster = 'ក្ក';
        const answer = toGuideRescueAnswer('ក' + cluster.repeat(100));
        expect(answer.endsWith('…')).toBe(true);
        const body = answer.slice(0, -1);
        expect(body.endsWith('្')).toBe(false);
        expect(body).toBe('ក' + cluster.repeat(79));
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

    test('a translation goes out under the translator’s prompt and comes back as written', async () => {
        const { sentList } = useAnthropic(
            [anthropicText('Press (Settings) to begin.')],
            'anthropic',
        );

        const answer = await askLlmBot(
            'ចុចការកំណត់',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                isTranslation: true,
                isGeneral: true,
                askedText: 'ចុចការកំណត់',
                replyLang: 'km',
            },
        );

        expect(sentList[0].system[0].text).toContain(
            'You are a translator for Open Worship',
        );
        // A general ask goes out with no tools at all.
        expect(sentList[0].tools).toBeUndefined();
        // Nobody reads a translator's words as they stand: not cleaned.
        expect(answer.text).toBe('Press (Settings) to begin.');
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

    test('a run of one letter goes back once, kept as an ellipsis', async () => {
        const { sentList } = useOpenAiShaped(
            [
                openAiText('ម'.repeat(30), 'length'),
                openAiText('The help works with no internet.'),
            ],
            'openai',
        );

        const answer = await askLlmBot(
            'Does the help work offline?',
            'presenter',
            'openai',
            'gpt-5',
        );

        expect(sentList[1].messages.slice(-2)).toEqual([
            { role: 'assistant', content: '…' },
            { role: 'user', content: RUNAWAY_ANSWER_NUDGE },
        ]);
        expect(answer.text).toBe('The help works with no internet.');
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
});
