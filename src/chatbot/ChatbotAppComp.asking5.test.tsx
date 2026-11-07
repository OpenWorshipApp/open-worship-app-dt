// @vitest-environment jsdom

// The edges of the help window's model road: a word of a passage taught,
// Stop pressed in the middle of each wait (a song drafted, a question put
// into English, the guide standing in, the main window read), a pick that
// says what its shared server is like, a hand-on the spend guard ends, and
// the handoffs and interpretations that send a line on to the assistant.
// Driven through the window's DOM; nothing reaches a provider or the tool
// host -- `askLlmBot` and `callTool` are this file's own scripted fakes --
// and every pure helper stays real.

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
        writeClipboardText: vi.fn(),
        // The Resources folders, as the setting would list them.
        resourceDirs: [] as string[],
        emit(channel: string, ...args: any[]) {
            for (const listener of [...(listenerMap.get(channel) ?? [])]) {
                listener(...args);
            }
        },
    };
});

vi.mock('../server/appProvider', () => ({
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
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string | null) => {
        h.settings.set(key, value ?? '');
    },
    getSettingForce: (key: string) => h.settings.get(key) ?? null,
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('../server/electronSendHelpers', () => ({
    genReturningEventName: (name: string) => `${name}-return`,
    electronSendAsync: (...args: any[]) => h.electronSendAsync(...args),
}));
vi.mock('./llmBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./llmBotHelpers')>()),
    askLlmBot: (...args: any[]) => h.askLlmBot(...args),
}));
vi.mock('./mcpClient', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./mcpClient')>()),
    callTool: (...args: any[]) => h.callTool(...args),
    callToolPicture: (...args: any[]) => h.callToolPicture(...args),
    callToolWithPictures: async () => ({ text: '', pictures: [] }),
    listTools: async () => [],
    getAiEndpoints: () => ({ mcpUrl: null, mcpToken: null, cdpPort: null }),
}));
vi.mock('../server/appHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../server/appHelpers')>()),
    findContactEmail: (...args: any[]) => h.findContactEmail(...args),
}));
vi.mock('../helper/domHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../helper/domHelpers')>()),
    openPopupWindow: (...args: any[]) => h.openPopupWindow(...args),
}));
vi.mock('./reportHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./reportHelpers')>()),
    postIssueReport: (...args: any[]) => h.postIssueReport(...args),
}));
vi.mock('./attachmentHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./attachmentHelpers')>()),
    copyImageToClipboard: (...args: any[]) => h.copyImageToClipboard(...args),
}));
vi.mock('../resources/resourcesFolderHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../resources/resourcesFolderHelpers')
    >()),
    getResourcesFolderList: () => h.resourceDirs,
}));

import ChatbotAppComp from './ChatbotAppComp';
import { suggestQuestions } from './questionHelpers';
import {
    SpendLimitError,
    getSpendState,
    resetSpendGuardForTests,
} from './spendGuardHelpers';
import { clearAutoSetbacks } from './autoAssistantHelpers';
import { clearAutoAwayServers } from './autoAssistantSourceHelpers';
import { BIBLE_IMPORT_STEP_TOOL_NAME } from './bibleImportChatHelpers';
import { requestChatbotAsk } from '../helper/ai/chatbotHandoffStoreHelpers';
import { LOOKUP_STEP_TOOL_NAME } from './lookupStepHelpers';

const FREE_VL = 'nvidia/nemotron-3.5-super-vl:free';
const FREE_SUPER = 'nvidia/nemotron-3-super-120b-a12b:free';
const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=';
// A question no corpus row is about, so no guide page rides with it.
const ODD_QUESTION = 'Why does the zebra overlay flicker on screen two?';

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

function setKeys(keys: Record<string, string>) {
    h.secureStore.set('ai-setting-secret', JSON.stringify(keys));
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
    // ...and has no clipboard: the window's Copy buttons get this one.
    h.writeClipboardText.mockImplementation(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: (text: string) => h.writeClipboardText(text) },
        configurable: true,
    });
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
    Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
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

function noteOf(element: Element | null | undefined) {
    return element?.querySelector('.cue-note')?.textContent ?? '';
}

function findButton(text: string, scope: ParentNode = container) {
    return (
        [...scope.querySelectorAll('button')].find((button) => {
            return button.textContent?.trim() === text;
        }) ?? null
    );
}

