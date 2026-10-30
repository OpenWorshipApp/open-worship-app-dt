// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

// The help window drawn whole, with its effects running: the reads the
// window makes for a question before (or instead of) a model -- a record
// handed over from a Lookup Detail panel, what a line under a passage card
// asks of its surroundings, a Reader question naming a book -- and what an
// ask that fails, or costs, leaves in the transcript. Only the boundaries are
// faked -- the IPC, the settings store, the tool host and the model -- each
// answering from state a test seeds.
const { mocks, state } = vi.hoisted(() => {
    return {
        mocks: {
            sendData: vi.fn(),
            openExternalURL: vi.fn(),
            electronSendAsync: vi.fn(),
            callTool: vi.fn(),
            callToolPicture: vi.fn(),
            askLlmBot: vi.fn(),
            listAllLlmModels: vi.fn(),
            captureAppWindow: vi.fn(),
            openPopupWindow: vi.fn(),
            getStarterQuestions: vi.fn(),
            getAllQuestions: vi.fn(),
            suggestQuestions: vi.fn(),
            scrollIntoView: vi.fn(),
            scrollTo: vi.fn(),
        },
        state: {
            settings: new Map<string, string>(),
            home: new Map<string, string>(),
            secure: new Map<string, string>(),
            listeners: new Map<string, Set<(...args: any[]) => void>>(),
            endpoints: {
                mcpUrl: 'http://127.0.0.1:39223/mcp',
                mcpToken: 'token',
                cdpPort: 9222,
            } as any,
        },
    };
});

vi.mock('../server/appProvider', () => {
    return {
        default: {
            systemUtils: { isDev: false, isGlassCapable: false },
            envUtils: { isFEUseEffectWarning: false },
            isPageScreen: false,
            settingHomePage: '/setting.html',
            messageUtils: {
                sendData: (...args: any[]) => {
                    return mocks.sendData(...args);
                },
                sendDataSync: (channel: string, data?: any) => {
                    if (channel === 'main:app:get-ai-endpoints') {
                        return state.endpoints;
                    }
                    if (
                        channel === 'main:app:client-setting' &&
                        data?.type === 'get'
                    ) {
                        return state.home.get(data.key) ?? null;
                    }
                    if (
                        channel === 'main:app:secure-setting' &&
                        data?.type === 'get'
                    ) {
                        return state.secure.get(data.key) ?? null;
                    }
                    return null;
                },
                listenForData: (
                    channel: string,
                    listener: (...args: any[]) => void,
                ) => {
                    const set = state.listeners.get(channel) ?? new Set();
                    set.add(listener);
                    state.listeners.set(channel, set);
                },
                listenOnceForData: () => {},
                removeListener: (
                    channel: string,
                    listener: (...args: any[]) => void,
                ) => {
                    state.listeners.get(channel)?.delete(listener);
                },
            },
            pathUtils: {
                sep: '/',
                join: (...parts: string[]) => {
                    return parts.join('/');
                },
                basename: (path: string) => {
                    return path.split('/').pop() ?? '';
                },
            },
            browserUtils: {
                openExternalURL: (...args: any[]) => {
                    return mocks.openExternalURL(...args);
                },
            },
        },
    };
});
vi.mock('../helper/settingHelpers', () => {
    return {
        getSetting: (key: string) => {
            return state.settings.get(key) ?? null;
        },
        getSettingForce: (key: string) => {
            return state.settings.get(key) ?? null;
        },
        setSetting: (key: string, value: string | null) => {
            if (value === null) {
                state.settings.delete(key);
            } else {
                state.settings.set(key, value);
            }
        },
        removeSetting: (key: string) => {
            state.settings.delete(key);
        },
    };
});
vi.mock('../server/electronSendHelpers', () => {
    return {
        genReturningEventName: (name: string) => {
            return `${name}-return`;
        },
        electronSendAsync: (...args: any[]) => {
            return mocks.electronSendAsync(...args);
        },
    };
});
vi.mock('../helper/appCaptureHelpers', () => {
    return {
        captureAppWindow: (...args: any[]) => {
            return mocks.captureAppWindow(...args);
        },
    };
});
vi.mock('../helper/domHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('../helper/domHelpers')>()),
        openPopupWindow: (...args: any[]) => {
            return mocks.openPopupWindow(...args);
        },
    };
});
vi.mock('./mcpClient', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('./mcpClient')>()),
        callTool: (...args: any[]) => {
            return mocks.callTool(...args);
        },
        callToolPicture: (...args: any[]) => {
            return mocks.callToolPicture(...args);
        },
    };
});
vi.mock('./llmBotHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('./llmBotHelpers')>()),
        askLlmBot: (...args: any[]) => {
            return mocks.askLlmBot(...args);
        },
        listAllLlmModels: (...args: any[]) => {
            return mocks.listAllLlmModels(...args);
        },
    };
});
vi.mock('./questionHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('./questionHelpers')>()),
        getStarterQuestions: (...args: any[]) => {
            return mocks.getStarterQuestions(...args);
        },
        getAllQuestions: (...args: any[]) => {
            return mocks.getAllQuestions(...args);
        },
        suggestQuestions: (...args: any[]) => {
            return mocks.suggestQuestions(...args);
        },
    };
});

