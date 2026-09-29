import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import {
    appDocumentFlexSizeNames,
    settingPrefix,
    type FlexSizeType,
} from '../resize-actor/flexSizeHelpers';
import { parseJsonSafely } from './helpers';
import { handleError } from './errorHelpers';

/**
 * ONE-OFF, per data folder: the presenter previewer's Note pane used to ship
 * OPEN, so every document opened before this version remembers it open and
 * would keep it open for ever -- the shipped default is only ever read for a
 * document that has no stored layout yet.
 *
 * Each stored layout gets the very flag a click on _Close Second Widget_ would
 * have written (`setDisablingSetting`): the pane's own grow is kept in the
 * flag, so the green `Note` strip gives the pane back exactly as before, and
 * a layout the user had already collapsed -- or dragged -- is left alone.
 *
 * Loaded through a dynamic `import()` from `init()`, and only while its marker
 * setting is missing, so after the first launch it is never even fetched.
 */

// The previewer's two panes: the slides above, the note below.
const SLIDES_PANE_KEY = 'v1';
const NOTE_PANE_KEY = 'v2';

function toPaneFlexGrow(size: string) {
    // `'6'` or `'6.45902 1 0%'` -- the shorthand a drag writes back.
    const flexGrow = Number(size.split(' ')[0]);
    return Number.isFinite(flexGrow) ? flexGrow : 0;
}

function toPaneSize(size: string, flexGrow: number) {
    const parts = size.split(' ');
    parts[0] = `${flexGrow}`;
    return parts.join(' ');
}

/**
 * The stored layout with its Note pane closed, or null when there is nothing
 * to do -- not a previewer layout, already closed, or unreadable.
 *
 * Written exactly as a press on _Close Second Widget_ writes it: the slides
 * TAKE the note pane's grow and the flag remembers it, so the green strip
 * gives the layout back unchanged.
 */
export function toNoteClosedFlexSize(value: string) {
    const flexSize = parseJsonSafely<FlexSizeType>(value, true);
    if (
        flexSize === null ||
        typeof flexSize !== 'object' ||
        Array.isArray(flexSize)
    ) {
        return null;
    }
    const notePane = flexSize[NOTE_PANE_KEY];
    const slidesPane = flexSize[SLIDES_PANE_KEY];
    // A pane that is already collapsed carries the flag; anything that is not
    // the two-pane previewer layout is not this migration's business.
    if (
        !Array.isArray(notePane) ||
        typeof notePane[0] !== 'string' ||
        !Array.isArray(slidesPane) ||
        typeof slidesPane[0] !== 'string'
    ) {
        return null;
    }
    if (notePane[1]) {
        return null;
    }
    const noteFlexGrow = toPaneFlexGrow(notePane[0]);
    return JSON.stringify({
        ...flexSize,
        [SLIDES_PANE_KEY]: [
            toPaneSize(
                slidesPane[0],
                toPaneFlexGrow(slidesPane[0]) + noteFlexGrow,
            ),
            slidesPane[1],
        ],
        [NOTE_PANE_KEY]: [
            notePane[0],
            // `'second'`: the note pane sits AFTER the slides, so the slides
            // are what took its space and what gives it back.
            ['second', noteFlexGrow],
        ],
    });
}

export default async function migratePreviewerNoteClose() {
    // A floating preview of the same document stores its own layout under a
    // prefix of its own, so the name is matched anywhere in the key.
    const nameMatch = `${appDocumentFlexSizeNames.presenterPreviewer}-`;
    for (const key of await appLocalStorage.listKeys()) {
        if (!key.startsWith(`${settingPrefix}-`) || !key.includes(nameMatch)) {
            continue;
        }
        try {
            const value = appLocalStorage.getItem(key);
            if (value === null || value === '') {
                continue;
            }
            const newValue = toNoteClosedFlexSize(value);
            if (newValue === null) {
                continue;
            }
            appLocalStorage.setItem(key, newValue);
        } catch (error) {
            handleError(error);
        }
    }
}
