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

vi.mock('../../../../../../server/appProvider', () => ({
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
vi.mock('../../../../../../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    getSettingForce: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settings.set(key, value);
    },
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('../../../../../../helper/appHooks', async (importOriginal) => {
    const { useEffect } = await import('react');
    return {
        ...(await importOriginal<
            typeof import('../../../../../../helper/appHooks')
        >()),
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
vi.mock('../../../../../../helper/domHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../helper/domHelpers')
    >()),
    openPopupWindow: (...args: any[]) => h.openPopupWindow(...args),
}));
vi.mock('../../../../../../chatbot/llmBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../chatbot/llmBotHelpers')
    >()),
    askLlmBot: (...args: any[]) => h.askLlmBot(...args),
    getAvailableLlmProviders: () => [...h.llm.available],
    getLlmProvider: () => h.llm.chosen,
    getIsLlmAuto: () => h.llm.isAuto,
}));
vi.mock('../../../../../../chatbot/mcpClient', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../chatbot/mcpClient')
    >()),
    callTool: (...args: any[]) => h.callTool(...args),
}));
vi.mock('../../../../../../chatbot/helpBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../chatbot/helpBotHelpers')
    >()),
    askHelpBot: (...args: any[]) => h.askHelpBot(...args),
}));
vi.mock(
    '../../../../../../chatbot/questionHelpers',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/questionHelpers')
        >()),
        findKnownQuestion: (...args: any[]) => h.findKnownQuestion(...args),
        findTemplateAsk: async () => null,
        readKnownQuestionPage: (...args: any[]) =>
            h.readKnownQuestionPage(...args),
        genFollowUpQuestions: async () => [],
        suggestQuestions: async () => [],
    }),
);
vi.mock(
    '../../../../../../chatbot/autoAssistantSourceHelpers',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/autoAssistantSourceHelpers')
        >()),
        resolveAutoPicks: (...args: any[]) => h.resolveAutoPicks(...args),
        resolveHandOnPicks: (...args: any[]) => h.resolveHandOnPicks(...args),
        guessAutoPick: () => h.guessAutoPick(),
        clearAutoAwayServers: () => {},
    }),
);
vi.mock(
    '../../../../../../chatbot/attachmentHelpers',
    async (importOriginal) => {
        const actual =
            await importOriginal<
                typeof import('../../../../../../chatbot/attachmentHelpers')
            >();
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
    },
);
vi.mock(
    '../../../../../../chatbot/fileAttachHelpers',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/fileAttachHelpers')
        >()),
        // The Resources folders on this machine: one, `/res/pdf`, read as the
        // panel names its files (`pdf/MAT.18.pdf`).
        findResourceFileNames: (
            attachments: { filePath?: string; name: string }[],
        ) =>
            attachments
                .filter((one) => one.filePath?.startsWith('/res/pdf/') === true)
                .map((one) => `pdf/${one.name}`),
        reloadFileAttachment: async () => {},
    }),
);
vi.mock(
    '../../../../../../chatbot/assetPreviewHelpers',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/assetPreviewHelpers')
        >()),
        downloadAsset: (...args: any[]) => h.downloadAsset(...args),
    }),
);
vi.mock('../../../../../../server/appHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../server/appHelpers')
    >()),
    showFileOrDirExplorer: (filePath: string) =>
        h.showFileOrDirExplorer(filePath),
}));

import ChatbotAppComp from '../../../../../../chatbot/ChatbotAppComp';
import { AskCancelledError } from '../../../../../../chatbot/cancelHelpers';
import { resetSpendGuardForTests } from '../../../../../../chatbot/spendGuardHelpers';
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
                    if (asked.includes('Translate each numbered line')) {
                        return { text: `1. ${KHMER_OPTION}` };
                    }
                    return asked.includes('from English into')
                        ? { text: KHMER_ANSWER }
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
        expect(calls).toHaveLength(4);
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
        // ...and its answer is put back, its options on their own beside it
        // (2026-11-03: riding the answer, they came back under 0 of 6).
        expect(calls[2][0]).toContain('Open the Background panel.');
        expect(calls[2][0]).not.toContain('OPTIONS: Show me');
        expect(calls[2][6].isTranslation).toBe(true);
        expect(calls[3][0]).toContain('1. Show me');
        expect(calls[3][6].isTranslation).toBe(true);

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
});
