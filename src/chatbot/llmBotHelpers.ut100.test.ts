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
        // the links the office conversation downloaded, in order (EC-777)
        downloadList: [] as { url: string; want: string }[],
        // what an ask let go of once it was over
        letGoList: [] as string[],
    },
    settingMap: new Map<string, string>(),
}));

// A picture from a link the person typed (EC-777): the window downloads it.
vi.mock('./officeLinkMediaDownload', () => ({
    downloadOfficeLinkMedia: async (url: string, want: string) => {
        fake.downloadList.push({ url, want });
        if (url.includes('page')) {
            return { reason: 'The link is a web page.' };
        }
        return {
            name: 'choir.jpg',
            filePath: '/tmp/open-worship-app-office-links/a/choir.jpg',
        };
    },
    deleteOfficeLinkFiles: async (filePaths: string[]) => {
        fake.letGoList.push(...filePaths);
    },
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
    checkClaimsUnmadeChange,
    checkClaimsUnmadeForegroundChange,
    checkClaimsUnmadeHeldStudyChange,
    findAnswerShapeNudge,
    findStudyChangeReport,
    FOREGROUND_CLAIM_NUDGE,
    checkClaimsUnmadeOfficeChange,
    genToolWatch,
    resetReasoningOffMemoryForTests,
    SCREEN_CLAIM_NUDGE,
} from './llmBotHelpers';
import { RESOURCES_MAX_TOOL_ROUNDS } from './resourcesChatHelpers';
import { LYRIC_SYSTEM_PROMPT } from './lyricChatHelpers';
import { SLIDE_SYSTEM_PROMPT } from './slideChatHelpers';
import { OFFICE_CLAIM_NUDGE, OFFICE_SYSTEM_PROMPT } from './officeChatHelpers';
import { FLOW_SYSTEM_PROMPT } from './flowChatHelpers';
import {
    NOTE_BESIDE_DRAFT_REFUSAL,
    NOTE_HELD_CHOICE_NOTE,
    NOTE_HELD_MARKDOWN_NOTE,
    NOTE_MARKDOWN_NO_PASSAGE_REFUSAL,
    STUDY_CHANGE_STOPPED_TEXT,
    STUDY_CREATE_TOOL_NAME,
    STUDY_HELD_NOTE,
    STUDY_KEEP_ANSWER_HINT,
    STUDY_KEPT_ANSWER_CHANGE_NOTE,
    STUDY_KEPT_ANSWER_NOTE,
    STUDY_MAX_TOOL_ROUNDS,
    STUDY_NO_ANSWER_REFUSAL,
    STUDY_PREVIEW_TOOL_NAME,
    STUDY_RENAME_TOOL_NAME,
    STUDY_SAVE_MODEL_REFUSAL,
    STUDY_STOPPED_TEXT,
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
            // EC-581: a Bible note or a Markdown file, as they choose.
            ['New Bible Note', STUDY_CREATE_TOOL_NAME],
            [
                'Create "MAT.3.3-7 The Voice.md" in Resources',
                STUDY_CREATE_TOOL_NAME,
            ],
            [
                'Create "MAT.3.3-7 The Voice.md" in Bible Notes',
                STUDY_CREATE_TOOL_NAME,
            ],
            ['Preview', STUDY_PREVIEW_TOOL_NAME],
            ['Change the name', STUDY_RENAME_TOOL_NAME],
        ]);
    });

    // EC-504: a new study held when the rounds run out keeps its own
    // sentence, Create, under the card.
    test('a new study held when the rounds run out is answered with the Create sentence', async () => {
        fake.answerTool = (name: string, args: any) => {
            if (name !== 'owa_resource_file' || args.action !== 'draft') {
                return '{}';
            }
            return JSON.stringify({
                drafted: true,
                isChange: false,
                name: 'MAT.3.3-7 The Voice.md',
                passage: 'Matthew 3:3-7',
                bible: 'KJV',
                diagramCount: 0,
                warnings: [],
                content: '# The Voice\n\nA study.',
            });
        };
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    ref: 'Matthew 3:3-7',
                    title: 'The Voice',
                    content: 'A study.',
                },
            }),
            ...Array.from({ length: STUDY_MAX_TOOL_ROUNDS - 1 }, () => {
                return anthropicToolUse({
                    name: 'owa_find_verse',
                    input: { refs: 'Matthew 3:3-7' },
                });
            }),
            anthropicText('never asked'),
        ]);

        const answer = await askLlmBot(
            'Make a study file for Matthew 3:3-7',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { study: {} },
        );

        expect(sentList).toHaveLength(STUDY_MAX_TOOL_ROUNDS);
        expect(answer.text).toBe(STUDY_STOPPED_TEXT);
        expect(
            answer.actions?.map((action) => {
                return action.label;
            }),
        ).toEqual([
            'New Bible Note',
            'Create "MAT.3.3-7 The Voice.md" in Resources',
            'Create "MAT.3.3-7 The Voice.md" in Bible Notes',
            'Preview',
            'Change the name',
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
        expect(
            answer.actions?.slice(0, 2).map((action) => action.label),
        ).toEqual([
            'New Bible Note',
            'Create "JHN.3.16 God So Loved.md" in Resources',
        ]);
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
        // EC-581: kept as a Bible note or a Markdown file, as they choose.
        expect(
            answer.actions?.slice(0, 2).map((action) => action.label),
        ).toEqual([
            'New Bible Note',
            'Create "JHN.3.16 God So Loved.md" in Resources',
        ]);
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

// EC-581, the user: _the chatbot usually confuse between bible-note and
// resource file_, _whenever creating bible-note or resource study file
// should always let user choose between bible-note or markdown file_, then
// _but if user click and choose step by step explicitely it should skip the
// confirmation_.
describe('a new note, kept as the person chooses', () => {
    const NOTE_ARGS = {
        action: 'add',
        title: 'God So Loved',
        text: '[^John 3:16]\n\nGod gave his only Son.',
    };
    const MADE_NOTE = JSON.stringify({
        file: 'Default',
        added: 'God So Loved',
        id: 7,
        filePath: 'C:\\notes\\Default.own',
        undoId: 'u-7',
    });

    function answerDraftAndNote() {
        fake.answerTool = (name: string, args: any) => {
            if (name === 'owa_resource_file' && args.action === 'draft') {
                return JSON.stringify({
                    drafted: true,
                    isChange: false,
                    name: 'JHN.3.16 God So Loved.md',
                    passage: 'John 3:16',
                    bible: 'KJV',
                    diagramCount: 0,
                    warnings: [],
                    content: `# God So Loved\n\n${args.content}`,
                });
            }
            return name === 'owa_bible_note' ? MADE_NOTE : '{}';
        };
    }

    async function askForNote(extra: any = { bibleReader: {} }) {
        fake.toolList = [{ name: 'owa_bible_note' }];
        answerDraftAndNote();
        const { sentList } = useAnthropic([
            anthropicToolUse({ name: 'owa_bible_note', input: NOTE_ARGS }),
            anthropicText('It is under this answer.'),
        ]);
        const answer = await askLlmBot(
            'Make me a note on John 3:16',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            extra,
        );
        return { answer, seen: readToolResults(sentList[1])[0] };
    }

    test('a new note is held: the window drafts it as a file, and the card asks a Bible note or a Markdown file', async () => {
        const { answer, seen } = await askForNote();

        // Nothing is made: the note's words are drafted as a study file.
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_resource_file',
                args: {
                    action: 'draft',
                    ref: 'John 3:16',
                    title: 'God So Loved',
                    content: 'God gave his only Son.',
                },
            },
        ]);
        expect(JSON.parse(seen)).toEqual({
            held: true,
            title: 'God So Loved',
            markdownFile: 'JHN.3.16 God So Loved.md',
            note: NOTE_HELD_CHOICE_NOTE,
        });
        expect(answer.createdNote).toBeUndefined();
        expect(answer.actions?.map((action) => action.label)).toEqual([
            'New Bible Note',
            'Create "JHN.3.16 God So Loved.md" in Resources',
            'Create "JHN.3.16 God So Loved.md" in Bible Notes',
            'Preview',
            'Change the name',
        ]);
        // New Bible Note makes the note as the model wrote it.
        const held = takeDraftedStudy(answer.actions?.[0]?.args?.reference);
        expect(held?.note).toEqual({
            title: 'God So Loved',
            text: NOTE_ARGS.text,
        });
    });

    test('pressed for a Bible note, the note is made at once', async () => {
        const { answer, seen } = await askForNote({
            bibleReader: {},
            createKind: 'note',
        });

        expect(fake.toolCallList).toEqual([
            { name: 'owa_bible_note', args: NOTE_ARGS },
        ]);
        expect(seen).toBe(MADE_NOTE);
        expect(answer.createdNote).toMatchObject({
            name: 'God So Loved',
            noteId: 7,
        });
        expect(answer.actions?.map((action) => action.label)).toEqual([
            'Undo this change',
        ]);
    });

    test('pressed for a Markdown file, the card asks only where', async () => {
        const { answer, seen } = await askForNote({
            bibleReader: {},
            createKind: 'markdown',
        });

        expect(
            fake.toolCallList.map((call) => {
                return [call.name, call.args.action];
            }),
        ).toEqual([['owa_resource_file', 'draft']]);
        expect(JSON.parse(seen).note).toBe(NOTE_HELD_MARKDOWN_NOTE);
        expect(answer.createdNote).toBeUndefined();
        expect(answer.actions?.map((action) => action.label)).toEqual([
            'Create "JHN.3.16 God So Loved.md" in Resources',
            'Create "JHN.3.16 God So Loved.md" in Bible Notes',
            'Preview',
            'Change the name',
        ]);
    });

    test('a note that names no passage is made as asked -- unless a Markdown file was pressed for', async () => {
        fake.toolList = [{ name: 'owa_bible_note' }];
        answerDraftAndNote();
        const prayer = { action: 'add', title: 'Prayer', text: 'Pray.' };
        useAnthropic([
            anthropicToolUse({ name: 'owa_bible_note', input: prayer }),
            anthropicText('Made.'),
        ]);
        await askLlmBot(
            'Make me a prayer note',
            'reader',
            'anthropic',
            'claude-sonnet-5',
        );
        expect(fake.toolCallList).toEqual([
            { name: 'owa_bible_note', args: prayer },
        ]);

        fake.toolCallList = [];
        const { sentList } = useAnthropic([
            anthropicToolUse({ name: 'owa_bible_note', input: prayer }),
            anthropicText('Which passage?'),
        ]);
        await askLlmBot(
            'Make me a prayer note',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { createKind: 'markdown' },
        );
        expect(fake.toolCallList).toEqual([]);
        expect(readToolResults(sentList[1])).toEqual([
            `Tool refused: ${NOTE_MARKDOWN_NO_PASSAGE_REFUSAL}`,
        ]);
    });

    test('a note the window could not draft as a file is made as asked', async () => {
        fake.toolList = [{ name: 'owa_bible_note' }];
        fake.answerTool = (name: string) => {
            return name === 'owa_bible_note'
                ? MADE_NOTE
                : 'No Bible reads John 3:16.';
        };
        useAnthropic([
            anthropicToolUse({ name: 'owa_bible_note', input: NOTE_ARGS }),
            anthropicText('Made.'),
        ]);
        const answer = await askLlmBot(
            'Make me a note on John 3:16',
            'reader',
            'anthropic',
            'claude-sonnet-5',
        );
        expect(
            fake.toolCallList.map((call) => {
                return call.name;
            }),
        ).toEqual(['owa_resource_file', 'owa_bible_note']);
        expect(answer.createdNote).toMatchObject({ noteId: 7 });
    });

    test('a note asked for beside a new study already held is refused: the card chooses', async () => {
        fake.toolList = [{ name: 'owa_bible_note' }];
        answerDraftAndNote();
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    ref: 'John 3:16',
                    title: 'God So Loved',
                    content: 'God gave his only Son.',
                },
            }),
            anthropicToolUse({ name: 'owa_bible_note', input: NOTE_ARGS }),
            anthropicText('Press the one you want.'),
        ]);
        await askLlmBot(
            'Make a study file for John 3:16',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { study: {} },
        );
        expect(readToolResults(sentList[2])).toEqual([
            `Tool refused: ${NOTE_BESIDE_DRAFT_REFUSAL}`,
        ]);
        expect(
            fake.toolCallList.map((call) => {
                return call.name;
            }),
        ).toEqual(['owa_resource_file']);
    });

    test('a new study drafted after a press for a Bible note is made that note, its diagrams left out', async () => {
        answerDraftAndNote();
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    ref: 'John 3:16',
                    title: 'God So Loved',
                    content:
                        'God gave his only Son.\n\n```mermaid\n' +
                        'flowchart TD\n  A["God"] --> B["Son"]\n```',
                },
            }),
            anthropicText('Your Bible note is open.'),
        ]);
        const answer = await askLlmBot(
            'Make a study file for John 3:16',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { study: {}, createKind: 'note' },
        );
        expect(fake.toolCallList[1]).toEqual({
            name: 'owa_bible_note',
            args: {
                action: 'add',
                title: 'God So Loved',
                text: '[^(KJV) John 3:16]\n\nGod gave his only Son.',
            },
        });
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain('They chose a Bible note');
        expect(seen).toContain('its diagram was left out');
        expect(answer.createdNote).toMatchObject({ noteId: 7 });
        expect(answer.actions?.map((action) => action.label)).toEqual([
            'Undo this change',
        ]);
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
        // A change drafted is a change made: nothing said over it.
        expect(answer.isChangeUnmade).toBeUndefined();
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
        // Honest the second time: nothing to say over it.
        expect(answer.isChangeUnmade).toBeUndefined();
    });

    test('the same answer with no study open is not handed back', async () => {
        const { sentList } = useAnthropic([
            anthropicText('I have fixed the cross-references.'),
        ]);

        const answer = await askLlmBot(
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
        expect(answer.isChangeUnmade).toBeUndefined();
    });

    // EC-501: the claim goes back once, never on the last round -- there
    // is no round left to answer it -- so what reaches the person is marked.
    test('a claim written again after its hand-back is marked as a change never made', async () => {
        fake.answerTool = answerStudyTool;
        const { sentList } = useAnthropic([
            anthropicText(
                'I have fixed the cross-references in the study file.',
            ),
            anthropicText('I have fixed them. Press Save changes to keep it.'),
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
        expect(answer.text).toBe(
            'I have fixed them. Press Save changes to keep it.',
        );
        expect(answer.isChangeUnmade).toBe(true);
    });

    test('a claim written on the last round is marked, never handed back', async () => {
        fake.answerTool = answerStudyTool;
        const { sentList } = useAnthropic([
            ...Array.from({ length: RESOURCES_MAX_TOOL_ROUNDS - 1 }, () => {
                return anthropicToolUse({
                    name: 'owa_resource_file',
                    input: { action: 'read', file: OPEN },
                });
            }),
            anthropicText(
                'I have fixed the cross-references in the study file.',
            ),
            anthropicText('never asked'),
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

        expect(sentList).toHaveLength(RESOURCES_MAX_TOOL_ROUNDS);
        expect(answer.text).toBe(
            'I have fixed the cross-references in the study file.',
        );
        expect(answer.isChangeUnmade).toBe(true);
    });

    // EC-504: the rounds ran out, or the service failed, with a change
    // held -- the answer is the card's own sentence: Preview, then Save
    // changes, never "Press Create" or "could not settle on an answer".
    const DRAFT_CROSS_REFERENCES = anthropicToolUse({
        name: 'owa_resource_file',
        input: {
            action: 'draft',
            file: OPEN,
            section: 'Cross References',
            content: '- Numbers 21:8-9',
        },
    });

    test('a change held when the rounds run out is answered with its own sentence over its card', async () => {
        fake.answerTool = answerStudyTool;
        const { sentList } = useAnthropic([
            DRAFT_CROSS_REFERENCES,
            ...Array.from({ length: RESOURCES_MAX_TOOL_ROUNDS - 1 }, () => {
                return anthropicToolUse({
                    name: 'owa_resource_file',
                    input: { action: 'read', file: OPEN },
                });
            }),
            anthropicText('never asked'),
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

        expect(sentList).toHaveLength(RESOURCES_MAX_TOOL_ROUNDS);
        expect(answer.text).toBe(STUDY_CHANGE_STOPPED_TEXT);
        expect(
            answer.actions?.map((action) => {
                return action.label;
            }),
        ).toEqual(['Save changes to "JHN.3.The New Birth.md"', 'Preview']);
        expect(answer.isChangeUnmade).toBeUndefined();
    });

    test('a change held and then a failure is answered with the same sentence over its card', async () => {
        fake.answerTool = answerStudyTool;
        useAnthropic([
            DRAFT_CROSS_REFERENCES,
            {
                then: (_resolve: unknown, reject: (error: Error) => void) => {
                    reject(new Error('the stream broke'));
                },
            },
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

        expect(answer.text).toBe(STUDY_CHANGE_STOPPED_TEXT);
        expect(
            answer.actions?.map((action) => {
                return action.label;
            }),
        ).toEqual(['Save changes to "JHN.3.The New Birth.md"', 'Preview']);
    });
});

// EC-501: which finished answers the window says changed nothing.
describe('checkClaimsUnmadeChange', () => {
    const CLAIM = 'I have added a gold star to the heading.';

    function genNoteWatch() {
        const watch = genToolWatch();
        watch.noteFiles = [];
        return watch;
    }

    test('a note claim with nothing done is a change never made', () => {
        expect(checkClaimsUnmadeChange(CLAIM, genNoteWatch())).toBe(true);
    });

    test('nor is it in a tab with no note or study open, or with honest words', () => {
        expect(checkClaimsUnmadeChange(CLAIM, genToolWatch())).toBe(false);
        expect(
            checkClaimsUnmadeChange(
                'I have not changed the note yet.',
                genNoteWatch(),
            ),
        ).toBe(false);
    });

    test('anything the ask did may be what the words are about', () => {
        const pressed = genNoteWatch();
        pressed.isActedOn = true;
        expect(checkClaimsUnmadeChange(CLAIM, pressed)).toBe(false);
        const stepped = genNoteWatch();
        stepped.isNoteStepped = true;
        expect(checkClaimsUnmadeChange(CLAIM, stepped)).toBe(false);
        const song = genNoteWatch();
        song.createdLyric = { name: 'Grace', filePath: 'lyrics/Grace.owl' };
        expect(checkClaimsUnmadeChange(CLAIM, song)).toBe(false);
        const drafted = genNoteWatch();
        drafted.draftedLyrics = [{ key: 'title:grace', content: '<song/>' }];
        expect(checkClaimsUnmadeChange(CLAIM, drafted)).toBe(false);
        // An edit to another document in the same ask.
        const edited = genNoteWatch();
        edited.editedLyric = { name: 'Grace', undoId: 'u-1' };
        expect(checkClaimsUnmadeChange(CLAIM, edited)).toBe(false);
    });

    // EC-508: a Gemma 4 model answers in the person's own language, so the
    // claim is read in the words of the language the answer is in -- here a
    // made-up one, no language being named in code.
    test("the answer's own language's claim words, and English's beside them", () => {
        const claimWords = {
            claim: /\bzorbed\b/iu,
            save: /\bkeepa changa\b/iu,
            file: /\bthe filo\b/iu,
        };
        const note = genNoteWatch();
        expect(checkClaimsUnmadeChange('Zorbed a star.', note)).toBe(false);
        note.changeClaimWords = claimWords;
        expect(checkClaimsUnmadeChange('Zorbed a star.', note)).toBe(true);
        expect(checkClaimsUnmadeChange(CLAIM, note)).toBe(true);
        // A Save changes is a study card's, not a note's.
        expect(checkClaimsUnmadeChange('Press Keepa changa.', note)).toBe(
            false,
        );
        const study = genToolWatch();
        study.openStudyFiles = ['Default/JHN.3.The New Birth.md'];
        study.changeClaimWords = claimWords;
        expect(checkClaimsUnmadeChange('Press Keepa changa.', study)).toBe(
            true,
        );
        expect(checkClaimsUnmadeChange('The filo explains it.', study)).toBe(
            false,
        );
    });

    test('a curly apostrophe is a straight one', () => {
        expect(
            checkClaimsUnmadeChange(
                'I’ve added a gold star to the heading.',
                genNoteWatch(),
            ),
        ).toBe(true);
    });
});

// EC-700: a later line under a card holding a NEW study (EC-606), answered
// "I've changed the title" with no draft made -- the card still holds the
// words it had, and its Create would keep them. Only a change reported
// MADE: such a study is not saved yet, and an answer saying so is true.
describe('a change claimed of the new study the card above holds', () => {
    const HELD = {
        reference: 'held-1',
        name: 'JHN.3.Born Again.md',
        nameTaken: null,
        isChange: false,
        file: null,
        hash: null,
        passage: 'John 3:1-8',
        bible: 'KJV',
        diagramCount: 0,
        change: null,
        content: '# Born Again\n',
        raw: null,
    };
    const CLAIM = "I've changed the title to Born of the Spirit.";

    function genHeldWatch() {
        const watch = genToolWatch();
        watch.heldStudyBefore = { ...HELD };
        return watch;
    }

    test('a change reported made with no draft: handed back once, its card back', () => {
        const watch = genHeldWatch();
        expect(checkClaimsUnmadeHeldStudyChange(CLAIM, watch)).toBe(true);
        const found = findAnswerShapeNudge(CLAIM, watch);
        expect(found?.nudge).toMatch(
            /^Not yet: nothing in "JHN\.3\.Born Again\.md" changed/,
        );
        expect(found?.kept).toBe(CLAIM);
        expect(watch.isHeldStudyBeforeUsed).toBe(true);
        // Written again after the hand-back, it is marked.
        expect(checkClaimsUnmadeChange(CLAIM, watch)).toBe(true);
    });

    test('"not saved yet" is the truth of such a study, never a claim', () => {
        for (const words of [
            'It is not saved yet: press Create to keep it.',
            'Press Save changes under the card to keep it.',
        ]) {
            const watch = genHeldWatch();
            expect(checkClaimsUnmadeHeldStudyChange(words, watch), words).toBe(
                false,
            );
            expect(findAnswerShapeNudge(words, watch), words).toBeNull();
            expect(watch.isHeldStudyBeforeUsed, words).toBe(false);
        }
    });

    test('nor with no card above, a study open, a draft made or anything else done', () => {
        expect(checkClaimsUnmadeHeldStudyChange(CLAIM, genToolWatch())).toBe(
            false,
        );
        const open = genHeldWatch();
        open.openStudyFiles = ['Default/JHN.3.The New Birth.md'];
        expect(checkClaimsUnmadeHeldStudyChange(CLAIM, open)).toBe(false);
        const drafted = genHeldWatch();
        drafted.draftedStudy = { ...HELD, content: '# Born of the Spirit\n' };
        expect(checkClaimsUnmadeHeldStudyChange(CLAIM, drafted)).toBe(false);
        // A later line may be about anything: a passage put up ...
        const put = genHeldWatch();
        applyToolWatch(
            put,
            'owa_present_bible',
            { action: 'present', ref: 'John 3:16' },
            '{"isPresented":true}',
        );
        const putWords = "I've put John 3:16 on the screen.";
        expect(checkClaimsUnmadeHeldStudyChange(putWords, put)).toBe(false);
        expect(findAnswerShapeNudge(putWords, put)).toBeNull();
        // ... or a press.
        const pressed = genHeldWatch();
        applyToolWatch(pressed, 'owa_click', { find: 'Dark' }, '{"ok":true}');
        expect(
            checkClaimsUnmadeHeldStudyChange(
                "I've changed the theme to dark.",
                pressed,
            ),
        ).toBe(false);
        // A read of the study or of a verse changes nothing of its own.
        const read = genHeldWatch();
        applyToolWatch(
            read,
            'owa_resource_file',
            { action: 'read', file: HELD.name },
            '{"file":"JHN.3.Born Again.md","content":"# Born Again"}',
        );
        applyToolWatch(read, 'owa_find_verse', { refs: 'John 3:5' }, '{}');
        expect(checkClaimsUnmadeHeldStudyChange(CLAIM, read)).toBe(true);
    });

    // A made-up language, no language being named in code.
    test("the answer's own language's words: its claim, never its unsaved", () => {
        const watch = genHeldWatch();
        expect(checkClaimsUnmadeHeldStudyChange('Zorbed it.', watch)).toBe(
            false,
        );
        watch.changeClaimWords = {
            claim: /\bzorbed\b/iu,
            unsaved: /\bnot keepa yet\b/iu,
            save: /\bkeepa changa\b/iu,
            file: /\bthe filo\b/iu,
        };
        expect(checkClaimsUnmadeHeldStudyChange('Zorbed it.', watch)).toBe(
            true,
        );
        for (const words of ['It is not keepa yet.', 'Press Keepa changa.']) {
            expect(checkClaimsUnmadeHeldStudyChange(words, watch), words).toBe(
                false,
            );
        }
    });
});

// EC-558: asked in Khmer to take the clock off the screen, a model made one
// `owa_foreground_edit read` and answered that the clock was off -- it was
// still up. A foreground answer claiming a change no call made goes back
// once, and is marked if it stands.
describe('a foreground change claimed and never made', () => {
    const CLAIM = 'I have taken the clock off the screen.';

    function genForegroundWatch() {
        const watch = genToolWatch();
        watch.foregroundAsks = [];
        return watch;
    }

    test('a read only, then a claim: handed back once, and marked', () => {
        const watch = genForegroundWatch();
        applyToolWatch(
            watch,
            'owa_foreground_edit',
            { action: 'read' },
            '{"sessions":[]}',
        );
        expect(findAnswerShapeNudge(CLAIM, watch)?.nudge).toBe(
            FOREGROUND_CLAIM_NUDGE,
        );
        expect(checkClaimsUnmadeChange(CLAIM, watch)).toBe(true);
        // The foreground's own verbs, beside a note's.
        for (const words of [
            "I've started a 5 minute countdown.",
            'I cleared everything from the foreground.',
            'I have hidden the clock.',
            'I paused the countdown.',
        ]) {
            expect(checkClaimsUnmadeChange(words, watch), words).toBe(true);
        }
    });

    test('a refused change is no change', () => {
        const watch = genForegroundWatch();
        applyToolWatch(
            watch,
            'owa_foreground_edit',
            { action: 'hide' },
            'Tool refused: no session called "Clock" is up.',
        );
        expect(checkClaimsUnmadeChange(CLAIM, watch)).toBe(true);
    });

    test('a change a call made, a press or an undo is believed', () => {
        const hidden = genForegroundWatch();
        applyToolWatch(
            hidden,
            'owa_foreground_edit',
            { action: 'hide' },
            '{"did":"hidden","detail":"The clock is off screen 0."}',
        );
        expect(findAnswerShapeNudge(CLAIM, hidden)).toBeNull();
        expect(checkClaimsUnmadeChange(CLAIM, hidden)).toBe(false);
        const stopped = genForegroundWatch();
        applyToolWatch(
            stopped,
            'owa_foreground',
            { action: 'stop', widget: 'all' },
            '{"did":"stopped"}',
        );
        expect(checkClaimsUnmadeChange(CLAIM, stopped)).toBe(false);
        for (const name of ['owa_click', 'owa_undo']) {
            const other = genForegroundWatch();
            applyToolWatch(other, name, {}, '{"didChange":true}');
            expect(checkClaimsUnmadeChange(CLAIM, other), name).toBe(false);
        }
    });

    // EC-649: "count back from five minutes on the screen", asked the
    // general way, was answered "I have started a 5 minute countdown on the
    // screen" over one guide page read -- nothing went up.
    test('an ordinary question claiming a component changed, too', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_help_page', { id: 'W-09' }, 'W-09 …');
        const words = 'I have started a 5 minute countdown on the screen.';
        expect(findAnswerShapeNudge(words, watch)?.nudge).toBe(
            FOREGROUND_CLAIM_NUDGE,
        );
        expect(checkClaimsUnmadeChange(words, watch)).toBe(true);
        expect(checkClaimsUnmadeChange(CLAIM, genToolWatch())).toBe(true);
        // The call that put it up is believed.
        const started = genToolWatch();
        applyToolWatch(
            started,
            'owa_foreground',
            { widget: 'countdown', minutes: 5 },
            '{"did":"started"}',
        );
        expect(checkClaimsUnmadeChange(words, started)).toBe(false);
        // A claim naming no component, a how-to and an offer claim nothing.
        for (const other of [
            'I have taken it off.',
            'I have shown you how to start a countdown.',
            'Shall I start a 5 minute countdown?',
        ]) {
            expect(checkClaimsUnmadeChange(other, genToolWatch()), other).toBe(
                false,
            );
        }
        // A note or a song open in the tab is that conversation's to read.
        const note = genToolWatch();
        note.noteFiles = [];
        expect(checkClaimsUnmadeForegroundChange(words, note)).toBe(false);
        const song = genToolWatch();
        song.lyricFiles = [];
        expect(checkClaimsUnmadeForegroundChange(words, song)).toBe(false);
    });

    test('never for an offer or a state', () => {
        const watch = genForegroundWatch();
        for (const words of [
            'Shall I take the clock off the screen?',
            'The clock is on screen 0. I can take it off if you like.',
            'Shall I set it to 10 minutes?',
            'The countdown has been running for two minutes.',
        ]) {
            expect(checkClaimsUnmadeChange(words, watch), words).toBe(false);
        }
    });

    test("in the answer's own language too", () => {
        const watch = genForegroundWatch();
        watch.changeClaimWords = {
            claim: /\bzorbed\b/iu,
            save: null,
            file: null,
        };
        expect(checkClaimsUnmadeChange('Zorbed the clock.', watch)).toBe(true);
    });

    // EC-607: a language's note words say "added", never "started"; its own
    // foreground words read the rest, in a foreground ask alone.
    test("the answer's own language's foreground words", () => {
        const WORDS = 'Kicked the tocker off.';
        const claimWords = {
            claim: null,
            save: null,
            file: null,
            foreground: /\bkicked the tocker\b/iu,
        };
        const watch = genForegroundWatch();
        expect(checkClaimsUnmadeChange(WORDS, watch)).toBe(false);
        watch.changeClaimWords = claimWords;
        expect(checkClaimsUnmadeChange(WORDS, watch)).toBe(true);
        expect(findAnswerShapeNudge(WORDS, watch)?.nudge).toBe(
            FOREGROUND_CLAIM_NUDGE,
        );
        const note = genToolWatch();
        note.noteFiles = [];
        note.changeClaimWords = claimWords;
        expect(checkClaimsUnmadeChange(WORDS, note)).toBe(false);
    });
});

// 2026-11-14, the screen run's S5: asked to undo the last change, the model's
// five owa_undo calls were refused for the pace and it answered _I have
// undone the last change_ -- nothing had been put back. A refused call
// throws in `callTool`, so it never reaches `applyToolWatch`.
describe('a screen change claimed and never made', () => {
    const CLAIM = 'I have undone the last change.';
    const UNDONE = '{"undone":"20261114-001000000-ab12","undoId":"x"}';

    function genScreenWatch() {
        const watch = genToolWatch();
        watch.isScreenAsk = true;
        return watch;
    }

    test('a read only, then a claim: handed back once, and marked', () => {
        const watch = genScreenWatch();
        applyToolWatch(
            watch,
            'owa_screen_edit',
            { action: 'read' },
            '{"screens":[{"id":0,"isShowing":true}]}',
        );
        expect(findAnswerShapeNudge(CLAIM, watch)?.nudge).toBe(
            SCREEN_CLAIM_NUDGE,
        );
        expect(checkClaimsUnmadeChange(CLAIM, watch)).toBe(true);
        for (const words of [
            "I've undone the centering of the text.",
            'I undid the colour change.',
            "I've grouped screens 0 and 1.",
            'I locked screen 1.',
        ]) {
            expect(checkClaimsUnmadeChange(words, watch), words).toBe(true);
        }
        // The nudge names the tool that does an undo.
        expect(SCREEN_CLAIM_NUDGE).toContain('owa_undo');
    });

    test('an undo that went through, or a change made, is believed', () => {
        const undone = genScreenWatch();
        applyToolWatch(undone, 'owa_undo', { action: 'undo' }, UNDONE);
        expect(findAnswerShapeNudge(CLAIM, undone)).toBeNull();
        expect(checkClaimsUnmadeChange(CLAIM, undone)).toBe(false);
        const changed = genScreenWatch();
        applyToolWatch(
            changed,
            'owa_screen_edit',
            { action: 'set', lock: true },
            JSON.stringify({
                did: 'screen 1 locked',
                undoId: '20261114-001000000-cd34',
            }),
        );
        expect(checkClaimsUnmadeChange('I locked screen 1.', changed)).toBe(
            false,
        );
    });

    test('never outside a screen ask, nor for an offer or a state', () => {
        expect(checkClaimsUnmadeChange(CLAIM, genToolWatch())).toBe(false);
        const watch = genScreenWatch();
        for (const words of [
            'Shall I undo that?',
            'Screen 0 is locked and shows John 3:16.',
            'The button under the answer puts it back.',
        ]) {
            expect(checkClaimsUnmadeChange(words, watch), words).toBe(false);
        }
    });
});

// 2026-11-20, EC-770: on a host still holding the old schema, every edit
// of _Add a fade transition to every slide_ was refused and gemma4:cloud
// answered "I've added a fade transition to every slide" -- no Undo under
// it, the file as it was.
describe('a PowerPoint change claimed and never made', () => {
    const FILE = { name: 'Hymn 4.pptx', filePath: '/d/Hymn 4.pptx' };
    const CLAIM = "I've added a fade transition to every slide.";

    function genOfficeWatch() {
        const watch = genToolWatch();
        watch.officeFiles = [FILE];
        return watch;
    }

    test('a read only, then a claim: handed back once, and marked', () => {
        const watch = genOfficeWatch();
        applyToolWatch(
            watch,
            'owa_office_edit',
            { action: 'read', file: FILE.name },
            '{"kind":"PowerPoint","slides":[]}',
        );
        expect(findAnswerShapeNudge(CLAIM, watch)?.nudge).toBe(
            OFFICE_CLAIM_NUDGE,
        );
        for (const words of [
            CLAIM,
            'I have increased the size of the words on every slide.',
            'I’ve set every title to gold.',
            'I moved the title to the bottom. Undo this change puts it back.',
        ]) {
            expect(checkClaimsUnmadeOfficeChange(words, watch), words).toBe(
                true,
            );
            expect(checkClaimsUnmadeChange(words, watch), words).toBe(true);
        }
    });

    test('an edit that changed the file, or an undo, is believed', () => {
        const changed = genOfficeWatch();
        applyToolWatch(
            changed,
            'owa_office_edit',
            { action: 'edit', file: FILE.name },
            JSON.stringify({
                name: FILE.name,
                isChanged: true,
                changed: ['Every slide: fade transition.'],
                undoId: '20261120-001000000-ab12',
            }),
        );
        expect(checkClaimsUnmadeChange(CLAIM, changed)).toBe(false);
        const undone = genOfficeWatch();
        applyToolWatch(
            undone,
            'owa_undo',
            { id: 'x' },
            '{"undone":"Changed “Hymn 4.pptx”"}',
        );
        expect(checkClaimsUnmadeChange("I've put it back.", undone)).toBe(
            false,
        );
    });

    // EC-776: three refused edits, then a French answer saying in the
    // passive that the word had been replaced -- read by no language's
    // first-person claim words, over a file that had not changed. The same
    // passive in English is read by none either.
    test('edits all refused: any answer is handed back and marked', () => {
        const words = 'The word "Pray" has been replaced by "Worship".';
        const fresh = genOfficeWatch();
        expect(checkClaimsUnmadeChange(words, fresh)).toBe(false);
        const refused = genOfficeWatch();
        refused.officeEditFailCount = 3;
        expect(findAnswerShapeNudge(words, refused)?.nudge).toBe(
            OFFICE_CLAIM_NUDGE,
        );
        expect(checkClaimsUnmadeChange(words, refused)).toBe(true);
        // one went through after them: believed
        applyToolWatch(
            refused,
            'owa_office_edit',
            { action: 'edit', file: FILE.name },
            JSON.stringify({
                name: FILE.name,
                isChanged: true,
                changed: ['Replaced “Pray” with “Worship” (1 place).'],
                undoId: '20261121-001000000-ab12',
            }),
        );
        expect(checkClaimsUnmadeChange(words, refused)).toBe(false);
    });

    // 2026-11-21: a fill on a SmartArt is refused with "Say so and ask"
    // (it must be turned into shapes first); the answer that asks is that
    // question, not an unmade change -- one that claims it still is
    test('a refusal that says to ask first, answered with a question', () => {
        const asked = genOfficeWatch();
        asked.officeEditFailCount = 1;
        asked.officeAskFirstCount = 1;
        expect(
            checkClaimsUnmadeChange(
                'It is a SmartArt. Shall I turn it into shapes first?',
                asked,
            ),
        ).toBe(false);
        expect(
            checkClaimsUnmadeChange('It is a SmartArt, so I left it.', asked),
        ).toBe(true);
        expect(
            checkClaimsUnmadeChange(
                "I've made the boxes green. Anything else?",
                asked,
            ),
        ).toBe(true);
        asked.officeEditFailCount = 2;
        expect(
            checkClaimsUnmadeChange('Shall I turn it into shapes?', asked),
        ).toBe(true);
    });

    test('never outside an office ask, nor for an offer or a refusal said', () => {
        expect(checkClaimsUnmadeOfficeChange(CLAIM, genToolWatch())).toBe(
            false,
        );
        const watch = genOfficeWatch();
        for (const words of [
            'Shall I set every title to gold?',
            'The fade transition could not be added: the tool refused it.',
            'Slide 2 has a fade transition already.',
        ]) {
            expect(checkClaimsUnmadeChange(words, watch), words).toBe(false);
        }
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

        // The file name alone is the study the tab has open (EC-706).
        expect(fake.toolCallList).toEqual([
            { name: 'owa_resource_file', args: { ...readPart, file: OPEN } },
            {
                name: 'owa_resource_file',
                args: { action: 'read', file: OPEN },
            },
            {
                name: 'owa_resource_file',
                args: {
                    action: 'draft',
                    file: OPEN,
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

        // The file name alone is the study the tab has open (EC-706).
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_resource_file',
                args: { action: 'read', file: OPEN },
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

    // EC-508: the report as the language of the answer writes it -- here a
    // made-up one -- and English's beside it.
    test('findStudyChangeReport reads the language the answer is in', () => {
        const file = 'JHN.3.The New Birth.md';
        const claimWords = {
            claim: /\bzorbed\b/iu,
            save: /\bkeepa changa\b/iu,
            file: /\bthe filo\b/iu,
        };
        const own = 'Zorbed the cross-references in the filo.';
        expect(findStudyChangeReport({ file, content: own })).toBeNull();
        expect(findStudyChangeReport({ file, content: own }, claimWords)).toBe(
            own,
        );
        // Its claim and English's pointer, and its Save changes alone.
        expect(
            findStudyChangeReport(
                { file, append: 'Zorbed this file with the new verses.' },
                claimWords,
            ),
        ).toBe('Zorbed this file with the new verses.');
        expect(
            findStudyChangeReport(
                { file, content: 'Press Keepa changa to keep it.' },
                claimWords,
            ),
        ).toBe('Press Keepa changa to keep it.');
        // Its file words with no claim are a study's own.
        expect(
            findStudyChangeReport(
                { file, content: 'The filo explains John 3:16.' },
                claimWords,
            ),
        ).toBeNull();
        // English's curly apostrophe.
        expect(
            findStudyChangeReport({
                file,
                content: 'I’ve fixed the typo in the study file.',
            }),
        ).toBe('I’ve fixed the typo in the study file.');
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

// A PowerPoint or Word file opened in the chat (EC-761): the model names it,
// the window puts its path in, and every change of one answer is one Undo.
describe('a PowerPoint or Word file conversation', () => {
    const deck = {
        name: 'Sunday Welcome.pptx',
        filePath: '/church/documents/Sunday Welcome.pptx',
    };

    test('the name becomes the path, a path is refused, two edits are one Undo', async () => {
        fake.toolList = [{ name: 'owa_office_edit' }];
        const undoIdList = ['o-1', 'o-2'];
        fake.answerTool = (_name, args) => {
            if (args.action === 'read') {
                return JSON.stringify({ kind: 'PowerPoint', slideCount: 1 });
            }
            return changed('Sunday Welcome.pptx', undoIdList.shift()!);
        };
        const { sentList } = useAnthropic([
            anthropicToolUse(
                {
                    name: 'owa_office_edit',
                    input: { action: 'read', file: '/etc/Sunday Welcome.pptx' },
                },
                {
                    name: 'owa_office_edit',
                    input: { action: 'read', file: 'sunday welcome' },
                },
                {
                    name: 'owa_office_edit',
                    input: {
                        action: 'edit',
                        file: 'Sunday Welcome.pptx',
                        replace: [{ from: 'Lord', to: 'God' }],
                    },
                },
                // sent with no `action`: an edit, filled in by the window
                // and counted as one (EC-770)
                {
                    name: 'owa_office_edit',
                    input: {
                        file: 'Sunday Welcome',
                        changes: [{ id: '1.1', text: 'Welcome home' }],
                    },
                },
            ),
            anthropicText('I changed the words. It is kept in the file.'),
        ]);

        const answer = await askLlmBot(
            'Change Lord to God and the title to Welcome home',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { office: { files: [deck] } },
        );

        expect(sentList[0].system[0].text).toBe(OFFICE_SYSTEM_PROMPT);
        expect(readToolResults(sentList[1])[0]).toMatch(/^Tool refused: /);
        expect(
            fake.toolCallList.map((call) => {
                return [call.args.action, call.args.file];
            }),
        ).toEqual([
            ['read', deck.filePath],
            ['edit', deck.filePath],
            ['edit', deck.filePath],
        ]);
        // The read changed nothing; both edits are undone by one press.
        expect(answer.actions).toEqual([
            {
                label: 'Undo this change',
                toolName: 'lyric-undo',
                args: {
                    id: 'o-2',
                    name: 'Sunday Welcome.pptx',
                    ids: ['o-1', 'o-2'],
                },
            },
        ]);
    });

    test('a picture by its attached name: the window puts its path in', async () => {
        fake.toolList = [{ name: 'owa_office_edit' }];
        fake.answerTool = () => {
            return changed('Sunday Welcome.pptx', 'o-3');
        };
        const photo = {
            name: 'Choir.jpg',
            filePath: '/Users/a/Pictures/Choir.jpg',
        };
        const { sentList } = useAnthropic([
            anthropicToolUse(
                // a path the model writes is never taken
                {
                    name: 'owa_office_edit',
                    input: {
                        action: 'edit',
                        file: 'Sunday Welcome.pptx',
                        changes: [{ slide: 2, picture: '/etc/x.png' }],
                    },
                },
                {
                    name: 'owa_office_edit',
                    input: {
                        file: 'Sunday Welcome.pptx',
                        changes: [
                            {
                                slide: 2,
                                picture: 'choir',
                                at: [60, 10, 30, null],
                            },
                        ],
                    },
                },
            ),
            anthropicText('I put the choir photo on slide 2.'),
        ]);

        await askLlmBot(
            'Put this photo on slide 2',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { office: { files: [deck], pictures: [photo] } },
        );

        expect(readToolResults(sentList[1])[0]).toBe(
            'Tool refused: `picture` names a picture attached to this chat ' +
                'by its name, never a path: "Choir.jpg".',
        );
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_office_edit',
                args: {
                    action: 'edit',
                    file: deck.filePath,
                    changes: [
                        {
                            slide: 2,
                            picture: photo.filePath,
                            at: [60, 10, 30, null],
                        },
                    ],
                },
            },
        ]);
    });

    // EC-777: a picture at a link the person typed is downloaded by the
    // window and put in by its file; a link they never typed is refused,
    // and one given twice is one download.
    test('a picture from a link they typed: downloaded, then put in', async () => {
        fake.toolList = [{ name: 'owa_office_edit' }];
        fake.downloadList = [];
        fake.letGoList = [];
        fake.answerTool = () => {
            return changed('Sunday Welcome.pptx', 'o-9');
        };
        const typed = 'https://cdn.example.org/img/choir.jpg';
        const { sentList } = useAnthropic([
            anthropicToolUse(
                {
                    name: 'owa_office_edit',
                    input: {
                        action: 'edit',
                        file: 'Sunday Welcome.pptx',
                        changes: [
                            {
                                slide: 2,
                                picture: 'https://other.example/x.png',
                            },
                        ],
                    },
                },
                {
                    name: 'owa_office_edit',
                    input: {
                        action: 'edit',
                        file: 'Sunday Welcome.pptx',
                        changes: [
                            {
                                slide: 2,
                                picture: typed,
                                at: [60, 10, 30, null],
                            },
                            { slide: 3, picture: typed },
                        ],
                    },
                },
            ),
            anthropicText('I put the choir photo on slides 2 and 3.'),
        ]);

        await askLlmBot(
            `Put this photo on slides 2 and 3: ${typed}.`,
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                office: { files: [deck] },
                askedText: `Put this photo on slides 2 and 3: ${typed}.`,
            },
        );

        expect(readToolResults(sentList[1])[0]).toMatch(
            /^Tool refused: A picture, video or sound from the web goes in only from a link THEY typed/,
        );
        expect(fake.downloadList).toEqual([{ url: typed, want: 'picture' }]);
        // the deck keeps its own copy: the download is let go at the end
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(fake.letGoList).toEqual([
            '/tmp/open-worship-app-office-links/a/choir.jpg',
        ]);
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_office_edit',
                args: {
                    action: 'edit',
                    file: deck.filePath,
                    changes: [
                        {
                            slide: 2,
                            picture:
                                '/tmp/open-worship-app-office-links/a/choir.jpg',
                            at: [60, 10, 30, null],
                        },
                        {
                            slide: 3,
                            picture:
                                '/tmp/open-worship-app-office-links/a/choir.jpg',
                        },
                    ],
                },
            },
        ]);
    });

    test("a link that is a page: the download's reason, the tool never called", async () => {
        fake.toolList = [{ name: 'owa_office_edit' }];
        fake.downloadList = [];
        const typed = 'https://example.org/page/choir';
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_office_edit',
                input: {
                    action: 'edit',
                    file: 'Sunday Welcome.pptx',
                    changes: [{ slide: 2, picture: typed }],
                },
            }),
            anthropicText('That link is a page, not the picture.'),
            // every edit refused: the answer is handed back once (EC-776)
            anthropicText(
                'Nothing was changed: that link is a web page. Send the ' +
                    "picture's own link, or save it and drag it in.",
            ),
        ]);

        await askLlmBot(
            `Put the picture at ${typed} on slide 2`,
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [{ author: 'you', text: `Here it is: ${typed}` }],
            null,
            { office: { files: [deck] }, askedText: 'Put it on slide 2' },
        );

        expect(readToolResults(sentList[1])[0]).toBe(
            'Tool refused: The link is a web page.',
        );
        expect(fake.toolCallList).toEqual([]);
    });

    test('outside such a chat the tool is refused and never called', async () => {
        fake.toolList = [{ name: 'owa_help_search' }];
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_office_edit',
                input: { action: 'edit', file: 'Sunday Welcome.pptx' },
            }),
            anthropicText('Open the file in the chat first.'),
        ]);

        await askLlmBot(
            'Change my PowerPoint',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );

        expect(readToolResults(sentList[1])[0]).toMatch(
            /^Tool refused: owa_office_edit changes a PowerPoint or Word file/,
        );
        expect(fake.toolCallList).toEqual([]);
    });
});
