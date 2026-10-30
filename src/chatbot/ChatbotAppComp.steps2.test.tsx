// @vitest-environment jsdom

/**
 * What is TYPED in a lookup conversation, and what starts one: a passage
 * typed under "Open another passage" (read, or interpreted by the
 * assistant first), the word study (`readStudyPlace` /
 * `handleWordStudyRef`), the lines under a card the window answers itself
 * (`handleAsking`'s lookup readers) and a Lookup Detail panel's handed-over
 * record (`openHandedLookupRef`). The real reader helpers run; the tool host
 * (`callTool`) and the model (`askLlmBot`) are the boundaries. The card's
 * own buttons are `ChatbotAppComp.steps.test.tsx`.
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
        callToolMock: vi.fn(),
        askLlmBotMock: vi.fn(),
        openExternalURLMock: vi.fn(),
        clipboardWriteMock: vi.fn(),
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
                sendDataSync: () => null,
                listenForData: () => {},
                removeListener: () => {},
            },
            browserUtils: { openExternalURL: hoisted.openExternalURLMock },
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
import { genLookupActions, LOOKUP_STEP_TOOL_NAME } from './lookupStepHelpers';
import type { LookupAskType } from '../helper/ai/lookupAskHelpers';
import { suggestQuestions } from './questionHelpers';

const LOOKUP_TOOL = 'owa_lookup_record';
const FIND_TOOL = 'owa_find_verse';

const PASSAGE_ASK: LookupAskType = {
    kind: 'verse',
    target: 'GEN 8:1-3',
    title: 'Genesis 8:1-3',
    bibleKey: 'KJV',
    page: 'reader.html',
};
const PASSAGE_TEXT =
    '(1): And God remembered Noah. (2): The fountains also of the deep ' +
    'were stopped. (3): And the waters returned from off the earth.';
const PASSAGE_FACTS = {
    kind: 'verse',
    bible: 'KJV',
    passages: [
        {
            key: 'GEN 8:1-3',
            ref: 'Genesis 8:1-3',
            title: 'Genesis 8:1-3',
            text: PASSAGE_TEXT,
        },
    ],
    crossRefs: {
        referenceCount: 2,
        mostCited: [
            { key: 'HEB 11:7', title: 'Hebrews 11:7', from: ['1', '2'] },
        ],
        otherTestament: [{ key: 'MAT 24:38', title: 'Matthew 24:38' }],
        otherTestamentName: 'New Testament',
        byVerse: [{ verse: '1', themes: [{ theme: 'God remembers' }] }],
    },
    studyFiles: ['pdf/GEN.8.pdf'],
};

const NOAH_ASK: LookupAskType = {
    kind: 'name',
    target: 'noah',
    title: 'Noah',
    langCode: 'en',
    page: 'reader.html',
};
const NOAH_FACTS = {
    kind: 'name',
    name: 'Noah',
    kjvName: 'Noah',
    bible: 'KJV',
    otherForms: [{ name: 'Noe' }],
    verseCount: 3,
    quoted: [
        {
            key: 'GEN 6:8',
            ref: 'Genesis 6:8',
            title: 'Genesis 6:8',
            text: 'But Noah found grace in the eyes of the LORD.',
        },
    ],
    children: [
        { id: 'shem', name: 'Shem' },
        { id: 'ham', name: 'Ham' },
        { id: 'japheth', name: 'Japheth' },
    ],
    parents: [{ id: 'lamech', name: 'Lamech' }],
    places: [{ id: 'ararat', name: 'Ararat' }],
};

const ARARAT_ASK: LookupAskType = {
    kind: 'location',
    target: 'ararat',
    title: 'Ararat',
    langCode: 'en',
};
const ARARAT_FACTS = {
    kind: 'location',
    name: 'Ararat',
    bible: 'KJV',
    verseCount: 2,
    coordinates: { latitude: 39.7, longitude: 44.3 },
    relatedPlaces: [{ id: 'armenia', name: 'Armenia' }],
};

function toCard(id: number, ask: LookupAskType, facts: any, text: string) {
    return {
        id,
        author: 'bot',
        text,
        actions: genLookupActions(ask, facts),
        lookup: { ...ask, facts: JSON.stringify(facts) },
    };
}

const PASSAGE_CARD = toCard(
    1,
    PASSAGE_ASK,
    PASSAGE_FACTS,
    'I have read Genesis 8:1-3 in the Bible KJV.',
);
const NOAH_CARD = toCard(
    1,
    NOAH_ASK,
    NOAH_FACTS,
    'I have read what the names lookup holds on Noah.',
);
const ARARAT_CARD = toCard(
    1,
    ARARAT_ASK,
    ARARAT_FACTS,
    'I have read what the names lookup holds on Ararat.',
);

function seedTab(messages: any[], extra: Record<string, unknown> = {}) {
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
                    provider: 'free',
                    model: '',
                    isLocked: false,
                    ...extra,
                },
            ],
        }),
    );
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

describe('typing in a lookup conversation', () => {
    let container: HTMLDivElement;
    let root: Root;

    // A line that leaves the conversation is an ordinary question, and that
    // reads the supported-question corpus: loaded once here, where a slow
    // machine has the hook's time for it, not in the one test that needs it.
    beforeAll(async () => {
        await suggestQuestions('', 'presenter');
    }, 60000);

    beforeEach(() => {
        hoisted.settings.clear();
        // A new tab (a handed-over job opens one) asks the free assistant
        // by name, not Auto.
        hoisted.settings.set('chatbot-llm-auto', 'false');
        hoisted.settings.set('chatbot-llm-provider', 'free');
        hoisted.tools.route = () => {
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
        Object.defineProperty(window.navigator, 'clipboard', {
            configurable: true,
            value: { writeText: hoisted.clipboardWriteMock },
        });
        hoisted.clipboardWriteMock.mockResolvedValue(undefined);
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
        delete (window.navigator as any).clipboard;
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

    function findButton(label: string, scope?: HTMLElement) {
        const buttons = [
            ...(scope ?? container).querySelectorAll<HTMLButtonElement>(
                'button.cue-act',
            ),
        ].filter((button) => {
            return button.textContent === label;
        });
        expect(buttons.length).toBeGreaterThan(0);
        // The newest one: a list answered again stands under the last card.
        return buttons[buttons.length - 1];
    }

    async function press(label: string, scope?: HTMLElement) {
        const button = findButton(label, scope);
        await act(async () => {
            button.click();
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

    describe('a passage typed under "Open another passage"', () => {
        const AWAITING_ANSWER = {
            id: 2,
            author: 'bot',
            text: 'Type the passage you want, like John 3:16 or Psalm 23.',
            isLookupAnswer: true,
            lookupAwaits: PASSAGE_ASK,
        };
        const JOHN_FACTS = {
            kind: 'verse',
            bible: 'KJV',
            passages: [
                {
                    key: 'JHN 3:16',
                    ref: 'John 3:16',
                    title: 'John 3:16',
                    text: '(16): For God so loved the world',
                },
            ],
        };

        test('asks the assistant for the reference it meant and opens that', async () => {
            hoisted.tools.route = (name, args) => {
                if (name === LOOKUP_TOOL && args.ref === 'John 3:16') {
                    return JOHN_FACTS;
                }
                return '';
            };
            hoisted.model.waiting = () => {
                return { text: '{"kind":"value","value":"John 3:16"}' };
            };
            seedTab([PASSAGE_CARD, AWAITING_ANSWER]);
            await render();
            await send('the verse about God loving the world');
            expect(hoisted.askLlmBotMock).toHaveBeenCalledOnce();
            const [prompt, , provider, , , , extra] =
                hoisted.askLlmBotMock.mock.calls[0];
            expect(provider).toBe('free');
            expect(extra.isWaitingInput).toBe(true);
            expect(prompt).toContain('"valueKind":"passage"');
            expect(prompt).toContain('"previous":"Genesis 8:1-3"');
            expect(callsOf(LOOKUP_TOOL).at(-1)).toEqual({
                kind: 'verse',
                ref: 'John 3:16',
                bible: 'KJV',
                page: 'reader.html',
                related: true,
            });
            expect(lastBot().textContent).toContain(
                'I have read John 3:16 in the Bible KJV.',
            );
        });

        test("says the assistant's help and keeps waiting for a passage", async () => {
            hoisted.model.waiting = () => {
                return {
                    text: '{"kind":"help","reply":"Which book is it in?"}',
                };
            };
            seedTab([PASSAGE_CARD, AWAITING_ANSWER]);
            await render();
            await send('the one about the flood');
            expect(lastBot().textContent).toContain('Which book is it in?');
            // Still waiting: the next line is read as a passage too.
            hoisted.model.waiting = () => {
                return { text: 'not json at all' };
            };
            await send('no idea really');
            expect(lastBot().textContent).toContain(
                'I could not read “no idea really”. Type it like John 3:16 or Psalm 23.',
            );
            expect(hoisted.askLlmBotMock).toHaveBeenCalledTimes(2);
        });

        test('says what went wrong when the assistant cannot be asked', async () => {
            hoisted.model.waiting = () => {
                throw new Error('The free service is busy');
            };
            seedTab([PASSAGE_CARD, AWAITING_ANSWER]);
            await render();
            await send('somewhere in the gospels');
            expect(lastBot().textContent).toContain(
                'I could not answer that: The free service is busy',
            );
        });

        test('hands an unrelated line to the assistant, echoed once', async () => {
            hoisted.model.answer = () => {
                return { text: 'The projector is on the Presenter page.' };
            };
            seedTab([PASSAGE_CARD, AWAITING_ANSWER]);
            await render();
            await send('where is the projector button');
            // Interpreted first, then asked as an ordinary question.
            await waitFor(() => {
                return (
                    lastBot().textContent?.includes(
                        'The projector is on the Presenter page.',
                    ) === true
                );
            });
            expect(hoisted.askLlmBotMock).toHaveBeenCalledTimes(2);
            expect(hoisted.askLlmBotMock.mock.calls[1][6]).not.toHaveProperty(
                'isWaitingInput',
            );
            expect(
                youTexts().filter((text) => {
                    return text === 'where is the projector button';
                }),
            ).toHaveLength(1);
            expect(lastBot().textContent).toContain(
                'The projector is on the Presenter page.',
            );
        });

        test('Stop while the passage is read keeps the question waiting', async () => {
            let release: (value: string) => void = () => {};
            hoisted.callToolMock.mockImplementation(
                (_name: string, _args: any, signal: AbortSignal) => {
                    return new Promise((resolve, reject) => {
                        release = resolve;
                        signal?.addEventListener('abort', () => {
                            reject(new Error('aborted'));
                        });
                    });
                },
            );
            seedTab([PASSAGE_CARD, AWAITING_ANSWER]);
            await render();
            await send('Psalm 23');
            const stop =
                container.querySelector<HTMLButtonElement>('.chat-stop');
            expect(stop).not.toBeNull();
            await act(async () => {
                stop!.click();
            });
            await settle();
            release('');
            await settle();
            const stopped = lastBot();
            expect(stopped.textContent).toContain(
                'Stopped. I did not finish looking that up',
            );
            // The question it stopped is the one still asked.
            expect(stopped.textContent).toContain(
                'Type the passage you want, like John 3:16 or Psalm 23.',
            );
            expect(container.querySelector('.chat-stop')).toBeNull();
        });
    });

    describe('studying the words of a passage', () => {
        test('lists the verses, then the words of the verse pressed', async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Study the words');
            const verses = lastBot();
            expect(verses.textContent).toContain(
                'Which verse of Genesis 8:1-3 do you want to study?',
            );
            expect(labelsIn(verses)).toEqual([
                '1 · And God remembered Noah.',
                '2 · The fountains also of…',
                '3 · And the waters returned…',
                'More things to do',
            ]);
            await press('2 · The fountains also of…');
            expect(youTexts().at(-1)).toBe('2 · The fountains also of…');
            const words = lastBot();
            expect(words.textContent).toContain(
                'The fountains also of the deep were stopped.',
            );
            expect(labelsIn(words)).toEqual([
                'All words',
                'The',
                'fountains',
                'also',
                'of',
                'deep',
                'were',
                'stopped',
                'Another verse',
                'More things to do',
            ]);
            // All off the card: nothing read again.
            expect(hoisted.callToolMock).not.toHaveBeenCalled();
        });

        test('teaches a word pressed through the assistant, with the verse and its lesson', async () => {
            hoisted.model.answer = () => {
                return { text: 'A fountain is a spring of water.' };
            };
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Study the words');
            await press('2 · The fountains also of…');
            await press('fountains');
            expect(youTexts().at(-1)).toBe('Teach me the word fountains');
            expect(hoisted.askLlmBotMock).toHaveBeenCalledOnce();
            const [prompt, , , , , , extra] =
                hoisted.askLlmBotMock.mock.calls[0];
            expect(prompt).toContain(
                'Teach me the word “fountains” in Genesis 8:2.',
            );
            expect(extra.lookup).toMatchObject({
                page: 'reader.html',
                isStudy: true,
            });
            expect(lastBot().textContent).toContain(
                'A fountain is a spring of water.',
            );
        });

        test('teaches every word of a verse typed by its number', async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await send('explain each word of verse 3');
            expect(youTexts()).toEqual(['explain each word of verse 3']);
            expect(hoisted.askLlmBotMock).toHaveBeenCalledOnce();
            expect(hoisted.askLlmBotMock.mock.calls[0][0]).toContain(
                'Teach me every word of Genesis 8:3, one by one.',
            );
        });

        test('a typed word study with no verse named lists the verses', async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await send('teach me the vocabulary');
            expect(youTexts()).toEqual(['teach me the vocabulary']);
            expect(lastBot().textContent).toContain(
                'Which verse of Genesis 8:1-3 do you want to study?',
            );
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test('reads a verse the card cut short again by its key', async () => {
            const cutFacts = {
                ...PASSAGE_FACTS,
                passages: [
                    {
                        key: 'GEN 8:1-3',
                        ref: 'Genesis 8:1-3',
                        title: 'Genesis 8:1-3',
                        text: '(1): And God remembered Noah, and every…',
                    },
                ],
            };
            hoisted.tools.route = (name, args) => {
                if (name === LOOKUP_TOOL && args.page !== undefined) {
                    throw new Error('The Reader window was closed');
                }
                if (name === LOOKUP_TOOL && args.ref === 'GEN 8:3') {
                    return {
                        bible: 'KJV',
                        passages: [
                            {
                                key: 'GEN 8:3',
                                ref: 'Genesis 8:3',
                                text: '(3): And the waters returned from off the earth continually.',
                            },
                        ],
                    };
                }
                return '';
            };
            seedTab([
                toCard(1, PASSAGE_ASK, cutFacts, 'I have read Genesis 8:1-3.'),
            ]);
            await render();
            await press('Study the words');
            // A verse the record carried no words of shows its number.
            expect(labelsIn(lastBot())).toEqual([
                '1 · And God remembered Noah,…',
                '2',
                '3',
                'More things to do',
            ]);
            await press('3');
            // The panel's window first; that gone, any window reads it.
            expect(callsOf(LOOKUP_TOOL)).toEqual([
                {
                    kind: 'verse',
                    ref: 'GEN 8:3',
                    bible: 'KJV',
                    page: 'reader.html',
                },
                { kind: 'verse', ref: 'GEN 8:3', bible: 'KJV' },
            ]);
            expect(lastBot().textContent).toContain(
                'And the waters returned from off the earth continually.',
            );
        });

        test('says the words could not be read when the verse has none', async () => {
            const cutFacts = {
                ...PASSAGE_FACTS,
                passages: [
                    {
                        key: 'GEN 8:1-3',
                        ref: 'Genesis 8:1-3',
                        text: '(1): And God remembered Noah…',
                    },
                ],
            };
            seedTab([
                toCard(1, PASSAGE_ASK, cutFacts, 'I have read Genesis 8:1-3.'),
                {
                    id: 2,
                    author: 'bot',
                    text: 'Its words.',
                    isLookupAnswer: true,
                    actions: [
                        {
                            label: 'All words',
                            toolName: LOOKUP_STEP_TOOL_NAME,
                            args: {
                                step: 'verseWords',
                                ask: PASSAGE_ASK,
                                verse: 'GEN 8:3',
                            },
                        },
                    ],
                },
            ]);
            hoisted.tools.route = (name) => {
                if (name === LOOKUP_TOOL) {
                    throw new Error('No window can read it');
                }
                return '';
            };
            await render();
            await press('All words');
            // Read again by its key, in the panel's window and then in any.
            expect(callsOf(LOOKUP_TOOL)).toHaveLength(2);
            expect(youTexts().at(-1)).toBe('All words');
            expect(lastBot().textContent).toContain(
                'I could not read the words of Genesis 8:1-3 just now.',
            );
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test('opens a Google search for a word and offers the lesson again', async () => {
            seedTab([
                PASSAGE_CARD,
                {
                    id: 2,
                    author: 'bot',
                    text: 'A fountain is a spring.',
                    isLookupAnswer: true,
                    actions: [
                        {
                            label: 'Search Google for fountains',
                            toolName: LOOKUP_STEP_TOOL_NAME,
                            args: {
                                step: 'wordWeb',
                                ask: PASSAGE_ASK,
                                verse: 'GEN 8:2',
                                word: 'fountains',
                            },
                            isData: true,
                        },
                    ],
                },
            ]);
            await render();
            await press('Search Google for fountains');
            expect(hoisted.openExternalURLMock).toHaveBeenCalledWith(
                'https://www.google.com/search?q=%22fountains%22%20meaning',
            );
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'Opened a Google search for fountains in your browser.',
            );
            expect(labelsIn(answer)).toEqual([
                'Next word: also',
                'Choose a word',
                'More things to do',
            ]);
        });
    });

    describe('lines typed under a card', () => {
        test('a Bible asked for by its language lists only the Bibles in it', async () => {
            hoisted.tools.route = (name) => {
                if (name === FIND_TOOL) {
                    return {
                        bibles: [
                            { key: 'KJV', title: 'King James Version' },
                            { key: 'ASV', title: 'American Standard' },
                            { key: 'ពគប', title: 'ព្រះគម្ពីរ' },
                        ],
                    };
                }
                return '';
            };
            seedTab([PASSAGE_CARD]);
            await render();
            await send('show this passage in Khmer');
            expect(youTexts()).toEqual(['show this passage in Khmer']);
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'Which Bible should I read Genesis 8:1-3 in?',
            );
            expect(labelsIn(answer)).toEqual(['ពគប — ព្រះគម្ពីរ']);
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test("the record's own language shows the passage as it was opened", async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await send('show this passage in English');
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'Here is Genesis 8:1-3 from the Bible it was opened in.',
            );
            expect(answer.textContent).toContain('And God remembered Noah.');
            expect(labelsIn(answer)).toEqual(['Read it in another Bible']);
        });

        test("a line asking for one of the card's buttons names it and offers it", async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await send('please save this to my list');
            expect(lastBot().textContent).toContain(
                'Press Save to my Bibles list under the passage above.',
            );
            expect(labelsIn(lastBot())).toEqual(['Save to my Bibles list']);
            await send('go to the next chapter');
            expect(lastBot().textContent).toContain(
                'Press Next chapter under the passage above.',
            );
            expect(labelsIn(lastBot())).toEqual(['Next chapter']);
            // Offered, never pressed.
            expect(hoisted.callToolMock).not.toHaveBeenCalled();
        });

        test('a map asked for under a place offers its map button', async () => {
            seedTab([ARARAT_CARD]);
            await render();
            await send('show Ararat on a map');
            expect(youTexts()).toEqual(['show Ararat on a map']);
            expect(lastBot().textContent).toContain(
                'Press Show it on a map to open Ararat on a map in your browser.',
            );
            expect(labelsIn(lastBot())).toEqual(['Show it on a map']);
            expect(hoisted.openExternalURLMock).not.toHaveBeenCalled();
        });

        test('a family line asked for in words reads the genealogy', async () => {
            hoisted.tools.route = (name, args) => {
                if (name !== LOOKUP_TOOL) {
                    return '';
                }
                return {
                    bible: 'KJV',
                    passages: [
                        {
                            key: args.ref,
                            ref: args.ref,
                            text: '(36): Which was the son of Noe',
                        },
                    ],
                };
            };
            seedTab([NOAH_CARD]);
            await render();
            await send('show me the genealogy');
            expect(youTexts()).toEqual(['show me the genealogy']);
            expect(lastBot().textContent).toContain(
                'Here is the family line in MAT 1:1-17, from the Bible KJV',
            );
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });

        test('a "how many" question is counted from the record', async () => {
            seedTab([NOAH_CARD]);
            await render();
            await send('how many children did he have?');
            expect(lastBot().textContent).toContain(
                'The record names 3 children of Noah: Shem, Ham, Japheth.',
            );
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });
    });

    describe('a record handed over by a Lookup Detail panel', () => {
        function leaveLookup(ask: LookupAskType) {
            hoisted.settings.set(
                'chatbot-handoff-lookup',
                JSON.stringify({ ...ask, at: Date.now() }),
            );
        }

        test('opens a tab of its own on a card read in the panel window', async () => {
            hoisted.tools.route = (name, args) => {
                if (name === LOOKUP_TOOL && args.related === true) {
                    return PASSAGE_FACTS;
                }
                if (name === 'owa_resource_file') {
                    return {
                        files: [
                            { file: 'pdf/GEN.8.pdf' },
                            { file: 'pdf/GEN.0.pdf' },
                        ],
                    };
                }
                return '';
            };
            seedTab([{ id: 1, author: 'you', text: 'An earlier question' }]);
            leaveLookup(PASSAGE_ASK);
            await render();
            await settle();
            // Taken once.
            expect(hoisted.settings.has('chatbot-handoff-lookup')).toBe(false);
            expect(callsOf(LOOKUP_TOOL)).toEqual([
                {
                    kind: 'verse',
                    ref: 'GEN 8:1-3',
                    bible: 'KJV',
                    page: 'reader.html',
                    related: true,
                },
            ]);
            // A new tab, in front; the earlier conversation is left alone.
            expect(youTexts()).toEqual([]);
            const card = lastBot();
            expect(card.textContent).toContain(
                'I have read Genesis 8:1-3 in the Bible KJV.',
            );
            expect(card.textContent).toContain(
                'Resources has 2 study files for its chapter.',
            );
            expect(labelsIn(card)).toContain('Related verses');
        });

        test("reads the record in any window when the panel's has gone", async () => {
            hoisted.tools.route = (name, args) => {
                if (name === LOOKUP_TOOL && args.page !== undefined) {
                    throw new Error('No such window');
                }
                if (name === LOOKUP_TOOL) {
                    return NOAH_FACTS;
                }
                return '';
            };
            leaveLookup(NOAH_ASK);
            await render();
            await settle();
            expect(callsOf(LOOKUP_TOOL)).toEqual([
                { kind: 'name', id: 'noah', lang: 'en', page: 'reader.html' },
                { kind: 'name', id: 'noah', lang: 'en' },
            ]);
            expect(lastBot().textContent).toContain(
                'I have read what the names lookup holds on Noah',
            );
        });

        test('Stop while the record is read leaves no card behind', async () => {
            hoisted.callToolMock.mockImplementation(
                (_name: string, _args: any, signal: AbortSignal) => {
                    return new Promise((_resolve, reject) => {
                        signal.addEventListener('abort', () => {
                            reject(new Error('aborted'));
                        });
                    });
                },
            );
            leaveLookup(NOAH_ASK);
            await render();
            await settle();
            const stop =
                container.querySelector<HTMLButtonElement>('.chat-stop');
            expect(stop).not.toBeNull();
            await act(async () => {
                stop!.click();
            });
            await settle();
            // Only the panel's window was asked: a stopped read is not
            // tried again elsewhere.
            expect(callsOf(LOOKUP_TOOL)).toHaveLength(1);
            expect(botCards()).toHaveLength(1);
            expect(lastBot().textContent).toContain(
                'Stopped. I did not finish looking that up',
            );
            expect(container.textContent).not.toContain(
                'I have read what the names lookup holds on Noah',
            );
        });

        test('says it could not read a record no window can read', async () => {
            hoisted.tools.route = (name) => {
                if (name === LOOKUP_TOOL) {
                    throw new Error('No names dataset');
                }
                return '';
            };
            leaveLookup(ARARAT_ASK);
            await render();
            await settle();
            expect(lastBot().textContent).toContain(
                'I could not read Ararat from the app just now.',
            );
        });

        test('with the tab strip full, it opens in an empty tab', async () => {
            const sessions = Array.from({ length: 12 }, (_, index) => {
                return {
                    id: `tab-${index}`,
                    title: `Tab ${index}`,
                    messages:
                        index === 7
                            ? []
                            : [
                                  {
                                      id: 1,
                                      author: 'you',
                                      text: `Question ${index}`,
                                  },
                              ],
                    draft: '',
                    focus: 'presenter',
                    isFocusChosen: true,
                    provider: 'free',
                    model: '',
                    isLocked: false,
                };
            });
            hoisted.settings.set(
                'chatbot-sessions',
                JSON.stringify({ activeId: 'tab-0', sessions }),
            );
            hoisted.tools.route = (name) => {
                return name === LOOKUP_TOOL ? ARARAT_FACTS : '';
            };
            leaveLookup(ARARAT_ASK);
            await render();
            await settle();
            // The empty tab is in front, with the card and nothing else.
            expect(youTexts()).toEqual([]);
            expect(botCards()).toHaveLength(1);
            expect(lastBot().textContent).toContain(
                'I have read what the names lookup holds on Ararat',
            );
        });
    });
});
