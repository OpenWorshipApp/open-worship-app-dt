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
    return {
        ...original,
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

import ChatbotAppComp, { describeRegistryStatus } from './ChatbotAppComp';
import { setChatTranslator } from './chatTranHelpers';
import { suggestQuestions } from './questionHelpers';
import { resetSpendGuardForTests } from './spendGuardHelpers';
import { describeUsageBriefly, describeUsageInFull } from './usageHelpers';
import { READER_DEMO_LIST } from '../../tools/owa-devtools-mcp/readerDemos.mjs';
import { getCurrentWindowAim, setCurrentWindowAim } from './windowAimHelpers';
import { loadLlmRegistry } from '../helper/ai/customServerHelpers';

const LIST_APP_WINDOWS_CHANNEL = 'main:app:list-app-windows';
const APP_WINDOWS_CHANGED_CHANNEL = 'main:app:app-windows-changed';
const REGISTRY_GET_CHANNEL = 'main:app:llm-registry';
const REGISTRY_RELOAD_CHANNEL = 'main:app:llm-registry-reload';
const LAUNCH_FOCUS_CHANNEL = 'main:app:chatbot-launch-focus';

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

function emit(channel: string, ...args: any[]) {
    for (const listener of [...(h.listeners.get(channel) ?? [])]) {
        listener(...args);
    }
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
    await suggestQuestions('background', 'presenter');
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

describe('the shared registry title', () => {
    test('says how the last read of the registry went', () => {
        const title = 'Reload the assistants shared on openworship.app';
        expect(describeRegistryStatus(null)).toBe(title);
        expect(
            describeRegistryStatus({
                url: 'https://www.openworship.app/llm/info.json',
                servers: [],
                fetchedAt: 1,
                error: 'offline',
            }),
        ).toBe(`${title} — the last read failed: offline`);
        expect(
            describeRegistryStatus({
                url: 'https://www.openworship.app/llm/info.json',
                servers: [{ id: 'a' }, { id: 'b' }] as any,
                fetchedAt: null,
                error: null,
            }),
        ).toBe(`${title} — 2 shared`);
        const fetchedAt = new Date(2026, 10, 3, 9, 30).getTime();
        expect(
            describeRegistryStatus({
                url: 'https://www.openworship.app/llm/info.json',
                servers: [{ id: 'a' }] as any,
                fetchedAt,
                error: null,
            }),
        ).toBe(
            `${title} — 1 shared, read at ${new Date(fetchedAt).toLocaleTimeString()}`,
        );
    });
});

describe('opening the window', () => {
    test('tells the app nothing is busy and takes the busy mark off the title', async () => {
        document.title = '🟠 App Help';
        await renderWindow();
        expect(h.sendData).toHaveBeenCalledWith('all:app:chatbot-busy', {
            isBusy: false,
        });
        expect(document.title).toBe('App Help');
        expect(h.electronSendAsync).toHaveBeenCalledWith(
            LIST_APP_WINDOWS_CHANNEL,
        );
        expect(h.electronSendAsync).toHaveBeenCalledWith(REGISTRY_GET_CHANNEL);
    });

    test('listens to main while open and stops listening when closed', async () => {
        await renderWindow();
        expect(h.listeners.get(LAUNCH_FOCUS_CHANNEL)?.size).toBe(3);
        expect(h.listeners.get(APP_WINDOWS_CHANGED_CHANNEL)?.size).toBe(1);
        await unmountWindow();
        expect(h.listeners.get(LAUNCH_FOCUS_CHANNEL)?.size).toBe(0);
        expect(h.listeners.get(APP_WINDOWS_CHANGED_CHANNEL)?.size).toBe(0);
        expect(h.removeListener).toHaveBeenCalledWith(
            APP_WINDOWS_CHANGED_CHANNEL,
            expect.any(Function),
        );
    });

    test('a later launch from another window puts the tab on that window', async () => {
        seedSessions([genSession({ focus: 'presenter', isFocusChosen: true })]);
        await renderWindow();
        expect(getSelect('Which part of the app').value).toBe('presenter');
        await act(async () => {
            emit(LAUNCH_FOCUS_CHANNEL, {}, '/reader.html');
        });
        await flush();
        expect(getSelect('Which part of the app').value).toBe('reader');
    });
});

const MAIN_WINDOW_ENTRY = {
    id: 'W1',
    title: 'Open Worship app - Presenter',
    url: 'http://localhost:3000/presenter.html',
};
const SETTING_WINDOW_ENTRY = {
    id: 'W2',
    title: 'Open Worship app - Setting (⚙️)',
    url: 'http://localhost:3000/setting.html?uuid=setting',
};
const LAB_SERVER = {
    id: 'lab',
    name: 'LM Studio',
    baseUrl: 'http://192.168.1.5:1234/v1',
    models: [
        { id: 'm1', model: 'gemma-4-e4b', name: 'Gemma 4 E4B' },
        { id: 'm2', model: 'qwen3-8b', name: 'Qwen 3 8B' },
    ],
};

function countCalls(mock: { mock: { calls: any[][] } }, first: string) {
    return mock.mock.calls.filter((call) => {
        return call[0] === first;
    }).length;
}

function optionTexts(select: HTMLSelectElement) {
    return [...select.options].map((option) => {
        return option.textContent;
    });
}

describe('what the window reads again while it is open', () => {
    test('a key saved in Settings is offered once the window is focused again', async () => {
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        const claude = () => {
            return [...getSelect('Which assistant answers').options].find(
                (option) => {
                    return option.value === 'anthropic';
                },
            )!;
        };
        expect(claude().textContent).toBe('Claude — needs an API key');
        expect(claude().hasAttribute('data-needs-key')).toBe(true);
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        await act(async () => {
            window.dispatchEvent(new Event('focus'));
        });
        await flush();
        expect(claude().textContent).toBe('Claude');
        expect(claude().hasAttribute('data-needs-key')).toBe(false);
    });

    test('a tab on a deleted model row moves to its server’s first model', async () => {
        h.customServers = [LAB_SERVER];
        seedSessions([genSession({ provider: 'custom', model: 'lab/m2' })]);
        await renderWindow();
        expect(getSelect('Which assistant answers').value).toBe('custom/lab');
        expect(getSelect('Which model answers').value).toBe('lab/m2');
        h.customServers = [{ ...LAB_SERVER, models: [LAB_SERVER.models[0]] }];
        await act(async () => {
            window.dispatchEvent(new Event('focus'));
        });
        await flush();
        expect(getSelect('Which model answers').value).toBe('lab/m1');
        expect(optionTexts(getSelect('Which model answers'))).toEqual([
            'Gemma 4 E4B',
        ]);
    });

    test('a tab on a deleted server moves to the window’s own default', async () => {
        h.settings.set('chatbot-llm-auto', 'false');
        h.customServers = [LAB_SERVER];
        seedSessions([genSession({ provider: 'custom', model: 'lab/m1' })]);
        await renderWindow();
        expect(getSelect('Which assistant answers').value).toBe('custom/lab');
        h.customServers = [];
        await act(async () => {
            window.dispatchEvent(new Event('focus'));
        });
        await flush();
        expect(getSelect('Which assistant answers').value).toBe('free');
        expect(
            [...getSelect('Which assistant answers').options].some((option) => {
                return option.value === 'custom/lab';
            }),
        ).toBe(false);
    });

    test('the shared registry’s servers are rows, and Reload says how the read went', async () => {
        const fetchedAt = Date.now();
        h.registryStatus = {
            url: 'https://www.openworship.app/llm/info.json',
            servers: [
                {
                    id: 'registry-lab',
                    name: 'Church Lab',
                    baseUrl: 'https://shared-server.invalid/v1',
                    isFree: true,
                    models: [
                        {
                            id: 'gemma',
                            model: 'gemma4:12b',
                            name: 'Gemma 4 12B',
                            note: { '': 'Slow, but it saves us the cost.' },
                        },
                    ],
                },
            ],
            fetchedAt,
            error: null,
        };
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        const reload = $<HTMLButtonElement>('.chat-registry-reload')!;
        expect(reload.title).toBe(describeRegistryStatus(h.registryStatus));
        expect(reload.title).toContain('1 shared, read at');
        const assistant = getSelect('Which assistant answers');
        expect(optionTexts(assistant)).toContain('Church Lab');
        // The registry's row asks that server's model, and its word on it
        // is drawn under the pickers.
        expect($('.chat-model-notice')).toBeNull();
        await chooseOption(assistant, 'custom/registry-lab');
        expect(getSelect('Which assistant answers').value).toBe(
            'custom/registry-lab',
        );
        expect(getSelect('Which model answers').value).toBe(
            'registry-lab/gemma',
        );
        expect(h.settings.get('chatbot-llm-model-custom')).toBe(
            'registry-lab/gemma',
        );
        expect($('.chat-model-notice')?.textContent?.trim()).toBe(
            'Slow, but it saves us the cost.',
        );
        // Reload: busy while main reads the site, then the failure is said
        // on the button.
        let finishReload: (value: any) => void = () => {};
        h.electronSendAsync.mockImplementation(async (channel: string) => {
            if (channel === REGISTRY_RELOAD_CHANNEL) {
                return new Promise((resolve) => {
                    finishReload = resolve;
                });
            }
            return channel === LIST_APP_WINDOWS_CHANNEL ? [] : null;
        });
        await press(reload);
        expect(reload.disabled).toBe(true);
        expect(reload.querySelector('i')?.className).toContain(
            'spinner-border',
        );
        await act(async () => {
            finishReload({ ...h.registryStatus, error: 'no answer' });
        });
        await flush();
        expect(reload.disabled).toBe(false);
        expect(reload.title).toBe(
            'Reload the assistants shared on openworship.app — the last read failed: no answer',
        );
        expect(h.electronSendAsync).toHaveBeenCalledWith(
            REGISTRY_RELOAD_CHANNEL,
        );
    });
});

describe('the window the tab works in', () => {
    test('is offered only with a second window open, and moves the tab with it', async () => {
        h.windowEntries = [MAIN_WINDOW_ENTRY];
        seedSessions([genSession()]);
        await renderWindow();
        expect($('.chat-window-row')).toBeNull();
        h.windowEntries = [MAIN_WINDOW_ENTRY, SETTING_WINDOW_ENTRY];
        await act(async () => {
            emit(APP_WINDOWS_CHANGED_CHANNEL);
        });
        await flush();
        const row = $('.chat-window-row')!;
        expect(row.textContent).toContain('Working in');
        expect(row.classList.contains('is-aimed')).toBe(false);
        const picker = getSelect('Which window');
        expect(picker.value).toBe('W1');
        expect(optionTexts(picker)).toEqual([
            'Presenter · main window',
            'Setting (⚙️) · own window',
        ]);
        await chooseOption(picker, 'W2');
        expect($('.chat-window-row')!.classList.contains('is-aimed')).toBe(
            true,
        );
        expect(getSelect('Which part of the app').value).toBe('setting');
        expect(getCurrentWindowAim()).toEqual({
            windowId: 'W2',
            focus: 'setting',
            isSeparateWindow: false,
        });
        await chooseOption(getSelect('Which window'), 'W1');
        expect($('.chat-window-row')!.classList.contains('is-aimed')).toBe(
            false,
        );
        expect(getSelect('Which part of the app').value).toBe('presenter');
        expect(getCurrentWindowAim()).toBeNull();
    });

    test('asking about another kind of window lets go of the one chosen', async () => {
        h.windowEntries = [MAIN_WINDOW_ENTRY, SETTING_WINDOW_ENTRY];
        seedSessions([genSession()]);
        await renderWindow();
        await chooseOption(getSelect('Which window'), 'W2');
        expect(getCurrentWindowAim()?.windowId).toBe('W2');
        await chooseOption(getSelect('Which part of the app'), 'reader');
        expect(getSelect('Which part of the app').value).toBe('reader');
        expect(getCurrentWindowAim()).toBeNull();
        expect($('.chat-window-row')!.classList.contains('is-aimed')).toBe(
            false,
        );
    });

    test('the list is asked again on a press, on focus and on main’s word', async () => {
        h.windowEntries = [MAIN_WINDOW_ENTRY, SETTING_WINDOW_ENTRY];
        seedSessions([genSession()]);
        await renderWindow();
        expect(countCalls(h.electronSendAsync, LIST_APP_WINDOWS_CHANNEL)).toBe(
            1,
        );
        await act(async () => {
            getSelect('Which window').dispatchEvent(
                new MouseEvent('mousedown', { bubbles: true }),
            );
        });
        await flush();
        expect(countCalls(h.electronSendAsync, LIST_APP_WINDOWS_CHANNEL)).toBe(
            2,
        );
        // Settings closed: one window left, and the line goes.
        h.windowEntries = [MAIN_WINDOW_ENTRY];
        await act(async () => {
            window.dispatchEvent(new Event('focus'));
        });
        await flush();
        expect(countCalls(h.electronSendAsync, LIST_APP_WINDOWS_CHANNEL)).toBe(
            3,
        );
        expect($('.chat-window-row')).toBeNull();
        // A list main cannot give, or gives in some other shape, is no list.
        h.windowEntries = [MAIN_WINDOW_ENTRY, SETTING_WINDOW_ENTRY];
        await act(async () => {
            emit(APP_WINDOWS_CHANGED_CHANNEL);
        });
        await flush();
        expect($('.chat-window-row')).not.toBeNull();
        h.electronSendAsync.mockImplementation(async (channel: string) => {
            if (channel === LIST_APP_WINDOWS_CHANNEL) {
                throw new Error('main went away');
            }
            return null;
        });
        await act(async () => {
            emit(APP_WINDOWS_CHANGED_CHANNEL);
        });
        await flush();
        expect($('.chat-window-row')).toBeNull();
        h.electronSendAsync.mockImplementation(async (channel: string) => {
            return channel === LIST_APP_WINDOWS_CHANNEL ? 'nonsense' : null;
        });
        h.windowEntries = [];
        await act(async () => {
            emit(APP_WINDOWS_CHANGED_CHANNEL);
        });
        await flush();
        expect($('.chat-window-row')).toBeNull();
    });

    describe('opened from another window', () => {
        afterEach(() => {
            delete (window as any).opener;
        });

        test('starts working in the window it was opened from', async () => {
            Object.defineProperty(window, 'opener', {
                configurable: true,
                get: () => {
                    return {
                        location: {
                            href: SETTING_WINDOW_ENTRY.url,
                            pathname: '/setting.html',
                        },
                    };
                },
            });
            h.windowEntries = [MAIN_WINDOW_ENTRY, SETTING_WINDOW_ENTRY];
            await renderWindow();
            expect(getSelect('Which part of the app').value).toBe('setting');
            expect(getSelect('Which window').value).toBe('W2');
            expect($('.chat-window-row')!.classList.contains('is-aimed')).toBe(
                true,
            );
            // A later press from the main window's page is the main
            // window again: no aim of its own.
            await act(async () => {
                emit(LAUNCH_FOCUS_CHANNEL, {}, '/presenter.html');
            });
            await flush();
            expect(getSelect('Which part of the app').value).toBe('presenter');
            expect(getCurrentWindowAim()).toBeNull();
            expect($('.chat-window-row')!.classList.contains('is-aimed')).toBe(
                false,
            );
        });

        test('an opener that cannot be read leaves the main window standing', async () => {
            Object.defineProperty(window, 'opener', {
                configurable: true,
                get: () => {
                    return {
                        get location(): any {
                            throw new Error('Blocked a frame');
                        },
                    };
                },
            });
            h.windowEntries = [MAIN_WINDOW_ENTRY, SETTING_WINDOW_ENTRY];
            await renderWindow();
            expect(getSelect('Which part of the app').value).toBe('presenter');
            expect(getSelect('Which window').value).toBe('W1');
            expect(getCurrentWindowAim()).toBeNull();
        });
    });
});

describe('the assistant picker', () => {
    test('a row with no key opens Settings at its key box and leaves the tab alone', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        const assistant = getSelect('Which assistant answers');
        expect(assistant.title).toBe('Free answers your questions here');
        const free = [...assistant.options].find((option) => {
            return option.value === 'free';
        })!;
        expect(free.title).toBe(' — no key needed, shared public service');
        await chooseOption(assistant, 'anthropic');
        expect(openSpy).toHaveBeenCalledTimes(1);
        expect(String(openSpy.mock.calls[0][0])).toContain(
            '/setting.html?uuid=setting',
        );
        expect(h.settings.get('setting-tabs')).toBe('a');
        expect(
            JSON.parse(h.settings.get('setting-ai-key-focus')!).keyName,
        ).toBe('anthropicAPIKey');
        expect(getSelect('Which assistant answers').value).toBe('free');
    });

    test('a row with a key moves the tab and is what a new tab starts on', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        await chooseOption(getSelect('Which assistant answers'), 'anthropic');
        expect(getSelect('Which assistant answers').value).toBe('anthropic');
        expect(getSelect('Which assistant answers').title).toBe(
            'Claude answers your questions here',
        );
        expect(h.settings.get('chatbot-llm-provider')).toBe('anthropic');
        expect(h.settings.get('chatbot-llm-auto')).toBe('false');
        expect(optionTexts(getSelect('Which model answers'))).toEqual([
            'Opus 5',
            'Sonnet 5',
            'Haiku 4.5',
            'More models…',
        ]);
        await chooseOption(
            getSelect('Which model answers'),
            'claude-haiku-4-5',
        );
        expect(getSelect('Which model answers').value).toBe('claude-haiku-4-5');
        expect(h.settings.get('chatbot-llm-model-anthropic')).toBe(
            'claude-haiku-4-5',
        );
    });

    test('an arrow on the closed list steps over a row with no key', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        seedSessions([genSession({ provider: 'anthropic' })]);
        await renderWindow();
        const arrowOnto = async (key: string, value: string, init = {}) => {
            const select = getSelect('Which assistant answers');
            await act(async () => {
                select.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key,
                        bubbles: true,
                        ...init,
                    }),
                );
                Object.getOwnPropertyDescriptor(
                    HTMLSelectElement.prototype,
                    'value',
                )!.set!.call(select, value);
                select.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await flush();
        };
        // Down onto ChatGPT (no key): on to the next row that can answer.
        await arrowOnto('ArrowDown', 'openai');
        expect(getSelect('Which assistant answers').value).toBe('free');
        // Up onto ChatGPT: back to the one before it that can.
        await arrowOnto('ArrowUp', 'openai');
        expect(getSelect('Which assistant answers').value).toBe('anthropic');
        expect(openSpy).not.toHaveBeenCalled();
        // Alt+arrow is the OS opening the list, not a step: the landing is a
        // press, and asks for the key.
        await arrowOnto('ArrowDown', 'openai', { altKey: true });
        expect(openSpy).toHaveBeenCalledTimes(1);
        expect(getSelect('Which assistant answers').value).toBe('anthropic');
    });

    test('an arrow with nowhere left to step to changes nothing', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        const select = getSelect('Which assistant answers');
        await act(async () => {
            select.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
            );
            Object.getOwnPropertyDescriptor(
                HTMLSelectElement.prototype,
                'value',
            )!.set!.call(select, 'anthropic');
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await flush();
        expect(openSpy).not.toHaveBeenCalled();
        expect(getSelect('Which assistant answers').value).toBe('free');
        // The step is forgotten straight after the key: the next landing
        // on the same row is a press.
        await chooseOption(getSelect('Which assistant answers'), 'anthropic');
        expect(openSpy).toHaveBeenCalledTimes(1);
    });

    test('Auto keeps the tab on Auto, and a named row ends it', async () => {
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        await chooseOption(getSelect('Which assistant answers'), '::auto::');
        expect(getSelect('Which assistant answers').value).toBe('::auto::');
        expect(getSelect('Which assistant answers').title).toContain(
            'Auto picks the best assistant that costs nothing',
        );
        expect(h.settings.get('chatbot-llm-auto')).toBe('true');
        expect($('.chat-auto-pick')?.textContent).toBe(
            'chosen at each question',
        );
        expect($('select[aria-label="Which model answers"]')).toBeNull();
        await chooseOption(getSelect('Which assistant answers'), 'free');
        expect(getSelect('Which assistant answers').value).toBe('free');
        expect($('.chat-auto-pick')).toBeNull();
        expect(h.settings.get('chatbot-llm-auto')).toBe('false');
    });

    test('Auto names who answered the last question, open and folded', async () => {
        seedSessions([
            genSession({
                provider: 'free',
                model: 'nvidia/nemotron-3.5-super-vl:free',
                isAuto: true,
                autoPick: 'Free · Nemotron Super VL',
            }),
        ]);
        await renderWindow();
        const pick = $('.chat-auto-pick')!;
        expect(pick.textContent).toBe('Free · Nemotron Super VL');
        expect(pick.title).toMatch(
            /^Free · Nemotron Super VL answered the last question\. Auto picks/,
        );
        await press($('.chat-head-fold'));
        expect($('.chat-head-summary')?.textContent).toBe(
            'Presenter · Auto · Free · Nemotron Super VL',
        );
    });

    test('folded, a named assistant reads as the pickers’ own words', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        seedSessions([
            genSession({ provider: 'anthropic', model: 'claude-sonnet-5' }),
        ]);
        await renderWindow();
        await press($('.chat-head-fold'));
        expect($('.chat-head-summary')?.textContent).toBe(
            'Presenter · Claude · Sonnet 5',
        );
    });

    test('a model picked off the account’s own list is named by its id', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        seedSessions([
            genSession({ provider: 'anthropic', model: 'claude-x-1' }),
        ]);
        await renderWindow();
        expect(getSelect('Which model answers').value).toBe('claude-x-1');
        expect(optionTexts(getSelect('Which model answers'))[0]).toBe(
            'claude-x-1',
        );
        expect(getSelect('Which model answers').title).toBe('claude-x-1');
        await press($('.chat-head-fold'));
        expect($('.chat-head-summary')?.textContent).toBe(
            'Presenter · Claude · claude-x-1',
        );
    });

    test('More models asks the account and lists what it can run', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        let finishListing: (value: any) => void = () => {};
        h.listAllLlmModels.mockImplementation(() => {
            return new Promise((resolve) => {
                finishListing = resolve;
            });
        });
        seedSessions([genSession({ provider: 'anthropic' })]);
        await renderWindow();
        await chooseOption(getSelect('Which model answers'), '::more::');
        expect(h.listAllLlmModels).toHaveBeenCalledWith('anthropic');
        expect(getSelect('Which model answers').disabled).toBe(true);
        expect(optionTexts(getSelect('Which model answers'))).toContain(
            'Loading…',
        );
        await act(async () => {
            finishListing([
                {
                    id: 'claude-opus-5',
                    label: 'Opus 5',
                    note: '',
                    speed: '',
                    price: '',
                },
                {
                    id: 'claude-legacy-3',
                    label: 'Legacy 3',
                    note: '',
                    speed: '',
                    price: '',
                },
            ]);
        });
        await flush();
        expect(getSelect('Which model answers').disabled).toBe(false);
        expect(optionTexts(getSelect('Which model answers'))).toEqual([
            'Opus 5',
            'Legacy 3',
            'More models…',
        ]);
    });

    test('a catalogue that cannot be read is said above the conversation', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        h.listAllLlmModels.mockRejectedValue(new Error('401 refused'));
        seedSessions([genSession({ provider: 'anthropic' })]);
        await renderWindow();
        await chooseOption(getSelect('Which model answers'), '::more::');
        expect($('.chat-alert')?.textContent).toBe(
            'The other models could not be listed — 401 refused',
        );
        expect(getSelect('Which model answers').disabled).toBe(false);
    });

    test('the gear opens the AI panel itself, no box in particular', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
        await renderWindow();
        await press($('.chat-head-setting'));
        expect(openSpy).toHaveBeenCalledTimes(1);
        expect(h.settings.get('setting-tabs')).toBe('a');
        expect(
            JSON.parse(h.settings.get('setting-ai-key-focus')!).keyName,
        ).toBeNull();
    });
});

function genDeferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
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

describe('the empty window', () => {
    test('a fill-in starter goes into the box instead of being asked', async () => {
        await renderWindow();
        const template = $$<HTMLButtonElement>('.chat-starter').find((one) => {
            return (
                one.title ===
                'Press to put this in the box, then change the example to yours'
            );
        });
        expect(template).toBeDefined();
        await press(template!);
        const box = $<HTMLTextAreaElement>('.chat-input')!;
        expect(box.value).toBe(template!.textContent);
        expect(document.activeElement).toBe(box);
        expect(h.askLlmBot).not.toHaveBeenCalled();
        expect($('.chat-cues')).toBeNull();
    });

    test('the starters follow the window the tab asks about, whatever lands late', async () => {
        const presenterAnswer = genDeferred<any[]>();
        h.getStarterQuestions.mockImplementation((focus: string) => {
            if (focus === 'presenter') {
                return presenterAnswer.promise;
            }
            return Promise.resolve([
                { text: 'A question about reading', isTemplate: false },
            ]);
        });
        seedSessions([genSession()]);
        await renderWindow();
        await chooseOption(getSelect('Which part of the app'), 'reader');
        expect($$('.chat-empty .chat-starters')[0].textContent).toContain(
            'A question about reading',
        );
        await act(async () => {
            presenterAnswer.resolve([
                { text: 'A question about presenting', isTemplate: false },
            ]);
        });
        await flush();
        expect($('.chat-empty')?.textContent).not.toContain(
            'A question about presenting',
        );
        expect($('.chat-empty')?.textContent).toContain(
            'A question about reading',
        );
    });

    test('More lists everything under its headings, and a row is pressed like a chip', async () => {
        h.getAllQuestions.mockResolvedValue([
            {
                label: 'Screens',
                questions: [
                    {
                        text: 'What does the Mini Screen show?',
                        isTemplate: false,
                    },
                    { text: 'Put verse ... on the screen', isTemplate: true },
                ],
            },
            {
                label: 'Bible',
                questions: [
                    { text: 'Where is the Bible list?', isTemplate: false },
                ],
            },
        ]);
        seedSessions([genSession()]);
        await renderWindow();
        await press($('.chat-more'));
        expect($('.chat-more')?.textContent).toBe('Fewer');
        expect($('.chat-all-count')?.textContent).toBe(
            '3 questions it is ready for here. Type a few words in the box to narrow them down.',
        );
        expect(
            $$('.chat-all-group .chat-eyebrow').map((one) => {
                return one.textContent;
            }),
        ).toEqual(['Screens', 'Bible']);
        const rowOf = (text: string) => {
            return $$<HTMLButtonElement>('.chat-all .chat-starter').find(
                (one) => {
                    return one.textContent === text;
                },
            )!;
        };
        await press(rowOf('Put verse ... on the screen'));
        expect($<HTMLTextAreaElement>('.chat-input')!.value).toBe(
            'Put verse ... on the screen',
        );
        await press(rowOf('What does the Mini Screen show?'));
        expect(transcriptTexts('you')[0]).toContain(
            'What does the Mini Screen show?',
        );
        expect(h.askLlmBot).toHaveBeenCalled();
    });

    test('a list that could not be read is said plainly', async () => {
        h.getAllQuestions.mockResolvedValue([]);
        await renderWindow();
        await press($('.chat-more'));
        expect($('.chat-empty')?.textContent).toContain(
            'The full list is not available right now — the four above still work, and so does anything you type.',
        );
    });

    test('the list of another window that lands late is not drawn', async () => {
        const presenterList = genDeferred<any[]>();
        h.getAllQuestions.mockImplementation((focus: string) => {
            return focus === 'presenter'
                ? presenterList.promise
                : Promise.resolve([
                      {
                          label: 'Reader',
                          questions: [
                              { text: 'Reader row', isTemplate: false },
                          ],
                      },
                  ]);
        });
        seedSessions([genSession()]);
        await renderWindow();
        await press($('.chat-more'));
        expect($('.chat-empty')?.textContent).toContain('Fetching the list…');
        await chooseOption(getSelect('Which part of the app'), 'reader');
        await act(async () => {
            presenterList.resolve([
                {
                    label: 'Presenter',
                    questions: [{ text: 'Presenter row', isTemplate: false }],
                },
            ]);
        });
        await flush();
        expect($('.chat-all')?.textContent).toContain('Reader row');
        expect($('.chat-all')?.textContent).not.toContain('Presenter row');
    });

    test('the Reader offers its guided demos, which need no model', async () => {
        seedSessions([genSession({ focus: 'reader' })]);
        await renderWindow();
        const block = $('.chat-demo-block')!;
        expect(block.querySelector('.chat-eyebrow')?.textContent).toBe(
            'Try a guided demo',
        );
        expect(block.querySelector('.chat-demo-note')?.textContent).toBe(
            'No AI model or account needed. Press one, then use Do it in the Reader for one safe step at a time.',
        );
        expect(block.querySelector('.chat-demo-note b')?.textContent).toBe(
            'Do it',
        );
        const featured = READER_DEMO_LIST.filter((demo) => {
            return demo.isFeatured !== false;
        });
        const demos = $$<HTMLButtonElement>('.chat-demo');
        expect(demos).toHaveLength(featured.length);
        expect(demos[0].getAttribute('aria-label')).toBe(
            `${featured[0].label}. ${featured[0].detail}`,
        );
        await press(demos[0]);
        expect(transcriptTexts('you')[0]).toContain(
            `Guided demo: ${featured[0].label}`,
        );
        expect(h.callTool).toHaveBeenCalledWith('owa_guide_start', {
            demoId: featured[0].id,
        });
        expect(transcriptTexts('bot')[0]).toContain(
            'I could not start the walkthrough for that one.',
        );
    });
});

