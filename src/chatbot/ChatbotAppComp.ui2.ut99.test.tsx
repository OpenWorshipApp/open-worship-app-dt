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

// One mock surface for the whole window: the settings store, the main
// process (sync and async), the tool host and the model. Everything that
// crosses a process is a file-local `vi.fn`; the window's own helpers stay
// real so the tests exercise what it really does.
const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    homeSettings: new Map<string, string>(),
    listeners: new Map<string, Set<(...args: any[]) => void>>(),
    secret: {} as Record<string, string>,
    customServers: [] as any[],
    endpoints: {
        mcpUrl: 'http://127.0.0.1:39223/mcp',
        mcpToken: 'token',
        cdpPort: 9222,
    } as any,
    pendingSnapshot: null as any,
    windowEntries: [] as any[],
    registryStatus: null as any,
    resourceFolders: [] as string[],
    sendData: vi.fn(),
    removeListener: vi.fn(),
    openExternalURL: vi.fn(),
    electronSendAsync: vi.fn(),
    callTool: vi.fn(),
    callToolPicture: vi.fn(),
    askLlmBot: vi.fn(),
    listAllLlmModels: vi.fn(),
    copyImageToClipboard: vi.fn(),
    readAssetPreview: vi.fn(),
    downloadAsset: vi.fn(),
    getAllQuestions: vi.fn(),
    originalGetAllQuestions: null as null | ((...args: any[]) => any),
    getStarterQuestions: vi.fn(),
    originalGetStarterQuestions: null as null | ((...args: any[]) => any),
    originalReadAssetPreview: null as null | ((...args: any[]) => any),
    suggestQuestions: vi.fn(),
    originalSuggestQuestions: null as null | ((...args: any[]) => any),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false, isGlassCapable: false },
        envUtils: { isFEUseEffectWarning: false },
        isPageScreen: false,
        settingHomePage: '/setting.html',
        POPUP_FRAME_NAME_PREFIX: 'owa-popup',
        messageUtils: {
            sendDataSync: (channel: string, data?: any) => {
                if (channel === 'main:app:get-ai-endpoints') {
                    return h.endpoints;
                }
                if (channel === 'main:app:get-theme') {
                    return 'light';
                }
                if (channel === 'main:app:take-chat-attachment') {
                    const snapshot = h.pendingSnapshot;
                    h.pendingSnapshot = null;
                    return snapshot;
                }
                if (channel === 'main:app:secure-setting') {
                    if (data?.type === 'is-available') {
                        return true;
                    }
                    return data?.key === 'ai-setting-secret'
                        ? JSON.stringify(h.secret)
                        : null;
                }
                if (channel === 'main:app:client-setting') {
                    if (data?.key === 'ai-custom-servers') {
                        return JSON.stringify({ servers: h.customServers });
                    }
                    return h.homeSettings.get(data?.key) ?? null;
                }
                return null;
            },
            sendData: (...args: any[]) => h.sendData(...args),
            listenForData: (channel: string, listener: any) => {
                const set = h.listeners.get(channel) ?? new Set();
                set.add(listener);
                h.listeners.set(channel, set);
            },
            listenOnceForData: () => {},
            removeListener: (channel: string, listener: any) => {
                h.listeners.get(channel)?.delete(listener);
                h.removeListener(channel, listener);
            },
        },
        pathUtils: {
            sep: '/',
            join: (...parts: string[]) => parts.join('/'),
            basename: (path: string) => path.split('/').pop() ?? '',
            dirname: (path: string) => path.split('/').slice(0, -1).join('/'),
        },
        browserUtils: {
            openExternalURL: (url: string) => h.openExternalURL(url),
        },
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    getSettingForce: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string | null) => {
        h.settings.set(key, value ?? '');
    },
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('../server/electronSendHelpers', () => ({
    genReturningEventName: (name: string) => `${name}-return`,
    electronSendAsync: (...args: any[]) => h.electronSendAsync(...args),
}));
vi.mock('./mcpClient', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./mcpClient')>()),
    callTool: (...args: any[]) => h.callTool(...args),
    callToolPicture: (...args: any[]) => h.callToolPicture(...args),
}));
vi.mock('./llmBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./llmBotHelpers')>()),
    askLlmBot: (...args: any[]) => h.askLlmBot(...args),
    listAllLlmModels: (...args: any[]) => h.listAllLlmModels(...args),
}));
vi.mock('./attachmentHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./attachmentHelpers')>()),
    copyImageToClipboard: (...args: any[]) => h.copyImageToClipboard(...args),
}));
vi.mock('./assetPreviewHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('./assetPreviewHelpers')>();
    h.originalReadAssetPreview = original.readAssetPreview;
    return {
        ...original,
        readAssetPreview: (...args: any[]) => h.readAssetPreview(...args),
        downloadAsset: (...args: any[]) => h.downloadAsset(...args),
    };
});
vi.mock('./questionHelpers', async (importOriginal) => {
    const original = await importOriginal<typeof import('./questionHelpers')>();
    h.originalGetAllQuestions = original.getAllQuestions;
    h.originalGetStarterQuestions = original.getStarterQuestions;
    h.originalSuggestQuestions = original.suggestQuestions;
    return {
        ...original,
        suggestQuestions: (...args: any[]) => h.suggestQuestions(...args),
        getAllQuestions: (...args: any[]) => h.getAllQuestions(...args),
        getStarterQuestions: (...args: any[]) => {
            return h.getStarterQuestions(...args);
        },
    };
});
vi.mock('../resources/resourcesFolderHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../resources/resourcesFolderHelpers')
    >()),
    getResourcesFolderList: () => h.resourceFolders,
}));

import ChatbotAppComp from './ChatbotAppComp';
import { setChatTranslator } from './chatTranHelpers';
import { resetSpendGuardForTests } from './spendGuardHelpers';
import { describeUsageBriefly, describeUsageInFull } from './usageHelpers';
import { setCurrentWindowAim } from './windowAimHelpers';
import { keepDraftedLyric } from './lyricDraftHelpers';
import { loadLlmRegistry } from '../helper/ai/customServerHelpers';

const LIST_APP_WINDOWS_CHANNEL = 'main:app:list-app-windows';
const REGISTRY_GET_CHANNEL = 'main:app:llm-registry';
const REGISTRY_RELOAD_CHANNEL = 'main:app:llm-registry-reload';

function genSession(overrides: Record<string, any> = {}) {
    return {
        id: 's1',
        title: '',
        messages: [],
        draft: '',
        focus: 'presenter',
        isFocusChosen: true,
        provider: 'free',
        model: '',
        isLocked: false,
        ...overrides,
    };
}

function seedSessions(sessions: any[], activeId = sessions[0].id) {
    h.settings.set('chatbot-sessions', JSON.stringify({ activeId, sessions }));
}

function readSavedSessions() {
    return JSON.parse(h.settings.get('chatbot-sessions') ?? 'null');
}

let container: HTMLDivElement;
let root: Root;
let isMounted = false;
let originalTitle = '';

beforeAll(async () => {
    // jsdom draws no layout: the tab strip and the suggestion list bring
    // their active row into view, which jsdom does not implement.
    (Element.prototype as any).scrollIntoView = function () {
        scrolledIntoView.push(this as Element);
    };
    // The corpus is a lazy chunk; loaded once here, with real timers, so a
    // test under fake timers reads it from memory.
    await h.originalGetStarterQuestions!('presenter');
    await h.originalGetAllQuestions!('presenter');
    await h.originalSuggestQuestions!('background', 'presenter');
});
afterAll(() => {
    delete (Element.prototype as any).scrollIntoView;
});

const scrolledIntoView: Element[] = [];

beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.settings.clear();
    h.homeSettings.clear();
    h.listeners.clear();
    h.secret = {};
    h.customServers = [];
    h.endpoints = {
        mcpUrl: 'http://127.0.0.1:39223/mcp',
        mcpToken: 'token',
        cdpPort: 9222,
    };
    h.pendingSnapshot = null;
    h.windowEntries = [];
    h.registryStatus = null;
    h.resourceFolders = [];
    scrolledIntoView.length = 0;
    localStorage.clear();
    h.electronSendAsync.mockImplementation(async (channel: string) => {
        if (channel === LIST_APP_WINDOWS_CHANNEL) {
            return h.windowEntries;
        }
        if (
            channel === REGISTRY_GET_CHANNEL ||
            channel === REGISTRY_RELOAD_CHANNEL
        ) {
            return h.registryStatus;
        }
        return null;
    });
    h.callTool.mockImplementation(async () => '{}');
    h.callToolPicture.mockImplementation(async () => {
        throw new Error('No picture in this test');
    });
    h.askLlmBot.mockImplementation(async () => {
        return { text: 'A plain answer.' };
    });
    h.readAssetPreview.mockImplementation((attachment: any) => {
        return h.originalReadAssetPreview!(attachment);
    });
    h.downloadAsset.mockImplementation(async () => {
        return { filePath: null, message: 'Saved it.' };
    });
    h.getAllQuestions.mockImplementation((...args: any[]) => {
        return h.originalGetAllQuestions!(...args);
    });
    h.getStarterQuestions.mockImplementation((...args: any[]) => {
        return h.originalGetStarterQuestions!(...args);
    });
    h.suggestQuestions.mockImplementation((...args: any[]) => {
        return h.originalSuggestQuestions!(...args);
    });
    // Module state shared by every mount: the registry's servers, the spend
    // guard's ledger, the window the tab works in, the translator.
    await loadLlmRegistry();
    resetSpendGuardForTests();
    setCurrentWindowAim(null);
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
    originalTitle = document.title;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    isMounted = false;
});

afterEach(() => {
    if (isMounted) {
        act(() => {
            root.unmount();
        });
    }
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    document.title = originalTitle;
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
    setCurrentWindowAim(null);
    localStorage.clear();
});

async function flush(ms = 0) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

async function renderWindow() {
    await act(async () => {
        root.render(<ChatbotAppComp />);
    });
    isMounted = true;
    await flush();
}

async function unmountWindow() {
    act(() => {
        root.unmount();
    });
    isMounted = false;
}

function $<T extends Element = HTMLElement>(selector: string) {
    return container.querySelector<T & Element>(selector) as T | null;
}

function $$<T extends Element = HTMLElement>(selector: string) {
    return [...container.querySelectorAll(selector)] as T[];
}

function findButton(words: string) {
    const button = $$<HTMLButtonElement>('button').find((one) => {
        return (one.textContent ?? '').trim() === words;
    });
    expect(button, `a button reading "${words}"`).toBeDefined();
    return button!;
}

async function press(element: Element | null) {
    expect(element).not.toBeNull();
    await act(async () => {
        (element as HTMLElement).click();
    });
    await flush();
}

async function typeQuestion(value: string) {
    const box = $<HTMLTextAreaElement>('.chat-input')!;
    const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(box, value);
        box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();
}

async function keyDown(element: Element, init: KeyboardEventInit) {
    await act(async () => {
        element.dispatchEvent(
            new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                ...init,
            }),
        );
    });
    await flush();
}

async function chooseOption(select: HTMLSelectElement, value: string) {
    await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            'value',
        )!.set!;
        setter.call(select, value);
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
}

function getSelect(label: string) {
    const select = $<HTMLSelectElement>(`select[aria-label="${label}"]`);
    expect(select, `the "${label}" picker`).not.toBeNull();
    return select!;
}

afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as any).clipboard;
    document.documentElement.lang = '';
});

function genDeferred<T>() {
    let resolve: (value: T) => void = () => {};
    let reject: (error: unknown) => void = () => {};
    const promise = new Promise<T>((done, fail) => {
        resolve = done;
        reject = fail;
    });
    return { promise, resolve, reject };
}

// What each message SAYS: a question's own words, an answer's lines.
function transcriptTexts(author: 'you' | 'bot') {
    return $$(`.cue-${author} .cue-body`).map((one) => {
        return [...one.children]
            .filter((child) => {
                return (
                    child.classList.contains('cue-said') ||
                    child.classList.contains('chatbot-line')
                );
            })
            .map((child) => {
                return (child.textContent ?? '').trim();
            })
            .join('\n');
    });
}

function suggestionTexts() {
    return $$('.chat-suggest-text').map((one) => {
        return one.textContent;
    });
}

async function mouseDown(element: Element) {
    await act(async () => {
        element.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
        );
    });
    await flush();
}

// jsdom never decodes a picture: this one "loads" at 40×20 when it is a
// picture's data URL and fails otherwise, which is all `normalizeImage`
// asks of it.
class FakeImage {
    width = 0;
    height = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
        queueMicrotask(() => {
            // 'YnJva2Vu' is 'broken': a file a test means to be no picture.
            if (
                value.startsWith('data:image/') &&
                !value.includes('YnJva2Vu')
            ) {
                this.width = 40;
                this.height = 20;
                this.onload?.();
            } else {
                this.onerror?.();
            }
        });
    }
}

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

// The translator a non-English window plugs in, for a few words only, so a
// test can see which words went through it.
function plugTestTranslator(words: Record<string, string>) {
    const translate = (text: string) => {
        return words[text] ?? text;
    };
    setChatTranslator(translate, translate);
}

describe('the suggestions under the box', () => {
    test('two letters bring the corpus questions, and a press fills the box', async () => {
        seedSessions([genSession()]);
        await renderWindow();
        await typeQuestion('b');
        expect($('.chat-suggests')).toBeNull();
        await typeQuestion('background');
        const rows = $$<HTMLButtonElement>('.chat-suggest');
        expect(rows.length).toBeGreaterThan(0);
        const firstText =
            rows[0].querySelector('.chat-suggest-text')!.textContent!;
        expect(firstText.toLowerCase()).toContain('background');
        expect(
            rows[0].querySelector('.chat-suggest-where')?.textContent,
        ).not.toBe('');
        await mouseDown(rows[0]);
        const box = $<HTMLTextAreaElement>('.chat-input')!;
        expect(box.value).toBe(firstText);
        expect(document.activeElement).toBe(box);
        // A question taken is the end of the list's work.
        expect($('.chat-suggests')).toBeNull();
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });

    test('the arrows walk the list both ways and bring their row into view', async () => {
        seedSessions([genSession()]);
        await renderWindow();
        await typeQuestion('background');
        const box = $<HTMLTextAreaElement>('.chat-input')!;
        const count = $$('.chat-suggest').length;
        expect(count).toBeGreaterThan(1);
        expect($('.chat-suggest.is-on')).toBeNull();
        await keyDown(box, { key: 'ArrowDown' });
        const rows = () => $$<HTMLButtonElement>('.chat-suggest');
        expect(rows()[0].classList.contains('is-on')).toBe(true);
        expect(rows()[0].getAttribute('aria-selected')).toBe('true');
        expect(scrolledIntoView).toContain(rows()[0].parentElement);
        // Up from the first row is "nothing chosen", then the last row.
        await keyDown(box, { key: 'ArrowUp' });
        expect($('.chat-suggest.is-on')).toBeNull();
        await keyDown(box, { key: 'ArrowUp' });
        expect(rows()[count - 1].classList.contains('is-on')).toBe(true);
        expect(scrolledIntoView).toContain(rows()[count - 1].parentElement);
        // Enter takes the row walked to.
        const lastText =
            rows()[count - 1].querySelector('.chat-suggest-text')!.textContent;
        await keyDown(box, { key: 'Enter' });
        expect(box.value).toBe(lastText);
        expect($('.chat-suggests')).toBeNull();
    });

    test('Escape puts the list away until the next keystroke', async () => {
        seedSessions([genSession()]);
        await renderWindow();
        await typeQuestion('background');
        const box = $<HTMLTextAreaElement>('.chat-input')!;
        await keyDown(box, { key: 'Escape' });
        expect($('.chat-suggests')).toBeNull();
        expect(box.value).toBe('background');
        await typeQuestion('backgrounds');
        expect($('.chat-suggests')).not.toBeNull();
    });

    test('a question already in the box is not offered back', async () => {
        seedSessions([genSession()]);
        await renderWindow();
        await typeQuestion('background');
        const offered = suggestionTexts()[0]!;
        await typeQuestion(offered);
        expect(suggestionTexts()).not.toContain(offered);
    });

    test('under a person’s card the box offers no app questions', async () => {
        seedSessions([
            genSession({
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'I have read Adam.',
                        lookup: {
                            kind: 'name',
                            target: 'adam',
                            title: 'Adam',
                            facts: '{"kind":"name","name":"Adam"}',
                        },
                    },
                ],
            }),
        ]);
        await renderWindow();
        await typeQuestion('background');
        expect($('.chat-suggests')).toBeNull();
    });
});

