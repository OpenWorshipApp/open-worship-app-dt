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
import { suggestQuestions } from '../../../../../../chatbot/questionHelpers';
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

        test('a passage in Khmer whose record has no words to quote says it could not', async () => {
            const khmerFacts = {
                kind: 'verse',
                bible: 'KHSV',
                passages: [{ key: 'GEN 8:1-3', title: 'លោកុប្បត្តិ ៨:១-៣' }],
            };
            seedTab([
                toCard(
                    1,
                    PASSAGE_ASK,
                    khmerFacts,
                    'I have read Genesis 8:1-3 in the Bible KHSV.',
                ),
            ]);
            await render();
            await send('show this passage in Khmer');
            const answer = lastBot();
            expect(answer.textContent).toContain(
                'I could not do that just now.',
            );
            expect(labelsIn(answer)).toEqual(['Read it in another Bible']);
        });
    });
});