describe('the notice over a free conversation', () => {
    test('opens in full, folds itself to its first sentence, and a fold by hand sticks', async () => {
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        const warn = $('.chat-warn')!;
        expect(warn.textContent).toContain(
            'Answers are coming from a free public AI service (Kilo Code)',
        );
        const fold = () => $<HTMLButtonElement>('.chat-warn-fold')!;
        expect(fold().getAttribute('aria-expanded')).toBe('true');
        expect(fold().textContent).toBe('Fold');
        await flush(9000);
        expect($('.chat-warn')!.classList.contains('is-folded')).toBe(true);
        expect(fold().getAttribute('aria-expanded')).toBe('false');
        expect(fold().textContent).toBe(
            'Answers are coming from a free public AI service (Kilo Code), which needs no API key.',
        );
        expect(fold().title).toBe('Read the whole notice');
        await press(fold());
        expect($('.chat-warn')!.classList.contains('is-folded')).toBe(false);
        // Opened by hand: no timer folds it again.
        await flush(20000);
        expect($('.chat-warn')!.classList.contains('is-folded')).toBe(false);
        expect(fold().title).toBe('Fold this notice');
    });

    test('names who answers, with a link to their own site', async () => {
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        const links = $('.chat-warn-links')!;
        expect(links.textContent).toContain('Who answers:');
        const kilo = findButton('Kilo Code');
        expect(kilo.title).toBe('Open https://kilo.ai');
        await press(kilo);
        expect(h.openExternalURL).toHaveBeenCalledWith('https://kilo.ai');
    });

    test('can be put away for 30 days, and opens the AI settings', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        const warnLinks = $$<HTMLButtonElement>('.chat-warn .chat-warn-link');
        await press(
            warnLinks.find((one) => {
                return one.textContent === 'Open AI settings';
            })!,
        );
        expect(openSpy).toHaveBeenCalledTimes(1);
        await press(
            $$<HTMLButtonElement>('.chat-warn .chat-warn-link').find((one) => {
                return one.textContent === 'Hide for 30 days';
            })!,
        );
        expect($('.chat-warn')).toBeNull();
        expect(
            Number(localStorage.getItem('ai-provider-warn-hidden-until')),
        ).toBeGreaterThan(Date.now());
    });

    test('an Auto tab carries its own notice, which opens again for a new subject', async () => {
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        await flush(9000);
        expect($('.chat-warn')!.classList.contains('is-folded')).toBe(true);
        await chooseOption(getSelect('Which assistant answers'), '::auto::');
        expect($('.chat-warn')!.classList.contains('is-folded')).toBe(false);
        expect($('.chat-warn-body')?.textContent).toContain(
            'Auto picks an assistant that costs nothing for each question',
        );
    });

    test('a paid assistant carries no notice', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        seedSessions([genSession({ provider: 'anthropic' })]);
        await renderWindow();
        expect($('.chat-warn')).toBeNull();
    });
});

