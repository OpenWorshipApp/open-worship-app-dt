// @vitest-environment jsdom

// The help window's model road for the conversations of their own -- a
// question in another language, a verse being looked for, the Bible
// Reader's material, a Resources file, a Lookup record -- and the advice the
// window adds under an answer. Driven through the window's DOM; nothing
// reaches a provider or the app's tool host (`askLlmBot` and `callTool` are
// this file's own scripted fakes), and every pure helper stays real.

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
import { ASK_SMARTER_TOOL_NAME, SMARTER_ASK_HINT } from './answerRatingHelpers';
import { RESOURCES_RANGE_HINT } from './resourcesChatHelpers';

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

function repliesOf(element: Element | null | undefined) {
    return [...(element?.querySelectorAll('.cue-reply') ?? [])].map(
        (button) => button.textContent ?? '',
    );
}

function actionsOf(element: Element | null | undefined) {
    return [...(element?.querySelectorAll('.cue-actions button') ?? [])].map(
        (button) => button.textContent ?? '',
    );
}

function failWith(message: string, cause?: any) {
    return async () => {
        throw Object.assign(
            new Error(message),
            cause === undefined ? {} : { cause },
        );
    };
}

describe('a verse being looked for', () => {
    const VERSE_ASK = 'Help me find a Bible verse in "KJV": love your enemies';
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

    test('the window searches first, the assistant starts from what it found, and a plain line under it searches on', async () => {
        seedSessions([{ id: 'verse' }]);
        h.callTool.mockImplementation(async (name: string, args: any) => {
            return name === 'owa_find_verse' && args?.words !== undefined
                ? foundVerses
                : '';
        });
        h.askLlmBot.mockImplementation(
            answerWith('Matthew 5:44 says to love your enemies.'),
        );
        await renderWindow();
        await askAndSettle(VERSE_ASK);

        expect(h.callTool).toHaveBeenCalledWith('owa_find_verse', {
            bible: 'KJV',
            words: 'love your enemies',
        });
        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain('Matthew 5:44');
        expect(extra.verseFind).toMatchObject({
            bible: 'KJV',
            words: 'love your enemies',
        });
        // No translation behind the scenes for a verse being looked for.
        expect(extra.isTranslation).toBeUndefined();

        await askAndSettle('the one about the other cheek');
        expect(h.callTool).toHaveBeenCalledWith('owa_find_verse', {
            bible: 'KJV',
            words: 'the one about the other cheek',
        });
        expect(h.askLlmBot.mock.calls[1][6].verseFind.bible).toBe('KJV');
    });

    test('with no assistant, the window’s own search is the answer, and so it is under a pause', async () => {
        setKeys({ kimiAPIKey: 'sk-kimi' });
        seedSessions([
            { id: 'verse-offline', provider: 'kimi', model: 'kimi-k2.6' },
        ]);
        h.callTool.mockImplementation(async (name: string, args: any) => {
            return name === 'owa_find_verse' && args?.words !== undefined
                ? foundVerses
                : '';
        });
        h.askLlmBot.mockImplementation(failWith('the service is busy'));
        await renderWindow();
        await askAndSettle(VERSE_ASK);

        expect(textOf(lastBot())).toContain('Matthew 5:44');
        expect(noteOf(lastBot())).toBe(
            'Kimi could not answer — the service is busy. I searched the Bible for your words myself instead.',
        );

        const pause = new SpendLimitError(getSpendState());
        h.askLlmBot.mockImplementation(async () => {
            throw pause;
        });
        await askAndSettle('love thy neighbour');
        expect(noteOf(lastBot())).toBe(
            `${pause.message} I searched the Bible for your words myself instead.`,
        );
        expect(findButton('Allow more', lastBot()!)).not.toBeNull();
    });
});

