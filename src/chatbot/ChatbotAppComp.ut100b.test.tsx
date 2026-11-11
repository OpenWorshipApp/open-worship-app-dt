// @vitest-environment jsdom

// A question asked in a tab with one of the person's DOCUMENTS open -- a
// Bible note, a song, a presenting flow, a slide document: the card again
// for "show me the options again", the words larger or a whole-note style
// done by the window with no model (one change, Undo under it), and every
// other question asked of the assistant with the document as it reads NOW
// (or, with none to answer, the sentence saying one is needed). Beside it,
// the window loading again for a language installed while it is open. The
// tool host and the assistant are file-local mocks; the readers are real.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { settings, files, listeners, routes, mocks, langState } = vi.hoisted(
    () => ({
        settings: new Map<string, string>(),
        // Files on the disk, by path: none unless a test puts one there.
        files: new Map<string, string>(),
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
            handleError: vi.fn(),
        },
        // The languages this window has, and who is told when they change.
        langState: {
            enabled: [] as {
                langCode: string;
                version: string;
                isEnabled: boolean;
            }[],
            changeListeners: new Set<() => void>(),
        },
    }),
);

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
        fileUtils: {
            readFile: (filePath: string, ...args: any[]) => {
                const done = args[args.length - 1];
                const text = files.get(filePath);
                if (text === undefined) {
                    done(new Error(`ENOENT: ${filePath}`));
                } else {
                    done(null, text);
                }
            },
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
// The window's list of languages, as the registry hands it out: what is
// enabled now, and the change it is told of.
vi.mock('../lang/langPluginRegistry', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lang/langPluginRegistry')>()),
    getEnabledLangPlugins: () => langState.enabled,
    onLangPluginsChanged: (listener: () => void) => {
        langState.changeListeners.add(listener);
        return () => {
            langState.changeListeners.delete(listener);
        };
    },
}));

import ChatbotAppComp from './ChatbotAppComp';
import { LANG_RELOAD_DELAY_MILLISECONDS } from './chatLangReloadHelpers';

// Captured before any test fakes the clock: a real turn of the event loop
// and the real time, for the lazy chunks (the question corpus) from disk.
const realSetTimeout = globalThis.setTimeout;
const realNow = performance.now.bind(performance);
const originalScrollIntoView = Element.prototype.scrollIntoView;

const SESSIONS_KEY = 'chatbot-sessions';
const NOTE_PATH = '/notes/Sermons.own';
const SONG_PATH = '/docs/Amazing Grace.owl';
const FLOW_PATH = '/flows/Sunday Service.owpf';
const SLIDE_PATH = '/docs/Sermon.ows';
const NEEDS_ASSISTANT =
    'A question about this needs an assistant, and none could answer just now.';

function json(value: unknown) {
    return JSON.stringify(value);
}

function genFileAttachment(filePath: string, extra: any = {}) {
    const name = filePath.split('/').pop() ?? filePath;
    return {
        id: `file-${name}`,
        kind: 'text',
        name,
        mimeType: 'text/plain',
        byteSize: 20,
        summary: name,
        filePath,
        ...extra,
    };
}

function genNoteAttachment() {
    return genFileAttachment(NOTE_PATH, { name: 'Sunday Lesson', noteId: 3 });
}

// A tab whose last question attached the document.
function seedDocumentTab(
    attachment: Record<string, unknown>,
    botExtra: Record<string, unknown> = {},
) {
    settings.set(
        SESSIONS_KEY,
        json({
            activeId: 'doc',
            sessions: [
                {
                    id: 'doc',
                    title: 'doc',
                    messages: [
                        {
                            id: 1,
                            author: 'you',
                            text: 'About this',
                            attachments: [attachment],
                        },
                        {
                            id: 2,
                            author: 'bot',
                            text: 'It is attached.',
                            ...botExtra,
                        },
                    ],
                    draft: '',
                    focus: 'presenter',
                    isFocusChosen: true,
                    provider: 'free',
                    model: '',
                    isLocked: false,
                },
            ],
        }),
    );
}

