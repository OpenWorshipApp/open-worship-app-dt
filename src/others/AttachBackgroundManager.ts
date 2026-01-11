import { dirSourceSettingNames } from '../helper/constants';
import { DragTypeEnum, DroppedDataType } from '../helper/DragInf';
import FileSource from '../helper/FileSource';
import {
    fsCheckFileExist,
    fsDeleteFile,
    fsWriteFile,
} from '../server/fileHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { BaseDirFileSource } from '../setting/directory-setting/directoryHelpers';
import CacheManager from './CacheManager';

export type AttachBackgroundType = { [key: string]: DroppedDataType };

const cached = new CacheManager<AttachBackgroundType | null>(5);
export default class AttachBackgroundManager {
    static genMetaDataFilePath(filePath: string) {
        return `${filePath}.bg.json`;
    }

    getBaseDirSettingName(droppedData: DroppedDataType) {
        if (droppedData.type === DragTypeEnum.BACKGROUND_IMAGE) {
            return dirSourceSettingNames.BACKGROUND_IMAGE;
        } else if (droppedData.type === DragTypeEnum.BACKGROUND_VIDEO) {
            return dirSourceSettingNames.BACKGROUND_VIDEO;
        } else if (droppedData.type === DragTypeEnum.BACKGROUND_WEB) {
            return dirSourceSettingNames.BACKGROUND_WEB;
        }
        throw new Error(`Unsupported dropped data type: ${droppedData.type}`);
    }

    async saveData(filePath: string, data: AttachBackgroundType) {
        const metaDataFilePath =
            AttachBackgroundManager.genMetaDataFilePath(filePath);
        const newData = Object.fromEntries(
            Object.entries(data)
                .map(([key, value]) => {
                    if (
                        [
                            DragTypeEnum.BACKGROUND_COLOR,
                            DragTypeEnum.BACKGROUND_CAMERA,
                        ].includes(value.type)
                    ) {
                        return [key, value];
                    }
                    const fileSource = value.item as FileSource;
                    const baseDirSettingName =
                        this.getBaseDirSettingName(value);
                    const baseDirFileSource = new BaseDirFileSource(
                        baseDirSettingName,
                        fileSource.filePath,
                    );
                    const { fileFullNameOrFilePath } = baseDirFileSource;
                    if (fileFullNameOrFilePath === null) {
                        return [key, null];
                    }
                    return [
                        key,
                        {
                            ...value,
                            item: fileFullNameOrFilePath,
                        },
                    ];
                })
                .filter(([_, value]) => {
                    return value !== null;
                }),
        );
        await FileSource.getInstance(metaDataFilePath).writeFileData(
            JSON.stringify(newData),
        );
        FileSource.getInstance(metaDataFilePath).fireUpdateEvent();
    }

    public async readData(filePath: string): Promise<AttachBackgroundType> {
        const metaDataFilePath =
            AttachBackgroundManager.genMetaDataFilePath(filePath);
        const fileSource = FileSource.getInstance(metaDataFilePath);
        if (!(await fsCheckFileExist(metaDataFilePath))) {
            await fsWriteFile(metaDataFilePath, JSON.stringify({}));
        }
        const data = await fileSource.readFileJsonData();
        if (data === null) {
            return {};
        }
        const newData = Object.fromEntries(
            Object.entries(data)
                .map(([key, value]) => {
                    if (
                        [
                            DragTypeEnum.BACKGROUND_COLOR,
                            DragTypeEnum.BACKGROUND_CAMERA,
                        ].includes(value.type)
                    ) {
                        return [key, value];
                    }
                    const baseDirFileSource = new BaseDirFileSource(
                        this.getBaseDirSettingName(value),
                        value.item,
                    );
                    const fileSource = baseDirFileSource.fileSource;
                    if (fileSource === null) {
                        return [key, null];
                    }
                    return [
                        key,
                        {
                            ...value,
                            item: fileSource,
                        },
                    ];
                })
                .filter(([_, value]) => {
                    return value !== null;
                }),
        );
        return newData;
    }

    toKey(id?: string | number): string {
        if (typeof id === 'number') {
            return id.toString();
        }
        return id ?? 'self';
    }

    toLockingKey(filePath: string): string {
        return `attached-background-${filePath}`;
    }

    public async getAttachedBackground(
        filePath: string,
        id?: string | number,
    ): Promise<DroppedDataType | null> {
        return await unlocking(this.toLockingKey(filePath), async () => {
            const cachedData = await cached.get(filePath);
            const data = cachedData ?? (await this.readData(filePath));
            const attachedData = data[this.toKey(id)] ?? null;
            return attachedData;
        });
    }

    public async attachDroppedBackground(
        droppedData: DroppedDataType,
        filePath: string,
        id?: string | number,
    ) {
        await unlocking(this.toLockingKey(filePath), async () => {
            const data = await this.readData(filePath);
            data[this.toKey(id)] = droppedData;
            await cached.set(filePath, data);
            await this.saveData(filePath, data);
        });
    }

    public async detachBackground(filePath: string, id?: string | number) {
        await unlocking(this.toLockingKey(filePath), async () => {
            const data = await this.readData(filePath);
            delete data[this.toKey(id)];
            await cached.set(filePath, data);
            await this.saveData(filePath, data);
        });
    }

    public async deleteMetaDataFile(filePath: string) {
        await unlocking(this.toLockingKey(filePath), async () => {
            const metaDataFilePath =
                AttachBackgroundManager.genMetaDataFilePath(filePath);
            await cached.set(filePath, null);
            await fsDeleteFile(metaDataFilePath);
            FileSource.getInstance(metaDataFilePath).fireUpdateEvent();
        });
    }
}

export const attachBackgroundManager = new AttachBackgroundManager();
