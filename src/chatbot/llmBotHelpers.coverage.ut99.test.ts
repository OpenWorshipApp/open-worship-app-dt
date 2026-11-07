import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// What the rest of the model loop is handed instead of the SDK clients, the
// setting store and the tool host -- and what it is read back off. Every
// field is reset before each test; the factories below only delegate.
const { fake } = vi.hoisted(() => {
    return {
        fake: {
            anthropic: null as any,
            openai: null as any,
            kimi: null as any,
            free: null as any,
            bedrock: null as any,
            bedrockClaude: null as any,
            custom: null as any,
            bedrockRegion: 'us-west-2',
            customServers: [] as any[],
            aiSetting: null as Record<string, string> | null,
            settings: new Map<string, string>(),
            toolList: [] as { name: string; description?: string }[],
            toolCallList: [] as string[],
            toolArgsList: [] as { name: string; args: any }[],
            toolAimList: [] as any[],
            toolResultMap: {} as Record<string, string>,
            // Answers a tool call itself (and may throw) when set.
            toolReply: null as
                null | ((name: string, args: any) => string | Promise<string>),
            pictureReply: null as null | ((name: string, args: any) => any),
        },
    };
});

vi.mock('../helper/ai/aiHelpers', () => {
    return {
        getAISetting: () => {
            return (
                fake.aiSetting ?? {
                    openAIAPIKey: '',
                    anthropicAPIKey: '',
                    kimiAPIKey: '',
                }
            );
        },
        getBedrockRegion: () => {
            return fake.bedrockRegion;
        },
    };
});
vi.mock('../helper/ai/anthropicHelpers', () => {
    return {
        getAnthropicInstance: () => {
            return fake.anthropic;
        },
    };
});
vi.mock('../helper/ai/openAIHelpers', () => {
    return {
        getOpenAIInstance: () => {
            return fake.openai;
        },
    };
});
vi.mock('../helper/ai/kimiHelpers', () => {
    return {
        getKimiInstance: () => {
            return fake.kimi;
        },
    };
});
vi.mock('../helper/ai/bedrockHelpers', () => {
    return {
        getBedrockInstance: () => {
            return fake.bedrock;
        },
    };
});
vi.mock('../helper/ai/bedrockClaudeHelpers', () => {
    return {
        getBedrockClaudeInstance: () => {
            return fake.bedrockClaude;
        },
    };
});
vi.mock('../helper/ai/customServerHelpers', () => {
    return {
        getCustomServers: () => {
            return fake.customServers;
        },
        getAllCustomServers: () => {
            return fake.customServers;
        },
        getUsableCustomServers: () => {
            return fake.customServers;
        },
        readCustomServerModelInfo: async () => {
            return null;
        },
        findCustomModelInfo: () => {
            return null;
        },
    };
});
vi.mock('../helper/ai/customServerClientHelpers', () => {
    return {
        genContextTooSmallText: (loadedContext: number | null) => {
            return `context ${loadedContext} is too small`;
        },
        genContextCutText: (loadedContext: number) => {
            return `answered from a question cut to ${loadedContext}`;
        },
        getCustomServerInstance: () => {
            return fake.custom;
        },
        // The real one's patterns, in short.
        checkIsToolsRefused: (error: any) => {
            return /not supported|--jinja|does not support tools/i.test(
                String(error?.message ?? ''),
            );
        },
        toCustomServerFailure: (error: any) => {
            return error?.name === 'CustomServerError' ? error : null;
        },
    };
});
// Without it the module graph reaches `langHelpers` and `document`.
vi.mock('../helper/ai/freeHelpers', () => {
    return {
        FREE_SERVICE_MAP: {
            kilo: { label: 'Kilo', homeUrl: 'https://kilo.ai' },
        },
        getFreeInstance: () => {
            return fake.free;
        },
    };
});
// The setting store as a plain map: the spend guard's ledger and the
// provider / model / Auto choices all land in it.
vi.mock('../helper/settingHelpers', () => {
    return {
        getSetting: (key: string) => {
            return fake.settings.get(key) ?? null;
        },
        setSetting: (key: string, value: string | null) => {
            if (value === null) {
                fake.settings.delete(key);
                return;
            }
            fake.settings.set(key, value);
        },
    };
});
vi.mock('../helper/loggerHelpers', () => {
    return {
        appError: () => {},
    };
});
vi.mock('./mcpClient', () => {
    return {
        callTool: async (
            name: string,
            args?: any,
            _signal?: AbortSignal | null,
            aim?: any,
        ) => {
            fake.toolCallList.push(name);
            fake.toolArgsList.push({
                name,
                args: JSON.parse(JSON.stringify(args ?? {})),
            });
            fake.toolAimList.push(aim ?? null);
            if (fake.toolReply !== null) {
                return await fake.toolReply(name, args);
            }
            return fake.toolResultMap[name] ?? '';
        },
        callToolWithPictures: async (name: string, args?: any) => {
            fake.toolCallList.push(name);
            fake.toolArgsList.push({
                name,
                args: JSON.parse(JSON.stringify(args ?? {})),
            });
            if (fake.pictureReply !== null) {
                return await fake.pictureReply(name, args);
            }
            return { text: fake.toolResultMap[name] ?? '', pictures: [] };
        },
        listTools: async () => {
            return fake.toolList;
        },
        // What `verseFindChatHelpers.readFoundVerses` reads a result with.
        parseToolJson: (text: string) => {
            try {
                return JSON.parse(text);
            } catch (_error) {
                return null;
            }
        },
    };
});

