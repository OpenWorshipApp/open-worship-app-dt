// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        toVerseTextList: vi.fn(),
        getVersesCount: vi.fn(),
        toLocaleNumBible: vi.fn(),
        getBibleInfoIsRtl: vi.fn(),
        handleError: vi.fn(),
        cleanupVerseNumberClicked: vi.fn(),
        useVerseHighlightPainting: vi.fn(),
        useVerseCommentHover: vi.fn(),
        viewController: null as any,
    };
});

vi.mock('../../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
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
vi.mock('../../helper/bibleViewHelpers', () => ({
    BIBLE_VIEW_TEXT_CLASS: 'bible-view-text',
    useBibleViewFontSizeContext: () => 20,
}));
vi.mock('../BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { toVerseTextList: h.toVerseTextList },
}));
vi.mock('../../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: h.getVersesCount,
    toLocaleNumBible: h.toLocaleNumBible,
}));
vi.mock('../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfoIsRtl: h.getBibleInfoIsRtl,
}));
vi.mock('../../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../others/LoadingComp', () => ({
    default: () => <div className="loading" />,
}));
vi.mock('./RenderVerseTextComp', () => ({
    default: ({ verseInfo, extraVerseInfoList, nextVerseInfo, index }: any) => (
        <span
            className="verse"
            data-extra={extraVerseInfoList
                .map((verse: any) => verse.text)
                .join('|')}
            data-next={nextVerseInfo?.kjvBibleVersesKey ?? ''}
            data-index={index}
        >
            {verseInfo.text}
        </span>
    ),
}));
vi.mock('./viewExtraHelpers', () => ({
    cleanupVerseNumberClicked: h.cleanupVerseNumberClicked,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `Font ${bibleKey}`,
}));
vi.mock('../verseHighlightPainter', () => ({
    useVerseHighlightPainting: h.useVerseHighlightPainting,
}));
vi.mock('../verseCommentHoverHelpers', () => ({
    useVerseCommentHover: h.useVerseCommentHover,
}));

import BibleViewTextComp from './BibleViewTextComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const WIDE_DIGITS = '０１２３４５６７８９';

function toWide(n: number) {
    return `${n}`
        .split('')
        .map((digit) => WIDE_DIGITS[Number(digit)])
        .join('');
}

function genDeferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

function genVerse(kjvBibleVersesKey: string, text: string) {
    return { kjvBibleVersesKey, text } as any;
}

function genItem(target: object, extraBibleKeys: string[] = []) {
    return { id: 4, bibleKey: 'KJV', extraBibleKeys, target } as any;
}

