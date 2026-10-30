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

// The help window drawn whole, with its effects running: what an answer
// draws (rich text, links, buttons, thumbs, cost, songs), and everything a
// question can carry -- the 📷, the ◎, files, pastes and drops, the chips and
// the preview they open. Only the boundaries are faked -- the IPC, the
// settings store, the tool host, the clipboard and the picture decoding --
// each answering from state a test seeds.
const { mocks, state } = vi.hoisted(() => {
    return {
        mocks: {
            sendData: vi.fn(),
            openExternalURL: vi.fn(),
            electronSendAsync: vi.fn(),
            callTool: vi.fn(),
            callToolPicture: vi.fn(),
            askLlmBot: vi.fn(),
            listAllLlmModels: vi.fn(),
            captureAppWindow: vi.fn(),
            openPopupWindow: vi.fn(),
            getStarterQuestions: vi.fn(),
            getAllQuestions: vi.fn(),
            suggestQuestions: vi.fn(),
            scrollIntoView: vi.fn(),
            scrollTo: vi.fn(),
            genImageAttachment: vi.fn(),
            copyImageToClipboard: vi.fn(),
            readAssetPreview: vi.fn(),
            downloadAsset: vi.fn(),
            writeText: vi.fn(),
        },
        state: {
            settings: new Map<string, string>(),
            home: new Map<string, string>(),
            secure: new Map<string, string>(),
            listeners: new Map<string, Set<(...args: any[]) => void>>(),
            endpoints: {
                mcpUrl: 'http://127.0.0.1:39223/mcp',
                mcpToken: 'token',
                cdpPort: 9222,
            } as any,
        },
    };
});

vi.mock('../server/appProvider', () => {
    return {
        default: {
            systemUtils: { isDev: false, isGlassCapable: false },
            envUtils: { isFEUseEffectWarning: false },
            isPageScreen: false,
            settingHomePage: '/setting.html',
            messageUtils: {
                sendData: (...args: any[]) => {
                    return mocks.sendData(...args);
                },
                sendDataSync: (channel: string, data?: any) => {
                    if (channel === 'main:app:get-ai-endpoints') {
                        return state.endpoints;
                    }
                    if (
                        channel === 'main:app:client-setting' &&
                        data?.type === 'get'
                    ) {
                        return state.home.get(data.key) ?? null;
                    }
                    if (
                        channel === 'main:app:secure-setting' &&
                        data?.type === 'get'
                    ) {
                        return state.secure.get(data.key) ?? null;
                    }
                    return null;
                },
                listenForData: (
                    channel: string,
                    listener: (...args: any[]) => void,
                ) => {
                    const set = state.listeners.get(channel) ?? new Set();
                    set.add(listener);
                    state.listeners.set(channel, set);
                },
                listenOnceForData: () => {},
                removeListener: (
                    channel: string,
                    listener: (...args: any[]) => void,
                ) => {
                    state.listeners.get(channel)?.delete(listener);
                },
            },
            pathUtils: {
                sep: '/',
                join: (...parts: string[]) => {
                    return parts.join('/');
                },
                basename: (path: string) => {
                    return path.split('/').pop() ?? '';
                },
            },
            browserUtils: {
                openExternalURL: (...args: any[]) => {
                    return mocks.openExternalURL(...args);
                },
            },
        },
    };
});
vi.mock('../helper/settingHelpers', () => {
    return {
        getSetting: (key: string) => {
            return state.settings.get(key) ?? null;
        },
        getSettingForce: (key: string) => {
            return state.settings.get(key) ?? null;
        },
        setSetting: (key: string, value: string | null) => {
            if (value === null) {
                state.settings.delete(key);
            } else {
                state.settings.set(key, value);
            }
        },
        removeSetting: (key: string) => {
            state.settings.delete(key);
        },
    };
});
vi.mock('../server/electronSendHelpers', () => {
    return {
        genReturningEventName: (name: string) => {
            return `${name}-return`;
        },
        electronSendAsync: (...args: any[]) => {
            return mocks.electronSendAsync(...args);
        },
    };
});
vi.mock('../helper/appCaptureHelpers', () => {
    return {
        captureAppWindow: (...args: any[]) => {
            return mocks.captureAppWindow(...args);
        },
    };
});
vi.mock('../helper/domHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('../helper/domHelpers')>()),
        openPopupWindow: (...args: any[]) => {
            return mocks.openPopupWindow(...args);
        },
    };
});
vi.mock('./mcpClient', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('./mcpClient')>()),
        callTool: (...args: any[]) => {
            return mocks.callTool(...args);
        },
        callToolPicture: (...args: any[]) => {
            return mocks.callToolPicture(...args);
        },
    };
});
vi.mock('./llmBotHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('./llmBotHelpers')>()),
        askLlmBot: (...args: any[]) => {
            return mocks.askLlmBot(...args);
        },
        listAllLlmModels: (...args: any[]) => {
            return mocks.listAllLlmModels(...args);
        },
    };
});
vi.mock('./questionHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('./questionHelpers')>()),
        getStarterQuestions: (...args: any[]) => {
            return mocks.getStarterQuestions(...args);
        },
        getAllQuestions: (...args: any[]) => {
            return mocks.getAllQuestions(...args);
        },
        suggestQuestions: (...args: any[]) => {
            return mocks.suggestQuestions(...args);
        },
    };
});

// Pictures are decoded through a canvas jsdom does not have; the rest of the
// store (`putAttachmentData` and friends) is the real one.
vi.mock('./attachmentHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('./attachmentHelpers')>()),
        genImageAttachment: (...args: any[]) => {
            return mocks.genImageAttachment(...args);
        },
        copyImageToClipboard: (...args: any[]) => {
            return mocks.copyImageToClipboard(...args);
        },
    };
});
vi.mock('./assetPreviewHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('./assetPreviewHelpers')>()),
        readAssetPreview: (...args: any[]) => {
            return mocks.readAssetPreview(...args);
        },
        downloadAsset: (...args: any[]) => {
            return mocks.downloadAsset(...args);
        },
    };
});

import ChatbotAppComp from './ChatbotAppComp';
import {
    dropAttachmentData,
    getAttachmentData,
    putAttachmentData,
} from './attachmentHelpers';
import { keepDraftedLyric, LYRIC_CREATE_TOOL_NAME } from './lyricDraftHelpers';
import { resetSpendGuardForTests } from './spendGuardHelpers';
import { clearProgressSteps } from './progressHelpers';
import { LIST_APP_WINDOWS_CHANNEL } from './windowAimHelpers';
import {
    LLM_REGISTRY_GET_CHANNEL,
    LLM_REGISTRY_RELOAD_CHANNEL,
} from '../../electron/customLlmProtocol';

