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

vi.mock('../server/appProvider', () => ({
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
vi.mock('../helper/appHooks', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../helper/appHooks')>()),
    // Startup subscriptions do not run: every test presses a button.
    useAppEffect: () => {},
}));
vi.mock('../helper/domHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../helper/domHelpers')>()),
    openPopupWindow: (...args: any[]) => h.openPopupWindow(...args),
}));
vi.mock('./llmBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./llmBotHelpers')>()),
    askLlmBot: (...args: any[]) => h.askLlmBot(...args),
    getAvailableLlmProviders: () => ['anthropic', 'free'],
    getLlmProvider: () => 'anthropic',
    getIsLlmAuto: () => false,
}));
vi.mock('./mcpClient', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./mcpClient')>()),
    callTool: (...args: any[]) => h.callTool(...args),
}));
vi.mock('./helpBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./helpBotHelpers')>()),
    runBotAction: (...args: any[]) => h.runBotAction(...args),
}));
vi.mock('./questionHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./questionHelpers')>()),
    findKnownQuestion: async () => null,
    findTemplateAsk: async () => null,
    readKnownQuestionPage: async () => null,
    genFollowUpQuestions: async () => [],
    suggestQuestions: async () => [],
}));
vi.mock('./fileAttachHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./fileAttachHelpers')>()),
    genAttachmentFromPath: (filePath: string) =>
        h.genAttachmentFromPath(filePath),
}));
vi.mock('../resources/resourcesFolderHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../resources/resourcesFolderHelpers')
    >()),
    getResourcesFolderList: () => [...h.resourceFolders],
}));

import ChatbotAppComp from './ChatbotAppComp';
import { AskCancelledError } from './cancelHelpers';
import {
    LYRIC_COPY_TOOL_NAME,
    LYRIC_CREATE_TOOL_NAME,
    keepDraftedLyric,
} from './lyricDraftHelpers';
import { LOOKUP_STEP_TOOL_NAME } from './lookupStepHelpers';
import {
    VERSE_FIND_STEP_TOOL_NAME,
    VERSE_WEB_SEARCH_TOOL_NAME,
} from './verseFindChatHelpers';
import { BIBLE_IMPORT_STEP_TOOL_NAME } from './bibleImportChatHelpers';
import { RESOURCE_ASK_TOOL_NAME } from './resourcesChatHelpers';
import { GENERAL_ASK_TOOL_NAME } from './llmBotHelpers';
import { USE_ASSISTANT_TOOL_NAME } from './autoAssistantHelpers';
import {
    OPEN_AI_SETTING_TOOL_NAME,
    OPEN_PROVIDER_PAGE_TOOL_NAME,
} from './providerIssueHelpers';
import {
    DEFAULT_SPEND_LIMIT_USD,
    SPEND_ALLOW_TOOL_NAME,
    setSpendLimitUsd,
} from './spendGuardHelpers';

