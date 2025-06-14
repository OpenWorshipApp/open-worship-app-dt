import appProvider, { FontListType } from './appProvider';
import { showSimpleToast } from '../toast/toastHelpers';
import { OptionalPromise } from '../others/otherHelpers';
import FileSource from '../helper/FileSource';
import { AnyObjectType } from '../helper/helpers';

export function getFontListByNodeFont() {
    appProvider.messageUtils.sendData('main:app:get-font-list');
    return appProvider.messageUtils.sendDataSync(
        'main:app:get-font-list',
    ) as FontListType | null;
}

export function genReturningEventName(eventName: string) {
    const newDate = new Date().getTime();
    return `${eventName}-return-${newDate}`;
}

export function electronSendAsync<T>(
    eventName: string,
    data: AnyObjectType = {},
) {
    return new Promise<T>((resolve, reject) => {
        const replyEventName = genReturningEventName(eventName);
        appProvider.messageUtils.listenOnceForData(
            replyEventName,
            (_event, data: T) => {
                if (data instanceof Error) {
                    return reject(data);
                }
                resolve(data);
            },
        );
        appProvider.messageUtils.sendData(eventName, {
            ...data,
            replyEventName,
        });
    });
}

export function showExplorer(dir: string) {
    appProvider.messageUtils.sendData('main:app:reveal-path', dir);
}

export async function trashFile(filePath: string) {
    await electronSendAsync<void>('main:app:trash-path', { path: filePath });
    FileSource.getInstance(filePath).fireDeleteEvent();
}

export function previewPdf(src: string) {
    appProvider.messageUtils.sendData('main:app:preview-pdf', src);
}

export function convertToPdf(officeFilePath: string, pdfFilePath: string) {
    return electronSendAsync<void>('main:app:convert-to-pdf', {
        officeFilePath,
        pdfFilePath,
    });
}

export function tarExtract(filePath: string, outputDir: string) {
    return electronSendAsync<void>('main:app:tar-extract', {
        filePath,
        outputDir,
    });
}

export function copyToClipboard(str: string) {
    appProvider.systemUtils.copyToClipboard(str);
    showSimpleToast('Copy', 'Text has been copied to clip');
    return true;
}

export function selectDirs() {
    return appProvider.messageUtils.sendDataSync(
        'main:app:select-dirs',
    ) as string[];
}
export function selectFiles(
    filters: {
        name: string;
        extensions: string[];
    }[],
) {
    return appProvider.messageUtils.sendDataSync(
        'main:app:select-files',
        filters,
    ) as string[];
}

export function getUserWritablePath(): string {
    return appProvider.messageUtils.sendDataSync('main:app:get-data-path');
}

export function getDesktopPath(): string {
    return appProvider.messageUtils.sendDataSync('main:app:get-desktop-path');
}

export function getTempPath(): string {
    return appProvider.messageUtils.sendDataSync('main:app:get-temp-path');
}

const lockSet = new Set<string>();
export async function unlocking<T>(
    key: string,
    callback: () => OptionalPromise<T>,
) {
    if (lockSet.has(key)) {
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
        return unlocking(key, callback);
    }
    lockSet.add(key);
    const data = await callback();
    lockSet.delete(key);
    return data;
}
