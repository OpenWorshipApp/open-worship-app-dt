// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type RestPropsType = {
    restVerseList: { verse: number; label: string }[];
    onSelect: (verse: number) => void;
    toTitle: (verse: number) => string;
};

const h = vi.hoisted(() => ({
    viewController: { applyTargetOrBibleKey: vi.fn() },
    // bibleKey -> the verses of chapter `start` of the passage, or null
    verseTextList: vi.fn(),
    getVersesCount: vi.fn(),
    handleError: vi.fn(),
    restPropsList: [] as RestPropsType[],
}));

vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(load: () => Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                void load().then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
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
    bibleRenderHelper: { toVerseTextList: h.verseTextList },
}));
vi.mock('../../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: h.getVersesCount,
    toLocaleNumBible: async (_bibleKey: string, verse: number) => `${verse}`,
}));
vi.mock('../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfoIsRtl: async () => true,
}));
vi.mock('../../others/LoadingComp', () => ({
    default: () => <div className="loading" />,
}));
vi.mock('./RenderRestVerseNumListComp', () => ({
    default: (props: RestPropsType) => {
        h.restPropsList.push(props);
        return (
            <span className="rest">
                {props.restVerseList.map(({ verse }) => verse).join(',')}
            </span>
        );
    },
}));
vi.mock('./RenderVerseTextComp', () => ({
    default: ({
        verseInfo,
        extraVerseInfoList,
        nextVerseInfo,
    }: {
        verseInfo: { text: string };
        extraVerseInfoList: { text: string }[];
        nextVerseInfo: { text: string } | null;
    }) => (
        <span
            className="verse"
            data-extra={extraVerseInfoList.map((info) => info.text).join('|')}
            data-next={nextVerseInfo?.text ?? ''}
        >
            {verseInfo.text}
        </span>
    ),
}));
vi.mock('./RenderShowNextChapterButtonComp', () => ({
    // Not disabled while loading, unlike the real one: a press that lands
    // anyway (a second click in the same frame) must still be ignored.
    default: ({ onClick }: { onClick: () => void }) => (
        <button type="button" className="more" onClick={onClick} />
    ),
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../verseHighlightPainter', () => ({
    useVerseHighlightPainting: () => {},
}));
vi.mock('../verseCommentHoverHelpers', () => ({
    useVerseCommentHover: () => {},
}));
vi.mock('../../helper/errorHelpers', () => ({ handleError: h.handleError }));

import BibleViewTextComp from './BibleViewTextComp';

function genVerse(bibleKey: string, chapter: number, verse: number) {
    return {
        text: `${bibleKey} ${chapter}:${verse}`,
        kjvBibleVersesKey: `GEN ${chapter}:${verse}`,
    };
}

