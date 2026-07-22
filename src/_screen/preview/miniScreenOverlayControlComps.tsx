import { useKeyboardRegistering } from '../../event/KeyboardEventListener';
import { useAppCurrentRef } from '../../helper/appHooks';
import {
    drawShortcutMap,
    toShortcutTitle,
    type DrawShortcutIdType,
    type DrawStepShortcutBaseType,
} from '../managers/screenDrawShortcutHelpers';

// Controls shared by the previewer footer's two overlay panels — Drawing
// (MiniScreenDrawHandlersComp) and Focusing (MiniScreenFocusHandlersComp).
// The panels themselves have nothing in common (one paints strokes, the other
// masks the screen) and are deliberately kept separate, but a slider is a
// slider: both need the same +/- stepper, the same four step shortcuts, the
// same checkerboard colour swatch and — critically — the same
// don't-steal-the-overlay's-focus rule.

// Keep the overlay focused when a panel control is clicked. Every shortcut here
// gates on the overlay owning the keyboard, so a button that took focus on
// mousedown would silently kill the lot (and, in the draw panel, turn the
// user's next drag into a no-op re-select). preventDefault on mousedown
// suppresses only the focus transfer; the click still fires, and Tab focus
// still works for keyboard users. The range and colour inputs are deliberately
// left alone — they need the default mousedown to drag the thumb / open the OS
// picker.
export function handleKeepOverlayFocus(event: { preventDefault: () => void }) {
    event.preventDefault();
}

// Bind one panel key, scoped to the mini-screen whose overlay holds the
// keyboard (pressing a preview focuses it; the cyan ring shows which one). With
// no overlay focused the key is left alone entirely — these are plain letters
// and punctuation that `document.onkeydown` would otherwise fire from anywhere
// in the app, including while typing in a text field.
//
// Deliberately does NOT preventDefault: `EventHandler.checkOnEvent` breaks its
// listener loop on `defaultPrevented`, which would drop the other previewers'
// listeners on the floor before they got to check their own focus.
//
// Auto-repeat is dropped unless `isRepeatable`. Only the +/- steps read
// sensibly when held; for everything else a held key is destructive or absurd
// — `C` would push ~30 empty snapshots a second and flush the 50-deep undo
// history it claims to preserve, `Q` would reallocate the (up to 33MB) backing
// store and broadcast a full-history sync per repeat, and toggles would flap.
export function useOverlayShortcut(
    shortcutId: DrawShortcutIdType,
    handle: () => void,
    checkIsShortcutTarget: () => boolean,
    isRepeatable = false,
) {
    const checkIsShortcutTargetRef = useAppCurrentRef(checkIsShortcutTarget);
    useKeyboardRegistering(
        drawShortcutMap[shortcutId],
        (event: any) => {
            if (!isRepeatable && event?.repeat === true) {
                return;
            }
            if (!checkIsShortcutTargetRef.current()) {
                return;
            }
            handle();
        },
        [],
    );
}

// Compact +/- stepper flanking a range input, so the value can be nudged by
// exactly one step without fighting the slider thumb on a small preview.
function OverlayStepButtonComp({
    icon,
    label,
    isDisabled,
    onClick,
}: Readonly<{
    icon: string;
    label: string;
    isDisabled: boolean;
    onClick: () => void;
}>) {
    return (
        <button
            className="btn btn-sm btn-outline-secondary p-0 lh-1"
            style={{ width: '20px', height: '20px', flex: '0 0 auto' }}
            disabled={isDisabled}
            onMouseDown={handleKeepOverlayFocus}
            onClick={onClick}
            title={label}
            aria-label={label}
        >
            <i className={`bi ${icon}`} />
        </button>
    );
}

