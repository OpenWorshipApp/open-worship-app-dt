import { tran } from '../../lang/langHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { genBlockUnload } from '../../helper/blockUnloadHelpers';

// Tracks which Bible editors currently hold unsaved changes so the app can
// block a window reload/close and any UI action that would unmount an editor
// and silently discard those changes. Keyed by bibleKey -> set of dirty editor
// ids (one per editing type). This is intentionally not a React store: reading
// it on demand (e.g. in a click handler) avoids re-rendering the editor
// subtree on every change.
const dirtyMap = new Map<string, Set<string>>();

const blockUnload = genBlockUnload(() => {
    showSimpleToast(
        tran('Unsaved Bible Data'),
        tran('You have unsaved Bible changes.') +
            ' ' +
            tran('Please save or discard them before reloading.') +
            ' ' +
            tran('Or attempt 3 times to force leaving.'),
    );
});

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
    // Empty sets are deleted eagerly above, so any entry means dirty.
    if (dirtyMap.size > 0) {
        // Adding the same listener twice is a no-op, so this also re-arms the
        // guard if a previous force-leave attempt removed it.
        window.addEventListener('beforeunload', blockUnload);
    } else {
        window.removeEventListener('beforeunload', blockUnload);
    }
}

export function checkIsBibleKeyDirty(bibleKey: string) {
    return dirtyMap.has(bibleKey);
}

// Both helpers return true (after warning) when the caller must block its
// action because it would unmount an editor holding unsaved changes.
export function warnIfBibleKeyDirty(bibleKey: string, message: string) {
    if (!dirtyMap.has(bibleKey)) {
        return false;
    }
    showSimpleToast(tran('Unsaved Bible Data'), tran(message));
    return true;
}

export function warnIfAnyBibleEditorDirty(message: string) {
    if (dirtyMap.size === 0) {
        return false;
    }
    showSimpleToast(tran('Unsaved Bible Data'), tran(message));
    return true;
}
