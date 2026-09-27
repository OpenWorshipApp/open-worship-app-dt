import ScreenForegroundComp from '../ScreenForegroundComp';
import ScreenBackgroundComp from '../ScreenBackgroundComp';
import ScreenVaryAppDocumentComp from '../ScreenVaryAppDocumentComp';
import ScreenBibleComp from '../ScreenBibleComp';
import { getScreenManagerByScreenId } from '../managers/screenManagerHelpers';
import {
    ScreenManagerBaseContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';
import type ScreenManagerBase from '../managers/ScreenManagerBase';
import type ScreenEffectManager from '../managers/ScreenEffectManager';
import {
    getIsWallpaperBackdropEnabled,
    refreshDisplayWallpaper,
    useDisplayWallpaper,
    type DisplayWallpaperType,
} from './displayWallpaperHelpers';
import { checkIsDarkMode } from '../../others/themeHelpers';
import ScreenDrawComp from '../ScreenDrawComp';
import ScreenFocusComp from '../ScreenFocusComp';
import ScreenMaskComp from '../ScreenMaskComp';

const genBGBlank = () => {
    const isDarkMode = checkIsDarkMode();
    if (isDarkMode) {
        return `linear-gradient(45deg, var(--bs-gray-700) 25%, var(--bs-gray-800) 25%),
        linear-gradient(-45deg, var(--bs-gray-700) 25%, var(--bs-gray-800) 25%),
        linear-gradient(45deg, var(--bs-gray-800) 75%, var(--bs-gray-700) 75%),
        linear-gradient(-45deg, var(--bs-gray-800) 75%, var(--bs-gray-700) 75%)`;
    }
    return `linear-gradient(45deg, var(--bs-gray-300) 25%, var(--bs-gray-200) 25%),
    linear-gradient(-45deg, var(--bs-gray-300) 25%, var(--bs-gray-200) 25%),
    linear-gradient(45deg, var(--bs-gray-200) 75%, var(--bs-gray-300) 75%),
    linear-gradient(-45deg, var(--bs-gray-200) 75%, var(--bs-gray-300) 75%)`;
};

export function genStyleRendering(effectManager: ScreenEffectManager) {
    return Object.entries(effectManager.styleAnimList).map(
        ([effectType, styleAnim]) => {
            return <style key={effectType}>{styleAnim.styleText}</style>;
        },
    );
}

// The desktop lays its picture out its own way, and the card copies that rather
// than always filling: a "Fit" wallpaper really does show the desktop colour
// down its sides on the monitor, so showing it edge to edge here would be a
// prettier lie.
const WALLPAPER_FIT_STYLE_MAP = {
    cover: { backgroundSize: 'cover', backgroundRepeat: 'no-repeat' },
    contain: { backgroundSize: 'contain', backgroundRepeat: 'no-repeat' },
    fill: { backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' },
    center: { backgroundSize: 'auto', backgroundRepeat: 'no-repeat' },
    tile: { backgroundSize: 'auto', backgroundRepeat: 'repeat' },
} as const;

function genWallpaperStyle(wallpaper: DisplayWallpaperType) {
    const { imageDataUrl, color, fit } = wallpaper;
    if (imageDataUrl === null) {
        // A desktop with no picture on it is a plain colour, and that IS what
        // the audience would see.
        return { backgroundColor: color ?? undefined };
    }
    return {
        ...(WALLPAPER_FIT_STYLE_MAP[fit] ?? WALLPAPER_FIT_STYLE_MAP.cover),
        backgroundColor: color ?? undefined,
        backgroundImage: `url("${imageDataUrl}")`,
        backgroundPosition: 'center',
    };
}

/**
 * What is BEHIND everything the app puts on this screen.
 *
 * A screen window is `transparent: true`, so the audience sees that monitor's
 * own desktop wherever the app draws nothing. The checkered pattern was a
 * stand-in for that; the display's real wallpaper is drawn instead whenever
 * this machine will say what it is, and the pattern remains the honest answer
 * when it will not -- the feature turned off, a desktop environment with no
 * reader for it, a wallpaper file that has moved.
 *
 * The wallpaper, never a capture of the screen (see `displayWallpaperHelpers`):
 * it holds no other window, so a screen assigned to the machine's own monitor
 * does not draw a picture of the app inside itself, and it needs no retaking
 * during a service.
 */
function RenderBackdropComp({
    screenManagerBase,
}: Readonly<{
    screenManagerBase: ScreenManagerBase;
}>) {
    useScreenManagerEvents(['display-id'], screenManagerBase);
    // Refresh Preview reads it again -- it is the one control the operator has
    // after changing the desktop background.
    useScreenManagerEvents(['refresh'], screenManagerBase, () => {
        refreshDisplayWallpaper(screenManagerBase.displayId);
    });
    const wallpaper = useDisplayWallpaper(
        screenManagerBase.displayId,
        getIsWallpaperBackdropEnabled(),
    );
    return (
        <div
            style={{
                pointerEvents: 'none',
                position: 'absolute',
                width: '100%',
                height: '100%',
                ...(wallpaper === null
                    ? {
                          backgroundImage: genBGBlank(),
                          backgroundSize: '20px 20px',
                          backgroundPosition:
                              '0 0, 0 10px, 10px -10px, -10px 0px',
                      }
                    : genWallpaperStyle(wallpaper)),
            }}
        />
    );
}

export default function MiniScreenAppComp({
    screenId,
}: Readonly<{
    screenId: number;
}>) {
    const screenManager = getScreenManagerByScreenId(screenId);
    if (screenManager === null) {
        return null;
    }
    const {
        varyAppDocumentEffectManager,
        backgroundEffectManager,
        foregroundEffectManager,
    } = screenManager;
    return (
        <ScreenManagerBaseContext value={screenManager}>
            {genStyleRendering(backgroundEffectManager)}
            {genStyleRendering(varyAppDocumentEffectManager)}
            {genStyleRendering(foregroundEffectManager)}
            <RenderBackdropComp screenManagerBase={screenManager} />
            <ScreenBackgroundComp />
            <ScreenVaryAppDocumentComp />
            <ScreenBibleComp />
            <ScreenForegroundComp />
            <ScreenDrawComp />
            <ScreenFocusComp />
            {/* Last, for the reason given in `ScreenAppComp`. */}
            <ScreenMaskComp />
        </ScreenManagerBaseContext>
    );
}
