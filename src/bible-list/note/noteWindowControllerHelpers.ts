/**
 * The note window's own editor, as the help window's note conversation
 * reaches it (2026-11-08, the user, after the assistant changed a note's
 * verses from the editing history while the note was open in front of them:
 * _it's dangerous to read and modify wrong file … chatbot should work
 * directly on UI, e.g. bible-note chatbot should depend on bible-note UI
 * controller_, and the goal _chatbot modifying files should work on the
 * fresh latest user seen content_).
 *
 * A note is read and changed IN its own window (`owa_note_edit` aims there,
 * opening it first): what is read is what the editor shows that moment,
 * typing not yet in the history included, and a change is put into the
 * editor itself -- the window's own save then writes it into the editing
 * history, the one writer the note has, and the editor's own Undo takes it
 * back. The window says which note it is by its full path, so a call meant
 * for another file of the same name -- another Bible Notes folder's
 * `Default.own` -- is refused rather than written here.
 *
 * No imports: the worker (`agentNoteEditHelpers.ts`) and the note window
 * both load it.
 */

export type NoteWindowControllerType = {
    // The note this window shows: its file's whole path and its id there.
    filePath: string;
    noteId: number;
    // A preview of a file from outside the Bible Notes folders: read only.
    isReadOnly: boolean;
    // Whether the editor has drawn the note yet.
    isMounted: () => boolean;
    // The note as the editor shows it NOW, as it is stored.
    readContent: () => string;
    // Puts content into the editor and waits for the window to keep it in
    // the editing history; whether it took it.
    writeContent: (content: string) => Promise<boolean>;
    // Writes what was typed and not kept yet into the editing history.
    flush: () => Promise<void>;
};

// Why a window would not take a request, for the tool to act on: no note
// window here -- open the note's -- or one showing another note -- try the
// next window of that address (`agentNoteEdit.mjs`, a test holds them).
export const NOTE_WINDOW_MISSING_CODE = 'not-note-window';
export const NOTE_WINDOW_OTHER_CODE = 'other-note-window';

// Read by a page expression, which can import nothing: the tool asks the
// window whether its editor is up before it sends a request
// (`NOTE_WINDOW_READY_EXPRESSION` in `agentNoteEdit.mjs`, which a test holds
// to this name).
export const NOTE_WINDOW_READY_GLOBAL_NAME = '__owaIsNoteWindowReady';

let controller: NoteWindowControllerType | null = null;

export function setNoteWindowController(
    value: NoteWindowControllerType | null,
) {
    controller = value;
    (globalThis as any)[NOTE_WINDOW_READY_GLOBAL_NAME] = () => {
        return controller !== null && controller.isMounted();
    };
}

/** This window's note editor, or null in any other window. */
export function getNoteWindowController() {
    return controller;
}
