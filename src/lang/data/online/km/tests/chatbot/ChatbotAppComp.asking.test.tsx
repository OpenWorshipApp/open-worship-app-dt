// @vitest-environment jsdom

// The help window's model road for a question in Khmer: put into English
// for a model that works in English and its answer back, shown in English
// when it could not be put back, asked as it stands when it could not be
// put into English, Stop pressed while it is, a verse looked for by Khmer
// words, and a starter pressed in a window shown in Khmer riding with its
// Khmer guide page. Moved out of `src/chatbot/ChatbotAppComp.asking2` /
// `.asking5.test.tsx` (the Khmer cases need this package). Driven through
// the window's DOM; nothing reaches a provider or the app's tool host
// (`askLlmBot` and `callTool` are this file's own scripted fakes), and
// every pure helper stays real.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

const h = vi.hoisted(() => {
    const listenerMap = new Map<string, Set<(...args: any[]) => void>>();
    return {
        settings: new Map<string, string>(),
        // `appHomeStorage` / `appSecureStorage`: what main would answer.
        homeStore: new Map<string, string>(),
        secureStore: new Map<string, string>(),
        listenerMap,
        sent: [] as { channel: string; data: any }[],
        takenAttachment: { payload: null as any },
        askLlmBot: vi.fn(),
        callTool: vi.fn(),
        callToolPicture: vi.fn(),
        electronSendAsync: vi.fn(),
        findContactEmail: vi.fn(),
        openExternalURL: vi.fn(),
        openPopupWindow: vi.fn(),
        postIssueReport: vi.fn(),
        copyImageToClipboard: vi.fn(),
        handleError: vi.fn(),
        // The Resources folders, as the setting would list them.
        resourceDirs: [] as string[],
        emit(channel: string, ...args: any[]) {
            for (const listener of [...(listenerMap.get(channel) ?? [])]) {
                listener(...args);
            }
        },
    };
});

vi.mock('../../../../../../server/appProvider', () => ({
    default: {
        systemUtils: {
            isDev: false,
            isGlassCapable: false,
            isWindows: true,
            is64System: true,
        },
        appInfo: {
            name: 'open-worship',
            title: 'Open Worship',
            version: '2026.11.3',
            description: '',
            author: '',
            homepage: '',
        },
        settingHomePage: '/setting.html',
        appUtils: {
            handleError: (error: any) => h.handleError(error),
        },
        browserUtils: {
            openExternalURL: (url: string) => h.openExternalURL(url),
        },
        messageUtils: {
            sendDataSync: (channel: string, data?: any) => {
                if (channel === 'main:app:client-setting') {
                    return data?.type === 'get'
                        ? (h.homeStore.get(data.key) ?? null)
                        : null;
                }
                if (channel === 'main:app:secure-setting') {
                    return data?.type === 'get'
                        ? (h.secureStore.get(data.key) ?? null)
                        : null;
                }
                if (channel === 'main:app:take-chat-attachment') {
                    const { payload } = h.takenAttachment;
                    h.takenAttachment.payload = null;
                    return payload;
                }
                return null;
            },
            sendData: (channel: string, data?: any) => {
                h.sent.push({ channel, data });
            },
            listenForData: (channel: string, listener: any) => {
                const set = h.listenerMap.get(channel) ?? new Set();
                set.add(listener);
                h.listenerMap.set(channel, set);
            },
            listenOnceForData: () => {},
            removeListener: (channel: string, listener: any) => {
                h.listenerMap.get(channel)?.delete(listener);
            },
        },
        pathUtils: {
            sep: '/',
            join: (...parts: string[]) => parts.join('/'),
            basename: (path: string) => path.split('/').pop() ?? '',
        },
    },
}));
vi.mock('../../../../../../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string | null) => {
        h.settings.set(key, value ?? '');
    },
    getSettingForce: (key: string) => h.settings.get(key) ?? null,
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('../../../../../../server/electronSendHelpers', () => ({
    genReturningEventName: (name: string) => `${name}-return`,
    electronSendAsync: (...args: any[]) => h.electronSendAsync(...args),
}));
vi.mock('../../../../../../chatbot/llmBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../chatbot/llmBotHelpers')
    >()),
    askLlmBot: (...args: any[]) => h.askLlmBot(...args),
}));
vi.mock('../../../../../../chatbot/mcpClient', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../chatbot/mcpClient')
    >()),
    callTool: (...args: any[]) => h.callTool(...args),
    callToolPicture: (...args: any[]) => h.callToolPicture(...args),
    callToolWithPictures: async () => ({ text: '', pictures: [] }),
    listTools: async () => [],
    getAiEndpoints: () => ({ mcpUrl: null, mcpToken: null, cdpPort: null }),
}));
vi.mock('../../../../../../server/appHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../server/appHelpers')
    >()),
    findContactEmail: (...args: any[]) => h.findContactEmail(...args),
}));
vi.mock('../../../../../../helper/domHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../helper/domHelpers')
    >()),
    openPopupWindow: (...args: any[]) => h.openPopupWindow(...args),
}));
vi.mock('../../../../../../chatbot/reportHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../chatbot/reportHelpers')
    >()),
    postIssueReport: (...args: any[]) => h.postIssueReport(...args),
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
    '../../../../../../resources/resourcesFolderHelpers',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../../../resources/resourcesFolderHelpers')
        >()),
        getResourcesFolderList: () => h.resourceDirs,
    }),
);

