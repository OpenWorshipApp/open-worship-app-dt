import type { BibleNote } from 'bible-note';

/**
 * The editor's own read-only lock, as `bible-note` keeps it: in the settings
 * store the host hands it, which in this app is ONE store every note window
 * reads when it opens.
 */
export const BIBLE_NOTE_READ_ONLY_SETTING_KEY =
    'lexical-playground-read-only-mode';

export type BibleNoteSettingStoreType = {
    deleteSetting(key: string): unknown;
    getSetting(key: string): unknown;
    setSetting(key: string, value: any): unknown;
};

/**
 * The settings store a read-only preview hands the editor: everything passes
 * through but the lock. The editor stores the HOST's lock exactly as it stores
 * the user's own press of its lock button, so one preview opened from
 * Resources left every editable note after it opening locked.
 */
export function genPreviewSettingStore(
    settingStore: BibleNoteSettingStoreType,
): BibleNoteSettingStoreType {
    return {
        deleteSetting(key: string) {
            if (key === BIBLE_NOTE_READ_ONLY_SETTING_KEY) {
                return;
            }
            return settingStore.deleteSetting(key);
        },
        getSetting(key: string) {
            return settingStore.getSetting(key);
        },
        setSetting(key: string, value: any) {
            if (key === BIBLE_NOTE_READ_ONLY_SETTING_KEY) {
                return;
            }
            return settingStore.setSetting(key, value);
        },
    };
}

const LOCK_SYNC_POLL_MILLISECOND = 50;
const LOCK_SYNC_GIVE_UP_MILLISECOND = 10_000;

/**
 * Locks the editor of a read-only note in a way its toolbar can see.
 *
 * The toolbar reads whether the editor is editable ONCE, as it first renders,
 * and hears about changes only from its own effect on -- but the editor
 * applies a host's lock from an effect that runs BEFORE that one. So a
 * read-only note opened with Bold, Link and the rest of the toolbar enabled,
 * and Undo lit up as soon as anything put a step in the editor's history: the
 * file changing on disk, which a preview follows. Pressing it rolled the
 * window back to text the file no longer held.
 *
 * Once the editor is up, lifting the lock and setting it again is a change the
 * toolbar hears. The two happen in one synchronous step, so nothing can be
 * typed in between, and `genPreviewSettingStore` keeps either of them from
 * reaching the shared setting.
 */
export function lockBibleNoteReadOnly(bibleNote: BibleNote) {
    bibleNote.isReadOnly = true;
    const startTime = Date.now();
    const timer = setInterval(() => {
        // `content` reads '' until the editor has connected, and it connects
        // in the same pass of effects that starts the toolbar listening: once
        // it answers, the toolbar is listening too. A toolbar mounted later
        // than that reads the lock as it starts.
        const isConnected = bibleNote.content !== '';
        const isGivingUp =
            Date.now() - startTime >= LOCK_SYNC_GIVE_UP_MILLISECOND;
        if (!isConnected && !isGivingUp) {
            return;
        }
        clearInterval(timer);
        if (isConnected) {
            bibleNote.isReadOnly = false;
            bibleNote.isReadOnly = true;
        }
    }, LOCK_SYNC_POLL_MILLISECOND);
}
