// @vitest-environment jsdom

import { act, createContext, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        paneList: [] as {
            target: {
                bookKey: string;
                chapter: number;
                verseStart: number;
                verseEnd: number;
                chapterEnd?: number;
            };
        }[],
        renderedTargetsList: [] as unknown[],
    };
});

vi.mock('../bible-reader/BibleItemsViewController', () => ({
    useBibleItemViewControllerUpdateEvent: () => mocks.paneList,
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    EditingResultContext: createContext(null),
    useLookupBibleItemControllerContext: () => ({
        resolveStraightBibleItems: () => mocks.paneList,
    }),
}));
vi.mock('../helper/appHooks', () => ({ useAppEffect: useEffect }));
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => {
        callback();
    },
}));
vi.mock('../others/LoadingComp', () => ({ default: () => null }));
vi.mock('./ResourcesRendererComp', () => ({
    default: ({ targets }: { targets: unknown }) => {
        mocks.renderedTargetsList.push(targets);
        return null;
    },
}));
// The key rules as shipped (`resourcesScanHelpers` reaches the file system at
// import time): one `BOOK.chapter` part per distinct chapter, in order.
vi.mock('./resourcesScanHelpers', () => ({
    toResourceTargetsKey: (targets: { bookKey: string; chapter: number }[]) => {
        const parts = targets.map(({ bookKey, chapter }) => {
            return `${bookKey}.${chapter}`;
        });
        return [...new Set(parts)].join(',');
    },
    fromResourceTargetsKey: (targetsKey: string) => {
        if (targetsKey === '') {
            return [];
        }
        return targetsKey.split(',').map((part) => {
            const [bookKey, chapter] = part.split('.');
            return { bookKey, chapter: Number(chapter) };
        });
    },
}));

import ResourcesPreviewerComp from './ResourcesPreviewerComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    mocks.paneList = [];
    mocks.renderedTargetsList = [];
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

async function renderTargets() {
    await act(async () => {
        root.render(<ResourcesPreviewerComp />);
    });
    return mocks.renderedTargetsList.at(-1);
}

describe('ResourcesPreviewerComp', () => {
    test('lists the chapter of each pane once', async () => {
        mocks.paneList = [
            {
                target: {
                    bookKey: 'GEN',
                    chapter: 24,
                    verseStart: 1,
                    verseEnd: 5,
                },
            },
            {
                target: {
                    bookKey: 'GEN',
                    chapter: 24,
                    verseStart: 6,
                    verseEnd: 9,
                },
            },
            {
                target: {
                    bookKey: 'EXO',
                    chapter: 3,
                    verseStart: 1,
                    verseEnd: 1,
                },
            },
        ];
        expect(await renderTargets()).toEqual([
            { bookKey: 'GEN', chapter: 24 },
            { bookKey: 'EXO', chapter: 3 },
        ]);
    });

    test('lists each chapter of a passage crossing chapters, the first three only', async () => {
        mocks.paneList = [
            {
                // JHN 1:2-6:4: six chapters, of which three are shown.
                target: {
                    bookKey: 'JHN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 4,
                    chapterEnd: 6,
                },
            },
            {
                target: {
                    bookKey: 'GEN',
                    chapter: 2,
                    verseStart: 9,
                    verseEnd: 1,
                    chapterEnd: 3,
                },
            },
        ];
        expect(await renderTargets()).toEqual([
            { bookKey: 'JHN', chapter: 1 },
            { bookKey: 'JHN', chapter: 2 },
            { bookKey: 'JHN', chapter: 3 },
            { bookKey: 'GEN', chapter: 2 },
            { bookKey: 'GEN', chapter: 3 },
        ]);
    });
});
