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

// The help window drawn whole, with its effects running: the head's pickers,
// the tab strip, the suggestion list, the tip line and the busy/Stop path.
// Only the boundaries are faked -- the IPC, the settings store, the tool host
// and the model -- each answering from state a test seeds.
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
            isWithoutAnyProvider: false,
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
    const original = await importOriginal<typeof import('./llmBotHelpers')>();
    return {
        ...original,
        // A build with no assistant to offer at all -- the keyless one taken
        // out -- is a state of the head only this boundary can produce.
        getAvailableLlmProviders: () => {
            return state.isWithoutAnyProvider
                ? []
                : original.getAvailableLlmProviders();
        },
        getLlmProvider: () => {
            return state.isWithoutAnyProvider
                ? null
                : original.getLlmProvider();
        },
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
import {
    clearProgressSteps,
    genProgressReporter,
    genSessionProgress,
} from './progressHelpers';
import {
    APP_WINDOWS_CHANGED_CHANNEL,
    LIST_APP_WINDOWS_CHANNEL,
} from './windowAimHelpers';
import {
    CUSTOM_LLM_SERVERS_SETTING_KEY,
    LLM_REGISTRY_GET_CHANNEL,
    LLM_REGISTRY_RELOAD_CHANNEL,
} from '../../electron/customLlmProtocol';

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

async function pressKey(
    target: Element,
    key: string,
    init: KeyboardEventInit = {},
) {
    await act(async () => {
        target.dispatchEvent(
            new KeyboardEvent('keydown', {
                key,
                bubbles: true,
                cancelable: true,
                ...init,
            }),
        );
    });
    await settle();
}

async function pickOption(select: HTMLSelectElement | null, value: string) {
    expect(select).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(select, value);
        select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
}

// An arrow on a CLOSED list: the OS changes the value inside the same key
// press, before any timer the keydown set can run.
async function arrowPick(
    select: HTMLSelectElement,
    key: 'ArrowDown' | 'ArrowUp',
    value: string,
    init: KeyboardEventInit = {},
) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        select.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true, ...init }),
        );
        setter.call(select, value);
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
}

function emit(channel: string, ...args: any[]) {
    for (const listener of [...(state.listeners.get(channel) ?? [])]) {
        listener({}, ...args);
    }
}

function lastBotText() {
    return queryAll('.cue-bot').at(-1)?.textContent ?? '';
}

function getSelect(label: string) {
    return query<HTMLSelectElement>(`select[aria-label="${label}"]`);
}

function genDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: any) => void;
    const promise = new Promise<T>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
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
    state.isWithoutAnyProvider = false;
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

describe('starter questions and the full list', () => {
    test('the corpus replaces the fallback chips once it has loaded', async () => {
        mocks.getStarterQuestions.mockResolvedValue([
            { text: 'How do I show the next slide?', isTemplate: false },
        ]);
        await renderApp();
        expect(mocks.getStarterQuestions).toHaveBeenCalledWith('presenter');
        const chips = queryAll('.chat-empty .chat-starters .chat-starter').map(
            (chip) => {
                return chip.textContent;
            },
        );
        expect(chips).toEqual(['How do I show the next slide?']);
    });

    test('More lists every group with a total, and a template row fills the box', async () => {
        mocks.getAllQuestions.mockResolvedValue([
            {
                label: 'Screens',
                questions: [
                    { text: 'How do I turn a screen on?', isTemplate: false },
                    { text: 'Show the verse ... please', isTemplate: true },
                ],
            },
            {
                label: 'Bible',
                questions: [
                    { text: 'Where is Bible Find?', isTemplate: false },
                ],
            },
        ]);
        await renderApp();
        await click(query('.chat-more'));
        expect(mocks.getAllQuestions).toHaveBeenCalledWith('presenter');
        expect(query('.chat-all-count')?.textContent).toBe(
            '3 questions it is ready for here. Type a few words in the box to narrow them down.',
        );
        const groupLabels = queryAll('.chat-all-group .chat-eyebrow').map(
            (label) => {
                return label.textContent;
            },
        );
        expect(groupLabels).toEqual(['Screens', 'Bible']);
        await click(findButton('Show the verse ... please'));
        expect(query<HTMLTextAreaElement>('.chat-input')!.value).toBe(
            'Show the verse ... please',
        );
        // The template went into the box; nothing was asked of a model.
        expect(queryAll('.cue')).toHaveLength(0);
        expect(mocks.askLlmBot).not.toHaveBeenCalled();
    });

    test('a list that lands after the tab moved to another window is dropped', async () => {
        const late = genDeferred<any[]>();
        mocks.getAllQuestions.mockImplementation((focus: string) => {
            return focus === 'presenter' ? late.promise : Promise.resolve([]);
        });
        await renderApp();
        await click(query('.chat-more'));
        await pickOption(getSelect('Which part of the app'), 'reader');
        expect(mocks.getAllQuestions).toHaveBeenLastCalledWith('reader');
        await act(async () => {
            late.resolve([
                {
                    label: 'Screens',
                    questions: [
                        { text: 'A Presenter question', isTemplate: false },
                    ],
                },
            ]);
        });
        await settle();
        expect(container.textContent).not.toContain('A Presenter question');
        expect(container.textContent).toContain(
            'The full list is not available right now',
        );
    });

    test('a corpus that failed to load says so instead of an empty list', async () => {
        mocks.getAllQuestions.mockResolvedValue([]);
        await renderApp();
        await click(query('.chat-more'));
        expect(container.textContent).toContain(
            'The full list is not available right now',
        );
        expect(query('.chat-all')).toBeNull();
    });
});

describe('the Reader guided demos', () => {
    test('a Reader tab offers the featured demos and a press starts its walkthrough', async () => {
        seedSessions([genSession({ focus: 'reader' })]);
        const { READER_DEMO_LIST } =
            await import('../../tools/owa-devtools-mcp/readerDemos.mjs');
        const featured = READER_DEMO_LIST.filter((demo: any) => {
            return demo.isFeatured !== false;
        });
        mocks.callTool.mockResolvedValue(
            JSON.stringify({ isRunning: true, stepCount: 3 }),
        );
        await renderApp();
        expect(query('#reader-demo-title')?.textContent).toBe(
            'Try a guided demo',
        );
        const demoButtons = queryAll<HTMLButtonElement>('.chat-demo');
        expect(demoButtons).toHaveLength(featured.length);
        expect(demoButtons[0].getAttribute('aria-label')).toBe(
            `${featured[0].label}. ${featured[0].detail}`,
        );
        await click(demoButtons[0]);
        expect(mocks.callTool).toHaveBeenCalledWith(
            'owa_guide_start',
            expect.objectContaining({ demoId: featured[0].id }),
        );
        expect(query('.cue-you')?.textContent).toContain(
            `Guided demo: ${featured[0].label}`,
        );
    });

    test('the Presenter has no demo shelf', async () => {
        await renderApp();
        expect(query('.chat-demo-block')).toBeNull();
    });
});

