import { useState } from 'react';

import { useAppEffect } from './appHooks';
import appProvider from '../server/appProvider';
import { checkIsMainWindow } from '../server/mainWindowHelpers';
import {
    PACKAGE_UPDATES_BROADCAST_CHANNEL,
    PACKAGE_UPDATES_GET_CHANNEL,
    PACKAGE_UPDATES_RENDERER_CHANNEL,
    mergePackageUpdates,
    type PackageUpdatesType,
} from '../../electron/packageUpdateProtocol';

/**
 * "An installed package has an update", in every window (2026-11-04, the user:
 * _sign on the gear icon then on each tab then on the item to update_). Main
 * keeps the answer for the launch (`electron/packageUpdateProtocol.ts`).
 *
 * A leaf on purpose: the gear is in every top-bar window, and the look itself
 * -- the catalog read, the Extra Binaries' file stats -- is imported only when
 * it runs (`packageUpdateCheckHelpers.ts`), never at start-up.
 */

// Long enough for the window to finish its own start-up first: a sign nobody
// is waiting for is not worth a slower first paint on a weak machine.
export const PACKAGE_UPDATE_CHECK_DELAY_MILLISECONDS = 10_000;

// Once per window life: the reader's header may draw a gear more than once.
let isLaunchCheckScheduled = false;

// A provider with no messages (a unit test's) has no main to tell or ask.
function getMessageUtils() {
    const messageUtils = appProvider.messageUtils;
    return typeof messageUtils?.sendData === 'function' &&
        typeof messageUtils.listenForData === 'function'
        ? messageUtils
        : null;
}

/** What a window has learned; each half is optional and kept otherwise. */
export function reportPackageUpdates(report: Partial<PackageUpdatesType>) {
    getMessageUtils()?.sendData(PACKAGE_UPDATES_BROADCAST_CHANNEL, report);
}

async function runLaunchCheck() {
    try {
        const { checkPackageUpdates } =
            await import('./packageUpdateCheckHelpers');
        await checkPackageUpdates();
    } catch (error) {
        console.error('Failed to check the installed packages:', error);
    }
}

function scheduleLaunchCheck() {
    if (isLaunchCheckScheduled || !checkIsMainWindow()) {
        return;
    }
    isLaunchCheckScheduled = true;
    setTimeout(runLaunchCheck, PACKAGE_UPDATE_CHECK_DELAY_MILLISECONDS);
}

/**
 * The packages with an update, kept current: asked once on mount, then told.
 * `null` until main has an answer. `isCheckingAtLaunch` (the gear) starts the
 * launch's one look when main says nobody has looked yet -- in the main window
 * only, so a Settings window opened first does not look as well.
 */
export function usePackageUpdates(isCheckingAtLaunch = false) {
    const [packageUpdates, setPackageUpdates] =
        useState<PackageUpdatesType | null>(null);
    useAppEffect(() => {
        const messageUtils = getMessageUtils();
        if (messageUtils === null) {
            return;
        }
        const listener = (_event: unknown, data: unknown) => {
            if (data === null || data === undefined) {
                if (isCheckingAtLaunch) {
                    scheduleLaunchCheck();
                }
                return;
            }
            setPackageUpdates(mergePackageUpdates(null, data));
        };
        messageUtils.listenForData(PACKAGE_UPDATES_RENDERER_CHANNEL, listener);
        // Listening first, so the answer cannot arrive before the ear.
        messageUtils.sendData(PACKAGE_UPDATES_GET_CHANNEL);
        return () => {
            messageUtils.removeListener(
                PACKAGE_UPDATES_RENDERER_CHANNEL,
                listener,
            );
        };
    }, []);
    return packageUpdates;
}

export { checkHasPackageUpdate } from '../../electron/packageUpdateProtocol';
export type { PackageUpdatesType } from '../../electron/packageUpdateProtocol';