describe('the Bible input aid', () => {
    test('a Reader tab completes a passage in the Reader’s own words', async () => {
        plugTestTranslator({ Book: 'BOOK-IN-KHMER' });
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_bible_suggest' && args.kind === 'reference') {
                return JSON.stringify({
                    suggestions: [
                        { label: 'John', fill: 'John ', detail: 'Book' },
                        { label: 'Jonah', fill: 'Jonah ', detail: 'Book' },
                    ],
                });
            }
            return '{}';
        });
        seedSessions([genSession({ focus: 'reader' })]);
        await renderWindow();
        await typeQuestion('Jo');
        // Debounced: nothing is asked until the typing settles.
        expect(
            h.callTool.mock.calls.filter((call) => {
                return call[0] === 'owa_bible_suggest';
            }),
        ).toHaveLength(0);
        await flush(350);
        expect(h.callTool).toHaveBeenCalledWith('owa_bible_suggest', {
            kind: 'reference',
            prefix: 'Jo',
            limit: 60,
        });
        expect(suggestionTexts()).toEqual(['John', 'Jonah']);
        // A book is data, drawn as it is, never put through the dictionary.
        expect(
            $$('.chat-suggest-where').map((one) => {
                return one.textContent;
            }),
        ).toEqual(['Book', 'Book']);
        await mouseDown($$('.chat-suggest')[0]);
        expect($<HTMLTextAreaElement>('.chat-input')!.value).toBe('John ');
        // One step of a completion: the list stays for the chapter.
        expect($('.chat-suggests')).not.toBeNull();
    });

    test('a name after "Who was" is completed with its KJV spelling', async () => {
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_bible_suggest' && args.kind === 'name') {
                return JSON.stringify({
                    // The lookup's own spelling, in a script of its own
                    // (signs stand in for it), with the KJV name beside it.
                    suggestions: [
                        { label: '☩✠☧', fill: '☩✠☧', detail: 'Moses' },
                    ],
                });
            }
            return '{}';
        });
        seedSessions([genSession()]);
        await renderWindow();
        await typeQuestion('Who was Mos');
        await flush(350);
        expect(h.callTool).toHaveBeenCalledWith('owa_bible_suggest', {
            kind: 'name',
            prefix: 'Mos',
            allowLoad: true,
            limit: 8,
        });
        expect(suggestionTexts()).toEqual(['☩✠☧']);
        await mouseDown($$('.chat-suggest')[0]);
        expect($<HTMLTextAreaElement>('.chat-input')!.value).toBe(
            'Who was Moses',
        );
    });

    test('a reference look that fails goes on to the name; one that answers is enough', async () => {
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name !== 'owa_bible_suggest') {
                return '{}';
            }
            if (args.kind === 'reference') {
                throw new Error('No Bible open');
            }
            return JSON.stringify({
                suggestions: [{ label: 'Moses', fill: 'Moses', detail: '' }],
            });
        });
        seedSessions([genSession({ focus: 'reader' })]);
        await renderWindow();
        await typeQuestion('Mose');
        await flush(350);
        expect(suggestionTexts()).toEqual(['Moses']);
        // With a passage found, no name is asked for at all.
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_bible_suggest' && args.kind === 'reference') {
                return JSON.stringify({
                    suggestions: [
                        { label: 'Moses 1', fill: 'Moses 1', detail: '' },
                    ],
                });
            }
            throw new Error('not asked');
        });
        await typeQuestion('Moses');
        await flush(350);
        expect(suggestionTexts()).toEqual(['Moses 1']);
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_bible_suggest',
            expect.objectContaining({ kind: 'name', prefix: 'Moses' }),
        );
    });

    test('rows that answer words since replaced are dropped', async () => {
        const first = genDeferred<string>();
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name !== 'owa_bible_suggest') {
                return '{}';
            }
            if (args.prefix === 'Joh') {
                return first.promise;
            }
            return JSON.stringify({
                suggestions: [{ label: 'John 1', fill: 'John 1:', detail: '' }],
            });
        });
        seedSessions([genSession({ focus: 'reader' })]);
        await renderWindow();
        await typeQuestion('Joh');
        await flush(350);
        await typeQuestion('John 1');
        await act(async () => {
            first.resolve(
                JSON.stringify({
                    suggestions: [
                        { label: 'Stale', fill: 'Stale', detail: '' },
                    ],
                }),
            );
        });
        await flush();
        expect(suggestionTexts()).not.toContain('Stale');
        await flush(350);
        expect(suggestionTexts()).toEqual(['John 1']);
    });

    test('under an answer that waits for a passage, digits complete in its book', async () => {
        seedSessions([
            genSession({
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'Which passage should I open?',
                        lookupAwaits: {
                            kind: 'verse',
                            target: 'JHN 3:16',
                            title: 'John 3:16',
                            bibleKey: 'KJV',
                        },
                    },
                ],
            }),
        ]);
        await renderWindow();
        await typeQuestion('5');
        await flush(350);
        expect(h.callTool).toHaveBeenCalledWith('owa_bible_suggest', {
            kind: 'reference',
            prefix: '5',
            book: 'JHN',
            limit: 60,
        });
    });

    test('under a verse search the box suggests nothing at all', async () => {
        seedSessions([
            genSession({
                focus: 'reader',
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'What do you remember about the verse?',
                        verseFind: 'KJV',
                    },
                ],
            }),
        ]);
        await renderWindow();
        await typeQuestion('love your enemies');
        await flush(350);
        expect($('.chat-suggests')).toBeNull();
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_bible_suggest',
            expect.anything(),
        );
    });
});

describe('Alt+↑ and the box', () => {
    const genAskedSession = (id: string, asked: string[]) => {
        return genSession({
            id,
            messages: asked.map((text, index) => {
                return { id: index + 1, author: 'you', text };
            }),
        });
    };

    test('walks back through what was asked and hands back the half-written words', async () => {
        seedSessions([
            genAskedSession('s1', [
                'How do I add a background?',
                'How do I clear the screen?',
            ]),
        ]);
        await renderWindow();
        const box = $<HTMLTextAreaElement>('.chat-input')!;
        await typeQuestion('half written');
        await keyDown(box, { key: 'ArrowUp', altKey: true });
        expect(box.value).toBe('How do I clear the screen?');
        // The caret goes to the end, ready for the correction.
        expect(box.selectionStart).toBe(box.value.length);
        expect($('.chat-suggests')).toBeNull();
        await keyDown(box, { key: 'ArrowUp', altKey: true });
        expect(box.value).toBe('How do I add a background?');
        // Nothing older: the box stays as it is.
        await keyDown(box, { key: 'ArrowUp', altKey: true });
        expect(box.value).toBe('How do I add a background?');
        await keyDown(box, { key: 'ArrowDown', altKey: true });
        expect(box.value).toBe('How do I clear the screen?');
        await keyDown(box, { key: 'ArrowDown', altKey: true });
        expect(box.value).toBe('half written');
    });

    test('a walk belongs to the tab it started in', async () => {
        seedSessions([
            genAskedSession('s1', ['How do I add a background?']),
            genAskedSession('s2', ['How do I clear the screen?']),
        ]);
        await renderWindow();
        const box = () => $<HTMLTextAreaElement>('.chat-input')!;
        await keyDown(box(), { key: 'ArrowUp', altKey: true });
        expect(box().value).toBe('How do I clear the screen?');
        await press($$('.chat-tab-name')[1]);
        // A fresh walk in the other tab starts from the newest again.
        await keyDown(box(), { key: 'ArrowUp', altKey: true });
        expect(box().value).toBe('How do I clear the screen?');
    });

    test('the box grows with what is in it, borders included', async () => {
        vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(64);
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(
            42,
        );
        vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(40);
        seedSessions([genSession()]);
        await renderWindow();
        await typeQuestion('one\ntwo\nthree');
        expect($<HTMLTextAreaElement>('.chat-input')!.style.height).toBe(
            '66px',
        );
    });
});

