import { pathToFileURL } from '../server/calcHelpers';
import { pathBasename } from '../server/fileHelpers';
import { openPopupWindow } from './domHelpers';

/**
 * Opens a PDF in the app's own popup window, the one Chromium draws its PDF
 * viewer in. Shared by the Documents list and the Resources panel, and kept
 * apart from `pdfHelpers` on purpose: that module pulls `FileSource` and the
 * page-image cache, none of which a preview needs.
 *
 * By default the main process brings forward a preview already open on the
 * same file instead of stacking another, whichever list opened it
 * (`appReuseOpen`): the Documents list and the Resources 🤖. `isAnother` opens
 * one more beside it -- a Resources row's press, so two places of one file can
 * be read at once (2026-11-10) -- under a url id of its own.
 */
export function openPdfPreview(
    filePath: string,
    options: Readonly<{ isAnother?: boolean }> = {},
) {
    const fileFullName = pathBasename(filePath);
    const frameName = `pdf_preview-${fileFullName}_${Date.now()}`;
    if (options.isAnother === true) {
        return openPopupWindow(
            pathToFileURL(filePath),
            frameName,
            `${fileFullName}-${crypto.randomUUID()}`,
        );
    }
    return openPopupWindow(pathToFileURL(filePath), frameName, fileFullName, {
        appReuseOpen: true,
    });
}