let container: HTMLDivElement;
let root: Root;
// What the registry and the window list answer, per test.
let registryStatus: any = null;
let reloadedRegistryStatus: any = null;
let windowEntryList: any[] = [];
// The ids the fake decoder hands out: img-1, img-2 …
let imageCount = 0;

function genSession(overrides: Record<string, any> = {}) {
    return {
        id: 's1',
        title: '',
        messages: [],
        draft: '',
        focus: 'presenter',
        isFocusChosen: true,
        provider: 'free',
        model: 'nvidia/nemotron-3.5-super-vl:free',
        isLocked: false,
        ...overrides,
    };
}

function seedSessions(sessions: any[], activeId?: string) {
    state.settings.set(
        'chatbot-sessions',
        JSON.stringify({ activeId: activeId ?? sessions[0].id, sessions }),
    );
}

function readSavedSessions() {
    return JSON.parse(state.settings.get('chatbot-sessions') ?? 'null');
}

async function settle(milliseconds = 0) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds);
    });
}

async function renderApp() {
    await act(async () => {
        root.render(<ChatbotAppComp />);
    });
    await settle();
}

function query<T extends Element = HTMLElement>(selector: string) {
    return container.querySelector<T>(selector as any) as T | null;
}

function queryAll<T extends Element = HTMLElement>(selector: string) {
    return [...container.querySelectorAll<T>(selector as any)] as T[];
}

function findButton(text: string) {
    return queryAll<HTMLButtonElement>('button').find((button) => {
        return button.textContent?.trim() === text;
    });
}

async function click(target: Element | null | undefined) {
    expect(target).toBeTruthy();
    await act(async () => {
        (target as HTMLElement).click();
    });
    await settle();
}

async function typeQuestion(value: string) {
    const box = query<HTMLTextAreaElement>('.chat-input')!;
    const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(box, value);
        box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle();
}

async function pressKey(
    target: Element,
    key: string,
    init: KeyboardEventInit = {},
) {
    await act(async () => {
        target.dispatchEvent(
            new KeyboardEvent('keydown', {
                key,
                bubbles: true,
                cancelable: true,
                ...init,
            }),
        );
    });
    await settle();
}

function genDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: any) => void;
    const promise = new Promise<T>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}

beforeAll(() => {
    (Element.prototype as any).scrollIntoView = function (...args: any[]) {
        return mocks.scrollIntoView(...args);
    };
    (Element.prototype as any).scrollTo = function (...args: any[]) {
        return mocks.scrollTo(...args);
    };
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            writeText: (...args: any[]) => {
                return mocks.writeText(...args);
            },
        },
    });
});

afterAll(() => {
    delete (Element.prototype as any).scrollIntoView;
    delete (Element.prototype as any).scrollTo;
    delete (navigator as any).clipboard;
});

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.settings.clear();
    state.home.clear();
    state.secure.clear();
    state.listeners.clear();
    state.endpoints = {
        mcpUrl: 'http://127.0.0.1:39223/mcp',
        mcpToken: 'token',
        cdpPort: 9222,
    };
    globalThis.localStorage?.clear();
    resetSpendGuardForTests();
    clearProgressSteps('s1');
    document.title = 'Open Worship app - Help';
    registryStatus = null;
    reloadedRegistryStatus = null;
    windowEntryList = [];
    mocks.electronSendAsync.mockImplementation(async (channel: string) => {
        if (channel === LIST_APP_WINDOWS_CHANNEL) {
            return windowEntryList;
        }
        if (channel === LLM_REGISTRY_GET_CHANNEL) {
            return registryStatus;
        }
        if (channel === LLM_REGISTRY_RELOAD_CHANNEL) {
            return reloadedRegistryStatus;
        }
        return null;
    });
    mocks.getStarterQuestions.mockResolvedValue([]);
    mocks.getAllQuestions.mockResolvedValue([]);
    mocks.suggestQuestions.mockResolvedValue([]);
    mocks.callTool.mockResolvedValue('{}');
    imageCount = 0;
    mocks.genImageAttachment.mockImplementation(
        async (source: any, name: string, filePath?: string, takenIn?: any) => {
            imageCount += 1;
            const id = `img-${imageCount}`;
            const dataUrl =
                typeof source === 'string'
                    ? source
                    : 'data:image/png;base64,QQ==';
            putAttachmentData(id, dataUrl);
            return {
                id,
                kind: 'image',
                name,
                mimeType: 'image/png',
                byteSize: dataUrl.length,
                ...(filePath ? { filePath } : {}),
                ...(takenIn ? { window: takenIn } : {}),
            };
        },
    );
    mocks.copyImageToClipboard.mockResolvedValue(undefined);
    mocks.writeText.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

const PICTURE = 'data:image/png;base64,UElDVFVSRQ==';

function genAskedMessage(overrides: Record<string, any> = {}) {
    return { id: 1, author: 'you', text: 'What is this?', ...overrides };
}

function genAnswer(overrides: Record<string, any> = {}) {
    return { id: 2, author: 'bot', text: 'An answer.', ...overrides };
}

function seedMessages(messages: any[], overrides: Record<string, any> = {}) {
    seedSessions([genSession({ messages, ...overrides })]);
}

function chipNames() {
    return queryAll('.chat-ask .chat-clip-name').map((name) => {
        return name.textContent;
    });
}

function attachError() {
    return query('.chat-attach-error')?.textContent ?? null;
}

function findPreviewTool(text: string) {
    return queryAll<HTMLButtonElement>('.chat-preview-tool').find((button) => {
        return button.textContent?.trim() === text;
    });
}

function genFile(
    parts: string[],
    name: string,
    type: string,
    appFilePath?: string,
) {
    const file = new File(parts, name, { type });
    // jsdom's File has no text(); Chromium's does.
    Object.defineProperty(file, 'text', {
        value: async () => {
            return parts.join('');
        },
    });
    if (appFilePath !== undefined) {
        Object.defineProperty(file, 'appFilePath', { value: appFilePath });
    }
    return file;
}

