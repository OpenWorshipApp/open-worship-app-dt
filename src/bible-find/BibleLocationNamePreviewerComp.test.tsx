// @vitest-environment jsdom

import { act, createContext, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        // Stable, as the real hooks' are: a fresh object per render would
        // re-run the effect that lists them on every render, for good.
        index: {},
        recordLabels: {},
        langCode: 'km',
        paneList: [] as {
            bibleKey: string;
            target: {
                bookKey: string;
                chapter: number;
                verseStart: number;
                verseEnd: number;
                chapterEnd?: number;
            };
        }[],
        verseReadList: [] as unknown[][],
        collectedTargetList: [] as unknown[],
        isKjvMissing: false,
        // What a scan finds; nothing unless a test says otherwise.
        foundRecords: null as null | { names: unknown[]; locations: unknown[] },
    };
});

vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: {
        toKJVBibleVersesKey: (target: any) => {
            return `${target.bookKey} ${target.chapter}:${target.verseStart}`;
        },
        toTitle: async (_bibleKey: string, target: any) => {
            return `Genesis ${target.chapter}:${target.verseStart}`;
        },
    },
}));
vi.mock('../bible-reader/BibleItemsViewController', () => ({
    useBibleItemViewControllerUpdateEvent: () => mocks.paneList,
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    EditingResultContext: createContext(null),
    useLookupBibleItemControllerContext: () => ({
        // The editing pane: the bible every heading used to be named in.
        selectedBibleItem: { bibleKey: 'NIV' },
        resolveStraightBibleItems: () => mocks.paneList,
    }),
}));
vi.mock('../helper/appHooks', () => ({ useAppEffect: useEffect }));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    // Every chapter three verses long.
    getVerses: async (...args: unknown[]) => {
        mocks.verseReadList.push(args);
        if (mocks.isKjvMissing && args[0] === 'KJV') {
            return null;
        }
        return { 1: 'a', 2: 'b', 3: 'c' };
    },
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => {
        callback();
    },
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    tran: (key: string) => key,
}));
// The real rule, on the mocked language: KJV under English, otherwise the
// bible it is handed.
vi.mock('../location-name-lookup/bibleVerseHelpers', () => ({
    toLookupVerseBibleKey: (bibleKey: string | null) => {
        return mocks.langCode === 'en' ? 'KJV' : (bibleKey ?? 'KJV');
    },
}));
vi.mock('../location-name-lookup/lookupLangHelpers', () => ({
    useLookupLangPresentation: () => ({ fontFamily: undefined }),
    useSelectedLookupLangCode: () => mocks.langCode,
}));
vi.mock('../location-name-lookup/RenderLookupRecordItemComp', () => ({
    default: ({
        kind,
        record,
        extraLabel,
    }: {
        kind: string;
        record: {
            id: string;
            name: string;
            kjvName: string;
            title: string;
            iconClass: string;
        };
        extraLabel: string;
    }) => (
        <li
            className="lookup-record"
            data-kind={kind}
            data-id={record.id}
            data-icon={record.iconClass}
            title={record.title}
        >
            {`${record.name}|${record.kjvName}|${extraLabel}`}
        </li>
    ),
}));
vi.mock('../location-name-lookup/verseRecordListHelpers', () => ({
    collectVerseRecords: (
        _index: unknown,
        _labels: unknown,
        target: unknown,
    ) => {
        mocks.collectedTargetList.push(target);
        return mocks.foundRecords ?? { names: [], locations: [] };
    },
    // The real rule: each verse under its chapter.
    toVerseListLabel: (chapter: number, verseList: number[]) => {
        return verseList.map((verse) => `${chapter}:${verse}`).join(', ');
    },
    // The real rule: an open end is where the chapter read ends.
    toVerseRecordChapterTarget: (
        bookKey: string,
        slice: any,
        verseMap: any,
    ) => {
        return {
            bookKey,
            chapter: slice.chapter,
            verseStart: slice.verseStart,
            verseEnd: slice.verseEnd ?? Object.keys(verseMap ?? {}).length,
        };
    },
    useLookupRecordLabels: () => mocks.recordLabels,
}));
vi.mock('../location-name-lookup/verseTextIndexHelpers', () => ({
    useLookupTextIndex: () => mocks.index,
}));
vi.mock('../others/LoadingComp', () => ({ default: () => null }));

import BibleLocationNamePreviewerComp from './BibleLocationNamePreviewerComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    mocks.paneList = [
        {
            bibleKey: 'KJV',
            target: {
                bookKey: 'GEN',
                chapter: 3,
                verseStart: 20,
                verseEnd: 20,
            },
        },
        {
            bibleKey: 'ពគប',
            target: { bookKey: 'GEN', chapter: 4, verseStart: 1, verseEnd: 1 },
        },
    ];
    mocks.verseReadList = [];
    mocks.collectedTargetList = [];
    mocks.isKjvMissing = false;
    mocks.foundRecords = null;
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