describe('what a message draws', () => {
    const USAGE = {
        rounds: 1,
        unpricedRounds: 0,
        input: 900,
        cacheRead: 0,
        cacheWrite: 0,
        output: 100,
        costUsd: 0,
    };

    test('an answer: its note, its words set as rich text, its cost and who wrote it', async () => {
        seedSessions([
            genSession({
                messages: [
                    { id: 1, author: 'you', text: 'Where is Clear All?' },
                    {
                        id: 2,
                        author: 'bot',
                        text:
                            'Press **Clear All** in the `Mini Screen` panel.\n' +
                            '_Then_ look at the screen.\n' +
                            'The guide is at `https://example.com/help` and `not-a-link`.',
                        links: ['https://example.com/help'],
                        note: 'Answered from the guide.',
                        answeredBy: {
                            assistant: 'Free',
                            model: 'Nemotron Super VL',
                        },
                        usage: USAGE,
                    },
                ],
            }),
        ]);
        await renderWindow();
        const answer = $$('.cue-bot')[0];
        expect(answer.querySelector('.cue-note')?.textContent).toBe(
            'Answered from the guide.',
        );
        expect(answer.querySelector('.cue-label')?.getAttribute('title')).toBe(
            'Model: Free · Nemotron Super VL',
        );
        expect(answer.querySelector('strong')?.textContent).toBe('Clear All');
        expect(answer.querySelector('em')?.textContent).toBe('Then');
        expect(
            [...answer.querySelectorAll('.chatbot-line > code')].map((one) => {
                return one.textContent;
            }),
        ).toEqual(['Mini Screen', 'not-a-link']);
        const link = answer.querySelector<HTMLButtonElement>('.chatbot-link')!;
        expect(link.textContent).toBe('example.com/help');
        expect(link.title).toBe(
            'Opens https://example.com/help in your browser',
        );
        await press(link);
        expect(h.openExternalURL).toHaveBeenCalledWith(
            'https://example.com/help',
        );
        const cost = answer.querySelector<HTMLElement>('.cue-cost')!;
        expect(cost.textContent).toBe(
            `Nemotron Super VL · ${describeUsageBriefly(USAGE)}`,
        );
        expect(cost.title).toBe(
            `Model: Free · Nemotron Super VL\n${describeUsageInFull(USAGE)}`,
        );
    });

    test('a question is the button that puts it back in the box', async () => {
        seedSessions([
            genSession({
                messages: [
                    { id: 1, author: 'you', text: 'Keep this question' },
                    { id: 2, author: 'bot', text: 'An answer.' },
                ],
            }),
        ]);
        await renderWindow();
        const said = $<HTMLElement>('.cue-said')!;
        expect(said.title).toBe('Put this question back in the box');
        // A drag that selected the words is copying, not asking again.
        const selection = vi
            .spyOn(window, 'getSelection')
            .mockReturnValue({ toString: () => 'Keep' } as any);
        await press(said);
        expect($<HTMLTextAreaElement>('.chat-input')!.value).toBe('');
        selection.mockRestore();
        await keyDown(said, { key: 'Enter' });
        expect($<HTMLTextAreaElement>('.chat-input')!.value).toBe(
            'Keep this question',
        );
        await typeQuestion('');
        await press(findButton('Ask again'));
        expect($<HTMLTextAreaElement>('.chat-input')!.value).toBe(
            'Keep this question',
        );
    });

    test('a thumb up stays filled, and a follow-up line has no thumbs', async () => {
        seedSessions([
            genSession({
                messages: [
                    { id: 1, author: 'you', text: 'Where is Clear All?' },
                    { id: 2, author: 'bot', text: 'Look at the top.' },
                    {
                        id: 3,
                        author: 'bot',
                        text: 'What was wrong with it?',
                        isFollowUp: true,
                    },
                ],
            }),
        ]);
        await renderWindow();
        const [answer, followUp] = $$('.cue-bot');
        expect(followUp.querySelector('[aria-label="Good answer"]')).toBeNull();
        const good = answer.querySelector<HTMLButtonElement>(
            '[aria-label="Good answer"]',
        )!;
        expect(good.getAttribute('aria-pressed')).toBe('false');
        await press(good);
        const pressed = $$('.cue-bot')[0].querySelector(
            '[aria-label="Good answer"]',
        )!;
        expect(pressed.getAttribute('aria-pressed')).toBe('true');
        expect(pressed.querySelector('i')?.className).toBe(
            'bi bi-hand-thumbs-up-fill',
        );
        // A thumb up asks nothing more.
        expect($$('.cue-bot')).toHaveLength(2);
    });

    test('Copy puts the answer on the clipboard and says so, or says it could not', async () => {
        const writeText = vi.fn();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });
        writeText.mockResolvedValue(undefined);
        seedSessions([
            genSession({
                messages: [{ id: 1, author: 'bot', text: 'Copy these words.' }],
            }),
        ]);
        await renderWindow();
        const copy = findButton('Copy');
        expect(copy.title).toBe('Copy this answer');
        await press(copy);
        expect(writeText).toHaveBeenCalledWith('Copy these words.');
        expect(copy.textContent).toBe('✓ Copied');
        await flush(1600);
        expect(copy.textContent).toBe('Copy');
        writeText.mockRejectedValue(new Error('denied'));
        await press(copy);
        expect(copy.textContent).toBe('Could not copy');
        // Closed before the timer: nothing is set on a gone button.
        await unmountWindow();
        await flush(1600);
    });

    test('the buttons an answer carries, each drawn for what it does', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        plugTestTranslator({
            'Open {provider} billing': 'OPEN-BILLING {provider}',
            'Show me step by step': 'STEP-BY-STEP-KM',
        });
        seedSessions([
            genSession({
                provider: 'anthropic',
                messages: [
                    { id: 1, author: 'you', text: 'What happened?' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'The account is out of credit.',
                        actions: [
                            {
                                label: 'Open Claude billing',
                                toolName: 'owa-open-provider-page',
                                args: {
                                    provider: 'anthropic',
                                    page: 'billing',
                                },
                            },
                            {
                                label: 'Show me step by step',
                                toolName: 'owa_guide_start',
                                args: { manualId: 'W-04' },
                            },
                            {
                                label: 'Do it for me',
                                toolName: 'owa_guide_start',
                                args: { mode: 'demo' },
                            },
                            {
                                label: 'GEN 4:1',
                                toolName: 'owa-lookup-step',
                                isData: true,
                                title: 'Genesis 4:1',
                                args: {},
                            },
                        ],
                    },
                ],
            }),
        ]);
        await renderWindow();
        const buttons = $$<HTMLButtonElement>('.cue-actions .cue-act');
        const [page, guide, demo, data] = buttons;
        expect(page.className).toBe('cue-act cue-act-page');
        expect(page.textContent).toBe('OPEN-BILLING Claude');
        expect(page.title).toBe(
            'Opens https://platform.claude.com/settings/billing in your browser',
        );
        expect(page.querySelector('.bi-box-arrow-up-right')).not.toBeNull();
        expect(guide.className).toBe('cue-act cue-act-guide');
        // A label the dictionary has whole is drawn as the dictionary says.
        expect(guide.textContent).toBe('STEP-BY-STEP-KM');
        expect(demo.className).toBe('cue-act cue-act-demo');
        expect(data.className).toBe('cue-act cue-act-data');
        expect(data.textContent).toBe('GEN 4:1');
        expect(data.title).toBe('Genesis 4:1');
        await press(page);
        expect(h.openExternalURL).toHaveBeenCalledWith(
            'https://platform.claude.com/settings/billing',
        );
    });

    test('a pressed option goes back as the person’s own words', async () => {
        seedSessions([
            genSession({
                messages: [
                    { id: 1, author: 'you', text: 'Can I add a song?' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Do you want me to show you?',
                        replies: ['Yes, show me', 'No thanks'],
                    },
                ],
            }),
        ]);
        await renderWindow();
        expect(
            $$('.cue-reply').map((one) => {
                return one.textContent;
            }),
        ).toEqual(['Yes, show me', 'No thanks']);
        await press(findButton('Yes, show me'));
        expect(transcriptTexts('you')).toEqual([
            'Can I add a song?',
            'Yes, show me',
        ]);
        expect(h.askLlmBot).toHaveBeenCalled();
    });

    test('a Resources reading card keeps every reference pressable, wherever it is', async () => {
        seedSessions([
            genSession({
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text:
                            'Matthew 18:15 says to go and tell him his fault.\n' +
                            'References: Luke 17:3, Leviticus 19:17\n' +
                            'The PDF explains it on page 2.',
                        replies: ['16', '17', 'Full chapter'],
                    },
                    { id: 2, author: 'you', text: 'Thank you' },
                ],
            }),
        ]);
        await renderWindow();
        expect(
            $$('.cue-reply').map((one) => {
                return one.textContent;
            }),
        ).toEqual(['Luke 17:3', 'Leviticus 19:17', '16', '17', 'Full chapter']);
    });

    test('a drafted song shows its words before Create is pressed', async () => {
        const drafted = keepDraftedLyric(
            'Verse 1\nAmazing grace how sweet the sound\nThat saved a wretch like me',
        );
        seedSessions([
            genSession({
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'Here is the song.',
                        actions: [
                            {
                                label: 'Create "Amazing Grace"',
                                toolName: 'owa-lyric-create',
                                args: { reference: drafted.reference },
                            },
                        ],
                    },
                ],
            }),
        ]);
        await renderWindow();
        const preview = $<HTMLTextAreaElement>('.cue-lyric-text')!;
        expect(preview.value).toBe(drafted.content);
        expect(preview.readOnly).toBe(true);
        // Three lines, drawn no shorter than six.
        expect(preview.rows).toBe(6);
        expect($('.cue-lyric summary')?.textContent).toBe(
            'The song text, as it will be saved',
        );
    });

    test('a song this window no longer holds draws no preview', async () => {
        seedSessions([
            genSession({
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'Here is the song.',
                        actions: [
                            {
                                label: 'Create "Gone"',
                                toolName: 'owa-lyric-create',
                                args: { reference: 'lyric-gone' },
                            },
                        ],
                    },
                ],
            }),
        ]);
        await renderWindow();
        expect($('.cue-lyric')).toBeNull();
        expect(findButton('Create "Gone"')).toBeDefined();
    });

    test('what the assistant asks to be shown is a button that goes and gets it', async () => {
        const clickSpy = vi
            .spyOn(HTMLInputElement.prototype, 'click')
            .mockImplementation(() => {});
        seedSessions([
            genSession({
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'Can you show me?',
                        attachRequests: ['screenshot', 'element', 'file'],
                    },
                ],
            }),
        ]);
        await renderWindow();
        expect(
            $$('.cue-act-attach').map((one) => {
                return one.textContent?.trim();
            }),
        ).toEqual([
            'Send a picture of my screen',
            'Point at the control',
            'Attach a file',
        ]);
        await press(findButton('Attach a file'));
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });
});

