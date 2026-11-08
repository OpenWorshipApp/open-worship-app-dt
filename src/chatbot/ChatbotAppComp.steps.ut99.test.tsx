// @vitest-environment jsdom

// The steps the help window answers with NO model, driven through the window
// itself: an asset's Copy and Download, the buttons an answer asks to be
// shown with, the jump to the newest message, Stop and Escape, the in-chat
// Bible import and verse finder, and what another window hands over. The
// tool host and the assistant are file-local mocks whose answers each test
// chooses; the step helpers behind the buttons are the real ones.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { settings, listeners, routes, mocks } = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    listeners: new Map<string, Set<(...args: any[]) => void>>(),
    // What each tool answers in this test, by name. A tool with no route
    // fails, the way a tool host that does not have it would.
    routes: {} as Record<
        string,
        (args: any, signal?: AbortSignal | null) => any
    >,
    mocks: {
        callTool: vi.fn(),
        callToolPicture: vi.fn(),
        getAiEndpoints: vi.fn(),
        askLlmBot: vi.fn(),
        electronSendAsync: vi.fn(),
        sendData: vi.fn(),
        openExternalURL: vi.fn(),
        genAttachmentFromPath: vi.fn(),
        downloadAsset: vi.fn(),
        captureAppWindow: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPagePresenter: false,
        isPageReader: false,
        isPageAppDocumentEditor: false,
        isPageExperiment: false,
        currentHomePage: '/chatbot.html',
        appInfo: { author: 'Open Worship <help@example.org>' },
        systemUtils: { isDev: false, isGlassCapable: false },
        envUtils: {},
        messageUtils: {
            sendDataSync: () => null,
            sendData: (...args: any[]) => mocks.sendData(...args),
            listenOnceForData: () => {},
            listenForData: (channel: string, listener: any) => {
                const set = listeners.get(channel) ?? new Set();
                set.add(listener);
                listeners.set(channel, set);
            },
            removeListener: (channel: string, listener: any) => {
                listeners.get(channel)?.delete(listener);
            },
        },
        pathUtils: {
            sep: '/',
            join: (...parts: string[]) => parts.join('/'),
            basename: (filePath: string) => {
                return filePath.split(/[\\/]/).pop() ?? filePath;
            },
            dirname: (filePath: string) => {
                return filePath.split(/[\\/]/).slice(0, -1).join('/');
            },
        },
        browserUtils: {
            openExternalURL: (url: string) => mocks.openExternalURL(url),
        },
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settings.get(key) ?? null,
    getSettingForce: (key: string) => settings.get(key) ?? null,
    setSetting: (key: string, value: string | null) => {
        settings.set(key, value ?? '');
    },
    removeSetting: (key: string) => {
        settings.delete(key);
    },
}));
vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: (...args: any[]) => mocks.electronSendAsync(...args),
    genReturningEventName: (name: string) => `${name}-return`,
}));
vi.mock('../helper/appCaptureHelpers', () => ({
    captureAppWindow: (...args: any[]) => mocks.captureAppWindow(...args),
}));
vi.mock('./mcpClient', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./mcpClient')>()),
    callTool: (...args: any[]) => mocks.callTool(...args),
    callToolPicture: (...args: any[]) => mocks.callToolPicture(...args),
    getAiEndpoints: () => mocks.getAiEndpoints(),
}));
vi.mock('./llmBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./llmBotHelpers')>()),
    askLlmBot: (...args: any[]) => mocks.askLlmBot(...args),
}));
vi.mock('./fileAttachHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./fileAttachHelpers')>()),
    genAttachmentFromPath: (...args: any[]) =>
        mocks.genAttachmentFromPath(...args),
}));
vi.mock('./assetPreviewHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./assetPreviewHelpers')>()),
    downloadAsset: (...args: any[]) => mocks.downloadAsset(...args),
}));

import ChatbotAppComp from './ChatbotAppComp';
import { dropAttachmentData, putAttachmentData } from './attachmentHelpers';
import { BIBLE_IMPORT_STEP_TOOL_NAME } from './bibleImportChatHelpers';
import { VERSE_FIND_STEP_TOOL_NAME } from './verseFindChatHelpers';
import {
    REPORT_FIXED_TOOL_NAME,
    REPORT_STILL_TOOL_NAME,
} from './reportHelpers';
import {
    REPORT_NOTE,
    REPORT_RESOLVED_NOTE,
    REPORT_START_TOOL_NAME,
} from './reportMarks';

// Captured before any test fakes the clock: a real turn of the event loop
// and the real time, for the lazy chunks (the question corpus) from disk.
const realSetTimeout = globalThis.setTimeout;
const realNow = performance.now.bind(performance);
const originalScrollIntoView = Element.prototype.scrollIntoView;

const SESSIONS_KEY = 'chatbot-sessions';
// The smallest PNG there is: one transparent pixel.
const PIXEL_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const CATALOG_URL = 'https://github.com/Beblia/Holy-Bible-XML-Format';
const FREE_MODEL = 'nvidia/nemotron-3.5-super-vl:free';
const STOPPED_TEXT =
    'Stopped. I did not finish looking that up — press the question above ' +
    'to ask it again.';
const NOT_UNDERSTOOD_TEXT =
    'I could not understand that choice. Choose an option below, or say it ' +
    'another way.';

function genSession(id: string, messages: any[], extra: any = {}) {
    return {
        id,
        title: '',
        messages,
        draft: '',
        focus: 'presenter',
        isFocusChosen: true,
        provider: 'free',
        model: '',
        isLocked: false,
        ...extra,
    };
}

function seedSessions(sessions: any[], activeId = sessions[0]?.id ?? '') {
    settings.set(SESSIONS_KEY, JSON.stringify({ activeId, sessions }));
}

function json(value: unknown) {
    return JSON.stringify(value);
}

function defer<T = string>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}

// A handed-over request, as another window leaves it (30 s, taken once).
function handOver(key: string, value: Record<string, unknown>) {
    settings.set(`chatbot-handoff-${key}`, json({ ...value, at: Date.now() }));
}

// One model round, as the loop reports it.
const FREE_ROUND = {
    provider: 'free',
    model: FREE_MODEL,
    input: 1200,
    cacheRead: 0,
    cacheWrite: 0,
    output: 40,
};

// The interpreter's reply to a waiting question, with the round it cost.
function genWaitingReply(reply: unknown) {
    return async (...args: any[]) => {
        args[6]?.onUsage?.(FREE_ROUND);
        return { text: json(reply) };
    };
}

// The language question the import asks first, with one more choice that
// the collection will find nothing for.
const LANGUAGE_QUESTION = {
    id: 1,
    author: 'bot',
    text: '**Which language do you want the Bible in?** Press one, or type its name.',
    actions: [
        {
            label: 'Khmer',
            toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
            args: {
                step: 'check',
                url: CATALOG_URL,
                find: 'Khmer',
                kjvChecked: true,
                awaits: 'find',
                pageUrl: CATALOG_URL,
                pageFind: '',
            },
        },
        {
            label: 'Klingon',
            toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
            args: {
                step: 'check',
                url: CATALOG_URL,
                find: 'Klingon',
                kjvChecked: true,
            },
        },
        {
            label: 'Cancel',
            toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
            args: { step: 'cancel' },
        },
    ],
};
const LANGUAGE_LABELS = ['Khmer', 'Klingon', 'Cancel'];

