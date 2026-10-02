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
            };
        }[],
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
    getVerses: async () => ({}),
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
    default: () => null,
}));
vi.mock('../location-name-lookup/verseRecordListHelpers', () => ({
    collectVerseRecords: () => ({ names: [], locations: [] }),
    toVerseListLabel: () => '',
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
    });
});
