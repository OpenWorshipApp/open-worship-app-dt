import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A study file TRANSLATED by the help window (EC-478): the model only names
// the file, the language and where the translation goes; the window asks
// the app for the plan, hands the words to its translator a part at a time
// and each diagram's labels on their own, and drafts the result like any
// change for the person's **Save changes**. The same mock surface as
// `llmBotHelpers.ut100.test.ts`: a fake Anthropic client, a tool host that
// records every call, a setting map -- and mermaid's parse, which says
// whether a translated diagram still draws.
const { fake, settingMap, TERMISH, LABELISH, SCRIPTISH } = vi.hoisted(() => ({
    fake: {
        anthropic: null as any,
        toolList: [] as { name: string }[],
        // Every call the loop made of the tool host, in order.
        toolCallList: [] as { name: string; args: any }[],
        answerTool: null as null | ((name: string, args: any) => string),
        // Every diagram source mermaid was asked to parse.
        parsedList: [] as string[],
        isDiagramBroken: (_source: string): boolean => false,
    },
    settingMap: new Map<string, string>(),
    // A made-up language with church words, as a language's
    // `translationTerms` carries them (EC-486); no Bible is looked up for it.
    TERMISH: {
        code: '',
        name: 'Termish',
        nativeName: 'Termo',
        scriptPattern: null,
        terms: {
            'Cross references': 'Linked Verses',
            'bronze serpent': 'brasssnake',
        },
    },
    // A made-up INSTALLED language with no church words of its own: its
    // labels are what it calls them (EC-488), as its plugin's `tran.json`
    // carries them -- every key in lower case.
    LABELISH: {
        code: 'zz',
        name: 'Labelish',
        nativeName: 'Labelo',
        scriptPattern: null,
        terms: {},
        labels: {
            'cross references': 'Joined Verses',
            'old testament': 'Elder Book',
            'new testament': 'New Testament',
        } as Record<string, unknown>,
        // Every language whose labels the job asked the store for.
        loadedList: [] as string[],
        // In this window's language store: turned on. Off, it is a language
        // turned off in Settings, offered before anything is read (EC-494).
        isInStore: true,
        // Its Bible's own words (EC-491), as its plugin's `churchWords.json`
        // carries them: its words change form in a sentence.
        churchWords: {
            wordsChangeForm: true,
            words: {
                'Son of Man': 'Sono di Manno',
                Pharisees: 'the strict ones',
            },
        } as unknown,
    },
    // A made-up language with a script of its own -- one Unicode block, its
    // letters made by code point, so no word of any language is written
    // here (EC-533). No Bible is looked up for it.
    SCRIPTISH: {
        code: '',
        name: 'Scriptish',
        nativeName: 'Scripto',
        scriptPattern: new RegExp(
            `[${String.fromCodePoint(0x1000)}-${String.fromCodePoint(0x109f)}]`,
            'u',
        ),
        terms: {},
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
vi.mock('../markdown-preview/markdownMermaidHelpers', () => ({
    findMermaidParseErrors: async (sourceList: string[]) => {
        fake.parsedList.push(...sourceList);
        return sourceList.map((source) => {
            return fake.isDiagramBroken(source)
                ? 'Parse error on line 2'
                : null;
        });
    },
}));
// Every rule of the real helpers, and one more language to name.
vi.mock('./studyTranslateHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('./studyTranslateHelpers')>();
    return {
        ...original,
        resolveStudyTranslateLanguage: (value: unknown) => {
            const name = String(value).toLowerCase();
            if (name === 'labelish') {
                const {
                    labels: _d,
                    loadedList: _l,
                    churchWords: _c,
                    isInStore: _s,
                    ...language
                } = LABELISH;
                return language;
            }
            if (name === 'scriptish') {
                return SCRIPTISH;
            }
            return name === 'termish'
                ? TERMISH
                : original.resolveStudyTranslateLanguage(value);
        },
    };
});
// The installed language's own labels, read on demand.
vi.mock('../lang/langFileStore', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../lang/langFileStore')>();
    return {
        ...original,
        listLangFileCodes: () => {
            const codeList = original.listLangFileCodes();
            return LABELISH.isInStore ? [...codeList, LABELISH.code] : codeList;
        },
        loadLangFile: async (langCode: string, fileName: string) => {
            if (fileName === 'tran.json') {
                LABELISH.loadedList.push(langCode);
                return langCode === LABELISH.code ? LABELISH.labels : null;
            }
            if (fileName === 'churchWords.json' && langCode === LABELISH.code) {
                return LABELISH.churchWords;
            }
            return original.loadLangFile(langCode, fileName);
        },
    };
});
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
import { askLlmBot, resetReasoningOffMemoryForTests } from './llmBotHelpers';
import {
    STUDY_CREATE_TOOL_NAME,
    STUDY_HELD_MARKDOWN_NOTE,
    STUDY_KEPT_ANSWER_HELD_NOTE,
    STUDY_KEPT_ANSWER_NOTE,
    STUDY_PREVIEW_TOOL_NAME,
    genStudyDraftActions,
    keepDraftedStudy,
    takeDraftedStudy,
} from './studyFileChatHelpers';
import {
    composeStudyFile,
    lintStudyContent,
    separateStudyLines,
    splitStudyFooter,
    splitStudyForTranslation,
    splitStudyTranslations,
    toStudyBody,
} from '../helper/agentStudyFileRules';

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

const FILE = 'Default/JHN.3.The New Birth.md';
const NAME = 'JHN.3.The New Birth.md';
const DIAGRAM = '```mermaid\ngraph TD\n    A["Night"] --> B["Light"]\n```';
const QUOTED = '> **John 3:3** (XB)\n>\n> **3** Unless one is born again.';

// What the app answers `translate` with: the file split into its parts,
// each passage quoted again from the Bible the call named.
function genPlan(bible: string | null) {
    return {
        translating: true,
        file: FILE,
        name: NAME,
        hash: 'h-1',
        title: 'The New Birth',
        ref: 'JHN 3',
        bible,
        passageCount: 1,
        quotedCount: bible === null ? 0 : 1,
        parts: [
            {
                kind: 'text',
                text: '# The New Birth\n\nA night talk with a teacher.\n',
            },
            {
                kind: 'passage',
                text: '> **John 3:3** (KJV)\n>\n> **3** Except a man be born again.',
                quoted: bible === null ? null : QUOTED,
            },
            {
                kind: 'text',
                text: '\n## The Setting\nNicodemus came by night [^John 3:2].\n',
            },
            { kind: 'diagram', text: DIAGRAM },
            { kind: 'text', text: '' },
        ],
        footer: '\n---\n\n*Drafted by the assistant.*\n',
        note: 'Translate each part.',
    };
}

function genDraftResult() {
    return JSON.stringify({
        drafted: true,
        isChange: true,
        name: NAME,
        file: FILE,
        hash: 'h-1',
        passage: 'John 3',
        bible: 'XB',
        diagramCount: 2,
        change: 'adds a translation at its end',
        content: '# The New Birth\n\nThe whole file with its translation.',
    });
}

// A study whose heading and words use the church words of Termish.
function genTermPlan() {
    return {
        ...genPlan(null),
        parts: [
            {
                kind: 'text',
                text:
                    '## Cross References\nMoses lifted the bronze serpent ' +
                    '[^Numbers 21:9].\n',
            },
        ],
    };
}

// The tool host: the Lookup's Bible list, the plan, and the draft.
function useToolHost(
    bibleList: unknown = { bible: null, bibles: [] },
    makePlan: (bible: string | null) => unknown = genPlan,
) {
    fake.answerTool = (name, args) => {
        if (name === 'owa_find_verse') {
            return JSON.stringify(bibleList);
        }
        if (args?.action === 'translate') {
            return JSON.stringify(
                makePlan(typeof args.bible === 'string' ? args.bible : null),
            );
        }
        if (args?.action === 'draft') {
            return genDraftResult();
        }
        return '';
    };
}

// The words a translator is handed, without the frame after them.
function readAskedSource(ask: string) {
    return ask.slice(0, ask.lastIndexOf('\n\n('));
}

function checkIsDiagramAsk(ask: string) {
    return ask.includes('(This is a mermaid diagram');
}

// "Testish": every word of four letters or more gets an `o`; a diagram
// only its quoted labels, so its first line, ids and arrows stay.
function toTestish(ask: string) {
    const source = readAskedSource(ask);
    return checkIsDiagramAsk(ask)
        ? source.replace(/"([^"]+)"/g, '"$1o"')
        : source.replace(/\b([A-Za-z]{4,})\b/g, '$1o');
}

// "Scriptish": every Latin letter written as a letter of its own script, by
// code point; a `[^…]` token kept, and one word left as it was when named.
function toScriptish(text: string, keptWord = '') {
    return text.replace(/\[\^[^\]\n]*\]|[A-Za-z]+/g, (words) => {
        if (words.startsWith('[^') || words === keptWord) {
            return words;
        }
        return words.replace(/[A-Za-z]/g, (letter) => {
            return String.fromCodePoint(0x1000 + (letter.charCodeAt(0) % 32));
        });
    });
}

// A diagram in Scriptish: its quoted labels alone, so its ids and arrows
// stay.
function toScriptishDiagram(ask: string) {
    return readAskedSource(ask).replace(
        /"([^"]+)"/g,
        (_whole, words: string) => {
            return `"${toScriptish(words)}"`;
        },
    );
}

const TIMELINE_SOURCE =
    "timeline\n    title The Night Talk\n    John's Ministry : Preparing the way";
const TIMELINE_DIAGRAM = `\`\`\`mermaid\n${TIMELINE_SOURCE}\n\`\`\``;
// As the window's translator gave the user's study's timeline back: the
// words after each colon translated, its title and period not (EC-533).
const TIMELINE_EVENTS_ONLY =
    "timeline\n    title The Night Talk\n    John's Ministry : " +
    toScriptish('Preparing the way');
const TIMELINE_TITLE_LEFT =
    'timeline\n    title The Night Talk\n    ' +
    `${toScriptish("John's Ministry")} : ${toScriptish('Preparing the way')}`;
const TIMELINE_TRANSLATED =
    `timeline\n    title ${toScriptish('The Night Talk')}\n    ` +
    `${toScriptish("John's Ministry")} : ${toScriptish('Preparing the way')}`;

// A study of a title and one timeline.
function genTimelinePlan() {
    return {
        ...genPlan(null),
        parts: [
            { kind: 'text', text: '# The New Birth\n' },
            { kind: 'diagram', text: TIMELINE_DIAGRAM },
        ],
    };
}

function useTranslator(translate: (ask: string) => string = toTestish) {
    const askList: string[] = [];
    const translateText = vi.fn(async (ask: string) => {
        askList.push(ask);
        return { text: translate(ask), by: 'Gemma 4 (test)' };
    });
    return { askList, translateText };
}

function translateCall(input: Record<string, unknown>) {
    return {
        name: 'owa_resource_file',
        input: { action: 'translate', file: FILE, ...input },
    };
}

beforeEach(() => {
    settingMap.clear();
    fake.anthropic = null;
    fake.toolList = [];
    fake.toolCallList = [];
    fake.answerTool = null;
    fake.parsedList = [];
    fake.isDiagramBroken = () => false;
    LABELISH.loadedList.length = 0;
    LABELISH.isInStore = true;
    resetSpendGuardForTests();
    resetReasoningOffMemoryForTests();
});
afterEach(() => {
    resetSpendGuardForTests();
});

