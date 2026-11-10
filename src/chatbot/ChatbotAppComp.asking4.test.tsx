// @vitest-environment jsdom

// The buttons pressed under the help window's answers -- the pseudo tools no
// model can press, a drafted song's two buttons, a guide action and its
// follow-up -- and the keys and overlay of the window itself, driven through
// its own DOM. Nothing reaches a provider, the tool host, the clipboard or
// the disk: `askLlmBot`, `callTool` and the clipboard are this file's own
// scripted fakes, and every pure helper stays real.

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
import { resetSpendGuardForTests } from './spendGuardHelpers';
import { clearAutoSetbacks } from './autoAssistantHelpers';
import { clearAutoAwayServers } from './autoAssistantSourceHelpers';
import { BIBLE_IMPORT_STEP_TOOL_NAME } from './bibleImportChatHelpers';
import {
    DRAFT_GONE_TEXT,
    LYRIC_COPY_TOOL_NAME,
    LYRIC_CREATE_TOOL_NAME,
    keepDraftedLyric,
} from './lyricDraftHelpers';
import { LOOKUP_STEP_TOOL_NAME } from './lookupStepHelpers';
import {
    VERSE_FIND_STEP_TOOL_NAME,
    VERSE_WEB_SEARCH_TOOL_NAME,
} from './verseFindChatHelpers';
import { RESOURCE_ASK_TOOL_NAME } from './resourcesChatHelpers';
import { GENERAL_ASK_TOOL_NAME } from './llmBotHelpers';
import { USE_ASSISTANT_TOOL_NAME } from './autoAssistantHelpers';
import { SPEND_ALLOW_TOOL_NAME, setSpendLimitUsd } from './spendGuardHelpers';
import {
    OPEN_AI_SETTING_TOOL_NAME,
    OPEN_PROVIDER_PAGE_TOOL_NAME,
} from './providerIssueHelpers';
import { ASK_SMARTER_TOOL_NAME } from './answerRatingHelpers';

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

function chipNamesOf(element: Element | null | undefined) {
    return [...(element?.querySelectorAll('.chat-clip-name') ?? [])].map(
        (name) => name.textContent ?? '',
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

function keyDown(target: Element, init: KeyboardEventInit) {
    act(() => {
        target.dispatchEvent(
            new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                ...init,
            }),
        );
    });
}

function box() {
    return container.querySelector<HTMLTextAreaElement>('.chat-input')!;
}

