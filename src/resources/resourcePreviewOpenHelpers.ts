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
 * Both pass a FIXED url id, unlike the editable Bible Note window's random
 * one: the main process focuses a window already open on the same URL instead
 * of opening another, so a second press on the same file brings its preview
 * forward rather than stacking a copy of it.
 */
const PREVIEW_URL_UUID = 'preview';

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

export function openBibleNotePreview(filePath: string, noteItemId: number) {
    return openPopupWindow(
        genBibleNotePreviewPathname(filePath, noteItemId),
        `bible-note-preview_${Date.now()}`,
        PREVIEW_URL_UUID,
        // The editable note window's width, so the two read alike.
        { width: 870 },
    );
}

export function genMarkdownPreviewPathname(filePath: string) {
    return setParamKeyValue(
        appProvider.markdownPreviewHomePage,
        MARKDOWN_PREVIEW_FILE_PARAM_NAME,
        filePath,
    );
}

export function openMarkdownPreview(filePath: string) {
    return openPopupWindow(
        genMarkdownPreviewPathname(filePath),
        `markdown-preview_${Date.now()}`,
        PREVIEW_URL_UUID,
        { width: 870 },
    );
}
