import { useState } from 'react';

import { useAppEffect } from '../../helper/appHooks';
import { handleError } from '../../helper/errorHelpers';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import { electronSendAsync } from '../../server/electronSendHelpers';
import { getAllDisplays } from '../managers/screenHelpers';
import { MIRROR_REMOTE_DISPLAY_FIRST } from '../../../electron/screenMirrorProtocol';

/**
 * The monitor's own desktop background, drawn behind everything a mini screen
 * card renders, in place of the checkered "nothing here" pattern.
 *
 * A screen window is `transparent: true`, so where the app puts nothing the
 * audience sees that display's desktop. The pattern stood for that; this shows
 * it.
 *
 * It is a WALLPAPER, not a photograph of the screen, and that is what makes it
 * affordable on the low-spec machines this app targets: it is read once per
 * display, never retaken on a timer, and holds no windows — so a screen assigned
 * to the machine's own monitor does not draw a picture of the app inside itself.
 * One read is shared by every card on that display and released with the last of
 * them.
 */

// Wide enough for a card at its default size, small enough that the JPEG behind
// it stays tens of kilobytes.
const WALLPAPER_WIDTH = 400;

export const WALLPAPER_BACKDROP_SETTING_NAME = 'mini-screen-wallpaper-backdrop';

export function getIsWallpaperBackdropEnabled() {
    return getSetting(WALLPAPER_BACKDROP_SETTING_NAME) !== 'false';
}

export function setIsWallpaperBackdropEnabled(isEnabled: boolean) {
    setSetting(WALLPAPER_BACKDROP_SETTING_NAME, isEnabled ? 'true' : 'false');
}

export type DisplayWallpaperType = {
    imageDataUrl: string | null;
    color: string | null;
    fit: 'cover' | 'contain' | 'fill' | 'center' | 'tile';
};

type ListenerType = (wallpaper: DisplayWallpaperType | null) => void;

type WallpaperStateType = {
    wallpaper: DisplayWallpaperType | null;
    listeners: Set<ListenerType>;
    isReading: boolean;
};

const stateMap = new Map<number, WallpaperStateType>();

/**
 * Windows names each monitor's pre-fitted wallpaper copy after its PIXEL size
 * and macOS lists one picture per display in order, so both are resolved from
 * the display list the renderer already holds rather than from the main
 * process's `screen` module.
 */
function readDisplayPlace(displayId: number) {
    const { displays } = getAllDisplays();
    const displayIndex = displays.findIndex((display) => {
        return display.id === displayId;
    });
    const display = displays[displayIndex];
    if (display === undefined) {
        return { displayIndex: 0, sizes: [] };
    }
    const { bounds, scaleFactor } = display as any;
    const sizes = [{ width: bounds.width, height: bounds.height }];
    if (typeof scaleFactor === 'number' && scaleFactor !== 1) {
        // The cached file is named in physical pixels; `bounds` is in DIP.
        sizes.unshift({
            width: Math.round(bounds.width * scaleFactor),
            height: Math.round(bounds.height * scaleFactor),
        });
    }
    return { displayIndex, sizes };
}

async function readWallpaper(
    displayId: number,
    state: WallpaperStateType,
    isForced = false,
) {
    if (displayId <= MIRROR_REMOTE_DISPLAY_FIRST) return;
    if (state.isReading) {
        return;
    }
    state.isReading = true;
    try {
        const { displayIndex, sizes } = readDisplayPlace(displayId);
        const wallpaper = await electronSendAsync<DisplayWallpaperType | null>(
            'main:app:read-display-wallpaper',
            {
                displayId,
                displayIndex,
                sizes,
                width: WALLPAPER_WIDTH,
                isForced,
            },
        );
        // The card may have gone while the read was in flight; writing into a
        // dropped state would resurrect the picture it was meant to release.
        if (stateMap.get(displayId) !== state) {
            return;
        }
        state.wallpaper = wallpaper;
        for (const listener of state.listeners) {
            listener(wallpaper);
        }
    } catch (error) {
        // A desktop that will not say what its background is not something the
        // operator can act on, and a backdrop is not worth a toast: the card
        // keeps its pattern and the reason goes to the log.
        handleError(error);
    } finally {
        state.isReading = false;
    }
}

/**
 * Registers a card's interest in `displayId`, hands it whatever is already
 * known and reads the wallpaper on the first subscriber. It is held while any
 * card is subscribed and released with the last one.
 */
export function subscribeDisplayWallpaper(
    displayId: number,
    listener: ListenerType,
) {
    let state = stateMap.get(displayId);
    const isFirst = state === undefined;
    if (state === undefined) {
        state = { wallpaper: null, listeners: new Set(), isReading: false };
        stateMap.set(displayId, state);
    }
    const currentState = state;
    currentState.listeners.add(listener);
    listener(currentState.wallpaper);
    if (isFirst) {
        readWallpaper(displayId, currentState);
    }
    return () => {
        currentState.listeners.delete(listener);
        if (
            currentState.listeners.size === 0 &&
            stateMap.get(displayId) === currentState
        ) {
            stateMap.delete(displayId);
        }
    };
}

/**
 * Reads the wallpaper again -- what Refresh Preview is asking for, and the only
 * thing that picks up a desktop background the user has just changed.
 */
export function refreshDisplayWallpaper(displayId: number) {
    const state = stateMap.get(displayId);
    if (state === undefined) {
        return;
    }
    // Forced: the main process holds its read for a few minutes, and the whole
    // point of this press is a background the user has just changed.
    readWallpaper(displayId, state, true);
}

/** The desktop background of `displayId`, or null while there is none to draw. */
export function useDisplayWallpaper(displayId: number, isEnabled: boolean) {
    const [wallpaper, setWallpaper] = useState<DisplayWallpaperType | null>(
        null,
    );
    useAppEffect(() => {
        if (!isEnabled) {
            // Turned off mid-session: let go of the picture rather than keep
            // one nothing is going to draw.
            setWallpaper(null);
            return;
        }
        return subscribeDisplayWallpaper(displayId, setWallpaper);
    }, [displayId, isEnabled]);
    return isEnabled ? wallpaper : null;
}
