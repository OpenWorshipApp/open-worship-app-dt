import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The document conversations' tool doors in `runMcpToolCall` -- a song, a
// slide document, a presenting flow and a Bible note each named by its NAME
// and turned into its path by the window -- and what goes under the answer
// once one was changed. The same mock surface as the coverage suite beside
// it: fake SDK clients, a tool host that records every call, a setting map.
const { fake, settingMap } = vi.hoisted(() => ({
    fake: {
        anthropic: null as any,
        toolList: [] as { name: string }[],
        // Every call the loop made of the tool host, in order.
        toolCallList: [] as { name: string; args: any }[],
        // What a tool answers, by name, when no `answerTool` is set.
        toolResultMap: {} as Record<string, string>,
        answerTool: null as null | ((name: string, args: any) => string),
    },
    settingMap: new Map<string, string>(),
}));

vi.mock('../helper/ai/aiHelpers', () => ({
    getAISetting: () => {
        return {
            openAIAPIKey: '',
            anthropicAPIKey: 'sk-ant-test',
            kimiAPIKey: '',
        };
    },
    getBedrockRegion: () => 'us-west-2',
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
vi.mock('../helper/ai/bedrockHelpers', () => ({
    getBedrockInstance: () => null,
}));
vi.mock('../helper/ai/bedrockClaudeHelpers', () => ({
    getBedrockClaudeInstance: () => null,
}));
vi.mock('../helper/ai/customServerHelpers', () => ({
    getCustomServers: () => [],
    getAllCustomServers: () => [],
    getUsableCustomServers: () => [],
    readCustomServerModelInfo: async () => null,
    findCustomModelInfo: () => null,
}));
vi.mock('../helper/ai/customServerClientHelpers', () => ({
    genContextTooSmallText: (loadedContext: number | null) => {
        return `context ${loadedContext} is too small`;
    },
    genContextCutText: (loadedContext: number) => {
        return `answered from a question cut to ${loadedContext}`;
    },
    getCustomServerInstance: () => null,
    checkIsToolsRefused: () => false,
    toCustomServerFailure: () => null,
}));
vi.mock('../helper/ai/freeHelpers', () => ({
    FREE_SERVICE_MAP: {
        kilo: { label: 'Kilo', homeUrl: 'https://kilo.ai' },
    },
    getFreeInstance: () => null,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => {
        return settingMap.get(key) ?? null;
    },
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));
// `loggerHelpers` reaches `appProvider` -- `document` at module scope.
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
        return { text: fake.toolResultMap[name] ?? '', pictures: [] };
    },
    listTools: async () => {
        return fake.toolList;
    },
    parseToolJson: (text: string) => {
        try {
            return JSON.parse(text);
        } catch (_error) {
            return null;
        }
    },
}));

import { resetSpendGuardForTests } from './spendGuardHelpers';
import {
    applyToolWatch,
    askLlmBot,
    genToolWatch,
    resetReasoningOffMemoryForTests,
} from './llmBotHelpers';
import { LYRIC_SYSTEM_PROMPT } from './lyricChatHelpers';
import { SLIDE_SYSTEM_PROMPT } from './slideChatHelpers';
import { FLOW_SYSTEM_PROMPT } from './flowChatHelpers';
import {
    STUDY_CREATE_TOOL_NAME,
    STUDY_HELD_NOTE,
    STUDY_KEEP_ANSWER_HINT,
    STUDY_KEPT_ANSWER_CHANGE_NOTE,
    STUDY_KEPT_ANSWER_NOTE,
    STUDY_NO_ANSWER_REFUSAL,
    STUDY_PREVIEW_TOOL_NAME,
    STUDY_RENAME_TOOL_NAME,
    STUDY_SAVE_MODEL_REFUSAL,
} from './studyFileChatHelpers';

function snapshotOf(request: any) {
    return JSON.parse(JSON.stringify(request));
}

// An Anthropic client whose rounds are answered in turn by `rounds`; each
// request is kept as it was when it was sent.
function useAnthropic(rounds: any[]) {
    const sentList: any[] = [];
    const create = vi.fn(async (request: any) => {
        sentList.push(snapshotOf(request));
        return rounds.shift();
    });
    fake.anthropic = { messages: { create } };
    return { create, sentList };
}