// What each bible answers per chapter, `<bibleKey> <chapter>`: a list, null
// for a chapter it lacks, or a promise answering later. Any other chapter
// answers one verse naming itself.
function setChapterTable(table: Record<string, unknown> = {}) {
    h.toVerseTextList.mockImplementation(
        async (
            bibleKey: string,
            target: any,
            _isSkip: boolean,
            range: { start: number; count: number },
        ) => {
            const verseList: any[] = [];
            for (let i = 0; i < range.count; i++) {
                const chapter = target.chapter + range.start + i;
                const key = `${bibleKey} ${chapter}`;
                const chapterVerseList =
                    key in table
                        ? await table[key]
                        : [
                              genVerse(
                                  `GEN ${chapter}:1`,
                                  `${bibleKey} ${chapter}`,
                              ),
                          ];
                if (chapterVerseList === null) {
                    return null;
                }
                verseList.push(...(chapterVerseList as any[]));
            }
            return verseList;
        },
    );
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    h.viewController = { applyTargetOrBibleKey: vi.fn() };
    h.getVersesCount.mockResolvedValue(6);
    h.toLocaleNumBible.mockImplementation(
        async (_bibleKey: string, n: number) => {
            return toWide(n);
        },
    );
    h.getBibleInfoIsRtl.mockResolvedValue(false);
    setChapterTable();
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

async function renderText(bibleItem: any) {
    act(() => {
        root.render(<BibleViewTextComp bibleItem={bibleItem} />);
    });
    await flush();
}

function readVerses() {
    return Array.from(host.querySelectorAll<HTMLElement>('.verse')).map(
        (element) => {
            return {
                text: element.textContent,
                extra: element.dataset.extra,
                next: element.dataset.next,
                index: element.dataset.index,
            };
        },
    );
}

function getNumbers() {
    return Array.from(host.querySelectorAll<HTMLElement>('.verse-number'));
}

function getMoreButton() {
    return host.querySelector<HTMLButtonElement>('.bible-show-next-chapter');
}

async function pressMore() {
    await act(async () => {
        getMoreButton()!.click();
    });
    await flush();
}

describe('BibleViewTextComp', () => {
    test("each verse is paired with the extra bibles' own by its key, and a bible lacking the chapter adds nothing", async () => {
        h.getBibleInfoIsRtl.mockResolvedValue(true);
        setChapterTable({
            'KJV 1': [
                genVerse('GEN 1:2', 'In the beginning'),
                genVerse('GEN 1:3', 'And God said'),
            ],
            // Numbered its own way: its verses come in another order.
            'XXB 1': [genVerse('GEN 1:3', '☀ ✦ ☾'), genVerse('GEN 1:2', '✝ ☁')],
            'NIV 1': null,
        });
        act(() => {
            root.render(
                <BibleViewTextComp
                    bibleItem={genItem(
                        {
                            bookKey: 'GEN',
                            chapter: 1,
                            verseStart: 2,
                            verseEnd: 3,
                        },
                        ['XXB', 'NIV'],
                    )}
                />,
            );
        });
        expect(host.querySelector('.loading')).not.toBeNull();
        await flush();
        expect(host.querySelector('.loading')).toBeNull();

        const container = host.firstElementChild as HTMLElement;
        expect(container.className).toBe(
            'bible-view-text app-selectable-text p-1',
        );
        expect(container.dataset.bibleItemId).toBe('4');
        expect(container.style.fontSize).toBe('20px');
        expect(container.style.paddingBottom).toBe('100px');
        // A right-to-left bible beside others is laid out with them.
        expect(container.getAttribute('dir')).toBeNull();
        expect(h.toVerseTextList.mock.calls.map((call) => call[0])).toEqual([
            'KJV',
            'XXB',
            'NIV',
        ]);
        expect(readVerses()).toEqual([
            {
                text: 'In the beginning',
                extra: '✝ ☁',
                next: 'GEN 1:3',
                index: '0',
            },
            {
                text: 'And God said',
                extra: '☀ ✦ ☾',
                next: '',
                index: '1',
            },
        ]);
        // One painter and one hover watcher for the whole view.
        expect(h.useVerseHighlightPainting.mock.lastCall![0].current).toBe(
            container,
        );
        expect(h.useVerseCommentHover.mock.lastCall![0].current).toBe(
            container,
        );
    });

    test('a passage the bible lacks says so, right to left when it stands alone', async () => {
        h.getBibleInfoIsRtl.mockResolvedValue(true);
        h.getVersesCount.mockResolvedValue(null);
        setChapterTable({ 'KJV 1': null });
        await renderText(
            genItem({ bookKey: 'GEN', chapter: 1, verseStart: 1, verseEnd: 3 }),
        );
        const container = host.firstElementChild as HTMLElement;
        expect(container.getAttribute('dir')).toBe('rtl');
        // Nothing before verse 1, and nothing after in a chapter it cannot
        // count.
        expect(container.textContent).toBe(
            'No verses found for this Bible item',
        );
        expect(container.querySelector('.text-danger')).not.toBeNull();
        expect(getNumbers()).toHaveLength(0);
    });

    test('the verses around the passage are numbered as the bible writes them, and a double-click moves its start or end', async () => {
        const bibleItem = genItem({
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 3,
            verseEnd: 4,
        });
        await renderText(bibleItem);
        expect(
            Array.from(host.querySelectorAll('.verse-number, .verse')).map(
                (element) => element.textContent,
            ),
        ).toEqual(['１', '２', 'KJV 1', '５', '６']);
        expect(getNumbers().map((element) => element.title)).toEqual([
            'Double click to select verses 1-3',
            'Double click to select verses 2-3',
            'Double click to select verses 3-5',
            'Double click to select verses 3-6',
        ]);
        const label = getNumbers()[0].firstElementChild as HTMLElement;
        expect(label.style.fontSize).toBe('14px');
        expect(label.style.fontFamily).toBe('Font KJV');

        for (const element of [getNumbers()[0], getNumbers()[3]]) {
            act(() => {
                element.dispatchEvent(
                    new MouseEvent('dblclick', {
                        bubbles: true,
                        cancelable: true,
                    }),
                );
            });
        }
        expect(h.viewController.applyTargetOrBibleKey.mock.calls).toEqual([
            [
                bibleItem,
                {
                    target: {
                        bookKey: 'GEN',
                        chapter: 1,
                        verseStart: 1,
                        verseEnd: 4,
                    },
                },
            ],
            [
                bibleItem,
                {
                    target: {
                        bookKey: 'GEN',
                        chapter: 1,
                        verseStart: 3,
                        verseEnd: 6,
                    },
                },
            ],
        ]);
        expect(
            h.cleanupVerseNumberClicked.mock.calls.map((call) => call[0].type),
        ).toEqual(['dblclick', 'dblclick']);
    });

    test('a passage over more chapters than are shown reads one more per press, in every bible', async () => {
        const chapter4 = genDeferred<unknown>();
        setChapterTable({
            'KJV 4': chapter4.promise,
            // The extra bible lacks this one chapter.
            'XXB 4': null,
        });
        await renderText(
            genItem(
                {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 1,
                    verseEnd: 2,
                    chapterEnd: 5,
                },
                ['XXB'],
            ),
        );
        expect(readVerses().map((verse) => [verse.text, verse.extra])).toEqual([
            ['KJV 1', 'XXB 1'],
            ['KJV 2', 'XXB 2'],
            ['KJV 3', 'XXB 3'],
        ]);
        const more = getMoreButton()!;
        expect([
            more.title,
            more.getAttribute('aria-label'),
            more.textContent,
            more.disabled,
        ]).toEqual([
            'Show the next chapter',
            'Show the next chapter',
            '...',
            false,
        ]);
        // The numbers after the passage wait for its last chapter.
        expect(getNumbers()).toHaveLength(0);

        await pressMore();
        // Pressed once, it cannot be pressed again until that chapter is in.
        expect(more.disabled).toBe(true);
        expect(
            h.toVerseTextList.mock.calls.slice(-2).map((call) => {
                return [call[0], call[3]];
            }),
        ).toEqual([
            ['KJV', { start: 3, count: 1 }],
            ['XXB', { start: 3, count: 1 }],
        ]);
        chapter4.resolve([genVerse('GEN 4:1', 'KJV 4')]);
        await flush();
        expect(more.disabled).toBe(false);
        expect(readVerses().slice(-2)).toEqual([
            { text: 'KJV 3', extra: 'XXB 3', next: 'GEN 4:1', index: '2' },
            { text: 'KJV 4', extra: '', next: '', index: '3' },
        ]);

        await pressMore();
        expect(readVerses().map((verse) => [verse.text, verse.extra])).toEqual([
            ['KJV 1', 'XXB 1'],
            ['KJV 2', 'XXB 2'],
            ['KJV 3', 'XXB 3'],
            ['KJV 4', ''],
            ['KJV 5', 'XXB 5'],
        ]);
        // All of it shown: nothing more to read, and the verses after it are
        // those of the chapter it ends in.
        expect(getMoreButton()).toBeNull();
        expect(h.getVersesCount).toHaveBeenLastCalledWith('KJV', 'GEN', 5);
        expect(getNumbers().map((element) => element.textContent)).toEqual([
            '３',
            '４',
            '５',
            '６',
        ]);
    });

    test('a chapter the bible lacks ends the passage where it is', async () => {
        h.getVersesCount.mockResolvedValue(null);
        setChapterTable({ 'KJV 4': null });
        await renderText(
            genItem({
                bookKey: 'GEN',
                chapter: 1,
                verseStart: 1,
                verseEnd: 2,
                chapterEnd: 5,
            }),
        );
        await pressMore();
        expect(readVerses().map((verse) => verse.text)).toEqual([
            'KJV 1',
            'KJV 2',
            'KJV 3',
        ]);
        expect(getMoreButton()).toBeNull();
        expect(getNumbers()).toHaveLength(0);
    });

    test('a chapter read for a passage no longer shown is dropped', async () => {
        const chapter4 = genDeferred<unknown>();
        setChapterTable({ 'KJV 4': chapter4.promise });
        await renderText(
            genItem({
                bookKey: 'GEN',
                chapter: 1,
                verseStart: 1,
                verseEnd: 2,
                chapterEnd: 5,
            }),
        );
        await pressMore();
        // Meanwhile the view moves on to another passage.
        await renderText(
            genItem({ bookKey: 'GEN', chapter: 7, verseStart: 1, verseEnd: 2 }),
        );
        expect(readVerses().map((verse) => verse.text)).toEqual(['KJV 7']);

        chapter4.resolve([genVerse('GEN 4:1', 'KJV 4')]);
        await flush();
        expect(readVerses().map((verse) => verse.text)).toEqual(['KJV 7']);
    });

    test('a chapter that fails to read is reported, and can be asked for again', async () => {
        const error = new Error('The bible file could not be read');
        const readChapters = h.toVerseTextList.getMockImplementation()!;
        h.toVerseTextList.mockImplementation((...args: any[]) => {
            if (args[3].start === 3) {
                return Promise.reject(error);
            }
            return readChapters(...args);
        });
        await renderText(
            genItem({
                bookKey: 'GEN',
                chapter: 1,
                verseStart: 1,
                verseEnd: 2,
                chapterEnd: 5,
            }),
        );
        await pressMore();
        expect(h.handleError.mock.calls).toEqual([[error]]);
        expect(readVerses().map((verse) => verse.text)).toEqual([
            'KJV 1',
            'KJV 2',
            'KJV 3',
        ]);
        expect(getMoreButton()!.disabled).toBe(false);
    });
});