import { AskCancelledError } from './cancelHelpers';
import { resetSpendGuardForTests } from './spendGuardHelpers';
import { BIBLE_KJV_MODEL_REFUSAL } from './bibleImportChatHelpers';
import { BIBLE_READER_SYSTEM_PROMPT } from './bibleReaderChatHelpers';
import {
    LYRIC_COPY_TOOL_NAME,
    LYRIC_CREATE_TOOL_NAME,
    takeDraftedLyric,
} from './lyricDraftHelpers';
import {
    EVERY_VERSE_LABEL,
    SEARCH_ANOTHER_BIBLE_LABEL,
    SHOW_IN_ANOTHER_BIBLE_LABEL,
    VERSE_FIND_STEP_TOOL_NAME,
    VERSE_WEB_SEARCH_TOOL_NAME,
} from './verseFindChatHelpers';
import {
    AUTO_ASSISTANT_WARNING,
    GENERAL_ASK_LABEL,
    GENERAL_ASK_TOOL_NAME,
    RECORD_TURN_ACK,
    WORDLESS_ANSWER_NUDGE,
    addQuoteSource,
    applyToolWatch,
    askLlmBot,
    checkCanSeeImages,
    checkIsReasoningOffRemembered,
    describeLlmError,
    filterVerifiedAnswerShows,
    genAutoAssistantWarning,
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

const FAKE_KEY = 'test-key-not-real';
const PICTURE = { mediaType: 'image/png', data: 'iVBORw0KGgo=' };
// A passage record the way a Lookup Detail panel hands it over.
const RECORD =
    '{"kind":"passage","bible":"KJV","ref":"GEN 8:1-22",' +
    '"text":"And God remembered Noah"}';
const GEN_8_3 =
    '{"bible":"KJV","verses":[{"key":"GEN 8:3","ref":"Genesis 8:3",' +
    '"text":"And the waters returned from off the earth continually"}]}';

type CallType = { request: any; options: any };

// A `create` that answers the replies in order (the last one again once they
// run out), throws a reply that is an Error, and keeps a COPY of every
// request: both loops push onto the same `messages` array after the call.
function genCreate(replies: any[]) {
    const calls: CallType[] = [];
    const create = vi.fn(async (request: any, options: any) => {
        calls.push({
            request: JSON.parse(JSON.stringify(request)),
            options,
        });
        const reply = replies[Math.min(calls.length, replies.length) - 1];
        if (reply instanceof Error) {
            throw reply;
        }
        return typeof reply === 'function' ? await reply() : reply;
    });
    return { create, calls };
}

function useAnthropic(...replies: any[]) {
    const created = genCreate(replies);
    fake.anthropic = { messages: { create: created.create } };
    return created;
}

function useOpenAiShaped(
    key: 'openai' | 'kimi' | 'free' | 'custom',
    ...replies: any[]
) {
    const created = genCreate(replies);
    fake[key] = { chat: { completions: { create: created.create } } };
    return created;
}

const USAGE_ANTHROPIC = { input_tokens: 12, output_tokens: 4 };
const USAGE_OPENAI = { prompt_tokens: 12, completion_tokens: 4 };

function genAnthropicText(text: string, stopReason = 'end_turn') {
    return {
        content: [{ type: 'text', text }],
        stop_reason: stopReason,
        usage: USAGE_ANTHROPIC,
    };
}

function genAnthropicTools(...uses: [string, string, any][]) {
    return {
        content: uses.map(([id, name, input]) => {
            return { type: 'tool_use', id, name, input };
        }),
        stop_reason: 'tool_use',
        usage: USAGE_ANTHROPIC,
    };
}

function genOpenAiText(content: string | null, finishReason = 'stop') {
    return {
        choices: [
            {
                message: { role: 'assistant', content },
                finish_reason: finishReason,
            },
        ],
        usage: USAGE_OPENAI,
    };
}

function genOpenAiTools(...calls: [string, string, any][]) {
    return {
        choices: [
            {
                message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: calls.map(([id, name, args]) => {
                        return {
                            id,
                            type: 'function',
                            function: { name, arguments: JSON.stringify(args) },
                        };
                    }),
                },
                finish_reason: 'tool_calls',
            },
        ],
        usage: USAGE_OPENAI,
    };
}

function genStatusError(message: string, status: number) {
    return Object.assign(new Error(message), { status });
}

function toToolNames(request: any) {
    return (request.tools ?? []).map((tool: any) => {
        return tool.name ?? tool.function?.name;
    });
}