export function OverlayRangeComp({
    icon,
    label,
    value,
    setValue,
    min,
    max,
    step,
    stepBig,
    suffix = '',
    shortcutBase,
    checkIsShortcutTarget,
}: Readonly<{
    icon: string;
    label: string;
    value: number;
    setValue: (value: number) => void;
    min: number;
    max: number;
    step: number;
    stepBig: number;
    suffix?: string;
    // The four step bindings are named by convention off this one base, so a
    // slider names its keys once instead of restating them prop by prop.
    shortcutBase: DrawStepShortcutBaseType;
    // Read at key time (never at bind time): whether THIS panel's overlay owns
    // the keyboard right now.
    checkIsShortcutTarget: () => boolean;
}>) {
    const downShortcutId = `${shortcutBase}Down` as const;
    const upShortcutId = `${shortcutBase}Up` as const;
    const genStepHandler = (delta: number) => {
        return () => {
            setValue(Math.max(min, Math.min(max, value + delta)));
        };
    };
    // Held +/- keys are the one case where auto-repeat is what the user wants,
    // so these four opt in.
    const check = checkIsShortcutTarget;
    useOverlayShortcut(downShortcutId, genStepHandler(-step), check, true);
    useOverlayShortcut(upShortcutId, genStepHandler(step), check, true);
    useOverlayShortcut(
        `${shortcutBase}DownBig`,
        genStepHandler(-stepBig),
        check,
        true,
    );
    useOverlayShortcut(
        `${shortcutBase}UpBig`,
        genStepHandler(stepBig),
        check,
        true,
    );
    return (
        <div
            className="d-flex align-items-center gap-1"
            title={label}
            style={{ minWidth: '190px', flex: '1 1 190px', maxWidth: '300px' }}
        >
            <i className={`bi ${icon}`} title={label} />
            <OverlayStepButtonComp
                icon="bi-dash"
                label={toShortcutTitle(
                    `${label} -${step} / -${stepBig}`,
                    downShortcutId,
                    `${shortcutBase}DownBig`,
                )}
                isDisabled={value <= min}
                onClick={genStepHandler(-step)}
            />
            <input
                type="range"
                className="form-range flex-fill"
                min={min}
                max={max}
                step={step}
                value={value}
                aria-label={label}
                onChange={(event) => {
                    setValue(Number.parseInt(event.target.value, 10));
                }}
            />
            <OverlayStepButtonComp
                icon="bi-plus"
                label={toShortcutTitle(
                    `${label} +${step} / +${stepBig}`,
                    upShortcutId,
                    `${shortcutBase}UpBig`,
                )}
                isDisabled={value >= max}
                onClick={genStepHandler(step)}
            />
            <small
                className="text-muted"
                style={{
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: '46px',
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                }}
            >
                {value}
                {suffix}
            </small>
        </div>
    );
}

// `<input type="color">` over a checkerboard, dimmed to the chosen opacity so
// the swatch previews how much of the screen the colour will actually cover.
//
// No `handleKeepOverlayFocus` here, in either panel: preventDefault on a colour
// input's mousedown stops the OS picker from opening. Clicking it therefore
// costs the overlay's keyboard claim — press the preview again to get the
// shortcuts back.
export function OverlayColorSwatchComp({
    icon,
    label,
    color,
    setColor,
    opacity,
}: Readonly<{
    icon: string;
    label: string;
    color: string;
    setColor: (color: string) => void;
    // 0..100, mirroring the panels' opacity/dim sliders.
    opacity: number;
}>) {
    return (
        <label className="d-flex align-items-center gap-1 m-0" title={label}>
            <i className={`bi ${icon}`} />
            <span
                style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '34px',
                    height: '24px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    background:
                        'conic-gradient(#bbb 25%, #fff 0 50%,' +
                        ' #bbb 0 75%, #fff 0) 0 0 / 10px 10px',
                }}
            >
                <input
                    type="color"
                    value={color}
                    aria-label={label}
                    onChange={(event) => {
                        setColor(event.target.value);
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
                        opacity: opacity / 100,
                    }}
                />
            </span>
        </label>
    );
}
