import { showSimpleToast } from '../../toast/toastHelpers';
import { handleError } from '../../helper/errorHelpers';
import appProvider from '../../server/appProvider';
import { writeStreamToFile } from '../../helper/bible-helpers/downloadHelpers';
import {
    getUserWritablePath,
    showExplorer,
    trashFile,
} from '../../server/appHelpers';
import {
    fsDeleteFile,
    fsReadFile,
    fsWriteFile,
    pathJoin,
} from '../../server/fileHelpers';
import { allLocalesMap } from '../../lang';
import { showAppInput } from '../../popup-widget/popupWidgetHelpers';
import {
    genBibleBooksMapXMLInput,
    genBibleNumbersMapXMLInput,
} from './bibleXMLAttributesGuessing';
import { getBibleInfo } from '../../helper/bible-helpers/bibleInfoHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../../others/AppContextMenuComp';
import { useState, useTransition } from 'react';
import { useAppEffect } from '../../helper/debuggerHelpers';
import BibleDatabaseController from '../../helper/bible-helpers/BibleDatabaseController';
import { toBibleFileName } from '../../helper/bible-helpers/serverBibleHelpers';
import {
    bibleKeyToFilePath,
    BibleJsonInfoType,
    BibleJsonType,
    jsonToXMLText,
    xmlToJson,
    xmlTextToBibleElement,
    getBibleInfoJson,
    getAllXMLFileKeys,
} from './bibleXMLJsonDataHelpers';
import {
    bibleDataReader,
    BibleInfoType,
} from '../../helper/bible-helpers/BibleDataReader';

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
            resolve(event1.target?.result?.toString() ?? null);
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
        const userWritablePath = getUserWritablePath();
        let fileFullName = appProvider.pathUtils.basename(url.pathname);
        if (fileFullName.endsWith('.xml') === false) {
            fileFullName += '.xml';
        }
        const filePath = appProvider.pathUtils.resolve(
            userWritablePath,
            'temp-xml',
            fileFullName,
        );
        await downloadXMLToFile(filePath, response, messageCallback);
        messageCallback('Reading file...');
        const xmlText = await fsReadFile(filePath);
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
    } catch (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        error
    ) {
        return false;
    }
}

export async function getBibleXMLInfo(bibleKey: string) {
    const filePath = await bibleKeyToFilePath(bibleKey);
    const xmlText = await fsReadFile(filePath);
    const bible = xmlTextToBibleElement(xmlText);
    if (!bible) {
        return null;
    }
    return await getBibleInfoJson(bible);
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
    const filePath = await bibleKeyToFilePath(bibleKey);
    await fsWriteFile(filePath, xmlText);
}

export function handBibleKeyContextMenuOpening(bibleKey: string, event: any) {
    const contextMenuItems: ContextMenuItemType[] = [
        {
            menuTitle: `Reveal in ${
                appProvider.systemUtils.isMac ? 'Finder' : 'File Explorer'
            }`,
            onClick: async () => {
                const filePath = await bibleKeyToFilePath(bibleKey);
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
            menuTitle: 'Chose Locale',
            onClick: () => {
                showAppContextMenu(
                    event,
                    Object.entries(allLocalesMap).map(([locale]) => {
                        return {
                            menuTitle: locale,
                            onClick: () => {
                                setBibleInfo({
                                    ...bibleInfo,
                                    locale,
                                });
                            },
                        };
                    }),
                );
            },
        },
        {
            menuTitle: 'Edit Numbers Map',
            onClick: async () => {
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
            menuTitle: 'Edit Books Map',
            onClick: async () => {
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
            menuTitle: 'Copy to Clipboard',
            onClick: () => {
                navigator.clipboard.writeText(
                    JSON.stringify(bibleInfo, null, 2),
                );
                showSimpleToast('Copied', 'Bible info copied');
            },
        },
    ];
    showAppContextMenu(event, contextMenuItems);
}

export async function cacheBibleXMLData(jsonData: BibleJsonType) {
    const databaseController = await BibleDatabaseController.getInstance();
    const bibleInfo = jsonData.info;
    const bibleKey = bibleInfo.key;
    const biblePath = await bibleDataReader.toBiblePath(bibleKey);
    if (biblePath === null) {
        return false;
    }
    const addItem = async (fileName: string, data: string) => {
        const filePath = pathJoin(biblePath, fileName);
        const b64Data = appProvider.appUtils.base64Encode(data);
        await databaseController.addItem({
            id: filePath,
            data: b64Data,
            isForceOverride: true,
            secondaryId: bibleKey,
        });
    };
    await addItem(
        '_info',
        JSON.stringify({
            ...bibleInfo,
            books: bibleInfo.booksMap,
            numList: Array.from(
                {
                    length: 10,
                },
                (_, i) => bibleInfo.numbersMap?.[i],
            ),
        } as BibleInfoType),
    );
    for (const [bookKey, book] of Object.entries(jsonData.books)) {
        const bookName = bibleInfo.booksMap[bookKey];
        for (const [chapterKey, verses] of Object.entries(book)) {
            const chapterNumber = parseInt(chapterKey);
            const fileName = toBibleFileName(bookKey, chapterNumber);
            await addItem(
                fileName,
                JSON.stringify({
                    title: `${bookName} ${chapterKey}`,
                    verses,
                }),
            );
        }
    }
    return true;
}

export async function saveJsonDataToXMLfile(jsonData: BibleJsonType) {
    const xmlText = jsonToXMLText(jsonData);
    if (xmlText === null) {
        showSimpleToast('Error', 'Error occurred during saving to XML');
        return false;
    }
    await cacheBibleXMLData(jsonData);
    await saveXMLText(jsonData.info.key, xmlText);
    return true;
}

export async function deleteBibleXML(bibleKey: string) {
    await bibleDataReader.clearBibleDatabaseData(bibleKey);
    const filePath = await bibleKeyToFilePath(bibleKey);
    await trashFile(filePath);
}

export async function getBibleXMLDataFromKey(bibleKey: string) {
    const filePath = await bibleKeyToFilePath(bibleKey);
    const xmlText = await fsReadFile(filePath);
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
