import type { BibleNoteSettingStoreType } from './bibleNoteReadOnlyHelpers';

/** Where `bible-note` keeps its switches: only those off its own defaults. */
export const BIBLE_NOTE_SETTINGS_KEY = 'lexical-playground-settings';

/**
 * The editor switches this app turns ON although `bible-note` ships them off.
 *
 * The note window mounts no settings panel (`BibleNoteSettings`), so a switch
 * left at the package's default is one nobody can reach. The Table of
 * contents button -- the outline at the toolbar's left end, before Undo, that
 * lists the note's headings and jumps to the one picked -- is drawn only
 * while `showTableOfContents` is on (2026-11-14, the user: _enable bible-note
 * table of content_).
 */
export const HOST_DEFAULT_EDITOR_SETTINGS: Readonly<Record<string, boolean>> = {
    showTableOfContents: true,
};

function toSettingsObject(value: unknown): Record<string, unknown> {
    if (value === null || value === undefined) {
        return {};
    }
    let parsed: unknown = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        } catch (_error) {
            return {};
        }
    }
    if (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
    ) {
        return {};
    }
    return parsed as Record<string, unknown>;
}

/** The stored switches with this app's defaults under them. */
export function withHostDefaultEditorSettings(value: unknown) {
    return JSON.stringify({
        ...HOST_DEFAULT_EDITOR_SETTINGS,
        ...toSettingsObject(value),
    });
}

/**
 * The settings store the editor is handed: every key passes through, and the
 * switches are READ with this app's defaults under what is stored -- a value
 * stored for a switch still wins. Nothing is written, so the shared setting
 * and the help window's note conversation (which writes the same key) see
 * exactly what they saw before.
 */
export function genHostDefaultSettingStore(
    settingStore: BibleNoteSettingStoreType,
): BibleNoteSettingStoreType {
    return {
        deleteSetting(key: string) {
            return settingStore.deleteSetting(key);
        },
        getSetting(key: string) {
            const value = settingStore.getSetting(key);
            if (key !== BIBLE_NOTE_SETTINGS_KEY) {
                return value;
            }
            if (value instanceof Promise) {
                return value.then(withHostDefaultEditorSettings);
            }
            return withHostDefaultEditorSettings(value);
        },
        setSetting(key: string, value: any) {
            return settingStore.setSetting(key, value);
        },
    };
}
