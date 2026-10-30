// @vitest-environment jsdom

/**
 * The buttons under a person's, a place's or a passage's card in the help
 * window (`handleLookupStepRef`): every one answered by the window with no
 * model. The real step helpers run (`lookupStepHelpers`,
 * `lookupChatHelpers`); the tool host (`callTool`) and the model
 * (`askLlmBot`) are the boundaries. The lines typed under a card, the word
 * study and a handed-over record are `ChatbotAppComp.steps2.test.tsx`.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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

describe("a lookup card's buttons", () => {
    let container: HTMLDivElement;
    let root: Root;

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

    describe('a passage card', () => {
        test('opens the passage in the Bible Lookup, or says it could not', async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Open in bible lookup');
            expect(callsOf(FIND_TOOL)).toEqual([
                { open: 'GEN 8:1-3', bible: 'KJV' },
            ]);
            expect(youTexts()).toEqual(['Open in bible lookup']);
            expect(lastBot().textContent).toContain(
                'I opened Genesis 8:1-3 in the Bible Lookup.',
            );

            hoisted.tools.route = (name) => {
                if (name === FIND_TOOL) {
                    throw new Error('The window is gone');
                }
                return '';
            };
            await press('Open in bible lookup', botCards()[0]);
            expect(lastBot().textContent).toContain(
                'I could not open Genesis 8:1-3 in the Bible Lookup just now.',
            );
        });

        test('lists the other Bibles and opens the passage in the one pressed', async () => {
            const khmerFacts = {
                kind: 'verse',
                bible: 'KHOV',
                passages: [
                    {
                        key: 'GEN 8:1-3',
                        ref: 'Genesis 8:1-3',
                        title: 'លោកុប្បត្តិ ៨:១-៣',
                        text: '(១): ព្រះទ្រង់នឹកចាំពីណូអេ',
                    },
                ],
            };
            hoisted.tools.route = (name, args) => {
                if (name === FIND_TOOL) {
                    return {
                        bible: 'KJV',
                        bibles: [
                            { key: 'KJV', title: 'King James Version' },
                            { key: 'KHOV', title: 'Khmer Old Version' },
                        ],
                    };
                }
                if (name === LOOKUP_TOOL && args.bible === 'KHOV') {
                    return khmerFacts;
                }
                if (name === 'owa_resource_file') {
                    return { files: [{ file: 'pdf/GEN.8.pdf' }] };
                }
                return '';
            };
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Read it in another Bible');
            const listing = lastBot();
            expect(listing.textContent).toContain(
                'Which Bible should I read Genesis 8:1-3 in?',
            );
            // The Bible the card is in is not offered again.
            expect(labelsIn(listing)).toEqual(['KHOV — Khmer Old Version']);

            await press('KHOV — Khmer Old Version');
            expect(callsOf(LOOKUP_TOOL)).toContainEqual({
                kind: 'verse',
                ref: 'GEN 8:1-3',
                bible: 'KHOV',
                page: 'reader.html',
                related: true,
            });
            expect(callsOf('owa_resource_file')).toContainEqual({
                action: 'list',
                book: 'GEN',
                chapter: 8,
            });
            const card = lastBot();
            expect(card.textContent).toContain(
                'I have read លោកុប្បត្តិ ៨:១-៣ in the Bible KHOV.',
            );
            expect(card.textContent).toContain(
                'Resources has 1 study files for its chapter.',
            );
            expect(labelsIn(card)).toContain('Study files for this chapter');
        });

        test('says the passage is in the only Bible when none can be listed', async () => {
            hoisted.tools.route = (name) => {
                if (name === FIND_TOOL) {
                    throw new Error('No Bible is installed');
                }
                return '';
            };
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Read it in another Bible');
            expect(lastBot().textContent).toContain(
                'This is the only Bible on this computer.',
            );
        });

        test('names the people and places in it, and opens a person pressed', async () => {
            hoisted.tools.route = (name, args) => {
                if (name === LOOKUP_TOOL && args.names === true) {
                    return {
                        lang: 'en',
                        people: [{ id: 'noah', name: 'Noah' }],
                        places: [{ id: 'ararat', name: 'Ararat' }],
                    };
                }
                if (name === LOOKUP_TOOL && args.kind === 'name') {
                    return NOAH_FACTS;
                }
                if (name === FIND_TOOL) {
                    return {
                        bible: 'KJV',
                        words: ['Noah', 'Noe'],
                        total: 2,
                        byBook: [{ book: 'GEN', title: 'Genesis', verses: 2 }],
                        verses: [
                            {
                                key: 'GEN 6:8',
                                title: 'Genesis 6:8',
                                text: 'But Noah found grace',
                            },
                        ],
                    };
                }
                return '';
            };
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Who and where is in it');
            expect(callsOf(LOOKUP_TOOL)).toContainEqual({
                kind: 'verse',
                ref: 'GEN 8:1-3',
                bible: 'KJV',
                page: 'reader.html',
                names: true,
            });
            const names = lastBot();
            expect(names.textContent).toContain(
                'People and places in Genesis 8:1-3. Press one to ask about it.',
            );
            expect(labelsIn(names)).toEqual(['Noah', 'Ararat']);

            await press('Noah');
            expect(callsOf(LOOKUP_TOOL)).toContainEqual({
                kind: 'name',
                id: 'noah',
                lang: 'en',
                page: 'reader.html',
            });
            // The person's own Bible is searched for every name they had.
            expect(callsOf(FIND_TOOL)).toContainEqual({
                bible: 'KJV',
                words: 'Noah Noe',
                page: 'reader.html',
            });
            const card = lastBot();
            expect(card.textContent).toContain(
                'I have read what the names lookup holds on Noah',
            );
            expect(labelsIn(card)).toEqual([
                'Its verses',
                'Family and places',
                'Family line to Jesus',
                'Read it in another Bible',
            ]);
        });

        test('says when the names lookup has nobody in the passage', async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Who and where is in it');
            expect(lastBot().textContent).toContain(
                'The names lookup has nobody and no place in Genesis 8:1-3.',
            );
        });

        test('tells the cross references the card gathered, with no tool call', async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Related verses');
            expect(hoisted.callToolMock).not.toHaveBeenCalled();
            const answer = lastBot();
            expect(answer.textContent).toContain(
                "The app's cross references lead from Genesis 8:1-3 to 2 other verses.",
            );
            expect(answer.textContent).toContain('In the New Testament');
            expect(answer.textContent).toContain('Verse 1: God remembers');
            // The references, then the conversation's own way on.
            expect(labelsIn(answer)).toEqual([
                'Hebrews 11:7',
                'Matthew 24:38',
                'Previous chapter',
                'Next chapter',
                'More things to do',
            ]);
        });

        test('lists the study files of its chapter, each to ask about', async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Study files for this chapter');
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'The study files in Resources for the chapter of Genesis 8:1-3.',
            );
            expect(labelsIn(answer)[0]).toBe('Ask about GEN.8.pdf');
        });

        test('steps to the chapter before, and says when there is none after', async () => {
            hoisted.tools.route = (name, args) => {
                if (name === LOOKUP_TOOL && args.near === 'previous') {
                    return {
                        kind: 'verse',
                        bible: 'KJV',
                        passages: [
                            {
                                key: 'GEN 7',
                                ref: 'Genesis 7',
                                title: 'Genesis 7',
                                text: '(1): And the LORD said unto Noah',
                            },
                        ],
                    };
                }
                if (name === LOOKUP_TOOL && args.near === 'next') {
                    return { kind: 'verse', bible: 'KJV', passages: [] };
                }
                return '';
            };
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Previous chapter');
            expect(callsOf(LOOKUP_TOOL)).toContainEqual({
                kind: 'verse',
                ref: 'GEN 8:1-3',
                bible: 'KJV',
                page: 'reader.html',
                related: true,
                near: 'previous',
            });
            expect(lastBot().textContent).toContain(
                'I have read Genesis 7 in the Bible KJV.',
            );

            await press('Next chapter', botCards()[0]);
            expect(lastBot().textContent).toContain(
                'There is no passage after Genesis 8:1-3 in this Bible.',
            );
        });

        test('says a passage cannot be stepped back from when the record cannot be read', async () => {
            hoisted.tools.route = (name) => {
                if (name === LOOKUP_TOOL) {
                    throw new Error('The tool host is away');
                }
                return '';
            };
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Previous chapter');
            // The panel's window first, then any window.
            expect(callsOf(LOOKUP_TOOL)).toEqual([
                {
                    kind: 'verse',
                    ref: 'GEN 8:1-3',
                    bible: 'KJV',
                    page: 'reader.html',
                    related: true,
                    near: 'previous',
                },
                {
                    kind: 'verse',
                    ref: 'GEN 8:1-3',
                    bible: 'KJV',
                    related: true,
                    near: 'previous',
                },
            ]);
            expect(lastBot().textContent).toContain(
                'There is no passage before Genesis 8:1-3 in this Bible.',
            );
        });

        test('saves the passage to the Bibles list, or says it could not', async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Save to my Bibles list');
            expect(callsOf('owa_bible_item')).toEqual([
                { action: 'add', reference: 'Genesis 8:1-3', version: 'KJV' },
            ]);
            expect(lastBot().textContent).toContain(
                'Saved Genesis 8:1-3 to your Bibles list.',
            );

            hoisted.tools.route = (name) => {
                if (name === 'owa_bible_item') {
                    throw new Error('The list is locked');
                }
                return '';
            };
            await press('Save to my Bibles list', botCards()[0]);
            expect(lastBot().textContent).toContain(
                'I could not save Genesis 8:1-3 just now.',
            );
        });

        test('copies the passage as its Bible wrote it, or says it could not', async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Copy the passage');
            expect(hoisted.clipboardWriteMock).toHaveBeenCalledWith(
                `(KJV) Genesis 8:1-3\n${PASSAGE_TEXT}`,
            );
            expect(lastBot().textContent).toContain('Copied Genesis 8:1-3.');

            hoisted.clipboardWriteMock.mockRejectedValueOnce(
                new Error('No clipboard'),
            );
            await press('Copy the passage', botCards()[0]);
            expect(lastBot().textContent).toContain(
                'I could not copy it just now.',
            );
        });

        test('a passage read with no words cannot be saved or copied', async () => {
            const wordless = {
                kind: 'verse',
                bible: 'KJV',
                passages: [{ key: 'GEN 8:1-3' }],
            };
            seedTab([
                toCard(1, PASSAGE_ASK, wordless, 'I have read Genesis 8:1-3.'),
            ]);
            await render();
            await press('Save to my Bibles list');
            expect(lastBot().textContent).toContain(
                'I could not save Genesis 8:1-3 just now.',
            );
            await press('Copy the passage', botCards()[0]);
            expect(lastBot().textContent).toContain(
                'I could not copy it just now.',
            );
            expect(callsOf('owa_bible_item')).toEqual([]);
            expect(hoisted.clipboardWriteMock).not.toHaveBeenCalled();
        });

        test('a related verse that cannot be read still opens its card, saying so', async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Related verses');
            await press('Hebrews 11:7');
            expect(callsOf(LOOKUP_TOOL)).toEqual([
                {
                    kind: 'verse',
                    ref: 'HEB 11:7',
                    bible: 'KJV',
                    page: 'reader.html',
                    related: true,
                },
            ]);
            const card = lastBot();
            expect(card.textContent).toContain(
                'I could not read Hebrews 11:7 from the app just now. Ask me about it anyway and I will try again.',
            );
            // A card all the same: the conversation is about it now.
            expect(labelsIn(card)).toContain('Open in bible lookup');
        });

        test('offers every thing to do again under More things to do', async () => {
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Related verses');
            await press('More things to do');
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'What would you like to do with Genesis 8:1-3?',
            );
            expect(labelsIn(answer)).toEqual(labelsIn(botCards()[0]));
        });

        test('reads the record afresh for a step whose card is not in the tab', async () => {
            const otherAsk: LookupAskType = { ...PASSAGE_ASK, bibleKey: 'ASV' };
            hoisted.tools.route = (name, args) => {
                if (name === LOOKUP_TOOL && args.bible === 'ASV') {
                    return { ...PASSAGE_FACTS, bible: 'ASV' };
                }
                return '';
            };
            seedTab([
                {
                    id: 1,
                    author: 'bot',
                    text: 'Under an old answer.',
                    actions: [
                        {
                            label: 'More things to do',
                            toolName: LOOKUP_STEP_TOOL_NAME,
                            args: { step: 'more', ask: otherAsk },
                        },
                    ],
                },
            ]);
            await render();
            await press('More things to do');
            expect(callsOf(LOOKUP_TOOL)).toEqual([
                {
                    kind: 'verse',
                    ref: 'GEN 8:1-3',
                    bible: 'ASV',
                    page: 'reader.html',
                    related: true,
                },
            ]);
            expect(labelsIn(lastBot())).toContain('Related verses');
        });

        test('asks for another passage and opens the one typed', async () => {
            const psalmFacts = {
                kind: 'verse',
                bible: 'KJV',
                passages: [
                    {
                        key: 'PSA 23',
                        ref: 'Psalm 23',
                        title: 'Psalm 23',
                        text: '(1): The LORD is my shepherd',
                    },
                ],
            };
            hoisted.tools.route = (name, args) => {
                if (name === LOOKUP_TOOL && args.ref === 'Psalm 23') {
                    return psalmFacts;
                }
                return '';
            };
            seedTab([PASSAGE_CARD]);
            await render();
            await press('Open another passage');
            expect(lastBot().textContent).toContain(
                'Type the passage you want, like John 3:16 or Psalm 23.',
            );
            await send('Psalm   23');
            expect(callsOf(LOOKUP_TOOL)).toContainEqual({
                kind: 'verse',
                ref: 'Psalm 23',
                bible: 'KJV',
                page: 'reader.html',
                related: true,
            });
            expect(youTexts().at(-1)).toBe('Psalm   23');
            expect(lastBot().textContent).toContain(
                'I have read Psalm 23 in the Bible KJV.',
            );
            expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
        });
    });

    describe('a person or a place card', () => {
        test('lists the family and places, and the verses, of a person', async () => {
            seedTab([NOAH_CARD]);
            await render();
            await press('Family and places');
            const family = lastBot();
            expect(family.textContent).toContain(
                'The family and places of Noah. Press one to ask about it.',
            );
            expect(labelsIn(family)).toEqual([
                'Lamech',
                'Shem',
                'Ham',
                'Japheth',
                'Ararat',
            ]);
            await press('Its verses', botCards()[0]);
            const verses = lastBot();
            expect(verses.textContent).toContain(
                'Verses about Noah. Press one to read it with me.',
            );
            expect(verses.textContent).toContain(
                'The names lookup lists 3 verses; these are the first 1.',
            );
            expect(labelsIn(verses)).toEqual(['Genesis 6:8']);
            expect(hoisted.callToolMock).not.toHaveBeenCalled();
        });

        test("reads a person's family line from the genealogy that names them", async () => {
            hoisted.tools.route = (name, args) => {
                if (name !== LOOKUP_TOOL) {
                    return '';
                }
                if (args.ref === 'MAT 1:1-17') {
                    return {
                        bible: 'KJV',
                        passages: [
                            {
                                key: 'MAT 1:1-17',
                                ref: 'Matthew 1:1-17',
                                text: '(1): The book of the generation of Jesus Christ, the son of David',
                            },
                        ],
                    };
                }
                return {
                    bible: 'KJV',
                    passages: [
                        {
                            key: 'LUK 3:23-38',
                            ref: 'Luke 3:23-38',
                            title: 'Luke 3:23-38',
                            text: '(36): Which was the son of Sem, which was the son of Noe',
                        },
                    ],
                };
            };
            seedTab([NOAH_CARD]);
            await render();
            await press('Family line to Jesus');
            expect(callsOf(LOOKUP_TOOL)).toEqual([
                {
                    kind: 'verse',
                    ref: 'MAT 1:1-17',
                    bible: 'KJV',
                    page: 'reader.html',
                },
                {
                    kind: 'verse',
                    ref: 'LUK 3:23-38',
                    bible: 'KJV',
                    page: 'reader.html',
                },
            ]);
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'Here is the family line in Luke 3:23-38, from the Bible KJV, in the order it gives it:',
            );
            expect(answer.textContent).toContain('which was the son of Noe');
            expect(labelsIn(answer)).toEqual([
                'Open in bible lookup',
                'Open another passage',
            ]);
        });

        test('says when neither genealogy names the person, or none could be read', async () => {
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
                            text: '(1): The book of the generation of Jesus Christ',
                        },
                    ],
                };
            };
            seedTab([NOAH_CARD]);
            await render();
            await press('Family line to Jesus');
            expect(lastBot().textContent).toContain(
                'Neither family line the Bible gives — Matthew 1 and Luke 3 — names Noah.',
            );

            hoisted.tools.route = () => {
                throw new Error('The tool host is away');
            };
            await press('Family line to Jesus', botCards()[0]);
            expect(lastBot().textContent).toContain(
                'I could not do that just now.',
            );
        });

        test('opens a place on a map in the browser, built from its own point', async () => {
            seedTab([ARARAT_CARD]);
            await render();
            expect(labelsIn(botCards()[0])).toEqual([
                'Its verses',
                'Related places',
                'Read it in another Bible',
                'Show it on a map',
            ]);
            await press('Show it on a map');
            expect(hoisted.openExternalURLMock).toHaveBeenCalledWith(
                'https://www.google.com/maps/search/?api=1&query=39.7%2C44.3',
            );
            expect(lastBot().textContent).toContain(
                'Opened Ararat on a map in your browser.',
            );
        });

        test('says a place has no point on a map, and a failed open is said too', async () => {
            const nowhere = { ...ARARAT_FACTS, coordinates: undefined };
            const mapAction = {
                label: 'Show it on a map',
                toolName: LOOKUP_STEP_TOOL_NAME,
                args: { step: 'map', ask: ARARAT_ASK },
            };
            seedTab([
                {
                    ...toCard(1, ARARAT_ASK, nowhere, 'Ararat.'),
                    actions: [mapAction],
                },
            ]);
            await render();
            await press('Show it on a map');
            expect(lastBot().textContent).toContain(
                'The names lookup has no point on a map for Ararat.',
            );
            expect(hoisted.openExternalURLMock).not.toHaveBeenCalled();
        });

        test('a browser that fails to open says the step could not be done', async () => {
            hoisted.openExternalURLMock.mockImplementationOnce(() => {
                throw new Error('No browser');
            });
            seedTab([ARARAT_CARD]);
            await render();
            await press('Show it on a map');
            expect(lastBot().textContent).toContain(
                'I could not do that just now.',
            );
        });

        test('opens a related place pressed off the list, read by its id', async () => {
            hoisted.tools.route = (name, args) => {
                if (name === LOOKUP_TOOL && args.id === 'armenia') {
                    return {
                        kind: 'location',
                        name: 'Armenia (region)',
                        verseCount: 0,
                    };
                }
                return '';
            };
            seedTab([ARARAT_CARD]);
            await render();
            await press('Related places');
            expect(lastBot().textContent).toContain(
                'Places related to Ararat. Press one to ask about it.',
            );
            await press('Armenia');
            expect(callsOf(LOOKUP_TOOL)).toEqual([
                { kind: 'location', id: 'armenia', lang: 'en' },
            ]);
            // The record's own name titles the new card.
            expect(lastBot().textContent).toContain(
                'I have read what the names lookup holds on Armenia (region)',
            );
        });
    });
});
