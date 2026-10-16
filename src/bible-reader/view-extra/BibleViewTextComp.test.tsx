// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    function genDeferred<T>() {
        let resolve: (value: T) => void = () => {};
        const promise = new Promise<T>((r) => {
            resolve = r;
        });
        return { promise, resolve };
    }
    return {
        genDeferred,
        // bookKey -> what each reader answers; a deferred answers later.
        verseListMap: new Map<string, any>(),
        verseCountMap: new Map<string, any>(),
        toVerseTextListMock: vi.fn(),
        getVersesCountMock: vi.fn(),
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
    useBibleItemsViewControllerContext: () => ({
        applyTargetOrBibleKey: vi.fn(),
    }),
}));
vi.mock('../../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { toVerseTextList: h.toVerseTextListMock },
}));
vi.mock('../../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: h.getVersesCountMock,
    toLocaleNumBible: async (_bibleKey: string, verse: number) => {
        return String(verse);
    },
}));
vi.mock('../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfoIsRtl: async () => false,
}));
vi.mock('../../others/LoadingComp', () => ({
    default: () => <div className="loading" />,
}));
vi.mock('./RenderRestVerseNumListComp', () => ({
    default: ({ restVerseList }: { restVerseList: any[] }) => {
        if (restVerseList.length === 0) {
            return null;
        }
        const first = restVerseList[0].label;
        const last = restVerseList[restVerseList.length - 1].label;
        return <span className="rest">{`${first}-${last}`}</span>;
    },
}));
vi.mock('./RenderVerseTextComp', () => ({
    default: ({ verseInfo }: { verseInfo: { text: string } }) => (
        <span className="verse">{verseInfo.text}</span>
    ),
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
vi.mock('../verseHighlightPainter', () => ({
    useVerseHighlightPainting: () => {},
}));
vi.mock('../verseCommentHoverHelpers', () => ({
    useVerseCommentHover: () => {},
}));
vi.mock('./RenderShowNextChapterButtonComp', () => ({
    default: ({ onClick }: { onClick: () => void }) => (
        <button type="button" className="more" onClick={onClick}>
            ...
        </button>
    ),
}));

import BibleViewTextComp, { toPassageViewKey } from './BibleViewTextComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function genItem(bookKey: string, chapter: number, verseEnd = 7) {
    return {
        id: 1,
        bibleKey: 'KJV',
        extraBibleKeys: [],
        target: { bookKey, chapter, verseStart: 2, verseEnd },
        toTitle: async () => `${bookKey} ${chapter}`,
    } as any;
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe('toPassageViewKey', () => {
    test('the same passage in a new object is the same key', () => {
        expect(toPassageViewKey(genItem('GEN', 4))).toBe(
            toPassageViewKey(genItem('GEN', 4)),
        );
    });

    test('another range, end chapter or extra bible is another key', () => {
        const key = toPassageViewKey(genItem('GEN', 4));
        expect(toPassageViewKey(genItem('GEN', 4, 8))).not.toBe(key);
        const crossItem = genItem('GEN', 4);
        crossItem.target.chapterEnd = 5;
        expect(toPassageViewKey(crossItem)).not.toBe(key);
        expect(
            toPassageViewKey({ ...genItem('GEN', 4), extraBibleKeys: ['NIV'] }),
        ).not.toBe(key);
    });
});

describe('BibleViewTextComp', () => {
    let host: HTMLDivElement;
    let root: Root;
    beforeEach(() => {
        h.verseListMap.clear();
        h.verseCountMap.clear();
        h.toVerseTextListMock.mockReset();
        h.getVersesCountMock.mockReset();
        h.toVerseTextListMock.mockImplementation(
            (_bibleKey: string, target: any) => {
                return h.verseListMap.get(target.bookKey);
            },
        );
        h.getVersesCountMock.mockImplementation(
            (_bibleKey: string, bookKey: string) => {
                return h.verseCountMap.get(bookKey);
            },
        );
        h.verseListMap.set(
            'GEN',
            Promise.resolve([
                {
                    localeVerse: '2',
                    text: 'GEN text',
                    kjvBibleVersesKey: 'GEN 4:2',
                },
            ]),
        );
        h.verseCountMap.set('GEN', Promise.resolve(26));
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

    function read() {
        return {
            verses: [...host.querySelectorAll('.verse')].map((element) => {
                return element.textContent;
            }),
            rests: [...host.querySelectorAll('.rest')].map((element) => {
                return element.textContent;
            }),
            isMore: host.querySelector('.more') !== null,
        };
    }

    // Read piece by piece, a move to another passage painted the new verse
    // numbers around the old verses for as long as the verses took.
    test('a passage stays whole until the next one is read whole', async () => {
        act(() => {
            root.render(<BibleViewTextComp bibleItem={genItem('GEN', 4)} />);
        });
        await flush();
        expect(read()).toEqual({
            verses: ['GEN text'],
            rests: ['1-1', '8-26'],
            isMore: false,
        });

        const verseList = h.genDeferred<any>();
        const verseCount = h.genDeferred<number>();
        h.verseListMap.set('JHN', verseList.promise);
        h.verseCountMap.set('JHN', verseCount.promise);
        act(() => {
            root.render(<BibleViewTextComp bibleItem={genItem('JHN', 3)} />);
        });
        verseCount.resolve(36);
        await flush();
        expect(read()).toEqual({
            verses: ['GEN text'],
            rests: ['1-1', '8-26'],
            isMore: false,
        });

        verseList.resolve([
            {
                localeVerse: '16',
                text: 'JHN text',
                kjvBibleVersesKey: 'JHN 3:16',
            },
        ]);
        await flush();
        expect(read()).toEqual({
            verses: ['JHN text'],
            rests: ['1-1', '8-36'],
            isMore: false,
        });
    });

    test('a new object for the same passage reads nothing again', async () => {
        act(() => {
            root.render(<BibleViewTextComp bibleItem={genItem('GEN', 4)} />);
        });
        await flush();
        const readCount = h.toVerseTextListMock.mock.calls.length;
        act(() => {
            root.render(<BibleViewTextComp bibleItem={genItem('GEN', 4)} />);
        });
        await flush();
        expect(h.toVerseTextListMock.mock.calls.length).toBe(readCount);
        expect(read().verses).toEqual(['GEN text']);
    });

    // GEN 4:2 to 9:7: six chapters, so three are read, then one per `...`;
    // the numbers after the passage belong to its LAST chapter, and show
    // only once that chapter does.
    test('a passage over many chapters is read three chapters deep, then one per press', async () => {
        h.toVerseTextListMock.mockImplementation(
            (_bibleKey: string, _target: any, _isSkip: boolean, range: any) => {
                return Promise.resolve(
                    Array.from({ length: range.count }, (_, i) => {
                        const chapter = 4 + range.start + i;
                        return {
                            localeVerse: '1',
                            text: `GEN ${chapter}`,
                            kjvBibleVersesKey: `GEN ${chapter}:1`,
                        };
                    }),
                );
            },
        );
        h.verseCountMap.set('GEN', Promise.resolve(9));
        const crossItem = genItem('GEN', 4);
        crossItem.target.chapterEnd = 9;
        act(() => {
            root.render(<BibleViewTextComp bibleItem={crossItem} />);
        });
        await flush();
        expect(h.toVerseTextListMock).toHaveBeenLastCalledWith(
            'KJV',
            crossItem.target,
            false,
            { start: 0, count: 3 },
        );
        expect(read()).toEqual({
            verses: ['GEN 4', 'GEN 5', 'GEN 6'],
            rests: ['1-1'],
            isMore: true,
        });
        for (const chapter of [7, 8]) {
            act(() => {
                (host.querySelector('.more') as HTMLButtonElement).click();
            });
            await flush();
            expect(h.toVerseTextListMock).toHaveBeenLastCalledWith(
                'KJV',
                crossItem.target,
                false,
                { start: chapter - 4, count: 1 },
            );
            expect(read().verses.at(-1)).toBe(`GEN ${chapter}`);
            expect(read().isMore).toBe(true);
        }
        act(() => {
            (host.querySelector('.more') as HTMLButtonElement).click();
        });
        await flush();
        expect(read()).toEqual({
            verses: ['GEN 4', 'GEN 5', 'GEN 6', 'GEN 7', 'GEN 8', 'GEN 9'],
            rests: ['1-1', '8-9'],
            isMore: false,
        });
        expect(h.getVersesCountMock).toHaveBeenLastCalledWith('KJV', 'GEN', 9);
    });
});
