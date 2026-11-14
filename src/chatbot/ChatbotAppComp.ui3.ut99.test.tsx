// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

// One mock surface for the whole window: the settings store, the main
// process (sync and async), the tool host and the model. Everything that
// crosses a process is a file-local `vi.fn`; the window's own helpers stay
// real so the tests exercise what it really does.
const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    homeSettings: new Map<string, string>(),
    listeners: new Map<string, Set<(...args: any[]) => void>>(),
    secret: {} as Record<string, string>,
    customServers: [] as any[],
    endpoints: {
        mcpUrl: 'http://127.0.0.1:39223/mcp',
        mcpToken: 'token',
        cdpPort: 9222,
    } as any,
    pendingSnapshot: null as any,
    windowEntries: [] as any[],
    registryStatus: null as any,
    resourceFolders: [] as string[],
    isClientSettingBroken: false,
    sendData: vi.fn(),
    removeListener: vi.fn(),
    openExternalURL: vi.fn(),
    electronSendAsync: vi.fn(),
    callTool: vi.fn(),
    callToolPicture: vi.fn(),
    askLlmBot: vi.fn(),
    listAllLlmModels: vi.fn(),
    copyImageToClipboard: vi.fn(),
    readAssetPreview: vi.fn(),
    downloadAsset: vi.fn(),
    getAllQuestions: vi.fn(),
    originalGetAllQuestions: null as null | ((...args: any[]) => any),
    getStarterQuestions: vi.fn(),
    originalGetStarterQuestions: null as null | ((...args: any[]) => any),
    originalReadAssetPreview: null as null | ((...args: any[]) => any),
    suggestQuestions: vi.fn(),
    originalSuggestQuestions: null as null | ((...args: any[]) => any),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false, isGlassCapable: false },
        envUtils: { isFEUseEffectWarning: false },
        isPageScreen: false,
        settingHomePage: '/setting.html',
        POPUP_FRAME_NAME_PREFIX: 'owa-popup',
        messageUtils: {
            sendDataSync: (channel: string, data?: any) => {
                if (channel === 'main:app:get-ai-endpoints') {
                    return h.endpoints;
                }
                if (channel === 'main:app:get-theme') {
                    return 'light';
                }
                if (channel === 'main:app:take-chat-attachment') {
                    const snapshot = h.pendingSnapshot;
                    h.pendingSnapshot = null;
                    return snapshot;
                }
                if (channel === 'main:app:secure-setting') {
                    if (data?.type === 'is-available') {
                        return true;
                    }
                    return data?.key === 'ai-setting-secret'
                        ? JSON.stringify(h.secret)
                        : null;
                }
                if (channel === 'main:app:client-setting') {
                    if (h.isClientSettingBroken) {
                        throw new Error('main is not answering');
                    }
                    if (data?.key === 'ai-custom-servers') {
                        return JSON.stringify({ servers: h.customServers });
                    }
                    return h.homeSettings.get(data?.key) ?? null;
                }
                return null;
            },
            sendData: (...args: any[]) => h.sendData(...args),
            listenForData: (channel: string, listener: any) => {
                const set = h.listeners.get(channel) ?? new Set();
                set.add(listener);
                h.listeners.set(channel, set);
            },
            listenOnceForData: () => {},
            removeListener: (channel: string, listener: any) => {
                h.listeners.get(channel)?.delete(listener);
                h.removeListener(channel, listener);
            },
        },
        pathUtils: {
            sep: '/',
            join: (...parts: string[]) => parts.join('/'),
            basename: (path: string) => path.split('/').pop() ?? '',
            dirname: (path: string) => path.split('/').slice(0, -1).join('/'),
        },
        browserUtils: {
            openExternalURL: (url: string) => h.openExternalURL(url),
        },
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    getSettingForce: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string | null) => {
        h.settings.set(key, value ?? '');
    },
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('../server/electronSendHelpers', () => ({
    genReturningEventName: (name: string) => `${name}-return`,
    electronSendAsync: (...args: any[]) => h.electronSendAsync(...args),
}));
vi.mock('./mcpClient', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./mcpClient')>()),
    callTool: (...args: any[]) => h.callTool(...args),
    callToolPicture: (...args: any[]) => h.callToolPicture(...args),
}));
vi.mock('./llmBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./llmBotHelpers')>()),
    askLlmBot: (...args: any[]) => h.askLlmBot(...args),
    listAllLlmModels: (...args: any[]) => h.listAllLlmModels(...args),
}));
vi.mock('./attachmentHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./attachmentHelpers')>()),
    copyImageToClipboard: (...args: any[]) => h.copyImageToClipboard(...args),
}));
vi.mock('./assetPreviewHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('./assetPreviewHelpers')>();
    h.originalReadAssetPreview = original.readAssetPreview;
    return {
        ...original,
        readAssetPreview: (...args: any[]) => h.readAssetPreview(...args),
        downloadAsset: (...args: any[]) => h.downloadAsset(...args),
    };
});
// The language packages' book names (`listLangBibleBookNames`, EC-461) are
// lazy files the fake clock cannot wait for; English, the package every tree
// has, answers at once.
vi.mock('../lang/langPackageFileHelpers', async (importOriginal) => {
    const englishBooks = (await import('../lang/data/en/bibleBooks.json'))
        .default as { books: string[] }[];
    return {
        ...(await importOriginal<
            typeof import('../lang/langPackageFileHelpers')
        >()),
        listLangBibleBookNames: async () => {
            return englishBooks.flatMap((set) => {
                return set.books;
            });
        },
    };
});
vi.mock('./questionHelpers', async (importOriginal) => {
    const original = await importOriginal<typeof import('./questionHelpers')>();
    h.originalGetAllQuestions = original.getAllQuestions;
    h.originalGetStarterQuestions = original.getStarterQuestions;
    h.originalSuggestQuestions = original.suggestQuestions;
    return {
        ...original,
        suggestQuestions: (...args: any[]) => h.suggestQuestions(...args),
        getAllQuestions: (...args: any[]) => h.getAllQuestions(...args),
        getStarterQuestions: (...args: any[]) => {
            return h.getStarterQuestions(...args);
        },
    };
});
vi.mock('../resources/resourcesFolderHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../resources/resourcesFolderHelpers')
    >()),
    getResourcesFolderList: () => h.resourceFolders,
}));