function anthropicText(text: string) {
    return {
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
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

// The tool results a round sent back, in the order of the calls.
function readToolResults(sent: any): string[] {
    const last = sent.messages[sent.messages.length - 1];
    return last.content
        .filter((block: any) => {
            return block.type === 'tool_result';
        })
        .map((block: any) => {
            return typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content);
        });
}

function changed(name: string, undoId: string) {
    return JSON.stringify({ name, isChanged: true, undoId });
}

beforeEach(() => {
    settingMap.clear();
    fake.anthropic = null;
    fake.toolList = [];
    fake.toolCallList = [];
    fake.toolResultMap = {};
    fake.answerTool = null;
    resetSpendGuardForTests();
    resetReasoningOffMemoryForTests();
});
afterEach(() => {
    resetSpendGuardForTests();
});

describe('a document tool outside the conversation it belongs to', () => {
    // The song, flow, slide and note tools change a file the PERSON
    // attached; in an ordinary question nothing is attached, so a model
    // that names one anyway is told what to do instead, and the tool host
    // is never reached.
    test('each is refused with its own sentence and nothing is called', async () => {
        fake.toolList = [{ name: 'owa_help_search' }];
        const { sentList } = useAnthropic([
            anthropicToolUse(
                {
                    name: 'owa_lyric_edit',
                    input: { action: 'set-lines', file: 'Still' },
                },
                {
                    name: 'owa_presenting_flow_edit',
                    input: { action: 'update-lines', file: 'Sunday' },
                },
                {
                    name: 'owa_slide_edit',
                    input: { action: 'update', file: 'Easter' },
                },
                {
                    name: 'owa_note_edit',
                    input: { action: 'edit', note: 'Grace' },
                },
            ),
            anthropicText('I cannot change those from here.'),
        ]);

        await askLlmBot(
            'Change my song, my flow, my slides and my note',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        const results = readToolResults(sentList[1]);
        expect(results).toHaveLength(4);
        expect(results[0]).toMatch(
            /^Tool refused: owa_lyric_edit changes a song the person attached/,
        );
        expect(results[0]).toContain('or use owa_lyric_file.');
        expect(results[1]).toMatch(
            /^Tool refused: owa_presenting_flow_edit changes a presenting flow/,
        );
        expect(results[1]).toContain('or use owa_presenting_flow.');
        expect(results[2]).toMatch(
            /^Tool refused: owa_slide_edit changes a slide document/,
        );
        expect(results[2]).toContain('or use owa_slide_file.');
        expect(results[3]).toMatch(
            /^Tool refused: owa_note_edit changes a Bible note/,
        );
        expect(results[3]).toContain('or use owa_bible_note.');
        expect(fake.toolCallList).toEqual([]);
    });
});

// A study file (EC-464): the model drafts it, the person saves it.
describe('a study file', () => {
    test('saving and previewing are refused to the model and never reach the tool host', async () => {
        const { sentList } = useAnthropic([
            anthropicToolUse(
                {
                    name: 'owa_resource_file',
                    input: { action: 'save', name: 'MAT.3.3-7 A.md' },
                },
                {
                    name: 'owa_resource_file',
                    input: { action: 'preview', name: 'MAT.3.3-7 A.md' },
                },
            ),
            anthropicText('Press Create to save it.'),
        ]);

        await askLlmBot(
            'Save the study for Matthew 3:3-7',
            'reader',
            'anthropic',
            'claude-sonnet-5',
        );

        const results = readToolResults(sentList[1]);
        expect(results).toHaveLength(2);
        for (const result of results) {
            expect(result).toBe(`Tool refused: ${STUDY_SAVE_MODEL_REFUSAL}`);
        }
        expect(fake.toolCallList).toEqual([]);
    });

    test('a draft is held by the window: the model sees no study and the answer carries the card', async () => {
        const content =
            '# The Voice\n\nA study of the voice in the wilderness.';
        fake.toolResultMap.owa_resource_file = JSON.stringify({
            drafted: true,
            isChange: false,
            name: 'MAT.3.3-7 The Voice.md',
            passage: 'Matthew 3:3-7',
            bible: 'KJV',
            diagramCount: 0,
            warnings: [],
            content,
        });
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    ref: 'Matthew 3:3-7',
                    title: 'The Voice',
                    content: 'A study of the voice in the wilderness.',
                },
            }),
            anthropicText('It is drafted. Press Create to save it.'),
        ]);

        const answer = await askLlmBot(
            'Make a study file for Matthew 3:3-7',
            'reader',
            'anthropic',
            'claude-sonnet-5',
        );

        expect(fake.toolCallList).toHaveLength(1);
        expect(fake.toolCallList[0].args.action).toBe('draft');
        const [seen] = readToolResults(sentList[1]);
        expect(seen).not.toContain('voice in the wilderness');
        expect(seen).toContain(`[held by the window: ${content.length}`);
        expect(seen).toContain(STUDY_HELD_NOTE);
        expect(
            answer.actions?.map((action) => {
                return [action.label, action.toolName];
            }),
        ).toEqual([
            ['Create "MAT.3.3-7 The Voice.md"', STUDY_CREATE_TOOL_NAME],
            ['Preview', STUDY_PREVIEW_TOOL_NAME],
            ['Change the name', STUDY_RENAME_TOOL_NAME],
        ]);
    });

    // EC-466: "save that as a study file" keeps the answer that was read.
    const ANSWER_ABOVE =
        '# God So Loved\n\nJohn 3:16 tells why Jesus came: God gave his ' +
        'only Son, so that whoever believes has eternal life.\n\n' +
        'Would you like me to draw a timeline of it?';
    const ANSWER_BODY =
        'John 3:16 tells why Jesus came: God gave his only Son, so that ' +
        'whoever believes has eternal life.';

    test('@answer is the answer above, put in word for word by the window', async () => {
        fake.toolResultMap.owa_resource_file = JSON.stringify({
            drafted: true,
            isChange: false,
            name: 'JHN.3.16 God So Loved.md',
            passage: 'John 3:16',
            bible: 'KJV',
            diagramCount: 0,
            warnings: [],
            content: `# God So Loved\n\n${ANSWER_BODY}`,
        });
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    ref: 'John 3:16',
                    title: 'God So Loved',
                    content: '@answer',
                },
            }),
            anthropicText('It is drafted. Press Create to save it.'),
        ]);

        const answer = await askLlmBot(
            'save that as a study file',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { answerAbove: ANSWER_ABOVE },
        );

        expect(fake.toolCallList).toHaveLength(1);
        expect(fake.toolCallList[0].args).toEqual({
            action: 'draft',
            ref: 'John 3:16',
            title: 'God So Loved',
            content: ANSWER_BODY,
        });
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain(STUDY_HELD_NOTE);
        expect(answer.actions?.[0]?.label).toBe(
            'Create "JHN.3.16 God So Loved.md"',
        );
    });

    test('@answer appended to a study file is the answer above too', async () => {
        fake.toolResultMap.owa_resource_file = JSON.stringify({
            drafted: true,
            isChange: true,
            name: 'JHN.3.16 God So Loved.md',
            file: 'JHN.3.16 God So Loved.md',
            hash: 'h-1',
            passage: 'John 3:16',
            bible: 'KJV',
            diagramCount: 0,
            change: 'added at the end',
            warnings: [],
            content: `# God So Loved\n\nWords.\n\n${ANSWER_BODY}`,
        });
        useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: 'JHN.3.16 God So Loved.md',
                    append: '"@answer"',
                },
            }),
            anthropicText('Press Save changes to write it.'),
        ]);

        await askLlmBot(
            'add that to my study file',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { answerAbove: ANSWER_ABOVE },
        );

        expect(fake.toolCallList).toHaveLength(1);
        expect(fake.toolCallList[0].args.append).toBe(ANSWER_BODY);
    });

    test('@answer with no answer above is refused and nothing is drafted', async () => {
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    ref: 'John 3:16',
                    title: 'God So Loved',
                    content: '@answer',
                },
            }),
            anthropicText('Which passage shall I write about?'),
        ]);

        const answer = await askLlmBot(
            'save that as a study file',
            'reader',
            'anthropic',
            'claude-sonnet-5',
        );

        expect(readToolResults(sentList[1])).toEqual([
            `Tool refused: ${STUDY_NO_ANSWER_REFUSAL}`,
        ]);
        expect(fake.toolCallList).toEqual([]);
        expect(answer.actions ?? []).toEqual([]);
    });

    // Seen live: told only the marker, gemma4:cloud drafted a study of its
    // own under "save that as a study file". Words read so are the window's.
    function readAskedText(sent: any): string {
        const last = sent.messages[sent.messages.length - 1];
        return typeof last.content === 'string'
            ? last.content
            : last.content
                  .filter((block: any) => {
                      return block.type === 'text';
                  })
                  .map((block: any) => {
                      return block.text;
                  })
                  .join('\n');
    }

    test('words that keep the answer put it in whatever the model wrote, and the model is told so', async () => {
        fake.toolList = [{ name: 'owa_resource_file' }];
        fake.toolResultMap.owa_resource_file = JSON.stringify({
            drafted: true,
            isChange: false,
            name: 'JHN.3.16 God So Loved.md',
            passage: 'John 3:16',
            bible: 'KJV',
            diagramCount: 0,
            warnings: [],
            content: `# God So Loved\n\n${ANSWER_BODY}`,
        });
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    ref: 'John 3:16',
                    title: 'God So Loved',
                    content: '## Background\n\nA study of its own.',
                },
            }),
            anthropicText('Your answer is ready. Press Create to save it.'),
        ]);

        const answer = await askLlmBot(
            'save that as a study file',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { study: {}, answerAbove: ANSWER_ABOVE, keepAnswer: true },
        );

        expect(readAskedText(sentList[0])).toContain(STUDY_KEEP_ANSWER_HINT);
        expect(fake.toolCallList).toHaveLength(1);
        expect(fake.toolCallList[0].args).toEqual({
            action: 'draft',
            ref: 'John 3:16',
            title: 'God So Loved',
            content: ANSWER_BODY,
        });
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain(STUDY_KEPT_ANSWER_NOTE);
        expect(seen).not.toContain(STUDY_HELD_NOTE);
        expect(answer.actions?.[0]?.label).toBe(
            'Create "JHN.3.16 God So Loved.md"',
        );
    });

    test('kept into a study file being changed, the answer is added at its end, never its whole text', async () => {
        fake.toolList = [{ name: 'owa_resource_file' }];
        fake.toolResultMap.owa_resource_file = JSON.stringify({
            drafted: true,
            isChange: true,
            name: 'JHN.3.16 God So Loved.md',
            file: 'JHN.3.16 God So Loved.md',
            hash: 'h-1',
            passage: 'John 3:16',
            bible: 'KJV',
            diagramCount: 0,
            change: 'added at the end',
            warnings: [],
            content: `# God So Loved\n\nWords.\n\n${ANSWER_BODY}`,
        });
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: 'JHN.3.16 God So Loved.md',
                    content: 'The whole study written again.',
                },
            }),
            anthropicText('Press Save changes to write it.'),
        ]);

        await askLlmBot(
            'add that to my study',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { study: {}, answerAbove: ANSWER_ABOVE, keepAnswer: true },
        );

        expect(fake.toolCallList[0].args).toEqual({
            action: 'draft',
            file: 'JHN.3.16 God So Loved.md',
            append: ANSWER_BODY,
        });
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain(STUDY_KEPT_ANSWER_CHANGE_NOTE);
    });

    test("without words that keep it, the model's own study stands and no hint rides the ask", async () => {
        fake.toolList = [{ name: 'owa_resource_file' }];
        fake.toolResultMap.owa_resource_file = JSON.stringify({
            drafted: true,
            isChange: false,
            name: 'JHN.3.16 God So Loved.md',
            passage: 'John 3:16',
            bible: 'KJV',
            diagramCount: 0,
            warnings: [],
            content: '# God So Loved\n\nA study of its own.',
        });
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    ref: 'John 3:16',
                    title: 'God So Loved',
                    content: 'A study of its own.',
                },
            }),
            anthropicText('Press Create to save it.'),
        ]);

        await askLlmBot(
            'make a study file for John 3:16',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { study: {}, answerAbove: ANSWER_ABOVE },
        );

        expect(readAskedText(sentList[0])).not.toContain(
            STUDY_KEEP_ANSWER_HINT,
        );
        expect(fake.toolCallList[0].args.content).toBe('A study of its own.');
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain(STUDY_HELD_NOTE);
    });
});