describe('a study file translated by the window', () => {
    test('appended: every part translated, the passage quoted again, drafted as a change with its card', async () => {
        useToolHost();
        const { askList, translateText } = useTranslator();
        const progressList: string[] = [];
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Testish', place: 'append' }),
            ),
            anthropicText('It is translated. Press Save changes to keep it.'),
        ]);

        const answer = await askLlmBot(
            'translate all to Testish and then append the translated ' +
                'content to new pages',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                translateText,
                onProgress: (step: any) => {
                    if (!step.isDone) {
                        progressList.push(step.text);
                    }
                },
            },
        );

        // A language no Bible is looked up for; the plan, then the draft.
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['translate', 'draft']);
        expect(fake.toolCallList[0].args).toEqual({
            action: 'translate',
            file: FILE,
        });
        // Two word parts and one diagram: the empty part is not asked.
        expect(askList).toHaveLength(3);
        expect(askList.filter(checkIsDiagramAsk)).toHaveLength(1);
        expect(askList[0]).toContain('Testish');
        // The diagram's own source, never its fence.
        const diagramAsk = askList.find(checkIsDiagramAsk) ?? '';
        expect(diagramAsk.startsWith('graph TD\n')).toBe(true);
        // The window's diagram draws: parsed before it was taken.
        expect(fake.parsedList).toEqual([
            'graph TD\n    A["Nighto"] --> B["Lighto"]',
        ]);

        // Added after the file, under a rule; the passage as the app
        // quoted it again; the token kept; the diagram in its fence.
        const draftArgs = fake.toolCallList[1].args;
        expect(draftArgs.file).toBe(FILE);
        expect(draftArgs.content).toBeUndefined();
        expect(draftArgs.append).toBe(
            '---\n\n' +
                '# The New Birtho\n\nA nighto talko witho a teachero.\n\n' +
                '> **John 3:3** (KJV)\n>\n> **3** Except a man be born again.' +
                '\n\n## The Settingo\nNicodemuso cameo by nighto ' +
                '[^Johno 3:2].\n\n' +
                '```mermaid\ngraph TD\n    A["Nighto"] --> B["Lighto"]\n```',
        );

        // The model is told what the window did, never shown the study.
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toMatch(
            new RegExp(
                `^The window translated ${NAME.replace(/\./g, '\\.')} into ` +
                    'Testish part by part with Gemma 4 \\(test\\), to be ' +
                    'added after the file as it is\\.',
            ),
        );
        expect(seen).toContain('Its 1 diagram(s) are translated.');
        expect(seen).toContain('No Testish Bible is installed');
        expect(seen).toContain('[held by the window:');
        expect(seen).not.toContain('Nighto');

        // The call's own line, then each part said on the wait, counted.
        expect(
            progressList.filter((text) => {
                return text.startsWith('Writing a study file');
            }),
        ).toEqual([
            'Writing a study file: “Testish”',
            'Writing a study file: “Testish 1/3”',
            'Writing a study file: “Testish 2/3”',
            'Writing a study file: “Testish 3/3”',
        ]);

        // The person's card: the change is saved by their press.
        expect(
            answer.actions?.map((action) => {
                return [action.label, action.toolName];
            }),
        ).toEqual([
            [`Save changes to "${NAME}"`, STUDY_CREATE_TOOL_NAME],
            ['Preview', STUDY_PREVIEW_TOOL_NAME],
        ]);
    });

    test.each([
        {
            title: 'the Lookup on a Bible in the language: that one',
            listed: {
                bible: 'KJV',
                bibles: [
                    { key: 'WEB', locale: 'en' },
                    { key: 'KJV', locale: 'en' },
                ],
            },
            expected: 'KJV',
        },
        {
            title: 'the Lookup on another language: a Bible in this one',
            listed: {
                bible: 'XB',
                bibles: [
                    { key: 'XB', locale: 'xq' },
                    { key: 'WEB', locale: 'en' },
                ],
            },
            expected: 'WEB',
        },
    ])(
        'the passage is quoted again from $title',
        async ({ listed, expected }) => {
            useToolHost(listed);
            const { translateText } = useTranslator();
            const { sentList } = useAnthropic([
                anthropicToolUse(
                    translateCall({ language: 'English', place: 'append' }),
                ),
                anthropicText('Done.'),
            ]);

            await askLlmBot(
                'Translate this study to English and add it under',
                'reader',
                'anthropic',
                'claude-sonnet-5',
                [],
                null,
                { translateText },
            );

            expect(fake.toolCallList[0]).toEqual({
                name: 'owa_find_verse',
                args: {},
            });
            expect(fake.toolCallList[1].args).toEqual({
                action: 'translate',
                file: FILE,
                bible: expected,
            });
            // The draft carries the passage as quoted from that Bible.
            const draftArgs = fake.toolCallList[2].args;
            expect(draftArgs.bible).toBe(expected);
            expect(draftArgs.append).toContain(QUOTED);
            const [seen] = readToolResults(sentList[1]);
            expect(seen).toContain(
                `Its Bible passages are quoted from ${expected}.`,
            );
        },
    );

    test('a call missing its place, its language or a translator is refused, and the app is never asked', async () => {
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Testish' }),
                translateCall({ place: 'append' }),
                translateCall({ language: 'Testish', place: 'append' }),
            ),
            anthropicText('Where should the translation go?'),
        ]);

        // No `translateText`: nothing can translate from here.
        await askLlmBot(
            'Translate the study',
            'reader',
            'anthropic',
            'claude-sonnet-5',
        );

        const results = readToolResults(sentList[1]);
        expect(results).toHaveLength(3);
        expect(results[0]).toMatch(
            /^Tool refused: Say where the translation goes in `place`/,
        );
        expect(results[1]).toMatch(/^Tool refused: Name the language/);
        expect(results[2]).toMatch(
            /^Tool refused: No assistant can translate a file from here\./,
        );
        expect(fake.toolCallList).toEqual([]);
    });

    test('words the translator gives back untranslated twice stop the job: nothing is drafted', async () => {
        useToolHost();
        // The second word part comes back as it was handed in.
        const { askList, translateText } = useTranslator((ask) => {
            return ask.includes('## The Setting')
                ? readAskedSource(ask)
                : toTestish(ask);
        });
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Testish', place: 'replace' }),
            ),
            anthropicText('The translation stopped. Shall I try again?'),
        ]);

        const answer = await askLlmBot(
            'Translate it to Testish in place',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        // Asked twice, then the job stopped before the diagram.
        expect(
            askList.filter((ask) => {
                return ask.includes('## The Setting');
            }),
        ).toHaveLength(2);
        expect(askList.filter(checkIsDiagramAsk)).toEqual([]);
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['translate']);
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toBe(
            `Tool refused: The translation of ${NAME} into Testish stopped ` +
                'at part 2 of 3: the translator did not give it back ' +
                'translated, twice. Nothing was drafted. Tell them so in a ' +
                'sentence and offer to try again, or to choose another ' +
                'assistant.',
        );
        expect(
            (answer.actions ?? []).some((action) => {
                return action.toolName === STUDY_CREATE_TOOL_NAME;
            }),
        ).toBe(false);
    });

    test('a diagram whose translation will not draw is kept as it was, and the rest still drafted', async () => {
        useToolHost();
        fake.isDiagramBroken = () => true;
        const { askList, translateText } = useTranslator();
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Testish', place: 'append' }),
            ),
            anthropicText('Translated; one diagram stayed as it was.'),
        ]);

        await askLlmBot(
            'Translate it to Testish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        // The diagram is asked twice, and parsed each time.
        expect(askList.filter(checkIsDiagramAsk)).toHaveLength(2);
        expect(fake.parsedList).toHaveLength(2);
        const draftArgs = fake.toolCallList[1].args;
        expect(draftArgs.append).toContain(DIAGRAM);
        expect(draftArgs.append).toContain('## The Settingo');
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain(
            '0 of its 1 diagrams are translated; 1 kept as they were, ' +
                'since their translation would not draw or left their ' +
                'words untranslated.',
        );
    });

    test('a church word written another way is asked once more, by name, and a heading that is one is written as it', async () => {
        useToolHost(undefined, genTermPlan);
        // The first answer says "bronze serpent" its own way; asked again
        // with the word named, the translator writes it.
        const { askList, translateText } = useTranslator((ask) => {
            const translated = toTestish(ask);
            return ask.includes('Your last translation')
                ? translated.replace('bronzeo serpento', 'brasssnake')
                : translated;
        });
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Termish', place: 'append' }),
            ),
            anthropicText('Translated. Press Save changes to keep it.'),
        ]);

        await askLlmBot(
            'Translate the study to Termish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        expect(askList).toHaveLength(2);
        expect(askList[0]).toContain(
            "Use the church's own words in Termish: Cross references = " +
                'Linked Verses; bronze serpent = brasssnake.',
        );
        expect(askList[0]).not.toContain('Your last translation');
        expect(askList[1]).toContain(
            'Your last translation wrote these another way; write them so: ' +
                'bronze serpent = brasssnake.',
        );
        const draftArgs = fake.toolCallList[1].args;
        expect(draftArgs.append).toBe(
            '---\n\n## Linked Verses\nMoseso liftedo the brasssnake ' +
                '[^Numberso 21:9].',
        );
    });

    test('a second answer no better keeps the first, and the job goes on', async () => {
        useToolHost(undefined, genTermPlan);
        // Neither answer writes the word; the second is otherwise worse.
        const { askList, translateText } = useTranslator((ask) => {
            const translated = toTestish(ask);
            return ask.includes('Your last translation')
                ? translated.replace('Moseso', 'Mosesu')
                : translated;
        });
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Termish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);

        await askLlmBot(
            'Translate the study to Termish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        expect(askList).toHaveLength(2);
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['translate', 'draft']);
        const draftArgs = fake.toolCallList[1].args;
        expect(draftArgs.append).toBe(
            '---\n\n## Linked Verses\nMoseso liftedo the bronzeo serpento ' +
                '[^Numberso 21:9].',
        );
    });

    test('a language with no church words of its own takes them from its installed labels', async () => {
        useToolHost(undefined, () => {
            return {
                ...genPlan(null),
                parts: [
                    {
                        kind: 'text',
                        text:
                            '## Cross References\nThe Old Testament promise ' +
                            '[^Numbers 21:9].\n',
                    },
                ],
            };
        });
        const { askList, translateText } = useTranslator((ask) => {
            const translated = toTestish(ask);
            return ask.includes('Your last translation')
                ? translated.replace('Old Testamento', 'Elder Book')
                : translated;
        });
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Labelish', place: 'append' }),
            ),
            anthropicText('Translated. Press Save changes to keep it.'),
        ]);

        await askLlmBot(
            'Translate the study to Labelish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        // Its own labels, once; a label it leaves in English is no word.
        expect(LABELISH.loadedList).toEqual([LABELISH.code]);
        expect(askList[0]).toContain(
            "Use the church's own words in Labelish: Cross References = " +
                'Joined Verses; Old Testament = Elder Book.',
        );
        expect(askList[0]).not.toContain('New Testament =');
        expect(askList).toHaveLength(2);
        expect(askList[1]).toContain(
            'write them so: Old Testament = Elder Book.',
        );
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.action).toBe('draft');
        expect(draftArgs.append).toBe(
            '---\n\n## Joined Verses\nThe Elder Book promiseo ' +
                '[^Numberso 21:9].',
        );
    });

    test("a language's Bible words: told, asked again when written another way, a changed form taken", async () => {
        useToolHost(undefined, () => {
            return {
                ...genPlan(null),
                parts: [
                    {
                        kind: 'text',
                        text: '## Pharisees\nThe Son of Man came [^John 3:14].\n',
                    },
                ],
            };
        });
        const { askList, translateText } = useTranslator((ask) => {
            const translated = toTestish(ask);
            return translated.replace(
                'Son of Man',
                ask.includes('Your last translation')
                    ? 'Sonon di Mannos'
                    : 'Childo of Humano',
            );
        });
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Labelish', place: 'append' }),
            ),
            anthropicText('Translated. Press Save changes to keep it.'),
        ]);

        await askLlmBot(
            'Translate the study to Labelish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        expect(askList[0]).toContain(
            "Use the church's own words in Labelish: Son of Man = " +
                'Sono di Manno; Pharisees = the strict ones.',
        );
        expect(askList).toHaveLength(2);
        expect(askList[1]).toContain(
            'write them so: Son of Man = Sono di Manno.',
        );
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain('## The strict ones\n');
        expect(draftArgs.append).toContain('Sonon di Mannos cameo');
    });

    test.each([
        {
            title: 'an English Bible names its references',
            bibles: [
                { key: 'XB', locale: 'xq' },
                { key: 'WEB', locale: 'en' },
            ],
            expected: 'WEB',
        },
        {
            title: 'with no English Bible, nothing is named',
            bibles: [{ key: 'XB', locale: 'xq' }],
            expected: undefined,
        },
    ])(
        "a language with no Bible of its own: $title, never the Lookup's",
        async ({ bibles, expected }) => {
            useToolHost({ bible: 'XB', bibles });
            const { translateText } = useTranslator();
            useAnthropic([
                anthropicToolUse(
                    translateCall({ language: 'Labelish', place: 'append' }),
                ),
                anthropicText('Translated.'),
            ]);

            await askLlmBot(
                'Translate the study to Labelish and add it under',
                'reader',
                'anthropic',
                'claude-sonnet-5',
                [],
                null,
                { translateText },
            );

            expect(
                fake.toolCallList.map((call) => {
                    return call.name === 'owa_find_verse'
                        ? 'list'
                        : call.args?.action;
                }),
            ).toEqual(['list', 'translate', 'draft']);
            // No Bible in it to quote the passage again from.
            expect(fake.toolCallList[1].args).toEqual({
                action: 'translate',
                file: FILE,
            });
            expect(fake.toolCallList[2].args.bible).toBe(expected);
        },
    );

    test('a letter of a third script slipped in is asked about once more, and the clean answer drafted', async () => {
        useToolHost();
        // A letter of one script, by code point: no language is written here.
        const stray = String.fromCodePoint(0x0d94);
        const { askList, translateText } = useTranslator((ask) => {
            const translated = toTestish(ask);
            return ask.startsWith('# The New Birth') &&
                !ask.includes('letters of another language')
                ? translated.replace('teachero', `teacher${stray}o`)
                : translated;
        });
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Testish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);

        await askLlmBot(
            'Translate the study to Testish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        // Two word parts and a diagram, the first asked twice.
        expect(askList).toHaveLength(4);
        expect(askList[1]).toContain(
            'Your last translation had letters of another language in it ' +
                `(${stray}); write every word in Testish letters.`,
        );
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain('A nighto talko witho a teachero.');
        expect(draftArgs.append).not.toContain(stray);
    });

    test('an English word left between the script’s words is asked about once more, and the clean answer drafted', async () => {
        useToolHost();
        // The first answer keeps "with" as it was: the user's John 3
        // study, its Khmer half, kept "and" and "between" so (EC-533).
        const { askList, translateText } = useTranslator((ask) => {
            const isFirstTry =
                ask.startsWith('# The New Birth') &&
                !ask.includes('left English words');
            return checkIsDiagramAsk(ask)
                ? toScriptishDiagram(ask)
                : toScriptish(readAskedSource(ask), isFirstTry ? 'with' : '');
        });
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);

        await askLlmBot(
            'Translate the study to Scriptish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        // Two word parts and a diagram, the first asked twice.
        expect(askList).toHaveLength(4);
        expect(askList[1]).toContain(
            'Your last translation left English words in it (with); ' +
                'translate them into Scriptish too.',
        );
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain(toScriptish('A night talk with'));
        expect(draftArgs.append).not.toContain(' with ');
    });

    test('a diagram’s label left as it was is asked about once more by name, and the answer that translated it drafted', async () => {
        useToolHost(undefined, genTimelinePlan);
        // The first answer translates the words after each colon alone, as
        // the old ask said -- the user's study's timeline, its periods left.
        const { askList, translateText } = useTranslator((ask) => {
            if (!checkIsDiagramAsk(ask)) {
                return toScriptish(readAskedSource(ask));
            }
            return ask.includes('left these as they were')
                ? TIMELINE_TRANSLATED
                : TIMELINE_EVENTS_ONLY;
        });
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);

        await askLlmBot(
            'Translate the study to Scriptish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        const diagramAskList = askList.filter(checkIsDiagramAsk);
        expect(diagramAskList).toHaveLength(2);
        // A timeline's periods are named for what they are.
        expect(diagramAskList[0]).toContain(
            'the words BEFORE each colon as well as after it',
        );
        expect(diagramAskList[1]).toContain(
            'Your last translation left these as they were; translate them ' +
                'too: "The Night Talk", "John\'s Ministry".',
        );
        expect(fake.parsedList).toEqual([
            TIMELINE_EVENTS_ONLY,
            TIMELINE_TRANSLATED,
        ]);
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain(
            `\`\`\`mermaid\n${TIMELINE_TRANSLATED}\n\`\`\``,
        );
    });

    test('a diagram handed back with every label as it was is kept as it was, and said so', async () => {
        useToolHost(undefined, genTimelinePlan);
        const { askList, translateText } = useTranslator((ask) => {
            return checkIsDiagramAsk(ask)
                ? readAskedSource(ask)
                : toScriptish(readAskedSource(ask));
        });
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'append' }),
            ),
            anthropicText('Translated; its diagram stayed as it was.'),
        ]);

        await askLlmBot(
            'Translate the study to Scriptish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        expect(askList.filter(checkIsDiagramAsk)).toHaveLength(2);
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain(TIMELINE_DIAGRAM);
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain(
            '0 of its 1 diagrams are translated; 1 kept as they were, ' +
                'since their translation would not draw or left their ' +
                'words untranslated.',
        );
    });

    test('the answer that left fewer labels is kept when the one asked again will not draw', async () => {
        useToolHost(undefined, genTimelinePlan);
        // The second answer is whole, and mermaid cannot draw it.
        fake.isDiagramBroken = (source) => {
            return source === TIMELINE_TRANSLATED;
        };
        const { askList, translateText } = useTranslator((ask) => {
            if (!checkIsDiagramAsk(ask)) {
                return toScriptish(readAskedSource(ask));
            }
            return ask.includes('left these as they were')
                ? TIMELINE_TRANSLATED
                : TIMELINE_TITLE_LEFT;
        });
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);

        await askLlmBot(
            'Translate the study to Scriptish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        expect(askList.filter(checkIsDiagramAsk)).toHaveLength(2);
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain(TIMELINE_TITLE_LEFT);
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain('Its 1 diagram(s) are translated.');
    });

    // EC-582, the user: _I asked to change all content to khmer, it still
    // partially english_ -- the dialogue's boxes read "God", "Cain" and
    // "Abel", ids its messages named and no translator was told of.
    test('a dialogue’s participants drawn by their ids are given them as names to translate, an id written in the language put back', async () => {
        const dialogue = [
            'sequenceDiagram',
            '    God->>Cain: "Why are you angry?"',
            '    Cain->>Abel: (kills him)',
        ].join('\n');
        useToolHost(undefined, () => {
            return {
                ...genPlan(null),
                parts: [
                    { kind: 'text', text: '# Two Brothers\n' },
                    {
                        kind: 'diagram',
                        text: `\`\`\`mermaid\n${dialogue}\n\`\`\``,
                    },
                ],
            };
        });
        // The translator writes each declared id in the script too, and
        // keeps the ids its arrows name.
        const { askList, translateText } = useTranslator((ask) => {
            const source = readAskedSource(ask);
            if (!checkIsDiagramAsk(ask)) {
                return toScriptish(source);
            }
            return source
                .split('\n')
                .map((line) => {
                    const declared = /^(\s*participant )(\S+) as (.+)$/.exec(
                        line,
                    );
                    if (declared !== null) {
                        return (
                            declared[1] +
                            toScriptish(declared[2]) +
                            ' as ' +
                            toScriptish(declared[3])
                        );
                    }
                    const colon = line.indexOf(':');
                    return colon < 0
                        ? line
                        : line.slice(0, colon + 1) +
                              toScriptish(line.slice(colon + 1));
                })
                .join('\n');
        });
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);

        await askLlmBot(
            'Change all of it to Scriptish',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        const diagramAskList = askList.filter(checkIsDiagramAsk);
        // Asked once: the answer drew every box in the script.
        expect(diagramAskList).toHaveLength(1);
        expect(readAskedSource(diagramAskList[0])).toBe(
            [
                'sequenceDiagram',
                '    participant God as God',
                '    participant Cain as Cain',
                '    God->>Cain: "Why are you angry?"',
                '    participant Abel as Abel',
                '    Cain->>Abel: (kills him)',
            ].join('\n'),
        );
        expect(diagramAskList[0]).toContain(
            'each name after `as` -- never the id before it',
        );
        const translated = [
            'sequenceDiagram',
            `    participant God as ${toScriptish('God')}`,
            `    participant Cain as ${toScriptish('Cain')}`,
            `    God->>Cain: "${toScriptish('Why are you angry')}?"`,
            `    participant Abel as ${toScriptish('Abel')}`,
            `    Cain->>Abel: (${toScriptish('kills him')})`,
        ].join('\n');
        expect(fake.parsedList).toEqual([translated]);
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain(
            `\`\`\`mermaid\n${translated}\n\`\`\``,
        );
    });

    test('a language named with no code reads no labels', async () => {
        useToolHost(undefined, genTermPlan);
        const { translateText } = useTranslator();
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Termish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);

        await askLlmBot(
            'Translate the study to Termish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        expect(LABELISH.loadedList).toEqual([]);
    });
});

