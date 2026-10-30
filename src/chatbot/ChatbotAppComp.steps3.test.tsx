// @vitest-environment jsdom

/**
 * A Bible installed in the help window one question at a time
 * (`handleBibleImportStep`), with no model -- a typed request, a press, a
 * request handed over by Settings -- and the replies the window cannot read
 * by itself, which ONE short interpretation by the assistant turns into a
 * press of the question's own buttons (`askWaitingInput`), or hands back to
 * an ordinary answer when they were about something else. Beside it, the
 * same for the verse finder's "Which Bible?" (`handleVerseFindInputRef`),
 * a typed answer under a report's "Try this first" card, and an empty Send.
 * The real step helpers run (`bibleImportChatHelpers`,
 * `verseFindChatHelpers`, `waitingInputHelpers`); the tool host
 * (`callTool`) and the model (`askLlmBot`) are the boundaries.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

const hoisted = vi.hoisted(() => {
    return {
        settings: new Map<string, string>(),
        // The person's own servers as main holds them (Settings → AI
        // Providers → Custom servers), or nothing.
        customServers: null as string | null,
        callToolMock: vi.fn(),
        askLlmBotMock: vi.fn(),
        // What the fake tool host answers, per test: a tool's JSON (or its
        // words), or a throw for a tool that failed.
        tools: {
            route: (_name: string, _args: any): any => {
                return '';
            },
        },
        // The model's answers, per test: the waiting-input interpreter's
        // JSON, and an ordinary answer.
        model: {
            waiting: (_prompt: string): any => {
                return { text: '{"kind":"unrelated"}' };
            },
            answer: (_prompt: string): any => {
                return { text: 'An answer from the assistant.' };
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
                sendDataSync: (channel: string, data: any) => {
                    return channel === 'main:app:client-setting' &&
                        data?.key === 'ai-custom-servers'
                        ? hoisted.customServers
                        : null;
                },
                listenForData: () => {},
                removeListener: () => {},
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
        // Only the handed-over job runs (`takeHandoff`): the window's other
        // startup work lists windows, reads the registry and saves the tabs
        // through main, none of which these tests are about.
        useAppEffect: (effect: () => any, deps?: any[]) => {
            useEffect(() => {
                return String(effect).includes('takeHandoff')
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

import ChatbotAppComp from './ChatbotAppComp';
import { suggestQuestions } from './questionHelpers';
import { REPORT_FIXED_TOOL_NAME, REPORT_STILL_TOOL_NAME } from './reportMarks';
import { VERSE_FIND_STEP_TOOL_NAME } from './verseFindChatHelpers';

const BIBLE_TOOL = 'owa_bible_xml';
const FIND_TOOL = 'owa_find_verse';
const LANGUAGE_QUESTION = 'Which language do you want the Bible in?';
const LANGUAGE_BUTTONS = [
    'Khmer',
    'English',
    'French',
    'A file on this computer',
];
const BIBLE_QUESTION = 'Which Bible should I search?';

function seedTab(
    messages: any[],
    assistant: { provider: string; model: string } = {
        provider: 'free',
        model: '',
    },
) {
    hoisted.settings.set(
        'chatbot-sessions',
        JSON.stringify({
            activeId: 'tab',
            sessions: [
                {
                    id: 'tab',
                    title: '',
                    messages,
                    draft: '',
                    focus: 'presenter',
                    isFocusChosen: true,
                    isLocked: false,
                    ...assistant,
                },
            ],
        }),
    );
}

// A local Ollama with one model, the tab asking it by name.
const LOCAL_SERVERS = JSON.stringify({
    servers: [
        {
            id: 'lab',
            name: 'Local Ollama',
            baseUrl: 'http://localhost:11434/v1',
            models: [{ id: 'gemma', model: 'gemma4:e4b', name: 'Gemma 4' }],
        },
    ],
});
const LOCAL_ASSISTANT = { provider: 'custom', model: 'lab/gemma' };

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

/** The waiting-input interpretations asked of the model, their prompts. */
function waitingPrompts() {
    return hoisted.askLlmBotMock.mock.calls
        .filter((call) => {
            return call[6]?.isWaitingInput === true;
        })
        .map((call) => {
            return String(call[0]);
        });
}

