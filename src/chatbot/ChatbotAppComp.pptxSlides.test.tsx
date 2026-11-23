// @vitest-environment jsdom

/**
 * A PowerPoint made into a slide document by asking (EC-763): the window
 * answers the ask with no model -- the Documents list's PowerPoints as
 * buttons, or the one named converted at once -- and a conversion's answer
 * says how alike it measured, under Undo. The tool host (`callTool`), the
 * model (`askLlmBot`) and the file read (`genAttachmentFromPath`) are the
 * boundaries.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
    return {
        settings: new Map<string, string>(),
        callToolMock: vi.fn(),
        askLlmBotMock: vi.fn(),
        genAttachmentFromPathMock: vi.fn(),
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
            pathUtils: {
                sep: '/',
                join: (...parts: string[]) => {
                    return parts.join('/');
                },
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
        // The window's startup work talks to main and is not what these
        // tests are about.
        useAppEffect: (effect: () => any, deps?: any[]) => {
            useEffect(() => {
                return undefined;
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            void effect;
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

const FOLDER = '/church/documents';
const NAMES = ['Easter.pptx', 'Easter.ows', 'Old.ppt', 'Sunday Welcome.pptx'];
const CONVERTED = {
    created: 'Easter (2)',
    from: 'Easter.pptx',
    filePath: `${FOLDER}/Easter (2).ows`,
    slideCount: 12,
    pptxSlideCount: 9,
    stepSlideCount: 3,
    likeness: {
        percent: 99.6,
        lowestSlide: 4,
        lowestPercent: 98.2,
        measuredSlides: [1, 3, 4, 6, 8, 9, 11, 12],
    },
    missingFonts: ['Calibri'],
    undoId: 'undo-easter',
};

function findMediaCalls(action: string) {
    return hoisted.callToolMock.mock.calls.filter((call) => {
        return call[0] === 'owa_media_file' && call[1]?.action === action;
    });
}

describe('a PowerPoint made into a slide document by asking', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        hoisted.settings.clear();
        hoisted.callToolMock.mockReset();
        hoisted.askLlmBotMock.mockReset();
        hoisted.genAttachmentFromPathMock.mockReset();
        hoisted.settings.set('chatbot-llm-auto', 'false');
        hoisted.settings.set('chatbot-llm-provider', 'free');
        hoisted.callToolMock.mockImplementation(
            async (name: string, args: any) => {
                if (name === 'owa_media_file' && args.action === 'list') {
                    return JSON.stringify({
                        kind: 'document',
                        folder: FOLDER,
                        names: NAMES,
                    });
                }
                if (name === 'owa_media_file' && args.action === 'convert') {
                    return JSON.stringify(CONVERTED);
                }
                return '';
            },
        );
        hoisted.askLlmBotMock.mockResolvedValue({ text: 'A model answer.' });
        hoisted.genAttachmentFromPathMock.mockImplementation(
            async (filePath: string) => {
                return {
                    attachment: genTextAttachment(
                        'Easter (2).ows',
                        'Easter',
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

    async function settle(rounds = 8) {
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

    function findButtons(card: HTMLElement) {
        return [
            ...card.querySelectorAll<HTMLButtonElement>('.cue-actions button'),
        ];
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

    test('offers the PowerPoints of the Documents list, with no model', async () => {
        await render();
        await send('convert .pptx to .ows');
        const labels = findButtons(lastBot()).map((button) => {
            return button.textContent;
        });
        expect(labels).toEqual([
            'Make a slide document from "Easter.pptx"',
            'Make a slide document from "Sunday Welcome.pptx"',
        ]);
        expect(findMediaCalls('convert')).toEqual([]);
        expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
    });

    test('a button converts its PowerPoint and says how alike it is, under Undo', async () => {
        await render();
        await send('convert .pptx to .ows');
        const button = findButtons(lastBot()).find((one) => {
            return one.textContent?.includes('Easter.pptx');
        })!;
        await act(async () => {
            button.click();
        });
        await settle();
        expect(findMediaCalls('convert').map((call) => call[1])).toEqual([
            { action: 'convert', kind: 'document', name: 'Easter.pptx' },
        ]);
        const answer = [
            ...container.querySelectorAll<HTMLElement>('article.cue-bot'),
        ].find((card) => {
            return card.textContent?.includes('I made “Easter (2)”');
        })!;
        expect(answer.textContent).toContain('from “Easter.pptx”: 12 slides');
        expect(answer.textContent).toContain(
            '8 of its slides look 99.6% like the PowerPoint',
        );
        expect(answer.textContent).toContain('Calibri');
        expect(
            findButtons(answer).map((one) => {
                return one.textContent;
            }),
        ).toContain('Undo this change');
        // The new document waits in the box, as one asked for in words does.
        expect(hoisted.genAttachmentFromPathMock).toHaveBeenCalledWith(
            CONVERTED.filePath,
            null,
        );
        expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
    });

    test('a PowerPoint named in the ask is converted at once', async () => {
        await render();
        await send('turn the Sunday Welcome PowerPoint into a slide document');
        expect(findMediaCalls('convert').map((call) => call[1])).toEqual([
            {
                action: 'convert',
                kind: 'document',
                name: 'Sunday Welcome.pptx',
            },
        ]);
        expect(hoisted.askLlmBotMock).not.toHaveBeenCalled();
    });

    test('a conversion that fails says so, and makes nothing', async () => {
        hoisted.callToolMock.mockImplementation(
            async (name: string, args: any) => {
                if (name === 'owa_media_file' && args.action === 'list') {
                    return JSON.stringify({
                        kind: 'document',
                        folder: FOLDER,
                        names: NAMES,
                    });
                }
                throw new Error('The file is locked');
            },
        );
        await render();
        await send('convert easter pptx to ows');
        expect(lastBot().textContent).toContain(
            'I could not make a slide document of “Easter.pptx”',
        );
        expect(hoisted.genAttachmentFromPathMock).not.toHaveBeenCalled();
    });
});
