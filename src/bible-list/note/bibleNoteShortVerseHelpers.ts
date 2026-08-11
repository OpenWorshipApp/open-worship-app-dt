import type * as BibleNoteModule from 'bible-note';

import { useSyncExternalStore } from 'react';

import { dirSourceSettingNames } from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import {
    escapeSelectorValue,
    notifyElementHighlight,
} from '../../helper/domHelpers';
import FileSource, {
    type FileSourcePathEventDataType,
} from '../../helper/FileSource';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import { pathSeparator } from '../../server/fileHelpers';
import Note from './Note';
import { type NoteItemType } from './noteItemHelpers';

export type NoteItemShortVersesType = {
    id: number;
    shortVerses: string[];
};

/** `"GEN 3:3": ["<note file path>@<note item id>", ...]` */
export type ShortVerseNoteRefsType = Record<string, string[]>;

/**
 * `bible-note` is resolved ON DEMAND, and only once something is actually going
 * to be scanned — a static import would pull the whole note editor (lexical,
 * excalidraw, katex) into the eager chunk of every window that reads a verse.
 *
 * The promise is kept, not the module: note files are read concurrently, and
 * one shared promise is what makes that one resolution instead of one per file.
 */
let bibleNoteModulePromise: Promise<typeof BibleNoteModule> | null = null;
function getBibleNoteModule() {
    bibleNoteModulePromise ??= import('bible-note');
    return bibleNoteModulePromise;
}

/**
 * The note file is read RAW instead of through `Note.fromFilePath`: only
 * `content` and the item id are wanted here, and instantiating every `NoteItem`
 * of every note file would build a whole object graph just to throw it away.
 */
async function readNoteShortVerses(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    const data = await fileSource.readFileJsonData();
    const items = data?.items;
    if (!Array.isArray(items)) {
        return [];
    }
    const validItems = items.filter((item: NoteItemType) => {
        return (
            typeof item?.content === 'string' &&
            typeof item.metadata?.id === 'number'
        );
    });
    if (validItems.length === 0) {
        return [];
    }
    const { BibleNote } = await getBibleNoteModule();
    return validItems.map((item: NoteItemType): NoteItemShortVersesType => {
        return {
            id: item.metadata.id,
            shortVerses: BibleNote.getAllShortVersesFromText(item.content),
        };
    });
}

/**
 * Every short verse reference (`GEN 1:1`) the bible notes mention, keyed by note
 * file path, then listed per note item id.
 */
export async function getShortVerses() {
    const dirSource = await DirSource.getInstance(
        dirSourceSettingNames.BIBLE_NOTES,
    );
    const bibleNoteFilePaths =
        (await dirSource.getFilePaths(Note.mimetypeName)) ?? [];
    const noteEntries = await Promise.all(
        bibleNoteFilePaths.map(async (filePath) => {
            return [filePath, await readNoteShortVerses(filePath)] as const;
        }),
    );
    return Object.fromEntries(noteEntries);
}

// One string, so a whole list of them survives a trip through a DOM attribute.
const NOTE_REF_SEPARATOR = '@';

export function toBibleNoteRef(filePath: string, noteItemId: number) {
    return `${filePath}${NOTE_REF_SEPARATOR}${noteItemId}`;
}

/**
 * Split on the LAST separator: a note may well live under a directory whose name
 * contains an `@`, and the id never does.
 */
export function fromBibleNoteRef(bibleNoteRef: string) {
    const index = bibleNoteRef.lastIndexOf(NOTE_REF_SEPARATOR);
    if (index < 1) {
        return null;
    }
    const noteItemId = Number.parseInt(bibleNoteRef.substring(index + 1));
    if (Number.isNaN(noteItemId)) {
        return null;
    }
    return { filePath: bibleNoteRef.substring(0, index), noteItemId };
}

/**
 * Turn "which verses does each note item mention?" inside out into "which note
 * items mention this verse?".
 *
 * That is the question the reader asks — once per verse on screen, dozens of
 * times per chapter — and the raw map answers it only by walking all of it.
 */
export function toShortVerseNoteRefs(
    shortVersesMap: Record<string, NoteItemShortVersesType[]>,
) {
    const shortVerseNoteRefs: ShortVerseNoteRefsType = {};
    for (const [filePath, noteItemShortVersesList] of Object.entries(
        shortVersesMap,
    )) {
        for (const { id, shortVerses } of noteItemShortVersesList) {
            const bibleNoteRef = toBibleNoteRef(filePath, id);
            for (const shortVerse of shortVerses) {
                shortVerseNoteRefs[shortVerse] ??= [];
                shortVerseNoteRefs[shortVerse].push(bibleNoteRef);
            }
        }
    }
    return shortVerseNoteRefs;
}

/**
 * ONE index for the whole window, however many verses are on screen.
 *
 * `RenderVerseTextComp` is mounted once per VERSE — a chapter is dozens of them
 * — so a per-instance load would read and scan every note file dozens of times
 * over, and a per-instance file subscription would do all of it again on every
 * save. Hence one store, one subscription, one debounce, N subscribers; and the
 * debounce is deliberately module-level, because the store it guards is
 * singleton by construction rather than by how many components happen to exist.
 *
 * Nothing is held once the last verse unmounts: the index is only worth what the
 * screen is currently showing, and a fresh one is a single read away.
 */