// A `File` as the paperclip, a paste or a drop hands one over. jsdom's has
// no `text()`; Chromium's does.
function genFile(
    content: string | Uint8Array,
    name: string,
    type: string,
    appFilePath?: string,
) {
    const file = new File([content as BlobPart], name, { type });
    Object.defineProperty(file, 'text', {
        value: async () => {
            return typeof content === 'string' ? content : '';
        },
    });
    if (appFilePath !== undefined) {
        Object.defineProperty(file, 'appFilePath', { value: appFilePath });
    }
    return file;
}

async function pasteFiles(files: File[], text = '') {
    const box = $<HTMLTextAreaElement>('.chat-input')!;
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
        value: {
            items: [
                ...files.map((file) => {
                    return { kind: 'file', getAsFile: () => file };
                }),
                ...(text.length > 0
                    ? [{ kind: 'string', getAsFile: () => null }]
                    : []),
            ],
        },
    });
    await act(async () => {
        box.dispatchEvent(event);
    });
    // jsdom's FileReader answers on a timer of its own, not a microtask.
    await flush(20);
    await flush(20);
    return event;
}

async function dropFiles(files: File[]) {
    const form = $('.chat-ask')!;
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files } });
    await act(async () => {
        form.dispatchEvent(event);
    });
    await flush(20);
    await flush(20);
    return event;
}

function draftChipNames() {
    return $$('.chat-ask > .chat-clips .chat-clip-name').map((one) => {
        return one.textContent;
    });
}

function attachError() {
    return $('.chat-attach-error')?.textContent ?? null;
}

