import { useCallback } from 'react';

import {
    toShortcutKey,
    useKeyboardRegistering,
} from '../../event/KeyboardEventListener';
import {
    useScreenManagerBaseContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';
import { useAppCurrentRef } from '../../helper/appHooks';

const showingScreenEventMap = { key: 'F5' };
export default function ShowHideScreen() {
    const screenManagerBase = useScreenManagerBaseContext();
    useKeyboardRegistering(
        [showingScreenEventMap],
        () => {
            screenManagerBase.isShowing = !screenManagerBase.isShowing;
        },
        [screenManagerBase],
    );
    const isShowing = screenManagerBase.isShowing;
    useScreenManagerEvents(['visible'], screenManagerBase);
    const screenManagerBaseRef = useAppCurrentRef(screenManagerBase);
    const isShowingRef = useAppCurrentRef(isShowing);
    const handleToggleShowing = useCallback(() => {
        screenManagerBaseRef.current.isShowing = !isShowingRef.current;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={
                'd-flex show-hide app-caught-hover-pointer px-2' +
                ` ${isShowing ? 'showing' : ''}`
            }
            title={
                'Toggle showing screen ' +
                `[${toShortcutKey(showingScreenEventMap)}]`
            }
            style={{
                opacity: isShowing ? 1 : 0.4,
                borderRadius: '5px',
                border: isShowing ? '1px solid var(--bs-gray-500)' : '',
            }}
            onClick={handleToggleShowing}
        >
            <i
                className={
                    'app-showing-indicator bi' +
                    ` bi-file-slides${isShowing ? '-fill' : ''}`
                }
                style={{ transform: 'translateY(-3px)' }}
            />
        </div>
    );
}
