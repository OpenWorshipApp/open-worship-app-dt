import { useState, useTransition } from 'react';
import type { SchemaNode } from 'json-schema-library';

import { showSimpleToast } from '../../toast/toastHelpers';
import { handleError } from '../../helper/errorHelpers';
import appProvider from '../../server/appProvider';
import {
    initHttpRequest,
    type MessageCallbackType,
    writeStreamToFile,
} from '../../helper/bible-helpers/downloadHelpers';
import { showFileOrDirExplorer } from '../../server/appHelpers';
import {
    ensureDirectory,
    fsCheckFileExist,
    fsDeleteDir,
    fsDeleteFile,
    pathJoin,
} from '../../server/fileHelpers';
import { tran } from '../../lang/langHelpers';
import { getBibleInfo } from '../../helper/bible-helpers/bibleInfoHelpers';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { useAppEffect } from '../../helper/appHooks';
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
    getBibleInfoJson,
    getAllXMLFileKeys,
} from './bibleXMLJsonDataHelpers';
import type {
    BibleChapterType,
    BibleInfoType,
} from '../../helper/bible-helpers/BibleDataReader';
import FileSource from '../../helper/FileSource';
import { getMenuTitleRevealFile } from '../../helper/helpers';
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
import {
    BIBLE_KJV_KEY,
    getBibleModelInfoSetting,
} from '../../helper/bible-helpers/bibleModelHelpers';
import { genEmbeddedKJVBibleXMLText } from '../../helper/bible-helpers/kjvBibleXMLTextHelpers';

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
                        showSimpleToast(
                            tran('Download Error'),
                            `Error: ${error}`,
                        );
                        reject(error);
                        return;
                    }
                    showSimpleToast(
                        tran('Download Completed'),
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
    return await getBibleInfoJson(xmlText);
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
            childBefore: genContextMenuItemIcon('folder2-open'),
            menuElement: getMenuTitleRevealFile(),
            onSelect: async () => {
                const filePath = await bibleKeyToXMLFilePath(bibleKey);
                if (filePath === null) {
                    return;
                }
                showFileOrDirExplorer(filePath);
            },
        },
        {
            childBefore: genContextMenuItemIcon('eraser'),
            menuElement: tran('Clear Cache'),
            onSelect: () => {
                clearBibleXMLCache(bibleKey);
            },
        },
    ];
    showAppContextMenu(event, contextMenuItems);
}

const ALL_DATA_FILE_NAME = 'all';
export const BIBLE_XML_CACHE_DURATION_SEC = 10;
const bibleJSONCacheManager = new CacheManager<BibleXMLJsonType>(
    BIBLE_XML_CACHE_DURATION_SEC,
);
export async function getBibleXMLDataFromKeyCaching(bibleKey: string) {
    return unlocking(bibleKey, async () => {
        let jsonData = await bibleJSONCacheManager.get(bibleKey);
        if (jsonData !== null) {
            return jsonData;
        }
        const title = tran('Loading Bible Data');
        showProgressBar(title);
        const backupData = await getBackupBibleXMLData(
            bibleKey,
            ALL_DATA_FILE_NAME,
        );
        if (backupData !== null) {
            hideProgressBar(title);
            await bibleJSONCacheManager.set(bibleKey, backupData);
            return backupData as BibleXMLJsonType;
        }
        jsonData = await getBibleXMLDataFromKey(bibleKey);
        hideProgressBar(title);
        if (jsonData !== null) {
            setBackupBibleXMLData(bibleKey, ALL_DATA_FILE_NAME, jsonData);
            await bibleJSONCacheManager.set(bibleKey, jsonData);
            return jsonData;
        }
        return null;
    });
}

/**
 * Where the parsed copies of a bible live: `<biblesDir>/<KEY>.xml.cache`.
 *
 * Derived from the KEY, never from the file's actual name, so a bible kept as
 * `my-kjv.xml` still caches under `KJV.xml.cache` — and, more to the point, so
 * this path can be resolved without the `getAllXMLFileKeys` folder scan, which
 * reads the head of every installed XML.
 */
async function getBibleXMLCachedBasePath(bibleKey: string) {
    const filePath = await bibleKeyToXMLFilePath(bibleKey, true);
    if (filePath === null) {
        return null;
    }
    return `${filePath}.cache`;
}

export async function ensureBibleXMLCachedBasePath(bibleKey: string) {
    const dirPath = await getBibleXMLCachedBasePath(bibleKey);
    if (dirPath === null) {
        return null;
    }
    await ensureDirectory(dirPath);
    return dirPath;
}

/**
 * Drop every parsed copy of a bible: this window's in-memory JSON and the whole
 * `<KEY>.xml.cache` folder — the `all` blob, the per-chapter blobs and the find
 * database. Call it whenever the XML behind the key is created, updated,
 * deleted or reset; a cached blob is only ever a re-parse away.
 *
 * The in-memory drop is NOT optional: that entry outlives the folder, and the
 * next read would write the very same stale JSON straight back into a fresh
 * `all` blob that then stands for a week.
 *
 * The folder is left deleted rather than re-created: every writer goes through
 * `ensureBibleXMLCachedBasePath`, so a still-installed bible rebuilds it on its
 * next cached write, and a deleted one leaves nothing behind.
 */
