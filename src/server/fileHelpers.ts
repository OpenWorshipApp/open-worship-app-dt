import { Stats } from 'node:fs';

import appProvider from './appProvider';
import FileSource from '../helper/FileSource';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';

import mimeBibleList from './mime/bible-types.json';
import mimeLyricList from './mime/lyric-types.json';
import mimeMarkdownList from './mime/markdown-types.json';
import mimeAppDocumentList from './mime/app-document-types.json';
import mimeImageList from './mime/image-types.json';
import mimePlaylistList from './mime/playlist-types.json';
import mimeVideoList from './mime/video-types.json';
import mimeSoundList from './mime/sound-types.json';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { cloneJson, freezeObject } from '../helper/helpers';

freezeObject(mimeBibleList);
freezeObject(mimeLyricList);
freezeObject(mimeMarkdownList);
freezeObject(mimeAppDocumentList);
freezeObject(mimeImageList);
freezeObject(mimePlaylistList);
freezeObject(mimeVideoList);
freezeObject(mimeSoundList);

export const mimetypePdf: AppMimetypeType = {
    type: 'PDF File',
    title: 'PDF File',
    mimetypeSignature: 'application/pdf',
    mimetypeName: 'other',
    extensions: ['.pdf'],
};

const appMimeTypesMapper = {
    bible: mimeBibleList,
    lyric: mimeLyricList,
    appDocument: mimeAppDocumentList,
};
const _mimeTypes = Object.values(appMimeTypesMapper) as AppMimetypeType[][];
const appExtensions = _mimeTypes.reduce((acc: string[], cur) => {
    const exts = cur
        .map((mimeType) => {
            return mimeType.extensions;
        })
        .reduce((acc1, cur1) => {
            return acc1.concat(cur1);
        }, []);
    return acc.concat(exts);
}, []);

const mimeTypesMapper = {
    bible: mimeBibleList,
    lyric: mimeLyricList,
    markdown: mimeMarkdownList,
    appDocument: mimeAppDocumentList,
    pdf: [mimetypePdf],
    image: mimeImageList,
    playlist: mimePlaylistList,
    video: mimeVideoList,
    sound: mimeSoundList,
};

export type AppMimetypeType = {
    type: string;
    title: string;
    mimetypeSignature: string;
    mimetypeName: MimetypeNameType;
    extensions: string[];
};

export type FileMetadataType = {
    fileFullName: string;
    appMimetype: AppMimetypeType;
};

export function checkIsAppFile(fileFullName: string) {
    const dotExtension = getFileDotExtension(fileFullName);
    const isAppFile = appExtensions.includes(dotExtension);
    return isAppFile;
}

export const pathSeparator = appProvider.pathUtils.sep;
export function pathJoin(filePath: string, fileFullName: string) {
    return appProvider.pathUtils.join(filePath, fileFullName);
}

export function pathResolve(...paths: string[]): string {
    const path = appProvider.pathUtils.resolve(...paths);
    if (path.endsWith(pathSeparator)) {
        return path.slice(0, -1);
    }
    return path;
}

export function pathBasename(filePath: string) {
    return appProvider.pathUtils.basename(filePath);
}

export function getFileName(fileFullName: string) {
    return fileFullName.substring(0, fileFullName.lastIndexOf('.'));
}

export function getFileDotExtension(fileFullName: string) {
    return fileFullName.substring(fileFullName.lastIndexOf('.'));
}

export function addExtension(name: string, extension: string) {
    return `${name}${extension}`;
}

export const createNewFileDetail = async (
    dir: string,
    name: string,
    content: string,
    mimetypeName: MimetypeNameType,
) => {
    // TODO: verify file name before create
    const extensions = getMimetypeExtensions(mimetypeName);
    if (extensions.length === 0) {
        throw new Error(`No extensions found for mimetype: ${mimetypeName}`);
    }
    const fileFullName = `${name}.${extensions[0]}`;
    try {
        const filePath = pathJoin(dir, fileFullName);
        return await fsCreateFile(filePath, content);
    } catch (error: any) {
        showSimpleToast('Creating Playlist', error.message);
    }
    return null;
};

