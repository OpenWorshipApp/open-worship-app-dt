/**
 * The Lyric Editor window keeping up with a song changed from OUTSIDE it --
 * the help window's assistant (`owa_lyric_edit`), another agent, another
 * window -- while it is open.
 *
 * The editor reads the song once, when it opens, and its own typing stays in
 * the Open Lyric dashboard until Save. So a change written into the song's
 * editing history behind it was invisible there, and worse: the person's
 * next Save wrote the editor's old text over it. Asked for 2026-11-06 with
 * the editor's own 🤖 (the user: _on lyric editor add robot icon to click
 * for `Open In Chatbot`_): pressed, the assistant changes the very song the
 * editor shows.
 *
 * The signal is the data-folder watcher, which already tells a song's
 * `update` when anything is written into its `.histories` folder
 * (`dirWatchingHelpers.ts`), debounced so a burst of writes is one read.
 * What happens next is `decideLyricEditorSync`: nothing, the new text put
 * into the editor (no typing since the last time the two agreed -- it stays
 * unsaved, and Save writes it), or -- the person typed meanwhile -- their
 * typing kept and a notice offering to load the change, which only they
 * press.
 */
import FileSource from '../helper/FileSource';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { toEditingHistoryFolderPath } from '../editing-manager/editingHistoryPathHelpers';
import type Lyric from './Lyric';

export type LyricEditorSyncDecisionType = 'none' | 'apply' | 'notice';

/** The few parts of open-lyric's `Editor` facade this file writes through. */
export type LyricEditorFacadeType = {
    value: string;
    isSimpleMode?: boolean;
    activeTextarea?: HTMLTextAreaElement | null;
    monacoEditor?: any;
};

/**
 * Put `value` into the editor AS AN EDIT: Monaco's own edit, or the simple
 * editor's textarea and its `input` event. Never the facade's `value`
 * setter, which "replaces the document and the isDirty baseline" -- the
 * editor then calls the song clean and greys Save out, while the song's
 * editing history still holds a change nobody saved (seen live 2026-11-06:
 * the tempo the assistant set showed, and Save stayed disabled). Answers
 * whether it could.
 */
export function applyLyricEditorText(
    editor: LyricEditorFacadeType | null | undefined,
    value: string,
) {
    if (editor === null || editor === undefined) {
        return false;
    }
    const monaco = editor.isSimpleMode === true ? null : editor.monacoEditor;
    const model = monaco?.getModel?.();
    if (model !== null && model !== undefined) {
        if (model.getValue() !== value) {
            monaco.pushUndoStop?.();
            monaco.executeEdits('owa-assistant', [
                {
                    range: model.getFullModelRange(),
                    text: value,
                    forceMoveMarkers: true,
                },
            ]);
            monaco.pushUndoStop?.();
        }
        return true;
    }
    const textarea = editor.activeTextarea;
    if (textarea !== null && textarea !== undefined) {
        if (textarea.value !== value) {
            textarea.value = value;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return true;
    }
    return false;
}

/**
 * What a new editing head means for the editor: `head` the song as written
 * now, `value` what the editor shows, `lastSynced` the text the two last
 * agreed on (opened, saved, handed to the assistant, or loaded).
 */
export function decideLyricEditorSync({
    head,
    value,
    lastSynced,
}: {
    head: string;
    value: string;
    lastSynced: string;
}): LyricEditorSyncDecisionType {
    if (head === value || head === lastSynced) {
        return 'none';
    }
    return value === lastSynced ? 'apply' : 'notice';
}

export type LyricEditorSyncType = {
    /** A change held back because the person typed meanwhile, or null. */
    getPendingHead: () => string | null;
    subscribe: (listener: () => void) => () => void;
    /** The person's press: the held-back change into the editor. */
    applyPending: () => void;
    /** Save wrote this; it is what the two agree on now. */
    markSaved: (value: string) => void;
    /**
     * Before the help window opens on the song: what the editor shows goes
     * into the editing history (unsaved), so the assistant reads THAT.
     */
    writeShownToHead: () => Promise<void>;
    dispose: () => void;
};

export function createLyricEditorSync({
    lyric,
    initialContent,
    getShown,
    setShown,
}: {
    lyric: Lyric;
    initialContent: string;
    getShown: () => string;
    setShown: (value: string) => void;
}): LyricEditorSyncType {
    let lastSynced = initialContent;
    let pendingHead: string | null = null;
    const listenerSet = new Set<() => void>();
    const tell = () => {
        for (const listener of listenerSet) {
            listener();
        }
    };
    // The head as it is NOW: the path cache is let go first, or a read
    // inside its two seconds answers the text from before the write.
    const readHead = async () => {
        FileSource.forgetCachedData(lyric.filePath);
        FileSource.forgetCachedDataUnder(
            toEditingHistoryFolderPath(lyric.filePath),
        );
        const json = await lyric.getJsonData();
        return typeof json?.content === 'string' ? json.content : null;
    };
    // One window, one song, for good: a module-level timer would do, and a
    // per-instance one costs nothing and survives a second instance.
    const attemptTimeout = genTimeoutAttempt(500);
    const fileSource = FileSource.getInstance(lyric.filePath);
    const registered = fileSource.registerEventListener(['update'], () => {
        attemptTimeout(async () => {
            const head = await readHead();
            if (head === null) {
                return;
            }
            const value = getShown();
            const decision = decideLyricEditorSync({ head, value, lastSynced });
            if (decision === 'apply') {
                setShown(head);
                lastSynced = head;
                pendingHead = null;
            } else if (decision === 'notice') {
                pendingHead = head;
            } else if (head === value) {
                lastSynced = head;
                pendingHead = null;
            }
            tell();
        });
    });
    return {
        getPendingHead: () => {
            return pendingHead;
        },
        subscribe: (listener) => {
            listenerSet.add(listener);
            return () => {
                listenerSet.delete(listener);
            };
        },
        applyPending: () => {
            if (pendingHead === null) {
                return;
            }
            setShown(pendingHead);
            lastSynced = pendingHead;
            pendingHead = null;
            tell();
        },
        markSaved: (value) => {
            lastSynced = value;
            pendingHead = null;
            tell();
        },
        writeShownToHead: async () => {
            const shown = getShown();
            const head = await readHead();
            if (head !== null && shown !== head) {
                await lyric.setContent(shown);
            }
            lastSynced = shown;
            pendingHead = null;
            tell();
        },
        dispose: () => {
            fileSource.unregisterEventListener(registered);
        },
    };
}
