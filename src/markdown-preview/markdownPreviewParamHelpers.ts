/**
 * Which file the Markdown Preview window (`html/markdownPreview.html`) shows,
 * carried as a full path in its URL.
 *
 * A URL parameter and not a short-lived setting: every file is a window of its
 * own, and the main process focusing the window already open on the same URL
 * is exactly what a second press on one file should do.
 *
 * Imports nothing, for the reason `bibleNotePreviewHelpers.ts` does not.
 */
export const MARKDOWN_PREVIEW_FILE_PARAM_NAME = 'preview-file';

// A name, place, verse or file the page mentions, made a link
// (`markdownPreviewReferenceHelpers.ts`). Here so the window can tell a press
// on one without loading the helpers that make them.
export const MARKDOWN_REF_CLASS = 'app-markdown-ref';

// The line of the file a block on the page starts at, counted from 0. Written
// on the blocks only while the editor is shown beside the page, so each side
// can follow the other's scrolling (`markdownScrollFollowHelpers.ts`).
export const MARKDOWN_SOURCE_LINE_ATTRIBUTE = 'data-source-line';

// Every name `src/server/mime/markdown-types.json` lists, written out rather
// than read from it so this module stays import-free; a test holds the two
// alike. The Bible Notes list shows each of them, and a row pressed opens here.
const MARKDOWN_DOT_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'];

export function checkIsMarkdownPreviewFileName(fileFullName: string) {
    const lowerName = fileFullName.toLowerCase();
    return MARKDOWN_DOT_EXTENSIONS.some((dotExtension) => {
        return lowerName.endsWith(dotExtension);
    });
}

/**
 * The file the window was opened on, or `null`. A path that is not a markdown
 * file by name is refused, so a hand-made URL cannot turn the window into a
 * reader of any other file on the machine.
 */
export function getMarkdownPreviewFilePath(url: string) {
    if (!URL.canParse(url)) {
        return null;
    }
    const filePath = new URL(url).searchParams.get(
        MARKDOWN_PREVIEW_FILE_PARAM_NAME,
    );
    if (!filePath || !checkIsMarkdownPreviewFileName(filePath)) {
        return null;
    }
    return filePath;
}
