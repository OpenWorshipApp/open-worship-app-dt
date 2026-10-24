import { useCallback, useState } from 'react';

import {
    STAY_AWAKE_SETTING_NAME,
    toIsStayAwake,
} from '../../electron/stayAwakeProtocol';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { appHomeStorage } from '../server/appHomeStorage';

/**
 * Whether this computer is kept from sleeping while the main window is on the
 * Presenter or on the Screen Mirror page -- the two left alone for a whole
 * service. On unless switched off. The main process holds the OS request
 * (`keepAwakeOnPresentingPages` in `electron/ElectronMainController.ts`) and
 * acts on the very write this button makes, so there is no second message to
 * send and nothing here to release.
 *
 * Off does not let a service go dark: a showing screen keeps the display awake
 * by itself (`ElectronScreenController`), whatever this says.
 *
 * A file of its own rather than one more button in `commonButtons`: the Screen
 * Mirror page mounts it too, and that page loads none of the app header's
 * modules.
 */
export default function StayAwakeButtonComp({
    className,
}: Readonly<{ className?: string }>) {
    const [isStayAwake, setIsStayAwake] = useState(() => {
        return toIsStayAwake(appHomeStorage.getItem(STAY_AWAKE_SETTING_NAME));
    });
    const isStayAwakeRef = useAppCurrentRef(isStayAwake);
    const handleClick = useCallback(() => {
        const isNewStayAwake = !isStayAwakeRef.current;
        appHomeStorage.setItem(STAY_AWAKE_SETTING_NAME, `${isNewStayAwake}`);
        setIsStayAwake(isNewStayAwake);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const stateText = isStayAwake
        ? tran('this computer will not sleep while this page is open')
        : tran('turned off, this computer may sleep when no screen is showing');
    return (
        <button
            type="button"
            className={
                `btn btn-outline-${isStayAwake ? 'info' : 'secondary'}` +
                (className ? ` ${className}` : '')
            }
            title={`${tran('Stay Awake')} — ${stateText}`}
            // The name stays put and `aria-pressed` carries the state, so a
            // screen reader says "Stay Awake, pressed" rather than a sentence
            // that changes under it.
            aria-label={tran('Stay Awake')}
            aria-pressed={isStayAwake}
            onClick={handleClick}
        >
            <i
                className={`bi bi-cup${isStayAwake ? '-hot-fill' : ''}`}
                aria-hidden="true"
            />
        </button>
    );
}