describe('a song conversation', () => {
    const song = { name: 'Still', filePath: 'C:\\songs\\Still.owl' };

    test('the song is named by its name, a path is refused, and the change can be undone', async () => {
        fake.toolList = [{ name: 'owa_lyric_edit' }];
        fake.toolResultMap.owa_lyric_edit = changed('Still', 'u-1');
        const { sentList } = useAnthropic([
            anthropicToolUse(
                {
                    name: 'owa_lyric_edit',
                    input: {
                        action: 'set-lines',
                        file: 'C:\\songs\\Other.owl',
                    },
                },
                {
                    name: 'owa_lyric_edit',
                    input: { action: 'set-lines', file: 'still', part: 'v2' },
                },
            ),
            anthropicText('I changed the second verse of "Still".'),
        ]);

        const answer = await askLlmBot(
            'Change the second verse',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { lyric: { files: [song] } },
        );

        // The song's own prompt, not the app's.
        expect(sentList[0].system[0].text).toBe(LYRIC_SYSTEM_PROMPT);
        const results = readToolResults(sentList[1]);
        expect(results[0]).toBe(
            'Tool refused: Name the song as it is attached, by its name -- ' +
                'never a path.',
        );
        // Only the call by name reached the host, with the attached path.
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_lyric_edit',
                args: {
                    action: 'set-lines',
                    file: 'C:\\songs\\Still.owl',
                    part: 'v2',
                },
            },
        ]);
        expect(answer.actions).toEqual([
            {
                label: 'Undo this change',
                toolName: 'lyric-undo',
                args: { id: 'u-1', name: 'Still' },
            },
        ]);
        expect(answer.shows).toContainEqual({
            kind: 'control',
            value: 'Document List > Still',
            name: 'Show it in the list',
        });
    });

    test('a change that left no undo id offers no undo, only the row', async () => {
        fake.toolList = [{ name: 'owa_lyric_edit' }];
        fake.toolResultMap.owa_lyric_edit = JSON.stringify({
            name: 'Still',
            isChanged: true,
        });
        useAnthropic([
            anthropicToolUse({
                name: 'owa_lyric_edit',
                input: { action: 'set-lines' },
            }),
            anthropicText('Done.'),
        ]);

        const answer = await askLlmBot(
            'Fix the typo',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { lyric: { files: [song] } },
        );

        // No file named and one song attached: that one.
        expect(fake.toolCallList[0].args.file).toBe('C:\\songs\\Still.owl');
        expect(answer.actions).toEqual([]);
        expect(answer.shows).toContainEqual({
            kind: 'control',
            value: 'Document List > Still',
            name: 'Show it in the list',
        });
    });
});

