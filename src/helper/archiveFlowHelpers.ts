import { handleError } from './errorHelpers';
import { tran } from '../lang/langHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { showSimpleToast } from '../toast/toastHelpers';

/**
 * The two wrappers every archive flow puts around its file work -- the same
 * pair `bibleXMLArchiveMenuHelpers.tsx` and `dataArchiveMenuHelpers.tsx` each
 * still keep a copy of.
 */

/**
 * Run one step under the progress bar. Written once because the failure mode of
 * a hand-balanced show/hide pair is a progress bar that never goes away, and it
 * is invisible until it happens.
 */
export async function runWithProgress<T>(title: string, run: () => Promise<T>) {
    showProgressBar(title);
    try {
        return await run();
    } finally {
        hideProgressBar(title);
    }
}

/** A flow ends the same way whatever failed: log it and say so under its title. */
export async function runMenuAction(title: string, run: () => Promise<void>) {
    try {
        await run();
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            tran(title),
            error?.message ?? `Unable to complete ${title}`,
        );
    }
}
