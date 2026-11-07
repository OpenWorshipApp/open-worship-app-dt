import { describe, expect, test, vi } from 'vitest';

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
import {
    findNotStatedNudge,
    toQuoteKey,
    genToolWatch,
} from '../../../../../../chatbot/llmBotHelpers';

// The card is one line of plain text in a shadow root, so whatever the model
// wrote for a chat window has to be flattened before it is drawn there.

describe('a passage chat’s answer', () => {
    // French's own words for "the Bible does not say" (`lookupWords.notStated`).
    test('"the Bible does not say", written in French, goes back once', () => {
        const watch = genToolWatch();
        watch.quoteSources = [toQuoteKey('Record: {"bible":"LSG"}')];
        watch.quoteBible = 'LSG';
        expect(
            findNotStatedNudge('Le texte ne précise pas la durée.', watch),
        ).not.toBeNull();
    });
});
