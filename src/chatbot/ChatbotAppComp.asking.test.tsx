// @vitest-environment jsdom

// The help window's MODEL road, driven through its own DOM: what is asked of
// which assistant, what the window draws from the answer, and what it says
// when the answer does not come. Nothing reaches a provider or the app's tool
// host -- `askLlmBot` and `callTool` are this file's own scripted fakes -- and
// every pure helper the window runs its answers through stays real.

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

import ChatbotAppComp from './ChatbotAppComp';
import { suggestQuestions } from './questionHelpers';
import {
    SpendLimitError,
    getSpendState,
    recordSpendRound,
    resetSpendGuardForTests,
} from './spendGuardHelpers';
import { clearAutoSetbacks } from './autoAssistantHelpers';
import { clearAutoAwayServers } from './autoAssistantSourceHelpers';
import { ToolHostError } from './mcpClient';
import { BIBLE_IMPORT_STEP_TOOL_NAME } from './bibleImportChatHelpers';
import { listAssistantLangPackages } from '../test-setup/langPackageDirs';

const FREE_VL = 'nvidia/nemotron-3.5-super-vl:free';
const FREE_SUPER = 'nvidia/nemotron-3-super-120b-a12b:free';
const FREE_LIGHT = 'nvidia/nemotron-3.5-lightning:free';
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

