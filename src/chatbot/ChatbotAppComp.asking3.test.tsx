// @vitest-environment jsdom

// The help window's Report: the first press that only asks, the look into
// the app and the write-up, the way to put it right that comes first, the
// sending, Stop and Add in the middle of either, and the buttons under a
// saved report. Driven through the window's DOM; nothing reaches a provider,
// the tool host, the clipboard or the disk -- `askLlmBot`, `callTool`,
// `postIssueReport` and the clipboard are this file's own scripted fakes,
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
import { resetSpendGuardForTests } from './spendGuardHelpers';
import { clearAutoSetbacks } from './autoAssistantHelpers';
import { clearAutoAwayServers } from './autoAssistantSourceHelpers';
import { requestChatbotReport } from '../helper/ai/chatbotHandoffStoreHelpers';
import {
    REPORT_COPY_EMAIL_TOOL_NAME,
    REPORT_COPY_IMAGE_TOOL_NAME,
    REPORT_COPY_SUBJECT_TOOL_NAME,
    REPORT_COPY_TOOL_NAME,
    REPORT_EMAIL_TOOL_NAME,
    REPORT_FIXED_TEXT,
    REPORT_SEND_TOOL_NAME,
} from './reportHelpers';

const FREE_VL = 'nvidia/nemotron-3.5-super-vl:free';
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

const REPORT_ANSWER =
    'The screen went black because no screen was showing.\n\n' +
    'REPORT:\nTITLE: Projector goes black\nSTEPS: 1. Show a song\n2. Watch the screen';
const FIX_ANSWER =
    'It looks like the screen is only hidden.\n\n' +
    'TRY THIS: Press **Show** on the Mini Screen.\n\n' +
    'REPORT:\nTITLE: Screen hidden\nSTEPS: unknown';

// What the app's own window and screens say, for the report's evidence.
function scriptAppState() {
    h.callTool.mockImplementation(async (name: string) => {
        if (name === 'owa_app_state') {
            return JSON.stringify({
                mainWindow: {
                    title: 'Presenter',
                    page: 'presenter.html',
                    language: 'en',
                    theme: 'dark',
                },
            });
        }
        if (name === 'owa_list_screens') {
            return JSON.stringify({
                showingScreenIds: [],
                displays: [{ id: 1 }],
                screens: [],
            });
        }
        return '';
    });
}

async function pressReport() {
    await act(async () => {
        container.querySelector<HTMLButtonElement>('.chat-report')!.click();
    });
}

async function reportFromBox(complaint: string) {
    typeQuestion(complaint);
    await pressReport();
    await press('Report it');
}

async function waitForCard(label: string) {
    await waitFor(() => {
        return findButton(label, lastBot() ?? container) !== null && isIdle();
    }, `the card with "${label}"`);
    return lastBot()!;
}

function genPosted(report: any, more: Record<string, any> = {}) {
    return {
        reference: report.reference,
        isSent: true,
        isQueued: false,
        sentFileNames: [`${report.reference}.png`],
        unsentFiles: [],
        filePath: `/downloads/${report.reference}.md`,
        imageFilePath: `/downloads/${report.reference}.png`,
        failure: null,
        sendFailure: null,
        ...more,
    };
}

// A report prepared from the box and sent, for the buttons under it.
async function prepareAndSendReport() {
    h.askLlmBot.mockImplementation(answerWith(REPORT_ANSWER));
    h.postIssueReport.mockImplementation(async (report: any) => {
        return genPosted(report);
    });
    await reportFromBox('The projector went black during the song');
    const card = await waitForCard('Send report');
    await press('Send report', card);
    await waitFor(() => {
        return h.postIssueReport.mock.calls.length === 1 && isIdle();
    }, 'the report sent');
    return {
        report: h.postIssueReport.mock.calls[0][0],
        sent: lastBot()!,
    };
}