export const mimetypeNameTypeList = [
    'image',
    'video',
    'appDocument',
    'pdf',
    'playlist',
    'lyric',
    'markdown',
    'bible',
    'sound',
    'other',
] as const;
export type MimetypeNameType = (typeof mimetypeNameTypeList)[number];

export function getFileMetaData(
    fileFullName: string,
    mimetypeList?: AppMimetypeType[],
): FileMetadataType | null {
    mimetypeList = mimetypeList ?? getAllAppMimetype();
    const dotExtension = getFileDotExtension(fileFullName);
    const foundMT = mimetypeList.find((mt) => {
        return mt.extensions.includes(dotExtension);
    });
    if (foundMT) {
        return { fileFullName: fileFullName, appMimetype: foundMT };
    }
    return null;
}

export function getAllAppMimetype() {
    return mimetypeNameTypeList
        .map((mimetypeName) => {
            return getAppMimetype(mimetypeName);
        })
        .reduce((acc, cur) => {
            return acc.concat(cur);
        }, []);
}

export function getAppMimetype(mimetypeName: MimetypeNameType) {
    if (mimetypeName === 'other') {
        return [];
    }
    const json = cloneJson(mimeTypesMapper[mimetypeName]);
    json.forEach((data: any) => {
        data.mimetypeName = mimetypeName;
    });
    return json as AppMimetypeType[];
}

export function getMimetypeExtensions(mimetypeName: MimetypeNameType) {
    const mimetypeList = getAppMimetype(mimetypeName);
    return mimetypeList
        .reduce((r: string[], mimetype) => {
            r.push(...mimetype.extensions);
            return r;
        }, [])
        .map((ext) => {
            return ext.replace('.', '');
        });
}

export function isSupportedMimetype(
    fileMimetype: string,
    mimetypeName: MimetypeNameType,
) {
    const mimetypeList = getAppMimetype(mimetypeName);
    return mimetypeList
        .map((newMimetype) => {
            return newMimetype.mimetypeSignature;
        })
        .some((type) => {
            return type === fileMimetype;
        });
}

export function isSupportedExt(
    fileFullName: string,
    mimetypeName: MimetypeNameType,
) {
    const mimetypeList = getAppMimetype(mimetypeName);
    const dotExtension = getFileDotExtension(fileFullName);
    return mimetypeList
        .map((newMimetype) => {
            return newMimetype.extensions;
        })
        .some((extensions) => {
            return extensions.includes(dotExtension);
        });
}

export function fsCreateWriteStream(filePath: string) {
    return appProvider.fileUtils.createWriteStream(filePath);
}

export function fsCreateReadStream(filePath: string) {
    return appProvider.fileUtils.createReadStream(filePath);
}

export type FileResultType = {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
    filePath: string;
};

function fsFilePromise<T>(
    fn: (...args: any) => void,
    ...args: any
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        args = args ?? [];
        args.push(function (error: any, ...args1: any) {
            if (error) {
                reject(error as Error);
            } else {
                args1 = args1 ?? [];
                (resolve as any)(...args1);
            }
        });
        fn(...args);
    });
}

function _fsStat(filePath: string) {
    return fsFilePromise<Stats>(appProvider.fileUtils.stat, filePath);
}

function _fsMkdir(dirPath: string, isRecursive: boolean) {
    return fsFilePromise<void>(appProvider.fileUtils.mkdir, dirPath, {
        recursive: isRecursive,
    });
}

function _fsRmdir(dirPath: string) {
    return fsFilePromise<void>(appProvider.fileUtils.rmdir, dirPath, {
        recursive: true,
    });
}

function _fsReaddir(dirPath: string) {
    return fsFilePromise<string[]>(appProvider.fileUtils.readdir, dirPath);
}

function _fsReadFile(filePath: string, options?: any) {
    return fsFilePromise<string>(
        appProvider.fileUtils.readFile,
        filePath,
        options,
    );
}

function _fsWriteFile(filePath: string, data: string | Buffer, options?: any) {
    return fsFilePromise<void>(
        appProvider.fileUtils.writeFile,
        filePath,
        data,
        options,
    );
}