import ChatbotAppComp from './ChatbotAppComp';
import { resetSpendGuardForTests } from './spendGuardHelpers';
import { clearProgressSteps } from './progressHelpers';
import { LIST_APP_WINDOWS_CHANNEL } from './windowAimHelpers';
import {
    LLM_REGISTRY_GET_CHANNEL,
    LLM_REGISTRY_RELOAD_CHANNEL,
} from '../../electron/customLlmProtocol';
import { ToolHostError } from './mcpClient';

let container: HTMLDivElement;
let root: Root;
// What the registry and the window list answer, per test.
let registryStatus: any = null;
let reloadedRegistryStatus: any = null;
let windowEntryList: any[] = [];

function seedKeys(keys: Record<string, string>) {
    state.secure.set('ai-setting-secret', JSON.stringify(keys));
}

function seedNamedProvider(provider: string, model?: string) {
    state.settings.set('chatbot-llm-auto', 'false');
    state.settings.set('chatbot-llm-provider', provider);
    if (model !== undefined) {
        state.settings.set(`chatbot-llm-model-${provider}`, model);
    }
}

function genSession(overrides: Record<string, any> = {}) {
    return {
        id: 's1',
        title: '',
        messages: [],
        draft: '',
        focus: 'presenter',
        isFocusChosen: true,
        provider: 'free',
        model: 'nvidia/nemotron-3.5-super-vl:free',
        isLocked: false,
        ...overrides,
    };
}

function seedSessions(sessions: any[], activeId?: string) {
    state.settings.set(
        'chatbot-sessions',
        JSON.stringify({ activeId: activeId ?? sessions[0].id, sessions }),
    );
}

function readSavedSessions() {
    return JSON.parse(state.settings.get('chatbot-sessions') ?? 'null');
}

async function settle(milliseconds = 0) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds);
    });
}

async function renderApp() {
    await act(async () => {
        root.render(<ChatbotAppComp />);
    });
    await settle();
}

function query<T extends Element = HTMLElement>(selector: string) {
    return container.querySelector<T>(selector as any) as T | null;
}

function queryAll<T extends Element = HTMLElement>(selector: string) {
    return [...container.querySelectorAll<T>(selector as any)] as T[];
}

function findButton(text: string) {
    return queryAll<HTMLButtonElement>('button').find((button) => {
        return button.textContent?.trim() === text;
    });
}

async function click(target: Element | null | undefined) {
    expect(target).toBeTruthy();
    await act(async () => {
        (target as HTMLElement).click();
    });
    await settle();
}

async function typeQuestion(value: string) {
    const box = query<HTMLTextAreaElement>('.chat-input')!;
    const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(box, value);
        box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle();
}

beforeAll(() => {
    (Element.prototype as any).scrollIntoView = function (...args: any[]) {
        return mocks.scrollIntoView(...args);
    };
    (Element.prototype as any).scrollTo = function (...args: any[]) {
        return mocks.scrollTo(...args);
    };
});