describe('a slide document conversation', () => {
    const doc = { name: 'Easter', filePath: 'C:\\slides\\Easter.ows' };

    test('two changes of one document are put back by one press', async () => {
        fake.toolList = [{ name: 'owa_slide_edit' }];
        const undoIdList = ['u-2', 'u-3'];
        fake.answerTool = (_name, args) => {
            if (args.action === 'slides') {
                return JSON.stringify({ name: 'Easter', slides: [] });
            }
            return changed('Easter', undoIdList.shift()!);
        };
        const { sentList } = useAnthropic([
            anthropicToolUse(
                {
                    name: 'owa_slide_edit',
                    input: { action: 'slides', file: 'D:/x/Easter.ows' },
                },
                { name: 'owa_slide_edit', input: { action: 'slides' } },
                {
                    name: 'owa_slide_edit',
                    input: { action: 'add-slides', file: 'Easter' },
                },
                {
                    name: 'owa_slide_edit',
                    input: { action: 'background', file: 'Easter' },
                },
            ),
            anthropicText('I added the slides and put a background behind.'),
        ]);

        const answer = await askLlmBot(
            'Add two slides with a background',
            'appDocumentEditor',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { slide: { files: [doc] } },
        );

        expect(sentList[0].system[0].text).toBe(SLIDE_SYSTEM_PROMPT);
        expect(readToolResults(sentList[1])[0]).toBe(
            'Tool refused: Name the slide document as it is attached, by ' +
                'its name -- never a path.',
        );
        expect(
            fake.toolCallList.map((call) => {
                return [call.args.action, call.args.file];
            }),
        ).toEqual([
            ['slides', 'C:\\slides\\Easter.ows'],
            ['add-slides', 'C:\\slides\\Easter.ows'],
            ['background', 'C:\\slides\\Easter.ows'],
        ]);
        // The read changed nothing; both changes are undone together.
        expect(answer.actions).toEqual([
            {
                label: 'Undo this change',
                toolName: 'lyric-undo',
                args: { id: 'u-3', name: 'Easter', ids: ['u-2', 'u-3'] },
            },
        ]);
        expect(answer.shows).toContainEqual({
            kind: 'control',
            value: 'Document List > Easter',
            name: 'Show it in the list',
        });
    });
});

