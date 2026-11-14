import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// What `runMcpToolCall` does when the app's half of a call fails, or a stop
// comes in the middle of it -- a Bible list or a note that cannot be read,
// a study draft or plan the tool host drops, a translator that throws once,
// mermaid that does not load -- and the asks the other suites never make:
// a foreground session's conversation, a note put into another language
// read in parts, a sentence putting a verse in the wrong Testament. The
// mock surface is `llmBotHelpers.ut100.test.ts`'s, with an OpenAI-shaped
// client for the loop's dropped-reply nudge and a mermaid that can fail to
// load.
const { fake, settingMap } = vi.hoisted(() => ({
    fake: {
        anthropic: null as any,
        openai: null as any,
        toolList: [] as { name: string }[],
        // Every call the loop made of the tool host, in order.
        toolCallList: [] as { name: string; args: any }[],
        answerTool: null as null | ((name: string, args: any) => string),
        // Every diagram source mermaid was asked to parse.
        parsedList: [] as string[],
        isMermaidGone: false,
    },
    settingMap: new Map<string, string>(),
}));

vi.mock('../helper/ai/aiHelpers', () => ({
    getAISetting: () => {
        return {
            openAIAPIKey: 'sk-test',
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
    getOpenAIInstance: () => fake.openai,
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
// Mermaid's parse: a diagram with BROKEN in it does not draw, and with
// `isMermaidGone` the module does not load at all.
vi.mock('../markdown-preview/markdownMermaidHelpers', () => ({
    findMermaidParseErrors: async (sourceList: string[]) => {
        if (fake.isMermaidGone) {
            throw new Error('The diagram module did not load.');
        }
        fake.parsedList.push(...sourceList);
        return sourceList.map((source) => {
            return source.includes('BROKEN') ? 'Parse error on line 2' : null;
        });
    },
}));
vi.mock('./mcpClient', () => ({
    callTool: async (name: string, args?: any) => {
        fake.toolCallList.push({ name, args });
        return fake.answerTool === null ? '' : fake.answerTool(name, args);
    },
    callToolWithPictures: async (name: string, args?: any) => {
        fake.toolCallList.push({ name, args });
        return {
            text: fake.answerTool === null ? '' : fake.answerTool(name, args),
            pictures: [],
        };
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
import {
    FOREGROUND_EDIT_TOOL_NAME,
    FOREGROUND_SYSTEM_PROMPT,
} from './foregroundChatHelpers';
import {
    NOTE_BLANK_LESSON_HINT,
    NOTE_REWRITE_DROPPED_NUDGE,
} from './noteChatHelpers';

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

function useOpenAi(rounds: any[]) {
    const sentList: any[] = [];
    const create = vi.fn(async (request: any) => {
        sentList.push(snapshotOf(request));
        return rounds.shift();
    });
    fake.openai = { chat: { completions: { create } } };
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

function callsOf(name: string) {
    return fake.toolCallList.filter((call) => {
        return call.name === name;
    });
}

const NOTE_FILE = {
    name: 'Lesson',
    filePath: 'C:\\notes\\Default.own',
    noteId: 4,
};

/** A stop pressed while the tool host is working, as `callTool` meets it. */
function genStop() {
    const controller = new AbortController();
    const stop = () => {
        controller.abort();
        const error: any = new Error('The ask was stopped.');
        error.name = 'AbortError';
        throw error;
    };
    return { signal: controller.signal, stop };
}

beforeEach(() => {
    settingMap.clear();
    fake.anthropic = null;
    fake.openai = null;
    fake.toolList = [];
    fake.toolCallList = [];
    fake.answerTool = null;
    fake.parsedList = [];
    fake.isMermaidGone = false;
    resetSpendGuardForTests();
    resetReasoningOffMemoryForTests();
});
afterEach(() => {
    resetSpendGuardForTests();
});

describe('a foreground session changed in its conversation', () => {
    test('a change is the ask done, with its undo and its session; a read is neither', () => {
        const watch = genToolWatch();
        applyToolWatch(
            watch,
            FOREGROUND_EDIT_TOOL_NAME,
            { action: 'read' },
            JSON.stringify({ did: 'read', component: 'countdown' }),
        );
        expect(watch.isActedOn).toBe(false);
        expect(watch.editedLyric).toBeNull();
        applyToolWatch(
            watch,
            FOREGROUND_EDIT_TOOL_NAME,
            { action: 'set' },
            JSON.stringify({
                did: 'changed',
                isChanged: true,
                undoId: 'u-1',
                component: 'Countdown',
                session: { name: 'Opening' },
            }),
        );
        expect(watch.isActedOn).toBe(true);
        expect(watch.editedLyric).toMatchObject({
            name: 'Opening',
            undoId: 'u-1',
            listName: 'Countdown',
        });
    });

    test('outside a foreground conversation the change is refused, and nothing is called', async () => {
        fake.toolList = [{ name: FOREGROUND_EDIT_TOOL_NAME }];
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: FOREGROUND_EDIT_TOOL_NAME,
                input: { action: 'set', widget: 'countdown', look: 'larger' },
            }),
            anthropicText('I could not change it from here.'),
        ]);
        await askLlmBot(
            'make the countdown larger',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );
        expect(readToolResults(sentList[1])[0]).toBe(
            `Tool refused: ${FOREGROUND_EDIT_TOOL_NAME} changes a foreground ` +
                'component in a conversation about one. Use owa_foreground ' +
                'to start or stop one.',
        );
        expect(fake.toolCallList).toEqual([]);
    });

    test('the session the model names is the attached one, by its id', async () => {
        fake.toolList = [{ name: FOREGROUND_EDIT_TOOL_NAME }];
        fake.answerTool = () => {
            return JSON.stringify({
                did: 'changed',
                isChanged: true,
                undoId: 'u-2',
                component: 'Countdown',
                session: { name: 'Opening' },
            });
        };
        const { sentList } = useAnthropic([
            anthropicToolUse(
                {
                    name: FOREGROUND_EDIT_TOOL_NAME,
                    input: {
                        action: 'set',
                        widget: 'countdown',
                        session: 'Opening',
                        look: 'larger',
                    },
                },
                {
                    name: FOREGROUND_EDIT_TOOL_NAME,
                    input: { action: 'show', widget: 'countdown' },
                },
            ),
            anthropicText('The countdown is larger now.'),
        ]);

        const answer = await askLlmBot(
            'make the countdown larger',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                foreground: {
                    asks: [
                        {
                            widget: 'countdown',
                            sessionId: 's1abc',
                            sessionName: 'Opening',
                        },
                    ],
                },
            },
        );

        // A foreground conversation's own prompt.
        expect(JSON.stringify(sentList[0].system)).toContain(
            JSON.stringify(FOREGROUND_SYSTEM_PROMPT).slice(1, 80),
        );
        expect(
            callsOf(FOREGROUND_EDIT_TOOL_NAME).map((call) => call.args),
        ).toEqual([
            {
                action: 'set',
                widget: 'countdown',
                session: 's1abc',
                look: 'larger',
            },
            // No session named: the call goes as written.
            { action: 'show', widget: 'countdown' },
        ]);
        expect(answer.text).toContain('The countdown is larger now.');
    });
});

describe('a note put into another language', () => {
    const TRANSLATE_NOTE = {
        files: [NOTE_FILE],
        translate: { code: 'xx', name: 'Xish' },
    };
    const EDIT = {
        name: 'owa_note_edit',
        input: {
            action: 'edit',
            note: 'Lesson',
            changes: [{ block: 2, text: 'Xish love [^(KJV) John 3:16] .' }],
        },
    };
    const BLOCKS = [
        {
            n: 1,
            kind: 'passage',
            text: '(KJV) John 3:16 — (16): For God so loved',
        },
        { n: 2, kind: 'paragraph', text: 'Love [^(KJV) John 3:16] given.' },
    ];
    const BIBLES = {
        bible: 'KJV',
        bibles: [
            { key: 'KJV', locale: 'en' },
            { key: 'XXB', locale: 'xx-YY' },
        ],
    };

    function askTranslate(signal: AbortSignal | null = null) {
        useAnthropic([anthropicToolUse(EDIT), anthropicText('Done.')]);
        return askLlmBot(
            'Replace the words with Xish',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            signal,
            { note: TRANSLATE_NOTE },
        );
    }

    function editCall() {
        return fake.toolCallList.find((call) => {
            return call.args?.action === 'edit';
        });
    }

    function readCalls() {
        return fake.toolCallList
            .filter((call) => call.args?.action === 'read')
            .map((call) => call.args);
    }

    beforeEach(() => {
        fake.toolList = [{ name: 'owa_note_edit' }];
    });

    test('a long note is read in its parts before its verses are moved', async () => {
        fake.answerTool = (name, args) => {
            if (name === 'owa_find_verse') {
                return JSON.stringify(BIBLES);
            }
            if (args?.action === 'read') {
                return JSON.stringify(
                    args.from === undefined
                        ? { hash: 'h', blocks: [BLOCKS[0]], nextFrom: 2 }
                        : { hash: 'h', blocks: [BLOCKS[1]] },
                );
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        await askTranslate();
        expect(readCalls()).toEqual([
            { action: 'read', file: 'C:\\notes\\Default.own', id: 4 },
            { action: 'read', file: 'C:\\notes\\Default.own', id: 4, from: 2 },
        ]);
        // Both parts read: the passage of block 1 is read again too.
        expect(editCall()?.args.changes).toEqual([
            { block: 2, text: 'Xish love [^(XXB) John 3:16] .' },
            { block: 1, ref: '(XXB) John 3:16' },
        ]);
    });

    test('a read that never ends is stopped at its tenth part', async () => {
        fake.answerTool = (name, args) => {
            if (name === 'owa_find_verse') {
                return JSON.stringify(BIBLES);
            }
            if (args?.action === 'read') {
                const from = args.from ?? 1;
                return JSON.stringify({
                    hash: 'h',
                    blocks: from === 1 ? BLOCKS : [],
                    nextFrom: from + 1,
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        await askTranslate();
        expect(readCalls()).toHaveLength(10);
        expect(readCalls()[9].from).toBe(10);
        // What was read is still used.
        expect(editCall()?.args.changes).toContainEqual({
            block: 1,
            ref: '(XXB) John 3:16',
        });
    });

    test('a note that cannot be read keeps the change as the model wrote it', async () => {
        for (const read of ['{"hash":"h"}', 'The note window closed.']) {
            fake.toolCallList = [];
            fake.answerTool = (name, args) => {
                if (name === 'owa_find_verse') {
                    return JSON.stringify(BIBLES);
                }
                if (args?.action === 'read') {
                    return read;
                }
                return JSON.stringify({ name: 'Lesson', isChanged: true });
            };
            await askTranslate();
            expect(readCalls()).toHaveLength(1);
            expect(editCall()?.args.changes).toEqual(EDIT.input.changes);
        }
    });

    test('a Bible list that cannot be read moves no verse', async () => {
        fake.answerTool = (name, args) => {
            if (name === 'owa_find_verse') {
                return 'The verse finder is not ready.';
            }
            if (args?.action === 'read') {
                return JSON.stringify({ hash: 'h', blocks: BLOCKS });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        await askTranslate();
        expect(callsOf('owa_find_verse')).toHaveLength(1);
        const edit = editCall();
        expect(edit?.args.bible).toBeUndefined();
        expect(edit?.args.changes).toEqual(EDIT.input.changes);
    });

    test('a stop while the Bible list or the note is read writes nothing', async () => {
        for (const stopAt of ['list', 'read']) {
            fake.toolCallList = [];
            const { signal, stop } = genStop();
            fake.answerTool = (name, args) => {
                if (name === 'owa_find_verse') {
                    return stopAt === 'list' ? stop() : JSON.stringify(BIBLES);
                }
                if (args?.action === 'read') {
                    return stop();
                }
                return JSON.stringify({ name: 'Lesson', isChanged: true });
            };
            const raised = await askTranslate(signal).catch((error) => error);
            expect(raised).toBeInstanceOf(Error);
            expect(editCall()).toBeUndefined();
        }
    });
});

describe('a study file drafted', () => {
    const DRAFT = {
        action: 'draft',
        ref: 'Matthew 3:3-7',
        title: 'The Voice',
        content: 'A study of the voice in the wilderness.',
    };

    function genDrafted(content: string) {
        return JSON.stringify({
            drafted: true,
            isChange: false,
            name: 'MAT.3.3-7 The Voice.md',
            passage: 'Matthew 3:3-7',
            bible: 'KJV',
            diagramCount: 1,
            warnings: [],
            content,
        });
    }

    function askDraft(input: any = DRAFT, extra: any = {}) {
        const used = useAnthropic([
            anthropicToolUse({ name: 'owa_resource_file', input }),
            anthropicText('It is drafted.'),
        ]);
        return askLlmBot(
            'Make a study file for Matthew 3:3-7',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            extra,
        ).then((answer) => {
            return { answer, seen: readToolResults(used.sentList[1])[0] };
        });
    }

    function draftCall() {
        return fake.toolCallList.find((call) => {
            return call.args?.action === 'draft';
        });
    }

    test("asked in another language, the passage is quoted from that language's Bible", async () => {
        fake.answerTool = (name) => {
            if (name === 'owa_find_verse') {
                return JSON.stringify({
                    bible: 'KJV',
                    bibles: [
                        { key: 'KJV', locale: 'en' },
                        { key: 'XXB', locale: 'xx-YY' },
                    ],
                });
            }
            return genDrafted('# The Voice\n\nA study.');
        };
        await askDraft(DRAFT, { study: { verseLang: 'xx' } });
        expect(draftCall()?.args).toEqual({ ...DRAFT, bible: 'XXB' });
    });

    test('a Bible list that cannot be read keeps the Lookup Bible', async () => {
        fake.answerTool = (name) => {
            if (name === 'owa_find_verse') {
                return 'The verse finder is not ready.';
            }
            return genDrafted('# The Voice\n\nA study.');
        };
        await askDraft(DRAFT, { study: { verseLang: 'xx' } });
        expect(draftCall()?.args).toEqual(DRAFT);
    });

    test('a tool host that fails is said as a tool error, and no card comes', async () => {
        fake.answerTool = () => {
            throw new Error('The app did not answer.');
        };
        const { answer, seen } = await askDraft();
        expect(seen).toBe('Tool error: The app did not answer.');
        expect(answer.actions ?? []).toEqual([]);
    });

    test("the app's own refusal reaches the model as it was written", async () => {
        const refusal = 'No installed Bible could read Matthew 3:3-7.';
        fake.answerTool = () => refusal;
        const { answer, seen } = await askDraft();
        expect(seen).toBe(refusal);
        expect(answer.actions ?? []).toEqual([]);
    });

    test("a new study's diagram that does not draw goes back once", async () => {
        const diagram = '```mermaid\ngraph TD\n    A --> BROKEN\n```';
        fake.answerTool = () => {
            return genDrafted(`# The Voice\n\nA study.\n\n${diagram}\n`);
        };
        const { seen } = await askDraft();
        expect(fake.parsedList).toEqual(['graph TD\n    A --> BROKEN']);
        expect(seen).toBe(
            'Tool refused: Diagram 1 does not draw: Parse error on line 2 ' +
                'Fix it and call draft again with the whole study.',
        );
    });
});

describe('a study file open in the tab, read by the window', () => {
    const OPEN = 'Default/JHN.3.The New Birth.md';
    const NAME = 'JHN.3.The New Birth.md';
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
        resources: { canSeePictures: false, openFiles: [OPEN] },
    };

    function genChange(content: string) {
        return JSON.stringify({
            drafted: true,
            isChange: true,
            name: NAME,
            file: OPEN,
            hash: 'h-1',
            diagramCount: 0,
            change: 'It changes words inside the sections.',
            warnings: [],
            content,
        });
    }

    async function askFix(
        question: string,
        drafts: any[],
        finalText = 'Press Save changes to write it.',
    ) {
        const used = useAnthropic([
            anthropicToolUse(
                ...drafts.map((input) => {
                    return { name: 'owa_resource_file', input };
                }),
            ),
            anthropicText(finalText),
        ]);
        const answer = await askLlmBot(
            question,
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            RESOURCES_EXTRA,
        );
        return { answer, seenList: readToolResults(used.sentList[1]) };
    }

    test('a report of a change is refused even when the file cannot be read for its headings', async () => {
        fake.answerTool = (_name, args) => {
            if (args.action === 'read') {
                throw new Error('The file is busy.');
            }
            return genChange(OLD);
        };
        const { answer, seenList } = await askFix(
            'Question 1 is wrong. Fix it.',
            [
                {
                    action: 'draft',
                    file: NAME,
                    section: 'Questions',
                    content:
                        'I have fixed the questions in the study file. ' +
                        'They read well now.',
                },
            ],
            'I could not change the file this time.',
        );
        expect(fake.toolCallList.map((call) => call.args.action)).toEqual([
            'read',
        ]);
        expect(seenList[0]).toMatch(
            /^Tool refused: These words say what was done to the study/,
        );
        // No headings could be read to name.
        expect(seenList[0]).not.toContain('## Questions');
        expect(answer.actions ?? []).toEqual([]);
    });

    test('a part nothing showed is drafted when the window cannot read it', async () => {
        fake.answerTool = (_name, args) => {
            if (args.action === 'read') {
                throw new Error('The file is busy.');
            }
            return genChange(OLD.replace('1. Who came?', args.content));
        };
        const draft = {
            action: 'draft',
            file: OPEN,
            section: 'Questions',
            content: '1. Who came to Jesus by night?',
        };
        const { answer } = await askFix('Fix the questions in the study.', [
            draft,
        ]);
        expect(fake.toolCallList.map((call) => call.args)).toEqual([
            { action: 'read', file: OPEN, section: 'Questions' },
            draft,
        ]);
        expect(answer.actions?.[0]?.label).toBe(`Save changes to "${NAME}"`);
    });

    test('a second part naming a heading the held change lacks is refused', async () => {
        fake.answerTool = (_name, args) => {
            if (args.action === 'read') {
                return JSON.stringify({ file: OPEN, kind: 'text', text: OLD });
            }
            return genChange(
                OLD.replace('- Num 21:8-9', String(args.content ?? '')),
            );
        };
        const { seenList } = await askFix('Fix the study file.', [
            {
                action: 'draft',
                file: OPEN,
                section: 'Cross References',
                content: '- Numbers 21:8-9',
            },
            {
                action: 'draft',
                file: OPEN,
                section: 'Closing Prayer',
                content: 'Amen.',
            },
        ]);
        const drafts = fake.toolCallList.filter((call) => {
            return call.args.action === 'draft';
        });
        expect(drafts).toHaveLength(1);
        expect(seenList[1]).toMatch(/^Tool refused: /);
        expect(seenList[1]).toContain('Closing Prayer');
    });

    // EC-537: words written anew where they stand.
    function genReplaced(content: string, diagramsChanged: number[]) {
        return JSON.stringify({
            drafted: true,
            isChange: true,
            name: NAME,
            file: OPEN,
            hash: 'h-1',
            diagramCount: 2,
            change: 'It writes the words anew; nothing else changes.',
            replaced: [],
            diagramsChanged,
            warnings: [],
            content,
        });
    }

    test("a replace that leaves one of the file's diagrams undrawable is refused every time, never dropped", async () => {
        const own = '```mermaid\ngraph TD\n    A["Law"] --> BROKEN\n```';
        const places =
            '```mermaid\ngraph TD\n    A["BROKEN"] --> B["Salim"]\n```';
        fake.answerTool = () => {
            return genReplaced(`${OLD}\n${own}\n\n${places}\n`, [1]);
        };
        const draft = {
            action: 'draft',
            file: OPEN,
            replace: [{ from: 'Aenon', to: 'BROKEN' }],
        };
        const used = useAnthropic([
            anthropicToolUse({ name: 'owa_resource_file', input: draft }),
            anthropicToolUse({ name: 'owa_resource_file', input: draft }),
            anthropicText('That name would break the diagram.'),
        ]);
        const answer = await askLlmBot(
            'Write Aenon as BROKEN in the study.',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            RESOURCES_EXTRA,
        );
        const refusal =
            'Tool refused: Diagram 2 of the file would not draw with these ' +
            'words in it: Parse error on line 2 Nothing is changed: call ' +
            'draft again without the pair that changes it, or with a `to` ' +
            'the diagram can hold.';
        expect(readToolResults(used.sentList[1])).toEqual([refusal]);
        expect(readToolResults(used.sentList[2])).toEqual([refusal]);
        // The diagram the words changed is parsed; the person's own, broken
        // before, is theirs and never looked at.
        const changed = 'graph TD\n    A["BROKEN"] --> B["Salim"]';
        expect(fake.parsedList).toEqual([changed, changed]);
        expect(answer.actions ?? []).toEqual([]);
    });

    test('a replace written as JSON text reaches the tool as a list, and one changing no diagram parses none', async () => {
        const replace = [{ from: 'Who came?', to: 'Who came by night?' }];
        fake.answerTool = () => {
            return genReplaced(
                `${OLD.replace('Who came?', 'Who came by night?')}\n` +
                    '```mermaid\ngraph TD\n    A --> BROKEN\n```\n',
                [],
            );
        };
        const { answer } = await askFix('Fix question 1.', [
            { action: 'draft', file: OPEN, replace: JSON.stringify(replace) },
        ]);
        expect(fake.toolCallList.map((call) => call.args)).toEqual([
            { action: 'draft', file: OPEN, replace },
        ]);
        expect(fake.parsedList).toEqual([]);
        expect(answer.actions?.[0]?.label).toBe(`Save changes to "${NAME}"`);
    });
});

describe('a study file translated by the window', () => {
    const FILE = 'Default/JHN.3.The New Birth.md';
    const NAME = 'JHN.3.The New Birth.md';
    const DIAGRAM = '```mermaid\ngraph TD\n    A["Night"] --> B["Light"]\n```';

    function genPlan(ref: string | null = 'JHN 3') {
        return JSON.stringify({
            translating: true,
            file: FILE,
            name: NAME,
            hash: 'h-1',
            title: 'The New Birth',
            ref,
            bible: null,
            passageCount: 0,
            quotedCount: 0,
            parts: [
                {
                    kind: 'text',
                    text: '# The New Birth\n\nA night talk with a teacher.\n',
                },
                { kind: 'diagram', text: DIAGRAM },
            ],
            footer: '\n---\n\n*Drafted by the assistant.*\n',
            note: 'Translate each part.',
        });
    }

    function genDraftResult() {
        return JSON.stringify({
            drafted: true,
            isChange: true,
            name: NAME,
            file: FILE,
            hash: 'h-1',
            passage: 'John 3',
            bible: 'KJV',
            diagramCount: 2,
            change: 'adds a translation at its end',
            content: '# The New Birth\n\nThe whole file with its translation.',
        });
    }

    function useToolHost({
        plan = () => genPlan(),
        draft = genDraftResult,
        bibleList = () => JSON.stringify({ bible: null, bibles: [] }),
    }: {
        plan?: () => string;
        draft?: () => string;
        bibleList?: () => string;
    } = {}) {
        fake.answerTool = (name, args) => {
            if (name === 'owa_find_verse') {
                return bibleList();
            }
            if (args?.action === 'translate') {
                return plan();
            }
            if (args?.action === 'draft') {
                return draft();
            }
            return '';
        };
    }

    // "Testish": every word of four letters or more gets an `o`; a diagram
    // only its quoted labels.
    function toTestish(ask: string) {
        const source = ask.slice(0, ask.lastIndexOf('\n\n('));
        return ask.includes('(This is a mermaid diagram')
            ? source.replace(/"([^"]+)"/g, '"$1o"')
            : source.replace(/\b([A-Za-z]{4,})\b/g, '$1o');
    }

    async function askTranslate(
        input: Record<string, unknown>,
        translateText = vi.fn(async (ask: string) => {
            return { text: toTestish(ask), by: 'Gemma 4 (test)' };
        }),
        signal: AbortSignal | null = null,
    ) {
        const used = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: { action: 'translate', file: FILE, ...input },
            }),
            anthropicText('It is translated.'),
        ]);
        const answer = await askLlmBot(
            'translate the study and add it after',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            signal,
            { translateText },
        );
        return {
            answer,
            seen: readToolResults(used.sentList[1])[0],
            translateText,
        };
    }

    function actionsCalled() {
        return fake.toolCallList.map((call) => {
            return call.name === 'owa_find_verse' ? 'bibles' : call.args.action;
        });
    }

    test('a Bible list that cannot be read asks the plan with no Bible', async () => {
        useToolHost({ bibleList: () => 'The verse finder is not ready.' });
        const { seen } = await askTranslate({
            language: 'English',
            place: 'append',
        });
        expect(actionsCalled()).toEqual(['bibles', 'translate', 'draft']);
        expect(fake.toolCallList[1].args).toEqual({
            action: 'translate',
            file: FILE,
        });
        expect(seen).toMatch(/^The window translated /);
    });

    test('a translator that fails once is asked again, and the job goes on', async () => {
        useToolHost();
        let isFailed = false;
        const translateText = vi.fn(async (ask: string) => {
            if (!isFailed) {
                isFailed = true;
                throw new Error('The translator is busy.');
            }
            return { text: toTestish(ask), by: 'Gemma 4 (test)' };
        });
        const { seen } = await askTranslate(
            { language: 'Testish', place: 'append' },
            translateText,
        );
        // One failed ask and the two parts.
        expect(translateText).toHaveBeenCalledTimes(3);
        expect(actionsCalled()).toEqual(['translate', 'draft']);
        expect(fake.toolCallList[1].args.append).toContain(
            'A nighto talko witho a teachero.',
        );
        expect(seen).toMatch(/^The window translated /);
    });

    test('a stop while a part is being translated ends the job: nothing is drafted', async () => {
        useToolHost();
        const { signal, stop } = genStop();
        const translateText = vi.fn(async (_ask: string) => {
            return stop();
        });
        const raised = await askTranslate(
            { language: 'Testish', place: 'append' },
            translateText,
            signal,
        ).catch((error) => error);
        expect(raised).toBeInstanceOf(Error);
        // Asked once, never again after the stop.
        expect(translateText).toHaveBeenCalledTimes(1);
        expect(actionsCalled()).toEqual(['translate']);
    });

    test("a diagram's translation is taken when mermaid cannot be loaded to check it", async () => {
        useToolHost();
        fake.isMermaidGone = true;
        await askTranslate({ language: 'Testish', place: 'append' });
        expect(fake.toolCallList[1].args.append).toContain(
            'A["Nighto"] --> B["Lighto"]',
        );
    });

    test('a plan the tool host drops is a tool error, and nothing is translated', async () => {
        fake.answerTool = () => {
            throw new Error('The app did not answer.');
        };
        const { seen, translateText } = await askTranslate({
            language: 'Testish',
            place: 'append',
        });
        expect(seen).toBe('Tool error: The app did not answer.');
        expect(translateText).not.toHaveBeenCalled();
    });

    test("the app's own answer to a plan it could not make reaches the model as written", async () => {
        const refusal = 'That file is not in Resources.';
        useToolHost({ plan: () => refusal });
        const { seen, translateText } = await askTranslate({
            language: 'Testish',
            place: 'append',
        });
        expect(seen).toBe(refusal);
        expect(translateText).not.toHaveBeenCalled();
        expect(actionsCalled()).toEqual(['translate']);
    });

    test('a copy of a study named for no passage is refused, and nothing is drafted', async () => {
        useToolHost({ plan: () => genPlan(null) });
        const { seen } = await askTranslate({
            language: 'Testish',
            place: 'new',
        });
        expect(seen).toBe(
            `Tool refused: ${NAME} is not named for a passage, so a copy ` +
                'cannot be named for one: add the translation after it ' +
                '(place "append") instead.',
        );
        expect(actionsCalled()).toEqual(['translate']);
    });

    test('a draft the app will not make is said as the app said it, with no card', async () => {
        const refusal = 'The file changed since it was read; read it again.';
        useToolHost({ draft: () => refusal });
        const { answer, seen } = await askTranslate({
            language: 'Testish',
            place: 'append',
        });
        expect(seen).toBe(refusal);
        expect(answer.actions ?? []).toEqual([]);
    });
});

describe('a new lesson reads the verses before its passage', () => {
    const PASSAGE = 'Luke 10:25-37';
    const BEFORE = 'Luke 10:15-24';
    const BEFORE_WORDS = '(15): And thou, Capernaum';

    async function askLesson(
        answerPassage: () => string,
        answerBefore: () => string,
        signal: AbortSignal | null = null,
    ) {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        fake.answerTool = (_name, args) => {
            return args.refs === PASSAGE ? answerPassage() : answerBefore();
        };
        const used = useAnthropic([
            anthropicToolUse({
                name: 'owa_find_verse',
                input: { refs: PASSAGE },
            }),
            anthropicText('Which way should the lesson go?'),
        ]);
        await askLlmBot(
            `a sermon on the good samaritan\n${NOTE_BLANK_LESSON_HINT}`,
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            signal,
            { note: { files: [NOTE_FILE], blankBlockCount: 1 } },
        );
        return readToolResults(used.sentList[1])[0];
    }

    function versesOf(ref: string, text: string) {
        return () => {
            return JSON.stringify({ bible: 'KJV', verses: [{ ref, text }] });
        };
    }

    test('verses before that cannot be read leave the passage as read, and say nothing of them', async () => {
        const seen = await askLesson(
            versesOf(PASSAGE, '(25): And, behold, a certain lawyer'),
            () => {
                throw new Error('The verse finder is not ready.');
            },
        );
        expect(fake.toolCallList.map((call) => call.args.refs)).toEqual([
            PASSAGE,
            BEFORE,
        ]);
        expect(seen).not.toContain('The window also read');
        expect(seen).toContain('(25): And, behold, a certain lawyer');
    });

    test('a passage read that holds no verses is handed on without them', async () => {
        const read = JSON.stringify({
            bible: 'KJV',
            notFound: [{ ref: PASSAGE, reason: 'Not in this Bible.' }],
        });
        const seen = await askLesson(
            () => read,
            versesOf(BEFORE, BEFORE_WORDS),
        );
        expect(seen).toContain(read);
        expect(seen).not.toContain(BEFORE_WORDS);
        // A read that is not JSON at all, the same.
        fake.toolCallList = [];
        const plain = 'Luke 10 could not be read.';
        const seenPlain = await askLesson(
            () => plain,
            versesOf(BEFORE, BEFORE_WORDS),
        );
        expect(seenPlain).toContain(plain);
        expect(seenPlain).not.toContain(BEFORE_WORDS);
    });

    test('a stop while the verses before are read stops the ask', async () => {
        const { signal, stop } = genStop();
        const raised = await askLesson(
            versesOf(PASSAGE, '(25): And, behold, a certain lawyer'),
            stop,
            signal,
        ).catch((error) => error);
        expect(raised).toBeInstanceOf(Error);
        expect(callsOf('owa_note_edit')).toEqual([]);
    });
});

describe('a Bible note lesson held to its verses', () => {
    function addLesson(quote: string) {
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
    }

    async function askLesson(signal: AbortSignal | null = null) {
        fake.toolList = [
            { name: 'owa_note_edit' },
            { name: 'owa_bible_note' },
            { name: 'owa_find_verse' },
        ];
        useAnthropic([
            addLesson('weary and heavy laden'),
            anthropicText('Your lesson is in the note.'),
        ]);
        await askLlmBot(
            'help me prepare a sermon on Isaiah 40:31',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            signal,
            { note: { files: [NOTE_FILE], blankBlockCount: 1 } },
        );
    }

    test('a cited verse that cannot be read holds nothing back', async () => {
        fake.answerTool = (name) => {
            if (name === 'owa_find_verse') {
                throw new Error('The verse finder is not ready.');
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        await askLesson();
        expect(fake.toolCallList.map((call) => call.name)).toEqual([
            'owa_find_verse',
            'owa_note_edit',
        ]);
    });

    test('a stop while a cited verse is read writes nothing', async () => {
        const { signal, stop } = genStop();
        fake.answerTool = (name) => {
            if (name === 'owa_find_verse') {
                return stop();
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const raised = await askLesson(signal).catch((error) => error);
        expect(raised).toBeInstanceOf(Error);
        expect(callsOf('owa_note_edit')).toEqual([]);
    });

    test('a verse put in the other Testament is sent back once', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.answerTool = () => {
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const edit = (testament: string) => {
            return anthropicToolUse({
                name: 'owa_note_edit',
                input: {
                    action: 'edit',
                    note: 'Lesson',
                    changes: [
                        {
                            block: 1,
                            text:
                                `The ${testament} Testament tells us he was ` +
                                'wounded for us (Isaiah 53:5).',
                        },
                    ],
                },
            });
        };
        const { sentList } = useAnthropic([
            edit('New'),
            edit('Old'),
            anthropicText('It is in the note.'),
        ]);
        await askLlmBot(
            'add a line on Isaiah 53:5',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { note: { files: [NOTE_FILE] } },
        );
        expect(readToolResults(sentList[1])[0]).toBe(
            'Tool refused: Nothing was written: Isaiah 53:5 is in the Old ' +
                'Testament, and the sentence says the New Testament. Name ' +
                'the Testament it is in, or name it by its book, then send ' +
                'the change again, whole.',
        );
        const edits = callsOf('owa_note_edit');
        expect(edits).toHaveLength(1);
        expect(JSON.stringify(edits[0].args)).toContain('The Old Testament');
    });
});

describe('loose lines made a lesson', () => {
    const REWRITE = {
        lines: ['mark 4 storm', 'jesus asleep in the boat', 'peace be still'],
        lineBlocks: [1, 2, 3],
        blockCount: 3,
    };
    const REWRITE_NOTE = {
        files: [{ ...NOTE_FILE, name: 'Storm' }],
        rewrite: REWRITE,
    };

    test('a lesson the note would not take is said as the note said it', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_bible_note' }];
        const refusal =
            'Tool refused: The note changed since it was read; read it again.';
        fake.answerTool = () => refusal;
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_bible_note',
                input: {
                    action: 'add',
                    title: 'Storm',
                    text:
                        '[^Mark 4:35-41]\n## Introduction\nThe mark 4 storm.\n' +
                        '## 1. Jesus asleep in the boat\n## 2. Peace be still',
                },
            }),
            anthropicText('I could not change the note.'),
        ]);
        await askLlmBot(
            'finish my sermon',
            'bibleNote',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { note: REWRITE_NOTE },
        );
        expect(callsOf('owa_note_edit')).toHaveLength(1);
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toBe(refusal);
        expect(seen).not.toContain('Their lines');
    });

    test('a reply the server dropped asks for the lesson as one add', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_bible_note' }];
        const { sentList } = useOpenAi([
            openAiText('', 'stop'),
            openAiText('Which way should it go?'),
        ]);
        const answer = await askLlmBot(
            'finish my sermon',
            'bibleNote',
            'openai',
            'gpt-5',
            [],
            null,
            { note: REWRITE_NOTE },
        );
        expect(sentList).toHaveLength(2);
        expect(sentList[1].messages.at(-1)).toEqual({
            role: 'user',
            content: NOTE_REWRITE_DROPPED_NUDGE,
        });
        expect(answer.text).toContain('Which way should it go?');
    });
});