async function chooseFiles(files: File[]) {
    const input = query<HTMLInputElement>('.chat-file-input')!;
    Object.defineProperty(input, 'files', {
        configurable: true,
        value: files,
    });
    await act(async () => {
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
}

describe('an answer as it is drawn', () => {
    test('steps, ticks, bold, code and emphasis, and only the app’s own links open', async () => {
        seedMessages([
            genAskedMessage(),
            genAnswer({
                text:
                    '1. **Open** the `Presenter`\n' +
                    '- _quietly_ done\n' +
                    'See `https://example.org/a` or `https://example.com/b`',
                links: ['https://example.org/a'],
            }),
        ]);
        await renderApp();
        const answer = query('.cue-bot')!;
        const lines = answer.querySelectorAll('.chatbot-line');
        expect(lines[0].className).toContain('chatbot-item');
        expect(lines[0].querySelector('.chatbot-item-mark')?.textContent).toBe(
            '1.',
        );
        expect(lines[0].querySelector('strong')?.textContent).toBe('Open');
        expect(lines[0].querySelector('code')?.textContent).toBe('Presenter');
        expect(lines[1].className).toContain('chatbot-item-dot');
        expect(lines[1].querySelector('em')?.textContent).toBe('quietly');
        const links =
            answer.querySelectorAll<HTMLButtonElement>('.chatbot-link');
        expect(links).toHaveLength(1);
        expect(links[0].title).toBe(
            'Opens https://example.org/a in your browser',
        );
        expect(links[0].textContent).toBe('example.org/a');
        await click(links[0]);
        expect(mocks.openExternalURL).toHaveBeenCalledWith(
            'https://example.org/a',
        );
        // An address the app did not write stays words.
        expect(
            [...answer.querySelectorAll('code')].map((code) => {
                return code.textContent;
            }),
        ).toContain('https://example.com/b');
    });

    test('the cost line names the model and the hover carries the sums', async () => {
        seedMessages([
            genAskedMessage(),
            genAnswer({
                answeredBy: { assistant: 'Free', model: 'Nemotron Super' },
                usage: {
                    rounds: 2,
                    unpricedRounds: 0,
                    input: 1000,
                    cacheRead: 0,
                    cacheWrite: 0,
                    output: 500,
                    costUsd: 0,
                },
            }),
            genAnswer({
                id: 3,
                text: 'Another answer.',
                usage: {
                    rounds: 1,
                    unpricedRounds: 0,
                    input: 100,
                    cacheRead: 0,
                    cacheWrite: 0,
                    output: 20,
                    costUsd: 0,
                },
            }),
        ]);
        await renderApp();
        const [first, second] = queryAll('.cue-cost');
        expect(first.textContent).toMatch(
            /^Nemotron Super · .+ · 1\.5k tokens$/,
        );
        expect(first.getAttribute('title')).toMatch(
            /^Model: Free · Nemotron Super\n/,
        );
        expect(query('.cue-bot .cue-label')?.getAttribute('title')).toBe(
            'Model: Free · Nemotron Super',
        );
        // No model named: the line is the cost alone.
        expect(second.textContent).toMatch(/^[^·]+ · 120 tokens$/);
        expect(second.getAttribute('title')).not.toContain('Model:');
    });

    test('a thumb up is kept on the answer and drawn filled', async () => {
        seedMessages([genAskedMessage(), genAnswer()]);
        await renderApp();
        const like = query<HTMLButtonElement>('[aria-label="Good answer"]')!;
        expect(like.getAttribute('aria-pressed')).toBe('false');
        await click(like);
        const pressed = query('[aria-label="Good answer"]')!;
        expect(pressed.getAttribute('aria-pressed')).toBe('true');
        expect(pressed.querySelector('i')?.className).toBe(
            'bi bi-hand-thumbs-up-fill',
        );
        // A thumb up asks nothing more.
        expect(queryAll('.cue-bot')).toHaveLength(1);
        await settle(400);
        expect(readSavedSessions().sessions[0].messages[1].rating).toBe('like');
    });

    test('Copy puts the answer on the clipboard and says so, then goes back', async () => {
        seedMessages([genAskedMessage(), genAnswer({ text: 'Press F6.' })]);
        await renderApp();
        const copy = () => {
            return queryAll('.cue-bot .cue-tool').find((button) => {
                return button.getAttribute('title') === 'Copy this answer';
            })!;
        };
        await click(copy());
        expect(mocks.writeText).toHaveBeenCalledWith('Press F6.');
        expect(copy().textContent).toBe('✓ Copied');
        await settle(1600);
        expect(copy().textContent).toBe('Copy');
        mocks.writeText.mockRejectedValueOnce(new Error('denied'));
        await click(copy());
        expect(copy().textContent).toBe('Could not copy');
        // Pressed twice inside the pause: one timer, still one word.
        mocks.writeText.mockResolvedValueOnce(undefined);
        await click(copy());
        expect(copy().textContent).toBe('✓ Copied');
    });

    test('the buttons under an answer wear what they do', async () => {
        seedMessages([
            genAskedMessage(),
            genAnswer({
                actions: [
                    {
                        label: 'Show me step by step',
                        toolName: 'owa_guide_start',
                        args: { manualId: 'W-01' },
                    },
                    {
                        label: 'Do it for me',
                        toolName: 'owa_guide_start',
                        args: { mode: 'demo' },
                    },
                    {
                        label: 'Open Claude billing',
                        toolName: 'owa-open-provider-page',
                        args: { provider: 'anthropic', page: 'billing' },
                    },
                    {
                        label: 'GKHB',
                        toolName: 'owa-bible-import-step',
                        isData: true,
                        title: 'Khmer Bible',
                    },
                    {
                        label: 'List 2',
                        toolName: 'owa-bible-import-step',
                        args: { step: 'names' },
                    },
                    {
                        label: 'Put Amazing Grace on the screen',
                        toolName: 'owa-builtin',
                    },
                    {
                        label: 'Open John 3:16 in Bible Lookup',
                        toolName: 'owa_find_verse',
                        args: { title: 'John 3:16' },
                    },
                ],
            }),
        ]);
        await renderApp();
        const button = (text: string) => {
            return queryAll<HTMLButtonElement>('.cue-act').find((one) => {
                return one.textContent === text;
            })!;
        };
        expect(button('Show me step by step').className).toBe(
            'cue-act cue-act-guide',
        );
        expect(button('Do it for me').className).toBe('cue-act cue-act-demo');
        const page = button('Open Claude billing');
        expect(page.className).toBe('cue-act cue-act-page');
        expect(page.title).toBe(
            'Opens https://platform.claude.com/settings/billing in your browser',
        );
        expect(page.querySelector('.bi-box-arrow-up-right')).not.toBeNull();
        const data = button('GKHB');
        expect(data.className).toBe('cue-act cue-act-data');
        expect(data.title).toBe('Khmer Bible');
        expect(button('List 2')).toBeDefined();
        expect(button('Put Amazing Grace on the screen')).toBeDefined();
        expect(button('Open John 3:16 in Bible Lookup')).toBeDefined();
    });

    test('a drafted song is shown as it will be saved above its Create button', async () => {
        const drafted = keepDraftedLyric(
            '```open-lyric\n- Title: Amazing Grace\n```\n[v1]\nAmazing grace',
        );
        seedMessages([
            genAskedMessage(),
            genAnswer({
                actions: [
                    {
                        label: 'Create "Amazing Grace"',
                        toolName: LYRIC_CREATE_TOOL_NAME,
                        args: { reference: drafted.reference },
                    },
                ],
            }),
        ]);
        await renderApp();
        const text = query<HTMLTextAreaElement>('.cue-lyric-text')!;
        expect(text.value).toBe(drafted.content);
        expect(text.readOnly).toBe(true);
        expect(text.rows).toBe(6);
        expect(findButton('Create "Amazing Grace"')).toBeDefined();
    });

    test('a song this window no longer holds draws no preview', async () => {
        seedMessages([
            genAskedMessage(),
            genAnswer({
                actions: [
                    {
                        label: 'Create "Gone"',
                        toolName: LYRIC_CREATE_TOOL_NAME,
                        args: { reference: 'lyric-gone' },
                    },
                ],
            }),
        ]);
        await renderApp();
        expect(query('.cue-lyric')).toBeNull();
    });

    test('a Resources card keeps every reference it printed as a button', async () => {
        seedMessages([
            genAskedMessage({ text: 'Read 5' }),
            genAnswer({
                text:
                    'Matthew 5:44 — love your enemies.\n' +
                    'References: Luke 6:27; Romans 12:20\n' +
                    'From the PDF: page 2.',
                replies: ['6', 'Full chapter'],
            }),
            genAskedMessage({ id: 3, text: 'Thanks' }),
            genAnswer({ id: 4, text: 'You are welcome.' }),
        ]);
        await renderApp();
        const card = queryAll('.cue-bot')[0];
        const replies = [...card.querySelectorAll('.cue-reply')].map(
            (reply) => {
                return reply.textContent;
            },
        );
        // Not the last message, still pressable: each one names its verse.
        expect(replies).toEqual(
            expect.arrayContaining(['Luke 6:27', 'Romans 12:20', '6']),
        );
        expect(replies).toContain('Full chapter');
    });
});

describe('a question asked again', () => {
    test('the question and what it was asked with go back in the box', async () => {
        seedMessages([
            genAskedMessage({
                text: 'Explain it in simple words',
                attachments: [
                    {
                        id: 'f1',
                        kind: 'text',
                        name: 'notes.txt',
                        filePath: '/docs/notes.txt',
                        mimeType: 'text/plain',
                        byteSize: 10,
                        number: 1,
                    },
                ],
            }),
            genAnswer(),
        ]);
        await renderApp();
        query<HTMLTextAreaElement>('.chat-input')!.blur();
        await click(query('.cue-said'));
        expect(query<HTMLTextAreaElement>('.chat-input')!.value).toBe(
            'Explain it in simple words',
        );
        expect(document.activeElement).toBe(query('.chat-input'));
        expect(chipNames()).toEqual(['notes.txt']);
        expect(query('.chat-ask .chat-clip-number')?.textContent).toBe('1');
        // Asked again twice: the same file is not attached twice.
        await click(findButton('Ask again'));
        expect(chipNames()).toEqual(['notes.txt']);
        await pressKey(query('.cue-said')!, 'Enter');
        expect(chipNames()).toEqual(['notes.txt']);
    });

    test('a drag that selects the words is a copy, not an ask', async () => {
        seedMessages([genAskedMessage({ text: 'Keep this' }), genAnswer()]);
        await renderApp();
        const selection = vi.spyOn(window, 'getSelection').mockReturnValue({
            toString: () => {
                return 'Keep';
            },
        } as any);
        await click(query('.cue-said'));
        expect(query<HTMLTextAreaElement>('.chat-input')!.value).toBe('');
        selection.mockRestore();
    });
});

describe('what an answer asks to be shown', () => {
    function seedAttachRequests() {
        seedMessages([
            genAskedMessage(),
            genAnswer({
                text: 'Can you show me?',
                attachRequests: ['screenshot', 'element', 'file'],
            }),
        ]);
    }

    test('a picture of the screen becomes a numbered chip with a copy icon', async () => {
        seedAttachRequests();
        mocks.captureAppWindow.mockResolvedValue(PICTURE);
        await renderApp();
        await click(findButton('Send a picture of my screen'));
        expect(mocks.captureAppWindow).toHaveBeenCalledTimes(1);
        expect(mocks.genImageAttachment).toHaveBeenCalledWith(
            PICTURE,
            'my screen',
            undefined,
            null,
        );
        expect(chipNames()).toEqual(['my screen']);
        const chip = query('.chat-ask .chat-clip')!;
        expect(chip.querySelector('img')?.getAttribute('src')).toBe(PICTURE);
        expect(chip.querySelector('.chat-clip-number')?.textContent).toBe('1');
        expect(chip.getAttribute('title')).toBe(
            'my screen — press to see it bigger',
        );
        expect(
            chip.querySelector('.chat-clip-copy')?.getAttribute('aria-label'),
        ).toBe('Copy my screen to the clipboard');
        expect(attachError()).toBeNull();
    });

    test('pointing at a control attaches it by its selector', async () => {
        seedAttachRequests();
        mocks.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_pick_element') {
                return JSON.stringify({
                    picked: true,
                    element: {
                        labelParts: ['Clear All', 'Clear All [F6]'],
                        selector: '#clear-all',
                    },
                });
            }
            return '{}';
        });
        await renderApp();
        await click(findButton('Point at the control'));
        expect(mocks.callTool).toHaveBeenCalledWith(
            'owa_pick_element',
            {},
            null,
            null,
        );
        expect(chipNames()).toEqual(['Clear All']);
        expect(query('.chat-ask .chat-clip .bi-bullseye')).not.toBeNull();
        expect(query('.chat-ask .chat-clip')?.getAttribute('title')).toBe(
            'Clear All — press to ring it in the app',
        );
        expect(attachError()).toBeNull();
    });

    test('Attach a file opens the file picker', async () => {
        seedAttachRequests();
        await renderApp();
        const input = query<HTMLInputElement>('.chat-file-input')!;
        const picking = vi.spyOn(input, 'click').mockImplementation(() => {});
        await click(findButton('Attach a file'));
        expect(picking).toHaveBeenCalledTimes(1);
    });

    test('a picture that cannot be taken, and a pointing that fails, are said', async () => {
        seedAttachRequests();
        mocks.captureAppWindow.mockRejectedValueOnce(new Error('no frame'));
        await renderApp();
        await click(findButton('Send a picture of my screen'));
        expect(attachError()).toBe('I could not take a picture: no frame');
        mocks.captureAppWindow.mockResolvedValueOnce(PICTURE);
        mocks.genImageAttachment.mockResolvedValueOnce(null);
        await click(findButton('Send a picture of my screen'));
        expect(attachError()).toBe('I could not take a picture of the app.');
        expect(chipNames()).toEqual([]);
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ picked: false, reason: 'You pressed Escape.' }),
        );
        await click(findButton('Point at the control'));
        expect(attachError()).toBe('You pressed Escape.');
        mocks.callTool.mockResolvedValueOnce(JSON.stringify({ picked: false }));
        await click(findButton('Point at the control'));
        expect(attachError()).toBe('Nothing was picked in the app window.');
        const pending = genDeferred<string>();
        mocks.callTool.mockImplementationOnce(() => {
            return pending.promise;
        });
        await click(findButton('Point at the control'));
        // Said BEFORE the round trip: the app is live while they point.
        expect(attachError()).toBe(
            'Point at the control you mean in the app window…',
        );
        await act(async () => {
            pending.reject(new Error('the picker went away'));
        });
        await settle();
        expect(attachError()).not.toBeNull();
        expect(attachError()).not.toContain('Point at the control');
        expect(chipNames()).toEqual([]);
    });
});

