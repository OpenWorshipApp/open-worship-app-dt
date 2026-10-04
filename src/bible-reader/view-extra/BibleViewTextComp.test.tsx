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
        expect(toPassageViewKey(genItem('GEN', 4), undefined)).toBe(
            toPassageViewKey(genItem('GEN', 4), undefined),
        );
    });

    test('another range, extra bible or extra passage is another key', () => {
        const key = toPassageViewKey(genItem('GEN', 4), undefined);
        expect(toPassageViewKey(genItem('GEN', 4, 8), undefined)).not.toBe(key);
        expect(
            toPassageViewKey(
                { ...genItem('GEN', 4), extraBibleKeys: ['NIV'] },
                undefined,
            ),
        ).not.toBe(key);
        expect(
            toPassageViewKey(genItem('GEN', 4), [genItem('GEN', 5)]),
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
            Promise.resolve([{ localeVerse: '2', text: 'GEN text' }]),
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
        });

        verseList.resolve([{ localeVerse: '16', text: 'JHN text' }]);
        await flush();
        expect(read()).toEqual({
            verses: ['JHN text'],
            rests: ['1-1', '8-36'],
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
});
