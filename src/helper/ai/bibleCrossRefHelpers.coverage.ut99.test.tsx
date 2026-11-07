// @vitest-environment jsdom

import { act, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    files: new Map<string, string>(),
    directories: new Set<string>(),
    deleted: [] as string[],
    toast: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: async (path: string) => h.directories.has(path),
    fsCheckFileExist: async (path: string) => h.files.has(path),
    fsDeleteFile: async (path: string) => {
        h.deleted.push(path);
        h.files.delete(path);
    },
    fsMkDirSync: (path: string) => {
        h.directories.add(path);
    },
    fsReadFile: async (path: string) => h.files.get(path),
    fsWriteFile: async (path: string, text: string) => {
        h.files.set(path, text);
    },
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../../setting/directory-setting/directoryHelpers', () => ({
    ensureDataDirectory: async () => '/data',
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => Promise<unknown>) => {
        return await callback();
    },
}));
// The real hooks' shape on plain React, so the hooks under test run.
vi.mock('../appHooks', async () => {
    const { useEffect } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppEffectAsync: (
            effectMethod: (context: any) => Promise<void>,
            deps: unknown[],
            methods?: Record<string, unknown>,
        ) => {
            useEffect(() => {
                void effectMethod({ ...methods });
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
        },
    };
});
vi.mock('./aiHelpers', () => ({
    bibleCrossRefSchemaJson: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                titleEn: { type: 'string' },
                verses: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'verses'],
            additionalProperties: false,
        },
    },
}));
vi.mock('../errorHelpers', () => ({ handleError: h.error }));
vi.mock('../bible-helpers/bibleLogicHelpers1', () => ({
    getModelKeyBookMap: () => ({ GEN: 'Genesis', EXO: 'Exodus' }),
}));
vi.mock('../helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
}));
vi.mock('../bible-helpers/bibleInfoHelpers', () => ({
    toVerseFullKeyFormat: (book: string, chapter: number, verse: number) =>
        `${book} ${chapter}:${verse}`,
}));
vi.mock('../bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
    getBibleModelInfoSetting: () => 'model-v1',
}));
vi.mock('../loggerHelpers', () => ({ appError: h.logError }));

import {
    BibleKeyContext,
    defaultRefreshingRef,
    useBibleKeyContext,
    useGenRefreshRef,
    useGetBibleCrossRef,
} from './bibleCrossRefHelpers';
import type { RefreshingRefType } from './aiHelpers';

const PARAMS = { bookKey: 'GEN', chapter: 1, verseNum: 1, dataDir: 'ai' };
const FILE_PATH = '/data/bible-cross-refs/Genesis 1_1.json';
const getCrossRefs = vi.fn();

let container: HTMLDivElement;
let root: Root;

function CrossRefProbeComp() {
    const { bibleCrossRef, refresh } = useGetBibleCrossRef(
        PARAMS,
        getCrossRefs,
    );
    return (
        <div>
            <output>
                {bibleCrossRef === undefined
                    ? 'loading'
                    : JSON.stringify(bibleCrossRef)}
            </output>
            <button type="button" onClick={refresh}>
                Refresh
            </button>
        </div>
    );
}

