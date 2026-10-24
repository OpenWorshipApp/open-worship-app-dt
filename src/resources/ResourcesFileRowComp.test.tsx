// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    openFileMock: vi.fn(),
    openMarkdownPreviewMock: vi.fn(),
    openBibleNotePreviewMock: vi.fn(),
    openPdfPreviewMock: vi.fn(),
    openResourceLinkUrlMock: vi.fn(),
    readResourceLinksMock: vi.fn(),
    readResourceNoteItemsMock: vi.fn(),
    showAppContextMenuMock: vi.fn(),
    openChatbotWithFileMock: vi.fn(),
    isAiEnabled: false,
}));

vi.mock('../helper/ai/aiHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../helper/ai/aiHelpers')>();
    return {
        ...original,
        getIsAIEnabled: () => {
            return h.isAiEnabled;
        },
    };
});

vi.mock('../helper/ai/chatbotHandoffHelpers', () => ({
    openChatbotWithFile: h.openChatbotWithFileMock,
}));

vi.mock('./resourcePreviewOpenHelpers', () => ({
    openMarkdownPreview: h.openMarkdownPreviewMock,
    openBibleNotePreview: h.openBibleNotePreviewMock,
}));

vi.mock('../helper/pdfPreviewHelpers', () => ({
    openPdfPreview: h.openPdfPreviewMock,
}));

vi.mock('./resourcePreviewHelpers', async (importOriginal) => {
    // Partial: which files preview in the app is decided by the REAL names.
    const original =
        await importOriginal<typeof import('./resourcePreviewHelpers')>();
    return {
        ...original,
        readResourceNoteItems: h.readResourceNoteItemsMock,
    };
});

vi.mock('./resourceLinksHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('./resourceLinksHelpers')>();
    return {
        ...original,
        openResourceLinkUrl: h.openResourceLinkUrlMock,
        readResourceLinks: h.readResourceLinksMock,
    };
});

vi.mock('../context-menu/appContextMenuHelpers', async (importOriginal) => {
    const original =
        await importOriginal<
            typeof import('../context-menu/appContextMenuHelpers')
        >();
    return { ...original, showAppContextMenu: h.showAppContextMenuMock };
});

vi.mock('../helper/appHooks', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../helper/appHooks')>();
    return { ...original, useAppEffect: useEffect };
});

// A marked verse's face, and the view a mark opens in: both reach the bible
// database modules, which read the whole provider as they load.
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => {
        return undefined;
    },
}));

vi.mock('../bible-reader/BibleItemsViewController', async () => {
    const { createContext } = await import('react');
    return { BibleItemsViewControllerContext: createContext(null) };
});

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false, isMac: true, openFile: h.openFileMock },
        messageUtils: { sendDataSync: () => null, listenForData: () => {} },
        pathUtils: {
            basename: (filePath: string) =>
                filePath.slice(filePath.lastIndexOf('/') + 1),
            dirname: (filePath: string) =>
                filePath.slice(0, filePath.lastIndexOf('/')) || '/',
        },
    },
}));

import ResourcesFileRowComp from './ResourcesFileRowComp';
import {
    type ResourceReadingPaneType,
    ResourcesReadingContext,
} from './resourceReadingHelpers';

async function flush() {
    await act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    });
}