// The verse finder's "Which Bible?" as the window wrote it, with the two
// Bibles the tool host lists below.
const BIBLE_LIST = {
    bible: 'KJV',
    bibles: [
        { key: 'KJV', title: 'King James Version' },
        { key: 'ASV', title: 'American Standard Version' },
    ],
};
const WHICH_BIBLE_ANSWER = {
    id: 2,
    author: 'bot',
    text: '**Which Bible should I search?** Pick one below.',
    actions: BIBLE_LIST.bibles.map((bible) => {
        return {
            label: `${bible.key} — ${bible.title}`,
            toolName: VERSE_FIND_STEP_TOOL_NAME,
            args: { step: 'remember', bible: bible.key, title: bible.title },
        };
    }),
};

describe('Bible import and the questions the window waits on', () => {
    let container: HTMLDivElement;
    let root: Root;

    // A reply that leaves the waiting question is an ordinary question, and
    // that reads the supported-question corpus: loaded once here, where a
    // slow machine has the hook's time for it, not inside a test.
    beforeAll(async () => {
        await suggestQuestions('', 'presenter');
    }, 60000);

    beforeEach(() => {
        hoisted.settings.clear();
        hoisted.customServers = null;
        // A new tab (a handed-over job opens one) asks the free assistant
        // by name, not Auto.
        hoisted.settings.set('chatbot-llm-auto', 'false');
        hoisted.settings.set('chatbot-llm-provider', 'free');
        hoisted.tools.route = (name, args) => {
            // The provided KJV is installed, so an import goes straight on.
            if (name === BIBLE_TOOL && args.action === 'list') {
                return { bibles: [{ key: 'KJV' }] };
            }
            if (name === BIBLE_TOOL && args.action === 'check') {
                return { problem: 'server' };
            }
            if (name === FIND_TOOL) {
                return BIBLE_LIST;
            }
            return '';
        };
        hoisted.model.waiting = () => {
            return { text: '{"kind":"unrelated"}' };
        };
        hoisted.model.answer = () => {
            return { text: 'An answer from the assistant.' };
        };
        hoisted.callToolMock.mockImplementation(
            async (name: string, args: any) => {
                const result = hoisted.tools.route(name, args);
                return typeof result === 'string'
                    ? result
                    : JSON.stringify(result);
            },
        );
        hoisted.askLlmBotMock.mockImplementation(
            async (prompt: string, ...rest: any[]) => {
                const extra = rest[5] ?? {};
                return extra.isWaitingInput === true
                    ? hoisted.model.waiting(prompt)
                    : hoisted.model.answer(prompt);
            },
        );
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

    /** Waits, a few milliseconds at a time, until the window shows it. */
    async function waitFor(check: () => boolean, rounds = 400) {
        for (let index = 0; index < rounds && !check(); index++) {
            await act(async () => {
                await new Promise((resolve) => {
                    setTimeout(resolve, 5);
                });
            });
        }
        expect(check()).toBe(true);
    }

    async function render() {
        await act(async () => {
            root.render(<ChatbotAppComp />);
        });
        await settle(2);
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

    function noteOf(element: HTMLElement) {
        return element.querySelector('.cue-note')?.textContent ?? null;
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

    async function send(value: string) {
        typeQuestion(value);
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-send')!.click();
        });
        await settle();
    }

    describe('installing a Bible', () => {
        test('a typed request asks the language first when the provided KJV is there', async () => {
            await render();
            await send('Import bible');
            expect(youTexts()).toEqual(['Import bible']);
            expect(callsOf(BIBLE_TOOL)).toEqual([{ action: 'list' }]);
            const question = lastBot();
            expect(question.textContent).toContain(LANGUAGE_QUESTION);
            expect(labelsIn(question)).toEqual(LANGUAGE_BUTTONS);
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test('a press searches the collection and a failed download is said with a way to try again', async () => {
            await render();
            await send('Import bible');
            await press('English');
            expect(youTexts().at(-1)).toBe('English');
            expect(callsOf(BIBLE_TOOL).at(-1)).toMatchObject({
                action: 'check',
                find: 'English',
            });
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'That website had a problem sending the file. Try again later.',
            );
            expect(labelsIn(answer)).toEqual(['Try again']);
        });

        test('a request handed over by Settings starts in a tab of its own', async () => {
            seedTab([{ id: 1, author: 'you', text: 'An earlier question' }]);
            hoisted.settings.set(
                'chatbot-handoff-ask',
                JSON.stringify({ text: 'Import bible', at: Date.now() }),
            );
            await render();
            await settle();
            expect(hoisted.settings.has('chatbot-handoff-ask')).toBe(false);
            // Their request as they would say it, in a new tab.
            expect(youTexts()).toEqual(['Import a Bible']);
            expect(lastBot().textContent).toContain(LANGUAGE_QUESTION);
        });

        test("a reply in other words is interpreted, and the assistant's help keeps the question", async () => {
            hoisted.model.waiting = () => {
                return {
                    text: '{"kind":"help","reply":"Which language does she read?"}',
                };
            };
            await render();
            await send('Import bible');
            await send('which one is best for my grandmother?');
            const prompts = waitingPrompts();
            expect(prompts).toHaveLength(1);
            expect(prompts[0]).toContain(LANGUAGE_QUESTION);
            expect(prompts[0]).toContain('"valueKind":"search"');
            expect(prompts[0]).toContain(
                '"typed":"which one is best for my grandmother?"',
            );
            const answer = lastBot();
            expect(noteOf(answer)).toBe('Which language does she read?');
            expect(answer.textContent).toContain(LANGUAGE_QUESTION);
            expect(labelsIn(answer)).toEqual(LANGUAGE_BUTTONS);
        });

        test('a choice the assistant read in the words runs that step', async () => {
            hoisted.model.waiting = () => {
                return { text: '{"kind":"choice","choice":2}' };
            };
            await render();
            await send('Import bible');
            await send('the second one would be good, please');
            // The second button's step: the collection searched for English.
            expect(callsOf(BIBLE_TOOL).at(-1)).toMatchObject({
                action: 'check',
                find: 'English',
            });
            expect(youTexts().at(-1)).toBe(
                'the second one would be good, please',
            );
            const answer = lastBot();
            expect(noteOf(answer)).toBeNull();
            expect(answer.textContent).toContain(
                'That website had a problem sending the file.',
            );
        });

        test('a reply nobody could read keeps the question with a sentence saying so', async () => {
            hoisted.model.waiting = () => {
                return { text: 'I think they mean something' };
            };
            await render();
            await send('Import bible');
            await send('hmm what about the old one?');
            const answer = lastBot();
            expect(noteOf(answer)).toBe(
                'I could not understand that choice. Choose an option below, or say it another way.',
            );
            expect(labelsIn(answer)).toEqual(LANGUAGE_BUTTONS);
        });

        test('an assistant that fails keeps the question and says what went wrong', async () => {
            hoisted.model.waiting = () => {
                throw new Error('The free service is busy');
            };
            await render();
            await send('Import bible');
            await send('the one my church uses, please');
            const answer = lastBot();
            expect(noteOf(answer)).toBe(
                'I could not answer that: The free service is busy',
            );
            expect(answer.textContent).toContain(LANGUAGE_QUESTION);
        });

        test('a reply about something else leaves the import for an ordinary answer, echoed once', async () => {
            hoisted.model.answer = () => {
                return { text: 'Songs are in the Lyrics list.' };
            };
            await render();
            await send('Import bible');
            await send('where do I find my songs?');
            await waitFor(() => {
                return (
                    lastBot().textContent?.includes(
                        'Songs are in the Lyrics list.',
                    ) === true
                );
            });
            expect(waitingPrompts()).toHaveLength(1);
            expect(hoisted.askLlmBotMock).toHaveBeenCalledTimes(2);
            expect(
                youTexts().filter((text) => {
                    return text === 'where do I find my songs?';
                }),
            ).toHaveLength(1);
        });
    });

    describe('"Which Bible should I search?" answered in words', () => {
        test('a Bible named in other words is picked through the assistant', async () => {
            hoisted.model.waiting = () => {
                return { text: '{"kind":"choice","choice":2}' };
            };
            seedTab([
                { id: 1, author: 'you', text: 'Help me find a Bible verse' },
                WHICH_BIBLE_ANSWER,
            ]);
            await render();
            await send('the American one please');
            const prompts = waitingPrompts();
            expect(prompts).toHaveLength(1);
            expect(prompts[0]).toContain(
                '{"id":2,"label":"ASV — American Standard Version"}',
            );
            // Their words once, then the next question for the Bible read.
            expect(youTexts()).toEqual([
                'Help me find a Bible verse',
                'the American one please',
            ]);
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'I will search ASV — American Standard Version.',
            );
            expect(answer.textContent).toContain(
                'What do you remember about the verse?',
            );
            expect(labelsIn(answer)).toEqual(['Search another Bible']);
        });

        test('a Bible picked for words already remembered searches them in it at once', async () => {
            hoisted.model.waiting = () => {
                return { text: '{"kind":"choice","choice":1}' };
            };
            hoisted.model.answer = () => {
                return { text: 'Matthew 5:44 says love your enemies.' };
            };
            seedTab([
                {
                    ...WHICH_BIBLE_ANSWER,
                    actions: WHICH_BIBLE_ANSWER.actions.map((action) => {
                        return {
                            ...action,
                            args: {
                                ...action.args,
                                words: 'love your enemies',
                            },
                        };
                    }),
                },
            ]);
            await render();
            await send('the first one');
            await waitFor(() => {
                return (
                    lastBot().textContent?.includes(
                        'Matthew 5:44 says love your enemies.',
                    ) === true
                );
            });
            // The words searched in the Bible picked, before the model.
            expect(callsOf(FIND_TOOL)).toContainEqual({
                bible: 'KJV',
                words: 'love your enemies',
            });
            const asked = hoisted.askLlmBotMock.mock.calls.find((call) => {
                return call[6]?.isWaitingInput !== true;
            });
            expect(asked?.[6]?.verseFind).toMatchObject({
                bible: 'KJV',
                words: 'love your enemies',
            });
            // The pick shown once, as typed: the search adds no second echo.
            expect(youTexts()).toEqual(['the first one']);
        });

        test("the assistant's help keeps the Bibles to pick from", async () => {
            hoisted.model.waiting = () => {
                return {
                    text: '{"kind":"help","reply":"Do you want English or another language?"}',
                };
            };
            seedTab([WHICH_BIBLE_ANSWER]);
            await render();
            await send('which is easier to read?');
            const answer = lastBot();
            expect(noteOf(answer)).toBe(
                'Do you want English or another language?',
            );
            expect(answer.textContent).toContain(BIBLE_QUESTION);
            expect(labelsIn(answer)).toEqual([
                'KJV — King James Version',
                'ASV — American Standard Version',
            ]);
        });

        test('a reply nobody could read, or a failed ask, keeps the Bibles too', async () => {
            hoisted.model.waiting = () => {
                return { text: 'no idea' };
            };
            seedTab([WHICH_BIBLE_ANSWER]);
            await render();
            await send('not sure what that means');
            expect(noteOf(lastBot())).toBe(
                'I could not understand that choice. Choose an option below, or say it another way.',
            );
            hoisted.model.waiting = () => {
                throw new Error('No assistant answered');
            };
            await send('the one in my language');
            const answer = lastBot();
            expect(noteOf(answer)).toBe(
                'I could not answer that: No assistant answered',
            );
            expect(labelsIn(answer)).toHaveLength(2);
        });

        test('a reply about something else gets an ordinary answer', async () => {
            hoisted.model.answer = () => {
                return { text: 'The screens are on the Presenter page.' };
            };
            seedTab([WHICH_BIBLE_ANSWER]);
            await render();
            await send('how do I show the screens?');
            await waitFor(() => {
                return (
                    lastBot().textContent?.includes(
                        'The screens are on the Presenter page.',
                    ) === true
                );
            });
            expect(
                youTexts().filter((text) => {
                    return text === 'how do I show the screens?';
                }),
            ).toHaveLength(1);
        });
    });

    describe('a typed answer under "Try this first"', () => {
        const FIX_CARD = [
            {
                id: 1,
                author: 'you',
                text: 'The projector froze',
                note: 'Reporting a problem.',
            },
            {
                id: 2,
                author: 'bot',
                text: 'Try this first: press Clear All, then show it again.',
                actions: [
                    {
                        label: 'That fixed it',
                        toolName: REPORT_FIXED_TOOL_NAME,
                        args: { reference: 'OWA-1' },
                    },
                    {
                        label: 'Still a problem — report it',
                        toolName: REPORT_STILL_TOOL_NAME,
                        args: { reference: 'OWA-1' },
                    },
                ],
            },
        ];

        test('"yes, thanks" closes the report with nothing sent', async () => {
            seedTab(FIX_CARD);
            await render();
            await send('yes, thanks');
            expect(youTexts().at(-1)).toBe('yes, thanks');
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'Good. Nothing was sent, and this report is closed.',
            );
            expect(noteOf(answer)).toBe('Solved without a report.');
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
            expect(
                container.querySelector<HTMLTextAreaElement>('.chat-input')
                    ?.value,
            ).toBe('');
        });

        test('"no" asks for the report again when it is no longer held', async () => {
            seedTab(FIX_CARD);
            await render();
            await send('no');
            expect(lastBot().textContent).toContain(
                'That report is not prepared any more',
            );
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });
    });

    describe("on a server of the person's own", () => {
        beforeEach(() => {
            hoisted.customServers = LOCAL_SERVERS;
            seedTab([], LOCAL_ASSISTANT);
        });

        test('a song asked for by its title is looked up by the app, with no model', async () => {
            hoisted.tools.route = (name) => {
                if (name === 'owa_lyric_validate') {
                    throw new Error('The song collection is not reachable');
                }
                return '';
            };
            await render();
            await send('Create a lyric file for song "Amazing Grace"');
            expect(callsOf('owa_lyric_validate')).toEqual([
                { mode: 'find', title: 'Amazing Grace' },
            ]);
            expect(youTexts()).toEqual([
                'Create a lyric file for song "Amazing Grace"',
            ]);
            expect(lastBot().textContent).toContain(
                'I could not look up "Amazing Grace" just now.',
            );
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test('a song asked for by its link is read by the app, with no model', async () => {
            hoisted.tools.route = (name) => {
                if (name === 'owa_lyric_validate') {
                    throw new Error('The page did not load');
                }
                return '';
            };
            await render();
            await send(
                'Create a lyric file from https://hymnary.org/text/amazing_grace',
            );
            expect(callsOf('owa_lyric_validate')).toEqual([
                {
                    url: 'https://hymnary.org/text/amazing_grace',
                    mode: 'draft',
                },
            ]);
            expect(lastBot().textContent).toContain(
                'Check the address, or copy the words off the page',
            );
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test('a screen asked off with every screen off offers to turn it on, never a clear', async () => {
            hoisted.tools.route = (name) => {
                return name === 'owa_list_screens'
                    ? { isAnyShowing: false, displayCount: 1, screens: [] }
                    : '';
            };
            await render();
            await send('Turn off the screen for me');
            const answer = lastBot();
            expect(answer.textContent).toContain('Nothing to turn off.');
            expect(labelsIn(answer)).toEqual(['Turn the screen on']);
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test('a slide asked for off the Presenter says where the slides are', async () => {
            hoisted.tools.route = (name) => {
                return name === 'owa_app_state'
                    ? { mainWindow: { page: 'reader.html' } }
                    : '';
            };
            await render();
            await send('Show the next slide');
            expect(lastBot().textContent).toContain(
                'The main window is not on the Presenter, so there is no slide list to choose from.',
            );
            expect(labelsIn(lastBot())).toEqual(['Go to the Presenter']);
            await send('show verse 1 on screen for me');
            expect(labelsIn(lastBot())).toEqual(['Go to the Presenter']);
            expect(callsOf('owa_app_state')).toHaveLength(2);
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test('a control asked for by its name is outlined where it is', async () => {
            hoisted.tools.route = (name) => {
                return name === 'owa_find_ui'
                    ? {
                          count: 1,
                          matches: [
                              {
                                  label: 'Clear All',
                                  isVisible: true,
                                  tier: 0,
                              },
                          ],
                      }
                    : '';
            };
            await render();
            await send('Where is the button for Clear All');
            expect(callsOf('owa_find_ui')).toEqual([
                { text: 'Clear All', page: 'presenter.html' },
                { text: 'Clear All', highlight: true, page: 'presenter.html' },
            ]);
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'Clear All is on screen now — I have outlined it in red',
            );
            expect(labelsIn(answer)).toEqual(['Highlight again']);
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });
    });

    test('Send with nothing in the box asks nothing', async () => {
        await render();
        await send('   ');
        expect(youTexts()).toEqual([]);
        expect(botCards()).toEqual([]);
        expect(hoisted.callToolMock).not.toHaveBeenCalled();
        expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
    });
});