function readOutput() {
    return container.querySelector('output')!.textContent;
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.files.clear();
    h.directories.clear();
    h.deleted.length = 0;
    getCrossRefs.mockResolvedValue([
        {
            title: 'Creation',
            verses: ['Genesis 1:1', 'Exodus 20:11', 'Unknown 1:1', 'Genesis'],
        },
    ]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('useGetBibleCrossRef', () => {
    test('reads the verse once mounted and hands back book keys', async () => {
        await act(async () => {
            root.render(<CrossRefProbeComp />);
        });
        await flush();
        expect(getCrossRefs).toHaveBeenCalledWith('Genesis 1:1');
        expect(JSON.parse(readOutput()!)).toEqual([
            { title: 'Creation', verses: ['GEN 1:1', 'EXO 20:11'] },
        ]);
        // What the provider said is kept as it said it, for the next mount.
        expect(JSON.parse(h.files.get(FILE_PATH)!).value).toEqual([
            {
                title: 'Creation',
                verses: [
                    'Genesis 1:1',
                    'Exodus 20:11',
                    'Unknown 1:1',
                    'Genesis',
                ],
            },
        ]);
    });

    test('a second mount reads the cache and asks nobody', async () => {
        await act(async () => {
            root.render(<CrossRefProbeComp />);
        });
        await flush();
        act(() => {
            root.unmount();
        });
        root = createRoot(container);
        await act(async () => {
            root.render(<CrossRefProbeComp />);
        });
        await flush();
        expect(getCrossRefs).toHaveBeenCalledTimes(1);
        expect(JSON.parse(readOutput()!)[0].verses).toEqual([
            'GEN 1:1',
            'EXO 20:11',
        ]);
    });

    test('refresh shows the wait, then asks again past the cache', async () => {
        await act(async () => {
            root.render(<CrossRefProbeComp />);
        });
        await flush();
        getCrossRefs.mockResolvedValue([
            { title: 'Light', verses: ['Genesis 1:3'] },
        ]);
        act(() => {
            container.querySelector('button')!.click();
        });
        expect(readOutput()).toBe('loading');
        await flush();
        expect(getCrossRefs).toHaveBeenCalledTimes(2);
        expect(h.deleted).toEqual([FILE_PATH]);
        expect(JSON.parse(readOutput()!)).toEqual([
            { title: 'Light', verses: ['GEN 1:3'] },
        ]);
    });

    test('an answer that is not a reference list reads as none', async () => {
        getCrossRefs.mockResolvedValue([{ title: 'Bad', verses: [4] }]);
        await act(async () => {
            root.render(<CrossRefProbeComp />);
        });
        await flush();
        expect(readOutput()).toBe('null');
        expect(h.error).toHaveBeenCalledTimes(1);
        expect(h.files.has(FILE_PATH)).toBe(false);
    });
});

describe('useGenRefreshRef', () => {
    function RefProbeComp({
        refreshRef,
        refresh,
    }: Readonly<{
        refreshRef: RefObject<RefreshingRefType>;
        refresh: () => void;
    }>) {
        useGenRefreshRef(refreshRef, refresh);
        return null;
    }

    test('points the ref at the latest refresh and lets go of it on unmount', async () => {
        const refreshRef = { current: defaultRefreshingRef };
        const first = vi.fn();
        const second = vi.fn();
        await act(async () => {
            root.render(
                <RefProbeComp refreshRef={refreshRef} refresh={first} />,
            );
        });
        refreshRef.current.refresh();
        expect(first).toHaveBeenCalledTimes(1);

        await act(async () => {
            root.render(
                <RefProbeComp refreshRef={refreshRef} refresh={second} />,
            );
        });
        refreshRef.current.refresh();
        expect(second).toHaveBeenCalledTimes(1);
        expect(first).toHaveBeenCalledTimes(1);

        act(() => {
            root.unmount();
        });
        expect(refreshRef.current).toBe(defaultRefreshingRef);
        root = createRoot(container);
    });
});

describe('useBibleKeyContext', () => {
    function KeyProbeComp() {
        return <output>{useBibleKeyContext()}</output>;
    }

    test('is KJV with no provider, and the provided Bible inside one', async () => {
        await act(async () => {
            root.render(
                <div>
                    <KeyProbeComp />
                    <BibleKeyContext.Provider value="KHMER">
                        <KeyProbeComp />
                    </BibleKeyContext.Provider>
                </div>,
            );
        });
        expect(
            [...container.querySelectorAll('output')].map((one) => {
                return one.textContent;
            }),
        ).toEqual(['KJV', 'KHMER']);
    });
});
