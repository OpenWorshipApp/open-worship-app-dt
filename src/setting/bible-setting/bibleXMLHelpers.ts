import { useState, useTransition } from 'react';

import { showSimpleToast } from '../../toast/toastHelpers';
import { handleError } from '../../helper/errorHelpers';
import appProvider from '../../server/appProvider';
import { writeStreamToFile } from '../../helper/bible-helpers/downloadHelpers';
import { showExplorer } from '../../server/appHelpers';
import {
    ensureDirectory,
    fsCheckFileExist,
    fsDeleteDir,
    fsDeleteFile,
    getFileMD5,
    pathJoin,
} from '../../server/fileHelpers';
import { tran } from '../../lang/langHelpers';
import { getBibleInfo } from '../../helper/bible-helpers/bibleInfoHelpers';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';
import {
    fromBibleFileName,
    getModelKeyBookMap,
} from '../../helper/bible-helpers/bibleLogicHelpers1';
import type {
    BibleJsonInfoType,
    BibleXMLJsonType,
} from './bibleXMLJsonDataHelpers';
import {
    bibleKeyToXMLFilePath,
    jsonToXMLText,
    xmlTextToJson,
    xmlTextToBibleElement,
    getBibleInfoJson,
    getAllXMLFileKeys,
} from './bibleXMLJsonDataHelpers';
import type {
    BibleChapterType,
    BibleInfoType,
} from '../../helper/bible-helpers/BibleDataReader';
import FileSource from '../../helper/FileSource';
import { menuTitleRevealFile } from '../../helper/helpers';
import { appLocalStorage } from '../directory-setting/appLocalStorage';
import { unlocking } from '../../server/unlockingHelpers';
import CacheManager from '../../others/CacheManager';
import {
    hideProgressBar,
    showProgressBar,
} from '../../progress-bar/progressBarHelpers';
import {
    infoEditorSchemaHandler,
    bookChapterEditorSchemaHandler,
} from './schemas/bibleSchemaHelpers';
import { getBibleModelInfoSetting } from '../../helper/bible-helpers/bibleModelHelpers';

type MessageCallbackType = (message: string | null) => void;

export function getInputByName(form: HTMLFormElement, name: string) {
    const inputFile = form.querySelector(`input[name="${name}"]`);
    if (inputFile === null || !(inputFile instanceof HTMLInputElement)) {
        return null;
    }
    return inputFile;
}

export function readFromFile(
    form: HTMLFormElement,
    messageCallback: MessageCallbackType,
) {
    return new Promise<string | null>((resolve, reject) => {
        const inputFile = getInputByName(form, 'file');
        if (inputFile === null || !(inputFile instanceof HTMLInputElement)) {
            resolve(null);
        }
        const file = (inputFile as any).files?.[0];
        if (!file) {
            resolve(null);
        }
        messageCallback('Reading file...');
        const reader = new FileReader();
        reader.onload = function (event1) {
            messageCallback(null);
            resolve(
                typeof event1.target?.result === 'string'
                    ? event1.target.result
                    : null,
            );
        };
        reader.onerror = function (error) {
            handleError(error);
            reject(new Error('Error during reading file'));
        };
        reader.readAsText(file);
    });
}

function initHttpRequest(url: URL) {
    return new Promise<any>((resolve, reject) => {
        const request = appProvider.httpUtils.request(
            {
                port: 443,
                path: url.pathname + url.search,
                method: 'GET',
                hostname: url.hostname,
            },
            (response) => {
                if (response.statusCode === 302 && response.headers.location) {
                    initHttpRequest(new URL(response.headers.location)).then(
                        resolve,
                    );
                    return;
                }
                resolve(response);
            },
        );
        request.on('error', (event: Error) => {
            reject(event);
        });
        request.end();
    });
}

