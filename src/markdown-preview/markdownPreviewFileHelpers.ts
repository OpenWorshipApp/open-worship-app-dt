import { pathToFileURL } from '../server/calcHelpers';
import {
    fsCheckFileExist,
    fsGetFileSize,
    fsReadFile,
    fsWriteFile,
    pathDirname,
    pathResolve,
} from '../server/fileHelpers';
import {
    type MarkdownPreviewRenderResultType,
    renderPreviewMarkdown,
} from './markdownPreviewRenderHelpers';

/**
 * Past this the SIZE is read and nothing else. A document is kilobytes; a
 * multi-megabyte `.md` is a data dump or a log with the wrong extension, and
 * rendering one into the DOM is the whole frame budget of the machines this app
 * targets spent on a page nobody will read. The window says so and offers the
 * file's own application instead.
 */
export const MAX_MARKDOWN_PREVIEW_FILE_SIZE = 5 * 1024 * 1024;

type MarkdownPreviewFailStatusType = 'not-found' | 'too-large' | 'unreadable';

export type MarkdownPreviewLoadResultType =
    | ({ status: 'ready' } & MarkdownPreviewRenderResultType)
    | { status: 'loading' | MarkdownPreviewFailStatusType };

export type MarkdownPreviewTextResultType =
    | { status: 'ready'; text: string }
    | { status: MarkdownPreviewFailStatusType };

/**
 * Read one markdown file's text. Never throws. The editor reads through this
 * too, so a file too large to preview is never put into an editor either.
 */
export async function readMarkdownPreviewText(
    filePath: string,
): Promise<MarkdownPreviewTextResultType> {
    try {
        if (!(await fsCheckFileExist(filePath))) {
            return { status: 'not-found' };
        }
        // The size FIRST: the point of the cap is not to read the bytes.
        if ((await fsGetFileSize(filePath)) > MAX_MARKDOWN_PREVIEW_FILE_SIZE) {
            return { status: 'too-large' };
        }
        return { status: 'ready', text: await fsReadFile(filePath) };
    } catch {
        return { status: 'unreadable' };
    }
}

/**
 * Render markdown text as it would be shown for `filePath` -- the file on
 * disk, or a draft of it not saved yet.
 */
export function renderMarkdownPreviewText(
    filePath: string,
    text: string,
): MarkdownPreviewLoadResultType {
    try {
        // A picture written as `images/map.png` is beside the FILE, not beside
        // the app.
        const baseDirPath = pathDirname(filePath);
        const rendered = renderPreviewMarkdown(text, (imagePath) => {
            return pathToFileURL(pathResolve(baseDirPath, imagePath));
        });
        return { status: 'ready', ...rendered };
    } catch {
        return { status: 'unreadable' };
    }
}

/**
 * Read and render one markdown file. Never throws. Nothing is cached: the
 * window re-reads on every change the file watcher reports, and the rendered
 * HTML it keeps is only what is on screen.
 */
export async function loadMarkdownPreviewFile(
    filePath: string,
): Promise<MarkdownPreviewLoadResultType> {
    const textResult = await readMarkdownPreviewText(filePath);
    if (textResult.status !== 'ready') {
        return textResult;
    }
    return renderMarkdownPreviewText(filePath, textResult.text);
}

/**
 * Write the editor's text back to the file. Never throws: `false` keeps the
 * draft and its unsaved mark on screen. Written through the provider bridge
 * like the read, so the data folder's portable paths round-trip.
 */
export async function saveMarkdownPreviewFile(filePath: string, text: string) {
    try {
        await fsWriteFile(filePath, text);
        return true;
    } catch {
        return false;
    }
}

export function toMarkdownPreviewTargetPath(
    currentFilePath: string,
    linkedPath: string,
) {
    return pathResolve(pathDirname(currentFilePath), linkedPath);
}