// What the collection holds: nothing called Klingon, two Khmer Bibles.
function routeCatalog() {
    routes.owa_bible_xml = (args) => {
        if (args.action !== 'check') {
            throw new Error(`unexpected ${args.action}`);
        }
        if (String(args.find).toLowerCase() === 'klingon') {
            return json({
                kind: 'page',
                matched: 0,
                total: 1000,
                searchedFor: ['klingon'],
                files: [],
            });
        }
        return json({
            kind: 'page',
            matched: 2,
            total: 1000,
            searchedFor: ['khmer'],
            files: [
                {
                    name: 'KhmerBible.xml',
                    url: `${CATALOG_URL}/blob/master/KhmerBible.xml`,
                    title: 'Khmer Standard Version',
                },
                {
                    name: 'Khmer2019Bible.xml',
                    url: `${CATALOG_URL}/blob/master/Khmer2019Bible.xml`,
                    title: 'Khmer 2019',
                },
            ],
        });
    };
}

const BIBLE_LIST = {
    bible: 'KJV',
    bibles: [
        { key: 'KJV', title: 'King James Version' },
        { key: 'KHSV', title: 'Khmer Standard Version' },
    ],
};

// "Which Bible should I search?" as the verse finder asks it.
const BIBLE_QUESTION = {
    id: 1,
    author: 'bot',
    text: '**Which Bible should I search?** Pick one below.',
    actions: [
        {
            label: 'KJV — King James Version',
            toolName: VERSE_FIND_STEP_TOOL_NAME,
            args: {
                step: 'remember',
                bible: 'KJV',
                title: 'King James Version',
            },
        },
        {
            label: 'KHSV — Khmer Standard Version',
            toolName: VERSE_FIND_STEP_TOOL_NAME,
            args: {
                step: 'remember',
                bible: 'KHSV',
                title: 'Khmer Standard Version',
            },
        },
    ],
};
const BIBLE_LABELS = [
    'KJV — King James Version',
    'KHSV — Khmer Standard Version',
];