describe('attaching from the box', () => {
    test('the camera, five times: only the newest four are kept, numbered on', async () => {
        mocks.captureAppWindow.mockResolvedValue(PICTURE);
        await renderApp();
        const camera = query('[aria-label="Attach a picture of the app"]');
        for (let index = 0; index < 5; index++) {
            await click(camera);
        }
        expect(chipNames()).toHaveLength(4);
        expect(
            queryAll('.chat-ask .chat-clip-number').map((number) => {
                return number.textContent;
            }),
        ).toEqual(['2', '3', '4', '5']);
        // The oldest picture's bytes went with its chip.
        expect(getAttachmentData('img-1')).toBeNull();
        expect(getAttachmentData('img-5')).toBe(PICTURE);
        await click(query('[aria-label="Remove my screen"]'));
        expect(chipNames()).toHaveLength(3);
        expect(getAttachmentData('img-2')).toBeNull();
    });

    test('files are read by kind, four at most, and what cannot be read is named', async () => {
        mocks.electronSendAsync.mockImplementation(
            async (channel: string, data: any) => {
                if (channel === 'main:app:pdf-to-chat-pages') {
                    expect(data).toEqual({ filePath: '/docs/sermon.pdf' });
                    return {
                        isSuccessful: true,
                        pageCount: 3,
                        dataUrls: [PICTURE],
                    };
                }
                return null;
            },
        );
        await renderApp();
        await chooseFiles([
            genFile(['x'], 'photo.png', 'image/png', '/pics/photo.png'),
            genFile(['line one'], 'notes.txt', 'text/plain'),
            genFile(
                [JSON.stringify({ items: [] })],
                'study.own',
                '',
                '/notes/study.own',
            ),
            genFile(
                ['%PDF'],
                'sermon.pdf',
                'application/pdf',
                '/docs/sermon.pdf',
            ),
            genFile(['zip'], 'report.docx', 'application/msword'),
        ]);
        expect(mocks.genImageAttachment).toHaveBeenCalledWith(
            expect.any(File),
            'photo.png',
            '/pics/photo.png',
        );
        expect(chipNames()).toEqual([
            'photo.png',
            'notes.txt',
            'study.own',
            'sermon.pdf',
        ]);
        expect(query('.chat-ask .bi-file-earmark-pdf')).not.toBeNull();
        // Four at most are read: the fifth was never opened.
        expect(attachError()).toBeNull();
        expect(query<HTMLInputElement>('.chat-file-input')!.value).toBe('');
        await chooseFiles([
            genFile(['zip'], 'report.docx', 'application/msword'),
        ]);
        expect(attachError()).toBe(
            'I cannot read report.docx — try a picture of it instead.',
        );
        expect(chipNames()).toHaveLength(4);
    });

    test('in a window of its own, the 📷 and the ◎ work in that window', async () => {
        windowEntryList = [
            {
                id: 'MAIN',
                title: 'Open Worship app - Presenter',
                url: 'https://localhost:3000/presenter.html',
            },
            {
                id: 'SET',
                title: 'Setting',
                url: 'https://localhost:3000/setting.html?uuid=setting',
            },
        ];
        // A tab asking about Settings, with one Settings window open.
        seedSessions([genSession({ focus: 'setting' })]);
        mocks.callToolPicture.mockResolvedValue(PICTURE);
        await renderApp();
        const aim = {
            windowId: 'SET',
            focus: 'setting',
            isSeparateWindow: false,
        };
        await click(query('[aria-label="Attach a picture of the app"]'));
        expect(mocks.captureAppWindow).not.toHaveBeenCalled();
        expect(mocks.callToolPicture).toHaveBeenCalledWith(
            'owa_screenshot',
            {},
            null,
            aim,
        );
        expect(mocks.genImageAttachment).toHaveBeenCalledWith(
            PICTURE,
            'my Settings window',
            undefined,
            {
                id: 'SET',
                page: 'setting.html?uuid=setting',
                label: 'Settings',
                isMain: false,
            },
        );
        expect(chipNames()).toEqual(['my Settings window']);
        const pointing = genDeferred<string>();
        mocks.callTool.mockImplementationOnce(() => {
            return pointing.promise;
        });
        await click(query('[aria-label="Point at a control in the app"]'));
        expect(attachError()).toBe(
            'Point at the control you mean in the Settings window…',
        );
        expect(mocks.callTool).toHaveBeenCalledWith(
            'owa_pick_element',
            {},
            null,
            aim,
        );
        await act(async () => {
            pointing.resolve(
                JSON.stringify({
                    picked: true,
                    element: { label: 'Apply', selector: '#apply' },
                }),
            );
        });
        await settle();
        expect(chipNames()).toEqual(['my Settings window', 'Apply']);
        expect(queryAll('.chat-ask .chat-clip')[1].getAttribute('title')).toBe(
            'Apply (Settings window) — press to ring it in the app',
        );
    });

    test('a picture that will not decode and a PDF with no place on disk are refused', async () => {
        mocks.genImageAttachment.mockResolvedValueOnce(null);
        await renderApp();
        await chooseFiles([
            genFile(['x'], 'broken.png', 'image/png'),
            genFile(['%PDF'], 'loose.pdf', 'application/pdf'),
        ]);
        expect(chipNames()).toEqual([]);
        expect(attachError()).toBe(
            'I cannot read broken.png, loose.pdf — try a picture of it instead.',
        );
    });

    test('a pasted picture is attached and pasted words are left to the box', async () => {
        await renderApp();
        const box = query<HTMLTextAreaElement>('.chat-input')!;
        const paste = async (items: any[]) => {
            const event = new Event('paste', {
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(event, 'clipboardData', {
                value: { items },
            });
            await act(async () => {
                box.dispatchEvent(event);
            });
            await settle();
            return event;
        };
        const wordsPaste = await paste([
            {
                kind: 'string',
                getAsFile: () => {
                    return null;
                },
            },
        ]);
        expect(wordsPaste.defaultPrevented).toBe(false);
        expect(chipNames()).toEqual([]);
        const picturePaste = await paste([
            {
                kind: 'file',
                getAsFile: () => {
                    return genFile(['x'], '', 'image/png');
                },
            },
            {
                kind: 'file',
                getAsFile: () => {
                    return null;
                },
            },
        ]);
        expect(picturePaste.defaultPrevented).toBe(true);
        // A pasted picture has no name of its own.
        expect(chipNames()).toEqual(['picture']);
    });

    test('a file dropped on the box is attached; a drop of nothing is left alone', async () => {
        await renderApp();
        const form = query('.chat-ask')!;
        const drop = async (files: File[]) => {
            const event = new Event('drop', {
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(event, 'dataTransfer', { value: { files } });
            await act(async () => {
                form.dispatchEvent(event);
            });
            await settle();
            return event;
        };
        expect((await drop([])).defaultPrevented).toBe(false);
        const dropped = await drop([
            genFile(['words'], 'order.md', 'text/markdown', '/docs/order.md'),
        ]);
        expect(dropped.defaultPrevented).toBe(true);
        expect(chipNames()).toEqual(['order.md']);
    });
});

describe('pressing a chip', () => {
    const settingsWindow = {
        id: 'SET',
        page: 'setting.html?uuid=setting',
        label: 'Settings',
        isMain: false,
    };

    test('a pointed-at control is rung in the window it was pointed at', async () => {
        windowEntryList = [
            {
                id: 'MAIN',
                title: 'Open Worship app - Presenter',
                url: 'https://localhost:3000/presenter.html',
            },
            {
                id: 'SET',
                title: 'Setting',
                url: 'https://localhost:3000/setting.html?uuid=setting',
            },
        ];
        seedMessages([
            genAskedMessage({
                attachments: [
                    {
                        id: 'e1',
                        kind: 'element',
                        name: 'Clear All',
                        selector: '#clear',
                        mimeType: 'application/x-owa-element',
                        byteSize: 0,
                        window: settingsWindow,
                    },
                ],
            }),
            genAnswer(),
        ]);
        mocks.callTool.mockResolvedValue(JSON.stringify({ found: true }));
        await renderApp();
        const chip = query('.cue-you .chat-clip')!;
        expect(chip.getAttribute('title')).toBe(
            'Clear All (Settings window) — press to ring it in the app',
        );
        await click(chip);
        expect(mocks.callTool).toHaveBeenCalledWith(
            'owa_highlight_selector',
            { selector: '#clear', page: 'SET' },
            null,
            null,
        );
        expect(attachError()).toBeNull();
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ found: false, reason: 'It is not there now.' }),
        );
        await click(chip);
        expect(attachError()).toBe('It is not there now.');
        mocks.callTool.mockResolvedValueOnce(JSON.stringify({ found: false }));
        await pressKey(chip, 'Enter');
        expect(attachError()).toBe('I could not point at that one any more.');
        mocks.callTool.mockRejectedValueOnce(new Error('host down'));
        await click(chip);
        expect(attachError()).not.toBeNull();
    });

    test('a control from before windows were kept goes the tab’s way', async () => {
        seedMessages([
            genAskedMessage({
                attachments: [
                    {
                        id: 'e2',
                        kind: 'element',
                        name: 'Bible Lookup',
                        selector: '#lookup',
                        mimeType: 'application/x-owa-element',
                        byteSize: 0,
                    },
                ],
            }),
            genAnswer(),
        ]);
        mocks.callTool.mockResolvedValue(JSON.stringify({ found: true }));
        await renderApp();
        await click(query('.cue-you .chat-clip'));
        expect(mocks.callTool).toHaveBeenCalledWith(
            'owa_highlight_selector',
            { selector: '#lookup' },
            null,
            null,
        );
    });

    test('a control with no selector is looked for by its words', async () => {
        seedMessages([
            genAskedMessage({
                attachments: [
                    {
                        id: 'e3',
                        kind: 'element',
                        name: 'Bible Properties',
                        mimeType: 'application/x-owa-element',
                        byteSize: 0,
                    },
                ],
            }),
            genAnswer(),
        ]);
        mocks.callTool.mockResolvedValueOnce(JSON.stringify({ shownCount: 1 }));
        await renderApp();
        const chip = query('.cue-you .chat-clip')!;
        await click(chip);
        expect(mocks.callTool).toHaveBeenCalledWith('owa_find_ui', {
            text: 'Bible Properties',
            highlight: true,
        });
        expect(attachError()).toBeNull();
        mocks.callTool.mockResolvedValueOnce(JSON.stringify({ shownCount: 0 }));
        await click(chip);
        expect(attachError()).toBe(
            'I could not find "Bible Properties" on screen any more.',
        );
        mocks.callTool.mockRejectedValueOnce(new Error('host down'));
        await click(chip);
        expect(attachError()).toBe(
            'I could not find "Bible Properties" on screen any more.',
        );
    });

    test('a control an answer names is looked up as the window is now', async () => {
        seedMessages([
            genAskedMessage(),
            genAnswer({
                shows: [
                    { kind: 'control', value: 'Clear All', name: 'Clear All' },
                    { kind: 'selector', value: '#x', name: 'The X button' },
                ],
            }),
        ]);
        mocks.callTool.mockResolvedValueOnce(JSON.stringify({ shownCount: 0 }));
        await renderApp();
        const [named, bySelector] = queryAll('.cue-bot .chat-clip');
        expect(named.getAttribute('title')).toBe(
            'Clear All — press to ring it in the app',
        );
        await click(named);
        expect(mocks.callTool).toHaveBeenCalledWith('owa_find_ui', {
            text: 'Clear All',
            highlight: true,
        });
        expect(attachError()).toBe('I could not find "Clear All" on screen.');
        mocks.callTool.mockRejectedValueOnce(new Error('host down'));
        await click(named);
        expect(attachError()).not.toBeNull();
        mocks.callTool.mockResolvedValueOnce(JSON.stringify({ found: true }));
        await click(bySelector);
        expect(mocks.callTool).toHaveBeenLastCalledWith(
            'owa_highlight_selector',
            { selector: '#x' },
            null,
            null,
        );
    });

    test('a picture whose bytes have gone says so and cannot be pressed', async () => {
        seedMessages([
            genAskedMessage({
                attachments: [
                    {
                        id: 'gone-1',
                        kind: 'image',
                        name: 'my screen',
                        mimeType: 'image/png',
                        byteSize: 10,
                    },
                    {
                        id: 'gone-2',
                        kind: 'image',
                        name: 'app screen',
                        mimeType: 'image/png',
                        byteSize: 10,
                    },
                    {
                        id: 'gone-3',
                        kind: 'image',
                        name: 'my Settings window',
                        mimeType: 'image/png',
                        byteSize: 10,
                        window: settingsWindow,
                    },
                ],
            }),
            genAnswer(),
        ]);
        await renderApp();
        const chips = queryAll('.cue-you .chat-clip');
        expect(
            chips.map((chip) => {
                return chip.querySelector('.chat-clip-name')?.textContent;
            }),
        ).toEqual(['my screen', 'app screen', 'my Settings window']);
        for (const chip of chips) {
            expect(chip.className).toContain('chat-clip-gone');
            expect(chip.getAttribute('role')).toBeNull();
            expect(chip.querySelector('.chat-clip-copy')).toBeNull();
        }
        expect(chips[0].getAttribute('title')).toBe(
            'my screen — not attached any more',
        );
        // "my Settings window" names its window already.
        expect(chips[2].getAttribute('title')).toBe(
            'my Settings window — not attached any more',
        );
    });

    test('a chip with nothing behind it says there is nothing to show', async () => {
        seedMessages([
            genAskedMessage({
                attachments: [
                    {
                        id: 't1',
                        kind: 'text',
                        name: 'old note',
                        mimeType: 'text/plain',
                        byteSize: 0,
                    },
                ],
            }),
            genAnswer(),
        ]);
        await renderApp();
        const chip = query('.cue-you .chat-clip')!;
        expect(chip.getAttribute('title')).toBe('old note — press to open it');
        expect(chip.querySelector('.bi-file-earmark-text')).not.toBeNull();
        await click(chip);
        expect(attachError()).toBe(
            'There is nothing left to show for that one.',
        );
    });
});

describe('the preview of an asset', () => {
    function genPreview(overrides: Record<string, any> = {}) {
        return {
            id: 'img-1',
            name: 'my screen',
            kind: 'image',
            imageDataUrl: PICTURE,
            text: null,
            filePath: null,
            byteSize: 100,
            note: null,
            ...overrides,
        };
    }

    async function openPicture() {
        mocks.captureAppWindow.mockResolvedValue(PICTURE);
        await renderApp();
        await click(query('[aria-label="Attach a picture of the app"]'));
        await click(query('.chat-ask .chat-clip'));
    }

    test('a picture opens big, takes the keyboard, and Copy says it copied', async () => {
        mocks.readAssetPreview.mockResolvedValue(genPreview());
        await openPicture();
        expect(mocks.readAssetPreview).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'img-1', name: 'my screen' }),
        );
        const preview = query('.chat-preview')!;
        expect(preview.querySelector('img')?.getAttribute('alt')).toBe(
            'my screen',
        );
        expect(document.activeElement).toBe(preview);
        await click(findPreviewTool('Copy'));
        expect(mocks.copyImageToClipboard).toHaveBeenCalledWith(PICTURE);
        expect(attachError()).toBe('Copied.');
        mocks.copyImageToClipboard.mockRejectedValueOnce(new Error('denied'));
        await click(findPreviewTool('Copy'));
        expect(attachError()).toBe('I could not copy it: denied');
    });

    test('Escape closes it first and hands the keyboard back', async () => {
        mocks.readAssetPreview.mockResolvedValue(genPreview());
        mocks.captureAppWindow.mockResolvedValue(PICTURE);
        await renderApp();
        await click(query('[aria-label="Attach a picture of the app"]'));
        const chip = query<HTMLElement>('.chat-ask .chat-clip')!;
        chip.focus();
        await click(chip);
        expect(query('.chat-preview')).not.toBeNull();
        await act(async () => {
            window.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape' }),
            );
        });
        await settle();
        expect(query('.chat-preview')).toBeNull();
        expect(document.activeElement).toBe(chip);
    });

    test('words are shown as a document and copied as words', async () => {
        mocks.readAssetPreview.mockResolvedValue(
            genPreview({
                id: 't1',
                name: 'notes.txt',
                kind: 'text',
                imageDataUrl: null,
                text: 'line one',
            }),
        );
        seedMessages([
            genAskedMessage({
                attachments: [
                    {
                        id: 't1',
                        kind: 'text',
                        name: 'notes.txt',
                        filePath: '/docs/notes.txt',
                        mimeType: 'text/plain',
                        byteSize: 8,
                    },
                ],
            }),
            genAnswer(),
        ]);
        await renderApp();
        await click(query('.cue-you .chat-clip'));
        const text = query('.chat-preview-text')!;
        expect(text.textContent).toBe('line one');
        expect(text.getAttribute('aria-label')).toBe('notes.txt');
        // Selecting a line of it does not close it.
        await click(text);
        expect(query('.chat-preview')).not.toBeNull();
        await click(findPreviewTool('Copy'));
        expect(mocks.writeText).toHaveBeenCalledWith('line one');
        expect(attachError()).toBe('Copied.');
    });

    test('a file it cannot draw is a card, and Download says where it went', async () => {
        mocks.readAssetPreview.mockResolvedValue(
            genPreview({
                id: 'f1',
                name: 'sermon.pdf',
                kind: 'file',
                imageDataUrl: null,
                filePath: '/docs/sermon.pdf',
                byteSize: 2048,
            }),
        );
        mocks.downloadAsset.mockResolvedValueOnce({
            message: 'Saved sermon.pdf in Downloads.',
        });
        seedMessages([
            genAskedMessage({
                attachments: [
                    {
                        id: 'f1',
                        kind: 'file',
                        name: 'sermon.pdf',
                        filePath: '/docs/sermon.pdf',
                        mimeType: 'application/pdf',
                        byteSize: 2048,
                    },
                ],
            }),
            genAnswer(),
        ]);
        await renderApp();
        await click(query('.cue-you .chat-clip'));
        expect(query('.chat-preview-card-name')?.textContent).toBe(
            'sermon.pdf',
        );
        expect(query('.chat-preview-card-size')?.textContent).toBe('2 KB');
        expect(query('.chat-preview-card-note')?.textContent).toBe(
            'This window cannot show this kind of file. Download it or open its folder to look at it.',
        );
        // Nothing to copy off a card.
        expect(findPreviewTool('Copy')).toBeUndefined();
        await click(findPreviewTool('Download'));
        expect(query('.chat-preview')).toBeNull();
        expect(mocks.downloadAsset).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'sermon.pdf' }),
        );
        expect(attachError()).toBe('Saved sermon.pdf in Downloads.');
        mocks.downloadAsset.mockRejectedValueOnce(new Error('disk full'));
        await click(query('.cue-you .chat-clip'));
        await click(findPreviewTool('Download'));
        expect(attachError()).toBe('I could not download it: disk full');
    });

    test('a card says what is missing in its own words', async () => {
        mocks.readAssetPreview.mockResolvedValue(
            genPreview({
                id: 'f2',
                name: 'huge.png',
                kind: 'file',
                imageDataUrl: null,
                byteSize: null,
                note: 'It is too big to show here.',
            }),
        );
        seedMessages([
            genAskedMessage({
                attachments: [
                    {
                        id: 'f2',
                        kind: 'image',
                        name: 'huge.png',
                        filePath: '/pics/huge.png',
                        mimeType: 'image/png',
                        byteSize: 20000000,
                    },
                ],
            }),
            genAnswer(),
        ]);
        await renderApp();
        const chip = query('.cue-you .chat-clip')!;
        // Its bytes are gone, but it came from disk: there is still a file.
        expect(chip.className).toContain('chat-clip-gone');
        expect(chip.getAttribute('role')).toBe('button');
        expect(chip.querySelector('.bi-image')).not.toBeNull();
        await click(chip);
        expect(query('.chat-preview-card-size')).toBeNull();
        expect(query('.chat-preview-card-note')?.textContent).toBe(
            'It is too big to show here.',
        );
    });
});

