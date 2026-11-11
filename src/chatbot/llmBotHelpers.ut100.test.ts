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
        const text =
            fake.answerTool !== null
                ? fake.answerTool(name, args)
                : (fake.toolResultMap[name] ?? '');
        return { text, pictures: [] };
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
// The help window's own mermaid parse (`runStudyDraft`): a diagram with
// BROKEN in it does not draw.
vi.mock('../markdown-preview/markdownMermaidHelpers', () => ({
    findMermaidParseErrors: async (diagrams: string[]) => {
        return diagrams.map((diagram) => {
            return diagram.includes('BROKEN') ? 'Parse error on line 2' : null;
        });
    },
}));

import { resetSpendGuardForTests } from './spendGuardHelpers';
import { genTextAttachment, toAskedOfModel } from './attachmentHelpers';
import {
    applyToolWatch,
    askLlmBot,
    findStudyChangeReport,
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
    takeDraftedStudy,
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

// EC-499: a study open in a Resources tab. Asked to "fix them in the study
// file", gemma4:cloud drafted the WHOLE study four times with no `file` and
// no `ref` -- each refused as a new study with no passage -- and answered
// that it had fixed the references. Nothing had changed.
describe('a study file open in the tab', () => {
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const OLD = [
        '# The New Birth',
        '',
        '## Cross References',
        '',
        '- Num 21:8-9',
        '',
        '## Questions',
        '',
        '1. Who came?',
        '',
    ].join('\n');
    const RESOURCES_EXTRA = {
        resources: {
            canSeePictures: false,
            openFiles: ['pdf/JHN.3.pdf', OPEN],
        },
    };
    // The ask as the window composes it: the study open in the tab goes
    // with every question, here whole (EC-500).
    const ASKED_WITH_STUDY = toAskedOfModel('Fix them in the study file.', [
        genTextAttachment('JHN.3.The New Birth.md', OLD),
    ]);

    // `draft` as the tool host does it: a part changes the file on the
    // disk (OLD), the whole text is taken as it is.
    function answerStudyTool(name: string, args: any) {
        if (name !== 'owa_resource_file') {
            return '';
        }
        if (args.action === 'read') {
            return JSON.stringify({ file: OPEN, kind: 'text', text: OLD });
        }
        let content = args.content;
        if (args.section === 'Cross References') {
            content = OLD.replace('- Num 21:8-9', args.content);
        } else if (args.section === 'Questions') {
            content = OLD.replace('1. Who came?', args.content);
        }
        return JSON.stringify({
            drafted: true,
            isChange: true,
            name: 'JHN.3.The New Birth.md',
            file: OPEN,
            hash: 'h-1',
            diagramCount: 0,
            change: 'It changes words inside the sections.',
            warnings: [],
            content,
        });
    }

    test('the whole study drafted with no file is refused with the call to make and its headings', async () => {
        fake.answerTool = answerStudyTool;
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: { action: 'draft', content: '# The New Birth\n\nAll.' },
            }),
            anthropicText('I could not change the file.'),
        ]);

        const answer = await askLlmBot(
            'Fix them in the study file.',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            RESOURCES_EXTRA,
        );

        // Read for its headings; nothing drafted.
        expect(fake.toolCallList).toEqual([
            { name: 'owa_resource_file', args: { action: 'read', file: OPEN } },
        ]);
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toMatch(/^Tool refused: No `file` and no `ref`\./);
        expect(seen).toContain(`\`file\` "${OPEN}"`);
        expect(seen).toMatch(
            /Its headings:\n# The New Birth\n## Cross References\n## Questions$/,
        );
        expect(answer.text).toBe('I could not change the file.');
        expect(answer.actions ?? []).toEqual([]);
    });

    test('a part drafted with no file goes to the study open', async () => {
        fake.answerTool = answerStudyTool;
        useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    section: 'Cross References',
                    content: '- Numbers 21:8-9',
                },
            }),
            anthropicText('Press Save changes to write it.'),
        ]);

        const answer = await askLlmBot(
            ASKED_WITH_STUDY,
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            RESOURCES_EXTRA,
        );

        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_resource_file',
                args: {
                    action: 'draft',
                    section: 'Cross References',
                    content: '- Numbers 21:8-9',
                    file: OPEN,
                },
            },
        ]);
        expect(answer.actions?.[0]?.label).toBe(
            'Save changes to "JHN.3.The New Birth.md"',
        );
    });

    test('two parts in one ask are one change: the second drafted on top of the first', async () => {
        fake.answerTool = answerStudyTool;
        useAnthropic([
            anthropicToolUse(
                {
                    name: 'owa_resource_file',
                    input: {
                        action: 'draft',
                        file: OPEN,
                        section: 'Cross References',
                        content: '- Numbers 21:8-9',
                    },
                },
                {
                    name: 'owa_resource_file',
                    input: {
                        action: 'draft',
                        file: OPEN,
                        section: 'Questions',
                        content: '1. Who came to Jesus by night?',
                    },
                },
            ),
            anthropicText('Press Save changes to write both.'),
        ]);

        const answer = await askLlmBot(
            ASKED_WITH_STUDY,
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            RESOURCES_EXTRA,
        );

        expect(fake.toolCallList).toHaveLength(2);
        const second = fake.toolCallList[1].args;
        expect(Object.keys(second).sort()).toEqual([
            'action',
            'content',
            'file',
        ]);
        expect(second.content).toContain('- Numbers 21:8-9');
        expect(second.content).toContain('1. Who came to Jesus by night?');
        expect(second.content).not.toContain('- Num 21:8-9');
        expect(
            answer.actions?.map((action) => {
                return action.label;
            }),
        ).toEqual(['Save changes to "JHN.3.The New Birth.md"', 'Preview']);
    });

    test('an answer saying the study changed when no draft was made is handed back once', async () => {
        fake.answerTool = answerStudyTool;
        const { sentList } = useAnthropic([
            anthropicText(
                'I have fixed the cross-references in the study file.',
            ),
            anthropicText('I have not changed the file yet.'),
        ]);

        const answer = await askLlmBot(
            'Fix them in the study file.',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            RESOURCES_EXTRA,
        );

        expect(sentList).toHaveLength(2);
        const nudge = sentList[1].messages[sentList[1].messages.length - 1];
        expect(nudge.role).toBe('user');
        expect(nudge.content).toMatch(
            /^Not yet: nothing in the study file changed/,
        );
        expect(nudge.content).toContain(`\`file\` "${OPEN}"`);
        expect(answer.text).toBe('I have not changed the file yet.');
    });

    test('the same answer with no study open is not handed back', async () => {
        const { sentList } = useAnthropic([
            anthropicText('I have fixed the cross-references.'),
        ]);

        await askLlmBot(
            'Fix them in the study file.',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                resources: {
                    canSeePictures: false,
                    openFiles: ['pdf/JHN.3.pdf'],
                },
            },
        );

        expect(sentList).toHaveLength(1);
    });
});