afterAll(() => {
    delete (Element.prototype as any).scrollIntoView;
    delete (Element.prototype as any).scrollTo;
});

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.settings.clear();
    state.home.clear();
    state.secure.clear();
    state.listeners.clear();
    state.endpoints = {
        mcpUrl: 'http://127.0.0.1:39223/mcp',
        mcpToken: 'token',
        cdpPort: 9222,
    };
    globalThis.localStorage?.clear();
    resetSpendGuardForTests();
    clearProgressSteps('s1');
    document.title = 'Open Worship app - Help';
    registryStatus = null;
    reloadedRegistryStatus = null;
    windowEntryList = [];
    mocks.electronSendAsync.mockImplementation(async (channel: string) => {
        if (channel === LIST_APP_WINDOWS_CHANNEL) {
            return windowEntryList;
        }
        if (channel === LLM_REGISTRY_GET_CHANNEL) {
            return registryStatus;
        }
        if (channel === LLM_REGISTRY_RELOAD_CHANNEL) {
            return reloadedRegistryStatus;
        }
        return null;
    });
    mocks.getStarterQuestions.mockResolvedValue([]);
    mocks.getAllQuestions.mockResolvedValue([]);
    mocks.suggestQuestions.mockResolvedValue([]);
    mocks.callTool.mockResolvedValue('{}');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

// The question corpus is a lazy chunk: read once here, with real timers, so
// every lookup of it during a test resolves on microtasks.
beforeAll(async () => {
    const { findKnownQuestion } =
        await vi.importActual<typeof import('./questionHelpers')>(
            './questionHelpers',
        );
    await findKnownQuestion('warm up', 'presenter');
}, 30000);

function handOverLookup(ask: Record<string, any>) {
    state.settings.set(
        'chatbot-handoff-lookup',
        JSON.stringify({ ...ask, at: Date.now() }),
    );
}

function callsOf(name: string) {
    return mocks.callTool.mock.calls.filter((call) => {
        return call[0] === name;
    });
}

async function send(text: string) {
    await typeQuestion(text);
    await click(query('.chat-send'));
    await settle();
}

