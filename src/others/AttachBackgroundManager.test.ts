import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    jsonDataMap,
    fsCheckFileExistMock,
    fsDeleteFileMock,
    fsWriteFileMock,
    unlockingMock,
    fileSourceInstances,
    getMockFileSource,
    baseDirFileFullNameOrPathMap,
    baseDirResolvedFilePathMap,
} = vi.hoisted(() => {
    const jsonDataMap: Record<string, any> = {};
    const fileSourceInstances = new Map<string, any>();
    const getMockFileSource = (filePath: string) => {
        const existing = fileSourceInstances.get(filePath);
        if (existing) {
            return existing;
        }
        const instance = {
            filePath,
            src: `src:${filePath}`,
            fullName: filePath.split('/').pop() ?? filePath,
            readFileJsonData: vi.fn(async () => jsonDataMap[filePath] ?? null),
            writeFileData: vi.fn(async (_data: string) => {}),
            fireUpdateEvent: vi.fn(),
        };
        fileSourceInstances.set(filePath, instance);
        return instance;
    };
    return {
        jsonDataMap,
        fsCheckFileExistMock: vi.fn(async () => true),
        fsDeleteFileMock: vi.fn(async () => {}),
        fsWriteFileMock: vi.fn(async () => {}),
        unlockingMock: vi.fn(
            async (_key: string, callback: () => Promise<unknown>) => {
                return await callback();
            },
        ),
        fileSourceInstances,
        getMockFileSource,
        baseDirFileFullNameOrPathMap: {} as Record<
            string,
            string | null | undefined
        >,
        baseDirResolvedFilePathMap: {} as Record<
            string,
            string | null | undefined
        >,
    };
});

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: getMockFileSource,
    },
}));

vi.mock('../background/backgroundWebUrlHelpers', () => ({
    BackgroundWebUrlSource: class BackgroundWebUrlSourceMock {
        readonly id: string;
        readonly src: string;
        readonly isUrl = true as const;

        constructor(data: { id: string; src: string; isUrl: true }) {
            this.id = data.id;
            this.src = data.src;
        }

        toData() {
            return {
                id: this.id,
                src: this.src,
                isUrl: true,
            };
        }
    },
    isBackgroundWebUrlItemData: (value: unknown) => {
        return (
            typeof value === 'object' &&
            value !== null &&
            'id' in value &&
            'src' in value &&
            'isUrl' in value
        );
    },
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: fsCheckFileExistMock,
    fsDeleteFile: fsDeleteFileMock,
    fsWriteFile: fsWriteFileMock,
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: unlockingMock,
}));

vi.mock('../setting/directory-setting/directoryHelpers', () => ({
    BaseDirFileSource: class BaseDirFileSourceMock {
        private readonly settingName: string;
        private readonly fileFullNameOrFilePathValue: string;

        constructor(settingName: string, fileFullNameOrFilePath: string) {
            this.settingName = settingName;
            this.fileFullNameOrFilePathValue = fileFullNameOrFilePath;
        }

        get fileFullNameOrFilePath() {
            const key = `${this.settingName}|${this.fileFullNameOrFilePathValue}`;
            return baseDirFileFullNameOrPathMap[key];
        }

        get fileSource() {
            const key = `${this.settingName}|${this.fileFullNameOrFilePathValue}`;
            const resolved = baseDirResolvedFilePathMap[key];
            if (resolved === null) {
                return null;
            }
            if (resolved !== undefined) {
                return getMockFileSource(resolved);
            }
            return getMockFileSource(this.fileFullNameOrFilePathValue);
        }
    },
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
    },
}));

import { DragTypeEnum } from '../helper/DragInf';
import AttachBackgroundManager from './AttachBackgroundManager';
import { BackgroundWebUrlSource } from '../background/backgroundWebUrlHelpers';

