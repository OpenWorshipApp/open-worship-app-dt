import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A study file TRANSLATED by the help window (EC-478): the model only names
// the file, the language and where the translation goes; the window asks
// the app for the plan, hands the words to its translator a part at a time
// and each diagram's labels on their own, and drafts the result like any
// change for the person's **Save changes**. The same mock surface as
// `llmBotHelpers.ut100.test.ts`: a fake Anthropic client, a tool host that
// records every call, a setting map -- and mermaid's parse, which says
// whether a translated diagram still draws.
const { fake, settingMap, TERMISH, LABELISH } = vi.hoisted(() => ({
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
                    ...language
                } = LABELISH;
                return language;
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
    STUDY_PREVIEW_TOOL_NAME,
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
                'since their translation would not draw.',
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
