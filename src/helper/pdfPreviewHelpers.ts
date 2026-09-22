import { pathToFileURL } from '../server/calcHelpers';
import { pathBasename } from '../server/fileHelpers';
import { openPopupWindow } from './domHelpers';

/**
 * Opens a PDF in the app's own popup window, the one Chromium draws its PDF
 * viewer in. Shared by the Documents list and the Resources panel, and kept
 * apart from `pdfHelpers` on purpose: that module pulls `FileSource` and the
 * page-image cache, none of which a preview needs.
 *
 * The url id is the file's name, so the main process focuses a preview already
 * open on the same file instead of stacking another, whichever list opened it.
 */
export function openPdfPreview(filePath: string) {
    const fileFullName = pathBasename(filePath);
    return openPopupWindow(
        pathToFileURL(filePath),
        `pdf_preview-${fileFullName}_${Date.now()}`,
        fileFullName,
    );
}