import ChatbotAppComp from './ChatbotAppComp';
import { setChatTranslator } from './chatTranHelpers';
import { resetSpendGuardForTests } from './spendGuardHelpers';
import { setCurrentWindowAim } from './windowAimHelpers';
import { hideChatTip, showChatTips } from './tipHelpers';
import { clearProgressSteps, pushProgressStep } from './progressHelpers';
import { toAttachmentNote } from './attachmentHelpers';
import { ToolHostError } from './mcpClient';
import { loadLlmRegistry } from '../helper/ai/customServerHelpers';

const LIST_APP_WINDOWS_CHANNEL = 'main:app:list-app-windows';
const REGISTRY_GET_CHANNEL = 'main:app:llm-registry';
const REGISTRY_RELOAD_CHANNEL = 'main:app:llm-registry-reload';

function genSession(overrides: Record<string, any> = {}) {
    return {
        id: 's1',
        title: '',
        messages: [],
        draft: '',
        focus: 'presenter',
        isFocusChosen: true,
        provider: 'free',
        model: '',
        isLocked: false,
        ...overrides,
    };
}

function seedSessions(sessions: any[], activeId = sessions[0].id) {
    h.settings.set('chatbot-sessions', JSON.stringify({ activeId, sessions }));
}

function readSavedSessions() {
    return JSON.parse(h.settings.get('chatbot-sessions') ?? 'null');
}

let container: HTMLDivElement;
let root: Root;
let isMounted = false;
let originalTitle = '';

beforeAll(async () => {
    // jsdom draws no layout: the tab strip and the suggestion list bring
    // their active row into view, which jsdom does not implement.
    (Element.prototype as any).scrollIntoView = function () {
        scrolledIntoView.push(this as Element);
    };
    // The corpus is a lazy chunk; loaded once here, with real timers, so a
    // test under fake timers reads it from memory.
    await h.originalGetStarterQuestions!('presenter');
    await h.originalGetAllQuestions!('presenter');
    await h.originalSuggestQuestions!('background', 'presenter');
});
afterAll(() => {
    delete (Element.prototype as any).scrollIntoView;
});

const scrolledIntoView: Element[] = [];

beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.settings.clear();
    h.homeSettings.clear();
    h.listeners.clear();
    h.secret = {};
    h.customServers = [];
    h.endpoints = {
        mcpUrl: 'http://127.0.0.1:39223/mcp',
        mcpToken: 'token',
        cdpPort: 9222,
    };
    h.pendingSnapshot = null;
    h.windowEntries = [];
    h.registryStatus = null;
    h.resourceFolders = [];
    h.isClientSettingBroken = false;
    scrolledIntoView.length = 0;
    localStorage.clear();
    h.electronSendAsync.mockImplementation(async (channel: string) => {
        if (channel === LIST_APP_WINDOWS_CHANNEL) {
            return h.windowEntries;
        }
        if (
            channel === REGISTRY_GET_CHANNEL ||
            channel === REGISTRY_RELOAD_CHANNEL
        ) {
            return h.registryStatus;
        }
        return null;
    });
    h.callTool.mockImplementation(async () => '{}');
    h.callToolPicture.mockImplementation(async () => {
        throw new Error('No picture in this test');
    });
    h.askLlmBot.mockImplementation(async () => {
        return { text: 'A plain answer.' };
    });
    h.readAssetPreview.mockImplementation((attachment: any) => {
        return h.originalReadAssetPreview!(attachment);
    });
    h.downloadAsset.mockImplementation(async () => {
        return { filePath: null, message: 'Saved it.' };
    });
    h.getAllQuestions.mockImplementation((...args: any[]) => {
        return h.originalGetAllQuestions!(...args);
    });
    h.getStarterQuestions.mockImplementation((...args: any[]) => {
        return h.originalGetStarterQuestions!(...args);
    });
    h.suggestQuestions.mockImplementation((...args: any[]) => {
        return h.originalSuggestQuestions!(...args);
    });
    // Module state shared by every mount: the registry's servers, the spend
    // guard's ledger, the window the tab works in, the translator.
    await loadLlmRegistry();
    resetSpendGuardForTests();
    setCurrentWindowAim(null);
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
    originalTitle = document.title;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    isMounted = false;
});

afterEach(() => {
    if (isMounted) {
        act(() => {
            root.unmount();
        });
    }
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    document.title = originalTitle;
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
    setCurrentWindowAim(null);
    localStorage.clear();
});

async function flush(ms = 0) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

async function renderWindow() {
    await act(async () => {
        root.render(<ChatbotAppComp />);
    });
    isMounted = true;
    await flush();
}

function $<T extends Element = HTMLElement>(selector: string) {
    return container.querySelector<T & Element>(selector) as T | null;
}

function $$<T extends Element = HTMLElement>(selector: string) {
    return [...container.querySelectorAll(selector)] as T[];
}

async function press(element: Element | null) {
    expect(element).not.toBeNull();
    await act(async () => {
        (element as HTMLElement).click();
    });
    await flush();
}

async function typeQuestion(value: string) {
    const box = $<HTMLTextAreaElement>('.chat-input')!;
    const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(box, value);
        box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();
}

afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as any).clipboard;
    document.documentElement.lang = '';
});

function genDeferred<T>() {
    let resolve: (value: T) => void = () => {};
    let reject: (error: unknown) => void = () => {};
    const promise = new Promise<T>((done, fail) => {
        resolve = done;
        reject = fail;
    });
    return { promise, resolve, reject };
}

// What each message SAYS: a question's own words, an answer's lines.
function transcriptTexts(author: 'you' | 'bot') {
    return $$(`.cue-${author} .cue-body`).map((one) => {
        return [...one.children]
            .filter((child) => {
                return (
                    child.classList.contains('cue-said') ||
                    child.classList.contains('chatbot-line')
                );
            })
            .map((child) => {
                return (child.textContent ?? '').trim();
            })
            .join('\n');
    });
}

async function mouseDown(element: Element) {
    await act(async () => {
        element.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
        );
    });
    await flush();
}

// The translator a non-English window plugs in, for a few words only, so a
// test can see which words went through it.
function plugTestTranslator(words: Record<string, string>) {
    const translate = (text: string) => {
        return words[text] ?? text;
    };
    setChatTranslator(translate, translate);
}

// A `File` as the paperclip, a paste or a drop hands one over. jsdom's has
// no `text()`; Chromium's does.
function genFile(
    content: string | Uint8Array,
    name: string,
    type: string,
    appFilePath?: string,
) {
    const file = new File([content as BlobPart], name, { type });
    Object.defineProperty(file, 'text', {
        value: async () => {
            return typeof content === 'string' ? content : '';
        },
    });
    if (appFilePath !== undefined) {
        Object.defineProperty(file, 'appFilePath', { value: appFilePath });
    }
    return file;
}

async function dropFiles(files: File[]) {
    const form = $('.chat-ask')!;
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files } });
    await act(async () => {
        form.dispatchEvent(event);
    });
    await flush(20);
    await flush(20);
    return event;
}

async function waitForAsk(count = 1) {
    for (
        let round = 0;
        round < 20 && h.askLlmBot.mock.calls.length < count;
        round++
    ) {
        await flush(10);
    }
    expect(h.askLlmBot.mock.calls.length).toBeGreaterThanOrEqual(count);
}

async function sendQuestion(text: string) {
    await typeQuestion(text);
    await press($('.chat-send'));
    await flush(10);
}