describe('a drafted song’s two buttons', () => {
    const SONG = '- Title: Amazing Grace\n\nAmazing grace, how sweet the sound';

    function seedDraft() {
        const drafted = keepDraftedLyric(SONG);
        seedButtons([
            {
                label: 'Create "Amazing Grace"',
                toolName: LYRIC_CREATE_TOOL_NAME,
                args: { reference: drafted.reference },
            },
            {
                label: 'Copy song text',
                toolName: LYRIC_COPY_TOOL_NAME,
                args: { reference: drafted.reference },
            },
        ]);
        return drafted;
    }

    test('Copy puts the song on the clipboard, and says so when it cannot', async () => {
        const drafted = seedDraft();
        await renderWindow();
        await press('Copy song text');
        await waitFor(isIdle, 'the copy');
        expect(h.writeClipboardText).toHaveBeenCalledWith(drafted.content);
        expect(saidOf(lastBot())).toBe(
            'Copied. Paste it into the Lyric Editor and it will open as a song.',
        );

        h.writeClipboardText.mockImplementation(async () => {
            throw new Error('denied');
        });
        await press('Copy song text', botCues()[0]);
        await waitFor(isIdle, 'the failed copy');
        expect(saidOf(lastBot())).toBe(
            'I could not reach the clipboard. The song is in my answer above — you can select and copy it from there.',
        );
    });

    test('Create saves it under a free name and shows where it went; a failed write says so', async () => {
        const drafted = seedDraft();
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name !== 'owa_lyric_file') {
                return '';
            }
            return args.action === 'list'
                ? JSON.stringify({ names: ['amazing grace'] })
                : JSON.stringify({ filePath: '/docs/Amazing Grace (1).lyric' });
        });
        await renderWindow();
        await press('Create "Amazing Grace"');
        await waitFor(() => botCues().length === 2 && isIdle(), 'the save');

        expect(h.callTool).toHaveBeenCalledWith('owa_lyric_file', {
            action: 'create',
            name: 'Amazing Grace (1)',
            content: drafted.content,
        });
        const saved = lastBot()!;
        expect(saidOf(saved)).toContain('Saved as "Amazing Grace (1)".');
        expect(chipNamesOf(saved)).toEqual([
            'Show it in the list',
            'Amazing Grace (1)',
        ]);

        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_lyric_file' && args.action === 'create') {
                throw new Error('the disk is full');
            }
            return JSON.stringify({ names: [] });
        });
        await press('Create "Amazing Grace"', botCues()[0]);
        await waitFor(() => botCues().length === 3 && isIdle(), 'the failure');
        expect(h.handleError).toHaveBeenCalledTimes(1);
        expect(saidOf(lastBot())).toBe(
            'That song could not be saved. Check there is room in your documents folder, then press the button again.',
        );
    });

    test('a song this window no longer holds asks for the words again', async () => {
        seedButtons([
            {
                label: 'Copy song text',
                toolName: LYRIC_COPY_TOOL_NAME,
                args: { reference: 'lyric-gone-1' },
            },
        ]);
        await renderWindow();
        await press('Copy song text');
        await waitFor(() => botCues().length === 2, 'the answer');
        expect(saidOf(lastBot())).toBe(DRAFT_GONE_TEXT);
        expect(h.writeClipboardText).not.toHaveBeenCalled();
    });
});