beforeEach(() => {
    fake.anthropic = null;
    fake.openai = null;
    fake.kimi = null;
    fake.free = null;
    fake.bedrock = null;
    fake.bedrockClaude = null;
    fake.custom = null;
    fake.bedrockRegion = 'us-west-2';
    fake.customServers = [];
    fake.aiSetting = null;
    fake.settings.clear();
    fake.toolList = [{ name: 'owa_help_search' }];
    fake.toolCallList = [];
    fake.toolArgsList = [];
    fake.toolAimList = [];
    fake.toolResultMap = {};
    fake.toolReply = null;
    fake.pictureReply = null;
    resetSpendGuardForTests();
    resetReasoningOffMemoryForTests();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('model lists and labels', () => {
    test('a hover says the wire id, what it is like, its price and its notice', () => {
        expect(
            genLlmModelTitle({
                id: 'srv/row',
                wireId: 'phi-3',
                label: 'Phi 3',
                note: 'good answers',
                speed: 'quick',
                price: '$1/$2',
                notice: 'slow, but free',
            } as any),
        ).toBe(
            'phi-3\ngood answers · quick\n$1/$2 per 1M tokens (in/out)\n' +
                'slow, but free',
        );
        // Nothing but a name: the id alone, no empty lines.
        expect(
            genLlmModelTitle({
                id: 'm',
                label: '',
                note: '',
                speed: '',
                price: '',
            } as any),
        ).toBe('m');
    });

    test('a round is named the way the model picker names it', () => {
        expect(getLlmModelLabel('anthropic', 'claude-sonnet-5')).toBe(
            'Sonnet 5',
        );
        // One the list no longer carries keeps its id.
        expect(getLlmModelLabel('anthropic', 'claude-gone-1')).toBe(
            'claude-gone-1',
        );
    });

    test('a shared server says who shares it, what it costs and its notes', () => {
        fake.customServers = [
            {
                id: 'registry-box',
                name: 'Shared Box',
                baseUrl: 'https://shared-server.invalid/v1',
                source: 'registry',
                isFree: true,
                note: { '': 'slow, but it saves us the cost of usage' },
                models: [
                    {
                        id: 'gemma',
                        model: 'gemma4:31b',
                        name: 'Gemma 4 31B',
                        canSeeImages: true,
                        note: { en: 'best for Khmer' },
                    },
                ],
            },
            {
                id: 'registry-paid',
                name: 'Paid Box',
                baseUrl: 'https://shared-server.invalid/v2',
                source: 'registry',
                isFree: false,
                models: [{ id: 'qwen', model: 'qwen3:8b', name: '' }],
            },
        ];

        const [freeRow, paidRow] = getLlmModelList('custom');

        expect(freeRow).toMatchObject({
            id: 'registry-box/gemma',
            label: 'Gemma 4 31B',
            note: 'Shared Box, shared by openworship.app · free · can see pictures',
            notice: 'slow, but it saves us the cost of usage best for Khmer',
            wireId: 'gemma4:31b',
        });
        expect(paidRow).toMatchObject({
            id: 'registry-paid/qwen',
            label: 'qwen3:8b',
            note: 'Paid Box, shared by openworship.app',
        });
        expect(paidRow.notice).toBeUndefined();
        expect(genLlmModelTitle(freeRow)).toBe(
            'gemma4:31b\n' +
                'Shared Box, shared by openworship.app · free · can see pictures\n' +
                'slow, but it saves us the cost of usage best for Khmer',
        );
        expect(getLlmModelNotice('custom', 'registry-box/gemma')).toBe(
            'slow, but it saves us the cost of usage best for Khmer',
        );
        expect(getLlmModelNotice('custom', 'registry-paid/qwen')).toBe('');
        expect(getLlmModelNotice('custom', 'registry-gone/none')).toBe('');
        expect(getLlmModelNotice(null, 'registry-box/gemma')).toBe('');
        // Only the row with its box ticked sees a picture.
        expect(checkCanSeeImages('custom', 'registry-box/gemma')).toBe(true);
        expect(checkCanSeeImages('custom', 'registry-paid/qwen')).toBe(false);
        expect(getFirstImageCapableModel('custom')?.id).toBe(
            'registry-box/gemma',
        );
    });

    test('no provider sees nothing and offers nothing', () => {
        expect(checkCanSeeImages(null, 'claude-sonnet-5')).toBe(false);
        expect(getFirstImageCapableModel(null)).toBeNull();
    });
});

describe('the stored choices', () => {
    test('a chosen provider stands only while its key is there', () => {
        fake.aiSetting = {
            openAIAPIKey: FAKE_KEY,
            anthropicAPIKey: '',
            kimiAPIKey: '',
        };
        setLlmProvider('openai');
        expect(fake.settings.get('chatbot-llm-provider')).toBe('openai');
        expect(getLlmProvider()).toBe('openai');

        // Kimi has no key: the first provider that can answer is asked.
        setLlmProvider('kimi');
        expect(getLlmProvider()).toBe('openai');

        // No key at all: the keyless service is all there is.
        fake.aiSetting = null;
        expect(getLlmProvider()).toBe('free');
    });

    test('the model is stored per provider', () => {
        setLlmModel('anthropic', 'claude-haiku-4-5');

        expect(fake.settings.get('chatbot-llm-model-anthropic')).toBe(
            'claude-haiku-4-5',
        );
        expect(getLlmModel('anthropic')).toBe('claude-haiku-4-5');
        // Another provider's model is its own.
        expect(getLlmModel('openai')).toBe('gpt-5');
    });

    test('Auto is the first-run default, and a stored pick before it stands', () => {
        expect(getIsLlmAuto()).toBe(true);

        setLlmProvider('anthropic');
        expect(getIsLlmAuto()).toBe(false);

        setIsLlmAuto(true);
        expect(fake.settings.get('chatbot-llm-auto')).toBe('true');
        expect(getIsLlmAuto()).toBe(true);

        setIsLlmAuto(false);
        expect(fake.settings.get('chatbot-llm-auto')).toBe('false');
        expect(getIsLlmAuto()).toBe(false);
    });

    test("Auto's notice names the free service it may ask", () => {
        expect(genAutoAssistantWarning()).toBe(AUTO_ASSISTANT_WARNING);
        expect(AUTO_ASSISTANT_WARNING).toContain('(Kilo)');
    });

    test('a thinking-off memory that ran out is dropped at the next write', () => {
        const later = 1000 + 31 * 60 * 1000;
        rememberReasoningOff('Local Box', 'm1', 1000);
        expect(checkIsReasoningOffRemembered('Local Box', 'm1', 1000)).toBe(
            true,
        );

        rememberReasoningOff('Local Box', 'm2', later);

        // Asked at the old time it would still be in force -- unless the
        // write took it away, which is what keeps the map small.
        expect(checkIsReasoningOffRemembered('Local Box', 'm1', 1000)).toBe(
            false,
        );
        expect(checkIsReasoningOffRemembered('Local Box', 'm2', later)).toBe(
            true,
        );
    });
});

describe('listAllLlmModels', () => {
    test("Claude's account list comes after the built-in one, sorted", async () => {
        const list = vi.fn(async () => {
            return {
                data: [
                    { id: 'claude-opus-5', display_name: 'Opus 5' },
                    { id: 'claude-zeta-9', display_name: 'Zeta 9' },
                    { id: 'claude-alpha-1', display_name: '' },
                ],
            };
        });
        fake.anthropic = { models: { list } };

        const models = await listAllLlmModels('anthropic');

        expect(list).toHaveBeenCalledWith({ limit: 100 });
        expect(
            models.map((model) => {
                return [model.id, model.label];
            }),
        ).toEqual([
            ['claude-opus-5', 'Opus 5'],
            ['claude-sonnet-5', 'Sonnet 5'],
            ['claude-haiku-4-5', 'Haiku 4.5'],
            // A row with no display name is called by its id.
            ['claude-alpha-1', 'claude-alpha-1'],
            ['claude-zeta-9', 'Zeta 9'],
        ]);
    });

    test('no Claude client adds nothing to the built-in list', async () => {
        const models = await listAllLlmModels('anthropic');

        expect(
            models.map((model) => {
                return model.id;
            }),
        ).toEqual(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
    });

    test("ChatGPT's catalogue is cut to the chat models", async () => {
        fake.openai = {
            models: {
                list: vi.fn(async () => {
                    return {
                        data: [
                            { id: 'gpt-5' },
                            { id: 'gpt-4o-audio-preview' },
                            { id: 'o3' },
                            { id: 'text-embedding-3' },
                            { id: 'gpt-4.1' },
                        ],
                    };
                }),
            },
        };

        const models = await listAllLlmModels('openai');

        expect(
            models.map((model) => {
                return model.id;
            }),
        ).toEqual(['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'o3']);
    });

    test("Kimi's list is taken whole, and no client adds nothing", async () => {
        fake.kimi = {
            models: {
                list: vi.fn(async () => {
                    return {
                        data: [{ id: 'kimi-k3' }, { id: 'moonshot-v1-8k' }],
                    };
                }),
            },
        };

        const models = await listAllLlmModels('kimi');
        expect(
            models.map((model) => {
                return model.id;
            }),
        ).toEqual([
            'kimi-k3',
            'kimi-k2.7-code-highspeed',
            'kimi-k2.6',
            'moonshot-v1-8k',
        ]);

        fake.kimi = null;
        expect((await listAllLlmModels('kimi')).length).toBe(3);
    });

    test('a custom server and the free service list only their own rows', async () => {
        fake.customServers = [
            {
                id: 'srv-1',
                name: 'Local Box',
                baseUrl: 'http://localhost:1234/v1',
                models: [{ id: 'row-1', model: 'phi-3', name: 'Phi 3' }],
            },
        ];

        expect(
            (await listAllLlmModels('custom')).map((model) => {
                return model.id;
            }),
        ).toEqual(['srv-1/row-1']);
        expect(
            (await listAllLlmModels('free')).map((model) => {
                return model.id;
            }),
        ).toEqual(
            getLlmModelList('free').map((model) => {
                return model.id;
            }),
        );
    });

    test('a refused key is said as a sentence, never with the key in it', async () => {
        const refused = genStatusError(
            `401 Incorrect API key provided: ${FAKE_KEY}`,
            401,
        );
        fake.anthropic = {
            models: {
                list: vi.fn(async () => {
                    throw refused;
                }),
            },
        };

        const raised: any = await listAllLlmModels('anthropic').catch(
            (error) => {
                return error;
            },
        );

        expect(raised).toBeInstanceOf(Error);
        expect(raised.message).toBe(
            'the API key was refused — check it in Settings → AI Providers',
        );
        expect(raised.message).not.toContain(FAKE_KEY);
        expect(raised.cause).toBe(refused);
    });
});

describe('describeLlmError, the remaining kinds', () => {
    test('a model the server could not load is not an empty account', () => {
        const said = describeLlmError({
            status: 400,
            message:
                'Model loading was stopped due to insufficient system resources',
        });

        expect(said).toContain('could not load this model');
        expect(said).not.toContain('credit');
    });

    test('a refused key never repeats the key the provider quoted', () => {
        const said = describeLlmError(
            genStatusError(`401 Incorrect API key: ${FAKE_KEY}`, 401),
        );

        expect(said).not.toContain(FAKE_KEY);
        expect(said).toContain('Settings → AI Providers');
    });
});

describe('the tool watch, the remaining reads', () => {
    test('no lookup conversation, nothing is kept to quote from', () => {
        const watch = genToolWatch();

        addQuoteSource(watch, 'And God remembered Noah');

        expect(watch.quoteSources).toBeNull();
    });

    test('a Bible check answered in prose leaves no import buttons', () => {
        const watch = genToolWatch();

        applyToolWatch(
            watch,
            'owa_bible_xml',
            { action: 'check', url: 'https://example.org/kjv.xml' },
            'That address could not be read.',
        );
        expect(watch.bibleImportCheck).toBeNull();

        applyToolWatch(
            watch,
            'owa_bible_xml',
            { action: 'check', url: 'https://example.org/kjv.xml' },
            '{"problem":"not-found"}',
        );
        expect(watch.bibleImportCheck).toEqual({
            result: { problem: 'not-found' },
            url: 'https://example.org/kjv.xml',
            find: '',
        });
    });

    test('a listed control is proven by its words, and only words count', () => {
        const watch = genToolWatch();

        applyToolWatch(
            watch,
            'owa_list_ui',
            {},
            JSON.stringify({
                controls: [{ label: 'Clear  All' }, { label: 5 }, {}],
            }),
        );

        expect([...watch.verifiedControlNames]).toEqual(['clear all']);
        expect(
            filterVerifiedAnswerShows(
                [
                    { kind: 'control', value: 'Clear All', name: 'Clear All' },
                    { kind: 'control', value: 'Show', name: 'Show' },
                ],
                watch,
            ),
        ).toEqual([{ kind: 'control', value: 'Clear All', name: 'Clear All' }]);
    });
});

describe('the walkthrough rescue, the remaining shapes', () => {
    test('each missing part has its own sentence', () => {
        expect(
            genGuideRescueSummary({ stepNumber: 2, stepText: 'Press Show' }),
        ).toBe(
            'The walkthrough got stuck on step 2 — "Press Show" — and asked ' +
                'for help.',
        );
        // The title and the step, and no step number to give (it read "got
        // stuck of" until 2026-11-04).
        expect(
            genGuideRescueSummary({
                title: 'Show a song',
                stepText: 'Press Show',
            }),
        ).toBe(
            'The walkthrough got stuck on "Show a song" — "Press Show" — and ' +
                'asked for help.',
        );
        expect(genGuideRescueSummary({ stepText: 'Press Show' })).toBe(
            'The walkthrough got stuck — "Press Show" — and asked for help.',
        );
    });

    test('a long answer with no sentence end is cut at a word', () => {
        expect(toGuideRescueAnswer(`DO: ${'word '.repeat(60)}`)).toBe(
            `${'word '.repeat(47)}word…`,
        );
    });

    test('a run with no spaces is never cut inside a letter', () => {
        // 'a' then 'a' + a combining acute over and over: the cut at 240
        // falls before the mark, which belongs to the letter in front of it.
        // (Any script's marks are read alike, `\p{M}`; a Khmer run is in the
        // Khmer package's own tests.)
        const said = toGuideRescueAnswer(`a${'á'.repeat(150)}`);

        expect(said).toBe(`a${'á'.repeat(119)}…`);
        expect(said.length).toBe(240);
    });
});

describe('genGeneralAskAction', () => {
    test('an answer pointing at /btw gets the button beside its others', () => {
        const action = genGeneralAskAction(
            {
                text: 'Type /btw before it to ask that.',
                actions: [{ label: 'Copy', toolName: 'owa-copy', args: {} }],
            },
            { askedText: 'will it rain today?' },
        );

        expect(action).toEqual({
            label: GENERAL_ASK_LABEL,
            toolName: GENERAL_ASK_TOOL_NAME,
            args: { question: 'will it rain today?' },
        });
    });

    test('never twice', () => {
        expect(
            genGeneralAskAction(
                {
                    text: 'Type /btw before it to ask that.',
                    actions: [
                        {
                            label: GENERAL_ASK_LABEL,
                            toolName: GENERAL_ASK_TOOL_NAME,
                            args: { question: 'will it rain today?' },
                        },
                    ],
                },
                { askedText: 'will it rain today?' },
            ),
        ).toBeNull();
    });
});

describe('the Anthropic loop', () => {
    test('a word lesson is one round, tools offered but not to be called', async () => {
        fake.toolList = [
            { name: 'owa_lookup_record' },
            { name: 'owa_read_website' },
            { name: 'owa_find_verse' },
            { name: 'owa_help_search' },
        ];
        const { calls } = useAnthropic(
            genAnthropicText('Remembered means God kept Noah in mind.'),
        );
        const controller = new AbortController();

        const answer = await askLlmBot(
            'What does "remembered" mean here?',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            controller.signal,
            { lookup: { page: null, isStudy: true } },
        );

        expect(answer.text).toBe('Remembered means God kept Noah in mind.');
        expect(calls.length).toBe(1);
        const [{ request, options }] = calls;
        expect(request.model).toBe('claude-sonnet-5');
        expect(request.max_tokens).toBe(6000);
        expect(request.cache_control).toEqual({ type: 'ephemeral' });
        expect(request.system[0].cache_control).toEqual({
            type: 'ephemeral',
        });
        expect(request.system[0].text).toContain(
            'answering questions about a person, a place or a passage',
        );
        expect(toToolNames(request)).toEqual([
            'owa_lookup_record',
            'owa_read_website',
            'owa_find_verse',
        ]);
        expect(request.tools[0].input_schema).toEqual({
            type: 'object',
            properties: {},
        });
        expect(request.tool_choice).toEqual({ type: 'none' });
        expect(options.signal).toBe(controller.signal);
    });

    test('the conversation so far goes ahead of the question', async () => {
        const { calls } = useAnthropic(genAnthropicText('Then press Show.'));

        await askLlmBot(
            'And then?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [
                { author: 'you', text: 'Where is Show?' },
                { author: 'bot', text: 'In the Mini Screen panel.' },
            ],
        );

        expect(calls[0].request.messages).toEqual([
            { role: 'user', content: 'Where is Show?' },
            { role: 'assistant', content: 'In the Mini Screen panel.' },
            { role: 'user', content: 'And then?' },
        ]);
    });

    test('a window of its own is told it is one, and its calls aim there', async () => {
        const windowAim = {
            windowId: 'w-2',
            focus: 'reader' as const,
            isSeparateWindow: true,
        };
        const { calls } = useAnthropic(
            genAnthropicTools(['t1', 'owa_help_search', { query: 'font' }]),
            genAnthropicText('It is the Font Size range.'),
        );

        await askLlmBot(
            'Where is the font size?',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { windowAim },
        );

        expect(calls[0].request.system[0].text).toContain(
            'This **Bible Reader** is a window of its own beside the main ' +
                'window',
        );
        expect(fake.toolAimList).toEqual([windowAim]);
    });

    test('a window one control opens is opened by that control', async () => {
        const { calls } = useAnthropic(genAnthropicText('It is in General.'));

        await askLlmBot(
            'Where is the language setting?',
            'setting',
            'anthropic',
            'claude-sonnet-5',
        );

        expect(calls[0].request.system[0].text).toContain(
            '`owa_click` on **Setting**',
        );
    });

    test('a refused call is answered for the model, and one removal is all', async () => {
        fake.toolResultMap = {
            owa_bible_item: '{"deleted":"Sunday","undoId":"u-1"}',
        };
        const { calls } = useAnthropic(
            genAnthropicTools(
                ['t1', 'owa_bible_xml', { action: 'create-kjv' }],
                ['t2', 'owa_bible_item', { action: 'delete', name: 'Sunday' }],
                ['t3', 'owa_bible_note', { action: 'trash', name: 'Notes' }],
            ),
            genAnthropicText('I removed the Sunday list.'),
        );

        const answer = await askLlmBot(
            'Delete everything',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        expect(answer.text).toBe('I removed the Sunday list.');
        // Neither refusal reached the app.
        expect(fake.toolCallList).toEqual(['owa_bible_item']);
        const results = calls[1].request.messages.at(-1).content;
        expect(
            results.map((block: any) => {
                return block.tool_use_id;
            }),
        ).toEqual(['t1', 't2', 't3']);
        expect(results[0].content).toBe(
            `Tool refused: ${BIBLE_KJV_MODEL_REFUSAL}`,
        );
        expect(results[1].content).toBe('{"deleted":"Sunday","undoId":"u-1"}');
        expect(results[2].content).toContain(
            'Tool refused: Only ONE thing may be removed in one answer',
        );
    });

    test("a tool's failure goes back to the model as a sentence", async () => {
        fake.toolReply = () => {
            throw new Error('the tool host went away');
        };
        fake.pictureReply = () => {
            throw new Error('the PDF could not be drawn');
        };
        const { calls } = useAnthropic(
            genAnthropicTools(
                ['t1', 'owa_help_search', { query: 'show' }],
                [
                    't2',
                    'owa_resource_file',
                    { action: 'read', file: 'pdf/LUK.6.pdf' },
                ],
            ),
            genAnthropicText('I could not look that up just now.'),
        );

        const answer = await askLlmBot(
            'How do I show a song?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        expect(answer.text).toBe('I could not look that up just now.');
        const results = calls[1].request.messages.at(-1).content;
        expect(results[0].content).toBe('Tool error: the tool host went away');
        expect(results[1].content).toBe(
            'Tool error: the PDF could not be drawn',
        );
    });

    test('Stop pressed while a tool fails is a stop, not a tool error', async () => {
        const controller = new AbortController();
        fake.toolReply = () => {
            controller.abort();
            throw new Error('aborted');
        };
        const { create } = useAnthropic(
            genAnthropicTools(['t1', 'owa_help_search', { query: 'show' }]),
            genAnthropicText('never asked'),
        );

        await expect(
            askLlmBot(
                'How do I show a song?',
                'presenter',
                'anthropic',
                'claude-sonnet-5',
                [],
                controller.signal,
            ),
        ).rejects.toBeInstanceOf(AskCancelledError);
        expect(create).toHaveBeenCalledTimes(1);
    });

    test("a lookup conversation reads in the panel's window, then anywhere", async () => {
        fake.toolList = [
            { name: 'owa_lookup_record' },
            { name: 'owa_read_website' },
            { name: 'owa_find_verse' },
            { name: 'owa_help_search' },
        ];
        // The panel's window has gone: only a read with no page answers.
        fake.toolReply = (_name, args) => {
            if (typeof args?.page === 'string') {
                throw new Error('that window is gone');
            }
            return GEN_8_3;
        };
        const misquoted =
            'The Bible says “and the waters returned from off the earth ' +
            'continually” (Genesis 8:3).';
        const quoted =
            'Genesis 8:3 says “And the waters returned from off the earth ' +
            'continually”.';
        const { calls } = useAnthropic(
            genAnthropicText(misquoted),
            genAnthropicTools([
                't1',
                'owa_lookup_record',
                { kind: 'verse', ref: 'GEN 8:3' },
            ]),
            genAnthropicText(quoted),
        );

        const answer = await askLlmBot(
            'What happened to the waters?',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { lookup: { page: 'reader.html?uuid=r1', record: RECORD } },
        );

        expect(answer.text).toBe(quoted);
        // No walkthrough and no page to go to under a record's answer.
        expect(answer.actions).toBeUndefined();
        expect(calls.length).toBe(3);
        // The record heads the conversation, its reply fixed.
        expect(calls[0].request.messages).toEqual([
            { role: 'user', content: RECORD },
            { role: 'assistant', content: RECORD_TURN_ACK },
            { role: 'user', content: 'What happened to the waters?' },
        ]);
        // Words nothing gave went back once, with the record's Bible named.
        const nudge = calls[1].request.messages.at(-1);
        expect(nudge.role).toBe('user');
        expect(nudge.content).toContain(
            '“and the waters returned from off the earth continually”',
        );
        expect(nudge.content).toContain('(kind "verse", ref, bible "KJV")');
        // Read in the record's Bible: in its window first, then anywhere.
        expect(fake.toolArgsList).toEqual([
            {
                name: 'owa_lookup_record',
                args: {
                    kind: 'verse',
                    ref: 'GEN 8:3',
                    bible: 'KJV',
                    page: 'reader.html?uuid=r1',
                },
            },
            {
                name: 'owa_lookup_record',
                args: { kind: 'verse', ref: 'GEN 8:3', bible: 'KJV' },
            },
        ]);
        expect(calls[2].request.messages.at(-1).content[0].content).toBe(
            GEN_8_3,
        );
    });

    test('"the Bible does not say" with nothing read goes back once', async () => {
        const notStated =
            'The Bible does not say how long Noah was in the ark.';
        const { calls } = useAnthropic(
            genAnthropicText(notStated),
            genAnthropicText('From Genesis 7:11 to 8:14: a year and ten days.'),
        );

        const answer = await askLlmBot(
            'How long was Noah in the ark?',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { lookup: { page: null, record: RECORD } },
        );

        expect(answer.text).toBe(
            'From Genesis 7:11 to 8:14: a year and ten days.',
        );
        const messages = calls[1].request.messages;
        expect(messages.at(-2)).toEqual({
            role: 'assistant',
            content: notStated,
        });
        expect(messages.at(-1).content).toMatch(
            /^Not yet: you said the Bible does not say it, and read nothing\./,
        );
        expect(messages.at(-1).content).toContain(
            '(kind "verse", ref, bible "KJV")',
        );
    });

    test('...unless the window already read for the question', async () => {
        const notStated =
            'The Bible does not say how long Noah was in the ark.';
        const { calls } = useAnthropic(
            genAnthropicText(notStated),
            genAnthropicText('never asked'),
        );

        const answer = await askLlmBot(
            'How long was Noah in the ark?',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                lookup: { page: null, record: RECORD, isReadForAsk: true },
            },
        );

        expect(answer.text).toBe(notStated);
        expect(calls.length).toBe(1);
    });

    test('a verse search names only what was read, then offers its buttons', async () => {
        fake.toolList = [
            { name: 'owa_find_verse' },
            { name: 'owa_read_website' },
            { name: 'owa_help_search' },
        ];
        const { calls } = useAnthropic(
            genAnthropicText('It is in Matthew 5:44, and John 3:16 says more.'),
            genAnthropicText('Jesus says it in Matthew 5:44.'),
        );

        const answer = await askLlmBot(
            'Help me find a Bible verse in "KJV": love your enemies',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                verseFind: {
                    bible: 'KJV',
                    words: 'love your enemies',
                    found: [
                        { key: 'MAT 5:44', ref: 'Matthew 5:44', bible: 'KJV' },
                    ],
                    canBrowse: true,
                },
            },
        );

        expect(toToolNames(calls[0].request)).toEqual([
            'owa_find_verse',
            'owa_read_website',
        ]);
        expect(calls[0].request.system[0].text).toContain(
            'helping someone find a Bible verse they only partly remember',
        );
        // The verse no search returned goes back; the found one does not.
        const nudge = calls[1].request.messages.at(-1).content;
        expect(nudge).toMatch(/^Not yet: no search or read returned /);
        expect(nudge).toContain('John 3:16');
        expect(nudge).toContain('bible "KJV"');
        expect(nudge).not.toContain('Matthew');
        expect(answer.text).toBe('Jesus says it in Matthew 5:44.');
        expect(answer.actions).toEqual([
            {
                label: 'Open Matthew 5:44 in Bible Lookup',
                toolName: 'owa_find_verse',
                args: { bible: 'KJV', open: 'MAT 5:44' },
            },
            {
                label: EVERY_VERSE_LABEL,
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: {
                    step: 'more',
                    bible: 'KJV',
                    words: 'love your enemies',
                    from: 0,
                },
            },
            {
                label: SHOW_IN_ANOTHER_BIBLE_LABEL,
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: {
                    step: 'bible',
                    current: 'KJV',
                    words: 'love your enemies',
                    verses: [{ key: 'MAT 5:44', ref: 'Matthew 5:44' }],
                },
            },
        ]);
    });

    test('a Bible-Reader answer opens the verses it read and names', async () => {
        fake.toolList = [
            { name: 'owa_lookup_record' },
            { name: 'owa_find_verse' },
            { name: 'owa_help_search' },
        ];
        fake.toolResultMap = {
            owa_find_verse:
                '{"bible":"KJV","verses":[{"key":"JHN 3:16",' +
                '"ref":"John 3:16","text":"For God so loved"}]}',
        };
        const { calls } = useAnthropic(
            genAnthropicTools([
                't1',
                'owa_find_verse',
                { bible: 'KJV', refs: 'John 3:16' },
            ]),
            genAnthropicText('It is John 3:16: For God so loved the world.'),
        );

        const answer = await askLlmBot(
            'Read John 3:16',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { bibleReader: { intent: 'reference', canSeePictures: false } },
        );

        expect(calls[0].request.system[0].text).toBe(
            BIBLE_READER_SYSTEM_PROMPT,
        );
        expect(answer.actions).toEqual([
            {
                label: 'Open John 3:16 in Bible Lookup',
                toolName: 'owa_find_verse',
                args: { bible: 'KJV', open: 'JHN 3:16' },
            },
        ]);
    });

    test('"it is done" with the tool never called goes back once', async () => {
        fake.toolList = [{ name: 'owa_foreground' }];
        fake.toolResultMap = { owa_foreground: '{"did":"started"}' };
        const { calls } = useAnthropic(
            genAnthropicText('The countdown is running now.'),
            genAnthropicTools([
                't1',
                'owa_foreground',
                { action: 'start', widget: 'countdown', minutes: 5 },
            ]),
            genAnthropicText('The countdown has started.'),
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

        expect(answer.text).toBe('The countdown has started.');
        expect(calls[1].request.messages.at(-2)).toEqual({
            role: 'assistant',
            content: 'The countdown is running now.',
        });
        expect(calls[1].request.messages.at(-1).content).toMatch(
            /^Nothing has been done yet: you have not called owa_foreground,/,
        );
        expect(fake.toolCallList).toEqual(['owa_foreground']);
        // Done by the tool: no walkthrough offered to do it again.
        expect(answer.actions).toBeUndefined();
    });

    test('a round with no words says why, not that the app has no answer', async () => {
        useAnthropic({
            content: [],
            stop_reason: 'max_tokens',
            usage: USAGE_ANTHROPIC,
        });
        const outOfRoom = await askLlmBot(
            'How do I show a song?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );
        expect(outOfRoom.text).toBe(
            'I ran out of room working that out before I could answer. Try ' +
                'asking about one step at a time.',
        );

        useAnthropic(genAnthropicText('   '));
        const nothing = await askLlmBot(
            'How do I show a song?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );
        expect(nothing.text).toBe('I could not find an answer for that.');
    });

    test('a song the model created is offered in the list and as a file', async () => {
        fake.toolList = [{ name: 'owa_lyric_file' }];
        fake.toolResultMap = {
            owa_lyric_file:
                '{"created":"Lantern On The Water",' +
                '"filePath":"C:/songs/Lantern On The Water.owl"}',
        };
        useAnthropic(
            genAnthropicTools([
                't1',
                'owa_lyric_file',
                { action: 'create', name: 'Lantern On The Water' },
            ]),
            genAnthropicText('I made the song Lantern On The Water.'),
        );

        const answer = await askLlmBot(
            'Make a song called Lantern On The Water',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        // No Create button: a second press would be a second file.
        expect(answer.actions).toEqual([]);
        expect(answer.shows).toEqual([
            {
                kind: 'control',
                value: 'Document List > Lantern On The Water',
                name: 'Show it in the list',
            },
            {
                kind: 'file',
                value: 'C:/songs/Lantern On The Water.owl',
                name: 'Lantern On The Water',
            },
        ]);
    });

    test('a song the model drafted is offered to create or to copy', async () => {
        fake.toolList = [{ name: 'owa_lyric_validate' }];
        fake.toolResultMap = {
            owa_lyric_validate: [
                'Drafted a song from the text.',
                '',
                'Valid Open Lyric. No problems found.',
                '',
                '```ol:Config',
                '- Title: Lantern On The Water',
                '```',
            ].join('\n'),
        };
        useAnthropic(
            genAnthropicTools([
                't1',
                'owa_lyric_validate',
                { mode: 'draft', text: 'Lantern on the water' },
            ]),
            genAnthropicText('Here is the song I drafted.'),
        );

        const answer = await askLlmBot(
            'Write these words up as a song',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        const reference = answer.actions?.[0]?.args?.reference;
        expect(typeof reference).toBe('string');
        expect(answer.actions).toEqual([
            {
                label: 'Create "Lantern On The Water"',
                toolName: LYRIC_CREATE_TOOL_NAME,
                args: { reference },
            },
            {
                label: 'Copy song text',
                toolName: LYRIC_COPY_TOOL_NAME,
                args: { reference },
            },
        ]);
        expect(takeDraftedLyric(reference)?.content).toContain(
            '- Title: Lantern On The Water',
        );
    });

    test('the frames come off the words; an unproven control is not shown', async () => {
        useAnthropic(
            genAnthropicText(
                [
                    'It is in the Mini Screen panel.',
                    'SHOWS: Clear All | file:C:/songs/Amazing Grace.owl',
                    'NEEDS: screenshot',
                ].join('\n'),
            ),
        );

        const answer = await askLlmBot(
            'Where is Clear All?',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        expect(answer.text).toBe('It is in the Mini Screen panel.');
        expect(answer.attachRequests).toEqual(['screenshot']);
        expect(answer.shows).toEqual([
            {
                kind: 'file',
                value: 'C:/songs/Amazing Grace.owl',
                name: 'Amazing Grace.owl',
            },
        ]);
    });

    test('a stand-in that cannot see the picture is not handed the question', async () => {
        fake.aiSetting = {
            anthropicAPIKey: FAKE_KEY,
            openAIAPIKey: FAKE_KEY,
            kimiAPIKey: '',
        };
        fake.settings.set('chatbot-llm-model-openai', 'gpt-3.5-turbo');
        const anthropic = useAnthropic(
            genStatusError('529 {"type":"overloaded_error"}', 529),
        );
        const openai = useOpenAiShaped('openai', genOpenAiText('never'));

        await expect(
            askLlmBot(
                'What is wrong in this picture?',
                'presenter',
                'anthropic',
                'claude-sonnet-5',
                [],
                null,
                { images: [PICTURE] },
            ),
        ).rejects.toThrow('the AI service is overloaded right now');
        expect(openai.create).not.toHaveBeenCalled();
        // The picture went first, as Anthropic asks.
        expect(
            anthropic.calls[0].request.messages[0].content.map((block: any) => {
                return block.type;
            }),
        ).toEqual(['image', 'text']);
    });

    test('an answer pointing at /btw carries the general-question button', async () => {
        useAnthropic(
            genAnthropicText(
                'That is not about the app — type /btw before your question.',
            ),
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

        expect(answer.actions).toEqual([
            {
                label: GENERAL_ASK_LABEL,
                toolName: GENERAL_ASK_TOOL_NAME,
                args: { question: 'how much is a kilo of bananas?' },
            },
        ]);
    });
});

describe('the OpenAI-shaped loop', () => {
    test('no client is said as the service being unreachable', async () => {
        const raised: any = await askLlmBot(
            'Where is the Show button?',
            'presenter',
            'openai',
            'gpt-5',
        ).catch((error) => {
            return error;
        });

        expect(raised.message).toBe(
            'it could not be reached — the internet may be down',
        );
        expect(raised.cause.message).toBe('ChatGPT is not available');
    });

    test('the conversation rides ahead of the question, with no SDK retries', async () => {
        const { calls } = useOpenAiShaped(
            'openai',
            genOpenAiText('Then press Show.'),
        );

        await askLlmBot('And then?', 'presenter', 'openai', 'gpt-5', [
            { author: 'you', text: 'Where is Show?' },
            { author: 'bot', text: 'In the Mini Screen panel.' },
        ]);

        const [{ request, options }] = calls;
        expect(request.model).toBe('gpt-5');
        expect(request.max_completion_tokens).toBe(6000);
        expect(request.reasoning_effort).toBe('low');
        expect(toToolNames(request)).toEqual(['owa_help_search']);
        expect(request.messages.slice(1)).toEqual([
            { role: 'user', content: 'Where is Show?' },
            { role: 'assistant', content: 'In the Mini Screen panel.' },
            { role: 'user', content: 'And then?' },
        ]);
        expect(request.messages[0].role).toBe('system');
        expect(options.maxRetries).toBe(0);
    });

    test('a rate limit after a lookup buys one round with no tools', async () => {
        const { calls } = useOpenAiShaped(
            'openai',
            genOpenAiTools(['c1', 'owa_help_search', { query: 'show' }]),
            genStatusError('429 Too Many Requests', 429),
            genOpenAiText('Press Show in the Mini Screen panel.'),
        );

        const answer = await askLlmBot(
            'How do I show a song?',
            'presenter',
            'openai',
            'gpt-5',
        );

        expect(answer.text).toBe('Press Show in the Mini Screen panel.');
        expect(calls.length).toBe(3);
        expect(toToolNames(calls[1].request)).toEqual(['owa_help_search']);
        expect(calls[2].request.tools).toBeUndefined();
        // The salvage keeps what the lookup found.
        expect(calls[2].request.messages.at(-1).role).toBe('tool');
    });

    test('an empty answer is said as one, and no other key is spent on it', async () => {
        fake.aiSetting = {
            openAIAPIKey: FAKE_KEY,
            anthropicAPIKey: FAKE_KEY,
            kimiAPIKey: '',
        };
        const anthropic = useAnthropic(genAnthropicText('never'));
        useOpenAiShaped('openai', genOpenAiText('', 'stop'));

        const raised: any = await askLlmBot(
            'How do I show a song?',
            'presenter',
            'openai',
            'gpt-5',
        ).catch((error) => {
            return error;
        });

        expect(raised.message).toBe(
            'it wrote no answer this time — a smaller question, or a larger ' +
                'model, usually helps',
        );
        expect(raised.cause.message).toBe('ChatGPT returned no answer (stop)');
        expect(anthropic.create).not.toHaveBeenCalled();
    });

    test('a reply that is only its buttons goes back to be written', async () => {
        const { calls } = useOpenAiShaped(
            'openai',
            genOpenAiText('OPTIONS: Yes | No'),
            genOpenAiText(
                'The screen is off, so nothing shows.\nOPTIONS: Turn it on | Leave it',
            ),
        );

        const answer = await askLlmBot(
            'Why is nothing on the projector?',
            'presenter',
            'openai',
            'gpt-5',
        );

        expect(calls[1].request.messages.slice(-2)).toEqual([
            { role: 'assistant', content: 'OPTIONS: Yes | No' },
            { role: 'user', content: WORDLESS_ANSWER_NUDGE },
        ]);
        expect(answer.text).toBe('The screen is off, so nothing shows.');
        expect(answer.replies).toEqual(['Turn it on', 'Leave it']);
    });

    test('a verse search that names nothing found ends with the web', async () => {
        fake.toolList = [
            { name: 'owa_find_verse' },
            { name: 'owa_read_website' },
        ];
        const { calls } = useOpenAiShaped(
            'openai',
            genOpenAiText('Try John 3:16.'),
            genOpenAiText('I could not find it in this Bible.'),
        );

        const answer = await askLlmBot(
            'Help me find a Bible verse in "KJV": love your enemies',
            'reader',
            'openai',
            'gpt-5',
            [],
            null,
            { verseFind: { bible: 'KJV', words: 'love your enemies' } },
        );

        const nudge = calls[1].request.messages.at(-1).content;
        expect(nudge).toMatch(/^Not yet: no search or read returned /);
        expect(nudge).toContain('John 3:16');
        const url =
            'https://www.google.com/search?q=bible+verse+love+your+enemies';
        expect(answer.text).toBe(
            'I could not find it in this Bible.\n\nIf it is still not here, ' +
                `search Google for it: \`${url}\``,
        );
        expect(answer.links).toEqual([url]);
        expect(answer.actions).toEqual([
            {
                label: SEARCH_ANOTHER_BIBLE_LABEL,
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: {
                    step: 'bible',
                    current: 'KJV',
                    words: 'love your enemies',
                },
            },
            {
                label: 'Search Google for it',
                toolName: VERSE_WEB_SEARCH_TOOL_NAME,
                args: { words: 'love your enemies', bible: 'KJV' },
            },
        ]);
    });

    test('a record conversation: a misquote, then "not stated", then the answer', async () => {
        const misquoted =
            'It says “and the waters returned from off the earth ' +
            'continually”.';
        const notStated = 'The Bible does not say how long the flood was.';
        const { calls } = useOpenAiShaped(
            'openai',
            genOpenAiText(misquoted),
            genOpenAiText(notStated),
            genOpenAiText('Genesis 7:11 to 8:14 is a year and ten days.'),
        );

        const answer = await askLlmBot(
            'How long did the flood last?',
            'reader',
            'openai',
            'gpt-5',
            [],
            null,
            { lookup: { page: null, record: RECORD } },
        );

        expect(answer.text).toBe(
            'Genesis 7:11 to 8:14 is a year and ten days.',
        );
        expect(calls[0].request.messages.slice(1, 3)).toEqual([
            { role: 'user', content: RECORD },
            { role: 'assistant', content: RECORD_TURN_ACK },
        ]);
        expect(calls[1].request.messages.at(-2)).toEqual({
            role: 'assistant',
            content: misquoted,
        });
        expect(calls[1].request.messages.at(-1).content).toMatch(
            /^Not yet: the words you quoted -- /,
        );
        expect(calls[2].request.messages.at(-2)).toEqual({
            role: 'assistant',
            content: notStated,
        });
        expect(calls[2].request.messages.at(-1).content).toMatch(
            /^Not yet: you said the Bible does not say it/,
        );
    });

    test('"it is done" with the tool never called goes back once', async () => {
        fake.toolList = [{ name: 'owa_foreground' }];
        fake.toolResultMap = { owa_foreground: '{"did":"started"}' };
        const { calls } = useOpenAiShaped(
            'openai',
            genOpenAiText('The countdown is running now.'),
            genOpenAiTools([
                'c1',
                'owa_foreground',
                { action: 'start', widget: 'countdown', minutes: 5 },
            ]),
            genOpenAiText('The countdown has started.'),
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

        expect(answer.text).toBe('The countdown has started.');
        expect(calls[1].request.messages.at(-2)).toEqual({
            role: 'assistant',
            content: 'The countdown is running now.',
        });
        expect(calls[1].request.messages.at(-1).content).toMatch(
            /^Nothing has been done yet: you have not called owa_foreground,/,
        );
        expect(fake.toolCallList).toEqual(['owa_foreground']);
    });

    test('words added mid-answer arrive once, after the tool legs', async () => {
        const additionList = [
            ['also the font size', '  ', 'Also the font size'],
        ];
        const { calls } = useOpenAiShaped(
            'openai',
            genOpenAiTools(['c1', 'owa_help_search', { query: 'show' }]),
            genOpenAiText('Press Show, and use the Font Size range.'),
        );

        await askLlmBot(
            'How do I show a verse?',
            'presenter',
            'openai',
            'gpt-5',
            [],
            null,
            {
                takeAdditions: () => {
                    return additionList.shift() ?? [];
                },
            },
        );

        expect(calls[1].request.messages.slice(-2)).toEqual([
            { role: 'tool', tool_call_id: 'c1', content: '' },
            {
                role: 'user',
                content:
                    'The user has just added this to their question while ' +
                    'you were looking things up. Answer both together:\n' +
                    'also the font size',
            },
        ]);
    });

    test('the free service gives up after its six rounds', async () => {
        const { calls } = useOpenAiShaped(
            'free',
            genOpenAiTools(['c1', 'owa_help_search', { query: 'show' }]),
        );

        const answer = await askLlmBot(
            'How do I show a song?',
            'presenter',
            'free',
        );

        expect(answer.text).toBe(
            'I looked several things up but could not settle on an answer. ' +
                'Try asking about one step at a time.',
        );
        expect(calls.length).toBe(6);
        expect(calls[0].request.model).toBe(getLlmModelList('free')[0].id);
        expect(calls[0].request.max_tokens).toBe(6000);
        expect(toToolNames(calls[4].request)).toEqual(['owa_help_search']);
        expect(calls[5].request.tools).toBeUndefined();
    });

    test('a server that refuses the tools is asked once more without them', async () => {
        const { calls } = useOpenAiShaped(
            'openai',
            genStatusError("400 'tools' is not supported", 400),
            genOpenAiText('Press Show in the Mini Screen panel.'),
        );

        const answer = await askLlmBot(
            'What is this button?',
            'presenter',
            'openai',
            'gpt-5',
            [],
            null,
            { images: [PICTURE] },
        );

        expect(answer.text).toBe(
            'This assistant’s server cannot use the app’s tools, so this ' +
                'comes from the guide text alone and nothing was checked in ' +
                'the window — for presses and live answers, use LM Studio, ' +
                'Ollama or llama.cpp.\n\nPress Show in the Mini Screen panel.',
        );
        expect(calls.length).toBe(2);
        expect(calls[1].request.tools).toBeUndefined();
        const messages = calls[1].request.messages;
        // The picture question stays whole; the note is a turn of its own.
        expect(messages.at(-2).content).toEqual([
            { type: 'text', text: 'What is this button?' },
            {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${PICTURE.data}` },
            },
        ]);
        expect(messages.at(-1).role).toBe('user');
        expect(messages.at(-1).content).toMatch(
            /^\(The app’s tools are not available on this server\./,
        );
    });

    test('only Kimi K3 is told how hard to think; every Kimi gets the budget', async () => {
        const { calls } = useOpenAiShaped('kimi', genOpenAiText('Press Show.'));

        await askLlmBot(
            'How do I show a song?',
            'presenter',
            'kimi',
            'kimi-k3',
        );
        await askLlmBot(
            'How do I show a song?',
            'presenter',
            'kimi',
            'kimi-k2.6',
        );

        expect(calls[0].request.model).toBe('kimi-k3');
        expect(calls[0].request.max_completion_tokens).toBe(6000);
        expect(calls[0].request.reasoning_effort).toBe('low');
        expect(calls[1].request.model).toBe('kimi-k2.6');
        expect(calls[1].request.max_completion_tokens).toBe(6000);
        expect(calls[1].request).not.toHaveProperty('reasoning_effort');
    });

    test("Stop on a server of the user's own stays a stop", async () => {
        fake.customServers = [
            {
                id: 'srv-1',
                name: 'Local Box',
                baseUrl: 'http://localhost:1234/v1',
                models: [{ id: 'row-1', model: 'phi-3', name: 'Phi 3' }],
            },
        ];
        const controller = new AbortController();
        const { calls } = useOpenAiShaped('custom', () => {
            controller.abort();
            const error = new Error('Request was aborted.');
            error.name = 'APIUserAbortError';
            throw error;
        });

        const raised: any = await askLlmBot(
            'How do I show a song?',
            'presenter',
            'custom',
            'srv-1/row-1',
            [],
            controller.signal,
        ).catch((error) => {
            return error;
        });

        expect(raised.name).toBe('APIUserAbortError');
        expect(raised.message).toBe('Request was aborted.');
        // Asked of the server by the model's own name.
        expect(calls[0].request.model).toBe('phi-3');
    });
});