const SONG_TEXT = [
    'Amazing grace how sweet the sound',
    'That saved a wretch like me',
].join('\n');

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

    function botTexts() {
        return [...container.querySelectorAll('.cue-bot')].map((one) => {
            return one.textContent ?? '';
        });
    }

    function lastBot() {
        return [...container.querySelectorAll('.cue-bot')].at(-1)!;
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

    describe('a song the assistant drafted', () => {
        function seedDraft() {
            const drafted = keepDraftedLyric(SONG_TEXT);
            seedButtons([
                {
                    label: `Create "${drafted.name}"`,
                    toolName: LYRIC_CREATE_TOOL_NAME,
                    args: { reference: drafted.reference },
                },
                {
                    label: 'Copy song text',
                    toolName: LYRIC_COPY_TOOL_NAME,
                    args: { reference: drafted.reference },
                },
            ]);
            return drafted;
        }

        test('Create saves it under a name no song has yet and shows where it went', async () => {
            const drafted = seedDraft();
            h.callTool.mockImplementation(async (name: string, args: any) => {
                if (name === 'owa_lyric_file' && args.action === 'list') {
                    return JSON.stringify({ names: [drafted.name] });
                }
                if (name === 'owa_lyric_file' && args.action === 'create') {
                    return JSON.stringify({
                        filePath: `/docs/${args.name}.own`,
                    });
                }
                throw new Error(`unexpected ${name}`);
            });
            render();
            await press(`Create "${drafted.name}"`);
            const created = h.callTool.mock.calls.find((call) => {
                return call[1]?.action === 'create';
            })!;
            expect(created[1]).toEqual({
                action: 'create',
                name: `${drafted.name} (1)`,
                content: SONG_TEXT,
            });
            const answer = lastBot();
            expect(answer.textContent).toContain(
                `Saved as "${drafted.name} (1)". It is in your documents list now`,
            );
            // Where it went: the row in the list, and the file itself.
            expect(answer.textContent).toContain('Show it in the list');
            expect(answer.textContent).toContain(`${drafted.name} (1)`);
        });

        test('Create says plainly when the song could not be saved, and hands the reason to the log', async () => {
            const drafted = seedDraft();
            const failure = new Error('disk full');
            h.callTool.mockImplementation(async (_name: string, args: any) => {
                if (args.action === 'list') {
                    return JSON.stringify({ names: [] });
                }
                throw failure;
            });
            render();
            await press(`Create "${drafted.name}"`);
            expect(h.handleError).toHaveBeenCalledWith(failure);
            expect(lastBot().textContent).toContain(
                'That song could not be saved. Check there is room in your ' +
                    'documents folder',
            );
        });

        test('the tab is busy while the file is written, and words typed then are asked on their own', async () => {
            const drafted = seedDraft();
            let finishCreate: (value: string) => void = () => {};
            h.callTool.mockImplementation(async (_name: string, args: any) => {
                if (args.action === 'list') {
                    return JSON.stringify({ names: [] });
                }
                return new Promise((resolve) => {
                    finishCreate = resolve;
                });
            });
            render();
            await press(`Create "${drafted.name}"`);
            // Busy, and not stoppable by an ask's Stop: there is no ask.
            expect(container.querySelector('.chat-stop')).not.toBeNull();
            typeQuestion('Thank you');
            await act(async () => {
                container
                    .querySelector<HTMLButtonElement>('.chat-add')!
                    .click();
            });
            await settle();
            expect(h.askLlmBot).toHaveBeenCalledTimes(1);
            expect(h.askLlmBot.mock.calls[0][0]).toContain('Thank you');
            await act(async () => {
                finishCreate(JSON.stringify({ filePath: '/docs/song.own' }));
            });
            await settle();
            expect(botTexts().some((text) => text.includes('Saved as'))).toBe(
                true,
            );
            expect(container.querySelector('.chat-stop')).toBeNull();
        });

        test('Copy song text puts the song on the clipboard', async () => {
            seedDraft();
            render();
            await press('Copy song text');
            expect(h.writeText).toHaveBeenCalledWith(SONG_TEXT);
            expect(lastBot().textContent).toContain(
                'Copied. Paste it into the Lyric Editor',
            );
        });

        test('Copy song text says so when the clipboard refuses', async () => {
            seedDraft();
            h.writeText.mockRejectedValue(new Error('denied'));
            render();
            await press('Copy song text');
            expect(lastBot().textContent).toContain(
                'I could not reach the clipboard. The song is in my answer',
            );
        });

        test('a button whose song is no longer held says so', async () => {
            seedButtons([
                {
                    label: 'Copy song text',
                    toolName: LYRIC_COPY_TOOL_NAME,
                    args: { reference: 'lyric-gone' },
                },
            ]);
            render();
            await press('Copy song text');
            expect(h.writeText).not.toHaveBeenCalled();
            expect(lastBot().textContent).toContain(
                'That song is not held any more',
            );
        });
    });

    describe('the window’s own steps', () => {
        const VERSE_ASK = {
            kind: 'verse',
            target: 'GEN 8:20',
            title: 'Genesis 8:20',
            bibleKey: 'KJV',
        };

        test('a lookup step is answered by the window, echoing what was pressed', async () => {
            seedButtons([
                {
                    label: 'More things to do',
                    toolName: LOOKUP_STEP_TOOL_NAME,
                    args: { step: 'more', ask: VERSE_ASK },
                },
            ]);
            render();
            await press('More things to do');
            expect(askedTexts().at(-1)).toBe('More things to do');
            expect(lastBot().textContent).toContain(
                'What would you like to do with Genesis 8:20?',
            );
            expect(h.askLlmBot).not.toHaveBeenCalled();
        });

        test('a lookup step a hand-edited file broke does nothing at all', async () => {
            seedButtons([
                {
                    label: 'More things to do',
                    toolName: LOOKUP_STEP_TOOL_NAME,
                    args: { step: 'teleport', ask: VERSE_ASK },
                },
            ]);
            render();
            const before = container.querySelectorAll('.cue').length;
            await press('More things to do');
            expect(container.querySelectorAll('.cue')).toHaveLength(before);
        });

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

        test('a verse-finding step and a Bible import step echo the press and run their own step', async () => {
            seedButtons([
                {
                    label: 'Search another Bible',
                    toolName: VERSE_FIND_STEP_TOOL_NAME,
                    args: { step: 'bible' },
                },
            ]);
            render();
            await press('Search another Bible');
            expect(askedTexts().at(-1)).toBe('Search another Bible');
            expect(h.askLlmBot).not.toHaveBeenCalled();
        });

        test('a Bible import step echoes the press as the person’s words', async () => {
            seedButtons([
                {
                    label: 'Cancel',
                    toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                    args: { step: 'cancel' },
                },
            ]);
            render();
            await press('Cancel');
            expect(askedTexts().at(-1)).toBe('Cancel');
            expect(h.askLlmBot).not.toHaveBeenCalled();
        });

        test('Search Google for it opens a search the window wrote from their words, and keeps the search going', async () => {
            seedButtons([
                {
                    label: 'Search Google for it',
                    toolName: VERSE_WEB_SEARCH_TOOL_NAME,
                    args: { words: 'love your  enemies', bible: 'KJV' },
                },
            ]);
            render();
            await press('Search Google for it');
            expect(h.openExternalURL).toHaveBeenCalledWith(
                'https://www.google.com/search?q=bible+verse+love+your+enemies',
            );
            expect(lastBot().textContent).toContain(
                'Opening a search for it in your browser.',
            );
            // The line typed under it is more of the same search.
            h.callTool.mockImplementation(async (name: string) => {
                if (name === 'owa_find_verse') {
                    return JSON.stringify({ bible: 'KJV', verses: [] });
                }
                throw new Error('no tool host here');
            });
            typeQuestion('Matthew 5:44 I think');
            await act(async () => {
                container
                    .querySelector<HTMLButtonElement>('.chat-send')!
                    .click();
            });
            await settle();
            expect(h.askLlmBot.mock.calls[0][6].verseFind).toMatchObject({
                bible: 'KJV',
            });
        });
    });

    describe('a Resources file the assistant read', () => {
        test('Ask about a file no longer in the Resources folders says so', async () => {
            h.resourceFolders = ['/res/pdf'];
            seedButtons([
                {
                    label: 'Ask about pdf/LUK.9.pdf',
                    toolName: RESOURCE_ASK_TOOL_NAME,
                    args: { file: 'notes/LUK.9.pdf' },
                },
            ]);
            render();
            await press('Ask about pdf/LUK.9.pdf');
            expect(h.genAttachmentFromPath).not.toHaveBeenCalled();
            expect(lastBot().textContent).toContain(
                'notes/LUK.9.pdf is not in the Resources folders any more.',
            );
        });

        test('Ask about a file in them attaches it to the tab under a card of its own', async () => {
            h.resourceFolders = ['/res/pdf'];
            h.genAttachmentFromPath.mockResolvedValue({
                attachment: {
                    id: 'file-1',
                    kind: 'file',
                    name: 'LUK.7.pdf',
                    mimeType: 'application/pdf',
                    byteSize: 2048,
                    filePath: '/res/pdf/LUK.7.pdf',
                },
            });
            seedButtons([
                {
                    label: 'Ask about pdf/LUK.7.pdf',
                    toolName: RESOURCE_ASK_TOOL_NAME,
                    args: { file: 'pdf/LUK.7.pdf' },
                },
            ]);
            render();
            await press('Ask about pdf/LUK.7.pdf');
            expect(h.genAttachmentFromPath).toHaveBeenCalledWith(
                '/res/pdf/LUK.7.pdf',
            );
            // In the box, numbered, ready to ask about.
            expect(
                container.querySelector('.chat-ask .chat-clip')?.textContent,
            ).toContain('LUK.7.pdf');
            expect(lastBot().textContent).toContain('LUK.7.pdf');
        });

        test('a file that cannot be attached is said in the window’s own words', async () => {
            h.resourceFolders = ['/res/pdf'];
            h.genAttachmentFromPath.mockResolvedValue({
                failure: 'LUK.7.pdf is not there any more.',
            });
            seedButtons([
                {
                    label: 'Ask about pdf/LUK.7.pdf',
                    toolName: RESOURCE_ASK_TOOL_NAME,
                    args: { file: 'pdf/LUK.7.pdf' },
                },
            ]);
            render();
            await press('Ask about pdf/LUK.7.pdf');
            expect(lastBot().textContent).toContain(
                'LUK.7.pdf is not there any more.',
            );
            expect(container.querySelector('.chat-ask .chat-clip')).toBeNull();
        });
    });

    describe('buttons that ask again', () => {
        test('Ask it as a general question asks the /btw command written for them', async () => {
            seedButtons([
                {
                    label: 'Ask it as a general question',
                    toolName: GENERAL_ASK_TOOL_NAME,
                    args: { question: 'Who wrote the Psalms?' },
                },
            ]);
            render();
            await press('Ask it as a general question');
            expect(askedTexts().at(-1)).toBe('/btw Who wrote the Psalms?');
            expect(h.askLlmBot).toHaveBeenCalledTimes(1);
            expect(h.askLlmBot.mock.calls[0][0]).toContain(
                'Who wrote the Psalms?',
            );
            expect(h.askLlmBot.mock.calls[0][6].isGeneral).toBe(true);
        });

        test('Ask it as a general question with nothing to ask does nothing', async () => {
            seedButtons([
                {
                    label: 'Ask it as a general question',
                    toolName: GENERAL_ASK_TOOL_NAME,
                    args: { question: '   ' },
                },
            ]);
            render();
            await press('Ask it as a general question');
            expect(h.askLlmBot).not.toHaveBeenCalled();
            expect(askedTexts()).toHaveLength(1);
        });

        test('a built-in command button runs the command as though typed', async () => {
            seedButtons([
                {
                    label: 'List the commands',
                    toolName: 'builtin-command',
                    args: { command: '/commands' },
                },
                {
                    label: 'Not a command',
                    toolName: 'builtin-command',
                    args: { command: 'tell me a joke' },
                },
            ]);
            render();
            await press('Not a command');
            expect(askedTexts()).toHaveLength(1);
            await press('List the commands');
            expect(askedTexts().at(-1)).toBe('/commands');
            expect(lastBot().textContent).toContain('/screen');
            expect(h.askLlmBot).not.toHaveBeenCalled();
        });

        test('Allow more with no money cap and no question carried only lifts the pause', async () => {
            // No money cap: the pace cap alone holds.
            setSpendLimitUsd(null);
            try {
                seedButtons([
                    {
                        label: 'Allow more',
                        toolName: SPEND_ALLOW_TOOL_NAME,
                        args: {},
                    },
                ]);
                render();
                await press('Allow more');
                const said = lastBot().textContent ?? '';
                expect(said).toContain(
                    'Carrying on: the hour starts again from now.',
                );
                expect(said).not.toContain('available before I pause again');
                expect(said).not.toContain('Asking your question');
                expect(h.askLlmBot).not.toHaveBeenCalled();
            } finally {
                setSpendLimitUsd(DEFAULT_SPEND_LIMIT_USD);
            }
        });

        test('a switch to an assistant that is not in the list any more is refused in words', async () => {
            seedButtons([
                {
                    label: 'Use Gone Server for this chat',
                    toolName: USE_ASSISTANT_TOOL_NAME,
                    args: { provider: 'custom', model: 'gone/row' },
                },
            ]);
            render();
            await press('Use Gone Server for this chat');
            expect(lastBot().textContent).toContain(
                'That assistant is not in the list any more.',
            );
            expect(
                container.querySelector<HTMLSelectElement>(
                    '[aria-label="Which model answers"]',
                )?.value,
            ).toBe('claude-opus-5');
        });
    });

    describe('doors out of the window', () => {
        test('Open AI settings on a refused key opens the panel with the cursor in that key’s box', async () => {
            seedButtons([
                {
                    label: 'Open AI settings',
                    toolName: OPEN_AI_SETTING_TOOL_NAME,
                    args: { provider: 'anthropic' },
                },
            ]);
            render();
            await press('Open AI settings', lastBot());
            expect(h.openPopupWindow).toHaveBeenCalledTimes(1);
            expect(h.settings.get('setting-tabs')).toBe('a');
            expect(
                JSON.parse(h.settings.get('setting-ai-key-focus') ?? '{}')
                    .keyName,
            ).toBe('anthropicAPIKey');
        });

        test('a provider page a saved button cannot name opens nothing', async () => {
            seedButtons([
                {
                    label: 'Open somewhere',
                    toolName: OPEN_PROVIDER_PAGE_TOOL_NAME,
                    args: {
                        provider: 'anthropic',
                        page: 'https://evil.example',
                    },
                },
            ]);
            render();
            const before = container.querySelectorAll('.cue').length;
            await press('Open somewhere');
            expect(h.openExternalURL).not.toHaveBeenCalled();
            expect(container.querySelectorAll('.cue')).toHaveLength(before);
        });
    });

    describe('a walkthrough and the app’s own tools', () => {
        test('an ordinary button runs through the tool host and its result is drawn', async () => {
            seedButtons([
                {
                    label: 'Show me step by step',
                    toolName: 'owa_guide_start',
                    args: { manualId: 'W-06', mode: 'show' },
                },
            ]);
            render();
            await press('Show me step by step');
            expect(h.runBotAction).toHaveBeenCalledWith({
                label: 'Show me step by step',
                toolName: 'owa_guide_start',
                args: { manualId: 'W-06', mode: 'show' },
            });
            expect(lastBot().textContent).toContain(
                'I put a card on the app window.',
            );
            expect(h.askLlmBot).not.toHaveBeenCalled();
        });

        test('a card that needs the model for the rest asks it right after', async () => {
            h.runBotAction.mockResolvedValue({
                text: 'Getting the steps ready…',
                actions: [],
                isNeedingModel: true,
            });
            h.askLlmBot.mockResolvedValue({
                text: 'Step 1: press Background.',
            });
            seedButtons([
                {
                    label: 'Do it for me',
                    toolName: 'owa_guide_start',
                    args: { manualId: 'W-06', mode: 'demo' },
                    ask: 'Walk me through changing the background',
                },
            ]);
            render();
            await press('Do it for me');
            expect(h.askLlmBot).toHaveBeenCalledTimes(1);
            expect(h.askLlmBot.mock.calls[0][0]).toContain(
                'Walk me through changing the background',
            );
            // Asked as pressed: in the language the app is shown in.
            expect(h.askLlmBot.mock.calls[0][6].replyLang).toBe('en');
            expect(botTexts()).toEqual([
                expect.stringContaining('Here is what you can do.'),
                expect.stringContaining('Getting the steps ready…'),
                expect.stringContaining('Step 1: press Background.'),
            ]);
        });

        test('a tool that fails is said in the window’s words, never the tool’s', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            h.runBotAction.mockRejectedValue(
                new Error('owa_guide_start: selector #bg not found'),
            );
            seedButtons([
                {
                    label: 'Show me step by step',
                    toolName: 'owa_guide_start',
                    args: { manualId: 'W-06' },
                },
            ]);
            render();
            await press('Show me step by step');
            const said = lastBot().textContent ?? '';
            expect(said).toContain('I could not do that just now.');
            expect(said).not.toContain('selector');
        });

        test('Stop while a button’s tool is running ends the wait, and its late answer is dropped', async () => {
            let finish: (value: unknown) => void = () => {};
            h.runBotAction.mockImplementation(() => {
                return new Promise((resolve) => {
                    finish = resolve;
                });
            });
            seedButtons([
                {
                    label: 'Show me step by step',
                    toolName: 'owa_guide_start',
                    args: { manualId: 'W-06' },
                },
            ]);
            render();
            await press('Show me step by step');
            await act(async () => {
                container
                    .querySelector<HTMLButtonElement>('.chat-stop')!
                    .click();
            });
            await act(async () => {
                finish({
                    text: 'Too late.',
                    actions: [],
                    isNeedingModel: false,
                });
            });
            await settle();
            expect(lastBot().textContent).toContain(
                'Stopped. I did not finish looking that up',
            );
            expect(botTexts().join('\n')).not.toContain('Too late.');
        });

        test('a Stop that lands as the tool throws says nothing more', async () => {
            let fail: (error: unknown) => void = () => {};
            h.runBotAction.mockImplementation(() => {
                return new Promise((_resolve, reject) => {
                    fail = reject;
                });
            });
            seedButtons([
                {
                    label: 'Show me step by step',
                    toolName: 'owa_guide_start',
                    args: { manualId: 'W-06' },
                },
            ]);
            render();
            await press('Show me step by step');
            await act(async () => {
                container
                    .querySelector<HTMLButtonElement>('.chat-stop')!
                    .click();
            });
            await act(async () => {
                fail(new AskCancelledError());
            });
            await settle();
            expect(botTexts().at(-1)).toContain('Stopped.');
            expect(botTexts().join('\n')).not.toContain(
                'I could not do that just now.',
            );
        });

        test('a guided demo pressed in the Reader’s empty window is said as theirs and started', async () => {
            seedSession([], { focus: 'reader' });
            render();
            const demo =
                container.querySelector<HTMLButtonElement>('.chat-demo');
            expect(demo).not.toBeNull();
            const label =
                demo!.querySelector('.chat-demo-label')?.textContent ?? '';
            await act(async () => {
                demo!.click();
            });
            await settle();
            expect(askedTexts()).toEqual([`Guided demo: ${label}`]);
            expect(h.runBotAction).toHaveBeenCalledTimes(1);
            expect(h.runBotAction.mock.calls[0][0]).toMatchObject({
                toolName: 'owa_guide_start',
                args: { demoId: expect.any(String) },
            });
            expect(lastBot().textContent).toContain(
                'I put a card on the app window.',
            );
        });
    });
});