describe('the buttons no model can press', () => {
    test('a lookup step on a broken record does nothing; a good one opens its own answer', async () => {
        seedButtons([
            {
                label: 'Broken step',
                toolName: LOOKUP_STEP_TOOL_NAME,
                args: { step: 'nope' },
            },
            {
                label: 'More things to do',
                toolName: LOOKUP_STEP_TOOL_NAME,
                args: {
                    step: 'more',
                    ask: { kind: 'name', target: 'noah', title: 'Noah' },
                },
            },
        ]);
        await renderWindow();
        await press('Broken step');
        await flush();
        expect(botCues()).toHaveLength(1);
        expect(youCues()).toHaveLength(0);

        await press('More things to do');
        await waitFor(() => botCues().length === 2 && isIdle(), 'the step');
        expect(saidOf(youCues().at(-1))).toBe('More things to do');
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });

    test('Search Google for it opens a search the window writes from their words', async () => {
        seedButtons([
            {
                label: 'Search Google for it',
                toolName: VERSE_WEB_SEARCH_TOOL_NAME,
                args: { words: 'love your enemies', bible: 'KJV' },
            },
        ]);
        await renderWindow();
        await press('Search Google for it');
        expect(h.openExternalURL).toHaveBeenCalledWith(
            'https://www.google.com/search?q=bible+verse+love+your+enemies',
        );
        expect(saidOf(lastBot())).toContain(
            'Opening a search for it in your browser.',
        );
    });

    test('a verse-finding step and a Bible-import step are said as the person’s own words', async () => {
        seedButtons([
            {
                label: 'Search another Bible',
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: { step: 'bible' },
            },
            {
                label: 'Sample',
                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                args: { step: 'language', locale: 'xx' },
            },
        ]);
        await renderWindow();
        await press('Search another Bible');
        await waitFor(() => botCues().length === 2 && isIdle(), 'the step');
        expect(saidOf(youCues().at(-1))).toBe('Search another Bible');
        await press('Sample', botCues()[0]);
        await waitFor(() => botCues().length === 3 && isIdle(), 'the import');
        expect(saidOf(youCues().at(-1))).toBe('Sample');
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });

    test('Ask about a Resources file that is gone says so', async () => {
        seedButtons([
            {
                label: 'Ask about LUK.7.pdf',
                toolName: RESOURCE_ASK_TOOL_NAME,
                args: { file: 'pdf/LUK.7.pdf' },
            },
        ]);
        await renderWindow();
        await press('Ask about LUK.7.pdf');
        expect(saidOf(lastBot())).toBe(
            'pdf/LUK.7.pdf is not in the Resources folders any more.',
        );
        // The window's own word, not an answer: no thumbs under it.
        expect(
            lastBot()!.querySelector('[aria-label="Bad answer"]'),
        ).toBeNull();
    });

    test('Ask it as a general question asks it with /btw, as pressed', async () => {
        seedButtons([
            {
                label: 'Ask it as a general question',
                toolName: GENERAL_ASK_TOOL_NAME,
                args: { question: 'what is grace?' },
            },
        ]);
        h.askLlmBot.mockImplementation(answerWith('Grace is a gift.'));
        await renderWindow();
        await press('Ask it as a general question');
        await waitFor(() => botCues().length === 2 && isIdle(), 'the answer');
        expect(h.askLlmBot.mock.calls[0][6].isGeneral).toBe(true);
        expect(h.askLlmBot.mock.calls[0][0]).toContain('what is grace?');
        expect(saidOf(youCues().at(-1))).toBe('/btw what is grace?');
    });

    test('Use … for this chat refuses an assistant that is not in the list', async () => {
        seedButtons([
            {
                label: 'Use Kimi for this chat',
                toolName: USE_ASSISTANT_TOOL_NAME,
                args: { provider: 'kimi', model: 'kimi-k3' },
            },
            {
                label: 'Use a withdrawn model for this chat',
                toolName: USE_ASSISTANT_TOOL_NAME,
                args: { provider: 'free', model: 'nvidia/withdrawn:free' },
            },
        ]);
        await renderWindow();
        await press('Use Kimi for this chat');
        expect(saidOf(lastBot())).toBe(
            'That assistant is not in the list any more. Pick one in the ASSISTANT list at the top of this window.',
        );
        await press('Use a withdrawn model for this chat', botCues()[0]);
        expect(botCues()).toHaveLength(3);
        expect(selectedText('Which model answers')).toContain('Nemotron Super');
    });

    test('Allow more with no hourly limit starts the hour again and asks nothing', async () => {
        setSpendLimitUsd(null);
        seedButtons([
            { label: 'Allow more', toolName: SPEND_ALLOW_TOOL_NAME, args: {} },
        ]);
        await renderWindow();
        await press('Allow more');
        expect(saidOf(lastBot())).toBe(
            'Carrying on: the hour starts again from now.',
        );
        await flush();
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });

    test('the doors under a failure: the key’s own box in Settings, and the provider’s page', async () => {
        seedButtons([
            {
                label: 'Open AI settings',
                toolName: OPEN_AI_SETTING_TOOL_NAME,
                args: { provider: 'kimi' },
            },
            {
                label: 'Open Kimi API keys',
                toolName: OPEN_PROVIDER_PAGE_TOOL_NAME,
                args: { provider: 'kimi', page: 'keys' },
            },
            {
                label: 'Open a page nobody has',
                toolName: OPEN_PROVIDER_PAGE_TOOL_NAME,
                args: { provider: 'nobody', page: 'keys' },
            },
        ]);
        await renderWindow();
        await press('Open AI settings', botCues()[0]);
        expect(h.openPopupWindow).toHaveBeenCalledTimes(1);
        expect(h.settings.get('setting-tabs')).toBe('a');
        expect([...h.settings.values()].join(' ')).toContain('kimiAPIKey');

        await press('Open Kimi API keys');
        expect(h.openExternalURL).toHaveBeenCalledTimes(1);
        const url = h.openExternalURL.mock.calls[0][0];
        expect(url).toMatch(/^https:\/\//);
        expect(saidOf(lastBot())).toBe(`Opening ${url} in your browser.`);

        await press('Open a page nobody has', botCues()[0]);
        expect(h.openExternalURL).toHaveBeenCalledTimes(1);
        expect(botCues()).toHaveLength(2);
    });

    test('Ask again with … and a general ask wait while the tab is still answering', async () => {
        setKeys({ kimiAPIKey: 'sk-kimi' });
        seedButtons(
            [
                {
                    label: 'Ask again with Kimi K3',
                    toolName: ASK_SMARTER_TOOL_NAME,
                    args: {
                        model: 'kimi-k3',
                        question: 'How do I clear the screen?',
                    },
                },
                {
                    label: 'Ask it as a general question',
                    toolName: GENERAL_ASK_TOOL_NAME,
                    args: { question: 'what is grace?' },
                },
            ],
            { id: 'busy', provider: 'kimi', model: 'kimi-k2.6' },
        );
        const { impl } = genHeldAnswer();
        h.askLlmBot.mockImplementation(impl);
        await renderWindow();
        await ask(ODD_QUESTION);
        await waitForAsks(1);
        await press('Ask again with Kimi K3', botCues()[0]);
        await press('Ask it as a general question', botCues()[0]);
        await flush();
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        expect(selectedText('Which model answers')).toContain('K2.6');
    });

    test('a guide button runs its tool and draws what came back', async () => {
        seedButtons([
            {
                label: 'Read the whole thing',
                toolName: 'owa_help_page',
                args: { id: 'W-06' },
            },
        ]);
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_help_page'
                ? '# Clearing the screen\n\n1. Press **Clear All** at the top.'
                : '';
        });
        await renderWindow();
        await press('Read the whole thing');
        await waitFor(() => botCues().length === 2 && isIdle(), 'the page');
        expect(h.callTool).toHaveBeenCalledWith('owa_help_page', {
            id: 'W-06',
        });
        expect(saidOf(lastBot())).toContain('at the top.');
    });

    test('a walkthrough that cannot point at its steps asks the model for the rest', async () => {
        seedButtons([
            {
                label: 'Show me step by step',
                toolName: 'owa_guide_start',
                args: { manualId: 'W-06', mode: 'show' },
                ask: 'Walk me through clearing the screen',
            },
        ]);
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_guide_start'
                ? JSON.stringify({
                      isRunning: true,
                      isTargetFound: false,
                      stepCount: 3,
                  })
                : '';
        });
        h.askLlmBot.mockImplementation(
            answerWith('Press Clear All at the top.'),
        );
        await renderWindow();
        await press('Show me step by step');
        await waitForAsks(1);
        await waitFor(isIdle, 'the model');
        expect(h.askLlmBot.mock.calls[0][0]).toContain(
            'Walk me through clearing the screen',
        );
        expect(saidOf(botCues().at(-2))).toContain('A card is up.');
        expect(saidOf(lastBot())).toContain('Press Clear All at the top.');
    });

    test('a guide button that fails says so in plain words, and one stopped says nothing', async () => {
        seedButtons([
            {
                label: 'Highlight again',
                toolName: 'owa_find_ui',
                args: { text: 'Clear All' },
            },
        ]);
        h.callTool.mockImplementation(async () => {
            throw new Error('The app has no open page matching setting.html');
        });
        await renderWindow();
        await press('Highlight again');
        await waitFor(() => botCues().length === 2 && isIdle(), 'the failure');
        expect(saidOf(lastBot())).toBe(
            'I could not do that just now. Ask me again, or tell me what you are trying to do and I will find another way.',
        );

        h.callTool.mockImplementation(
            (_name: string, _args: any) => new Promise(() => {}),
        );
        await press('Highlight again', botCues()[0]);
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-stop')!.click();
        });
        await flush();
        expect(saidOf(lastBot())).toBe(
            'Stopped. I did not finish looking that up — press the question above to ask it again.',
        );
    });
});

