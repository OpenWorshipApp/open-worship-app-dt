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
import {
    type NoteItemType,
    type VerseCommentType,
    type VerseHighlightType,
    toValidVerseComments,
    toValidVerseHighlights,
} from './noteItemHelpers';
import type {
    VerseAnnotationsMapType,
    VerseAnnotationsType,
} from './verseAnnotationHelpers';

export type NoteItemShortVersesType = {
    id: number;
    shortVerses: string[];
};

/** `"GEN 3:3": ["<note file path>@<note item id>", ...]` */
export type ShortVerseNoteRefsType = Record<string, string[]>;

type NoteVerseItemType = {
    id: number;
    verseKey: string;
    highlights: VerseHighlightType[];
    comments: VerseCommentType[];
};

/** What ONE pass over one note file yields — enough for both indexes. */
type NoteFileScanType = {
    shortVersesList: NoteItemShortVersesType[];
    verseItems: NoteVerseItemType[];
};

const EMPTY_NOTE_FILE_SCAN: NoteFileScanType = {
    shortVersesList: [],
    verseItems: [],
};

/**
 * `"(KJV) GEN 22:1"` → `"GEN 22:1"`.
 *
 * A pure slice, not a lookup: `bibleRenderHelper.toBibleVersesKey` builds the
 * key as `` `(${bibleKey}) ${kjvVersesKey}` ``, so the verse half is already KJV
 * coordinates whatever the bible key is.
 */
function toShortVerseFromVerseKey(verseKey: string) {
    const index = verseKey.indexOf(') ');
    return index === -1 ? null : verseKey.slice(index + 2);
}

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
 * The note file is read RAW instead of through `Note.fromFilePath`: only the
 * item id, its `content` and — for a verse item — its marks are wanted here, and
 * instantiating every `NoteItem` of every note file would build a whole object
 * graph just to throw it away.
 *
 * ONE pass feeds BOTH indexes, because they come from the same bytes and reading
 * every note file twice is the one thing worth not doing here.
 */
async function readNoteFileScan(filePath: string): Promise<NoteFileScanType> {
    const fileSource = FileSource.getInstance(filePath);
    const data = await fileSource.readFileJsonData();
    const items = data?.items;
    if (!Array.isArray(items)) {
        return EMPTY_NOTE_FILE_SCAN;
    }
    const verseItems: NoteVerseItemType[] = [];
    const plainNoteItems: NoteItemType[] = [];
    for (const item of items as NoteItemType[]) {
        if (typeof item?.metadata?.id !== 'number') {
            continue;
        }
        // Identified by its own `verseKey`, never by an empty `content`: a
        // brand-new ordinary note item is empty too.
        if (typeof item.verseKey === 'string' && item.verseKey !== '') {
            verseItems.push({
                id: item.metadata.id,
                verseKey: item.verseKey,
                highlights: toValidVerseHighlights(item.highlights),
                comments: toValidVerseComments(item.comments),
            });
        } else if (typeof item.content === 'string') {
            plainNoteItems.push(item);
        }
    }
    const shortVersesList: NoteItemShortVersesType[] = [];
    for (const verseItem of verseItems) {
        const shortVerse = toShortVerseFromVerseKey(verseItem.verseKey);
        if (shortVerse !== null) {
            shortVersesList.push({
                id: verseItem.id,
                shortVerses: [shortVerse],
            });
        }
    }
    // The guard is load-bearing, and it is now on the TEXT items alone: a verse
    // item names its verse outright, so a note directory holding only verse
    // items must still never resolve `bible-note`.
    if (plainNoteItems.length > 0) {
        const { BibleNote } = await getBibleNoteModule();
        for (const item of plainNoteItems) {
            shortVersesList.push({
                id: item.metadata.id,
                shortVerses: BibleNote.getAllShortVersesFromText(item.content),
            });
        }
    }
    return { shortVersesList, verseItems };
}