describe('ChatbotAppComp steps', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.useFakeTimers();
        settings.clear();
        listeners.clear();
        for (const key of Object.keys(routes)) {
            delete routes[key];
        }
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        // jsdom lays nothing out: the tab strip and the suggestion list
        // scroll their row into view, which it does not implement.
        Element.prototype.scrollIntoView = () => {};
        mocks.callTool.mockImplementation(
            async (name: string, args: any, signal?: AbortSignal | null) => {
                const route = routes[name];
                if (route === undefined) {
                    throw new Error(`The tool host has no ${name}`);
                }
                return await route(args ?? {}, signal);
            },
        );
        mocks.getAiEndpoints.mockReturnValue({
            mcpUrl: 'http://127.0.0.1:39223/mcp',
            mcpToken: 'token',
            cdpPort: null,
        });
        mocks.electronSendAsync.mockImplementation(async (channel: string) => {
            return channel === 'main:app:list-app-windows' ? [] : null;
        });
        mocks.askLlmBot.mockRejectedValue(new Error('No assistant here'));
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.clearAllTimers();
        vi.useRealTimers();
        settings.clear();
        listeners.clear();
        if (originalScrollIntoView === undefined) {
            delete (Element.prototype as any).scrollIntoView;
        } else {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
        delete (navigator as any).clipboard;
        delete (globalThis as any).ClipboardItem;
        dropAttachmentData('shot-1');
    });

    // Every promise the mocked tools and assistant answer with, and the
    // re-renders they cause. No fake time passes.
    async function settle(rounds = 2) {
        for (let index = 0; index < rounds; index++) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });
        }
    }

    // The same, until `check` holds -- with a real turn of the event loop
    // each time, for a lazy chunk (the question corpus) loading from disk.
    // Bounded by the real clock, not by turns: a loaded machine is slower.
    async function waitFor(check: () => boolean, what: string) {
        const deadline = realNow() + 5000;
        while (!check()) {
            if (realNow() > deadline) {
                throw new Error(`Timed out waiting for ${what}`);
            }
            await settle(1);
            await act(async () => {
                await new Promise((resolve) => realSetTimeout(resolve, 1));
            });
        }
    }

    async function renderWindow() {
        act(() => root.render(<ChatbotAppComp />));
        await settle();
    }

    function cues() {
        return Array.from(container.querySelectorAll<HTMLElement>('.cue'));
    }

    function bodyOf(cue: Element | undefined) {
        return cue?.querySelector('.cue-body')?.textContent ?? '';
    }

    function lastCue() {
        const list = cues();
        return list[list.length - 1];
    }

    function noteOf(cue: Element | undefined) {
        return cue?.querySelector('.cue-note')?.textContent ?? null;
    }

    function actionLabels(cue: Element | undefined) {
        return Array.from(cue?.querySelectorAll('.cue-act') ?? []).map(
            (button) => button.textContent?.trim() ?? '',
        );
    }

    function findButton(selector: string, label: string) {
        return Array.from(
            container.querySelectorAll<HTMLButtonElement>(selector),
        ).find((one) => one.textContent?.trim() === label);
    }

    async function click(element: HTMLElement | null | undefined) {
        expect(element).toBeTruthy();
        await act(async () => {
            element!.click();
        });
        await settle();
    }

    async function press(label: string, cue: Element | undefined = lastCue()) {
        const button = Array.from(
            cue?.querySelectorAll<HTMLButtonElement>('.cue-act') ?? [],
        ).find((one) => one.textContent?.trim() === label);
        expect(button, `a button "${label}"`).toBeDefined();
        await click(button);
    }

    function inputBox() {
        return container.querySelector<HTMLTextAreaElement>('.chat-input')!;
    }

    function typeQuestion(value: string) {
        const box = inputBox();
        const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value',
        )!.set!;
        act(() => {
            setter.call(box, value);
            box.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    async function send(value: string) {
        typeQuestion(value);
        await click(container.querySelector<HTMLButtonElement>('.chat-send'));
    }

    function pressKey(key: string) {
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key }));
        });
    }

    function stopButton() {
        return container.querySelector<HTMLButtonElement>('.chat-stop');
    }

    function attachError() {
        return container.querySelector('.chat-attach-error')?.textContent;
    }

    function toolCalls(name: string) {
        return mocks.callTool.mock.calls.filter((call) => call[0] === name);
    }

    // The JSON the interpreter of a waiting question was handed.
    function readWaitingAsk(callIndex = 0) {
        const prompt = String(mocks.askLlmBot.mock.calls[callIndex][0]);
        return JSON.parse(prompt.split('\n').at(-1)!);
    }

    function useClipboard(writeText: (text: string) => Promise<void>) {
        const clipboard = { writeText: vi.fn(writeText) };
        Object.defineProperty(navigator, 'clipboard', {
            value: clipboard,
            configurable: true,
        });
        return clipboard;
    }

    describe('the window around the conversation', () => {
        test('saves the tabs 400 ms after a change, and at once on unload', async () => {
            seedSessions([genSession('one', [])]);
            await renderWindow();
            settings.delete(SESSIONS_KEY);
            typeQuestion('Where is Clear All');
            await act(async () => {
                await vi.advanceTimersByTimeAsync(399);
            });
            expect(settings.has(SESSIONS_KEY)).toBe(false);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });
            expect(
                JSON.parse(settings.get(SESSIONS_KEY)!).sessions[0].draft,
            ).toBe('Where is Clear All');
            typeQuestion('Where is the Mini Screen');
            act(() => {
                window.dispatchEvent(new Event('beforeunload'));
            });
            expect(
                JSON.parse(settings.get(SESSIONS_KEY)!).sessions[0].draft,
            ).toBe('Where is the Mini Screen');
        });

        test('says so when this copy of the app runs no assistant', async () => {
            mocks.getAiEndpoints.mockReturnValue({
                mcpUrl: null,
                mcpToken: null,
                cdpPort: null,
            });
            await renderWindow();
            expect(container.querySelector('.chat-alert')?.textContent).toBe(
                'The assistant is not running in this copy of the app. ' +
                    'Restart the app, then open this window again.',
            );
        });

        test('an empty box asks nothing', async () => {
            seedSessions([genSession('one', [])]);
            await renderWindow();
            await send('   ');
            expect(cues()).toHaveLength(0);
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('an opened asset copies its words and downloads a copy', async () => {
            seedSessions([
                genSession('one', [
                    {
                        id: 1,
                        author: 'you',
                        text: 'What does this say?',
                        attachments: [
                            {
                                id: 'note-1',
                                kind: 'text',
                                name: 'notes.txt',
                                mimeType: 'text/plain',
                                byteSize: 20,
                                summary: 'Hello from the notes',
                            },
                        ],
                    },
                    { id: 2, author: 'bot', text: 'It says hello.' },
                ]),
            ]);
            await renderWindow();
            await click(container.querySelector('.cue-you .chat-clip'));
            const preview = container.querySelector('.chat-preview');
            expect(preview?.getAttribute('aria-label')).toBe(
                'Preview of notes.txt',
            );
            expect(preview?.textContent).toContain('Hello from the notes');
            const clipboard = useClipboard(async () => {});
            await click(findButton('.chat-preview-tool', 'Copy'));
            expect(clipboard.writeText).toHaveBeenCalledWith(
                'Hello from the notes',
            );
            expect(attachError()).toBe('Copied.');
            clipboard.writeText.mockRejectedValueOnce(
                new Error('the clipboard is busy'),
            );
            await click(findButton('.chat-preview-tool', 'Copy'));
            expect(attachError()).toBe(
                'I could not copy it: the clipboard is busy',
            );
            mocks.downloadAsset.mockResolvedValueOnce({
                filePath: '/downloads/notes.txt',
                message: 'Saved “notes.txt” into your Downloads folder.',
            });
            await click(findButton('.chat-preview-tool', 'Download'));
            // Closed first: the save opens a file manager.
            expect(container.querySelector('.chat-preview')).toBeNull();
            expect(mocks.downloadAsset).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'notes.txt',
                    text: 'Hello from the notes',
                }),
            );
            expect(attachError()).toBe(
                'Saved “notes.txt” into your Downloads folder.',
            );
            await click(container.querySelector('.cue-you .chat-clip'));
            mocks.downloadAsset.mockRejectedValueOnce(new Error('disk full'));
            await click(findButton('.chat-preview-tool', 'Download'));
            expect(attachError()).toBe('I could not download it: disk full');
        });

        test('a picture still held is copied as a PNG', async () => {
            putAttachmentData('shot-1', PIXEL_PNG);
            seedSessions([
                genSession('one', [
                    {
                        id: 1,
                        author: 'you',
                        text: 'Is this right?',
                        attachments: [
                            {
                                id: 'shot-1',
                                kind: 'image',
                                name: 'my screen',
                                mimeType: 'image/png',
                                byteSize: 68,
                            },
                        ],
                    },
                    { id: 2, author: 'bot', text: 'It looks right.' },
                ]),
            ]);
            await renderWindow();
            await click(container.querySelector('.cue-you .chat-clip'));
            expect(
                container
                    .querySelector('.chat-preview img')
                    ?.getAttribute('src'),
            ).toBe(PIXEL_PNG);
            class FakeClipboardItem {
                constructor(public readonly items: Record<string, Blob>) {}
            }
            (globalThis as any).ClipboardItem = FakeClipboardItem;
            const write = vi.fn(async (_items: unknown[]) => {});
            Object.defineProperty(navigator, 'clipboard', {
                value: { write },
                configurable: true,
            });
            await click(findButton('.chat-preview-tool', 'Copy'));
            await waitFor(() => attachError() !== undefined, 'the copy');
            expect(attachError()).toBe('Copied.');
            expect(write).toHaveBeenCalledTimes(1);
            const [item] = write.mock.calls[0][0] as FakeClipboardItem[];
            expect(item.items['image/png'].type).toBe('image/png');
        });

        test('a pointed-at control with no selector is looked up by its words', async () => {
            const answers = [json({ shownCount: 1 }), json({ shownCount: 0 })];
            routes.owa_find_ui = () => {
                const answer = answers.shift();
                if (answer === undefined) {
                    throw new Error('The window has gone');
                }
                return answer;
            };
            seedSessions([
                genSession('one', [
                    {
                        id: 1,
                        author: 'you',
                        text: 'What does this do?',
                        attachments: [
                            {
                                id: 'element-1',
                                kind: 'element',
                                name: 'Clear All',
                                mimeType: 'text/plain',
                                byteSize: 0,
                            },
                            {
                                id: 'text-1',
                                kind: 'text',
                                name: 'old.txt',
                                mimeType: 'text/plain',
                                byteSize: 0,
                            },
                        ],
                    },
                    { id: 2, author: 'bot', text: 'It clears the screens.' },
                ]),
            ]);
            await renderWindow();
            const [control, file] = Array.from(
                container.querySelectorAll<HTMLElement>('.cue-you .chat-clip'),
            );
            await click(control);
            // Found and rung: nothing to say.
            expect(attachError()).toBeUndefined();
            await click(control);
            expect(attachError()).toBe(
                'I could not find "Clear All" on screen any more.',
            );
            await click(control);
            expect(toolCalls('owa_find_ui').map((call) => call[1])).toEqual([
                { text: 'Clear All', highlight: true },
                { text: 'Clear All', highlight: true },
                { text: 'Clear All', highlight: true },
            ]);
            expect(attachError()).toBe(
                'I could not find "Clear All" on screen any more.',
            );
            await click(file);
            expect(attachError()).toBe(
                'There is nothing left to show for that one.',
            );
        });

        test('the buttons an answer asks to be shown with do what they say', async () => {
            routes.owa_pick_element = () => json({ picked: false });
            mocks.captureAppWindow.mockRejectedValue(new Error('no frame yet'));
            seedSessions([
                genSession('one', [
                    { id: 1, author: 'you', text: 'Why is it blank?' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Show me the window, please.',
                        attachRequests: ['screenshot', 'element', 'file'],
                    },
                ]),
            ]);
            await renderWindow();
            expect(actionLabels(lastCue())).toEqual([
                'Send a picture of my screen',
                'Point at the control',
                'Attach a file',
            ]);
            const fileInput =
                container.querySelector<HTMLInputElement>(
                    'input[type="file"]',
                )!;
            const fileClicks: Event[] = [];
            fileInput.addEventListener('click', (event) => {
                fileClicks.push(event);
            });
            await press('Attach a file');
            expect(fileClicks).toHaveLength(1);
            await press('Point at the control');
            expect(toolCalls('owa_pick_element')).toHaveLength(1);
            expect(attachError()).toBe('Nothing was picked in the app window.');
            await press('Send a picture of my screen');
            expect(mocks.captureAppWindow).toHaveBeenCalledTimes(1);
            expect(attachError()).toBe(
                'I could not take a picture: no frame yet',
            );
        });

        test('scrolled up, the round arrow goes back to the newest message', async () => {
            seedSessions([
                genSession('one', [
                    { id: 1, author: 'you', text: 'Where is Clear All?' },
                    { id: 2, author: 'bot', text: 'In the Mini Screen.' },
                ]),
            ]);
            await renderWindow();
            const log = container.querySelector<HTMLDivElement>('.chat-log')!;
            let top = 0;
            Object.defineProperty(log, 'scrollHeight', {
                configurable: true,
                get: () => 1000,
            });
            Object.defineProperty(log, 'clientHeight', {
                configurable: true,
                get: () => 300,
            });
            Object.defineProperty(log, 'scrollTop', {
                configurable: true,
                get: () => top,
                set: (value: number) => {
                    top = value;
                },
            });
            const scrollTo = vi.fn();
            (log as any).scrollTo = scrollTo;
            const jumpButton = () => {
                return container.querySelector<HTMLButtonElement>(
                    '.chat-log-jump-button',
                );
            };
            expect(jumpButton()).toBeNull();
            top = 100;
            act(() => {
                log.dispatchEvent(new Event('scroll'));
            });
            expect(jumpButton()?.getAttribute('aria-label')).toBe(
                'Go to the newest message',
            );
            await click(jumpButton());
            expect(scrollTo).toHaveBeenCalledWith({
                top: 1000,
                behavior: 'smooth',
            });
            top = 690;
            act(() => {
                log.dispatchEvent(new Event('scroll'));
            });
            expect(jumpButton()).toBeNull();
            top = 100;
            act(() => {
                log.dispatchEvent(new Event('scroll'));
            });
            expect(jumpButton()).not.toBeNull();
            // A message arriving brings the newest one into view.
            await click(
                container.querySelector<HTMLButtonElement>(
                    '[aria-label="Bad answer"]',
                ),
            );
            expect(cues()).toHaveLength(3);
            expect(top).toBe(1000);
            expect(jumpButton()).toBeNull();
        });
    });

    describe('waiting, Stop and Escape', () => {
        test('Stop ends a step of the tab in front and keeps its question', async () => {
            const check = defer();
            routes.owa_bible_xml = () => check.promise;
            seedSessions([genSession('one', [LANGUAGE_QUESTION])]);
            await renderWindow();
            expect(stopButton()).toBeNull();
            await press('Khmer');
            expect(
                container.querySelector('.chat-progress')?.textContent,
            ).toContain('Downloading the Bible file and reading it…');
            await click(stopButton());
            expect(stopButton()).toBeNull();
            const stopped = lastCue();
            expect(noteOf(stopped)).toBe(STOPPED_TEXT);
            expect(bodyOf(stopped)).toContain(
                'Which language do you want the Bible in?',
            );
            expect(actionLabels(stopped)).toEqual(LANGUAGE_LABELS);
            const count = cues().length;
            await act(async () => {
                check.resolve(
                    json({
                        kind: 'page',
                        matched: 0,
                        total: 1,
                        searchedFor: ['khmer'],
                        files: [],
                    }),
                );
            });
            await settle();
            // The answer that came late is dropped, and nothing more asked.
            expect(cues()).toHaveLength(count);
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('two steps waiting in one tab keep it busy until both end', async () => {
            const first = defer();
            const second = defer();
            const answers = [first, second];
            routes.owa_bible_xml = () => answers.shift()!.promise;
            seedSessions([genSession('one', [LANGUAGE_QUESTION])]);
            await renderWindow();
            const question = cues()[0];
            await press('Khmer', question);
            await press('Klingon', question);
            expect(stopButton()).not.toBeNull();
            await act(async () => {
                first.resolve(
                    json({ kind: 'page', matched: 0, total: 3, files: [] }),
                );
            });
            await settle();
            // One answer in, the other still on its way.
            expect(stopButton()).not.toBeNull();
            expect(container.querySelector('.chat-progress')).not.toBeNull();
            await act(async () => {
                second.resolve(
                    json({ kind: 'page', matched: 0, total: 3, files: [] }),
                );
            });
            await settle();
            expect(stopButton()).toBeNull();
            expect(
                container.querySelector<HTMLButtonElement>('.chat-send')
                    ?.textContent,
            ).toBe('Send');
        });

        test('Escape stops the wait in front, never while the caret is in a field', async () => {
            const check = defer();
            routes.owa_bible_xml = () => check.promise;
            seedSessions([
                genSession('one', [
                    {
                        id: 1,
                        author: 'you',
                        text: 'Look at this',
                        attachments: [
                            {
                                id: 'note-1',
                                kind: 'text',
                                name: 'notes.txt',
                                mimeType: 'text/plain',
                                byteSize: 9,
                                summary: 'Some note',
                            },
                        ],
                    },
                    { ...LANGUAGE_QUESTION, id: 2 },
                ]),
            ]);
            await renderWindow();
            // Nothing waiting: Escape does nothing.
            (document.activeElement as HTMLElement | null)?.blur();
            pressKey('Escape');
            expect(cues()).toHaveLength(2);
            await press('Khmer');
            expect(cues()).toHaveLength(3);
            inputBox().focus();
            pressKey('Escape');
            expect(stopButton()).not.toBeNull();
            inputBox().blur();
            pressKey('Enter');
            expect(stopButton()).not.toBeNull();
            // A preview over the conversation is what Escape closes first.
            await click(container.querySelector('.cue-you .chat-clip'));
            expect(container.querySelector('.chat-preview')).not.toBeNull();
            (document.activeElement as HTMLElement | null)?.blur();
            pressKey('Escape');
            expect(container.querySelector('.chat-preview')).toBeNull();
            expect(stopButton()).not.toBeNull();
            (document.activeElement as HTMLElement | null)?.blur();
            pressKey('Escape');
            await settle();
            expect(stopButton()).toBeNull();
            expect(noteOf(lastCue())).toBe(STOPPED_TEXT);
        });

        test('Stop puts what was added while it worked back in the box', async () => {
            const found = defer();
            routes.owa_find_ui = () => found.promise;
            seedSessions([
                genSession('one', [
                    { id: 1, author: 'you', text: 'Where is Clear All?' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'It is in the Mini Screen.',
                        actions: [
                            {
                                label: 'Show me where',
                                toolName: 'owa_find_ui',
                                args: { text: 'Clear All', highlight: true },
                            },
                        ],
                    },
                ]),
            ]);
            await renderWindow();
            await press('Show me where');
            typeQuestion('and the Clear Background button');
            const addButton =
                container.querySelector<HTMLButtonElement>('.chat-add');
            expect(addButton).not.toBeNull();
            await click(addButton);
            expect(noteOf(lastCue())).toBe('Added while it was working.');
            expect(inputBox().value).toBe('');
            // A box holding only spaces is not joined to what comes back.
            typeQuestion('  ');
            await click(stopButton());
            expect(inputBox().value).toBe('and the Clear Background button');
            expect(bodyOf(lastCue())).toContain(STOPPED_TEXT);
            const count = cues().length;
            await act(async () => {
                found.resolve(json({ shownCount: 1 }));
            });
            await settle();
            expect(cues()).toHaveLength(count);
        });
    });

    describe('the Bible import, a step at a time', () => {
        test('a pressed step answers with the next question and no model', async () => {
            // The KJV this app provides is looked for first: it is there.
            routes.owa_bible_xml = () => json({ bibles: [{ key: 'KJV' }] });
            seedSessions([
                genSession('one', [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'I can install a Bible for you.',
                        actions: [
                            {
                                label: 'Import a Bible for me',
                                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                                args: { step: 'language' },
                            },
                        ],
                    },
                ]),
            ]);
            await renderWindow();
            await press('Import a Bible for me');
            await waitFor(() => cues().length === 3, 'the next step');
            expect(bodyOf(cues()[1])).toContain('Import a Bible for me');
            expect(bodyOf(cues()[2])).toContain(
                'Which language do you want the Bible in?',
            );
            expect(actionLabels(lastCue())).toEqual([
                'Khmer',
                'English',
                'French',
                'A file on this computer',
            ]);
            expect(toolCalls('owa_bible_xml').map((call) => call[1])).toEqual([
                { action: 'list' },
            ]);
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('a language the collection lacks is put into one by the assistant and searched again', async () => {
            routeCatalog();
            mocks.askLlmBot.mockImplementationOnce(
                genWaitingReply({ kind: 'value', value: 'Khmer' }),
            );
            seedSessions([genSession('one', [LANGUAGE_QUESTION])]);
            await renderWindow();
            await press('Klingon');
            await waitFor(() => cues().length === 3, 'the searched list');
            expect(toolCalls('owa_bible_xml').map((call) => call[1])).toEqual([
                { action: 'check', url: CATALOG_URL, find: 'Klingon' },
                { action: 'check', url: CATALOG_URL, find: 'Khmer' },
            ]);
            const [prompt, , provider, model, turns, signal, extra] =
                mocks.askLlmBot.mock.calls[0];
            expect(prompt).toContain('Interpret a reply');
            expect([provider, model, turns]).toEqual(['free', FREE_MODEL, []]);
            expect(signal).toBeInstanceOf(AbortSignal);
            expect(extra).toMatchObject({
                isGeneral: true,
                isWaitingInput: true,
                replyLang: 'en',
                appLang: 'en',
            });
            const asked = readWaitingAsk();
            expect(asked.typed).toBe('Klingon');
            expect(asked.valueKind).toBe('search');
            // The question it answers, not the echo of what was pressed.
            expect(asked.conversation).toEqual([
                {
                    author: 'bot',
                    text: expect.stringContaining('Which language'),
                },
            ]);
            const answer = lastCue();
            expect(bodyOf(answer)).toContain(
                'Of its 1,000 Bibles, 2 have “khmer” in the name.',
            );
            expect(actionLabels(answer).join(' | ')).toContain(
                'Khmer Standard Version',
            );
            expect(answer.querySelector('.cue-cost')?.textContent).toContain(
                'tokens',
            );
            expect(noteOf(answer)).toBeNull();
        });

        test('a help reply keeps the question and says why', async () => {
            routeCatalog();
            mocks.askLlmBot.mockImplementationOnce(
                genWaitingReply({
                    kind: 'help',
                    reply: 'Klingon is not in the collection. Try Khmer.',
                }),
            );
            seedSessions([genSession('one', [LANGUAGE_QUESTION])]);
            await renderWindow();
            await press('Klingon');
            await waitFor(() => cues().length === 3, 'the kept question');
            const kept = lastCue();
            expect(noteOf(kept)).toBe(
                'Klingon is not in the collection. Try Khmer.',
            );
            expect(bodyOf(kept)).toContain('Which language do you want');
            expect(actionLabels(kept)).toEqual(LANGUAGE_LABELS);
            expect(toolCalls('owa_bible_xml')).toHaveLength(1);
        });

        test('a reply that cannot be read asks for the choice again', async () => {
            routeCatalog();
            mocks.askLlmBot.mockResolvedValueOnce({ text: 'Sure, Khmer!' });
            seedSessions([genSession('one', [LANGUAGE_QUESTION])]);
            await renderWindow();
            await press('Klingon');
            await waitFor(() => cues().length === 3, 'the kept question');
            expect(noteOf(lastCue())).toBe(NOT_UNDERSTOOD_TEXT);
            expect(actionLabels(lastCue())).toEqual(LANGUAGE_LABELS);
        });

        // Found by UT-95 (2026-11-03): only a TYPED line can go on to the
        // assistant when the interpreter calls it another task. A press has
        // no words of anybody's to hand on, and the tab ended on its echo.
        test('a pressed choice the interpreter calls another task keeps the question', async () => {
            routeCatalog();
            mocks.askLlmBot.mockImplementationOnce(
                genWaitingReply({ kind: 'unrelated' }),
            );
            seedSessions([genSession('one', [LANGUAGE_QUESTION])]);
            await renderWindow();
            await press('Klingon');
            await waitFor(() => cues().length === 3, 'the kept question');
            const kept = lastCue();
            expect(kept.classList.contains('cue-you')).toBe(false);
            expect(noteOf(kept)).toBe(NOT_UNDERSTOOD_TEXT);
            expect(bodyOf(kept)).toContain('Which language do you want');
            expect(actionLabels(kept)).toEqual(LANGUAGE_LABELS);
            // Nothing was handed on as a question of its own.
            expect(mocks.askLlmBot).toHaveBeenCalledTimes(1);
        });

        test('an assistant that fails leaves the question up with the reason', async () => {
            routeCatalog();
            mocks.askLlmBot.mockRejectedValueOnce(
                new Error('The free service is busy'),
            );
            seedSessions([genSession('one', [LANGUAGE_QUESTION])]);
            await renderWindow();
            await press('Klingon');
            await waitFor(() => cues().length === 3, 'the failure');
            expect(noteOf(lastCue())).toBe(
                'I could not answer that: The free service is busy',
            );
            expect(bodyOf(lastCue())).toContain('Which language do you want');
            expect(actionLabels(lastCue())).toEqual(LANGUAGE_LABELS);
        });

        test('a typed sentence under the question is read into one of its buttons', async () => {
            routeCatalog();
            mocks.askLlmBot.mockImplementationOnce(
                genWaitingReply({ kind: 'choice', choice: 1 }),
            );
            seedSessions([genSession('one', [LANGUAGE_QUESTION])]);
            await renderWindow();
            await send('the first one please');
            await waitFor(() => cues().length === 3, 'the chosen step');
            expect(bodyOf(cues()[1])).toContain('the first one please');
            expect(toolCalls('owa_bible_xml').map((call) => call[1])).toEqual([
                { action: 'check', url: CATALOG_URL, find: 'Khmer' },
            ]);
            expect(readWaitingAsk().choices).toEqual([
                { id: 1, label: 'Khmer', requiresPress: false },
                { id: 2, label: 'Klingon', requiresPress: false },
                { id: 3, label: 'Cancel', requiresPress: true },
            ]);
            expect(bodyOf(lastCue())).toContain('2 have “khmer” in the name');
            expect(inputBox().value).toBe('');
        });

        test('a typed sentence the assistant calls another task goes on to the assistant', async () => {
            routeCatalog();
            mocks.askLlmBot
                .mockImplementationOnce(genWaitingReply({ kind: 'unrelated' }))
                .mockResolvedValueOnce({
                    text: 'Press Clear All in the Mini Screen.',
                });
            seedSessions([genSession('one', [LANGUAGE_QUESTION])]);
            await renderWindow();
            await send('how do I clear the screen instead?');
            await waitFor(() => cues().length === 3, 'the ordinary answer');
            // Said once: the import's echo stands for the question.
            expect(
                cues().filter((cue) => cue.classList.contains('cue-you')),
            ).toHaveLength(1);
            expect(mocks.askLlmBot).toHaveBeenCalledTimes(2);
            expect(mocks.askLlmBot.mock.calls[1][6]?.isWaitingInput).toBe(
                undefined,
            );
            expect(bodyOf(lastCue())).toContain(
                'Press Clear All in the Mini Screen.',
            );
        });
    });

    describe('the verse finder, a step at a time', () => {
        test('a pressed Bible asks what they remember', async () => {
            seedSessions([genSession('one', [BIBLE_QUESTION])]);
            await renderWindow();
            await press('KHSV — Khmer Standard Version');
            await waitFor(() => cues().length === 3, 'the memory question');
            expect(bodyOf(cues()[1])).toContain(
                'KHSV — Khmer Standard Version',
            );
            expect(bodyOf(lastCue())).toContain(
                'I will search KHSV — Khmer Standard Version.',
            );
            expect(bodyOf(lastCue())).toContain(
                'What do you remember about the verse?',
            );
            expect(actionLabels(lastCue())).toEqual(['Search another Bible']);
            expect(document.activeElement).toBe(inputBox());
            expect(mocks.callTool).not.toHaveBeenCalled();
        });

        test('a typed number picks that Bible with no model', async () => {
            seedSessions([genSession('one', [BIBLE_QUESTION])]);
            await renderWindow();
            await send('2');
            await waitFor(() => cues().length === 3, 'the memory question');
            expect(bodyOf(cues()[1])).toContain('2');
            expect(bodyOf(lastCue())).toContain('I will search KHSV');
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('typed words are read into a Bible by the assistant', async () => {
            mocks.askLlmBot.mockImplementationOnce(
                genWaitingReply({ kind: 'choice', choice: 2 }),
            );
            seedSessions([genSession('one', [BIBLE_QUESTION])]);
            await renderWindow();
            await send('the Khmer one please');
            await waitFor(() => cues().length === 3, 'the memory question');
            expect(
                cues().filter((cue) => cue.classList.contains('cue-you')),
            ).toHaveLength(1);
            expect(readWaitingAsk()).toMatchObject({
                question: BIBLE_QUESTION.text,
                choices: [
                    { id: 1, label: BIBLE_LABELS[0] },
                    { id: 2, label: BIBLE_LABELS[1] },
                ],
                typed: 'the Khmer one please',
            });
            const answer = lastCue();
            expect(bodyOf(answer)).toContain('I will search KHSV');
            expect(answer.querySelector('.cue-cost')?.textContent).toContain(
                'tokens',
            );
        });

        test('a help reply, an unreadable one and a failure keep the question', async () => {
            mocks.askLlmBot
                .mockImplementationOnce(
                    genWaitingReply({
                        kind: 'help',
                        reply: 'KJV is in English, KHSV in Khmer.',
                    }),
                )
                .mockResolvedValueOnce({ text: 'hmm' })
                .mockRejectedValueOnce(new Error('The free service is busy'));
            seedSessions([genSession('one', [BIBLE_QUESTION])]);
            await renderWindow();
            await send('which one is which?');
            await waitFor(() => cues().length === 3, 'the help reply');
            expect(noteOf(lastCue())).toBe('KJV is in English, KHSV in Khmer.');
            expect(actionLabels(lastCue())).toEqual(BIBLE_LABELS);
            await send('not sure at all');
            await waitFor(() => cues().length === 5, 'the unread reply');
            expect(noteOf(lastCue())).toBe(NOT_UNDERSTOOD_TEXT);
            await send('the first one I guess');
            await waitFor(() => cues().length === 7, 'the failure');
            expect(noteOf(lastCue())).toBe(
                'I could not answer that: The free service is busy',
            );
            expect(actionLabels(lastCue())).toEqual(BIBLE_LABELS);
            expect(bodyOf(lastCue())).toContain('Which Bible should I search?');
        });

        test('Stop while the words are being read keeps the question', async () => {
            const reply = defer<any>();
            mocks.askLlmBot.mockImplementationOnce(() => reply.promise);
            seedSessions([genSession('one', [BIBLE_QUESTION])]);
            await renderWindow();
            await send('the Khmer one please');
            await click(stopButton());
            expect(noteOf(lastCue())).toBe(STOPPED_TEXT);
            expect(actionLabels(lastCue())).toEqual(BIBLE_LABELS);
            const count = cues().length;
            await act(async () => {
                reply.resolve({ text: json({ kind: 'choice', choice: 2 }) });
            });
            await settle();
            expect(cues()).toHaveLength(count);
        });

        test('words the assistant calls another task go on to the assistant, said once', async () => {
            mocks.askLlmBot
                .mockImplementationOnce(genWaitingReply({ kind: 'unrelated' }))
                .mockResolvedValueOnce({
                    text: 'Open Settings from the gear.',
                });
            seedSessions([genSession('one', [BIBLE_QUESTION])]);
            await renderWindow();
            await send('where are the settings for fonts?');
            await waitFor(() => cues().length === 3, 'the ordinary answer');
            expect(
                cues().filter((cue) => cue.classList.contains('cue-you')),
            ).toHaveLength(1);
            expect(bodyOf(lastCue())).toContain('Open Settings from the gear.');
        });

        test('a thank-you under a found verse is answered by the window', async () => {
            seedSessions([
                genSession('one', [
                    { id: 1, author: 'you', text: 'love your enemies' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Matthew 5:44 says it.',
                        verseFind: 'KJV',
                    },
                ]),
            ]);
            await renderWindow();
            await send('thank you');
            expect(bodyOf(lastCue())).toContain(
                'You are welcome. When you want to find another verse, just ' +
                    'tell me what you remember of it.',
            );
            expect(inputBox().value).toBe('');
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('asking to find a verse lists the Bibles to search', async () => {
            routes.owa_find_verse = () => json(BIBLE_LIST);
            seedSessions([genSession('one', [])]);
            await renderWindow();
            await send('Help me find a Bible verse');
            await waitFor(() => cues().length === 2, 'the Bible question');
            expect(bodyOf(lastCue())).toContain(
                'Which Bible should I search? Pick one below.',
            );
            expect(actionLabels(lastCue())).toEqual([
                'KJV — King James Version',
                'KHSV — Khmer Standard Version',
            ]);
        });

        test('a Bible picked to search again asks the whole search for it', async () => {
            routes.owa_find_verse = () => json(BIBLE_LIST);
            mocks.askLlmBot.mockResolvedValue({
                text: 'Matthew 5:44 has those words.',
            });
            // The list was answered further up; its old button still runs
            // its own step.
            seedSessions([
                genSession('one', [
                    { id: 1, author: 'you', text: 'love your enemies' },
                    {
                        id: 2,
                        author: 'bot',
                        text: '**Which Bible should I show the verse in?**',
                        actions: [
                            {
                                label: 'KHSV — Khmer Standard Version',
                                toolName: VERSE_FIND_STEP_TOOL_NAME,
                                args: {
                                    step: 'remember',
                                    bible: 'KHSV',
                                    title: 'Khmer Standard Version',
                                    words: 'love your enemies',
                                },
                            },
                        ],
                    },
                    { id: 3, author: 'you', text: 'never mind' },
                    { id: 4, author: 'bot', text: 'All right.' },
                ]),
            ]);
            await renderWindow();
            await press('KHSV — Khmer Standard Version', cues()[1]);
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the search',
            );
            await waitFor(() => cues().length === 6, 'the answer');
            // The press is what the transcript shows, not the sentence.
            expect(bodyOf(cues()[4])).toContain(
                'KHSV — Khmer Standard Version',
            );
            expect(bodyOf(cues()[4])).not.toContain('love your enemies');
            expect(mocks.askLlmBot).toHaveBeenCalledTimes(1);
            expect(String(mocks.askLlmBot.mock.calls[0][0])).toContain(
                'love your enemies',
            );
            expect(mocks.askLlmBot.mock.calls[0][6]?.verseFind).toMatchObject({
                bible: 'KHSV',
                words: 'love your enemies',
            });
            expect(bodyOf(lastCue())).toContain(
                'Matthew 5:44 has those words.',
            );
        });

        test('typed words that pick a Bible to search again go on searching', async () => {
            routes.owa_find_verse = () => json(BIBLE_LIST);
            mocks.askLlmBot
                .mockImplementationOnce(
                    genWaitingReply({ kind: 'choice', choice: 1 }),
                )
                .mockResolvedValue({ text: 'Matthew 5:44 has those words.' });
            seedSessions([
                genSession('one', [
                    {
                        id: 1,
                        author: 'bot',
                        text: '**Which Bible should I search?** Pick one below.',
                        actions: [
                            {
                                label: 'KHSV — Khmer Standard Version',
                                toolName: VERSE_FIND_STEP_TOOL_NAME,
                                args: {
                                    step: 'remember',
                                    bible: 'KHSV',
                                    title: 'Khmer Standard Version',
                                    words: 'love your enemies',
                                },
                            },
                        ],
                    },
                ]),
            ]);
            await renderWindow();
            await send('the Khmer one');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length === 2,
                'the search',
            );
            await waitFor(() => cues().length === 3, 'the answer');
            expect(
                cues().filter((cue) => cue.classList.contains('cue-you')),
            ).toHaveLength(1);
            expect(bodyOf(cues()[1])).toContain('the Khmer one');
            expect(mocks.askLlmBot.mock.calls[1][6]?.verseFind).toMatchObject({
                bible: 'KHSV',
            });
        });
    });

    // Found by UT-95 (2026-11-03): with the search-again list the LAST
    // answer, its Bible's press asks the search-again sentence -- which
    // names the Bible -- and that sentence went to the list's own
    // interpreter instead of to the search. With no assistant the list came
    // back under "I could not answer that", and nothing was searched.
    describe('a Bible pressed under its own Search another Bible list', () => {
        test('is searched, with the words remembered, and asks no interpreter', async () => {
            routes.owa_find_verse = (args) => {
                return args?.bible === undefined
                    ? json(BIBLE_LIST)
                    : json({ bible: args.bible, verses: [], total: 0 });
            };
            seedSessions([
                genSession('one', [
                    { id: 1, author: 'you', text: 'love your enemies' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Nothing in KJV has those words.',
                        verseFind: 'KJV',
                        actions: [
                            {
                                label: 'Search another Bible',
                                toolName: VERSE_FIND_STEP_TOOL_NAME,
                                args: {
                                    step: 'bible',
                                    current: 'KJV',
                                    words: 'love your enemies',
                                },
                            },
                        ],
                    },
                ]),
            ]);
            await renderWindow();
            await press('Search another Bible');
            await waitFor(
                () => actionLabels(lastCue()).includes(BIBLE_LABELS[1]),
                'the Bible list',
            );
            await press(BIBLE_LABELS[1]);
            await waitFor(
                () =>
                    toolCalls('owa_find_verse').some((call) => {
                        return call[1]?.bible === 'KHSV';
                    }),
                'the search in KHSV',
            );
            expect(
                toolCalls('owa_find_verse').find((call) => {
                    return call[1]?.bible === 'KHSV';
                })?.[1],
            ).toMatchObject({ bible: 'KHSV', words: 'love your enemies' });
            // The press is never read as a pick by the list's interpreter.
            expect(
                mocks.askLlmBot.mock.calls.some((call) => {
                    return call[6]?.isWaitingInput === true;
                }),
            ).toBe(false);
        });
    });

    describe('a report in progress', () => {
        const OFFER = {
            id: 1,
            author: 'bot',
            text: 'Tell me what went wrong.',
            actions: [
                { label: 'Report', toolName: REPORT_START_TOOL_NAME, args: {} },
            ],
        };
        const FIX_CARD = {
            id: 3,
            author: 'bot',
            text: 'Try this first: restart the app.',
            actions: [
                {
                    label: 'That fixed it',
                    toolName: REPORT_FIXED_TOOL_NAME,
                    args: { reference: 'OWA-1' },
                },
                {
                    label: 'Still a problem — report it',
                    toolName: REPORT_STILL_TOOL_NAME,
                    args: { reference: 'OWA-1' },
                },
            ],
        };

        test('a typed yes under the fix card closes the report', async () => {
            seedSessions([
                genSession('one', [
                    OFFER,
                    {
                        id: 2,
                        author: 'you',
                        text: 'The screen is blank',
                        note: REPORT_NOTE,
                    },
                    FIX_CARD,
                ]),
            ]);
            await renderWindow();
            await send('yes thanks');
            const list = cues();
            expect(bodyOf(list[list.length - 2])).toContain('yes thanks');
            expect(bodyOf(lastCue())).toContain(
                'Good. Nothing was sent, and this report is closed.',
            );
            expect(noteOf(lastCue())).toBe(REPORT_RESOLVED_NOTE);
            expect(inputBox().value).toBe('');
        });

        test('a typed no under the fix card asks for the report again', async () => {
            seedSessions([genSession('one', [OFFER, FIX_CARD])]);
            await renderWindow();
            await send('no');
            expect(bodyOf(lastCue())).toContain(
                'That report is not prepared any more',
            );
        });

        test('words typed under the offer go into the report, and Stop says so', async () => {
            const reply = defer<any>();
            mocks.askLlmBot.mockImplementation(() => reply.promise);
            mocks.captureAppWindow.mockRejectedValue(new Error('no frame'));
            seedSessions([genSession('one', [OFFER])]);
            await renderWindow();
            await send('The projector went blank');
            await waitFor(() => stopButton() !== null, 'the report wait');
            const said = cues()[1];
            expect(bodyOf(said)).toContain('The projector went blank');
            expect(noteOf(said)).toBe(REPORT_NOTE);
            await click(stopButton());
            expect(bodyOf(lastCue())).toContain(
                'Stopped. I did not finish writing the report, and nothing ' +
                    'was sent — press Report when you want it written.',
            );
        });
    });

    describe('what another window hands over', () => {
        test('a problem to report opens a tab of its own on the offer', async () => {
            seedSessions([
                genSession('one', [{ id: 1, author: 'you', text: 'Hello' }]),
            ]);
            handOver('report', { text: '' });
            await renderWindow();
            expect(container.querySelectorAll('.chat-tab')).toHaveLength(2);
            expect(cues()).toHaveLength(1);
            expect(bodyOf(lastCue())).toContain('Tell me what went wrong');
            expect(actionLabels(lastCue())).toEqual(['Report']);
            expect(settings.has('chatbot-handoff-report')).toBe(false);
            expect(document.activeElement).toBe(inputBox());
        });

        test('with the strip full it takes the empty tab, else the one in front', async () => {
            const full = Array.from({ length: 12 }, (_value, index) => {
                return genSession(`tab-${index}`, [
                    { id: 1, author: 'you', text: `Question ${index}` },
                ]);
            });
            full[7] = genSession('tab-7', []);
            seedSessions(full, 'tab-0');
            handOver('report', { text: '' });
            await renderWindow();
            expect(container.querySelectorAll('.chat-tab')).toHaveLength(12);
            expect(cues()).toHaveLength(1);
            expect(bodyOf(lastCue())).toContain('Tell me what went wrong');
            // No empty tab left: the one in front takes the next.
            handOver('report', { text: 'The app showed an error: boom' });
            await act(async () => {
                window.dispatchEvent(new Event('focus'));
            });
            await settle();
            expect(container.querySelectorAll('.chat-tab')).toHaveLength(12);
            expect(cues()).toHaveLength(2);
            expect(bodyOf(lastCue())).toContain(
                'The app showed an error: boom',
            );
        });

        test('a Resources file is attached under a card that fits it', async () => {
            mocks.genAttachmentFromPath.mockResolvedValue({
                attachment: {
                    id: 'file-1',
                    kind: 'file',
                    name: 'MAT.18.pdf',
                    mimeType: 'application/pdf',
                    byteSize: 4096,
                    filePath: '/resources/pdf/MAT.18.pdf',
                    pageCount: 3,
                },
            });
            handOver('file', {
                filePath: '/resources/pdf/MAT.18.pdf',
                reading: {
                    bookKey: 'MAT',
                    chapter: 18,
                    verseStart: 15,
                    verseEnd: 17,
                    title: 'Matthew 18:15-17',
                    bibleKey: 'KJV',
                },
            });
            await renderWindow();
            expect(mocks.genAttachmentFromPath).toHaveBeenCalledWith(
                '/resources/pdf/MAT.18.pdf',
                null,
            );
            const card = lastCue();
            expect(bodyOf(card)).toContain(
                'MAT.18.pdf is attached below. Ask me anything about what is ' +
                    'in it, or press a question.',
            );
            expect(bodyOf(card)).toContain(
                'You are reading Matthew 18:15-17 in the Bible Reader.',
            );
            expect(
                Array.from(card.querySelectorAll('.cue-reply')).map(
                    (one) => one.textContent,
                ),
            ).toEqual([
                '15-17',
                'Read',
                'What is this file about?',
                'Sum up the main points',
                'Explain it in simple words',
            ]);
            const chip = container.querySelector('.chat-ask .chat-clip');
            expect(chip?.querySelector('.chat-clip-name')?.textContent).toBe(
                'MAT.18.pdf',
            );
            expect(chip?.querySelector('.chat-clip-number')?.textContent).toBe(
                '1',
            );
            expect(document.activeElement).toBe(inputBox());
        });

        test('a file handed to a full strip is numbered after the tab’s own', async () => {
            mocks.genAttachmentFromPath.mockResolvedValue({
                attachment: {
                    id: 'file-2',
                    kind: 'text',
                    name: 'notes.txt',
                    mimeType: 'text/plain',
                    byteSize: 5,
                    summary: 'Notes',
                    filePath: '/resources/notes.txt',
                },
            });
            const full = Array.from({ length: 12 }, (_value, index) => {
                return genSession(`tab-${index}`, [
                    {
                        id: 1,
                        author: 'you',
                        text: `Question ${index}`,
                        attachments: [
                            {
                                id: `old-${index}`,
                                kind: 'text',
                                name: 'old.txt',
                                mimeType: 'text/plain',
                                byteSize: 3,
                                summary: 'old',
                                number: 4,
                            },
                        ],
                    },
                ]);
            });
            seedSessions(full, 'tab-3');
            handOver('file', { filePath: '/resources/notes.txt' });
            await renderWindow();
            expect(bodyOf(lastCue())).toContain('notes.txt is attached below.');
            expect(
                container.querySelector('.chat-ask .chat-clip-number')
                    ?.textContent,
            ).toBe('5');
        });

        test('a file that cannot be read says why', async () => {
            mocks.genAttachmentFromPath.mockResolvedValue({
                failure: 'MAT.18.pdf is not there any more.',
            });
            handOver('file', { filePath: '/resources/pdf/MAT.18.pdf' });
            await renderWindow();
            expect(bodyOf(lastCue())).toContain(
                'MAT.18.pdf is not there any more.',
            );
            expect(container.querySelector('.chat-ask .chat-clip')).toBeNull();
        });

        test('Bible Find hands over its Bible, offered first', async () => {
            routes.owa_find_verse = () => json(BIBLE_LIST);
            handOver('ask', { text: 'Help me find a Bible verse in "KJV"' });
            await renderWindow();
            await waitFor(() => cues().length === 2, 'the Bible question');
            expect(bodyOf(cues()[0])).toContain(
                'Help me find a Bible verse in "KJV"',
            );
            expect(actionLabels(lastCue())).toEqual([
                'KJV — King James Version (the one in Find)',
                'KHSV — Khmer Standard Version',
            ]);
            expect(document.activeElement).toBe(inputBox());
        });

        test('Bible Find hands over its words, searched at once', async () => {
            routes.owa_find_verse = () => json({ total: 0, verses: [] });
            mocks.askLlmBot.mockResolvedValue({
                text: 'Matthew 5:44 has those words.',
            });
            handOver('ask', {
                text: 'Help me find a Bible verse in "KJV": love your enemies',
            });
            await renderWindow();
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the search',
            );
            await waitFor(() => cues().length === 2, 'the answer');
            expect(bodyOf(cues()[0])).toContain(
                'Help me find a Bible verse in "KJV": love your enemies',
            );
            expect(mocks.askLlmBot.mock.calls[0][6]?.verseFind).toMatchObject({
                bible: 'KJV',
            });
        });

        test('Stop while the Bibles are read drops the list', async () => {
            const listed = defer();
            routes.owa_find_verse = () => listed.promise;
            handOver('ask', { text: 'Help me find a Bible verse in "KJV"' });
            await renderWindow();
            await click(stopButton());
            expect(bodyOf(lastCue())).toContain(STOPPED_TEXT);
            const count = cues().length;
            await act(async () => {
                listed.resolve(json(BIBLE_LIST));
            });
            await settle();
            expect(cues()).toHaveLength(count);
        });

        test('Settings hands over an import, run in a tab of its own', async () => {
            routeCatalog();
            handOver('ask', { text: 'Import bible for Khmer' });
            await renderWindow();
            await waitFor(() => cues().length === 2, 'the list');
            expect(bodyOf(cues()[0])).toContain('Import bible for Khmer');
            expect(bodyOf(lastCue())).toContain('2 have “khmer” in the name');
        });

        test('an import the collection cannot read and an assistant that fails', async () => {
            routeCatalog();
            mocks.askLlmBot.mockRejectedValueOnce(
                new Error('The free service is busy'),
            );
            handOver('ask', { text: 'Import bible for Klingon' });
            await renderWindow();
            await waitFor(() => cues().length === 2, 'the failure');
            expect(bodyOf(lastCue())).toContain(
                'I could not answer that: The free service is busy',
            );
            expect(noteOf(lastCue())).toBeNull();
            expect(actionLabels(lastCue())).toEqual([]);
            // A new tab is on Auto: the assistant was picked for it.
            expect(mocks.askLlmBot.mock.calls[0][2]).toBe('free');
            expect(
                container.querySelector('.chat-auto-pick')?.textContent,
            ).not.toBe('chosen at each question');
        });

        test('a request it cannot run is taken and left alone', async () => {
            seedSessions([genSession('one', [])]);
            handOver('ask', { text: 'Hello there' });
            await renderWindow();
            expect(settings.has('chatbot-handoff-ask')).toBe(false);
            expect(container.querySelectorAll('.chat-tab')).toHaveLength(1);
            expect(cues()).toHaveLength(0);
        });

        test('a request left later is taken on focus and when main says so', async () => {
            seedSessions([genSession('one', [])]);
            await renderWindow();
            handOver('report', { text: '' });
            await act(async () => {
                window.dispatchEvent(new Event('focus'));
            });
            await settle();
            expect(container.querySelectorAll('.chat-tab')).toHaveLength(2);
            handOver('report', { text: 'The app showed an error: boom' });
            await act(async () => {
                for (const listener of listeners.get(
                    'main:app:chatbot-launch-focus',
                ) ?? []) {
                    listener({}, '/presenter.html');
                }
            });
            await settle();
            expect(container.querySelectorAll('.chat-tab')).toHaveLength(3);
            expect(bodyOf(lastCue())).toContain(
                'The app showed an error: boom',
            );
            act(() => root.unmount());
            expect(
                listeners.get('main:app:chatbot-launch-focus')?.size ?? 0,
            ).toBe(0);
            // Gone with the window: a request left now waits for the next.
            handOver('report', { text: '' });
            window.dispatchEvent(new Event('focus'));
            expect(settings.has('chatbot-handoff-report')).toBe(true);
            root = createRoot(container);
        });
    });
});
