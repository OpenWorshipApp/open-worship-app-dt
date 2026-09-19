import { use, useCallback, useState } from 'react';

import { BibleItemsViewControllerContext } from '../bible-reader/BibleItemsViewController';
import VerseAnnotationLineComp from '../bible-list/note/VerseAnnotationLineComp';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import { tran } from '../lang/langHelpers';
import type {
    ResourceNoteItemsResultType,
    ResourceNoteRowType,
    ResourceVerseCommentType,
    ResourceVerseHighlightType,
    ResourceVerseRowType,
} from './resourcePreviewHelpers';
import { readResourceNoteItems } from './resourcePreviewHelpers';

const FAILURE_MESSAGE_MAP = {
    'not-a-note': 'Not a bible note file',
    'too-large': 'This file is too large to preview',
    unreadable: 'Cannot read this file',
} as const;

/**
 * One note inside a note file. Pressing it opens the Bible Note window on it,
 * READ-ONLY: a file on this shelf belongs wherever it was found, and is not
 * the user's own Bible Notes to write into.
 *
 * A `<button>`, like a link row, so a press has exactly one behaviour.
 */
function ResourcesNoteRowComp({
    filePath,
    noteItem,
}: Readonly<{ filePath: string; noteItem: ResourceNoteRowType }>) {
    const filePathRef = useAppCurrentRef(filePath);
    const noteItemRef = useAppCurrentRef(noteItem);
    const handleOpening = useCallback(async () => {
        // Loaded at the press: the lookup panel carries no window helpers for
        // a note nobody opens.
        const { openBibleNotePreview } =
            await import('./resourcePreviewOpenHelpers');
        openBibleNotePreview(filePathRef.current, noteItemRef.current.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleOpeningSync = useCallback(() => {
        void handleOpening();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const title = noteItem.title || tran('No title');
    return (
        <div className="app-resources-link-row">
            <button
                className="app-resources-link app-resources-note-item app-caught-hover-pointer"
                type="button"
                title={`${title} (${tran('Read-only')})`}
                onClick={handleOpeningSync}
            >
                <i className="bi bi-journal app-resources-link-icon" />
                <span
                    className={
                        'app-resources-link-title app-ellipsis' +
                        (noteItem.title ? '' : ' fst-italic')
                    }
                >
                    {title}
                </span>
            </button>
        </div>
    );
}

/**
 * One highlight or comment under its verse, drawn as the Bible Notes panel
 * draws it. Pressing it goes TO the verse, as it does there -- opened as
 * another bible view beside the passage being read. Nothing else: no recolour,
 * no edit, no delete, because the file is not the user's own Bible Notes.
 */
function ResourcesVerseMarkRowComp({
    verseKey,
    annotation,
}: Readonly<{
    verseKey: string;
    annotation: ResourceVerseHighlightType | ResourceVerseCommentType;
}>) {
    const viewController = use(BibleItemsViewControllerContext);
    const viewControllerRef = useAppCurrentRef(viewController);
    const verseKeyRef = useAppCurrentRef(verseKey);
    const handleOpening = useCallback(async () => {
        const currentViewController = viewControllerRef.current;
        if (currentViewController === null) {
            return;
        }
        // Loaded at the press: it carries the note file writers with it.
        const { openVerseBibleItem, toVerseBibleItem } =
            await import('../bible-reader/verseAnnotationActionHelpers');
        const bibleItem = toVerseBibleItem(verseKeyRef.current);
        if (bibleItem === null) {
            return;
        }
        openVerseBibleItem(currentViewController, bibleItem);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleOpeningSync = useCallback(() => {
        void handleOpening();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="app-resources-link-row">
            <button
                className={
                    'app-resources-link app-resources-note-item' +
                    ' app-resources-verse-mark app-caught-hover-pointer'
                }
                type="button"
                title={tran('Click to open the verse')}
                onClick={handleOpeningSync}
            >
                <VerseAnnotationLineComp annotation={annotation} />
            </button>
        </div>
    );
}

/**
 * A verse marked in the file, holding every highlight and comment made on it,
 * as the Bible Notes panel lists it. Open or folded as the file itself says;
 * folding it here is not written back.
 */
function ResourcesVerseRowComp({
    verseRow,
}: Readonly<{ verseRow: ResourceVerseRowType }>) {
    const [isOpened, setIsOpened] = useState(verseRow.isOpened);
    const isOpenedRef = useAppCurrentRef(isOpened);
    const handleToggling = useCallback(() => {
        setIsOpened(!isOpenedRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // The reference, the marked words and what was written about them all
    // belong to one translation, so its face is set once on the whole block.
    const fontFamily = useBibleFontFamily(verseRow.bibleKey);
    const { highlights, comments } = verseRow;
    return (
        <div className="app-resources-verse-item" style={{ fontFamily }}>
            <div className="app-resources-link-row">
                <button
                    className="app-resources-link app-resources-note-item app-caught-hover-pointer"
                    type="button"
                    title={verseRow.title}
                    aria-expanded={isOpened}
                    onClick={handleToggling}
                >
                    <i
                        className={
                            'app-resources-file-chevron bi bi-chevron-' +
                            (isOpened ? 'down' : 'right')
                        }
                    />
                    <i className="bi bi-highlighter app-resources-link-icon" />
                    <span className="app-resources-link-title app-resources-verse-title app-ellipsis">
                        {verseRow.title}
                    </span>
                    {/* Folded only: open, the marks are the count. */}
                    {isOpened ? null : (
                        <span className="app-resources-verse-count">
                            {highlights.length + comments.length}
                        </span>
                    )}
                </button>
            </div>
            {isOpened ? (
                <div className="app-resources-links">
                    {[...highlights, ...comments].map((annotation) => {
                        return (
                            <ResourcesVerseMarkRowComp
                                key={annotation.id}
                                verseKey={verseRow.verseKey}
                                annotation={annotation}
                            />
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

/**
 * What one `.own` file holds, drawn under its row: its notes, and the verses
 * marked in it with their highlights and comments, in the file's own order.
 *
 * The file is read HERE, on mount, which is when the row is opened -- never as
 * the row appears -- and re-read every time it is opened again, so something
 * added since shows. Only titles and marked words are kept, and folding the row
 * away unmounts this and lets go of them.
 */
export default function ResourcesFileNotesComp({
    filePath,
}: Readonly<{ filePath: string }>) {
    const [result, setResult] = useState<ResourceNoteItemsResultType | null>(
        null,
    );
    useAppEffect(() => {
        let isCancelled = false;
        readResourceNoteItems(filePath).then((newResult) => {
            if (!isCancelled) {
                setResult(newResult);
            }
        });
        return () => {
            isCancelled = true;
        };
    }, [filePath]);
    if (result === null) {
        return null;
    }
    const { items, failureReason } = result;
    return (
        <div className="app-resources-links">
            {items.map((noteItem) => {
                // Notes and verses share one id space in a file.
                if (noteItem.kind === 'verse') {
                    return (
                        <ResourcesVerseRowComp
                            key={noteItem.id}
                            verseRow={noteItem}
                        />
                    );
                }
                return (
                    <ResourcesNoteRowComp
                        key={noteItem.id}
                        filePath={filePath}
                        noteItem={noteItem}
                    />
                );
            })}
            {failureReason !== null ? (
                <div className="app-resources-note text-warning app-ellipsis">
                    <i className="bi bi-exclamation-triangle pe-1" />
                    {tran(FAILURE_MESSAGE_MAP[failureReason])}
                </div>
            ) : items.length === 0 ? (
                <div className="app-resources-note app-ellipsis">
                    {tran('No notes')}
                </div>
            ) : null}
        </div>
    );
}
