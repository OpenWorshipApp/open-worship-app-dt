import {
    BibleNote,
    type BibleNoteProps,
    type FilePathResolver,
} from 'bible-note';

import type { MouseEvent as ReactMouseEvent } from 'react';

import { dirSourceSettingNames } from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import { getParamFileFullName, getParamIdNum } from '../../helper/domHelpers';
import { handleError } from '../../helper/errorHelpers';
import appProvider from '../../server/appProvider';
import { appHomeStorage } from '../../server/appHomeStorage';
import {
    pathBasename,
    pathJoin,
    pathResolve,
    fsExistSync,
} from '../../server/fileHelpers';
import {
    getAppFilePathFromFile,
    type LocalFile,
} from '../../helper/localFileHelpers';
import Note from './Note';
import type NoteItem from './NoteItem';
import {
    DEFAULT_LANG_CODE,
    getAllLangsAsync,
    initAllLangCss,
    tran,
} from '../../lang/langHelpers';
import { getBibleNotePreviewFilePath } from './bibleNotePreviewHelpers';
import { acquireLookupData } from '../../location-name-lookup/lookupDataHelpers';
import { showFileOrDirExplorer } from '../../server/appHelpers';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import BibleItem from '../BibleItem';
import { showBibleKeyOption } from '../../bible-lookup/BibleKeySelectionComp';
import { getSetting } from '../../helper/settingHelpers';
import { genStringListSettingManager } from '../../helper/SettingManager';
import { BIBLE_KJV_KEY } from '../../helper/bible-helpers/bibleModelHelpers';
import { getBibleFontFamily } from '../../helper/bible-helpers/bibleStyleHelpers';

/**
 * A serialized editor state whose root holds NO children at all.
 *
 * Lexical refuses to load one back: `setEditorState` throws on a state whose
 * node map holds the root alone (`Minified Lexical error #38`), and the throw
 * happens inside `LexicalComposer`'s own initialisation -- so the editor tree
 * unmounts and the note window paints NOTHING. That note can never be opened
 * again, whatever is done to it from the list.
 *
 * A childless root is exactly what a note opened and never typed in serializes
 * to: a brand-new item's `content` is `''`, `loadData` therefore hands the
 * composer `null`, and `null` tells the composer to leave the root ALONE rather
 * than seed it with a paragraph -- then the editor's own autosave writes that
 * childless root into the file. So it is normalised to "no content" at BOTH
 * ends: nothing poisonous is ever written, and a file already holding one opens
 * as the empty note it is.
 */
const EMPTY_EDITOR_STATE_MAX_LENGTH = 512;

/**
 * One empty paragraph -- what an editor opened on a blank note must be handed.
 *
 * Handing it `null` instead does NOT mean "start blank" to `LexicalComposer`:
 * it means "leave the root alone", and what `bible-note` then puts in the root
 * is its own Genesis 1 PLAYGROUND DEMO, which the autosave wrote into the
 * user's note. The state has to be a real one, and a real one with a child --
 * a childless root is the state `setEditorState` refuses (above).
 */