export function fsMove(oldFullPath: string, newFullPath: string) {
    return fsFilePromise<void>(
        appProvider.fileUtils.rename,
        oldFullPath,
        newFullPath,
    );
}

function _fsUnlink(filePath: string) {
    return fsFilePromise<void>(appProvider.fileUtils.unlink, filePath);
}

export function fsCloneFile(file: File | string, dest: string) {
    if (file instanceof File) {
        return new Promise<void>((resolve, reject) => {
            const writeStream = fsCreateWriteStream(dest);
            const writableStream = new WritableStream({
                write(chunk) {
                    writeStream.write(chunk);
                },
                close() {
                    writeStream.end();
                },
                abort() {
                    writeStream.destroy();
                },
            });
            writeStream.once('close', resolve);
            file.stream().pipeTo(writableStream).catch(reject);
        });
    }
    return fsFilePromise<void>(appProvider.fileUtils.copyFile, file, dest);
}

async function _fsCheckExist(
    isFile: boolean,
    filePath: string,
    fileFullName?: string,
) {
    if (!filePath) {
        return false;
    }
    if (fileFullName) {
        filePath = pathJoin(filePath, fileFullName);
    }
    try {
        const stat = await _fsStat(filePath);
        if (isFile) {
            return stat.isFile();
        } else {
            return stat.isDirectory();
        }
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return false;
        } else {
            handleError(error);
            throw new Error('Error during checking file exist');
        }
    }
}

export function fsCheckDirExist(dirPath: string) {
    return _fsCheckExist(false, dirPath);
}

export function fsCheckFileExist(filePath: string, fileFullName?: string) {
    return _fsCheckExist(true, filePath, fileFullName);
}

export async function fsList(dir: string) {
    if (!dir) {
        return [];
    }
    const foundFileList = await _fsReaddir(dir);
    const fileList = [];
    for (const file of foundFileList) {
        const filePath = pathJoin(dir, file);
        try {
            const fileStat = await _fsStat(filePath);
            fileList.push({
                isFile: fileStat.isFile(),
                isDirectory: fileStat.isDirectory(),
                name: file,
                filePath,
            });
        } catch (_error) {}
    }
    return fileList;
}

export async function fsListFiles(dirPath: string) {
    const foundFileList = await fsList(dirPath);
    return foundFileList
        .filter(({ isFile }) => {
            return isFile;
        })
        .map(({ name }) => {
            return name;
        });
}

export async function fsListDirectories(dirPath: string) {
    const foundFileList = await fsList(dirPath);
    return foundFileList
        .filter(({ isDirectory }) => {
            return isDirectory;
        })
        .map(({ name }) => {
            return name;
        });
}

export async function fsListFilesWithMimetype(
    dir: string,
    mimetypeName: MimetypeNameType,
) {
    if (!dir) {
        return [];
    }
    try {
        const mimetypeList = getAppMimetype(mimetypeName);
        const files = await fsListFiles(dir);
        const matchedFiles = files
            .map((fileFullName) => {
                return getFileMetaData(fileFullName, mimetypeList);
            })
            .filter((d) => {
                return !!d;
            });
        return matchedFiles.map((fileMetadata) => {
            return FileSource.getInstance(dir, fileMetadata.fileFullName)
                .filePath;
        });
    } catch (error) {
        handleError(error);
        showSimpleToast(
            'Getting File List',
            'Error occurred during listing file',
        );
    }
    return null;
}

export function fsCreateDir(dirPath: string, isRecursive = true) {
    return _fsMkdir(dirPath, isRecursive);
}

export function fsMkDirSync(dirPath: string, isRecursive = true) {
    return appProvider.fileUtils.mkdirSync(dirPath, {
        recursive: isRecursive,
    });
}

export async function fsWriteFile(
    filePath: string,
    data: string | Buffer,
    encoding?: string,
) {
    await _fsWriteFile(filePath, data, {
        encoding: encoding ?? 'utf8',
        flag: 'w',
    });
    return filePath;
}

