import { use, useCallback, type MouseEvent } from 'react';

import { tran } from '../lang/langHelpers';
import { SelectedVaryAppDocumentContext } from '../app-document-list/appDocumentHelpers';
import {
    toggleIsVaryAppDocumentPinned,
    useIsVaryAppDocumentPinned,
    VARY_APP_DOCUMENT_PIN_ELEMENT_ID,
} from '../app-document-list/varyAppDocumentLockHelpers';

/**
 * Pins the previewed document so an accidental click on another one cannot
 * replace it. Hidden when nothing is being previewed — there is nothing to pin,
 * and a pin left on with no selection would silently refuse the next click.
 *
 * Rendered INSIDE the Documents tab's own button, so it reads as that tab's
 * badge rather than as a loose control between two tabs. That means it is a
 * `span`, not a nested `button` (which the parser would drop), and it has to
 * swallow both events the tab button listens for — a plain click toggles the
 * tab, a right-click solos it.
 */
export default function VaryAppDocumentPinComp() {
    const selectedContext = use(SelectedVaryAppDocumentContext);
    const isPinned = useIsVaryAppDocumentPinned();
    const handleClicking = useCallback((event: MouseEvent<HTMLSpanElement>) => {
        event.preventDefault();
        event.stopPropagation();
        toggleIsVaryAppDocumentPinned();
    }, []);
    if (selectedContext?.selectedVaryAppDocument == null) {
        return null;
    }
    const label = isPinned ? tran('Unpin document') : tran('Pin document');
    return (
        <span
            id={VARY_APP_DOCUMENT_PIN_ELEMENT_ID}
            className={
                'app-vary-app-document-pin' + (isPinned ? ' app-pinned' : '')
            }
            role="button"
            tabIndex={-1}
            title={label}
            aria-label={label}
            aria-pressed={isPinned}
            onClick={handleClicking}
            onContextMenu={handleClicking}
        >
            <i className={`bi bi-${isPinned ? 'lock-fill' : 'unlock'}`} />
        </span>
    );
}