describe('the spend guard and the bill', () => {
    test('a cap set by a command is one of the choices, and the picker sets another', async () => {
        h.settings.set('chatbot-spend-limit', '0.05');
        await renderWindow();
        const limit = getSelect('Spending limit per hour');
        expect(limit.value).toBe('0.05');
        expect(optionTexts(limit)).toEqual([
            '$0.05',
            '$0.25',
            '$0.50',
            '$1',
            '$2',
            '$5',
            '$10',
            '$20',
            'No limit',
        ]);
        await chooseOption(limit, '2');
        expect(h.settings.get('chatbot-spend-limit')).toBe('2');
        expect(getSelect('Spending limit per hour').value).toBe('2');
    });

    test('paused, the head says so, and Allow more lifts it', async () => {
        const now = Date.now();
        h.settings.set('chatbot-spend-limit', '1');
        h.settings.set(
            'chatbot-spend-ledger',
            JSON.stringify({
                rounds: [[now - 1000, 5000, 1.2]],
                resetAt: 0,
                trippedAt: now - 500,
                trippedBy: 'money',
            }),
        );
        await renderWindow();
        expect($('.chat-spend')!.classList.contains('is-paused')).toBe(true);
        expect($('.chat-spend-value')?.textContent).toContain('paused');
        await press($('.chat-head-fold'));
        expect($('.chat-head-spend')!.classList.contains('is-paused')).toBe(
            true,
        );
        await press($('.chat-head-fold'));
        await press($('.chat-spend-allow'));
        expect($('.chat-spend-allow')).toBeNull();
        expect($('.chat-spend')!.classList.contains('is-paused')).toBe(false);
        expect(
            JSON.parse(h.settings.get('chatbot-spend-ledger')!).trippedAt,
        ).toBeNull();
    });

    test('past four fifths of the cap the corner turns amber', async () => {
        h.settings.set('chatbot-spend-limit', '1');
        h.settings.set(
            'chatbot-spend-ledger',
            JSON.stringify({
                rounds: [[Date.now() - 1000, 5000, 0.85]],
                resetAt: 0,
                trippedAt: null,
                trippedBy: null,
            }),
        );
        await renderWindow();
        expect($('.chat-spend')!.classList.contains('is-near')).toBe(true);
        expect($('.chat-spend-allow')).toBeNull();
    });

    test('the tab’s running bill is a line under the pickers', async () => {
        const usage = {
            rounds: 2,
            unpricedRounds: 0,
            input: 1200,
            cacheRead: 0,
            cacheWrite: 0,
            output: 300,
            costUsd: 0.0123,
        };
        seedSessions([genSession({ usage })]);
        await renderWindow();
        const credit = $('.chat-credit')!;
        expect(credit.querySelector('.chat-pick-caption')?.textContent).toBe(
            'Credit used',
        );
        expect(credit.querySelector('.chat-credit-value')?.textContent).toBe(
            describeUsageBriefly(usage),
        );
        expect(
            credit.querySelector<HTMLElement>('.chat-credit-field')?.title,
        ).toBe(describeUsageInFull(usage));
    });
});