describe('the assistant and model pickers', () => {
    test('a provider with no key opens Settings at its key box and the tab keeps its provider', async () => {
        seedKeys({ anthropicAPIKey: 'sk-ant' });
        seedNamedProvider('anthropic');
        await renderApp();
        const providerSelect = getSelect('Which assistant answers')!;
        expect(providerSelect.value).toBe('anthropic');
        expect(providerSelect.title).toBe('Claude answers your questions here');
        const openAiOption = providerSelect.querySelector<HTMLOptionElement>(
            'option[value="openai"]',
        )!;
        expect(openAiOption.textContent).toBe('ChatGPT — needs an API key');
        expect(openAiOption.hasAttribute('data-needs-key')).toBe(true);
        const freeOption = providerSelect.querySelector<HTMLOptionElement>(
            'option[value="free"]',
        )!;
        expect(freeOption.title).toBe(
            ' — no key needed, shared public service',
        );
        await pickOption(providerSelect, 'openai');
        expect(mocks.openPopupWindow).toHaveBeenCalledWith(
            '/setting.html',
            expect.stringMatching(/^setting_\d+$/),
            'setting',
            { appTopToMain: true },
        );
        expect(state.settings.get('setting-tabs')).toBe('a');
        expect(
            JSON.parse(state.settings.get('setting-ai-key-focus')!).keyName,
        ).toBe('openAIAPIKey');
        expect(getSelect('Which assistant answers')!.value).toBe('anthropic');
        expect(state.settings.get('chatbot-llm-provider')).toBe('anthropic');
        // A value no row holds is no pick at all.
        await pickOption(getSelect('Which assistant answers'), 'gone');
        expect(mocks.openPopupWindow).toHaveBeenCalledTimes(1);
        expect(getSelect('Which assistant answers')!.value).toBe('anthropic');
    });

    test('a keyed provider ends Auto for the tab and the model picker writes its model', async () => {
        seedKeys({ anthropicAPIKey: 'a', openAIAPIKey: 'b' });
        await renderApp();
        // A fresh install starts on Auto, with nothing picked yet.
        expect(getSelect('Which assistant answers')!.value).toBe('::auto::');
        expect(query('.chat-auto-pick')?.textContent).toBe(
            'chosen at each question',
        );
        expect(getSelect('Which model answers')).toBeNull();
        await pickOption(getSelect('Which assistant answers'), 'openai');
        expect(state.settings.get('chatbot-llm-provider')).toBe('openai');
        expect(state.settings.get('chatbot-llm-auto')).toBe('false');
        const modelSelect = getSelect('Which model answers')!;
        expect(modelSelect.value).toBe('gpt-5');
        await pickOption(modelSelect, 'gpt-5-mini');
        expect(state.settings.get('chatbot-llm-model-openai')).toBe(
            'gpt-5-mini',
        );
        expect(getSelect('Which model answers')!.value).toBe('gpt-5-mini');
        await settle(400);
        const saved = readSavedSessions().sessions[0];
        expect(saved).toMatchObject({
            provider: 'openai',
            model: 'gpt-5-mini',
        });
        expect(saved.isAuto).toBeUndefined();
    });

    test('the Auto row puts a named tab back on Auto with its own notice', async () => {
        seedKeys({ anthropicAPIKey: 'a' });
        seedNamedProvider('anthropic');
        await renderApp();
        expect(query('.chat-warn')).toBeNull();
        await pickOption(getSelect('Which assistant answers'), '::auto::');
        expect(state.settings.get('chatbot-llm-auto')).toBe('true');
        expect(getSelect('Which assistant answers')!.value).toBe('::auto::');
        const autoPick = query('.chat-auto-pick')!;
        expect(autoPick.textContent).toBe('chosen at each question');
        expect(autoPick.title).toContain('Auto picks the best assistant');
        expect(query('.chat-warn')).not.toBeNull();
    });

    test('Auto names who answered last, on the picker and the folded head', async () => {
        seedSessions([
            genSession({ isAuto: true, autoPick: 'Free · Nemotron Super VL' }),
        ]);
        await renderApp();
        const autoPick = query('.chat-auto-pick')!;
        expect(autoPick.textContent).toBe('Free · Nemotron Super VL');
        expect(autoPick.title).toMatch(
            /^Free · Nemotron Super VL answered the last question\. Auto picks/,
        );
        await click(query('.chat-head-fold'));
        expect(query('.chat-head-summary')?.textContent).toBe(
            'Presenter · Auto · Free · Nemotron Super VL',
        );
        expect(state.settings.get('chatbot-head-collapsed')).toBe('true');
        await click(query('.chat-head-fold'));
        expect(state.settings.get('chatbot-head-collapsed')).toBe('false');
        expect(query('.chat-head-summary')).toBeNull();
    });

    test('the folded head of a named tab reads window, assistant and model', async () => {
        seedKeys({ anthropicAPIKey: 'a' });
        seedNamedProvider('anthropic', 'claude-sonnet-5');
        await renderApp();
        await click(query('.chat-head-fold'));
        expect(query('.chat-head-summary')?.textContent).toBe(
            'Presenter · Claude · Sonnet 5',
        );
        expect(query('.chat-head-spend')?.textContent?.length).toBeGreaterThan(
            0,
        );
        expect(getSelect('Which assistant answers')).toBeNull();
    });

    test('More models lists the account catalogue, and a failure is said', async () => {
        seedKeys({ anthropicAPIKey: 'a' });
        seedNamedProvider('anthropic');
        mocks.listAllLlmModels.mockResolvedValueOnce([
            {
                id: 'claude-extra-1',
                label: 'Claude Extra',
                note: '',
                speed: '',
                price: '',
            },
        ]);
        await renderApp();
        const more = getSelect('Which model answers')!.querySelector(
            'option[value="::more::"]',
        );
        expect(more?.textContent).toBe('More models…');
        await pickOption(getSelect('Which model answers'), '::more::');
        expect(mocks.listAllLlmModels).toHaveBeenCalledWith('anthropic');
        const labels = [
            ...getSelect('Which model answers')!.querySelectorAll('option'),
        ].map((option) => {
            return option.textContent;
        });
        // The model the tab is on is kept as an option although the account's
        // list does not carry it, so the select never shows blank.
        expect(labels).toEqual([
            'claude-opus-5',
            'Claude Extra',
            'More models…',
        ]);
        expect(getSelect('Which model answers')!.value).toBe('claude-opus-5');
        mocks.listAllLlmModels.mockRejectedValueOnce(new Error('no network'));
        await pickOption(getSelect('Which model answers'), '::more::');
        expect(query('.chat-alert')?.textContent).toBe(
            'The other models could not be listed — no network',
        );
    });

    test('an arrow on the closed list steps over rows that need a key', async () => {
        seedKeys({ anthropicAPIKey: 'a' });
        seedNamedProvider('anthropic');
        await renderApp();
        const select = () => {
            return getSelect('Which assistant answers')!;
        };
        await arrowPick(select(), 'ArrowDown', 'openai');
        // Down past ChatGPT, Kimi and Bedrock, which all need a key.
        expect(select().value).toBe('free');
        expect(state.settings.get('chatbot-llm-provider')).toBe('free');
        expect(mocks.openPopupWindow).not.toHaveBeenCalled();
        await arrowPick(select(), 'ArrowUp', 'bedrock');
        expect(select().value).toBe('anthropic');
        // The step is forgotten once the key press is over: a click that
        // follows on a keyless row is the ask for its key.
        await pressKey(select(), 'ArrowDown');
        await pickOption(select(), 'openai');
        expect(mocks.openPopupWindow).toHaveBeenCalledTimes(1);
        // A modified arrow is no step either.
        await arrowPick(select(), 'ArrowDown', 'kimi', { altKey: true });
        expect(mocks.openPopupWindow).toHaveBeenCalledTimes(2);
        expect(select().value).toBe('anthropic');
    });

    test('an arrow with nothing keyed past it leaves the tab where it was', async () => {
        seedNamedProvider('free');
        await renderApp();
        const select = getSelect('Which assistant answers')!;
        expect(select.value).toBe('free');
        await arrowPick(select, 'ArrowUp', 'bedrock');
        expect(getSelect('Which assistant answers')!.value).toBe('free');
        expect(mocks.openPopupWindow).not.toHaveBeenCalled();
    });

    test('the window focus re-reads the keys a Settings window just saved', async () => {
        seedKeys({ anthropicAPIKey: 'a' });
        seedNamedProvider('anthropic');
        await renderApp();
        const optionText = () => {
            return getSelect('Which assistant answers')!.querySelector(
                'option[value="kimi"]',
            )?.textContent;
        };
        expect(optionText()).toBe('Kimi — needs an API key');
        seedKeys({ anthropicAPIKey: 'a', kimiAPIKey: 'k' });
        await act(async () => {
            window.dispatchEvent(new Event('focus'));
        });
        await settle();
        expect(optionText()).toBe('Kimi');
        await pickOption(getSelect('Which assistant answers'), 'kimi');
        expect(state.settings.get('chatbot-llm-provider')).toBe('kimi');
    });
});