describe('AttachBackgroundManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const key of Object.keys(jsonDataMap)) {
            delete jsonDataMap[key];
        }
        for (const key of Object.keys(baseDirFileFullNameOrPathMap)) {
            delete baseDirFileFullNameOrPathMap[key];
        }
        for (const key of Object.keys(baseDirResolvedFilePathMap)) {
            delete baseDirResolvedFilePathMap[key];
        }
        fileSourceInstances.clear();
        fsCheckFileExistMock.mockResolvedValue(true);
    });

    test('serializes supported background items and filters unresolved file entries', async () => {
        const manager = new AttachBackgroundManager();
        const filePath = '/docs/song.txt';
        const metaPath = AttachBackgroundManager.genMetaDataFilePath(filePath);
        const imageSource = getMockFileSource('/files/image.png');
        const missingVideoSource = getMockFileSource('/files/video.mp4');
        baseDirFileFullNameOrPathMap['select-dir-image-bg|/files/image.png'] =
            'image.png';
        baseDirFileFullNameOrPathMap['select-dir-video-bg|/files/video.mp4'] =
            null;

        await manager.saveData(filePath, {
            color: {
                type: DragTypeEnum.BACKGROUND_COLOR,
                item: '#fff000',
            },
            camera: {
                type: DragTypeEnum.BACKGROUND_CAMERA,
                item: { src: 'camera:0' },
            },
            web: {
                type: DragTypeEnum.BACKGROUND_WEB,
                item: new BackgroundWebUrlSource({
                    id: 'web-1',
                    src: 'https://example.com',
                    isUrl: true,
                }),
            },
            image: {
                type: DragTypeEnum.BACKGROUND_IMAGE,
                item: imageSource,
            },
            video: {
                type: DragTypeEnum.BACKGROUND_VIDEO,
                item: missingVideoSource,
            },
        });

        expect(getMockFileSource(metaPath).writeFileData).toHaveBeenCalledWith(
            JSON.stringify({
                color: {
                    type: DragTypeEnum.BACKGROUND_COLOR,
                    item: '#fff000',
                },
                camera: {
                    type: DragTypeEnum.BACKGROUND_CAMERA,
                    item: { src: 'camera:0' },
                },
                web: {
                    type: DragTypeEnum.BACKGROUND_WEB,
                    item: {
                        id: 'web-1',
                        src: 'https://example.com',
                        isUrl: true,
                    },
                },
                image: {
                    type: DragTypeEnum.BACKGROUND_IMAGE,
                    item: 'image.png',
                },
            }),
        );
        expect(
            getMockFileSource(metaPath).fireUpdateEvent,
        ).toHaveBeenCalledTimes(1);
    });

    test('reads metadata, initializes missing files, and deserializes entries', async () => {
        const manager = new AttachBackgroundManager();
        const filePath = '/docs/read.txt';
        const metaPath = AttachBackgroundManager.genMetaDataFilePath(filePath);
        fsCheckFileExistMock.mockResolvedValue(false);
        jsonDataMap[metaPath] = {
            color: {
                type: DragTypeEnum.BACKGROUND_COLOR,
                item: '#000000',
            },
            camera: {
                type: DragTypeEnum.BACKGROUND_CAMERA,
                item: { src: 'camera:1' },
            },
            web: {
                type: DragTypeEnum.BACKGROUND_WEB,
                item: {
                    id: 'web-2',
                    src: 'https://open.worship',
                    isUrl: true,
                },
            },
            image: {
                type: DragTypeEnum.BACKGROUND_IMAGE,
                item: 'cover.png',
            },
            invalid: {
                type: DragTypeEnum.BACKGROUND_VIDEO,
                item: 123,
            },
        };
        baseDirResolvedFilePathMap['select-dir-image-bg|cover.png'] =
            '/resolved/cover.png';

        const data = await manager.readData(filePath);

        expect(fsWriteFileMock).toHaveBeenCalledWith(
            metaPath,
            JSON.stringify({}),
        );
        expect(data.color).toEqual({
            type: DragTypeEnum.BACKGROUND_COLOR,
            item: '#000000',
        });
        expect(data.camera).toEqual({
            type: DragTypeEnum.BACKGROUND_CAMERA,
            item: { src: 'camera:1' },
        });
        expect((data.web.item as BackgroundWebUrlSource).toData()).toEqual({
            id: 'web-2',
            src: 'https://open.worship',
            isUrl: true,
        });
        expect(data.image.item.filePath).toBe('/resolved/cover.png');
        expect('invalid' in data).toBe(false);
    });

    test('caches attachment lookups and updates attached background data', async () => {
        const manager = new AttachBackgroundManager();
        const filePath = '/docs/cache.txt';
        const droppedData = {
            type: DragTypeEnum.BACKGROUND_COLOR,
            item: '#112233',
        };
        const readSpy = vi.spyOn(manager, 'readData').mockResolvedValue({});
        const saveSpy = vi.spyOn(manager, 'saveData').mockResolvedValue();

        await manager.attachDroppedBackground(droppedData, filePath, 2);

        expect(saveSpy).toHaveBeenCalledWith(filePath, {
            '2': droppedData,
        });
        expect(manager.getAttachedBackgroundSync(filePath, 2)).toEqual(
            droppedData,
        );

        readSpy.mockClear();
        expect(await manager.getAttachedBackground(filePath, 2)).toEqual(
            droppedData,
        );
        expect(readSpy).not.toHaveBeenCalled();

        await manager.detachBackground(filePath, 2);

        expect(saveSpy).toHaveBeenLastCalledWith(filePath, {});
        expect(await manager.getAttachedBackground(filePath, 2)).toBeNull();
    });

    test('deletes metadata files and clears cached attachments', async () => {
        const manager = new AttachBackgroundManager();
        const filePath = '/docs/delete.txt';
        const metaPath = AttachBackgroundManager.genMetaDataFilePath(filePath);
        vi.spyOn(manager, 'readData').mockResolvedValue({});
        vi.spyOn(manager, 'saveData').mockResolvedValue();

        await manager.attachDroppedBackground(
            {
                type: DragTypeEnum.BACKGROUND_COLOR,
                item: '#abcdef',
            },
            filePath,
        );
        await manager.deleteMetaDataFile(filePath);

        expect(fsDeleteFileMock).toHaveBeenCalledWith(metaPath);
        expect(
            getMockFileSource(metaPath).fireUpdateEvent,
        ).toHaveBeenCalledTimes(1);
        expect(await manager.getAttachedBackground(filePath)).toBeNull();
    });

    test('maps keys and rejects unsupported background types', () => {
        const manager = new AttachBackgroundManager();

        expect(manager.toKey()).toBe('self');
        expect(manager.toKey(5)).toBe('5');
        expect(manager.toKey('cover')).toBe('cover');
        expect(manager.toLockingKey('/docs/a.txt')).toBe(
            'attached-background-/docs/a.txt',
        );
        expect(() => {
            manager.getBaseDirSettingName({
                type: DragTypeEnum.SLIDE,
                item: null,
            } as any);
        }).toThrow('Unsupported dropped data type: slide');
    });
});
