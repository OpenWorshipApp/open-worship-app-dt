import type { BibleNote } from 'BibleNote.js';

import type { MouseEvent as ReactMouseEvent } from 'react';

import { dirSourceSettingNames } from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import { getParamFileFullName, getParamIdNum } from '../../helper/domHelpers';
import { handleError } from '../../helper/errorHelpers';
import appProvider from '../../server/appProvider';
import { appHomeStorage } from '../../server/appHomeStorage';
import { pathJoin, pathResolve, fsExistSync } from '../../server/fileHelpers';
import Note from './Note';
import type NoteItem from './NoteItem';
import {
    getAllLangsAsync,
    getCurrentLocale,
    initLangCss,
} from '../../lang/langHelpers';
import { showFileOrDirExplorer } from '../../server/appHelpers';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import BibleItem from '../BibleItem';
import { showBibleKeyOption } from '../../bible-lookup/BibleKeySelectionComp';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import { BIBLE_KJV_KEY } from '../../helper/bible-helpers/bibleModelHelpers';
import { getBibleFontFamily } from '../../helper/bible-helpers/bibleStyleHelpers';

export const BIBLE_KEY_SETTING_NAME = 'bible-note-bible-key';
export function getBibleNoteSelectedBibleKey() {
    return getSetting(BIBLE_KEY_SETTING_NAME) || BIBLE_KJV_KEY;
}

const storageManager = {
    deleteSetting(key: string) {
        appHomeStorage.removeItem(key);
    },
    getSetting(key: string) {
        return appHomeStorage.getItem(key);
    },
    setSetting(key: string, value: any) {
        appHomeStorage.setItem(key, value);
    },
};

type LocalFile = Readonly<{
    appFilePath?: unknown;
}>;

async function resolveLocalFilePath(file: LocalFile | null | undefined) {
    const filePath = file?.appFilePath;
    if (typeof filePath !== 'string' || filePath.trim() === '') {
        return null;
    }
    const resolvedFilePath = pathResolve(filePath);
    if (fsExistSync(resolvedFilePath) === false) {
        return null;
    }
    return resolvedFilePath;
}

function revealFile(filePath: string) {
    showFileOrDirExplorer(filePath);
}

export async function getBibleNoteConstructor() {
    let AppBibleNote = (globalThis as any).AppBibleNote;
    while (AppBibleNote === undefined) {
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
        AppBibleNote = (globalThis as any).AppBibleNote;
    }
    return AppBibleNote as typeof BibleNote;
}

async function shortToVerseData(shortVerse: string) {
    // `Genesis 1:1` => {
    //     title: "Genesis 1:1",
    //     fullText: "(1): In the beginning God created the heaven and the earth."
    //     style: { color: 'green' }
    // }
    const bibleItem = await BibleItem.fromTitleText(BIBLE_KJV_KEY, shortVerse);
    if (bibleItem === null) {
        return null;
    }
    const selectedBibleKey = getBibleNoteSelectedBibleKey();
    bibleItem.bibleKey = selectedBibleKey;
    const title = await bibleItem.toTitle();
    const fullText = await bibleItem.toFullText();
    const fontFamily = await getBibleFontFamily(selectedBibleKey);
    const data = { title, fullText, style: { fontFamily } };
    return data;
}

async function verseFullTextToListShorts(verseFullText: string) {
    // `Genesis 1:1-2\n(1): In the beginning God created the heaven and the
    // earth. (2): And the earth was without form, and void; and darkness
    // was upon the face of the deep. And the Spirit of God moved upon the
    // face of the waters.`
    // => ["Genesis 1:1", "Genesis 1:2"]
    let titleWithKey = verseFullText.split('\n')[0];
    titleWithKey = titleWithKey.trim();
    if (titleWithKey === undefined) {
        return null;
    }
    const bibleItem = await BibleItem.fromTitleText(
        BIBLE_KJV_KEY,
        titleWithKey,
    );
    if (bibleItem === null) {
        return null;
    }
    const { target } = bibleItem;
    const startVerse = target.verseStart;
    const endVerse = target.verseEnd;
    const shortVerseList: string[] = [];
    for (let i = startVerse; i <= endVerse; i++) {
        const shortVerse = `${target.bookKey} ${target.chapter}:${i}`;
        shortVerseList.push(shortVerse);
    }
    return shortVerseList;
}

// "(KJV) Genesis 1:1-2"
const titleWithKeyRegex = /^\(\S+\) (.+)$/;
async function changeBibleKey(
    event: ReactMouseEvent<HTMLButtonElement>,
    fullText: string,
) {
    const titleWithKey = fullText.split('\n')[0].trim();
    const match = titleWithKeyRegex.exec(titleWithKey);
    if (match === null) {
        return null;
    }
    const bibleItem = await BibleItem.fromTitleText(
        BIBLE_KJV_KEY,
        titleWithKey,
    );
    if (bibleItem === null) {
        return null;
    }
    const promise = new Promise<string>((resolve) => {
        showBibleKeyOption(
            event,
            (newBibleKey: string) => {
                resolve(newBibleKey);
            },
            [bibleItem.bibleKey],
        );
    });
    const newBibleKey = await promise;
    if (newBibleKey === bibleItem.bibleKey) {
        return null;
    }
    bibleItem.bibleKey = newBibleKey;
    const newTitleWithKey = await bibleItem.toTitleWithBibleKey();
    const newFullText = await bibleItem.toFullText();
    const fontFamily = await getBibleFontFamily(newBibleKey);
    return {
        title: newTitleWithKey,
        fullText: newFullText,
        style: { fontFamily },
    };
}

