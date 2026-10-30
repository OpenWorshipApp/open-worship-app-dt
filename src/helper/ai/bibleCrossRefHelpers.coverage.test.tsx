// @vitest-environment jsdom

import { act, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The hooks over `getBibleCrossRef`, which `bibleCrossRefHelpers.test.ts`
// stubs away: the same disk and schema stand-ins, with the effects real.
const h = vi.hoisted(() => ({
    files: new Map<string, string>(),
    directories: new Set<string>(),
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: async (path: string) => h.directories.has(path),
    fsCheckFileExist: async (path: string) => h.files.has(path),
    fsDeleteFile: async (path: string) => {
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
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => Promise<unknown>) =>
        await callback(),
}));
vi.mock('../appHooks', async () => {
    const { useEffect } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppEffectAsync: (
            effect: (methods: Record<string, unknown>) => Promise<void>,
            deps: unknown[],
            methods: Record<string, unknown>,
        ) => {
            useEffect(() => {
                void effect({ ...methods });
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
                verses: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'verses'],
        },
    },
}));
vi.mock('../errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../bible-helpers/bibleLogicHelpers1', () => ({
    getModelKeyBookMap: () => ({ GEN: 'Genesis', JHN: 'John' }),
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
vi.mock('../loggerHelpers', () => ({ appError: vi.fn() }));

import type { RefreshingRefType } from './aiHelpers';
import {
    BibleKeyContext,
    defaultRefreshingRef,
    useBibleKeyContext,
    useGenRefreshRef,
    useGetBibleCrossRef,
    type CrossReferenceType,
} from './bibleCrossRefHelpers';

const PARAMS = { bookKey: 'GEN', chapter: 1, verseNum: 1, dataDir: 'ai' };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.files.clear();
    h.directories.clear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('useGetBibleCrossRef', () => {
    test('loads the verse’s references as book keys, and refresh asks again', async () => {
        const answers: CrossReferenceType[][] = [
            [{ title: 'Creation', verses: ['John 1:1', 'Nowhere 1:1'] }],
            [{ title: 'Word', verses: ['John 1:3'] }],
        ];
        const getCrossRefs = vi.fn(async () => answers.shift() ?? null);
        const seen: ReturnType<typeof useGetBibleCrossRef>[] = [];
        function ProbeComp() {
            seen.push(useGetBibleCrossRef(PARAMS, getCrossRefs));
            return null;
        }
        await act(async () => root.render(<ProbeComp />));
        expect(seen[0].bibleCrossRef).toBeUndefined();
        expect(getCrossRefs).toHaveBeenCalledWith('Genesis 1:1');
        expect(seen.at(-1)?.bibleCrossRef).toEqual([
            { title: 'Creation', verses: ['JHN 1:1'] },
        ]);

        await act(async () => {
            seen.at(-1)?.refresh();
        });
        // A forced refresh deletes the cached answer and asks the provider.
        expect(getCrossRefs).toHaveBeenCalledTimes(2);
        expect(seen.some((one) => one.bibleCrossRef === undefined)).toBe(true);
        expect(seen.at(-1)?.bibleCrossRef).toEqual([
            { title: 'Word', verses: ['JHN 1:3'] },
        ]);
    });

    test('an answer that is not a list of references is null', async () => {
        const getCrossRefs = vi.fn(async () => null);
        const seen: ReturnType<typeof useGetBibleCrossRef>[] = [];
        function ProbeComp() {
            seen.push(useGetBibleCrossRef(PARAMS, getCrossRefs));
            return null;
        }
        await act(async () => root.render(<ProbeComp />));
        expect(seen.at(-1)?.bibleCrossRef).toBeNull();
    });
});

describe('useGenRefreshRef', () => {
    test('hands its refresh to the ref while mounted, and takes it back', async () => {
        const ref: RefObject<RefreshingRefType> = {
            current: defaultRefreshingRef,
        };
        const refresh = vi.fn();
        function ProbeComp() {
            useGenRefreshRef(ref, refresh);
            return null;
        }
        await act(async () => root.render(<ProbeComp />));
        ref.current.refresh();
        expect(refresh).toHaveBeenCalledTimes(1);

        await act(async () => root.unmount());
        expect(ref.current).toBe(defaultRefreshingRef);
        root = createRoot(host);
    });
});

describe('useBibleKeyContext', () => {
    test('is the KJV until a provider names a Bible', async () => {
        const seen: string[] = [];
        function ProbeComp() {
            seen.push(useBibleKeyContext());
            return null;
        }
        await act(async () => root.render(<ProbeComp />));
        expect(seen.at(-1)).toBe('KJV');

        await act(async () =>
            root.render(
                <BibleKeyContext value="ពគប">
                    <ProbeComp />
                </BibleKeyContext>,
            ),
        );
        expect(seen.at(-1)).toBe('ពគប');
    });
});
