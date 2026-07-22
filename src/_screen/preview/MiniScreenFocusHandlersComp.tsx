import { useState } from 'react';

import { tran } from '../../lang/langHelpers';
import { useAppEffect } from '../../helper/appHooks';
import { useScreenManagerContext } from '../managers/screenManagerHooks';
import { useScreenFocusManagerEvents } from '../managers/screenEventHelpers';
import { toShortcutTitle } from '../managers/screenDrawShortcutHelpers';
import {
    OverlayColorSwatchComp,
    OverlayRangeComp,
    handleKeepOverlayFocus,
    useOverlayShortcut,
} from './miniScreenOverlayControlComps';
import {
    FOCUS_BLUR_MAX,
    FOCUS_BLUR_MIN,
    FOCUS_DIM_MAX,
    FOCUS_DIM_MIN,
    FOCUS_SIZE_MAX,
    FOCUS_SIZE_MIN,
} from '../managers/ScreenFocusManager';

// Spotlight controls. Deliberately NOT the draw panel with pieces hidden: the
// spotlight has no strokes, no history and nothing to erase, so it shares no
// state with Drawing — only the generic slider/swatch widgets in
// `miniScreenOverlayControlComps`, which both panels draw from.
//
// The manager owns every value here (it read them off disk on construction and
// is the only writer), so these are plain useState seeded from it — the same
// single-writer arrangement the draw panel uses for its quality flag.

// Nudge amounts for the keys and the +/- buttons. Not the draw panel's 1/5:
// this size slider spans 40..1200px, where a step of 1 would be useless.
const SIZE_STEP_SMALL = 10;
const SIZE_STEP_BIG = 50;
const PERCENT_STEP_SMALL = 5;
const PERCENT_STEP_BIG = 20;

