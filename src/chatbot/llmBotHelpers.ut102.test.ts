import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The model loop at the edges the other suites leave (UT-102): a result
// that is no object, the foreground sessions an answer holds, a screen ask
// and its Undo, a transcription's prompt, a new study the card above holds
// changed when mermaid cannot load or a diagram does not draw, a new note
// the window cannot draft as a file, and a new lesson whose reads, second
// look or legends do not go the usual way. The mock surface is
// `llmBotHelpers.ut101.test.ts`'s, with a tool host that can throw and a
// mermaid that can fail to load; one key, Anthropic's.
const { fake, settingMap } = vi.hoisted(() => ({
    fake: {
        anthropic: null as any,
        toolList: [] as { name: string }[],
        // Every call the loop made of the tool host, in order.
        toolCallList: [] as { name: string; args: any }[],
        answerTool: null as null | ((name: string, args: any) => string),
        isMermaidGone: false,
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
// Mermaid's parse: a diagram with BROKEN in it does not draw, and with
// `isMermaidGone` the module does not load at all.
vi.mock('../markdown-preview/markdownMermaidHelpers', () => ({
    findMermaidParseErrors: async (sourceList: string[]) => {
        if (fake.isMermaidGone) {
            throw new Error('The diagram module did not load.');
        }
        return sourceList.map((source) => {
            return source.includes('BROKEN') ? 'Parse error on line 2' : null;
        });
    },
}));
// A tool host whose `answerTool` may throw: the call rejects, as a host
// that drops it does.
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
    TRANSCRIPTION_SYSTEM_PROMPT,
    applyToolWatch,
    askLlmBot,
    genToolWatch,
    resetReasoningOffMemoryForTests,
} from './llmBotHelpers';
import { SCREEN_SYSTEM_PROMPT } from './screenChatHelpers';
import { NOTE_BLANK_LESSON_HINT } from './noteChatHelpers';
import { keepDraftedStudy, takeDraftedStudy } from './studyFileChatHelpers';
import {
    composeStudyFile,
    lintStudyContent,
    separateStudyLines,
    toStudyBody,
} from '../helper/agentStudyFileRules';

function snapshotOf(request: any) {
    return JSON.parse(JSON.stringify(request));
}

// An Anthropic client whose rounds are answered in turn by `rounds` -- a
// function is called with the request instead -- each request kept as it
// was when it was sent.
function useAnthropic(rounds: any[]) {
    const sentList: any[] = [];
    const create = vi.fn(async (request: any) => {
        sentList.push(snapshotOf(request));
        const round = rounds.shift();
        return typeof round === 'function' ? round(request) : round;
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

function callsOf(name: string) {
    return fake.toolCallList.filter((call) => {
        return call.name === name;
    });
}

function systemOf(sent: any) {
    return JSON.stringify(sent.system);
}

beforeEach(() => {
    settingMap.clear();
    fake.anthropic = null;
    fake.toolList = [];
    fake.toolCallList = [];
    fake.answerTool = null;
    fake.isMermaidGone = false;
    resetSpendGuardForTests();
    resetReasoningOffMemoryForTests();
});
afterEach(() => {
    resetSpendGuardForTests();
});

describe('the tool a known question is done by, its result read', () => {
    test('a result that is no object, an error or a refusal is not the job done', () => {
        const watch = genToolWatch();
        watch.doTool = 'owa_click';
        for (const text of [
            'null',
            '7',
            'not json',
            '{"isError":true}',
            '{"did":"refused"}',
        ]) {
            applyToolWatch(watch, 'owa_click', {}, text);
            expect(watch.isDoToolDone, text).toBe(false);
        }
        expect(watch.isDoToolCalled).toBe(true);
        applyToolWatch(watch, 'owa_click', {}, '{"did":"clicked"}');
        expect(watch.isDoToolDone).toBe(true);
    });
});

function genStarted(sessionId: string, name: string, did = 'started') {
    return JSON.stringify({
        did,
        widget: 'countdown',
        session: { id: sessionId, name },
    });
}

describe('the foreground sessions an answer holds (EC-520)', () => {
    test('one session once, the newest first, three at most', () => {
        const watch = genToolWatch();
        applyToolWatch(watch, 'owa_foreground', {}, genStarted('s1', '5:00'));
        // The same session changed again: still one, by its new name.
        applyToolWatch(
            watch,
            'owa_foreground',
            {},
            genStarted('s1', '6:00', 'changed'),
        );
        expect(watch.heldForeground).toEqual([
            { widget: 'countdown', sessionId: 's1', sessionName: '6:00' },
        ]);
        for (const id of ['s2', 's3', 's4']) {
            applyToolWatch(watch, 'owa_foreground', {}, genStarted(id, id));
        }
        expect(
            watch.heldForeground.map((one) => {
                return one.sessionId;
            }),
        ).toEqual(['s4', 's3', 's2']);
        // A read holds nothing.
        applyToolWatch(
            watch,
            'owa_foreground',
            {},
            JSON.stringify({ did: 'checked', session: { id: 's5' } }),
        );
        expect(watch.heldForeground).toHaveLength(3);
    });

    test('a countdown the model started is held on its answer', async () => {
        fake.toolList = [{ name: 'owa_foreground' }];
        fake.answerTool = () => {
            return genStarted('s9', '5:00');
        };
        useAnthropic([
            anthropicToolUse({
                name: 'owa_foreground',
                input: { action: 'start', widget: 'countdown', minutes: 5 },
            }),
            anthropicText('A 5 minute countdown is on the screen.'),
        ]);
        const answer = await askLlmBot(
            'Start a 5 minute countdown',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
        );
        expect(answer.heldForeground).toEqual([
            { widget: 'countdown', sessionId: 's9', sessionName: '5:00' },
        ]);
    });
});

describe("a screen ask's own prompt and its Undo", () => {
    async function askScreen(result: string) {
        fake.toolList = [{ name: 'owa_screen_edit' }];
        fake.answerTool = () => {
            return result;
        };
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_screen_edit',
                input: { action: 'set', screens: [0], lock: true },
            }),
            anthropicText('Screen 0 is locked.'),
        ]);
        const answer = await askLlmBot(
            'Lock screen 0',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { screen: {} },
        );
        return { answer, sentList };
    }

    test('a change made is put back by the one press under the answer', async () => {
        const { answer, sentList } = await askScreen(
            JSON.stringify({ did: 'screen 0 locked', undoId: 'u-31' }),
        );
        expect(systemOf(sentList[0])).toContain(
            JSON.stringify(SCREEN_SYSTEM_PROMPT).slice(1, 80),
        );
        expect(answer.actions).toEqual([
            {
                label: 'Undo this change',
                toolName: 'lyric-undo',
                args: { id: 'u-31', name: expect.any(String), kind: 'screen' },
            },
        ]);
    });

    test('a screen added with no Undo kept offers no press', async () => {
        const { answer } = await askScreen(
            JSON.stringify({ did: 'screen 2 added', newScreen: 2 }),
        );
        expect(answer.actions).toEqual([]);
    });
});

describe("a page's words read off its picture", () => {
    test('are asked under the transcription prompt', async () => {
        const { sentList } = useAnthropic([
            anthropicText('=== picture 1 ===\nAmazing grace'),
        ]);
        const answer = await askLlmBot(
            'Write the words of each picture.',
            'presenter',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { isTranscription: true, isGeneral: true, isTranslation: true },
        );
        expect(systemOf(sentList[0])).toContain(
            JSON.stringify(TRANSCRIPTION_SYSTEM_PROMPT).slice(1, 80),
        );
        expect(answer.text).toContain('Amazing grace');
        expect(fake.toolCallList).toEqual([]);
    });
});

// A new study an EARLIER answer drafted, held under that answer's card
// (EC-606), composed as the app composes one -- what the tool host drafts
// again when it is changed.
const EARLIER_NAME = 'JHN.3.Born Again.md';
const EARLIER_BODY =
    '## The Setting\n\nNicodemus came by night.\n\n## Prayer\n\nLord, teach us.';
const PASSAGE = {
    title: 'John 3',
    bibleKey: 'XB',
    verses: [{ number: '3', text: 'Unless one is born again.' }],
};

function composeStudy(title: string, body: string) {
    return composeStudyFile({
        title,
        passage: PASSAGE,
        isPassageCut: false,
        body: separateStudyLines(toStudyBody(body)),
        footnote: 'Drafted by the assistant.',
    });
}

function holdEarlierStudy() {
    return keepDraftedStudy({
        name: EARLIER_NAME,
        nameTaken: null,
        isChange: false,
        file: null,
        hash: null,
        passage: 'John 3',
        bible: 'XB',
        diagramCount: 0,
        change: null,
        content: composeStudy('Born Again', EARLIER_BODY),
        raw: {
            ref: 'John 3',
            title: 'Born Again',
            content: EARLIER_BODY,
            bible: null,
        },
    });
}

// The tool host's draft of a NEW study, composed; every other call answered
// with nothing.
function answerNewStudyDraft(_name: string, args: any) {
    if (args?.action !== 'draft' || typeof args.file === 'string') {
        return '';
    }
    const content = composeStudy(args.title, String(args.content));
    return JSON.stringify({
        drafted: true,
        isChange: false,
        name: `JHN.3.${args.title}.md`,
        passage: 'John 3',
        bible: 'XB',
        diagramCount: lintStudyContent(content, Infinity).diagrams.length,
        warnings: [],
        content,
    });
}

function genDiagram(label: string) {
    return `\`\`\`mermaid\ngraph TD\n    A["Night"] --> B["${label}"]\n\`\`\``;
}

function appendCall(append: string) {
    return {
        name: 'owa_resource_file',
        input: { action: 'draft', file: EARLIER_NAME, append },
    };
}

function askUnderEarlierCard(question: string, earlier: any) {
    return askLlmBot(
        question,
        'reader',
        'anthropic',
        'claude-sonnet-5',
        [],
        null,
        { heldStudy: earlier },
    );
}

describe('a new study the card above holds, changed (EC-606)', () => {
    beforeEach(() => {
        fake.toolList = [
            { name: 'owa_help_search' },
            { name: 'owa_resource_file' },
        ];
        fake.answerTool = answerNewStudyDraft;
    });

    test('a diagram added is kept when mermaid cannot be loaded to check it', async () => {
        fake.isMermaidGone = true;
        const earlier = holdEarlierStudy();
        useAnthropic([
            anthropicToolUse(appendCall(genDiagram('Light'))),
            anthropicText('A diagram is added to the study.'),
        ]);
        const answer = await askUnderEarlierCard('Add a diagram', earlier);
        const reference = answer.actions?.[0]?.args?.reference ?? '';
        expect(reference).not.toBe(earlier.reference);
        const held = takeDraftedStudy(reference);
        expect(held?.content).toContain('A["Night"] --> B["Light"]');
        expect(held?.diagramCount).toBe(1);
    });

    test('a diagram that does not draw goes back once, then is left out', async () => {
        const earlier = holdEarlierStudy();
        const broken = genDiagram('BROKEN');
        const { sentList } = useAnthropic([
            anthropicToolUse(appendCall(`Night and day.\n\n${broken}`)),
            anthropicToolUse(appendCall(`Night and day.\n\n${broken}`)),
            anthropicText('The words are added.'),
        ]);
        const answer = await askUnderEarlierCard('Add a diagram', earlier);
        const [refused] = readToolResults(sentList[1]);
        expect(refused).toMatch(
            /^Tool refused: Diagram 1 of the study does not draw with this change: Parse error on line 2 Nothing is changed/,
        );
        const [dropped] = readToolResults(sentList[2]);
        expect(dropped).toContain(
            'A diagram the change wrote did not draw again and was left out.',
        );
        const held = takeDraftedStudy(
            answer.actions?.[0]?.args?.reference ?? '',
        );
        expect(held?.content).toContain('Night and day.');
        expect(held?.content).not.toContain('BROKEN');
        expect(held?.diagramCount).toBe(0);
    });

    test('a draft the tool host drops is a tool error, and the card keeps its study', async () => {
        fake.answerTool = () => {
            throw new Error('The app did not answer.');
        };
        const earlier = holdEarlierStudy();
        const { sentList } = useAnthropic([
            anthropicToolUse(appendCall('Night and day.')),
            anthropicText('I could not change it.'),
        ]);
        await askUnderEarlierCard('Add a line', earlier);
        expect(readToolResults(sentList[1])).toEqual([
            'Tool error: The app did not answer.',
        ]);
        expect(callsOf('owa_resource_file')).toHaveLength(1);
        expect(takeDraftedStudy(earlier.reference)?.content).not.toContain(
            'Night and day.',
        );
    });
});

// EC-581: a new note is held for the person to choose what it is kept as,
// the window drafting its words as a study file -- unless it cannot.
describe('a new note the window cannot hold as a study file', () => {
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

    async function askForNote(args: any, extra: any = { bibleReader: {} }) {
        fake.toolList = [{ name: 'owa_bible_note' }];
        const { sentList } = useAnthropic([
            anthropicToolUse({ name: 'owa_bible_note', input: args }),
            anthropicText('It is made.'),
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

    test('words longer than a note holds are not drafted: the add goes as asked', async () => {
        const long = {
            ...NOTE_ARGS,
            text: `[^John 3:16]\n\n${'Love. '.repeat(3400)}`,
        };
        fake.answerTool = (name) => {
            return name === 'owa_bible_note'
                ? '{"isError":true,"message":"Too long."}'
                : '';
        };
        const { seen } = await askForNote(long);
        expect(fake.toolCallList).toEqual([
            { name: 'owa_bible_note', args: long },
        ]);
        expect(seen).toBe('{"isError":true,"message":"Too long."}');
    });

    test('a draft the tool host drops leaves the note made as asked', async () => {
        fake.answerTool = (name) => {
            if (name === 'owa_resource_file') {
                throw new Error('The app did not answer.');
            }
            return MADE_NOTE;
        };
        const { answer, seen } = await askForNote(NOTE_ARGS);
        expect(
            fake.toolCallList.map((call) => {
                return call.name;
            }),
        ).toEqual(['owa_resource_file', 'owa_bible_note']);
        expect(seen).toBe(MADE_NOTE);
        expect(answer.createdNote).toMatchObject({ noteId: 7 });
    });

    // Pressed for a Bible note, a study drafted after it is made that note
    // -- unless it cannot be one.
    function answerStudyDraft(noteAnswer: string) {
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
            return noteAnswer;
        };
    }

    async function askStudyForNote(content: string) {
        fake.toolList = [{ name: 'owa_resource_file' }];
        useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    ref: 'John 3:16',
                    title: 'God So Loved',
                    content,
                },
            }),
            anthropicText('Here it is.'),
        ]);
        return askLlmBot(
            'Make a study file for John 3:16',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { study: {}, createKind: 'note' },
        );
    }

    function labelsOf(answer: any) {
        return (answer.actions ?? []).map((action: any) => {
            return action.label;
        });
    }

    test('a study longer than a note holds keeps its card', async () => {
        answerStudyDraft(MADE_NOTE);
        const answer = await askStudyForNote('God gave his Son. '.repeat(1300));
        expect(callsOf('owa_bible_note')).toEqual([]);
        expect(answer.createdNote).toBeUndefined();
        expect(labelsOf(answer)).toContain(
            'Create "JHN.3.16 God So Loved.md" in Resources',
        );
    });

    test('a note the app did not make keeps the study card', async () => {
        answerStudyDraft('{"isError":true,"message":"No notes folder."}');
        const answer = await askStudyForNote('God gave his only Son.');
        expect(
            callsOf('owa_bible_note').map((call) => {
                return call.args.action;
            }),
        ).toEqual(['add']);
        expect(answer.createdNote).toBeUndefined();
        expect(labelsOf(answer)).toContain(
            'Create "JHN.3.16 God So Loved.md" in Resources',
        );
    });
});

