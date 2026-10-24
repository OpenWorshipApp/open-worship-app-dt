import { lazy, Suspense, useCallback, useState } from 'react';

import { useAppEffect } from '../helper/appHooks';
import {
    registerAppMenuClicked,
    setAppMenuItems,
    tran,
} from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { checkIsMainWindow } from '../server/mainWindowHelpers';

// The list and everything it formats load on the first open, never at startup:
// this host is mounted in every window for the whole session.
const LazyKeyboardShortcutsPanelComp = lazy(() => {
    return import('./KeyboardShortcutsPanelComp');
});

const MENU_KEY = 'keyboard-shortcuts';

type KeyboardShortcutsMenuClickType = {
    isOpenKeyboardShortcuts?: boolean;
};

/**
 * Help -> Keyboard Shortcuts: a floating panel listing what the page in front
 * answers to, with a search box.
 *
 * Renders nothing until it is asked for, so mounting it in every window costs a
 * menu listener. The panel claims no keyboard layer on purpose -- every key it
 * lists keeps working while it is open, so a person can try one out.
 */
export default function KeyboardShortcutsComp() {
    const [isOpen, setIsOpen] = useState(false);
    // Asked for again while open: pull the panel back to the front rather than
    // reopening it.
    const [raiseToken, setRaiseToken] = useState(0);
    const handleClosing = useCallback(() => {
        setIsOpen(false);
    }, []);

    useAppEffect(() => {
        const unregister =
            registerAppMenuClicked<KeyboardShortcutsMenuClickType>(
                (_event, data) => {
                    // The click reaches every window; only the one in front
                    // opens its list.
                    if (
                        data?.isOpenKeyboardShortcuts !== true ||
                        !appProvider.getIsWindowFocused()
                    ) {
                        return;
                    }
                    setIsOpen(true);
                    setRaiseToken((oldToken) => {
                        return oldToken + 1;
                    });
                },
            );
        // The main window owns the shared menu; every window listens, so
        // closing a popup does not withdraw the item from the others. Routed to
        // the focused window, which on a Mac -- and in a popup whose hidden
        // menu bar Alt brings back -- is the window the list is about.
        const isMainWindow = checkIsMainWindow();
        if (isMainWindow) {
            setAppMenuItems(
                MENU_KEY,
                {
                    help: [
                        {
                            label: tran('Keyboard Shortcuts'),
                            clickData: { isOpenKeyboardShortcuts: true },
                        },
                    ],
                },
                { isRoutedToFocusedWindow: true },
            );
        }
        return () => {
            unregister();
            if (isMainWindow) {
                setAppMenuItems(MENU_KEY, null);
            }
        };
    }, []);

    if (!isOpen) {
        return null;
    }
    return (
        <Suspense fallback={null}>
            <LazyKeyboardShortcutsPanelComp
                raiseToken={raiseToken}
                onClose={handleClosing}
            />
        </Suspense>
    );
}