function downloadXMLToFile(
    filePath: string,
    response: any,
    messageCallback: MessageCallbackType,
) {
    return new Promise<void>((resolve, reject) => {
        writeStreamToFile(
            filePath,
            {
                onStart: (total) => {
                    const fileSize = Number.parseInt(total.toFixed(2));
                    messageCallback(
                        `Start downloading (File size: ${fileSize}MB)...`,
                    );
                },
                onProgress: (progress) => {
                    messageCallback(`${(progress * 100).toFixed(2)}% done`);
                },
                onDone: (error, filePath) => {
                    if (error) {
                        showSimpleToast('Download Error', `Error: ${error}`);
                        reject(error);
                        return;
                    }
                    showSimpleToast(
                        'Download Completed',
                        `File saved at: ${filePath}`,
                    );
                    resolve();
                },
            },
            response,
        );
    });
}

export async function readFromUrl(
    form: HTMLFormElement,
    messageCallback: MessageCallbackType,
) {
    const inputText = getInputByName(form, 'url');
    if (!inputText?.value) {
        return null;
    }
    const url = new URL(inputText.value);
    try {
        messageCallback('Downloading file...');
        const response = await initHttpRequest(url);
        const userWritablePath = appLocalStorage.defaultStorage;
        let fileFullName = appProvider.pathUtils.basename(url.pathname);
        if (fileFullName.toLocaleLowerCase().endsWith('.xml') === false) {
            fileFullName += '.xml';
        }
        const filePath = appProvider.pathUtils.resolve(
            userWritablePath,
            'temp-xml',
            fileFullName,
        );
        await downloadXMLToFile(filePath, response, messageCallback);
        messageCallback('Reading file...');
        const xmlText = await FileSource.readFileData(filePath);
        messageCallback('Deleting file...');
        await fsDeleteFile(filePath);
        messageCallback(null);
        return xmlText;
    } catch (error) {
        showSimpleToast(
            `Error occurred during download "${inputText.value}"`,
            `Error: ${error}`,
        );
        handleError(error);
    }
    return null;
}

export function checkIsValidUrl(urlText: string) {
    try {
        new URL(urlText);
        return true;
    } catch (_error) {
        return false;
    }
}

export async function getBibleXMLInfo(bibleKey: string) {
    const filePath = await bibleKeyToXMLFilePath(bibleKey);
    if (filePath === null) {
        return null;
    }
    const xmlText = await FileSource.readFileData(filePath);
    if (xmlText === null) {
        return null;
    }
    const xmlElementBible = xmlTextToBibleElement(xmlText);
    if (!xmlElementBible) {
        return null;
    }
    return await getBibleInfoJson(xmlElementBible);
}

export async function getBibleXMLCacheInfoList() {
    const bibleKeysMap = await getAllXMLFileKeys();
    const infoList: BibleInfoType[] = [];
    for (const bibleKey of Object.keys(bibleKeysMap)) {
        const bibleInfo = await getBibleInfo(bibleKey, true);
        if (bibleInfo !== null) {
            infoList.push(bibleInfo);
        }
    }
    return infoList;
}

export async function saveXMLText(bibleKey: string, xmlText: string) {
    const filePath = await bibleKeyToXMLFilePath(bibleKey, true);
    if (filePath === null) {
        return false;
    }
    const fileSource = FileSource.getInstance(filePath);
    return await fileSource.writeFileData(xmlText);
}

export function handBibleKeyContextMenuOpening(bibleKey: string, event: any) {
    const contextMenuItems: ContextMenuItemType[] = [
        {
            menuElement: menuTitleRevealFile,
            onSelect: async () => {
                const filePath = await bibleKeyToXMLFilePath(bibleKey);
                if (filePath === null) {
                    return;
                }
                showExplorer(filePath);
            },
        },
        {
            menuElement: tran('Clear Cache'),
            onSelect: () => {
                invalidateBibleXMLCachedFolder(bibleKey);
            },
        },
    ];
    showAppContextMenu(event, contextMenuItems);
}

export const BIBLE_XML_CACHE_DURATION_SEC = 60; // 1 minute
const bibleJSONCacheManager = new CacheManager<BibleXMLJsonType>(
    BIBLE_XML_CACHE_DURATION_SEC,
);
export async function getBibleXMLDataFromKeyCaching(bibleKey: string) {
    return unlocking(bibleKey, async () => {
        let jsonData = await bibleJSONCacheManager.get(bibleKey);
        if (jsonData !== null) {
            return jsonData;
        }
        const title = `Loading Bible Data`;
        showProgressBar(title);
        jsonData = await getBibleXMLDataFromKey(bibleKey);
        hideProgressBar(title);
        if (jsonData !== null) {
            await bibleJSONCacheManager.set(bibleKey, jsonData);
        }
        return jsonData;
    });
}