function noteTexts() {
    return $$('.cue-bot .cue-note').map((one) => {
        return one.textContent;
    });
}

describe('the tip line', () => {
    test('pressing the sentence shows another and puts the caret back in the box', async () => {
        await renderWindow();
        const tip = () => $('.chat-tip')!.textContent;
        const first = tip();
        await press($('.chat-tip'));
        expect(tip()).not.toBe(first);
        expect(document.activeElement).toBe($('.chat-input'));
        expect(h.settings.get('chatbot-tip-shown')).toBeTruthy();
    });

    test('put away for 30 days, it comes back when /tips says so', async () => {
        await renderWindow();
        await press($('[aria-label="Hide tips for 30 days"]'));
        expect($('.chat-tip-row')).toBeNull();
        expect(
            Number(h.settings.get('chatbot-tip-hidden-until')),
        ).toBeGreaterThan(Date.now());
        expect(document.activeElement).toBe($('.chat-input'));
        await act(async () => {
            showChatTips();
        });
        await flush();
        expect($('.chat-tip-row')).not.toBeNull();
    });

    test('a window opened while the tips are put away draws no tip line', async () => {
        hideChatTip();
        await renderWindow();
        expect($('.chat-tip-row')).toBeNull();
        expect($('.chat-input')).not.toBeNull();
    });
});

describe('a question on its way', () => {
    test('Stop, the title mark, the steps so far, and Add with words in the box', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        const answer = genDeferred<any>();
        h.askLlmBot.mockReturnValue(answer.promise);
        document.title = 'App Help';
        seedSessions([
            genSession({ provider: 'anthropic', model: 'claude-sonnet-5' }),
        ]);
        await renderWindow();
        await sendQuestion('Explain the slide editor to me');
        await waitForAsk();
        expect(document.title).toBe('🟠 App Help');
        expect(h.sendData).toHaveBeenCalledWith('all:app:chatbot-busy', {
            isBusy: true,
        });
        expect($('.chat-stop')?.textContent).toBe('Stop');
        expect($('.chat-send.chat-report')).toBeNull();
        const box = $<HTMLTextAreaElement>('.chat-input')!;
        expect(box.placeholder).toBe('Add anything else while it works…');
        await act(async () => {
            clearProgressSteps('s1');
        });
        await flush();
        expect($('.chat-status')?.textContent).toBe(
            'Looking it up… press Stop to give up on it.',
        );
        await act(async () => {
            for (let id = 1; id <= 6; id++) {
                pushProgressStep('s1', {
                    id: 9000 + id,
                    text: `Step ${id}`,
                    isDone: id < 6,
                });
            }
        });
        await flush();
        expect($('.chat-progress-more')?.textContent).toBe('1 earlier step');
        expect(
            $$('.chat-progress .chat-status').map((one) => {
                return one.textContent;
            }),
        ).toEqual(['Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6…']);
        expect($$('.chat-progress .chat-status.is-done')).toHaveLength(4);
        await act(async () => {
            pushProgressStep('s1', { id: 9007, text: 'Step 7', isDone: false });
            // Another tab's steps are not this tab's to show.
            pushProgressStep('other-tab', {
                id: 1,
                text: 'Elsewhere',
                isDone: false,
            });
        });
        await flush();
        expect($('.chat-progress-more')?.textContent).toBe('2 earlier steps');
        expect($('.chat-progress')?.textContent).not.toContain('Elsewhere');
        expect($('.chat-progress-stop')?.textContent).toBe(
            'press Stop to give up on it.',
        );
        // Words typed while it works can be added to it.
        expect($('.chat-add')).toBeNull();
        await typeQuestion('and the background');
        expect($('.chat-add')?.textContent).toBe('Add');
        plugTestTranslator({ 'Add more': 'ADD-MORE-XX' });
        await typeQuestion('and the backgrounds');
        expect($('.chat-add')?.textContent).toBe('ADD-MORE-XX');
        await act(async () => {
            answer.resolve({ text: 'Here it is.' });
        });
        await flush(10);
        await flush(10);
        expect(transcriptTexts('bot').at(-1)).toBe('Here it is.');
        expect(document.title).toBe('App Help');
        expect($('.chat-stop')).toBeNull();
        const busyCalls = h.sendData.mock.calls.filter((call) => {
            return call[0] === 'all:app:chatbot-busy';
        });
        expect(busyCalls.at(-1)?.[1]).toEqual({ isBusy: false });
        clearProgressSteps('other-tab');
    });

    test('a question of only a file adds nothing to the walk back', async () => {
        seedSessions([genSession({ provider: 'free' })]);
        await renderWindow();
        await dropFiles([genFile('Line one', 'log.txt', 'text/plain')]);
        await press($('.chat-send'));
        await waitForAsk(1);
        await flush(10);
        expect(h.settings.has('chatbot-ask-history')).toBe(false);
        await sendQuestion('Hello there');
        await waitForAsk(2);
        expect(JSON.parse(h.settings.get('chatbot-ask-history')!)).toEqual([
            'Hello there',
        ]);
    });

    test('a command with nothing to add runs on the press of its row', async () => {
        seedSessions([genSession()]);
        await renderWindow();
        await typeQuestion('/comman');
        const row = $$('.chat-suggest').find((one) => {
            return (
                one.querySelector('.chat-suggest-text')?.textContent ===
                '/commands'
            );
        });
        expect(row).toBeDefined();
        await mouseDown(row!);
        await flush(10);
        expect(transcriptTexts('you')).toEqual(['/commands']);
        expect(transcriptTexts('bot')[0]).toContain('/screen');
        expect(JSON.parse(h.settings.get('chatbot-ask-history')!)).toEqual([
            '/commands',
        ]);
        expect(h.askLlmBot).not.toHaveBeenCalled();
    });
});