describe('the window’s own keys and overlay', () => {
    test('a guided demo in the Reader starts its card with no model', async () => {
        seedSessions([{ id: 'demo', focus: 'reader' }]);
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_guide_start'
                ? JSON.stringify({
                      isRunning: true,
                      isDemo: true,
                      stepCount: 4,
                  })
                : '';
        });
        await renderWindow();
        const demo = container.querySelector<HTMLButtonElement>('.chat-demo')!;
        const label = demo.querySelector('.chat-demo-label')!.textContent;
        await act(async () => {
            demo.click();
        });
        await waitFor(() => botCues().length === 1 && isIdle(), 'the card');
        expect(saidOf(youCues()[0])).toBe(`Guided demo: ${label}`);
        expect(h.callTool.mock.calls[0][0]).toBe('owa_guide_start');
        expect(typeof h.callTool.mock.calls[0][1].demoId).toBe('string');
        expect(saidOf(lastBot())).toContain('A card is showing step 1 of 4.');
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });

    test('Ctrl+Enter asks; plain Enter and an IME still composing do not', async () => {
        seedSessions([{ id: 'enter' }]);
        h.askLlmBot.mockImplementation(answerWith('Asked by the keys.'));
        await renderWindow();
        typeQuestion(ODD_QUESTION);
        keyDown(box(), { key: 'Enter' });
        keyDown(box(), { key: 'Enter', ctrlKey: true, isComposing: true });
        await flush();
        expect(h.askLlmBot).not.toHaveBeenCalled();
        keyDown(box(), { key: 'Enter', ctrlKey: true });
        await waitFor(() => botCues().length === 1 && isIdle(), 'the answer');
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
    });

    test('Alt+↑ brings the last question back; Escape empties a box with no list', async () => {
        seedSessions([{ id: 'recall' }]);
        h.askLlmBot.mockImplementation(answerWith('Answered.'));
        await renderWindow();
        await askAndSettle('zzqx qzzx');
        expect(box().value).toBe('');
        keyDown(box(), { key: 'ArrowUp', altKey: true });
        expect(box().value).toBe('zzqx qzzx');
        keyDown(box(), { key: 'Escape' });
        expect(box().value).toBe('');
    });

    test('the arrows walk the command list, a plain key and a modified Tab leave it, Enter takes the row', async () => {
        seedSessions([{ id: 'commands' }]);
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
        typeQuestion('/screen');
        const rows = () => {
            return [...container.querySelectorAll('[role="option"]')];
        };
        await waitFor(() => rows().length > 0, 'the command rows');
        const activeRow = () => {
            return container.querySelector(
                '[role="listbox"] [aria-selected="true"]',
            );
        };
        expect(activeRow()).toBeNull();
        keyDown(box(), { key: 'ArrowDown' });
        expect(activeRow()).not.toBeNull();
        keyDown(box(), { key: 'ArrowUp' });
        expect(activeRow()).toBeNull();
        keyDown(box(), { key: 'ArrowUp' });
        expect(activeRow()).not.toBeNull();
        keyDown(box(), { key: 'ArrowDown' });
        expect(activeRow()).toBeNull();
        // Neither of these is the list's.
        keyDown(box(), { key: 'a' });
        keyDown(box(), { key: 'Tab', shiftKey: true });
        expect(box().value).toBe('/screen');
        keyDown(box(), { key: 'ArrowDown' });
        const taken = activeRow()?.textContent ?? '';
        expect(taken).toContain('/screen');
        keyDown(box(), { key: 'Enter' });
        await waitFor(() => {
            return youCues().length === 1 && isIdle();
        }, 'the command');
        expect(saidOf(youCues()[0])).toContain('/screen');
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });

    test('a box holding two lines keeps the arrows, and Escape puts the list away', async () => {
        seedSessions([{ id: 'lines' }]);
        await renderWindow();
        typeQuestion('/screen');
        await waitFor(() => {
            return container.querySelector('[role="listbox"]') !== null;
        }, 'the list');
        keyDown(box(), { key: 'Escape' });
        expect(container.querySelector('[role="listbox"]')).toBeNull();
        expect(box().value).toBe('/screen');
        typeQuestion('clear the screen\nnow');
        await waitFor(() => {
            return container.querySelector('[role="listbox"]') !== null;
        }, 'the question rows');
        keyDown(box(), { key: 'ArrowDown' });
        expect(
            container.querySelector('[role="listbox"] [aria-selected="true"]'),
        ).toBeNull();
    });

    test('the paperclip opens the chooser, a chosen file lands in the box, and a drag over the form is let in', async () => {
        seedSessions([{ id: 'files' }]);
        await renderWindow();
        const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
        await act(async () => {
            container
                .querySelector<HTMLButtonElement>(
                    '[aria-label="Attach a file"]',
                )!
                .click();
        });
        expect(clickSpy).toHaveBeenCalledTimes(1);

        const input =
            container.querySelector<HTMLInputElement>('.chat-file-input')!;
        // jsdom's File has no `text()`; the window reads a text file by it.
        const file = Object.assign(
            new File(['the words'], 'notes.txt', { type: 'text/plain' }),
            { text: async () => 'the words' },
        );
        Object.defineProperty(input, 'files', {
            value: [file],
            configurable: true,
        });
        await act(async () => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await waitFor(() => {
            return chipNamesOf(
                container.querySelector('form.chat-ask'),
            ).includes('notes.txt');
        }, 'the file chip');

        const dragOver = new Event('dragover', {
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            container.querySelector('form.chat-ask')!.dispatchEvent(dragOver);
        });
        expect(dragOver.defaultPrevented).toBe(true);
    });

    test('a picture opens the overlay: Copy copies it, and Close, Escape, Enter, the backdrop and Download each close it', async () => {
        seedSessions([{ id: 'preview' }]);
        await renderWindow();
        await act(async () => {
            h.emit('main:app:chat-attach', {}, { dataUrl: PNG_DATA_URL });
        });
        const chip = () => {
            return container.querySelector<HTMLElement>(
                'form.chat-ask .chat-clip',
            );
        };
        await waitFor(() => chip() !== null, 'the picture chip');
        const overlay = () => {
            return container.querySelector<HTMLElement>('.chat-preview');
        };
        const open = async () => {
            await act(async () => {
                chip()!.click();
            });
            await waitFor(() => overlay() !== null, 'the overlay');
        };

        await open();
        await press('Copy', overlay()!);
        await flush();
        expect(h.copyImageToClipboard).toHaveBeenCalledWith(PNG_DATA_URL);
        expect(container.querySelector('.chat-attach-error')?.textContent).toBe(
            'Copied.',
        );
        await press('Close', overlay()!);
        expect(overlay()).toBeNull();

        await open();
        keyDown(overlay()!, { key: 'Escape' });
        expect(overlay()).toBeNull();

        await open();
        keyDown(overlay()!, { key: 'Enter' });
        expect(overlay()).toBeNull();

        await open();
        await act(async () => {
            overlay()!.click();
        });
        expect(overlay()).toBeNull();

        await open();
        await press('Download', overlay()!);
        expect(overlay()).toBeNull();
    });

    test('a saved file opens the overlay with its folder one press away', async () => {
        seedSessions([
            {
                id: 'folder',
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'Saved.',
                        shows: [
                            {
                                kind: 'file',
                                value: '/downloads/OWA-260101-abcd.md',
                                name: 'OWA-260101-abcd.md',
                            },
                        ],
                    },
                ],
            },
        ]);
        await renderWindow();
        await act(async () => {
            lastBot()!.querySelector<HTMLElement>('.chat-clip')!.click();
        });
        await waitFor(() => {
            return container.querySelector('.chat-preview') !== null;
        }, 'the overlay');
        await press('Open folder', container.querySelector('.chat-preview')!);
        expect(container.querySelector('.chat-preview')).toBeNull();
        expect(h.sent).toContainEqual({
            channel: 'main:app:reveal-path',
            data: '/downloads/OWA-260101-abcd.md',
        });
    });

    test('words sent while only a walkthrough’s rescue runs are a question of their own', async () => {
        seedSessions([{ id: 'rescue-add' }]);
        const { impl } = genHeldAnswer();
        h.askLlmBot.mockImplementation(impl);
        await renderWindow();
        await act(async () => {
            h.emit(
                'main:app:guide-help',
                {},
                { token: 1, stepText: 'Press it' },
            );
        });
        await waitForAsks(1);
        // Ctrl+Enter with nothing in the box adds nothing.
        keyDown(box(), { key: 'Enter', ctrlKey: true });
        await flush();
        expect(youCues()).toHaveLength(1);

        h.askLlmBot.mockImplementation(answerWith('Asked on its own.'));
        typeQuestion('And where is the Show button?');
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-add')!.click();
        });
        await waitForAsks(2);
        expect(h.askLlmBot.mock.calls[1][0]).toContain(
            'And where is the Show button?',
        );
        expect(h.askLlmBot.mock.calls[1][4]).not.toEqual([]);
    });
});

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

