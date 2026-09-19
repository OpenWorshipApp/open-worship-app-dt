import { pathToFileURL } from '../server/calcHelpers';
import {
    fsCheckFileExist,
    fsGetFileSize,
    fsReadFile,
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

export type MarkdownPreviewLoadResultType =
    | ({ status: 'ready' } & MarkdownPreviewRenderResultType)
    | { status: 'loading' | 'not-found' | 'too-large' | 'unreadable' };

/**
 * Read and render one markdown file. Never throws. Nothing is cached: the
 * window re-reads on every change the file watcher reports, and the rendered
 * HTML it keeps is only what is on screen.
 */
export async function loadMarkdownPreviewFile(
    filePath: string,
): Promise<MarkdownPreviewLoadResultType> {
    try {
        if (!(await fsCheckFileExist(filePath))) {
            return { status: 'not-found' };
        }
        // The size FIRST: the point of the cap is not to read the bytes.
        if ((await fsGetFileSize(filePath)) > MAX_MARKDOWN_PREVIEW_FILE_SIZE) {
            return { status: 'too-large' };
        }
        const text = await fsReadFile(filePath);
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

export function toMarkdownPreviewTargetPath(
    currentFilePath: string,
    linkedPath: string,
) {
    return pathResolve(pathDirname(currentFilePath), linkedPath);
}
