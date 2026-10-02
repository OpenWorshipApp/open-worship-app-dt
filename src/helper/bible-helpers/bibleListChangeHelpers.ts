import appProvider from '../../server/appProvider';

/**
 * "The bibles installed on this machine just changed" — said by the window
 * that changed them, heard by every other window.
 *
 * Each window resolves a bible key once and keeps the answer. A Reader that
 * opened on _Bible key "KJV" is not available!_ stayed on it after the KJV was
 * created in Settings: nothing ever asked it again, and its key picker leaves
 * the current key out, so the user could not re-pick it either. Only a window
 * showing that answer listens (`useSelectedBibleKey`), so this costs nothing
 * anywhere else.
 *
 * Sent from `clearBibleXMLCache`, which every writer of a bible XML already
 * calls on a create, an import, a reset and a delete.
 */
const BIBLE_LIST_CHANGED_BROADCAST_CHANNEL = 'all:app:bible-list-changed';
const BIBLE_LIST_CHANGED_RENDERER_CHANNEL = 'main:app:bible-list-changed';

export function notifyBibleListChanged() {
    appProvider.messageUtils.sendData(BIBLE_LIST_CHANGED_BROADCAST_CHANNEL);
}

/** Returns the unregister function, so a hook can hand it back as its effect
 * cleanup without knowing the channel names. */
export function registerBibleListChangedListener(handler: () => void) {
    appProvider.messageUtils.listenForData(
        BIBLE_LIST_CHANGED_RENDERER_CHANNEL,
        handler,
    );
    return () => {
        appProvider.messageUtils.removeListener(
            BIBLE_LIST_CHANGED_RENDERER_CHANNEL,
            handler,
        );
    };
}