function guideHits(title: string, excerpt: string) {
    return JSON.stringify([
        { id: 'W-06', title, section: '', excerpt, score: 40 },
    ]);
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

function selectedText(label: string) {
    const select = container.querySelector<HTMLSelectElement>(
        `select[aria-label="${label}"]`,
    );
    return select?.selectedOptions[0]?.textContent ?? null;
}

describe('the model road of the help window', () => {
    test('a named assistant is asked with the tab history and its answer is drawn with its options and cost', async () => {
        seedSessions([
            {
                id: 'named',
                messages: [
                    { id: 1, author: 'you', text: 'What is a slide?' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'A slide is one screen of a song.',
                    },
                    {
                        id: 3,
                        author: 'bot',
                        text: 'What was wrong with that answer?',
                        isFollowUp: true,
                    },
                ],
            },
        ]);
        h.askLlmBot.mockImplementation(
            answerWith(
                'Press **Clear All** to empty every screen. See `https://example.org/help`.',
                {
                    replies: ['Show me how', 'Thanks'],
                    links: ['https://example.org/help'],
                    shows: [
                        {
                            kind: 'control',
                            value: 'Clear All',
                            name: 'Clear All',
                        },
                    ],
                },
            ),
        );
        await renderWindow();
        await askAndSettle(ODD_QUESTION);

        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        const [asked, focus, provider, model, turns, signal, extra] =
            h.askLlmBot.mock.calls[0];
        expect(asked).toContain(ODD_QUESTION);
        expect(focus).toBe('presenter');
        expect(provider).toBe('free');
        expect(model).toBe(FREE_SUPER);
        // The window's own follow-up to a thumb down is no turn of the talk.
        expect(turns).toEqual([
            { author: 'you', text: 'What is a slide?' },
            { author: 'bot', text: 'A slide is one screen of a song.' },
        ]);
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(extra).toMatchObject({
            images: [],
            askedText: ODD_QUESTION,
            replyLang: 'en',
        });
        expect(typeof extra.takeAdditions).toBe('function');

        expect(textOf(youCues().at(-1))).toContain(ODD_QUESTION);
        const answer = lastBot()!;
        expect(textOf(answer)).toContain('to empty every screen');
        const replyTexts = [...answer.querySelectorAll('.cue-reply')].map(
            (button) => button.textContent,
        );
        expect(replyTexts).toEqual(['Show me how', 'Thanks']);
        expect(answer.querySelector('.cue-cost')?.textContent).toContain(
            'Nemotron Super',
        );
        expect(answer.querySelector('.cue-cost')?.textContent).toContain(
            'tokens',
        );
        // The box is emptied and the window is ready for the next question.
        expect(
            container.querySelector<HTMLTextAreaElement>('.chat-input')!.value,
        ).toBe('');
        expect(findButton('Send')).not.toBeNull();
    });

    test('a paid assistant that fails is answered by the guide, with the door to its billing page', async () => {
        setKeys({ kimiAPIKey: 'sk-kimi' });
        seedSessions([{ id: 'paid', provider: 'kimi', model: 'kimi-k2.6' }]);
        h.askLlmBot.mockImplementation(async () => {
            throw Object.assign(new Error('the AI account is out of credit.'), {
                cause: { status: 402 },
            });
        });
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_help_search'
                ? guideHits(
                      'Clearing the screen',
                      'Press **Clear All** at the top of the Presenter.',
                  )
                : '';
        });
        await renderWindow();
        await askAndSettle(ODD_QUESTION);

        expect(h.askLlmBot.mock.calls[0][2]).toBe('kimi');
        const answer = lastBot()!;
        expect(noteOf(answer)).toBe(
            "Kimi could not answer — the AI account is out of credit. Here is what the app's own guide says.",
        );
        expect(textOf(answer)).toContain('Clearing the screen');
        expect(findButton('Open Kimi billing', answer)).not.toBeNull();
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_help_search',
            expect.objectContaining({ query: ODD_QUESTION, kind: 'manual' }),
        );
    });

    test('the app tool host failing is said in its own sentence, not blamed on the assistant', async () => {
        seedSessions([{ id: 'host' }]);
        h.askLlmBot.mockImplementation(async () => {
            throw new ToolHostError(500);
        });
        h.callTool.mockImplementation(async () => {
            throw new ToolHostError(500);
        });
        await renderWindow();
        await askAndSettle(ODD_QUESTION);

        const answer = lastBot()!;
        expect(textOf(answer)).toContain(
            "The app's own help service did not respond.",
        );
        expect(textOf(answer)).not.toContain('could not answer');
    });

    test('a general question goes to the model with no tools, and a plain follow-up stays general', async () => {
        seedSessions([{ id: 'general' }]);
        h.askLlmBot.mockImplementation(
            answerWith('The Bible is a collection of 66 books.', {
                replies: ['Tell me more'],
            }),
        );
        await renderWindow();
        await askAndSettle('/btw what is the Bible?');

        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain('what is the Bible?');
        expect(extra.isGeneral).toBe(true);
        expect(textOf(youCues().at(-1))).toContain('/btw what is the Bible?');
        expect(
            [...lastBot()!.querySelectorAll('.cue-reply')].map(
                (button) => button.textContent,
            ),
        ).toEqual(['Tell me more']);

        await askAndSettle('in khmer please');
        expect(h.askLlmBot).toHaveBeenCalledTimes(2);
        expect(h.askLlmBot.mock.calls[1][6].isGeneral).toBe(true);
    });

    test('a general question with no assistant to answer it offers the AI settings instead of the guide', async () => {
        seedSessions([{ id: 'general-off' }]);
        h.askLlmBot.mockImplementation(async () => {
            throw new Error('the service is busy');
        });
        await renderWindow();
        await askAndSettle('/btw who wrote the psalms?');

        const answer = lastBot()!;
        expect(textOf(answer)).toContain(
            'A general question needs an assistant',
        );
        expect(noteOf(answer)).toContain(
            'could not answer — the service is busy.',
        );
        await press('Open AI settings', answer);
        expect(h.openPopupWindow).toHaveBeenCalledTimes(1);
        expect(h.openPopupWindow.mock.calls[0][0]).toBe('/setting.html');
        expect(h.settings.get('setting-tabs')).toBe('a');
        // Nothing was searched in the guide for it.
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
    });
});