export async function ensureBibleXMLCachedBasePath(bibleKey: string) {
    const filePath = await bibleKeyToXMLFilePath(bibleKey, true);
    if (filePath === null) {
        return null;
    }
    const dirPath = `${filePath}.cache`;
    await ensureDirectory(dirPath);
    return dirPath;
}

async function invalidateBibleXMLCachedFolder(bibleKey: string) {
    const xmlFilePath = await bibleKeyToXMLFilePath(bibleKey);
    if (xmlFilePath === null) {
        return;
    }
    const md5Hash = await getFileMD5(xmlFilePath);
    if (md5Hash === null) {
        return;
    }
    const basePath = await ensureBibleXMLCachedBasePath(bibleKey);
    if (basePath === null) {
        return;
    }
    const md5FilePath = pathJoin(basePath, md5Hash);
    await fsDeleteDir(basePath);
    await ensureDirectory(basePath);
    const fileSource = FileSource.getInstance(md5FilePath);
    await fileSource.writeFileData(Date.now().toString());
}

async function backupBibleXMLData<T>(
    bibleKey: string,
    fileName: string,
    data: T,
) {
    const basePath = await ensureBibleXMLCachedBasePath(bibleKey);
    if (basePath !== null) {
        const filePath = pathJoin(basePath, fileName);
        const fileSource = FileSource.getInstance(filePath);
        const bibleModel = getBibleModelInfoSetting();
        await fileSource.writeFileData(
            JSON.stringify({
                _cachingTime: Date.now(),
                _bibleModel: bibleModel,
                value: data,
            }),
        );
    }
    return data;
}

async function getBackupBibleXMLData(bibleKey: string, fileName: string) {
    const basePath = await ensureBibleXMLCachedBasePath(bibleKey);
    if (basePath === null) {
        return null;
    }
    const filePath = pathJoin(basePath, fileName);
    if (!(await fsCheckFileExist(filePath))) {
        return null;
    }
    const fileSource = FileSource.getInstance(filePath);
    const jsonText = await fileSource.readFileData();
    if (jsonText !== null) {
        try {
            const data = JSON.parse(jsonText);
            const bibleModel = getBibleModelInfoSetting();
            const time = data._cachingTime ?? 0;
            // if the backup data is older than 7 days, ignore it
            if (
                Date.now() - time > 7 * 24 * 60 * 60 * 1000 ||
                data._bibleModel !== bibleModel
            ) {
                return null;
            }
            const backData = data.value;
            const validatedData = (
                fileName === '_info'
                    ? infoEditorSchemaHandler
                    : bookChapterEditorSchemaHandler
            ).validate(backData);
            if (!validatedData.valid) {
                handleError(validatedData.errors);
                return null;
            }
            return backData;
        } catch (_error) {}
    }
    return null;
}