/** One raw pass over every note file, keyed by note file path. */
async function scanNoteFiles() {
    const dirSource = await DirSource.getInstance(
        dirSourceSettingNames.BIBLE_NOTES,
    );
    const bibleNoteFilePaths =
        (await dirSource.getFilePaths(Note.mimetypeName)) ?? [];
    const noteEntries = await Promise.all(
        bibleNoteFilePaths.map(async (filePath) => {
            return [filePath, await readNoteFileScan(filePath)] as const;
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
function toShortVerseNoteRefs(scanMap: Record<string, NoteFileScanType>) {
    const shortVerseNoteRefs: ShortVerseNoteRefsType = {};
    for (const [filePath, { shortVersesList }] of Object.entries(scanMap)) {
        for (const { id, shortVerses } of shortVersesList) {
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
 * Turn the same scan into "what is marked on this verse?", which is what the
 * reader paints.
 *
 * Keyed by the FULL `bibleVersesKey` (`(KJV) GEN 22:1`) rather than by the
 * translation-independent short verse: a mark is a character range in one
 * translation's text, so a KJV mark must never be painted over a Khmer verse.
 */
function toVerseAnnotationsMap(scanMap: Record<string, NoteFileScanType>) {
    const verseAnnotationsMap: VerseAnnotationsMapType = {};
    for (const [filePath, { verseItems }] of Object.entries(scanMap)) {
        for (const { id, verseKey, highlights, comments } of verseItems) {
            if (highlights.length === 0 && comments.length === 0) {
                continue;
            }
            const annotations: VerseAnnotationsType = (verseAnnotationsMap[
                verseKey
            ] ??= { highlights: [], comments: [] });
            for (const highlight of highlights) {
                annotations.highlights.push({
                    filePath,
                    noteItemId: id,
                    highlight,
                });
            }
            for (const comment of comments) {
                annotations.comments.push({
                    filePath,
                    noteItemId: id,
                    comment,
                });
            }
        }
    }
    return verseAnnotationsMap;
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
const EMPTY_VERSE_ANNOTATIONS_MAP: VerseAnnotationsMapType = {};
let shortVerseNoteRefs = EMPTY_SHORT_VERSE_NOTE_REFS;
let verseAnnotationsMap = EMPTY_VERSE_ANNOTATIONS_MAP;
const listeners = new Set<() => void>();
let unregisterFileUpdates: (() => void) | null = null;
const attemptTimeout = genTimeoutAttempt(500);

function notifyListeners() {
    for (const listener of listeners) {
        listener();
    }
}

async function refreshNoteIndexes() {
    const scanMap = await scanNoteFiles();
    const newShortVerseNoteRefs = toShortVerseNoteRefs(scanMap);
    const newVerseAnnotationsMap = toVerseAnnotationsMap(scanMap);
    if (listeners.size === 0) {
        return;
    }
    shortVerseNoteRefs = newShortVerseNoteRefs;
    verseAnnotationsMap = newVerseAnnotationsMap;
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
        refreshNoteIndexes();
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
        refreshNoteIndexes();
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size > 0) {
            return;
        }
        unregisterFileUpdates?.();
        unregisterFileUpdates = null;
        shortVerseNoteRefs = EMPTY_SHORT_VERSE_NOTE_REFS;
        verseAnnotationsMap = EMPTY_VERSE_ANNOTATIONS_MAP;
    };
}

// Both snapshots hand back the module-level reference itself. Building the
// object here instead would hand `useSyncExternalStore` a new identity on every
// read and loop forever.
function getShortVerseNoteRefsSnapshot() {
    return shortVerseNoteRefs;
}

function getVerseAnnotationsMapSnapshot() {
    return verseAnnotationsMap;
}

/** `"GEN 3:3": ["<note file path>@<note item id>", ...]` for every verse. */
export function useShortBibleNoteVerses() {
    return useSyncExternalStore(
        subscribe,
        getShortVerseNoteRefsSnapshot,
        getShortVerseNoteRefsSnapshot,
    );
}

/** `"(KJV) GEN 22:1": { highlights, comments }` for every marked verse. */
export function useBibleVerseAnnotations() {
    return useSyncExternalStore(
        subscribe,
        getVerseAnnotationsMapSnapshot,
        getVerseAnnotationsMapSnapshot,
    );
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