describe('ResourcesFileRowComp previews', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        h.readResourceLinksMock.mockReset();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    async function renderRow(
        filePath: string,
        paneList: ResourceReadingPaneType[] | null = null,
        canAutoExpandLinks = false,
    ) {
        const row = (
            <ResourcesFileRowComp
                filePath={filePath}
                bookKey="GEN"
                canAutoExpandLinks={canAutoExpandLinks}
            />
        );
        await act(async () => {
            root = createRoot(container!);
            root.render(
                paneList === null ? (
                    row
                ) : (
                    <ResourcesReadingContext
                        value={() => {
                            return paneList;
                        }}
                    >
                        {row}
                    </ResourcesReadingContext>
                ),
            );
        });
        await flush();
    }

    function getRowButton() {
        return container!.querySelector<HTMLButtonElement>(
            '.app-resources-file',
        )!;
    }

    async function press(element: HTMLElement) {
        await act(async () => {
            element.click();
        });
        await flush();
    }

    // The notes list is lazily loaded, which takes longer than a tick.
    async function waitForSelector(selector: string) {
        for (let i = 0; i < 100; i++) {
            if (container!.querySelector(selector) !== null) {
                return;
            }
            await act(async () => {
                await new Promise((resolve) => {
                    setTimeout(resolve, 20);
                });
            });
        }
    }

    function getMenuLabels() {
        const menuItems = h.showAppContextMenuMock.mock.calls.at(-1)![1];
        return menuItems.map((item: any) => {
            return item.menuElement;
        });
    }

    test('a markdown file opens in the preview, not the OS', async () => {
        await renderRow('/r/Document/GEN.1.md');
        await press(getRowButton());
        expect(h.openMarkdownPreviewMock).toHaveBeenCalledWith(
            '/r/Document/GEN.1.md',
        );
        expect(h.openFileMock).not.toHaveBeenCalled();
    });

    test("a markdown file's menu offers Preview, and still Open", async () => {
        await renderRow('/r/Document/GEN.1.md');
        await act(async () => {
            getRowButton().dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        const labels = getMenuLabels();
        expect(labels[0]).toBe('Preview');
        expect(labels).toContain('Open');
    });

    test('a note file is read only when opened, and lists its notes', async () => {
        h.readResourceNoteItemsMock.mockResolvedValue({
            items: [
                { kind: 'note', id: 1, title: 'Sunday' },
                { kind: 'note', id: 2, title: '' },
            ],
            failureReason: null,
        });
        await renderRow('/r/Document/GEN.1.own');
        expect(h.readResourceNoteItemsMock).not.toHaveBeenCalled();
        expect(getRowButton().getAttribute('aria-expanded')).toBe('false');

        await press(getRowButton());
        await waitForSelector('.app-resources-note-item');
        expect(h.readResourceNoteItemsMock).toHaveBeenCalledWith(
            '/r/Document/GEN.1.own',
        );
        expect(h.openFileMock).not.toHaveBeenCalled();
        expect(getRowButton().getAttribute('aria-expanded')).toBe('true');
        const noteButtons = container!.querySelectorAll<HTMLButtonElement>(
            '.app-resources-note-item',
        );
        expect(noteButtons).toHaveLength(2);
        expect(noteButtons[0].textContent).toBe('Sunday');
        expect(noteButtons[1].textContent).toBe('No title');

        await press(noteButtons[0]);
        expect(h.openBibleNotePreviewMock).toHaveBeenCalledWith(
            '/r/Document/GEN.1.own',
            1,
        );

        // Folding it away lets the list go.
        await press(getRowButton());
        expect(
            container!.querySelectorAll('.app-resources-note-item'),
        ).toHaveLength(0);
    });

    test('a note file lists its marked verses with their marks', async () => {
        h.readResourceNoteItemsMock.mockResolvedValue({
            items: [
                {
                    kind: 'verse',
                    id: 3,
                    title: '(KJV) Genesis 22:1',
                    verseKey: '(KJV) GEN 22:1',
                    bibleKey: 'KJV',
                    isOpened: true,
                    highlights: [
                        { id: 'h1', text: 'pass after', color: 'pink' },
                    ],
                    comments: [
                        { id: 'c1', text: 'and offer', comment: 'a thought' },
                    ],
                },
            ],
            failureReason: null,
        });
        await renderRow('/r/Document/GEN.1.own');
        await press(getRowButton());
        await waitForSelector('.app-resources-verse-mark');
        const marks = container!.querySelectorAll('.app-resources-verse-mark');
        expect(marks).toHaveLength(2);
        const highlightText = marks[0].querySelector<HTMLElement>(
            '.app-verse-annotation__text',
        )!;
        expect(highlightText.textContent).toBe('pass after');
        expect(highlightText.style.backgroundColor).toBe(
            'var(--owa-verse-hl-pink)',
        );
        expect(
            marks[1].querySelector('.app-verse-annotation__text--comment')
                ?.textContent,
        ).toBe('and offer');
        expect(marks[1].textContent).toContain('a thought');

        // The verse folds away to a count, and nothing is written.
        const verseButton = container!.querySelector<HTMLButtonElement>(
            '.app-resources-verse-item button[aria-expanded]',
        )!;
        await press(verseButton);
        expect(verseButton.getAttribute('aria-expanded')).toBe('false');
        expect(
            container!.querySelectorAll('.app-resources-verse-mark'),
        ).toHaveLength(0);
        expect(
            container!.querySelector('.app-resources-verse-count')?.textContent,
        ).toBe('2');
    });

    test('a note file with nothing to open says so', async () => {
        h.readResourceNoteItemsMock.mockResolvedValue({
            items: [],
            failureReason: 'not-a-note',
        });
        await renderRow('/r/Document/GEN.1.own');
        await press(getRowButton());
        await waitForSelector('.app-resources-note');
        expect(container!.textContent).toContain('Not a bible note file');
    });

    test.each([
        ['too-large', 'This file is too large to preview'],
        ['unreadable', 'Cannot read this file'],
    ] as const)(
        'a note file that is %s explains why it cannot open',
        async (failureReason, message) => {
            h.readResourceNoteItemsMock.mockResolvedValue({
                items: [],
                failureReason,
            });
            await renderRow('/r/Document/GEN.1.own');
            await press(getRowButton());
            await waitForSelector('.app-resources-note');

            expect(container!.textContent).toContain(message);
        },
    );

    test('an empty but readable note file says it has no notes', async () => {
        h.readResourceNoteItemsMock.mockResolvedValue({
            items: [],
            failureReason: null,
        });
        await renderRow('/r/Document/GEN.1.own');
        await press(getRowButton());
        await waitForSelector('.app-resources-note');

        expect(container!.textContent).toContain('No notes');
    });

    test("a note file's menu has no OS Open", async () => {
        await renderRow('/r/Document/GEN.1.own');
        await act(async () => {
            getRowButton().dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        expect(getMenuLabels()).not.toContain('Open');
    });

    test('a PDF previews in the app, whatever case its extension', async () => {
        await renderRow('/r/Document/GEN.1.PDF');
        await press(getRowButton());
        expect(h.openPdfPreviewMock).toHaveBeenCalledWith(
            '/r/Document/GEN.1.PDF',
        );
        expect(h.openFileMock).not.toHaveBeenCalled();
    });

    test("a PDF's menu offers Preview PDF, and still Open", async () => {
        await renderRow('/r/Document/GEN.1.pdf');
        await act(async () => {
            getRowButton().dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        const labels = getMenuLabels();
        expect(labels[0]).toBe('Preview PDF');
        expect(labels).toContain('Open');
    });

    test('any other file still goes to the OS', async () => {
        await renderRow('/r/Document/GEN.1.docx');
        await press(getRowButton());
        expect(h.openFileMock).toHaveBeenCalledWith('/r/Document/GEN.1.docx');
        expect(h.openMarkdownPreviewMock).not.toHaveBeenCalled();
        expect(h.openPdfPreviewMock).not.toHaveBeenCalled();
    });

    test('a free-text JSON hit is read on its first press and then folded', async () => {
        h.readResourceLinksMock.mockResolvedValue({
            links: [{ title: 'Overview', url: 'https://example.com' }],
            droppedCount: 0,
            isTruncated: false,
            failureReason: null,
        });
        await renderRow('/r/YouTube/GEN.1.json');
        expect(h.readResourceLinksMock).not.toHaveBeenCalled();

        await press(getRowButton());
        expect(h.readResourceLinksMock).toHaveBeenCalledWith(
            '/r/YouTube/GEN.1.json',
        );
        expect(getRowButton().getAttribute('aria-expanded')).toBe('true');
        expect(container!.querySelector('.app-resources-link')).not.toBeNull();

        await press(getRowButton());
        expect(getRowButton().getAttribute('aria-expanded')).toBe('false');
        expect(container!.querySelector('.app-resources-link')).toBeNull();
    });

    test('JSON content without links stays an ordinary file', async () => {
        h.readResourceLinksMock.mockResolvedValue({
            links: [],
            droppedCount: 0,
            isTruncated: false,
            failureReason: 'not-a-list',
        });
        await renderRow('/r/YouTube/GEN.1.json');

        await press(getRowButton());
        await press(getRowButton());

        expect(h.readResourceLinksMock).toHaveBeenCalledTimes(1);
        expect(h.openFileMock).toHaveBeenCalledTimes(2);
        expect(h.openFileMock).toHaveBeenLastCalledWith(
            '/r/YouTube/GEN.1.json',
        );
        expect(getRowButton().getAttribute('aria-expanded')).toBeNull();
    });

    test('verse-matched JSON is read as it appears', async () => {
        h.readResourceLinksMock.mockResolvedValue({
            links: [{ title: 'Study', url: 'https://example.com/study' }],
            droppedCount: 0,
            isTruncated: false,
            failureReason: null,
        });
        await renderRow('/r/YouTube/GEN.1.json', null, true);

        expect(h.readResourceLinksMock).toHaveBeenCalledWith(
            '/r/YouTube/GEN.1.json',
        );
        expect(container!.querySelector('.app-resources-link')).not.toBeNull();
    });

    // 2026-10-17, the user: _add robot icon to each file, click to open file
    // in chatbot in attachment to analyze_.
    describe('the 🤖 that asks the assistant about a file', () => {
        afterEach(() => {
            h.isAiEnabled = false;
        });

        function getAskButton() {
            return container!.querySelector<HTMLButtonElement>(
                '.app-resources-file-ask',
            );
        }

        test('opens the assistant on that file, not the file itself', async () => {
            h.isAiEnabled = true;
            for (const filePath of [
                '/r/pdf/LUK.6.pdf',
                '/r/YouTube/LUK.0.json',
                '/r/notes/LUK.own',
            ]) {
                h.openChatbotWithFileMock.mockClear();
                await renderRow(filePath);
                await press(getAskButton()!);
                expect(h.openChatbotWithFileMock).toHaveBeenCalledWith(
                    filePath,
                    null,
                );
                expect(h.openPdfPreviewMock).not.toHaveBeenCalledWith(filePath);
                await act(async () => {
                    root?.unmount();
                });
                root = null;
            }
        });

        // 2026-10-22, the user's goal: _make the chatbot smarter to interact
        // with user for the selected resource file_ -- the Reader was on
        // Matthew 18:15-17 and the tab offered verses 1, 2 and 3.
        test('hands over the passage the Reader is on for that file', async () => {
            h.isAiEnabled = true;
            const paneList = [
                {
                    bibleKey: 'KJV',
                    target: {
                        bookKey: 'EXO',
                        chapter: 2,
                        verseStart: 1,
                        verseEnd: 3,
                    },
                    toTitle: async () => {
                        return 'Exodus 2:1-3';
                    },
                },
                {
                    bibleKey: 'ពគប',
                    target: {
                        bookKey: 'GEN',
                        chapter: 4,
                        verseStart: 15,
                        verseEnd: 17,
                    },
                    toTitle: async () => {
                        return 'លោកុប្បត្តិ ៤:១៥-១៧';
                    },
                },
            ];
            await renderRow('/r/pdf/GEN.4.pdf', paneList);
            await press(getAskButton()!);
            expect(h.openChatbotWithFileMock).toHaveBeenLastCalledWith(
                '/r/pdf/GEN.4.pdf',
                {
                    bookKey: 'GEN',
                    chapter: 4,
                    verseStart: 15,
                    verseEnd: 17,
                    title: 'លោកុប្បត្តិ ៤:១៥-១៧',
                    bibleKey: 'ពគប',
                },
            );
            await act(async () => {
                root?.unmount();
            });
            // The book's introduction: the chapter being read, no verses.
            await renderRow('/r/pdf/GEN.0.pdf', paneList);
            await press(getAskButton()!);
            expect(h.openChatbotWithFileMock).toHaveBeenLastCalledWith(
                '/r/pdf/GEN.0.pdf',
                {
                    bookKey: 'GEN',
                    chapter: 4,
                    title: 'លោកុប្បត្តិ ៤:១៥-១៧',
                    bibleKey: 'ពគប',
                },
            );
            await act(async () => {
                root?.unmount();
            });
            // Another chapter's file: nothing the Reader is on.
            await renderRow('/r/pdf/GEN.9.pdf', paneList);
            await press(getAskButton()!);
            expect(h.openChatbotWithFileMock).toHaveBeenLastCalledWith(
                '/r/pdf/GEN.9.pdf',
                null,
            );
        });

        test('is in the menu too', async () => {
            h.isAiEnabled = true;
            await renderRow('/r/pdf/LUK.6.pdf');
            await act(async () => {
                getRowButton().dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                );
            });
            expect(getMenuLabels()[0]).toBe(
                'Ask the Assistant About This File',
            );
        });

        test('is not offered on a file the assistant cannot read', async () => {
            h.isAiEnabled = true;
            await renderRow('/r/Document/GEN.1.docx');
            expect(getAskButton()).toBeNull();
        });

        test('goes with the AI switch, as the toolbar 🤖 does', async () => {
            await renderRow('/r/pdf/LUK.6.pdf');
            expect(getAskButton()).toBeNull();
        });
    });
});