describe('what the model is handed, and what a failure says', () => {
    test('the history carries each turn’s note, what was attached and the choices offered', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        const picture = {
            id: 'a1',
            kind: 'image',
            name: 'my screen',
            mimeType: 'image/png',
            byteSize: 10,
            number: 1,
        };
        seedSessions([
            genSession({
                provider: 'anthropic',
                model: 'claude-sonnet-5',
                messages: [
                    {
                        id: 1,
                        author: 'you',
                        text: 'Where is the screen?',
                        attachments: [picture],
                    },
                    {
                        id: 2,
                        author: 'bot',
                        text: 'It is in the Mini Screen panel.',
                        note: 'Answered from the guide.',
                        actions: [
                            {
                                label: 'Show me step by step',
                                toolName: 'owa_guide_start',
                                args: { manualId: 'W-04' },
                            },
                            {
                                label: 'Open AI settings',
                                toolName: 'owa-open-ai-setting',
                            },
                        ],
                    },
                    {
                        id: 3,
                        author: 'bot',
                        text: 'What was wrong with it?',
                        isFollowUp: true,
                    },
                ],
            }),
        ]);
        await renderWindow();
        await sendQuestion('/btw what is a psalm');
        await waitForAsk();
        const [, , provider, model, turns, , extra] = h.askLlmBot.mock.calls[0];
        expect(provider).toBe('anthropic');
        expect(model).toBe('claude-sonnet-5');
        expect(extra.isGeneral).toBe(true);
        expect(turns).toEqual([
            {
                author: 'you',
                text: `Where is the screen?\n${toAttachmentNote([picture as any])}`,
            },
            {
                author: 'bot',
                text:
                    'It is in the Mini Screen panel.\nAnswered from the guide.\n' +
                    'Choices: Show me step by step; Open AI settings',
            },
        ]);
    });

    test('a provider that fails is named over the guide’s own answer', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        h.askLlmBot.mockRejectedValue(new Error('The service is down.'));
        seedSessions([
            genSession({ provider: 'anthropic', model: 'claude-sonnet-5' }),
        ]);
        await renderWindow();
        await sendQuestion('How do I add a background?');
        await waitForAsk();
        await flush(10);
        expect(noteTexts()).toContain(
            "Claude could not answer — The service is down. Here is what the app's own guide says.",
        );
    });

    test('the app’s own help service failing is said in its own sentence', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        h.askLlmBot.mockRejectedValue(new ToolHostError(500));
        seedSessions([
            genSession({ provider: 'anthropic', model: 'claude-sonnet-5' }),
        ]);
        await renderWindow();
        await sendQuestion('How do I add a background?');
        await waitForAsk();
        await flush(10);
        expect(noteTexts()).toContain(
            `${new ToolHostError(500).message} Here is what the app's own guide says.`,
        );
    });

    test('a song the guide wrote out itself is not called the guide’s answer', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        h.askLlmBot.mockRejectedValue(new Error('No credit left'));
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_lyric_validate'
                ? [
                      'Drafted a song from the words.',
                      'Song: Amazing Grace',
                      'Valid Open Lyric. No problems found.',
                      '```ol:Config',
                      '- Title: Amazing Grace',
                      '```',
                  ].join('\n')
                : '{}';
        });
        seedSessions([
            genSession({ provider: 'anthropic', model: 'claude-sonnet-5' }),
        ]);
        await renderWindow();
        await sendQuestion(
            [
                'Amazing grace how sweet the sound',
                'That saved a wretch like me',
                'I once was lost but now am found',
                'Was blind but now I see',
                'Twas grace that taught my heart to fear',
            ].join('\n'),
        );
        await waitForAsk();
        await flush(10);
        expect(noteTexts()).toContain(
            'Claude could not answer — No credit left. I wrote the song out myself instead.',
        );
    });
});

