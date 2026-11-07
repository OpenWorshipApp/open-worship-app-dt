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

vi.mock('../../../../../../server/appProvider', () => {
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
vi.mock('../../../../../../helper/settingHelpers', () => {
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
vi.mock('../../../../../../helper/appHooks', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../../../../../helper/appHooks')
        >();
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
vi.mock('../../../../../../chatbot/mcpClient', async (importOriginal) => {
    return {
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/mcpClient')
        >()),
        callTool: hoisted.callToolMock,
    };
});
vi.mock('../../../../../../chatbot/llmBotHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<
            typeof import('../../../../../../chatbot/llmBotHelpers')
        >()),
        askLlmBot: hoisted.askLlmBotMock,
    };
});

import ChatbotAppComp from '../../../../../../chatbot/ChatbotAppComp';
import { genLookupActions } from '../../../../../../chatbot/lookupStepHelpers';
import type { LookupAskType } from '../../../../../../helper/ai/lookupAskHelpers';

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

    describe('a passage card', () => {
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
    });
});
