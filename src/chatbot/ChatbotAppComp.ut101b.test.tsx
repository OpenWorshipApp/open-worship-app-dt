// @vitest-environment jsdom

// The help window's second half, by what a person does in it: a STUDY
// file's card pressed -- Create, Save changes, Preview, Change the name and
// the name typed after it, Open it -- with the tool host saying yes and no;
// "check my verses" asked of a Bible note and of a study file open in the
// tab, each verse read by the window before the assistant is asked; a
// study translated part by part through the window's own translator; and
// Retry under an answer a paid key wrote, its question carrying a file. The
// tool host, the assistant, the Auto picker and the file reads are
// file-local mocks; the study and check helpers are real.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { settings, listeners, routes, mocks, llmState, replyState } = vi.hoisted(
    () => ({
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
            readWholeTextFile: vi.fn(),
            resolveAutoPicks: vi.fn(),
            listLangBibleBookNames: vi.fn(),
            handleError: vi.fn(),
            openNoteWindow: vi.fn(),
        },
        // The assistants with a key, when a test names them; else the real list
        // (no key set: the free one alone).
        llmState: { available: null as string[] | null },
        // The buttons worked out under an answer: the real ones, unless a test
        // holds them back to press Stop meanwhile.
        replyState: { held: null as Promise<string[]> | null },
    }),
);
// The language a saved study's translation is read as (none, unless a test
// names one) and the church words its package holds; every language file
// the window loads, by code and name (EC-596).
const studyLanguageState = vi.hoisted(() => ({
    code: null as string | null,
    churchWords: null as unknown,
    loads: [] as [string, string][],
}));
// The Resources folders (none, unless a test names one) and the languages a
// study's halves are read as -- the real reading, unless a test names them
// (EC-608): what the languages installed would read a made-up script as is
// not this file's to depend on.
const studyFileState = vi.hoisted(() => ({
    resourceDirs: [] as string[],
    halfLanguages: null as (string | null)[] | null,
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
vi.mock('./llmBotHelpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./llmBotHelpers')>();
    return {
        ...actual,
        askLlmBot: (...args: any[]) => mocks.askLlmBot(...args),
        getAvailableLlmProviders: () => {
            return llmState.available === null
                ? actual.getAvailableLlmProviders()
                : ([...llmState.available] as any);
        },
    };
});
vi.mock('./fileAttachHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./fileAttachHelpers')>()),
    genAttachmentFromPath: (...args: any[]) =>
        mocks.genAttachmentFromPath(...args),
    refreshTextAttachment: (...args: any[]) =>
        mocks.refreshTextAttachment(...args),
    readWholeTextFile: (...args: any[]) => mocks.readWholeTextFile(...args),
}));
vi.mock('./autoAssistantSourceHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./autoAssistantSourceHelpers')>()),
    resolveAutoPicks: (...args: any[]) => mocks.resolveAutoPicks(...args),
}));
vi.mock('./quickReplyHelpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./quickReplyHelpers')>();
    return {
        ...actual,
        genMessageReplies: (...args: [any]) => {
            return replyState.held ?? actual.genMessageReplies(...args);
        },
    };
});
// The language packages' Bible book names are lazy files: none installed.
// A Bible note made from a study's card opens in a window of its own.
vi.mock('../bible-list/note/noteWindowOpenHelpers', () => ({
    openNoteWindow: (...args: any[]) => mocks.openNoteWindow(...args),
}));
vi.mock('../lang/langPackageFileHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../lang/langPackageFileHelpers')
    >()),
    listLangBibleBookNames: () => mocks.listLangBibleBookNames(),
}));
// A translation's language is read off its words by the languages
// installed: a test names it, so none depends on a package being here.
vi.mock('./studyTranslateHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./studyTranslateHelpers')>()),
    readStudyPartsLanguage: () => studyLanguageState.code,
}));
vi.mock('../resources/resourcesFolderHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../resources/resourcesFolderHelpers')
    >()),
    getResourcesFolderList: () => [...studyFileState.resourceDirs],
}));
vi.mock('./studyFileChatHelpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('./studyFileChatHelpers')>();
    return {
        ...actual,
        readStudyHalfLanguages: (
            ...args: Parameters<typeof actual.readStudyHalfLanguages>
        ) => {
            return (
                studyFileState.halfLanguages ??
                actual.readStudyHalfLanguages(...args)
            );
        },
    };
});
vi.mock('../lang/langFileStore', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../lang/langFileStore')>();
    return {
        ...actual,
        loadLangFile: (langCode: string, fileName: string) => {
            studyLanguageState.loads.push([langCode, fileName]);
            return fileName === 'churchWords.json' &&
                studyLanguageState.churchWords !== null
                ? Promise.resolve(studyLanguageState.churchWords)
                : actual.loadLangFile(langCode, fileName);
        },
    };
});

import ChatbotAppComp from './ChatbotAppComp';
import { getLlmModelLabel, getLlmProviderLabel } from './llmBotHelpers';
import {
    STUDY_DRAFT_GONE_TEXT,
    genStudyDraftActions,
    keepDraftedStudy,
    readDraftedStudy,
} from './studyFileChatHelpers';
import { STUDY_CHECK_READ_MAX_CHARS } from './studyVerseCheckHelpers';

// Captured before any test fakes the clock: a real turn of the event loop
// and the real time, for the lazy chunks (the question corpus) from disk.
const realSetTimeout = globalThis.setTimeout;
const realNow = performance.now.bind(performance);
const originalScrollIntoView = Element.prototype.scrollIntoView;

const SESSIONS_KEY = 'chatbot-sessions';
const STUDY_PATH = '/resources/Default/Love.md';
const NOTE_PATH = '/notes/Sermons.own';
const PREVIEW_FAILED = 'The preview could not be opened.';

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

const STUDY_CONTENT = [
    '# Love',
    '',
    'God so loved the world: Romans 5:8 says the same.',
    '',
    '```mermaid',
    'flowchart TD',
    '    A[Love] --> B[Gift]',
    '```',
].join('\n');

// A new study as the tool drafted it, held by the window as an answer's
// card holds it. `nameTaken`: the name Resources already had, so the
// draft took the next free one there.
function keepNewStudy(
    bible: string | null = 'KJV',
    nameTaken: string | null = null,
) {
    const drafted = readDraftedStudy(
        json({
            drafted: true,
            content: STUDY_CONTENT,
            name: nameTaken === null ? 'Love.md' : 'Love (1).md',
            ...(nameTaken === null ? {} : { nameTaken }),
            passage: 'John 3:16',
            bible: bible ?? '',
            diagramCount: 1,
        }),
        {
            ref: 'John 3:16',
            title: 'Love',
            content: STUDY_CONTENT,
            ...(bible === null ? {} : { bible }),
        },
    );
    return keepDraftedStudy(drafted!);
}

// A drafted CHANGE to the study open in the tab.
function keepStudyChange() {
    const drafted = readDraftedStudy(
        json({
            drafted: true,
            isChange: true,
            file: 'Default/Love.md',
            hash: 'hash-1',
            content: `${STUDY_CONTENT}\n\n## Prayer\n\nThank you.`,
            name: 'Love.md',
            passage: 'John 3:16',
            bible: 'KJV',
            diagramCount: 1,
            change: 'append',
        }),
        {},
    );
    return keepDraftedStudy(drafted!);
}