// EC-503: a change parsed every diagram in the file. One of the person's
// own that mermaid could not draw went to the model to fix, and was dropped
// from their file when the model sent its change again.
describe("a change's diagrams", () => {
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const FILE_DIAGRAM =
        '```mermaid\nflowchart TD\n    A["Law"] --> BROKEN\n```';
    const OLD = [
        '# The New Birth',
        '',
        FILE_DIAGRAM,
        '',
        '## Questions',
        '',
        '1. Who came?',
        '',
    ].join('\n');
    const RESOURCES_EXTRA = {
        resources: { canSeePictures: false, openFiles: [OPEN] },
    };

    function answerStudyDraft(_name: string, args: any) {
        if (args.action !== 'draft') {
            return '';
        }
        return JSON.stringify({
            drafted: true,
            isChange: true,
            name: 'JHN.3.The New Birth.md',
            file: OPEN,
            hash: 'h-1',
            diagramCount: (args.content.match(/```mermaid/g) ?? []).length + 1,
            change: 'It changes “Questions”.',
            warnings: [],
            content: OLD.replace('1. Who came?', args.content),
        });
    }

    function readHeldContent(answer: any) {
        const reference = answer.actions?.[0]?.args?.reference;
        return takeDraftedStudy(reference)?.content ?? '';
    }

    test("the file's own diagram that does not draw is neither sent back nor dropped", async () => {
        fake.answerTool = answerStudyDraft;
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: OPEN,
                    section: 'Questions',
                    content: '1. Who came to Jesus by night?',
                },
            }),
            anthropicText('Press Save changes to write it.'),
        ]);

        const answer = await askLlmBot(
            'Fix the first question.',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            RESOURCES_EXTRA,
        );

        expect(readToolResults(sentList[1])[0]).not.toMatch(/^Tool refused/);
        expect(answer.actions?.[0]?.label).toBe(
            'Save changes to "JHN.3.The New Birth.md"',
        );
        const held = readHeldContent(answer);
        expect(held).toContain('A["Law"] --> BROKEN');
        expect(held).toContain('1. Who came to Jesus by night?');
    });

    test('a diagram the change writes goes back once, then only it is dropped', async () => {
        fake.answerTool = answerStudyDraft;
        const part =
            '1. Who came?\n\n```mermaid\nmindmap\n  root((BROKEN love))\n```';
        const call = {
            name: 'owa_resource_file',
            input: {
                action: 'draft',
                file: OPEN,
                section: 'Questions',
                content: part,
            },
        };
        const { sentList } = useAnthropic([
            anthropicToolUse(call),
            anthropicToolUse(call),
            anthropicText('Press Save changes to write it.'),
        ]);

        const answer = await askLlmBot(
            'Add a mindmap to the questions.',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            RESOURCES_EXTRA,
        );

        const [refused] = readToolResults(sentList[1]);
        expect(refused).toMatch(/^Tool refused: Diagram 1 does not draw/);
        expect(refused).toContain('with the same change.');
        const held = readHeldContent(answer);
        expect(held).not.toContain('root((BROKEN love))');
        expect(held).toContain('A["Law"] --> BROKEN');
    });
});

// EC-502, seen live: asked to fix one line past the 16 KB the ask shows of a
// 44 KB study, gemma4:cloud sent that part back as the WHOLE new text, and
// the card would have saved the part alone.
describe('a study file written whole again', () => {
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const RESOURCES_EXTRA = {
        resources: { canSeePictures: false, openFiles: [OPEN] },
    };

    // A long file: `read` gives its start and a note naming every heading,
    // or the part a `section` names.
    function answerLongStudyTool(_name: string, args: any) {
        if (args.action === 'read' && args.section === 'Questions') {
            return JSON.stringify({
                file: OPEN,
                kind: 'text',
                section: 'Questions',
                text: '## Questions\n\n1. Who came?',
            });
        }
        if (args.action === 'read') {
            return JSON.stringify({
                file: OPEN,
                kind: 'text',
                text: '# The New Birth\n\n',
                note:
                    'Only the start of it is here: it is 44021 characters. ' +
                    'Its headings:\n# The New Birth\n## Cross References\n' +
                    '## Questions',
            });
        }
        return JSON.stringify({
            drafted: true,
            isChange: true,
            name: 'JHN.3.The New Birth.md',
            file: OPEN,
            hash: 'h-1',
            diagramCount: 0,
            change: 'It changes “Questions”.',
            warnings: [],
            content: `# The New Birth\n\n${args.content}`,
        });
    }

    test('one part sent as the whole text is drafted as that part', async () => {
        fake.answerTool = answerLongStudyTool;
        const content = '## Questions\n\n1. Who came to Jesus by night?';
        // As seen live: the part past what the ask shows is read first.
        const readPart = {
            action: 'read',
            file: 'JHN.3.The New Birth.md',
            section: 'Questions',
        };
        useAnthropic([
            anthropicToolUse({ name: 'owa_resource_file', input: readPart }),
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: 'JHN.3.The New Birth.md',
                    ref: 'John 3:1-36',
                    title: 'The New Birth',
                    content,
                },
            }),
            anthropicText('Press Save changes to write it.'),
        ]);

        const answer = await askLlmBot(
            'Question 1 has the wrong word. Fix it.',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            RESOURCES_EXTRA,
        );

        expect(fake.toolCallList).toEqual([
            { name: 'owa_resource_file', args: readPart },
            {
                name: 'owa_resource_file',
                args: { action: 'read', file: 'JHN.3.The New Birth.md' },
            },
            {
                name: 'owa_resource_file',
                args: {
                    action: 'draft',
                    file: 'JHN.3.The New Birth.md',
                    ref: 'John 3:1-36',
                    title: 'The New Birth',
                    content,
                    section: 'Questions',
                },
            },
        ]);
        expect(answer.actions?.[0]?.label).toBe(
            'Save changes to "JHN.3.The New Birth.md"',
        );
    });

    test('a text losing the parts the ask never showed is refused, and no card comes', async () => {
        fake.answerTool = answerLongStudyTool;
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: OPEN,
                    content: 'Question 3 now names the book of Numbers.',
                },
            }),
            anthropicText('I could not change the file this time.'),
        ]);

        const answer = await askLlmBot(
            'Fix them in the study file.',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            RESOURCES_EXTRA,
        );

        expect(fake.toolCallList).toEqual([
            { name: 'owa_resource_file', args: { action: 'read', file: OPEN } },
        ]);
        const [refused] = readToolResults(sentList[1]);
        expect(refused).toMatch(
            /^Tool refused: `content` with no `section` is the WHOLE new text/,
        );
        expect(refused).toContain(
            'leaves out 3 of its parts: “The New Birth”, “Cross References”, “Questions”.',
        );
        expect(refused).toContain('The ask shows only the start of this file');
        expect(answer.actions ?? []).toEqual([]);
    });
});