describe('a record handed over from a Lookup Detail panel', () => {
    const noahAsk = {
        kind: 'name',
        target: 'noah-1',
        title: 'Noah',
        langCode: 'en',
        page: 'reader.html?uuid=reader',
    };

    test('a person is read in the panel’s window and searched for in its own Bible', async () => {
        handOverLookup(noahAsk);
        mocks.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_lookup_record') {
                return JSON.stringify({
                    kind: 'name',
                    name: 'Noah',
                    bible: 'KJV',
                    verseCount: 3,
                });
            }
            if (name === 'owa_find_verse') {
                return JSON.stringify({
                    bible: 'KJV',
                    words: ['Noah'],
                    total: 3,
                    verses: [
                        {
                            key: 'GEN 6:9',
                            ref: 'Genesis 6:9',
                            text: 'Noah was a just man',
                        },
                    ],
                });
            }
            return '{}';
        });
        await renderApp();
        expect(callsOf('owa_lookup_record')).toEqual([
            [
                'owa_lookup_record',
                {
                    kind: 'name',
                    id: 'noah-1',
                    lang: 'en',
                    page: 'reader.html?uuid=reader',
                },
                expect.any(AbortSignal),
            ],
        ]);
        expect(callsOf('owa_find_verse')).toEqual([
            [
                'owa_find_verse',
                {
                    bible: 'KJV',
                    words: 'Noah',
                    page: 'reader.html?uuid=reader',
                },
                expect.any(AbortSignal),
            ],
        ]);
        // A person has no chapter: no study files are listed for him.
        expect(callsOf('owa_resource_file')).toEqual([]);
        // In a tab of its own, called by what it is about.
        expect(
            queryAll('.chat-tab-name').map((tab) => {
                return tab.textContent;
            }),
        ).toEqual(['New chat', 'Noah']);
        expect(query('.chat-tab.is-on .chat-tab-name')?.textContent).toBe(
            'Noah',
        );
        await settle(400);
        const card = readSavedSessions().sessions[1].messages[0];
        expect(JSON.parse(card.lookup.facts).bibleSearch).toMatchObject({
            bible: 'KJV',
            total: 3,
        });
    });

    test('a search of its Bible that fails leaves the record as it was read', async () => {
        handOverLookup(noahAsk);
        mocks.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_lookup_record') {
                return JSON.stringify({
                    kind: 'name',
                    name: 'Noah',
                    bible: 'KJV',
                });
            }
            throw new Error('no Bible indexed');
        });
        await renderApp();
        expect(callsOf('owa_find_verse')).toHaveLength(1);
        await settle(400);
        const card = readSavedSessions().sessions[1].messages[0];
        expect(JSON.parse(card.lookup.facts)).toEqual({
            kind: 'name',
            name: 'Noah',
            bible: 'KJV',
        });
    });

    test('a passage lists its chapter’s study files, each once', async () => {
        handOverLookup({
            kind: 'verse',
            target: 'GEN 8:1-22',
            title: 'Genesis 8:1-22',
            bibleKey: 'KJV',
        });
        mocks.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_lookup_record') {
                return JSON.stringify({
                    kind: 'verse',
                    bible: 'KJV',
                    passages: [
                        {
                            key: 'GEN 8:1-22',
                            title: 'Genesis 8:1-22',
                            text: 'And God remembered Noah',
                        },
                    ],
                });
            }
            if (name === 'owa_resource_file') {
                return JSON.stringify({
                    files: [
                        { file: 'pdf/GEN.8.pdf' },
                        { file: 'pdf/GEN.8.pdf' },
                    ],
                });
            }
            return '{}';
        });
        await renderApp();
        expect(callsOf('owa_lookup_record')[0]).toEqual([
            'owa_lookup_record',
            { kind: 'verse', ref: 'GEN 8:1-22', bible: 'KJV', related: true },
            expect.any(AbortSignal),
        ]);
        // A passage is no name to search for.
        expect(callsOf('owa_find_verse')).toEqual([]);
        expect(callsOf('owa_resource_file')).toEqual([
            [
                'owa_resource_file',
                { action: 'list', book: 'GEN', chapter: 8 },
                expect.any(AbortSignal),
            ],
        ]);
        await settle(400);
        const card = readSavedSessions().sessions[1].messages[0];
        expect(JSON.parse(card.lookup.facts).studyFiles).toEqual([
            'pdf/GEN.8.pdf',
        ]);
    });

    test('a list of study files that fails leaves the passage as it was read', async () => {
        handOverLookup({
            kind: 'verse',
            target: 'GEN 8:1-22',
            title: 'Genesis 8:1-22',
            bibleKey: 'KJV',
        });
        mocks.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_lookup_record') {
                return JSON.stringify({ kind: 'verse', bible: 'KJV' });
            }
            throw new Error('no Resources folder');
        });
        await renderApp();
        expect(callsOf('owa_resource_file')).toHaveLength(1);
        await settle(400);
        const card = readSavedSessions().sessions[1].messages[0];
        expect(JSON.parse(card.lookup.facts)).toEqual({
            kind: 'verse',
            bible: 'KJV',
        });
    });

    test('a record nobody can read still opens a card that says so', async () => {
        handOverLookup(noahAsk);
        mocks.callTool.mockRejectedValue(new Error('the panel window is gone'));
        await renderApp();
        // The panel's own window first, then any window.
        expect(
            callsOf('owa_lookup_record').map((call) => {
                return call[1];
            }),
        ).toEqual([
            {
                kind: 'name',
                id: 'noah-1',
                lang: 'en',
                page: 'reader.html?uuid=reader',
            },
            { kind: 'name', id: 'noah-1', lang: 'en' },
        ]);
        expect(callsOf('owa_find_verse')).toEqual([]);
        expect(query('.cue-bot')?.textContent).toContain(
            'I could not read Noah from the app just now.',
        );
    });
});

const GENESIS_8_FACTS = {
    kind: 'verse',
    bible: 'KJV',
    passages: [
        {
            key: 'GEN 8:1-22',
            title: 'Genesis 8:1-22',
            text: 'And God remembered Noah',
        },
    ],
    around: {
        before: { key: 'GEN 7', title: 'Genesis 7' },
        after: { key: 'GEN 9', title: 'Genesis 9' },
    },
};

function seedPassageCard(facts: Record<string, any> = GENESIS_8_FACTS) {
    seedKeys({ anthropicAPIKey: 'a' });
    seedNamedProvider('anthropic');
    seedSessions([
        genSession({
            provider: 'anthropic',
            model: 'claude-opus-5',
            messages: [
                {
                    id: 1,
                    author: 'bot',
                    text: 'Genesis 8:1-22 is ready.',
                    lookup: {
                        kind: 'verse',
                        target: 'GEN 8:1-22',
                        title: 'Genesis 8:1-22',
                        bibleKey: 'KJV',
                        facts: JSON.stringify(facts),
                    },
                },
            ],
        }),
    ]);
}

function lastAnswerText() {
    return queryAll('.cue-bot').at(-1)?.textContent ?? '';
}