import ChatbotAppComp from '../../../../../../chatbot/ChatbotAppComp';
import { suggestQuestions } from '../../../../../../chatbot/questionHelpers';
import { resetSpendGuardForTests } from '../../../../../../chatbot/spendGuardHelpers';
import { clearAutoSetbacks } from '../../../../../../chatbot/autoAssistantHelpers';
import { clearAutoAwayServers } from '../../../../../../chatbot/autoAssistantSourceHelpers';

const FREE_SUPER = 'nvidia/nemotron-3-super-120b-a12b:free';
const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=';

// jsdom loads no pictures: the window's image reader waits on `onload`.
class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 0;
    height = 0;
    private source = '';
    get src() {
        return this.source;
    }
    set src(value: string) {
        this.source = value;
        queueMicrotask(() => {
            if (value.startsWith('data:image/')) {
                this.width = 40;
                this.height = 30;
                this.onload?.();
            } else {
                this.onerror?.();
            }
        });
    }
}

type SeedSessionType = {
    id: string;
    messages?: any[];
    provider?: string | null;
    model?: string;
    focus?: string;
    isFocusChosen?: boolean;
    isAuto?: boolean;
    autoPick?: string;
    draft?: string;
    title?: string;
    isLocked?: boolean;
    fileClosedAt?: number;
};

function seedSessions(sessions: SeedSessionType[], activeId?: string) {
    h.settings.set(
        'chatbot-sessions',
        JSON.stringify({
            activeId: activeId ?? sessions[0].id,
            sessions: sessions.map((session) => {
                return {
                    title: '',
                    messages: [],
                    draft: '',
                    focus: 'presenter',
                    isFocusChosen: true,
                    provider: 'free',
                    model: FREE_SUPER,
                    isLocked: false,
                    ...session,
                };
            }),
        }),
    );
}

// A server of the user's own on this computer, with one model.
const LAB_MODEL = 'lab/m1';
function addLabServer(model = 'gemma4:e4b', canSeeImages = false) {
    h.homeStore.set(
        'ai-custom-servers',
        JSON.stringify({
            servers: [
                {
                    id: 'lab',
                    name: 'Lab Ollama',
                    baseUrl: 'http://localhost:11434/v1',
                    models: [
                        {
                            id: 'm1',
                            model,
                            name: 'Gemma 4 E4B',
                            ...(canSeeImages ? { canSeeImages: true } : {}),
                        },
                    ],
                },
            ],
        }),
    );
}

function defaultElectronSendAsync(channel: string, data?: any) {
    if (channel === 'main:app:capture-window') {
        return Promise.resolve(PNG_DATA_URL);
    }
    if (channel === 'main:app:recent-console') {
        return Promise.resolve(['Error: the projector went black']);
    }
    if (channel === 'main:app:custom-llm-fetch') {
        return Promise.resolve(
            data?.path === '/models'
                ? {
                      ok: true,
                      status: 200,
                      text: JSON.stringify({ data: [{ id: 'gemma4:e4b' }] }),
                  }
                : { ok: false, reason: 'unreachable' },
        );
    }
    if (channel === 'main:app:list-app-windows') {
        return Promise.resolve([]);
    }
    return Promise.resolve(null);
}

// One answer: words, and whatever an answer may carry with them. Says what
// the round cost, the way both provider loops do.
function answerWith(text: string, more: Record<string, any> = {}) {
    return async (...args: any[]) => {
        const [, , provider, model, , , extra] = args;
        extra?.onUsage?.({
            provider,
            model,
            input: 100,
            cacheRead: 0,
            cacheWrite: 0,
            output: 20,
        });
        return { text, ...more };
    };
}

