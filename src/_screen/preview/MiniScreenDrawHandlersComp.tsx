import { tran } from '../../lang/langHelpers';
import { useAppEffect } from '../../helper/appHooks';
import {
    useStateSettingString,
    useStateSettingNumber,
    useStateSettingBoolean,
} from '../../helper/settingHelpers';
import { useScreenManagerContext } from '../managers/screenManagerHooks';
import { useScreenDrawManagerEvents } from '../managers/screenEventHelpers';

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

// 0..100 opacity -> 2-digit hex alpha, appended to #rrggbb to make #rrggbbaa
// (canvas + CSS both render the 8-digit form with transparency).
function alphaToHex(alpha: number) {
    const clamped = Math.max(0, Math.min(100, alpha));
    return Math.round((clamped / 100) * 255)
        .toString(16)
        .padStart(2, '0');
}

function DrawToggleComp({
    isActive,
    onToggle,
    label,
}: Readonly<{
    isActive: boolean;
    onToggle: () => void;
    label: string;
}>) {
    return (
        <button
            className={
                'btn btn-sm btn-' + (isActive ? 'primary' : 'outline-secondary')
            }
            onClick={onToggle}
            title={label}
        >
            {label}
        </button>
    );
}

function DrawRangeComp({
    icon,
    label,
    value,
    setValue,
    min,
    max,
    suffix = '',
}: Readonly<{
    icon: string;
    label: string;
    value: number;
    setValue: (value: number) => void;
    min: number;
    max: number;
    suffix?: string;
}>) {
    return (
        <div
            className="d-flex align-items-center gap-2"
            title={label}
            style={{ minWidth: '150px', flex: '1 1 150px', maxWidth: '230px' }}
        >
            <i className={`bi ${icon}`} title={label} />
            <input
                type="range"
                className="form-range flex-fill"
                min={min}
                max={max}
                step={1}
                value={value}
                aria-label={label}
                onChange={(event) => {
                    setValue(Number.parseInt(event.target.value, 10));
                }}
            />
            <small
                className="text-muted"
                style={{
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: '36px',
                    textAlign: 'right',
                }}
            >
                {value}
                {suffix}
            </small>
        </div>
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
    const color = `${baseColor}${alphaToHex(alpha)}`;
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
    // Render fidelity. Key MUST match ScreenDrawManager's DRAW_QUALITY_PREFIX so
    // the manager (and the output window's) reads the same value on load.
    const [isHighQuality, setIsHighQuality] = useStateSettingBoolean(
        `draw-paint-quality-${screenId}`,
        DEFAULT_HIGH_QUALITY,
    );

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
        setIsHighQuality(DEFAULT_HIGH_QUALITY);
        screenDrawManager.setRenderQuality(DEFAULT_HIGH_QUALITY);
    };

    // Activating this panel arms the Paint tool on the shared draw manager (the
    // same instance the mini-screen overlay uses); unmounting disarms it so the
    // preview stops capturing pointer input.
    useAppEffect(() => {
        screenDrawManager.setPaintTool({
            color,
            size,
            isStraight,
            is3D,
            isDots,
        });
        return () => {
            screenDrawManager.setPaintTool(null);
        };
    }, [screenDrawManager, color, size, isStraight, is3D, isDots]);

    return (
        <div className="w-100">
            <hr className="w-100 my-1" />
            <div className="d-flex flex-wrap align-items-center gap-2 px-1 pb-1">
                <label
                    className="d-flex align-items-center gap-1 m-0"
                    title={tran('Color')}
                >
                    <i className="bi bi-brush" />
                    <span
                        style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: '34px',
                            height: '24px',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            // Checkerboard behind the swatch shows transparency.
                            background:
                                'conic-gradient(#bbb 25%, #fff 0 50%,' +
                                ' #bbb 0 75%, #fff 0) 0 0 / 10px 10px',
                        }}
                    >
                        <input
                            type="color"
                            value={baseColor}
                            onChange={(event) => {
                                setBaseColor(event.target.value);
                            }}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                padding: 0,
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                // Let the checkerboard show through the alpha.
                                opacity: alpha / 100,
                                mixBlendMode: 'normal',
                            }}
                        />
                    </span>
                </label>
                <DrawRangeComp
                    icon="bi-border-width"
                    label={tran('Size')}
                    value={size}
                    setValue={setSize}
                    min={SIZE_MIN}
                    max={SIZE_MAX}
                    suffix="px"
                />
                <DrawRangeComp
                    icon="bi-droplet-half"
                    label={tran('Opacity')}
                    value={alpha}
                    setValue={setAlpha}
                    min={ALPHA_MIN}
                    max={ALPHA_MAX}
                    suffix="%"
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
                    />
                    <DrawToggleComp
                        isActive={is3D}
                        onToggle={() => {
                            setIs3D(!is3D);
                        }}
                        label={tran('3D')}
                    />
                    <DrawToggleComp
                        isActive={isDots}
                        onToggle={() => {
                            setIsDots(!isDots);
                        }}
                        label={tran('Dots')}
                    />
                </div>
                <button
                    className={
                        'btn btn-sm btn-' +
                        (isHighQuality ? 'primary' : 'outline-secondary')
                    }
                    onClick={handleToggleQuality}
                    title={
                        isHighQuality
                            ? tran(
                                  'High quality drawing (anti-aliased, slower)',
                              )
                            : tran('Fast drawing (lighter, less smooth)')
                    }
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
                    onClick={handleResetSettings}
                    title={tran('Reset settings')}
                    aria-label={tran('Reset settings')}
                >
                    <i className="bi bi-arrow-repeat" />
                </button>
                <div className="ms-auto d-flex align-items-center gap-1">
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={!screenDrawManager.canUndo}
                        onClick={() => {
                            screenDrawManager.undo();
                        }}
                        title={tran('Undo')}
                        aria-label={tran('Undo')}
                    >
                        <i className="bi bi-arrow-counterclockwise" />
                    </button>
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={!screenDrawManager.canRedo}
                        onClick={() => {
                            screenDrawManager.redo();
                        }}
                        title={tran('Redo')}
                        aria-label={tran('Redo')}
                    >
                        <i className="bi bi-arrow-clockwise" />
                    </button>
                    <button
                        className="btn btn-sm btn-danger"
                        disabled={!screenDrawManager.isShowing}
                        onClick={() => {
                            screenDrawManager.clear();
                        }}
                        title={tran('Clear drawing')}
                        aria-label={tran('Clear drawing')}
                    >
                        <i className="bi bi-eraser-fill" />
                    </button>
                </div>
            </div>
        </div>
    );
}
