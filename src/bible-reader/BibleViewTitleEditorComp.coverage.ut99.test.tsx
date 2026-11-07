// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        showAppContextMenu: vi.fn(),
        getBibleInfo: vi.fn(),
        getVerses: vi.fn(),
        getModelChapterCount: vi.fn(),
        getModelKeyBookMap: vi.fn(),
        getVersesCount: vi.fn(),
        toLocaleNumBible: vi.fn(),
        toTitleParts: vi.fn(),
        getBibleFontFamily: vi.fn(),
        isDismissing: false,
    };
});

vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppStateAsync: (callee: () => unknown, deps: unknown[]) => {
            const [value, setValue] = React.useState<unknown>(undefined);
            React.useEffect(() => {
                let isAlive = true;
                Promise.resolve(callee()).then((newValue) => {
                    if (isAlive) {
                        setValue(newValue);
                    }
                });
                return () => {
                    isAlive = false;
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue];
        },
    };
});
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: h.getBibleInfo,
    getVerses: h.getVerses,
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers1', () => ({
    getModelChapterCount: h.getModelChapterCount,
    getModelKeyBookMap: h.getModelKeyBookMap,
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: h.getVersesCount,
    toLocaleNumBible: h.toLocaleNumBible,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: h.getBibleFontFamily,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { toTitleParts: h.toTitleParts },
}));

import BibleViewTitleEditorComp from './BibleViewTitleEditorComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const BOOK_NAMES: Record<string, string> = {
    GEN: '☀☾',
    EXO: '⛰☁',
    LEV: '⚖✦',
};
const WIDE_DIGITS = '０１２３４５６７８９';

function toWide(n: number) {
    return `${n}`
        .split('')
        .map((digit) => WIDE_DIGITS[Number(digit)])
        .join('');
}

function genBibleItem(target: object) {
    return {
        bibleKey: 'XXB',
        target,
        toTitle: async () => 'unused',
    } as any;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    h.isDismissing = false;
    // A picker either stays open until a row is chosen, or is closed.
    h.showAppContextMenu.mockImplementation(() => ({
        promiseDone: h.isDismissing
            ? Promise.resolve()
            : new Promise<void>(() => {}),
        closeMenu: () => {},
    }));
    h.getBibleInfo.mockResolvedValue({
        keyBookMap: BOOK_NAMES,
        booksAvailable: ['GEN', 'EXO'],
    });
    h.getVerses.mockResolvedValue({});
    h.getModelChapterCount.mockImplementation((bookKey: string) => {
        return bookKey === 'GEN' ? 5 : 4;
    });
    h.getModelKeyBookMap.mockReturnValue({
        GEN: 'Genesis',
        EXO: 'Exodus',
        LEV: 'Leviticus',
    });
    h.getVersesCount.mockResolvedValue(6);
    h.toLocaleNumBible.mockImplementation(
        async (_bibleKey: string, n: number) => {
            return toWide(n);
        },
    );
    h.toTitleParts.mockImplementation(
        async (_bibleKey: string, target: any) => {
            return {
                book: BOOK_NAMES[target.bookKey],
                chapter: toWide(target.chapter),
                verseStart: toWide(target.verseStart),
                verseEnd: toWide(target.verseEnd),
                chapterEnd:
                    target.chapterEnd > target.chapter
                        ? toWide(target.chapterEnd)
                        : null,
            };
        },
    );
    h.getBibleFontFamily.mockResolvedValue('Script Face');
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

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function renderEditor(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
    await flush();
}

function getParts() {
    return Array.from(
        host.querySelectorAll<HTMLElement>('.app-caught-hover-pointer'),
    );
}

async function rightClick(part: HTMLElement, init: MouseEventInit = {}) {
    const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        ...init,
    });
    await act(async () => {
        part.dispatchEvent(event);
    });
    await flush();
    return event;
}

async function pressKey(part: HTMLElement, init: KeyboardEventInit) {
    const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        ...init,
    });
    await act(async () => {
        part.dispatchEvent(event);
    });
    await flush();
    return event;
}

function getMenu(index: number): any[] {
    return h.showAppContextMenu.mock.calls[index][1];
}

function getMenuNames(index: number) {
    return getMenu(index).map((item) => item.menuElement);
}