describe('a job another window handed over', () => {
    function handOver(key: string, data: Record<string, any>) {
        h.settings.set(key, JSON.stringify({ ...data, at: Date.now() }));
    }

    test.each([
        [
            'Import bible from https://example.com/kjv.xml',
            'Import a Bible from https://example.com/kjv.xml',
        ],
        ['Import bible', 'Import a Bible'],
        ['Import the Bible called "KJV"', 'CALLED-XX "KJV"'],
        ['Import bible for Swahili', 'Import bible for Swahili'],
    ])('a Bible import "%s" is shown as "%s"', async (asked, shown) => {
        plugTestTranslator({
            'Import the Bible called "{name}"': 'CALLED-XX "{name}"',
        });
        handOver('chatbot-handoff-ask', { text: asked });
        await renderWindow();
        await flush(10);
        expect($$('.chat-tab-name')).toHaveLength(2);
        expect(transcriptTexts('you')[0]).toBe(shown);
    });

    test('a person from a Lookup panel is read, searched in their Bible, and kept on the card', async () => {
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_lookup_record') {
                return JSON.stringify({
                    kind: 'name',
                    name: 'Adam',
                    bible: 'KJV',
                    verses: ['GEN 2:19'],
                });
            }
            if (name === 'owa_find_verse') {
                return JSON.stringify({
                    bible: 'KJV',
                    words: ['Adam'],
                    total: 2,
                    verses: [
                        { key: 'GEN 2:19', text: 'Adam called every beast' },
                        { key: 'GEN 3:9', text: 'unto Adam' },
                    ],
                });
            }
            return '{}';
        });
        handOver('chatbot-handoff-lookup', {
            kind: 'name',
            target: 'adam',
            title: 'Adam',
            langCode: 'en',
            page: 'reader.html',
        });
        await renderWindow();
        await flush(10);
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_lookup_record',
            { kind: 'name', id: 'adam', lang: 'en', page: 'reader.html' },
            expect.any(AbortSignal),
        );
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_find_verse',
            { bible: 'KJV', words: 'Adam', page: 'reader.html' },
            expect.any(AbortSignal),
        );
        // A person has no chapter: no Resources are listed for him.
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_resource_file',
            expect.anything(),
            expect.anything(),
        );
        const facts = JSON.parse((await readSavedCard()).lookup.facts);
        expect(facts.bibleSearch.total).toBe(2);
        expect($('.chat-open-files .chat-clip-name')?.textContent).toBe('Adam');
    });

    test('a passage’s card lists its chapter’s study files', async () => {
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_lookup_record') {
                return JSON.stringify({
                    kind: 'verse',
                    bible: 'KJV',
                    passages: [{ key: 'GEN 4:1', text: 'And Adam knew Eve' }],
                });
            }
            if (name === 'owa_resource_file') {
                return JSON.stringify({ files: [{ file: 'pdf/GEN.4.pdf' }] });
            }
            return '{}';
        });
        handOver('chatbot-handoff-lookup', {
            kind: 'verse',
            target: 'GEN 4:1',
            title: 'Genesis 4:1',
            bibleKey: 'KJV',
        });
        await renderWindow();
        await flush(10);
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_lookup_record',
            { kind: 'verse', ref: 'GEN 4:1', bible: 'KJV', related: true },
            expect.any(AbortSignal),
        );
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_resource_file',
            { action: 'list', book: 'GEN', chapter: 4 },
            expect.any(AbortSignal),
        );
        // A passage is not searched for as a name.
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_find_verse',
            expect.anything(),
            expect.anything(),
        );
        expect(
            JSON.parse((await readSavedCard()).lookup.facts).studyFiles,
        ).toEqual(['pdf/GEN.4.pdf']);
    });

    test('a search or a list that fails still opens the card with the record', async () => {
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_lookup_record') {
                return JSON.stringify({
                    kind: 'verse',
                    bible: 'KJV',
                    passages: [{ key: 'GEN 4:1', text: 'And Adam knew Eve' }],
                });
            }
            throw new Error('not now');
        });
        handOver('chatbot-handoff-lookup', {
            kind: 'verse',
            target: 'GEN 4:1',
            title: 'Genesis 4:1',
            bibleKey: 'KJV',
        });
        await renderWindow();
        await flush(10);
        const facts = JSON.parse((await readSavedCard()).lookup.facts);
        expect(facts.passages[0].key).toBe('GEN 4:1');
        expect(facts.studyFiles).toBeUndefined();
    });

    test('a name whose search fails keeps the record as it was read', async () => {
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_lookup_record') {
                return JSON.stringify({
                    kind: 'name',
                    name: 'Eve',
                    bible: 'KJV',
                });
            }
            throw new Error('not now');
        });
        handOver('chatbot-handoff-lookup', {
            kind: 'name',
            target: 'eve',
            title: 'Eve',
        });
        await renderWindow();
        await flush(10);
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_find_verse',
            { bible: 'KJV', words: 'Eve' },
            expect.any(AbortSignal),
        );
        const facts = JSON.parse((await readSavedCard()).lookup.facts);
        expect(facts).toEqual({ kind: 'name', name: 'Eve', bible: 'KJV' });
    });

    test('a record that cannot be read anywhere still opens a card that says so', async () => {
        h.callTool.mockImplementation(async () => {
            throw new Error('not now');
        });
        handOver('chatbot-handoff-lookup', {
            kind: 'name',
            target: 'seth',
            title: 'Seth',
            page: 'reader.html',
        });
        await renderWindow();
        await flush(10);
        // Asked in the panel's window, then in any window.
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_lookup_record',
            { kind: 'name', id: 'seth', page: 'reader.html' },
            expect.any(AbortSignal),
        );
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_lookup_record',
            { kind: 'name', id: 'seth' },
            expect.any(AbortSignal),
        );
        expect(transcriptTexts('bot')[0]).toContain(
            'I could not read Seth from the app just now.',
        );
        expect((await readSavedCard()).lookup.facts).toBe('');
    });

    // The card the handed-over tab opened on, as the window saved it.
    async function readSavedCard() {
        await flush(400);
        return readSavedSessions()
            .sessions.flatMap((session: any) => {
                return session.messages;
            })
            .find((message: any) => {
                return message.lookup !== undefined;
            });
    }
});

