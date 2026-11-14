// @vitest-environment jsdom

// The help window's first half, by what a person does in it: a FOREGROUND
// session handed over by a panel, picked from the box's ⋮ menu, rung by its
// chip and put away by the × of its line; two presses of a tab's + or ×
// landing before the window redraws; Auto chosen when nothing can answer
// on it; a reply typed under the verse finder's Bible choices on Auto with
// no assistant to read it; and a chapter of a book no Bible names. The tool
// host, the assistant, the Auto picker and the file read are file-local
// mocks; the step helpers are real.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { settings, listeners, routes, mocks, autoState } = vi.hoisted(() => ({
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
        refreshTextAttachment: vi.fn(),
        resolveAutoPicks: vi.fn(),
        listLangBibleBookNames: vi.fn(),
        handleError: vi.fn(),
    },
    // Auto's first guess: the real one, unless a test says none can answer.
    autoState: { isGuessNone: false },
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
        appUtils: {
            handleError: (error: unknown) => mocks.handleError(error),
        },
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
    refreshTextAttachment: (...args: any[]) =>
        mocks.refreshTextAttachment(...args),
}));
vi.mock('./autoAssistantSourceHelpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('./autoAssistantSourceHelpers')>();
    return {
        ...actual,
        resolveAutoPicks: (...args: any[]) => mocks.resolveAutoPicks(...args),
        guessAutoPick: () => {
            return autoState.isGuessNone ? null : actual.guessAutoPick();
        },
    };
});
// The language packages' Bible book names are lazy files: none installed.
vi.mock('../lang/langPackageFileHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../lang/langPackageFileHelpers')
    >()),
    listLangBibleBookNames: () => mocks.listLangBibleBookNames(),
}));

import ChatbotAppComp from './ChatbotAppComp';
import { genForegroundAttachment } from './foregroundChatHelpers';

// Captured before any test fakes the clock: a real turn of the event loop
// and the real time, for the lazy chunks (the question corpus) from disk.
const realSetTimeout = globalThis.setTimeout;
const realNow = performance.now.bind(performance);
const originalScrollIntoView = Element.prototype.scrollIntoView;

const SESSIONS_KEY = 'chatbot-sessions';
const COULD_NOT = 'I could not do that just now. Try again in a moment.';