async function press(text: string, scope: ParentNode = container) {
    const button = findButton(text, scope);
    expect(button, `button "${text}"`).not.toBeNull();
    await act(async () => {
        button!.click();
    });
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

function actionsOf(element: Element | null | undefined) {
    return [...(element?.querySelectorAll('.cue-actions button') ?? [])].map(
        (button) => button.textContent ?? '',
    );
}

// One bot message carrying the buttons a test presses.
function seedButtons(
    actions: any[],
    more: SeedSessionType = { id: 'buttons' },
) {
    seedSessions([
        {
            ...more,
            messages: [
                ...(more.messages ?? []),
                {
                    id: 100,
                    author: 'bot',
                    text: 'Here are some things to press.',
                    actions,
                },
            ],
        },
    ]);
}

// A promise the test settles by hand, for work Stop is pressed in the middle of.
function genHeld<T>() {
    const held = {
        resolve: (_value: T) => {},
        reject: (_error: any) => {},
    };
    const promise = new Promise<T>((resolve, reject) => {
        held.resolve = resolve;
        held.reject = reject;
    });
    return { held, promise };
}

const STOPPED_TEXT =
    'Stopped. I did not finish looking that up — press the question above to ask it again.';

async function pressStop() {
    await act(async () => {
        container.querySelector<HTMLButtonElement>('.chat-stop')!.click();
    });
}

describe('a word of a passage taught', () => {
    const passageCard = {
        id: 1,
        author: 'bot',
        text: 'John 3:16 in the KJV.',
        lookup: {
            kind: 'verse',
            target: 'JHN 3:16',
            title: 'John 3:16',
            facts: JSON.stringify({
                bible: 'KJV',
                passages: [
                    {
                        key: 'JHN 3:16',
                        ref: 'John 3:16',
                        title: 'John 3:16',
                        text: '(16): For God so loved the world',
                    },
                ],
            }),
        },
    };
    const studyButton = {
        label: 'Every word of verse 16',
        toolName: LOOKUP_STEP_TOOL_NAME,
        args: {
            step: 'verseWords',
            ask: { kind: 'verse', target: 'JHN 3:16', title: 'John 3:16' },
            verse: 'JHN 3:16',
        },
    };

    test('is asked of the assistant with the lesson’s own buttons under the answer', async () => {
        seedButtons([studyButton], { id: 'study', messages: [passageCard] });
        h.askLlmBot.mockImplementation(answerWith('“Loved” is agapao.'));
        await renderWindow();
        await press('Every word of verse 16');
        await waitFor(() => botCues().length === 3 && isIdle(), 'the lesson');

        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain('For God so loved the world');
        expect(extra.lookup.isStudy).toBe(true);
        expect(actionsOf(lastBot())).toContain('More things to do');
    });

    test('with no assistant, says a word needs one, with the way to one', async () => {
        setKeys({ kimiAPIKey: 'sk-kimi' });
        seedButtons([studyButton], {
            id: 'study-offline',
            provider: 'kimi',
            model: 'kimi-k2.6',
            messages: [passageCard],
        });
        h.askLlmBot.mockImplementation(async () => {
            throw new Error('the service is busy');
        });
        await renderWindow();
        await press('Every word of verse 16');
        await waitFor(() => botCues().length === 3 && isIdle(), 'the answer');
        expect(saidOf(lastBot())).toContain(
            'Teaching a word needs an assistant, and none could answer just now.',
        );
        expect(actionsOf(lastBot())).toContain('Open AI settings');
    });
});

describe('the edges of the model road', () => {
    test('a reply the Bible import’s question cannot read, nor its interpreter, keeps the question', async () => {
        seedButtons([
            {
                label: 'Khmer',
                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                args: { step: 'language', locale: 'km' },
            },
        ]);
        h.askLlmBot.mockImplementation(async () => {
            return { text: 'not a JSON reply' };
        });
        await renderWindow();
        await askAndSettle('what is this one about?');
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        expect(h.askLlmBot.mock.calls[0][6].isWaitingInput).toBe(true);
        expect(noteOf(lastBot())).toBe(
            'I could not understand that choice. Choose an option below, or say it another way.',
        );
        expect(saidOf(lastBot())).toBe('Here are some things to press.');
    });

    test('a song drafted on a server of the user’s own and stopped is not answered late', async () => {
        addLabServer();
        seedSessions([
            { id: 'song-stop', provider: 'custom', model: LAB_MODEL },
        ]);
        const { held, promise } = genHeld<string>();
        h.callTool.mockImplementation((name: string) => {
            return name === 'owa_lyric_validate'
                ? promise
                : Promise.resolve('');
        });
        await renderWindow();
        await ask('Create a lyric file for song "Amazing Grace"');
        await flush();
        await pressStop();
        await act(async () => {
            held.reject(new Error('the song finder is away'));
        });
        await flush();
        expect(botCues().map((cue) => saidOf(cue))).toEqual([STOPPED_TEXT]);
    });

    test('a Resources passage the Bible could not be read for still rides with the plain hint', async () => {
        h.resourceDirs = ['/data/pdf'];
        seedSessions([
            {
                id: 'pdf-unread',
                messages: [
                    {
                        id: 1,
                        author: 'you',
                        text: 'Ask about MAT.18.pdf',
                        attachments: [
                            {
                                id: 'pdf-1',
                                kind: 'file',
                                name: 'MAT.18.pdf',
                                mimeType: 'application/pdf',
                                byteSize: 2048,
                                filePath: '/data/pdf/MAT.18.pdf',
                            },
                        ],
                    },
                ],
            },
        ]);
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_lookup_record') {
                throw new Error('no Bible is installed');
            }
            return '';
        });
        h.askLlmBot.mockImplementation(
            answerWith('Matthew 18:2 is about a child.'),
        );
        await renderWindow();
        await askAndSettle('2');
        const asked = h.askLlmBot.mock.calls[0][0];
        expect(asked).toContain('This is the verse or range chosen');
        expect(asked).not.toContain('The app prepared the chapter index');
    });

    test('Auto’s pick of a shared server says what its registry says of it while they wait', async () => {
        h.electronSendAsync.mockImplementation(
            (channel: string, data?: any) => {
                if (channel === 'main:app:llm-registry') {
                    return Promise.resolve({
                        servers: [
                            {
                                id: 'registry-hall',
                                name: 'Church Hall',
                                baseUrl: 'https://shared-server.invalid/v1',
                                isFree: true,
                                models: [
                                    {
                                        id: 'big',
                                        model: 'qwen3:32b',
                                        name: 'Qwen 32B',
                                        note: {
                                            '': 'Slow, but it saves us the cost.',
                                        },
                                    },
                                ],
                            },
                        ],
                        fetchedAt: null,
                        error: null,
                    });
                }
                return defaultElectronSendAsync(channel, data);
            },
        );
        seedSessions([
            {
                id: 'auto-shared',
                isAuto: true,
                provider: 'free',
                model: FREE_VL,
            },
        ]);
        const { held, impl } = genHeldAnswer();
        h.askLlmBot.mockImplementation(impl);
        await renderWindow();
        await ask(ODD_QUESTION);
        await waitForAsks(1);
        expect(h.askLlmBot.mock.calls[0][2]).toBe('custom');
        expect(h.askLlmBot.mock.calls[0][3]).toBe('registry-hall/big');
        expect(
            container.querySelector('.chat-progress')?.textContent,
        ).toContain('Slow, but it saves us the cost.');
        await act(async () => {
            held.release('The hall answered.');
        });
        await waitFor(isIdle, 'the answer');
        expect(saidOf(lastBot())).toContain('The hall answered.');
    });

    test('a hand-on stopped by the spend guard is the pause, not another failure', async () => {
        seedSessions([
            { id: 'hand-on-spend', provider: 'free', model: FREE_SUPER },
        ]);
        const pause = new SpendLimitError(getSpendState());
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            if (args[3] === FREE_SUPER) {
                throw new Error('the free pool is full');
            }
            throw pause;
        });
        await renderWindow();
        await askAndSettle(ODD_QUESTION);
        expect(h.askLlmBot.mock.calls.map((call) => call[3])).toEqual([
            FREE_SUPER,
            FREE_VL,
        ]);
        expect(noteOf(lastBot())).toBe(
            `${pause.message} Here is what the app's own guide says.`,
        );
        expect(findButton('Allow more', lastBot()!)).not.toBeNull();
    });

    test('Stop while the guide answers in place of a failed assistant drops its late answer', async () => {
        setKeys({ kimiAPIKey: 'sk-kimi' });
        seedSessions([
            { id: 'guide-stop', provider: 'kimi', model: 'kimi-k2.6' },
        ]);
        h.askLlmBot.mockImplementation(async () => {
            throw new Error('the service is busy');
        });
        const { held, promise } = genHeld<string>();
        h.callTool.mockImplementation((name: string) => {
            return name === 'owa_help_search' ? promise : Promise.resolve('');
        });
        await renderWindow();
        await ask(ODD_QUESTION);
        await waitForAsks(1);
        await flush();
        await pressStop();
        await act(async () => {
            held.resolve('[]');
        });
        await flush();
        expect(botCues().map((cue) => saidOf(cue))).toEqual([STOPPED_TEXT]);
    });

    test('the way back to the Reader is offered even when the main window cannot be read', async () => {
        seedSessions([{ id: 'route-unread' }]);
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_app_state') {
                throw new Error('the main window is busy');
            }
            return '';
        });
        h.askLlmBot.mockImplementation(answerWith('Use the Bible Lookup.'));
        await renderWindow();
        await askAndSettle('How can I open the Bible to read it?');
        expect(actionsOf(lastBot())).toContain('Go to the Bible Reader');
    });

    test('Bible Find is pointed at under an answer whose own buttons name another page', async () => {
        seedSessions([{ id: 'find-actions', focus: 'reader' }]);
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_find_verse') {
                throw new Error('no Bible is installed');
            }
            return '';
        });
        h.askLlmBot.mockImplementation(
            answerWith('That is Matthew 5:44.', {
                actions: [
                    {
                        label: 'Show me step by step',
                        toolName: 'owa_guide_start',
                        args: { manualId: 'W-11', mode: 'show' },
                    },
                ],
            }),
        );
        await renderWindow();
        await askAndSettle('Which verse says love your enemies?');
        expect(actionsOf(lastBot())).toEqual([
            'Show me step by step',
            'Show me Bible Find',
        ]);
    });

    test('a verse search handed over from Bible Find with its words is asked in its own tab', async () => {
        requestChatbotAsk(
            'Help me find a Bible verse in "KJV": love your enemies',
        );
        h.callTool.mockImplementation(async (name: string, args: any) => {
            return name === 'owa_find_verse' && args?.words !== undefined
                ? JSON.stringify({
                      verses: [
                          {
                              key: 'MAT 5:44',
                              ref: 'Matthew 5:44',
                              text: 'Love your enemies',
                          },
                      ],
                  })
                : '';
        });
        h.askLlmBot.mockImplementation(answerWith('Matthew 5:44.'));
        await renderWindow();
        await waitFor(
            () => botCues().length === 1 && isIdle(),
            'the handed ask',
        );
        expect(saidOf(youCues()[0])).toBe(
            'Help me find a Bible verse in "KJV": love your enemies',
        );
        expect(h.askLlmBot.mock.calls[0][6].verseFind.bible).toBe('KJV');
    });
});

