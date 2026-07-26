import { tran } from '../lang/langHelpers';
import { toShortcutTitle } from '../_screen/managers/screenDrawShortcutHelpers';
import {
    OverlayColorSwatchComp,
    OverlayRangeComp,
    handleKeepOverlayFocus,
    useOverlayShortcut,
} from '../_screen/preview/miniScreenOverlayControlComps';
import type PresentingFocusManager from './PresentingFocusManager';
import {
    FOCUS_BLUR_MAX,
    FOCUS_BLUR_MIN,
    FOCUS_DIM_MAX,
    FOCUS_DIM_MIN,
    FOCUS_PERCENT_STEP_BIG,
    FOCUS_PERCENT_STEP_SMALL,
    FOCUS_SIZE_MAX,
    FOCUS_SIZE_MIN,
    FOCUS_SIZE_STEP_BIG,
    FOCUS_SIZE_STEP_SMALL,
} from './presentingControlHelpers';
import {
    PRESENTING_CONTROL_LAYER,
    presentingShortcutMap,
    toPresentingShortcutTitle,
    usePresentingShortcut,
} from './presentingControlShortcutHelpers';
import { usePresentingManagerEvents } from './presentingControlHooks';

// Spotlight controls for the app-wide overlay. The engine is the ONLY store: it
// read the six settings off disk on construction, it clamps and validates every
// write, and it fires an update event for each one — which is what re-renders
// this panel. So there is no local mirror of any of them; a mirror could only
// ever drift from what is actually painted (a value the engine clamped, or a
// `resetSettings` done from the keyboard) and would have to be copied back by
// hand every time.
//
// This panel only ever mounts while the focus tool is armed, so the gate is
// simply "is this panel showing" — which mounting already answers. The keyboard
// layer has to be named EXPLICITLY though; see `ControllerDrawToolsComp` for why
// letting `useKeyboardRegistering` infer it pins these keys to `root` and kills
// them for exactly as long as the tool is armed.
function checkIsShortcutTarget() {
    return true;
}

export default function ControllerFocusToolsComp({
    focusManager,
}: Readonly<{
    focusManager: PresentingFocusManager;
}>) {
    // Re-render on any engine change: the six controls below read straight off
    // it, and the on/off hint tracks the spotlight.
    usePresentingManagerEvents(focusManager);
    const {
        size,
        dimColor,
        dimOpacity,
        edgeBlur,
        isContrast,
        isHoldMode,
        isSpotlighting,
    } = focusManager;

    const handleToggleContrast = () => {
        focusManager.setIsContrast(!focusManager.isContrast);
    };
    const handleToggleHoldMode = () => {
        focusManager.setIsHoldMode(!focusManager.isHoldMode);
    };
    const handleResetSettings = () => {
        focusManager.resetSettings();
    };
    useOverlayShortcut(
        'toggleContrast',
        handleToggleContrast,
        checkIsShortcutTarget,
        false,
        PRESENTING_CONTROL_LAYER,
    );
    useOverlayShortcut(
        'resetSettings',
        handleResetSettings,
        checkIsShortcutTarget,
        false,
        PRESENTING_CONTROL_LAYER,
    );
    usePresentingShortcut(
        presentingShortcutMap.toggleHold,
        handleToggleHoldMode,
    );

    // NOTE: this panel deliberately does not arm/disarm the overlay. It is
    // unmounted whenever the widget is collapsed, and a collapsed widget must
    // keep spotlighting; ControllerComp arms off the selected tool instead, and
    // leaving the tool is what drops the mask.

    return (
        <div className="w-100">
            <hr className="w-100 my-1" />
            <div className="d-flex flex-wrap align-items-center gap-2 px-1 pb-1">
                <OverlayRangeComp
                    icon="bi-circle"
                    label={tran('Spotlight size')}
                    value={size}
                    setValue={(value) => {
                        focusManager.setSize(value);
                    }}
                    min={FOCUS_SIZE_MIN}
                    max={FOCUS_SIZE_MAX}
                    step={FOCUS_SIZE_STEP_SMALL}
                    stepBig={FOCUS_SIZE_STEP_BIG}
                    suffix="px"
                    shortcutBase="size"
                    checkIsShortcutTarget={checkIsShortcutTarget}
                    layer={PRESENTING_CONTROL_LAYER}
                />
                <OverlayColorSwatchComp
                    icon="bi-palette"
                    label={tran('Dim color')}
                    color={dimColor}
                    setColor={(value) => {
                        focusManager.setDimColor(value);
                    }}
                    opacity={dimOpacity}
                />
                <OverlayRangeComp
                    icon="bi-circle-half"
                    label={tran('Dim the rest of the app')}
                    value={dimOpacity}
                    setValue={(value) => {
                        focusManager.setDimOpacity(value);
                    }}
                    min={FOCUS_DIM_MIN}
                    max={FOCUS_DIM_MAX}
                    step={FOCUS_PERCENT_STEP_SMALL}
                    stepBig={FOCUS_PERCENT_STEP_BIG}
                    suffix="%"
                    shortcutBase="opacity"
                    checkIsShortcutTarget={checkIsShortcutTarget}
                    layer={PRESENTING_CONTROL_LAYER}
                />
                <OverlayRangeComp
                    icon="bi-droplet"
                    label={tran('Spotlight edge blur (0 = hard edge)')}
                    value={edgeBlur}
                    setValue={(value) => {
                        focusManager.setEdgeBlur(value);
                    }}
                    min={FOCUS_BLUR_MIN}
                    max={FOCUS_BLUR_MAX}
                    step={FOCUS_PERCENT_STEP_SMALL}
                    stepBig={FOCUS_PERCENT_STEP_BIG}
                    suffix="%"
                    shortcutBase="blur"
                    checkIsShortcutTarget={checkIsShortcutTarget}
                    layer={PRESENTING_CONTROL_LAYER}
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
                    className={
                        'btn btn-sm btn-' +
                        (isHoldMode ? 'primary' : 'outline-secondary')
                    }
                    onMouseDown={handleKeepOverlayFocus}
                    onClick={handleToggleHoldMode}
                    title={toPresentingShortcutTitle(
                        isHoldMode
                            ? tran('Hold: dim only while the button is down')
                            : tran('Follow: the spotlight tracks the pointer'),
                        'toggleHold',
                    )}
                    aria-label={tran('Hold to spotlight')}
                    aria-pressed={isHoldMode}
                >
                    <i
                        className={`bi ${
                            isHoldMode ? 'bi-hand-index' : 'bi-cursor-fill'
                        }`}
                    />
                    <span className="ms-1">
                        {isHoldMode ? tran('Hold') : tran('Follow')}
                    </span>
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
                        {isHoldMode
                            ? tran('Press and hold on the app to spotlight')
                            : tran('Move over the app to spotlight')}
                    </small>
                </div>
            </div>
        </div>
    );
}