describe('a report of a change written into a study', () => {
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const REPORT =
        'I have fixed the cross-references in the study file. I corrected ' +
        'the book names to match the Bible.';

    function answerStudyTool(_name: string, args: any) {
        if (args.action === 'read' && args.section === 'Questions') {
            return JSON.stringify({
                file: OPEN,
                kind: 'text',
                section: 'Questions',
                text: '## Questions\n\n1. Who came?',
            });
        }
        if (args.action === 'read') {
            return JSON.stringify({
                file: OPEN,
                kind: 'text',
                text: '# The New Birth\n\n',
                note:
                    'Only the start of it is here: it is 44021 characters. ' +
                    'Its headings:\n# The New Birth\n## Cross References\n' +
                    '## Questions',
            });
        }
        return JSON.stringify({
            drafted: true,
            isChange: true,
            name: 'JHN.3.The New Birth.md',
            file: OPEN,
            hash: 'h-1',
            diagramCount: 0,
            change: 'It changes “Questions”.',
            warnings: [],
            content: `# The New Birth\n\n${args.content}`,
        });
    }

    function askToFix(extra: Record<string, unknown> = {}) {
        return askLlmBot(
            'Question 3 still calls Numbers by the wrong name. Fix it there too.',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                resources: { canSeePictures: false, openFiles: [OPEN] },
                ...extra,
            },
        );
    }

    test('an earlier answer sent as a part’s new words is refused with the headings, and no card comes', async () => {
        fake.answerTool = answerStudyTool;
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: 'JHN.3.The New Birth.md',
                    ref: 'John 3:1-36',
                    title: 'The New Birth',
                    section: 'Questions',
                    content: REPORT,
                },
            }),
            anthropicText('I could not change the file this time.'),
        ]);

        const answer = await askToFix();

        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_resource_file',
                args: { action: 'read', file: 'JHN.3.The New Birth.md' },
            },
        ]);
        const [refused] = readToolResults(sentList[1]);
        expect(refused).toMatch(
            /^Tool refused: These words say what was done to the study \(“I have fixed the cross-references in the study file\./,
        );
        expect(refused).toContain('Nothing in the file has changed');
        expect(refused).toContain(
            '# The New Birth\n## Cross References\n## Questions',
        );
        expect(answer.actions ?? []).toEqual([]);
    });

    test('`@answer` bringing in a report of a change is refused too', async () => {
        fake.answerTool = answerStudyTool;
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: OPEN,
                    section: 'Questions',
                    content: '@answer',
                },
            }),
            anthropicText('I could not change the file this time.'),
        ]);

        const answer = await askToFix({ answerAbove: REPORT });

        expect(fake.toolCallList).toEqual([
            { name: 'owa_resource_file', args: { action: 'read', file: OPEN } },
        ]);
        expect(readToolResults(sentList[1])[0]).toMatch(
            /^Tool refused: These words say what was done to the study/,
        );
        expect(answer.actions ?? []).toEqual([]);
    });

    test('a part whose own words carry such a line further down is drafted', async () => {
        fake.answerTool = answerStudyTool;
        const content =
            '## Questions\n\n1. Who came to Jesus by night?\n\n' +
            'I have fixed the date in this file.';
        // The part is read first: no part is written from memory (EC-500).
        const readPart = { action: 'read', file: OPEN, section: 'Questions' };
        useAnthropic([
            anthropicToolUse({ name: 'owa_resource_file', input: readPart }),
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: OPEN,
                    section: 'Questions',
                    content,
                },
            }),
            anthropicText('Press Save changes to write it.'),
        ]);

        const answer = await askToFix();

        expect(fake.toolCallList).toEqual([
            { name: 'owa_resource_file', args: readPart },
            {
                name: 'owa_resource_file',
                args: {
                    action: 'draft',
                    file: OPEN,
                    section: 'Questions',
                    content,
                },
            },
        ]);
        expect(answer.actions?.[0]?.label).toBe(
            'Save changes to "JHN.3.The New Birth.md"',
        );
    });

    test('findStudyChangeReport reads the first line of words of a change', () => {
        const file = 'JHN.3.The New Birth.md';
        expect(findStudyChangeReport({ file, content: REPORT })).toBe(REPORT);
        expect(
            findStudyChangeReport({
                file,
                content: '## Notes\n\nI have fixed the typo in the study file.',
            }),
        ).toBe('I have fixed the typo in the study file.');
        expect(
            findStudyChangeReport({
                file,
                append: 'Please press Save changes to keep this fix.',
            }),
        ).toBe('Please press Save changes to keep this fix.');
        // A new study takes nothing of theirs away.
        expect(findStudyChangeReport({ content: REPORT })).toBeNull();
        // A claim with nothing pointing at the file is a study's own words.
        expect(
            findStudyChangeReport({
                file,
                content: '## Prayer\n\nLord, I have made my own way.',
            }),
        ).toBeNull();
        expect(
            findStudyChangeReport({
                file,
                section: 'Questions',
                content: '1. Who came to Jesus by night?',
            }),
        ).toBeNull();
    });
});