describe('attaching to the next question', () => {
    test('a pasted picture is a numbered chip with its picture and a copy icon', async () => {
        vi.stubGlobal('Image', FakeImage);
        seedSessions([
            genSession({
                messages: [
                    {
                        id: 1,
                        author: 'you',
                        text: 'Look at this',
                        attachments: [
                            {
                                id: 'old',
                                kind: 'image',
                                name: 'my screen',
                                mimeType: 'image/png',
                                byteSize: 10,
                                number: 2,
                            },
                        ],
                    },
                ],
            }),
        ]);
        await renderWindow();
        const event = await pasteFiles([
            genFile(new Uint8Array([137, 80, 78, 71]), 'shot.png', 'image/png'),
        ]);
        expect(event.defaultPrevented).toBe(true);
        expect(draftChipNames()).toEqual(['shot.png']);
        const chip = $('.chat-ask > .chat-clips .chat-clip')!;
        expect(chip.querySelector('img')?.getAttribute('src')).toMatch(
            /^data:image\/png;base64,/,
        );
        // One past the highest number already in the tab.
        expect(chip.querySelector('.chat-clip-number')?.textContent).toBe('3');
        expect(chip.getAttribute('title')).toBe(
            'shot.png — press to see it bigger',
        );
        expect(
            chip.querySelector('.chat-clip-copy')?.getAttribute('aria-label'),
        ).toBe('Copy shot.png to the clipboard');
    });

    test('pasting only words leaves the box to paste them', async () => {
        seedSessions([genSession()]);
        await renderWindow();
        const event = await pasteFiles([], 'just words');
        expect(event.defaultPrevented).toBe(false);
        expect(draftChipNames()).toEqual([]);
    });

    test('the copy icon copies the picture without opening it, and says how it went', async () => {
        vi.stubGlobal('Image', FakeImage);
        h.copyImageToClipboard.mockResolvedValue(undefined);
        seedSessions([genSession()]);
        await renderWindow();
        await pasteFiles([
            genFile(new Uint8Array([1, 2, 3]), 'shot.png', 'image/png'),
        ]);
        const icon = () => $<HTMLButtonElement>('.chat-clip-copy')!;
        expect(icon().title).toBe('Copy the picture to the clipboard');
        await press(icon());
        expect(h.copyImageToClipboard).toHaveBeenCalledWith(
            expect.stringMatching(/^data:image\/png;base64,/),
        );
        expect(icon().className).toBe('chat-clip-copy chat-clip-copy-done');
        expect(icon().title).toBe('Copied');
        expect(icon().querySelector('i')?.className).toBe('bi bi-check2');
        expect($('.chat-preview')).toBeNull();
        await flush(1600);
        expect(icon().className).toBe('chat-clip-copy');
        h.copyImageToClipboard.mockRejectedValue(new Error('denied'));
        await press(icon());
        expect(icon().className).toBe('chat-clip-copy chat-clip-copy-failed');
        expect(icon().title).toBe('Could not copy the picture');
        expect(icon().querySelector('i')?.className).toBe('bi bi-x-lg');
        // Enter on the icon is not Enter on the chip.
        await keyDown(icon(), { key: 'Enter' });
        expect($('.chat-preview')).toBeNull();
        await unmountWindow();
        await flush(1600);
    });

    test('a picture opens big, takes the keyboard, and gives it back when closed', async () => {
        vi.stubGlobal('Image', FakeImage);
        seedSessions([genSession()]);
        await renderWindow();
        await pasteFiles([
            genFile(new Uint8Array([1, 2, 3]), 'shot.png', 'image/png'),
        ]);
        const chip = $<HTMLElement>('.chat-ask > .chat-clips .chat-clip')!;
        chip.focus();
        await press(chip);
        const overlay = $<HTMLElement>('.chat-preview')!;
        expect(overlay.getAttribute('aria-label')).toBe('Preview of shot.png');
        expect(overlay.querySelector('img')?.getAttribute('alt')).toBe(
            'shot.png',
        );
        expect(document.activeElement).toBe(overlay);
        expect(
            $$('.chat-preview-tool').map((one) => {
                return one.textContent?.trim();
            }),
        ).toEqual(['Copy', 'Download', 'Close']);
        await press(findButton('Close'));
        expect($('.chat-preview')).toBeNull();
        expect(document.activeElement).toBe(chip);
    });

    test('a chip is taken off by its ×', async () => {
        seedSessions([genSession()]);
        await renderWindow();
        await dropFiles([
            genFile('Hello words', 'notes.txt', 'text/plain'),
            genFile('{}', 'report.docx', 'application/msword'),
        ]);
        expect(draftChipNames()).toEqual(['notes.txt']);
        expect(attachError()).toBe(
            'I cannot read report.docx — try a picture of it instead.',
        );
        await press($('[aria-label="Remove notes.txt"]'));
        expect(draftChipNames()).toEqual([]);
        expect(attachError()).toBeNull();
    });

    test('a drop reads text, a note’s words and a PDF’s pages, and refuses the rest by name', async () => {
        h.electronSendAsync.mockImplementation(async (channel: string) => {
            if (channel === 'main:app:pdf-to-chat-pages') {
                return {
                    isSuccessful: true,
                    pageCount: 3,
                    dataUrls: [PNG_DATA_URL],
                };
            }
            return channel === LIST_APP_WINDOWS_CHANNEL ? [] : null;
        });
        seedSessions([genSession()]);
        await renderWindow();
        const note = JSON.stringify({
            items: [{ title: 'Sermon notes', content: '' }],
        });
        await dropFiles([
            genFile('Line one', 'log.txt', 'text/plain'),
            genFile(note, 'sermon.own', ''),
            genFile('%PDF', 'LUK.6.pdf', 'application/pdf', '/docs/LUK.6.pdf'),
            genFile('%PDF', 'nopath.pdf', 'application/pdf'),
        ]);
        expect(draftChipNames()).toEqual([
            'log.txt',
            'sermon.own',
            'LUK.6.pdf',
        ]);
        expect(attachError()).toBe(
            'I cannot read nopath.pdf — try a picture of it instead.',
        );
        expect(h.electronSendAsync).toHaveBeenCalledWith(
            'main:app:pdf-to-chat-pages',
            { filePath: '/docs/LUK.6.pdf' },
        );
        const icons = $$('.chat-ask > .chat-clips .chat-clip > i').map(
            (one) => {
                return one.className;
            },
        );
        expect(icons).toEqual([
            'bi bi-file-earmark-text',
            'bi bi-file-earmark-text',
            'bi bi-file-earmark-pdf',
        ]);
    });

    test('a drop with nothing in it is left alone, and the oldest chips give way past four', async () => {
        seedSessions([genSession()]);
        await renderWindow();
        const empty = await dropFiles([]);
        expect(empty.defaultPrevented).toBe(false);
        await dropFiles([
            genFile('1', 'one.txt', 'text/plain'),
            genFile('2', 'two.txt', 'text/plain'),
            genFile('3', 'three.txt', 'text/plain'),
        ]);
        await dropFiles([
            genFile('4', 'four.txt', 'text/plain'),
            genFile('5', 'five.txt', 'text/plain'),
        ]);
        expect(draftChipNames()).toEqual([
            'two.txt',
            'three.txt',
            'four.txt',
            'five.txt',
        ]);
    });

    test('the paperclip’s choice is read the same way, and the box forgets it', async () => {
        seedSessions([genSession()]);
        await renderWindow();
        const input = $<HTMLInputElement>('.chat-file-input')!;
        Object.defineProperty(input, 'files', {
            configurable: true,
            value: [genFile('Chosen words', 'chosen.md', 'text/markdown')],
        });
        await act(async () => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await flush();
        await flush();
        expect(draftChipNames()).toEqual(['chosen.md']);
        expect(input.value).toBe('');
    });

    test('a picture that cannot be read is refused by its name', async () => {
        vi.stubGlobal('Image', FakeImage);
        seedSessions([genSession()]);
        await renderWindow();
        await pasteFiles([genFile('broken', 'broken.png', 'image/png')]);
        await flush();
        expect(draftChipNames()).toEqual([]);
        expect(attachError()).toBe(
            'I cannot read broken.png — try a picture of it instead.',
        );
    });
});

describe('the camera and the pointer', () => {
    test('the 📷 photographs the main window, or says why it could not', async () => {
        vi.stubGlobal('Image', FakeImage);
        h.windowEntries = [
            {
                id: 'W1',
                title: 'Open Worship app - Presenter',
                url: 'http://localhost:3000/presenter.html',
            },
        ];
        let captured: any = PNG_DATA_URL;
        h.electronSendAsync.mockImplementation(async (channel: string) => {
            if (channel === 'main:app:capture-window') {
                if (captured instanceof Error) {
                    throw captured;
                }
                return captured;
            }
            return channel === LIST_APP_WINDOWS_CHANNEL
                ? h.windowEntries
                : null;
        });
        plugTestTranslator({ 'my screen': 'MY-SCREEN' });
        seedSessions([genSession()]);
        await renderWindow();
        const camera = $('[aria-label="Attach a picture of the app"]')!;
        await press(camera);
        await flush();
        expect(draftChipNames()).toEqual(['MY-SCREEN']);
        // The main window it was of, said on its hover.
        expect(
            $('.chat-ask > .chat-clips .chat-clip')!.getAttribute('title'),
        ).toBe('MY-SCREEN (main window, Presenter) — press to see it bigger');
        captured = 'data:text/plain;base64,aGk=';
        await press(camera);
        await flush();
        expect(attachError()).toBe('I could not take a picture of the app.');
        captured = new Error('the window is hidden');
        await press(camera);
        await flush();
        expect(attachError()).toBe(
            'I could not take a picture: the window is hidden',
        );
    });

    test('with a window of its own chosen, the 📷 photographs that window', async () => {
        vi.stubGlobal('Image', FakeImage);
        h.windowEntries = [
            {
                id: 'W1',
                title: 'Open Worship app - Presenter',
                url: 'http://localhost:3000/presenter.html',
            },
            {
                id: 'W2',
                title: 'Open Worship app - Setting (⚙️)',
                url: 'http://localhost:3000/setting.html?uuid=setting',
            },
        ];
        h.callToolPicture.mockResolvedValue(PNG_DATA_URL);
        plugTestTranslator({
            'my {window} window': 'WINDOW-OF {window}',
            Settings: 'SETTINGS-KM',
        });
        seedSessions([genSession()]);
        await renderWindow();
        await chooseOption(getSelect('Which window'), 'W2');
        await press($('[aria-label="Attach a picture of the app"]'));
        await flush();
        expect(h.callToolPicture).toHaveBeenCalledWith(
            'owa_screenshot',
            {},
            null,
            { windowId: 'W2', focus: 'setting', isSeparateWindow: false },
        );
        expect(draftChipNames()).toEqual(['WINDOW-OF SETTINGS-KM']);
    });

    test('the ◎ says to point first, then attaches what was pointed at', async () => {
        const picked = genDeferred<string>();
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_pick_element' ? picked.promise : '{}';
        });
        seedSessions([genSession()]);
        await renderWindow();
        await press($('[aria-label="Point at a control in the app"]'));
        expect(attachError()).toBe(
            'Point at the control you mean in the app window…',
        );
        await act(async () => {
            picked.resolve(
                JSON.stringify({
                    picked: true,
                    element: {
                        label: 'Clear All [F6] Clear All',
                        labelParts: ['Clear All [F6]', 'Clear All'],
                        selector: '#clear-all',
                    },
                }),
            );
        });
        await flush();
        expect(attachError()).toBeNull();
        expect(draftChipNames()).toEqual(['Clear All']);
        const chip = $('.chat-ask > .chat-clips .chat-clip')!;
        expect(chip.querySelector('i')?.className).toBe('bi bi-bullseye');
        expect(chip.getAttribute('title')).toBe(
            'Clear All — press to ring it in the app',
        );
    });

    test('the ◎ says why nothing was attached', async () => {
        let answer: any = JSON.stringify({
            picked: false,
            reason: 'You pressed Escape.',
        });
        h.callTool.mockImplementation(async (name: string) => {
            if (name !== 'owa_pick_element') {
                return '{}';
            }
            if (answer instanceof Error) {
                throw answer;
            }
            return answer;
        });
        h.windowEntries = [
            {
                id: 'W1',
                title: 'Open Worship app - Presenter',
                url: 'http://localhost:3000/presenter.html',
            },
            {
                id: 'W2',
                title: 'Open Worship app - Setting (⚙️)',
                url: 'http://localhost:3000/setting.html?uuid=setting',
            },
        ];
        seedSessions([genSession()]);
        await renderWindow();
        const pointer = $('[aria-label="Point at a control in the app"]')!;
        await press(pointer);
        expect(attachError()).toBe('You pressed Escape.');
        answer = JSON.stringify({ picked: false });
        await press(pointer);
        expect(attachError()).toBe('Nothing was picked in the app window.');
        answer = new Error('host down');
        await press(pointer);
        expect(attachError()).toBe(
            'I could not do that just now. Try again in a moment.',
        );
        // In a window of its own, the line names that window.
        await chooseOption(getSelect('Which window'), 'W2');
        const waiting = genDeferred<string>();
        h.callTool.mockImplementation(async () => {
            return waiting.promise;
        });
        await press(pointer);
        expect(attachError()).toBe(
            'Point at the control you mean in the Settings window…',
        );
        await act(async () => {
            waiting.resolve('{}');
        });
        await flush();
    });
});

