import type { BibleNote } from 'BibleNote.js';

import { dirSourceSettingNames } from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import { getParamFileFullName, getParamIdNum } from '../../helper/domHelpers';
import { handleError } from '../../helper/errorHelpers';
import appProvider from '../../server/appProvider';
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

const storageManager = {
    deleteSetting(key: string) {
        localStorage.removeItem(key);
    },
    getSetting(key: string) {
        return localStorage.getItem(key);
    },
    setSetting(key: string, value: any) {
        localStorage.setItem(key, value);
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

async function getBibleNoteConstructor() {
    let AppBibleNote = (globalThis as any).AppBibleNote;
    while (AppBibleNote === undefined) {
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
        AppBibleNote = (globalThis as any).AppBibleNote;
    }
    return AppBibleNote as typeof BibleNote;
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
                    if (bibleNote.getIsFocusing()) {
                        return;
                    }
                    await note.reload();
                    const newNoteItem = note.getItemById(noteItem.id);
                    if (newNoteItem === null) {
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
        dirSourceSettingNames.NOTES,
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
