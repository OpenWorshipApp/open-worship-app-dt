import { handleError } from '../errorHelpers';
import {
    fsCheckFileExist,
    fsDeleteFile,
    fsCreateWriteStream,
    fsCreateDir,
    fsCheckDirExist,
} from '../../server/fileHelpers';
import { WriteStream } from 'node:fs';
import appProvider from '../../server/appProvider';
import { OptionalPromise } from '../typeHelpers';

export const BIBLE_DOWNLOAD_TOAST_TITLE = 'Bible Download';

export type DownloadOptionsType = {
    onStart: (fileSize: number) => OptionalPromise<void>;
    onProgress: (percentage: number) => OptionalPromise<void>;
    onDone: (error: Error | null, filePath?: string) => OptionalPromise<void>;
};
export async function writeStreamToFile(
    filePath: string,
    options: DownloadOptionsType,
    response: any,
) {
    if (response.statusCode !== 200) {
        return options.onDone(new Error('Error during download'));
    }
    if (await fsCheckFileExist(filePath)) {
        await fsDeleteFile(filePath);
    }
    const dir = appProvider.pathUtils.dirname(filePath);
    if (!(await fsCheckDirExist(dir))) {
        await fsCreateDir(dir);
    }
    let writeStreamGlobal: WriteStream | null = null;
    try {
        const writeStream = (writeStreamGlobal = fsCreateWriteStream(filePath));
        if (!writeStream.writable) {
            throw new Error('Write Stream is not writable');
        }
        const len = Number.parseInt(response.headers['content-length']);
        let cur = 0;
        const mb = 1048576; //1048576 - bytes in  1Megabyte
        const total = len / mb;
        options.onStart(Number.parseInt(total.toFixed(2)));
        response.on('data', (chunk: Buffer) => {
            writeStream.write(chunk, (error1) => {
                if (error1) {
                    handleError(error1);
                }
            });
            cur += chunk.length;
            options.onProgress(cur / len);
        });
        response.on('end', async () => {
            writeStream.close();
            options.onDone(null, filePath);
        });
    } catch (error) {
        if (writeStreamGlobal !== null) {
            writeStreamGlobal.close();
        }
        try {
            await fsDeleteFile(filePath);
        } catch (error) {
            handleError(error);
        }
        options.onDone(error as Error);
    }
}
