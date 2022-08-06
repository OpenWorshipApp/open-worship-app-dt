import { useState, useEffect } from 'react';
import { globalEventHandler } from '../event/EventHandler';
import { toastEventListener } from '../event/ToastEventListener';
import SlideItem from '../slide-list/SlideItem';
import DirSource from './DirSource';
import {
    fsCreateFile,
    fsDeleteFile,
    fsReadFile,
    getFileMetaData,
    pathBasename,
    pathJoin,
    pathSeparator,
} from '../server/fileHelper';
import { AnyObjectType } from './helpers';
import ItemSource from './ItemSource';
import { urlPathToFileURL } from '../server/helpers';

type FSListener = (slideItem?: SlideItem) => void;
export type FSEventType = 'select' | 'update'
    | 'history-update' | 'edit' | 'delete'
    | 'delete-cache' | 'refresh-dir';
export type RegisteredEventType = {
    key: string,
    listener: FSListener,
}
export default class FileSource {
    basePath: string;
    fileName: string;
    filePath: string;
    src: string;
    static _fileCache = new Map<string, FileSource>();
    constructor(basePath: string, fileName: string,
        filePath: string, src: string) {
        this.basePath = basePath;
        this.fileName = fileName;
        this.filePath = filePath;
        this.src = src;
    }
    get metadata() {
        return getFileMetaData(this.fileName);
    }
    toEventKey(fsType: FSEventType) {
        return `${fsType}-${this.filePath}`;
    }
    registerEventListener(fsTypes: FSEventType[],
        listener: FSListener): RegisteredEventType[] {
        return fsTypes.map((fsType) => {
            const key = this.toEventKey(fsType);
            globalEventHandler._addOnEventListener(key, listener);
            return {
                key,
                listener,
            };
        });
    }
    unregisterEventListener(events: RegisteredEventType[]) {
        events.forEach(({ key: key, listener }) => {
            globalEventHandler._removeOnEventListener(key, listener);
        });
    }
    get name() {
        return this.fileName.substring(0, this.fileName.lastIndexOf('.'));
    }
    get dirSource() {
        return DirSource.getDirSourceByDirPath(this.basePath);
    }
    fireRefreshDirEvent() {
        this.dirSource?.fireRefreshEvent();
    }
    fireReloadDirEvent() {
        this.dirSource?.fireReloadEvent();
    }
    fireSelectEvent() {
        globalEventHandler.addPropEvent(this.toEventKey('select'));
    }
    fireHistoryUpdateEvent() {
        globalEventHandler.addPropEvent(this.toEventKey('history-update'));
    }
    fireUpdateEvent() {
        globalEventHandler.addPropEvent(this.toEventKey('update'));
    }
    fireEditEvent(slideItem: SlideItem) {
        globalEventHandler.addPropEvent(this.toEventKey('edit'), slideItem);
    }
    fireDeleteEvent() {
        globalEventHandler.addPropEvent(this.toEventKey('delete'));
    }
    fireDeleteCacheEvent() {
        globalEventHandler.addPropEvent(this.toEventKey('delete-cache'));
    }
    deleteCache() {
        FileSource._fileCache.delete(this.filePath);
        ItemSource.deleteCache(this.filePath);
        this.fireDeleteCacheEvent();
    }
    async readFileToData() {
        try {
            const str = await fsReadFile(this.filePath);
            return JSON.parse(str) as AnyObjectType;
        } catch (error: any) {
            toastEventListener.showSimpleToast({
                title: 'Reading File Data',
                message: error.message,
            });
        }
        return null;
    }
    async saveData(data: ItemSource<any>) {
        try {
            const content = JSON.stringify(data.toJson());
            await fsCreateFile(this.filePath, content, true);
            this.fireUpdateEvent();
            return true;
        } catch (error: any) {
            toastEventListener.showSimpleToast({
                title: 'Saving File',
                message: error.message,
            });
        }
        return false;
    }
    async delete() {
        try {
            await fsDeleteFile(this.filePath);
            this.fireDeleteEvent();
            this.deleteCache();
            this.fireReloadDirEvent();
            return true;
        } catch (error: any) {
            toastEventListener.showSimpleToast({
                title: 'Saving File',
                message: error.message,
            });
        }
        return false;
    }
    static genFileSourceNoCache(filePath: string, fileName?: string) {
        let basePath;
        if (fileName) {
            basePath = filePath;
            filePath = pathJoin(filePath, fileName);
        } else {
            const index = filePath.lastIndexOf(pathSeparator);
            basePath = filePath.substring(0, index);
            fileName = pathBasename(filePath);
        }
        return new FileSource(basePath, fileName, filePath,
            urlPathToFileURL(filePath).toString());
    }
    static genFileSource(filePath: string, fileName?: string, refreshCache?: boolean) {
        const fileSource = this.genFileSourceNoCache(filePath, fileName);
        if (refreshCache) {
            this._fileCache.delete(fileSource.filePath);
        }
        if (this._fileCache.has(fileSource.filePath)) {
            return this._fileCache.get(fileSource.filePath) as FileSource;
        }
        this._fileCache.set(fileSource.filePath, fileSource);
        return fileSource;
    }
}

export function useFSEvents(events: FSEventType[], fileSource: FileSource | null,
    callback?: () => void) {
    const [n, setN] = useState(0);
    useEffect(() => {
        if (fileSource === null) {
            return;
        }
        const registerEvent = fileSource.registerEventListener(
            events, () => {
                setN(n + 1);
                if (callback) {
                    callback();
                }
            });
        return () => {
            fileSource.unregisterEventListener(registerEvent);
        };
    }, [fileSource, n]);
}