const LESSON_NOTE = {
    name: 'Lesson',
    filePath: 'C:\\notes\\Default.own',
    noteId: 4,
};

function askNote(question: string, note: any, signal: any = null) {
    return askLlmBot(
        question,
        'bibleNote',
        'anthropic',
        'claude-sonnet-5',
        [],
        signal,
        { note: { files: [LESSON_NOTE], ...note } },
    );
}

function noteEdit(changes: any[]) {
    return anthropicToolUse({
        name: 'owa_note_edit',
        input: { action: 'edit', note: 'Lesson', changes },
    });
}

function namesOfCalls() {
    return fake.toolCallList.map((call) => {
        return call.args?.action === undefined
            ? call.name
            : `${call.name} ${call.args.action}`;
    });
}

function countOf(text: string, part: string) {
    return text.split(part).length - 1;
}

// BN-274: a new lesson written with its passage never read has it read by
// the window -- a read that fails leaves the checks as they were.
describe("a new lesson's passage the window could not read", () => {
    const LESSON_TEXT =
        '[^1 Corinthians 11:23-26]\n## 1. Received\nPaul passed on what ' +
        'he had received: "he brake it, and said, Take, eat".';

    function askBlankLesson(signal: any = null) {
        fake.toolList = [
            { name: 'owa_note_edit' },
            { name: 'owa_bible_note' },
            { name: 'owa_find_verse' },
        ];
        const rounds = useAnthropic([
            anthropicToolUse({
                name: 'owa_bible_note',
                input: {
                    action: 'add',
                    title: 'The Lord’s Table',
                    text: LESSON_TEXT,
                },
            }),
            anthropicText('Your message is in the note.'),
        ]);
        const asking = askNote(
            'a short message for a communion service, from 1 Corinthians ' +
                `11:23-26\n${NOTE_BLANK_LESSON_HINT}`,
            { blankBlockCount: 1 },
            signal,
        );
        return { ...rounds, asking };
    }

    test('a read the app drops lets the lesson go in as written', async () => {
        fake.answerTool = (name: string) => {
            if (name === 'owa_find_verse') {
                throw new Error('The app did not answer.');
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const { asking, sentList } = askBlankLesson();
        const answer = await asking;
        expect(namesOfCalls().slice(0, 2)).toEqual([
            'owa_find_verse',
            'owa_note_edit edit',
        ]);
        expect(fake.toolCallList[0].args).toEqual({
            refs: '1 Corinthians 11:23-26',
        });
        const [result] = readToolResults(sentList[1]);
        expect(result).toContain('"isChanged":true');
        expect(result).not.toContain('Tool error');
        expect(result).not.toContain('so the window read it');
        expect(answer.text).toContain('Your message is in the note.');
    });

    test('a stop pressed while it reads stops the ask, the lesson unwritten', async () => {
        const controller = new AbortController();
        fake.answerTool = (name: string) => {
            if (name === 'owa_find_verse') {
                controller.abort();
                throw new Error('The app did not answer.');
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const { asking, create } = askBlankLesson(controller.signal);
        await expect(asking).rejects.toThrow('The app did not answer.');
        expect(namesOfCalls()).toEqual(['owa_find_verse']);
        expect(create).toHaveBeenCalledTimes(1);
    });
});

// BN-223: loose lines being made a lesson -- an edit that takes one of
// them out, its words nowhere in the new ones, goes back once an ask.
describe('loose lines made a lesson by an edit that loses one', () => {
    test('is refused naming the line, then goes as sent', async () => {
        fake.toolList = [{ name: 'owa_note_edit' }];
        fake.answerTool = () => {
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
        const changes = [
            { block: 3, remove: true },
            { block: 2, text: '## 1. Jesus asleep in the boat' },
            { after: 3, kind: 'section', text: 'The storm on the lake.' },
        ];
        const { sentList } = useAnthropic([
            noteEdit(changes),
            noteEdit(changes),
            anthropicText('Your lesson is in the note.'),
        ]);
        await askNote('make my lines into a lesson', {
            rewrite: {
                lines: [
                    'mark 4 storm',
                    'jesus asleep in the boat',
                    'peace be still',
                ],
                lineBlocks: [1, 2, 3],
                blockCount: 3,
            },
        });
        const [refused] = readToolResults(sentList[1]);
        expect(refused).toMatch(/^Tool refused: /);
        expect(refused).toContain('"peace be still"');
        expect(refused).not.toContain('"jesus asleep in the boat"');
        // Refused once an ask: the same edit sent again reaches the note.
        expect(namesOfCalls().filter((call) => call.endsWith('edit'))).toEqual([
            'owa_note_edit edit',
        ]);
        expect(readToolResults(sentList[2])[0]).toContain('"isChanged":true');
    });
});

// BN-226: a new lesson's second look, asked of the model in an ask of its
// own -- a look that fails is no answer, a pause is.
describe("a new lesson's second look", () => {
    const SLIP =
        '**What it means:** The name Jehovahjireh refers to the ram God ' +
        'gave in the place of Isaac.';
    const RAISE =
        'Abraham went up the mountain sure that God could raise Isaac ' +
        'from the dead.';

    function answerLesson(lines: string[]) {
        fake.toolList = [{ name: 'owa_note_edit' }, { name: 'owa_find_verse' }];
        fake.answerTool = (name: string, args: any) => {
            if (name === 'owa_find_verse') {
                return JSON.stringify({
                    bible: 'KJV',
                    verses: [
                        {
                            key: 'GEN 22:1-19',
                            ref: 'Genesis 22:1-19',
                            text:
                                '(5): I and the lad will go yonder and ' +
                                'worship, and come again to you. (13): And ' +
                                'Abraham lifted up his eyes, and looked, and ' +
                                'behold behind him a ram (14): And Abraham ' +
                                'called the name of that place Jehovahjireh',
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
                        ...lines.map((text, index) => {
                            return { n: 3 + index, kind: 'paragraph', text };
                        }),
                    ],
                });
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
    }

    function lessonRounds(lines: string[], look: any) {
        return useAnthropic([
            anthropicToolUse({
                name: 'owa_find_verse',
                input: { refs: 'Genesis 22:1-19' },
            }),
            noteEdit([
                { block: 1, remove: true },
                {
                    after: 0,
                    kind: 'section',
                    text:
                        '[^Genesis 22:1-19]\n## 1. God provides\n' +
                        lines.join('\n'),
                },
            ]),
            look,
            anthropicText('Your sermon is in the note.'),
        ]);
    }

    function askSermon() {
        return askNote(
            `Help me prepare a sermon on Genesis 22\n${NOTE_BLANK_LESSON_HINT}`,
            { blankBlockCount: 1 },
        );
    }

    test('a look the service fails leaves the lesson as written', async () => {
        answerLesson([SLIP]);
        const { sentList, create } = lessonRounds([SLIP], () => {
            throw new Error('The service is busy.');
        });
        const answer = await askSermon();
        // The look was asked, in an ask of its own...
        expect(create).toHaveBeenCalledTimes(4);
        expect(JSON.stringify(sentList[2].system)).toContain(
            'You check a preaching lesson',
        );
        // ...and its failure names nothing under the change.
        const [result] = readToolResults(sentList[3]);
        expect(result).toContain('"isChanged":true');
        expect(result).not.toContain('refers to the ram');
        expect(result).not.toContain('Tool error');
        expect(answer.text).toContain('Your sermon is in the note.');
    });

    test('a look the spend guard pauses stops the ask', async () => {
        answerLesson([SLIP]);
        // The lesson's round is the one that reaches the hour's cap.
        const edit = noteEdit([
            { block: 1, remove: true },
            {
                after: 0,
                kind: 'section',
                text: `[^Genesis 22:1-19]\n## 1. God provides\n${SLIP}`,
            },
        ]);
        const { create } = useAnthropic([
            anthropicToolUse({
                name: 'owa_find_verse',
                input: { refs: 'Genesis 22:1-19' },
            }),
            {
                ...edit,
                usage: { input_tokens: 2_000_000, output_tokens: 5 },
            },
            anthropicText('[]'),
            anthropicText('Your sermon is in the note.'),
        ]);
        await expect(askSermon()).rejects.toMatchObject({
            name: 'SpendLimitError',
        });
        // The edit went in; the look and the round after it were never
        // bought.
        expect(namesOfCalls()).toContain('owa_note_edit edit');
        expect(create).toHaveBeenCalledTimes(2);
    });

    test('a sentence the look and the legends both name is named once', async () => {
        answerLesson([RAISE]);
        const { sentList } = lessonRounds(
            [RAISE],
            anthropicText(
                JSON.stringify([
                    {
                        sentence: RAISE,
                        verses:
                            'Genesis 22:5: I and the lad will go yonder and ' +
                            'worship, and come again to you',
                    },
                ]),
            ),
        );
        await askSermon();
        const [result] = readToolResults(sentList[3]);
        // Named by the legend, the look's finding of it dropped.
        expect(result).toContain(
            `block 3: "${RAISE}" -- Hebrews 11:19 says it`,
        );
        expect(countOf(result, `"${RAISE}"`)).toBe(1);
        expect(result).not.toContain('the verses read say');
    });
});

// BN-142, BN-157, BN-191, BN-288: a sermon's detail no verse gives, named
// under the change by the block it is in.
describe('a legend named under a change, by its block', () => {
    const ARMOUR =
        "Goliath fell, for the stone found the only gap in the giant's armour.";
    const SPOT = 'The stone found the one vulnerable spot on his brow.';
    const STORY =
        'David ran and stood upon the Philistine, and took his sword, and ' +
        'drew it out of the sheath, and slew him.';

    function answerGoliath() {
        fake.toolList = [{ name: 'owa_note_edit' }];
        const blockMap = new Map<number, string>([[2, 'Goliath.']]);
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
                        { n: 2, kind: 'paragraph', text: blockMap.get(2) },
                    ],
                });
            }
            for (const change of args?.changes ?? []) {
                if (typeof change.block === 'number') {
                    blockMap.set(change.block, change.text);
                }
            }
            return JSON.stringify({ name: 'Lesson', isChanged: true });
        };
    }

    const READ = anthropicToolUse({
        name: 'owa_note_edit',
        input: { action: 'read', note: 'Lesson' },
    });

    test('two named lines of one longer block ask for that block once', async () => {
        answerGoliath();
        const { sentList } = useAnthropic([
            READ,
            noteEdit([{ block: 2, text: `${ARMOUR} ${SPOT} ${STORY}` }]),
            anthropicText('Done.'),
        ]);
        await askNote('say more about Goliath', {});
        const [result] = readToolResults(sentList[2]);
        expect(result).toContain(`"${ARMOUR}"`);
        expect(result).toContain(`"${SPOT}"`);
        expect(countOf(result, '(Block 2 holds more than that line')).toBe(1);
    });

    test('a line the next edit wrote in a named one is named too', async () => {
        answerGoliath();
        const { sentList } = useAnthropic([
            READ,
            noteEdit([{ block: 2, text: ARMOUR }]),
            noteEdit([{ block: 2, text: SPOT }]),
            anthropicText('Done.'),
        ]);
        await askNote('say more about Goliath', {});
        expect(readToolResults(sentList[2])[0]).toContain(`"${ARMOUR}"`);
        const second = readToolResults(sentList[3])[0];
        // The named line is gone, so nothing is said to be left...
        expect(second).not.toContain('it left a line the window named');
        // ...and the line written in its place is named by its block.
        expect(second).toContain(`block 2: "${SPOT}"`);
        expect(second).toContain('sunk into his forehead');
    });
});
