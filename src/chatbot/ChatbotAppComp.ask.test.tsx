// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The model branch of `handleAsking` and what answers a press under it: the
// assistant answering, failing, stopped, standing in, handing on and being
// translated for -- reached the way a volunteer reaches it, by typing in the
// box and pressing Send. The provider, the tool host and the offline guide
// are the boundaries, mocked here; everything between them is the real code.
const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    llm: {
        available: ['anthropic', 'free'] as string[],
        chosen: 'anthropic' as string | null,
        isAuto: false,
    },
    askLlmBot: vi.fn(),
    callTool: vi.fn(),
    askHelpBot: vi.fn(),
    findKnownQuestion: vi.fn(),
    readKnownQuestionPage: vi.fn(),
    resolveAutoPicks: vi.fn(),
    resolveHandOnPicks: vi.fn(),
    guessAutoPick: vi.fn(),
    openPopupWindow: vi.fn(),
    openExternalURL: vi.fn(),
    sendData: vi.fn(),
    sendDataSync: vi.fn(),
    copyImageToClipboard: vi.fn(),
    downloadAsset: vi.fn(),
    showFileOrDirExplorer: vi.fn(),
    pictureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    // The listeners the window registers for messages from other windows,
    // by channel, so a test can deliver one.
    listeners: new Map<string, (...args: any[]) => void>(),
    // The window's effects that run: none but the subscriptions a test
    // names by their channel (the window list, the registry and the tips
    // stay off).
    effectChannels: [] as string[],
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false, isGlassCapable: false },
        messageUtils: {
            sendData: (...args: any[]) => h.sendData(...args),
            sendDataSync: (channel: string) => h.sendDataSync(channel),
            listenForData: (
                channel: string,
                listener: (...args: any[]) => void,
            ) => {
                h.listeners.set(channel, listener);
            },
            removeListener: (channel: string) => {
                h.listeners.delete(channel);
            },
        },
        browserUtils: {
            openExternalURL: (url: string) => h.openExternalURL(url),
        },
        appUtils: { handleError: () => {} },
        pathUtils: { sep: '/', join: (...parts: string[]) => parts.join('/') },
        settingHomePage: '/setting.html',
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    getSettingForce: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settings.set(key, value);
    },
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('../helper/appHooks', async (importOriginal) => {
    const { useEffect } = await import('react');
    return {
        ...(await importOriginal<typeof import('../helper/appHooks')>()),
        // Startup subscriptions do not run: the tests drive the window by
        // its own controls. A subscription a test delivers a message to is
        // switched on by the channel it listens on.
        useAppEffect: (effect: () => any, deps?: readonly unknown[]) => {
            useEffect(() => {
                const source = String(effect);
                return h.effectChannels.some((channel) => {
                    return source.includes(channel);
                })
                    ? effect()
                    : undefined;
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
        },
    };
});
vi.mock('../helper/domHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../helper/domHelpers')>()),
    openPopupWindow: (...args: any[]) => h.openPopupWindow(...args),
}));
vi.mock('./llmBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./llmBotHelpers')>()),
    askLlmBot: (...args: any[]) => h.askLlmBot(...args),
    getAvailableLlmProviders: () => [...h.llm.available],
    getLlmProvider: () => h.llm.chosen,
    getIsLlmAuto: () => h.llm.isAuto,
}));
vi.mock('./mcpClient', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./mcpClient')>()),
    callTool: (...args: any[]) => h.callTool(...args),
}));
vi.mock('./helpBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./helpBotHelpers')>()),
    askHelpBot: (...args: any[]) => h.askHelpBot(...args),
}));
vi.mock('./questionHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./questionHelpers')>()),
    findKnownQuestion: (...args: any[]) => h.findKnownQuestion(...args),
    findTemplateAsk: async () => null,
    readKnownQuestionPage: (...args: any[]) => h.readKnownQuestionPage(...args),
    genFollowUpQuestions: async () => [],
    suggestQuestions: async () => [],
}));
vi.mock('./autoAssistantSourceHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./autoAssistantSourceHelpers')>()),
    resolveAutoPicks: (...args: any[]) => h.resolveAutoPicks(...args),
    resolveHandOnPicks: (...args: any[]) => h.resolveHandOnPicks(...args),
    guessAutoPick: () => h.guessAutoPick(),
    clearAutoAwayServers: () => {},
}));
vi.mock('./attachmentHelpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./attachmentHelpers')>();
    return {
        ...actual,
        // jsdom decodes no picture: the bytes are kept as they came, in the
        // window's own store, so everything downstream reads them as usual.
        genImageAttachment: async (
            _source: Blob | string,
            name: string,
            filePath?: string,
        ) => {
            const id = actual.genAttachmentId();
            actual.putAttachmentData(id, h.pictureDataUrl);
            return {
                id,
                kind: 'image' as const,
                name,
                mimeType: 'image/png',
                byteSize: 68,
                ...(filePath ? { filePath } : {}),
            };
        },
        copyImageToClipboard: (dataUrl: string) =>
            h.copyImageToClipboard(dataUrl),
    };
});
vi.mock('./fileAttachHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./fileAttachHelpers')>()),
    // The Resources folders on this machine: one, `/res/pdf`, read as the
    // panel names its files (`pdf/MAT.18.pdf`).
    findResourceFileNames: (
        attachments: { filePath?: string; name: string }[],
    ) =>
        attachments
            .filter((one) => one.filePath?.startsWith('/res/pdf/') === true)
            .map((one) => `pdf/${one.name}`),
    reloadFileAttachment: async () => {},
}));
vi.mock('./assetPreviewHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./assetPreviewHelpers')>()),
    downloadAsset: (...args: any[]) => h.downloadAsset(...args),
}));
vi.mock('../server/appHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../server/appHelpers')>()),
    showFileOrDirExplorer: (filePath: string) =>
        h.showFileOrDirExplorer(filePath),
}));

import ChatbotAppComp from './ChatbotAppComp';
import { AskCancelledError } from './cancelHelpers';
import { ToolHostError } from './mcpClient';
import { recordSpendRound, resetSpendGuardForTests } from './spendGuardHelpers';

const FREE_SEEING = {
    provider: 'free' as const,
    model: 'nvidia/nemotron-3.5-super-vl:free',
    serverId: null,
    label: 'Free · Nemotron Super VL',
    modelName: 'nvidia/nemotron-3.5-super-vl:free',
    canSeeImages: true,
};
const FREE_LIGHTNING = {
    provider: 'free' as const,
    model: 'nvidia/nemotron-3.5-lightning:free',
    serverId: null,
    label: 'Free · Nemotron Lightning',
    modelName: 'nvidia/nemotron-3.5-lightning:free',
    canSeeImages: false,
};
const GEMMA_TRANSLATOR = {
    provider: 'custom' as const,
    model: 'srv/gemma',
    serverId: 'srv',
    label: 'Church PC · gemma-4-e4b',
    modelName: 'gemma-4-e4b',
    canSeeImages: false,
};

const KHMER_QUESTION = 'តើខ្ញុំប្តូរផ្ទៃខាងក្រោយដោយរបៀបណា?';
const KHMER_ANSWER = 'បើកផ្ទាំងផ្ទៃខាងក្រោយ ហើយជ្រើសពណ៌។';
const KHMER_OPTION = 'បង្ហាញខ្ញុំ';
const ENGLISH_PAGE = [
    '# Change the background',
    '',
    '1. Open the **Background** panel.',
    '2. Pick a colour.',
].join('\n');
const KHMER_PAGE = [
    '# ប្តូរផ្ទៃខាងក្រោយ',
    '',
    '1. បើកផ្ទាំង **ផ្ទៃខាងក្រោយ**។',
    '2. ជ្រើសពណ៌។',
].join('\n');
const KNOWN_ROW = {
    id: 'background',
    text: 'How do I change the background?',
    page: 'presenter',
    pageLabel: 'Presenter',
    section: 'background',
    sectionLabel: 'Background',
    focus: 'presenter',
    resources: { recipe: 'W-06', find: 'Background' },
};
const FOUND_VERSES = {
    bible: 'KJV',
    total: 3,
    verses: [
        {
            key: 'MAT 5:44',
            ref: 'Matthew 5:44',
            text: 'But I say unto you, Love your enemies, bless them that curse you',
        },
    ],
};

type SeedMessageType = Record<string, any>;

function seedSession(
    messages: SeedMessageType[] = [],
    overrides: Record<string, any> = {},
) {
    h.settings.set(
        'chatbot-sessions',
        JSON.stringify({
            activeId: 'tab',
            sessions: [
                {
                    id: 'tab',
                    title: '',
                    messages: messages.map((message, index) => {
                        return { id: index + 1, ...message };
                    }),
                    draft: '',
                    focus: 'presenter',
                    isFocusChosen: true,
                    provider: 'anthropic',
                    model: 'claude-opus-5',
                    isLocked: false,
                    ...overrides,
                },
            ],
        }),
    );
}

