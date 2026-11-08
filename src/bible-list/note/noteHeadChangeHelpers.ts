import appProvider from '../../server/appProvider';

/**
 * "This note file's editing head just changed" -- said by the window that
 * changed it, heard by every other window (2026-11-07: the help window's
 * note conversation changes a note through `owa_note_edit`, which writes the
 * editing history from the Presenter's or the Reader's page).
 *
 * A note window shows its file's editing HEAD and watches only the FILE, so
 * a change written into the history by another window never reached it --
 * and its next keystroke would have written its own older copy back over the
 * change. On this the window reads its head again (`initBibleNote`) and the
 * change is on screen; its own writes come back as no change at all, which
 * is why it may hear its own.
 *
 * Sent by the note-edit worker after each change and by an undo that puts a
 * note's head back (`agentBackupHelpers.ts`).
 */
const NOTE_HEAD_CHANGED_BROADCAST_CHANNEL = 'all:app:note-head-changed';
const NOTE_HEAD_CHANGED_RENDERER_CHANNEL = 'main:app:note-head-changed';

export function notifyNoteHeadChanged(filePath: string) {
    appProvider.messageUtils.sendData(NOTE_HEAD_CHANGED_BROADCAST_CHANNEL, {
        filePath,
    });
}

/** Returns the unregister function. */
export function registerNoteHeadChangedListener(
    handler: (filePath: string) => void,
) {
    const listener = (_event: unknown, data?: { filePath?: unknown }) => {
        if (typeof data?.filePath === 'string') {
            handler(data.filePath);
        }
    };
    appProvider.messageUtils.listenForData(
        NOTE_HEAD_CHANGED_RENDERER_CHANNEL,
        listener,
    );
    return () => {
        appProvider.messageUtils.removeListener(
            NOTE_HEAD_CHANGED_RENDERER_CHANNEL,
            listener,
        );
    };
}