function getMenuHeaders() {
    return h.showAppContextMenu.mock.calls.map((call) => {
        return call[1][0].menuElement;
    });
}

async function pick(menuIndex: number, menuElement: string) {
    const item = getMenu(menuIndex).find((menuItem) => {
        return menuItem.menuElement === menuElement;
    });
    expect(item).toBeDefined();
    await act(async () => {
        item.onSelect();
    });
    await flush();
}

describe('BibleViewTitleEditorComp', () => {
    test('without a change handler the title is plain text', async () => {
        const bibleItem = genBibleItem({
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 4,
        });
        bibleItem.toTitle = async () => '☀☾ １:２-４';
        await renderEditor(<BibleViewTitleEditorComp bibleItem={bibleItem} />);
        expect(host.innerHTML).toBe('<span>☀☾ １:２-４</span>');
    });

    test('the parts read as the Bible writes them, and a chapter picked asks for its verses', async () => {
        // A number the Bible cannot write reads as itself.
        h.toLocaleNumBible.mockImplementation(
            async (_bibleKey: string, n: number) => {
                return n === 5 ? null : toWide(n);
            },
        );
        const onTargetChange = vi.fn();
        await renderEditor(
            <BibleViewTitleEditorComp
                bibleItem={genBibleItem({
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 4,
                })}
                onTargetChange={onTargetChange}
            />,
        );
        expect(host.textContent).toBe('☀☾ １:２-４');
        expect(
            getParts().map((part) => part.getAttribute('aria-label')),
        ).toEqual([
            'Book: ☀☾',
            'Chapter: １',
            'Verse Start: ２',
            'Verse End: ４',
        ]);

        await rightClick(getParts()[1]);
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        expect(
            getMenu(0).map((item) => {
                return [item.menuElement, item.title, item.disabled];
            }),
        ).toEqual([
            ['Chapter', 'Chapter', false],
            ['１', '1', false],
            ['２', '2', false],
            ['３', '3', false],
            ['４', '4', false],
            ['5', '5', false],
        ]);
        expect(
            getMenu(0).map((item) => [item.isSectionHeader, item.style]),
        ).toEqual([
            [true, { fontFamily: 'Script Face' }],
            ...Array.from({ length: 5 }, () => [
                false,
                { fontFamily: 'Script Face' },
            ]),
        ]);

        await pick(0, '３');
        expect(onTargetChange.mock.calls).toEqual([
            [{ bookKey: 'GEN', chapter: 3, verseStart: 1, verseEnd: 6 }],
        ]);
        expect(h.getVerses).toHaveBeenLastCalledWith('XXB', 'GEN', 3);
        expect(getMenuNames(1)).toEqual([
            'Verse Start',
            '１',
            '２',
            '３',
            '４',
            '5',
            '６',
        ]);
        await pick(1, '２');
        // No end before the start.
        expect(getMenuNames(2)).toEqual([
            'Verse End',
            '２',
            '３',
            '４',
            '5',
            '６',
        ]);
        await pick(2, '5');
        expect(onTargetChange.mock.calls.slice(1)).toEqual([
            [{ bookKey: 'GEN', chapter: 3, verseStart: 2, verseEnd: 6 }],
            [{ bookKey: 'GEN', chapter: 3, verseStart: 2, verseEnd: 5 }],
        ]);
    });

    test('the start verse part asks for the verses of its own chapter', async () => {
        // The chapter's count unread: the passage is the verse alone until an
        // end is picked.
        h.getVersesCount.mockResolvedValueOnce(null);
        const onTargetChange = vi.fn();
        await renderEditor(
            <BibleViewTitleEditorComp
                bibleItem={genBibleItem({
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 4,
                })}
                onTargetChange={onTargetChange}
            />,
        );
        await rightClick(getParts()[2]);
        expect(h.getVerses).toHaveBeenCalledWith('XXB', 'GEN', 1);
        expect(getMenuNames(0)).toEqual([
            'Verse Start',
            '１',
            '２',
            '３',
            '４',
            '５',
            '６',
        ]);
        await pick(0, '４');
        expect(onTargetChange.mock.calls).toEqual([
            [{ bookKey: 'GEN', chapter: 1, verseStart: 4, verseEnd: 4 }],
        ]);
        expect(getMenuNames(1)).toEqual(['Verse End', '４', '５', '６']);
    });

    test('a header that waits for its start verse applies nothing before it, and stops there', async () => {
        const onTargetChange = vi.fn();
        await renderEditor(
            <BibleViewTitleEditorComp
                bibleItem={genBibleItem({
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 2,
                })}
                isOneVerse
                waitUntilGotVerseStart
                onTargetChange={onTargetChange}
            />,
        );
        expect(host.textContent).toBe('☀☾ １:２');
        expect(getParts()).toHaveLength(3);

        await rightClick(getParts()[0]);
        // Only the books this Bible has; the one open now is not offered.
        expect(
            getMenu(0).map((item) => {
                return [item.menuElement, item.title, item.disabled];
            }),
        ).toEqual([
            ['Book', 'Book', false],
            ['☀☾', 'Genesis(5)', true],
            ['⛰☁', 'Exodus(4)', false],
        ]);
        await pick(0, '⛰☁');
        expect(getMenuNames(1)).toEqual(['Chapter', '１', '２', '３', '４']);
        await pick(1, '２');
        expect(getMenuNames(2)[0]).toBe('Verse Start');
        expect(h.getVerses).toHaveBeenLastCalledWith('XXB', 'EXO', 2);
        expect(onTargetChange).not.toHaveBeenCalled();

        await pick(2, '４');
        expect(onTargetChange.mock.calls).toEqual([
            [{ bookKey: 'EXO', chapter: 2, verseStart: 4, verseEnd: 6 }],
        ]);
        // One verse: no end is asked for.
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(3);
    });

    test('a Bible whose verses cannot be counted keeps the passage to its first verse', async () => {
        h.getVersesCount.mockResolvedValue(null);
        const onTargetChange = vi.fn();
        await renderEditor(
            <BibleViewTitleEditorComp
                bibleItem={genBibleItem({
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 4,
                })}
                onTargetChange={onTargetChange}
            />,
        );
        await rightClick(getParts()[0]);
        await pick(0, '⛰☁');
        h.isDismissing = true;
        await pick(1, '２');
        expect(onTargetChange.mock.calls).toEqual([
            [{ bookKey: 'EXO', chapter: 1, verseStart: 1, verseEnd: 1 }],
            [{ bookKey: 'EXO', chapter: 2, verseStart: 1, verseEnd: 1 }],
        ]);
        // Nothing to pick from but the picker's own name.
        expect(getMenuNames(2)).toEqual(['Verse Start']);
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(3);
    });

    test('closing a picker unchosen leaves a one-chapter passage as it was', async () => {
        h.isDismissing = true;
        const onTargetChange = vi.fn();
        await renderEditor(
            <BibleViewTitleEditorComp
                bibleItem={genBibleItem({
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 4,
                })}
                onTargetChange={onTargetChange}
            />,
        );
        for (const part of getParts()) {
            await rightClick(part);
        }
        // One picker per press, none followed by the next.
        expect(getMenuHeaders()).toEqual([
            'Book',
            'Chapter',
            'Verse Start',
            'Verse End',
        ]);
        expect(onTargetChange).not.toHaveBeenCalled();
    });

    test('closing a picker unchosen leaves a passage across chapters as it was', async () => {
        h.isDismissing = true;
        const onTargetChange = vi.fn();
        await renderEditor(
            <BibleViewTitleEditorComp
                bibleItem={genBibleItem({
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 4,
                    chapterEnd: 3,
                })}
                onTargetChange={onTargetChange}
            />,
        );
        expect(host.textContent).toBe('☀☾ １:２-３:４');
        for (const part of getParts().slice(2)) {
            await rightClick(part);
        }
        expect(getMenuHeaders()).toEqual([
            'Verse Start',
            'End Chapter',
            'Verse End',
        ]);
        expect(onTargetChange).not.toHaveBeenCalled();
    });

    test('a passage across chapters picks its end verse in the chapter it ends in', async () => {
        const onTargetChange = vi.fn();
        await renderEditor(
            <BibleViewTitleEditorComp
                bibleItem={genBibleItem({
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 4,
                    chapterEnd: 3,
                })}
                onTargetChange={onTargetChange}
            />,
        );
        await rightClick(getParts()[4]);
        expect(h.getVerses).toHaveBeenLastCalledWith('XXB', 'GEN', 3);
        // Every verse of a later chapter comes after the start.
        expect(getMenuNames(0)).toEqual([
            'Verse End',
            '１',
            '２',
            '３',
            '４',
            '５',
            '６',
        ]);
        await pick(0, '１');
        expect(onTargetChange.mock.calls).toEqual([
            [
                {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 1,
                    chapterEnd: 3,
                },
            ],
        ]);
    });

    test('ending a passage in the chapter it starts in makes it one chapter again', async () => {
        // The end chapter's count unread: the end is the start verse until
        // one is picked.
        h.getVersesCount.mockResolvedValueOnce(null);
        const onTargetChange = vi.fn();
        await renderEditor(
            <BibleViewTitleEditorComp
                bibleItem={genBibleItem({
                    bookKey: 'GEN',
                    chapter: 2,
                    verseStart: 3,
                    verseEnd: 4,
                    chapterEnd: 4,
                })}
                onTargetChange={onTargetChange}
            />,
        );
        await rightClick(getParts()[3]);
        // Never a chapter before the start.
        expect(getMenuNames(0)).toEqual([
            'End Chapter',
            '２',
            '３',
            '４',
            '５',
        ]);
        await pick(0, '２');
        expect(onTargetChange.mock.calls).toEqual([
            [{ bookKey: 'GEN', chapter: 2, verseStart: 3, verseEnd: 3 }],
        ]);
        // In the start chapter, no end before the start verse.
        expect(getMenuNames(1)).toEqual(['Verse End', '３', '４', '５', '６']);
        await pick(1, '５');
        expect(onTargetChange.mock.calls[1]).toEqual([
            { bookKey: 'GEN', chapter: 2, verseStart: 3, verseEnd: 5 },
        ]);
    });

    test('only Enter, Space and the menu keys open a part, and a held key opens it once', async () => {
        await renderEditor(
            <BibleViewTitleEditorComp
                bibleItem={genBibleItem({
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 4,
                })}
                onTargetChange={() => {}}
            />,
        );
        const book = getParts()[0];
        const ignoredList = [
            await pressKey(book, { key: 'a' }),
            await pressKey(book, { key: 'Enter', repeat: true }),
            // F10 alone belongs to the menu bar.
            await pressKey(book, { key: 'F10' }),
        ];
        expect(h.showAppContextMenu).not.toHaveBeenCalled();
        expect(ignoredList.map((event) => event.defaultPrevented)).toEqual([
            false,
            false,
            false,
        ]);

        const pressedList = [
            await pressKey(book, { key: 'ContextMenu' }),
            await pressKey(book, { key: 'F10', shiftKey: true }),
            await pressKey(book, { key: ' ' }),
        ];
        expect(pressedList.map((event) => event.defaultPrevented)).toEqual([
            true,
            true,
            true,
        ]);
        expect(getMenuHeaders()).toEqual(['Book', 'Book', 'Book']);
        // The picker opens where a right-click would have opened it.
        expect(h.showAppContextMenu.mock.calls[0][0].type).toBe('contextmenu');
    });

    test('in a Bibles list row only Ctrl+right-click opens a part, and the row keeps its own menu', async () => {
        const rowMenu = vi.fn();
        await renderEditor(
            <div onContextMenu={rowMenu}>
                <BibleViewTitleEditorComp
                    bibleItem={genBibleItem({
                        bookKey: 'GEN',
                        chapter: 1,
                        verseStart: 2,
                        verseEnd: 4,
                    })}
                    withCtrl
                    onTargetChange={() => {}}
                />
            </div>,
        );
        const book = getParts()[0];
        const plain = await rightClick(book);
        expect(plain.defaultPrevented).toBe(false);
        expect(rowMenu).toHaveBeenCalledTimes(1);
        expect(h.showAppContextMenu).not.toHaveBeenCalled();

        const withCtrlKey = await rightClick(book, { ctrlKey: true });
        expect(withCtrlKey.defaultPrevented).toBe(true);
        expect(rowMenu).toHaveBeenCalledTimes(1);
        expect(getMenuHeaders()).toEqual(['Book']);
    });
});
