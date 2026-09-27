import './BibleNoteEditingMenuComp.scss';

import type { BibleNote } from 'bible-note';

import { useCallback, useMemo } from 'react';

import { checkIsHistoryMovementEventType } from '../../editing-manager/EditingHistoryManager';
import {
    FileEditingMenuComp,
    savingEventMapper,
} from '../../editing-manager/editingHelpers';
import { useKeyboardRegistering } from '../../event/KeyboardEventListener';
import { useAppCurrentRef } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import { toEditorContent, toStoredContent } from './bibleNoteHelpers';
import type Note from './Note';
import type NoteItem from './NoteItem';

/**
 * Undo / Redo / Discard / Save for the note window, the same control the slide
 * document and lyric editors carry and driven by the same
 * `EditingHistoryManager`.
 *
 * It exists because the `bible-note` editor SAVES ITSELF -- continuously, and
 * whatever state it happens to be in. That reached the file, so a note could be
 * emptied, or broken, with nothing left to go back to. Its writes land in the
 * editing history now; this is the press that puts them on disk.
 *
 * It renders inside the editor's own footer, which is a React root of the
 * PACKAGE's making, so nothing here may rely on app context -- the history
 * manager, the event bus and the confirm popup are all module-level.
 */
export default function BibleNoteEditingMenuComp({
    note,
    noteItem,
    bibleNote,
}: Readonly<{
    note: Note;
    noteItem: NoteItem;
    bibleNote: BibleNote;
}>) {
    const noteRef = useAppCurrentRef(note);
    const noteItemRef = useAppCurrentRef(noteItem);
    const bibleNoteRef = useAppCurrentRef(bibleNote);
    // per-window, and this window holds exactly one editor -- but the timer is
    // still its own, so a second note window cannot swallow this one's reload
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(300);
    }, []);
    const editingDocument = useMemo(() => {
        return {
            filePath: note.filePath,
            historyUndo: () => noteRef.current.historyUndo(),
            historyRedo: () => noteRef.current.historyRedo(),
            historyDiscard: () => noteRef.current.historyDiscard(),
            save: () => noteRef.current.saveEditingHistory(),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [note.filePath]);
    const handleSaving = useCallback(() => {
        noteRef.current.saveEditingHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useKeyboardRegistering([savingEventMapper], handleSaving, []);
    // An Undo moves the head, and the head is not a file the window watches --
    // nothing else would bring the text back on screen.
    useFileSourceEvents(
        ['update'],
        (data: any) => {
            if (!checkIsHistoryMovementEventType(data?.eventType)) {
                return;
            }
            attemptTimeout(async () => {
                const currentNote = noteRef.current;
                await currentNote.reloadEditing();
                const newNoteItem = currentNote.getItemById(
                    noteItemRef.current.id,
                );
                if (newNoteItem === null) {
                    return;
                }
                const newContent = toStoredContent(newNoteItem.content);
                if (newContent === noteItemRef.current.content) {
                    return;
                }
                // The item the editor's own `saveData` compares against, so
                // what comes back is not written straight out again as a new
                // history entry -- which would throw the Redo away.
                noteItemRef.current.content = newContent;
                bibleNoteRef.current.content = toEditorContent(newContent);
            });
        },
        [],
        note.filePath,
    );
    return (
        <div className="bible-note-editing-menu">
            <FileEditingMenuComp
                editableDocument={editingDocument}
                undoLabel={tran('Undo Saved Change')}
                redoLabel={tran('Redo Saved Change')}
            />
        </div>
    );
}