describe('a question under a passage card', () => {
    test('a verse by number, the verses before it and the names in it are read first', async () => {
        seedPassageCard();
        mocks.callTool.mockImplementation(async (name: string, args: any) => {
            if (name !== 'owa_lookup_record') {
                return '{}';
            }
            if (args.related === true) {
                return JSON.stringify({
                    passages: [{ title: 'Genesis 8:4' }],
                    crossRefs: { byVerse: [{ themes: ['Ararat'] }] },
                });
            }
            if (args.names === true) {
                return JSON.stringify({
                    people: [
                        {
                            id: 'p1',
                            name: 'Noah',
                            kjvName: 'Noah',
                            verses: ['GEN 8:1'],
                        },
                    ],
                    places: [{ id: 'l1', name: 'Ararat', verses: ['GEN 8:4'] }],
                });
            }
            return JSON.stringify({
                passages: [
                    { text: 'And the flood was forty days upon the earth.' },
                ],
            });
        });
        mocks.askLlmBot.mockResolvedValue({
            text: 'Before it, the flood rose.',
        });
        await renderApp();
        await send('What happened before this, and who is in verse 4?');
        expect(
            callsOf('owa_lookup_record').map((call) => {
                return call[1];
            }),
        ).toEqual([
            { kind: 'verse', bible: 'KJV', ref: 'GEN 8:4', related: true },
            { kind: 'verse', bible: 'KJV', ref: 'GEN 7' },
            { kind: 'verse', bible: 'KJV', ref: 'GEN 8:1-22', names: true },
        ]);
        expect(mocks.askLlmBot).toHaveBeenCalledTimes(1);
        const [asked, , , , , , extra] = mocks.askLlmBot.mock.calls[0];
        // Read for the question, it goes under the question; the record
        // stays the conversation's first turn.
        expect(extra.lookup.isReadForAsk).toBe(true);
        expect(asked).toContain('Read for this question, as data');
        expect(asked).toContain('Genesis 8:4, its own cross references');
        expect(asked).toContain('The verses before it (Genesis 7)');
        expect(asked).toContain('forty days');
        // Each person or place by name and verses; the ids are a later read's.
        expect(asked).toContain('Noah');
        expect(asked).not.toContain('p1');
        expect(lastAnswerText()).toContain('Before it, the flood rose.');
    });

    test('reads that fail or find nothing leave the record alone, and the question is still asked', async () => {
        seedPassageCard({ ...GENESIS_8_FACTS, around: {} });
        mocks.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_lookup_record' && args.related === true) {
                // A verse with no themes is no block.
                return JSON.stringify({
                    crossRefs: { byVerse: [{ themes: [] }] },
                });
            }
            if (name === 'owa_lookup_record') {
                throw new Error('the lookup is not loaded');
            }
            return '{}';
        });
        mocks.askLlmBot.mockResolvedValue({ text: 'It lasted a year.' });
        await renderApp();
        // "How long" is both sides, and neither is in this record.
        await send(
            'How long did it last, from verse 3, and which people are in it?',
        );
        expect(
            callsOf('owa_lookup_record').map((call) => {
                return call[1];
            }),
        ).toEqual([
            { kind: 'verse', bible: 'KJV', ref: 'GEN 8:3', related: true },
            { kind: 'verse', bible: 'KJV', ref: 'GEN 8:1-22', names: true },
        ]);
        const [asked, , , , , , extra] = mocks.askLlmBot.mock.calls[0];
        expect(asked).not.toContain('Read for this question');
        expect(extra.lookup.isReadForAsk).toBeUndefined();
        expect(lastAnswerText()).toContain('It lasted a year.');
    });

    test('the app’s own tool host failing is said in its own sentence', async () => {
        seedPassageCard();
        mocks.askLlmBot.mockRejectedValue(new ToolHostError(500));
        await renderApp();
        await send('How did it end?');
        expect(lastAnswerText()).toContain(
            "The app's own help service did not respond.",
        );
        // The guide stands in with what the app holds on the passage.
        expect(lastAnswerText()).toContain('And God remembered Noah');
    });
});

