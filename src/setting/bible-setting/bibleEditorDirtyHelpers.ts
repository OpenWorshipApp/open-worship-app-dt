import { tran } from '../../lang/langHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';

// Tracks which Bible editors currently hold unsaved changes so the app can both
// block a window reload/close and block collapsing an editor that would discard
// those changes. Keyed by bibleKey -> set of dirty editor ids (one per editing
// type). This is intentionally not a React store: reading it on demand (e.g. in
// a click handler) avoids re-rendering the editor subtree on every change.
const dirtyMap = new Map<string, Set<string>>();

function hasAnyDirty() {
    for (const editorIds of dirtyMap.values()) {
        if (editorIds.size > 0) {
            return true;
        }
    }
    return false;
}

const unloadAttemptTimeout = genTimeoutAttempt(3000);
let unloadAttemptCount = 0;
function blockUnload(event: BeforeUnloadEvent) {
    unloadAttemptTimeout(() => {
        unloadAttemptCount = 0;
    });
    unloadAttemptCount++;
    if (unloadAttemptCount > 3) {
        window.removeEventListener('beforeunload', blockUnload);
        return;
    }
    event.preventDefault();
    showSimpleToast(
        tran('Unsaved Bible Data'),
        tran('You have unsaved Bible changes.') +
            ' ' +
            tran('Please save or discard them before reloading.') +
            ' ' +
            tran('Or attempt 3 times to force leaving.'),
    );
}

export function setBibleEditorDirty(
    bibleKey: string,
    editorId: string,
    isDirty: boolean,
) {
    let editorIds = dirtyMap.get(bibleKey);
    if (isDirty) {
        if (editorIds === undefined) {
            editorIds = new Set();
            dirtyMap.set(bibleKey, editorIds);
        }
        editorIds.add(editorId);
    } else if (editorIds !== undefined) {
        editorIds.delete(editorId);
        if (editorIds.size === 0) {
            dirtyMap.delete(bibleKey);
        }
    }
    if (hasAnyDirty()) {
        // Adding the same listener twice is a no-op, so this also re-arms the
        // guard if a previous force-leave attempt removed it.
        window.addEventListener('beforeunload', blockUnload);
    } else {
        window.removeEventListener('beforeunload', blockUnload);
    }
}

export function checkIsBibleKeyDirty(bibleKey: string) {
    const editorIds = dirtyMap.get(bibleKey);
    return editorIds !== undefined && editorIds.size > 0;
}
