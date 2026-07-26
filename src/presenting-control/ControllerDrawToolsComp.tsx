import { useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppEffect } from '../helper/appHooks';
import {
    useStateSettingBoolean,
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import { toAlphaHex } from '../_screen/managers/screenOverlayHelpers';
import {
    toShortcutTitle,
    type DrawShortcutIdType,
} from '../_screen/managers/screenDrawShortcutHelpers';
import {
    OverlayColorSwatchComp,
    OverlayRangeComp,
    handleKeepOverlayFocus,
    useOverlayShortcut,
} from '../_screen/preview/miniScreenOverlayControlComps';
import type PresentingDrawManager from './PresentingDrawManager';
import {
    DEFAULT_IS_3D,
    DEFAULT_IS_DOTS,
    DEFAULT_IS_HIGH_QUALITY,
    DEFAULT_IS_STRAIGHT,
    DEFAULT_PAINT_ALPHA,
    DEFAULT_PAINT_COLOR,
    DEFAULT_PAINT_SIZE,
    PAINT_3D_SETTING_NAME,
    PAINT_ALPHA_MAX,
    PAINT_ALPHA_MIN,
    PAINT_ALPHA_SETTING_NAME,
    PAINT_COLOR_SETTING_NAME,
    PAINT_DOTS_SETTING_NAME,
    PAINT_SIZE_MAX,
    PAINT_SIZE_MIN,
    PAINT_SIZE_SETTING_NAME,
    PAINT_STEP_BIG,
    PAINT_STEP_SMALL,
    PAINT_STRAIGHT_SETTING_NAME,
    toPresentingSettingKey,
} from './presentingControlHelpers';
import { PRESENTING_CONTROL_LAYER } from './presentingControlShortcutHelpers';

// Brush controls for the app-wide overlay. The widgets are the previewer draw
// panel's (`OverlayRangeComp` / `OverlayColorSwatchComp`) and the shortcut ids
// are the same, so a user who knows one knows the other — but the settings live
// under their own `presenting-control-` keys, because a brush picked for
// annotating the app is not the brush picked for a projector.
//
// Paint-vs-eraser is NOT a control here: it is one of the toolbar's four tools,
// so the toolbar owns that state (and the `b`/`e` keys) and this panel is told
// which one is live.

// This panel only ever mounts while a drawing tool is armed, so the gate is
// simply "is this panel showing" — which mounting already answers.
function checkIsShortcutTarget() {
    return true;
}

// The layer is passed EXPLICITLY and must stay that way. Arming is what opens
// the presenting-control layer, and it opens it from ControllerComp's EFFECT —
// which runs after this panel has already rendered, because child effects run
// before parent ones and the panel's chunk is prewarmed the moment the
// controller opens. `useKeyboardRegistering` resolves an implicit layer in a
// render-phase memo, so leaving it out pinned these keys to `root` and every
// one of them (size, opacity, straight/3D/dots, quality, reset) was dead for as
// long as the tool stayed armed — i.e. always.
function useDrawShortcut(shortcutId: DrawShortcutIdType, handle: () => void) {
    useOverlayShortcut(
        shortcutId,
        handle,
        checkIsShortcutTarget,
        false,
        PRESENTING_CONTROL_LAYER,
    );
}

function DrawToggleComp({
    isActive,
    onToggle,
    label,
    shortcutId,
}: Readonly<{
    isActive: boolean;
    onToggle: () => void;
    label: string;
    shortcutId: DrawShortcutIdType;
}>) {
    useDrawShortcut(shortcutId, onToggle);
    return (
        <button
            className={
                'btn btn-sm btn-' + (isActive ? 'primary' : 'outline-secondary')
            }
            onMouseDown={handleKeepOverlayFocus}
            onClick={onToggle}
            title={toShortcutTitle(label, shortcutId)}
            aria-pressed={isActive}
        >
            {label}
        </button>
    );
}

export default function ControllerDrawToolsComp({
    drawManager,
    isEraser,
}: Readonly<{
    drawManager: PresentingDrawManager;
    isEraser: boolean;
}>) {
    const [baseColor, setBaseColor] = useStateSettingString(
        toPresentingSettingKey(PAINT_COLOR_SETTING_NAME),
        DEFAULT_PAINT_COLOR,
    );
    const [alpha, setAlpha] = useStateSettingNumber(
        toPresentingSettingKey(PAINT_ALPHA_SETTING_NAME),
        DEFAULT_PAINT_ALPHA,
    );
    // Effective brush color (with transparency) fed to the canvas.
    const color = `${baseColor}${toAlphaHex(alpha)}`;
    const [size, setSize] = useStateSettingNumber(
        toPresentingSettingKey(PAINT_SIZE_SETTING_NAME),
        DEFAULT_PAINT_SIZE,
    );
    const [isStraight, setIsStraight] = useStateSettingBoolean(
        toPresentingSettingKey(PAINT_STRAIGHT_SETTING_NAME),
        DEFAULT_IS_STRAIGHT,
    );
    const [is3D, setIs3D] = useStateSettingBoolean(
        toPresentingSettingKey(PAINT_3D_SETTING_NAME),
        DEFAULT_IS_3D,
    );
    const [isDots, setIsDots] = useStateSettingBoolean(
        toPresentingSettingKey(PAINT_DOTS_SETTING_NAME),
        DEFAULT_IS_DOTS,
    );
    // The engine is the only reader AND writer of the quality flag (it is about
    // the backing store, not about how a stroke looks), so the button is seeded
    // from it and pushes back into it — the persistence lives there.
    const [isHighQuality, setIsHighQuality] = useState(
        drawManager.isHighQuality,
    );

    const handleToggleQuality = () => {
        const next = !isHighQuality;
        setIsHighQuality(next);
        drawManager.setRenderQuality(next);
    };

    const handleResetSettings = () => {
        setBaseColor(DEFAULT_PAINT_COLOR);
        setAlpha(DEFAULT_PAINT_ALPHA);
        setSize(DEFAULT_PAINT_SIZE);
        setIsStraight(DEFAULT_IS_STRAIGHT);
        setIs3D(DEFAULT_IS_3D);
        setIsDots(DEFAULT_IS_DOTS);
        setIsHighQuality(DEFAULT_IS_HIGH_QUALITY);
        drawManager.setRenderQuality(DEFAULT_IS_HIGH_QUALITY);
    };

    useDrawShortcut('toggleQuality', handleToggleQuality);
    useDrawShortcut('resetSettings', handleResetSettings);
    // NOTE: `b` / `e` (paint vs eraser) and `c` / `Ctrl+Z` / `Ctrl+Shift+Z`
    // (clear / undo / redo) are deliberately not bound here — they belong to
    // header buttons that are live for the whole session, and this panel is
    // unmounted by every tool but the brush and by collapsing the widget, so
    // binding them here made them work only sometimes. Binding them twice on
    // the same layer would fire both handlers.

    // Push brush edits onto the engine, which owns the live brush. This panel
    // deliberately does NOT arm or disarm anything: it is unmounted whenever the
    // widget is collapsed, and a collapsed widget must keep drawing. Arming is
    // ControllerComp's job, off the selected tool.
    useAppEffect(() => {
        drawManager.setPaintParams({ color, size, isStraight, is3D, isDots });
    }, [color, size, isStraight, is3D, isDots, drawManager]);

    return (
        <div className="w-100">
            <hr className="w-100 my-1" />
            <div className="d-flex flex-wrap align-items-center gap-2 px-1 pb-1">
                <OverlayColorSwatchComp
                    icon="bi-brush"
                    label={tran('Color')}
                    color={baseColor}
                    setColor={setBaseColor}
                    opacity={alpha}
                />
                <OverlayRangeComp
                    icon="bi-border-width"
                    label={tran('Size')}
                    value={size}
                    setValue={setSize}
                    min={PAINT_SIZE_MIN}
                    max={PAINT_SIZE_MAX}
                    step={PAINT_STEP_SMALL}
                    stepBig={PAINT_STEP_BIG}
                    suffix="px"
                    shortcutBase="size"
                    checkIsShortcutTarget={checkIsShortcutTarget}
                    layer={PRESENTING_CONTROL_LAYER}
                />
                <OverlayRangeComp
                    icon="bi-droplet-half"
                    label={tran('Opacity')}
                    value={alpha}
                    setValue={setAlpha}
                    min={PAINT_ALPHA_MIN}
                    max={PAINT_ALPHA_MAX}
                    step={PAINT_STEP_SMALL}
                    stepBig={PAINT_STEP_BIG}
                    suffix="%"
                    shortcutBase="opacity"
                    checkIsShortcutTarget={checkIsShortcutTarget}
                    layer={PRESENTING_CONTROL_LAYER}
                />
                <div
                    className="btn-group btn-group-sm"
                    role="group"
                    aria-label={tran('Stroke style')}
                >
                    <DrawToggleComp
                        isActive={isStraight}
                        onToggle={() => {
                            setIsStraight(!isStraight);
                        }}
                        label={tran('Straight')}
                        shortcutId="toggleStraight"
                    />
                    <DrawToggleComp
                        isActive={is3D}
                        onToggle={() => {
                            setIs3D(!is3D);
                        }}
                        label={tran('3D')}
                        shortcutId="toggle3D"
                    />
                    <DrawToggleComp
                        isActive={isDots}
                        onToggle={() => {
                            setIsDots(!isDots);
                        }}
                        label={tran('Dots')}
                        shortcutId="toggleDots"
                    />
                </div>
                <button
                    className={
                        'btn btn-sm btn-' +
                        (isHighQuality ? 'primary' : 'outline-secondary')
                    }
                    onMouseDown={handleKeepOverlayFocus}
                    onClick={handleToggleQuality}
                    title={toShortcutTitle(
                        isHighQuality
                            ? tran(
                                  'High quality drawing (anti-aliased, slower)',
                              )
                            : tran('Fast drawing (lighter, less smooth)'),
                        'toggleQuality',
                    )}
                    aria-label={tran('Toggle drawing quality')}
                >
                    <i
                        className={`bi ${
                            isHighQuality ? 'bi-stars' : 'bi-lightning-charge'
                        }`}
                    />
                    <span className="ms-1">
                        {isHighQuality ? tran('HQ') : tran('Fast')}
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
                <small className="ms-auto text-muted">
                    {isEraser
                        ? tran('Drag over the drawing to rub it out')
                        : tran('Drag anywhere on the app to draw')}
                </small>
            </div>
        </div>
    );
}