describe('who answers when the tab’s own assistant cannot', () => {
    test('Auto asks the first assistant that costs nothing, and the head names who answered', async () => {
        seedSessions([
            { id: 'auto', isAuto: true, provider: 'free', model: FREE_VL },
        ]);
        h.askLlmBot.mockImplementation(answerWith('Auto answered.'));
        await renderWindow();
        expect(container.textContent).toContain('chosen at each question');
        await askAndSettle(ODD_QUESTION);

        expect(h.askLlmBot.mock.calls[0][2]).toBe('free');
        expect(h.askLlmBot.mock.calls[0][3]).toBe(FREE_VL);
        expect(textOf(lastBot())).toContain('Auto answered.');
        // The first answer of a tab says nothing over it.
        expect(noteOf(lastBot())).toBe('');
        expect(container.textContent).toContain('Free · Nemotron Super VL');
    });

    test('Auto hands a question on when its pick fails before answering, and says so', async () => {
        seedSessions([
            { id: 'auto-on', isAuto: true, provider: 'free', model: FREE_VL },
        ]);
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            if (args[3] === FREE_VL) {
                throw new Error('the free pool is full.');
            }
            return answerWith('Handed on and answered.')(...args);
        });
        await renderWindow();
        await askAndSettle(ODD_QUESTION);

        expect(h.askLlmBot.mock.calls.map((call) => call[3])).toEqual([
            FREE_VL,
            FREE_SUPER,
        ]);
        expect(noteOf(lastBot())).toBe(
            'Free · Nemotron Super VL could not answer — the free pool is full. Auto asked Free · Nemotron Super instead.',
        );
        expect(container.textContent).toContain('Free · Nemotron Super');
    });

    test('a named free model that fails before a round hands on, and the note offers to switch', async () => {
        seedSessions([{ id: 'hand-on', provider: 'free', model: FREE_SUPER }]);
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            if (args[3] === FREE_SUPER) {
                throw new Error('the free pool is full.');
            }
            return answerWith('Another free model answered.')(...args);
        });
        await renderWindow();
        await askAndSettle(ODD_QUESTION);

        const answer = lastBot()!;
        expect(h.askLlmBot.mock.calls.map((call) => call[3])).toEqual([
            FREE_SUPER,
            FREE_VL,
        ]);
        expect(noteOf(answer)).toBe(
            'Free · Nemotron Super could not answer — the free pool is full. Free · Nemotron Super VL answered instead.',
        );
        // The tab keeps its own pick until a person says otherwise.
        expect(selectedText('Which model answers')).toContain('Nemotron Super');
        await press('Use Free · Nemotron Super VL for this chat', answer);
        expect(textOf(lastBot())).toContain(
            'This chat now uses Free · Nemotron Super VL.',
        );
        await waitFor(() => {
            return (
                selectedText('Which model answers')?.includes(
                    'Nemotron Super VL',
                ) === true
            );
        }, 'the tab on the model that answered');
        await press('Use Auto for this chat', answer);
        expect(textOf(lastBot())).toContain('This chat now uses Auto');
        await waitFor(() => {
            return container.textContent?.includes('Auto pick') === true;
        }, 'the tab on Auto');
    });

    test('when every free model fails, the guide answers under a note naming each of them', async () => {
        seedSessions([{ id: 'all-fail', provider: 'free', model: FREE_SUPER }]);
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            throw new Error(`${args[3]} is busy`);
        });
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_help_search'
                ? guideHits('Clearing the screen', 'Press **Clear All**.')
                : '';
        });
        await renderWindow();
        await askAndSettle(ODD_QUESTION);

        expect(h.askLlmBot).toHaveBeenCalledTimes(3);
        expect(noteOf(lastBot())).toBe(
            `Free could not answer — ${FREE_SUPER} is busy. ` +
                `Free · Nemotron Super VL could not answer — ${FREE_VL} is busy. ` +
                `Free · Nemotron Lightning could not answer — ${FREE_LIGHT} is busy. ` +
                "Here is what the app's own guide says.",
        );
        expect(textOf(lastBot())).toContain('Clearing the screen');
    });

    test('a model that already answered a round is not handed on: the guide answers', async () => {
        seedSessions([{ id: 'round', provider: 'free', model: FREE_SUPER }]);
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            await answerWith('')(...args);
            throw new Error('it went quiet');
        });
        await renderWindow();
        await askAndSettle(ODD_QUESTION);

        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        expect(noteOf(lastBot())).toContain(
            'Free could not answer — it went quiet.',
        );
        // The round it paid for is still on the answer.
        expect(lastBot()!.querySelector('.cue-cost')?.textContent).toContain(
            'tokens',
        );
    });

    test('another key of the user’s own stands in, and the tab moves to it', async () => {
        setKeys({ kimiAPIKey: 'sk-kimi', openAIAPIKey: 'sk-openai' });
        seedSessions([
            { id: 'stand-in', provider: 'kimi', model: 'kimi-k2.6' },
        ]);
        h.askLlmBot.mockImplementation(async () => {
            return {
                text: 'ChatGPT answered for Kimi.',
                standIn: {
                    provider: 'openai',
                    model: 'gpt-5-mini',
                    failedProvider: 'kimi',
                    reason: 'the AI account is out of credit',
                    issue: 'noCredit',
                },
            };
        });
        await renderWindow();
        await askAndSettle(ODD_QUESTION);

        const answer = lastBot()!;
        expect(noteOf(answer)).toBe(
            'Kimi could not answer — the AI account is out of credit. ChatGPT answered instead and this chat now uses it; pick Kimi in the row above to switch back.',
        );
        expect(findButton('Open Kimi billing', answer)).not.toBeNull();
        await waitFor(() => {
            return (
                selectedText('Which assistant answers')?.includes('ChatGPT') ===
                true
            );
        }, 'the tab moved to the stand-in');
    });

    test('the spend guard’s pause is answered by the guide, and Allow more asks again once', async () => {
        seedSessions([{ id: 'spend', provider: 'free', model: FREE_SUPER }]);
        let isPaused = true;
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            if (isPaused) {
                isPaused = false;
                throw new SpendLimitError(getSpendState());
            }
            return answerWith('Asked again and answered.')(...args);
        });
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_help_search'
                ? guideHits('Clearing the screen', 'Press **Clear All**.')
                : '';
        });
        await renderWindow();
        await askAndSettle(ODD_QUESTION);

        const paused = lastBot()!;
        expect(noteOf(paused)).toContain(
            "Here is what the app's own guide says.",
        );
        expect(textOf(paused)).toContain('Clearing the screen');
        // Allow more first, the guide's own buttons after it.
        const firstAction = paused.querySelector('.cue-actions button');
        expect(firstAction?.textContent).toBe('Allow more');
        const youCount = youCues().length;

        await press('Allow more', paused);
        await waitFor(() => {
            return (
                textOf(lastBot()).includes('Asked again and answered.') &&
                isIdle()
            );
        }, 'the question asked again');
        const carryOn = botCues().at(-2)!;
        expect(textOf(carryOn)).toContain(
            'Carrying on: the hour starts again from now, with $1 available before I pause again. Asking your question again.',
        );
        expect(h.askLlmBot.mock.calls[1][0]).toContain(ODD_QUESTION);
        // Asked again without a second echo of it.
        expect(youCues()).toHaveLength(youCount);
    });

    test('the answer that crosses four fifths of the hour’s calls carries a one-time heads-up', async () => {
        seedSessions([{ id: 'near', provider: 'free', model: FREE_SUPER }]);
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            // What the real loop writes to the ledger for every round.
            for (let index = 0; index < 121; index += 1) {
                recordSpendRound({
                    provider: 'free',
                    model: FREE_SUPER,
                    input: 10,
                    cacheRead: 0,
                    cacheWrite: 0,
                    output: 1,
                });
            }
            return answerWith('Near the limit.')(...args);
        });
        await renderWindow();
        await askAndSettle(ODD_QUESTION);

        expect(noteOf(lastBot())).toBe(
            'Heads-up: 121 of the 150 model calls an hour are used. At the limit I pause and ask before spending more; the guide keeps answering for free.',
        );
        h.askLlmBot.mockImplementation(answerWith('Said once only.'));
        await askAndSettle('And the second screen?');
        expect(noteOf(lastBot())).toBe('');
    });
});