const EMPTY_EDITOR_STATE_CONTENT = JSON.stringify({
    root: {
        children: [
            {
                children: [],
                direction: null,
                format: '',
                indent: 0,
                type: 'paragraph',
                version: 1,
            },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
    },
});

/** What a note item's stored text becomes on its way INTO the editor. */
export function toEditorContent(content: string) {
    return checkIsEmptyNoteContent(content)
        ? EMPTY_EDITOR_STATE_CONTENT
        : content;
}

/** And on its way back OUT, where an empty note is stored as no text at all. */
export function toStoredContent(content: string) {
    return checkIsEmptyNoteContent(content) ? '' : content;
}
export function checkIsEmptyNoteContent(content: string) {
    const trimmedContent = content.trim();
    if (trimmedContent === '') {
        return true;
    }
    // An empty state is a fixed handful of root fields and no children, so it
    // can never be long -- anything bigger is content, and parsing a 60KB note
    // on every autosave to learn that is work for nothing.
    if (trimmedContent.length > EMPTY_EDITOR_STATE_MAX_LENGTH) {
        return false;
    }
    try {
        const children = JSON.parse(trimmedContent)?.root?.children;
        return Array.isArray(children) && children.length === 0;
    } catch (_error) {
        // Not this editor's state at all, so not ours to call empty.
        return false;
    }
}

/**
 * How long the editor has to go quiet before its text is written into the
 * editing history. Long enough that a word is one step and one write, short
 * enough that a window closed straight after a sentence still keeps it.
 */
const EDITING_HISTORY_DEBOUNCE_MILLISECOND = 1_000;

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

async function resolveLocalFilePath(file: LocalFile | null | undefined) {
    const filePath = getAppFilePathFromFile(file);
    if (filePath === null) {
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

const excalidrawLibrariesSettingManager = genStringListSettingManager(
    'excalidraw-libraries',
);
function excalidrawLoadLibrariesFileList() {
    return excalidrawLibrariesSettingManager.getSetting();
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
    excalidrawLibrariesSettingManager.setSetting(mergedLibrariesFileList);
}
function excalidrawClearLibrariesFileList() {
    excalidrawLibrariesSettingManager.setSetting([]);
}

export async function initBibleNote({
    note,
    noteItem,
    isReadOnly = false,
}: Readonly<{
    note: Note;
    noteItem: NoteItem;
    /**
     * A preview of a note file from outside the Bible Notes folder
     * (`bibleNotePreviewHelpers.ts`). The editor is locked AND nothing is
     * saved: the lock is the editor's to enforce, and a lock the user can
     * reach is not the only thing standing between a preview and somebody's
     * file on disk -- `saveData` refuses on its own.
     */
    isReadOnly?: boolean;
}>) {
    void initAllLangCss();
    const langDataList = await getAllLangsAsync();
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
            if (langData.langCode === DEFAULT_LANG_CODE) {
                return false;
            }
            return langData.checkIsThisLang(text);
        });
        return currentLangData?.langCode ?? DEFAULT_LANG_CODE;
    };
    const print = () => {
        appProvider.messageUtils.sendData('all:app:print');
    };

    // `acquireLookupData`, NOT `getLookupDataCached`: the raw cache expires 60s
    // after the write, so a note opened past that window used to build a SECOND
    // ~34MB copy of the dataset while the lookup UI still held the first. The
    // note editor needs the managers for as long as it is open, so it takes a
    // reference and simply keeps it — the window closing is what frees it.
    const { namesLookupManager, locationsLookupManager } =
        await acquireLookupData();
    // Per WINDOW, and the editor in it is the only writer: `bible-note` saves
    // on every keystroke, and one history entry per letter is both 600KB of
    // disk for a word and an Undo that walks back one character at a time.
    // Trailing, so what lands is always the newest text.
    const historyAttemptTimeout = genTimeoutAttempt(
        EDITING_HISTORY_DEBOUNCE_MILLISECOND,
    );
    let pendingHistoryItem: NoteItem | null = null;
    const writeEditingHistory = async () => {
        const itemToWrite = pendingHistoryItem;
        if (itemToWrite === null) {
            return;
        }
        pendingHistoryItem = null;
        await note.addItemEditingHistory(itemToWrite);
    };
    // A window closed a moment after the last letter must not lose it. Nothing
    // can be AWAITED here, so this is a best effort on top of the debounce
    // rather than instead of it -- which is why the wait is short.
    const handleUnloading = () => {
        void writeEditingHistory();
    };
    globalThis.addEventListener('beforeunload', handleUnloading);
    globalThis.addEventListener('pagehide', handleUnloading);
    const bibleNoteProps: BibleNoteProps = {
        namesLookupManager,
        locationsLookupManager,
        getLangCode,
        editorExtraFontFamilies,
        loadData: () => {
            return toEditorContent(noteItem.content);
        },
        saveData: async (data: string) => {
            if (isReadOnly) {
                return;
            }
            // Normalised on the way IN as well, so the file never comes to
            // hold the one value the editor refuses to load back.
            const newContent = toStoredContent(data);
            if (newContent === noteItem.content) {
                return;
            }
            noteItem.content = newContent;
            // The EDITING HISTORY, never the file: the editor saves itself
            // constantly and saves whatever state it is in, so a bad moment
            // used to reach the disk with nothing to undo it. The human
            // presses Save.
            note.updateNoteItem(noteItem, true);
            pendingHistoryItem = noteItem;
            historyAttemptTimeout(writeEditingHistory);
        },
        storageManager: storageManager as any,
        stickyNoteExtraFontFamilies,
        resolveFilePath: resolveLocalFilePath as FilePathResolver,
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
    };
    const bibleNote = new BibleNote(bibleNoteProps);
    if (isReadOnly) {
        // Set by the host, which the editor shows as LOCKED: its own read-only
        // toggle cannot be flipped back from inside the window.
        bibleNote.isReadOnly = true;
    }

    // per-note: a module-level shared timer would drop note A's reload when
    // note B changes within the debounce window
    const attemptTimeout = genTimeoutAttempt(1_000);
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
                    // The wait protects typing in progress from being
                    // overwritten; a preview has none, and following the file
                    // as it changes is the point of keeping one open.
                    if (
                        !isReadOnly &&
                        (bibleNote.getIsFocusing() || document.hasFocus())
                    ) {
                        await new Promise((resolve) => {
                            setTimeout(resolve, 3_000);
                        });
                    }
                    // The EDITING head, not the file: an item added or a verse
                    // marked from the list rebases that head onto the new file,
                    // so what comes back here still carries this window's own
                    // unsaved text instead of wiping it.
                    await (isReadOnly ? note.reload() : note.reloadEditing());
                    const newNoteItem = note.getItemById(noteItem.id);
                    if (newNoteItem === null) {
                        return;
                    }
                    // Same normalisation the file is read through: the editor
                    // throws on a childless root here too.
                    const newContent = toStoredContent(newNoteItem.content);
                    if (newContent === noteItem.content) {
                        return;
                    }
                    if (isReadOnly) {
                        // Nothing else moves it on in a preview -- `saveData`
                        // is what does that in an editable window -- so a file
                        // edited back to what it was would otherwise never be
                        // shown again.
                        noteItem.content = newContent;
                    }
                    bibleNote.content = toEditorContent(newContent);
                });
            },
        );
    } catch (error) {
        handleError(error);
    }

    return bibleNote;
}

