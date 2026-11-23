import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    files: new Map<string, string>(),
    writes: [] as Array<[string, string]>,
    forgotten: [] as string[],
    lockKeys: [] as string[],
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            readFileJsonData: async () => {
                const text = h.files.get(filePath);
                if (text === undefined) {
                    return null;
                }
                try {
                    return JSON.parse(text);
                } catch (_error) {
                    return null;
                }
            },
            writeFileData: async (data: string) => {
                h.writes.push([filePath, data]);
                h.files.set(filePath, data);
                return true;
            },
        }),
        forgetCachedData: (filePath: string) => {
            h.forgotten.push(filePath);
        },
    },
}));
vi.mock('./fileHelpers', () => ({
    fsCheckFileExist: async (filePath: string) => h.files.has(filePath),
    fsDeleteFile: async (filePath: string) => {
        h.files.delete(filePath);
    },
}));
vi.mock('./unlockingHelpers', () => ({
    unlocking: async (key: string, callback: () => unknown) => {
        h.lockKeys.push(key);
        return await callback();
    },
}));

import {
    getPptxOmitBackground,
    PPTX_BUILD_META_DOT_EXTENSION,
    setPptxOmitBackground,
} from './pptxBuildOptionHelpers';

const DECK = '/documents/deck.pptx';
const SIDECAR = '/documents/deck.pptx.build.json';

describe('a PowerPoint file own build choices', () => {
    beforeEach(() => {
        h.files.clear();
        h.writes = [];
        h.forgotten = [];
        h.lockKeys = [];
    });

    test('the sidecar sits beside the deck', () => {
        expect(`${DECK}${PPTX_BUILD_META_DOT_EXTENSION}`).toBe(SIDECAR);
    });

    test('a deck nobody touched leaves its background out, and reading creates nothing', async () => {
        await expect(getPptxOmitBackground(DECK)).resolves.toBe(true);
        expect(h.files.has(SIDECAR)).toBe(false);
    });

    test('a sidecar that cannot be read is the default', async () => {
        h.files.set(SIDECAR, '{not json');
        await expect(getPptxOmitBackground(DECK)).resolves.toBe(true);
    });

    test('unticked is written, and read back', async () => {
        await setPptxOmitBackground(DECK, false);

        expect(h.writes).toEqual([
            [SIDECAR, JSON.stringify({ omitBackground: false })],
        ]);
        expect(h.lockKeys).toEqual([`pptx-build-${DECK}`]);
        await expect(getPptxOmitBackground(DECK)).resolves.toBe(false);
    });

    test('ticked again removes the sidecar instead of writing the default', async () => {
        await setPptxOmitBackground(DECK, false);
        h.writes = [];

        await setPptxOmitBackground(DECK, true);

        expect(h.writes).toEqual([]);
        expect(h.files.has(SIDECAR)).toBe(false);
        expect(h.forgotten).toEqual([SIDECAR]);
        await expect(getPptxOmitBackground(DECK)).resolves.toBe(true);
    });

    test('ticking a deck that has no sidecar writes nothing', async () => {
        await setPptxOmitBackground(DECK, true);
        expect(h.writes).toEqual([]);
        expect(h.files.size).toBe(0);
    });
});