describe('pressing a chip under a message', () => {
    const SETTING_WINDOW = {
        id: 'W2',
        page: 'setting.html?uuid=setting',
        label: 'Settings',
        isMain: false,
    };

    function seedChips(attachments: any[], shows: any[] = []) {
        seedSessions([
            genSession({
                messages: [
                    { id: 1, author: 'you', text: 'Look', attachments },
                    { id: 2, author: 'bot', text: 'I see.', shows },
                ],
            }),
        ]);
    }

    function chipTitled(start: string) {
        const chip = $$<HTMLElement>('.chat-cues .chat-clip').find((one) => {
            return (one.getAttribute('title') ?? '').startsWith(start);
        });
        expect(chip, `a chip titled "${start}…"`).toBeDefined();
        return chip!;
    }

    test('a pointed-at control is rung in the window it was pointed at in', async () => {
        h.windowEntries = [
            {
                id: 'W1',
                title: 'Open Worship app - Presenter',
                url: 'http://localhost:3000/presenter.html',
            },
            {
                id: 'W2',
                title: 'Open Worship app - Setting (⚙️)',
                url: 'http://localhost:3000/setting.html?uuid=setting',
            },
        ];
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_highlight_selector'
                ? JSON.stringify({ found: false, reason: 'It has gone.' })
                : '{}';
        });
        seedChips([
            {
                id: 'e1',
                kind: 'element',
                name: 'Font Family',
                selector: '#font-family',
                window: SETTING_WINDOW,
            },
        ]);
        await renderWindow();
        const chip = chipTitled('Font Family (Settings window)');
        expect(chip.getAttribute('title')).toBe(
            'Font Family (Settings window) — press to ring it in the app',
        );
        await press(chip);
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_highlight_selector',
            { selector: '#font-family', page: 'W2' },
            null,
            null,
        );
        expect(attachError()).toBe('It has gone.');
    });

    test('a control pointed at before windows were kept goes the tab’s way', async () => {
        let answer: any = JSON.stringify({ found: false });
        h.callTool.mockImplementation(async (name: string) => {
            if (name !== 'owa_highlight_selector') {
                return '{}';
            }
            if (answer instanceof Error) {
                throw answer;
            }
            return answer;
        });
        seedChips([
            {
                id: 'e1',
                kind: 'element',
                name: 'Clear All',
                selector: '#clear-all',
                window: {
                    id: 'W1',
                    page: 'presenter.html',
                    label: 'Presenter',
                    isMain: true,
                },
            },
            {
                id: 'e2',
                kind: 'element',
                name: 'Show Screen',
                selector: '#show',
            },
        ]);
        await renderWindow();
        expect(chipTitled('Clear All').getAttribute('title')).toBe(
            'Clear All (main window, Presenter) — press to ring it in the app',
        );
        await press(chipTitled('Show Screen'));
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_highlight_selector',
            { selector: '#show' },
            null,
            null,
        );
        expect(attachError()).toBe('I could not point at that one any more.');
        answer = new Error('host down');
        await keyDown(chipTitled('Show Screen'), { key: 'Enter' });
        expect(attachError()).toBe(
            'I could not do that just now. Try again in a moment.',
        );
    });

    test('a control with no selector is looked for by its words', async () => {
        let shownCount: any = 1;
        h.callTool.mockImplementation(async (name: string) => {
            if (name !== 'owa_find_ui') {
                return '{}';
            }
            if (shownCount instanceof Error) {
                throw shownCount;
            }
            return JSON.stringify({ shownCount });
        });
        seedChips([{ id: 'e1', kind: 'element', name: 'Clear All' }]);
        await renderWindow();
        // Found by UT-94 (2026-11-03): its hover promised to OPEN it, and the
        // press rings it, like every other pointed-at control.
        expect(chipTitled('Clear All').getAttribute('title')).toBe(
            'Clear All — press to ring it in the app',
        );
        await press(chipTitled('Clear All'));
        expect(h.callTool).toHaveBeenCalledWith('owa_find_ui', {
            text: 'Clear All',
            highlight: true,
        });
        expect(attachError()).toBeNull();
        shownCount = 0;
        await press(chipTitled('Clear All'));
        expect(attachError()).toBe(
            'I could not find "Clear All" on screen any more.',
        );
        shownCount = new Error('host down');
        await press(chipTitled('Clear All'));
        expect(attachError()).toBe(
            'I could not find "Clear All" on screen any more.',
        );
    });

    test('a control an answer shows is looked up as the window is now', async () => {
        let shownCount: any = 0;
        h.callTool.mockImplementation(async (name: string) => {
            if (name !== 'owa_find_ui') {
                return '{}';
            }
            if (shownCount instanceof Error) {
                throw shownCount;
            }
            return JSON.stringify({ shownCount });
        });
        plugTestTranslator({ 'Clear All': 'CLEAR-ALL-KM' });
        seedChips(
            [],
            [
                { kind: 'control', value: 'Clear All', name: 'Clear All' },
                { kind: 'selector', value: '#bible', name: 'Bible button' },
            ],
        );
        await renderWindow();
        const chip = chipTitled('CLEAR-ALL-KM');
        expect(chip.getAttribute('title')).toBe(
            'CLEAR-ALL-KM — press to ring it in the app',
        );
        expect(chip.querySelector('i')?.className).toBe('bi bi-bullseye');
        await press(chip);
        expect(h.callTool).toHaveBeenCalledWith('owa_find_ui', {
            text: 'Clear All',
            highlight: true,
        });
        expect(attachError()).toBe('I could not find "Clear All" on screen.');
        shownCount = new Error('host down');
        await press(chip);
        expect(attachError()).toBe(
            'I could not do that just now. Try again in a moment.',
        );
        expect(chipTitled('Bible button').getAttribute('title')).toBe(
            'Bible button — press to ring it in the app',
        );
    });

    test('a file opens as a card, sized, with its folder one press on', async () => {
        h.readAssetPreview.mockResolvedValue({
            id: 'show:file:/videos/clip.mp4',
            name: 'clip.mp4',
            kind: 'file',
            imageDataUrl: null,
            text: null,
            filePath: '/videos/clip.mp4',
            byteSize: 2048,
            note: null,
        });
        seedChips(
            [
                {
                    id: 'f1',
                    kind: 'file',
                    name: 'LUK.6.pdf',
                    mimeType: 'application/pdf',
                    filePath: '/docs/LUK.6.pdf',
                },
                {
                    id: 'p1',
                    kind: 'text',
                    name: 'photo.png',
                    filePath: '/pictures/photo.png',
                },
            ],
            [{ kind: 'file', value: '/videos/clip.mp4', name: 'clip.mp4' }],
        );
        await renderWindow();
        expect(chipTitled('LUK.6.pdf').querySelector('i')?.className).toBe(
            'bi bi-file-earmark-pdf',
        );
        expect(chipTitled('photo.png').querySelector('i')?.className).toBe(
            'bi bi-image',
        );
        const clip = chipTitled('clip.mp4');
        expect(clip.getAttribute('title')).toBe('clip.mp4 — press to open it');
        await press(clip);
        const card = $('.chat-preview-card')!;
        expect(card.querySelector('.chat-preview-card-name')?.textContent).toBe(
            'clip.mp4',
        );
        expect(card.querySelector('.chat-preview-card-size')?.textContent).toBe(
            '2 KB',
        );
        expect(card.querySelector('.chat-preview-card-note')?.textContent).toBe(
            'This window cannot show this kind of file. Download it or open its folder to look at it.',
        );
        expect(
            $$('.chat-preview-tool').map((one) => {
                return one.textContent?.trim();
            }),
        ).toEqual(['Download', 'Open folder', 'Close']);
    });

    test('a card says what it has to say instead of a size it does not know', async () => {
        h.readAssetPreview.mockResolvedValue({
            id: 'x',
            name: 'huge.png',
            kind: 'file',
            imageDataUrl: null,
            text: null,
            filePath: null,
            byteSize: null,
            note: 'That picture is too large to show here.',
        });
        seedChips([
            {
                id: 'h1',
                kind: 'text',
                name: 'huge.png',
                filePath: '/pictures/huge.png',
            },
        ]);
        await renderWindow();
        await press(chipTitled('huge.png'));
        expect($('.chat-preview-card-size')).toBeNull();
        expect($('.chat-preview-card-note')?.textContent).toBe(
            'That picture is too large to show here.',
        );
        expect($('.chat-preview-tool')?.textContent?.trim()).toBe('Download');
    });

    test('words the window holds open as a document; a click in them keeps it open', async () => {
        seedChips([
            {
                id: 't1',
                kind: 'text',
                name: 'notes.txt',
                summary:
                    'The user attached a file called "notes.txt":\nBring the hymn books.',
            },
        ]);
        await renderWindow();
        await press(chipTitled('notes.txt'));
        const text = $<HTMLElement>('.chat-preview-text')!;
        expect(text.getAttribute('role')).toBe('document');
        expect(text.getAttribute('aria-label')).toBe('notes.txt');
        expect(text.textContent).toBe('Bring the hymn books.');
        await press(text);
        expect($('.chat-preview')).not.toBeNull();
        await press($('.chat-preview'));
        expect($('.chat-preview')).toBeNull();
    });

    test('a picture whose bytes went with the window says so and offers nothing', async () => {
        plugTestTranslator({
            'app screen': 'APP-SCREEN',
            'my {window} window': 'WINDOW-OF {window}',
            Settings: 'SETTINGS-KM',
        });
        seedChips([
            {
                id: 'g1',
                kind: 'image',
                name: 'app screen',
                mimeType: 'image/png',
            },
            {
                id: 'g2',
                kind: 'image',
                name: 'my Settings window',
                mimeType: 'image/png',
                window: SETTING_WINDOW,
            },
            {
                id: 'g3',
                kind: 'image',
                name: 'holiday.jpg',
                mimeType: 'image/jpeg',
            },
            { id: 'g4', kind: 'text', name: 'empty.txt' },
        ]);
        await renderWindow();
        const gone = chipTitled('APP-SCREEN');
        expect(gone.classList.contains('chat-clip-gone')).toBe(true);
        expect(gone.getAttribute('role')).toBeNull();
        expect(gone.getAttribute('title')).toBe(
            'APP-SCREEN — not attached any more',
        );
        // A name that says its window already is not told it twice.
        expect(chipTitled('WINDOW-OF SETTINGS-KM').getAttribute('title')).toBe(
            'WINDOW-OF SETTINGS-KM — not attached any more',
        );
        expect(chipTitled('holiday.jpg').querySelector('i')?.className).toBe(
            'bi bi-image',
        );
        // Nothing left of a word file that never held its words.
        await press(chipTitled('empty.txt'));
        expect(attachError()).toBe(
            'There is nothing left to show for that one.',
        );
    });

    test('Ask again brings the question back with what it was asked with', async () => {
        seedSessions([
            genSession({
                messages: [
                    {
                        id: 1,
                        author: 'you',
                        text: 'Explain it in simple words',
                        attachments: [
                            {
                                id: 'f1',
                                kind: 'file',
                                name: 'MAT.18.pdf',
                                mimeType: 'application/pdf',
                                filePath: '/res/pdf/MAT.18.pdf',
                                number: 1,
                            },
                        ],
                    },
                    { id: 2, author: 'bot', text: 'It says forgive.' },
                    { id: 3, author: 'you', text: 'More please' },
                ],
                fileClosedAt: 3,
            }),
        ]);
        await renderWindow();
        expect(draftChipNames()).toEqual([]);
        const [askAgain] = $$<HTMLButtonElement>('.cue-you .cue-tool');
        await press(askAgain);
        expect($<HTMLTextAreaElement>('.chat-input')!.value).toBe(
            'Explain it in simple words',
        );
        expect(draftChipNames()).toEqual(['MAT.18.pdf']);
        // Pressed again, the same file is not added twice.
        await press(askAgain);
        expect(draftChipNames()).toEqual(['MAT.18.pdf']);
    });
});