describe('a button whose tool cannot finish', () => {
    test('says nothing more whether the tool comes back afterwards or fails', async () => {
        seedButtons([
            {
                label: 'Highlight again',
                toolName: 'owa_find_ui',
                args: { text: 'Clear All' },
            },
        ]);
        let next = genHeld<string>();
        h.callTool.mockImplementation(() => next.promise);
        await renderWindow();
        await press('Highlight again');
        await pressStop();
        await act(async () => {
            next.held.resolve(JSON.stringify({ matches: [] }));
        });
        await flush();
        expect(saidOf(lastBot())).toBe(STOPPED_TEXT);

        next = genHeld<string>();
        await press('Highlight again', botCues()[0]);
        await pressStop();
        await act(async () => {
            next.held.reject(new DOMException('Stopped', 'AbortError'));
        });
        await flush();
        expect(botCues().map((cue) => saidOf(cue))).toEqual([
            'Here are some things to press.',
            STOPPED_TEXT,
            STOPPED_TEXT,
        ]);
    });

    test('Ask about a Resources file that cannot be read says so', async () => {
        h.resourceDirs = ['/data/pdf'];
        seedButtons([
            {
                label: 'Ask about LUK.7.pdf',
                toolName: RESOURCE_ASK_TOOL_NAME,
                args: { file: 'pdf/LUK.7.pdf' },
            },
        ]);
        await renderWindow();
        await press('Ask about LUK.7.pdf');
        await waitFor(() => botCues().length === 2, 'the answer');
        expect(saidOf(lastBot())).toBe('LUK.7.pdf is not there any more.');
    });

    test('a walkthrough of a window that is not open says how to open it, with the button to start it', async () => {
        seedButtons([
            {
                label: 'Show me in Settings',
                toolName: 'owa_guide_start',
                args: { manualId: 'W-30', page: 'setting.html', mode: 'show' },
            },
        ]);
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_guide_start' || name === 'owa_click') {
                throw new Error(
                    'The app has no open page matching "setting.html". The open pages are: presenter.html.',
                );
            }
            return '';
        });
        await renderWindow();
        await press('Show me in Settings');
        await waitFor(() => botCues().length === 2 && isIdle(), 'the answer');
        expect(saidOf(lastBot())).toContain('first.');
        expect(actionsOf(lastBot())).toEqual(["I'm there — start it"]);
    });
});
