import { createContext, use } from 'react';

import BibleItem from './BibleItem';
import {
    checkIsBookAvailable,
    getVerses,
    keyToBook,
} from '../helper/bible-helpers/bibleInfoHelpers';
import {
    extractBibleTitle,
    toInputText,
    toLocaleNumBible,
} from '../helper/bible-helpers/serverBibleHelpers2';
import Bible from './Bible';
import { showSimpleToast } from '../toast/toastHelpers';
import DirSource from '../helper/DirSource';
import FileSource from '../helper/FileSource';
import { addExtension } from '../server/fileHelpers';
import appProvider from '../server/appProvider';
import { VerseList } from '../helper/bible-helpers/BibleDataReader';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';

export const SelectedBibleKeyContext = createContext<string>('KJV');
export function useBibleKeyContext() {
    const bibleKey = use(SelectedBibleKeyContext);
    if (!bibleKey) {
        throw new Error('SelectedBibleKeyContext is not provided');
    }
    return bibleKey;
}

export async function genInputText(
    oldBibleKey: string,
    bibleKey: string,
    inputText: string,
) {
    const { result } = await extractBibleTitle(oldBibleKey, inputText);
    const { bookKey, chapter, bibleItem } = result;
    const target = bibleItem?.target;
    if (bookKey !== null && (await checkIsBookAvailable(bibleKey, bookKey))) {
        const newBook = await keyToBook(bibleKey, bookKey);
        return toInputText(
            bibleKey,
            newBook,
            chapter,
            target?.verseStart,
            target?.verseEnd,
        );
    }
    return inputText;
}

export async function saveBibleItem(bibleItem: BibleItem, onDone?: () => void) {
    if (appProvider.isPageEditor) {
        // TODO: Implement this, find canvasController
        // canvasController.addNewBibleItem(bibleItem);
        return null;
    }
    const savedBibleItem = await Bible.addBibleItemToDefault(bibleItem);
    if (savedBibleItem !== null) {
        showSimpleToast('Adding bible', 'Bible item is added');
        onDone?.();
        return savedBibleItem;
    } else {
        showSimpleToast('Adding bible', 'Fail to add bible to list');
    }
    return null;
}

export type ConsumeVerseType = {
    sVerse: number;
    eVerse: number;
    verses: VerseList;
};
export async function genVerseList({
    bibleKey,
    bookKey,
    chapter,
}: {
    bibleKey: string;
    bookKey: string;
    chapter: number;
}) {
    const verses = await getVerses(bibleKey, bookKey, chapter);
    if (verses === null) {
        return null;
    }
    const verseNumbList = await Promise.all(
        Array.from({ length: Object.keys(verses).length }, (_, i) => {
            return toLocaleNumBible(bibleKey, i + 1);
        }),
    );
    const verseList = verseNumbList.map((verseNumSting, i) => {
        return [i + 1, verseNumSting];
    });
    return verseList.filter(([_, verseNumSting]) => {
        return verseNumSting !== null;
    }) as [number, string][];
}

export async function moveBibleItemTo(
    event: any,
    bible: Bible,
    index?: number,
) {
    const dirSource = await DirSource.getInstance(
        Bible.getDirSourceSettingName(),
    );
    dirSource.getFilePaths('bible').then((filePaths) => {
        const targetNames = (filePaths ?? [])
            .map((filePath) => {
                return FileSource.getInstance(filePath).name;
            })
            .filter((name) => {
                const fileSource = FileSource.getInstance(bible.filePath);
                return name !== fileSource.name;
            });
        if (targetNames.length === 0) {
            showSimpleToast('Move Bible Item', 'No other bibles found');
            return;
        }
        showAppContextMenu(
            event,
            targetNames.map((name) => {
                return {
                    menuElement: name,
                    onSelect: async () => {
                        const bibleFileSource = FileSource.getInstance(
                            bible.filePath,
                        );
                        const { basePath, extension } = bibleFileSource;
                        const fileSource = FileSource.getInstance(
                            basePath,
                            addExtension(name, extension),
                        );
                        const targetBible = await Bible.fromFilePath(
                            fileSource.filePath,
                        );
                        if (!targetBible) {
                            showSimpleToast(
                                'Move Bible Item',
                                'Target bible not found',
                            );
                            return;
                        }
                        targetBible.moveItemFrom(bible.filePath, index);
                    },
                };
            }),
        );
    });
}