export async function clearBibleXMLCache(bibleKey: string) {
    await bibleJSONCacheManager.delete(bibleKey);
    const basePath = await getBibleXMLCachedBasePath(bibleKey);
    if (basePath === null) {
        return;
    }
    try {
        await fsDeleteDir(basePath);
    } catch (error) {
        handleError(error);
    }
}

async function getBackupBibleXMLData(
    bibleKey: string,
    fileName: string,
    validateData: SchemaNode | null = null,
) {
    // A read has no business creating the folder — that would litter one back
    // beside a bible that was just deleted, and costs a syscall per lookup.
    const basePath = await getBibleXMLCachedBasePath(bibleKey);
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
            if (validateData !== null) {
                const validatedData = validateData.validate(backData);
                if (!validatedData.valid) {
                    handleError(validatedData.errors);
                    return null;
                }
            }
            return backData;
        } catch (_error) {}
    }
    return null;
}

async function setBackupBibleXMLData<T>(
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

function checkIsMatchBookChapterKey(verseKey: string, bookChapterKey: string) {
    return verseKey.split(':')[0] === bookChapterKey;
}
export async function readBibleXMLData(
    bibleKey: string,
    fileName: string,
): Promise<BibleInfoType | BibleChapterType | null> {
    const validateData =
        fileName === '_info'
            ? infoEditorSchemaHandler
            : bookChapterEditorSchemaHandler;
    const backupData = await getBackupBibleXMLData(
        bibleKey,
        fileName,
        validateData,
    );
    if (backupData !== null) {
        return backupData;
    }
    const jsonData = await getBibleXMLDataFromKeyCaching(bibleKey);
    if (jsonData === null) {
        return null;
    }
    const bibleInfo = jsonData.info;
    if (fileName === '_info') {
        return setBackupBibleXMLData<BibleInfoType>(
            bibleKey,
            fileName,
            bibleInfo,
        );
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
    return setBackupBibleXMLData<BibleChapterType>(bibleKey, fileName, {
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
        showSimpleToast(
            tran('Error'),
            tran('Error occurred during saving to XML'),
        );
        return false;
    }
    await saveXMLText(bibleKey, xmlText);
    await clearBibleXMLCache(bibleKey);
    return true;
}

/**
 * Overwrite an installed KJV XML file with the app-embedded copy, discarding
 * whatever the operator had edited into it.
 *
 * Takes the row's own `filePath` rather than resolving the key: a KJV kept
 * under a different file name must be replaced IN PLACE, otherwise the write
 * would land on `<dir>/KJV.xml` and leave two files claiming the same key.
 * Shares `initKJVBible`'s lock so a first-run creation and a reset can never
 * write the same data at once.
 */
export async function resetBibleXMLToEmbeddedKJV(filePath: string) {
    return await unlocking('init-kjv-xml-file', async () => {
        const xmlText = await genEmbeddedKJVBibleXMLText();
        if (xmlText === null) {
            showSimpleToast(
                tran('Reset Bible XML'),
                tran('Failed to convert KJV Bible data to XML text.'),
            );
            return false;
        }
        const fileSource = FileSource.getInstance(filePath);
        if (!(await fileSource.writeFileData(xmlText))) {
            return false;
        }
        // The parsed copies outlive the file itself: the `.cache` folder beside
        // it is on disk, and this key may already sit in the in-memory map.
        // Left alone, both would keep serving the data just replaced.
        await clearBibleXMLCache(BIBLE_KJV_KEY);
        return true;
    });
}

export async function deleteBibleXML(bibleKey: string) {
    const filePath = await bibleKeyToXMLFilePath(bibleKey);
    if (filePath === null) {
        return;
    }
    const fileSource = FileSource.getInstance(filePath);
    await fileSource.trash();
    // The folder sits BESIDE the file, so trashing the XML leaves it behind.
    // Left there it would still answer for this key the moment a bible with the
    // same key is imported or re-created.
    await clearBibleXMLCache(bibleKey);
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
        showSimpleToast(
            tran('Error'),
            tran('Error occurred during reading file'),
        );
        return false;
    }
    newBibleInfo.keyBookMap = newBibleInfo.keyBookMap ?? getModelKeyBookMap();
    const newJsonData = { ...dataJson, info: newBibleInfo };
    await saveJsonDataToXMLfile(newJsonData, oldBibleInfo.key);
    // The save clears the OLD key's folder, the one named after the file it
    // wrote. A renamed key answers out of `<NEW KEY>.xml.cache` from here on,
    // which may still hold whatever bible last carried that key.
    if (newBibleInfo.key !== oldBibleInfo.key) {
        await clearBibleXMLCache(newBibleInfo.key);
    }
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
