import { useSyncExternalStore } from 'react';

import appProvider from '../server/appProvider';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { notifyElementHighlight } from '../helper/domHelpers';
import {
    getSetting,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';
import type { VaryAppDocumentType } from './appDocumentTypeHelpers';

/**
 * Whether the previewed document is pinned — i.e. whether a click on another
 * document is allowed to replace what the previewer is showing.
 *
 * A plain boolean rather than the pinned file path: "the pinned document" is
 * always whatever is selected, so a rename needs no path migration and there is
 * no second setting that can drift out of sync with the selection.
 *
 * Shared through an external store rather than `useStateSettingBoolean` because
 * the pin button and the guard live in disjoint trees, the guard has to read the
 * value synchronously outside of a hook, and the force-unpin has to be able to
 * reach the button.
 */
export const SELECTED_VARY_APP_DOCUMENT_LOCK_SETTING_NAME =
    'selected-vary-app-document-lock';

/** The pin button's DOM id, so a refusal can draw attention to it. */
export const VARY_APP_DOCUMENT_PIN_ELEMENT_ID = 'app-vary-app-document-pin';

const listeners = new Set<() => void>();

// `null` until first use. Lazily, never at module scope: reading a setting
// touches the local storage directory, and this module is imported by the
// layout, by every document row and by the presenting flow.
let isPinned: boolean | null = null;

function ensureIsPinnedRead() {
    isPinned ??=
        getSetting(SELECTED_VARY_APP_DOCUMENT_LOCK_SETTING_NAME) === 'true';
    return isPinned;
}

function notifyListeners() {
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function checkIsVaryAppDocumentPinned() {
    return ensureIsPinnedRead();
}

export function setIsVaryAppDocumentPinned(newIsPinned: boolean) {
    // Unchanged is a no-op on purpose: `forceUnpinVaryAppDocument` runs on every
    // matching delete event and on every start, and each write is a synchronous
    // file write plus a re-render.
    if (ensureIsPinnedRead() === newIsPinned) {
        return;
    }
    isPinned = newIsPinned;
    if (newIsPinned) {
        setSetting(SELECTED_VARY_APP_DOCUMENT_LOCK_SETTING_NAME, 'true');
    } else {
        // Removed, not blanked: unpinned is the default, so an install that
        // never pinned anything carries no setting file at all.
        removeSetting(SELECTED_VARY_APP_DOCUMENT_LOCK_SETTING_NAME);
    }
    notifyListeners();
}

export function toggleIsVaryAppDocumentPinned() {
    setIsVaryAppDocumentPinned(!ensureIsPinnedRead());
}

/**
 * For when there is nothing left to pin — the pinned document was deleted, or
 * the stored selection no longer resolves. A pin left on would be invisible (the
 * button hides with no selection) AND would refuse the next click.
 *
 * Presenter-only, like the pin itself. The app-document editor window runs the
 * same layout hook over this shared setting store, and its own start-up resolve
 * would otherwise silently drop the presenter's pin.
 */
export function forceUnpinVaryAppDocument() {
    if (!appProvider.isPagePresenter) {
        return;
    }
    setIsVaryAppDocumentPinned(false);
}

export function useIsVaryAppDocumentPinned() {
    return useSyncExternalStore(
        subscribe,
        ensureIsPinnedRead,
        ensureIsPinnedRead,
    );
}

function notifyPinElementHighlight() {
    const element = document.getElementById(VARY_APP_DOCUMENT_PIN_ELEMENT_ID);
    if (element === null) {
        return;
    }
    // Resolved here rather than inside the getter: `notifyElementHighlight`
    // polls a getter that answers null for ~3s, and the pin is only mounted on
    // the presenter page.
    notifyElementHighlight(
        () => {
            return element;
        },
        { type: 'warning' },
    );
}

/**
 * The one refusal predicate for changing the previewed document. `true` means
 * "refuse" — it has already toasted and flashed the pin.
 */
export function checkIsVaryAppDocumentSwitchRefused(
    currentVaryAppDocument: VaryAppDocumentType | null,
    newVaryAppDocument: VaryAppDocumentType | null,
) {
    // The pin only exists on the presenter page; the editor window shares the
    // setting store and must not be refused by a pin it cannot show.
    if (!appProvider.isPagePresenter) {
        return false;
    }
    if (!ensureIsPinnedRead()) {
        return false;
    }
    if (currentVaryAppDocument === null) {
        return false;
    }
    // Re-clicking the row that is already selected is not a switch, so it must
    // not toast.
    if (newVaryAppDocument?.filePath === currentVaryAppDocument.filePath) {
        return false;
    }
    showSimpleToast(
        tran('Document is pinned'),
        tran('Unpin the document to preview another one'),
    );
    notifyPinElementHighlight();
    return true;
}
