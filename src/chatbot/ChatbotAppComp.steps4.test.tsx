// @vitest-environment jsdom

/**
 * Finding a half-remembered verse in the help window by its own steps
 * (`handleVerseFindStep`): which Bible, then what they remember, with no
 * model -- and the search the window starts by itself for a verse asked for
 * by what it says. Beside it, the jobs another window hands over and the
 * window takes when it opens or comes to the front (`takeHandoff`): a
 * problem to report, a Resources file to ask about (`attachHandedFileRef`),
 * Bible Find's verse with or without its words. The real step helpers run
 * (`verseFindChatHelpers`, `reportHelpers`, `resourcesChatHelpers`); the
 * tool host (`callTool`), the model (`askLlmBot`) and the file read
 * (`genAttachmentFromPath`) are the boundaries.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
    return {
        settings: new Map<string, string>(),
        // What main is listened to for, by channel.
        listeners: new Map<string, (...args: any[]) => void>(),
        callToolMock: vi.fn(),
        askLlmBotMock: vi.fn(),
        genAttachmentFromPathMock: vi.fn(),
        // What the fake tool host answers, per test.
        tools: {
            route: (_name: string, _args: any): any => {
                return '';
            },
        },
    };
});

vi.mock('../server/appProvider', () => {
    return {
        default: {
            systemUtils: { isDev: false, isGlassCapable: false },
            messageUtils: {
                sendData: () => {},
                sendDataSync: () => null,
                listenForData: (
                    channel: string,
                    callback: (...args: any[]) => void,
                ) => {
                    hoisted.listeners.set(channel, callback);
                },
                removeListener: (channel: string) => {
                    hoisted.listeners.delete(channel);
                },
            },
            pathUtils: {
                sep: '/',
                join: (...parts: string[]) => {
                    return parts.join('/');
                },
            },
        },
    };
});
vi.mock('../helper/settingHelpers', () => {
    return {
        getSetting: (key: string) => {
            return hoisted.settings.get(key) ?? null;
        },
        getSettingForce: (key: string) => {
            return hoisted.settings.get(key) ?? null;
        },
        setSetting: (key: string, value: string) => {
            hoisted.settings.set(key, value);
        },
        removeSetting: (key: string) => {
            hoisted.settings.delete(key);
        },
    };
});
vi.mock('../helper/appHooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../helper/appHooks')>();
    return {
        ...actual,
        // Only the handed-over jobs run (`takeHandoff`, and Bible Find's
        // words asked once their tab is in front): the window's other
        // startup work talks to main and is not what these tests are about.
        useAppEffect: (effect: () => any, deps?: any[]) => {
            useEffect(() => {
                const source = String(effect);
                return source.includes('takeHandoff') ||
                    source.includes('handedVerseAsk')
                    ? effect()
                    : undefined;
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
        },
    };
});
vi.mock('./mcpClient', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('./mcpClient')>()),
        callTool: hoisted.callToolMock,
    };
});
vi.mock('./llmBotHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('./llmBotHelpers')>()),
        askLlmBot: hoisted.askLlmBotMock,
    };
});
vi.mock('./fileAttachHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<typeof import('./fileAttachHelpers')>()),
        genAttachmentFromPath: hoisted.genAttachmentFromPathMock,
    };
});

import ChatbotAppComp from './ChatbotAppComp';
import { genTextAttachment, putAttachmentData } from './attachmentHelpers';
import { VERSE_FIND_STEP_TOOL_NAME } from './verseFindChatHelpers';

const FIND_TOOL = 'owa_find_verse';
const BIBLE_LIST = {
    bible: 'KJV',
    bibles: [
        { key: 'KJV', title: 'King James Version' },
        { key: 'ASV', title: 'American Standard Version' },
    ],
};
const ENEMIES_FOUND = {
    bible: 'KJV',
    total: 1,
    verses: [
        {
            key: 'MAT 5:44',
            ref: 'Matthew 5:44',
            text: 'But I say unto you, Love your enemies',
        },
    ],
};

function toSession(id: string, messages: any[]) {
    return {
        id,
        title: '',
        messages,
        draft: '',
        focus: 'presenter',
        isFocusChosen: true,
        provider: 'free',
        model: '',
        isLocked: false,
    };
}

function seedTab(messages: any[]) {
    hoisted.settings.set(
        'chatbot-sessions',
        JSON.stringify({
            activeId: 'tab',
            sessions: [toSession('tab', messages)],
        }),
    );
}

/** A request another window leaves for this one, as it leaves it. */
function leave(key: string, data: Record<string, unknown>) {
    hoisted.settings.set(key, JSON.stringify({ ...data, at: Date.now() }));
}