function genSession(id: string, messages: any[], extra: any = {}) {
    return {
        id,
        title: id,
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
    const promise = new Promise<T>((onResolve) => {
        resolve = onResolve;
    });
    return { promise, resolve };
}

// A handed-over request, as another window leaves it (30 s, taken once).
function handOver(key: string, value: Record<string, unknown>) {
    settings.set(`chatbot-handoff-${key}`, json({ ...value, at: Date.now() }));
}

const QUICK_TEXT_ASK = {
    widget: 'quick-text' as const,
    sessionId: 's2',
    sessionName: 'Session 2',
};

describe('ChatbotAppComp: foreground sessions, tab presses and Auto', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.useFakeTimers();
        settings.clear();
        listeners.clear();
        autoState.isGuessNone = false;
        for (const key of Object.keys(routes)) {
            delete routes[key];
        }
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        // jsdom lays nothing out: the tab strip and the suggestion list
        // scroll their row into view, which it does not implement.
        Element.prototype.scrollIntoView = () => {};
        // A new tab (a handed-over job opens one) is on the free
        // assistant by name, not Auto.
        settings.set('chatbot-llm-auto', 'false');
        settings.set('chatbot-llm-provider', 'free');
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
        mocks.refreshTextAttachment.mockImplementation(
            async (attachment: any) => {
                return attachment;
            },
        );
        mocks.resolveAutoPicks.mockResolvedValue([]);
        mocks.listLangBibleBookNames.mockResolvedValue([]);
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
    });

    // Every promise the mocked tools and assistant answer with, and the
    // re-renders they cause. No fake time passes.
    async function settle(rounds = 3) {
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

    function query<T extends Element = HTMLElement>(selector: string) {
        return container.querySelector<T>(selector);
    }

    function queryAll<T extends Element = HTMLElement>(selector: string) {
        return Array.from(container.querySelectorAll<T>(selector));
    }

    function cues() {
        return queryAll('.cue');
    }

    function bodyOf(cue: Element | undefined) {
        return cue?.querySelector('.cue-body')?.textContent ?? '';
    }

    function lastCue() {
        const list = cues();
        return list[list.length - 1];
    }

    function replyLabels(cue: Element | undefined) {
        return Array.from(cue?.querySelectorAll('.cue-reply') ?? []).map(
            (button) => button.textContent?.trim() ?? '',
        );
    }

    function noteOf(cue: Element | undefined) {
        return cue?.querySelector('.cue-note')?.textContent ?? '';
    }

    async function click(element: Element | null | undefined) {
        expect(element).toBeTruthy();
        await act(async () => {
            (element as HTMLElement).click();
        });
        await settle();
    }

    function inputBox() {
        return query<HTMLTextAreaElement>('.chat-input')!;
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
        await click(query<HTMLButtonElement>('.chat-send'));
    }

    function pick(label: string, value: string) {
        const select = query<HTMLSelectElement>(
            `select[aria-label="${label}"]`,
        )!;
        expect(select, `a picker "${label}"`).toBeTruthy();
        const setter = Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            'value',
        )!.set!;
        act(() => {
            setter.call(select, value);
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    function tabNames() {
        return queryAll('.chat-tab-name').map((element) => {
            return element.textContent ?? '';
        });
    }

    function boxChipNames() {
        return queryAll('.chat-ask .chat-clip .chat-clip-name').map(
            (element) => element.textContent ?? '',
        );
    }

    // The "Still asking about" lines above the box, by their chips' names.
    function openLineChipNames() {
        return queryAll('.chat-open-files .chat-clip-name').map((element) => {
            return element.textContent ?? '';
        });
    }

    function attachError() {
        return query('.chat-attach-error')?.textContent ?? null;
    }

    function toolCalls(name: string) {
        return mocks.callTool.mock.calls
            .filter((call) => call[0] === name)
            .map((call) => call[1]);
    }

    function savedSession(id: string) {
        return JSON.parse(settings.get(SESSIONS_KEY) ?? '{}').sessions?.find(
            (session: any) => session.id === id,
        );
    }

    // A tab whose question carried a foreground session: it stays open.
    function seedForegroundTab(ask: Record<string, unknown> = QUICK_TEXT_ASK) {
        seedSessions([
            genSession('fg', [
                {
                    id: 1,
                    author: 'you',
                    text: 'About this',
                    attachments: [
                        { ...genForegroundAttachment(ask as any), number: 1 },
                    ],
                },
                { id: 2, author: 'bot', text: 'It is open.' },
            ]),
        ]);
    }

    describe('a foreground session handed over by its panel', () => {
        test('opens a tab of its own: the chip in the box, the Presenter asked about, and what can be done', async () => {
            seedSessions([genSession('front', [], { focus: 'reader' })]);
            handOver('foreground', QUICK_TEXT_ASK);
            await renderWindow();
            expect(tabNames()).toHaveLength(2);
            expect(
                query<HTMLSelectElement>(
                    'select[aria-label="Which part of the app"]',
                )?.value,
            ).toBe('presenter');
            expect(boxChipNames()).toEqual(['Quick Text › Session 2']);
            const card = lastCue();
            expect(bodyOf(card)).toContain(
                '“Quick Text › Session 2” is attached below. I can change it for you',
            );
            expect(replyLabels(card)).toEqual([
                'Show it on the screen',
                'Make the words larger',
                'Move it to the top',
                'Take it off the screen',
            ]);
            expect(document.activeElement).toBe(inputBox());
            // Taken once: the same window focused again opens nothing more.
            await act(async () => {
                window.dispatchEvent(new Event('focus'));
            });
            await settle();
            expect(tabNames()).toHaveLength(2);
        });

        test('with every tab taken and none empty it goes to the tab in front, numbered after that tab’s own', async () => {
            const sessions = Array.from({ length: 12 }, (_unused, index) => {
                return genSession(`tab-${index}`, [
                    { id: 1, author: 'you', text: `question ${index}` },
                ]);
            });
            sessions[4] = genSession('tab-4', [
                {
                    id: 1,
                    author: 'you',
                    text: 'About the countdown',
                    attachments: [
                        {
                            ...genForegroundAttachment({
                                widget: 'countdown',
                                sessionId: '',
                                sessionName: 'Default',
                            }),
                            number: 3,
                        },
                    ],
                },
                { id: 2, author: 'bot', text: 'It is open.' },
            ]);
            seedSessions(sessions, 'tab-4');
            handOver('foreground', QUICK_TEXT_ASK);
            await renderWindow();
            expect(tabNames()).toHaveLength(12);
            expect(query('.chat-tab.is-on .chat-tab-name')?.textContent).toBe(
                'tab-4',
            );
            expect(boxChipNames()).toEqual(['Quick Text › Session 2']);
            expect(
                queryAll('.chat-ask .chat-clip .chat-clip-number').map(
                    (element) => element.textContent,
                ),
            ).toEqual(['4']);
            expect(bodyOf(lastCue())).toContain(
                '“Quick Text › Session 2” is attached below.',
            );
        });
    });

    describe('Attach a foreground session, from the box’s ⋮', () => {
        async function openPicker() {
            await click(query('button.chat-ask-tools'));
            await click(
                query(
                    '[role="menu"] [aria-label="Attach a foreground session"]',
                ),
            );
        }

        function pickerGroup() {
            return query(
                '.chat-open-files[aria-label="Attach a foreground session"]',
            );
        }

        function pickerRows() {
            return Array.from(
                pickerGroup()?.querySelectorAll<HTMLButtonElement>(
                    'button.chat-clip',
                ) ?? [],
            );
        }

        test('lists the open panels’ sessions as they are now, and one press attaches one', async () => {
            const read = defer();
            routes.owa_foreground_edit = () => read.promise;
            seedSessions([genSession('front', [])]);
            await renderWindow();
            await openPicker();
            expect(toolCalls('owa_foreground_edit')).toEqual([
                { action: 'read', open: true },
            ]);
            expect(pickerGroup()?.textContent).toContain(
                'Looking at the open panels…',
            );
            await act(async () => {
                read.resolve(
                    json({
                        panels: [
                            {
                                widget: 'quick-text',
                                sessions: [
                                    { id: '', name: '', onScreens: [1] },
                                    {
                                        id: 's2',
                                        name: 'Session 2',
                                        onScreens: [],
                                    },
                                    // No id: not a session to attach.
                                    { id: 7, name: 'Broken' },
                                ],
                            },
                            // A panel with no sessions is its own one.
                            { widget: 'countdown', isOnScreen: true },
                            // No widget: not a panel at all.
                            { sessions: [{ id: 's9', name: 'Lost' }] },
                        ],
                    }),
                );
            });
            await settle();
            const rows = pickerRows();
            expect(
                rows.map((row) => {
                    return row.querySelector('.chat-clip-name')?.textContent;
                }),
            ).toEqual([
                'Quick Text › Default',
                'Quick Text › Session 2',
                'Countdown › Default',
            ]);
            // What is up on a screen says so.
            expect(rows[0].title).toBe('Quick Text › Default — On Screen');
            expect(
                rows[0]
                    .querySelector('.chat-clip-name')
                    ?.classList.contains('app-on-screen'),
            ).toBe(true);
            expect(rows[1].title).toBe('Quick Text › Session 2');
            expect(rows[2].title).toBe('Countdown › Default — On Screen');
            await click(rows[1]);
            expect(pickerGroup()).toBeNull();
            expect(boxChipNames()).toEqual(['Quick Text › Session 2']);
            expect(document.activeElement).toBe(inputBox());
        });

        test('with no panel open it says where to open one, and × puts the line away', async () => {
            routes.owa_foreground_edit = () => json({ panels: [] });
            seedSessions([genSession('front', [])]);
            await renderWindow();
            await openPicker();
            expect(pickerGroup()?.textContent).toContain(
                'No foreground panel is open. Open one from the Foreground tab in the Presenter.',
            );
            await click(pickerGroup()?.querySelector('.chat-clip-x'));
            expect(pickerGroup()).toBeNull();
            expect(boxChipNames()).toEqual([]);
        });

        test('a Presenter that cannot be read says to switch to it; a tool host that fails says to try again', async () => {
            routes.owa_foreground_edit = () => json({ isError: true });
            seedSessions([genSession('front', [])]);
            await renderWindow();
            await openPicker();
            expect(pickerGroup()?.textContent).toContain(
                'The Presenter could not be read. Switch the main window to the Presenter, then try again.',
            );
            expect(pickerRows()).toHaveLength(0);
            routes.owa_foreground_edit = () => {
                throw new Error('The tool host is away');
            };
            await openPicker();
            expect(pickerGroup()?.textContent).toContain(COULD_NOT);
        });
    });

    describe('a foreground session still asked about', () => {
        test('its chip rings the session on its panel’s strip, and says so when the panel is shut', async () => {
            routes.owa_find_ui = () => json({ shownCount: 0 });
            seedForegroundTab();
            await renderWindow();
            expect(openLineChipNames()).toEqual(['Quick Text › Session 2']);
            await click(query('.chat-open-files .chat-clip'));
            expect(toolCalls('owa_find_ui')).toEqual([
                {
                    text: 'Quick Text > Session 2',
                    highlight: true,
                    page: 'presenter.html',
                },
            ]);
            expect(attachError()).toBe(
                'Its panel is not open. Open it from the Foreground tab in the Presenter.',
            );
            // Found and rung: no line.
            routes.owa_find_ui = () => json({ shownCount: 1 });
            await click(query('.chat-open-files .chat-clip'));
            expect(toolCalls('owa_find_ui')).toHaveLength(2);
            expect(attachError()).toBeNull();
        });

        test('a camera has no sessions: its panel is rung by name, and a tool host that fails says to try again', async () => {
            routes.owa_find_ui = () => {
                throw new Error('The tool host is away');
            };
            seedForegroundTab({
                widget: 'camera',
                sessionId: '',
                sessionName: '',
                itemId: 'cam-1',
                itemLabel: 'Front Camera',
            });
            await renderWindow();
            expect(openLineChipNames()).toEqual(['Camera Show › Front Camera']);
            await click(query('.chat-open-files .chat-clip'));
            expect(toolCalls('owa_find_ui')).toEqual([
                {
                    text: 'Camera Show',
                    highlight: true,
                    page: 'presenter.html',
                },
            ]);
            expect(attachError()).toBe(COULD_NOT);
        });

        test('the × of its line puts it away for the questions after, and the tab remembers where', async () => {
            seedForegroundTab();
            await renderWindow();
            await click(
                query(
                    '.chat-open-files [aria-label="Remove Quick Text › Session 2"]',
                ),
            );
            expect(openLineChipNames()).toEqual([]);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(500);
            });
            expect(savedSession('fg')?.foregroundClosedAt).toBe(2);
        });

        test('a question it cannot be read for is asked with the session named, and how to read it', async () => {
            routes.owa_foreground_edit = () => {
                throw new Error('The Presenter is reloading');
            };
            seedForegroundTab();
            await renderWindow();
            await send('make the words say Welcome home');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            expect(toolCalls('owa_foreground_edit')).toEqual([
                {
                    action: 'read',
                    widget: 'quick-text',
                    session: 's2',
                },
            ]);
            const asked = String(mocks.askLlmBot.mock.calls[0][0]);
            expect(asked).toContain('make the words say Welcome home');
            expect(asked).toContain(
                '(The foreground session "Quick Text › Session 2" is attached.',
            );
            expect(asked).toContain(
                '(it could not be read just now; call owa_foreground_edit with action "read")',
            );
            expect(mocks.askLlmBot.mock.calls[0][6].foreground.asks).toEqual([
                QUICK_TEXT_ASK,
            ]);
        });
    });

    describe('two presses of the tab strip before the window draws again', () => {
        test('+ pressed twice with one place left opens one tab, not one past the cap', async () => {
            const sessions = Array.from({ length: 11 }, (_unused, index) => {
                return genSession(`tab-${index}`, [
                    { id: 1, author: 'you', text: `question ${index}` },
                ]);
            });
            seedSessions(sessions);
            await renderWindow();
            expect(tabNames()).toHaveLength(11);
            const add = query<HTMLButtonElement>('.chat-tab-add')!;
            await act(async () => {
                add.click();
                add.click();
            });
            await settle();
            expect(tabNames()).toHaveLength(12);
        });

        test('× pressed twice on one tab closes that tab alone', async () => {
            seedSessions(
                [
                    genSession('one', []),
                    genSession('two', []),
                    genSession('three', []),
                ],
                'one',
            );
            await renderWindow();
            const close = query<HTMLButtonElement>('[aria-label="Close two"]')!;
            await act(async () => {
                close.click();
                close.click();
            });
            await settle();
            expect(tabNames()).toEqual(['one', 'three']);
            expect(query('.chat-tab.is-on .chat-tab-name')?.textContent).toBe(
                'one',
            );
        });
    });

    describe('Auto, with nothing it could ask', () => {
        test('picking Auto leaves the tab on the assistant it names', async () => {
            autoState.isGuessNone = true;
            seedSessions([genSession('front', [])]);
            await renderWindow();
            const assistantPick = () => {
                return query<HTMLSelectElement>(
                    'select[aria-label="Which assistant answers"]',
                )!;
            };
            const before = assistantPick().value;
            expect(before).not.toBe('::auto::');
            pick('Which assistant answers', '::auto::');
            await settle();
            expect(assistantPick().value).toBe(before);
            expect(settings.get('chatbot-llm-auto')).toBe('false');
            expect(container.textContent).not.toContain('Auto pick');
        });

        test('a reply typed under the verse finder’s Bible choices asks the choices again', async () => {
            const choices = [
                {
                    label: 'KJV (the one in Find)',
                    toolName: 'owa-verse-find-step',
                    args: {
                        step: 'remember',
                        bible: 'KJV',
                        title: 'King James Version',
                    },
                },
                {
                    label: 'NIV',
                    toolName: 'owa-verse-find-step',
                    args: {
                        step: 'remember',
                        bible: 'NIV',
                        title: 'New International',
                    },
                },
            ];
            seedSessions([
                genSession(
                    'verse',
                    [
                        { id: 1, author: 'you', text: 'Help me find a verse' },
                        {
                            id: 2,
                            author: 'bot',
                            text: 'Which Bible should I search?',
                            actions: choices,
                        },
                    ],
                    { isAuto: true },
                ),
            ]);
            await renderWindow();
            await send('the modern one please');
            await waitFor(() => cues().length >= 4, 'the question again');
            expect(mocks.resolveAutoPicks).toHaveBeenCalled();
            expect(mocks.resolveAutoPicks.mock.calls[0][0]).toMatchObject({
                isGeneral: true,
            });
            // Nobody to read the words into a choice: nothing asked.
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
            const again = lastCue();
            expect(bodyOf(again)).toContain('Which Bible should I search?');
            expect(noteOf(again)).toBe(
                'I could not understand that choice. Choose an option below, or say it another way.',
            );
            expect(
                Array.from(again.querySelectorAll('.cue-act')).map((button) =>
                    button.textContent?.trim(),
                ),
            ).toEqual(['KJV (the one in Find)', 'NIV']);
        });
    });

    describe('a chapter of a book the Bible Reader does not know', () => {
        test('named by no Bible and no language package, it is asked as it stands', async () => {
            routes.owa_bible_suggest = () => json({ suggestions: [] });
            mocks.listLangBibleBookNames.mockRejectedValue(
                new Error('The package is away'),
            );
            mocks.askLlmBot.mockResolvedValue({ text: 'Which book is that?' });
            seedSessions([genSession('reader', [], { focus: 'reader' })]);
            await renderWindow();
            await send('summarize Zorbatha 18');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            // Its words were asked of the Reader's own aid first.
            expect(toolCalls('owa_bible_suggest').length).toBeGreaterThan(0);
            expect(toolCalls('owa_bible_suggest')[0]).toMatchObject({
                kind: 'reference',
                limit: 1,
            });
            expect(mocks.listLangBibleBookNames).toHaveBeenCalled();
            expect(String(mocks.askLlmBot.mock.calls[0][0])).toContain(
                'summarize Zorbatha 18',
            );
            expect(mocks.askLlmBot.mock.calls[0][6]?.bibleReader).toBe(
                undefined,
            );
            await waitFor(
                () => bodyOf(lastCue()).includes('Which book is that?'),
                'the answer',
            );
        });
    });
});