describe('the Bible Reader’s own material', () => {
    test('a typed passage is asked with the Bible the reader reads, and a plain line under it stays there', async () => {
        seedSessions([{ id: 'reader', focus: 'reader' }]);
        h.callTool.mockImplementation(async (name: string, args: any) => {
            return name === 'owa_find_verse' &&
                Object.keys(args ?? {}).length === 0
                ? JSON.stringify({
                      bible: 'KJV',
                      bibles: [{ key: 'KJV', locale: 'en' }],
                  })
                : '';
        });
        h.askLlmBot.mockImplementation(
            answerWith('Romans 8:28 is about hope.'),
        );
        await renderWindow();
        await askAndSettle('Romans 8:28');

        expect(h.callTool).toHaveBeenCalledWith(
            'owa_find_verse',
            {},
            expect.any(AbortSignal),
        );
        const extra = h.askLlmBot.mock.calls[0][6];
        expect(extra.bibleReader).toMatchObject({ canSeePictures: false });
        expect(typeof extra.bibleReader.intent).toBe('string');

        await askAndSettle('and what about the verse after it?');
        expect(h.askLlmBot.mock.calls[1][6].bibleReader).toBeDefined();
    });
});

describe('a Resources file open in the tab', () => {
    const VERSES_TEXT =
        'Moreover if thy brother shall trespass against thee, go and tell him his fault.';
    const ANSWER_WITH_REFERENCES =
        'Matthew 18:15-17 teaches how to settle a quarrel.\n\nReferences: Matthew 5:23, Luke 17:3';

    function openPdfTab(more: SeedSessionType = { id: 'pdf' }) {
        h.resourceDirs = ['/data/pdf'];
        seedSessions([
            {
                ...more,
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
                    {
                        id: 2,
                        author: 'bot',
                        text: 'MAT.18.pdf is attached below.',
                        replies: ['Read', 'What is this file about?'],
                        resourceReading: {
                            bookKey: 'MAT',
                            chapter: 18,
                            verseStart: 15,
                            verseEnd: 17,
                            title: 'Matthew 18:15-17',
                            bibleKey: 'KJV',
                        },
                    },
                ],
            },
        ]);
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name !== 'owa_lookup_record') {
                return '';
            }
            if (args.ref === 'MAT 18') {
                return JSON.stringify({
                    passages: [{ key: 'MAT 18:1-35' }],
                });
            }
            return JSON.stringify({
                bible: 'KJV',
                passages: [
                    {
                        key: args.ref,
                        ref: args.ref,
                        title: `Matthew ${args.ref}`,
                        text: VERSES_TEXT,
                    },
                ],
            });
        });
    }

    test('a chosen range is read from the Bible first, rides the ask with its hint, and its references become buttons', async () => {
        openPdfTab();
        h.askLlmBot.mockImplementation(answerWith(ANSWER_WITH_REFERENCES));
        await renderWindow();
        await askAndSettle('15-17');

        expect(h.callTool).toHaveBeenCalledWith(
            'owa_lookup_record',
            { kind: 'verse', ref: 'MAT 18', bible: 'KJV' },
            expect.any(AbortSignal),
            null,
        );
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_lookup_record',
            { kind: 'verse', ref: 'MAT 18:15-17', bible: 'KJV' },
            expect.any(AbortSignal),
            null,
        );
        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain(RESOURCES_RANGE_HINT.slice(0, 60));
        expect(asked).toContain(VERSES_TEXT);
        expect(asked).toContain('(MAT 18:1-35)');
        expect(extra.resources).toEqual({
            canSeePictures: false,
            openFiles: ['pdf/MAT.18.pdf'],
        });
        const replies = repliesOf(lastBot());
        expect(replies).toEqual(
            expect.arrayContaining(['Matthew 5:23', 'Luke 17:3', '18', '19']),
        );

        // A pressed reference is read in the passage it came from.
        h.askLlmBot.mockImplementation(answerWith('Matthew 5:23 is about it.'));
        await press('Matthew 5:23', lastBot()!);
        await waitFor(
            () => botCues().length === 3 && isIdle(),
            'the reference',
        );
        const pressed = h.askLlmBot.mock.calls[1][0];
        expect(pressed).toContain('They pressed "Matthew 5:23" on the card');
        expect(pressed).toContain('Matthew 18:15-17 teaches how to settle');
    });

    test('a reading that ran away is not shown: the verses read from the Bible stand in for it', async () => {
        openPdfTab();
        h.askLlmBot.mockImplementation(
            answerWith('amen amen amen amen amen amen amen amen'),
        );
        await renderWindow();
        await askAndSettle('15-17');

        const shown = textOf(lastBot());
        expect(shown).toContain(VERSES_TEXT);
        expect(shown).toContain(
            'I could not read the PDF explanation reliably, so I did not show it.',
        );
        expect(shown).not.toContain('amen amen');
    });

    test('with no assistant a passage shows its verses, and any other question the way to one', async () => {
        setKeys({ kimiAPIKey: 'sk-kimi' });
        openPdfTab({ id: 'pdf-offline', provider: 'kimi', model: 'kimi-k2.6' });
        h.askLlmBot.mockImplementation(failWith('the service is busy'));
        await renderWindow();
        await askAndSettle('15-17');
        expect(textOf(lastBot())).toContain(VERSES_TEXT);
        expect(noteOf(lastBot())).toBe(
            'Kimi could not answer — the service is busy.',
        );

        await askAndSettle('Sum up the main points');
        expect(textOf(lastBot())).toContain(
            'A question about this needs an assistant',
        );
        expect(findButton('Open AI settings', lastBot()!)).not.toBeNull();
        // Never the guide's search for a Resources question.
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_help_search',
            expect.anything(),
        );
    });

    test('Read is the window’s own verse menu, the passage being read first, with no model', async () => {
        openPdfTab();
        await renderWindow();
        await press('Read', lastBot()!);
        await flush();
        expect(h.askLlmBot).not.toHaveBeenCalled();
        expect(textOf(lastBot())).toContain(
            'You are reading 15-17 — press it, or choose another below.',
        );
        expect(repliesOf(lastBot())).toEqual([
            '15-17',
            '1',
            '2',
            '3',
            '1-3',
            'Full chapter',
        ]);
    });

    test('Full chapter asks each verse in turn as a card of its own', async () => {
        openPdfTab();
        const baseCallTool = h.callTool.getMockImplementation()!;
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_lookup_record' && args.ref === 'MAT 18') {
                return JSON.stringify({ passages: [{ key: 'MAT 18:1-2' }] });
            }
            return baseCallTool(name, args);
        });
        h.askLlmBot.mockImplementation(async (...args: any[]) => {
            return answerWith(`Card for ${args[6].askedText}.`)(...args);
        });
        await renderWindow();
        await press('Read', lastBot()!);
        await flush();
        await press('Full chapter', lastBot()!);
        await waitForAsks(2);
        await waitFor(() => {
            return textOf(lastBot()).includes('Card for 2.') && isIdle();
        }, 'the second verse');

        const asked = h.askLlmBot.mock.calls.map((call) => call[6].askedText);
        expect(asked).toEqual(['1', '2']);
        // Each verse alone: no history rides with it.
        expect(h.askLlmBot.mock.calls[0][4]).toEqual([]);
        // The press is said once; each verse is a card under it.
        expect(
            youCues().filter((cue) => textOf(cue).includes('Full chapter')),
        ).toHaveLength(1);
        expect(textOf(botCues().at(-2))).toContain('Card for 1.');
    });

    test('Full chapter stops going on once another tab is in front', async () => {
        openPdfTab();
        // The same tab, beside another one.
        const pdfSession = JSON.parse(h.settings.get('chatbot-sessions')!)
            .sessions[0];
        seedSessions(
            [
                { ...pdfSession, id: 'pdf' },
                { id: 'other', title: 'Other chat' },
            ],
            'pdf',
        );
        const baseCallTool = h.callTool.getMockImplementation()!;
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_lookup_record' && args.ref === 'MAT 18') {
                return JSON.stringify({ passages: [{ key: 'MAT 18:1-2' }] });
            }
            return baseCallTool(name, args);
        });
        const { held, impl } = genHeldAnswer();
        h.askLlmBot.mockImplementation(impl);
        await renderWindow();
        await press('Read', lastBot()!);
        await flush();
        await press('Full chapter', lastBot()!);
        await waitForAsks(1);
        const otherTab = [
            ...container.querySelectorAll<HTMLButtonElement>('.chat-tab-name'),
        ].find((button) => button.textContent === 'Other chat')!;
        await act(async () => {
            otherTab.click();
        });
        await act(async () => {
            held.release('Card for 1.');
        });
        await flush(6);
        // Verse 1 was answered in its own tab; verse 2 was never asked.
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
    });
});