const EMPTY_SHORT_VERSE_NOTE_REFS: ShortVerseNoteRefsType = {};
let shortVerseNoteRefs = EMPTY_SHORT_VERSE_NOTE_REFS;
const listeners = new Set<() => void>();
let unregisterFileUpdates: (() => void) | null = null;
const attemptTimeout = genTimeoutAttempt(500);

function notifyListeners() {
    for (const listener of listeners) {
        listener();
    }
}

async function refreshShortVerseNoteRefs() {
    const newShortVerseNoteRefs = toShortVerseNoteRefs(await getShortVerses());
    if (listeners.size === 0) {
        return;
    }
    shortVerseNoteRefs = newShortVerseNoteRefs;
    notifyListeners();
}

/**
 * The path comes off the `:with-path` channel, NOT off the listener's plain
 * `data`: the unscoped `update` event hands on whatever the firing code passed,
 * which is `undefined` for `writeFileData` and an `{isHistoryEditing}` object
 * for an editing-history write. Reading a path out of that argument meant this
 * filter never matched a note save (so the index never refreshed) and threw
 * outright on the history payload.
 */
async function handleFileUpdating({
    filePath,
}: FileSourcePathEventDataType<unknown>) {
    const dirSource = await DirSource.getInstance(
        dirSourceSettingNames.BIBLE_NOTES,
    );
    const { dirPath } = dirSource;
    // `dirPath` is '' when the directory is not set, never null
    if (
        !dirPath ||
        typeof filePath !== 'string' ||
        !filePath.startsWith(dirPath + pathSeparator)
    ) {
        return;
    }
    attemptTimeout(() => {
        refreshShortVerseNoteRefs();
    });
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1) {
        const registeredEvents = FileSource.registerFileSourcePathEventListener(
            ['update'],
            handleFileUpdating,
        );
        unregisterFileUpdates = () => {
            FileSource.unregisterEventListener(registeredEvents);
        };
        refreshShortVerseNoteRefs();
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size > 0) {
            return;
        }
        unregisterFileUpdates?.();
        unregisterFileUpdates = null;
        shortVerseNoteRefs = EMPTY_SHORT_VERSE_NOTE_REFS;
    };
}

function getSnapshot() {
    return shortVerseNoteRefs;
}

/** `"GEN 3:3": ["<note file path>@<note item id>", ...]` for every verse. */
export function useShortBibleNoteVerses() {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Flashes the element where it is instead of scrolling to it: everything after
// the first match, so several notes of one verse do not fight over the viewport.
function keepInPlace() {}

function highlightBibleNoteFile(fileSource: FileSource, isMoving: boolean) {
    notifyElementHighlight(
        () => {
            return document.querySelector(
                `[data-file-item-file-src=` +
                    `"${escapeSelectorValue(fileSource.src)}"]`,
            );
        },
        isMoving ? {} : { moveToView: keepInPlace },
    );
}

function highlightBibleNoteItem(
    fileSource: FileSource,
    noteItemId: number,
    isMoving: boolean,
) {
    const itemKey = escapeSelectorValue(`${fileSource.name}-${noteItemId}`);
    notifyElementHighlight(
        () => {
            return document.querySelector(`[data-note-item-id="${itemKey}"]`);
        },
        isMoving ? {} : { moveToView: keepInPlace },
    );
}

/**
 * A collapsed note file renders none of its items, so the item element the
 * caller wants pointed at does not exist yet. Opening the file is what the
 * accordion header does, and `notifyElementHighlight` polls for a few seconds —
 * long enough for the list to re-render off the resulting file update.
 */
async function openBibleNoteFile(filePath: string) {
    const note = await Note.fromFilePath(filePath);
    if (note === null || note.isOpened) {
        return;
    }
    await note.setIsOpened(true);
}

/**
 * Point at the given bible notes in the Bible Notes list: the note FILE row and
 * the note ITEM inside it, both flashed, the first of each scrolled into view.
 *
 * Takes the refs the verse already carries rather than a verse to go looking
 * for: the index the reader is holding is the same answer, and re-reading every
 * note file on a click is the one thing worth not doing here.
 */
export async function revealBibleNoteRefs(bibleNoteRefs: string[]) {
    // grouped, so a note file holding two matching items is opened once
    const noteItemIdsMap = new Map<string, number[]>();
    for (const bibleNoteRef of bibleNoteRefs) {
        const parsedRef = fromBibleNoteRef(bibleNoteRef);
        if (parsedRef === null) {
            continue;
        }
        const { filePath, noteItemId } = parsedRef;
        const noteItemIds = noteItemIdsMap.get(filePath) ?? [];
        noteItemIds.push(noteItemId);
        noteItemIdsMap.set(filePath, noteItemIds);
    }
    let isFirstFile = true;
    let isFirstItem = true;
    for (const [filePath, noteItemIds] of noteItemIdsMap) {
        const fileSource = FileSource.getInstance(filePath);
        highlightBibleNoteFile(fileSource, isFirstFile);
        isFirstFile = false;
        await openBibleNoteFile(filePath);
        for (const noteItemId of noteItemIds) {
            highlightBibleNoteItem(fileSource, noteItemId, isFirstItem);
            isFirstItem = false;
        }
    }
    return noteItemIdsMap.size;
}
