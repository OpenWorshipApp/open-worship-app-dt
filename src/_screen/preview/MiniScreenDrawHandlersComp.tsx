import { useState } from 'react';

import { tran } from '../../lang/langHelpers';
import { useAppEffect } from '../../helper/appHooks';
import {
    useStateSettingString,
    useStateSettingNumber,
    useStateSettingBoolean,
} from '../../helper/settingHelpers';
import { useScreenManagerContext } from '../managers/screenManagerHooks';
import { useScreenDrawManagerEvents } from '../managers/screenEventHelpers';
import {
    toShortcutTitle,
    STEP_BIG,
    STEP_SMALL,
    type DrawShortcutIdType,
} from '../managers/screenDrawShortcutHelpers';
import { toAlphaHex } from '../managers/screenOverlayHelpers';
import {
    OverlayColorSwatchComp,
    OverlayRangeComp,
    handleKeepOverlayFocus,
    useOverlayShortcut,
} from './miniScreenOverlayControlComps';

const DEFAULT_COLOR = '#ff2d2d';
const DEFAULT_SIZE = 10;
const DEFAULT_ALPHA = 100;
const DEFAULT_STRAIGHT = false;
const DEFAULT_IS_3D = false;
const DEFAULT_DOTS = false;
const DEFAULT_HIGH_QUALITY = true;

const SIZE_MIN = 1;
const SIZE_MAX = 60;
const ALPHA_MIN = 5;
const ALPHA_MAX = 100;