describe('a presenting flow conversation', () => {
    const files = [
        { name: 'Sunday', filePath: 'C:\\flows\\Sunday.owpf' },
        { name: 'Evening', filePath: 'C:\\flows\\Evening.owpf' },
    ];

    test('with two flows attached a call must say which; the change rings its row in the flows list', async () => {
        fake.toolList = [{ name: 'owa_presenting_flow_edit' }];
        fake.answerTool = (_name, args) => {
            return args.action === 'lines'
                ? changed('Sunday', 'u-not-a-change')
                : changed('Sunday', 'u-4');
        };
        const { sentList } = useAnthropic([
            anthropicToolUse(
                {
                    name: 'owa_presenting_flow_edit',
                    input: { action: 'update-lines' },
                },
                {
                    name: 'owa_presenting_flow_edit',
                    input: { action: 'lines', file: 'Sunday' },
                },
                {
                    name: 'owa_presenting_flow_edit',
                    input: { action: 'update-lines', file: 'Sunday' },
                },
            ),
            anthropicText('Line 3 now clears the screen.'),
        ]);

        const answer = await askLlmBot(
            'Make line 3 clear the screen',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { flow: { files } },
        );

        expect(sentList[0].system[0].text).toBe(FLOW_SYSTEM_PROMPT);
        expect(readToolResults(sentList[1])[0]).toBe(
            'Tool refused: Say which presenting flow (`file`): "Sunday", ' +
                '"Evening".',
        );
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_presenting_flow_edit',
                args: { action: 'lines', file: 'C:\\flows\\Sunday.owpf' },
            },
            {
                name: 'owa_presenting_flow_edit',
                args: {
                    action: 'update-lines',
                    file: 'C:\\flows\\Sunday.owpf',
                },
            },
        ]);
        // The `lines` read is no change, whatever it answered.
        expect(answer.actions).toEqual([
            {
                label: 'Undo this change',
                toolName: 'lyric-undo',
                args: { id: 'u-4', name: 'Sunday' },
            },
        ]);
        expect(answer.shows).toContainEqual({
            kind: 'control',
            value: 'Presenting Flow List > Sunday',
            name: 'Show it in the list',
        });
    });
});