describe('a question while it is being answered', () => {
    test('Stop ends the wait with one line and no apology, and the box is usable again', async () => {
        seedSessions([{ id: 'stop' }]);
        const { held, impl } = genHeldAnswer();
        h.askLlmBot.mockImplementation(impl);
        await renderWindow();
        await ask(ODD_QUESTION);
        await waitForAsks(1);
        expect(container.querySelector('.chat-stop')).not.toBeNull();

        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-stop')!.click();
        });
        await flush();
        expect(held.isAborted).toBe(true);
        const texts = botCues().map((cue) => textOf(cue));
        expect(texts).toHaveLength(1);
        expect(texts[0]).toContain('Stopped. I did not finish looking that up');
        expect(findButton('Send')).not.toBeNull();
    });

    test('words added while it works are folded into the answer being written', async () => {
        seedSessions([{ id: 'add' }]);
        const { held, impl } = genHeldAnswer();
        h.askLlmBot.mockImplementation(impl);
        await renderWindow();
        await ask(ODD_QUESTION);
        await waitForAsks(1);
        typeQuestion('It happens on the second screen only');
        const addButton =
            container.querySelector<HTMLButtonElement>('.chat-add');
        expect(addButton).not.toBeNull();
        await act(async () => {
            addButton!.click();
        });
        const added = youCues().at(-1)!;
        expect(textOf(added)).toContain('It happens on the second screen only');
        expect(noteOf(added)).toBe('Added while it was working.');
        expect(
            container.querySelector<HTMLTextAreaElement>('.chat-input')!.value,
        ).toBe('');

        const taken = held.extra.takeAdditions();
        expect(taken).toEqual(['It happens on the second screen only']);
        await act(async () => {
            held.release('Folded in the second screen.');
        });
        await waitFor(isIdle, 'the answer');
        expect(textOf(lastBot())).toContain('Folded in the second screen.');
        // Taken by the loop, so not asked again on its own.
        await flush();
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
    });

    test('words added too late for the loop are asked on their own, with a note saying so', async () => {
        seedSessions([{ id: 'late' }]);
        const { held, impl } = genHeldAnswer();
        h.askLlmBot.mockImplementation(impl);
        await renderWindow();
        await ask(ODD_QUESTION);
        await waitForAsks(1);
        typeQuestion('Also the colours are wrong');
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-add')!.click();
        });
        h.askLlmBot.mockImplementation(
            answerWith('The colours come from the theme.'),
        );
        await act(async () => {
            held.release('About the flicker.');
        });
        await waitForAsks(2);
        await waitFor(() => {
            return (
                textOf(lastBot()).includes(
                    'The colours come from the theme.',
                ) && isIdle()
            );
        }, 'the late addition answered');
        expect(h.askLlmBot.mock.calls[1][0]).toContain(
            'Also the colours are wrong',
        );
        expect(noteOf(lastBot())).toBe(
            'You added that after I had finished looking, so there was no round left to fold it into — I asked it on its own.',
        );
        // No second echo: the addition is already in the transcript once.
        expect(
            youCues().filter((cue) => {
                return textOf(cue).includes('Also the colours are wrong');
            }),
        ).toHaveLength(1);
    });
});