export function fsWriteFileSync(filePath: string, txt: string, encoding?: any) {
    return appProvider.fileUtils.writeFileSync(filePath, txt, {
        encoding: encoding ?? 'utf8',
        flag: 'w',
    });
}

export async function fsCreateFile(
    filePath: string,
    txt: string,
    isOverride?: boolean,
) {
    if (await fsCheckFileExist(filePath)) {
        if (isOverride) {
            await fsDeleteFile(filePath);
        } else {
            throw new Error('File exist');
        }
    }
    await _fsWriteFile(filePath, txt);
    return filePath;
}

export function fsExistSync(filePath: string) {
    return appProvider.fileUtils.existsSync(filePath);
}

export async function fsRenameFile(
    basePath: string,
    oldFileName: string,
    newFileName: string,
) {
    const oldFilePath = pathJoin(basePath, oldFileName);
    const newFilePath = pathJoin(basePath, newFileName);
    if (!(await fsCheckFileExist(oldFilePath))) {
        throw new Error('File not exist');
    } else if (await fsCheckFileExist(newFilePath)) {
        throw new Error('File exist');
    }
    return fsMove(oldFilePath, newFilePath);
}

export async function fsDeleteFile(filePath: string) {
    if (await fsCheckDirExist(filePath)) {
        throw new Error(`${filePath} is not a file`);
    }
    if (await fsCheckFileExist(filePath)) {
        await _fsUnlink(filePath);
    }
}

export function fsUnlinkSync(filePath: string) {
    return appProvider.fileUtils.unlinkSync(filePath);
}

export async function fsDeleteDir(filePath: string) {
    if (await fsCheckFileExist(filePath)) {
        throw new Error(`${filePath} is not a directory`);
    }
    if (await fsCheckDirExist(filePath)) {
        await _fsRmdir(filePath);
    }
}

export function fsReadFile(filePath: string) {
    return _fsReadFile(filePath, 'utf8');
}

export function fsReadSync(filePath: string) {
    return appProvider.fileUtils.readFileSync(filePath, 'utf8');
}

export async function fsCopyFilePathToPath(
    file: File | string,
    destinationPath: string,
    fileFullName?: string,
) {
    const progressKey = 'Copying File';
    showProgressBar(progressKey);
    fileFullName = fileFullName ?? getFileFullName(file);
    const targetPath = pathJoin(destinationPath, fileFullName);
    try {
        const isFileExist = await fsCheckFileExist(targetPath);
        if (isFileExist) {
            const isConfirm = await showAppConfirm(
                'Copy File',
                `File path "${targetPath}" exist, do you want to override it?`,
            );
            if (!isConfirm) {
                throw new Error('Canceled by user');
            }
        }
        await fsCloneFile(file, targetPath);
        hideProgressBar(progressKey);
        return targetPath;
    } catch (error: any) {
        if (error.message !== 'Canceled by user') {
            handleError(error);
            showSimpleToast('Copying File', 'Error: ' + error.message);
            try {
                await fsDeleteFile(targetPath);
            } catch (error) {
                handleError(error);
            }
        }
    }
    hideProgressBar(progressKey);
    return null;
}

export function getFileFullName(file: File | string) {
    if (file instanceof File) {
        return file.name;
    }
    const fileFullName = pathBasename(file);
    return fileFullName;
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

export function writeFileFromBase64(filePath: string, base64: string) {
    return appProvider.fileUtils.writeFileFromBase64(filePath, base64);
}

export function getDotExtensionFromBase64Data(base64Data: string) {
    const mimeRegex = /^data:([a-zA-Z0-9+]+\/[a-zA-Z0-9+]+);base64,/;
    const mimeMatch = mimeRegex.exec(base64Data);
    if (mimeMatch) {
        const mimeType = mimeMatch[1].toLowerCase();
        const allMimeTypes = Object.values(mimeTypesMapper).flat();
        const foundMime = allMimeTypes.find((mt) => {
            return mt.mimetypeSignature === mimeType;
        });
        if (foundMime) {
            return foundMime.extensions[0];
        }
    }
    return null;
}