describe('a person, place or passage from the Lookup panel', () => {
    const noahCard = {
        id: 1,
        author: 'bot',
        text: 'Here is what the app holds on Noah.',
        lookup: {
            kind: 'name',
            target: 'noah',
            title: 'Noah',
            facts: JSON.stringify({
                name: 'Noah',
                summary: 'Noah built the ark.',
            }),
        },
    };

    test('a line under the record is asked about it, with the record heading the conversation', async () => {
        seedSessions([{ id: 'noah', messages: [noahCard] }]);
        h.askLlmBot.mockImplementation(answerWith('He planted a vineyard.'));
        await renderWindow();
        await askAndSettle('What did he do after the flood?');

        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain('What did he do after the flood?');
        expect(asked).toContain(
            'its record is at the start of this conversation',
        );
        expect(extra.lookup.page).toBeNull();
        expect(extra.lookup.record).toContain('Noah built the ark.');
        expect(actionsOf(lastBot())).toContain('More things to do');

        await askAndSettle('And who were his sons?');
        expect(h.askLlmBot.mock.calls[1][6].lookup).toBeDefined();
    });

    test('with no assistant, the record’s own words answer, with the way to an assistant', async () => {
        setKeys({ kimiAPIKey: 'sk-kimi' });
        seedSessions([
            {
                id: 'noah-offline',
                provider: 'kimi',
                model: 'kimi-k2.6',
                messages: [noahCard],
            },
        ]);
        h.askLlmBot.mockImplementation(failWith('the service is busy'));
        await renderWindow();
        await askAndSettle('What did he do after the flood?');

        expect(textOf(lastBot())).toContain('Noah built the ark.');
        expect(actionsOf(lastBot())).toEqual(
            expect.arrayContaining(['Open AI settings', 'More things to do']),
        );
    });

    test('a verse named by number under a passage is read for the question first', async () => {
        seedSessions([
            {
                id: 'passage',
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'Genesis 8 in the KJV.',
                        lookup: {
                            kind: 'verse',
                            target: 'GEN 8:1-22',
                            title: 'Genesis 8',
                            bibleKey: 'KJV',
                            facts: JSON.stringify({
                                bible: 'KJV',
                                passages: [
                                    {
                                        key: 'GEN 8:1-22',
                                        title: 'Genesis 8',
                                        text: 'And God remembered Noah.',
                                    },
                                ],
                            }),
                        },
                    },
                ],
            },
        ]);
        h.callTool.mockImplementation(async (name: string, args: any) => {
            return name === 'owa_lookup_record' && args.related === true
                ? JSON.stringify({
                      passages: [{ title: 'Genesis 8:20' }],
                      crossRefs: {
                          byVerse: [{ themes: [{ theme: 'an altar' }] }],
                      },
                  })
                : '';
        });
        h.askLlmBot.mockImplementation(answerWith('Noah built an altar.'));
        await renderWindow();
        await askAndSettle('What does verse 20 say about worship?');

        expect(h.callTool).toHaveBeenCalledWith(
            'owa_lookup_record',
            { kind: 'verse', bible: 'KJV', ref: 'GEN 8:20', related: true },
            expect.any(AbortSignal),
        );
        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain('Read for this question');
        expect(asked).toContain('an altar');
        expect(extra.lookup.isReadForAsk).toBe(true);
        expect(actionsOf(lastBot())).toEqual(
            expect.arrayContaining(['Previous chapter', 'Next chapter']),
        );
    });

    test('a how-to about the app under a passage goes to the ordinary assistant with the card’s buttons', async () => {
        seedSessions([
            {
                id: 'passage-app',
                messages: [
                    {
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
                                        title: 'John 3:16',
                                        text: 'For God so loved the world.',
                                    },
                                ],
                            }),
                        },
                    },
                ],
            },
        ]);
        h.askLlmBot.mockImplementation(
            answerWith('Open the Presenter and pick the verse.'),
        );
        await renderWindow();
        await askAndSettle(
            'How do I put this passage on the projector screen?',
        );

        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain(
            'They are asking how to do something in this app about the passage',
        );
        expect(extra.lookup).toBeUndefined();
        // Still about the passage: the next line stays in its conversation.
        expect(actionsOf(lastBot())).toContain('More things to do');
    });
});