describe('a Reader question that names a book', () => {
    function seedReaderTab() {
        seedKeys({ anthropicAPIKey: 'a' });
        seedNamedProvider('anthropic');
        seedSessions([
            genSession({
                provider: 'anthropic',
                model: 'claude-opus-5',
                focus: 'reader',
            }),
        ]);
    }

    test('a book the Bible being read knows makes it a Reader ask, and its cost is kept', async () => {
        seedReaderTab();
        mocks.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_bible_suggest' && args.limit === 1) {
                return JSON.stringify({
                    suggestions:
                        args.prefix === 'Matthew'
                            ? [{ label: 'Matthew', fill: 'Matthew ' }]
                            : [],
                });
            }
            return '{}';
        });
        mocks.askLlmBot.mockImplementation(async (...args: any[]) => {
            args[6].onUsage({
                provider: 'anthropic',
                model: 'claude-opus-5',
                input: 100,
                cacheRead: 0,
                cacheWrite: 0,
                output: 50,
            });
            return { text: 'Matthew 18 is about forgiveness.' };
        });
        await renderApp();
        await send('Summarize Matthew 18');
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_suggest', {
            kind: 'reference',
            prefix: 'Matthew',
            limit: 1,
        });
        expect(mocks.askLlmBot.mock.calls[0][6].bibleReader).toBeDefined();
        expect(lastAnswerText()).toContain('Matthew 18 is about forgiveness.');
        // What the answer cost, named by the model that answered it.
        expect(query('.cue-cost')?.textContent).toMatch(
            /^Opus 5 · .+ · 150 tokens$/,
        );
        expect(query('.cue-cost')?.getAttribute('title')).toContain(
            'Model: Claude · Opus 5',
        );
        expect(query('.chat-credit-value')?.textContent).toContain(
            '150 tokens',
        );
        await settle(400);
        const saved = readSavedSessions().sessions[0];
        expect(saved.usage).toMatchObject({
            rounds: 1,
            input: 100,
            output: 50,
        });
        expect(saved.messages.at(-1).answeredBy).toEqual({
            assistant: 'Claude',
            model: 'Opus 5',
        });
    });

    test('words that name no book are asked as a question about the app', async () => {
        seedReaderTab();
        mocks.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_bible_suggest' && args.limit === 1) {
                if (args.prefix === 'Summarize Matthew') {
                    return JSON.stringify({ suggestions: [] });
                }
                throw new Error('no Bible open');
            }
            return '{}';
        });
        mocks.askLlmBot.mockResolvedValue({ text: 'Here is how.' });
        await renderApp();
        await send('Summarize Matthew 18');
        const prefixes = callsOf('owa_bible_suggest')
            .filter((call) => {
                return call[1].limit === 1;
            })
            .map((call) => {
                return call[1].prefix;
            });
        expect(prefixes).toEqual(['Matthew', 'Summarize Matthew']);
        expect(mocks.askLlmBot.mock.calls[0][6].bibleReader).toBeUndefined();
    });
});

describe('when the assistant cannot answer', () => {
    test('the note names who failed and why, over the guide’s own answer', async () => {
        seedKeys({ anthropicAPIKey: 'a' });
        seedNamedProvider('anthropic');
        mocks.askLlmBot.mockRejectedValue(new Error('The service is down.'));
        await renderApp();
        await send('How do I clear the screen?');
        expect(mocks.callTool).toHaveBeenCalledWith(
            'owa_help_search',
            expect.objectContaining({ query: 'How do I clear the screen?' }),
        );
        const note = queryAll('.cue-bot').at(-1)?.querySelector('.cue-note');
        expect(note?.textContent).toBe(
            "Claude could not answer — The service is down. Here is what the app's own guide says.",
        );
    });
});

