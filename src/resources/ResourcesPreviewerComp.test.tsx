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
        // What each row would be handed for its 🤖, render by render.
        readingGetters: [] as unknown[],
        resolvedWith: [] as unknown[],
    };
});
// One controller for the panel's life, as the lookup gives it.
const controller = vi.hoisted(() => ({
    resolveStraightBibleItems: (foundBibleItem: unknown) => {
        mocks.resolvedWith.push(foundBibleItem);
        return mocks.paneList;
    },
}));

vi.mock('../bible-reader/BibleItemsViewController', () => ({
    useBibleItemViewControllerUpdateEvent: () => mocks.paneList,
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    EditingResultContext: createContext(null),
    useLookupBibleItemControllerContext: () => controller,
}));
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => {
        callback();
    },
}));
vi.mock('../others/LoadingComp', () => ({ default: () => null }));
vi.mock('./ResourcesRendererComp', async () => {
    const { use } = await import('react');
    const { ResourcesReadingContext } =
        await import('./resourceReadingHelpers');
    return {
        default: ({ targets }: { targets: unknown }) => {
            mocks.renderedTargetsList.push(targets);
            mocks.readingGetters.push(use(ResourcesReadingContext));
            return null;
        },
    };
});
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

import { EditingResultContext } from '../bible-reader/LookupBibleItemController';
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
    mocks.readingGetters = [];
    mocks.resolvedWith = [];
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

    test("a row's 🤖 reads the panes at the press, through one getter for the panel's life", async () => {
        const GEN_24 = {
            target: { bookKey: 'GEN', chapter: 24, verseStart: 1, verseEnd: 5 },
        };
        mocks.paneList = [GEN_24];
        const renderWithFound = async (foundBibleItem: unknown) => {
            const value =
                foundBibleItem === null
                    ? null
                    : { result: { bibleItem: foundBibleItem } };
            await act(async () => {
                root.render(
                    <EditingResultContext value={value as any}>
                        <ResourcesPreviewerComp />
                    </EditingResultContext>,
                );
            });
        };
        await renderWithFound(null);
        const getReadingPaneList = mocks.readingGetters.at(-1) as () => unknown;
        expect(typeof getReadingPaneList).toBe('function');
        // Not read on render: only the reading effect asked the panes.
        expect(mocks.resolvedWith).toEqual([null]);

        // The box now resolves a typed passage, and the reader moved on.
        const typedBibleItem = { id: 'typed EXO 3:1' };
        mocks.paneList = [
            {
                target: {
                    bookKey: 'EXO',
                    chapter: 3,
                    verseStart: 1,
                    verseEnd: 1,
                },
            },
        ];
        await renderWithFound(typedBibleItem);
        expect(mocks.readingGetters.length).toBeGreaterThan(1);
        // The same getter every render, so a verse click re-renders no row.
        expect(new Set(mocks.readingGetters).size).toBe(1);

        mocks.resolvedWith = [];
        // Asked at the press: the panes as they are NOW, with what the box
        // resolves now.
        expect(getReadingPaneList()).toBe(mocks.paneList);
        expect(mocks.resolvedWith).toEqual([typedBibleItem]);
    });
});
