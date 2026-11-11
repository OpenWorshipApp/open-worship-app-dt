/**
 * What the help window asks the main process to hold over the MAIN window
 * (`electron/windowOnTopHelpers.ts`, whose test holds the channel and the
 * request equal to these): every window the tab in front works on.
 *
 * First a Bible note's window (2026-11-08, the user: _a bible note window that
 * attached to chatbot should toggled for stay on top_), then a Resources
 * file's (2026-11-10, the user, the 🤖 on a PDF and a Markdown row circled:
 * _like bible note I want behavior of during attached to chatbot the window
 * have to be on top of main window_), then every kind: _this behavior should
 * apply to all window types, imagine chatbot working on an attached window but
 * the window is covered by main window that's wrong behavior_.
 *
 * Two halves, because the help window's window list names only the pages it
 * can work in: `url`, the window **Working in** says (Settings, an editor, a
 * Reader of its own, a note); and `filePath`, a file attached in the tab,
 * whose own preview window -- Markdown Preview, or the PDF viewer -- is not in
 * that list and is found by main from the file.
 *
 * Imports only a leaf: the help window and the main process's test load it.
 */
import {
    checkIsMarkdownPreviewFileName,
    getMarkdownPreviewFilePath,
} from '../../markdown-preview/markdownPreviewParamHelpers';

export const HOLD_WINDOW_ON_TOP_CHANNEL = 'main:app:hold-window-on-top';

const MARKDOWN_PREVIEW_PAGE_NAME = 'markdownPreview.html';

export type HoldWindowRequestType = {
    url: string | null;
    filePath: string | null;
};

/** A file the app shows in a window of its own: a PDF or a Markdown file. */
export function checkIsPreviewWindowFileName(fileName: string) {
    return (
        fileName.toLowerCase().endsWith('.pdf') ||
        checkIsMarkdownPreviewFileName(fileName)
    );
}

/**
 * The file a window shows in a window of its own, read off its address: the
 * Markdown Preview's `preview-file`, or the PDF viewer's own `file:` address
 * (`file:///C:/a/JHN.3.pdf?uuid=JHN.3.pdf`). `null` for any other window.
 * The help window lists such a window as the FILE's (2026-11-10, the user,
 * with **Working in** naming a note's window: _should behave like what
 * working for bible-note_); main's twin, with Node's own path reading, is
 * `toPreviewWindowFilePath` in `electron/windowOnTopHelpers.ts`.
 */
export function toPreviewWindowFilePath(url: string): string | null {
    if (!URL.canParse(url)) {
        return null;
    }
    const urlObject = new URL(url);
    if (urlObject.pathname.split('/').pop() === MARKDOWN_PREVIEW_PAGE_NAME) {
        return getMarkdownPreviewFilePath(url);
    }
    if (
        urlObject.protocol !== 'file:' ||
        !urlObject.pathname.toLowerCase().endsWith('.pdf')
    ) {
        return null;
    }
    let pathname: string;
    try {
        pathname = decodeURIComponent(urlObject.pathname);
    } catch (_error) {
        return null;
    }
    // `/C:/a/b.pdf` is a drive's `C:/a/b.pdf`; a share keeps its server.
    if (/^\/[a-z]:\//i.test(pathname)) {
        return pathname.slice(1);
    }
    return urlObject.host === '' ? pathname : `//${urlObject.host}${pathname}`;
}

/**
 * Two paths of ONE file compare equal: either slash, either case -- a drive
 * on Windows and macOS does not tell cases apart, and two files of one folder
 * named apart only by case are no real Resources folder.
 */
export function toPreviewPathKey(filePath: string) {
    return filePath.replace(/\\/g, '/').toLowerCase();
}

/**
 * The file whose preview window is held: the LAST of the tab's files that has
 * one -- the newest attached, the one the questions are about. `null` for
 * none.
 */
export function toHeldPreviewFilePath(
    filePathList: readonly (string | undefined)[],
): string | null {
    for (let index = filePathList.length - 1; index >= 0; index--) {
        const filePath = filePathList[index];
        if (
            typeof filePath === 'string' &&
            checkIsPreviewWindowFileName(filePath)
        ) {
            return filePath;
        }
    }
    return null;
}