// The note as `owa_note_edit read` gives it.
const NOTE_READ = {
    file: 'Sermons',
    hash: 'hash-1',
    blockCount: 3,
    blocks: [
        { n: 1, kind: 'heading', text: 'Grace' },
        { n: 2, kind: 'paragraph', text: 'By grace you are saved' },
        { n: 3, kind: 'paragraph', text: '' },
    ],
};

// The slides as `owa_slide_edit slides` gives them.
const SLIDES_READ = {
    slideCount: 2,
    width: 1920,
    height: 1080,
    slides: [
        {
            number: 1,
            items: [
                { id: 1, type: 'text', fontSize: 70, text: 'Welcome' },
                { id: 2, type: 'text', fontSize: 70, locked: true },
            ],
        },
        {
            number: 2,
            items: [{ id: 3, type: 'text', fontSize: 40, text: 'Pray' }],
        },
    ],
};

describe('ChatbotAppComp: a question about a document of theirs', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.useFakeTimers();
        settings.clear();
        files.clear();
        listeners.clear();
        langState.enabled = [];
        langState.changeListeners.clear();
        for (const key of Object.keys(routes)) {
            delete routes[key];
        }
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
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
        vi.unstubAllGlobals();
        settings.clear();
        listeners.clear();
        if (originalScrollIntoView === undefined) {
            delete (Element.prototype as any).scrollIntoView;
        } else {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });

    async function settle(rounds = 3) {
        for (let index = 0; index < rounds; index++) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });
        }
    }

    // Until `check` holds -- with a real turn of the event loop each time,
    // for the question corpus loading from disk. Bounded by the real clock.
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

    function inputBox() {
        return container.querySelector<HTMLTextAreaElement>('.chat-input')!;
    }

    async function send(value: string) {
        const box = inputBox();
        const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value',
        )!.set!;
        act(() => {
            setter.call(box, value);
            box.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-send')!.click();
        });
        await settle();
    }

    function toolCalls(name: string) {
        return mocks.callTool.mock.calls
            .filter((call) => call[0] === name)
            .map((call) => call[1]);
    }

    function askedText(callIndex = 0) {
        return String(mocks.askLlmBot.mock.calls[callIndex]?.[0] ?? '');
    }

    // Two cues were there (the seeded question and its answer): the new
    // question and the window's own answer under it.
    async function waitForAnswer(count = 4) {
        await waitFor(() => cues().length >= count, 'the answer');
        await settle();
    }

    describe('"show me the options again" brings the card back with no model', () => {
        test('a note', async () => {
            seedDocumentTab(genNoteAttachment());
            await renderWindow();
            await send('show me the options again');
            await waitForAnswer();
            expect(youTexts()).toEqual([
                'About this',
                'show me the options again',
            ]);
            expect(bodyOf(lastCue())).toContain(
                '“Sunday Lesson” is attached below. I can change this note for you',
            );
            expect(replyLabels(lastCue())).toContain('Summarize this note');
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
            expect(mocks.callTool).not.toHaveBeenCalled();
        });

        test('a presenting flow', async () => {
            seedDocumentTab(genFileAttachment(FLOW_PATH));
            await renderWindow();
            await send('show me the options again');
            await waitForAnswer();
            expect(bodyOf(lastCue())).toContain(
                '“Sunday Service” is attached below. I can change this presenting flow for you',
            );
            expect(replyLabels(lastCue())).toContain('Check the running order');
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('a slide document', async () => {
            seedDocumentTab(genFileAttachment(SLIDE_PATH));
            await renderWindow();
            await send('what else can you do?');
            await waitForAnswer();
            expect(bodyOf(lastCue())).toContain(
                '“Sermon” is attached below. I can change these slides for you',
            );
            expect(replyLabels(lastCue())).toContain('Make the words larger');
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('a song', async () => {
            seedDocumentTab(genFileAttachment(SONG_PATH));
            await renderWindow();
            await send('show me the options again');
            await waitForAnswer();
            expect(bodyOf(lastCue())).toContain(
                '“Amazing Grace” is attached below. I can change this song for you',
            );
            expect(replyLabels(lastCue())).toContain('Add chords');
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });
    });

    describe('the words larger on a slide document, done by the window', () => {
        test('every box that is not locked, one change, Undo under it', async () => {
            routes.owa_slide_edit = (args) => {
                return args.action === 'slides'
                    ? json(SLIDES_READ)
                    : json({ isChanged: true, undoId: 'undo-7' });
            };
            seedDocumentTab(genFileAttachment(SLIDE_PATH));
            await renderWindow();
            await send('make the words larger');
            await waitForAnswer();
            expect(toolCalls('owa_slide_edit')).toEqual([
                { action: 'slides', file: SLIDE_PATH },
                {
                    action: 'update-slides',
                    file: SLIDE_PATH,
                    changes: [
                        { slide: 1, items: [{ id: 1, fontSize: 88 }] },
                        { slide: 2, items: [{ id: 3, fontSize: 50 }] },
                    ],
                },
            ]);
            expect(youTexts().at(-1)).toBe('make the words larger');
            const done = lastCue();
            expect(bodyOf(done)).toContain(
                'Done in one change: 2 boxes of “Sermon” have a new font size (40 → 50, 70 → 88).',
            );
            expect(actionLabels(done)).toContain('Undo this change');
            expect(done.textContent).toContain('Show it in the list');
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('a change the app did not make goes on to the assistant, which has the slides', async () => {
            routes.owa_slide_edit = (args) => {
                return args.action === 'slides'
                    ? json(SLIDES_READ)
                    : json({ isChanged: false });
            };
            seedDocumentTab(genFileAttachment(SLIDE_PATH));
            await renderWindow();
            await send('make the words larger');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            await waitForAnswer();
            expect(askedText()).toContain('make the words larger');
            expect(askedText()).toContain(
                '(The slide document "Sermon" is attached. Change it with owa_slide_edit',
            );
            expect(askedText()).toContain(
                'Slides: 2 · each 1920 x 1080 pixels',
            );
            // No assistant could answer: never the guide's steps.
            const answer = lastCue();
            expect(bodyOf(answer)).toContain(NEEDS_ASSISTANT);
            expect(actionLabels(answer)).toContain('Open AI settings');
        });

        test('a slide document that cannot be read is said so to the assistant', async () => {
            routes.owa_slide_edit = () => {
                throw new Error('The editor is closed');
            };
            mocks.askLlmBot.mockResolvedValue({ text: 'I made them larger.' });
            seedDocumentTab(genFileAttachment(SLIDE_PATH));
            await renderWindow();
            await send('make the words larger');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            await waitForAnswer();
            expect(mocks.handleError).toHaveBeenCalled();
            expect(askedText()).toContain(
                '(it could not be read just now; call owa_slide_edit with action "slides")',
            );
            expect(bodyOf(lastCue())).toContain('I made them larger.');
        });
    });

    describe('a whole-note change, done by the window', () => {
        test('the words larger: one size change a block with words', async () => {
            routes.owa_note_edit = (args) => {
                return args.action === 'read'
                    ? json(NOTE_READ)
                    : json({ isChanged: true, undoId: 'undo-9' });
            };
            seedDocumentTab(genNoteAttachment());
            await renderWindow();
            await send('make text bigger');
            await waitForAnswer();
            expect(toolCalls('owa_note_edit')).toEqual([
                { action: 'read', file: NOTE_PATH, id: 3 },
                {
                    action: 'edit',
                    note: 'Sunday Lesson',
                    file: NOTE_PATH,
                    id: 3,
                    hash: 'hash-1',
                    changes: [
                        { block: 1, size: 'larger' },
                        { block: 2, size: 'larger' },
                    ],
                },
            ]);
            const done = lastCue();
            expect(bodyOf(done)).toContain(
                'Done in one change: the words of 2 blocks of “Sunday Lesson” have a new size.',
            );
            expect(actionLabels(done)).toContain('Undo this change');
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('all the text bold: a style on every block, no Undo when the app gave no id', async () => {
            routes.owa_note_edit = (args) => {
                return args.action === 'read'
                    ? json(NOTE_READ)
                    : json({ isChanged: true });
            };
            seedDocumentTab(genNoteAttachment());
            await renderWindow();
            await send('make all the text bold');
            await waitForAnswer();
            expect(toolCalls('owa_note_edit')[1].changes).toEqual([
                { block: 1, styles: ['bold'] },
                { block: 2, styles: ['bold'] },
            ]);
            const done = lastCue();
            expect(bodyOf(done)).toContain(
                'Done in one change: the words of 2 blocks of “Sunday Lesson” have a new style.',
            );
            expect(actionLabels(done)).not.toContain('Undo this change');
        });

        test('a note that cannot be read goes to the assistant, which is told so', async () => {
            routes.owa_note_edit = () => {
                throw new Error('The note window is closed');
            };
            seedDocumentTab(genNoteAttachment());
            await renderWindow();
            await send('make text bigger');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            await waitForAnswer();
            expect(mocks.handleError).toHaveBeenCalled();
            expect(askedText()).toContain(
                '(The Bible note "Sunday Lesson" is attached.',
            );
            expect(askedText()).toContain(
                '(it could not be read just now; call owa_note_edit with action "read")',
            );
            expect(bodyOf(lastCue())).toContain(NEEDS_ASSISTANT);
        });

        // BN-87 (2026-11-11): on a busy computer the note's window took
        // over twenty seconds to open; the read failed, the empty note was
        // taken for one with words, and the lesson went into a NEW note.
        test('an empty note whose window is still opening is read off its file', async () => {
            routes.owa_note_edit = () => {
                throw new Error("The note's window is still opening.");
            };
            files.set(
                NOTE_PATH,
                json({
                    items: [
                        {
                            title: 'Sunday Lesson',
                            content: '',
                            metadata: { id: 3 },
                        },
                    ],
                }),
            );
            seedDocumentTab(genNoteAttachment());
            await renderWindow();
            await send('help me prepare a sermon on John 10');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            await waitForAnswer();
            const extra = mocks.askLlmBot.mock.calls[0][6];
            expect(extra.note.blankBlockCount).toBe(1);
            expect(askedText()).toContain('1. paragraph');
            expect(askedText()).not.toContain('it could not be read just now');
        });
    });

    // BN-77 (2026-11-10): a lesson review offers two or three fixes; one
    // pressed, the others had gone until the review was asked again.
    test('the other fixes of a review stay buttons after one is pressed', async () => {
        routes.owa_note_edit = () => json(NOTE_READ);
        mocks.askLlmBot.mockResolvedValue({
            text: 'I added it under Point 1.',
            replies: ['Make the headings blue'],
        });
        seedDocumentTab(genNoteAttachment(), {
            text: 'A strong lesson. Three things would improve it.',
            replies: [
                'Add a point on the good soil',
                'Write what verse 19 means',
                'Make the response shorter',
            ],
        });
        await renderWindow();
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.cue-reply')!.click();
        });
        await waitFor(
            () => mocks.askLlmBot.mock.calls.length > 0,
            'the assistant',
        );
        await waitForAnswer();
        expect(askedText()).toContain('Add a point on the good soil');
        expect(replyLabels(lastCue())).toEqual([
            'Write what verse 19 means',
            'Make the response shorter',
            'Make the headings blue',
        ]);
    });

    describe('any other question goes to the assistant with the document as it reads now', () => {
        test('a note', async () => {
            routes.owa_note_edit = () => json(NOTE_READ);
            mocks.askLlmBot.mockResolvedValue({
                text: 'I tidied it into a heading and a list.',
            });
            seedDocumentTab(genNoteAttachment());
            await renderWindow();
            await send('tidy it into headings and lists please');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            await waitForAnswer();
            expect(toolCalls('owa_note_edit')).toEqual([
                { action: 'read', file: NOTE_PATH, id: 3 },
            ]);
            expect(askedText()).toContain(
                'tidy it into headings and lists please',
            );
            expect(askedText()).toContain('2. paragraph');
            expect(askedText()).toContain('"By grace you are saved"');
            // The note goes as read, never as the attachment's own words.
            expect(askedText()).not.toContain('Sermons.own');
            expect(bodyOf(lastCue())).toContain(
                'I tidied it into a heading and a list.',
            );
        });

        test('a song', async () => {
            routes.owa_lyric_edit = () =>
                json({
                    title: 'Amazing Grace',
                    key: 'G',
                    parts: [
                        {
                            part: 'Verse 1',
                            lines: ['Amazing grace how sweet the sound'],
                        },
                    ],
                });
            seedDocumentTab(genFileAttachment(SONG_PATH));
            await renderWindow();
            await send('add a bridge about hope');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            await waitForAnswer();
            expect(toolCalls('owa_lyric_edit')).toEqual([
                { action: 'read', file: SONG_PATH },
            ]);
            expect(askedText()).toContain(
                '(The song "Amazing Grace" is attached. Change it with owa_lyric_edit',
            );
            expect(askedText()).toContain(
                '1. Amazing grace how sweet the sound',
            );
            expect(bodyOf(lastCue())).toContain(NEEDS_ASSISTANT);
        });

        test('a song that cannot be read', async () => {
            routes.owa_lyric_edit = () => {
                throw new Error('The song is gone');
            };
            seedDocumentTab(genFileAttachment(SONG_PATH));
            await renderWindow();
            await send('add a bridge about hope');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            expect(askedText()).toContain(
                '(it could not be read just now; call owa_lyric_edit with action "read")',
            );
        });

        test('a presenting flow', async () => {
            routes.owa_presenting_flow_edit = () =>
                json({ count: 0, lines: [], screens: ['Screen 1'] });
            seedDocumentTab(genFileAttachment(FLOW_PATH));
            await renderWindow();
            await send('put the welcome slides first');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            await waitForAnswer();
            expect(toolCalls('owa_presenting_flow_edit')).toEqual([
                { action: 'lines', file: FLOW_PATH },
            ]);
            expect(askedText()).toContain(
                '(The presenting flow "Sunday Service" is attached.',
            );
            expect(askedText()).toContain('Lines: 0 · screens: Screen 1');
            expect(askedText()).toContain('(no lines yet)');
            const answer = lastCue();
            expect(bodyOf(answer)).toContain(NEEDS_ASSISTANT);
            expect(actionLabels(answer)).toContain('Open AI settings');
        });

        test('a presenting flow that cannot be read', async () => {
            routes.owa_presenting_flow_edit = () => {
                throw new Error('The flow is gone');
            };
            seedDocumentTab(genFileAttachment(FLOW_PATH));
            await renderWindow();
            await send('put the welcome slides first');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            expect(askedText()).toContain(
                '(it could not be read just now; call owa_presenting_flow_edit with action "lines")',
            );
        });

        test('a slide document', async () => {
            routes.owa_slide_edit = () => json(SLIDES_READ);
            seedDocumentTab(genFileAttachment(SLIDE_PATH));
            await renderWindow();
            await send('translate the welcome slide into Spanish');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the assistant',
            );
            expect(toolCalls('owa_slide_edit')).toEqual([
                { action: 'slides', file: SLIDE_PATH },
            ]);
            expect(askedText()).toContain(
                'translate the welcome slide into Spanish',
            );
            expect(askedText()).toContain('Slide 1');
        });
    });

    describe('a language installed while the window is open', () => {
        test('loads the window again once nothing is on its way, the tabs saved first', async () => {
            const reload = vi.fn();
            vi.stubGlobal('location', { ...window.location, reload });
            seedDocumentTab(genNoteAttachment());
            await renderWindow();
            expect(langState.changeListeners.size).toBe(1);
            settings.delete(SESSIONS_KEY);
            langState.enabled = [
                { langCode: 'xx', version: '1.0.0', isEnabled: true },
            ];
            act(() => {
                for (const listener of langState.changeListeners) {
                    listener();
                }
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(
                    LANG_RELOAD_DELAY_MILLISECONDS - 1,
                );
            });
            expect(reload).not.toHaveBeenCalled();
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });
            expect(reload).toHaveBeenCalledOnce();
            expect(JSON.parse(settings.get(SESSIONS_KEY)!).activeId).toBe(
                'doc',
            );
        });

        test('the same languages as at load change nothing', async () => {
            const reload = vi.fn();
            vi.stubGlobal('location', { ...window.location, reload });
            await renderWindow();
            act(() => {
                for (const listener of langState.changeListeners) {
                    listener();
                }
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(
                    LANG_RELOAD_DELAY_MILLISECONDS * 2,
                );
            });
            expect(reload).not.toHaveBeenCalled();
        });

        test('an ask started in the wait keeps the window until it ends', async () => {
            const reload = vi.fn();
            vi.stubGlobal('location', { ...window.location, reload });
            let answer: (value: { text: string }) => void = () => {};
            mocks.askLlmBot.mockImplementation(() => {
                return new Promise((resolve) => {
                    answer = resolve;
                });
            });
            await renderWindow();
            langState.enabled = [
                { langCode: 'xx', version: '1.0.0', isEnabled: true },
            ];
            act(() => {
                for (const listener of langState.changeListeners) {
                    listener();
                }
            });
            // Asked before the window goes.
            await send('/btw what is grace?');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the ask',
            );
            await act(async () => {
                await vi.advanceTimersByTimeAsync(
                    LANG_RELOAD_DELAY_MILLISECONDS * 2,
                );
            });
            expect(reload).not.toHaveBeenCalled();
            await act(async () => {
                answer({ text: 'Grace is a gift.' });
            });
            await waitFor(
                () => bodyOf(lastCue()).includes('Grace is a gift.'),
                'the answer',
            );
            await act(async () => {
                await vi.advanceTimersByTimeAsync(
                    LANG_RELOAD_DELAY_MILLISECONDS,
                );
            });
            expect(reload).toHaveBeenCalledOnce();
        });

        test('an ask on its way keeps the window until it ends', async () => {
            const reload = vi.fn();
            vi.stubGlobal('location', { ...window.location, reload });
            let answer: (value: { text: string }) => void = () => {};
            mocks.askLlmBot.mockImplementation(() => {
                return new Promise((resolve) => {
                    answer = resolve;
                });
            });
            await renderWindow();
            await send('/btw what is grace?');
            await waitFor(
                () => mocks.askLlmBot.mock.calls.length > 0,
                'the ask',
            );
            langState.enabled = [
                { langCode: 'xx', version: '1.0.0', isEnabled: true },
            ];
            act(() => {
                for (const listener of langState.changeListeners) {
                    listener();
                }
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(
                    LANG_RELOAD_DELAY_MILLISECONDS * 2,
                );
            });
            expect(reload).not.toHaveBeenCalled();
            await act(async () => {
                answer({ text: 'Grace is a gift.' });
            });
            await waitFor(
                () => bodyOf(lastCue()).includes('Grace is a gift.'),
                'the answer',
            );
            await act(async () => {
                await vi.advanceTimersByTimeAsync(
                    LANG_RELOAD_DELAY_MILLISECONDS,
                );
            });
            expect(reload).toHaveBeenCalledOnce();
        });
    });
});