describe('what a server of the user’s own is spared', () => {
    test('a song asked for by its title or its link is drafted with no model', async () => {
        addLabServer();
        seedSessions([{ id: 'songs', provider: 'custom', model: LAB_MODEL }]);
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_lyric_validate') {
                throw new Error('the song finder is away');
            }
            return '';
        });
        await renderWindow();
        await askAndSettle('Create a lyric file for song "Amazing Grace"');
        expect(textOf(lastBot())).toContain(
            'I could not look up "Amazing Grace" just now.',
        );
        expect(h.callTool).toHaveBeenCalledWith('owa_lyric_validate', {
            mode: 'find',
            title: 'Amazing Grace',
        });

        await askAndSettle(
            'Create a lyric file from https://hymns.example.org/amazing-grace',
        );
        expect(textOf(lastBot())).toContain('just now. Check the address');
        expect(h.callTool).toHaveBeenCalledWith('owa_lyric_validate', {
            url: 'https://hymns.example.org/amazing-grace',
            mode: 'draft',
        });
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });

    test('a screen asked off is answered from the screens, and its one button runs the command', async () => {
        addLabServer();
        seedSessions([{ id: 'screen', provider: 'custom', model: LAB_MODEL }]);
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_list_screens'
                ? JSON.stringify({
                      isAnyShowing: false,
                      showingScreenIds: [],
                      screens: [],
                      displays: [{ id: 1 }],
                  })
                : '';
        });
        await renderWindow();
        await askAndSettle('Turn off the screen for me');
        const answer = lastBot()!;
        expect(textOf(answer)).toContain('Nothing to turn off.');
        expect(h.askLlmBot).not.toHaveBeenCalled();

        await press('Turn the screen on', answer);
        await waitFor(() => {
            return (
                textOf(youCues().at(-1)).includes('/screen-show') && isIdle()
            );
        }, 'the command asked as typed');
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });

    test('a where-is question for a control on show is answered by pointing at it', async () => {
        addLabServer();
        seedSessions([{ id: 'where', provider: 'custom', model: LAB_MODEL }]);
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_find_ui'
                ? JSON.stringify({
                      count: 1,
                      matches: [
                          {
                              isVisible: true,
                              tier: 0,
                              label: 'Clear All',
                              where: 'at the top of the Mini Screen panel',
                          },
                      ],
                  })
                : '';
        });
        await renderWindow();
        await askAndSettle('Where is the button for Clear All');
        expect(h.askLlmBot).not.toHaveBeenCalled();
        expect(h.callTool).toHaveBeenCalledWith('owa_find_ui', {
            text: 'Clear All',
            page: 'presenter.html',
        });
        expect(textOf(lastBot())).toContain('Clear All');
    });
});

