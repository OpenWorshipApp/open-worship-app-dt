import { createContext } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        headerBibleItemList: [] as any[],
        aiVerseList: [] as unknown[],
    };
});

vi.mock('../bible-reader/SelectedBibleVerseHeaderComp', () => ({
    default: ({ bibleItem }: { bibleItem: unknown }) => {
        mocks.headerBibleItemList.push(bibleItem);
        return null;
    },
}));
vi.mock('./BibleCrossRefWrapperComp', () => ({
    default: ({ children }: { children: unknown }) => children,
}));
vi.mock('./BibleCrossRefAIItemRendererBodyComp', () => ({
    default: ({ chapter, verse }: { chapter: number; verse: number }) => {
        mocks.aiVerseList.push([chapter, verse]);
        return null;
    },
}));
vi.mock('./BibleCrossRefOpenAIItemRendererBodyComp', () => ({
    default: () => null,
}));
vi.mock('./BibleCrossRefAnthropicItemRendererBodyComp', () => ({
    default: () => null,
}));
vi.mock('../helper/ai/openAIAvailabilityHelpers', () => ({
    useAvailable: () => false,
}));
vi.mock('../helper/ai/anthropicAvailabilityHelpers', () => ({
    useAvailable: () => false,
}));
vi.mock('../helper/ai/bibleCrossRefHelpers', () => ({
    BibleKeyContext: createContext('KJV'),
    defaultRefreshingRef: { refresh: () => {} },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../server/appProvider', () => ({ default: {} }));

import BibleCrossRefRendererComp from './BibleCrossRefRendererComp';

// Only what the renderer uses: a copy whose target can be replaced.
class FakeBibleItem {
    constructor(
        public bibleKey: string,
        public target: any,
    ) {}
    clone() {
        return new FakeBibleItem(this.bibleKey, { ...this.target });
    }
}

beforeEach(() => {
    mocks.headerBibleItemList = [];
    mocks.aiVerseList = [];
});

function render(bibleItem: FakeBibleItem) {
    renderToStaticMarkup(
        <BibleCrossRefRendererComp
            bibleItem={bibleItem as any}
            setBibleItem={() => {}}
        />,
    );
    return mocks.headerBibleItemList[0];
}

describe('BibleCrossRefRendererComp', () => {
    test('heads a cross-chapter passage with its first verse alone', () => {
        const target = {
            bookKey: 'JHN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 4,
            chapterEnd: 3,
        };
        const bibleItem = new FakeBibleItem('KJV', target);
        // Rewritten in place, the copy kept `chapterEnd`: JHN 1:2-3:2.
        expect(render(bibleItem).target).toEqual({
            bookKey: 'JHN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 2,
        });
        expect(mocks.aiVerseList).toEqual([[1, 2]]);
        expect(bibleItem.target).toEqual(target);
    });

    test('heads a one-chapter passage with its first verse, as before', () => {
        const bibleItem = new FakeBibleItem('KJV', {
            bookKey: 'GEN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 18,
        });
        expect(render(bibleItem).target).toEqual({
            bookKey: 'GEN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 16,
        });
    });
});