describe('a reply typed under a question that waits', () => {
    const bibleChoices = [
        {
            label: 'KJV (the one in Find)',
            toolName: 'owa-verse-find-step',
            args: {
                step: 'remember',
                bible: 'KJV',
                title: 'King James Version',
            },
        },
        {
            label: 'NIV',
            toolName: 'owa-verse-find-step',
            args: {
                step: 'remember',
                bible: 'NIV',
                title: 'New International',
            },
        },
    ];

    function seedBibleQuestion(overrides: Record<string, any> = {}) {
        seedSessions([
            genSession({
                provider: 'anthropic',
                model: 'claude-opus-5',
                messages: [
                    {
                        id: 1,
                        author: 'you',
                        text: 'Help me find a verse',
                        attachments: [
                            {
                                id: 'n1',
                                kind: 'text',
                                name: 'notes.txt',
                                filePath: '/docs/notes.txt',
                                mimeType: 'text/plain',
                                byteSize: 3,
                                number: 1,
                            },
                        ],
                    },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Which Bible should I search?',
                        actions: bibleChoices,
                    },
                ],
                ...overrides,
            }),
        ]);
    }

    test('words that are no button are read by the assistant into a choice', async () => {
        seedKeys({ anthropicAPIKey: 'a' });
        seedNamedProvider('anthropic');
        seedBibleQuestion();
        mocks.askLlmBot.mockResolvedValue({
            text: '{"kind":"choice","choice":2}',
        });
        await renderApp();
        expect(findButton('KJV (the one in Find)')).toBeDefined();
        await send('the modern one please');
        expect(mocks.askLlmBot).toHaveBeenCalledTimes(1);
        const [prompt, focus, provider, model, history, , extra] =
            mocks.askLlmBot.mock.calls[0];
        expect([focus, provider, model, history]).toEqual([
            'presenter',
            'anthropic',
            'claude-opus-5',
            [],
        ]);
        expect(extra).toMatchObject({
            isGeneral: true,
            isWaitingInput: true,
            replyLang: 'en',
            appLang: 'en',
        });
        // The tab's own turns ride as data: the question, its file and its
        // choices -- never the line just typed twice.
        expect(prompt).toContain('Help me find a verse');
        expect(prompt).toContain('Choices: KJV (the one in Find); NIV');
        expect(prompt.split('the modern one please').length).toBe(2);
        expect(lastAnswerText()).toContain('NIV');
    });

    test('a reply the assistant answers with help keeps the question and its buttons', async () => {
        seedKeys({ anthropicAPIKey: 'a' });
        seedNamedProvider('anthropic');
        seedBibleQuestion();
        mocks.askLlmBot.mockResolvedValue({
            text: '{"kind":"help","reply":"Choose KJV for the English one."}',
        });
        await renderApp();
        await send('which is english?');
        const answer = queryAll('.cue-bot').at(-1)!;
        expect(answer.querySelector('.cue-note')?.textContent).toBe(
            'Choose KJV for the English one.',
        );
        expect(answer.textContent).toContain('Which Bible should I search?');
        expect(findButton('NIV')).toBeDefined();
    });

    test('an Auto tab asks the assistant Auto picks, and says who it was', async () => {
        seedBibleQuestion({ isAuto: true, provider: 'free' });
        mocks.askLlmBot.mockResolvedValue({ text: 'not json at all' });
        await renderApp();
        await send('hmm the second maybe');
        expect(mocks.askLlmBot.mock.calls[0][2]).toBe('free');
        expect(lastAnswerText()).toContain('Which Bible should I search?');
        expect(
            queryAll('.cue-bot').at(-1)?.querySelector('.cue-note')
                ?.textContent,
        ).toBe(
            'I could not understand that choice. Choose an option below, or say it another way.',
        );
        expect(query('.chat-auto-pick')?.textContent).toMatch(/^Free · /);
    });
});

describe('a job another window handed over', () => {
    function handOverAsk(text: string) {
        state.settings.set(
            'chatbot-handoff-ask',
            JSON.stringify({ text, at: Date.now() }),
        );
    }

    async function echoOfHandOver(text: string) {
        handOverAsk(text);
        await renderApp();
        const tabs = readTabs();
        expect(tabs).toHaveLength(2);
        return query('.cue-you')?.textContent ?? '';
    }

    function readTabs() {
        return queryAll('.chat-tab-name').map((tab) => {
            return tab.textContent;
        });
    }

    test('a Bible asked for by name is shown in their words, in a tab of its own', async () => {
        expect(await echoOfHandOver('Import the Bible called "KJV"')).toContain(
            'Import the Bible called "KJV"',
        );
        expect(state.settings.has('chatbot-handoff-ask')).toBe(false);
    });

    test('a Bible from a link', async () => {
        expect(
            await echoOfHandOver(
                'Import bible from https://example.org/kjv.xml',
            ),
        ).toContain('Import a Bible from https://example.org/kjv.xml');
    });

    test('a Bible with nothing more said', async () => {
        expect(await echoOfHandOver('Import bible')).toContain(
            'Import a Bible',
        );
    });

    test('a Bible for a language is shown as it was asked', async () => {
        expect(await echoOfHandOver('Import bible for Khmer')).toContain(
            'Import bible for Khmer',
        );
    });
});