// What `owa_bible_suggest books` answers (EC-534): the Labelish Bible the
// passages are quoted from, and one of another language naming its books
// its own way -- as the French Bibles named Titus in the user's Khmer study.
const BOOK_NAMES_ANSWER = {
    kind: 'books',
    bookKeys: ['NUM', 'JHN', 'TIT'],
    english: ['Numbers', 'John', 'Titus'],
    bibles: [
        { keys: ['ZB'], locale: 'zz', books: ['Znum', 'Zjohn', 'Ztit'] },
        { keys: ['YB'], locale: 'yq', books: ['Ynum', 'Yjohn', 'Ytit'] },
    ],
};

// A study whose words cite a book in each of two parts.
function genBookPlan(bible: string | null) {
    return {
        ...genPlan(bible),
        parts: [
            {
                kind: 'text',
                text: '# The New Birth\n\nTitus 3:4-5 tells of the washing.\n',
            },
            { kind: 'diagram', text: DIAGRAM },
            {
                kind: 'text',
                text: '\n## The Serpent\nMoses lifted it up: Numbers 21:8-9.\n',
            },
        ],
    };
}

// The tool host, with every installed Bible's book names.
function useBookNames() {
    const hostAnswer = fake.answerTool;
    fake.answerTool = (name, args) => {
        if (name === 'owa_bible_suggest') {
            return JSON.stringify(BOOK_NAMES_ANSWER);
        }
        return hostAnswer === null ? '' : hostAnswer(name, args);
    };
}

// Testish, with Titus named as the other language's Bible names it and
// Numbers -- until asked again -- as no Bible does.
function toTestishWithBooks(ask: string) {
    const words = toTestish(ask);
    if (checkIsDiagramAsk(ask)) {
        return words;
    }
    const isAskedAgain = ask.includes('named these books another way');
    return words
        .replace('Tituso', 'Ytit')
        .replace('Numberso', isAskedAgain ? 'Znum' : 'Numbo');
}

describe('the books a translated study cites (EC-534)', () => {
    async function askTranslation(
        translator: ReturnType<typeof useTranslator>,
    ) {
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Labelish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);
        await askLlmBot(
            'Translate the study to Labelish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText: translator.translateText },
        );
    }

    test("are named as the language's Bible names them: another language's name written so, one no Bible gives asked about once more", async () => {
        useToolHost(
            { bible: null, bibles: [{ key: 'ZB', locale: 'zz' }] },
            genBookPlan,
        );
        useBookNames();
        const translator = useTranslator(toTestishWithBooks);

        await askTranslation(translator);

        // Read once for the job, though two parts cite a book.
        expect(
            fake.toolCallList.filter((call) => {
                return call.name === 'owa_bible_suggest';
            }),
        ).toEqual([
            { name: 'owa_bible_suggest', args: { kind: 'books', prefix: '' } },
        ]);
        const textAskList = translator.askList.filter((ask) => {
            return !checkIsDiagramAsk(ask);
        });
        // The first part once -- its name put right with no second round
        // -- and the second twice.
        expect(textAskList).toHaveLength(3);
        expect(textAskList[0]).toContain(
            ' Write each book of the Bible as the Labelish Bible names it: ' +
                'Titus = Ztit.',
        );
        expect(textAskList[1]).toContain('names it: Numbers = Znum.');
        expect(textAskList[1]).not.toContain('another way');
        expect(textAskList[2]).toContain(
            ' Your last translation named these books another way: ' +
                '"Numbo 21:8-9" (Numbers = Znum); write each as the ' +
                'Labelish Bible names it.',
        );
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain('Ztit 3:4-5 tellso');
        expect(draftArgs.append).toContain('Znum 21:8-9.');
        expect(draftArgs.append).not.toContain('Ytit');
        expect(draftArgs.append).not.toContain('Numbo');
    });

    test('are not read when the words cite no chapter and verse', async () => {
        // The plan cites John 3:2 in a token alone, which the draft names
        // from the Bible.
        useToolHost({ bible: null, bibles: [{ key: 'ZB', locale: 'zz' }] });
        useBookNames();
        const translator = useTranslator();

        await askTranslation(translator);

        expect(
            fake.toolCallList.some((call) => {
                return call.name === 'owa_bible_suggest';
            }),
        ).toBe(false);
        expect(
            translator.askList.some((ask) => {
                return ask.includes('Write each book');
            }),
        ).toBe(false);
    });

    test('are left as the translator wrote them when the names cannot be read', async () => {
        useToolHost(
            { bible: null, bibles: [{ key: 'ZB', locale: 'zz' }] },
            genBookPlan,
        );
        const translator = useTranslator(toTestishWithBooks);

        await askTranslation(translator);

        // Asked about, nothing named: each part once, and drafted.
        expect(translator.askList).toHaveLength(3);
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain('Ytit 3:4-5');
        expect(draftArgs.append).toContain('Numbo 21:8-9');
    });
});

