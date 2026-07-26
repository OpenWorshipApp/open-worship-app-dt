import { lazy, useCallback, useState } from 'react';

import AppSuspenseComp from '../others/AppSuspenseComp';
import { useAppEffect } from '../helper/appHooks';
import appProvider from '../server/appProvider';
import {
    registerAppMenuClicked,
    setAppMenuItems,
    tran,
} from '../lang/langHelpers';
import {
    type EventMapperType,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';

const ControllerCompLazy = lazy(() => import('./ControllerComp'));

// Module-level so the mapper array keeps one identity for the life of the
// process — this component is mounted in every window for the whole session.
// Every platform is spelled out because `toShortcutKey` THROWS on a mapper that
// carries another platform's control keys and none of its own, and that throw
// would happen during this component's render, in every window.
const keyboardEventMappers: EventMapperType[] = [
    {
        key: 'P',
        mControlKey: ['Meta', 'Shift'],
        wControlKey: ['Ctrl', 'Shift'],
        lControlKey: ['Ctrl', 'Shift'],
    },
];

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
    const handleStartControlling = useCallback(() => {
        setIsControlling(true);
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
        setAppMenuItems('presenting-control', {
            tools: [
                {
                    label: tran('Start Controlling'),
                    accelerator: appProvider.systemUtils.isMac
                        ? 'Command+Shift+P'
                        : 'Ctrl+Shift+P',
                    clickData: { isTogglePresentingControl: true },
                },
            ],
        });
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
