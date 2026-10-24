// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        showAppContextMenu: vi.fn((_event: any, _items: any[]) => {
            return {
                promiseDone: new Promise<void>(() => {}),
                closeMenu: () => {},
            };
        }),
        getBibleInfo: vi.fn(async () => ({
            keyBookMap: { GEN: 'Genesis', EXO: 'Exodus' },
            booksAvailable: ['GEN', 'EXO'],
        })),
        getVerses: vi.fn(async () => ({})),
        getModelChapterCount: vi.fn(() => 50),
        getModelKeyBookMap: vi.fn(() => ({ GEN: 'Genesis', EXO: 'Exodus' })),
        getVersesCount: vi.fn(async () => 31),
        toLocaleNumBible: vi.fn(async (_bibleKey: string, n: number) => `${n}`),
    };
});

vi.mock('../helper/appHooks', () => ({
    // No title yet: the parts fall back to the target's own keys.
    useAppStateAsync: () => [undefined],
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: mocks.getBibleInfo,
    getVerses: mocks.getVerses,
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers1', () => ({
    getModelChapterCount: mocks.getModelChapterCount,
    getModelKeyBookMap: mocks.getModelKeyBookMap,
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: mocks.getVersesCount,
    toLocaleNumBible: mocks.toLocaleNumBible,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenu,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: async () => null,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { toTitleParts: async () => null },
}));

import BibleViewTitleEditorComp from './BibleViewTitleEditorComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const bibleItem = {
    bibleKey: 'KJV',
    target: { bookKey: 'GEN', chapter: 1, verseStart: 1, verseEnd: 3 },
    toTitle: async () => '',
} as any;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    mocks.showAppContextMenu.mockClear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