describe('what the window reads before the model is asked', () => {
    const PASSAGE_FACTS = {
        kind: 'verse',
        bible: 'KJV',
        passages: [
            {
                key: 'GEN 8:1-22',
                title: 'Genesis 8:1-22',
                text: 'And God remembered Noah.',
            },
        ],
        around: {
            before: { key: 'GEN 7:1-24', title: 'Genesis 7' },
        },
    };

    function seedPassageCard(facts: Record<string, any>, bibleKey?: string) {
        seedSessions([
            genSession({
                provider: 'anthropic',
                model: 'claude-sonnet-5',
                messages: [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'I have read Genesis 8:1-22.',
                        lookup: {
                            kind: 'verse',
                            target: 'GEN 8:1-22',
                            title: 'Genesis 8:1-22',
                            ...(bibleKey === undefined ? {} : { bibleKey }),
                            facts: JSON.stringify(facts),
                        },
                    },
                ],
            }),
        ]);
    }

    test('a verse by number, the verses before and the people in it go under the record', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name !== 'owa_lookup_record') {
                return '{}';
            }
            if (args.ref === 'GEN 8:20') {
                return JSON.stringify({
                    crossRefs: { byVerse: [{ themes: ['altar', 'offering'] }] },
                    passages: [{ title: 'Genesis 8:20' }],
                });
            }
            if (args.ref === 'GEN 7:1-24') {
                return JSON.stringify({
                    passages: [{ text: 'And the LORD said unto Noah.' }],
                });
            }
            if (args.names === true) {
                return JSON.stringify({
                    people: [
                        { name: 'Noah', kjvName: 'Noah', verses: ['GEN 8:1'] },
                    ],
                    places: [{ name: 'Ararat', verses: ['GEN 8:4'] }],
                });
            }
            return '{}';
        });
        seedPassageCard(PASSAGE_FACTS);
        await renderWindow();
        await sendQuestion(
            'What happened before verse 20, and which people are in it?',
        );
        await waitForAsk();
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_lookup_record',
            { kind: 'verse', bible: 'KJV', ref: 'GEN 8:20', related: true },
            expect.any(AbortSignal),
        );
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_lookup_record',
            { kind: 'verse', bible: 'KJV', ref: 'GEN 7:1-24' },
            expect.any(AbortSignal),
        );
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_lookup_record',
            { kind: 'verse', bible: 'KJV', ref: 'GEN 8:1-22', names: true },
            expect.any(AbortSignal),
        );
        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain(
            'Genesis 8:20, its own cross references, every theme',
        );
        expect(asked).toContain(
            'The verses before it (Genesis 7), read for this question:\nAnd the LORD said unto Noah.',
        );
        expect(asked).toContain(
            '{"people":[{"name":"Noah","kjvName":"Noah","verses":["GEN 8:1"]}],"places":[{"name":"Ararat","verses":["GEN 8:4"]}]}',
        );
        expect(extra.lookup.isReadForAsk).toBe(true);
    });

    test('with no Bible on the record the card’s own is read, and failed reads are left out', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_lookup_record') {
                throw new Error('not now');
            }
            return '{}';
        });
        const { bible: _bible, ...factsWithoutBible } = PASSAGE_FACTS;
        seedPassageCard(factsWithoutBible, 'ASV');
        await renderWindow();
        await sendQuestion(
            'What happened before verse 20, and which people are in it?',
        );
        await waitForAsk();
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_lookup_record',
            { kind: 'verse', bible: 'ASV', ref: 'GEN 8:20', related: true },
            expect.any(AbortSignal),
        );
        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).not.toContain('Read for this question, as data');
        expect(extra.lookup.isReadForAsk).toBeUndefined();
    });

    test('a side the record does not name is not read, nor themes that are not there', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        h.callTool.mockImplementation(async (name: string) => {
            return name === 'owa_lookup_record'
                ? JSON.stringify({ passages: [{ title: 'Genesis 8:3' }] })
                : '{}';
        });
        const { bible: _bible, ...factsWithoutBible } = PASSAGE_FACTS;
        seedPassageCard(factsWithoutBible);
        await renderWindow();
        await sendQuestion('And after verse 3?');
        await waitForAsk();
        const lookupCalls = h.callTool.mock.calls.filter((call) => {
            return call[0] === 'owa_lookup_record';
        });
        expect(lookupCalls.map((call) => call[1])).toEqual([
            { kind: 'verse', ref: 'GEN 8:3', related: true },
        ]);
        expect(
            h.askLlmBot.mock.calls[0][6].lookup.isReadForAsk,
        ).toBeUndefined();
    });
});