// The names a translated study uses (EC-535), in a made-up Bible whose
// letters and vowel signs are made by code point: a place it writes in one
// verse, the Pharisees, and the ways a translator -- or the language's list
// of church words -- writes them with another vowel sign.
function toNameLetter(index: number) {
    return String.fromCodePoint(0x1000 + index);
}
const NAME_VOWEL_I = String.fromCodePoint(0x102d);
const NAME_VOWEL_II = String.fromCodePoint(0x102e);
const NAME_VOWEL_U = String.fromCodePoint(0x102f);
const ZENON_BIBLE = `${toNameLetter(0)}${NAME_VOWEL_I}${toNameLetter(1)}${toNameLetter(2)}${NAME_VOWEL_U}`;
const ZENON_SLIP = `${toNameLetter(0)}${NAME_VOWEL_II}${toNameLetter(1)}${toNameLetter(2)}${NAME_VOWEL_U}`;
const PHARISEES_BIBLE = `${toNameLetter(9)}${NAME_VOWEL_I}${toNameLetter(10)}${toNameLetter(11)}${NAME_VOWEL_I}`;
const PHARISEES_LISTED = `${toNameLetter(9)}${NAME_VOWEL_II}${toNameLetter(10)}${toNameLetter(11)}${NAME_VOWEL_I}`;
// Words of both verses, with no vowel sign: no name.
const VERSE_WORD = `${toNameLetter(20)}${toNameLetter(21)}`;
const WATER_WORD = `${toNameLetter(22)}${toNameLetter(23)}${toNameLetter(24)}`;
const NAME_QUOTED = [
    `> **${VERSE_WORD} 3:22-23** (ZB)`,
    '>',
    `> **22** ${VERSE_WORD} ${PHARISEES_BIBLE} ${WATER_WORD}.`,
    '>',
    `> **23** ${VERSE_WORD} ${ZENON_BIBLE} ${WATER_WORD}.`,
].join('\n');
const NAME_DIAGRAM =
    '```mermaid\ngraph TD\n    A["Zenon"] --> B["Much water"]\n```';

// A study quoting two verses, its heading naming no one, its words and its
// diagram naming the place and the Pharisees.
function genNamePlan(bible: string | null) {
    return {
        ...genPlan(bible),
        parts: [
            { kind: 'text', text: '# Baptizing in the Land\n' },
            {
                kind: 'passage',
                text:
                    '> **John 3:22-23** (KJV)\n>\n> **22** After these things ' +
                    'came the Pharisees into the land.\n>\n> **23** And they ' +
                    'were baptizing in Zenon, because there was much water there.',
                quoted: bible === null ? null : NAME_QUOTED,
            },
            { kind: 'diagram', text: NAME_DIAGRAM },
            {
                kind: 'text',
                text:
                    '\n## The Place\nThey baptized at Zenon, and the ' +
                    'Pharisees heard of it.\n',
            },
        ],
    };
}

// Scriptish, with Zenon written with another vowel sign until asked again,
// and the Pharisees always as the language's list writes them.
function toScriptishWithNames(ask: string) {
    const zenon = ask.includes('another way than their verse')
        ? ZENON_BIBLE
        : ZENON_SLIP;
    const source = readAskedSource(ask)
        .replace('Zenon', zenon)
        .replace('Pharisees', PHARISEES_LISTED);
    return checkIsDiagramAsk(ask)
        ? source.replace(/"([^"]+)"/g, (_whole, words: string) => {
              return `"${toScriptish(words)}"`;
          })
        : toScriptish(source);
}

describe('the names a translated study uses (EC-535)', () => {
    const churchWords = LABELISH.churchWords;
    beforeEach(() => {
        // The language's list writes the Pharisees with another vowel sign
        // than the Bible its passages are quoted from, letter for letter.
        LABELISH.churchWords = {
            wordsChangeForm: false,
            words: { Pharisees: PHARISEES_LISTED },
        };
    });
    afterEach(() => {
        LABELISH.churchWords = churchWords;
    });

    async function askTranslation(
        translator: ReturnType<typeof useTranslator>,
    ) {
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Labelish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);
        await askLlmBot(
            'Translate the study to Labelish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText: translator.translateText },
        );
    }

    test('are written as the Bible quoted writes them: a church word put right in code, a place shown with its verse and asked about once more', async () => {
        useToolHost(
            { bible: null, bibles: [{ key: 'ZB', locale: 'zz' }] },
            genNamePlan,
        );
        const translator = useTranslator(toScriptishWithNames);

        await askTranslation(translator);

        const textAskList = translator.askList.filter((ask) => {
            return !checkIsDiagramAsk(ask);
        });
        const diagramAskList = translator.askList.filter(checkIsDiagramAsk);
        // The heading, naming no one, once; the words and the diagram twice.
        expect(textAskList).toHaveLength(3);
        expect(textAskList[0]).not.toContain('Write each name');
        const namesText =
            ' Write each name of a person or a place as the Labelish Bible ' +
            `writes it in its verse: Zenon -- verse 23: "${VERSE_WORD} ` +
            `${ZENON_BIBLE} ${WATER_WORD}."`;
        expect(textAskList[1]).toContain(
            " Use the church's own words in Labelish: Pharisees = " +
                `${PHARISEES_BIBLE}.`,
        );
        expect(textAskList[1]).toContain(namesText);
        expect(textAskList[1]).not.toContain('another way than their verse');
        const slipText =
            ' Your last translation wrote these another way than their ' +
            `verse: "${ZENON_SLIP}" (verse 23 writes "${ZENON_BIBLE}"); ` +
            'write each name as its verse does.';
        expect(textAskList[2]).toContain(slipText);
        expect(diagramAskList).toHaveLength(2);
        expect(diagramAskList[0]).toContain(namesText);
        expect(diagramAskList[1]).toContain(slipText);
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain(
            `${toScriptish('They baptized at')} ${ZENON_BIBLE}, ` +
                `${toScriptish('and the')} ${PHARISEES_BIBLE} ` +
                `${toScriptish('heard of it')}.`,
        );
        expect(draftArgs.append).toContain(`A["${ZENON_BIBLE}"]`);
        expect(draftArgs.append).not.toContain(PHARISEES_LISTED);
        expect(draftArgs.append).not.toContain(ZENON_SLIP);
    });

    test('are the translator’s with no Bible of the language to quote from: no verse shown, the church word as listed', async () => {
        useToolHost({ bible: null, bibles: [] }, genNamePlan);
        const translator = useTranslator(toScriptishWithNames);

        await askTranslation(translator);

        // Each part once: nothing to hold a name to.
        expect(translator.askList).toHaveLength(3);
        expect(
            translator.askList.some((ask) => {
                return ask.includes('Write each name');
            }),
        ).toBe(false);
        expect(
            translator.askList.find((ask) => {
                return ask.includes('They baptized');
            }),
        ).toContain(`Pharisees = ${PHARISEES_LISTED}.`);
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain(
            `${toScriptish('and the')} ${PHARISEES_LISTED} ` +
                `${toScriptish('heard of it')}.`,
        );
        expect(draftArgs.append).toContain(`A["${ZENON_SLIP}"]`);
    });
});

// A river the passage names in one verse (EC-561), in the same made-up
// Bible: four letters, a sign on the first, as its verse writes it -- and
// as a translator writes it, a letter fewer and a vowel sign for the sign.
const NAME_DOT_BELOW = String.fromCodePoint(0x1037);
const RIVER_BIBLE =
    `${toNameLetter(14)}${NAME_DOT_BELOW}${toNameLetter(15)}` +
    `${toNameLetter(16)}${NAME_VOWEL_U}${toNameLetter(17)}`;
const RIVER_OWN =
    `${toNameLetter(14)}${NAME_VOWEL_I}${toNameLetter(16)}` +
    `${NAME_VOWEL_U}${toNameLetter(17)}`;
const RIVER_QUOTED = [
    `> **${VERSE_WORD} 3:26** (ZB)`,
    '>',
    `> **26** ${VERSE_WORD} ${RIVER_BIBLE} ${WATER_WORD}.`,
].join('\n');

// A study quoting the verse, its list of places naming the river in bold.
function genRiverPlan(bible: string | null) {
    return {
        ...genPlan(bible),
        parts: [
            { kind: 'text', text: '# Beyond the River\n' },
            {
                kind: 'passage',
                text:
                    '> **John 3:26** (KJV)\n>\n> **26** And they came ' +
                    'unto him beyond Jordan.',
                quoted: bible === null ? null : RIVER_QUOTED,
            },
            {
                kind: 'text',
                text: '\n## The Places\n* **Jordan**: the river.\n',
            },
        ],
    };
}

// Scriptish, with the river in the translator's own letters until a retry
// names it.
function toScriptishWithRiver(ask: string) {
    const river = ask.includes('if that word is Jordan')
        ? RIVER_BIBLE
        : RIVER_OWN;
    return toScriptish(readAskedSource(ask).replace('Jordan', river));
}

describe('a name a translated study writes with other letters (EC-561)', () => {
    test('is named in its part’s retry with its English name, read off the bold words in its place, and written as its verse writes it', async () => {
        useToolHost(
            { bible: null, bibles: [{ key: 'ZB', locale: 'zz' }] },
            genRiverPlan,
        );
        const translator = useTranslator(toScriptishWithRiver);
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Labelish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);

        await askLlmBot(
            'Translate the study to Labelish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText: translator.translateText },
        );

        // The heading once; the places twice.
        expect(translator.askList).toHaveLength(3);
        expect(translator.askList[1]).toContain(
            `Jordan -- verse 26: "${VERSE_WORD} ${RIVER_BIBLE} ${WATER_WORD}."`,
        );
        expect(translator.askList[1]).not.toContain(
            'another way than their verse',
        );
        expect(translator.askList[2]).toContain(
            ' Your last translation wrote these another way than their ' +
                `verse: Jordan as "${RIVER_OWN}" (verse 26 writes ` +
                `"${RIVER_BIBLE}", if that word is Jordan); write each ` +
                'name as its verse does.',
        );
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.append).toContain(`**${RIVER_BIBLE}**`);
        expect(draftArgs.append).not.toContain(RIVER_OWN);
    });
});

// What the app's `owa_language check` says of a language this window does
// not have; null when the check cannot be made.
function useLangCheck(checked: unknown) {
    const hostAnswer = fake.answerTool;
    fake.answerTool = (name, args) => {
        if (name === 'owa_language') {
            return checked === null ? '' : JSON.stringify(checked);
        }
        return hostAnswer === null ? '' : hostAnswer(name, args);
    };
}

function readCallSteps() {
    return fake.toolCallList.map((call) => {
        return call.name === 'owa_find_verse' ? 'list' : call.args?.action;
    });
}

const LANG_CHECKED = {
    langCode: 'zz',
    name: 'Labelish',
    nativeName: 'Labelo',
    version: '0.0.3',
    size: 4_000_000,
};