describe('a typed line under the Bible import', () => {
    test('a request to import a Bible starts the import with no model', async () => {
        seedSessions([{ id: 'import' }]);
        await renderWindow();
        await askAndSettle('Import bible');
        expect(textOf(youCues().at(-1))).toContain('Import bible');
        expect(h.askLlmBot).not.toHaveBeenCalled();
        // Its first step: which language, by buttons.
        const buttons = [
            ...lastBot()!.querySelectorAll('.cue-actions button'),
        ].map((button) => button.textContent);
        expect(buttons).toEqual(
            expect.arrayContaining([
                'Khmer',
                'English',
                'French',
                'A file on this computer',
            ]),
        );
    });

    test('a line the waiting question cannot read is interpreted, and an unrelated one goes to the assistant', async () => {
        seedSessions([
            {
                id: 'waiting',
                messages: [
                    { id: 1, author: 'you', text: 'Import bible' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Which language is the Bible in?',
                        actions: [
                            {
                                label: 'Khmer',
                                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                                args: { step: 'language', locale: 'km' },
                            },
                        ],
                    },
                ],
            },
        ]);
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            if (args[6]?.isWaitingInput === true) {
                return { text: '{"kind":"unrelated"}' };
            }
            return answerWith('The projector is dark because no screen is on.')(
                ...args,
            );
        });
        await renderWindow();
        await askAndSettle('Why is the projector dark today?');

        expect(h.askLlmBot).toHaveBeenCalledTimes(2);
        expect(h.askLlmBot.mock.calls[0][6].isWaitingInput).toBe(true);
        expect(h.askLlmBot.mock.calls[1][0]).toContain(
            'Why is the projector dark today?',
        );
        expect(textOf(lastBot())).toContain('no screen is on');
        // Echoed once, by the import's own step.
        expect(
            youCues().filter((cue) => {
                return textOf(cue).includes('Why is the projector dark today?');
            }),
        ).toHaveLength(1);
    });
});