describe('BibleViewTitleEditorComp keyboard', () => {
    // RD-33: the book, chapter and verses of a pane's title answered a
    // right-click only, so a keyboard could not change the passage from them.
    test("a pane title's parts are buttons a keyboard can press", async () => {
        act(() => {
            root.render(
                <BibleViewTitleEditorComp
                    bibleItem={bibleItem}
                    onTargetChange={() => {}}
                />,
            );
        });
        const partList = Array.from(host.querySelectorAll('[role="button"]'));

        expect(partList.map((part) => part.getAttribute('aria-label'))).toEqual(
            ['Book: GEN', 'Chapter: 1', 'Verse Start: 1', 'Verse End: 3'],
        );
        expect(partList.every((part) => part.getAttribute('tabindex'))).toBe(
            true,
        );

        await act(async () => {
            partList[0].dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(mocks.showAppContextMenu).toHaveBeenCalledTimes(1);
        const [event, itemList] = mocks.showAppContextMenu.mock.calls[0];
        expect(event.type).toBe('contextmenu');
        // The picker's header row is translated now, like its parts.
        expect(itemList[0].menuElement).toBe('Book');
        expect(itemList.map((item: any) => item.menuElement)).toContain(
            'Genesis',
        );
    });

    // In a Bibles list row the parts need Ctrl+right-click, and a tab stop
    // per part would bury the list.
    test('a list row title stays out of the tab order', () => {
        act(() => {
            root.render(
                <BibleViewTitleEditorComp
                    bibleItem={bibleItem}
                    withCtrl
                    onTargetChange={() => {}}
                />,
            );
        });

        expect(host.querySelector('[role="button"]')).toBeNull();
        expect(host.querySelector('[tabindex]')).toBeNull();
    });

    // `John 1:2-3:4`: a passage crossing chapters has a part for the chapter
    // it ends in, between the start verse and the end verse.
    test('a title across chapters has an end chapter part', () => {
        act(() => {
            root.render(
                <BibleViewTitleEditorComp
                    bibleItem={{
                        ...bibleItem,
                        target: {
                            bookKey: 'GEN',
                            chapter: 1,
                            verseStart: 2,
                            verseEnd: 4,
                            chapterEnd: 3,
                        },
                    }}
                    onTargetChange={() => {}}
                />,
            );
        });

        expect(
            Array.from(host.querySelectorAll('[role="button"]')).map((part) => {
                return part.getAttribute('aria-label');
            }),
        ).toEqual([
            'Book: GEN',
            'Chapter: 1',
            'Verse Start: 2',
            'End Chapter: 3',
            'Verse End: 4',
        ]);
        expect(host.textContent).toBe('GEN 1:2-3:4');
    });

    test('one verse has no end part', () => {
        act(() => {
            root.render(
                <BibleViewTitleEditorComp
                    bibleItem={{
                        ...bibleItem,
                        target: {
                            bookKey: 'GEN',
                            chapter: 1,
                            verseStart: 2,
                            verseEnd: 2,
                        },
                    }}
                    onTargetChange={() => {}}
                />,
            );
        });

        expect(host.textContent).toBe('GEN 1:2');
    });

    test('choosing an end verse updates the passage without offering earlier verses', async () => {
        const onTargetChange = vi.fn();
        act(() => {
            root.render(
                <BibleViewTitleEditorComp
                    bibleItem={{
                        ...bibleItem,
                        target: {
                            bookKey: 'GEN',
                            chapter: 1,
                            verseStart: 5,
                            verseEnd: 8,
                        },
                    }}
                    onTargetChange={onTargetChange}
                />,
            );
        });
        const endVerse = host.querySelectorAll('[role="button"]')[3];
        await act(async () => {
            endVerse.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        const [, items] = mocks.showAppContextMenu.mock.calls[0];
        expect(items[0].menuElement).toBe('Verse End');
        expect(items.some((item: any) => item.menuElement === '4')).toBe(false);
        expect(items.some((item: any) => item.menuElement === '5')).toBe(true);
        act(() => items[4].onSelect());
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(onTargetChange).toHaveBeenCalledWith({
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 5,
            verseEnd: 8,
        });
    });

    test('changing the end chapter keeps the start and then chooses its end verse', async () => {
        const onTargetChange = vi.fn();
        act(() => {
            root.render(
                <BibleViewTitleEditorComp
                    bibleItem={{
                        ...bibleItem,
                        target: {
                            bookKey: 'GEN',
                            chapter: 1,
                            verseStart: 2,
                            verseEnd: 4,
                            chapterEnd: 3,
                        },
                    }}
                    onTargetChange={onTargetChange}
                />,
            );
        });
        const endChapter = host.querySelectorAll('[role="button"]')[3];
        await act(async () => {
            endChapter.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                    cancelable: true,
                }),
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(mocks.showAppContextMenu.mock.calls[0][1][0].menuElement).toBe(
            'End Chapter',
        );
        act(() => mocks.showAppContextMenu.mock.calls[0][1][4].onSelect());
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(mocks.showAppContextMenu).toHaveBeenCalledTimes(2);
        expect(mocks.showAppContextMenu.mock.calls[1][1][0].menuElement).toBe(
            'Verse End',
        );
        act(() => mocks.showAppContextMenu.mock.calls[1][1][7].onSelect());
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(onTargetChange.mock.calls).toEqual([
            [
                {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 31,
                    chapterEnd: 4,
                },
            ],
            [
                {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 7,
                    chapterEnd: 4,
                },
            ],
        ]);
    });

    test('changing the book chooses a chapter and a valid verse range in order', async () => {
        const onTargetChange = vi.fn();
        act(() => {
            root.render(
                <BibleViewTitleEditorComp
                    bibleItem={bibleItem}
                    onTargetChange={onTargetChange}
                />,
            );
        });
        const book = host.querySelectorAll('[role="button"]')[0];
        const openMenu = async (element: Element) => {
            await act(async () => {
                element.dispatchEvent(
                    new MouseEvent('contextmenu', {
                        bubbles: true,
                        cancelable: true,
                    }),
                );
                await new Promise((resolve) => setTimeout(resolve, 0));
            });
        };
        const choose = async (menuIndex: number, itemIndex: number) => {
            act(() => {
                mocks.showAppContextMenu.mock.calls[menuIndex][1][
                    itemIndex
                ].onSelect();
            });
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 0));
            });
        };

        await openMenu(book);
        const bookMenu = mocks.showAppContextMenu.mock.calls[0][1];
        expect(bookMenu[0].isSectionHeader).toBe(true);
        expect(bookMenu[1].disabled).toBe(true);
        expect(bookMenu[2].menuElement).toBe('Exodus');
        await choose(0, 2);
        expect(mocks.showAppContextMenu.mock.calls[1][1][0].menuElement).toBe(
            'Chapter',
        );
        await choose(1, 2);
        expect(mocks.showAppContextMenu.mock.calls[2][1][0].menuElement).toBe(
            'Verse Start',
        );
        await choose(2, 4);
        expect(mocks.showAppContextMenu.mock.calls[3][1][0].menuElement).toBe(
            'Verse End',
        );
        expect(
            mocks.showAppContextMenu.mock.calls[3][1].some(
                (item: any) => item.menuElement === '3',
            ),
        ).toBe(false);
        await choose(3, 5);
        expect(onTargetChange).toHaveBeenLastCalledWith({
            bookKey: 'EXO',
            chapter: 2,
            verseStart: 4,
            verseEnd: 8,
        });
    });

    test('a cross-chapter start verse keeps its end chapter and verse', async () => {
        const onTargetChange = vi.fn();
        act(() => {
            root.render(
                <BibleViewTitleEditorComp
                    bibleItem={{
                        ...bibleItem,
                        target: {
                            bookKey: 'GEN',
                            chapter: 1,
                            verseStart: 2,
                            verseEnd: 4,
                            chapterEnd: 3,
                        },
                    }}
                    onTargetChange={onTargetChange}
                />,
            );
        });
        const verseStart = host.querySelectorAll('[role="button"]')[2];
        await act(async () => {
            verseStart.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(mocks.showAppContextMenu.mock.calls[0][1][0].menuElement).toBe(
            'Verse Start',
        );
        act(() => mocks.showAppContextMenu.mock.calls[0][1][6].onSelect());
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(onTargetChange).toHaveBeenCalledWith({
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 6,
            verseEnd: 4,
            chapterEnd: 3,
        });
    });

    test('missing Bible data and a dismissed picker leave the passage unchanged', async () => {
        const onTargetChange = vi.fn();
        act(() => {
            root.render(
                <BibleViewTitleEditorComp
                    bibleItem={bibleItem}
                    onTargetChange={onTargetChange}
                />,
            );
        });
        mocks.getBibleInfo.mockResolvedValueOnce(null as any);
        const book = host.querySelectorAll('[role="button"]')[0];
        await act(async () => {
            book.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(mocks.showAppContextMenu).not.toHaveBeenCalled();

        const endVerse = host.querySelectorAll('[role="button"]')[3];
        mocks.getVerses.mockResolvedValueOnce(null as any);
        await act(async () => {
            endVerse.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(mocks.showAppContextMenu).not.toHaveBeenCalled();

        mocks.showAppContextMenu.mockImplementationOnce(() => ({
            promiseDone: Promise.resolve(),
            closeMenu: vi.fn(),
        }));
        await act(async () => {
            endVerse.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(mocks.showAppContextMenu).toHaveBeenCalledTimes(1);
        expect(onTargetChange).not.toHaveBeenCalled();
    });
});