describe('a study translated into a language this window does not have (EC-494)', () => {
    test.each([
        {
            state: 'turned-off',
            said: 'turned off in this app',
            asked: 'turn it on',
        },
        {
            state: 'missing',
            said: 'not installed in this app',
            asked: 'install it',
        },
    ])(
        '$state: offered under the answer -- nothing read, translated or drafted, by the window or the model',
        async ({ state, said, asked }) => {
            LABELISH.isInStore = false;
            useToolHost({ bible: null, bibles: [{ key: 'ZB', locale: 'zz' }] });
            const checked = { ...LANG_CHECKED, state };
            useLangCheck(checked);
            const { translateText } = useTranslator();
            const { sentList } = useAnthropic([
                anthropicToolUse(
                    translateCall({ language: 'Labelish', place: 'append' }),
                ),
                // Asked again, then written by the model itself.
                anthropicToolUse(
                    translateCall({ language: 'Labelish', place: 'append' }),
                    {
                        name: 'owa_resource_file',
                        input: {
                            action: 'draft',
                            file: FILE,
                            append: 'Labelo words of its own',
                        },
                    },
                ),
                anthropicText('Labelish has to be turned on first.'),
            ]);

            const answer = await askLlmBot(
                'Translate the study to Labelish and add it under',
                'reader',
                'anthropic',
                'claude-sonnet-5',
                [],
                null,
                { translateText },
            );

            // One check, once, and nothing else asked of the app.
            expect(fake.toolCallList).toEqual([
                {
                    name: 'owa_language',
                    args: { action: 'check', language: 'zz' },
                },
            ]);
            expect(LABELISH.loadedList).toEqual([]);
            expect(translateText).not.toHaveBeenCalled();
            const [refused] = readToolResults(sentList[1]);
            // Its sentence in their language, not the one translated into,
            // and no way on but the window's (both seen live).
            expect(refused).toBe(
                `Tool refused: Labelish is ${said}, so the window cannot ` +
                    'translate into it yet. Nothing was translated. Under ' +
                    'your answer the window asks them, with buttons of its ' +
                    `own, whether to ${asked} first. Tell them so in one ` +
                    'short sentence, written in the language of their ' +
                    'question, not in Labelish. Give no steps, buttons or ' +
                    'options of your own. Do not translate the study ' +
                    'yourself, and draft nothing.',
            );
            const [again, drafted] = readToolResults(sentList[2]);
            expect(again).toBe(refused);
            expect(drafted).toMatch(
                /^Tool refused: The translation waits for the language the window offers under your answer\./,
            );
            // The window offers it, with the question to ask again.
            expect(answer.langOffer).toEqual({
                check: checked,
                packageCode: 'zz',
            });
        },
    );

    test('Not now: asked again going on without the language, it is translated as before', async () => {
        LABELISH.isInStore = false;
        useToolHost();
        useLangCheck({ ...LANG_CHECKED, state: 'turned-off' });
        const { askList, translateText } = useTranslator();
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Labelish', place: 'append' }),
            ),
            anthropicText('Translated. Press Save changes to keep it.'),
        ]);

        const answer = await askLlmBot(
            'Translate the study to Labelish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText, skipLangOffer: 'zz' },
        );

        expect(readCallSteps()).toEqual(['list', 'translate', 'draft']);
        expect(askList.length).toBeGreaterThan(0);
        expect(answer.langOffer).toBeUndefined();
        expect(
            answer.actions?.map((action) => {
                return action.toolName;
            }),
        ).toEqual([STUDY_CREATE_TOOL_NAME, STUDY_PREVIEW_TOOL_NAME]);
    });

    test.each([
        { title: 'a check that cannot be made', checked: null },
        {
            title: 'a language the catalog lacks',
            checked: { state: 'unavailable' },
        },
        {
            title: 'one installed meanwhile',
            checked: { ...LANG_CHECKED, state: 'installed' },
        },
    ])('$title: translated as before, never stopped', async ({ checked }) => {
        LABELISH.isInStore = false;
        useToolHost();
        useLangCheck(checked);
        const { translateText } = useTranslator();
        useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Labelish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);

        const answer = await askLlmBot(
            'Translate the study to Labelish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        expect(readCallSteps()).toEqual([
            'check',
            'list',
            'translate',
            'draft',
        ]);
        expect(answer.langOffer).toBeUndefined();
    });
});

describe('a study translated again into a language it holds (EC-547)', () => {
    // Added after the study already: a translation in a language no package
    // names, then an earlier English one.
    const OLD_OTHER =
        '***\n# Kavrut Nelvo\n\nDaskim mekrot tranvel privol, vaskun deltor.\n';
    const OLD_SAME =
        '---\n\n# The Second Birth\n\nA night conversation with a rabbi, ' +
        'the teacher of Israel.\n\n## The Scene\nNicodemus came to Jesus ' +
        'by night [^John 3:2].\n';

    // English again, in other words: every part comes back changed.
    function toOtherEnglish(ask: string) {
        if (checkIsDiagramAsk(ask)) {
            return toTestish(ask);
        }
        return readAskedSource(ask)
            .replace('New', 'Second')
            .replace('talk', 'conversation')
            .replace('teacher', 'rabbi')
            .replace('Setting', 'Scene')
            .replace('came', 'went');
    }

    test('added after the file: in place of the one in that language, never a second one', async () => {
        useToolHost(undefined, (bible) => {
            return {
                ...genPlan(bible),
                translations: `${OLD_OTHER}\n${OLD_SAME}`,
            };
        });
        const { translateText } = useTranslator(toOtherEnglish);
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'English', place: 'append' }),
            ),
            anthropicText('Done.'),
        ]);

        await askLlmBot(
            'Translate this study to English again and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual([undefined, 'translate', 'draft']);
        const draftArgs = fake.toolCallList[2].args;
        expect(draftArgs.append).toBeUndefined();
        const plan = genPlan(null);
        const original = plan.parts
            .map((part) => {
                return part.text;
            })
            .join('\n');
        // The study as written, the other translation as it was, and the
        // new English where the old stood: one English, never two.
        expect(draftArgs.content).toBe(
            `${original}\n${OLD_OTHER}\n---\n\n` +
                '# The Second Birth\n\nA night conversation with a rabbi.\n\n' +
                '> **John 3:3** (KJV)\n>\n> **3** Except a man be born again.' +
                '\n\n## The Scene\nNicodemus went by night [^John 3:2].\n\n' +
                '```mermaid\ngraph TD\n    A["Nighto"] --> B["Lighto"]\n```\n' +
                plan.footer,
        );

        // The model is told it took the old one's place.
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain(
            'in place of its translation into English already added after ' +
                'it: never a second one.',
        );
        expect(seen).toContain(
            'the other translations added after it are kept as they are.',
        );
        expect(seen).not.toContain('Nicodemus went');
    });
});

describe('a study in the language asked already (EC-589)', () => {
    // The user's Genesis 4 study, written in the language: its words, its
    // passage and a diagram in the script, its dialogue's boxes drawn by
    // their English ids -- and a paragraph naming a Bible by its key.
    const WORDS =
        `${toScriptish('# Two Brothers')}\n\n` +
        `${toScriptish('Cain brought fruit and Abel a lamb')}.\n`;
    const KEYED = `\n${toScriptish('Abel kept sheep')} (KJV) ${toScriptish('and Cain tilled the ground')}.\n`;
    const PASSAGE =
        `> **${toScriptish('Genesis')} 4:8** (XB)\n>\n` +
        `> **8** ${toScriptish('And Cain talked with Abel his brother')}.`;
    const GRAPH =
        '```mermaid\ngraph TD\n' +
        `    A["${toScriptish('Offering')}"] --> B["${toScriptish('Anger')}"]\n` +
        '```';
    const DIALOGUE = `\`\`\`mermaid\nsequenceDiagram\n    God->>Cain: "${toScriptish('Why are you angry')}?"\n\`\`\``;

    function genScriptPlan(parts: { kind: string; text: string }[]) {
        return () => {
            return {
                ...genPlan(null),
                parts: parts.map((part) => {
                    return { ...part, quoted: null };
                }),
            };
        };
    }

    // The translator: a dialogue's names after `as` put into the script,
    // and words handed back as they were.
    function toNamedDialogue(ask: string) {
        const source = readAskedSource(ask);
        if (!checkIsDiagramAsk(ask)) {
            return source;
        }
        return source.replace(/ as (\w+)$/gm, (_whole, name: string) => {
            return ` as ${toScriptish(name)}`;
        });
    }

    test('only what is not in it is asked: a paragraph given back as it was is taken, the dialogue’s boxes translated, the rest byte for byte', async () => {
        useToolHost(
            undefined,
            genScriptPlan([
                { kind: 'text', text: WORDS },
                { kind: 'passage', text: PASSAGE },
                { kind: 'text', text: KEYED },
                { kind: 'diagram', text: GRAPH },
                { kind: 'diagram', text: DIALOGUE },
                { kind: 'text', text: '' },
            ]),
        );
        const { askList, translateText } = useTranslator(toNamedDialogue);
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'replace' }),
            ),
            anthropicText('Done.'),
        ]);

        await askLlmBot(
            'Change all of it to Scriptish',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        // The keyed paragraph, asked once and taken as it came back, and
        // the dialogue: never the words, the passage or the graph.
        expect(askList).toHaveLength(2);
        expect(readAskedSource(askList[0])).toBe(KEYED.trim());
        expect(checkIsDiagramAsk(askList[1])).toBe(true);
        const named = [
            'sequenceDiagram',
            `    participant God as ${toScriptish('God')}`,
            `    participant Cain as ${toScriptish('Cain')}`,
            `    God->>Cain: "${toScriptish('Why are you angry')}?"`,
        ].join('\n');
        expect(fake.parsedList).toEqual([named]);
        const draftArgs = fake.toolCallList[fake.toolCallList.length - 1].args;
        expect(draftArgs.action).toBe('draft');
        expect(draftArgs.content).toBe(
            [WORDS, PASSAGE, KEYED, GRAPH, `\`\`\`mermaid\n${named}\n\`\`\``]
                .join('\n')
                .trim() +
                '\n' +
                genPlan(null).footer,
        );
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain(
            `The window translated what of ${NAME} was not in Scriptish yet ` +
                'part by part with Gemma 4 (test), in place of its words. 2 ' +
                'paragraph(s) of its words, 1 diagram(s) and 1 Bible ' +
                'passage(s) were in Scriptish already, so are kept as they ' +
                'were. 1 of its 2 diagrams are translated.',
        );
    });

    test('wholly in it: nothing is asked or drafted, and the model is told so', async () => {
        useToolHost(
            undefined,
            genScriptPlan([
                { kind: 'text', text: WORDS },
                { kind: 'passage', text: PASSAGE },
                { kind: 'diagram', text: GRAPH },
            ]),
        );
        const { askList, translateText } = useTranslator();
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'replace' }),
            ),
            anthropicText('It is in Scriptish already.'),
        ]);

        const answer = await askLlmBot(
            'Change all of it to Scriptish',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        expect(askList).toEqual([]);
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['translate']);
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toBe(
            `Nothing was translated: every part of ${NAME} is in Scriptish ` +
                'already, so nothing was drafted. Tell them so in a sentence ' +
                '-- never that it was translated or changed.',
        );
        expect(
            (answer.actions ?? []).some((action) => {
                return (
                    action.toolName === STUDY_CREATE_TOOL_NAME ||
                    action.toolName === STUDY_PREVIEW_TOOL_NAME
                );
            }),
        ).toBe(false);
    });

    test('added after words in it already: refused before anything is asked, nothing drafted', async () => {
        useToolHost(
            undefined,
            genScriptPlan([
                { kind: 'text', text: WORDS },
                { kind: 'diagram', text: DIALOGUE },
            ]),
        );
        const { askList, translateText } = useTranslator(toNamedDialogue);
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'append' }),
            ),
            anthropicText('It is in Scriptish already.'),
        ]);

        await askLlmBot(
            'Translate it to Scriptish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        expect(askList).toEqual([]);
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['translate']);
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toBe(
            `Tool refused: The words of ${NAME} are in Scriptish already, so ` +
                'a translation added after it would be the study again. ' +
                'Nothing was drafted. Tell them so in a sentence, and offer to ' +
                'put what is not in Scriptish yet into it in its place (place ' +
                '"replace").',
        );
    });
});

// The tool host, its draft answering with the file as drafted (EC-600): the
// study as written with what was appended after it, the whole text a change
// was drafted as, or a new copy's words.
function useHeldDraftHost() {
    useToolHost();
    const answerPlanned = fake.answerTool;
    const original = genPlan(null)
        .parts.map((part) => {
            return part.text;
        })
        .join('\n');
    fake.answerTool = (name, args) => {
        if (args?.action !== 'draft') {
            return answerPlanned === null ? '' : answerPlanned(name, args);
        }
        const isChange = typeof args.file === 'string';
        return JSON.stringify({
            drafted: true,
            isChange,
            name: NAME,
            ...(isChange ? { file: args.file, hash: 'h-1' } : {}),
            passage: 'John 3',
            bible: '',
            diagramCount: 1,
            change: 'adds a translation at its end',
            content:
                typeof args.append === 'string'
                    ? `${original}\n\n${args.append}\n`
                    : args.content,
        });
    };
}

// The tool host, its draft of a NEW study composed as the app composes one
// (EC-604): the title, the passage quoted under it, the words, the app's
// last lines -- what a held new study is drafted again from.
function useComposingDraftHost() {
    useHeldDraftHost();
    const answerHeld = fake.answerTool;
    fake.answerTool = (name, args) => {
        if (args?.action !== 'draft' || typeof args.file === 'string') {
            return answerHeld === null ? '' : answerHeld(name, args);
        }
        const content = composeStudyFile({
            title: args.title,
            passage: {
                title: 'John 3',
                bibleKey: 'XB',
                verses: [{ number: '3', text: 'Unless one is born again.' }],
            },
            isPassageCut: false,
            body: separateStudyLines(toStudyBody(String(args.content))),
            footnote: 'Drafted by the assistant.',
        });
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
    };
}

// Every word in Scriptish but "with", left as it was on both tries.
function toScriptishKeepingWith(ask: string) {
    return checkIsDiagramAsk(ask)
        ? toScriptishDiagram(ask)
        : toScriptish(readAskedSource(ask), 'with');
}

const SCRIPTISH_TITLE = toScriptish('The New Birth');
// The copy a translation of its own is drafted as (EC-604).
const NEW_COPY_NAME = `JHN.3.${SCRIPTISH_TITLE}.md`;