describe('Report', () => {
    test('looks into the complaint itself, then files it only on Send report and shows the saved copies', async () => {
        seedSessions([{ id: 'report' }]);
        scriptAppState();
        h.findContactEmail.mockImplementation(async () => ({
            email: 'help@example.org',
            source: 'help page',
        }));
        await renderWindow();
        const { report, sent } = await prepareAndSendReport();

        const [asked, , provider, model, , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain('The projector went black during the song');
        expect(asked).toContain('Window: Presenter (presenter.html)');
        expect(asked).toContain('Error: the projector went black');
        expect(provider).toBe('free');
        expect(model).toBe(FREE_SUPER);
        expect(extra.replyLang).toBe('en');
        const said = youCues().at(-1)!;
        expect(noteOf(said)).toBe('Reporting a problem.');

        const card = botCues().at(-2)!;
        expect(textOf(card)).toContain(
            'I have written this up as "Projector goes black".',
        );
        // The picture taken before the investigation rides on the card.
        expect(chipNamesOf(card)).toEqual(['app screen']);

        expect(report.title).toBe('Projector goes black');
        expect(report.contactEmail).toBe('help@example.org');
        expect(h.postIssueReport.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
        expect(textOf(sent)).toContain(
            `Sent. Report ${report.reference} went to the report server`,
        );
        expect(chipNamesOf(sent)).toEqual([
            `${report.reference}.md`,
            `${report.reference}.png`,
        ]);
        expect(actionsOf(sent)).toEqual([
            'Copy report',
            'Copy subject',
            'Copy picture',
            'Copy email address',
            'Email it',
        ]);
    });

    test('a way to put it right comes first; a typed “yes, thanks” closes it and Still re-opens the report', async () => {
        seedSessions([{ id: 'fix' }]);
        scriptAppState();
        h.askLlmBot.mockImplementation(answerWith(FIX_ANSWER));
        await renderWindow();
        await reportFromBox('The screen is blank');
        const card = await waitForCard('That fixed it');
        expect(textOf(card)).toContain('Try this first:');
        expect(textOf(card)).toContain('on the Mini Screen.');
        expect(actionsOf(card)).toEqual([
            'That fixed it',
            'Still a problem — report it',
        ]);

        await ask('yes, thanks');
        await flush();
        expect(textOf(lastBot())).toContain(REPORT_FIXED_TEXT);
        expect(noteOf(lastBot())).toBe('Solved without a report.');
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);

        await press('Still a problem — report it', card);
        const prepared = lastBot()!;
        expect(textOf(prepared)).toContain(
            'I have written this up as "Screen hidden".',
        );
        expect(actionsOf(prepared)).toEqual(['Send report', 'Copy report']);
    });

    test('an investigation that fails still prepares the report, with the door to the assistant’s settings', async () => {
        seedSessions([{ id: 'report-fail' }]);
        scriptAppState();
        h.askLlmBot.mockImplementation(async () => {
            throw Object.assign(new Error('the free pool is full'), {
                cause: { status: 429 },
            });
        });
        // And the help page that names the address could not be read.
        h.findContactEmail.mockImplementation(async () => {
            throw new Error('offline');
        });
        await renderWindow();
        await reportFromBox('Songs will not open');
        const card = await waitForCard('Send report');
        h.postIssueReport.mockImplementation(async (report: any) => {
            return genPosted(report);
        });
        await press('Send report', card);
        await waitFor(() => h.postIssueReport.mock.calls.length === 1, 'send');
        expect(h.postIssueReport.mock.calls[0][0].contactEmail).toBeNull();
        expect(noteOf(card)).toBe(
            'I could not look into it — the free pool is full. The report still carries what the window could see for itself.',
        );
        expect(actionsOf(card)).toEqual([
            'Send report',
            'Copy report',
            'Open AI settings',
        ]);
        // The title is the person's own first line when nobody wrote one.
        expect(textOf(card)).toContain(
            'I have written this up as "Songs will not open".',
        );
    });

    test('on Auto the report is looked into by Auto’s first pick, and a picture in the box goes with it', async () => {
        seedSessions([
            {
                id: 'report-auto',
                isAuto: true,
                provider: 'free',
                model: FREE_VL,
            },
        ]);
        scriptAppState();
        // The main window open, so the picture says which window it is of.
        h.electronSendAsync.mockImplementation(
            (channel: string, data?: any) => {
                return channel === 'main:app:list-app-windows'
                    ? Promise.resolve([
                          {
                              id: 'w-main',
                              title: 'Presenter',
                              url: 'https://localhost:3000/presenter.html',
                          },
                      ])
                    : defaultElectronSendAsync(channel, data);
            },
        );
        h.askLlmBot.mockImplementation(answerWith(REPORT_ANSWER));
        await renderWindow();
        await act(async () => {
            h.emit('main:app:chat-attach', {}, { dataUrl: PNG_DATA_URL });
        });
        await waitFor(() => {
            return (
                container.querySelectorAll('form.chat-ask .chat-clip')
                    .length === 1
            );
        }, 'the picture in the box');
        await reportFromBox('This picture shows the problem');
        await waitForCard('Send report');

        const [asked, , provider, model, , , extra] = h.askLlmBot.mock.calls[0];
        expect(provider).toBe('free');
        expect(model).toBe(FREE_VL);
        expect(extra.images).toHaveLength(1);
        expect(asked).toContain('This picture shows the problem');
        // Its number and its window, for "in 1 it is missing".
        expect(asked).toContain('w-main');
        // Off the box, onto the report's own line in the transcript.
        expect(
            container.querySelectorAll('form.chat-ask .chat-clip'),
        ).toHaveLength(0);
        expect(chipNamesOf(youCues().at(-1))).toEqual(['my screen']);
    });

    test('Stop while it is being written says one line and nothing else', async () => {
        seedSessions([{ id: 'report-stop' }]);
        scriptAppState();
        const { held, impl } = genHeldAnswer();
        h.askLlmBot.mockImplementation(impl);
        await renderWindow();
        await reportFromBox('The clock is wrong');
        await waitForAsks(1);
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-stop')!.click();
        });
        await flush();
        expect(held.isAborted).toBe(true);
        expect(botCues().map((cue) => saidOf(cue))).toEqual([
            'Stopped. I did not finish writing the report, and nothing was sent — press Report when you want it written.',
        ]);
    });

    test('Stop while the picture is taken, or the window read, ends the report before any model', async () => {
        seedSessions([{ id: 'report-early-stop' }]);
        scriptAppState();
        // Either read, held until the test lets it go.
        let releaseHeld: (value: any) => void = () => {};
        let heldChannel = 'main:app:capture-window';
        h.electronSendAsync.mockImplementation(
            (channel: string, data?: any) => {
                if (channel === heldChannel) {
                    return new Promise((resolve) => {
                        releaseHeld = resolve;
                    });
                }
                return defaultElectronSendAsync(channel, data);
            },
        );
        const stopWhileHeld = async (value: any) => {
            await waitFor(() => {
                return h.electronSendAsync.mock.calls.some((call) => {
                    return call[0] === heldChannel;
                });
            }, heldChannel);
            await act(async () => {
                container
                    .querySelector<HTMLButtonElement>('.chat-stop')!
                    .click();
            });
            await act(async () => {
                releaseHeld(value);
            });
            await flush();
        };
        const stopped =
            'Stopped. I did not finish writing the report, and nothing was sent — press Report when you want it written.';
        await renderWindow();
        await reportFromBox('The clock is wrong');
        await stopWhileHeld(PNG_DATA_URL);
        expect(botCues().map((cue) => saidOf(cue))).toEqual([stopped]);

        heldChannel = 'main:app:recent-console';
        h.electronSendAsync.mockClear();
        // In the middle of a report already: Report adds to it, unasked.
        typeQuestion('The clock is still wrong');
        await pressReport();
        expect(container.querySelector('[role="alertdialog"]')).toBeNull();
        await stopWhileHeld(['Error: late']);
        expect(botCues().map((cue) => saidOf(cue))).toEqual([stopped, stopped]);
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });

    test('words added while it is written stop it and write it again with them', async () => {
        seedSessions([{ id: 'report-add' }]);
        scriptAppState();
        const { impl } = genHeldAnswer();
        h.askLlmBot.mockImplementation(impl);
        await renderWindow();
        await reportFromBox('The clock is wrong');
        await waitForAsks(1);
        h.askLlmBot.mockImplementation(answerWith(REPORT_ANSWER));
        typeQuestion('It started after the update');
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-add')!.click();
        });
        await waitForCard('Send report');
        expect(h.askLlmBot).toHaveBeenCalledTimes(2);
        const again = h.askLlmBot.mock.calls[1][0];
        expect(again).toContain('The clock is wrong');
        expect(again).toContain('It started after the update');
    });

    test('with an empty box Report quotes the last question, or asks for one when there is none', async () => {
        seedSessions([{ id: 'report-empty' }]);
        await renderWindow();
        await pressReport();
        expect(textOf(lastBot())).toContain('Tell me what went wrong first');
        expect(container.querySelector('[role="alertdialog"]')).toBeNull();

        h.askLlmBot.mockImplementation(answerWith('Try the Mini Screen.'));
        await askAndSettle('Why is the verse cut off?');
        await pressReport();
        const confirm = container.querySelector('[role="alertdialog"]')!;
        expect(confirm.textContent).toContain('Why is the verse cut off?');
        // Escape takes the question away again.
        await act(async () => {
            confirm.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
            );
        });
        expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    });

    test('a report another window asked for opens on an offer, and its Report looks into that problem', async () => {
        requestChatbotReport('TypeError: the screen is undefined');
        scriptAppState();
        h.askLlmBot.mockImplementation(answerWith(REPORT_ANSWER));
        await renderWindow();
        const offer = await waitForCard('Report');
        expect(textOf(offer)).toContain('The app ran into a problem:');
        expect(textOf(offer)).toContain('TypeError: the screen is undefined');
        await press('Report', offer);
        await waitForCard('Send report');
        expect(h.askLlmBot.mock.calls[0][0]).toContain(
            'TypeError: the screen is undefined',
        );
    });

    test('an offer that only asked what went wrong takes what is typed, with no second question', async () => {
        requestChatbotReport('');
        scriptAppState();
        h.askLlmBot.mockImplementation(answerWith(REPORT_ANSWER));
        await renderWindow();
        const offer = await waitForCard('Report');
        // Pressed with nothing said yet: asked for the words first.
        await press('Report', offer);
        expect(textOf(lastBot())).toContain('Tell me what went wrong first');
        typeQuestion('Songs open slowly');
        await pressReport();
        expect(container.querySelector('[role="alertdialog"]')).toBeNull();
        await waitForCard('Send report');
        expect(h.askLlmBot.mock.calls[0][0]).toContain('Songs open slowly');
    });

    test('Send report on a report this window no longer holds says so', async () => {
        seedSessions([
            {
                id: 'report-gone',
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'I have written this up.',
                        actions: [
                            {
                                label: 'Send report',
                                toolName: REPORT_SEND_TOOL_NAME,
                                args: { reference: 'OWA-260101-dead' },
                            },
                        ],
                    },
                ],
            },
        ]);
        await renderWindow();
        await press('Send report', lastBot()!);
        expect(textOf(lastBot())).toContain(
            'That report is not prepared any more',
        );
        expect(h.postIssueReport).not.toHaveBeenCalled();
    });

    test('Stop while it is being sent waits for main to say whether it went', async () => {
        seedSessions([{ id: 'report-send-stop' }]);
        scriptAppState();
        h.askLlmBot.mockImplementation(answerWith(REPORT_ANSWER));
        await renderWindow();
        await reportFromBox('The projector went black');
        const card = await waitForCard('Send report');
        let isSentAnyway = false;
        h.postIssueReport.mockImplementation(
            (report: any, signal: AbortSignal) => {
                return new Promise((resolve) => {
                    signal.addEventListener('abort', () => {
                        resolve(genPosted(report, { isSent: isSentAnyway }));
                    });
                });
            },
        );
        await press('Send report', card);
        await waitFor(
            () => h.postIssueReport.mock.calls.length === 1,
            'sending',
        );
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-stop')!.click();
        });
        await waitFor(isIdle, 'the stop');
        expect(saidOf(lastBot())).toBe(
            'Stopped. The report was not sent — press Send report when you want it to go. A copy is in your Downloads folder.',
        );

        // Pressed again, and Stop arriving as the server took it.
        isSentAnyway = true;
        await press('Send report', card);
        await waitFor(
            () => h.postIssueReport.mock.calls.length === 2,
            'resending',
        );
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-stop')!.click();
        });
        await waitFor(isIdle, 'the second stop');
        expect(textOf(lastBot())).toContain(
            'It had already gone when you pressed Stop.',
        );
    });
});