async function renderPreviewer() {
    await act(async () => {
        root.render(<BibleLocationNamePreviewerComp />);
    });
    // The titles are awaited inside the effect.
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return {
        headingList: Array.from(host.querySelectorAll('.alert')).map(
            (element) => element.textContent,
        ),
        header: host.querySelector('.border-bottom')?.textContent ?? '',
    };
}

describe('BibleLocationNamePreviewerComp headings', () => {
    // Every section was named in the EDITING pane's bible, so a ពគប pane's
    // reading was headed `(NIV) Genesis 3:20`.
    test('a non-English lookup names each passage in its own pane bible', async () => {
        mocks.langCode = 'km';

        const { headingList, header } = await renderPreviewer();

        expect(headingList).toEqual([
            '(KJV) Genesis 3:20',
            '(ពគប) Genesis 4:1',
        ]);
        // The headings are not all KJV any more, so the header must not say so.
        expect(header).not.toContain('(KJV)');
    });

    test('an English lookup names every passage in the KJV and says so', async () => {
        mocks.langCode = 'en';

        const { headingList, header } = await renderPreviewer();

        expect(headingList).toEqual([
            '(KJV) Genesis 3:20',
            '(KJV) Genesis 4:1',
        ]);
        expect(header).toContain('(KJV)');
        // One chapter read per passage, each passage scanned as it is.
        expect(mocks.verseReadList).toEqual([
            ['KJV', 'GEN', 3],
            ['KJV', 'GEN', 4],
        ]);
        expect(mocks.collectedTargetList).toEqual(
            mocks.paneList.map(({ target }) => target),
        );
    });
});

describe('BibleLocationNamePreviewerComp for a passage crossing chapters', () => {
    test('lists one section per chapter, the first three chapters only', async () => {
        mocks.langCode = 'en';
        // GEN 1:2-5:1: five chapters, of which three are read.
        mocks.paneList = [
            {
                bibleKey: 'KJV',
                target: {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 1,
                    chapterEnd: 5,
                },
            },
        ];

        const { headingList } = await renderPreviewer();

        expect(headingList).toEqual([
            '(KJV) Genesis 1:2',
            '(KJV) Genesis 2:1',
            '(KJV) Genesis 3:1',
        ]);
        expect(mocks.verseReadList).toEqual([
            ['KJV', 'GEN', 1],
            ['KJV', 'GEN', 2],
            ['KJV', 'GEN', 3],
        ]);
        // Each chapter scanned on its own, to the end of the chapter: the
        // whole passage handed over at once read nothing (`verseEnd` 1 is
        // before `verseStart` 2).
        expect(mocks.collectedTargetList).toEqual([
            { bookKey: 'GEN', chapter: 1, verseStart: 2, verseEnd: 3 },
            { bookKey: 'GEN', chapter: 2, verseStart: 1, verseEnd: 3 },
            { bookKey: 'GEN', chapter: 3, verseStart: 1, verseEnd: 3 },
        ]);
    });

    test('ends the last chapter where the passage does', async () => {
        mocks.langCode = 'en';
        mocks.paneList = [
            {
                bibleKey: 'KJV',
                target: {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 3,
                    verseEnd: 2,
                    chapterEnd: 2,
                },
            },
        ];

        await renderPreviewer();

        expect(mocks.collectedTargetList).toEqual([
            { bookKey: 'GEN', chapter: 1, verseStart: 3, verseEnd: 3 },
            { bookKey: 'GEN', chapter: 2, verseStart: 1, verseEnd: 2 },
        ]);
    });

    test('counts an open chapter in the pane bible when the KJV is missing', async () => {
        mocks.langCode = 'km';
        mocks.isKjvMissing = true;
        mocks.paneList = [
            {
                bibleKey: 'ពគប',
                target: {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 1,
                    chapterEnd: 2,
                },
            },
        ];

        await renderPreviewer();

        // Only the chapter with an open end needs counting.
        expect(mocks.verseReadList).toEqual([
            ['KJV', 'GEN', 1],
            ['ពគប', 'GEN', 1],
            ['KJV', 'GEN', 2],
        ]);
        expect(mocks.collectedTargetList).toEqual([
            { bookKey: 'GEN', chapter: 1, verseStart: 2, verseEnd: 3 },
            { bookKey: 'GEN', chapter: 2, verseStart: 1, verseEnd: 1 },
        ]);
    });
});