describe('the help window asking its assistant', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        h.settings.clear();
        h.llm.available = ['anthropic', 'free'];
        h.llm.chosen = 'anthropic';
        h.llm.isAuto = false;
        h.askLlmBot.mockResolvedValue({ text: 'An answer.' });
        h.callTool.mockRejectedValue(new Error('no tool host here'));
        h.askHelpBot.mockResolvedValue({
            text: 'The guide says: open the Background panel.',
        });
        h.findKnownQuestion.mockResolvedValue(null);
        h.readKnownQuestionPage.mockResolvedValue(null);
        h.resolveAutoPicks.mockResolvedValue([]);
        h.resolveHandOnPicks.mockResolvedValue(null);
        h.guessAutoPick.mockReturnValue(null);
        h.sendDataSync.mockReturnValue(null);
        h.copyImageToClipboard.mockResolvedValue(undefined);
        h.downloadAsset.mockResolvedValue({
            filePath: '/downloads/screen.png',
            message: 'Saved a copy in your Downloads folder.',
        });
        h.listeners.clear();
        h.effectChannels = [];
        resetSpendGuardForTests();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        h.settings.clear();
        document.documentElement.lang = '';
        resetSpendGuardForTests();
        vi.unstubAllGlobals();
    });

    function render() {
        act(() => root.render(<ChatbotAppComp />));
    }

    // Every await of an ask, and the timers a sequence hops on.
    async function settle() {
        for (let index = 0; index < 2; index += 1) {
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 0));
            });
        }
    }

    function typeQuestion(value: string) {
        const box =
            container.querySelector<HTMLTextAreaElement>('.chat-input')!;
        const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value',
        )!.set!;
        act(() => {
            setter.call(box, value);
            box.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    async function ask(value: string) {
        typeQuestion(value);
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-send')!.click();
        });
        await settle();
    }

    async function attachPicture(filePath?: string) {
        const input =
            container.querySelector<HTMLInputElement>('.chat-file-input')!;
        const file = new File(['png'], 'screen.png', { type: 'image/png' });
        if (filePath !== undefined) {
            // The electron preload's getter, for a file from the disk.
            Object.defineProperty(file, 'appFilePath', { value: filePath });
        }
        Object.defineProperty(input, 'files', {
            configurable: true,
            value: [file],
        });
        await act(async () => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await settle();
    }

    function botMessages() {
        return [...container.querySelectorAll('.cue-bot')];
    }

    function lastBot() {
        return botMessages().at(-1)!;
    }

    function replyTexts(scope: ParentNode) {
        return [...scope.querySelectorAll('.cue-reply')].map((one) => {
            return one.textContent;
        });
    }

    function findButton(text: string, scope: ParentNode = container) {
        return [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
            (button) => {
                return button.textContent?.trim() === text;
            },
        );
    }

    async function press(text: string, scope: ParentNode = container) {
        const button = findButton(text, scope);
        expect(button, `a button reading "${text}"`).toBeDefined();
        await act(async () => {
            button!.click();
        });
        await settle();
    }

    test('a typed question goes to the tab’s own assistant and its answer is drawn with the cost and options', async () => {
        h.askLlmBot.mockImplementation(
            async (
                _q: string,
                _f: string,
                provider: string,
                model: string,
                _t: any,
                _s: any,
                extra: any,
            ) => {
                extra.onUsage({
                    provider,
                    model,
                    input: 1200,
                    cacheRead: 0,
                    cacheWrite: 0,
                    output: 300,
                });
                return {
                    text: 'Open the **Background** panel and pick a colour.',
                    replies: ['Show me how'],
                };
            },
        );
        seedSession();
        render();
        await ask('How do I change the background?');

        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        const [asked, focus, provider, model, turns, signal, extra] =
            h.askLlmBot.mock.calls[0];
        expect(asked).toContain('How do I change the background?');
        expect(focus).toBe('presenter');
        expect(provider).toBe('anthropic');
        expect(model).toBe('claude-opus-5');
        expect(turns).toEqual([]);
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(extra.askedText).toBe('How do I change the background?');
        expect(extra.replyLang).toBe('en');
        expect(typeof extra.takeAdditions).toBe('function');

        const answer = lastBot();
        expect(answer.textContent).toContain('pick a colour');
        // The model's own option is the one button under it.
        expect(
            [...answer.querySelectorAll('.cue-reply')].map((one) => {
                return one.textContent;
            }),
        ).toEqual(['Show me how']);
        // What this answer cost, named by the model that answered it.
        expect(answer.querySelector('.cue-cost')?.textContent).toContain(
            'Opus 5',
        );
        // The box is empty again and the window is not busy.
        expect(
            container.querySelector<HTMLTextAreaElement>('.chat-input')!.value,
        ).toBe('');
        expect(container.querySelector('.chat-stop')).toBeNull();
    });

    test('the tab’s earlier turns ride with the question, the window’s own follow-ups do not', async () => {
        seedSession([
            { author: 'you', text: 'Where is Clear All?' },
            { author: 'bot', text: 'At the top of the Presenter.' },
            {
                author: 'bot',
                text: 'Sorry that did not help.',
                isFollowUp: true,
            },
        ]);
        render();
        await ask('And where is the screen list?');
        const turns = h.askLlmBot.mock.calls[0][4];
        expect(turns.map((turn: any) => turn.text)).toEqual([
            'Where is Clear All?',
            'At the top of the Presenter.',
        ]);
    });

    test('a provider that fails hands the question to the guide, with the reason and the door to its billing', async () => {
        h.askLlmBot.mockRejectedValue(
            Object.assign(new Error('the account is out of credit'), {
                cause: { status: 429 },
            }),
        );
        seedSession();
        render();
        await ask('How do I change the background?');

        expect(h.askHelpBot).toHaveBeenCalledWith(
            'How do I change the background?',
            'presenter',
            [],
        );
        const answer = lastBot();
        expect(answer.querySelector('.cue-note')?.textContent).toBe(
            'Claude could not answer — the account is out of credit. ' +
                "Here is what the app's own guide says.",
        );
        expect(answer.textContent).toContain(
            'The guide says: open the Background panel.',
        );
        // A 429 is an empty account as often as a rate limit: both doors.
        expect(findButton('Open Claude billing', answer)).toBeDefined();
        expect(findButton('Open Claude usage limits', answer)).toBeDefined();

        // The door opens the page in the browser and says so.
        await press('Open Claude billing', answer);
        expect(h.openExternalURL).toHaveBeenCalledTimes(1);
        const url = h.openExternalURL.mock.calls[0][0];
        expect(url).toMatch(/^https:\/\//);
        expect(lastBot().textContent).toContain(
            `Opening ${url} in your browser.`,
        );
    });

    test('the app’s own tool host failing is said in its own sentence, not blamed on the provider', async () => {
        h.askLlmBot.mockRejectedValue(new ToolHostError(500));
        seedSession();
        render();
        await ask('How do I change the background?');
        const note = lastBot().querySelector('.cue-note')?.textContent ?? '';
        expect(
            note.startsWith("The app's own help service did not respond."),
        ).toBe(true);
        expect(note).not.toContain('Claude could not answer');
        expect(note).toContain("Here is what the app's own guide says.");
    });

    test('a question with no assistant at all is answered by the guide alone', async () => {
        h.llm.available = [];
        h.llm.chosen = null;
        seedSession([], { provider: null, model: '' });
        render();
        await ask('How do I change the background?');
        expect(h.askLlmBot).not.toHaveBeenCalled();
        expect(h.askHelpBot).toHaveBeenCalledTimes(1);
        expect(lastBot().textContent).toContain(
            'The guide says: open the Background panel.',
        );
        expect(lastBot().querySelector('.cue-note')).toBeNull();
    });

    test('a general question with no assistant says it needs one and opens the AI settings', async () => {
        h.llm.available = [];
        h.llm.chosen = null;
        seedSession([], { provider: null, model: '' });
        render();
        await ask('/btw what is the Bible?');
        expect(h.askHelpBot).not.toHaveBeenCalled();
        expect(lastBot().textContent).toContain(
            'A general question needs an assistant',
        );
        await press('Open AI settings', lastBot());
        expect(h.openPopupWindow).toHaveBeenCalledTimes(1);
        expect(h.openPopupWindow.mock.calls[0][2]).toBe('setting');
        expect(h.settings.get('setting-tabs')).toBe('a');
        expect(
            JSON.parse(h.settings.get('setting-ai-key-focus') ?? '{}').keyName,
        ).toBeNull();
    });

    test('a general question goes to the model as one, and keeps only the model’s own options', async () => {
        h.askLlmBot.mockResolvedValue({
            text: 'The Bible is a collection of books.',
            replies: ['Tell me more', 'Who wrote it?'],
        });
        seedSession();
        render();
        await ask('/btw what is the Bible?');
        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain('what is the Bible?');
        expect(extra.isGeneral).toBe(true);
        expect(
            [...lastBot().querySelectorAll('.cue-reply')].map((one) => {
                return one.textContent;
            }),
        ).toEqual(['Tell me more', 'Who wrote it?']);
    });

    test('Stop ends the wait with one line, and the guide is not asked behind it', async () => {
        h.askLlmBot.mockImplementation(
            (
                _q: string,
                _f: string,
                _p: string,
                _m: string,
                _t: any,
                signal: AbortSignal,
            ) => {
                return new Promise((_resolve, reject) => {
                    signal.addEventListener('abort', () => {
                        reject(new AskCancelledError());
                    });
                });
            },
        );
        seedSession();
        render();
        await ask('How do I change the background?');
        const stop = container.querySelector<HTMLButtonElement>('.chat-stop');
        expect(stop).not.toBeNull();
        await act(async () => {
            stop!.click();
        });
        await settle();
        expect(botMessages()).toHaveLength(1);
        expect(lastBot().textContent).toContain(
            'Stopped. I did not finish looking that up',
        );
        expect(h.askHelpBot).not.toHaveBeenCalled();
        expect(container.querySelector('.chat-stop')).toBeNull();
    });

    test('words added while it works are folded into the loop when it takes them', async () => {
        let release: (value: unknown) => void = () => {};
        let extraSeen: any = null;
        h.askLlmBot.mockImplementation(
            (
                _q: string,
                _f: string,
                _p: string,
                _m: string,
                _t: any,
                _s: any,
                extra: any,
            ) => {
                extraSeen = extra;
                return new Promise((resolve) => {
                    release = resolve;
                });
            },
        );
        seedSession();
        render();
        await ask('How do I change the background?');
        typeQuestion('It is for Sunday');
        // Busy: the press that would ask now ADDS.
        const add = container.querySelector<HTMLButtonElement>('.chat-add');
        expect(add).not.toBeNull();
        await act(async () => {
            add!.click();
        });
        expect(container.textContent).toContain('Added while it was working.');
        // The loop pulls the addition between rounds.
        expect(extraSeen.takeAdditions()).toEqual(['It is for Sunday']);
        await act(async () => {
            release({ text: 'Folded in.' });
        });
        await settle();
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        expect(lastBot().textContent).toContain('Folded in.');
    });

    test('words added too late are asked on their own, said so on the answer', async () => {
        let release: (value: unknown) => void = () => {};
        h.askLlmBot.mockImplementationOnce(() => {
            return new Promise((resolve) => {
                release = resolve;
            });
        });
        h.askLlmBot.mockResolvedValue({ text: 'Asked on its own.' });
        seedSession();
        render();
        await ask('How do I change the background?');
        typeQuestion('Also the font');
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-add')!.click();
        });
        await act(async () => {
            release({ text: 'First answer.' });
        });
        await settle();
        expect(h.askLlmBot).toHaveBeenCalledTimes(2);
        expect(h.askLlmBot.mock.calls[1][0]).toContain('Also the font');
        const answer = lastBot();
        expect(answer.textContent).toContain('Asked on its own.');
        expect(answer.querySelector('.cue-note')?.textContent).toContain(
            'You added that after I had finished looking',
        );
        // Not echoed a second time: the words appear once, as added.
        const asked = [...container.querySelectorAll('.cue-you')].map((one) => {
            return one.querySelector('.cue-said')?.textContent;
        });
        expect(asked).toEqual([
            'How do I change the background?',
            'Also the font',
        ]);
    });

    test('a spend pause answers from the guide with the one button that lifts it, which asks again', async () => {
        h.askLlmBot.mockRejectedValueOnce(
            Object.assign(
                new Error('The assistant is paused: it reached the $1 limit.'),
                { name: 'SpendLimitError' },
            ),
        );
        h.askLlmBot.mockResolvedValue({
            text: 'Asked again after Allow more.',
        });
        seedSession();
        render();
        await ask('How do I change the background?');
        const answer = lastBot();
        expect(answer.querySelector('.cue-note')?.textContent).toBe(
            'The assistant is paused: it reached the $1 limit. ' +
                "Here is what the app's own guide says.",
        );
        expect(answer.textContent).toContain('The guide says');
        await press('Allow more', answer);
        const said = botMessages().map((one) => one.textContent ?? '');
        expect(
            said.some((text) => {
                return (
                    text.includes('Carrying on: the hour starts again') &&
                    text.includes('Asking your question again.')
                );
            }),
        ).toBe(true);
        expect(h.askLlmBot).toHaveBeenCalledTimes(2);
        expect(h.askLlmBot.mock.calls[1][0]).toContain(
            'How do I change the background?',
        );
        expect(lastBot().textContent).toContain(
            'Asked again after Allow more.',
        );
        // Lifted by the press, written to the ledger.
        expect(
            JSON.parse(h.settings.get('chatbot-spend-ledger') ?? '{}')
                .trippedAt,
        ).toBeNull();
    });

    test('another key standing in is said, its failed one gets the door, and the tab moves to it', async () => {
        h.llm.available = ['anthropic', 'openai', 'free'];
        h.askLlmBot.mockResolvedValue({
            text: 'ChatGPT answered this.',
            standIn: {
                provider: 'openai',
                model: 'gpt-5',
                failedProvider: 'anthropic',
                reason: 'the account is out of credit',
                issue: 'noCredit',
            },
        });
        seedSession();
        render();
        await ask('How do I change the background?');
        const answer = lastBot();
        expect(answer.querySelector('.cue-note')?.textContent).toBe(
            'Claude could not answer — the account is out of credit. ' +
                'ChatGPT answered instead and this chat now uses it; pick ' +
                'Claude in the row above to switch back.',
        );
        expect(findButton('Open Claude billing', answer)).toBeDefined();
        // The head row now shows who answered.
        expect(
            container.querySelector<HTMLSelectElement>(
                '[aria-label="Which model answers"]',
            )?.value,
        ).toBe('gpt-5');
    });

    test('on Auto, a pick that fails before answering hands the question to the next, and the tab names who answered', async () => {
        h.llm.isAuto = true;
        h.guessAutoPick.mockReturnValue(FREE_SEEING);
        h.resolveAutoPicks.mockResolvedValue([FREE_LIGHTNING, FREE_SEEING]);
        h.askLlmBot.mockImplementation(
            async (_q: string, _f: string, _p: string, model: string) => {
                if (model === FREE_LIGHTNING.model) {
                    throw new Error('the free pool is full.');
                }
                return { text: 'Nemotron answered.' };
            },
        );
        seedSession([], {
            provider: 'free',
            model: FREE_SEEING.model,
            isAuto: true,
        });
        render();
        await ask('How do I change the background?');
        expect(h.resolveAutoPicks).toHaveBeenCalledTimes(1);
        expect(h.resolveAutoPicks.mock.calls[0][0]).toMatchObject({
            needsImages: false,
            isGeneral: false,
            busyKeys: [],
        });
        expect(h.askLlmBot.mock.calls.map((call) => call[3])).toEqual([
            FREE_LIGHTNING.model,
            FREE_SEEING.model,
        ]);
        const answer = lastBot();
        expect(answer.textContent).toContain('Nemotron answered.');
        expect(answer.querySelector('.cue-note')?.textContent).toBe(
            'Free · Nemotron Lightning could not answer — the free pool is ' +
                'full. Auto asked Free · Nemotron Super VL instead.',
        );
        expect(container.textContent).toContain('Free · Nemotron Super VL');
    });

    test('on Auto with nobody able to answer, the note names Auto and the guide answers', async () => {
        h.llm.isAuto = true;
        h.guessAutoPick.mockReturnValue(FREE_SEEING);
        h.resolveAutoPicks.mockResolvedValue([]);
        seedSession([], {
            provider: 'free',
            model: FREE_SEEING.model,
            isAuto: true,
        });
        render();
        await ask('How do I change the background?');
        expect(h.askLlmBot).not.toHaveBeenCalled();
        expect(lastBot().querySelector('.cue-note')?.textContent).toBe(
            'Auto could not answer — no assistant that costs nothing could ' +
                "be asked just now. Here is what the app's own guide says.",
        );
    });

    test('a free model the tab names that fails hands the question on, and offers to keep the one that answered', async () => {
        h.askLlmBot.mockImplementation(
            async (_q: string, _f: string, _p: string, model: string) => {
                if (model === FREE_LIGHTNING.model) {
                    throw new Error('the free pool is full.');
                }
                return { text: 'Handed on and answered.' };
            },
        );
        h.resolveHandOnPicks.mockResolvedValue({
            failed: FREE_LIGHTNING,
            picks: [FREE_SEEING],
        });
        seedSession([], { provider: 'free', model: FREE_LIGHTNING.model });
        render();
        await ask('How do I change the background?');
        expect(h.resolveHandOnPicks).toHaveBeenCalledWith(
            { provider: 'free', model: FREE_LIGHTNING.model },
            expect.objectContaining({ needsImages: false }),
        );
        const answer = lastBot();
        expect(answer.textContent).toContain('Handed on and answered.');
        expect(answer.querySelector('.cue-note')?.textContent).toBe(
            'Free · Nemotron Lightning could not answer — the free pool is ' +
                'full. Free · Nemotron Super VL answered instead.',
        );
        // Keep the one that answered: the TAB moves, nothing is asked again.
        await press('Use Free · Nemotron Super VL for this chat', answer);
        expect(h.askLlmBot).toHaveBeenCalledTimes(2);
        expect(lastBot().textContent).toContain(
            'This chat now uses Free · Nemotron Super VL.',
        );
        expect(
            container.querySelector<HTMLSelectElement>(
                '[aria-label="Which model answers"]',
            )?.value,
        ).toBe(FREE_SEEING.model);
    });

    test('Use Auto under a hand-on note moves the tab onto Auto', async () => {
        h.guessAutoPick.mockReturnValue(FREE_SEEING);
        h.askLlmBot.mockImplementation(
            async (_q: string, _f: string, _p: string, model: string) => {
                if (model === FREE_LIGHTNING.model) {
                    throw new Error('the free pool is full.');
                }
                return { text: 'Handed on and answered.' };
            },
        );
        h.resolveHandOnPicks.mockResolvedValue({
            failed: FREE_LIGHTNING,
            picks: [FREE_SEEING],
        });
        seedSession([], { provider: 'free', model: FREE_LIGHTNING.model });
        render();
        await ask('How do I change the background?');
        await press('Use Auto for this chat', lastBot());
        expect(lastBot().textContent).toContain(
            'This chat now uses Auto: at each question it picks the best',
        );
        expect(
            container.querySelector<HTMLSelectElement>(
                '[aria-label="Which assistant answers"]',
            )?.value,
        ).toBe('::auto::');
    });

    test('when nobody the question is handed to can answer either, the note names every one of them over the guide', async () => {
        h.askLlmBot.mockImplementation(
            async (_q: string, _f: string, _p: string, model: string) => {
                throw new Error(
                    model === FREE_LIGHTNING.model
                        ? 'the free pool is full.'
                        : 'it is busy.',
                );
            },
        );
        h.resolveHandOnPicks.mockResolvedValue({
            failed: FREE_LIGHTNING,
            picks: [FREE_SEEING],
        });
        seedSession([], { provider: 'free', model: FREE_LIGHTNING.model });
        render();
        await ask('How do I change the background?');
        expect(lastBot().querySelector('.cue-note')?.textContent).toBe(
            'Free could not answer — the free pool is full. ' +
                'Free · Nemotron Super VL could not answer — it is busy. ' +
                "Here is what the app's own guide says.",
        );
        expect(lastBot().textContent).toContain('The guide says');
    });

    test('a free model that fails with nobody to hand on to falls back to the guide', async () => {
        h.askLlmBot.mockRejectedValue(new Error('the free pool is full.'));
        h.resolveHandOnPicks.mockResolvedValue({
            failed: FREE_LIGHTNING,
            picks: [],
        });
        seedSession([], { provider: 'free', model: FREE_LIGHTNING.model });
        render();
        await ask('How do I change the background?');
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        expect(lastBot().querySelector('.cue-note')?.textContent).toBe(
            'Free could not answer — the free pool is full. ' +
                "Here is what the app's own guide says.",
        );
    });

    test('a question typed in Khmer is put into English for a model that works in English, and its answer back into Khmer', async () => {
        h.resolveAutoPicks.mockResolvedValue([GEMMA_TRANSLATOR]);
        h.askLlmBot.mockImplementation(
            async (
                asked: string,
                _f: string,
                _p: string,
                _m: string,
                _t: any,
                _s: any,
                extra: any,
            ) => {
                if (extra?.isTranslation === true) {
                    return asked.includes('from English into')
                        ? {
                              text: `${KHMER_ANSWER}\n\nOPTIONS: ${KHMER_OPTION}`,
                          }
                        : { text: 'How do I change the background?' };
                }
                return {
                    text: 'Open the Background panel.',
                    replies: ['Show me'],
                };
            },
        );
        seedSession();
        render();
        await ask(KHMER_QUESTION);

        const calls = h.askLlmBot.mock.calls;
        expect(calls).toHaveLength(3);
        // The Gemma 4 sub-assistant puts the question into English...
        expect(calls[0][2]).toBe('custom');
        expect(calls[0][3]).toBe(GEMMA_TRANSLATOR.model);
        expect(calls[0][0]).toContain(KHMER_QUESTION);
        expect(calls[0][6]).toMatchObject({
            isGeneral: true,
            isTranslation: true,
        });
        // ...the tab's own model is asked in English, under the English
        // prompt...
        expect(calls[1][2]).toBe('anthropic');
        expect(calls[1][0]).toContain('How do I change the background?');
        expect(calls[1][0]).not.toContain(KHMER_QUESTION);
        expect(calls[1][6]).toMatchObject({
            askedText: 'How do I change the background?',
            replyLang: 'en',
            appLang: 'en',
        });
        // ...and its answer, options riding along, is put back.
        expect(calls[2][0]).toContain('Open the Background panel.');
        expect(calls[2][0]).toContain('OPTIONS: Show me');
        expect(calls[2][6].isTranslation).toBe(true);

        const answer = lastBot();
        expect(answer.textContent).toContain(KHMER_ANSWER);
        expect(answer.textContent).not.toContain('Open the Background panel.');
        expect(replyTexts(answer)).toEqual([KHMER_OPTION]);
        // The transcript keeps the words they typed.
        expect(container.querySelector('.cue-you .cue-said')?.textContent).toBe(
            KHMER_QUESTION,
        );
    });

    test('an answer the translator could not put back is shown in English under a sentence saying so', async () => {
        h.resolveAutoPicks.mockResolvedValue([GEMMA_TRANSLATOR]);
        h.askLlmBot.mockImplementation(
            async (
                asked: string,
                _f: string,
                _p: string,
                _m: string,
                _t: any,
                _s: any,
                extra: any,
            ) => {
                if (extra?.isTranslation === true) {
                    // The answer handed back untranslated is no translation.
                    return asked.includes('from English into')
                        ? { text: 'Open the Background panel.' }
                        : { text: 'How do I change the background?' };
                }
                return { text: 'Open the Background panel.' };
            },
        );
        seedSession();
        render();
        await ask(KHMER_QUESTION);
        const answer = lastBot();
        expect(answer.textContent).toContain('Open the Background panel.');
        expect(answer.querySelector('.cue-note')?.textContent).toBe(
            'I could not put this answer into ខ្មែរ, so it is in English.',
        );
    });

    test('a question the translator fails on is asked in their language as it stands', async () => {
        h.resolveAutoPicks.mockResolvedValue([GEMMA_TRANSLATOR]);
        h.askLlmBot.mockImplementation(
            async (
                _q: string,
                _f: string,
                _p: string,
                _m: string,
                _t: any,
                _s: any,
                extra: any,
            ) => {
                if (extra?.isTranslation === true) {
                    throw new Error('the translator is away');
                }
                return { text: KHMER_ANSWER };
            },
        );
        seedSession();
        render();
        await ask(KHMER_QUESTION);
        const modelCall = h.askLlmBot.mock.calls.find((call) => {
            return call[6]?.isTranslation !== true;
        })!;
        expect(modelCall[0]).toContain(KHMER_QUESTION);
        expect(modelCall[6]).toMatchObject({ replyLang: 'km' });
        expect(modelCall[6].appLang).toBeUndefined();
        expect(lastBot().textContent).toContain(KHMER_ANSWER);
    });

    test('a supported question carries its guide page, and the page in their language when the model is asked in it', async () => {
        h.findKnownQuestion.mockResolvedValue(KNOWN_ROW);
        h.readKnownQuestionPage.mockImplementation(
            async (_row: any, readPart: (id: string) => Promise<string>) => {
                return readPart('W-06');
            },
        );
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_help_page') {
                return args.id === 'W-06@km' ? KHMER_PAGE : ENGLISH_PAGE;
            }
            throw new Error('no tool host here');
        });
        seedSession();
        render();
        // Nothing to translate with: asked in Khmer, with the Khmer page.
        await ask(KHMER_QUESTION);
        expect(h.findKnownQuestion).toHaveBeenCalledWith(
            KHMER_QUESTION,
            'presenter',
        );
        const pageIds = h.callTool.mock.calls
            .filter((call) => call[0] === 'owa_help_page')
            .map((call) => call[1].id);
        expect(pageIds).toEqual(['W-06', 'W-06@km']);
        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain(KHMER_QUESTION);
        expect(extra.knownRecipeId).toBe('W-06');
        expect(extra.knownFind).toBe('Background');
    });

    test('“that is wrong” under a guide answer reads the page again and offers the next model up, whose press asks again', async () => {
        seedSession(
            [
                { author: 'you', text: 'How do I change the background?' },
                {
                    author: 'bot',
                    text: 'Press **Background** at the top.',
                    actions: [
                        {
                            label: 'Show me step by step',
                            toolName: 'owa_guide_start',
                            args: {
                                manualId: 'W-06',
                                page: 'presenter.html',
                                mode: 'show',
                                find: 'Background',
                            },
                        },
                    ],
                },
            ],
            { model: 'claude-sonnet-5' },
        );
        render();
        await ask('That is wrong');
        // The guide's newest copy was looked for before the model was asked.
        expect(
            h.callTool.mock.calls.some((call) => {
                return call[0] === 'owa_help_page' && call[1]?.id === 'W-06';
            }),
        ).toBe(true);
        const [asked, , , model] = h.askLlmBot.mock.calls[0];
        expect(model).toBe('claude-sonnet-5');
        expect(asked).toContain('That is wrong');
        expect(asked.length).toBeGreaterThan('That is wrong'.length + 40);
        const answer = lastBot();
        expect(answer.querySelector('.cue-note')?.textContent).toContain(
            'Opus 5',
        );
        await press('Ask again with Opus 5', answer);
        expect(h.askLlmBot).toHaveBeenCalledTimes(2);
        const [againAsked, , , againModel] = h.askLlmBot.mock.calls[1];
        expect(againModel).toBe('claude-opus-5');
        expect(againAsked).toContain('How do I change the background?');
        expect(againAsked).toContain(
            'The person said the last answer to this was wrong',
        );
        expect(lastBot().querySelector('.cue-note')?.textContent).toBe(
            'Asked again with Opus 5, and this chat now uses it — pick ' +
                'another in the MODEL list at the top of this window to ' +
                'switch back.',
        );
        expect(
            container.querySelector<HTMLSelectElement>(
                '[aria-label="Which model answers"]',
            )?.value,
        ).toBe('claude-opus-5');
    });

    test('a smarter-model button for a model the tab no longer asks says so and asks nothing', async () => {
        seedSession([
            { author: 'you', text: 'How do I change the background?' },
            {
                author: 'bot',
                text: 'Press Background.',
                actions: [
                    {
                        label: 'Ask again with GPT-5',
                        toolName: 'owa_window_ask_smarter',
                        args: {
                            model: 'gpt-5',
                            question: 'How do I change the background?',
                        },
                    },
                ],
            },
        ]);
        render();
        await press('Ask again with GPT-5', lastBot());
        expect(h.askLlmBot).not.toHaveBeenCalled();
        expect(lastBot().textContent).toContain(
            'This chat is not asking that assistant any more.',
        );
    });

    test('a question about reading the Bible, asked with the Presenter up, ends with the way to the Bible Reader', async () => {
        h.callTool.mockImplementation(async (name: string) => {
            if (name === 'owa_app_state') {
                return JSON.stringify({
                    mainWindow: { page: 'presenter.html' },
                });
            }
            throw new Error('no tool host here');
        });
        seedSession();
        render();
        await ask('How can I read the Bible by myself?');
        const answer = lastBot();
        expect(answer.textContent).toContain('An answer.');
        expect(answer.textContent).toContain(
            'Only want to read the Bible? The Bible Reader page is made for that.',
        );
        await press('Go to the Bible Reader', answer);
        // Pressed, it is the window's own command, typed for them.
        expect(
            [...container.querySelectorAll('.cue-you .cue-said')].map((one) => {
                return one.textContent;
            }),
        ).toContain('/goto reader');
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
    });

    test('a verse asked for by its words in the Bible Reader gets Bible Find named under the answer', async () => {
        seedSession([], { focus: 'reader' });
        render();
        await ask('Which verse says love your enemies?');
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        expect(h.askLlmBot.mock.calls[0][1]).toBe('reader');
        const answer = lastBot();
        expect(answer.textContent).toContain(
            'The Bibles in this app can be searched too: Bible Find lists',
        );
        expect(findButton('Show me Bible Find', answer)).toBeDefined();
    });

    test('a picture from the paperclip goes to a model that can see it, and leaves the box', async () => {
        seedSession();
        render();
        const input =
            container.querySelector<HTMLInputElement>('.chat-file-input')!;
        Object.defineProperty(input, 'files', {
            configurable: true,
            value: [new File(['png'], 'screen.png', { type: 'image/png' })],
        });
        await act(async () => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await settle();
        expect(
            container.querySelector('.chat-ask .chat-clip')?.textContent,
        ).toContain('screen.png');
        await ask('What is wrong here?');
        const extra = h.askLlmBot.mock.calls[0][6];
        expect(extra.images).toHaveLength(1);
        expect(extra.images[0].mediaType).toBe('image/png');
        // Sent with the question: off the box, on the message.
        expect(container.querySelector('.chat-ask .chat-clip')).toBeNull();
        expect(
            container.querySelector('.cue-you .chat-clip')?.textContent,
        ).toContain('screen.png');
    });

    test('a bare picture whose assistant fails is answered honestly: the guide cannot see it', async () => {
        h.askLlmBot.mockRejectedValue(new Error('the service is busy.'));
        seedSession();
        render();
        const input =
            container.querySelector<HTMLInputElement>('.chat-file-input')!;
        Object.defineProperty(input, 'files', {
            configurable: true,
            value: [new File(['png'], 'screen.png', { type: 'image/png' })],
        });
        await act(async () => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await settle();
        await ask('');
        // The picture WAS the question: the model was shown it...
        expect(h.askLlmBot.mock.calls[0][6].images).toHaveLength(1);
        // ...and the guide, which cannot see, is not handed a stand-in.
        expect(h.askHelpBot).not.toHaveBeenCalled();
        expect(lastBot().textContent).toContain(
            'I cannot look at pictures while I am offline.',
        );
        expect(lastBot().querySelector('.cue-note')?.textContent).toMatch(
            /^Claude could not answer — the service is busy\. /,
        );
    });

    test('a line under a verse search is searched first, and the found verses ride to the model', async () => {
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_find_verse' && args.words !== undefined) {
                return JSON.stringify(FOUND_VERSES);
            }
            throw new Error('no tool host here');
        });
        seedSession([
            { author: 'you', text: 'Help me find a Bible verse' },
            {
                author: 'bot',
                text: 'What do you remember about the verse?',
                verseFind: 'KJV',
            },
        ]);
        render();
        await ask('love your enemies');
        expect(h.callTool).toHaveBeenCalledWith('owa_find_verse', {
            bible: 'KJV',
            words: 'love your enemies',
        });
        const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(asked).toContain('Search the installed Bible "KJV"');
        expect(asked).toContain('Matthew 5:44');
        expect(extra.verseFind).toMatchObject({
            bible: 'KJV',
            words: 'love your enemies',
            canBrowse: true,
        });
        expect(extra.verseFind.found.map((one: any) => one.key)).toEqual([
            'MAT 5:44',
        ]);
    });

    test('a verse search with its assistant failing shows what the window found itself, under the reason', async () => {
        h.askLlmBot.mockRejectedValue(new Error('the service is busy.'));
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_find_verse' && args.words !== undefined) {
                return JSON.stringify(FOUND_VERSES);
            }
            throw new Error('no tool host here');
        });
        seedSession([
            { author: 'you', text: 'Help me find a Bible verse' },
            {
                author: 'bot',
                text: 'What do you remember about the verse?',
                verseFind: 'KJV',
            },
        ]);
        render();
        await ask('love your enemies');
        expect(h.askHelpBot).not.toHaveBeenCalled();
        const answer = lastBot();
        expect(answer.textContent).toContain('Love your enemies');
        expect(answer.querySelector('.cue-note')?.textContent).toMatch(
            /^Claude could not answer — the service is busy\. /,
        );
    });

    test('a passage typed in a Bible Reader tab is asked with the reader’s own Bible named', async () => {
        h.callTool.mockImplementation(async (name: string, args: any) => {
            if (name === 'owa_find_verse' && args?.words === undefined) {
                return JSON.stringify({
                    bible: 'KJV',
                    bibles: [{ key: 'KJV', locale: 'en' }],
                });
            }
            throw new Error('no tool host here');
        });
        h.askLlmBot.mockResolvedValue({ text: 'John 3:16 says God so loved.' });
        seedSession([], { focus: 'reader' });
        render();
        await ask('What does John 3:16 mean?');
        const [, focus, , , , , extra] = h.askLlmBot.mock.calls[0];
        expect(focus).toBe('reader');
        expect(extra.bibleReader).toMatchObject({ canSeePictures: true });
        // The next plain line stays in the conversation.
        await ask('And the verse after it?');
        expect(h.askLlmBot.mock.calls[1][6].bibleReader).toBeDefined();
    });

    test('a starter chip is asked as pressed, and a fill-in chip goes in the box instead', async () => {
        seedSession();
        render();
        await press('How do I add a background?');
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        expect(h.askLlmBot.mock.calls[0][0]).toContain(
            'How do I add a background?',
        );
        expect(h.askLlmBot.mock.calls[0][6].replyLang).toBe('en');
        expect(container.querySelector('.cue-you .cue-said')?.textContent).toBe(
            'How do I add a background?',
        );
    });

    test('a fill-in starter chip fills the box and asks nothing', async () => {
        seedSession();
        render();
        await press('Create a lyric file for song "Amazing Grace"');
        expect(h.askLlmBot).not.toHaveBeenCalled();
        expect(
            container.querySelector<HTMLTextAreaElement>('.chat-input')!.value,
        ).toBe('Create a lyric file for song "Amazing Grace"');
    });

    test('a quick reply under the last answer is asked as pressed', async () => {
        seedSession([
            { author: 'you', text: 'Can you show me the Background panel?' },
            {
                author: 'bot',
                text: 'Do you want me to show you?',
                replies: ['Yes, show me'],
            },
        ]);
        render();
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.cue-reply')!.click();
        });
        await settle();
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        expect(h.askLlmBot.mock.calls[0][0]).toContain('Yes, show me');
        expect(h.askLlmBot.mock.calls[0][4].at(-1).text).toContain(
            'Do you want me to show you?',
        );
    });

    describe('a walkthrough card stuck on a step', () => {
        const REQUEST = {
            token: 7,
            title: 'Change the background',
            stepNumber: 2,
            stepCount: 3,
            stepText: 'Press Background',
            reason: 'nothing on screen to act on',
        };

        async function deliverRescue() {
            const listener = h.listeners.get('main:app:guide-help');
            expect(listener).toBeDefined();
            await act(async () => {
                listener!(null, REQUEST);
            });
            await settle();
        }

        test('asks here with nothing behind it, and the answer goes back to the card', async () => {
            h.effectChannels = ['main:app:guide-help'];
            h.askLlmBot.mockResolvedValue({
                text: 'DO: Press **Background** at the top left.',
            });
            seedSession([
                { author: 'you', text: 'An earlier question' },
                { author: 'bot', text: 'An earlier answer.' },
            ]);
            render();
            await deliverRescue();
            const [asked, , , , turns] = h.askLlmBot.mock.calls[0];
            expect(asked).toContain('Press Background');
            // A fresh diagnosis: none of the tab's history rides along.
            expect(turns).toEqual([]);
            expect(h.sendData).toHaveBeenCalledWith(
                'all:app:guide-help-answer',
                { token: 7, text: 'Press Background at the top left.' },
            );
            // The transcript says who asked, in a summary, not the prompt.
            const said = [...container.querySelectorAll('.cue-you')].at(-1)!;
            expect(said.querySelector('.cue-note')?.textContent).toBe(
                'Asked by the walkthrough card, not by you.',
            );
            expect(lastBot().textContent).toContain(
                'Press Background at the top left.',
            );
            // No buttons under a line drawn on a card in another window.
            expect(lastBot().querySelector('.cue-reply')).toBeNull();
        });

        test('a provider that fails tells the card nothing is coming, and the guide is not asked', async () => {
            h.effectChannels = ['main:app:guide-help'];
            h.askLlmBot.mockRejectedValue(new Error('the service is busy.'));
            seedSession();
            render();
            await deliverRescue();
            expect(h.askHelpBot).not.toHaveBeenCalled();
            expect(h.sendData).toHaveBeenCalledWith(
                'all:app:guide-help-answer',
                { token: 7, text: '' },
            );
            expect(lastBot().textContent).toContain(
                'Claude could not answer — the service is busy.',
            );
        });

        test('a spend pause is said with its button, and the card falls back to its own words', async () => {
            h.effectChannels = ['main:app:guide-help'];
            h.askLlmBot.mockRejectedValue(
                Object.assign(new Error('The assistant is paused.'), {
                    name: 'SpendLimitError',
                }),
            );
            seedSession();
            render();
            await deliverRescue();
            expect(h.askHelpBot).not.toHaveBeenCalled();
            expect(h.sendData).toHaveBeenCalledWith(
                'all:app:guide-help-answer',
                { token: 7, text: '' },
            );
            expect(lastBot().textContent).toContain('The assistant is paused.');
            expect(findButton('Allow more', lastBot())).toBeDefined();
        });
    });

    test('a picture sent over from the Presenting Control lands in the box, and stops listening when the window goes', async () => {
        h.effectChannels = ['main:app:chat-attach'];
        h.sendDataSync.mockImplementation((channel: string) => {
            return channel === 'main:app:take-chat-attachment'
                ? { dataUrl: h.pictureDataUrl }
                : null;
        });
        seedSession();
        render();
        await settle();
        // The one held for this window while it was loading.
        expect(container.querySelectorAll('.chat-ask .chat-clip')).toHaveLength(
            1,
        );
        expect(
            container.querySelector('.chat-ask .chat-clip')?.textContent,
        ).toContain('my screen');
        // One pushed while it is open; an empty one is nothing.
        const listener = h.listeners.get('main:app:chat-attach')!;
        await act(async () => {
            listener(null, { dataUrl: '' });
        });
        await act(async () => {
            listener(null, { dataUrl: h.pictureDataUrl });
        });
        await settle();
        expect(container.querySelectorAll('.chat-ask .chat-clip')).toHaveLength(
            2,
        );
        act(() => root.unmount());
        expect(h.listeners.has('main:app:chat-attach')).toBe(false);
        root = createRoot(container);
    });

    describe('a Resources file open in the tab', () => {
        const OPEN_FILE = {
            id: 'res-1',
            kind: 'file',
            name: 'MAT.18.pdf',
            mimeType: 'application/pdf',
            byteSize: 4096,
            filePath: '/res/pdf/MAT.18.pdf',
        };
        const READING = {
            bookKey: 'MAT',
            chapter: 18,
            verseStart: 15,
            verseEnd: 17,
            title: 'Matthew 18:15-17',
            bibleKey: 'KJV',
        };
        const PASSAGE_TEXT =
            'Moreover if thy brother shall trespass against thee, go and tell him his fault';

        function seedResources(extraMessages: SeedMessageType[] = []) {
            seedSession([
                {
                    author: 'you',
                    text: 'What is in this file?',
                    attachments: [OPEN_FILE],
                },
                {
                    author: 'bot',
                    text: 'MAT.18.pdf is attached below. Ask me anything about what is in it, or press a question.',
                    replies: ['Read'],
                    resourceReading: READING,
                },
                ...extraMessages,
            ]);
        }

        // The window pre-reads the chapter and the passage from the Bible.
        function serveLookups() {
            h.callTool.mockImplementation(async (name: string, args: any) => {
                if (name === 'owa_lookup_record' && args.ref === 'MAT 18') {
                    return JSON.stringify({
                        bible: 'KJV',
                        passages: [{ key: 'MAT 18:1-35', ref: 'Matthew 18' }],
                    });
                }
                if (name === 'owa_lookup_record') {
                    return JSON.stringify({
                        bible: 'KJV',
                        passages: [
                            {
                                key: args.ref,
                                ref: 'Matthew 18:15-17',
                                text: PASSAGE_TEXT,
                            },
                        ],
                    });
                }
                throw new Error('no tool host here');
            });
        }

        test('Read is answered by the window with the verses being read first', async () => {
            seedResources();
            render();
            await press('Read', lastBot());
            expect(h.askLlmBot).not.toHaveBeenCalled();
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'You are reading 15-17 — press it, or choose another below.',
            );
            expect(replyTexts(answer)).toEqual([
                '15-17',
                '1',
                '2',
                '3',
                '1-3',
                'Full chapter',
            ]);
        });

        test('a range pressed under it is read from the Bible first, and the next verses follow as buttons', async () => {
            serveLookups();
            h.askLlmBot.mockResolvedValue({
                text: 'Jesus teaches how to make peace with a brother.',
            });
            seedResources([
                { author: 'you', text: 'Read' },
                {
                    author: 'bot',
                    text: 'Which verse in this chapter do you want to focus on?',
                    replies: ['15-17', '1', 'Full chapter'],
                },
            ]);
            render();
            await press('15-17', lastBot());
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
            // The passage rides the ask, to be copied as it stands.
            expect(asked).toContain(PASSAGE_TEXT);
            expect(asked).toContain('(MAT 18:1-35)');
            expect(extra.resources).toEqual({
                canSeePictures: true,
                openFiles: ['pdf/MAT.18.pdf'],
            });
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'Jesus teaches how to make peace with a brother.',
            );
            expect(replyTexts(answer)).toContain('18');
        });

        test('a reading that loops on one word is never shown: the verse and a sentence instead', async () => {
            serveLookups();
            h.askLlmBot.mockResolvedValue({
                text: 'brother brother brother brother brother brother brother',
            });
            seedResources([
                { author: 'you', text: 'Read' },
                {
                    author: 'bot',
                    text: 'Which verse in this chapter do you want to focus on?',
                    replies: ['15-17', '1', 'Full chapter'],
                },
            ]);
            render();
            await press('15-17', lastBot());
            const said = lastBot().textContent ?? '';
            expect(said).toContain(PASSAGE_TEXT);
            expect(said).toContain(
                'I could not read the PDF explanation reliably, so I did not show it.',
            );
            expect(said).not.toContain('brother brother brother');
        });

        test('a passage whose assistant fails shows the verses already read, and never the guide', async () => {
            serveLookups();
            h.askLlmBot.mockRejectedValue(new Error('the service is busy.'));
            seedResources([
                { author: 'you', text: 'Read' },
                {
                    author: 'bot',
                    text: 'Which verse in this chapter do you want to focus on?',
                    replies: ['15-17', '1', 'Full chapter'],
                },
            ]);
            render();
            await press('15-17', lastBot());
            expect(h.askHelpBot).not.toHaveBeenCalled();
            const answer = lastBot();
            expect(answer.querySelector('.cue-note')?.textContent).toBe(
                'Claude could not answer — the service is busy.',
            );
            expect(answer.textContent).toContain(PASSAGE_TEXT);
        });

        test('a question naming no passage is about the one being read, and needs an assistant', async () => {
            h.askLlmBot.mockRejectedValue(new Error('the service is busy.'));
            seedResources();
            render();
            await ask('Explain it in simple words');
            const asked = h.askLlmBot.mock.calls[0][0];
            expect(asked).toContain('pdf/MAT.18.pdf');
            expect(asked).toContain('Matthew 18:15-17');
            // No passage was pre-read for it.
            expect(h.callTool).not.toHaveBeenCalledWith(
                'owa_lookup_record',
                expect.anything(),
                expect.anything(),
                expect.anything(),
            );
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'A question about this needs an assistant',
            );
            expect(findButton('Open AI settings', answer)).toBeDefined();
        });

        test('a passage the Bible could not be read for still asks, told to read it itself', async () => {
            seedResources([
                { author: 'you', text: 'Read' },
                {
                    author: 'bot',
                    text: 'Which verse in this chapter do you want to focus on?',
                    replies: ['15-17', '1', 'Full chapter'],
                },
            ]);
            render();
            await press('1', lastBot());
            const asked = h.askLlmBot.mock.calls[0][0];
            expect(asked).not.toContain('The app prepared the chapter index');
            expect(h.askLlmBot.mock.calls[0][6].resources).toBeDefined();
        });

        test('a cross reference pressed on a card is read in the passage it came from', async () => {
            serveLookups();
            seedResources([
                { author: 'you', text: '15-17' },
                {
                    author: 'bot',
                    text: 'Jesus teaches about forgiving.\nCross references: Luke 17:3',
                    replies: ['Luke 17:3', '18'],
                },
            ]);
            render();
            await press('Luke 17:3', lastBot());
            const asked = h.askLlmBot.mock.calls[0][0];
            expect(asked).toContain(
                'They pressed "Luke 17:3" on the card that answered the passage below.',
            );
            expect(asked).toContain('Jesus teaches about forgiving.');
            expect(h.callTool).toHaveBeenCalledWith(
                'owa_lookup_record',
                { kind: 'verse', ref: 'Luke 17:3', bible: 'KJV' },
                expect.any(AbortSignal),
                null,
            );
        });

        test('Full chapter asks each verse in turn, one card each, shown once', async () => {
            h.callTool.mockImplementation(async (name: string, args: any) => {
                if (name === 'owa_lookup_record' && args.ref === 'MAT 18') {
                    return JSON.stringify({
                        bible: 'KJV',
                        passages: [{ key: 'MAT 18:1-2', ref: 'Matthew 18' }],
                    });
                }
                throw new Error('no tool host here');
            });
            h.askLlmBot.mockImplementation(async (asked: string) => {
                return {
                    text: asked.startsWith('2')
                        ? 'Verse two explained.'
                        : 'Verse one explained.',
                };
            });
            seedResources([
                { author: 'you', text: 'Read' },
                {
                    author: 'bot',
                    text: 'Which verse in this chapter do you want to focus on?',
                    replies: ['1', 'Full chapter'],
                },
            ]);
            render();
            await press('Full chapter', lastBot());
            await settle();
            expect(h.askLlmBot).toHaveBeenCalledTimes(2);
            // Each verse alone, with nothing behind it.
            for (const call of h.askLlmBot.mock.calls) {
                expect(call[4]).toEqual([]);
            }
            const said = [...container.querySelectorAll('.cue-you .cue-said')]
                .map((one) => one.textContent)
                .filter((text) => text === 'Full chapter');
            expect(said).toHaveLength(1);
            const texts = botMessages().map((one) => one.textContent ?? '');
            expect(
                texts.some((text) => text.includes('Verse one explained.')),
            ).toBe(true);
            expect(
                texts.some((text) => text.includes('Verse two explained.')),
            ).toBe(true);
        });
    });

    describe('a person, place or passage from a Lookup panel', () => {
        const NOAH = {
            kind: 'name',
            target: 'noah',
            title: 'Noah',
            facts: JSON.stringify({
                name: 'Noah',
                summary: 'Noah built the ark and was saved from the flood.',
                children: ['Shem', 'Ham', 'Japheth'],
            }),
        };

        test('a line under the card is asked about that record, with the record at the head of the conversation', async () => {
            h.askLlmBot.mockResolvedValue({ text: 'Noah walked with God.' });
            seedSession([
                {
                    author: 'bot',
                    text: 'Here is what the app holds on Noah.',
                    lookup: NOAH,
                },
            ]);
            render();
            await ask('What kind of man was he?');
            const [asked, , , , , , extra] = h.askLlmBot.mock.calls[0];
            expect(asked).toContain('What kind of man was he?');
            expect(extra.lookup.record).toContain('Noah built the ark');
            const answer = lastBot();
            expect(answer.textContent).toContain('Noah walked with God.');
            // The conversation stays about Noah.
            expect(
                container.querySelector('.chat-open-files')?.textContent,
            ).toContain('Noah');
        });

        test('with its assistant failing, the window shows what the app holds on it', async () => {
            h.askLlmBot.mockRejectedValue(new Error('the service is busy.'));
            seedSession([
                {
                    author: 'bot',
                    text: 'Here is what the app holds on Noah.',
                    lookup: NOAH,
                },
            ]);
            render();
            await ask('What kind of man was he?');
            expect(h.askHelpBot).not.toHaveBeenCalled();
            const answer = lastBot();
            expect(answer.querySelector('.cue-note')?.textContent).toBe(
                'Claude could not answer — the service is busy.',
            );
            expect(answer.textContent).toContain(
                'Noah built the ark and was saved from the flood.',
            );
            expect(findButton('Open AI settings', answer)).toBeDefined();
        });

        test('the × above the box ends the conversation about it', async () => {
            seedSession([
                {
                    author: 'bot',
                    text: 'Here is what the app holds on Noah.',
                    lookup: NOAH,
                },
            ]);
            render();
            await act(async () => {
                container
                    .querySelector<HTMLButtonElement>(
                        '.chat-open-files .chat-clip-x',
                    )!
                    .click();
            });
            expect(container.querySelector('.chat-open-files')).toBeNull();
            await ask('What kind of man was he?');
            expect(h.askLlmBot.mock.calls[0][6].lookup).toBeUndefined();
        });
    });

    test('a supported question names the tools it needs, even those an assistant was sent', async () => {
        h.findKnownQuestion.mockResolvedValue({
            ...KNOWN_ROW,
            resources: { ...KNOWN_ROW.resources, tools: ['owa_present_bible'] },
        });
        seedSession();
        render();
        await ask('How do I change the background?');
        expect(h.askLlmBot.mock.calls[0][0]).toContain('owa_present_bible');
    });

    test('the way to the Bible Reader is offered by the tab’s page when the app cannot be read', async () => {
        seedSession();
        render();
        await ask('How can I read the Bible by myself?');
        expect(h.callTool).toHaveBeenCalledWith(
            'owa_app_state',
            {},
            expect.any(AbortSignal),
        );
        expect(findButton('Go to the Bible Reader', lastBot())).toBeDefined();
    });

    test('Bible Find is offered beside the buttons an answer already has', async () => {
        h.askLlmBot.mockResolvedValue({
            text: 'Try searching for it.',
            actions: [
                {
                    label: 'Show me step by step',
                    toolName: 'owa_guide_start',
                    args: { manualId: 'W-11' },
                },
            ],
        });
        seedSession([], { focus: 'reader' });
        render();
        await ask('Which verse says love your enemies?');
        const answer = lastBot();
        expect(findButton('Show me step by step', answer)).toBeDefined();
        expect(findButton('Show me Bible Find', answer)).toBeDefined();
    });

    test('the guide itself failing, with no assistant, is said in its own sentence', async () => {
        h.llm.available = [];
        h.llm.chosen = null;
        h.askHelpBot.mockRejectedValue(new ToolHostError(503));
        seedSession([], { provider: null, model: '' });
        render();
        await ask('How do I change the background?');
        expect(lastBot().textContent).toContain(
            "The app's own help service did not respond.",
        );
    });

    test('a failure written for a person is said after “I could not answer that”; a bug in the window never is', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        h.llm.available = [];
        h.llm.chosen = null;
        h.askHelpBot.mockRejectedValueOnce(
            new Error('The help pages are being updated.'),
        );
        h.askHelpBot.mockRejectedValueOnce(new TypeError('x is undefined'));
        seedSession([], { provider: null, model: '' });
        render();
        await ask('How do I change the background?');
        expect(lastBot().textContent).toContain(
            'I could not answer that: The help pages are being updated.',
        );
        await ask('How do I change the font?');
        const said = lastBot().textContent ?? '';
        expect(said).toContain(
            'Something went wrong inside the app while answering that.',
        );
        expect(said).not.toContain('x is undefined');
    });

    test('the answer that crosses four fifths of the hourly limit carries the heads-up once', async () => {
        // $0.85 of the $1 default spent this hour.
        recordSpendRound({
            provider: 'anthropic',
            model: 'claude-opus-5',
            input: 0,
            cacheRead: 0,
            cacheWrite: 0,
            output: 34000,
        });
        seedSession();
        render();
        await ask('How do I change the background?');
        expect(lastBot().querySelector('.cue-note')?.textContent).toContain(
            'Heads-up: about $0.85 of the $1 hourly limit is used (85%).',
        );
        await ask('And the font?');
        expect(lastBot().querySelector('.cue-note')).toBeNull();
    });

    test('Stop while the question is being put into English ends it with nothing asked', async () => {
        h.resolveAutoPicks.mockResolvedValue([GEMMA_TRANSLATOR]);
        h.askLlmBot.mockImplementation(
            (
                _q: string,
                _f: string,
                _p: string,
                _m: string,
                _t: any,
                signal: AbortSignal,
            ) => {
                return new Promise((_resolve, reject) => {
                    signal.addEventListener('abort', () => {
                        reject(new AskCancelledError());
                    });
                });
            },
        );
        seedSession();
        render();
        await ask(KHMER_QUESTION);
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-stop')!.click();
        });
        await settle();
        // Only the translator was ever asked.
        expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        expect(h.askLlmBot.mock.calls[0][6].isTranslation).toBe(true);
        expect(botMessages()).toHaveLength(1);
        expect(lastBot().textContent).toContain('Stopped.');
    });

    test('a spend pause met by the one the question was handed to ends the hand-on', async () => {
        h.askLlmBot.mockImplementation(
            async (_q: string, _f: string, _p: string, model: string) => {
                if (model === FREE_LIGHTNING.model) {
                    throw new Error('the free pool is full.');
                }
                throw Object.assign(new Error('The assistant is paused.'), {
                    name: 'SpendLimitError',
                });
            },
        );
        h.resolveHandOnPicks.mockResolvedValue({
            failed: FREE_LIGHTNING,
            picks: [FREE_SEEING],
        });
        seedSession([], { provider: 'free', model: FREE_LIGHTNING.model });
        render();
        await ask('How do I change the background?');
        expect(h.askLlmBot).toHaveBeenCalledTimes(2);
        expect(lastBot().querySelector('.cue-note')?.textContent).toBe(
            "The assistant is paused. Here is what the app's own guide says.",
        );
    });

    describe('the box and its keys', () => {
        function keyDown(init: KeyboardEventInit) {
            const box =
                container.querySelector<HTMLTextAreaElement>('.chat-input')!;
            act(() => {
                box.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        bubbles: true,
                        cancelable: true,
                        ...init,
                    }),
                );
            });
        }

        function boxValue() {
            return container.querySelector<HTMLTextAreaElement>('.chat-input')!
                .value;
        }

        test('Ctrl+Enter sends; Enter alone, or while a word is being composed, does not', async () => {
            seedSession();
            render();
            typeQuestion('How do I change the background?');
            keyDown({ key: 'Enter' });
            keyDown({ key: 'Enter', ctrlKey: true, isComposing: true });
            await settle();
            expect(h.askLlmBot).not.toHaveBeenCalled();
            keyDown({ key: 'Enter', ctrlKey: true });
            await settle();
            expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        });

        test('Escape with no list up empties the box', () => {
            seedSession();
            render();
            typeQuestion('half a question');
            keyDown({ key: 'Escape' });
            expect(boxValue()).toBe('');
        });

        test('Alt+↑ brings back what was asked, Alt+↓ goes back to the words being written', async () => {
            seedSession();
            render();
            await ask('How do I change the background?');
            typeQuestion('half');
            keyDown({ key: 'ArrowUp', altKey: true });
            expect(boxValue()).toBe('How do I change the background?');
            keyDown({ key: 'ArrowDown', altKey: true });
            expect(boxValue()).toBe('half');
        });

        test('the arrows walk the command list and Enter takes the row walked to', async () => {
            seedSession();
            render();
            typeQuestion('/comm');
            const rows = () => {
                return [
                    ...container.querySelectorAll<HTMLElement>('.chat-suggest'),
                ];
            };
            expect(rows().length).toBeGreaterThan(0);
            keyDown({ key: 'ArrowUp' });
            expect(rows().at(-1)?.getAttribute('aria-selected')).toBe('true');
            keyDown({ key: 'ArrowDown' });
            expect(
                rows().some(
                    (row) => row.getAttribute('aria-selected') === 'true',
                ),
            ).toBe(false);
            keyDown({ key: 'ArrowDown' });
            expect(rows()[0].getAttribute('aria-selected')).toBe('true');
            const picked =
                rows()[0].querySelector('.chat-suggest-text')?.textContent;
            keyDown({ key: 'Enter' });
            await settle();
            expect(
                [...container.querySelectorAll('.cue-you .cue-said')].map(
                    (one) => one.textContent,
                ),
            ).toEqual([picked]);
            expect(h.askLlmBot).not.toHaveBeenCalled();
        });

        test('Escape puts the list away, and a second line keeps the arrows for the caret', () => {
            seedSession();
            render();
            typeQuestion('/comm');
            keyDown({ key: 'Escape' });
            expect(container.querySelector('.chat-suggests')).toBeNull();
            // Typing again brings it back.
            typeQuestion('/com');
            expect(container.querySelector('.chat-suggests')).not.toBeNull();
            // Shift+Tab is the way out of the box, not a completion; any
            // other key leaves the list as it is.
            keyDown({ key: 'Tab', shiftKey: true });
            keyDown({ key: 'a' });
            expect(boxValue()).toBe('/com');
            expect(container.querySelector('.chat-suggests')).not.toBeNull();
            typeQuestion('/com\nmore');
            keyDown({ key: 'ArrowDown' });
            expect(
                container.querySelector('.chat-suggest[aria-selected="true"]'),
            ).toBeNull();
        });

        test('Ctrl+Enter in an empty box while an answer is coming adds nothing', async () => {
            h.askLlmBot.mockImplementation(() => new Promise(() => {}));
            seedSession();
            render();
            await ask('How do I change the background?');
            keyDown({ key: 'Enter', ctrlKey: true });
            await settle();
            expect(container.textContent).not.toContain(
                'Added while it was working.',
            );
            expect(h.askLlmBot).toHaveBeenCalledTimes(1);
        });

        test('the paperclip opens the file chooser', () => {
            seedSession();
            render();
            const input =
                container.querySelector<HTMLInputElement>('.chat-file-input')!;
            const clicked = vi
                .spyOn(input, 'click')
                .mockImplementation(() => {});
            act(() => {
                container
                    .querySelector<HTMLButtonElement>(
                        '[aria-label="Attach a file"]',
                    )!
                    .click();
            });
            expect(clicked).toHaveBeenCalledTimes(1);
        });

        test('a model that cannot see is refused a picture, with the one that can offered', async () => {
            seedSession([], {
                provider: 'free',
                model: 'nvidia/nemotron-3-super-120b-a12b:free',
            });
            render();
            await attachPicture();
            await ask('What is this?');
            expect(h.askLlmBot).not.toHaveBeenCalled();
            const error = container.querySelector('.chat-attach-error')!;
            expect(error).not.toBeNull();
            await press('Use Nemotron Super VL', error);
            expect(container.querySelector('.chat-attach-error')).toBeNull();
            expect(
                container.querySelector<HTMLSelectElement>(
                    '[aria-label="Which model answers"]',
                )?.value,
            ).toBe('nvidia/nemotron-3.5-super-vl:free');
        });
    });

    describe('a picture opened big', () => {
        async function openPreview() {
            const chip = container.querySelector<HTMLElement>(
                '.chat-ask .chat-clip[role="button"]',
            );
            expect(chip).not.toBeNull();
            await act(async () => {
                chip!.click();
            });
            await settle();
            return container.querySelector<HTMLElement>('.chat-preview');
        }

        test('opens over the window, copies, downloads and opens its folder', async () => {
            seedSession();
            render();
            await attachPicture('/pictures/screen.png');
            let preview = await openPreview();
            expect(preview?.getAttribute('role')).toBe('dialog');
            // The tool row does not close it; Copy copies.
            await act(async () => {
                preview!
                    .querySelector<HTMLElement>('.chat-preview-tools')!
                    .click();
            });
            expect(container.querySelector('.chat-preview')).not.toBeNull();
            await press('Copy', preview!);
            expect(h.copyImageToClipboard).toHaveBeenCalledWith(
                h.pictureDataUrl,
            );
            expect(
                container.querySelector('.chat-attach-error')?.textContent,
            ).toContain('Copied.');
            // Download closes it and says where the copy went.
            await press('Download', container.querySelector('.chat-preview')!);
            expect(h.downloadAsset).toHaveBeenCalledTimes(1);
            expect(container.querySelector('.chat-preview')).toBeNull();
            expect(
                container.querySelector('.chat-attach-error')?.textContent,
            ).toContain('Saved a copy in your Downloads folder.');
            // Open folder: closed first, then the folder.
            preview = await openPreview();
            await press('Open folder', preview!);
            expect(h.showFileOrDirExplorer).toHaveBeenCalledWith(
                '/pictures/screen.png',
            );
            expect(container.querySelector('.chat-preview')).toBeNull();
        });

        test('Escape, Enter on the overlay, a press on the backdrop and Close each put it away', async () => {
            seedSession();
            render();
            await attachPicture();
            const close = async (how: (preview: HTMLElement) => void) => {
                const preview = await openPreview();
                expect(preview).not.toBeNull();
                await act(async () => {
                    how(preview!);
                });
                expect(container.querySelector('.chat-preview')).toBeNull();
            };
            await close((preview) => {
                preview.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Escape',
                        bubbles: true,
                    }),
                );
            });
            await close((preview) => {
                preview.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Enter',
                        bubbles: true,
                    }),
                );
            });
            await close((preview) => {
                preview.click();
            });
            await close((preview) => {
                findButton('Close', preview)!.click();
            });
        });
    });
});