/** The tool calls made with one tool's name, their args only. */
function callsOf(name: string) {
    return hoisted.callToolMock.mock.calls
        .filter((call) => {
            return call[0] === name;
        })
        .map((call) => {
            return call[1];
        });
}

describe('finding a verse, and the jobs other windows hand over', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        hoisted.settings.clear();
        hoisted.listeners.clear();
        // A new tab (a handed-over job opens one) asks the free assistant
        // by name, not Auto.
        hoisted.settings.set('chatbot-llm-auto', 'false');
        hoisted.settings.set('chatbot-llm-provider', 'free');
        hoisted.tools.route = (name, args) => {
            if (name !== FIND_TOOL) {
                return '';
            }
            // The list of Bibles, or a search of one for their words.
            return args.words === undefined ? BIBLE_LIST : ENEMIES_FOUND;
        };
        hoisted.callToolMock.mockImplementation(
            async (name: string, args: any) => {
                const result = hoisted.tools.route(name, args);
                return typeof result === 'string'
                    ? result
                    : JSON.stringify(result);
            },
        );
        hoisted.askLlmBotMock.mockResolvedValue({
            text: 'Matthew 5:44 says to love your enemies.',
        });
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        vi.unstubAllGlobals();
        hoisted.settings.clear();
    });

    async function settle(rounds = 6) {
        for (let index = 0; index < rounds; index++) {
            await act(async () => {
                await new Promise((resolve) => {
                    setTimeout(resolve, 0);
                });
            });
        }
    }

    async function render() {
        await act(async () => {
            root.render(<ChatbotAppComp />);
        });
        await settle();
    }

    function botCards() {
        return [...container.querySelectorAll<HTMLElement>('article.cue-bot')];
    }

    function lastBot() {
        const cards = botCards();
        expect(cards.length).toBeGreaterThan(0);
        return cards[cards.length - 1];
    }

    function youTexts() {
        return [
            ...container.querySelectorAll<HTMLElement>(
                'article.cue-you .cue-said',
            ),
        ].map((element) => {
            return element.textContent ?? '';
        });
    }

    function labelsIn(element: HTMLElement) {
        return [...element.querySelectorAll<HTMLElement>('.cue-act')].map(
            (button) => {
                return button.textContent ?? '';
            },
        );
    }

    /** The chips in the ask box: not under a message, not still open. */
    function boxChips() {
        return [...container.querySelectorAll<HTMLElement>('.chat-clip')]
            .filter((chip) => {
                return (
                    chip.closest('article') === null &&
                    chip.closest('.chat-open-files') === null
                );
            })
            .map((chip) => {
                return chip.textContent ?? '';
            });
    }

    async function press(label: string) {
        const buttons = [
            ...container.querySelectorAll<HTMLButtonElement>('button.cue-act'),
        ].filter((button) => {
            return button.textContent === label;
        });
        expect(buttons.length).toBeGreaterThan(0);
        await act(async () => {
            buttons[buttons.length - 1].click();
        });
        await settle();
    }

    async function send(value: string) {
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
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-send')!.click();
        });
        await settle();
    }

    /** The model asks that were a verse search, and what they searched. */
    function verseAsks() {
        return hoisted.askLlmBotMock.mock.calls
            .map((call) => {
                return call[6]?.verseFind;
            })
            .filter((verseFind) => {
                return verseFind !== undefined;
            });
    }

    describe('the verse finder', () => {
        test('asks which Bible, then what they remember of the verse', async () => {
            await render();
            await send('Help me find a Bible verse');
            expect(callsOf(FIND_TOOL)).toEqual([{}]);
            const question = lastBot();
            expect(question.textContent).toContain(
                'Which Bible should I search? Pick one below.',
            );
            expect(labelsIn(question)).toEqual([
                'KJV — King James Version',
                'ASV — American Standard Version',
            ]);
            await press('ASV — American Standard Version');
            expect(youTexts()).toEqual([
                'Help me find a Bible verse',
                'ASV — American Standard Version',
            ]);
            const memory = lastBot();
            expect(memory.textContent).toContain(
                'I will search ASV — American Standard Version.',
            );
            expect(memory.textContent).toContain(
                'What do you remember about the verse?',
            );
            expect(labelsIn(memory)).toEqual(['Search another Bible']);
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test('a Bible typed by its number is picked with no model', async () => {
            await render();
            await send('Help me find a Bible verse');
            await send('2');
            expect(lastBot().textContent).toContain(
                'I will search ASV — American Standard Version.',
            );
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test('with one Bible on this computer, that is the one searched', async () => {
            hoisted.tools.route = () => {
                return {
                    bibles: [{ key: 'KJV', title: 'King James Version' }],
                };
            };
            await render();
            await send('Help me find a Bible verse');
            const memory = lastBot();
            expect(memory.textContent).toContain(
                'There is one Bible on this computer, so that is the one.',
            );
            expect(memory.textContent).toContain(
                'I will search KJV — King James Version.',
            );
        });

        test('says so when the Bibles cannot be read', async () => {
            hoisted.tools.route = () => {
                throw new Error('The main window is closed');
            };
            await render();
            await send('Help me find a Bible verse');
            expect(lastBot().textContent).toContain(
                'I could not read the Bibles in the app just now.',
            );
        });

        test('Stop while the Bibles are read leaves no list behind', async () => {
            let release: (value: string) => void = () => {};
            hoisted.callToolMock.mockImplementation(() => {
                return new Promise((resolve) => {
                    release = resolve;
                });
            });
            await render();
            await send('Help me find a Bible verse');
            await act(async () => {
                container
                    .querySelector<HTMLButtonElement>('.chat-stop')!
                    .click();
            });
            release(JSON.stringify(BIBLE_LIST));
            await settle();
            const stopped = lastBot();
            expect(stopped.textContent).toContain(
                'Stopped. I did not finish looking that up',
            );
            expect(labelsIn(stopped)).toEqual([]);
            expect(container.textContent).not.toContain(
                'Which Bible should I search?',
            );
        });

        test('Search another Bible lists every Bible but the one searched', async () => {
            seedTab([
                {
                    id: 1,
                    author: 'bot',
                    text: 'Nothing in KJV has those words.',
                    verseFind: 'KJV',
                    actions: [
                        {
                            label: 'Search another Bible',
                            toolName: VERSE_FIND_STEP_TOOL_NAME,
                            args: {
                                step: 'bible',
                                current: 'KJV',
                                words: 'love your enemies',
                            },
                        },
                    ],
                },
            ]);
            await render();
            await press('Search another Bible');
            expect(youTexts()).toEqual(['Search another Bible']);
            const question = lastBot();
            expect(question.textContent).toContain(
                'Which Bible should I search? Pick one below.',
            );
            expect(labelsIn(question)).toEqual([
                'ASV — American Standard Version',
            ]);
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test('a verse asked for by what it says is searched in the Bible the lookup is on', async () => {
            await render();
            await send('which verse says do not worry about tomorrow');
            expect(callsOf(FIND_TOOL)).toEqual([
                {},
                { bible: 'KJV', words: 'do not worry about tomorrow' },
            ]);
            expect(verseAsks()).toEqual([
                expect.objectContaining({
                    bible: 'KJV',
                    words: 'do not worry about tomorrow',
                }),
            ]);
            expect(lastBot().textContent).toContain(
                'Matthew 5:44 says to love your enemies.',
            );
        });

        test('a thank-you under a found verse is answered by the window', async () => {
            seedTab([
                {
                    id: 1,
                    author: 'bot',
                    text: 'Matthew 5:44 has those words.',
                    verseFind: 'KJV',
                },
            ]);
            await render();
            await send('thank you!');
            expect(youTexts()).toEqual(['thank you!']);
            expect(lastBot().textContent).toContain(
                'You are welcome. When you want to find another verse, just tell me what you remember of it.',
            );
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
            expect(hoisted.callToolMock).not.toHaveBeenCalled();
        });
    });

    describe('asking with what is in the box', () => {
        test('a picture is refused before asking an assistant that cannot see', async () => {
            // The tab a handed-over file opens asks a model with no eyes.
            hoisted.settings.set(
                'chatbot-llm-model-free',
                'nvidia/nemotron-3.5-lightning:free',
            );
            hoisted.genAttachmentFromPathMock.mockImplementation(
                async (filePath: string) => {
                    putAttachmentData(
                        'picture-1',
                        'data:image/png;base64,iVBORw0KGgo=',
                    );
                    return {
                        attachment: {
                            id: 'picture-1',
                            kind: 'image',
                            name: 'screen.png',
                            mimeType: 'image/png',
                            byteSize: 12,
                            filePath,
                        },
                    };
                },
            );
            leave('chatbot-handoff-file', {
                filePath: '/church/Resources/screen.png',
            });
            await render();
            await send('what is wrong in this picture?');
            expect(
                container.querySelector('.chat-attach-error')?.textContent,
            ).toContain(
                'This assistant cannot look at pictures. Pick one that can, or take the picture off and describe it instead.',
            );
            // Nothing asked, nothing echoed; the picture waits in the box.
            expect(youTexts()).toEqual([]);
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
            expect(boxChips()).toEqual([expect.stringContaining('screen.png')]);
        });

        test('a file in the box goes with the question and leaves the box', async () => {
            hoisted.genAttachmentFromPathMock.mockImplementation(
                async (filePath: string) => {
                    return {
                        attachment: genTextAttachment(
                            'notes.txt',
                            'Psalm 23 for Sunday',
                            filePath,
                        ),
                    };
                },
            );
            leave('chatbot-handoff-file', {
                filePath: '/church/Resources/notes.txt',
            });
            await render();
            await send('/btw what does this say?');
            expect(hoisted.askLlmBotMock).toHaveBeenCalledOnce();
            const [asked, , , , , , extra] =
                hoisted.askLlmBotMock.mock.calls[0];
            expect(extra.isGeneral).toBe(true);
            expect(asked).toContain('Psalm 23 for Sunday');
            // Shown with the question that took it, gone from the box.
            const question =
                container.querySelector<HTMLElement>('article.cue-you')!;
            expect(question.textContent).toContain('/btw what does this say?');
            expect(question.textContent).toContain('notes.txt');
            expect(boxChips()).toEqual([]);
            // ...and stays open in the tab for the next question.
            expect(
                container.querySelector('.chat-open-files')?.textContent,
            ).toContain('Still asking about');
            expect(
                container.querySelector('.chat-open-files')?.textContent,
            ).toContain('notes.txt');
        });

        test('until a side is picked, a question follows the window it was opened from', async () => {
            hoisted.settings.set(
                'chatbot-sessions',
                JSON.stringify({
                    activeId: 'tab',
                    sessions: [
                        { ...toSession('tab', []), isFocusChosen: false },
                    ],
                }),
            );
            await render();
            const focusPick = () => {
                return container.querySelector<HTMLSelectElement>(
                    'select[aria-label="Which part of the app"]',
                )!.value;
            };
            expect(focusPick()).toBe('presenter');
            // The Reader opened it since.
            vi.stubGlobal('opener', { location: { pathname: '/reader.html' } });
            await send('/btw what is grace?');
            expect(hoisted.askLlmBotMock).toHaveBeenCalledOnce();
            expect(hoisted.askLlmBotMock.mock.calls[0][1]).toBe('reader');
            expect(focusPick()).toBe('reader');
        });
    });

    describe('a job handed over by another window', () => {
        test('a problem the app caught is offered as a report, nothing looked into yet', async () => {
            seedTab([{ id: 1, author: 'you', text: 'An earlier question' }]);
            leave('chatbot-handoff-report', {
                text: 'TypeError: screen is undefined in the Presenter window',
            });
            await render();
            expect(hoisted.settings.has('chatbot-handoff-report')).toBe(false);
            // A tab of its own, holding only the offer.
            expect(youTexts()).toEqual([]);
            const offer = lastBot();
            expect(offer.textContent).toContain('The app ran into a problem:');
            expect(offer.textContent).toContain(
                'TypeError: screen is undefined in the Presenter window',
            );
            expect(labelsIn(offer)).toEqual(['Report']);
            expect(hoisted.callToolMock).not.toHaveBeenCalled();
        });

        test("Help's Report asks what went wrong", async () => {
            leave('chatbot-handoff-report', { text: '' });
            await render();
            expect(lastBot().textContent).toContain(
                'Tell me what went wrong — or what you wish the app did better',
            );
        });

        test('a Resources file is attached in the box under a card about it', async () => {
            hoisted.genAttachmentFromPathMock.mockImplementation(
                async (filePath: string) => {
                    return {
                        attachment: genTextAttachment(
                            'notes.txt',
                            'Psalm 23 for Sunday',
                            filePath,
                        ),
                    };
                },
            );
            leave('chatbot-handoff-file', {
                filePath: '/church/Resources/notes.txt',
            });
            await render();
            expect(hoisted.genAttachmentFromPathMock).toHaveBeenCalledWith(
                '/church/Resources/notes.txt',
            );
            expect(lastBot().textContent).toContain(
                'notes.txt is attached below. Ask me anything about what is in it, or press a question.',
            );
            // Numbered as the tab's first attachment, waiting in the box.
            expect(boxChips()).toEqual([expect.stringContaining('notes.txt')]);
            expect(boxChips()[0]).toContain('1');
            expect(
                document.activeElement?.classList.contains('chat-input'),
            ).toBe(true);
        });

        test("a file taken into a tab in use is numbered after that tab's own", async () => {
            hoisted.genAttachmentFromPathMock.mockImplementation(
                async (filePath: string) => {
                    return {
                        attachment: genTextAttachment(
                            'notes.txt',
                            'Psalm 23 for Sunday',
                            filePath,
                        ),
                    };
                },
            );
            // Every tab in use: the file goes to the one in front, which
            // already showed the assistant a control as [3].
            const sessions = Array.from({ length: 12 }, (_, index) => {
                return toSession(`tab-${index}`, [
                    {
                        id: 1,
                        author: 'you',
                        text: `Question ${index}`,
                        attachments: [
                            {
                                id: `control-${index}`,
                                kind: 'element',
                                name: 'Clear All',
                                selector: '#clear-all',
                                number: 3,
                            },
                        ],
                    },
                ]);
            });
            hoisted.settings.set(
                'chatbot-sessions',
                JSON.stringify({ activeId: 'tab-4', sessions }),
            );
            leave('chatbot-handoff-file', {
                filePath: '/church/Resources/notes.txt',
            });
            await render();
            expect(youTexts()).toEqual(['Question 4']);
            expect(boxChips()).toEqual([expect.stringContaining('notes.txt')]);
            expect(
                container.querySelector('.chat-clip .chat-clip-number')
                    ?.textContent,
            ).toBe('3');
            const boxNumbers = [
                ...container.querySelectorAll<HTMLElement>('.chat-clip-number'),
            ]
                .filter((element) => {
                    return element.closest('article') === null;
                })
                .map((element) => {
                    return element.textContent;
                });
            expect(boxNumbers).toEqual(['4']);
        });

        test('a file that cannot be read is said so, and nothing is attached', async () => {
            hoisted.genAttachmentFromPathMock.mockResolvedValue({
                failure: 'notes.txt is not there any more.',
            });
            leave('chatbot-handoff-file', {
                filePath: '/church/Resources/notes.txt',
            });
            await render();
            expect(lastBot().textContent).toContain(
                'notes.txt is not there any more.',
            );
            expect(boxChips()).toEqual([]);
        });

        test("Bible Find's words are searched at once in its Bible", async () => {
            leave('chatbot-handoff-ask', {
                text: 'Help me find a Bible verse in "KJV": love your enemies',
            });
            await render();
            await settle();
            expect(youTexts()).toEqual([
                'Help me find a Bible verse in "KJV": love your enemies',
            ]);
            expect(callsOf(FIND_TOOL)).toContainEqual({
                bible: 'KJV',
                words: 'love your enemies',
            });
            expect(verseAsks()).toEqual([
                expect.objectContaining({
                    bible: 'KJV',
                    words: 'love your enemies',
                }),
            ]);
            expect(lastBot().textContent).toContain(
                'Matthew 5:44 says to love your enemies.',
            );
        });

        test('Bible Find with no words offers its Bible first', async () => {
            leave('chatbot-handoff-ask', {
                text: 'Help me find a Bible verse in "ASV"',
            });
            await render();
            expect(youTexts()).toEqual(['Help me find a Bible verse in "ASV"']);
            expect(labelsIn(lastBot())).toEqual([
                'ASV — American Standard Version (the one in Find)',
                'KJV — King James Version',
            ]);
        });

        test('a job handed over while the window is open is taken when main says so', async () => {
            await render();
            expect(botCards()).toEqual([]);
            leave('chatbot-handoff-report', { text: 'The screen went black' });
            const onLaunch = hoisted.listeners.get(
                'main:app:chatbot-launch-focus',
            );
            expect(onLaunch).toBeDefined();
            await act(async () => {
                onLaunch!({}, '/presenter.html');
            });
            await settle();
            expect(lastBot().textContent).toContain('The screen went black');
            // And the window's own focus takes one too.
            leave('chatbot-handoff-report', { text: 'The song is empty' });
            await act(async () => {
                window.dispatchEvent(new Event('focus'));
            });
            await settle();
            expect(lastBot().textContent).toContain('The song is empty');
        });

        test('with every tab in use, the job lands in the tab in front', async () => {
            const sessions = Array.from({ length: 12 }, (_, index) => {
                return toSession(`tab-${index}`, [
                    { id: 1, author: 'you', text: `Question ${index}` },
                ]);
            });
            hoisted.settings.set(
                'chatbot-sessions',
                JSON.stringify({ activeId: 'tab-4', sessions }),
            );
            leave('chatbot-handoff-report', { text: 'The screen went black' });
            await render();
            expect(youTexts()).toEqual(['Question 4']);
            expect(lastBot().textContent).toContain('The screen went black');
        });
    });
});