describe('what the tab is still asking about', () => {
    test('a person’s card rides above the box until its × puts it away', async () => {
        seedSessions([
            genSession({
                messages: [
                    {
                        id: 4,
                        author: 'bot',
                        text: 'I have read Adam.',
                        lookup: {
                            kind: 'name',
                            target: 'adam',
                            title: 'Adam',
                            facts: '{"kind":"name","name":"Adam"}',
                        },
                    },
                ],
            }),
        ]);
        await renderWindow();
        const line = $('.chat-open-files')!;
        expect(line.textContent).toContain('Still asking about');
        expect(line.querySelector('.chat-clip-name')?.textContent).toBe('Adam');
        await press($('[aria-label="Remove Adam"]'));
        expect($('.chat-open-files')).toBeNull();
        await flush(400);
        expect(readSavedSessions().sessions[0].lookupClosedAt).toBe(4);
    });

    test('a Resources PDF rides above the box with its caution, until its × closes it', async () => {
        h.resourceFolders = ['/res'];
        seedSessions([
            genSession({
                messages: [
                    {
                        id: 1,
                        author: 'you',
                        text: 'What does it say?',
                        attachments: [
                            {
                                id: 'f1',
                                kind: 'file',
                                name: 'LUK.6.pdf',
                                mimeType: 'application/pdf',
                                filePath: '/res/pdf/LUK.6.pdf',
                            },
                        ],
                    },
                    { id: 2, author: 'bot', text: 'It says love.' },
                ],
            }),
        ]);
        await renderWindow();
        expect($('.chat-open-files')?.textContent).toContain('LUK.6.pdf');
        expect($('.chat-ask .chat-caution')?.textContent).toContain(
            'AI analysis can make mistakes.',
        );
        await press($('.chat-open-files [aria-label="Remove LUK.6.pdf"]'));
        expect($('.chat-open-files')).toBeNull();
        expect($('.chat-ask .chat-caution')).toBeNull();
        await flush(400);
        expect(readSavedSessions().sessions[0].fileClosedAt).toBe(2);
    });
});

describe('answers that land after the words have moved on', () => {
    test('corpus rows for words since replaced are not drawn', async () => {
        const stale = genDeferred<any[]>();
        h.suggestQuestions.mockImplementation(
            (query: string, ...rest: any[]) => {
                return query === 'backg'
                    ? stale.promise
                    : h.originalSuggestQuestions!(query, ...rest);
            },
        );
        seedSessions([genSession()]);
        await renderWindow();
        await typeQuestion('backg');
        await typeQuestion('background');
        const fresh = suggestionTexts();
        expect(fresh.length).toBeGreaterThan(0);
        await act(async () => {
            stale.resolve([
                {
                    id: 'stale',
                    text: 'A row for the old words',
                    sectionLabel: 'Old',
                },
            ]);
        });
        await flush();
        expect(suggestionTexts()).toEqual(fresh);
        expect(suggestionTexts()).not.toContain('A row for the old words');
    });
});