describe('the advice the window adds under an answer', () => {
    test('“That is wrong” under a guide answer reads the page again and offers the next model up', async () => {
        setKeys({ kimiAPIKey: 'sk-kimi' });
        seedSessions([
            {
                id: 'dispute',
                provider: 'kimi',
                model: 'kimi-k2.6',
                messages: [
                    {
                        id: 1,
                        author: 'you',
                        text: 'How do I clear the screen?',
                    },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Press **Clear All** at the top.',
                        actions: [
                            {
                                label: 'Show me step by step',
                                toolName: 'owa_guide_start',
                                args: {
                                    manualId: 'W-06',
                                    find: 'Clear All',
                                    page: 'presenter.html',
                                    mode: 'show',
                                },
                            },
                        ],
                    },
                ],
            },
        ]);
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_find_ui'
                ? JSON.stringify({ count: 0, matches: [] })
                : '';
        });
        h.askLlmBot.mockImplementation(
            answerWith('Sorry, try the Mini Screen.'),
        );
        await renderWindow();
        await askAndSettle('That is wrong');

        expect(h.callTool).toHaveBeenCalledWith(
            'owa_find_ui',
            expect.objectContaining({ text: 'Clear All' }),
            expect.any(AbortSignal),
        );
        const answer = lastBot()!;
        expect(noteOf(answer)).toBe(
            'A smarter model often gets right what this one did not. This tab is asking Kimi · Kimi K2.6; Kimi K2.7 is the next one up.',
        );
        expect(actionsOf(answer)).toContain('Ask again with Kimi K2.7');

        h.askLlmBot.mockImplementation(
            answerWith('Clear All is in the Mini Screen.'),
        );
        await press('Ask again with Kimi K2.7', answer);
        await waitFor(() => {
            return textOf(lastBot()).includes('Mini Screen.') && isIdle();
        }, 'the smarter answer');
        const [asked, , , model] = h.askLlmBot.mock.calls[1];
        expect(model).toBe('kimi-k2.7-code-highspeed');
        expect(asked).toContain('How do I clear the screen?');
        expect(asked).toContain(SMARTER_ASK_HINT);
        expect(noteOf(lastBot())).toBe(
            'Asked again with Kimi K2.7, and this chat now uses it — pick another in the MODEL list at the top of this window to switch back.',
        );
        await waitFor(() => {
            return (
                selectedText('Which model answers')?.includes('K2.7') === true
            );
        }, 'the tab on the smarter model');
    });

    test('an old “Ask again with” button for a model the tab no longer has says so', async () => {
        setKeys({ kimiAPIKey: 'sk-kimi' });
        seedSessions([
            {
                id: 'stale',
                provider: 'kimi',
                model: 'kimi-k2.6',
                messages: [
                    {
                        id: 1,
                        author: 'you',
                        text: 'How do I clear the screen?',
                    },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Press Clear All.',
                        actions: [
                            {
                                label: 'Ask again with Opus 5',
                                toolName: ASK_SMARTER_TOOL_NAME,
                                args: {
                                    model: 'claude-opus-5',
                                    question: 'How do I clear the screen?',
                                },
                            },
                        ],
                    },
                ],
            },
        ]);
        await renderWindow();
        await press('Ask again with Opus 5', lastBot()!);
        expect(textOf(lastBot())).toContain(
            'This chat is not asking that assistant any more.',
        );
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });

    test('a question about reading the Bible, asked off the Reader, ends with the way back to it', async () => {
        seedSessions([{ id: 'route' }]);
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_app_state'
                ? JSON.stringify({ mainWindow: { page: 'presenter.html' } })
                : '';
        });
        h.askLlmBot.mockImplementation(answerWith('Use the Bible Lookup.'));
        await renderWindow();
        await askAndSettle('How can I open the Bible to read it?');

        expect(h.callTool).toHaveBeenCalledWith(
            'owa_app_state',
            {},
            expect.any(AbortSignal),
        );
        const answer = lastBot()!;
        expect(textOf(answer)).toContain('Use the Bible Lookup.');
        expect(actionsOf(answer)).toContain('Go to the Bible Reader');

        await press('Go to the Bible Reader', answer);
        await waitFor(() => {
            return (
                textOf(youCues().at(-1)).includes('/goto reader') && isIdle()
            );
        }, 'the command asked as typed');
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
    });

    test('a verse asked for by its words in the Reader, with no Bible to search, points at Bible Find', async () => {
        seedSessions([{ id: 'find', focus: 'reader' }]);
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_find_verse') {
                throw new Error('no Bible is installed');
            }
            return '';
        });
        h.askLlmBot.mockImplementation(answerWith('That is Matthew 5:44.'));
        await renderWindow();
        await askAndSettle('Which verse says love your enemies?');

        const answer = lastBot()!;
        expect(actionsOf(answer)).toContain('Show me Bible Find');
        expect(textOf(answer)).toContain('That is Matthew 5:44.');
    });
});

