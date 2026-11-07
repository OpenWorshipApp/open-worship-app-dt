// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks, colorNotes } = vi.hoisted(() => ({
    mocks: { notifyElementHighlight: vi.fn(), onLoaded: vi.fn() },
    colorNotes: new Map<string, string | null>(),
}));

vi.mock('./appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppEffectAsync: () => {},
        useAppCurrentRef: (target: unknown) => {
            const ref = react.useRef(target);
            ref.current = target;
            return ref;
        },
    };
});
vi.mock('./DirSource', () => ({ default: {} }));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            src: `src:${filePath}`,
            colorNote: null,
            getColorNote: async () => colorNotes.get(filePath) ?? null,
        }),
    },
}));
vi.mock('./domHelpers', () => ({
    notifyElementHighlight: mocks.notifyElementHighlight,
}));

import { FilePathLoadedContext, useFilePaths } from './dirSourceHelpers';

// A folder whose listing a test sets, and whose refresh it fires.
function genDirSource(listing: string[]) {
    const dirSource = {
        listing,
        refreshListeners: [] as Array<() => void>,
        registerEventListener: (_events: string[], listener: () => void) => {
            dirSource.refreshListeners.push(listener);
            return ['refresh'];
        },
        unregisterEventListener: () => {},
        getFilePaths: async () => dirSource.listing,
    };
    return dirSource;
}

type FakeDirSourceType = ReturnType<typeof genDirSource>;

let renders: Array<string[] | null | undefined> = [];

function ProbeComp({ dirSource }: Readonly<{ dirSource: FakeDirSourceType }>) {
    const filePaths = useFilePaths(dirSource as any, ['appDocument'] as any);
    renders.push(filePaths);
    return (
        <span>{filePaths === undefined ? 'loading' : filePaths?.length}</span>
    );
}

function genPaths(prefix: string, count: number) {
    return Array.from({ length: count }, (_, index) => {
        return `/docs/${prefix}-${index}.owa`;
    });
}

let container: HTMLDivElement;
let root: Root;

// The listing, the colour notes and each flash's timer all settle here.
async function settle() {
    await act(async () => {
        await vi.runAllTimersAsync();
    });
}

async function mount(dirSource: FakeDirSourceType) {
    await act(async () => {
        root.render(
            <FilePathLoadedContext value={{ onLoaded: mocks.onLoaded }}>
                <ProbeComp dirSource={dirSource} />
            </FilePathLoadedContext>,
        );
    });
    await settle();
}

async function refresh(dirSource: FakeDirSourceType, listing?: string[]) {
    if (listing !== undefined) {
        dirSource.listing = listing;
    }
    await act(async () => {
        for (const listener of dirSource.refreshListeners) {
            listener();
        }
    });
    await settle();
}

function flashedFilePaths() {
    return mocks.notifyElementHighlight.mock.calls.map(([getElement]) => {
        const element = (getElement as () => Element | null)();
        return element?.getAttribute('data-file-item-file-src') ?? null;
    });
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    renders = [];
    colorNotes.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
    vi.useRealTimers();
});

describe('flashing the files a folder gains', () => {
    test('files appearing in a folder that was empty are not flashed', async () => {
        const dirSource = genDirSource([]);
        await mount(dirSource);
        expect(container.textContent).toBe('0');

        await refresh(dirSource, ['/docs/first.owa']);
        expect(container.textContent).toBe('1');
        expect(mocks.notifyElementHighlight).not.toHaveBeenCalled();
    });

    test('a folder gaining more than twenty at once flashes none of them', async () => {
        const dirSource = genDirSource(['/docs/kept.owa']);
        await mount(dirSource);

        await refresh(dirSource, ['/docs/kept.owa', ...genPaths('copy', 21)]);
        expect(container.textContent).toBe('22');
        expect(mocks.notifyElementHighlight).not.toHaveBeenCalled();
    });

    test('twenty new files are each flashed, and only the last scrolls to its row', async () => {
        const dirSource = genDirSource(['/docs/kept.owa']);
        await mount(dirSource);
        const added = genPaths('new', 20);

        await refresh(dirSource, ['/docs/kept.owa', ...added]);
        const options = mocks.notifyElementHighlight.mock.calls.map(
            ([, option]) => option,
        );
        expect(options).toHaveLength(20);
        expect(options.slice(0, -1)).toEqual(Array(19).fill({}));
        expect(options.at(-1)).toEqual({ revealKey: added.at(-1) });
    });

    test('a flash looks its row up by the file source', async () => {
        const dirSource = genDirSource(['/docs/kept.owa']);
        await mount(dirSource);
        const row = document.createElement('div');
        row.setAttribute('data-file-item-file-src', 'src:/docs/added.owa');
        document.body.appendChild(row);

        await refresh(dirSource, ['/docs/kept.owa', '/docs/added.owa']);
        expect(flashedFilePaths()).toEqual(['src:/docs/added.owa']);
        // A row the windowed list has not drawn yet is simply not found.
        row.remove();
        expect(flashedFilePaths()).toEqual([null]);
    });
});

describe('a refresh of the same folder', () => {
    test('that changes nothing neither re-renders nor reports a load', async () => {
        colorNotes.set('/docs/a.owa', 'red');
        const dirSource = genDirSource(['/docs/a.owa', '/docs/b.owa']);
        await mount(dirSource);
        expect(mocks.onLoaded).toHaveBeenCalledOnce();
        const rendersBefore = renders.length;

        await refresh(dirSource, ['/docs/a.owa', '/docs/b.owa']);
        expect(renders).toHaveLength(rendersBefore);
        expect(mocks.onLoaded).toHaveBeenCalledOnce();
    });

    test('that only changes a colour note still reports the load', async () => {
        const dirSource = genDirSource(['/docs/a.owa', '/docs/b.owa']);
        await mount(dirSource);

        colorNotes.set('/docs/b.owa', 'blue');
        await refresh(dirSource);
        expect(mocks.onLoaded).toHaveBeenCalledTimes(2);
        expect(mocks.onLoaded).toHaveBeenLastCalledWith([
            '/docs/a.owa',
            '/docs/b.owa',
        ]);
        expect(mocks.notifyElementHighlight).not.toHaveBeenCalled();
    });
});