describe('the copy icon on a picture chip', () => {
    async function snapOne() {
        mocks.captureAppWindow.mockResolvedValue(PICTURE);
        await renderApp();
        await click(query('[aria-label="Attach a picture of the app"]'));
        return query<HTMLButtonElement>('.chat-ask .chat-clip-copy')!;
    }

    test('copies the picture without opening it, and says how it went', async () => {
        const icon = await snapOne();
        await click(icon);
        expect(mocks.copyImageToClipboard).toHaveBeenCalledWith(PICTURE);
        expect(mocks.readAssetPreview).not.toHaveBeenCalled();
        expect(icon.className).toBe('chat-clip-copy chat-clip-copy-done');
        expect(icon.title).toBe('Copied');
        expect(icon.querySelector('.bi-check2')).not.toBeNull();
        await settle(1600);
        expect(icon.className).toBe('chat-clip-copy');
        mocks.copyImageToClipboard.mockRejectedValueOnce(new Error('denied'));
        await click(icon);
        expect(icon.className).toBe('chat-clip-copy chat-clip-copy-failed');
        expect(icon.title).toBe('Could not copy the picture');
        expect(icon.querySelector('.bi-x-lg')).not.toBeNull();
        // Enter on the icon is not Enter on the chip.
        await pressKey(icon, 'Enter');
        expect(mocks.readAssetPreview).not.toHaveBeenCalled();
    });

    test('a picture let go of since it was drawn cannot be copied', async () => {
        const icon = await snapOne();
        dropAttachmentData('img-1');
        await click(icon);
        expect(mocks.copyImageToClipboard).not.toHaveBeenCalled();
        expect(icon.className).toBe('chat-clip-copy chat-clip-copy-failed');
    });
});

