// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `handleActing`: what a button under an answer does when it is pressed.
// Most are pseudo tools the window catches itself -- the song the assistant
// drafted, the web search for a verse, the doors to a provider's pages, a
// Resources file, a Bible import step -- and the rest go to the app's own
// tool host through `runBotAction`. Every button is seeded on an answer the
// way a saved conversation carries it, and pressed.
const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    resourceFolders: [] as string[],
    askLlmBot: vi.fn(),
    callTool: vi.fn(),
    runBotAction: vi.fn(),
    genAttachmentFromPath: vi.fn(),
    openPopupWindow: vi.fn(),
    openExternalURL: vi.fn(),
    handleError: vi.fn(),
    sendData: vi.fn(),
    writeText: vi.fn(),
}));

vi.mock('../../../../../../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false, isGlassCapable: false },
        messageUtils: {
            sendData: (...args: any[]) => h.sendData(...args),
            sendDataSync: () => null,
            listenForData: () => {},
            removeListener: () => {},
        },
        browserUtils: {
            openExternalURL: (url: string) => h.openExternalURL(url),
        },
        appUtils: { handleError: (error: any) => h.handleError(error) },
        pathUtils: {
            sep: '/',
            join: (...parts: string[]) => parts.join('/'),
            basename: (filePath: string) => filePath.split('/').pop() ?? '',
        },
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
vi.mock('../../../../../../helper/appHooks', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../../../helper/appHooks')
    >()),
    // Startup subscriptions do not run: every test presses a button.
    useAppEffect: () => {},
}));
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
    getAvailableLlmProviders: () => ['anthropic', 'free'],
    getLlmProvider: () => 'anthropic',
    getIsLlmAuto: () => false,
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
    runBotAction: (...args: any[]) => h.runBotAction(...args),
}));
vi.mock(
    '../../../../../../chatbot/questionHelpers',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/questionHelpers')
        >()),
        findKnownQuestion: async () => null,
        findTemplateAsk: async () => null,
        readKnownQuestionPage: async () => null,
        genFollowUpQuestions: async () => [],
        suggestQuestions: async () => [],
    }),
);
vi.mock(
    '../../../../../../chatbot/fileAttachHelpers',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/fileAttachHelpers')
        >()),
        genAttachmentFromPath: (filePath: string) =>
            h.genAttachmentFromPath(filePath),
    }),
);
vi.mock(
    '../../../../../../resources/resourcesFolderHelpers',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../../../resources/resourcesFolderHelpers')
        >()),
        getResourcesFolderList: () => [...h.resourceFolders],
    }),
);

import ChatbotAppComp from '../../../../../../chatbot/ChatbotAppComp';
import { LOOKUP_STEP_TOOL_NAME } from '../../../../../../chatbot/lookupStepHelpers';

describe('pressing a button under an answer', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        h.settings.clear();
        h.resourceFolders = [];
        h.askLlmBot.mockResolvedValue({ text: 'An answer.' });
        h.callTool.mockRejectedValue(new Error('no tool host here'));
        h.runBotAction.mockResolvedValue({
            text: 'I put a card on the app window.',
            actions: [],
            isNeedingModel: false,
        });
        h.writeText.mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: (text: string) => h.writeText(text) },
        });
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        h.settings.clear();
        delete (navigator as any).clipboard;
        vi.unstubAllGlobals();
    });

    function seedSession(
        messages: Record<string, any>[] = [],
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

    // An answer carrying the buttons under test, the way a saved
    // conversation holds them.
    function seedButtons(actions: Record<string, any>[], extra = {}) {
        seedSession([
            { author: 'you', text: 'How do I change the background?' },
            {
                author: 'bot',
                text: 'Here is what you can do.',
                actions,
                ...extra,
            },
        ]);
    }

    function render() {
        act(() => root.render(<ChatbotAppComp />));
    }

    async function settle() {
        for (let index = 0; index < 2; index += 1) {
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 0));
            });
        }
    }

    function askedTexts() {
        return [...container.querySelectorAll('.cue-you .cue-said')].map(
            (one) => {
                return one.textContent;
            },
        );
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

    describe('the window’s own steps', () => {
        const VERSE_ASK = {
            kind: 'verse',
            target: 'GEN 8:20',
            title: 'Genesis 8:20',
            bibleKey: 'KJV',
        };

        test('a lookup step pressed as data echoes its own words', async () => {
            seedButtons([
                {
                    label: 'ពគប',
                    isData: true,
                    toolName: LOOKUP_STEP_TOOL_NAME,
                    args: { step: 'more', ask: VERSE_ASK },
                },
            ]);
            render();
            await press('ពគប');
            expect(askedTexts().at(-1)).toBe('ពគប');
        });
    });
});