describe('with no assistant to offer at all', () => {
    const NAMES = 'Claude, ChatGPT, Kimi and Bedrock';

    test('the head says the answers are the guide’s and the way to a key', async () => {
        state.isWithoutAnyProvider = true;
        state.settings.set('chatbot-llm-auto', 'false');
        seedSessions([
            genSession({
                provider: null,
                model: '',
                messages: [
                    { id: 1, author: 'you', text: 'Where is Clear All?' },
                    { id: 2, author: 'bot', text: 'At the top.' },
                ],
            }),
        ]);
        await renderApp();
        const select = getSelect('Which assistant answers')!;
        expect(select.value).toBe('');
        expect(select.title).toBe(
            `${NAMES} need an API key of your own — add one in Settings → AI Providers`,
        );
        const noKey =
            select.querySelector<HTMLOptionElement>('option[value=""]');
        expect(noKey?.textContent).toBe('No AI key');
        expect(noKey?.disabled).toBe(true);
        expect(select.querySelector('option[value="::auto::"]')).toBeNull();
        expect(getSelect('Which model answers')).toBeNull();
        const engine = query<HTMLButtonElement>('.chat-engine-off')!;
        expect(engine.textContent).toBe('app guide · offline');
        expect(engine.title).toBe(
            `${NAMES} need an API key of your own — open AI settings`,
        );
        await click(engine);
        expect(mocks.openPopupWindow).toHaveBeenCalledTimes(1);
        // A thumb down is followed up, and asks no model to try again:
        // there is none.
        await click(query('[aria-label="Bad answer"]'));
        expect(queryAll('.cue-bot')).toHaveLength(2);
        expect(lastBotText()).not.toContain('Ask again with');
        await click(query('.chat-head-fold'));
        expect(query('.chat-head-summary')?.textContent).toBe(
            'Presenter · app guide · offline',
        );
    });

    test('the empty window says which assistants a key would bring', async () => {
        state.isWithoutAnyProvider = true;
        state.settings.set('chatbot-llm-auto', 'false');
        await renderApp();
        expect(query('.chat-empty')?.textContent).toContain(
            `${NAMES} answer here only with an API key of your own.`,
        );
    });
});

describe('custom servers and the shared registry', () => {
    const savedServers = {
        servers: [
            {
                id: 'lms',
                name: 'LM Studio',
                baseUrl: 'http://localhost:1234/v1',
                models: [
                    { id: 'm1', model: 'gemma-4-e4b', name: 'Gemma 4 E4B' },
                    { id: 'm2', model: 'qwen3', name: 'Qwen 3' },
                ],
            },
        ],
    };

    test('a server is its own row; picking it asks its model, and a deleted one moves the tab', async () => {
        state.home.set(
            CUSTOM_LLM_SERVERS_SETTING_KEY,
            JSON.stringify(savedServers),
        );
        seedKeys({ anthropicAPIKey: 'a' });
        seedNamedProvider('anthropic');
        await renderApp();
        const option = getSelect('Which assistant answers')!.querySelector(
            'option[value="custom/lms"]',
        );
        expect(option?.textContent).toBe('LM Studio');
        await pickOption(getSelect('Which assistant answers'), 'custom/lms');
        expect(state.settings.get('chatbot-llm-model-custom')).toBe('lms/m1');
        const modelLabels = [
            ...getSelect('Which model answers')!.querySelectorAll('option'),
        ].map((one) => {
            return one.textContent;
        });
        expect(modelLabels).toEqual(['Gemma 4 E4B', 'Qwen 3']);
        // The servers are edited in Settings; coming back is a focus.
        state.home.delete(CUSTOM_LLM_SERVERS_SETTING_KEY);
        await act(async () => {
            window.dispatchEvent(new Event('focus'));
        });
        await settle();
        expect(getSelect('Which assistant answers')!.value).toBe('anthropic');
        expect(
            getSelect('Which assistant answers')!.querySelector(
                'option[value="custom/lms"]',
            ),
        ).toBeNull();
    });

    test('the registry status is the reload title, and Reload reads it again', async () => {
        registryStatus = {
            url: 'https://example.org/llm/info.json',
            servers: [],
            fetchedAt: null,
            error: null,
        };
        await renderApp();
        const reload = () => {
            return query<HTMLButtonElement>('.chat-registry-reload')!;
        };
        expect(reload().title).toBe(
            'Reload the assistants shared on openworship.app — 0 shared',
        );
        const reloading = genDeferred<any>();
        mocks.electronSendAsync.mockImplementationOnce(() => {
            return reloading.promise;
        });
        await click(reload());
        expect(mocks.electronSendAsync).toHaveBeenCalledWith(
            LLM_REGISTRY_RELOAD_CHANNEL,
        );
        expect(reload().disabled).toBe(true);
        expect(reload().querySelector('.spinner-border')).not.toBeNull();
        await act(async () => {
            reloading.resolve({
                url: 'u',
                servers: [],
                fetchedAt: null,
                error: 'the site could not be reached',
            });
        });
        await settle();
        expect(reload().disabled).toBe(false);
        expect(reload().title).toBe(
            'Reload the assistants shared on openworship.app — the last read failed: the site could not be reached',
        );
        const fetchedAt = Date.UTC(2026, 9, 28, 9, 30);
        reloadedRegistryStatus = {
            url: 'u',
            servers: [],
            fetchedAt,
            error: null,
        };
        await click(reload());
        expect(reload().title).toBe(
            'Reload the assistants shared on openworship.app — 0 shared, ' +
                `read at ${new Date(fetchedAt).toLocaleTimeString()}`,
        );
    });

    test('a shared model carries the registry note under the pickers', async () => {
        const { loadLlmRegistry } =
            await import('../helper/ai/customServerHelpers');
        registryStatus = {
            url: 'u',
            servers: [
                {
                    id: 'registry-hall',
                    name: 'Hall PC',
                    baseUrl: 'https://shared-server.invalid/v1',
                    isFree: true,
                    note: { '': 'Slow, but free.' },
                    models: [
                        {
                            id: 'g4',
                            model: 'gemma4',
                            name: 'Gemma 4',
                            note: { '': 'Good at Khmer.' },
                        },
                    ],
                },
            ],
            fetchedAt: null,
            error: null,
        };
        try {
            await loadLlmRegistry();
            seedNamedProvider('custom');
            seedSessions([
                genSession({ provider: 'custom', model: 'registry-hall/g4' }),
            ]);
            await renderApp();
            expect(getSelect('Which assistant answers')!.value).toBe(
                'custom/registry-hall',
            );
            expect(query('.chat-model-notice')?.textContent).toContain(
                'Slow, but free. Good at Khmer.',
            );
        } finally {
            registryStatus = null;
            await loadLlmRegistry();
        }
    });
});