export default function MiniScreenFocusHandlersComp() {
    const { screenFocusManager } = useScreenManagerContext();
    // Re-render so the on/off hint tracks the spotlight.
    useScreenFocusManagerEvents(['update']);
    const [size, setSize] = useState(screenFocusManager.size);
    const [dimColor, setDimColor] = useState(screenFocusManager.dimColor);
    const [dimOpacity, setDimOpacity] = useState(screenFocusManager.dimOpacity);
    const [edgeBlur, setEdgeBlur] = useState(screenFocusManager.edgeBlur);
    const [isContrast, setIsContrast] = useState(screenFocusManager.isContrast);

    // Every control writes local state (so the slider tracks the thumb) and the
    // manager (which repaints, broadcasts and trails a debounced disk write).
    const checkIsShortcutTarget = () => {
        return screenFocusManager.isShortcutTarget;
    };
    const handleSizeChange = (value: number) => {
        setSize(value);
        screenFocusManager.setSize(value);
    };
    const handleDimColorChange = (value: string) => {
        setDimColor(value);
        screenFocusManager.setDimColor(value);
    };
    const handleDimChange = (value: number) => {
        setDimOpacity(value);
        screenFocusManager.setDimOpacity(value);
    };
    const handleBlurChange = (value: number) => {
        setEdgeBlur(value);
        screenFocusManager.setEdgeBlur(value);
    };
    const handleToggleContrast = () => {
        const next = !isContrast;
        setIsContrast(next);
        screenFocusManager.setIsContrast(next);
    };
    const handleResetSettings = () => {
        screenFocusManager.resetSettings();
        setSize(screenFocusManager.size);
        setDimColor(screenFocusManager.dimColor);
        setDimOpacity(screenFocusManager.dimOpacity);
        setEdgeBlur(screenFocusManager.edgeBlur);
        setIsContrast(screenFocusManager.isContrast);
    };
    useOverlayShortcut(
        'toggleContrast',
        handleToggleContrast,
        checkIsShortcutTarget,
    );
    useOverlayShortcut(
        'resetSettings',
        handleResetSettings,
        checkIsShortcutTarget,
    );

    // Arm the overlay while this panel is open so it takes pointer input, and
    // disarm on unmount — which also drops the mask, so closing the panel can
    // never leave a screen dimmed with no visible way to undim it.
    useAppEffect(() => {
        screenFocusManager.setIsArmed(true);
        return () => {
            screenFocusManager.setIsArmed(false);
        };
    }, [screenFocusManager]);

    const isSpotlighting = screenFocusManager.isSpotlighting;
    return (
        <div className="w-100">
            <hr className="w-100 my-1" />
            <div className="d-flex flex-wrap align-items-center gap-2 px-1 pb-1">
                <OverlayRangeComp
                    icon="bi-circle"
                    label={tran('Spotlight size')}
                    value={size}
                    setValue={handleSizeChange}
                    min={FOCUS_SIZE_MIN}
                    max={FOCUS_SIZE_MAX}
                    step={SIZE_STEP_SMALL}
                    stepBig={SIZE_STEP_BIG}
                    suffix="px"
                    shortcutBase="size"
                    checkIsShortcutTarget={checkIsShortcutTarget}
                />
                <OverlayColorSwatchComp
                    icon="bi-palette"
                    label={tran('Dim color')}
                    color={dimColor}
                    setColor={handleDimColorChange}
                    opacity={dimOpacity}
                />
                <OverlayRangeComp
                    icon="bi-circle-half"
                    label={tran('Dim the rest of the screen')}
                    value={dimOpacity}
                    setValue={handleDimChange}
                    min={FOCUS_DIM_MIN}
                    max={FOCUS_DIM_MAX}
                    step={PERCENT_STEP_SMALL}
                    stepBig={PERCENT_STEP_BIG}
                    suffix="%"
                    shortcutBase="opacity"
                    checkIsShortcutTarget={checkIsShortcutTarget}
                />
                <OverlayRangeComp
                    icon="bi-droplet"
                    label={tran('Spotlight edge blur (0 = hard edge)')}
                    value={edgeBlur}
                    setValue={handleBlurChange}
                    min={FOCUS_BLUR_MIN}
                    max={FOCUS_BLUR_MAX}
                    step={PERCENT_STEP_SMALL}
                    stepBig={PERCENT_STEP_BIG}
                    suffix="%"
                    shortcutBase="blur"
                    checkIsShortcutTarget={checkIsShortcutTarget}
                />
                <button
                    className={
                        'btn btn-sm btn-' +
                        (isContrast ? 'primary' : 'outline-secondary')
                    }
                    onMouseDown={handleKeepOverlayFocus}
                    onClick={handleToggleContrast}
                    title={toShortcutTitle(
                        isContrast
                            ? tran(
                                  'Contrast: the circle blocks what the pointer' +
                                      ' is over',
                              )
                            : tran(
                                  'Spotlight: the circle reveals what the' +
                                      ' pointer is over',
                              ),
                        'toggleContrast',
                    )}
                    aria-label={tran('Contrast')}
                    aria-pressed={isContrast}
                >
                    <i
                        className={`bi ${
                            isContrast ? 'bi-circle-fill' : 'bi-record-circle'
                        }`}
                    />
                    <span className="ms-1">{tran('Contrast')}</span>
                </button>
                <button
                    className="btn btn-sm btn-outline-secondary"
                    onMouseDown={handleKeepOverlayFocus}
                    onClick={handleResetSettings}
                    title={toShortcutTitle(
                        tran('Reset settings'),
                        'resetSettings',
                    )}
                    aria-label={tran('Reset settings')}
                >
                    <i className="bi bi-arrow-repeat" />
                </button>
                <div className="ms-auto d-flex align-items-center gap-2">
                    <i
                        className={
                            'bi bi-record-circle' +
                            (isSpotlighting ? ' text-primary' : ' text-muted')
                        }
                    />
                    <small className="text-muted">
                        {isSpotlighting
                            ? tran('Release to stop')
                            : tran('Press and hold on the screen to spotlight')}
                    </small>
                </div>
            </div>
        </div>
    );
}