let container: HTMLDivElement;
let root: Root;
let originalImage: any;

beforeAll(async () => {
    // The question corpus is a lazy chunk; loaded once here, so no test
    // below waits on its first read.
    await suggestQuestions('screen', 'presenter');
});

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    // Every test on the fake clock: the window debounces its saves and
    // folds, and a timer left over from one test must not write into the
    // next one's settings (cleared after the unmount below).
    useFakeClock();
    h.settings.clear();
    h.homeStore.clear();
    h.secureStore.clear();
    h.listenerMap.clear();
    h.sent.length = 0;
    h.takenAttachment.payload = null;
    h.resourceDirs = [];
    localStorage.clear();
    resetSpendGuardForTests();
    clearAutoSetbacks();
    clearAutoAwayServers();
    h.electronSendAsync.mockImplementation(defaultElectronSendAsync);
    h.callTool.mockImplementation(async () => '');
    h.callToolPicture.mockImplementation(async () => PNG_DATA_URL);
    h.findContactEmail.mockImplementation(async () => null);
    h.postIssueReport.mockImplementation(async () => {
        throw new Error('not scripted');
    });
    h.copyImageToClipboard.mockImplementation(async () => {});
    h.askLlmBot.mockImplementation(async () => {
        throw new Error('not scripted');
    });
    originalImage = globalThis.Image;
    (globalThis as any).Image = FakeImage;
    // jsdom lays nothing out: the tab strip and the lists scroll their row in.
    (Element.prototype as any).scrollIntoView = () => {};
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    if (isFakeClock) {
        vi.clearAllTimers();
        vi.useRealTimers();
        isFakeClock = false;
    }
    container.remove();
    (globalThis as any).Image = originalImage;
    delete (Element.prototype as any).scrollIntoView;
    document.documentElement.lang = '';
    Object.defineProperty(window, 'opener', {
        value: null,
        configurable: true,
        writable: true,
    });
});

// A test whose path sleeps on purpose (a screen given time to settle) runs on
// the fake clock, and these two step it instead of waiting.
let isFakeClock = false;
function useFakeClock() {
    vi.useFakeTimers();
    isFakeClock = true;
}