describe('a picture with the question', () => {
    test('a picture handed over lands in the box, a blind model is refused before any call, and the switch sends it', async () => {
        seedSessions([{ id: 'picture', provider: 'free', model: FREE_SUPER }]);
        // Taken on mount: the Presenting Control's snapshot, held by main.
        h.takenAttachment.payload = { dataUrl: PNG_DATA_URL };
        await renderWindow();
        const draftChips = () => {
            return container.querySelectorAll('form.chat-ask .chat-clip');
        };
        await waitFor(() => draftChips().length === 1, 'the snapshot chip');
        // And one pushed while the window is up.
        await act(async () => {
            h.emit('main:app:chat-attach', {}, { dataUrl: PNG_DATA_URL });
        });
        await waitFor(() => draftChips().length === 2, 'the second chip');
        expect(draftChips()[0].textContent).toContain('my screen');

        await ask('What is wrong here?');
        await flush();
        expect(h.askLlmBot).not.toHaveBeenCalled();
        const error = container.querySelector('.chat-attach-error')!;
        expect(error.textContent).toContain(
            'This assistant cannot look at pictures.',
        );
        // Nothing went into the transcript, and the pictures stay in the box.
        expect(youCues()).toHaveLength(0);
        expect(draftChips()).toHaveLength(2);

        h.askLlmBot.mockImplementation(answerWith('I can see two screens.'));
        await press('Use Nemotron Super VL', error);
        expect(container.querySelector('.chat-attach-error')).toBeNull();
        await waitFor(() => {
            return (
                selectedText('Which model answers')?.includes(
                    'Nemotron Super VL',
                ) === true
            );
        }, 'the model that sees');
        await pressSend();
        await waitFor(() => {
            return botCues().length === 1 && isIdle();
        }, 'the answer about the picture');
        const [asked, , , model, , , extra] = h.askLlmBot.mock.calls[0];
        expect(model).toBe(FREE_VL);
        expect(extra.images).toHaveLength(2);
        expect(asked).toContain('What is wrong here?');
        // The question carries its pictures in the transcript, the box is empty.
        expect(youCues()[0].querySelectorAll('.chat-clip')).toHaveLength(2);
        expect(draftChips()).toHaveLength(0);
    });

    test('a custom model not marked as seeing is told where to tick the box', async () => {
        addLabServer('qwen3:4b');
        seedSessions([
            { id: 'blind-custom', provider: 'custom', model: LAB_MODEL },
        ]);
        await renderWindow();
        await act(async () => {
            h.emit('main:app:chat-attach', {}, { dataUrl: PNG_DATA_URL });
        });
        await waitFor(() => {
            return (
                container.querySelectorAll('form.chat-ask .chat-clip')
                    .length === 1
            );
        }, 'the chip');
        await ask('What is this?');
        await flush();
        expect(
            container.querySelector('.chat-attach-error')?.textContent,
        ).toContain('This model is not marked as able to look at pictures.');
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });

    test('with nobody to answer, a picture with no words is told the guide cannot see it', async () => {
        seedSessions([
            { id: 'offline-picture', provider: 'free', model: FREE_VL },
        ]);
        h.askLlmBot.mockImplementation(async () => {
            throw new Error('the service is down');
        });
        await renderWindow();
        await act(async () => {
            h.emit('main:app:chat-attach', {}, { dataUrl: PNG_DATA_URL });
        });
        await waitFor(() => {
            return (
                container.querySelectorAll('form.chat-ask .chat-clip')
                    .length === 1
            );
        }, 'the chip');
        await pressSend();
        await waitFor(() => botCues().length === 1 && isIdle(), 'the answer');
        expect(textOf(lastBot())).toContain(
            'I cannot look at pictures while I am offline.',
        );
        expect(noteOf(lastBot())).toContain(
            'Free could not answer — the service is down.',
        );
        // The guide was never searched for a picture.
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
    });
});

describe('a walkthrough card stuck on a step', () => {
    const request = {
        token: 7,
        title: 'Clear the screen',
        stepNumber: 2,
        stepCount: 3,
        stepText: 'Press Clear All',
        reason: 'nothing on screen to act on',
        looked: ['Clear All'],
    };
    const cardAnswers = () => {
        return h.sent.filter((one) => {
            return one.channel === 'all:app:guide-help-answer';
        });
    };

    test('asks the assistant with no history and answers the card in one line', async () => {
        seedSessions([
            {
                id: 'rescue',
                messages: [
                    { id: 1, author: 'you', text: 'How do I clear it?' },
                    { id: 2, author: 'bot', text: 'Press Clear All.' },
                ],
            },
        ]);
        h.askLlmBot.mockImplementation(
            answerWith(
                'I looked at the window.\nDO: Press **Clear All** at the top.\nOPTIONS: Yes | No',
            ),
        );
        await renderWindow();
        await act(async () => {
            h.emit('main:app:guide-help', {}, request);
        });
        await waitFor(() => cardAnswers().length === 1, 'the card answered');

        const [asked, , , , turns] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain('The user is following a step-by-step card');
        expect(asked).toContain('Press Clear All');
        expect(turns).toEqual([]);
        expect(cardAnswers()[0].data).toEqual({
            token: 7,
            text: 'Press Clear All at the top.',
        });
        const shown = youCues().at(-1)!;
        expect(textOf(shown)).toContain(
            'The walkthrough got stuck on step 2 of "Clear the screen"',
        );
        expect(noteOf(shown)).toBe(
            'Asked by the walkthrough card, not by you.',
        );
        expect(textOf(lastBot())).toContain('Press Clear All at the top.');
        // A card's answer carries no buttons into this transcript.
        expect(lastBot()!.querySelectorAll('.cue-reply')).toHaveLength(0);
    });

    test('a failed rescue says why in the tab and tells the card nothing is coming', async () => {
        setKeys({ kimiAPIKey: 'sk-kimi' });
        seedSessions([
            { id: 'rescue-fail', provider: 'kimi', model: 'kimi-k2.6' },
        ]);
        h.askLlmBot.mockImplementation(async () => {
            throw Object.assign(new Error('the key was refused'), {
                cause: { status: 401 },
            });
        });
        await renderWindow();
        await act(async () => {
            h.emit('main:app:guide-help', {}, request);
        });
        await waitFor(() => cardAnswers().length === 1, 'the card told');

        expect(cardAnswers()[0].data).toEqual({ token: 7, text: '' });
        const failed = lastBot()!;
        expect(textOf(failed)).toContain(
            'Kimi could not answer — the key was refused.',
        );
        expect(findButton('Open AI settings', failed)).not.toBeNull();
        // Never the guide's answer to a machine-written prompt.
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
    });

    test('a rescue paused by the spend guard says the pause and offers Allow more', async () => {
        seedSessions([{ id: 'rescue-spend' }]);
        const pause = new SpendLimitError(getSpendState());
        h.askLlmBot.mockImplementation(async () => {
            throw pause;
        });
        await renderWindow();
        await act(async () => {
            h.emit('main:app:guide-help', {}, request);
        });
        await waitFor(() => cardAnswers().length === 1, 'the card told');
        expect(cardAnswers()[0].data.text).toBe('');
        const paused = lastBot()!;
        expect(findButton('Allow more', paused)).not.toBeNull();
        expect(pause.message.length).toBeGreaterThan(0);
        expect(textOf(paused)).toContain(pause.message);
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
    });

    test('a rescue stopped by the person tells the card at the press', async () => {
        seedSessions([{ id: 'rescue-stop' }]);
        const { impl } = genHeldAnswer();
        h.askLlmBot.mockImplementation(impl);
        await renderWindow();
        await act(async () => {
            h.emit('main:app:guide-help', {}, request);
        });
        await waitForAsks(1);
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-stop')!.click();
        });
        await flush();
        expect(cardAnswers()).toEqual([
            {
                channel: 'all:app:guide-help-answer',
                data: { token: 7, text: '' },
            },
        ]);
    });
});