describe('applyToolWatch on a flow or slide change', () => {
    test('a flow change is kept with the flows list; a read and a refusal are not', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_presenting_flow_edit',
            { action: 'lines' },
            changed('Sunday', 'u-1'),
        );
        expect(watch.editedLyric).toBeNull();
        applyToolWatch(
            watch,
            'owa_presenting_flow_edit',
            { action: 'update-lines' },
            'There is no line 40.',
        );
        expect(watch.editedLyric).toBeNull();
        expect(watch.isActedOn).toBe(false);
        applyToolWatch(
            watch,
            'owa_presenting_flow_edit',
            { action: 'update-lines' },
            changed('Sunday', 'u-2'),
        );
        expect(watch.editedLyric).toEqual({
            name: 'Sunday',
            undoId: 'u-2',
            listName: 'Presenting Flow List',
        });
        expect(watch.isActedOn).toBe(true);
    });

    test('a slide change is kept with the Documents list; a `slides` read is not', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            'owa_slide_edit',
            { action: 'slides' },
            changed('Easter', 'u-1'),
        );
        expect(watch.editedLyric).toBeNull();
        applyToolWatch(
            watch,
            'owa_slide_edit',
            { action: 'update' },
            changed('Easter', 'u-5'),
        );
        expect(watch.editedLyric).toEqual({ name: 'Easter', undoId: 'u-5' });
        expect(watch.isActedOn).toBe(true);
    });
});