describe('what a translation still leaves once each part was asked twice (EC-600)', () => {
    test('is told to the model, which puts it right in ONE replace drafted onto the change the card holds', async () => {
        useHeldDraftHost();
        const { askList, translateText } = useTranslator(
            toScriptishKeepingWith,
        );
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'append' }),
            ),
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: FILE,
                    section: SCRIPTISH_TITLE,
                    replace: [{ from: 'with', to: toScriptish('with') }],
                },
            }),
            anthropicText('Translated, and "with" put right in it.'),
        ]);

        const answer = await askLlmBot(
            'Translate the study to Scriptish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        // The first part asked twice, "with" left both times.
        expect(askList).toHaveLength(4);
        const [seen] = readToolResults(sentList[1]);
        const left = seen.indexOf('(What it still leaves');
        expect(left).toBeGreaterThan(0);
        expect(seen.indexOf('[held by the window:')).toBeGreaterThan(left);
        expect(seen).toContain(
            `The translation "${SCRIPTISH_TITLE}":\n` +
                'English words left between its own:\n' +
                `- "with", written once in “${SCRIPTISH_TITLE}”.`,
        );
        expect(seen).toContain(
            'Put right now, in ONE call before you answer, the English words',
        );
        expect(seen).toContain('never that every word is in Scriptish');

        // The replace is drafted onto the translation held, its section
        // keeping the English half's own "with" as it was.
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['translate', 'draft', 'draft']);
        const chained = fake.toolCallList[2].args;
        expect(chained.file).toBe(FILE);
        expect(chained.replace).toBeUndefined();
        expect(chained.content).toContain('A night talk with a teacher.');
        expect(chained.content).toContain(
            `${toScriptish('A night talk')} ${toScriptish('with')} ` +
                `${toScriptish('a teacher')}.`,
        );
        const [chainedSeen] = readToolResults(sentList[2]);
        expect(chainedSeen).toContain('[held by the window:');
        expect(chainedSeen).not.toContain('What it still leaves');
        expect(
            answer.actions?.map((action) => {
                return [action.label, action.toolName];
            }),
        ).toEqual([
            [`Save changes to "${NAME}"`, STUDY_CREATE_TOOL_NAME],
            ['Preview', STUDY_PREVIEW_TOOL_NAME],
        ]);
    });

    test('a new copy is put right in the same card: the replace naming it is drafted again as a new study (EC-604)', async () => {
        useComposingDraftHost();
        const { translateText } = useTranslator(toScriptishKeepingWith);
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'new' }),
            ),
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: NEW_COPY_NAME,
                    replace: [{ from: 'with', to: toScriptish('with') }],
                },
            }),
            anthropicText('Translated into a copy of its own, "with" too.'),
        ]);

        const answer = await askLlmBot(
            'Translate the study to Scriptish as a new file',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain(
            `- "with", written once in “${SCRIPTISH_TITLE}”.`,
        );
        expect(seen).toContain(
            `owa_resource_file \`draft\` with \`file\` "${NEW_COPY_NAME}" ` +
                '-- the new study the card holds -- and `replace`',
        );
        expect(seen).not.toContain('Once they press Create');
        // Drafted again as a NEW study -- its passage, its title, its words
        // with the pair written -- never sent as a file that is not saved.
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['translate', 'draft', 'draft']);
        const redrafted = fake.toolCallList[2].args;
        expect(redrafted).toEqual({
            action: 'draft',
            ref: 'JHN 3',
            title: SCRIPTISH_TITLE,
            content: expect.stringContaining(
                `${toScriptish('A night talk')} ${toScriptish('with')} ` +
                    `${toScriptish('a teacher')}.`,
            ),
            bible: 'XB',
        });
        expect(redrafted.content).not.toContain('> **John 3**');
        const [chainedSeen] = readToolResults(sentList[2]);
        expect(chainedSeen).toContain('[held by the window:');
        expect(JSON.parse(chainedSeen).change).toBe(
            'Changed in the new study the card holds, which is still not ' +
                `saved: It writes “${toScriptish('with')}” for “with” (1 ` +
                'place); nothing else changes.',
        );
        expect(JSON.parse(chainedSeen).note).toContain('Nothing is saved yet.');
        // One card, a new study's, holding the copy put right.
        const labelList = (answer.actions ?? []).map((action) => {
            return action.label;
        });
        expect(labelList).toContain(`Create "${NEW_COPY_NAME}" in Resources`);
        expect(
            labelList.some((label) => {
                return label.startsWith('Save changes');
            }),
        ).toBe(false);
        const held = takeDraftedStudy(
            answer.actions?.[0]?.args?.reference ?? '',
        );
        expect(held?.content).toContain(
            `${toScriptish('A night talk')} ${toScriptish('with')} ` +
                `${toScriptish('a teacher')}.`,
        );
        expect(held?.content).toContain(
            `# ${SCRIPTISH_TITLE}\n\n> **John 3** (XB)\n>\n> **3** Unless one ` +
                'is born again.',
        );
    });

    test('a pair that breaks a diagram of the copy is refused, and the card keeps it as it was (EC-604)', async () => {
        useComposingDraftHost();
        fake.isDiagramBroken = (source) => {
            return source.includes('Broken');
        };
        const { translateText } = useTranslator(toScriptishKeepingWith);
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'new' }),
            ),
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: NEW_COPY_NAME,
                    replace: [{ from: toScriptish('Light'), to: 'Broken' }],
                },
            }),
            anthropicText('Translated into a copy of its own.'),
        ]);

        const answer = await askLlmBot(
            'Translate the study to Scriptish as a new file',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        const [refused] = readToolResults(sentList[2]);
        expect(refused).toMatch(
            /^Tool refused: Diagram 1 of the file would not draw with these words in it: Parse error on line 2 Nothing is changed/,
        );
        const held = takeDraftedStudy(
            answer.actions?.[0]?.args?.reference ?? '',
        );
        expect(held?.content).toContain(`"${toScriptish('Light')}"`);
        expect(held?.content).not.toContain('Broken');
    });

    test('a part of the copy the model was never shown is handed to it first, then changed (EC-604)', async () => {
        useComposingDraftHost();
        const { translateText } = useTranslator(toScriptishKeepingWith);
        const settingHeading = `## ${toScriptish('The Setting')}`;
        const partCall = {
            name: 'owa_resource_file',
            input: {
                action: 'draft',
                file: NEW_COPY_NAME,
                section: toScriptish('The Setting'),
                content: `${settingHeading}\n${toScriptish('Nicodemus came')}.`,
            },
        };
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'new' }),
            ),
            anthropicToolUse(partCall),
            anthropicToolUse(partCall),
            anthropicText('Translated, its setting shorter.'),
        ]);

        const answer = await askLlmBot(
            'Translate the study to Scriptish as a new file',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        // The first is sent back with the part's own words, read off the
        // card's copy -- no read of a file that is not saved.
        const [first] = readToolResults(sentList[2]);
        expect(first).toContain(
            `The part “${toScriptish('The Setting')}” is in nothing you ` +
                `were shown of "${NEW_COPY_NAME}"`,
        );
        expect(first).toContain(`"section":"${toScriptish('The Setting')}"`);
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['translate', 'draft', 'draft']);
        const [second] = readToolResults(sentList[3]);
        expect(JSON.parse(second).change).toContain(
            'Changed in the new study the card holds, which is still not ' +
                'saved:',
        );
        const held = takeDraftedStudy(
            answer.actions?.[0]?.args?.reference ?? '',
        );
        // The part as the model wrote it, every other part as it was.
        expect(held?.content).toContain(
            `${settingHeading}\n${toScriptish('Nicodemus came')}.`,
        );
        expect(held?.content).not.toContain(toScriptish('by night'));
        expect(held?.content).toContain(
            `${toScriptish('A night talk')} with ${toScriptish('a teacher')}.`,
        );
    });

    test.each([
        { title: 'named by its file', named: { file: NEW_COPY_NAME } },
        // With no study open, a part naming no file is the copy's.
        { title: 'naming no file', named: {} },
    ])(
        'a report of a change sent as words of the copy, $title, is refused with its headings, as a saved study’s is (EC-505, EC-604)',
        async ({ named }) => {
            useComposingDraftHost();
            const { translateText } = useTranslator(toScriptishKeepingWith);
            const { sentList } = useAnthropic([
                anthropicToolUse(
                    translateCall({ language: 'Scriptish', place: 'new' }),
                ),
                anthropicToolUse({
                    name: 'owa_resource_file',
                    input: {
                        action: 'draft',
                        ...named,
                        append: 'I have fixed the English word left in the study file.',
                    },
                }),
                anthropicText('Translated into a copy of its own.'),
            ]);

            const answer = await askLlmBot(
                'Translate the study to Scriptish as a new file',
                'reader',
                'anthropic',
                'claude-sonnet-5',
                [],
                null,
                { translateText },
            );

            const [refused] = readToolResults(sentList[2]);
            expect(refused).toMatch(
                /^Tool refused: These words say what was done to the study \(“I have fixed the English word left in the study file\.”\)/,
            );
            // Its headings are the card's copy's -- no read of a file that
            // is not saved -- and nothing is drafted again.
            expect(refused).toContain(
                `# ${SCRIPTISH_TITLE}\n## ${toScriptish('The Setting')}`,
            );
            expect(
                fake.toolCallList.map((call) => {
                    return call.args?.action;
                }),
            ).toEqual(['translate', 'draft']);
            const held = takeDraftedStudy(
                answer.actions?.[0]?.args?.reference ?? '',
            );
            expect(held?.content).toContain(`# ${SCRIPTISH_TITLE}`);
            expect(held?.content).not.toContain('I have fixed');
        },
    );

    test('says nothing when the translation leaves nothing', async () => {
        useHeldDraftHost();
        const { translateText } = useTranslator((ask) => {
            return checkIsDiagramAsk(ask)
                ? toScriptishDiagram(ask)
                : toScriptish(readAskedSource(ask));
        });
        const { sentList } = useAnthropic([
            anthropicToolUse(
                translateCall({ language: 'Scriptish', place: 'append' }),
            ),
            anthropicText('Translated.'),
        ]);

        await askLlmBot(
            'Translate the study to Scriptish and add it under',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            { translateText },
        );

        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain('[held by the window:');
        expect(seen).not.toContain('What it still leaves');
    });
});

const EARLIER_NAME = 'JHN.3.Born Again.md';
const EARLIER_BODY =
    '## The Setting\n\nNicodemus came by night.\n\n## Prayer\n\nLord, teach us.';

// A new study an EARLIER answer drafted, held under that answer's card
// (EC-606): composed as the app composes one, as `useComposingDraftHost`
// drafts it again.
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
        content: composeStudyFile({
            title: 'Born Again',
            passage: {
                title: 'John 3',
                bibleKey: 'XB',
                verses: [{ number: '3', text: 'Unless one is born again.' }],
            },
            isPassageCut: false,
            body: EARLIER_BODY,
            footnote: 'Drafted by the assistant.',
        }),
        raw: {
            ref: 'John 3',
            title: 'Born Again',
            content: EARLIER_BODY,
            bible: null,
        },
    });
}

// The app's plan of a new study's held words (EC-609): handed `name` and
// `content` and no `file`, it splits the words as the worker does -- no
// passage quoted again, no Bible being in that language.
function usePlanOfHeldWords() {
    const answerHeld = fake.answerTool;
    fake.answerTool = (name, args) => {
        if (args?.action !== 'translate' || typeof args.content !== 'string') {
            return answerHeld === null ? '' : answerHeld(name, args);
        }
        const { body, footer } = splitStudyFooter(args.content);
        const { original, translations } = splitStudyTranslations(body);
        return JSON.stringify({
            translating: true,
            file: '',
            name: args.name,
            hash: 'h-held',
            title: 'Born Again',
            ref: 'JHN 3',
            bible: null,
            parts: splitStudyForTranslation(original).map((part) => {
                return { kind: part.kind, text: part.text, quoted: null };
            }),
            translations,
            footer,
            note: 'Translate each part.',
        });
    };
}

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function askUnderEarlierCard(question: string, extra: any) {
    return askLlmBot(
        question,
        'reader',
        'anthropic',
        'claude-sonnet-5',
        [],
        null,
        extra,
    );
}

function readOfferedTools(sent: any): string[] {
    return (sent.tools ?? []).map((tool: any) => {
        return tool.name;
    });
}

function readAsked(sent: any): string {
    const content = sent.messages.at(-1).content;
    return typeof content === 'string' ? content : JSON.stringify(content);
}

