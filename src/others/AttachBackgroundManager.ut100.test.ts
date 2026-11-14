import { beforeEach, describe, expect, test, vi } from 'vitest';

// Many backgrounds of one file set (or taken off) in ONE read and ONE
// write, and a cached map forgotten when another writer changed the file.
// The same mock surface as `AttachBackgroundManager.test.ts`, with the cache
// able to forget.
const h = vi.hoisted(() => {
    const jsonDataMap: Record<string, any> = {};
    const fileSourceInstances = new Map<string, any>();
    const getMockFileSource = (filePath: string) => {
        const existing = fileSourceInstances.get(filePath);
        if (existing) {
            return existing;
        }
        const instance = {
            filePath,
            readFileJsonData: vi.fn(),
            writeFileData: vi.fn(),
            fireUpdateEvent: vi.fn(),
        };
        fileSourceInstances.set(filePath, instance);
        return instance;
    };
    return {
        jsonDataMap,
        fileSourceInstances,
        getMockFileSource,
        lockKeyList: [] as string[],
    };
});

vi.mock('../helper/FileSource', () => ({
    default: { getInstance: h.getMockFileSource },
}));
vi.mock('../background/backgroundWebUrlHelpers', () => ({
    BackgroundWebUrlSource: class {},
    isBackgroundWebUrlItemData: () => false,
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (filePath: string) => {
        return Object.hasOwn(h.jsonDataMap, filePath);
    },
    fsDeleteFile: async () => {},
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (key: string, callback: () => Promise<unknown>) => {
        h.lockKeyList.push(key);
        return await callback();
    },
}));
vi.mock('../setting/directory-setting/directoryHelpers', () => ({
    BaseDirFileSource: class {},
}));
vi.mock('./CacheManager', () => ({
    default: class CacheManagerMock<T> {
        private readonly store = new Map<string, T>();

        getSync(key: string) {
            return this.store.get(key) ?? null;
        }

        async has(key: string) {
            return this.store.has(key);
        }

        async get(key: string) {
            return this.store.get(key) ?? null;
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
        }

        async delete(key: string) {
            this.store.delete(key);
        }
    },
}));

import { DragTypeEnum } from '../helper/DragInf';
import AttachBackgroundManager from './AttachBackgroundManager';

const red = { type: DragTypeEnum.BACKGROUND_COLOR, item: '#ff0000' } as any;
const blue = { type: DragTypeEnum.BACKGROUND_COLOR, item: '#0000ff' } as any;

function genMeta(filePath: string) {
    return AttachBackgroundManager.genMetaDataFilePath(filePath);
}

function readWritten(filePath: string) {
    const writeFileData = h.getMockFileSource(genMeta(filePath)).writeFileData;
    expect(writeFileData).toHaveBeenCalledTimes(1);
    return JSON.parse(writeFileData.mock.calls[0][0]);
}

beforeEach(() => {
    for (const key of Object.keys(h.jsonDataMap)) {
        delete h.jsonDataMap[key];
    }
    h.fileSourceInstances.clear();
    h.lockKeyList = [];
});

function seedMeta(filePath: string, data: Record<string, unknown>) {
    const metaPath = genMeta(filePath);
    h.jsonDataMap[metaPath] = data;
    h.getMockFileSource(metaPath).readFileJsonData.mockResolvedValue(data);
}

describe('setAttachedBackgrounds', () => {
    test('puts one background behind many slides in one read and one write', async () => {
        const manager = new AttachBackgroundManager();
        const filePath = '/docs/many.ows';
        seedMeta(filePath, { 9: blue });

        await manager.setAttachedBackgrounds(
            filePath,
            [1, '2', undefined],
            red,
        );

        expect(readWritten(filePath)).toEqual({
            9: blue,
            1: red,
            2: red,
            self: red,
        });
        expect(h.lockKeyList).toEqual([`attached-background-${filePath}`]);
        // The rows read it from the cache at once.
        expect(manager.getAttachedBackgroundSync(filePath, 1)).toEqual(red);
        expect(manager.getAttachedBackgroundSync(filePath)).toEqual(red);
        expect(
            h.getMockFileSource(genMeta(filePath)).fireUpdateEvent,
        ).toHaveBeenCalledOnce();
    });

    test('with null takes them off, leaving the rest', async () => {
        const manager = new AttachBackgroundManager();
        const filePath = '/docs/off.ows';
        seedMeta(filePath, { 1: red, 2: red, 3: blue });

        await manager.setAttachedBackgrounds(filePath, [1, 2], null);

        expect(readWritten(filePath)).toEqual({ 3: blue });
        expect(manager.getAttachedBackgroundSync(filePath, 1)).toBeNull();
        expect(manager.getAttachedBackgroundSync(filePath, 3)).toEqual(blue);
    });
});

describe('forgetCachedData', () => {
    test('drops the cached map under the file’s lock and tells the rows to read again', async () => {
        const manager = new AttachBackgroundManager();
        const filePath = '/docs/undone.ows';
        await manager.attachDroppedBackground(red, filePath, 4);
        expect(manager.getAttachedBackgroundSync(filePath, 4)).toEqual(red);
        const metaSource = h.getMockFileSource(genMeta(filePath));
        metaSource.fireUpdateEvent.mockClear();
        h.lockKeyList = [];

        await manager.forgetCachedData(filePath);

        expect(h.lockKeyList).toEqual([`attached-background-${filePath}`]);
        // Nothing cached: the sync read has no answer, the async one reads.
        expect(manager.getAttachedBackgroundSync(filePath, 4)).toBeUndefined();
        expect(metaSource.fireUpdateEvent).toHaveBeenCalledOnce();
        seedMeta(filePath, { 4: blue });
        expect(await manager.getAttachedBackground(filePath, 4)).toEqual(blue);
    });
});
