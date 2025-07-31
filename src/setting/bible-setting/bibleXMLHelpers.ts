import { showSimpleToast } from '../../toast/toastHelpers';
import { handleError } from '../../helper/errorHelpers';
import appProvider from '../../server/appProvider';
import { writeStreamToFile } from '../../helper/bible-helpers/downloadHelpers';
import { showExplorer } from '../../server/appHelpers';
import { fsDeleteFile } from '../../server/fileHelpers';
import { allLocalesMap, LocaleType } from '../../lang/langHelpers';
import { showAppInput } from '../../popup-widget/popupWidgetHelpers';
import {
    genBibleBooksMapXMLInput,
    genBibleNumbersMapXMLInput,
} from './bibleXMLAttributesGuessing';
import { getBibleInfo } from '../../helper/bible-helpers/bibleInfoHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import { useState, useTransition } from 'react';
import { useAppEffect } from '../../helper/debuggerHelpers';
import { fromBibleFileName } from '../../helper/bible-helpers/serverBibleHelpers';
import {
    bibleKeyToXMLFilePath,
    BibleJsonInfoType,
    BibleXMLJsonType,
    jsonToXMLText,
    xmlToJson,
    xmlTextToBibleElement,
    getBibleInfoJson,
    getAllXMLFileKeys,
} from './bibleXMLJsonDataHelpers';
import {
    BibleChapterType,
    BibleInfoType,
} from '../../helper/bible-helpers/BibleDataReader';
import FileSource from '../../helper/FileSource';
import { menuTitleRealFile } from '../../helper/helpers';
import { appLocalStorage } from '../directory-setting/appLocalStorage';
import { unlocking } from '../../server/unlockingHelpers';
import CacheManager from '../../others/CacheManager';

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
                    const fileSize = parseInt(total.toFixed(2));
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
    const bibleXMLElement = xmlTextToBibleElement(xmlText);
    if (!bibleXMLElement) {
        return null;
    }
    return await getBibleInfoJson(bibleXMLElement);
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
            menuElement: menuTitleRealFile,
            onSelect: async () => {
                const filePath = await bibleKeyToXMLFilePath(bibleKey);
                if (filePath === null) {
                    return;
                }
                showExplorer(filePath);
            },
        },
    ];
    showAppContextMenu(event, contextMenuItems);
}

export function handBibleInfoContextMenuOpening(
    event: any,
    bibleInfo: BibleJsonInfoType,
    setBibleInfo: (bibleInfo: BibleJsonInfoType) => void,
) {
    const contextMenuItems: ContextMenuItemType[] = [
        {
            menuElement: 'Choose Locale',
            onSelect: () => {
                showAppContextMenu(
                    event,
                    Object.entries(allLocalesMap).map(([locale]) => {
                        return {
                            menuElement: locale,
                            onSelect: () => {
                                setBibleInfo({
                                    ...bibleInfo,
                                    locale: locale as LocaleType,
                                });
                            },
                        };
                    }),
                );
            },
        },
        {
            menuElement: 'Edit Numbers Map',
            onSelect: async () => {
                let numbersMap = Object.keys(bibleInfo.numbersMap);
                const isConfirmInput = await showAppInput(
                    'Numbers map',
                    genBibleNumbersMapXMLInput(
                        numbersMap,
                        bibleInfo.locale,
                        (newNumbers) => {
                            numbersMap = newNumbers;
                        },
                    ),
                );
                if (isConfirmInput) {
                    setBibleInfo({
                        ...bibleInfo,
                        numbersMap: Object.fromEntries(
                            numbersMap.map((value, index) => [
                                index.toString(),
                                value,
                            ]),
                        ),
                    });
                }
            },
        },
        {
            menuElement: 'Edit Books Map',
            onSelect: async () => {
                let booksMap = Object.values(bibleInfo.booksMap);
                const isConfirmInput = await showAppInput(
                    'Books map',
                    genBibleBooksMapXMLInput(
                        booksMap,
                        bibleInfo.locale,
                        (newNumbers) => {
                            booksMap = newNumbers;
                        },
                    ),
                );
                if (isConfirmInput) {
                    setBibleInfo({
                        ...bibleInfo,
                        booksMap: Object.fromEntries(
                            Object.keys(bibleInfo.booksMap).map(
                                (value, index) => [value, booksMap[index]],
                            ),
                        ),
                    });
                }
            },
        },
        {
            menuElement: 'Copy to Clipboard',
            onSelect: () => {
                navigator.clipboard.writeText(
                    JSON.stringify(bibleInfo, null, 2),
                );
                showSimpleToast('Copied', 'Bible info copied');
            },
        },
    ];
    showAppContextMenu(event, contextMenuItems);
}

const bibleJSONCacheManager = new CacheManager<BibleXMLJsonType>(10);
export async function getBibleXMLDataFromKeyCaching(bibleKey: string) {
    return unlocking(bibleKey, async () => {
        let jsonData = await bibleJSONCacheManager.get(bibleKey);
        if (jsonData !== null) {
            return jsonData;
        }
        jsonData = await getBibleXMLDataFromKey(bibleKey);
        if (jsonData !== null) {
            await bibleJSONCacheManager.set(bibleKey, jsonData);
        }
        return jsonData;
    });
}

export async function readBibleXMLData(bibleKey: string, fileName: string) {
    const jsonData = await getBibleXMLDataFromKeyCaching(bibleKey);
    if (jsonData === null) {
        return null;
    }
    const bibleInfo = jsonData.info;
    if (fileName === '_info') {
        return {
            ...bibleInfo,
            books: bibleInfo.booksMap,
            numList: Array.from(
                {
                    length: 10,
                },
                (_, i) => bibleInfo.numbersMap?.[i],
            ),
        } as BibleInfoType;
    }
    const fileNameData = fromBibleFileName(fileName);
    if (fileNameData === null) {
        return null;
    }
    const { bookKey, chapterNum } = fileNameData;
    const book = jsonData.books[bookKey];
    if (!book) {
        return null;
    }
    const chapter = book[chapterNum];
    if (!chapter) {
        return null;
    }
    return {
        title: `${bibleInfo.booksMap[bookKey]} ${chapterNum}`,
        verses: chapter,
    } as BibleChapterType;
}

export async function saveJsonDataToXMLfile(jsonData: BibleXMLJsonType) {
    const xmlText = jsonToXMLText(jsonData);
    if (xmlText === null) {
        showSimpleToast('Error', 'Error occurred during saving to XML');
        return false;
    }
    await saveXMLText(jsonData.info.key, xmlText);
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
    return await xmlToJson(xmlText);
}

export async function updateBibleXMLInfo(bibleInfo: BibleJsonInfoType) {
    const dataJson = await getBibleXMLDataFromKey(bibleInfo.key);
    if (dataJson === null) {
        showSimpleToast('Error', 'Error occurred during reading file');
        return;
    }
    const jsonData = { ...dataJson, info: bibleInfo };
    await saveJsonDataToXMLfile(jsonData);
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
            const keys = await getAllXMLFileKeys();
            setBibleKeysMap(keys);
        });
    };
    useAppEffect(loadBibleKeys, []);
    return { bibleKeysMap, isPending, loadBibleKeys };
}