function checkIsMatchBookChapterKey(verseKey: string, bookChapterKey: string) {
    return verseKey.split(':')[0] === bookChapterKey;
}
export async function readBibleXMLData(
    bibleKey: string,
    fileName: string,
): Promise<BibleInfoType | BibleChapterType | null> {
    const backupData = await getBackupBibleXMLData(bibleKey, fileName);
    if (backupData !== null) {
        return backupData;
    }
    const jsonData = await getBibleXMLDataFromKeyCaching(bibleKey);
    if (jsonData === null) {
        return null;
    }
    const bibleInfo = jsonData.info;
    if (fileName === '_info') {
        return backupBibleXMLData<BibleInfoType>(bibleKey, fileName, bibleInfo);
    }
    const fileNameData = fromBibleFileName(fileName);
    if (fileNameData === null) {
        return null;
    }
    const { bookKey, chapterNum } = fileNameData;
    const chapterMap = jsonData.books[bookKey];
    if (!chapterMap) {
        return null;
    }
    const chapterData = chapterMap[chapterNum];
    if (!chapterData) {
        return null;
    }
    const bookChapterKey = `${bookKey} ${chapterNum}`;
    const newLines = jsonData.newLines.filter((verseKey) => {
        return checkIsMatchBookChapterKey(verseKey, bookChapterKey);
    });
    const newLinesTitleMap: { [key: string]: any } = {};
    for (const verseKey of Object.keys(jsonData.newLinesTitleMap)) {
        if (checkIsMatchBookChapterKey(verseKey, bookChapterKey)) {
            newLinesTitleMap[verseKey] = jsonData.newLinesTitleMap[verseKey];
        }
    }
    const customVersesMap: { [key: string]: any } = {};
    for (const verseKey of Object.keys(jsonData.customVersesMap)) {
        if (checkIsMatchBookChapterKey(verseKey, bookChapterKey)) {
            customVersesMap[verseKey] = jsonData.customVersesMap[verseKey];
        }
    }
    return backupBibleXMLData<BibleChapterType>(bibleKey, fileName, {
        title: `${bibleInfo.keyBookMap[bookKey]} ${chapterNum}`,
        verses: chapterData,
        newLines,
        newLinesTitleMap,
        customVersesMap,
    });
}

export async function saveJsonDataToXMLfile(
    jsonData: BibleXMLJsonType,
    bibleKey?: string,
) {
    bibleKey = bibleKey ?? jsonData.info.key;
    const xmlText = jsonToXMLText(jsonData);
    if (xmlText === null) {
        showSimpleToast('Error', 'Error occurred during saving to XML');
        return false;
    }
    await saveXMLText(bibleKey, xmlText);
    await invalidateBibleXMLCachedFolder(bibleKey);
    return true;
}

export async function deleteBibleXML(bibleKey: string) {
    const filePath = await bibleKeyToXMLFilePath(bibleKey);
    if (filePath === null) {
        return;
    }
    const fileSource = FileSource.getInstance(filePath);
    await fileSource.trash();
}

export async function getBibleXMLDataFromKey(bibleKey: string) {
    const filePath = await bibleKeyToXMLFilePath(bibleKey);
    if (filePath === null) {
        return null;
    }
    const xmlText = await FileSource.readFileData(filePath);
    if (xmlText === null) {
        return null;
    }
    return await xmlTextToJson(xmlText);
}

export async function updateBibleXMLInfo(
    oldBibleInfo: BibleJsonInfoType,
    newBibleInfo: BibleJsonInfoType,
) {
    const dataJson = await getBibleXMLDataFromKey(oldBibleInfo.key);
    if (dataJson === null) {
        showSimpleToast('Error', 'Error occurred during reading file');
        return false;
    }
    newBibleInfo.keyBookMap = newBibleInfo.keyBookMap ?? getModelKeyBookMap();
    const newJsonData = { ...dataJson, info: newBibleInfo };
    await saveJsonDataToXMLfile(newJsonData, oldBibleInfo.key);
    return true;
}

export function useBibleXMLInfo(bibleKey: string) {
    const [bibleInfo, setBibleInfo] = useState<BibleJsonInfoType | null>(null);
    const [isPending, startTransition] = useTransition();
    const loadBibleKeys = () => {
        startTransition(async () => {
            const newBibleInfo = await getBibleXMLInfo(bibleKey);
            setBibleInfo(newBibleInfo);
        });
    };
    useAppEffect(loadBibleKeys, []);
    return { bibleInfo, isPending, setBibleInfo };
}

export function useBibleXMLKeys() {
    const [bibleKeysMap, setBibleKeysMap] = useState<{
        [key: string]: string;
    } | null>(null);
    const [isPending, startTransition] = useTransition();
    const loadBibleKeys = () => {
        startTransition(async () => {
            const keyMap = await getAllXMLFileKeys();
            setBibleKeysMap(keyMap);
        });
    };
    useAppEffect(loadBibleKeys, []);
    return { bibleKeysMap, isPending, loadBibleKeys };
}
