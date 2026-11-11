// @vitest-environment jsdom

// What other windows hand the help window and the window answers with NO
// model: a Bible note, a song, a presenting flow and a slide document each
// open under their own card (`attachHandedFileRef`); words selected in a note
// or a passage are quoted in the box of the tab on it (`mentionHandedNoteRef`,
// `mentionHandedLookupRef`); a note an answer made is opened and attached
// (`openCreatedNoteRef`); a language asked for is offered and installed by
// buttons (`handleLangInstallStep`); and the buttons under a selection's card
// and under a changed document (`SELECTION_STEP_TOOL_NAME`,
// `LYRIC_UNDO_TOOL_NAME`). The tool host, the assistant, the file read and
// the note window opener are file-local mocks; the step helpers are real.

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
        openNoteWindow: vi.fn(),
        handleError: vi.fn(),
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
}));
vi.mock('../bible-list/note/noteWindowOpenHelpers', () => ({
    openNoteWindow: (...args: any[]) => mocks.openNoteWindow(...args),
}));

import ChatbotAppComp from './ChatbotAppComp';
import { genSelectionOffer } from './selectionMentionHelpers';
import { LYRIC_UNDO_LABEL, LYRIC_UNDO_TOOL_NAME } from './lyricChatHelpers';

// Captured before any test fakes the clock: a real turn of the event loop
// and the real time, for the lazy chunks (the question corpus) from disk.
const realSetTimeout = globalThis.setTimeout;
const realNow = performance.now.bind(performance);
const originalScrollIntoView = Element.prototype.scrollIntoView;

const SESSIONS_KEY = 'chatbot-sessions';
const NOTE_PATH = '/notes/Sermons.own';
const NOTE_WINDOW_URL =
    'https://localhost:3000/bibleNote.html?file=Sermons.own&id=3&uuid=note-3';

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

// One note of a notes file, as the file read gives it.
function genNoteAttachment(noteId = 3, name = 'Sunday Lesson') {
    return {
        id: `note-${noteId}`,
        kind: 'text',
        name,
        mimeType: 'text/plain',
        byteSize: 20,
        summary: 'Grace and peace',
        filePath: NOTE_PATH,
        noteId,
    };
}

function genFileAttachment(filePath: string) {
    const name = filePath.split('/').pop() ?? filePath;
    return {
        id: `file-${name}`,
        kind: 'text',
        name,
        mimeType: 'text/plain',
        byteSize: 20,
        summary: name,
        filePath,
    };
}

const MENTION = {
    text: 'grace',
    before: 'By ',
    after: ' alone',
    start: 4,
    end: 8,
};
const NOTE_QUOTE = 'Selected text (Sunday Lesson, 4-8):\n> By **grace** alone';