describe('pressing instead of typing', () => {
    test('a reply chip under the last answer is asked as pressed, in the app’s language', async () => {
        seedSessions([
            {
                id: 'chips',
                messages: [
                    { id: 1, author: 'you', text: ODD_QUESTION },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Is it only on screen two?',
                        replies: ['Yes, only there'],
                    },
                ],
            },
        ]);
        h.askLlmBot.mockImplementation(answerWith('Then check its cable.'));
        // The app shown in a language on disk the help window is written for
        // (English when only English is there): an English chip is still the
        // app's words.
        const appLang = listAssistantLangPackages()[0]?.langCode ?? 'en';
        document.documentElement.lang = appLang;
        await renderWindow();
        await press('Yes, only there', lastBot()!);
        await waitFor(() => botCues().length === 2 && isIdle(), 'the answer');
        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain('Yes, only there');
        expect(extra.replyLang).toBe(appLang);
        expect(textOf(youCues().at(-1))).toContain('Yes, only there');
    });

    test('a starter chip is asked with its guide page riding along; a fill-in chip goes in the box', async () => {
        seedSessions([{ id: 'starters' }]);
        h.askLlmBot.mockImplementation(answerWith('Here is how.'));
        h.callTool.mockImplementation(async (name: string, args: any) => {
            return name === 'owa_help_page'
                ? `# The page for ${args.id}\n\n1. Press the starter button.`
                : '';
        });
        await renderWindow();
        const starters = () => {
            return [
                ...container.querySelectorAll<HTMLButtonElement>(
                    '.chat-starter',
                ),
            ];
        };
        await waitFor(() => starters().length > 0, 'the starter chips');
        const template = starters().find((button) => button.title.length > 0);
        expect(template).toBeDefined();
        await act(async () => {
            template!.click();
        });
        expect(
            container.querySelector<HTMLTextAreaElement>('.chat-input')!.value,
        ).toBe(template!.textContent);
        expect(h.askLlmBot).not.toHaveBeenCalled();

        const plain = starters().find((button) => button.title.length === 0)!;
        const chipText = plain.textContent ?? '';
        await act(async () => {
            plain.click();
        });
        await waitFor(() => botCues().length === 1 && isIdle(), 'the answer');
        const asked = h.askLlmBot.mock.calls[0][0];
        expect(asked).toContain(chipText);
        expect(asked).toContain('Press the starter button.');
        expect(textOf(youCues()[0])).toContain(chipText);
    });
});