describe('a Bible Reader question that names a chapter by number', () => {
    test('the reference aid says which words are a book, and the Reader’s tools answer', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_bible_suggest' && args.limit === 1) {
                return args.prefix === 'Matthew'
                    ? JSON.stringify({
                          suggestions: [{ label: 'Matthew', fill: 'Matthew ' }],
                      })
                    : JSON.stringify({ suggestions: [] });
            }
            return '{}';
        });
        seedSessions([
            genSession({
                focus: 'reader',
                provider: 'anthropic',
                model: 'claude-sonnet-5',
            }),
        ]);
        await renderWindow();
        await sendQuestion('Summarize Matthew 18');
        await waitForAsk();
        expect(h.callTool).toHaveBeenCalledWith('owa_bible_suggest', {
            kind: 'reference',
            prefix: 'Matthew',
            limit: 1,
        });
        expect(h.askLlmBot.mock.calls[0][6].bibleReader).toEqual({
            intent: expect.any(String),
            canSeePictures: expect.any(Boolean),
        });
    });

    test('words no Bible names as a book leave it an ordinary question', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_bible_suggest' && args.limit === 1) {
                if (args.prefix === 'Summarize Hezekiah') {
                    throw new Error('no Bible open');
                }
                return JSON.stringify({ suggestions: [] });
            }
            return '{}';
        });
        seedSessions([
            genSession({
                focus: 'reader',
                provider: 'anthropic',
                model: 'claude-sonnet-5',
            }),
        ]);
        await renderWindow();
        await sendQuestion('Summarize Hezekiah 18');
        await waitForAsk();
        expect(h.callTool).toHaveBeenCalledWith('owa_bible_suggest', {
            kind: 'reference',
            prefix: 'Hezekiah',
            limit: 1,
        });
        expect(h.askLlmBot.mock.calls[0][6].bibleReader).toBeUndefined();
    });
});

describe('a Reader question with no chapter number in it', () => {
    test('is not taken to the Bible tools, and nothing is asked of the reference aid', async () => {
        h.secret = { anthropicAPIKey: 'sk-ant-test' };
        seedSessions([
            genSession({
                focus: 'reader',
                provider: 'anthropic',
                model: 'claude-sonnet-5',
            }),
        ]);
        await renderWindow();
        await sendQuestion('Tell me about grace');
        await waitForAsk();
        expect(h.askLlmBot.mock.calls[0][6].bibleReader).toBeUndefined();
        expect(h.callTool).not.toHaveBeenCalledWith(
            'owa_bible_suggest',
            expect.objectContaining({ limit: 1 }),
        );
    });
});