describe('the spend guard in the head', () => {
    test('the cap picker writes the new limit, and an unlisted cap is an option', async () => {
        state.settings.set('chatbot-spend-limit', '0.05');
        await renderApp();
        const select = getSelect('Spending limit per hour')!;
        expect(select.value).toBe('0.05');
        const values = [...select.querySelectorAll('option')].map((option) => {
            return option.value;
        });
        expect(values).toEqual([
            '0.05',
            '0.25',
            '0.5',
            '1',
            '2',
            '5',
            '10',
            '20',
            'off',
        ]);
        await pickOption(select, '5');
        expect(state.settings.get('chatbot-spend-limit')).toBe('5');
        // A value that is no option at all changes nothing.
        await pickOption(getSelect('Spending limit per hour'), 'bogus');
        expect(state.settings.get('chatbot-spend-limit')).toBe('5');
    });

    test('a paused assistant offers Allow more, and the press lifts the pause', async () => {
        state.settings.set(
            'chatbot-spend-ledger',
            JSON.stringify({
                rounds: [],
                resetAt: 0,
                trippedAt: Date.now(),
                trippedBy: 'pace',
            }),
        );
        await renderApp();
        expect(query('.chat-spend')?.className).toContain('is-paused');
        await click(query('.chat-spend-allow'));
        expect(query('.chat-spend-allow')).toBeNull();
        expect(query('.chat-spend')?.className).not.toContain('is-paused');
        expect(
            JSON.parse(state.settings.get('chatbot-spend-ledger')!).trippedAt,
        ).toBeNull();
    });

    test('a tab that has spent shows its credit line', async () => {
        seedSessions([
            genSession({
                usage: {
                    rounds: 2,
                    unpricedRounds: 0,
                    input: 1000,
                    cacheRead: 0,
                    cacheWrite: 0,
                    output: 500,
                    costUsd: 0.02,
                },
            }),
        ]);
        await renderApp();
        const credit = query('.chat-credit')!;
        expect(credit.textContent).toContain('Credit used');
        expect(query('.chat-credit-value')?.textContent).toContain(
            '1.5k tokens',
        );
    });
});