describe('the tab strip', () => {
    const genTabs = () => {
        return [
            genSession({
                id: 's1',
                messages: [
                    { id: 1, author: 'you', text: 'First tab question' },
                ],
            }),
            genSession({
                id: 's2',
                messages: [
                    { id: 1, author: 'you', text: 'Second tab question' },
                ],
            }),
            genSession({
                id: 's3',
                messages: [
                    { id: 1, author: 'you', text: 'Third tab question' },
                ],
            }),
        ];
    };

    function tabNames() {
        return $$('.chat-tab-name').map((one) => {
            return one.textContent;
        });
    }

    function activeTabName() {
        return $('.chat-tab-name[aria-selected="true"]')?.textContent;
    }

    async function openTabMenu(title: string) {
        await press($(`.chat-tab-menu[aria-label="More for ${title}"]`));
    }

    test('a new tab opens in front, and choosing a tab brings its conversation', async () => {
        seedSessions(genTabs(), 's1');
        await renderWindow();
        expect(tabNames()).toEqual([
            'First tab question',
            'Second tab question',
            'Third tab question',
        ]);
        await press($$('.chat-tab-name')[1]);
        expect(activeTabName()).toBe('Second tab question');
        expect(transcriptTexts('you')).toEqual(['Second tab question']);
        await press($('.chat-tab-add'));
        expect(tabNames()).toHaveLength(4);
        expect(activeTabName()).toBe('New chat');
        expect($('.chat-cues')).toBeNull();
        await flush(400);
        expect(readSavedSessions().sessions).toHaveLength(4);
    });

    test('closing a tab moves to its right, its left at the end, and leaves an empty tab last', async () => {
        seedSessions(genTabs(), 's2');
        await renderWindow();
        await press($('[aria-label="Close Second tab question"]'));
        expect(tabNames()).toEqual([
            'First tab question',
            'Third tab question',
        ]);
        expect(activeTabName()).toBe('Third tab question');
        // Not the tab in front: the front one stays.
        await press($('[aria-label="Close First tab question"]'));
        expect(tabNames()).toEqual(['Third tab question']);
        expect(activeTabName()).toBe('Third tab question');
        await press($('[aria-label="Close Third tab question"]'));
        expect(tabNames()).toEqual(['New chat']);
        expect(activeTabName()).toBe('New chat');
    });

    test('closing the last tab in the strip moves to its left', async () => {
        seedSessions(genTabs(), 's3');
        await renderWindow();
        await press($('[aria-label="Close Third tab question"]'));
        expect(activeTabName()).toBe('Second tab question');
    });

    test('a tab is renamed by a double-click, its words tidied', async () => {
        seedSessions(genTabs(), 's1');
        await renderWindow();
        await act(async () => {
            $$('.chat-tab-name')[0].dispatchEvent(
                new MouseEvent('dblclick', { bubbles: true }),
            );
        });
        await flush();
        const input = $<HTMLInputElement>('.chat-tab-input')!;
        await act(async () => {
            Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )!.set!.call(input, '  Sunday    notes  ');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await keyDown($('.chat-tab-input')!, { key: 'Enter' });
        expect(tabNames()[0]).toBe('Sunday notes');
        await flush(400);
        expect(readSavedSessions().sessions[0].title).toBe('Sunday notes');
    });

    test('a locked tab has no ×, and Clear all keeps it', async () => {
        seedSessions(genTabs(), 's1');
        await renderWindow();
        await openTabMenu('First tab question');
        await press(findButton('Lock this chat'));
        expect($('[aria-label="First tab question is locked"]')).not.toBeNull();
        expect($('[aria-label="Close First tab question"]')).toBeNull();
        await openTabMenu('Second tab question');
        await press(findButton('Clear all chats…'));
        await press(findButton('Clear all'));
        expect(tabNames()).toEqual(['First tab question']);
        expect(activeTabName()).toBe('First tab question');
        // Written at once, not on the debounce.
        const saved = readSavedSessions();
        expect(saved.sessions).toHaveLength(1);
        expect(saved.sessions[0].isLocked).toBe(true);
        await openTabMenu('First tab question');
        await press(findButton('Unlock this chat'));
        expect($('[aria-label="Close First tab question"]')).not.toBeNull();
    });

    test('Close other chats keeps the one asked for and every locked one', async () => {
        const tabs = genTabs();
        tabs[0].isLocked = true;
        seedSessions(tabs, 's2');
        await renderWindow();
        await openTabMenu('Third tab question');
        await press(findButton('Close other chats…'));
        await press(findButton('Close them'));
        expect(tabNames()).toEqual([
            'First tab question',
            'Third tab question',
        ]);
        expect(activeTabName()).toBe('Third tab question');
        const saved = readSavedSessions();
        expect(saved.activeId).toBe('s3');
        expect(
            saved.sessions.map((one: any) => {
                return one.id;
            }),
        ).toEqual(['s1', 's3']);
    });

    test('Clear all with nothing locked leaves one empty tab', async () => {
        seedSessions(genTabs(), 's1');
        await renderWindow();
        await openTabMenu('First tab question');
        await press(findButton('Clear all chats…'));
        await press(findButton('Clear all'));
        expect(tabNames()).toEqual(['New chat']);
        const saved = readSavedSessions();
        expect(saved.sessions).toHaveLength(1);
        expect(saved.activeId).toBe(saved.sessions[0].id);
    });
});