describe('ChatbotAppComp: handed-over documents, selections and buttons', () => {
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
        mocks.genAttachmentFromPath.mockImplementation(
            async (filePath: string, noteId: number | null) => {
                return {
                    attachment:
                        noteId === null
                            ? genFileAttachment(filePath)
                            : genNoteAttachment(noteId),
                };
            },
        );
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

    function actionLabels(cue: Element | undefined) {
        return Array.from(cue?.querySelectorAll('.cue-act') ?? []).map(
            (button) => button.textContent?.trim() ?? '',
        );
    }

    function replyLabels(cue: Element | undefined) {
        return Array.from(cue?.querySelectorAll('.cue-reply') ?? []).map(
            (button) => button.textContent?.trim() ?? '',
        );
    }

    function youTexts() {
        return Array.from(
            container.querySelectorAll<HTMLElement>(
                'article.cue-you .cue-said',
            ),
        ).map((element) => element.textContent ?? '');
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

    function focusPick() {
        return container.querySelector<HTMLSelectElement>(
            'select[aria-label="Which part of the app"]',
        )?.value;
    }

    function tabNames() {
        return Array.from(
            container.querySelectorAll<HTMLElement>('.chat-tab-name'),
        ).map((element) => element.textContent ?? '');
    }

    function activeTabName() {
        return (
            container.querySelector('.chat-tab.is-on .chat-tab-name')
                ?.textContent ?? null
        );
    }

    function boxChipNames() {
        return Array.from(
            container.querySelectorAll<HTMLElement>(
                '.chat-ask .chat-clip .chat-clip-name',
            ),
        ).map((element) => element.textContent ?? '');
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

    describe('a document handed over opens under its own card', () => {
        test('a Bible note: the tab asks about Bible Note under the note card', async () => {
            seedSessions([genSession('front', [])]);
            handOver('file', { filePath: NOTE_PATH, noteId: 3 });
            await renderWindow();
            expect(mocks.genAttachmentFromPath).toHaveBeenCalledWith(
                NOTE_PATH,
                3,
            );
            // A tab of its own, on Bible Note.
            expect(tabNames()).toHaveLength(2);
            expect(focusPick()).toBe('bibleNote');
            const card = lastCue();
            expect(bodyOf(card)).toContain(
                '“Sunday Lesson” is attached below. I can change this note for you',
            );
            expect(replyLabels(card)).toEqual(
                expect.arrayContaining([
                    'Check the spelling',
                    'Summarize this note',
                    'Format it so it is neat and easy to read',
                ]),
            );
            expect(boxChipNames()).toEqual(['Sunday Lesson']);
            expect(document.activeElement).toBe(inputBox());
        });

        test('a song: what can be done to it, as buttons', async () => {
            handOver('file', { filePath: '/docs/Amazing Grace.owl' });
            await renderWindow();
            const card = lastCue();
            expect(bodyOf(card)).toContain(
                '“Amazing Grace” is attached below. I can change this song for you',
            );
            expect(replyLabels(card)).toEqual(
                expect.arrayContaining([
                    'Add a section',
                    'Add chords',
                    'Change the key',
                ]),
            );
            expect(boxChipNames()).toEqual(['Amazing Grace.owl']);
        });

        test('a presenting flow: the four jobs asked of a running order', async () => {
            handOver('file', { filePath: '/flows/Sunday Service.owpf' });
            await renderWindow();
            const card = lastCue();
            expect(bodyOf(card)).toContain(
                '“Sunday Service” is attached below. I can change this presenting flow for you',
            );
            expect(replyLabels(card)).toEqual([
                'Check the running order',
                'Build it from my order of service',
                'Clear the screen between items',
                'Move on by itself',
            ]);
        });

        test('a slide document: its card offers the words larger', async () => {
            handOver('file', { filePath: '/docs/Sermon.ows' });
            await renderWindow();
            const card = lastCue();
            expect(bodyOf(card)).toContain(
                '“Sermon” is attached below. I can change these slides for you',
            );
            expect(replyLabels(card)).toEqual(
                expect.arrayContaining([
                    'Check the spelling',
                    'Make the words larger',
                    'Make slides like a picture',
                ]),
            );
            // Not a note: the tab keeps the part it was on.
            expect(focusPick()).not.toBe('bibleNote');
        });

        // 2026-11-10, the user, **Working in** naming a note's window:
        // _should behave like what working for bible-note_ -- the preview
        // a Resources row opened first is the window its tab works in.
        test("a study file: its tab works in the file's own preview window", async () => {
            const mdPath = '/resources/JHN.3.The New Birth.md';
            const previewUrl =
                'https://localhost:3000/markdownPreview.html?preview-file=' +
                `${encodeURIComponent(mdPath)}&uuid=preview`;
            mocks.electronSendAsync.mockImplementation(
                async (channel: string) => {
                    return channel === 'main:app:list-app-windows'
                        ? [
                              {
                                  id: 'main-window',
                                  title: 'Open Worship app - Reader',
                                  url: 'https://localhost:3000/reader.html',
                              },
                              {
                                  id: 'md-window',
                                  title:
                                      'Open Worship app - Markdown Preview' +
                                      ' - JHN.3.The New Birth.md',
                                  url: previewUrl,
                              },
                          ]
                        : null;
                },
            );
            seedSessions([genSession('front', [])]);
            handOver('file', { filePath: mdPath });
            await renderWindow();
            const windowPick = () => {
                return container.querySelector<HTMLSelectElement>(
                    'select[aria-label="Which window"]',
                );
            };
            await waitFor(() => {
                return windowPick()?.value === 'md-window';
            }, 'the preview window on the window line');
            const row = () => {
                return container.querySelector('.chat-window-row');
            };
            expect(row()?.classList.contains('is-aimed')).toBe(true);
            expect(windowPick()?.selectedOptions[0]?.textContent?.trim()).toBe(
                'Markdown Preview - JHN.3.The New Birth.md · own window',
            );
            // A file's window is no kind: the part the new tab asks about
            // is what it was.
            const askedAbout = focusPick();
            expect(askedAbout).toBe('presenter');
            // Held over the main window, by its address and by its file.
            expect(mocks.sendData).toHaveBeenLastCalledWith(
                'main:app:hold-window-on-top',
                { url: previewUrl, filePath: mdPath },
            );
            const pickWindow = async (windowId: string) => {
                await act(async () => {
                    const setter = Object.getOwnPropertyDescriptor(
                        HTMLSelectElement.prototype,
                        'value',
                    )!.set!;
                    setter.call(windowPick(), windowId);
                    windowPick()!.dispatchEvent(
                        new Event('change', { bubbles: true }),
                    );
                });
                await settle();
            };
            // The main window picked by hand: the preview is let go, and
            // the tab asks about the main window's page, as any pick does.
            await pickWindow('main-window');
            expect(windowPick()?.value).toBe('main-window');
            expect(row()?.classList.contains('is-aimed')).toBe(false);
            expect(focusPick()).toBe('reader');
            // The preview picked back by hand: worked in again, the kind
            // left as it was.
            await pickWindow('md-window');
            expect(windowPick()?.value).toBe('md-window');
            expect(row()?.classList.contains('is-aimed')).toBe(true);
            expect(focusPick()).toBe('reader');
        });
    });

    describe('words selected in a note', () => {
        test('open a tab on the note, quoted in the box, with what to do with them', async () => {
            seedSessions([genSession('front', [])]);
            handOver('file', {
                filePath: NOTE_PATH,
                noteId: 3,
                mention: MENTION,
            });
            await renderWindow();
            expect(tabNames()).toHaveLength(2);
            expect(mocks.genAttachmentFromPath).toHaveBeenCalledWith(
                NOTE_PATH,
                3,
            );
            expect(inputBox().value).toBe(`${NOTE_QUOTE}\n`);
            const offer = lastCue();
            expect(bodyOf(offer)).toContain(
                'What would you like to do with “grace”?',
            );
            expect(actionLabels(offer)).toEqual([
                'Explain it in simple words',
                'Check the spelling',
                'Replace the words with another language',
                'Add another language under each line',
                'Uppercase',
                'Search Selected Text on Google',
                'Copy Selected Text',
            ]);
        });

        test('go to the tab already on that note, which reads it again from nothing', async () => {
            seedSessions(
                [
                    genSession('notes', [
                        {
                            id: 1,
                            author: 'you',
                            text: 'Tidy this note',
                            attachments: [genNoteAttachment()],
                        },
                    ]),
                    genSession('front', []),
                ],
                'front',
            );
            handOver('file', {
                filePath: NOTE_PATH,
                noteId: 3,
                mention: MENTION,
            });
            await renderWindow();
            expect(tabNames()).toHaveLength(2);
            expect(activeTabName()).toBe('notes');
            expect(mocks.genAttachmentFromPath).not.toHaveBeenCalled();
            expect(inputBox().value).toBe(`${NOTE_QUOTE}\n`);
            expect(bodyOf(lastCue())).toContain(
                'What would you like to do with “grace”?',
            );
            // The same words handed over again are not quoted twice, and
            // no second card is written.
            const count = cues().length;
            handOver('file', {
                filePath: NOTE_PATH,
                noteId: 3,
                mention: MENTION,
            });
            await act(async () => {
                window.dispatchEvent(new Event('focus'));
            });
            await settle();
            expect(inputBox().value).toBe(`${NOTE_QUOTE}\n`);
            expect(cues()).toHaveLength(count);
        });

        test('a tab working in that note window takes them, and the note with them', async () => {
            mocks.electronSendAsync.mockImplementation(
                async (channel: string) => {
                    return channel === 'main:app:list-app-windows'
                        ? [
                              {
                                  id: 'main-window',
                                  title: 'Presenter',
                                  url: 'https://localhost:3000/presenter.html',
                              },
                              {
                                  id: 'note-window',
                                  title: 'Bible Note',
                                  url: NOTE_WINDOW_URL,
                              },
                          ]
                        : null;
                },
            );
            seedSessions(
                [
                    genSession('notes', [], { focus: 'bibleNote' }),
                    genSession('front', []),
                ],
                'front',
            );
            await renderWindow();
            await waitFor(
                () => mocks.electronSendAsync.mock.calls.length > 0,
                'the window list',
            );
            await settle();
            handOver('file', {
                filePath: NOTE_PATH,
                noteId: 3,
                mention: MENTION,
            });
            await act(async () => {
                window.dispatchEvent(new Event('focus'));
            });
            await settle();
            // No new tab: the one working in the note window.
            expect(tabNames()).toHaveLength(2);
            expect(activeTabName()).toBe('notes');
            expect(mocks.genAttachmentFromPath).toHaveBeenCalledWith(
                NOTE_PATH,
                3,
            );
            expect(boxChipNames()).toEqual(['Sunday Lesson']);
            expect(inputBox().value).toBe(`${NOTE_QUOTE}\n`);
        });

        test('a note that cannot be read quotes nothing', async () => {
            mocks.genAttachmentFromPath.mockResolvedValue({
                failure: 'Sermons.own is not there any more.',
            });
            handOver('file', {
                filePath: NOTE_PATH,
                noteId: 3,
                mention: MENTION,
            });
            await renderWindow();
            expect(bodyOf(lastCue())).toContain(
                'Sermons.own is not there any more.',
            );
            expect(inputBox().value).toBe('');
        });
    });

    // 2026-11-11, the user, the Markdown Preview's editor with a line
    // selected: _selected text in editor should have option to mention in
    // chatbot input text_.
    describe('words selected in a text file', () => {
        const STUDY_PATH = '/resources/Default/JHN.3.study.md';
        const STUDY_MENTION = {
            text: 'so loved',
            before: 'For God ',
            after: ' the world',
            start: null,
            end: null,
            lines: { first: 7, last: 7 },
        };
        const STUDY_QUOTE =
            'Selected text (JHN.3.study.md:7):\n' +
            '> For God **so loved** the world';

        test('open a tab of their own with the file, quoted with their line, no card', async () => {
            seedSessions([genSession('front', [])]);
            handOver('file', { filePath: STUDY_PATH, mention: STUDY_MENTION });
            await renderWindow();
            expect(tabNames()).toHaveLength(2);
            expect(mocks.genAttachmentFromPath).toHaveBeenCalledWith(
                STUDY_PATH,
                null,
            );
            expect(boxChipNames()).toEqual(['JHN.3.study.md']);
            expect(inputBox().value).toBe(`${STUDY_QUOTE}\n`);
            // The quote is what they came to ask about: no opening card,
            // and none of a note's jobs.
            expect(cues()).toHaveLength(0);
        });

        test('go to the tab already on the file, and are quoted once', async () => {
            seedSessions(
                [
                    genSession('study', [
                        {
                            id: 1,
                            author: 'you',
                            text: 'Check this study',
                            attachments: [genFileAttachment(STUDY_PATH)],
                        },
                    ]),
                    genSession('front', []),
                ],
                'front',
            );
            // Its path written the other way: the same file.
            handOver('file', {
                filePath: STUDY_PATH.toUpperCase(),
                mention: STUDY_MENTION,
            });
            await renderWindow();
            expect(tabNames()).toHaveLength(2);
            expect(activeTabName()).toBe('study');
            expect(mocks.genAttachmentFromPath).not.toHaveBeenCalled();
            expect(inputBox().value).toBe(`${STUDY_QUOTE}\n`);
            const count = cues().length;
            handOver('file', { filePath: STUDY_PATH, mention: STUDY_MENTION });
            await act(async () => {
                window.dispatchEvent(new Event('focus'));
            });
            await settle();
            expect(inputBox().value).toBe(`${STUDY_QUOTE}\n`);
            expect(cues()).toHaveLength(count);
        });
    });

    describe('words selected in a passage', () => {
        const PASSAGE = {
            kind: 'verse',
            target: 'JHN 3:16',
            title: 'John 3:16',
            bibleKey: 'KJV',
            page: 'reader.html',
        };

        function routePassage() {
            routes.owa_lookup_record = () =>
                json({
                    kind: 'verse',
                    bible: 'KJV',
                    passages: [
                        {
                            key: 'JHN 3:16',
                            text: 'For God so loved the world',
                        },
                    ],
                });
            routes.owa_resource_file = () => json({ files: [] });
        }

        test('the passage is read in a tab of its own, then the words quoted in its box', async () => {
            routePassage();
            seedSessions([genSession('front', [])]);
            handOver('lookup', {
                ...PASSAGE,
                mention: {
                    text: 'loved',
                    before: 'For God so ',
                    after: ' the world',
                    start: 12,
                    end: 16,
                },
            });
            await renderWindow();
            await waitFor(
                () => inputBox().value !== '',
                'the quote in the box',
            );
            expect(tabNames()).toHaveLength(2);
            expect(toolCalls('owa_lookup_record')).toHaveLength(1);
            expect(inputBox().value).toBe(
                'Selected text (John 3:16, 12-16):\n> For God so **loved** the world\n',
            );
        });

        test('more words of the same passage go to the tab already on it, read once', async () => {
            routePassage();
            seedSessions([genSession('front', [])]);
            handOver('lookup', {
                ...PASSAGE,
                mention: { text: 'God', before: '', after: '' },
            });
            await renderWindow();
            await waitFor(() => inputBox().value !== '', 'the first quote');
            const names = tabNames();
            expect(names).toHaveLength(2);
            const passageTab = activeTabName();
            // Back to the first tab, then more words of the same verse.
            await click(
                Array.from(
                    container.querySelectorAll<HTMLElement>('.chat-tab-name'),
                ).find((element) => element.textContent === 'front'),
            );
            expect(activeTabName()).toBe('front');
            handOver('lookup', {
                ...PASSAGE,
                mention: { text: 'the world', before: '', after: '' },
            });
            await act(async () => {
                window.dispatchEvent(new Event('focus'));
            });
            await settle();
            expect(tabNames()).toHaveLength(2);
            expect(activeTabName()).toBe(passageTab);
            expect(toolCalls('owa_lookup_record')).toHaveLength(1);
            expect(inputBox().value).toBe(
                'Selected text (John 3:16):\n> God\n\n' +
                    'Selected text (John 3:16):\n> the world\n',
            );
        });

        test('another passage of the same window goes to the tab asking about that window’s passage', async () => {
            routePassage();
            seedSessions([genSession('front', [])]);
            handOver('lookup', {
                ...PASSAGE,
                mention: { text: 'God', before: '', after: '' },
            });
            await renderWindow();
            await waitFor(() => inputBox().value !== '', 'the first quote');
            const passageTab = activeTabName();
            await click(
                Array.from(
                    container.querySelectorAll<HTMLElement>('.chat-tab-name'),
                ).find((element) => element.textContent === 'front'),
            );
            handOver('lookup', {
                ...PASSAGE,
                target: 'JHN 3:17',
                title: 'John 3:17',
                mention: { text: 'condemn', before: '', after: '' },
            });
            await act(async () => {
                window.dispatchEvent(new Event('focus'));
            });
            await waitFor(
                () => inputBox().value.includes('John 3:17'),
                'the second quote',
            );
            // Not a third tab: the one on John 3:16 reads John 3:17 too.
            expect(tabNames()).toHaveLength(2);
            expect(activeTabName()).toBe(passageTab);
            expect(toolCalls('owa_lookup_record')).toHaveLength(2);
            expect(toolCalls('owa_lookup_record')[1]).toMatchObject({
                kind: 'verse',
                ref: 'JHN 3:17',
            });
            expect(inputBox().value).toContain(
                'Selected text (John 3:17):\n> condemn\n',
            );
        });

        test('a tab still answering is passed over for a tab of its own', async () => {
            routePassage();
            const answered = defer<{ text: string }>();
            mocks.askLlmBot.mockImplementation(() => answered.promise);
            seedSessions([genSession('front', [])]);
            await renderWindow();
            await send('/btw what is grace?');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the ask',
            );
            handOver('lookup', {
                ...PASSAGE,
                mention: { text: 'God', before: '', after: '' },
            });
            await act(async () => {
                window.dispatchEvent(new Event('focus'));
            });
            await waitFor(() => inputBox().value !== '', 'the quote');
            expect(tabNames()).toHaveLength(2);
            expect(activeTabName()).not.toBe('front');
            expect(inputBox().value).toBe(
                'Selected text (John 3:16):\n> God\n',
            );
            await act(async () => {
                answered.resolve({ text: 'Grace is a gift.' });
            });
            await settle();
        });

        test('the tab working in the window the words came from takes them', async () => {
            routePassage();
            mocks.electronSendAsync.mockImplementation(
                async (channel: string) => {
                    return channel === 'main:app:list-app-windows'
                        ? [
                              {
                                  id: 'main-window',
                                  title: 'Presenter',
                                  url: 'https://localhost:3000/presenter.html',
                              },
                              {
                                  id: 'reader-window',
                                  title: 'Bible Reader',
                                  url: 'https://localhost:3000/reader.html?uuid=reader-2',
                              },
                          ]
                        : null;
                },
            );
            seedSessions([genSession('front', [])]);
            await renderWindow();
            const picker = () => {
                return container.querySelector<HTMLSelectElement>(
                    'select[aria-label="Which window"]',
                );
            };
            await waitFor(() => picker() !== null, 'the window picker');
            act(() => {
                const select = picker()!;
                select.value = 'reader-window';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await settle();
            expect(picker()!.value).toBe('reader-window');
            handOver('lookup', {
                ...PASSAGE,
                page: 'reader.html?uuid=reader-2',
                mention: { text: 'God', before: '', after: '' },
            });
            await act(async () => {
                window.dispatchEvent(new Event('focus'));
            });
            await waitFor(() => inputBox().value !== '', 'the quote');
            expect(tabNames()).toEqual(['front']);
            expect(toolCalls('owa_lookup_record')).toHaveLength(1);
            expect(inputBox().value).toBe(
                'Selected text (John 3:16):\n> God\n',
            );
        });
    });

    describe('a slide document handed over, then asked about', () => {
        test('the words larger, with the document still in the box', async () => {
            routes.owa_slide_edit = (args) => {
                return args.action === 'slides'
                    ? json({
                          slides: [
                              {
                                  number: 1,
                                  items: [
                                      { id: 4, type: 'text', fontSize: 60 },
                                  ],
                              },
                          ],
                      })
                    : json({ isChanged: true, undoId: 'undo-3' });
            };
            handOver('file', { filePath: '/docs/Sermon.ows' });
            await renderWindow();
            expect(boxChipNames()).toEqual(['Sermon.ows']);
            await send('make the words 72 px');
            await waitFor(
                () => bodyOf(lastCue()).includes('Done in one change'),
                'the change',
            );
            expect(toolCalls('owa_slide_edit')[1]).toEqual({
                action: 'update-slides',
                file: '/docs/Sermon.ows',
                changes: [{ slide: 1, items: [{ id: 4, fontSize: 72 }] }],
            });
            expect(bodyOf(lastCue())).toContain(
                'Done in one change: 1 boxes of “Sermon” have a new font size (72 px).',
            );
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });
    });

    describe('a note the answer made', () => {
        test('is opened in its own window and attached under its card', async () => {
            seedSessions([genSession('front', [])]);
            mocks.askLlmBot.mockResolvedValue({
                text: 'I made the note “Lesson”.',
                createdNote: {
                    name: 'Lesson',
                    filePath: '/notes/Default.own',
                    noteId: 5,
                    undoId: 'undo-5',
                },
            });
            mocks.genAttachmentFromPath.mockResolvedValue({
                attachment: {
                    ...genNoteAttachment(5, 'Lesson'),
                    filePath: '/notes/Default.own',
                },
            });
            await renderWindow();
            await send('/btw make me a note about grace');
            await waitFor(
                () => mocks.openNoteWindow.mock.calls.length > 0,
                'the note window',
            );
            await waitFor(
                () => bodyOf(lastCue()).includes('“Lesson” is attached below'),
                'the note card',
            );
            expect(mocks.openNoteWindow).toHaveBeenCalledWith(
                'Default.own',
                '/notes/Default.own',
                5,
            );
            expect(mocks.genAttachmentFromPath).toHaveBeenCalledWith(
                '/notes/Default.own',
                5,
            );
            expect(focusPick()).toBe('bibleNote');
            expect(boxChipNames()).toEqual(['Lesson']);
        });

        test('a window that cannot be opened still leaves the note attached', async () => {
            seedSessions([genSession('front', [])]);
            const failure = new Error('no window');
            mocks.openNoteWindow.mockImplementation(() => {
                throw failure;
            });
            mocks.askLlmBot.mockResolvedValue({
                text: 'I made the note “Lesson”.',
                createdNote: {
                    name: 'Lesson',
                    filePath: '/notes/Default.own',
                    noteId: 5,
                    undoId: null,
                },
            });
            mocks.genAttachmentFromPath.mockResolvedValue({
                attachment: {
                    ...genNoteAttachment(5, 'Lesson'),
                    filePath: '/notes/Default.own',
                },
            });
            await renderWindow();
            await send('/btw make me a note about grace');
            await waitFor(
                () => bodyOf(lastCue()).includes('“Lesson” is attached below'),
                'the note card',
            );
            expect(mocks.handleError).toHaveBeenCalledWith(failure);
            expect(boxChipNames()).toEqual(['Lesson']);
        });

        test('a made note with no number is not opened', async () => {
            seedSessions([genSession('front', [])]);
            mocks.askLlmBot.mockResolvedValue({
                text: 'I made a note.',
                createdNote: {
                    name: 'Lesson',
                    filePath: '/notes/Default.own',
                    noteId: -1,
                    undoId: null,
                },
            });
            await renderWindow();
            await send('/btw make me a note about grace');
            await waitFor(
                () => bodyOf(lastCue()).includes('I made a note.'),
                'the answer',
            );
            await settle();
            expect(mocks.openNoteWindow).not.toHaveBeenCalled();
            expect(mocks.genAttachmentFromPath).not.toHaveBeenCalled();
        });
    });

    describe('a language asked for in so many words', () => {
        function routeLanguage(
            check: Record<string, unknown>,
            install: () => unknown = () => ({ state: 'installed' }),
        ) {
            routes.owa_language = (args) => {
                return json(args.action === 'check' ? check : install());
            };
        }

        const MADE_UP_MISSING = {
            state: 'missing',
            langCode: 'xx',
            name: 'Examplish',
            nativeName: 'Exemplar',
        };

        test('is offered by buttons, and Install it installs it', async () => {
            routeLanguage(MADE_UP_MISSING);
            seedSessions([genSession('front', [])]);
            await renderWindow();
            await send('Install the Examplish language');
            expect(toolCalls('owa_language')).toEqual([
                { action: 'check', language: 'Examplish' },
            ]);
            expect(youTexts()).toEqual(['Install the Examplish language']);
            const offer = lastCue();
            expect(bodyOf(offer)).toContain(
                'Exemplar (Examplish) is not installed in this app yet.',
            );
            expect(actionLabels(offer)).toEqual(['Install it', 'Not now']);
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
            await press('Install it');
            expect(toolCalls('owa_language')[1]).toEqual({
                action: 'install',
                language: 'xx',
            });
            expect(youTexts()).toEqual([
                'Install the Examplish language',
                'Install it',
            ]);
            expect(bodyOf(lastCue())).toContain(
                'Done — Exemplar (Examplish) is ready.',
            );
        });

        test('a typed "no" under the offer is its Not now', async () => {
            routeLanguage(MADE_UP_MISSING);
            seedSessions([genSession('front', [])]);
            await renderWindow();
            await send('Install the Examplish language');
            await send('no');
            expect(toolCalls('owa_language')).toHaveLength(1);
            expect(youTexts()).toEqual([
                'Install the Examplish language',
                'no',
            ]);
            expect(bodyOf(lastCue())).toContain(
                'Stopped. Nothing was installed.',
            );
        });

        test('an install that fails offers it again', async () => {
            routeLanguage(MADE_UP_MISSING, () => ({
                state: 'missing',
                problem: 'offline',
            }));
            seedSessions([genSession('front', [])]);
            await renderWindow();
            await send('Install the Examplish language');
            await press('Install it');
            const failed = lastCue();
            expect(bodyOf(failed)).toContain(
                'I could not install Exemplar (Examplish). Nothing was changed.',
            );
            expect(actionLabels(failed)).toEqual(['Install it', 'Not now']);
        });

        test('Stop while it installs says nothing more when it lands', async () => {
            const installed = defer();
            routes.owa_language = (args) => {
                return args.action === 'check'
                    ? json(MADE_UP_MISSING)
                    : installed.promise;
            };
            seedSessions([genSession('front', [])]);
            await renderWindow();
            await send('Install the Examplish language');
            await press('Install it');
            const stop =
                container.querySelector<HTMLButtonElement>('.chat-stop');
            expect(stop).not.toBeNull();
            await click(stop);
            const count = cues().length;
            await act(async () => {
                installed.resolve(json({ state: 'installed' }));
            });
            await settle();
            expect(cues()).toHaveLength(count);
            expect(container.textContent).not.toContain('is ready.');
        });
    });

    describe('the buttons under a selection of a note', () => {
        const QUOTE = 'Selected text (Sunday Lesson):\n> grace';

        function seedOffer(words = 'grace') {
            const offer = genSelectionOffer(QUOTE, words);
            seedSessions([
                genSession('front', [
                    {
                        id: 1,
                        author: 'bot',
                        text: offer.text,
                        actions: offer.actions,
                    },
                ]),
            ]);
        }

        test('Copy Selected Text copies the words and says so', async () => {
            const writeText = vi.fn(async () => {});
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText },
                configurable: true,
            });
            seedOffer();
            await renderWindow();
            await press('Copy Selected Text');
            expect(writeText).toHaveBeenCalledWith('grace');
            expect(bodyOf(lastCue())).toContain('Copied “grace”.');
        });

        test('a copy the clipboard refuses says it could not', async () => {
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: async () => {
                        throw new Error('denied');
                    },
                },
                configurable: true,
            });
            seedOffer();
            await renderWindow();
            await press('Copy Selected Text');
            expect(bodyOf(lastCue())).toContain(
                'I could not copy it just now.',
            );
        });

        test('Search Selected Text on Google opens a search for the words alone', async () => {
            seedOffer('grace  and\npeace');
            await renderWindow();
            const count = cues().length;
            await press('Search Selected Text on Google');
            expect(mocks.openExternalURL).toHaveBeenCalledWith(
                'https://www.google.com/search?q=grace+and+peace',
            );
            expect(cues()).toHaveLength(count);
        });

        test('Uppercase asks the assistant under the quote, shown as pressed', async () => {
            mocks.askLlmBot.mockResolvedValue({ text: 'GRACE' });
            seedOffer();
            await renderWindow();
            await press('Uppercase');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the ask',
            );
            expect(String(mocks.askLlmBot.mock.calls[0][0])).toContain(
                `${QUOTE}\nMake these words uppercase.`,
            );
            await waitFor(() => youTexts().length === 1, 'the echo');
            expect(youTexts()[0]).toContain('Uppercase');
            expect(youTexts()[0]).not.toContain('Make these words');
        });

        test('a job pressed while the tab is still answering waits its turn: nothing is asked', async () => {
            const answered = defer<{ text: string }>();
            mocks.askLlmBot.mockImplementation(() => answered.promise);
            seedOffer();
            await renderWindow();
            await send('/btw what is grace?');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the first ask',
            );
            const offerCue = cues()[0];
            await press('Uppercase', offerCue);
            expect(mocks.askLlmBot).toHaveBeenCalledOnce();
            expect(youTexts()).toEqual(['/btw what is grace?']);
            await act(async () => {
                answered.resolve({ text: 'Grace is a gift.' });
            });
            await settle();
        });

        test('a button whose job is not one it knows does nothing', async () => {
            seedSessions([
                genSession('front', [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'What would you like to do with “grace”?',
                        actions: [
                            {
                                label: 'Shout it',
                                toolName: 'owa_window_selection_step',
                                args: {
                                    job: 'shout',
                                    quote: QUOTE,
                                    words: 'grace',
                                },
                            },
                        ],
                    },
                ]),
            ]);
            await renderWindow();
            await press('Shout it');
            expect(cues()).toHaveLength(1);
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
            expect(mocks.openExternalURL).not.toHaveBeenCalled();
        });
    });

    describe('Undo this change under a changed document', () => {
        function seedUndo(args: Record<string, unknown>) {
            seedSessions([
                genSession('front', [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'Done: the chorus is in Spanish.',
                        actions: [
                            {
                                label: LYRIC_UNDO_LABEL,
                                toolName: LYRIC_UNDO_TOOL_NAME,
                                args,
                            },
                        ],
                    },
                ]),
            ]);
        }

        test('puts the song back by its change and says so', async () => {
            routes.owa_undo = () => json({ isUndone: true });
            seedUndo({ id: 'undo-1', name: 'Amazing Grace' });
            await renderWindow();
            await press(LYRIC_UNDO_LABEL);
            expect(toolCalls('owa_undo')).toEqual([
                { action: 'undo', id: 'undo-1' },
            ]);
            expect(bodyOf(lastCue())).toContain(
                '“Amazing Grace” is back as it was before that change.',
            );
            expect(savedSession('front')).toBeDefined();
        });

        test('every change of the answer goes back, the newest first', async () => {
            routes.owa_undo = () => json({ isUndone: true });
            seedUndo({
                id: 'undo-2',
                name: 'Sermon',
                ids: ['undo-1', '', 7, 'undo-2'],
            });
            await renderWindow();
            await press(LYRIC_UNDO_LABEL);
            expect(toolCalls('owa_undo')).toEqual([
                { action: 'undo', id: 'undo-2' },
                { action: 'undo', id: 'undo-1' },
            ]);
            expect(bodyOf(lastCue())).toContain(
                '“Sermon” is back as it was before that change.',
            );
        });

        test('one undone by hand already: the rest still go back', async () => {
            routes.owa_undo = (args) => {
                if (args.id === 'undo-2') {
                    throw new Error('That change was already undone');
                }
                return json({ isUndone: true });
            };
            seedUndo({
                id: 'undo-2',
                name: 'Sermon',
                ids: ['undo-1', 'undo-2'],
            });
            await renderWindow();
            await press(LYRIC_UNDO_LABEL);
            expect(toolCalls('owa_undo')).toHaveLength(2);
            expect(bodyOf(lastCue())).toContain(
                '“Sermon” is back as it was before that change.',
            );
        });

        test('all of them undone already says so', async () => {
            routes.owa_undo = () => {
                throw new Error('That change was already undone');
            };
            seedUndo({ id: 'undo-1', name: 'Amazing Grace' });
            await renderWindow();
            await press(LYRIC_UNDO_LABEL);
            expect(bodyOf(lastCue())).toContain('That was already undone.');
        });

        test('an undo that fails says it could not, and stops there', async () => {
            routes.owa_undo = () => {
                throw new Error('The main window is closed');
            };
            seedUndo({
                id: 'undo-2',
                name: 'Sermon',
                ids: ['undo-1', 'undo-2'],
            });
            await renderWindow();
            await press(LYRIC_UNDO_LABEL);
            expect(toolCalls('owa_undo')).toEqual([
                { action: 'undo', id: 'undo-2' },
            ]);
            expect(bodyOf(lastCue())).toContain(
                'I could not do that just now. Ask me again',
            );
        });
    });
});
