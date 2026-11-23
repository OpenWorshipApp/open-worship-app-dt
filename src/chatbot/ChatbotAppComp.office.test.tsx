// @vitest-environment jsdom

/**
 * A PowerPoint or Word file handed to the help window from the Documents
 * list (EC-761): the card the window writes with no model, then a typed
 * change asked with the file read first, under the office conversation's
 * own tool. The tool host (`callTool`), the model (`askLlmBot`) and the
 * file read (`genAttachmentFromPath`) are the boundaries.
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
                // A file in the box is read again at the ask, its name
                // first (`refreshTextAttachment`).
                basename: (filePath: string) => {
                    return filePath.split(/[\\/]/).pop() ?? filePath;
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
import { genTextAttachment } from './attachmentHelpers';
import { OFFICE_EDIT_TOOL_NAME } from './officeChatHelpers';

const DECK_PATH = '/church/documents/Sunday Welcome.pptx';
const DECK_READ = {
    file: 'Sunday Welcome.pptx',
    kind: 'PowerPoint',
    slideCount: 1,
    slides: [
        {
            slide: 1,
            lines: [
                { id: '1.1', box: 'title', text: 'Welcome' },
                { id: '1.2', text: 'Praise the Lord' },
            ],
        },
    ],
};

/** A request another window leaves for this one, as it leaves it. */
function leave(key: string, data: Record<string, unknown>) {
    hoisted.settings.set(key, JSON.stringify({ ...data, at: Date.now() }));
}

describe('a PowerPoint handed over from the Documents list', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        hoisted.settings.clear();
        hoisted.listeners.clear();
        hoisted.callToolMock.mockReset();
        hoisted.askLlmBotMock.mockReset();
        hoisted.settings.set('chatbot-llm-auto', 'false');
        hoisted.settings.set('chatbot-llm-provider', 'free');
        hoisted.callToolMock.mockImplementation(
            async (name: string, args: any) => {
                if (name === OFFICE_EDIT_TOOL_NAME && args.action === 'read') {
                    return JSON.stringify(DECK_READ);
                }
                return '';
            },
        );
        hoisted.askLlmBotMock.mockResolvedValue({
            text: 'I changed Lord to God. It is kept in the file.',
        });
        hoisted.genAttachmentFromPathMock.mockImplementation(
            async (filePath: string) => {
                return {
                    attachment: genTextAttachment(
                        'Sunday Welcome.pptx',
                        'Welcome',
                        filePath,
                    ),
                };
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

    async function render() {
        await act(async () => {
            root.render(<ChatbotAppComp />);
        });
        await settle();
    }

    function lastBot() {
        const cards = [
            ...container.querySelectorAll<HTMLElement>('article.cue-bot'),
        ];
        expect(cards.length).toBeGreaterThan(0);
        return cards[cards.length - 1];
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

    test('the card says what can be changed, with no model asked', async () => {
        leave('chatbot-handoff-file', { filePath: DECK_PATH });
        await render();
        const card = lastBot();
        expect(card.textContent).toContain(
            '“Sunday Welcome.pptx” is attached below',
        );
        expect(card.textContent).toContain('Check the spelling');
        expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
    });

    test('a change typed is asked with the file read first, under its own tool', async () => {
        leave('chatbot-handoff-file', { filePath: DECK_PATH });
        await render();
        await send('Change Lord to God');
        // The file is read as it is now, by its whole path.
        expect(hoisted.callToolMock).toHaveBeenCalledWith(
            OFFICE_EDIT_TOOL_NAME,
            { action: 'read', file: DECK_PATH },
            expect.anything(),
        );
        expect(hoisted.askLlmBotMock).toHaveBeenCalledOnce();
        const [asked, , , , , , extra] = hoisted.askLlmBotMock.mock.calls[0];
        expect(extra.office).toEqual({
            files: [{ name: 'Sunday Welcome.pptx', filePath: DECK_PATH }],
        });
        expect(asked).toContain('Change Lord to God');
        expect(asked).toContain('1.2 "Praise the Lord"');
        expect(lastBot().textContent).toContain('I changed Lord to God.');
    });

    test('Make a song from it stays the window’s own song drafting, never an edit', async () => {
        leave('chatbot-handoff-file', { filePath: DECK_PATH });
        await render();
        const buttons = [
            ...container.querySelectorAll<HTMLButtonElement>(
                'button.cue-reply',
            ),
        ].filter((button) => {
            return button.textContent === 'Make a song from it';
        });
        expect(buttons.length).toBeGreaterThan(0);
        await act(async () => {
            buttons[buttons.length - 1].click();
        });
        await settle();
        // The press was asked (its echo is there), and went the song's way.
        expect(
            container.querySelector('article.cue-you')?.textContent,
        ).toContain('Make a song from it');
        const officeCalls = hoisted.callToolMock.mock.calls.filter((call) => {
            return call[0] === OFFICE_EDIT_TOOL_NAME;
        });
        expect(officeCalls).toEqual([]);
        for (const call of hoisted.askLlmBotMock.mock.calls) {
            expect(call[6]?.office).toBeUndefined();
        }
    });
});