async function tick(milliseconds: number) {
    await act(async () => {
        if (isFakeClock) {
            await vi.advanceTimersByTimeAsync(milliseconds);
            return;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    });
}

async function flush(times = 3) {
    for (let index = 0; index < times; index += 1) {
        await tick(0);
    }
}

async function waitFor(check: () => boolean, what: string) {
    for (let index = 0; index < 400; index += 1) {
        if (check()) {
            return;
        }
        // On the fake clock a poll is a step of it: the settle a command
        // sleeps through passes in a dozen of them.
        await tick(isFakeClock ? 50 : 5);
    }
    throw new Error(`Timed out waiting for ${what}`);
}

async function renderWindow() {
    await act(async () => {
        root.render(<ChatbotAppComp />);
    });
    await flush();
}

function typeQuestion(value: string) {
    const box = container.querySelector<HTMLTextAreaElement>('.chat-input')!;
    const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
    )!.set!;
    act(() => {
        setter.call(box, value);
        box.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function pressSend() {
    await act(async () => {
        container.querySelector<HTMLButtonElement>('.chat-send')!.click();
    });
}

async function ask(value: string) {
    typeQuestion(value);
    await pressSend();
}

function botCues() {
    return [...container.querySelectorAll('article.cue-bot')];
}

function youCues() {
    return [...container.querySelectorAll('article.cue-you')];
}

function lastBot() {
    return botCues().at(-1) ?? null;
}

function textOf(element: Element | null | undefined) {
    return element?.querySelector('.cue-body')?.textContent ?? '';
}

function noteOf(element: Element | null | undefined) {
    return element?.querySelector('.cue-note')?.textContent ?? '';
}

function isIdle() {
    return container.querySelector('.chat-stop') === null;
}

async function askAndSettle(value: string, answers = botCues().length + 1) {
    await ask(value);
    await waitFor(() => {
        return botCues().length >= answers && isIdle();
    }, `answer to "${value}"`);
}

async function waitForAsks(count: number) {
    await waitFor(() => {
        return h.askLlmBot.mock.calls.length >= count;
    }, `${count} model ask(s)`);
}

// An answer that waits for the test to let it go -- or for Stop.
function genHeldAnswer() {
    const held = {
        extra: null as any,
        release: (_text: string) => {},
        isAborted: false,
    };
    const impl = (...args: any[]) => {
        const signal: AbortSignal = args[5];
        held.extra = args[6];
        return new Promise((resolve, reject) => {
            held.release = (text: string) => {
                resolve({ text });
            };
            signal.addEventListener('abort', () => {
                held.isAborted = true;
                reject(new DOMException('Stopped', 'AbortError'));
            });
        });
    };
    return { held, impl };
}

function repliesOf(element: Element | null | undefined) {
    return [...(element?.querySelectorAll('.cue-reply') ?? [])].map(
        (button) => button.textContent ?? '',
    );
}

// The words of a message alone: its body without the note over it and the
// buttons, chips and tools under it.
function saidOf(element: Element | null | undefined) {
    const body = element?.querySelector('.cue-body')?.cloneNode(true) as
        Element | undefined;
    if (body === undefined) {
        return '';
    }
    for (const part of body.querySelectorAll(
        '.cue-note, .cue-actions, .cue-replies, .cue-tools, .chat-clips',
    )) {
        part.remove();
    }
    return body.textContent ?? '';
}

const STOPPED_TEXT =
    'Stopped. I did not finish looking that up — press the question above to ask it again.';

async function pressStop() {
    await act(async () => {
        container.querySelector<HTMLButtonElement>('.chat-stop')!.click();
    });
}

const KHMER_QUESTION = 'តើខ្ញុំសម្អាតអេក្រង់ដោយរបៀបណា?';

describe('a question in another language', () => {
    test('is put into English for a model that works in English, and its answer back into Khmer', async () => {
        addLabServer();
        seedSessions([{ id: 'khmer' }]);
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            const [asked, , , , , , extra] = args;
            if (extra?.isTranslation === true) {
                if (asked.includes('Translate each numbered line')) {
                    return { text: '1. បាទ\n2. ទេ' };
                }
                return asked.includes('into English')
                    ? { text: 'How do I clear the screen?' }
                    : { text: 'ចុច **Clear All** នៅខាងលើ។' };
            }
            return answerWith('Press **Clear All** at the top.', {
                replies: ['Yes', 'No'],
            })(...args);
        });
        await renderWindow();
        await askAndSettle(KHMER_QUESTION);

        const calls = h.askLlmBot.mock.calls;
        expect(calls).toHaveLength(4);
        // The question put into English by the Gemma 4 on the user's server,
        expect(calls[0][2]).toBe('custom');
        expect(calls[0][3]).toBe(LAB_MODEL);
        expect(calls[0][6].isTranslation).toBe(true);
        expect(calls[0][0]).toContain(KHMER_QUESTION);
        // the tab's own assistant asked in English,
        expect(calls[1][3]).toBe(FREE_SUPER);
        expect(calls[1][0]).toContain('How do I clear the screen?');
        expect(calls[1][6]).toMatchObject({
            askedText: 'How do I clear the screen?',
            replyLang: 'en',
            appLang: 'en',
        });
        // and its answer put back into Khmer, its options on their own
        // beside it (2026-11-03: riding the answer, they came back lost).
        expect(calls[2][6].isTranslation).toBe(true);
        expect(calls[2][0]).toContain('Press **Clear All** at the top.');
        expect(calls[2][0]).not.toContain('OPTIONS: Yes | No');
        expect(calls[3][6].isTranslation).toBe(true);
        expect(calls[3][0]).toContain('1. Yes\n2. No');
        expect(textOf(lastBot())).toContain('ចុច');
        expect(textOf(lastBot())).not.toContain('Press');
        expect(repliesOf(lastBot())).toEqual(['បាទ', 'ទេ']);
        expect(textOf(youCues().at(-1))).toContain(KHMER_QUESTION);
    });

    test('an answer that could not be put into Khmer is shown in English under a note saying so', async () => {
        addLabServer();
        seedSessions([{ id: 'khmer-english' }]);
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            const [asked, , , , , , extra] = args;
            if (extra?.isTranslation === true) {
                return asked.includes('into English')
                    ? { text: 'How do I clear the screen?' }
                    : { text: '' };
            }
            return answerWith('Press **Clear All** at the top.')(...args);
        });
        await renderWindow();
        await askAndSettle(KHMER_QUESTION);

        expect(textOf(lastBot())).toContain('Press');
        expect(noteOf(lastBot())).toBe(
            'I could not put this answer into ខ្មែរ, so it is in English.',
        );
    });

    test('when the question cannot be put into English, the model is asked in Khmer as it stands', async () => {
        addLabServer();
        seedSessions([{ id: 'khmer-direct' }]);
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            if (args[6]?.isTranslation === true) {
                throw new Error('the helper is away');
            }
            return answerWith('ចុច Clear All ។')(...args);
        });
        await renderWindow();
        await askAndSettle(KHMER_QUESTION);

        const calls = h.askLlmBot.mock.calls;
        expect(calls).toHaveLength(2);
        expect(calls[1][0]).toContain(KHMER_QUESTION);
        expect(calls[1][6].replyLang).toBe('km');
        expect(calls[1][6].appLang).toBeUndefined();
        expect(textOf(lastBot())).toContain('ចុច Clear All');
    });

    test('Stop while the question is being put into English ends it there', async () => {
        addLabServer();
        seedSessions([{ id: 'translate-stop' }]);
        const { impl } = genHeldAnswer();
        h.askLlmBot.mockImplementation(impl);
        await renderWindow();
        await ask('តើខ្ញុំសម្អាតអេក្រង់ដោយរបៀបណា?');
        await waitForAsks(1);
        expect(h.askLlmBot.mock.calls[0][6].isTranslation).toBe(true);
        await pressStop();
        await flush();
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        expect(botCues().map((cue) => saidOf(cue))).toEqual([STOPPED_TEXT]);
    });
});