function excalidrawLoadLibrariesFileList() {
    const libraries = getSetting('excalidraw-libraries');
    if (libraries === null) {
        return [];
    }

    try {
        const parsedLibraries = JSON.parse(libraries);
        return Array.isArray(parsedLibraries)
            ? parsedLibraries.filter(
                  (librariesFile): librariesFile is string =>
                      typeof librariesFile === 'string',
              )
            : [];
    } catch {
        return [];
    }
}
function excalidrawSaveLibrariesFile(librariesFile: string) {
    const existingLibrariesFileList = excalidrawLoadLibrariesFileList();
    if (existingLibrariesFileList.includes(librariesFile)) {
        return;
    }

    const mergedLibrariesFileList = [
        librariesFile,
        ...existingLibrariesFileList,
    ];
    setSetting('excalidraw-libraries', JSON.stringify(mergedLibrariesFileList));
}
function excalidrawClearLibrariesFileList() {
    setSetting('excalidraw-libraries', null);
}

const attemptTimeout = genTimeoutAttempt(1_000);

export async function initBibleNote({
    note,
    noteItem,
}: Readonly<{
    note: Note;
    noteItem: NoteItem;
}>) {
    const langDataList = await getAllLangsAsync();
    const currentLocale = getCurrentLocale();
    for (const langData of langDataList) {
        if (langData.locale === currentLocale) {
            continue;
        }
        initLangCss(langData);
    }
    const stickyNoteExtraFontFamilies = langDataList
        .filter((langData) => {
            return langData.stickyNoteFontFamily !== undefined;
        })
        .map((langData) => langData.stickyNoteFontFamily!);
    const editorExtraFontFamilies: ReadonlyArray<[string, string]> =
        langDataList
            .filter((langData) => {
                return langData.fontFamily !== undefined;
            })
            .map((langData) => {
                return [langData.fontFamily!, langData.langCode] as [
                    string,
                    string,
                ];
            });

    const getLangCode = (text: string) => {
        const currentLangData = langDataList.find((langData) => {
            if (langData.langCode === 'en') {
                return false;
            }
            return langData.checkIsThisLang(text);
        });
        return currentLangData?.langCode ?? 'en';
    };
    const print = () => {
        appProvider.messageUtils.sendData('all:app:print');
    };

    const AppBibleNote = await getBibleNoteConstructor();
    const bibleNote = new AppBibleNote({
        getLangCode,
        editorExtraFontFamilies,
        loadData: () => {
            return noteItem.content || null;
        },
        saveData: async (data: string) => {
            if (data === noteItem.content) {
                return;
            }
            noteItem.content = data;
            await note.updateAndSaveNoteItem(noteItem, true);
        },
        storageManager: storageManager as any,
        stickyNoteExtraFontFamilies,
        resolveFilePath: resolveLocalFilePath,
        revealFile,
        print,
        isOnApp: true,
        isMinimize: true,
        shortToVerseData,
        verseFullTextToListShorts,
        changeBibleKey,
        excalidrawClearLibrariesFileList,
        excalidrawLoadLibrariesFileList,
        excalidrawSaveLibrariesFile,
    });

    const abortController = new AbortController();
    try {
        appProvider.fileUtils.watch(
            note.filePath,
            {
                signal: abortController.signal,
            },
            async (eventType: string, ..._args: any[]) => {
                if (eventType !== 'change') {
                    return;
                }
                attemptTimeout(async () => {
                    if (bibleNote.getIsFocusing() || document.hasFocus()) {
                        await new Promise((resolve) => {
                            setTimeout(resolve, 3_000);
                        });
                    }
                    await note.reload();
                    const newNoteItem = note.getItemById(noteItem.id);
                    if (
                        newNoteItem === null ||
                        newNoteItem.content === noteItem.content
                    ) {
                        return;
                    }
                    bibleNote.content = newNoteItem.content;
                });
            },
        );
    } catch (error) {
        handleError(error);
    }

    return bibleNote;
}

async function getNoteAndNoteItem() {
    const fileFullName = getParamFileFullName();
    if (fileFullName === null) {
        throw new Error('Note file not specified');
    }
    const dirPath = DirSource.getDirPathBySettingName(
        dirSourceSettingNames.BIBLE_NOTES,
    );
    if (dirPath === null) {
        throw new Error('Note directory not set');
    }
    const filePath = pathJoin(dirPath, fileFullName);
    if (fsExistSync(filePath) === false) {
        throw new Error(`Note file not found: ${fileFullName}`);
    }
    const note = await Note.fromFilePath(filePath);
    if (note === null) {
        throw new Error(`Failed to load note from file: ${fileFullName}`);
    }

    const noteItemId = getParamIdNum();
    if (noteItemId === null) {
        throw new Error('Note item ID not specified');
    }
    const noteItem = note.getItemById(noteItemId);
    if (noteItem === null) {
        throw new Error(`Note item not found: ${noteItemId}`);
    }
    return { note, noteItem };
}

export async function getBibleNoteData() {
    try {
        const data = await getNoteAndNoteItem();
        const { name } = data.note.fileSource;
        const suffix = `${name}: ${data.noteItem.title}`;
        document.title = `${appProvider.windowTitle} - ${suffix}`;
        return data;
    } catch (error) {
        handleError(error);
    }
    return null;
}