describe('the keyless warning', () => {
    test('folds itself after a while, opens by hand, and can be put away', async () => {
        await renderApp();
        const warn = () => {
            return query('.chat-warn');
        };
        expect(warn()?.className).not.toContain('is-folded');
        await settle(9000);
        expect(warn()?.className).toContain('is-folded');
        const fold = query<HTMLButtonElement>('.chat-warn-fold')!;
        expect(fold.getAttribute('aria-expanded')).toBe('false');
        const firstSentence = fold.textContent!;
        expect(query('.chat-warn-body')?.textContent).toContain(firstSentence);
        await click(fold);
        expect(warn()?.className).not.toContain('is-folded');
        // Opened by hand: no timer folds it again.
        await settle(9000);
        expect(warn()?.className).not.toContain('is-folded');
        await click(findButton('Hide for 30 days'));
        expect(warn()).toBeNull();
        expect(
            Number(localStorage.getItem('ai-provider-warn-hidden-until')),
        ).toBeGreaterThan(Date.now());
    });

    test('its links open the service page and the AI settings', async () => {
        seedNamedProvider('free');
        await renderApp();
        const links = queryAll<HTMLButtonElement>(
            '.chat-warn-links .chat-warn-link',
        );
        expect(links.length).toBeGreaterThan(0);
        await click(links[0]);
        expect(mocks.openExternalURL).toHaveBeenCalledWith(
            expect.stringMatching(/^https:\/\//),
        );
        await click(
            queryAll('.chat-warn-link').find((button) => {
                return button.textContent === 'Open AI settings';
            }),
        );
        expect(mocks.openPopupWindow).toHaveBeenCalledTimes(1);
        expect(
            JSON.parse(state.settings.get('setting-ai-key-focus')!).keyName,
        ).toBeNull();
    });

    test('a paid provider carries no warning', async () => {
        seedKeys({ openAIAPIKey: 'b' });
        seedNamedProvider('openai');
        await renderApp();
        expect(query('.chat-warn')).toBeNull();
    });
});

describe('asking about, and the window picker', () => {
    const windowList = [
        {
            id: 'MAIN',
            title: 'Open Worship app - Presenter',
            url: 'https://localhost:3000/presenter.html',
        },
        {
            id: 'SET',
            title: 'Setting (⚙️)',
            url: 'https://localhost:3000/setting.html?uuid=setting',
        },
    ];

    test('the focus picker moves the tab to the Reader and its demo shelf', async () => {
        await renderApp();
        expect(query('.chat-demo-block')).toBeNull();
        await pickOption(getSelect('Which part of the app'), 'reader');
        expect(query('.chat-demo-block')).not.toBeNull();
        await settle(400);
        expect(readSavedSessions().sessions[0]).toMatchObject({
            focus: 'reader',
            isFocusChosen: true,
        });
    });

    test('a second window draws the picker; choosing it aims the tab there', async () => {
        windowEntryList = windowList;
        await renderApp();
        const row = () => {
            return query('.chat-window-row');
        };
        expect(row()?.textContent).toContain('Working in');
        const select = () => {
            return getSelect('Which window')!;
        };
        expect(
            [...select().querySelectorAll('option')].map((one) => {
                return one.textContent;
            }),
        ).toEqual(['Presenter · main window', 'Setting (⚙️) · own window']);
        expect(select().value).toBe('MAIN');
        expect(row()?.className).not.toContain('is-aimed');
        await pickOption(select(), 'SET');
        expect(row()?.className).toContain('is-aimed');
        expect(getSelect('Which part of the app')!.value).toBe('setting');
        // Another kind of window is no longer that window.
        await pickOption(getSelect('Which part of the app'), 'reader');
        expect(row()?.className).not.toContain('is-aimed');
        await pickOption(select(), 'SET');
        await pickOption(select(), 'MAIN');
        expect(row()?.className).not.toContain('is-aimed');
        expect(getSelect('Which part of the app')!.value).toBe('presenter');
        // An id the list does not hold changes nothing.
        await pickOption(select(), 'GONE');
        expect(getSelect('Which part of the app')!.value).toBe('presenter');
    });

    test('the list is read again as it opens and whenever main says it changed', async () => {
        windowEntryList = windowList;
        await renderApp();
        const listCalls = () => {
            return mocks.electronSendAsync.mock.calls.filter((call) => {
                return call[0] === LIST_APP_WINDOWS_CHANNEL;
            }).length;
        };
        const before = listCalls();
        await act(async () => {
            getSelect('Which window')!.dispatchEvent(
                new MouseEvent('mousedown', { bubbles: true }),
            );
        });
        await settle();
        expect(listCalls()).toBe(before + 1);
        windowEntryList = [
            ...windowList,
            {
                id: 'SET2',
                title: 'Setting (⚙️)',
                url: 'https://localhost:3000/setting.html?uuid=setting2',
            },
        ];
        await act(async () => {
            emit(APP_WINDOWS_CHANGED_CHANNEL);
        });
        await settle();
        expect(listCalls()).toBe(before + 2);
        expect(
            [...getSelect('Which window')!.querySelectorAll('option')].map(
                (one) => {
                    return one.textContent;
                },
            ),
        ).toEqual([
            'Presenter · main window',
            'Setting (⚙️) · own window',
            'Setting (⚙️) · own window 2',
        ]);
        // A list main cannot give is no picker at all.
        mocks.electronSendAsync.mockImplementation(async () => {
            throw new Error('main is gone');
        });
        await act(async () => {
            window.dispatchEvent(new Event('focus'));
        });
        await settle();
        expect(query('.chat-window-row')).toBeNull();
    });

    test('a later launch from a window aims the tab at it', async () => {
        windowEntryList = windowList;
        await renderApp();
        expect(query('.chat-window-row')?.className).not.toContain('is-aimed');
        await act(async () => {
            emit('main:app:chatbot-launch-focus', '/setting.html');
        });
        await settle();
        expect(query('.chat-window-row')?.className).toContain('is-aimed');
        expect(getSelect('Which window')!.value).toBe('SET');
        expect(getSelect('Which part of the app')!.value).toBe('setting');
        // A launch from the main window is the main window's way again.
        await act(async () => {
            emit('main:app:chatbot-launch-focus', '/presenter.html');
        });
        await settle();
        expect(query('.chat-window-row')?.className).not.toContain('is-aimed');
        expect(getSelect('Which window')!.value).toBe('MAIN');
    });

    test('the help opened from a popup starts working in it', async () => {
        windowEntryList = windowList;
        const descriptor = Object.getOwnPropertyDescriptor(window, 'opener');
        Object.defineProperty(window, 'opener', {
            configurable: true,
            value: {
                location: {
                    href: 'https://localhost:3000/setting.html?uuid=setting',
                    pathname: '/setting.html',
                },
            },
        });
        try {
            await renderApp();
            expect(getSelect('Which part of the app')!.value).toBe('setting');
            expect(getSelect('Which window')!.value).toBe('SET');
            expect(query('.chat-window-row')?.className).toContain('is-aimed');
        } finally {
            if (descriptor === undefined) {
                delete (window as any).opener;
            } else {
                Object.defineProperty(window, 'opener', descriptor);
            }
        }
    });
});

describe('the tab strip', () => {
    function genTwoTabs() {
        return [
            genSession({
                id: 's1',
                title: 'First',
                messages: [{ id: 1, author: 'you', text: 'one' }],
            }),
            genSession({ id: 's2', title: 'Second' }),
        ];
    }

    function tabNames() {
        return queryAll('.chat-tab-name').map((tab) => {
            return tab.textContent;
        });
    }

    function activeName() {
        return query('.chat-tab.is-on .chat-tab-name')?.textContent;
    }

    function findMenuItem(text: string) {
        return queryAll('.chat-menu-item').find((item) => {
            return item.textContent === text;
        });
    }

    test('+ opens a tab in front, a name chooses one, and closing picks a neighbour', async () => {
        seedSessions(genTwoTabs(), 's1');
        await renderApp();
        expect(tabNames()).toEqual(['First', 'Second']);
        expect(activeName()).toBe('First');
        await click(query('.chat-tab-add'));
        expect(tabNames()).toEqual(['First', 'Second', 'New chat']);
        expect(activeName()).toBe('New chat');
        // The last tab, closed in front: the one to its left comes forward.
        await click(query('.chat-tab.is-on .chat-tab-close'));
        expect(tabNames()).toEqual(['First', 'Second']);
        expect(activeName()).toBe('Second');
        await click(queryAll('.chat-tab-name')[0]);
        expect(activeName()).toBe('First');
        // A tab that is not in front leaves the front one alone.
        await click(queryAll('.chat-tab-close')[1]);
        expect(tabNames()).toEqual(['First']);
        expect(activeName()).toBe('First');
        // The last one closed leaves one empty tab, never an empty window.
        await click(query('.chat-tab-close'));
        expect(tabNames()).toEqual(['New chat']);
        expect(queryAll('.cue')).toHaveLength(0);
    });

    test('a double-click renames the tab, tidied, and the name is saved', async () => {
        seedSessions(genTwoTabs(), 's1');
        await renderApp();
        await act(async () => {
            queryAll('.chat-tab-name')[0].dispatchEvent(
                new MouseEvent('dblclick', { bubbles: true }),
            );
        });
        await settle();
        const input = query<HTMLInputElement>('.chat-tab-input')!;
        const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!;
        await act(async () => {
            setter.call(input, '  Sunday    service ');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await pressKey(input, 'Enter');
        expect(tabNames()[0]).toBe('Sunday service');
        await settle(400);
        expect(readSavedSessions().sessions[0].title).toBe('Sunday service');
    });

    test('a locked tab outlives Close other chats and Clear all chats, both saved at once', async () => {
        seedSessions(
            [...genTwoTabs(), genSession({ id: 's3', title: 'Third' })],
            's2',
        );
        await renderApp();
        await click(queryAll('.chat-tab-menu')[0]);
        await click(findMenuItem('Lock this chat'));
        const firstTab = () => {
            return queryAll('.chat-tab')[0];
        };
        expect(firstTab().querySelector('.chat-tab-lock')).not.toBeNull();
        expect(firstTab().querySelector('.chat-tab-close')).toBeNull();
        await click(queryAll('.chat-tab-menu')[1]);
        await click(findMenuItem('Close other chats…'));
        await click(query('.chat-clear-yes'));
        expect(tabNames()).toEqual(['First', 'Second']);
        // Written there and then, ahead of the usual debounce.
        expect(
            readSavedSessions().sessions.map((session: any) => {
                return session.id;
            }),
        ).toEqual(['s1', 's2']);
        expect(readSavedSessions().activeId).toBe('s2');
        await click(queryAll('.chat-tab-menu')[1]);
        await click(findMenuItem('Clear all chats…'));
        await click(query('.chat-clear-yes'));
        expect(tabNames()).toEqual(['First']);
        expect(readSavedSessions()).toMatchObject({ activeId: 's1' });
        await click(queryAll('.chat-tab-menu')[0]);
        await click(findMenuItem('Unlock this chat'));
        await click(queryAll('.chat-tab-menu')[0]);
        await click(findMenuItem('Clear all chats…'));
        await click(query('.chat-clear-yes'));
        expect(tabNames()).toEqual(['New chat']);
        expect(readSavedSessions().sessions).toHaveLength(1);
        expect(readSavedSessions().sessions[0].messages).toEqual([]);
    });
});

describe('the suggestion list under the box', () => {
    const rowList = [
        {
            id: 'q1',
            text: 'How do I clear the screen?',
            sectionLabel: 'Screens',
        },
        {
            id: 'q2',
            text: 'How do I change the background?',
            sectionLabel: 'Background',
        },
    ];

    function box() {
        return query<HTMLTextAreaElement>('.chat-input')!;
    }

    function suggestionTexts() {
        return queryAll('.chat-suggest-text').map((text) => {
            return text.textContent;
        });
    }

    test('two letters list corpus questions; the arrows walk them and Enter takes one', async () => {
        mocks.suggestQuestions.mockResolvedValue(rowList);
        await renderApp();
        await typeQuestion('h');
        expect(mocks.suggestQuestions).not.toHaveBeenCalled();
        expect(query('.chat-suggests')).toBeNull();
        await typeQuestion('ho');
        expect(mocks.suggestQuestions).toHaveBeenCalledWith('ho', 'presenter');
        expect(suggestionTexts()).toEqual([
            'How do I clear the screen?',
            'How do I change the background?',
        ]);
        expect(query('.chat-suggest-where')?.textContent).toBe('Screens');
        const options = () => {
            return queryAll('.chat-suggest');
        };
        await pressKey(box(), 'ArrowDown');
        expect(options()[0].getAttribute('aria-selected')).toBe('true');
        expect(mocks.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
        await pressKey(box(), 'ArrowDown');
        await pressKey(box(), 'ArrowDown');
        // Past the last row: back to the box's own words, not round again.
        expect(
            options().some((option) => {
                return option.className.includes('is-on');
            }),
        ).toBe(false);
        await pressKey(box(), 'ArrowUp');
        expect(options()[1].getAttribute('aria-selected')).toBe('true');
        await pressKey(box(), 'Enter');
        expect(box().value).toBe('How do I change the background?');
        expect(query('.chat-suggests')).toBeNull();
        expect(mocks.askLlmBot).not.toHaveBeenCalled();
    });

    test('a press takes a row, Escape puts the list away and typing brings it back', async () => {
        mocks.suggestQuestions.mockResolvedValue(rowList);
        await renderApp();
        await typeQuestion('ho');
        await pressKey(box(), 'Escape');
        expect(query('.chat-suggests')).toBeNull();
        expect(box().value).toBe('ho');
        await typeQuestion('how');
        expect(query('.chat-suggests')).not.toBeNull();
        box().blur();
        await act(async () => {
            queryAll('.chat-suggest')[0].dispatchEvent(
                new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        await settle();
        expect(box().value).toBe('How do I clear the screen?');
        expect(document.activeElement).toBe(box());
        expect(query('.chat-suggests')).toBeNull();
    });

    test('Tab fills the first row; a row the box already holds is not offered', async () => {
        mocks.suggestQuestions.mockResolvedValue(rowList);
        await renderApp();
        await typeQuestion('ho');
        await pressKey(box(), 'Tab');
        expect(box().value).toBe('How do I clear the screen?');
        await typeQuestion('How do I clear the screen? and the rest');
        expect(suggestionTexts()).toEqual(['How do I change the background?']);
        // With a modifier, Tab is the way out of the box.
        await pressKey(box(), 'Tab', { shiftKey: true });
        expect(box().value).toBe('How do I clear the screen? and the rest');
        // In a box of two lines the arrows belong to the caret.
        await typeQuestion('how\nmore');
        expect(suggestionTexts()).toHaveLength(2);
        await pressKey(box(), 'ArrowDown');
        expect(
            queryAll('.chat-suggest').some((option) => {
                return option.className.includes('is-on');
            }),
        ).toBe(false);
    });

    test('a ranking that lands after more typing is dropped', async () => {
        const late = genDeferred<any[]>();
        mocks.suggestQuestions
            .mockImplementationOnce(() => {
                return late.promise;
            })
            .mockResolvedValue([]);
        await renderApp();
        await typeQuestion('ho');
        await typeQuestion('hon');
        await act(async () => {
            late.resolve(rowList);
        });
        await settle();
        expect(query('.chat-suggests')).toBeNull();
    });

    test('a command with nothing to add runs from its row', async () => {
        await renderApp();
        await typeQuestion('/comm');
        const row = queryAll('.chat-suggest').find((one) => {
            return one.textContent?.startsWith('/commands');
        });
        await act(async () => {
            row!.dispatchEvent(
                new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        await settle();
        expect(query('.cue-you')?.textContent).toContain('/commands');
        expect(query('.chat-cues')?.textContent).toContain('/screen');
        // Asked from the box, so the walk back can bring it again.
        expect(JSON.parse(state.settings.get('chatbot-ask-history')!)).toEqual([
            '/commands',
        ]);
    });
});

describe('the Bible input aid', () => {
    function genSuggestTool(answer: (args: any) => Promise<string> | string) {
        return async (name: string, args: any) => {
            if (name === 'owa_bible_suggest') {
                return answer(args);
            }
            return '{}';
        };
    }

    test('a Reader box completes a passage after a pause, and a row keeps the list up', async () => {
        seedSessions([genSession({ focus: 'reader' })]);
        mocks.callTool.mockImplementation(
            genSuggestTool((args) => {
                return JSON.stringify({
                    suggestions: [
                        {
                            label: `${args.prefix} → John 3`,
                            fill: 'John 3:',
                            detail: 'chapter',
                        },
                    ],
                });
            }),
        );
        await renderApp();
        await typeQuestion('John 3');
        const suggestCalls = () => {
            return mocks.callTool.mock.calls.filter((call) => {
                return call[0] === 'owa_bible_suggest';
            });
        };
        expect(suggestCalls()).toHaveLength(0);
        await settle(350);
        expect(suggestCalls()).toEqual([
            [
                'owa_bible_suggest',
                { kind: 'reference', prefix: 'John 3', limit: 60 },
            ],
        ]);
        const row = query('.chat-suggest')!;
        expect(row.querySelector('.chat-suggest-text')?.textContent).toBe(
            'John 3 → John 3',
        );
        expect(row.querySelector('.chat-suggest-where')?.textContent).toBe(
            'chapter',
        );
        await act(async () => {
            row.dispatchEvent(
                new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        await settle(350);
        expect(query<HTMLTextAreaElement>('.chat-input')!.value).toBe(
            'John 3:',
        );
        // One step of a completion: the list is up for the verse.
        expect(query('.chat-suggest-text')?.textContent).toBe(
            'John 3: → John 3',
        );
    });

    test('a name asked about is looked up, and a lookup that fails offers nothing', async () => {
        mocks.callTool.mockImplementation(
            genSuggestTool(() => {
                throw new Error('no lookup data');
            }),
        );
        await renderApp();
        await typeQuestion('Who was Moses');
        await settle(350);
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_suggest', {
            kind: 'name',
            prefix: 'Moses',
            allowLoad: true,
            limit: 8,
        });
        expect(query('.chat-suggests')).toBeNull();
    });

    test('rows for words since changed are dropped', async () => {
        seedSessions([genSession({ focus: 'reader' })]);
        const late = genDeferred<string>();
        let callCount = 0;
        mocks.callTool.mockImplementation(
            genSuggestTool(() => {
                callCount += 1;
                return callCount === 1 ? late.promise : '{"suggestions":[]}';
            }),
        );
        await renderApp();
        await typeQuestion('John 3');
        await settle(350);
        await typeQuestion('John 4');
        await act(async () => {
            late.resolve(
                JSON.stringify({
                    suggestions: [{ label: 'John 3', fill: 'John 3:' }],
                }),
            );
        });
        await settle();
        expect(query('.chat-suggests')).toBeNull();
    });

    test('a passage awaited under a card is completed in that card’s book', async () => {
        seedSessions([
            genSession({
                messages: [
                    { id: 1, author: 'you', text: 'Open another passage' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Type the passage you want.',
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
        mocks.callTool.mockImplementation(
            genSuggestTool(() => {
                return '{"suggestions":[]}';
            }),
        );
        await renderApp();
        await typeQuestion('5');
        await settle(350);
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_suggest', {
            kind: 'reference',
            prefix: '5',
            book: 'JHN',
            limit: 60,
        });
    });

    test('under a verse search the box offers no app questions', async () => {
        mocks.suggestQuestions.mockResolvedValue([
            { id: 'q1', text: 'How do I love the app?', sectionLabel: 'Help' },
        ]);
        seedSessions([
            genSession({
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
        await renderApp();
        await typeQuestion('love your enemies');
        await settle(350);
        expect(query('.chat-suggests')).toBeNull();
        expect(mocks.callTool).not.toHaveBeenCalledWith(
            'owa_bible_suggest',
            expect.anything(),
        );
    });
});

describe('Alt+arrows bring back what was asked', () => {
    test('walks back through earlier questions and returns the half-typed words', async () => {
        seedSessions([
            genSession({
                messages: [
                    { id: 1, author: 'you', text: 'first question' },
                    { id: 2, author: 'bot', text: 'answer one' },
                    { id: 3, author: 'you', text: 'second question' },
                    { id: 4, author: 'bot', text: 'answer two' },
                ],
            }),
        ]);
        await renderApp();
        await typeQuestion('half typed');
        const box = () => {
            return query<HTMLTextAreaElement>('.chat-input')!;
        };
        await pressKey(box(), 'ArrowUp', { altKey: true });
        expect(box().value).toBe('second question');
        expect(box().selectionStart).toBe('second question'.length);
        await pressKey(box(), 'ArrowUp', { altKey: true });
        expect(box().value).toBe('first question');
        // The oldest is where the walk stops.
        await pressKey(box(), 'ArrowUp', { altKey: true });
        expect(box().value).toBe('first question');
        await pressKey(box(), 'ArrowDown', { altKey: true });
        expect(box().value).toBe('second question');
        await pressKey(box(), 'ArrowDown', { altKey: true });
        expect(box().value).toBe('half typed');
    });

    test('an empty box sent adds nothing to the walk', async () => {
        state.settings.set('chatbot-ask-history', JSON.stringify(['earlier']));
        await renderApp();
        await click(query('.chat-send'));
        expect(JSON.parse(state.settings.get('chatbot-ask-history')!)).toEqual([
            'earlier',
        ]);
        expect(queryAll('.cue')).toHaveLength(0);
    });
});

describe('a tab waiting on an answer', () => {
    function seedGuideAnswer() {
        seedSessions([
            genSession({
                messages: [
                    { id: 1, author: 'you', text: 'Where is Clear All?' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'At the top of the Mini Screen.',
                        actions: [
                            {
                                label: 'Show me step by step',
                                toolName: 'owa_guide_start',
                                args: { manualId: 'W-01' },
                            },
                        ],
                    },
                ],
            }),
        ]);
    }

    test('Stop ends the wait, hands what was added back and says it stopped', async () => {
        seedGuideAnswer();
        const started = genDeferred<string>();
        mocks.callTool.mockImplementation(() => {
            return started.promise;
        });
        await renderApp();
        await click(findButton('Show me step by step'));
        expect(mocks.callTool).toHaveBeenCalledWith(
            'owa_guide_start',
            expect.objectContaining({ manualId: 'W-01' }),
        );
        expect(query('.chat-stop')).not.toBeNull();
        expect(query('.chat-status')?.textContent).toBe(
            'Looking it up… press Stop to give up on it.',
        );
        expect(document.title).toBe('🟠 Open Worship app - Help');
        expect(mocks.sendData).toHaveBeenCalledWith('all:app:chatbot-busy', {
            isBusy: true,
        });
        expect(query('.chat-tab.is-on .chat-tab-busy')).not.toBeNull();
        expect(query('.chat-add')).toBeNull();
        await typeQuestion('and the red one');
        expect(query('.chat-add')?.textContent).toBe('Add');
        await click(query('.chat-add'));
        const added = queryAll('.cue-you').at(-1)!;
        expect(added.textContent).toContain('and the red one');
        expect(added.querySelector('.cue-note')?.textContent).toBe(
            'Added while it was working.',
        );
        expect(query<HTMLTextAreaElement>('.chat-input')!.value).toBe('');
        await click(query('.chat-stop'));
        expect(query('.chat-stop')).toBeNull();
        expect(queryAll('.cue-bot').at(-1)?.textContent).toContain(
            'Stopped. I did not finish looking that up — press the question above to ask it again.',
        );
        // Nothing typed is thrown away by a Stop.
        expect(query<HTMLTextAreaElement>('.chat-input')!.value).toBe(
            'and the red one',
        );
        expect(document.title).toBe('Open Worship app - Help');
        expect(mocks.sendData).toHaveBeenLastCalledWith(
            'all:app:chatbot-busy',
            { isBusy: false },
        );
        const cueCount = queryAll('.cue').length;
        await act(async () => {
            started.resolve(JSON.stringify({ isRunning: true, stepCount: 2 }));
        });
        await settle();
        // The call it gave up on lands on nobody.
        expect(queryAll('.cue')).toHaveLength(cueCount);
    });

    test('a second press in a busy tab answers while the first keeps it busy', async () => {
        seedSessions([
            genSession({
                messages: [
                    { id: 1, author: 'you', text: 'Where is Clear All?' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'At the top of the Mini Screen.',
                        actions: [
                            {
                                label: 'Show me step by step',
                                toolName: 'owa_guide_start',
                                args: { manualId: 'W-01' },
                            },
                            {
                                label: 'Show me the other one',
                                toolName: 'owa_guide_start',
                                args: { manualId: 'W-02' },
                            },
                        ],
                    },
                ],
            }),
        ]);
        mocks.callTool.mockImplementation(async (_name: string, args: any) => {
            if (args?.manualId === 'W-01') {
                return new Promise(() => {});
            }
            return JSON.stringify({ isRunning: false });
        });
        await renderApp();
        await click(findButton('Show me step by step'));
        expect(query('.chat-stop')).not.toBeNull();
        const busyCalls = mocks.sendData.mock.calls.filter((call) => {
            return call[0] === 'all:app:chatbot-busy';
        }).length;
        await click(findButton('Show me the other one'));
        expect(lastBotText()).toContain(
            'I could not start the walkthrough for that one.',
        );
        // Still waiting on the first: Stop and its line stay up, and the
        // busy flag was never lowered in between.
        expect(query('.chat-stop')).not.toBeNull();
        expect(query('.chat-status')).not.toBeNull();
        expect(
            mocks.sendData.mock.calls.filter((call) => {
                return call[0] === 'all:app:chatbot-busy';
            }).length,
        ).toBe(busyCalls);
    });

    test('the steps of the running ask are drawn under the conversation', async () => {
        seedGuideAnswer();
        mocks.callTool.mockImplementation(() => {
            return new Promise(() => {});
        });
        await renderApp();
        await click(findButton('Show me step by step'));
        const report = genProgressReporter(genSessionProgress('s1'));
        let finishFirst = () => {};
        await act(async () => {
            finishFirst = report('Searching the guide');
        });
        expect(query('.chat-progress')?.textContent).toContain(
            'Searching the guide…',
        );
        await act(async () => {
            finishFirst();
        });
        expect(query('.chat-progress .chat-status.is-done')?.textContent).toBe(
            'Searching the guide',
        );
        await act(async () => {
            for (const name of ['A', 'B', 'C', 'D', 'E']) {
                report(`Step ${name}`);
            }
        });
        expect(query('.chat-progress-more')?.textContent).toBe(
            '1 earlier step',
        );
        await act(async () => {
            report('Step F');
        });
        expect(query('.chat-progress-more')?.textContent).toBe(
            '2 earlier steps',
        );
        expect(query('.chat-progress-stop')?.textContent).toBe(
            'press Stop to give up on it.',
        );
    });

    test('Escape stops the tab in front, unless the caret is in a field', async () => {
        seedGuideAnswer();
        mocks.callTool.mockImplementation(() => {
            return new Promise(() => {});
        });
        await renderApp();
        await click(findButton('Show me step by step'));
        const escape = async () => {
            await act(async () => {
                window.dispatchEvent(
                    new KeyboardEvent('keydown', { key: 'Escape' }),
                );
            });
            await settle();
        };
        query<HTMLTextAreaElement>('.chat-input')!.focus();
        await escape();
        expect(query('.chat-stop')).not.toBeNull();
        query<HTMLTextAreaElement>('.chat-input')!.blur();
        await act(async () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        });
        expect(query('.chat-stop')).not.toBeNull();
        await escape();
        expect(query('.chat-stop')).toBeNull();
        expect(container.textContent).toContain(
            'Stopped. I did not finish looking that up',
        );
        // With nothing waiting it changes nothing.
        const cueCount = queryAll('.cue').length;
        await escape();
        expect(queryAll('.cue')).toHaveLength(cueCount);
    });
});

describe('the tip line', () => {
    test('pressing the sentence gives another tip and hands the caret back', async () => {
        await renderApp();
        const tipText = () => {
            return query('.chat-tip span')?.textContent;
        };
        const first = tipText();
        query<HTMLTextAreaElement>('.chat-input')!.blur();
        await click(query('.chat-tip'));
        expect(tipText()).not.toBe(first);
        expect(document.activeElement).toBe(query('.chat-input'));
    });

    test('the cross puts tips away for 30 days and /tips brings the line back', async () => {
        const { CHAT_TIPS_SHOWN_EVENT } = await import('./tipHelpers');
        await renderApp();
        await click(query('[aria-label="Hide tips for 30 days"]'));
        expect(query('.chat-tip-row')).toBeNull();
        expect(
            Number(state.settings.get('chatbot-tip-hidden-until')),
        ).toBeGreaterThan(Date.now());
        await act(async () => {
            window.dispatchEvent(new Event(CHAT_TIPS_SHOWN_EVENT));
        });
        expect(query('.chat-tip-row')).not.toBeNull();
    });
});

describe('the window around the conversation', () => {
    test('a copy of the app with no tool host says the assistant is not running', async () => {
        state.endpoints = { mcpUrl: null, mcpToken: null, cdpPort: null };
        await renderApp();
        expect(query('.chat-alert')?.textContent).toBe(
            'The assistant is not running in this copy of the app. Restart the app, then open this window again.',
        );
    });

    test('a draft is saved on a pause and flushed before the window unloads', async () => {
        await renderApp();
        await typeQuestion('half a question');
        expect(readSavedSessions()).toBeNull();
        await settle(400);
        expect(readSavedSessions().sessions[0].draft).toBe('half a question');
        await typeQuestion('more of it');
        await act(async () => {
            window.dispatchEvent(new Event('beforeunload'));
        });
        expect(readSavedSessions().sessions[0].draft).toBe('more of it');
    });

    test('scrolled up, a round arrow takes the log back to its end', async () => {
        seedSessions([
            genSession({
                messages: [
                    { id: 1, author: 'you', text: 'question' },
                    { id: 2, author: 'bot', text: 'answer' },
                ],
            }),
        ]);
        await renderApp();
        const log = query('.chat-log')!;
        let scrollTop = 100;
        Object.defineProperty(log, 'scrollHeight', {
            configurable: true,
            value: 1000,
        });
        Object.defineProperty(log, 'clientHeight', {
            configurable: true,
            value: 300,
        });
        Object.defineProperty(log, 'scrollTop', {
            configurable: true,
            get: () => {
                return scrollTop;
            },
            set: (value: number) => {
                scrollTop = value;
            },
        });
        await act(async () => {
            log.dispatchEvent(new Event('scroll'));
        });
        await click(query('.chat-log-jump-button'));
        expect(mocks.scrollTo).toHaveBeenCalledWith({
            top: 1000,
            behavior: 'smooth',
        });
        scrollTop = 700;
        await act(async () => {
            log.dispatchEvent(new Event('scroll'));
        });
        expect(query('.chat-log-jump-button')).toBeNull();
    });
});
