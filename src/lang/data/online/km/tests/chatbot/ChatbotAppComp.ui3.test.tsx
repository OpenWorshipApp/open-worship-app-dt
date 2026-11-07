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

vi.mock('../../../../../../server/appProvider', () => {
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
vi.mock('../../../../../../helper/settingHelpers', () => {
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
vi.mock('../../../../../../server/electronSendHelpers', () => {
    return {
        genReturningEventName: (name: string) => {
            return `${name}-return`;
        },
        electronSendAsync: (...args: any[]) => {
            return mocks.electronSendAsync(...args);
        },
    };
});
vi.mock('../../../../../../helper/appCaptureHelpers', () => {
    return {
        captureAppWindow: (...args: any[]) => {
            return mocks.captureAppWindow(...args);
        },
    };
});
vi.mock('../../../../../../helper/domHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<
            typeof import('../../../../../../helper/domHelpers')
        >()),
        openPopupWindow: (...args: any[]) => {
            return mocks.openPopupWindow(...args);
        },
    };
});
vi.mock('../../../../../../chatbot/mcpClient', async (importOriginal) => {
    return {
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/mcpClient')
        >()),
        callTool: (...args: any[]) => {
            return mocks.callTool(...args);
        },
        callToolPicture: (...args: any[]) => {
            return mocks.callToolPicture(...args);
        },
    };
});
vi.mock('../../../../../../chatbot/llmBotHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/llmBotHelpers')
        >()),
        askLlmBot: (...args: any[]) => {
            return mocks.askLlmBot(...args);
        },
        listAllLlmModels: (...args: any[]) => {
            return mocks.listAllLlmModels(...args);
        },
    };
});
vi.mock('../../../../../../chatbot/questionHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/questionHelpers')
        >()),
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

import ChatbotAppComp from '../../../../../../chatbot/ChatbotAppComp';
import { resetSpendGuardForTests } from '../../../../../../chatbot/spendGuardHelpers';
import { clearProgressSteps } from '../../../../../../chatbot/progressHelpers';
import { LIST_APP_WINDOWS_CHANNEL } from '../../../../../../chatbot/windowAimHelpers';
import {
    LLM_REGISTRY_GET_CHANNEL,
    LLM_REGISTRY_RELOAD_CHANNEL,
} from '../../../../../../../electron/customLlmProtocol';

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
    const { findKnownQuestion } = await vi.importActual<
        typeof import('../../../../../../chatbot/questionHelpers')
    >('../../../../../../chatbot/questionHelpers');
    await findKnownQuestion('warm up', 'presenter');
}, 30000);

async function send(text: string) {
    await typeQuestion(text);
    await click(query('.chat-send'));
    await settle();
}

function lastAnswerText() {
    return queryAll('.cue-bot').at(-1)?.textContent ?? '';
}

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