function genItem(target: object, extraBibleKeys: string[] = []) {
    return { id: 9, bibleKey: 'KJV', extraBibleKeys, target } as any;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.restPropsList = [];
    h.getVersesCount.mockResolvedValue(5);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function flush() {
    await act(async () => {
        for (let i = 0; i < 50; i++) {
            await Promise.resolve();
        }
    });
}

async function render(bibleItem: any) {
    await act(async () => {
        root.render(<BibleViewTextComp bibleItem={bibleItem} />);
    });
    await flush();
}

function readVerses() {
    return Array.from(host.querySelectorAll<HTMLSpanElement>('.verse')).map(
        (element) => {
            return [element.textContent, element.dataset.extra];
        },
    );
}

// The two rest lists of the latest render: before the passage, after it.
function getRests() {
    const [before, after] = h.restPropsList.slice(-2);
    return { before, after };
}

describe('compared bibles', () => {
    test('each verse is paired with the same verse of every other bible', async () => {
        h.verseTextList.mockImplementation(async (bibleKey: string) => {
            if (bibleKey === 'KJV') {
                return [genVerse('KJV', 4, 2), genVerse('KJV', 4, 3)];
            }
            if (bibleKey === 'KHM') {
                // Numbered differently: it has no verse 2 in this chapter.
                return [genVerse('KHM', 4, 3)];
            }
            // A bible lacking the chapter altogether.
            return null;
        });
        const target = {
            bookKey: 'GEN',
            chapter: 4,
            verseStart: 2,
            verseEnd: 3,
        };
        await render(genItem(target, ['KHM', 'FRE']));
        expect(h.verseTextList).toHaveBeenCalledWith('KHM', target, false, {
            start: 0,
            count: 1,
        });
        expect(h.verseTextList).toHaveBeenCalledWith('FRE', target, false, {
            start: 0,
            count: 1,
        });
        expect(readVerses()).toEqual([
            ['KJV 4:2', ''],
            ['KJV 4:3', 'KHM 4:3'],
        ]);
        const container =
            host.querySelector<HTMLDivElement>('.bible-view-text')!;
        // Compared columns are never flipped as a whole, even for an rtl bible.
        expect(container.getAttribute('dir')).toBeNull();
        expect(container.dataset.bibleItemId).toBe('9');
        expect(container.style.fontSize).toBe('20px');
    });

    test('a passage the bible lacks says so', async () => {
        h.verseTextList.mockResolvedValue(null);
        await render(
            genItem({
                bookKey: 'GEN',
                chapter: 99,
                verseStart: 1,
                verseEnd: 2,
            }),
        );
        expect(host.querySelector('.text-danger')!.textContent).toBe(
            'No verses found for this Bible item',
        );
        expect(host.querySelector('.verse')).toBeNull();
        // One bible, rtl: the whole view reads right to left.
        expect(
            host.querySelector('.bible-view-text')!.getAttribute('dir'),
        ).toBe('rtl');
    });
});

describe('the verse numbers outside the passage', () => {
    const target = { bookKey: 'GEN', chapter: 4, verseStart: 3, verseEnd: 3 };

    beforeEach(() => {
        h.verseTextList.mockResolvedValue([genVerse('KJV', 4, 3)]);
    });

    test('one before the passage starts it there', async () => {
        const bibleItem = genItem(target);
        await render(bibleItem);
        const { before } = getRests();
        expect(before.restVerseList.map(({ verse }) => verse)).toEqual([1, 2]);
        expect(before.toTitle(1)).toBe('1-3');
        before.onSelect(1);
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenCalledWith(
            bibleItem,
            { target: { ...target, verseStart: 1 } },
        );
    });

    test('one after the passage ends it there', async () => {
        const bibleItem = genItem(target);
        await render(bibleItem);
        const { after } = getRests();
        expect(after.restVerseList.map(({ verse }) => verse)).toEqual([4, 5]);
        expect(h.getVersesCount).toHaveBeenCalledWith('KJV', 'GEN', 4);
        expect(after.toTitle(5)).toBe('3-5');
        after.onSelect(5);
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenCalledWith(
            bibleItem,
            { target: { ...target, verseEnd: 5 } },
        );
    });

    test('a chapter that cannot be counted has no numbers after it', async () => {
        h.getVersesCount.mockResolvedValue(null);
        await render(genItem(target));
        expect(getRests().after.restVerseList).toEqual([]);
    });
});

describe('reading one more chapter', () => {
    // GEN 4:1 to 8:2: five chapters, three shown first.
    const target = {
        bookKey: 'GEN',
        chapter: 4,
        verseStart: 1,
        verseEnd: 2,
        chapterEnd: 8,
    };

    test('appends the chapter in every bible, read once per press', async () => {
        let releaseNext: () => void = () => {};
        const nextChapterGate = new Promise<void>((resolve) => {
            releaseNext = resolve;
        });
        h.verseTextList.mockImplementation(
            async (
                bibleKey: string,
                _target: unknown,
                _isSkip: boolean,
                range: { start: number; count: number },
            ) => {
                if (range.start === 3) {
                    await nextChapterGate;
                }
                return Array.from({ length: range.count }, (_, i) => {
                    return genVerse(bibleKey, 4 + range.start + i, 1);
                });
            },
        );
        await render(genItem(target, ['KHM']));
        expect(readVerses()).toEqual([
            ['KJV 4:1', 'KHM 4:1'],
            ['KJV 5:1', 'KHM 5:1'],
            ['KJV 6:1', 'KHM 6:1'],
        ]);
        const more = host.querySelector<HTMLButtonElement>('.more')!;
        // Two presses, each its own event, the second while the first reads.
        await act(async () => {
            more.click();
        });
        await act(async () => {
            more.click();
        });
        const nextReads = h.verseTextList.mock.calls.filter(([, , , range]) => {
            return range.start === 3;
        });
        // One read per bible, not two.
        expect(nextReads.map(([bibleKey]) => bibleKey)).toEqual(['KJV', 'KHM']);
        releaseNext();
        await flush();
        expect(readVerses().at(-1)).toEqual(['KJV 7:1', 'KHM 7:1']);
    });

    test('a chapter that fails to read is reported, and can be pressed again', async () => {
        h.verseTextList.mockImplementation(
            async (
                bibleKey: string,
                _target: unknown,
                _isSkip: boolean,
                range: { start: number; count: number },
            ) => {
                if (range.start === 3) {
                    throw new Error('disk gone');
                }
                return Array.from({ length: range.count }, (_, i) => {
                    return genVerse(bibleKey, 4 + range.start + i, 1);
                });
            },
        );
        await render(genItem(target));
        const more = host.querySelector<HTMLButtonElement>('.more')!;
        await act(async () => {
            more.click();
        });
        await flush();
        expect(h.handleError).toHaveBeenCalledOnce();
        expect(h.handleError.mock.calls[0][0].message).toBe('disk gone');
        expect(readVerses()).toHaveLength(3);
        await act(async () => {
            more.click();
        });
        await flush();
        expect(h.handleError).toHaveBeenCalledTimes(2);
    });
});
