import { handleError } from '../errorHelpers';
import { LocaleType } from '../../lang';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    get_api_url, get_api_key,
} from '../../_owa-crypto/owa_crypto';
import appProvider from '../../server/appProvider';
import {
    fsCheckFileExist, fsDeleteFile, fsCreateWriteStream, fsListDirectories,
} from '../../server/fileHelpers';
import {
    bibleDataReader, getBibleInfo,
} from './bibleInfoHelpers';
import { appApiFetch } from '../networkHelpers';

const TOAST_TITLE = 'Bible Download';

export function httpsRequest(
    pathName: string,
    callback: (error: Error | null, response?: any) => void,
) {
    const hostname = get_api_url().split('//')[1];
    const request = appProvider.httpUtils.request({
        port: 443,
        path: pathName,
        method: 'GET',
        hostname,
        headers: {
            'x-api-key': get_api_key(),
        },
    }, (response) => {
        callback(null, response);
    });
    request.on('error', (event: Error) => {
        callback(event);
    });
    request.end();
}

export type DownloadOptionsType = {
    onStart: (fileSize: number) => void,
    onProgress: (percentage: number) => void,
    onDone: (error: Error | null, filePath?: string) => void
}

const getDownloadHandler = (
    filePath: string, fileFullName: string, options: DownloadOptionsType,
) => {
    return async (error: any, response: any) => {
        if (await fsCheckFileExist(filePath)) {
            await fsDeleteFile(filePath);
        }
        const writeStream = fsCreateWriteStream(filePath);
        try {
            if (error || response.statusCode !== 200) {
                handleError(error);
                writeStream.close();
                await fsDeleteFile(filePath);
                options.onDone(new Error('Error during download'));
                return;
            }
            const len = parseInt(response.headers['content-length'], 10);
            let cur = 0;
            const mb = 1048576;//1048576 - bytes in  1Megabyte
            const total = len / mb;
            const fileSize = parseInt(total.toFixed(2), 10);
            showSimpleToast(
                TOAST_TITLE,
                `Start downloading "${fileFullName}". File size ${fileSize}mb`,
            );
            options.onStart(parseInt(total.toFixed(2), 10));
            response.on('data', (chunk: Buffer) => {
                if (writeStream.writable) {
                    writeStream.write(chunk, (error1) => {
                        if (error1) {
                            handleError(error1);
                        }
                    });
                }
                cur += chunk.length;
                options.onProgress(cur / len);
            });
            response.on('end', async () => {
                writeStream.close();
                await getBibleInfo(fileFullName);
                options.onDone(null, filePath);
            });
        } catch (error2) {
            writeStream.close();
            try {
                await fsDeleteFile(filePath);
            } catch (error) {
                handleError(error);
            }
            options.onDone(error2 as Error);
        }
    };
};
export async function startDownloadBible({
    bibleFileFullName, fileFullName, options,
}: {
    bibleFileFullName: string,
    fileFullName: string,
    options: DownloadOptionsType
}) {
    const filePath = await bibleDataReader.toBiblePath(bibleFileFullName);
    if (filePath === null) {
        return options.onDone(new Error('Invalid file path'));
    }
    httpsRequest(bibleFileFullName, (error, response) => {
        getDownloadHandler(filePath, fileFullName, options)(error, response);
    });
}


export type BibleMinimalInfoType = {
    locale: LocaleType,
    title: string,
    key: string,
    version: number,
    filePath?: string,
};

export async function downloadBible({
    bibleInfo, options,
}: {
    bibleInfo: BibleMinimalInfoType,
    options: DownloadOptionsType,
}) {
    if (bibleInfo.filePath === undefined) {
        return options.onDone(new Error('Invalid file path'));
    }
    try {
        const downloadPath = await bibleDataReader.getWritableBiblePath();
        if (downloadPath === null) {
            return options.onDone(new Error('Cannot create writable path'));
        }
        await startDownloadBible({
            bibleFileFullName: `/${encodeURI(bibleInfo.filePath)}`,
            fileFullName: bibleInfo.key,
            options,
        });
    } catch (error: any) {
        options.onDone(error);
    }
}
export async function extractDownloadedBible(filePath: string) {
    let isExtracted = false;
    try {
        showSimpleToast(
            TOAST_TITLE, `Start extracting bible from file "${filePath}"`,
        );
        const downloadPath = await bibleDataReader.getWritableBiblePath();
        await appProvider.fileUtils.tarExtract({
            file: filePath,
            cwd: downloadPath,
        });
        isExtracted = true;
    } catch (error: any) {
        handleError(error);
        showSimpleToast(TOAST_TITLE, 'Fail to extract bible');
    } finally {
        showSimpleToast(TOAST_TITLE, 'Bible extracted');
        fsDeleteFile(filePath).catch((error) => {
            handleError(error);
            showSimpleToast(TOAST_TITLE, 'Fail to delete downloaded file');
        });
    }
    return isExtracted;
}

export async function getOnlineBibleInfoList():
    Promise<BibleMinimalInfoType[] | null> {
    try {
        const content = await appApiFetch('info.json');
        const json = await content.json();
        if (typeof json.mapper !== 'object') {
            throw new Error('Cannot get bible list');
        }
        return Object.entries(json.mapper).map(([key, value]:
            [key: string, value: any]) => {
            return {
                locale: value.locale,
                title: value.title,
                key,
                version: value.version,
                filePath: value.filePath,
            };
        });
    } catch (error) {
        handleError(error);
    }
    return null;
}

export async function getDownloadedBibleInfoList() {
    const writableBiblePath = await bibleDataReader.getWritableBiblePath();
    if (writableBiblePath === null) {
        return null;
    }
    const directoryNames = await fsListDirectories(writableBiblePath);
    const promises = directoryNames.map(async (bibleKey) => {
        return getBibleInfo(bibleKey);
    });
    try {
        const infoList = await Promise.all(promises);
        return infoList.filter((info) => {
            return info !== null;
        }) as BibleMinimalInfoType[];
    } catch (error) {
        handleError(error);
    }
    return null;
}