describe('more of the model road', () => {
    test('a Bible asked for in a language the collection has no name for is asked of the assistant when it is not one', async () => {
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_bible_xml'
                ? JSON.stringify({ kind: 'page', matched: 0, files: [] })
                : '';
        });
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            if (args[6]?.isWaitingInput === true) {
                return { text: '{"kind":"unrelated"}' };
            }
            return answerWith('That is not a language a Bible is kept in.')(
                ...args,
            );
        });
        seedSessions([{ id: 'klingon' }]);
        await renderWindow();
        await askAndSettle('Import bible for Klingon');
        expect(h.askLlmBot).toHaveBeenCalledTimes(2);
        expect(h.askLlmBot.mock.calls[0][6].isWaitingInput).toBe(true);
        expect(h.askLlmBot.mock.calls[1][0]).toContain(
            'Import bible for Klingon',
        );
        // Echoed once, by the import's own step.
        expect(
            youCues().filter((cue) => saidOf(cue).includes('Klingon')),
        ).toHaveLength(1);
    });

    test('Stop while the main window is read for the way back to the Reader ends it there', async () => {
        seedSessions([{ id: 'route-stop' }]);
        const { held, promise } = genHeld<string>();
        h.callTool.mockImplementation((name: string) => {
            return name === 'owa_app_state' ? promise : Promise.resolve('');
        });
        h.askLlmBot.mockImplementation(answerWith('Use the Bible Lookup.'));
        await renderWindow();
        await ask('How can I open the Bible to read it?');
        await waitFor(() => {
            return h.callTool.mock.calls.some((call) => {
                return call[0] === 'owa_app_state';
            });
        }, 'the read of the main window');
        await pressStop();
        await act(async () => {
            held.resolve(
                JSON.stringify({ mainWindow: { page: 'presenter.html' } }),
            );
        });
        await flush();
        expect(botCues().map((cue) => saidOf(cue))).toEqual([STOPPED_TEXT]);
    });
});