describe('a Bible note conversation', () => {
    const file = {
        name: 'Grace',
        filePath: 'C:\\notes\\Default.own',
        noteId: 3,
    };
    const target = { file: file.filePath, id: 3, note: 'Grace' };

    test('a file or id the model writes is refused; the guide is searched in the note window', async () => {
        fake.toolList = [
            { name: 'owa_note_edit' },
            { name: 'owa_help_search' },
        ];
        fake.toolResultMap.owa_note_edit = JSON.stringify({ isChanged: true });
        fake.toolResultMap.owa_help_search = '[]';
        const { sentList } = useAnthropic([
            anthropicToolUse(
                {
                    name: 'owa_note_edit',
                    input: {
                        action: 'edit',
                        file: 'C:\\other.own',
                        changes: [],
                    },
                },
                {
                    name: 'owa_help_search',
                    input: { query: 'insert a table' },
                },
            ),
            anthropicText('Use Insert, then Table.'),
        ]);

        await askLlmBot(
            'How do I put a table in?',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { note: { files: [file] } },
        );

        expect(readToolResults(sentList[1])[0]).toBe(
            'Tool refused: Name the note (`note`) as it is attached, by its ' +
                'name -- never a file or an id.',
        );
        // The search is aimed at the note window's own guide.
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_help_search',
                args: { query: 'insert a table', focus: 'bibleNote' },
            },
        ]);
    });

    test('typed words with no look-alike letters known go in as the model wrote them', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.toolResultMap.owa_note_edit = JSON.stringify({ isChanged: true });
        const changes = [{ after: 1, kind: 'paragraph', text: 'Amen' }];
        useAnthropic([
            anthropicToolUse({
                name: 'owa_note_edit',
                input: { action: 'edit', changes },
            }),
            anthropicText('Added it.'),
        ]);

        await askLlmBot(
            'Add the line Amen',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { note: { files: [file], typed: 'Add the line Amen' } },
        );

        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_note_edit',
                args: { action: 'edit', changes, ...target },
            },
        ]);
    });

    test('a verse asked in another language keeps the Lookup Bible when the Bible list cannot be read', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        fake.toolResultMap.owa_find_verse = 'The Bible list is not ready.';
        fake.toolResultMap.owa_note_edit = JSON.stringify({ isChanged: true });
        const passage = { after: 1, kind: 'passage', ref: 'John 1:1' };
        useAnthropic([
            anthropicToolUse(
                {
                    name: 'owa_note_edit',
                    input: { action: 'edit', changes: [passage] },
                },
                {
                    name: 'owa_note_edit',
                    input: { action: 'edit', changes: [passage] },
                },
            ),
            anthropicText('Done.'),
        ]);

        await askLlmBot(
            'Put John 1:1 under the first line',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { note: { files: [file], verseLang: 'xx' } },
        );

        // Asked once for the whole ask; no Bible put in either edit.
        expect(fake.toolCallList).toEqual([
            { name: 'owa_find_verse', args: {} },
            {
                name: 'owa_note_edit',
                args: { action: 'edit', changes: [passage], ...target },
            },
            {
                name: 'owa_note_edit',
                args: { action: 'edit', changes: [passage], ...target },
            },
        ]);
    });
});

describe('a note made in a conversation that teaches', () => {
    test('a lookup answer carries the new note’s undo and its row after its own buttons', async () => {
        fake.toolList = [
            { name: 'owa_lookup_record' },
            { name: 'owa_bible_note' },
        ];
        fake.toolResultMap.owa_bible_note = JSON.stringify({
            file: 'Default',
            added: 'Noah',
            id: 12,
            filePath: 'C:\\notes\\Default.own',
            undoId: 'u-12',
        });
        useAnthropic([
            anthropicToolUse({
                name: 'owa_bible_note',
                input: { action: 'add', title: 'Noah', text: '# Noah' },
            }),
            anthropicText('I made the note "Noah".'),
        ]);

        const answer = await askLlmBot(
            'Make a note about Noah',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { lookup: { page: null } },
        );

        expect(answer.createdNote).toMatchObject({ name: 'Noah', noteId: 12 });
        expect(answer.actions).toEqual([
            {
                label: 'Undo this change',
                toolName: 'lyric-undo',
                args: { id: 'u-12', name: 'Noah' },
            },
        ]);
        expect(answer.shows).toContainEqual({
            kind: 'control',
            value: 'Bible Notes > Noah',
            name: 'Show it in the list',
        });
    });
});
