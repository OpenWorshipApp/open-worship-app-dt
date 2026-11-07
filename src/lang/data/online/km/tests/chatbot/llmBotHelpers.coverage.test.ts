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
    getKimiInstance: () => fake.kimi,
}));
vi.mock('../../../../../../helper/ai/bedrockHelpers', () => ({
    getBedrockInstance: () => fake.bedrock,
}));
vi.mock('../../../../../../helper/ai/bedrockClaudeHelpers', () => ({
    getBedrockClaudeInstance: () => fake.bedrockClaude,
}));
vi.mock('../../../../../../helper/ai/customServerHelpers', () => ({
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
vi.mock('../../../../../../helper/ai/customServerClientHelpers', () => ({
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
vi.mock('../../../../../../helper/ai/freeHelpers', () => ({
    FREE_SERVICE_MAP: {
        kilo: { label: 'Kilo', homeUrl: 'https://kilo.ai' },
    },
    getFreeInstance: () => fake.free,
}));
vi.mock('../../../../../../helper/settingHelpers', () => ({
    getSetting: (key: string) => {
        return settingMap.get(key) ?? null;
    },
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));
// `helpBotHelpers` logs a failed press, and `loggerHelpers` reaches
// `appProvider` -- `document` at module scope, which this node suite has not.
vi.mock('../../../../../../helper/loggerHelpers', () => ({
    appError: () => {},
}));
vi.mock('../../../../../../chatbot/mcpClient', () => ({
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

import { resetSpendGuardForTests } from '../../../../../../chatbot/spendGuardHelpers';
import { RUNAWAY_ANSWER_NUDGE } from '../../../../../../chatbot/llmBotHelpers';
import {
    askLlmBot,
    resetReasoningOffMemoryForTests,
    toGuideRescueAnswer,
} from '../../../../../../chatbot/llmBotHelpers';

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

describe('the tool watch and the rescue words', () => {
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
});

describe('the Anthropic loop', () => {
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
});

describe('the OpenAI-shaped loop', () => {
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
});

describe('an answer, not a translation', () => {
    // The translator's own words are left as they come back (above); the
    // same words written as an ANSWER in a Khmer window are cleaned of the
    // English gloss in brackets after them. The screen's language decides
    // (`appLang`, else `<html lang>`): an English window keeps the bracket.
    test('the same words as an answer lose the English in brackets', async () => {
        const askAnswer = async (appLang: string) => {
            useAnthropic([anthropicText('សួស្តី (Hello)')], 'anthropic');
            return await askLlmBot(
                'Hello',
                'presenter',
                'anthropic',
                'claude-sonnet-5',
                [],
                null,
                { isGeneral: true, replyLang: 'km', appLang },
            );
        };

        expect((await askAnswer('km')).text).toBe('សួស្តី');
        expect((await askAnswer('en')).text).toBe('សួស្តី (Hello)');
    });
});