describe('a new study the card above holds, asked of in a later question (EC-606)', () => {
    beforeEach(() => {
        useComposingDraftHost();
        fake.toolList = [
            { name: 'owa_help_search' },
            { name: 'owa_resource_file' },
        ];
    });

    test('an ordinary ask is offered the study tool and told of it, and a word changed is drafted again into a new card', async () => {
        const earlier = holdEarlierStudy();
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: EARLIER_NAME,
                    replace: [{ from: 'by night', to: 'after dark' }],
                },
            }),
            anthropicText('Changed: it says after dark now.'),
        ]);

        const answer = await askUnderEarlierCard('Make it say after dark', {
            heldStudy: earlier,
        });

        expect(readOfferedTools(sentList[0])).toEqual([
            'owa_help_search',
            'owa_resource_file',
        ]);
        const asked = readAsked(sentList[0]);
        expect(asked).toContain(
            '(The card under your last answer holds a NEW study file, not ' +
                `saved yet: "${EARLIER_NAME}", on John 3. When they ask to ` +
                'change it, call owa_resource_file draft with this `file`',
        );
        expect(asked).toContain(
            'Its headings:\n# Born Again\n## The Setting\n## Prayer)',
        );
        // Drafted again as a NEW study, never sent as a file that is not
        // saved.
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_resource_file',
                args: {
                    action: 'draft',
                    ref: 'John 3',
                    title: 'Born Again',
                    content: EARLIER_BODY.replace('by night', 'after dark'),
                    bible: 'XB',
                },
            },
        ]);
        const [seen] = readToolResults(sentList[1]);
        expect(JSON.parse(seen).change).toBe(
            'Changed in the new study the card holds, which is still not ' +
                'saved: It writes “after dark” for “by night” (1 place); ' +
                'nothing else changes.',
        );
        // A card of its own holds the change; the one above keeps its words.
        const reference = answer.actions?.[0]?.args?.reference ?? '';
        expect(reference).not.toBe(earlier.reference);
        expect(takeDraftedStudy(reference)?.content).toContain(
            'Nicodemus came after dark.',
        );
        expect(takeDraftedStudy(earlier.reference)?.content).toContain(
            'Nicodemus came by night.',
        );
        expect(
            (answer.actions ?? []).map((action) => {
                return action.label;
            }),
        ).toContain(`Create "${EARLIER_NAME}" in Resources`);
    });

    test('a read of it is answered off its words, and its card comes back', async () => {
        const earlier = holdEarlierStudy();
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'read',
                    file: EARLIER_NAME,
                    section: 'Prayer',
                },
            }),
            anthropicText('Its prayer asks the Lord to teach us.'),
        ]);

        const answer = await askUnderEarlierCard('What does its prayer say?', {
            heldStudy: earlier,
        });

        const [read] = readToolResults(sentList[1]);
        expect(JSON.parse(read)).toEqual({
            file: EARLIER_NAME,
            kind: 'text',
            section: 'Prayer',
            text: '## Prayer\n\nLord, teach us.',
            held: expect.stringContaining('Not saved yet'),
        });
        expect(fake.toolCallList).toEqual([]);
        expect(answer.actions).toEqual(genStudyDraftActions(earlier));
    });

    test('a part it was never shown is handed back with its words first, then changed', async () => {
        const earlier = holdEarlierStudy();
        const partCall = {
            name: 'owa_resource_file',
            input: {
                action: 'draft',
                file: EARLIER_NAME,
                section: 'The Setting',
                content: '## The Setting\n\nNicodemus came to Jesus.',
            },
        };
        const { sentList } = useAnthropic([
            anthropicToolUse(partCall),
            anthropicToolUse(partCall),
            anthropicText('Its setting says he came to Jesus now.'),
        ]);

        const answer = await askUnderEarlierCard('Rewrite its setting', {
            heldStudy: earlier,
        });

        const [first] = readToolResults(sentList[1]);
        expect(first).toContain(
            'The part “The Setting” is in nothing you were shown of ' +
                `"${EARLIER_NAME}"`,
        );
        expect(first).toContain('Nicodemus came by night.');
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['draft']);
        const [second] = readToolResults(sentList[2]);
        expect(JSON.parse(second).change).toContain(
            'Changed in the new study the card holds, which is still not ' +
                'saved:',
        );
        const held = takeDraftedStudy(
            answer.actions?.[0]?.args?.reference ?? '',
        );
        expect(held?.content).toContain(
            '## The Setting\n\nNicodemus came to Jesus.',
        );
        expect(held?.content).toContain('## Prayer\n\nLord, teach us.');
        expect(held?.content).not.toContain('by night');
    });

    test('a translation of it is made from its held words, into a new card holding the study and its translation (EC-609)', async () => {
        const earlier = holdEarlierStudy();
        usePlanOfHeldWords();
        const { translateText } = useTranslator((ask) => {
            return toScriptish(readAskedSource(ask));
        });
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'translate',
                    file: EARLIER_NAME,
                    language: 'Scriptish',
                    place: 'append',
                },
            }),
            anthropicText('The card under this answer holds both.'),
        ]);

        const answer = await askUnderEarlierCard(
            'Translate it to Scriptish and add it under',
            { heldStudy: earlier, translateText },
        );

        // Planned from its held words, by its name: no file is read.
        expect(fake.toolCallList[0]).toEqual({
            name: 'owa_resource_file',
            args: {
                action: 'translate',
                name: EARLIER_NAME,
                content: earlier.content,
            },
        });
        expect(translateText).toHaveBeenCalled();
        // Drafted as a NEW study -- its own passage, title and Bible, the
        // translation after its words -- never as a change to a file.
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['translate', 'draft']);
        const drafted = fake.toolCallList[1].args;
        expect(drafted).toEqual({
            action: 'draft',
            ref: 'John 3',
            title: 'Born Again',
            content: expect.stringMatching(
                new RegExp(
                    `^${escapeRegExp(EARLIER_BODY)}\\n\\n---\\n\\n# ` +
                        escapeRegExp(toScriptish('Born Again')),
                ),
            ),
            bible: 'XB',
        });
        expect(drafted.content).toContain(
            `## ${toScriptish('The Setting')}\n\n` +
                `${toScriptish('Nicodemus came by night')}.`,
        );
        // The passage no Bible in that language quotes, as it was.
        expect(drafted.content).toContain(
            '> **John 3** (XB)\n>\n> **3** Unless one is born again.',
        );
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain(
            `"${EARLIER_NAME}" is a new study not saved yet, so no file ` +
                'changed: the card under your answer holds it again as a new ' +
                'study, its translation after it. Nothing is kept until ' +
                'they press Create.',
        );
        expect(seen).toContain('[held by the window:');
        // A card of its own holds both; the one above keeps its words.
        const reference = answer.actions?.[0]?.args?.reference ?? '';
        expect(reference).not.toBe(earlier.reference);
        const held = takeDraftedStudy(reference);
        expect(held?.content).toContain('Nicodemus came by night.');
        expect(held?.content).toContain(
            `${toScriptish('Nicodemus came by night')}.`,
        );
        expect(held?.isWindowMade).toBe(true);
        expect(takeDraftedStudy(earlier.reference)?.content).not.toContain(
            toScriptish('Nicodemus'),
        );
        expect(
            (answer.actions ?? []).map((action) => {
                return action.label;
            }),
        ).toContain(`Create "${EARLIER_NAME}" in Resources`);
    });

    test('kept as a Markdown file, the translated study is kept as one too (EC-609)', async () => {
        const earlier = { ...holdEarlierStudy(), isMarkdownOnly: true };
        usePlanOfHeldWords();
        const { translateText } = useTranslator((ask) => {
            return toScriptish(readAskedSource(ask));
        });
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'translate',
                    language: 'Scriptish',
                    place: 'replace',
                },
            }),
            anthropicText('The card holds it in Scriptish.'),
        ]);

        const answer = await askUnderEarlierCard('Make it all Scriptish', {
            heldStudy: earlier,
            translateText,
        });

        expect(fake.toolCallList[1].args).toMatchObject({
            action: 'draft',
            ref: 'John 3',
            title: toScriptish('Born Again'),
            bible: 'XB',
        });
        const [seen] = readToolResults(sentList[1]);
        expect(seen).toContain('translated in place of its words');
        expect(JSON.parse(seen.slice(seen.lastIndexOf('\n{'))).note).toBe(
            STUDY_HELD_MARKDOWN_NOTE,
        );
        const labelList = (answer.actions ?? []).map((action) => {
            return action.label;
        });
        expect(labelList).toContain(
            `Create "JHN.3.${toScriptish('Born Again')}.md" in Resources`,
        );
        expect(labelList).not.toContain('New Bible Note');
    });

    test('a copy of a study drafted in the same answer is refused before any part is translated (EC-609)', async () => {
        const { translateText } = useTranslator();
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    ref: 'John 3',
                    title: 'Born Again',
                    content: EARLIER_BODY,
                },
            }),
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'translate',
                    file: EARLIER_NAME,
                    language: 'Scriptish',
                    place: 'new',
                },
            }),
            anthropicText('Here is the study; press Create, then ask again.'),
        ]);

        const answer = await askUnderEarlierCard(
            'Make a study of John 3 and a Scriptish copy of it',
            { translateText },
        );

        const [refused] = readToolResults(sentList[2]);
        expect(refused).toBe(
            `Tool refused: "${EARLIER_NAME}" was drafted in this answer and ` +
                'is not saved yet, and an answer holds one card: a copy of ' +
                'its own would take the study out. Translate it with place ' +
                '"append" -- one new study holding both -- or "replace", or ' +
                'tell them to press Create first and then ask for the copy.',
        );
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['draft']);
        expect(translateText).not.toHaveBeenCalled();
        // The study's own card stays under the answer.
        expect(
            takeDraftedStudy(answer.actions?.[0]?.args?.reference ?? '')
                ?.content,
        ).toContain('Nicodemus came by night.');
    });

    test('a translation that drafts nothing brings its card back', async () => {
        const earlier = holdEarlierStudy();
        usePlanOfHeldWords();
        // The words given back as they were, twice: the job stops.
        const { translateText } = useTranslator(readAskedSource);
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'translate',
                    file: EARLIER_NAME,
                    language: 'Scriptish',
                    place: 'append',
                },
            }),
            anthropicText('The translation stopped; nothing was drafted.'),
        ]);

        const answer = await askUnderEarlierCard('Translate it to Scriptish', {
            heldStudy: earlier,
            translateText,
        });

        const [refused] = readToolResults(sentList[1]);
        expect(refused).toMatch(
            new RegExp(
                `^Tool refused: The translation of ${escapeRegExp(EARLIER_NAME)} ` +
                    'into Scriptish stopped at part 1 of',
            ),
        );
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['translate']);
        expect(answer.actions).toEqual(genStudyDraftActions(earlier));
    });

    test.each([
        { title: 'no card above', extra: () => ({}) },
        {
            title: 'a change to a saved file above',
            extra: () => ({
                heldStudy: {
                    ...holdEarlierStudy(),
                    isChange: true,
                    file: `Default/${EARLIER_NAME}`,
                },
            }),
        },
    ])(
        'with $title, an ordinary ask is offered no study tool and told nothing of one',
        async ({ extra }) => {
            const { sentList } = useAnthropic([anthropicText('Hello.')]);

            const answer = await askUnderEarlierCard(
                'Make it say after dark',
                extra(),
            );

            expect(readOfferedTools(sentList[0])).toEqual(['owa_help_search']);
            expect(readAsked(sentList[0])).not.toContain(
                'The card under your last answer',
            );
            expect(
                (answer.actions ?? []).some((action) => {
                    return action.toolName === STUDY_CREATE_TOOL_NAME;
                }),
            ).toBe(false);
        },
    );
});

