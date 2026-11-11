import { BIBLE_NOTE_PREVIEW_FILE_PARAM_NAME } from '../bible-list/note/bibleNotePreviewHelpers';
import {
    openPopupWindow,
    setParamIdNum,
    setParamKeyValue,
} from '../helper/domHelpers';
import { MARKDOWN_PREVIEW_FILE_PARAM_NAME } from '../markdown-preview/markdownPreviewParamHelpers';
import appProvider from '../server/appProvider';

/**
 * The two popups a Resources row opens. Imported by the row only when it is
 * pressed (`import()`), so the bible lookup panel does not carry the window
 * helpers for a press that may never come.
 *
 * A row's press opens ANOTHER window every time, as a Bible note's Open does
 * (2026-11-10, the user: _as a user I want to open 2 windows of one resource
 * file so I can read different parts at the same time_): its url id is new,
 * so the main process finds no window to bring forward and steps the new one
 * off the others. A press that only wants the file in front -- the 🤖, which
 * works in the file's window, and the assistant's study preview -- leaves
 * `isAnother` off: then any window already open on the file, whichever press
 * opened it, is brought forward instead (`appReuseOpen`), and one opens only
 * when none is.
 */
const PREVIEW_URL_UUID = 'preview';

export type PreviewOpenOptionsType = { isAnother?: boolean };

// 870 is the editable note window's width, so a note's preview and its own
// window read alike.
function toPreviewOpenParts(options: PreviewOpenOptionsType) {
    if (options.isAnother === true) {
        return {
            urlUUID: `${PREVIEW_URL_UUID}-${crypto.randomUUID()}`,
            features: { width: 870 },
        };
    }
    return {
        urlUUID: PREVIEW_URL_UUID,
        features: { width: 870, appReuseOpen: true },
    };
}

export function genBibleNotePreviewPathname(
    filePath: string,
    noteItemId: number,
) {
    const pathname = setParamKeyValue(
        appProvider.bibleNoteHomePage,
        BIBLE_NOTE_PREVIEW_FILE_PARAM_NAME,
        filePath,
    );
    return setParamIdNum(pathname, noteItemId);
}

export function openBibleNotePreview(
    filePath: string,
    noteItemId: number,
    options: PreviewOpenOptionsType = {},
) {
    const { urlUUID, features } = toPreviewOpenParts(options);
    return openPopupWindow(
        genBibleNotePreviewPathname(filePath, noteItemId),
        `bible-note-preview_${Date.now()}`,
        urlUUID,
        features,
    );
}

export function genMarkdownPreviewPathname(filePath: string) {
    return setParamKeyValue(
        appProvider.markdownPreviewHomePage,
        MARKDOWN_PREVIEW_FILE_PARAM_NAME,
        filePath,
    );
}

export function openMarkdownPreview(
    filePath: string,
    options: PreviewOpenOptionsType = {},
) {
    const { urlUUID, features } = toPreviewOpenParts(options);
    return openPopupWindow(
        genMarkdownPreviewPathname(filePath),
        `markdown-preview_${Date.now()}`,
        urlUUID,
        features,
    );
}
