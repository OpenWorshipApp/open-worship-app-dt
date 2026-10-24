// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        verseKey: '',
        extracted: null as any,
        jsonList: [] as any[],
        renderedBibleItemList: [] as unknown[],
    };
});

vi.mock('../bible-cross-refs/BibleCrossRefRendererComp', () => ({
    default: ({ bibleItem }: { bibleItem: unknown }) => {
        mocks.renderedBibleItemList.push(bibleItem);
        return null;
    },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromJson: (json: unknown) => {
            mocks.jsonList.push(json);
            return { json };
        },
    },
}));
vi.mock('../helper/appHooks', () => ({ useAppEffect: useEffect }));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: {
        fromBibleVerseKey: () => mocks.extracted,
    },
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    useLookupBibleItemControllerContext: () => controller,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import BibleCrossReferencePreviewerComp from './BibleCrossReferencePreviewerComp';

const controller = {
    get bibleCrossReferenceVerseKey() {
        return mocks.verseKey;
    },
    setBibleVerseKey: (_key: string) => {},
};

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    mocks.jsonList = [];
    mocks.renderedBibleItemList = [];
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

async function renderPreviewer() {
    await act(async () => {
        root.render(<BibleCrossReferencePreviewerComp />);
    });
}

describe('BibleCrossReferencePreviewerComp', () => {
    test('keeps the end chapter of a cross-chapter verse key', async () => {
        mocks.verseKey = '(KJV) JHN 1:2-3:4';
        mocks.extracted = {
            bibleKey: 'KJV',
            bookKey: 'JHN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 4,
            chapterEnd: 3,
        };
        await renderPreviewer();
        expect(mocks.jsonList).toHaveLength(1);
        expect(mocks.jsonList[0]).toMatchObject({
            id: -1,
            bibleKey: 'KJV',
            target: {
                bookKey: 'JHN',
                chapter: 1,
                verseStart: 2,
                verseEnd: 4,
                chapterEnd: 3,
            },
        });
        expect(mocks.renderedBibleItemList.at(-1)).toEqual({
            json: mocks.jsonList[0],
        });
    });

    test('builds a one-chapter verse key as before', async () => {
        mocks.verseKey = '(KJV) JHN 3:16';
        mocks.extracted = {
            bibleKey: 'KJV',
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 16,
        };
        await renderPreviewer();
        expect(mocks.jsonList[0].target).toEqual({
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 16,
        });
        expect(mocks.jsonList[0].target.chapterEnd).toBeUndefined();
    });
});
