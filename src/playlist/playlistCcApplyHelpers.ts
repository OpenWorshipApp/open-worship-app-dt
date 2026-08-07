import { captureChosenScreenIds } from '../_screen/managers/screenChoosingHelpers';
import {
    applyOnScreenIds,
    showDroppedDataOnScreenIds,
} from '../_screen/managers/screenDroppedHelpers';
import { handleError } from '../helper/errorHelpers';
import { firePlaylistRunAction } from './playlistAutoNextHelpers';
import { resolveCcScreenIds } from './playlistCcHelpers';
import type PlaylistItem from './PlaylistItem';

/**
 * Putting a host's CC elements on a screen.
 *
 * Its own module, and deliberately importing `PlaylistItem` as a TYPE only:
 * `playlistHelpers` calls into this and `PlaylistItem` imports
 * `playlistHelpers`, so a value import here would close the cycle
 * `playlistItemsHelpers` was split out to avoid.
 */

/**
 * Put a host's CC elements on the screens the HOST resolved to.
 *
 * Nothing here CHOOSES a screen: a CC follows one click, and one click may raise
 * only one "which screen?" menu. That is why this goes through `applyOnScreenIds`
 * rather than `showDroppedDataOnScreens` — the latter would fall through to the
 * selected screens and then to the menu the moment the ids were empty.
 *
 * There is no parked check here, unlike the host's: a CC is NEVER parked —
 * `PlaylistItem` strips the flag on write and on read alike — so a listed CC is
 * one that fires. What cannot reach a screen at all is still stepped over.
 */
export async function applyPlaylistCcItemsOnScreenIds(
    ccItems: PlaylistItem[],
    hostScreenIds: number[],
) {
    for (const ccItem of ccItems) {
        // The one follower that goes nowhere near a screen: a `Next: Timeout`
        // attached to a line means "show this, and go on by yourself N seconds
        // later". Fired only from HERE, once the host has actually resolved its
        // screens, so a dismissed "which screen?" menu — nothing presented —
        // starts no countdown either. An interval is refused as a CC outright
        // (`canBeCcItem`), and a hand-edited file that carries one is skipped
        // rather than left walking the sheet forward on its own.
        const { runAction } = ccItem;
        if (runAction !== null) {
            if (runAction.canBeCcItem) {
                firePlaylistRunAction(ccItem);
            }
            continue;
        }
        if (!ccItem.isScreenReachable) {
            continue;
        }
        // A `Screen: Show`/`Screen: Hide` runs on the screens it NAMES even as a
        // follower: it carries its own pin here (`resolveCcItemJson` keeps the
        // field, and `buildCcItems` lets the CC write its own over it), and
        // falling through to the host's screens is exactly the ambient answer it
        // exists to avoid — "put this slide up on screen 1" must not also light
        // screen 1 when the line said screen 2.
        const screenAction = ccItem.screenAction;
        const ownScreenIds = ccItem.screenIds;
        if (screenAction?.requiresScreenIds === true) {
            if (ownScreenIds.length > 0) {
                await applyOnScreenIds(ownScreenIds, (screenManager) => {
                    screenAction.apply(screenManager);
                });
            }
            continue;
        }
        const screenIds = resolveCcScreenIds(ownScreenIds, hostScreenIds);
        if (screenIds.length === 0) {
            continue;
        }
        if (ccItem.isAction) {
            // Only the screen family can be a follower at all — a run action
            // reaches no screen, so `isScreenReachable` above has already
            // stepped over it.
            if (screenAction === null) {
                continue;
            }
            await applyOnScreenIds(screenIds, (screenManager) => {
                screenAction.apply(screenManager);
            });
            continue;
        }
        const droppedData = await ccItem.toDroppedData();
        if (droppedData === null) {
            continue;
        }
        await showDroppedDataOnScreenIds(screenIds, droppedData);
    }
    // Imported lazily rather than at the top, for INIT ORDER — not for code
    // splitting. The on-screen helpers import `Playlist` and run screen-manager
    // subscriptions at module scope, and this module sits under
    // `playlistHelpers`, which `PlaylistItem` imports: a static import here
    // would close that cycle and drag the whole screen graph into merely
    // LISTING a playlist. The build therefore reports this as an
    // `INEFFECTIVE_DYNAMIC_IMPORT` — the components import it statically anyway,
    // so it shares their chunk. That warning is expected; making this static to
    // silence it is the bug. Resolved once and cached by the loader thereafter.
    const { refreshOnScreenAfterPresenting } =
        await import('./playlistOnScreenHelpers');
    refreshOnScreenAfterPresenting();
}

/**
 * Arm the CC followers of ONE click, then get out of the way.
 *
 * The click goes on to do exactly what it did before; when the screens it aimed
 * at are decided, the followers land on those same screens. An empty answer —
 * the menu was dismissed, or this is not the presenter page — applies nothing.
 *
 * Returns immediately when there is nothing to follow, which is the case on
 * every row of every run sheet that uses no CCs: the common path pays one length
 * check and registers nothing.
 */
export function armPlaylistCcPropagation(event: any, ccItems: PlaylistItem[]) {
    if (ccItems.length === 0) {
        return;
    }
    captureChosenScreenIds(event, (screenIds) => {
        if (screenIds.length === 0) {
            return;
        }
        applyPlaylistCcItemsOnScreenIds(ccItems, screenIds).catch(handleError);
    });
}
