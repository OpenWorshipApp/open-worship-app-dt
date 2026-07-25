import { useCallback, type KeyboardEvent } from 'react';

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
export default function ShowHideScreenComp() {
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
    // Toggle off the manager's live state, not a snapshot ref — two quick
    // activations before the `visible` re-render must not compute the same
    // target state and cancel out.
    const handleToggleShowing = useCallback(() => {
        const manager = screenManagerBaseRef.current;
        manager.isShowing = !manager.isShowing;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Enter/Space activate it the way they would a real button. Needed because
    // this is a styled div rather than a <button>: without them the control is
    // in the tab order but does nothing when pressed.
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        // holding the key must not rapid-toggle real show/hide window work
        if (event.repeat) {
            return;
        }
        event.preventDefault();
        const manager = screenManagerBaseRef.current;
        manager.isShowing = !manager.isShowing;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const toggleTitle =
        'Toggle showing screen ' + `[${toShortcutKey(showingScreenEventMap)}]`;
    return (
        // Showing/hiding a screen is the most important control in the app, but
        // it renders as a div for styling — so it needs the button semantics
        // spelled out by hand: without role/tabIndex/aria-label it is absent
        // from the accessibility tree entirely and unreachable by keyboard
        // (every sibling in this header is a real <button>). aria-pressed
        // carries the on/off state that the opacity/border convey visually.
        <div
            role="button"
            tabIndex={0}
            aria-label={toggleTitle}
            aria-pressed={isShowing}
            className={
                'd-flex show-hide app-caught-hover-pointer px-2' +
                ` ${isShowing ? 'showing' : ''}`
            }
            title={toggleTitle}
            style={{
                opacity: isShowing ? 1 : 0.4,
                borderRadius: '5px',
                border: isShowing ? '1px solid var(--bs-gray-500)' : '',
            }}
            onClick={handleToggleShowing}
            onKeyDown={handleKeyDown}
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
