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

// The help window in Khmer, on one mock surface for the whole window: the
// settings store, the main process (sync and async), the tool host and
// the model, each a file-local `vi.fn`; the window's own helpers stay real.
// Moved out of `src/chatbot/ChatbotAppComp.ui2.ut99` / `.ui3.ut99.test.tsx`
// (these cases need this package): a found verse named the way its Bible
// writes it, and a verse remembered in Khmer whose translation is stopped,
// or whose translator cannot be looked for.
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
    isClientSettingBroken: false,
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

vi.mock('../../../../../../server/appProvider', () => ({
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
                    if (h.isClientSettingBroken) {
                        throw new Error('main is not answering');
                    }
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
vi.mock('../../../../../../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    getSettingForce: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string | null) => {
        h.settings.set(key, value ?? '');
    },
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('../../../../../../server/electronSendHelpers', () => ({
    genReturningEventName: (name: string) => `${name}-return`,
    electronSendAsync: (...args: any[]) => h.electronSendAsync(...args),
}));
vi.mock('../../../../../../chatbot/mcpClient', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../chatbot/mcpClient')
    >()),
    callTool: (...args: any[]) => h.callTool(...args),
    callToolPicture: (...args: any[]) => h.callToolPicture(...args),
}));
vi.mock('../../../../../../chatbot/llmBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../chatbot/llmBotHelpers')
    >()),
    askLlmBot: (...args: any[]) => h.askLlmBot(...args),
    listAllLlmModels: (...args: any[]) => h.listAllLlmModels(...args),
}));
vi.mock(
    '../../../../../../chatbot/attachmentHelpers',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/attachmentHelpers')
        >()),
        copyImageToClipboard: (...args: any[]) =>
            h.copyImageToClipboard(...args),
    }),
);
vi.mock(
    '../../../../../../chatbot/assetPreviewHelpers',
    async (importOriginal) => {
        const original =
            await importOriginal<
                typeof import('../../../../../../chatbot/assetPreviewHelpers')
            >();
        h.originalReadAssetPreview = original.readAssetPreview;
        return {
            ...original,
            readAssetPreview: (...args: any[]) => h.readAssetPreview(...args),
            downloadAsset: (...args: any[]) => h.downloadAsset(...args),
        };
    },
);
vi.mock('../../../../../../chatbot/questionHelpers', async (importOriginal) => {
    const original =
        await importOriginal<
            typeof import('../../../../../../chatbot/questionHelpers')
        >();
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
vi.mock(
    '../../../../../../resources/resourcesFolderHelpers',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../../../resources/resourcesFolderHelpers')
        >()),
        getResourcesFolderList: () => h.resourceFolders,
    }),
);

import ChatbotAppComp from '../../../../../../chatbot/ChatbotAppComp';
import { setChatTranslator } from '../../../../../../chatbot/chatTranHelpers';
import { resetSpendGuardForTests } from '../../../../../../chatbot/spendGuardHelpers';
import { setCurrentWindowAim } from '../../../../../../chatbot/windowAimHelpers';
import { loadLlmRegistry } from '../../../../../../helper/ai/customServerHelpers';

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
    h.isClientSettingBroken = false;
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

function $<T extends Element = HTMLElement>(selector: string) {
    return container.querySelector<T & Element>(selector) as T | null;
}

function $$<T extends Element = HTMLElement>(selector: string) {
    return [...container.querySelectorAll(selector)] as T[];
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

afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as any).clipboard;
    document.documentElement.lang = '';
});

async function waitForAsk(count = 1) {
    for (
        let round = 0;
        round < 20 && h.askLlmBot.mock.calls.length < count;
        round++
    ) {
        await flush(10);
    }
    expect(h.askLlmBot.mock.calls.length).toBeGreaterThanOrEqual(count);
}

async function sendQuestion(text: string) {
    await typeQuestion(text);
    await press($('.chat-send'));
    await flush(10);
}

describe('a window shown in Khmer', () => {
    test('a found verse’s button names it the way its Bible writes it', async () => {
        document.documentElement.lang = 'km';
        seedSessions([
            genSession({
                messages: [
                    { id: 1, author: 'you', text: 'Where is it?' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'It is John 3:16.',
                        actions: [
                            {
                                label: 'Open John 3:16 in Bible Lookup',
                                toolName: 'owa_find_verse',
                                args: {
                                    action: 'open',
                                    ref: 'JHN 3:16',
                                    title: 'យ៉ូហាន ៣:១៦',
                                },
                            },
                        ],
                    },
                ],
            }),
        ]);
        await renderWindow();
        const [verse] = $$<HTMLButtonElement>('.cue-actions .cue-act');
        expect(verse.textContent).toBe('Open យ៉ូហាន ៣:១៦ in Bible Lookup');
    });
});

describe('Stop while their words are being put into English', () => {
    test('stops the search with the translation, and asks nobody else', async () => {
        h.customServers = [
            {
                id: 'lab',
                name: 'LM Studio',
                baseUrl: 'http://192.168.1.5:1234/v1',
                models: [
                    { id: 'm1', model: 'gemma-4-e4b', name: 'Gemma 4 E4B' },
                ],
            },
        ];
        h.electronSendAsync.mockImplementation(async (channel: string) => {
            if (channel === 'main:app:custom-llm-fetch') {
                return {
                    ok: true,
                    status: 200,
                    contentType: 'application/json',
                    text: '{"data":[]}',
                };
            }
            return channel === LIST_APP_WINDOWS_CHANNEL ? [] : null;
        });
        h.askLlmBot.mockImplementation((...args: any[]) => {
            if (args[6]?.isTranslation !== true) {
                return Promise.resolve({ text: 'Should not be asked.' });
            }
            const signal: AbortSignal = args[5];
            return new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject(new DOMException('Stopped', 'AbortError'));
                });
            });
        });
        const words = 'ស្រឡាញ់ខ្មាំងសត្រូវ';
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        await sendQuestion(`Help me find a Bible verse in "KJV": ${words}`);
        await waitForAsk(1);
        expect($('.chat-stop')).not.toBeNull();
        await press($('.chat-stop'));
        await flush(10);
        await flush(10);
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        // The head start never ran: their words were not searched.
        expect(h.callTool).not.toHaveBeenCalledWith('owa_find_verse', {
            bible: 'KJV',
            words,
        });
        expect($('.chat-stop')).toBeNull();
    });
});

describe('a translator that cannot be looked for', () => {
    test('is no translator: the search goes on with their own words', async () => {
        const words = 'ស្រឡាញ់ខ្មាំងសត្រូវ';
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        // Main stops answering the setting reads once the window is up.
        h.isClientSettingBroken = true;
        await sendQuestion(`Help me find a Bible verse in "KJV": ${words}`);
        await waitForAsk();
        expect(
            h.askLlmBot.mock.calls.some((call) => {
                return call[6]?.isTranslation === true;
            }),
        ).toBe(false);
        expect(h.callTool).toHaveBeenCalledWith('owa_find_verse', {
            bible: 'KJV',
            words,
        });
    });
});