// A tab whose last answer is a study's card.
function seedStudyCard(actions: any[]) {
    seedSessions([
        genSession('study', [
            { id: 1, author: 'you', text: 'Make a study of John 3:16' },
            {
                id: 2,
                author: 'bot',
                text: 'Here is the study. Press Create to save it.',
                actions,
            },
        ]),
    ]);
}

describe('ChatbotAppComp: study cards, verse checks, the translator and Retry', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.useFakeTimers();
        settings.clear();
        listeners.clear();
        llmState.available = null;
        replyState.held = null;
        studyLanguageState.code = null;
        studyLanguageState.churchWords = null;
        studyLanguageState.loads = [];
        studyFileState.resourceDirs = [];
        studyFileState.halfLanguages = null;
        for (const key of Object.keys(routes)) {
            delete routes[key];
        }
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        // jsdom lays nothing out: the tab strip and the suggestion list
        // scroll their row into view, which it does not implement.
        Element.prototype.scrollIntoView = () => {};
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
            async (filePath: string) => {
                return { attachment: genFileAttachment(filePath) };
            },
        );
        mocks.refreshTextAttachment.mockImplementation(
            async (attachment: any) => {
                return attachment;
            },
        );
        mocks.readWholeTextFile.mockResolvedValue(null);
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

    // What a message SAYS: its lines, without the card, chips and buttons
    // drawn under them.
    function saidOf(cue: Element | undefined) {
        return Array.from(
            cue?.querySelectorAll(
                '.cue-body > .chatbot-line, .cue-body > .cue-said > .chatbot-line',
            ) ?? [],
        )
            .map((line) => line.textContent ?? '')
            .join('\n');
    }

    function actLabels(cue: Element | undefined) {
        return Array.from(cue?.querySelectorAll('.cue-act') ?? []).map(
            (button) => button.textContent?.trim() ?? '',
        );
    }

    // A button under an answer, by its words.
    function actButton(label: string, cue: Element | undefined = lastCue()) {
        return Array.from(
            cue?.querySelectorAll<HTMLButtonElement>('.cue-act') ?? [],
        ).find((button) => button.textContent?.trim() === label);
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

    function boxChipNames() {
        return queryAll('.chat-ask .chat-clip .chat-clip-name').map(
            (element) => element.textContent ?? '',
        );
    }

    function toolCalls(name: string) {
        return mocks.callTool.mock.calls
            .filter((call) => call[0] === name)
            .map((call) => call[1]);
    }

    function askedText(index = 0) {
        return String(mocks.askLlmBot.mock.calls[index]?.[0] ?? '');
    }

    async function waitForAsked(count = 1) {
        await waitFor(
            () => mocks.askLlmBot.mock.calls.length >= count,
            'the assistant',
        );
    }

    describe('a new study’s card', () => {
        test('Create saves it, attaches it to the tab quietly, and offers Open it and Undo', async () => {
            const previewUrl =
                'https://localhost:3000/markdownPreview.html?preview-file=' +
                `${encodeURIComponent(STUDY_PATH)}&uuid=preview`;
            mocks.electronSendAsync.mockImplementation(
                async (channel: string) => {
                    return channel === 'main:app:list-app-windows'
                        ? [
                              {
                                  id: 'main-window',
                                  title: 'Open Worship app - Presenter',
                                  url: 'https://localhost:3000/presenter.html',
                              },
                              {
                                  id: 'md-window',
                                  title:
                                      'Open Worship app - Markdown Preview' +
                                      ' - Love.md',
                                  url: previewUrl,
                              },
                          ]
                        : null;
                },
            );
            const kept = keepNewStudy();
            const save = defer();
            routes.owa_resource_file = (args) => {
                return args.action === 'save'
                    ? save.promise
                    : json({ previewed: STUDY_PATH });
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            // The card shows what it would save, under its buttons: where
            // it is kept is the person's choice (EC-509).
            expect(query<HTMLTextAreaElement>('.cue-study-text')?.value).toBe(
                STUDY_CONTENT,
            );
            expect(actLabels(lastCue())).toEqual([
                // A Bible note or a Markdown file, as they choose (EC-581).
                'New Bible Note',
                'Create "Love.md" in Resources',
                'Create "Love.md" in Bible Notes',
                'Preview',
                'Change the name',
            ]);
            // The main window picked by hand: the tab works there until a
            // file is handed over again.
            const windowPick = () => {
                return query<HTMLSelectElement>(
                    'select[aria-label="Which window"]',
                );
            };
            await waitFor(() => windowPick() !== null, 'the window line');
            await act(async () => {
                const setter = Object.getOwnPropertyDescriptor(
                    HTMLSelectElement.prototype,
                    'value',
                )!.set!;
                setter.call(windowPick(), 'main-window');
                windowPick()!.dispatchEvent(
                    new Event('change', { bubbles: true }),
                );
            });
            await settle();
            expect(windowPick()?.value).toBe('main-window');
            await click(actButton('Create "Love.md" in Resources'));
            // Busy while it is written, and nothing said yet.
            expect(query('.chat-tab-busy')).not.toBeNull();
            expect(toolCalls('owa_resource_file')).toEqual([
                {
                    action: 'save',
                    name: 'Love.md',
                    content: STUDY_CONTENT,
                    to: 'resources',
                },
            ]);
            await act(async () => {
                save.resolve(
                    json({
                        filePath: STUDY_PATH,
                        created: 'Love.md',
                        file: 'Default/Love.md',
                        undoId: 'undo-7',
                    }),
                );
            });
            await settle();
            expect(query('.chat-tab-busy')).toBeNull();
            expect(mocks.genAttachmentFromPath).toHaveBeenCalledWith(
                STUDY_PATH,
                null,
            );
            expect(boxChipNames()).toEqual(['Love.md']);
            const saved = lastCue();
            expect(saidOf(saved)).toBe(
                'Saved as "Love.md" in Resources → Default. It is attached to this chat: ask me about it, or ask me to change it.',
            );
            // Quiet: no Resources opening card under the save.
            expect(cues()).toHaveLength(3);
            expect(actLabels(saved)).toEqual(['Open it', 'Undo this change']);
            expect(
                Array.from(saved.querySelectorAll('.chat-clip-name')).map(
                    (element) => element.textContent,
                ),
            ).toEqual(['Love.md']);
            // The file handed over works in its own window again.
            await waitFor(
                () => windowPick()?.value === 'md-window',
                'the preview window on the window line',
            );
            await click(actButton('Open it'));
            expect(toolCalls('owa_resource_file').at(-1)).toEqual({
                action: 'preview',
                file: 'Default/Love.md',
            });
            expect(cues()).toHaveLength(3);
        });

        test('Open it that fails says the preview could not be opened', async () => {
            routes.owa_resource_file = () => {
                throw new Error('The preview window is gone');
            };
            seedStudyCard([
                {
                    label: 'Open it',
                    toolName: 'owa-study-preview',
                    args: { file: 'Default/Love.md' },
                },
            ]);
            await renderWindow();
            await click(actButton('Open it'));
            expect(mocks.handleError).toHaveBeenCalled();
            expect(saidOf(lastCue())).toBe(PREVIEW_FAILED);
        });

        test('Create with no undo the tool gave offers Open it alone', async () => {
            const kept = keepNewStudy();
            routes.owa_resource_file = () => {
                return json({ filePath: STUDY_PATH, file: 'Default/Love.md' });
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('Create "Love.md" in Resources'));
            expect(bodyOf(lastCue())).toContain('Saved as "Love.md"');
            expect(actLabels(lastCue())).toEqual(['Open it']);
        });

        test('Create the tool host fails says to draft it again', async () => {
            const kept = keepNewStudy();
            routes.owa_resource_file = () => {
                throw new Error('The disk is full');
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('Create "Love.md" in Resources'));
            expect(mocks.handleError).toHaveBeenCalled();
            expect(saidOf(lastCue())).toBe(
                'The study file could not be saved. Ask me to draft it again.',
            );
            expect(mocks.genAttachmentFromPath).not.toHaveBeenCalled();
            expect(boxChipNames()).toEqual([]);
        });

        // EC-509: kept in the Bible Notes list instead, where it stays the
        // chat's to read and change.
        test('Create in Bible Notes saves it there, says so, and opens it from there', async () => {
            const notesPath = '/notes/Love.md';
            const kept = keepNewStudy();
            routes.owa_resource_file = (args) => {
                return args.action === 'save'
                    ? json({
                          filePath: notesPath,
                          created: 'Love.md',
                          file: 'Bible Notes/Love.md',
                          place: 'bible-notes',
                          undoId: 'undo-8',
                      })
                    : json({ previewed: notesPath });
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('Create "Love.md" in Bible Notes'));
            expect(toolCalls('owa_resource_file')).toEqual([
                {
                    action: 'save',
                    name: 'Love.md',
                    content: STUDY_CONTENT,
                    to: 'bible-notes',
                },
            ]);
            expect(mocks.genAttachmentFromPath).toHaveBeenCalledWith(
                notesPath,
                null,
            );
            const saved = lastCue();
            expect(saidOf(saved)).toBe(
                'Saved as "Love.md" in Bible Notes. It is attached to this chat: ask me about it, or ask me to change it.',
            );
            expect(actLabels(saved)).toEqual(['Open it', 'Undo this change']);
            await click(actButton('Open it'));
            expect(toolCalls('owa_resource_file').at(-1)).toEqual({
                action: 'preview',
                file: 'Bible Notes/Love.md',
            });
        });

        test('Bible Notes is asked for the drafted name, not the one Resources had free', async () => {
            const kept = keepNewStudy('KJV', 'Love.md');
            routes.owa_resource_file = () => {
                return json({
                    filePath: '/notes/Love.md',
                    created: 'Love.md',
                    file: 'Bible Notes/Love.md',
                });
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            expect(actLabels(lastCue()).slice(1, 3)).toEqual([
                'Create "Love (1).md" in Resources',
                'Create "Love.md" in Bible Notes',
            ]);
            await click(actButton('Create "Love.md" in Bible Notes'));
            expect(toolCalls('owa_resource_file')).toEqual([
                {
                    action: 'save',
                    name: 'Love.md',
                    content: STUDY_CONTENT,
                    to: 'bible-notes',
                },
            ]);
        });

        test('a card saved before the choice still creates in Resources', async () => {
            const kept = keepNewStudy();
            routes.owa_resource_file = () => {
                return json({
                    filePath: STUDY_PATH,
                    created: 'Love.md',
                    file: 'Default/Love.md',
                });
            };
            seedStudyCard([
                {
                    label: 'Create "Love.md"',
                    toolName: 'owa-study-create',
                    args: { reference: kept.reference },
                },
            ]);
            await renderWindow();
            await click(actButton('Create "Love.md"'));
            expect(toolCalls('owa_resource_file')).toEqual([
                {
                    action: 'save',
                    name: 'Love.md',
                    content: STUDY_CONTENT,
                    to: 'resources',
                },
            ]);
            expect(saidOf(lastCue())).toContain('in Resources → Default.');
        });

        test('Preview opens the held copy, and says so when it cannot', async () => {
            const kept = keepNewStudy();
            const answers: (string | Error)[] = [
                json({ previewed: '/tmp/Love.md' }),
                'No window',
                new Error('The tool host went away'),
            ];
            routes.owa_resource_file = () => {
                const next = answers.shift();
                if (next instanceof Error) {
                    throw next;
                }
                return next;
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('Preview'));
            expect(toolCalls('owa_resource_file')).toEqual([
                { action: 'preview', name: 'Love.md', content: STUDY_CONTENT },
            ]);
            // Opened: nothing said.
            expect(cues()).toHaveLength(2);
            await click(actButton('Preview'));
            expect(saidOf(lastCue())).toBe(PREVIEW_FAILED);
            expect(mocks.handleError).not.toHaveBeenCalled();
            // A tool host that fails: the same sentence, the error kept.
            await click(actButton('Preview', cues()[1]));
            expect(mocks.handleError).toHaveBeenCalledTimes(1);
            expect(cues().map(saidOf).slice(2)).toEqual([
                PREVIEW_FAILED,
                PREVIEW_FAILED,
            ]);
        });

        test('a card whose draft is no longer held says to ask again', async () => {
            seedStudyCard([
                {
                    label: 'Create "Gone.md"',
                    toolName: 'owa-study-create',
                    args: { reference: 'study-not-held' },
                },
            ]);
            await renderWindow();
            // Nothing held: the card draws no study.
            expect(query('.cue-study')).toBeNull();
            await click(actButton('Create "Gone.md"'));
            expect(saidOf(lastCue())).toBe(STUDY_DRAFT_GONE_TEXT);
            expect(mocks.callTool).not.toHaveBeenCalled();
        });

        // EC-581, the user: _whenever creating bible-note or resource study
        // file should always let user choose between bible-note or markdown
        // file_.
        function genMadeNoteAttachment(name: string) {
            return {
                id: 'note-4',
                kind: 'text',
                name,
                mimeType: 'text/plain',
                byteSize: 20,
                summary: name,
                filePath: NOTE_PATH,
                noteId: 4,
            };
        }

        function findSaid(words: string) {
            return cues().find((cue) => saidOf(cue).includes(words));
        }

        test('New Bible Note makes the study a Bible note, opens and attaches it, and says its diagrams were left out', async () => {
            const kept = keepNewStudy();
            routes.owa_bible_note = () => {
                return json({
                    file: 'Sermons',
                    added: 'Love',
                    id: 4,
                    filePath: NOTE_PATH,
                    undoId: 'undo-4',
                });
            };
            mocks.genAttachmentFromPath.mockResolvedValue({
                attachment: genMadeNoteAttachment('Love'),
            });
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('New Bible Note'));
            // Its passage first, its words kept, its diagram left out -- and
            // no study file made.
            expect(toolCalls('owa_bible_note')).toEqual([
                {
                    action: 'add',
                    title: 'Love',
                    text:
                        '[^(KJV) John 3:16]\n\n' +
                        'God so loved the world: Romans 5:8 says the same.',
                },
            ]);
            expect(toolCalls('owa_resource_file')).toEqual([]);
            await waitFor(
                () => mocks.openNoteWindow.mock.calls.length > 0,
                'the note window',
            );
            expect(mocks.openNoteWindow).toHaveBeenCalledWith(
                'Sermons.own',
                NOTE_PATH,
                4,
            );
            await waitFor(
                () => boxChipNames().includes('Love'),
                'the note attached',
            );
            const made = findSaid('Saved as "Love" in Bible Notes');
            expect(saidOf(made)).toBe(
                'Saved as "Love" in Bible Notes, without its diagrams: a ' +
                    'Bible note does not draw them. It is attached to this ' +
                    'chat: ask me about it, or ask me to change it.',
            );
            expect(actLabels(made)).toContain('Undo this change');
        });

        test('New Bible Note makes the note the model wrote, in its own file, when the card holds one', async () => {
            const kept = keepDraftedStudy({
                ...keepNewStudy(),
                note: {
                    title: 'Grace',
                    text: 'Saved by grace [^Ephesians 2:8].',
                    file: 'Sermons',
                },
            });
            routes.owa_bible_note = () => {
                return json({
                    added: 'Grace',
                    id: 4,
                    filePath: NOTE_PATH,
                    undoId: 'undo-4',
                });
            };
            mocks.genAttachmentFromPath.mockResolvedValue({
                attachment: genMadeNoteAttachment('Grace'),
            });
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('New Bible Note'));
            expect(toolCalls('owa_bible_note')).toEqual([
                {
                    action: 'add',
                    title: 'Grace',
                    text: 'Saved by grace [^Ephesians 2:8].',
                    file: 'Sermons',
                },
            ]);
            await waitFor(
                () => mocks.openNoteWindow.mock.calls.length > 0,
                'the note window',
            );
            expect(saidOf(findSaid('Saved as "Grace"'))).toBe(
                'Saved as "Grace" in Bible Notes. It is attached to this ' +
                    'chat: ask me about it, or ask me to change it.',
            );
        });

        test('a Bible note the tool would not make is said so, and nothing is opened', async () => {
            const kept = keepNewStudy();
            routes.owa_bible_note = () => {
                return 'Tool refused: no Bible Notes folder';
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('New Bible Note'));
            expect(saidOf(lastCue())).toBe(
                'The Bible note could not be made. Ask me to write it again.',
            );
            expect(mocks.openNoteWindow).not.toHaveBeenCalled();
            expect(boxChipNames()).toEqual([]);
        });
    });

    // EC-581, the user: _if user click and choose step by step explicitely
    // it should skip the confirmation_ -- a click, not typed words.
    describe('a Bible note or a Markdown file pressed for', () => {
        test('a pressed option names the kind to the assistant; the same words typed do not', async () => {
            mocks.askLlmBot.mockResolvedValue({ text: 'It is ready.' });
            seedSessions([
                genSession('front', [
                    {
                        id: 1,
                        author: 'you',
                        text: 'Write a lesson on John 3:16.',
                    },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Shall I keep it as a Bible note or a Markdown file?',
                        replies: ['Make a Bible note', 'Make a Markdown file'],
                    },
                ]),
            ]);
            await renderWindow();
            await click(
                queryAll<HTMLButtonElement>('.cue-reply').find((button) => {
                    return (
                        button.textContent?.trim() === 'Make a Markdown file'
                    );
                }),
            );
            await waitForAsked();
            expect(askedText(0)).toContain('Make a Markdown file');
            expect(mocks.askLlmBot.mock.calls[0][6]?.createKind).toBe(
                'markdown',
            );
            await send('Make a Bible note');
            await waitForAsked(2);
            expect(askedText(1)).toContain('Make a Bible note');
            expect(mocks.askLlmBot.mock.calls[1][6]).not.toHaveProperty(
                'createKind',
            );
        });
    });

    describe('Change the name', () => {
        test('the name typed next drafts it again under that name, with no model', async () => {
            const kept = keepNewStudy();
            routes.owa_resource_file = () => {
                return json({
                    drafted: true,
                    content: STUDY_CONTENT.replace('# Love', '# Grace'),
                    name: 'Grace Study.md',
                    passage: 'John 3:16',
                    bible: 'KJV',
                    diagramCount: 1,
                });
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('Change the name'));
            expect(saidOf(lastCue())).toBe(
                'Type the new name for the study file, then press Send.',
            );
            expect(document.activeElement).toBe(inputBox());
            await send('Grace Study');
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
            expect(toolCalls('owa_resource_file')).toEqual([
                {
                    action: 'draft',
                    ref: 'John 3:16',
                    title: 'Grace Study',
                    content: STUDY_CONTENT,
                    bible: 'KJV',
                },
            ]);
            const list = cues();
            expect(saidOf(list[list.length - 2])).toBe('Grace Study');
            const card = lastCue();
            expect(saidOf(card)).toBe(
                'It will be saved as "Grace Study.md". Press Create to save it.',
            );
            // The new name is no question: asked again under a Retry, it
            // would go to a model as one (EC-506).
            expect(card.querySelector('.cue-retry')).toBeNull();
            expect(actLabels(card)).toEqual([
                'New Bible Note',
                'Create "Grace Study.md" in Resources',
                'Create "Grace Study.md" in Bible Notes',
                'Preview',
                'Change the name',
            ]);
            // The held words keep their diagrams; only the title line moved.
            expect(
                card.querySelector<HTMLTextAreaElement>('.cue-study-text')
                    ?.value,
            ).toBe(STUDY_CONTENT.replace('# Love', '# Grace Study'));
            expect(inputBox().value).toBe('');
        });

        test('a name the tool refuses keeps the card’s buttons and says to type another', async () => {
            const kept = keepNewStudy(null);
            routes.owa_resource_file = () => {
                return 'A file name cannot hold a slash.';
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('Change the name'));
            await send('Love: part one');
            // No Bible named on the draft: none named on the call.
            expect(toolCalls('owa_resource_file')).toEqual([
                {
                    action: 'draft',
                    ref: 'John 3:16',
                    title: 'Love: part one',
                    content: STUDY_CONTENT,
                },
            ]);
            const card = lastCue();
            expect(saidOf(card)).toBe(
                'That name cannot be used for a file. Press Change the name and type another, in plain words.',
            );
            expect(actLabels(card)).toEqual([
                'New Bible Note',
                'Create "Love.md" in Resources',
                'Create "Love.md" in Bible Notes',
                'Preview',
                'Change the name',
            ]);
        });

        test('a tool host that fails reads as a name that cannot be used', async () => {
            const kept = keepNewStudy();
            routes.owa_resource_file = () => {
                throw new Error('The tool host went away');
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('Change the name'));
            await send('Another name');
            expect(mocks.handleError).toHaveBeenCalled();
            expect(bodyOf(lastCue())).toContain(
                'That name cannot be used for a file.',
            );
        });

        test('a draft let go of while the name was typed says to ask again', async () => {
            const kept = keepNewStudy();
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('Change the name'));
            // Three newer drafts: the window holds three at most.
            keepNewStudy();
            keepNewStudy();
            keepNewStudy();
            await send('Grace Study');
            expect(mocks.callTool).not.toHaveBeenCalled();
            expect(saidOf(lastCue())).toBe(STUDY_DRAFT_GONE_TEXT);
        });
    });

    describe('a drafted change’s card', () => {
        test('Save changes writes it against the hash it was drafted from, and attaches nothing', async () => {
            const kept = keepStudyChange();
            routes.owa_resource_file = () => {
                return json({
                    filePath: STUDY_PATH,
                    changed: 'Love.md',
                    file: 'Default/Love.md',
                    undoId: 'undo-8',
                });
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            expect(actLabels(lastCue())).toEqual([
                'Save changes to "Love.md"',
                'Preview',
            ]);
            await click(actButton('Save changes to "Love.md"'));
            expect(toolCalls('owa_resource_file')).toEqual([
                {
                    action: 'save',
                    file: 'Default/Love.md',
                    hash: 'hash-1',
                    content: `${STUDY_CONTENT}\n\n## Prayer\n\nThank you.`,
                },
            ]);
            expect(saidOf(lastCue())).toBe(
                'Saved the changes to "Love.md". Undo this change puts it back.',
            );
            expect(actLabels(lastCue())).toEqual([
                'Open it',
                'Undo this change',
            ]);
            expect(mocks.genAttachmentFromPath).not.toHaveBeenCalled();
        });

        test('a change the file has moved on from says to ask for it again', async () => {
            const kept = keepStudyChange();
            routes.owa_resource_file = () => {
                return 'The file has changed since it was read.';
            };
            seedStudyCard(genStudyDraftActions(kept));
            await renderWindow();
            await click(actButton('Save changes to "Love.md"'));
            expect(saidOf(lastCue())).toBe(
                'The changes could not be saved: the file may have changed since. Ask me to make the change again.',
            );
        });
    });

    describe('"check my verses", read by the window first', () => {
        const NOTE_READ = {
            file: 'Sermons',
            hash: 'hash-1',
            blockCount: 2,
            blocks: [
                { n: 1, kind: 'heading', text: 'Love' },
                {
                    n: 2,
                    kind: 'paragraph',
                    text: 'God so loved the world [^(KJV) John 3:16] and [^Romans 5:8].',
                },
            ],
        };

        test('a note: each verse it cites, from the Bible its token names, beside what the note says', async () => {
            routes.owa_note_edit = () => json(NOTE_READ);
            routes.owa_find_verse = (args) => {
                if (args.bible === 'KJV') {
                    return json({
                        bible: 'KJV',
                        verses: [
                            {
                                ref: 'John 3:16',
                                text: 'For God so loved the world',
                            },
                        ],
                    });
                }
                throw new Error('The Lookup has no Bible open');
            };
            mocks.askLlmBot.mockResolvedValue({ text: 'Both are right.' });
            seedSessions([
                genSession('note', [
                    {
                        id: 1,
                        author: 'you',
                        text: 'About this',
                        attachments: [
                            genFileAttachment(NOTE_PATH, {
                                name: 'Sunday Lesson',
                                noteId: 3,
                            }),
                        ],
                    },
                    { id: 2, author: 'bot', text: 'It is attached.' },
                ]),
            ]);
            await renderWindow();
            await send('Please check my verses');
            await waitForAsked();
            expect(toolCalls('owa_find_verse')).toEqual([
                { refs: 'John 3:16', bible: 'KJV' },
                { refs: 'Romans 5:8' },
            ]);
            const asked = askedText();
            expect(asked).toContain('(This asks to check the verses.');
            expect(asked).toContain(
                '- (KJV) John 3:16\n' +
                    '  the note says: "God so loved the world John 3:16 and Romans 5:8."\n' +
                    '  the Bible says: "For God so loved the world"',
            );
            // The verse whose read failed is not claimed as read.
            expect(asked).not.toContain('- Romans 5:8');
            await waitFor(
                () => bodyOf(lastCue()).includes('Both are right.'),
                'the answer',
            );
        });

        describe('a study file open in the tab', () => {
            const STUDY_TEXT = [
                '# Love',
                '',
                '> **John 3:16** (KJV)',
                '> 16 For God so loved the world',
                '',
                '## Cross References',
                '',
                '- Romans 5:8 shows the love.',
            ].join('\n');
            const BOOKS = {
                kind: 'books',
                bookKeys: ['GEN', 'JHN', 'ROM'],
                english: ['Genesis', 'John', 'Romans'],
                bibles: [
                    {
                        keys: ['KJV'],
                        locale: 'en',
                        books: ['Genesis', 'John', 'Romans'],
                    },
                ],
            };
            const ASK = 'Are the cross references in this study file right?';

            function seedStudyTab() {
                seedSessions([
                    genSession('study', [
                        {
                            id: 1,
                            author: 'you',
                            text: 'About this',
                            attachments: [genFileAttachment(STUDY_PATH)],
                        },
                        { id: 2, author: 'bot', text: 'It is attached.' },
                    ]),
                ]);
            }

            test('reads the whole file, the Bibles’ book names and each reference before asking', async () => {
                mocks.readWholeTextFile.mockResolvedValue(STUDY_TEXT);
                routes.owa_bible_suggest = () => json(BOOKS);
                routes.owa_find_verse = () => {
                    return json({
                        bible: 'KJV',
                        verses: [
                            {
                                key: 'ROM 5:8',
                                ref: 'Romans 5:8',
                                text: 'But God commendeth his love toward us',
                            },
                        ],
                    });
                };
                mocks.askLlmBot.mockResolvedValue({ text: 'It is right.' });
                seedStudyTab();
                await renderWindow();
                await send(ASK);
                await waitForAsked();
                expect(mocks.readWholeTextFile).toHaveBeenCalledWith(
                    STUDY_PATH,
                    STUDY_CHECK_READ_MAX_CHARS,
                );
                expect(toolCalls('owa_bible_suggest')).toContainEqual({
                    kind: 'books',
                    prefix: '',
                });
                expect(toolCalls('owa_find_verse')).toEqual([
                    { refs: 'Romans 5:8', bible: 'KJV' },
                ]);
                const asked = askedText();
                expect(asked.startsWith(ASK)).toBe(true);
                expect(asked).toContain(
                    '(This asks to check the Bible references the study file cites.',
                );
                expect(asked).toContain(
                    '- "Romans 5:8": KJV reads: "But God commendeth his love toward us"',
                );
            });

            test('a reference the app could not read is said as unread', async () => {
                mocks.readWholeTextFile.mockResolvedValue(STUDY_TEXT);
                routes.owa_bible_suggest = () => json(BOOKS);
                routes.owa_find_verse = () => {
                    throw new Error('The Bible is away');
                };
                mocks.askLlmBot.mockResolvedValue({ text: 'It is right.' });
                seedStudyTab();
                await renderWindow();
                await send(ASK);
                await waitForAsked();
                expect(askedText()).toContain(
                    '- "Romans 5:8": The app could not read it from KJV.',
                );
            });

            test('a file or names it cannot read, or a tool host that fails, leave the question as asked', async () => {
                const outcomes: (() => void)[] = [
                    // The file cannot be read whole.
                    () => {
                        mocks.readWholeTextFile.mockResolvedValue(null);
                        routes.owa_bible_suggest = () => json(BOOKS);
                    },
                    // No book names to read references by.
                    () => {
                        mocks.readWholeTextFile.mockResolvedValue(STUDY_TEXT);
                        routes.owa_bible_suggest = () => {
                            return json({ kind: 'books', english: [] });
                        };
                    },
                    // The tool host fails to answer for the names.
                    () => {
                        mocks.readWholeTextFile.mockResolvedValue(STUDY_TEXT);
                        routes.owa_bible_suggest = () => {
                            throw new Error('The tool host went away');
                        };
                    },
                ];
                mocks.askLlmBot.mockResolvedValue({ text: 'Read them.' });
                seedStudyTab();
                await renderWindow();
                for (const [index, outcome] of outcomes.entries()) {
                    outcome();
                    await send(ASK);
                    await waitForAsked(index + 1);
                    await waitFor(
                        () => query('.chat-tab-busy') === null,
                        'the answer',
                    );
                    expect(askedText(index)).not.toContain(
                        'This asks to check the Bible references',
                    );
                }
                expect(mocks.readWholeTextFile).toHaveBeenCalledTimes(3);
                // The names asked for only once the file was read.
                expect(
                    toolCalls('owa_bible_suggest').filter((args) => {
                        return args.kind === 'books';
                    }),
                ).toHaveLength(2);
                expect(toolCalls('owa_find_verse')).toEqual([]);
            });
        });
    });

    describe('a saved study’s translation, its words read against the Bible it quotes', () => {
        // A made-up language in one Unicode block whose vowels are signs on
        // its letters, made by code point: no word of any language.
        function letter(index: number) {
            return String.fromCodePoint(0x1000 + index);
        }
        const VOWEL_I = String.fromCodePoint(0x102d);
        const VOWEL_II = String.fromCodePoint(0x102e);
        const VOWEL_U = String.fromCodePoint(0x102f);
        const ZENON = `${letter(0)}${VOWEL_I}${letter(1)}${letter(2)}${VOWEL_U}`;
        const ZENON_SLIP = `${letter(0)}${VOWEL_II}${letter(1)}${letter(2)}${VOWEL_U}`;
        const QALIM = `${letter(3)}${VOWEL_U}${letter(4)}${letter(5)}${VOWEL_I}`;
        const WORD = `${letter(12)}${letter(13)}`;
        const NAME_ASK = 'Are the names in the second half spelled right?';
        const CHECK_INTRO = '(About the study file "Love.md".';
        const SLIP_LINE = `- "${ZENON_SLIP}", written 2 times: verse 23 writes "${ZENON}".`;

        // The study, and under it a translation quoting its own Bible and
        // writing a name of the verse as `zenon`.
        function genTranslatedStudy(zenon: string) {
            return [
                '# Love',
                '',
                '> **John 3:23** (KJV)',
                '>',
                '> **23** And John also was baptizing in Zenon near to Qalim.',
                '',
                '## Places',
                '',
                'They baptized at Zenon near Qalim. Romans 5:8 shows the love.',
                '',
                '---',
                '',
                `# ${WORD}`,
                '',
                `> **${WORD} 3:23** (ZB)`,
                '>',
                `> **23** ${WORD} ${ZENON} ${WORD} ${QALIM}.`,
                '',
                `## ${WORD}`,
                '',
                `${WORD} ${zenon} ${QALIM}, ${WORD} ${zenon}.`,
            ].join('\n');
        }

        function seedStudyTab() {
            seedSessions([
                genSession('study', [
                    {
                        id: 1,
                        author: 'you',
                        text: 'About this',
                        attachments: [genFileAttachment(STUDY_PATH)],
                    },
                    { id: 2, author: 'bot', text: 'It is attached.' },
                ]),
            ]);
        }

        test('any question about the file carries each such word, how often and its verse, with no call for them', async () => {
            mocks.readWholeTextFile.mockResolvedValue(
                genTranslatedStudy(ZENON_SLIP),
            );
            mocks.askLlmBot.mockResolvedValue({ text: 'One is not.' });
            seedStudyTab();
            await renderWindow();
            await send(NAME_ASK);
            await waitForAsked();
            expect(mocks.readWholeTextFile).toHaveBeenCalledTimes(1);
            expect(mocks.callTool).not.toHaveBeenCalled();
            const asked = askedText();
            expect(asked.startsWith(NAME_ASK)).toBe(true);
            expect(asked).toContain(CHECK_INTRO);
            expect(asked).toContain(
                `The translation "${WORD}", quoting ${WORD} 3:23 (ZB):\n` +
                    'Words of its verses -- the names the passages give, ' +
                    'and the rest -- its own words write with the vowel ' +
                    'signs of one letter otherwise than that Bible writes ' +
                    'them, a difference too small to see in the file:\n' +
                    SLIP_LINE,
            );
            // Read for what else it left too (EC-559): here, nothing.
            expect(asked).not.toContain('Letters of another script');
            expect(asked).not.toContain('English words left');
            expect(asked).not.toContain('check the Bible references');
            await waitFor(
                () => bodyOf(lastCue()).includes('One is not.'),
                'the answer',
            );
        });

        test('nothing is said of a translation that writes them as its Bible does', async () => {
            mocks.readWholeTextFile.mockResolvedValue(
                genTranslatedStudy(ZENON),
            );
            mocks.askLlmBot.mockResolvedValue({ text: 'They are.' });
            seedStudyTab();
            await renderWindow();
            await send(NAME_ASK);
            await waitForAsked();
            expect(mocks.readWholeTextFile).toHaveBeenCalledTimes(1);
            expect(askedText().startsWith(NAME_ASK)).toBe(true);
            expect(askedText()).not.toContain(CHECK_INTRO);
            expect(askedText()).not.toContain(ZENON);
        });

        test('a heading its language writes as a church word is named, the church words read for the one question (EC-596)', async () => {
            const CROSS = `${letter(20)}${letter(21)}${VOWEL_I}`;
            const SPIRIT = `${letter(22)}${letter(23)}`;
            const LIFE = `${letter(24)}${VOWEL_U}${letter(25)}`;
            const OTHER = `${letter(6)}${letter(7)}${letter(8)}`;
            mocks.readWholeTextFile.mockResolvedValue(
                [
                    '# Love',
                    '',
                    '## Cross References',
                    '',
                    'The Holy Spirit gives eternal life.',
                    '',
                    '---',
                    '',
                    `# ${WORD}`,
                    '',
                    `## ${OTHER}`,
                    '',
                    `${SPIRIT} ${LIFE}.`,
                ].join('\n'),
            );
            studyLanguageState.code = 'zz';
            studyLanguageState.churchWords = {
                words: {
                    'Cross references': CROSS,
                    'Holy Spirit': SPIRIT,
                    'eternal life': LIFE,
                },
            };
            mocks.askLlmBot.mockResolvedValue({ text: 'One is not.' });
            seedStudyTab();
            await renderWindow();
            await send(NAME_ASK);
            await waitForAsked();
            const asked = askedText();
            expect(asked).toContain(CHECK_INTRO);
            expect(asked).toContain(
                `- "${OTHER}", written once: the heading of “Cross ` +
                    `References”, which its language writes "${CROSS}".`,
            );
            // Its church words read once, for this question; no dictionary.
            expect(
                studyLanguageState.loads.filter(([, fileName]) => {
                    return fileName === 'churchWords.json';
                }),
            ).toEqual([['zz', 'churchWords.json']]);
            expect(
                studyLanguageState.loads.some(([, fileName]) => {
                    return fileName === 'tran.json';
                }),
            ).toBe(false);
            expect(mocks.callTool).not.toHaveBeenCalled();
        });

        test('a verse check reads the file once for both, the verses first', async () => {
            mocks.readWholeTextFile.mockResolvedValue(
                genTranslatedStudy(ZENON_SLIP),
            );
            routes.owa_bible_suggest = () => {
                return json({
                    kind: 'books',
                    bookKeys: ['JHN', 'ROM'],
                    english: ['John', 'Romans'],
                    bibles: [
                        {
                            keys: ['KJV'],
                            locale: 'en',
                            books: ['John', 'Romans'],
                        },
                    ],
                });
            };
            routes.owa_find_verse = () => {
                return json({
                    bible: 'KJV',
                    verses: [
                        {
                            key: 'ROM 5:8',
                            ref: 'Romans 5:8',
                            text: 'But God commendeth his love toward us',
                        },
                    ],
                });
            };
            mocks.askLlmBot.mockResolvedValue({ text: 'Read them.' });
            seedStudyTab();
            await renderWindow();
            await send('Are the cross references in this study file right?');
            await waitForAsked();
            expect(mocks.readWholeTextFile).toHaveBeenCalledTimes(1);
            const asked = askedText();
            const verseAt = asked.indexOf(
                '- "Romans 5:8": KJV reads: "But God commendeth his love toward us"',
            );
            expect(verseAt).toBeGreaterThan(0);
            expect(asked.indexOf(CHECK_INTRO)).toBeGreaterThan(verseAt);
            expect(asked).toContain(SLIP_LINE);
        });
    });

    describe('the language a change to a study is written in (EC-608)', () => {
        const ASK = 'Add a prayer at the end.';
        const LINE_START = '(The study file "';

        // A tab with the study open, asked about once already.
        function seedOpenStudy() {
            seedSessions([
                genSession('study', [
                    {
                        id: 1,
                        author: 'you',
                        text: 'About this',
                        attachments: [genFileAttachment(STUDY_PATH)],
                    },
                    { id: 2, author: 'bot', text: 'It is attached.' },
                ]),
            ]);
        }

        test('the study open from Resources: each half’s language, read once', async () => {
            studyFileState.resourceDirs = ['/resources/Default'];
            studyFileState.halfLanguages = ['en', 'other'];
            mocks.readWholeTextFile.mockResolvedValue(STUDY_CONTENT);
            mocks.askLlmBot.mockResolvedValue({ text: 'Drafted.' });
            seedOpenStudy();
            await renderWindow();
            await send(ASK);
            await waitForAsked();
            const asked = askedText();
            expect(asked.startsWith(ASK)).toBe(true);
            expect(asked).toContain(
                '(The study file "Default/Love.md" is written in English, ' +
                    'with a translation into another language after it, ' +
                    'each under a rule and a # title of its own: a word you ' +
                    'put into a part is in the language of the half that ' +
                    'part is in, whatever language this message is in, ' +
                    'unless they ask for another.)',
            );
            // Asked in English, nothing of their own words to carry.
            expect(asked).not.toContain('As they typed it:');
            expect(mocks.readWholeTextFile).toHaveBeenCalledTimes(1);
        });

        test('the new study the card above holds, in a language none here names', async () => {
            studyFileState.halfLanguages = ['other'];
            mocks.askLlmBot.mockResolvedValue({ text: 'Drafted.' });
            seedStudyCard(genStudyDraftActions(keepNewStudy()));
            await renderWindow();
            await send('Change its title to Born Again.');
            await waitForAsked();
            expect(askedText()).toContain(
                '(The study file "Love.md" is not written in English: every ' +
                    'word you put into it is in the language it is written ' +
                    'in, whatever language this message is in, unless they ' +
                    'ask for another.)',
            );
            // The card it came from is held to the ask (EC-606).
            expect(mocks.askLlmBot.mock.calls[0][6]?.heldStudy?.name).toBe(
                'Love.md',
            );
        });

        test('the card above a question answered in between, and that answer kept into it (EC-701)', async () => {
            mocks.askLlmBot.mockResolvedValue({ text: 'Added.' });
            const explained =
                'Born again means a new start that God gives: not a second ' +
                'birth of the body, but a life from above, by water and the ' +
                'Spirit, as Jesus told Nicodemus.';
            seedSessions([
                genSession('study', [
                    { id: 1, author: 'you', text: 'Make a study of John 3:16' },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'Here is the study. Press Create to save it.',
                        actions: genStudyDraftActions(keepNewStudy()),
                    },
                    {
                        id: 3,
                        author: 'you',
                        text: 'What does born again mean?',
                    },
                    { id: 4, author: 'bot', text: explained },
                ]),
            ]);
            await renderWindow();
            await send('Add that to the study');
            await waitForAsked();
            const extra = mocks.askLlmBot.mock.calls[0][6];
            expect(extra?.heldStudy?.name).toBe('Love.md');
            expect(extra?.heldStudy?.answersBetween).toBe(1);
            expect(extra?.keepAnswer).toBe(true);
            expect(extra?.answerAbove).toBe(explained);
            // The line it answered, its heading at the study's end (EC-704).
            expect(extra?.answerAboveQuestion).toBe(
                'What does born again mean?',
            );
        });

        test('no option under the card an answer brings says one of its buttons again (EC-705)', async () => {
            // Seen live: the model's two beside the card's two Create
            // buttons. They were the two options a card leaves room for,
            // so the one asking for more went with them.
            mocks.askLlmBot.mockResolvedValue({
                text: 'I have made its title shorter in the study.',
                actions: genStudyDraftActions(keepNewStudy()),
                replies: [
                    'Create in Resources',
                    'Create in Bible Notes',
                    'Add a prayer at the end',
                ],
            });
            seedStudyCard(genStudyDraftActions(keepNewStudy()));
            await renderWindow();
            await send('Make its title shorter.');
            await waitFor(
                () => queryAll('article.cue-bot').length === 2,
                'the answer under its card',
            );
            const answered = queryAll('article.cue-bot')[1];
            const labels = Array.from(answered.querySelectorAll('button')).map(
                (button) => button.textContent ?? '',
            );
            // Five buttons: room for two options (seven in all).
            expect(labels).toContain('New Bible Note');
            expect(labels).toContain('Create "Love.md" in Resources');
            expect(labels).toContain('Change the name');
            expect(
                Array.from(answered.querySelectorAll('.cue-reply')).map(
                    (button) => button.textContent,
                ),
            ).toEqual(['Add a prayer at the end']);
        });

        test('the card above an ask the assistant failed is reached by the line typed again (EC-702)', async () => {
            // Every assistant fails the first line, the one handed on to too,
            // as a busy service does: its door comes with the failure, and
            // the guide answers under it.
            mocks.askLlmBot.mockRejectedValue(
                new Error('the service is busy.', { cause: { status: 429 } }),
            );
            routes.owa_help_search = () => {
                return JSON.stringify([
                    {
                        id: 'W-06',
                        title: 'Renaming a file',
                        section: '',
                        excerpt: 'Right-click the file and press **Rename**.',
                        score: 40,
                    },
                ]);
            };
            seedStudyCard(genStudyDraftActions(keepNewStudy()));
            await renderWindow();
            await send('Change its title to Born Again.');
            await waitFor(
                () => queryAll('article.cue-bot').length === 2,
                'the failure answer',
            );
            const failedCalls = mocks.askLlmBot.mock.calls.length;
            expect(mocks.askLlmBot.mock.calls[0][6]?.heldStudy?.name).toBe(
                'Love.md',
            );
            // The guide's stand-in under the failure, with the door to it
            // and the guide's own buttons: no plain answer.
            const failed = queryAll('article.cue-bot')[1];
            expect(failed.textContent).toContain('could not answer');
            const labels = Array.from(failed.querySelectorAll('button')).map(
                (button) => button.textContent ?? '',
            );
            expect(labels).toContain('Open AI settings');
            expect(labels).toContain('Show me step by step');
            mocks.askLlmBot.mockResolvedValue({ text: 'Drafted.' });
            await send('Change its title to Born Again.');
            await waitForAsked(failedCalls + 1);
            const held = mocks.askLlmBot.mock.calls[failedCalls][6]?.heldStudy;
            expect(held?.name).toBe('Love.md');
            expect(held?.answersBetween).toBe(1);
        });

        test('nothing is said of an English study asked in English', async () => {
            // Read for real: the study is English.
            studyFileState.resourceDirs = ['/resources/Default'];
            mocks.readWholeTextFile.mockResolvedValue(STUDY_CONTENT);
            mocks.askLlmBot.mockResolvedValue({ text: 'Drafted.' });
            seedOpenStudy();
            await renderWindow();
            await send(ASK);
            await waitForAsked();
            expect(askedText().startsWith(ASK)).toBe(true);
            expect(askedText()).not.toContain(LINE_START);
        });

        test('nor of a study in no Resources folder: no change reaches it', async () => {
            studyFileState.halfLanguages = ['other'];
            mocks.readWholeTextFile.mockResolvedValue(STUDY_CONTENT);
            mocks.askLlmBot.mockResolvedValue({ text: 'Drafted.' });
            seedOpenStudy();
            await renderWindow();
            await send(ASK);
            await waitForAsked();
            expect(askedText().startsWith(ASK)).toBe(true);
            expect(askedText()).not.toContain(LINE_START);
        });
    });

    describe('a study translated by the window', () => {
        // The assistant asked the question calls the window's translator
        // twice, as the loop does for two parts of a study.
        function answerWithTranslations() {
            mocks.askLlmBot.mockImplementation(
                async (
                    ask: string,
                    _focus: unknown,
                    _provider: unknown,
                    _model: unknown,
                    _images: unknown,
                    signal: AbortSignal,
                    extra: any,
                ) => {
                    if (extra?.isTranslation === true) {
                        return { text: `[xx] ${ask}` };
                    }
                    const first = await extra.translateText('Part one', signal);
                    const second = await extra.translateText(
                        'Part two',
                        signal,
                    );
                    return {
                        text: `Translated: ${first.text} / ${second.text} by ${first.by}`,
                    };
                },
            );
        }

        test('a Gemma 4 that costs nothing translates each part, looked for once', async () => {
            mocks.resolveAutoPicks.mockResolvedValue([
                {
                    provider: 'custom',
                    model: 'srv::gemma4:cloud',
                    serverId: 'srv',
                    label: 'Home Server · gemma4:cloud',
                    modelName: 'gemma4:cloud',
                    canSeeImages: false,
                },
            ]);
            answerWithTranslations();
            seedSessions([genSession('front', [])]);
            await renderWindow();
            await send('Put the open study into Xxlang on new pages');
            await waitFor(
                () => bodyOf(lastCue()).includes('Translated:'),
                'the answer',
            );
            const translations = mocks.askLlmBot.mock.calls.filter((call) => {
                return call[6]?.isTranslation === true;
            });
            expect(translations.map((call) => call[0])).toEqual([
                'Part one',
                'Part two',
            ]);
            for (const call of translations) {
                expect(call[2]).toBe('custom');
                expect(call[3]).toBe('srv::gemma4:cloud');
                expect(call[4]).toEqual([]);
                expect(call[6]).toMatchObject({
                    isGeneral: true,
                    isTranslation: true,
                });
            }
            // One look for the translator, however many parts.
            expect(
                mocks.resolveAutoPicks.mock.calls.filter((call) => {
                    return (
                        String(call[0]?.preferModelPattern) ===
                        String(/gemma[-_\s]?4/i)
                    );
                }),
            ).toHaveLength(1);
            expect(bodyOf(lastCue())).toContain(
                'Translated: [xx] Part one / [xx] Part two by Home Server · gemma4:cloud',
            );
        });

        test('with none to ask, the assistant the question went to translates', async () => {
            answerWithTranslations();
            seedSessions([genSession('front', [])]);
            await renderWindow();
            await send('Put the open study into Xxlang on new pages');
            await waitFor(
                () => bodyOf(lastCue()).includes('Translated:'),
                'the answer',
            );
            const [main] = mocks.askLlmBot.mock.calls;
            const translations = mocks.askLlmBot.mock.calls.filter((call) => {
                return call[6]?.isTranslation === true;
            });
            expect(translations).toHaveLength(2);
            for (const call of translations) {
                expect(call[2]).toBe(main[2]);
                expect(call[3]).toBe(main[3]);
            }
            expect(bodyOf(lastCue())).toContain(
                `by ${getLlmModelLabel(main[2], main[3])}`,
            );
        });
    });

    describe('Stop pressed while the buttons under an answer are worked out', () => {
        test('the answer that came back is not drawn', async () => {
            const held = defer<string[]>();
            replyState.held = held.promise;
            mocks.askLlmBot.mockResolvedValue({
                text: 'Press the Background button.',
            });
            seedSessions([genSession('front', [])]);
            await renderWindow();
            await send('How do I change the background colour?');
            await waitForAsked();
            await waitFor(
                () => query('.chat-stop') !== null,
                'the Stop button',
            );
            await click(query('.chat-stop'));
            await act(async () => {
                held.resolve(['Thanks']);
            });
            await settle();
            const said = cues().map(saidOf);
            expect(said.join('\n')).not.toContain(
                'Press the Background button.',
            );
            expect(said.at(-1)).toContain('Stopped.');
            expect(query('.chat-stop')).toBeNull();
        });
    });

    describe('Retry under an answer a paid key wrote', () => {
        test('asks the key’s next model with the question’s file again', async () => {
            llmState.available = ['anthropic', 'free'];
            mocks.askLlmBot.mockResolvedValue({ text: 'Another answer.' });
            seedSessions([
                genSession(
                    'paid',
                    [
                        {
                            id: 1,
                            author: 'you',
                            text: 'What does this file say?',
                            attachments: [
                                {
                                    ...genFileAttachment('/files/plan.txt'),
                                    number: 1,
                                },
                            ],
                        },
                        {
                            id: 2,
                            author: 'bot',
                            text: 'It lists the songs.',
                            answeredBy: {
                                assistant: getLlmProviderLabel(
                                    'anthropic',
                                    'claude-sonnet-5',
                                ),
                                model: getLlmModelLabel(
                                    'anthropic',
                                    'claude-sonnet-5',
                                ),
                            },
                        },
                    ],
                    { provider: 'anthropic', model: 'claude-sonnet-5' },
                ),
            ]);
            await renderWindow();
            await click(
                lastCue().querySelector<HTMLButtonElement>(
                    '[aria-label="Retry"]',
                ),
            );
            await waitForAsked();
            const [asked, , provider, model] = mocks.askLlmBot.mock.calls[0];
            expect(provider).toBe('anthropic');
            expect(model).toBe('claude-opus-5');
            expect(String(asked)).toContain('What does this file say?');
            expect(String(asked)).toContain('plan.txt');
            // The tab's own model is what the next question asks.
            expect(
                query<HTMLSelectElement>('[aria-label="Which model answers"]')
                    ?.value,
            ).toBe('claude-sonnet-5');
        });
    });
});