describe('what a tab is still asking about', () => {
    test('a file asked about stays open above the box until its × is pressed', async () => {
        seedMessages([
            genAskedMessage({
                attachments: [
                    {
                        id: 'f1',
                        kind: 'file',
                        name: 'sermon.pdf',
                        filePath: '/docs/sermon.pdf',
                        mimeType: 'application/pdf',
                        byteSize: 2048,
                    },
                ],
            }),
            genAnswer(),
        ]);
        await renderApp();
        const line = () => {
            return queryAll('.chat-open-files').find((one) => {
                return one.textContent?.includes('sermon.pdf');
            });
        };
        expect(line()?.textContent).toContain('Still asking about');
        await click(line()!.querySelector('.chat-clip-x'));
        expect(line()).toBeUndefined();
        await settle(400);
        expect(readSavedSessions().sessions[0].fileClosedAt).toBe(2);
    });

    test('a person asked about from a lookup card is put away by its ×', async () => {
        mocks.suggestQuestions.mockResolvedValue([
            { id: 'q1', text: 'How do I add Noah?', sectionLabel: 'Help' },
        ]);
        seedMessages([
            genAnswer({
                id: 1,
                text: 'Noah, a man of the flood.',
                lookup: {
                    kind: 'name',
                    target: 'noah-1',
                    title: 'Noah',
                    facts: '{"name":"Noah"}',
                },
            }),
        ]);
        await renderApp();
        const line = () => {
            return queryAll('.chat-open-files').find((one) => {
                return one.textContent?.includes('Noah');
            });
        };
        expect(line()?.querySelector('.bi-person-fill')).not.toBeNull();
        // A line typed under it is about him: no app questions offered.
        await typeQuestion('how old was he');
        expect(query('.chat-suggests')).toBeNull();
        await click(line()!.querySelector('[aria-label="Remove Noah"]'));
        expect(line()).toBeUndefined();
        await typeQuestion('how old was he?');
        expect(queryAll('.chat-suggest-text')[0]?.textContent).toBe(
            'How do I add Noah?',
        );
    });
});
