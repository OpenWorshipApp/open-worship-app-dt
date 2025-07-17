import DirSource from './DirSource';
import {
    checkIsAppFile,
    getFileDotExtension,
    fsCheckFileExist,
    fsCreateFile,
    fsReadFile,
    fsRenameFile,
    fsWriteFile,
    getFileMetaData,
    pathBasename,
    pathJoin,
    pathSeparator,
    getFileName,
} from '../server/fileHelpers';
import { isValidJson } from './helpers';
import { pathToFileURL } from '../server/helpers';
import EventHandler from '../event/EventHandler';
import appProvider from '../server/appProvider';
import DragInf, { DragTypeEnum } from './DragInf';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from './errorHelpers';
import FileSourceMetaManager from './FileSourceMetaManager';
import ColorNoteInf from './ColorNoteInf';
import { electronSendAsync } from '../server/appHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { AnyObjectType } from './typeHelpers';

export type SrcData = `data:${string}`;

export type FileSourceEventType = 'select' | 'update' | 'delete';

const cache = new Map<string, FileSource>();
export default class FileSource
    extends EventHandler<FileSourceEventType>
    implements DragInf<string>, ColorNoteInf
{
    static readonly eventNamePrefix: string = 'file-source';
    basePath: string;
    fullName: string;
    filePath: string;
    src: string;
    colorNote: string | null = null;

    constructor(
        basePath: string,
        fileFullName: string,
        filePath: string,
        src: string,
    ) {
        super();
        this.basePath = basePath;
        this.fullName = fileFullName;
        this.filePath = filePath;
        this.src = src;
    }

    get isAppFile() {
        return !checkIsAppFile(this.fullName);
    }

    getSrcData() {
        return new Promise<SrcData>((resolve, reject) => {
            appProvider.fileUtils.readFile(
                this.filePath,
                {
                    encoding: 'base64',
                },
                (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const metadata = this.metadata;
                    if (metadata === null) {
                        reject(new Error('metadata not found'));
                        return;
                    }
                    const { mimetypeSignature } = metadata.appMimetype;
                    resolve(`data:${mimetypeSignature};base64,${data}`);
                },
            );
        });
    }

    getColorNote() {
        return FileSourceMetaManager.getColorNote(this.filePath);
    }

    async setColorNote(color: string | null) {
        FileSourceMetaManager.setColorNote(this.filePath, color);
        this.dirSource?.fireReloadEvent();
    }

    get metadata() {
        return getFileMetaData(this.fullName);
    }

    get name() {
        return getFileName(this.fullName);
    }

    get dotExtension() {
        return getFileDotExtension(this.fullName);
    }

    get extension() {
        return this.dotExtension.substring(1);
    }

    get dirSource() {
        return DirSource.getInstanceByDirPath(this.basePath);
    }

    static toRWLockingKey(filePath: string) {
        return `rw-${filePath}`;
    }

    static async readFileData(filePath: string, isSilent?: boolean) {
        return await unlocking(this.toRWLockingKey(filePath), async () => {
            try {
                const dataText = await fsReadFile(filePath);
                return dataText;
            } catch (error: any) {
                if (!isSilent) {
                    showSimpleToast(
                        'Reader File Data',
                        'Error occurred during reading ' +
                            `file: "${filePath}", error: ${error.message}`,
                    );
                }
            }
            return null;
        });
    }

    async readFileData() {
        if ((await fsCheckFileExist(this.filePath)) === false) {
            return null;
        }
        return await FileSource.readFileData(this.filePath);
    }

    async writeFileData(data: string) {
        return await unlocking(
            FileSource.toRWLockingKey(this.filePath),
            async () => {
                try {
                    const isFileExist = await fsCheckFileExist(this.filePath);
                    if (isFileExist) {
                        await fsWriteFile(this.filePath, data);
                    } else {
                        await fsCreateFile(this.filePath, data, true);
                    }
                    this.fireUpdateEvent();
                    return true;
                } catch (error: any) {
                    showSimpleToast('Saving File', error.message);
                }
                return false;
            },
        );
    }

    static async writeFileData(filePath: string, data: string) {
        const fileSource = this.getInstance(filePath);
        return await fileSource.writeFileData(data);
    }

    async readFileJsonData() {
        try {
            const dataText = await this.readFileData();
            if (dataText !== null && isValidJson(dataText)) {
                return JSON.parse(dataText) as AnyObjectType;
            }
        } catch (_error) {}
        return null;
    }

    static getInstanceNoCache(filePath: string, fileFullName?: string) {
        let basePath;
        if (fileFullName) {
            basePath = filePath;
            filePath = pathJoin(filePath, fileFullName);
        } else {
            const index = filePath.lastIndexOf(pathSeparator);
            basePath = filePath.substring(0, index);
            fileFullName = pathBasename(filePath);
        }
        return new FileSource(
            basePath,
            fileFullName,
            filePath,
            pathToFileURL(filePath),
        );
    }

    static getInstance(
        filePath: string,
        fileFullName?: string,
        refreshCache?: boolean,
    ) {
        const fileSource = this.getInstanceNoCache(filePath, fileFullName);
        if (refreshCache) {
            cache.delete(fileSource.filePath);
        }
        if (cache.has(fileSource.filePath)) {
            return cache.get(fileSource.filePath) as FileSource;
        }
        cache.set(fileSource.filePath, fileSource);
        return fileSource;
    }

    dragSerialize(type?: DragTypeEnum) {
        return {
            type: type ?? DragTypeEnum.UNKNOWN,
            data: this.filePath,
        };
    }

    static dragDeserialize(data: any) {
        return this.getInstance(data);
    }

    async renameTo(newName: string) {
        if (newName === this.name) {
            return null;
        }
        try {
            await fsRenameFile(
                this.basePath,
                this.fullName,
                newName + this.dotExtension,
            );
            const newFilePath = pathJoin(
                this.basePath,
                newName + this.dotExtension,
            );
            return FileSource.getInstance(newFilePath);
        } catch (error: any) {
            handleError(error);
            showSimpleToast(
                'Renaming File',
                `Unable to rename file: ${error.message}`,
            );
        }
        return null;
    }

    private async _duplicate() {
        let i = 1;
        let newName = this.name + ' (Copy)';
        while (
            await fsCheckFileExist(this.basePath, newName + this.dotExtension)
        ) {
            newName = this.name + ' (Copy ' + i + ')';
            i++;
        }
        const newFilePath = pathJoin(
            this.basePath,
            newName + this.dotExtension,
        );
        const data = await this.readFileJsonData();
        if (data !== null) {
            await fsCreateFile(newFilePath, JSON.stringify(data));
        }
    }

    async duplicate() {
        try {
            await this._duplicate();
        } catch (error) {
            showSimpleToast('Duplicating File', 'Unable to duplicate file');
            handleError(error);
        }
    }

    static registerFileSourceEventListener<T>(
        events: FileSourceEventType[],
        callback: (data: T) => void,
        filePath?: string,
    ) {
        const newEvents = events.map((event) => {
            return filePath ? `${event}@${filePath}` : event;
        });
        return super.registerEventListener(newEvents, callback);
    }

    static addFileSourcePropEvent(
        eventName: FileSourceEventType,
        filePath: string,
        data?: any,
    ): void {
        const newEventName = `${eventName}@${filePath}` as FileSourceEventType;
        super.addPropEvent(eventName, data);
        super.addPropEvent(newEventName, data);
    }

    fireSelectEvent(data?: any) {
        FileSource.addFileSourcePropEvent('select', this.filePath, data);
    }

    fireUpdateEvent(data?: any) {
        FileSource.addFileSourcePropEvent('update', this.filePath, data);
    }

    fireDeleteEvent() {
        FileSource.addFileSourcePropEvent(
            'delete',
            this.filePath,
            this.filePath,
        );
    }

    async trash() {
        await electronSendAsync<void>('main:app:trash-path', {
            path: this.filePath,
        });
        FileSource.getInstance(this.filePath).fireDeleteEvent();
    }
}