describe('which window the answer is about', () => {
    test('a tab that never chose follows the window it was opened from', async () => {
        seedSessions([
            { id: 'opener', isFocusChosen: false, focus: 'presenter' },
        ]);
        h.askLlmBot.mockImplementation(
            answerWith('In the Reader, press Find.'),
        );
        await renderWindow();
        Object.defineProperty(window, 'opener', {
            value: {
                location: {
                    pathname: '/reader.html',
                    href: 'https://localhost:3000/reader.html',
                },
            },
            configurable: true,
            writable: true,
        });
        await askAndSettle(ODD_QUESTION);
        expect(h.askLlmBot.mock.calls[0][1]).toBe('reader');
    });

    test('with two windows open, a picture is told to the model with the window it is of', async () => {
        h.electronSendAsync.mockImplementation(
            (channel: string, data?: any) => {
                if (channel === 'main:app:list-app-windows') {
                    return Promise.resolve([
                        {
                            id: 'w-main',
                            title: 'Presenter',
                            url: 'https://localhost:3000/presenter.html',
                        },
                        {
                            id: 'w-setting',
                            title: 'Settings',
                            url: 'https://localhost:3000/setting.html?uuid=setting',
                        },
                    ]);
                }
                return defaultElectronSendAsync(channel, data);
            },
        );
        seedSessions([{ id: 'windows', provider: 'free', model: FREE_VL }]);
        h.askLlmBot.mockImplementation(answerWith('That is the Presenter.'));
        await renderWindow();
        await waitFor(() => {
            return (
                container.querySelector('select[aria-label="Which window"]') !==
                null
            );
        }, 'the window line');
        await act(async () => {
            h.emit('main:app:chat-attach', {}, { dataUrl: PNG_DATA_URL });
        });
        await waitFor(() => {
            return (
                container.querySelectorAll('form.chat-ask .chat-clip')
                    .length === 1
            );
        }, 'the picture');
        await askAndSettle('What is this?');
        const asked = h.askLlmBot.mock.calls[0][0];
        expect(asked).toContain('w-main');
    });
});