describe('a verse remembered in another script', () => {
    function seedVerseSearch() {
        seedKeys({ anthropicAPIKey: 'a' });
        seedNamedProvider('anthropic');
        seedSessions([
            genSession({
                provider: 'anthropic',
                model: 'claude-opus-5',
                messages: [
                    { id: 1, author: 'you', text: 'Help me find a verse' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'What do you remember about the verse?',
                        verseFind: 'KJV',
                    },
                ],
            }),
        ]);
    }

    test('with no Gemma 4 to translate, it is searched as it was typed', async () => {
        seedVerseSearch();
        mocks.askLlmBot.mockResolvedValue({ text: 'Matthew 5:44.' });
        await renderApp();
        await send('ស្រឡាញ់ខ្មាំងសត្រូវ');
        const translations = mocks.askLlmBot.mock.calls.filter((call) => {
            return call[6]?.isTranslation === true;
        });
        expect(translations).toEqual([]);
        expect(mocks.askLlmBot).toHaveBeenCalled();
    });

    test('a Gemma 4 on this computer puts the words into English first', async () => {
        seedVerseSearch();
        state.home.set(
            'ai-custom-servers',
            JSON.stringify({
                servers: [
                    {
                        id: 'lms',
                        name: 'LM Studio',
                        baseUrl: 'http://localhost:1234/v1',
                        models: [
                            {
                                id: 'g4',
                                model: 'gemma-4-e4b',
                                name: 'Gemma 4 E4B',
                            },
                        ],
                    },
                ],
            }),
        );
        const baseImplementation =
            mocks.electronSendAsync.getMockImplementation()!;
        mocks.electronSendAsync.mockImplementation(
            async (channel: string, data: any) => {
                if (channel === 'main:app:custom-llm-fetch') {
                    return {
                        ok: true,
                        status: 200,
                        contentType: 'application/json',
                        text: JSON.stringify({
                            data: [{ id: 'gemma-4-e4b', state: 'loaded' }],
                        }),
                    };
                }
                return baseImplementation(channel, data);
            },
        );
        mocks.askLlmBot.mockImplementation(async (...args: any[]) => {
            if (args[6]?.isTranslation === true) {
                return { text: 'love your enemies' };
            }
            return { text: 'Matthew 5:44.' };
        });
        await renderApp();
        await send('ស្រឡាញ់ខ្មាំងសត្រូវ');
        const translation = mocks.askLlmBot.mock.calls.find((call) => {
            return call[6]?.isTranslation === true;
        });
        expect(translation).toBeDefined();
        expect(translation![0]).toContain('ស្រឡាញ់ខ្មាំងសត្រូវ');
        expect([translation![2], translation![3]]).toEqual([
            'custom',
            'lms/g4',
        ]);
        expect(translation![6]).toMatchObject({ isGeneral: true });
    });

    test('a translation that fails is no English, and the search goes on', async () => {
        seedVerseSearch();
        state.home.set(
            'ai-custom-servers',
            JSON.stringify({
                servers: [
                    {
                        id: 'lms',
                        name: 'LM Studio',
                        baseUrl: 'http://localhost:1234/v1',
                        models: [
                            {
                                id: 'g4',
                                model: 'gemma-4-e4b',
                                name: 'Gemma 4 E4B',
                            },
                        ],
                    },
                ],
            }),
        );
        const baseImplementation =
            mocks.electronSendAsync.getMockImplementation()!;
        mocks.electronSendAsync.mockImplementation(
            async (channel: string, data: any) => {
                if (channel === 'main:app:custom-llm-fetch') {
                    return {
                        ok: true,
                        status: 200,
                        contentType: 'application/json',
                        text: '{"data":[{"id":"gemma-4-e4b"}]}',
                    };
                }
                return baseImplementation(channel, data);
            },
        );
        mocks.askLlmBot.mockImplementation(async (...args: any[]) => {
            if (args[6]?.isTranslation === true) {
                throw new Error('the server went quiet');
            }
            return { text: 'Matthew 5:44.' };
        });
        await renderApp();
        await send('ស្រឡាញ់ខ្មាំងសត្រូវ');
        expect(
            mocks.askLlmBot.mock.calls.filter((call) => {
                return call[6]?.isTranslation !== true;
            }),
        ).toHaveLength(1);
        expect(lastAnswerText()).toContain('Matthew 5:44.');
    });
});