// Bind one palette action, scoped to the mini-screen whose draw canvas holds
// the keyboard (pointer-down focuses it; the cyan ring shows which one). So `E`
// arms the eraser on the screen you are drawing on, and with NO draw canvas
// focused the key is left alone entirely. See `useOverlayShortcut` for why it
// never calls preventDefault and why auto-repeat is opt-in.
function useDrawShortcut(
    shortcutId: DrawShortcutIdType,
    handle: () => void,
    isRepeatable = false,
) {
    const { screenDrawManager } = useScreenManagerContext();
    useOverlayShortcut(
        shortcutId,
        handle,
        () => {
            return screenDrawManager.isFocused;
        },
        isRepeatable,
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

export default function MiniScreenDrawHandlersComp() {
    const screenManager = useScreenManagerContext();
    const { screenDrawManager, screenId } = screenManager;
    // Re-render so the Clear button reflects whether anything is drawn.
    useScreenDrawManagerEvents(['update']);
    // Settings are persisted per screen id so each screen keeps its own brush.
    const [baseColor, setBaseColor] = useStateSettingString(
        `draw-paint-color-${screenId}`,
        DEFAULT_COLOR,
    );
    const [alpha, setAlpha] = useStateSettingNumber(
        `draw-paint-alpha-${screenId}`,
        DEFAULT_ALPHA,
    );
    // Effective brush color (with transparency) fed to the canvas.
    const color = `${baseColor}${toAlphaHex(alpha)}`;
    const [size, setSize] = useStateSettingNumber(
        `draw-paint-size-${screenId}`,
        DEFAULT_SIZE,
    );
    const [isStraight, setIsStraight] = useStateSettingBoolean(
        `draw-paint-straight-${screenId}`,
        DEFAULT_STRAIGHT,
    );
    const [is3D, setIs3D] = useStateSettingBoolean(
        `draw-paint-3d-${screenId}`,
        DEFAULT_IS_3D,
    );
    const [isDots, setIsDots] = useStateSettingBoolean(
        `draw-paint-dots-${screenId}`,
        DEFAULT_DOTS,
    );
    // Render fidelity. The manager owns persistence of this one — its
    // loadPersisted already read the shared `draw-paint-quality-<screenId>` key
    // on construction — so seed the button state from it and let
    // setRenderQuality be the sole writer, rather than persisting the same key
    // from here too (which was a redundant second synchronous disk write).
    const [isHighQuality, setIsHighQuality] = useState(
        screenDrawManager.isHighQuality,
    );
    // Manual-eraser mode. Kept as transient local state (NOT persisted) so a
    // reload always reopens in paint mode rather than silently erasing.
    const [isEraser, setIsEraser] = useState(false);
    // Read at key time by the shared slider controls: whether THIS screen's
    // draw canvas owns the keyboard right now.
    const checkIsShortcutTarget = () => {
        return screenDrawManager.isFocused;
    };

    const handleToggleQuality = () => {
        const next = !isHighQuality;
        setIsHighQuality(next);
        // Re-renders locally at the new resolution and syncs the output window +
        // group members. Not run from an effect (that would re-broadcast on every
        // panel mount).
        screenDrawManager.setRenderQuality(next);
    };

    const handleResetSettings = () => {
        setBaseColor(DEFAULT_COLOR);
        setAlpha(DEFAULT_ALPHA);
        setSize(DEFAULT_SIZE);
        setIsStraight(DEFAULT_STRAIGHT);
        setIs3D(DEFAULT_IS_3D);
        setIsDots(DEFAULT_DOTS);
        setIsEraser(false);
        setIsHighQuality(DEFAULT_HIGH_QUALITY);
        screenDrawManager.setRenderQuality(DEFAULT_HIGH_QUALITY);
    };

    // Quick-select palette keys. Straight/3D/Dots and the two sliders bind
    // theirs inside their own sub-components, next to the control they drive.
    useDrawShortcut('toggleEraser', () => {
        setIsEraser(!isEraser);
    });
    useDrawShortcut('usePaint', () => {
        setIsEraser(false);
    });
    useDrawShortcut('toggleQuality', handleToggleQuality);
    useDrawShortcut('resetSettings', handleResetSettings);
    useDrawShortcut('clearDrawing', () => {
        if (!screenDrawManager.isShowing) {
            return;
        }
        // Undoable (clear pushes a history snapshot), so a mis-hit mid-service
        // is recoverable with Ctrl+Z.
        screenDrawManager.clear();
    });
    // NOTE: undo/redo are deliberately NOT bound here. `drawShortcutMap` still
    // declares them so the buttons can show the keys, but the binding would be
    // unreachable: the canvas keydown handler consumes Ctrl+Z / Ctrl+Y and calls
    // undo()/redo() itself, stopPropagation-ing before `document.onkeydown` ever
    // runs — and this hook only acts while that same canvas holds focus.

    // Arm the Paint tool on mount (the same shared manager instance the
    // mini-screen overlay uses), disarm on unmount so the preview stops
    // capturing pointer input. Kept separate from the param-sync effect below so
    // a slider tick does NOT disarm/re-arm the tool — re-arming flips #draw's
    // pointerEvents and broadcasts an update to every open draw panel each tick.
    useAppEffect(() => {
        screenDrawManager.setPaintTool({
            color,
            size,
            isStraight,
            is3D,
            isDots,
            isEraser,
        });
        return () => {
            screenDrawManager.setPaintTool(null);
        };
    }, [screenDrawManager]);
    // Push brush-param changes onto the already-armed tool in place.
    useAppEffect(() => {
        screenDrawManager.updatePaintToolParams({
            color,
            size,
            isStraight,
            is3D,
            isDots,
            isEraser,
        });
    }, [color, size, isStraight, is3D, isDots, isEraser]);

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
                    min={SIZE_MIN}
                    max={SIZE_MAX}
                    step={STEP_SMALL}
                    stepBig={STEP_BIG}
                    suffix="px"
                    shortcutBase="size"
                    checkIsShortcutTarget={checkIsShortcutTarget}
                />
                <OverlayRangeComp
                    icon="bi-droplet-half"
                    label={tran('Opacity')}
                    value={alpha}
                    setValue={setAlpha}
                    min={ALPHA_MIN}
                    max={ALPHA_MAX}
                    step={STEP_SMALL}
                    stepBig={STEP_BIG}
                    suffix="%"
                    shortcutBase="opacity"
                    checkIsShortcutTarget={checkIsShortcutTarget}
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
                <div className="ms-auto d-flex align-items-center gap-1">
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={!screenDrawManager.canUndo}
                        onMouseDown={handleKeepOverlayFocus}
                        onClick={() => {
                            screenDrawManager.undo();
                        }}
                        title={toShortcutTitle(tran('Undo'), 'undo')}
                        aria-label={tran('Undo')}
                    >
                        <i className="bi bi-arrow-counterclockwise" />
                    </button>
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={!screenDrawManager.canRedo}
                        onMouseDown={handleKeepOverlayFocus}
                        onClick={() => {
                            screenDrawManager.redo();
                        }}
                        title={toShortcutTitle(tran('Redo'), 'redo')}
                        aria-label={tran('Redo')}
                    >
                        <i className="bi bi-arrow-clockwise" />
                    </button>
                    <button
                        className={
                            'btn btn-sm btn-' +
                            (isEraser ? 'warning' : 'outline-warning')
                        }
                        onMouseDown={handleKeepOverlayFocus}
                        onClick={() => {
                            setIsEraser(!isEraser);
                        }}
                        title={toShortcutTitle(
                            tran(
                                'Manual eraser: drag over the drawing to rub' +
                                    ' out parts of it, or back to painting',
                            ),
                            'toggleEraser',
                            'usePaint',
                        )}
                        aria-label={tran('Manual eraser')}
                        aria-pressed={isEraser}
                    >
                        <i className="bi bi-eraser" />
                    </button>
                    <button
                        className="btn btn-sm btn-outline-danger"
                        disabled={!screenDrawManager.isShowing}
                        onMouseDown={handleKeepOverlayFocus}
                        onClick={() => {
                            screenDrawManager.clear();
                        }}
                        title={toShortcutTitle(
                            tran('Clear drawing'),
                            'clearDrawing',
                        )}
                        aria-label={tran('Clear drawing')}
                    >
                        <i className="bi bi-eraser-fill" />
                    </button>
                </div>
            </div>
        </div>
    );
}