// EC-500, seen live: asked to fix a part past the 16 KB the ask shows of a
// 44 KB study, gemma4:cloud drafted that part by its `section` without
// reading it, and two of its labels came out written anew.
describe('a part of a study drafted with none of its words shown', () => {
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const NAME = 'JHN.3.The New Birth.md';
    const LAST = [
        '## Last Words',
        '',
        '- The bronze snake: Numbers 21:8-9',
        '- Born of water: Titus 3:5',
    ].join('\n');
    // Long enough for the ask to show it cut inside its Background.
    const STUDY = [
        '# The New Birth',
        '',
        '## Questions',
        '',
        '1. Who came?',
        '',
        '## Background',
        '',
        ...Array.from({ length: 600 }, (_value, index) => {
            return `Line ${index + 1} of the background, as it was.`;
        }),
        '',
        LAST,
        '',
    ].join('\n');
    const RESOURCES_EXTRA = {
        resources: { canSeePictures: false, openFiles: [OPEN] },
    };
    // The ask as the window composes it, the study open in the tab with it.
    const ASKED = toAskedOfModel('Fix the last words in the study file.', [
        genTextAttachment(NAME, STUDY),
    ]);
    const DRAFT = { action: 'draft', file: OPEN, section: 'Last Words' };
    const FIXED =
        '## Last Words\n\n- The bronze snake: Numbers 21:8-9\n' +
        '- Born of water: Titus 3:5 and John 3:5';
    const READ_PART = { action: 'read', file: OPEN, section: 'Last Words' };

    let isPartLong = false;
    function answerStudyTool(_name: string, args: any) {
        if (args.action === 'read' && args.section === 'Last Words') {
            return JSON.stringify({
                file: OPEN,
                kind: 'text',
                section: 'Last Words',
                text: isPartLong ? LAST.slice(0, 20) : LAST,
                ...(isPartLong
                    ? { note: 'Only the start of this part is here.' }
                    : {}),
            });
        }
        return JSON.stringify({
            drafted: true,
            isChange: true,
            name: NAME,
            file: OPEN,
            hash: 'h-1',
            diagramCount: 0,
            change: `It changes “${args.section}”.`,
            warnings: [],
            content: STUDY,
        });
    }

    function askToFix() {
        return askLlmBot(
            ASKED,
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            RESOURCES_EXTRA,
        );
    }

    beforeEach(() => {
        isPartLong = false;
        fake.answerTool = answerStudyTool;
    });

    test('the window reads the part and sends the draft back with its words; drafted again, it goes through', async () => {
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    ...DRAFT,
                    content:
                        '## Last Words\n\n- The snake: Numbers 21:8-9\n' +
                        '- Born again: Titus 3:5',
                },
            }),
            anthropicToolUse({
                name: 'owa_resource_file',
                input: { ...DRAFT, content: FIXED },
            }),
            anthropicText('Press Save changes to write it.'),
        ]);

        const answer = await askToFix();

        // Read once, by the window: the words written unread reached no tool.
        expect(fake.toolCallList).toEqual([
            { name: 'owa_resource_file', args: READ_PART },
            { name: 'owa_resource_file', args: { ...DRAFT, content: FIXED } },
        ]);
        const [refused] = readToolResults(sentList[1]);
        expect(refused).toMatch(
            /^Tool refused: The part “Last Words” is in nothing you were shown of "Default\/JHN\.3\.The New Birth\.md"/,
        );
        expect(refused).toContain(
            'Call draft again with the same `file` and `section`',
        );
        expect(refused).toContain(
            'Nothing in the file has changed: never say it was.',
        );
        expect(refused).toContain('- The bronze snake: Numbers 21:8-9');
        expect(answer.actions?.[0]?.label).toBe(
            'Save changes to "JHN.3.The New Birth.md"',
        );
    });

    test('a part the ask shows whole is drafted with no read', async () => {
        const input = {
            action: 'draft',
            file: OPEN,
            section: 'Questions',
            content: '## Questions\n\n1. Who came to Jesus by night?',
        };
        useAnthropic([
            anthropicToolUse({ name: 'owa_resource_file', input }),
            anthropicText('Press Save changes to write it.'),
        ]);

        const answer = await askToFix();

        expect(fake.toolCallList).toEqual([
            { name: 'owa_resource_file', args: input },
        ]);
        expect(answer.actions?.[0]?.label).toBe(
            'Save changes to "JHN.3.The New Birth.md"',
        );
    });

    test('a part the model read first is drafted with no read of the window’s own', async () => {
        const { sentList } = useAnthropic([
            anthropicToolUse({ name: 'owa_resource_file', input: READ_PART }),
            anthropicToolUse({
                name: 'owa_resource_file',
                input: { ...DRAFT, content: FIXED },
            }),
            anthropicText('Press Save changes to write it.'),
        ]);

        const answer = await askToFix();

        expect(fake.toolCallList).toEqual([
            { name: 'owa_resource_file', args: READ_PART },
            { name: 'owa_resource_file', args: { ...DRAFT, content: FIXED } },
        ]);
        expect(readToolResults(sentList[2])[0]).not.toMatch(/^Tool refused/);
        expect(answer.actions?.[0]?.label).toBe(
            'Save changes to "JHN.3.The New Birth.md"',
        );
    });

    test('a part too long to hand over is drafted as before', async () => {
        isPartLong = true;
        useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: { ...DRAFT, content: FIXED },
            }),
            anthropicText('Press Save changes to write it.'),
        ]);

        const answer = await askToFix();

        expect(fake.toolCallList).toEqual([
            { name: 'owa_resource_file', args: READ_PART },
            { name: 'owa_resource_file', args: { ...DRAFT, content: FIXED } },
        ]);
        expect(answer.actions?.[0]?.label).toBe(
            'Save changes to "JHN.3.The New Birth.md"',
        );
    });
});