describe('the buttons under a saved report', () => {
    test('copy the report, its subject, its picture and the address, and open the mail app', async () => {
        seedSessions([{ id: 'extras' }]);
        scriptAppState();
        h.findContactEmail.mockImplementation(async () => ({
            email: 'help@example.org',
            source: 'help page',
        }));
        await renderWindow();
        const { report, sent } = await prepareAndSendReport();

        await press('Copy report', sent);
        await waitFor(
            () => h.writeClipboardText.mock.calls.length === 1,
            'copy',
        );
        expect(h.writeClipboardText.mock.calls[0][0]).toBe(report.markdown);
        // The address and the file are code spans, drawn without their marks.
        expect(textOf(lastBot())).toContain(
            `Copied the whole report. Paste it into an email to help@example.org, and attach ${report.reference}.png from your Downloads folder.`,
        );

        await press('Copy subject', sent);
        await flush();
        expect(h.writeClipboardText.mock.calls[1][0]).toBe(report.subject);
        expect(textOf(lastBot())).toContain('Copied the subject line');

        await press('Copy picture', sent);
        await flush();
        expect(h.copyImageToClipboard).toHaveBeenCalledWith(
            report.imageDataUrl,
        );
        expect(textOf(lastBot())).toContain(
            'Copied the picture. Paste it into the email to help@example.org',
        );

        await press('Copy email address', sent);
        await flush();
        expect(h.writeClipboardText.mock.calls[2][0]).toBe('help@example.org');
        expect(textOf(lastBot())).toContain(
            "Copied help@example.org (from the app's help page).",
        );

        await press('Email it', sent);
        await flush();
        expect(h.openExternalURL).toHaveBeenCalledTimes(1);
        expect(h.openExternalURL.mock.calls[0][0]).toMatch(
            /^mailto:help@example\.org\?subject=/,
        );
        expect(textOf(lastBot())).toContain(
            'Opening your email app with help@example.org and the subject filled in.',
        );
        expect(textOf(lastBot())).toContain(
            'The report is on your clipboard — paste it into the message',
        );
    });

    test('say so when the clipboard cannot be reached or the picture will not copy', async () => {
        seedSessions([{ id: 'extras-fail' }]);
        scriptAppState();
        h.findContactEmail.mockImplementation(async () => ({
            email: 'help@example.org',
            source: 'app',
        }));
        await renderWindow();
        const { sent } = await prepareAndSendReport();
        h.writeClipboardText.mockImplementation(async () => {
            throw new Error('denied');
        });
        h.copyImageToClipboard.mockImplementation(async () => {
            throw new Error('denied');
        });

        await press('Copy report', sent);
        await flush();
        expect(textOf(lastBot())).toContain(
            'I could not reach the clipboard. Open the report file from the chip above',
        );
        await press('Copy subject', sent);
        await flush();
        expect(textOf(lastBot())).toContain(
            'I could not reach the clipboard. The subject line is',
        );
        await press('Copy email address', sent);
        await flush();
        expect(textOf(lastBot())).toContain(
            'I could not reach the clipboard. The address is help@example.org',
        );
        await press('Copy picture', sent);
        await flush();
        expect(textOf(lastBot())).toContain(
            'I could not put the picture on the clipboard.',
        );
        await press('Email it', sent);
        await flush();
        expect(textOf(lastBot())).toContain(
            'I could not reach the clipboard, so press Copy report and paste it into the message',
        );
    });

    test('with no address in this build, or a report no longer held, say what is possible', async () => {
        seedSessions([
            {
                id: 'extras-none',
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'Saved.',
                        actions: [
                            REPORT_COPY_TOOL_NAME,
                            REPORT_COPY_SUBJECT_TOOL_NAME,
                            REPORT_COPY_IMAGE_TOOL_NAME,
                            REPORT_COPY_EMAIL_TOOL_NAME,
                            REPORT_EMAIL_TOOL_NAME,
                        ].map((toolName) => {
                            return {
                                label: `Old ${toolName}`,
                                toolName,
                                args: { reference: 'OWA-260101-dead' },
                            };
                        }),
                    },
                ],
            },
        ]);
        scriptAppState();
        await renderWindow();
        const old = lastBot()!;
        await press(`Old ${REPORT_COPY_EMAIL_TOOL_NAME}`, old);
        await flush();
        expect(textOf(lastBot())).toContain(
            'This build carries no contact address',
        );
        await press(`Old ${REPORT_COPY_IMAGE_TOOL_NAME}`, old);
        await flush();
        expect(textOf(lastBot())).toContain('I no longer have that picture');
        await press(`Old ${REPORT_COPY_TOOL_NAME}`, old);
        await flush();
        expect(textOf(lastBot())).toContain('I no longer have that report');
        await press(`Old ${REPORT_COPY_SUBJECT_TOOL_NAME}`, old);
        await flush();
        expect(textOf(lastBot())).toContain('I no longer have that report');
        await press(`Old ${REPORT_EMAIL_TOOL_NAME}`, old);
        await flush();
        expect(textOf(lastBot())).toContain('I no longer have that report');

        // A report this window holds, written while no address was found.
        const { report, sent } = await prepareAndSendReport();
        await press('Copy report', sent);
        await flush();
        expect(saidOf(lastBot())).toBe(
            `Copied the whole report. Paste it into your message, and attach ${report.reference}.png from your Downloads folder.`,
        );
        await press('Copy picture', sent);
        await flush();
        expect(textOf(lastBot())).toContain(
            'Copied the picture. Paste it into the email — most mail apps',
        );
        await press('Copy subject', sent);
        await flush();
        expect(h.writeClipboardText).toHaveBeenLastCalledWith(report.subject);
        expect(textOf(lastBot())).toContain(
            `Copied the subject line [Open Worship] Projector goes black (${report.reference}).`,
        );
    });

    test('a report with no picture says nothing of one', async () => {
        seedSessions([{ id: 'extras-no-picture' }]);
        scriptAppState();
        h.findContactEmail.mockImplementation(async () => ({
            email: 'help@example.org',
            source: 'help page',
        }));
        h.electronSendAsync.mockImplementation(
            (channel: string, data?: any) => {
                if (channel === 'main:app:capture-window') {
                    return Promise.reject(new Error('no frame'));
                }
                return defaultElectronSendAsync(channel, data);
            },
        );
        await renderWindow();
        const { report, sent } = await prepareAndSendReport();
        expect(report.imageDataUrl).toBeNull();
        expect(actionsOf(sent)).not.toContain('Copy picture');
        await press('Copy report', sent);
        await flush();
        expect(saidOf(lastBot())).toBe(
            'Copied the whole report. Paste it into an email to help@example.org.',
        );
        await press('Email it', sent);
        await flush();
        expect(textOf(lastBot())).toContain(
            'The report is on your clipboard — paste it into the message.',
        );
    });
});