// EC-700 (2026-11-14): a change to the new study the card above holds,
// claimed in words with no draft made -- the slip EC-606 left open: the
// card keeps the words it had, and Create would keep them. Handed back
// once; claimed again, the answer is marked, and either way its card comes
// back under the answer, so the next line reaches it.
describe('a change to the new study the card above holds, claimed and never made (EC-700)', () => {
    beforeEach(() => {
        useComposingDraftHost();
        fake.toolList = [
            { name: 'owa_help_search' },
            { name: 'owa_resource_file' },
        ];
    });

    function readNudge(sent: any) {
        const last = sent.messages[sent.messages.length - 1];
        expect(last.role).toBe('user');
        return String(last.content);
    }

    test('handed back once, then drafted into a card of its own', async () => {
        const earlier = holdEarlierStudy();
        const { sentList } = useAnthropic([
            anthropicText("I've changed it: it says after dark now."),
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: EARLIER_NAME,
                    replace: [{ from: 'by night', to: 'after dark' }],
                },
            }),
            anthropicText('Changed: it says after dark now.'),
        ]);

        const answer = await askUnderEarlierCard('Make it say after dark', {
            heldStudy: earlier,
        });

        expect(sentList).toHaveLength(3);
        const nudge = readNudge(sentList[1]);
        expect(nudge).toMatch(
            new RegExp(
                `^Not yet: nothing in "${escapeRegExp(EARLIER_NAME)}" changed`,
            ),
        );
        expect(nudge).toContain(`\`file\` "${EARLIER_NAME}"`);
        expect(
            fake.toolCallList.map((call) => {
                return call.args?.action;
            }),
        ).toEqual(['draft']);
        expect(answer.isChangeUnmade).toBeUndefined();
        const reference = answer.actions?.[0]?.args?.reference ?? '';
        expect(reference).not.toBe(earlier.reference);
        expect(takeDraftedStudy(reference)?.content).toContain(
            'Nicodemus came after dark.',
        );
    });

    test('claimed again after the hand-back: marked, and its card comes back', async () => {
        const earlier = holdEarlierStudy();
        const { sentList } = useAnthropic([
            anthropicText("I've changed it: it says after dark now."),
            anthropicText('I have updated the study: it says after dark.'),
        ]);

        const answer = await askUnderEarlierCard('Make it say after dark', {
            heldStudy: earlier,
        });

        expect(sentList).toHaveLength(2);
        expect(fake.toolCallList).toEqual([]);
        expect(answer.text).toBe(
            'I have updated the study: it says after dark.',
        );
        expect(answer.isChangeUnmade).toBe(true);
        expect(answer.actions).toEqual(genStudyDraftActions(earlier));
        expect(takeDraftedStudy(earlier.reference)?.content).toContain(
            'Nicodemus came by night.',
        );
    });

    test('"not saved yet", the truth of such a study, is never handed back', async () => {
        const earlier = holdEarlierStudy();
        const { sentList } = useAnthropic([
            anthropicText(
                'It is not saved yet: press Create under the card to keep it.',
            ),
        ]);

        const answer = await askUnderEarlierCard('Is it saved?', {
            heldStudy: earlier,
        });

        expect(sentList).toHaveLength(1);
        expect(answer.isChangeUnmade).toBeUndefined();
    });

    test('with no card above, the same words are left alone', async () => {
        const { sentList } = useAnthropic([
            anthropicText("I've changed it: it says after dark now."),
        ]);

        const answer = await askUnderEarlierCard('Make it say after dark', {});

        expect(sentList).toHaveLength(1);
        expect(answer.isChangeUnmade).toBeUndefined();
    });
});

// EC-703 (2026-11-14): told on the ask alone that a question about the
// passage is the study's, gemma4:cloud still sent "what does the word
// begotten mean in this verse?" to /btw once of twice under the card.
describe('a question about the passage of the study the card above holds (EC-703)', () => {
    const BTW_ADVICE =
        'The guide covers this app only. To ask a general question like ' +
        'this, please type `/btw` before your question.';
    const MEANING =
        'Born again means a new start that God gives: a life from above.';

    beforeEach(() => {
        useComposingDraftHost();
        fake.toolList = [
            { name: 'owa_help_search' },
            { name: 'owa_resource_file' },
        ];
    });

    test('sent to /btw, it is handed back once and answered in plain words', async () => {
        const earlier = holdEarlierStudy();
        const { sentList } = useAnthropic([
            anthropicText(BTW_ADVICE),
            anthropicText(MEANING),
        ]);

        const answer = await askUnderEarlierCard('What does born again mean?', {
            heldStudy: earlier,
        });

        expect(sentList).toHaveLength(2);
        const last = sentList[1].messages.at(-1);
        expect(last.role).toBe('user');
        const nudge = String(last.content);
        expect(nudge).toMatch(
            /^Not yet: that question is about the passage of the new study/,
        );
        expect(nudge).toContain(`\`file\` "${EARLIER_NAME}"`);
        expect(answer.text).toBe(MEANING);
        // Nothing changed for a question, and no card comes back under it:
        // a plain answer, so "add that to the study" next still reaches the
        // card above and keeps this answer (EC-701).
        expect(fake.toolCallList).toEqual([]);
        expect(answer.actions ?? []).toEqual([]);
    });

    test('sent to /btw again after the hand-back, that answer stands', async () => {
        const earlier = holdEarlierStudy();
        const { sentList } = useAnthropic([
            anthropicText(BTW_ADVICE),
            anthropicText(BTW_ADVICE),
        ]);

        const answer = await askUnderEarlierCard('What does born again mean?', {
            heldStudy: earlier,
        });

        expect(sentList).toHaveLength(2);
        expect(answer.text).toBe(BTW_ADVICE);
    });

    test('with no card above, or in a general question, it is left alone', async () => {
        const { sentList } = useAnthropic([anthropicText(BTW_ADVICE)]);

        const answer = await askUnderEarlierCard(
            'What does born again mean?',
            {},
        );

        expect(sentList).toHaveLength(1);
        expect(answer.text).toBe(BTW_ADVICE);
        const general = useAnthropic([anthropicText(BTW_ADVICE)]);
        await askUnderEarlierCard('What does born again mean?', {
            heldStudy: holdEarlierStudy(),
            isGeneral: true,
        });
        expect(general.sentList).toHaveLength(1);
    });
});

// EC-701: under a card holding a new study, "what does verse 3 mean?" was
// answered in words -- and that ended the chain, so "add that to the study"
// after it reached no study, and a kept answer naming the study was sent
// on as a file that is not saved.
describe('a new study the card holds, a question answered in between (EC-701)', () => {
    const EXPLAINED =
        'Born again means a new start that God gives: not a second birth ' +
        'of the body, but a life from above, by water and the Spirit.';

    beforeEach(() => {
        useComposingDraftHost();
        fake.toolList = [
            { name: 'owa_help_search' },
            { name: 'owa_resource_file' },
        ];
    });

    test('"add that to the study": the answer goes into the held study, a card of its own', async () => {
        const earlier = holdEarlierStudy();
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: EARLIER_NAME,
                    append: '@answer',
                },
            }),
            anthropicText('Added: press Create to keep it.'),
        ]);

        const answer = await askUnderEarlierCard('Add that to the study', {
            heldStudy: { ...earlier, answersBetween: 1 },
            answerAbove: EXPLAINED,
            keepAnswer: true,
        });

        const asked = readAsked(sentList[0]);
        expect(asked).toContain(
            '(A card further up this chat, above your last answer, still ' +
                `holds a NEW study file, not saved yet: "${EARLIER_NAME}"`,
        );
        expect(asked).toContain(
            '(To add that answer to the new study the card above holds ' +
                'instead, call owa_resource_file draft with `file` ' +
                `"${EARLIER_NAME}" and \`append\` "@answer".)`,
        );
        // Drafted again as a NEW study with the answer at its end -- never
        // sent as a file that is not saved.
        expect(fake.toolCallList).toEqual([
            {
                name: 'owa_resource_file',
                args: {
                    action: 'draft',
                    ref: 'John 3',
                    title: 'Born Again',
                    content: expect.stringContaining(EXPLAINED),
                    bible: 'XB',
                },
            },
        ]);
        expect(fake.toolCallList[0].args.content).toMatch(
            /^## The Setting\n\nNicodemus came by night\.\n\n## Prayer\n\nLord, teach us\./,
        );
        const shown = JSON.parse(readToolResults(sentList[1])[0]);
        expect(shown.note).toBe(STUDY_KEPT_ANSWER_HELD_NOTE);
        expect(shown.content).toMatch(
            /^\[held by the window: \d+ characters\]$/,
        );
        // A card of its own holds it; the one above keeps its words.
        const reference = answer.actions?.[0]?.args?.reference ?? '';
        expect(reference).not.toBe(earlier.reference);
        expect(takeDraftedStudy(reference)?.content).toContain(EXPLAINED);
        expect(takeDraftedStudy(reference)?.content).toContain(
            'Nicodemus came by night.',
        );
        expect(takeDraftedStudy(earlier.reference)?.content).not.toContain(
            EXPLAINED,
        );
        expect(
            (answer.actions ?? []).map((action) => {
                return action.label;
            }),
        ).toContain(`Create "${EARLIER_NAME}" in Resources`);
    });

    // EC-704: seen live, the answer added this way read as one more
    // paragraph of the study's last part.
    test('"add that to the study": the answer goes in under the question it answered', async () => {
        const earlier = holdEarlierStudy();
        useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: EARLIER_NAME,
                    append: '@answer',
                },
            }),
            anthropicText('Added: press Create to keep it.'),
        ]);

        const answer = await askUnderEarlierCard('Add that to the study', {
            heldStudy: { ...earlier, answersBetween: 1 },
            answerAbove: EXPLAINED,
            answerAboveQuestion: 'what does born again mean?',
            keepAnswer: true,
        });

        const headed = `## What does born again mean?\n\n${EXPLAINED}`;
        expect(fake.toolCallList[0].args.content).toContain(
            `Lord, teach us.\n\n${headed}`,
        );
        const reference = answer.actions?.[0]?.args?.reference ?? '';
        expect(takeDraftedStudy(reference)?.content).toContain(headed);
    });

    test('"save that as a study file" is still a study of its own, the held one left as it was', async () => {
        const earlier = holdEarlierStudy();
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    ref: 'John 3:3',
                    title: 'A New Start',
                    content: '@answer',
                },
            }),
            anthropicText('Ready: press Create to keep it.'),
        ]);

        const answer = await askUnderEarlierCard('Save that as a study file', {
            heldStudy: { ...earlier, answersBetween: 1 },
            answerAbove: EXPLAINED,
            keepAnswer: true,
        });

        expect(fake.toolCallList).toHaveLength(1);
        expect(fake.toolCallList[0].args).toMatchObject({
            action: 'draft',
            title: 'A New Start',
            content: EXPLAINED,
        });
        expect(JSON.parse(readToolResults(sentList[1])[0]).note).toBe(
            STUDY_KEPT_ANSWER_NOTE,
        );
        const reference = answer.actions?.[0]?.args?.reference ?? '';
        expect(takeDraftedStudy(reference)?.content).not.toContain(
            'Nicodemus came by night.',
        );
        expect(takeDraftedStudy(earlier.reference)?.content).not.toContain(
            EXPLAINED,
        );
    });

    test('a change asked after it reaches the study, told the card is further up', async () => {
        const earlier = holdEarlierStudy();
        const { sentList } = useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: {
                    action: 'draft',
                    file: EARLIER_NAME,
                    replace: [{ from: 'by night', to: 'after dark' }],
                },
            }),
            anthropicText('Changed: it says after dark now.'),
        ]);

        const answer = await askUnderEarlierCard('Make it say after dark', {
            heldStudy: { ...earlier, answersBetween: 2 },
        });

        const asked = readAsked(sentList[0]);
        expect(asked).toContain('(A card further up this chat');
        // No answer kept: no word of keeping one.
        expect(asked).not.toContain('To add that answer');
        expect(fake.toolCallList[0].args.content).toBe(
            EARLIER_BODY.replace('by night', 'after dark'),
        );
        expect(
            takeDraftedStudy(answer.actions?.[0]?.args?.reference ?? '')
                ?.content,
        ).toContain('Nicodemus came after dark.');
    });
});

// EC-706: the user's Psalm 100 study, attached from Bible Notes, a copy of
// the same name in Resources → Default, and GPT-5 naming it by its file name
// alone: the Default copy was translated and saved, twice, and every ask
// after it was told the study was all Khmer already.
describe('a study named by its file name alone, in a tab with it open (EC-706)', () => {
    const OPEN = `Bible Notes/${NAME}`;

    test('translate and read reach the study the tab has open, never its copy in Default', async () => {
        useToolHost();
        const { translateText } = useTranslator();
        useAnthropic([
            anthropicToolUse({
                name: 'owa_resource_file',
                input: { action: 'read', file: NAME },
            }),
            anthropicToolUse(
                translateCall({
                    file: NAME,
                    language: 'Testish',
                    place: 'replace',
                }),
            ),
            anthropicText('Translated.'),
        ]);

        await askLlmBot(
            'Translate it into Testish',
            'reader',
            'anthropic',
            'claude-sonnet-5',
            [],
            null,
            {
                translateText,
                resources: { canSeePictures: false, openFiles: [OPEN] },
            },
        );

        const studyCallList = fake.toolCallList.filter((call) => {
            return call.name === 'owa_resource_file';
        });
        expect(
            studyCallList.slice(0, 2).map((call) => {
                return [call.args.action, call.args.file];
            }),
        ).toEqual([
            ['read', OPEN],
            ['translate', OPEN],
        ]);
    });
});