describe('a verse being looked for', () => {
    const foundVerses = JSON.stringify({
        verses: [
            {
                key: 'MAT 5:44',
                ref: 'Matthew 5:44',
                text: 'But I say unto you, Love your enemies',
            },
        ],
        total: 1,
    });

    test('words in another script are put into English for the search by a Gemma 4 that costs nothing', async () => {
        addLabServer();
        seedSessions([{ id: 'verse-khmer' }]);
        h.callTool.mockImplementation(async (name: string, args: any) => {
            return name === 'owa_find_verse' && args?.words !== undefined
                ? foundVerses
                : '';
        });
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            if (args[6]?.isTranslation === true) {
                return { text: 'love your enemies' };
            }
            return answerWith('Matthew 5:44.')(...args);
        });
        await renderWindow();
        await askAndSettle(
            'Help me find a Bible verse in "KJV": ស្រឡាញ់ខ្មាំងសត្រូវ',
        );

        expect(h.askLlmBot.mock.calls[0][2]).toBe('custom');
        expect(h.askLlmBot.mock.calls[0][6].isTranslation).toBe(true);
        expect(h.callTool).toHaveBeenCalledWith('owa_find_verse', {
            bible: 'KJV',
            words: 'love your enemies',
        });
        expect(h.askLlmBot.mock.calls[1][6].verseFind.bible).toBe('KJV');
    });
});

describe('a question in a window shown in Khmer', () => {
    test('a pressed starter rides with its guide page in Khmer', async () => {
        document.documentElement.lang = 'km';
        seedSessions([{ id: 'km-starter' }]);
        h.callTool.mockImplementation(async (name: string, args: any) => {
            return name === 'owa_help_page'
                ? `# Page ${args.id}\n\n1. ចុចប៊ូតុង។`
                : '';
        });
        h.askLlmBot.mockImplementation(answerWith('ចុចប៊ូតុង។'));
        await renderWindow();
        const starter = await (async () => {
            await waitFor(() => {
                return [
                    ...container.querySelectorAll<HTMLButtonElement>(
                        '.chat-starter',
                    ),
                ].some((button) => button.title.length === 0);
            }, 'a starter');
            return [
                ...container.querySelectorAll<HTMLButtonElement>(
                    '.chat-starter',
                ),
            ].find((button) => button.title.length === 0)!;
        })();
        await act(async () => {
            starter.click();
        });
        await waitFor(() => botCues().length === 1 && isIdle(), 'the answer');

        const pageIds = h.callTool.mock.calls
            .filter((call) => call[0] === 'owa_help_page')
            .map((call) => String(call[1].id));
        expect(pageIds.some((id) => id.endsWith('@km'))).toBe(true);
        expect(pageIds.some((id) => !id.includes('@'))).toBe(true);
        expect(h.askLlmBot.mock.calls[0][6].replyLang).toBe('km');
    });
});