function getNoteFilePathInNotesDir(url: string) {
    const fileFullName = getParamFileFullName(url);
    if (fileFullName === null) {
        throw new Error('Note file not specified');
    }
    const dirPath = DirSource.getDirPathBySettingName(
        dirSourceSettingNames.BIBLE_NOTES,
    );
    if (dirPath === null) {
        throw new Error('Note directory not set');
    }
    return pathJoin(dirPath, fileFullName);
}

async function getNoteAndNoteItem() {
    const url = globalThis.location.href;
    const previewFilePath = getBibleNotePreviewFilePath(url);
    const isReadOnly = previewFilePath !== null;
    const filePath = previewFilePath ?? getNoteFilePathInNotesDir(url);
    const fileFullName = pathBasename(filePath);
    if (fsExistSync(filePath) === false) {
        throw new Error(`Note file not found: ${fileFullName}`);
    }
    // A preview shows what is SAVED; an editable window opens on its own
    // editing head, so a note closed with unsaved text comes back holding it.
    const note = await (isReadOnly
        ? Note.fromFilePath(filePath)
        : Note.fromFilePathEditing(filePath));
    if (note === null) {
        throw new Error(`Failed to load note from file: ${fileFullName}`);
    }

    const noteItemId = getParamIdNum(globalThis.location.href);
    if (noteItemId === null) {
        throw new Error('Note item ID not specified');
    }
    const noteItem = note.getItemById(noteItemId);
    // A verse item (a verse's highlights and comments) has no editor content,
    // and an editor opened on it would be an empty page.
    if (noteItem === null || noteItem.isVerseItem) {
        throw new Error(`Note item not found: ${noteItemId}`);
    }
    return { note, noteItem, isReadOnly };
}

export async function getBibleNoteData() {
    try {
        const data = await getNoteAndNoteItem();
        const { name } = data.note.fileSource;
        let suffix = `${name}: ${data.noteItem.title}`;
        if (data.isReadOnly) {
            suffix += ` (${tran('Read-only')})`;
        }
        document.title = `${appProvider.windowTitle} - ${suffix}`;
        return data;
    } catch (error) {
        handleError(error);
    }
    return null;
}
