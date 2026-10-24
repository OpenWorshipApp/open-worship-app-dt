import { lazy, useCallback, useState } from 'react';

import AppSuspenseComp from '../others/AppSuspenseComp';
import { useAppEffect } from '../helper/appHooks';
import appProvider from '../server/appProvider';
import {
    registerAppMenuClicked,
    setAppMenuItems,
    tran,
} from '../lang/langHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { presentingControlEventMappers } from '../keyboard-shortcut/appShortcutMappers';

const ControllerCompLazy = lazy(() => import('./ControllerComp'));

// Module-level so the mapper array keeps one identity for the life of the
// process — this component is mounted in every window for the whole session.
// Declared with every other shortcut, which spells out every platform: a
// mapper carrying only another platform's control keys makes `toShortcutKey`
// THROW, here during render, in every window.
const keyboardEventMappers = presentingControlEventMappers;

// Gate for the app-wide annotation overlay. Nothing but this tiny component and
// its menu entry exists until the user actually starts controlling — the
// overlay, its two engines, the tool panels and the keyboard screencast are all
// behind the lazy import, so an operator who never uses the feature pays nothing
// for it.
export default function PresentingControlComp() {
    const [isControlling, setIsControlling] = useState(false);
    // Identity-stable, so the menu listener below is registered ONCE for the
    // life of the window rather than re-registered on every render — and so the
    // effect that registers it does not silently capture a stale closure.
    // A TOGGLE, both from the key and from the menu — the menu already says so
    // (`isTogglePresentingControl`), and a chord that opens the overlay but
    // cannot take it away again sends the operator hunting for the ✕ with the
    // drawing still over the app.
    //
    // Armed, the overlay swallows the keyboard whole and replays only its own
    // keys under its own layer, so this chord cannot close it from there —
    // Escape disarms first, which is the order the toolbar teaches anyway.
    const handleStartControlling = useCallback(() => {
        setIsControlling((oldIsControlling) => {
            return !oldIsControlling;
        });
    }, []);
    const handleMenuItemClicked = useCallback(
        (_event: any, data: { isTogglePresentingControl?: boolean }) => {
            if (data?.isTogglePresentingControl !== true) {
                return;
            }
            // The menu-click message reaches every open window; only the one the
            // user is actually looking at should sprout an overlay.
            if (!appProvider.getIsWindowFocused()) {
                return;
            }
            handleStartControlling();
        },
        [handleStartControlling],
    );
    useKeyboardRegistering(keyboardEventMappers, handleStartControlling, []);
    useAppEffect(() => {
        return registerAppMenuClicked(handleMenuItemClicked);
    }, [handleMenuItemClicked]);
    useAppEffect(() => {
        setAppMenuItems(
            'presenting-control',
            {
                tools: [
                    {
                        label: tran('Start Controlling'),
                        accelerator: appProvider.systemUtils.isMac
                            ? 'Command+Shift+P'
                            : 'Ctrl+Shift+P',
                        clickData: { isTogglePresentingControl: true },
                    },
                ],
            },
            // Every window contributes this key and only the last one to load
            // is remembered, so an owner-routed click reaches that window and
            // no other -- which is why opening Settings used to take this menu
            // item away from the presenter.
            { isRoutedToFocusedWindow: true },
        );
    }, []);

    if (!isControlling) {
        return null;
    }

    return (
        <AppSuspenseComp>
            <ControllerCompLazy
                onClose={() => {
                    setIsControlling(false);
                }}
            />
        </AppSuspenseComp>
    );
}
