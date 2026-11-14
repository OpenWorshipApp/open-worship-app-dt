import './foregroundProperties.scss';

import {
    type ChangeEvent,
    type ReactNode,
    useCallback,
    useState,
    type CSSProperties,
} from 'react';

import { tran } from '../lang/langHelpers';
import {
    getSetting,
    useStateSettingBoolean,
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import ForegroundPositionPadComp from './ForegroundPositionPadComp';
import AppRangeComp from '../others/AppRangeComp';
import CommonStyleControlsComp, {
    DEFAULT_BACKDROP_FILTER,
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_TEXT_COLOR,
    genCommonStyleSettingNames,
    getForegroundCommonProperties,
} from './ForegroundCommonPropertiesSettingComp';
import { useAppCurrentRef } from '../helper/appHooks';
import PropRowComp from './ForegroundPropRowComp';
import ForegroundPresetsComp from './ForegroundPresetsComp';
import BlendModeSelectComp from '../others/BlendModeSelectComp';
import {
    checkIsBlending,
    DEFAULT_BLEND_MODE,
    toValidBlendMode,
} from '../helper/blendModeHelpers';
import DecorationControlsComp from './ForegroundDecorationSettingComp';
import {
    genForegroundDecorationStyle,
    getForegroundDecoration,
} from './foregroundDecorationHelpers';
import { resolveForegroundTransition } from './foregroundTransitionHelpers';
import { genPropsSettingNames } from './foregroundStyleSettingNames';
import { ForegroundTransitionPropComp } from './ForegroundTransitionControlsComp';
import { getForegroundDefaultColors } from './foregroundThemeColorHelpers';
import type { AppColorType } from '../others/color/colorHelpers';

const DEFAULT_FONT_SIZE = 100;
const DEFAULT_WIDGET_WIDTH_PERCENTAGE = 50;
/** A margin keeps at least a tenth of the screen for the box. */
const MAX_MARGIN_PERCENTAGE = 45;
const DEFAULT_WIDGET_SCALE = 1;
const DEFAULT_WIDGET_OPACITY_PERCENTAGE = 100;
const DEFAULT_ROUND_PERCENTAGE = 50;
const DEFAULT_ROUND_SIZE_PIXEL = 5;

/**
 * See `getWidgetRoundExtraStyle`: no geometry, no rounding to start with.
 *
 * BOTH halves have to say zero. A pixel size of 0 does not mean "no corner" --
 * it is how this control says "use the percentage instead" -- so zeroing only
 * the pixels handed a marquee the 50% default, i.e. a 25% radius on a band
 * that had square corners the day before.
 */
function genDefaultRoundSizePixel(isGeometry: boolean) {
    return isGeometry ? DEFAULT_ROUND_SIZE_PIXEL : 0;
}

function genDefaultRoundPercentage(isGeometry: boolean) {
    return isGeometry ? DEFAULT_ROUND_PERCENTAGE : 0;
}
const DEFAULT_WIDGET_OFFSET_X = 0;
const DEFAULT_WIDGET_OFFSET_Y = 0;
const DEFAULT_Z_INDEX = 1;

/**
 * The Width (%) a prefix is on, read straight from the setting so a slide show
 * running for a session nobody is looking at can still size its item.
 */
export function getForegroundWidthScale(prefix: string) {
    return getWidgetWidthScale(genPropsSettingNames(prefix).widthPercentage);
}

// The key names live in a module of their own, free of this one's React and
// styles; re-exported here for the callers that always found them here.
export { genPropsSettingNames };

/**
 * Whether this session's overlay goes BEHIND the slide and the Bible text.
 * Read straight from the setting like the transition, so a caller that is not
 * rendering the panel gets the current answer. It travels on the DATUM, not in
 * `extraStyle` -- see `ForegroundLayerDataType`.
 */
export function getForegroundIsBehind(prefix: string) {
    return getSetting(genPropsSettingNames(prefix).isBehind) === 'true';
}

/**
 * Lifts a widget above the foreground's own paint order, which is otherwise
 * just the order the items went up in -- a logo has to stay over the falling
 * snow whichever was shown first. The NUMBER is what separates two widgets
 * that are both on top: the higher one wins.
 *
 * Safe beside a blend mode: `z-index` makes this element a stacking context
 * for its DESCENDANTS, which is not the same as isolating the element from
 * its own backdrop -- it still blends with the background and the slide. Do
 * not move it onto the wrapper `createDivContainer` builds, which is static
 * on purpose; making THAT a stacking context is what would kill blending.
 */
function genZIndexExtraStyle(
    isAlwaysOnTopSettingName: string,
    zIndexSettingName: string,
): CSSProperties {
    if (getSetting(isAlwaysOnTopSettingName) !== 'true') {
        return {};
    }
    const zIndex = Number.parseInt(
        getSetting(zIndexSettingName) ?? DEFAULT_Z_INDEX.toString(),
    );
    return {
        position: 'absolute',
        zIndex: Number.isNaN(zIndex) ? DEFAULT_Z_INDEX : zIndex,
    };
}

/**
 * The corner radius, which every widget has and not only the ones that carry
 * geometry: a marquee is a band with a border on it now, and a border with no
 * way to round its corners is half a control.
 *
 * `defaultSizePixel` is what a widget starts on. It is 0 where there is no
 * geometry -- the rounding the other widgets ship with would otherwise appear
 * on the marquee band the day this stopped being gated, which is a change
 * nobody asked for.
 */
function getWidgetRoundExtraStyle(
    settingNamePixel: string,
    settingNamePercentage: string,
    defaultSizePixel: number,
    defaultPercentage: number,
): CSSProperties {
    const roundSizePixel = Number.parseInt(
        getSetting(settingNamePixel) ?? defaultSizePixel.toString(),
    );
    if (roundSizePixel > 0) {
        return {
            borderRadius: `${roundSizePixel}px`,
        };
    }
    const percentage = Number.parseInt(
        getSetting(settingNamePercentage) ?? defaultPercentage.toString(),
    );
    const roundPercentage = Math.round(
        Math.max(0, Math.min(100, percentage)) / 2,
    );
    return {
        borderRadius: `${roundPercentage}%`,
    };
}

function getWidgetWidthScale(settingName: string) {
    const widthScale = Number.parseInt(
        getSetting(settingName) ?? DEFAULT_WIDGET_WIDTH_PERCENTAGE.toString(),
    );
    return Math.max(1, Math.min(100, widthScale));
}
function genWidgetWidthExtraStyle(settingName: string): CSSProperties {
    const widthScale = getWidgetWidthScale(settingName);
    return {
        width: `${widthScale}%`,
        height: 'auto',
    };
}

function genWidgetOpacityExtraStyle(settingName: string): CSSProperties {
    const opacityScale = Number.parseInt(
        getSetting(settingName) ?? DEFAULT_WIDGET_OPACITY_PERCENTAGE.toString(),
    );
    return {
        opacity: Math.max(0, Math.min(100, opacityScale)) / 100,
    };
}

function extractNumber(n: number) {
    return [n < 0 ? '-' : '+', Math.abs(n)];
}

function genMinusCalc(n: number) {
    const [sign, abs] = extractNumber(n);
    return `calc(-50% ${sign} ${abs}px)`;
}

function genTransformScale(settingName: string) {
    const scale = Number.parseFloat(
        getSetting(settingName) ?? DEFAULT_WIDGET_SCALE.toString(),
    );
    return `scale(${scale})`;
}

function genTransformRotate() {
    return 'rotate(0deg)';
}

function genTransformingExtraStyle(
    alignSettingName: string,
    offsetXSettingName: string,
    offsetYSettingName: string,
    widgetScaleSettingName: string,
    insets: { horizontalPercentage: number; verticalPercentage: number } = {
        horizontalPercentage: 0,
        verticalPercentage: 0,
    },
): CSSProperties {
    const widgetOffsetX = Number.parseInt(
        getSetting(offsetXSettingName) ?? DEFAULT_WIDGET_OFFSET_X.toString(),
    );
    const widgetOffsetY = Number.parseInt(
        getSetting(offsetYSettingName) ?? DEFAULT_WIDGET_OFFSET_Y.toString(),
    );
    const alignmentData = JSON.parse(getSetting(alignSettingName) ?? '{}');
    const { horizontalAlignment = 'center', verticalAlignment = 'center' } =
        alignmentData;
    const transformScale = genTransformScale(widgetScaleSettingName);
    const transformRotate = genTransformRotate();
    const transformScaleRotate = `${transformScale} ${transformRotate}`;
    // Anchor scaling to the aligned edge so `scale()` grows the widget away from
    // the screen edge it is pinned to. With the default center origin, an
    // edge-anchored widget (left/right/top/bottom) scaled up expands past that
    // edge and gets clipped off-screen.
    const horizontalOrigin =
        horizontalAlignment === 'left'
            ? 'left'
            : horizontalAlignment === 'right'
              ? 'right'
              : 'center';
    const verticalOrigin =
        verticalAlignment === 'start'
            ? 'top'
            : verticalAlignment === 'end'
              ? 'bottom'
              : 'center';
    const transformOrigin = `${horizontalOrigin} ${verticalOrigin}`;
    if (horizontalAlignment === 'center' && verticalAlignment === 'center') {
        const translate =
            `translate(${genMinusCalc(widgetOffsetX)},` +
            ` ${genMinusCalc(widgetOffsetY)})`;
        const style = {
            left: '50%',
            top: '50%',
            transform: `${translate} ${transformScaleRotate}`,
            transformOrigin,
        };
        return style;
    }
    let style: any = {
        transform: transformScaleRotate,
    };
    if (horizontalAlignment === 'center') {
        style = {
            left: '50%',
            transform:
                `translateX(${genMinusCalc(widgetOffsetX)})` +
                ` ${transformScaleRotate}`,
        };
    }
    if (verticalAlignment === 'center') {
        style = {
            top: '50%',
            transform:
                `translateY(${genMinusCalc(widgetOffsetY)})` +
                ` ${transformScaleRotate}`,
        };
    }
    // A margin moves the box in from the edge it is set to; with none it is
    // the plain pixel nudge it always was.
    const toEdge = (percentage: number, pixel: number) => {
        return percentage > 0
            ? `calc(${percentage}% + ${pixel}px)`
            : `${pixel}px`;
    };
    if (horizontalAlignment === 'left') {
        style.left = toEdge(insets.horizontalPercentage, widgetOffsetX);
    } else if (horizontalAlignment === 'right') {
        style.right = toEdge(insets.horizontalPercentage, widgetOffsetX);
    }
    if (verticalAlignment === 'start') {
        style.top = toEdge(insets.verticalPercentage, widgetOffsetY);
    } else if (verticalAlignment === 'end') {
        style.bottom = toEdge(insets.verticalPercentage, widgetOffsetY);
    }
    style.transformOrigin = transformOrigin;
    return style;
}

function getFontSizeStyle(fontSizeSettingName: string): CSSProperties {
    const fontSize = Number.parseInt(
        getSetting(fontSizeSettingName) ?? DEFAULT_FONT_SIZE.toString(),
    );
    return {
        fontSize: `${fontSize}px`,
    };
}

type ForegroundPropsOptionType = {
    isFontSize: boolean;
    isGeometry: boolean;
    isCommonStyle: boolean;
    isBlendMode: boolean;
    /** Margins in place of Width -- see `genMarginInsets`. */
    isMargin?: boolean;
};

/**
 * Where a box with MARGINS sits (Quick Text, 2026-11-09, the user: _replace
 * the width with margin like in lyric setting_). The side margins are the
 * width -- `(100 - width) / 2` on each side -- so a box set to one side starts
 * that far in, and the top or bottom margin is a share of the screen's
 * height. Each adds to the pixel nudge.
 */
function genMarginInsets(names: ReturnType<typeof genPropsSettingNames>) {
    const width = getWidgetWidthScale(names.widthPercentage);
    const vertical = Number.parseFloat(
        getSetting(names.marginVerticalPercentage) ?? '0',
    );
    return {
        horizontalPercentage: (100 - width) / 2,
        verticalPercentage: Number.isFinite(vertical)
            ? Math.max(0, Math.min(MAX_MARGIN_PERCENTAGE, vertical))
            : 0,
    };
}

/**
 * The whole of a widget's `extraStyle`, read straight from the settings rather
 * than from React state -- which is what lets the Properties FORM stay
 * unmounted until somebody opens it.
 */
export function genForegroundExtraStyle(
    prefix: string,
    {
        isFontSize,
        isGeometry,
        isCommonStyle,
        isBlendMode,
        isMargin = false,
    }: ForegroundPropsOptionType,
): CSSProperties {
    const names = genPropsSettingNames(prefix);
    const blendMode = isBlendMode
        ? toValidBlendMode(getSetting(names.blendMode))
        : DEFAULT_BLEND_MODE;
    const isBlending = checkIsBlending(blendMode);
    const style: CSSProperties = {};
    if (isCommonStyle) {
        Object.assign(style, getForegroundCommonProperties(prefix));
        if (isBlending) {
            // `backdrop-filter` makes the element a backdrop root, and what
            // that composites with a blend mode on the SAME element is
            // undefined. It was never visible under a media widget anyway --
            // the picture covers its own box.
            Object.assign(style, { backdropFilter: 'none' });
        }
    }
    Object.assign(
        style,
        getWidgetRoundExtraStyle(
            names.roundSizePixel,
            names.roundPercentage,
            genDefaultRoundSizePixel(isGeometry),
            genDefaultRoundPercentage(isGeometry),
        ),
    );
    if (isGeometry) {
        Object.assign(style, {
            position: 'absolute',
            height: 'auto',
            ...genWidgetWidthExtraStyle(names.widthPercentage),
            ...genWidgetOpacityExtraStyle(names.opacityPercentage),
            ...genTransformingExtraStyle(
                names.alignment,
                names.offsetX,
                names.offsetY,
                names.scale,
                isMargin ? genMarginInsets(names) : undefined,
            ),
        });
    }
    if (isFontSize) {
        Object.assign(style, getFontSizeStyle(names.fontSize));
    }
    // Every foreground widget can be pinned on top, geometry or not -- except
    // one BEHIND the slide. Its root makes no stacking context (that is what
    // lets it blend with the background), so a `z-index` there competes with
    // the slide and the Bible view in the ROOT stacking context and wins: the
    // overlay would leap back over the words it was put behind.
    if (!getForegroundIsBehind(prefix)) {
        Object.assign(
            style,
            genZIndexExtraStyle(names.isAlwaysOnTop, names.zIndex),
        );
    }
    if (isBlending) {
        // Blends with whatever is painted UNDER `#foreground` -- the
        // background, the slide and the bible view -- because nothing between
        // this element and the document root makes a stacking context. See the
        // warning on `ScreenForegroundManager.containerStyle`.
        Object.assign(style, { mixBlendMode: blendMode });
    }
    // The frame, the shadow, the room around the words and how they are set.
    // LAST, so a border a person chose is never overwritten by a default, and
    // one read for all thirteen of its values -- see
    // `foregroundDecorationHelpers`. It owns the box shadow every overlay used
    // to get hardcoded, `medium` being that exact shadow.
    Object.assign(
        style,
        genForegroundDecorationStyle(
            getForegroundDecoration(prefix, isCommonStyle),
            { isText: isCommonStyle, isBlending },
        ),
    );
    return style;
}

function wrapSetter<T>(
    setter: (value: T) => void,
    afterChange: () => void,
): (value: T) => void {
    return (value: T) => {
        setter(value);
        afterChange();
    };
}

/**
 * Corner rounding, as ONE control with a unit.
 *
 * It was two: a `Round (%)` slider and, three controls away, an unlabelled
 * pixel box whose only clue was a tooltip on the slider saying "Set round size
 * pixel to 0 to use this" -- an explanation of a MODE, written where the mode
 * is not. They are one question with two units, so this asks it once: pick the
 * unit, set the value.
 */
function RoundPropComp({
    roundPercentage,
    setRoundPercentage,
    roundSizePixel,
    setRoundSizePixel,
    isEngaged,
}: Readonly<{
    roundPercentage: number;
    setRoundPercentage: (value: number) => void;
    roundSizePixel: number;
    setRoundSizePixel: (value: number) => void;
    isEngaged: boolean;
}>) {
    // The unit is the ROW's, not read off the value: a px box cleared to type
    // a new number wrote 0, and 0 is how the setting says "use the
    // percentage" -- so the row turned into the % slider and the box the
    // operator was typing in vanished under them (2026-11-09, reported).
    const [isPixel, setIsPixel] = useState(roundSizePixel > 0);
    // What the box shows while it is typed in, which may be nothing yet.
    const [pixelText, setPixelText] = useState(`${roundSizePixel}`);
    const roundSizePixelRef = useAppCurrentRef(roundSizePixel);
    const setRoundSizePixelRef = useAppCurrentRef(setRoundSizePixel);
    const setRoundPercentageRef = useAppCurrentRef(setRoundPercentage);
    // Switching to px with nothing set would leave the corner unchanged and
    // the control looking broken, so it starts at the default it always had.
    const handleUsePixel = useCallback(() => {
        const value =
            roundSizePixelRef.current > 0
                ? roundSizePixelRef.current
                : DEFAULT_ROUND_SIZE_PIXEL;
        setIsPixel(true);
        setPixelText(`${value}`);
        setRoundSizePixelRef.current(value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Zero IS how the app says "use the percentage"; the toggle just stops
    // that being something the user has to know.
    const handleUsePercentage = useCallback(() => {
        setIsPixel(false);
        setRoundSizePixelRef.current(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handlePixelChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const text = event.target.value;
            setPixelText(text);
            const value = Number.parseInt(text, 10);
            if (!Number.isFinite(value)) {
                // Emptied to type another number: nothing is written yet.
                return;
            }
            if (value <= 0) {
                // 0 px is a square corner. Stored as 0 it would mean "the
                // percentage", so the percentage goes to 0 with it.
                setRoundPercentageRef.current(0);
                setRoundSizePixelRef.current(0);
                return;
            }
            setRoundSizePixelRef.current(value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // Left empty: the box shows the value that is still in force.
    const handlePixelBlur = useCallback(() => {
        setPixelText((text) => {
            return Number.isFinite(Number.parseInt(text, 10))
                ? text
                : `${roundSizePixelRef.current}`;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const label = tran('Round');
    return (
        <PropRowComp
            iconClassName="bi bi-app"
            label={label}
            isEngaged={isEngaged}
        >
            <span className="fg-unit" role="group" aria-label={label}>
                <button
                    type="button"
                    className={isPixel ? '' : 'fg-unit-on'}
                    aria-pressed={!isPixel}
                    title={`${label} %`}
                    onClick={handleUsePercentage}
                >
                    %
                </button>
                <button
                    type="button"
                    className={isPixel ? 'fg-unit-on' : ''}
                    aria-pressed={isPixel}
                    title={`${label} px`}
                    onClick={handleUsePixel}
                >
                    px
                </button>
            </span>
            {isPixel ? (
                <input
                    className="fg-num"
                    type="number"
                    min={0}
                    aria-label={`${label} px`}
                    value={pixelText}
                    onChange={handlePixelChange}
                    onBlur={handlePixelBlur}
                />
            ) : (
                <AppRangeComp
                    value={roundPercentage}
                    title={`${label} %`}
                    setValue={setRoundPercentage}
                    defaultSize={{
                        size: roundPercentage,
                        min: 0,
                        max: 100,
                        step: 1,
                    }}
                    isShowValue
                    isCompact
                />
            )}
        </PropRowComp>
    );
}

/**
 * Quick Text's Margin, in place of Width (2026-11-09, the user: _for quick
 * text only I want to replace the width with margin like in lyric
 * setting_): the Lyric stage style's two sliders and link. The side margin
 * IS the width -- `(100 - width) / 2` -- so a preset, the assistant and the
 * screen keep reading the one width they always have; the top or bottom
 * margin is a key of its own.
 */
function MarginPropComp({
    widthPercentage,
    setWidthPercentage,
    marginVerticalPercentage,
    setMarginVerticalPercentage,
    isMarginLinked,
    setIsMarginLinked,
}: Readonly<{
    widthPercentage: number;
    setWidthPercentage: (value: number) => void;
    marginVerticalPercentage: number;
    setMarginVerticalPercentage: (value: number) => void;
    isMarginLinked: boolean;
    setIsMarginLinked: (value: boolean) => void;
}>) {
    const horizontal = Math.round((100 - widthPercentage) / 2);
    const toMargin = (value: number) => {
        return Math.max(0, Math.min(MAX_MARGIN_PERCENTAGE, Math.round(value)));
    };
    const handleHorizontal = (value: number) => {
        const margin = toMargin(value);
        setWidthPercentage(100 - margin * 2);
        if (isMarginLinked) {
            setMarginVerticalPercentage(margin);
        }
    };
    const handleVertical = (value: number) => {
        const margin = toMargin(value);
        setMarginVerticalPercentage(margin);
        if (isMarginLinked) {
            setWidthPercentage(100 - margin * 2);
        }
    };
    const linkTitle = tran('Link horizontal and vertical margin');
    const range = { min: 0, max: MAX_MARGIN_PERCENTAGE, step: 1 };
    // The link at the LEFT of both rows, centred between the two it ties
    // (the user's picture, 2026-11-09) -- and the Lyric stage panel's too.
    return (
        <div className="fg-margin-group">
            <button
                type="button"
                className={
                    'btn btn-sm btn' +
                    (isMarginLinked ? '' : '-outline') +
                    '-info fg-margin-link'
                }
                title={linkTitle}
                aria-label={linkTitle}
                aria-pressed={isMarginLinked}
                onClick={() => {
                    setIsMarginLinked(!isMarginLinked);
                }}
            >
                <i
                    className={'bi bi-link' + (isMarginLinked ? '-45deg' : '')}
                />
            </button>
            <div className="fg-margin-rows">
                <PropRowComp
                    iconClassName="bi bi-arrows"
                    label={tran('Horizontal Margin (%)')}
                    isEngaged={
                        widthPercentage !== DEFAULT_WIDGET_WIDTH_PERCENTAGE
                    }
                >
                    <AppRangeComp
                        value={horizontal}
                        title={tran('Horizontal Margin (%)')}
                        setValue={handleHorizontal}
                        defaultSize={{ ...range, size: horizontal }}
                        isShowValue
                        isCompact
                    />
                </PropRowComp>
                <PropRowComp
                    iconClassName="bi bi-arrows-vertical"
                    label={tran('Vertical Margin (%)')}
                    isEngaged={marginVerticalPercentage !== 0}
                >
                    <AppRangeComp
                        value={marginVerticalPercentage}
                        title={tran('Vertical Margin (%)')}
                        setValue={handleVertical}
                        defaultSize={{
                            ...range,
                            size: marginVerticalPercentage,
                        }}
                        isShowValue
                        isCompact
                    />
                </PropRowComp>
            </div>
        </div>
    );
}

function BlendModePropComp({
    blendMode,
    setBlendMode,
}: Readonly<{
    blendMode: string;
    setBlendMode: (value: string) => void;
}>) {
    return (
        <PropRowComp
            iconClassName="bi bi-layers-half"
            label={tran('Blend Mode')}
            isEngaged={checkIsBlending(blendMode)}
        >
            <BlendModeSelectComp
                className="fg-select"
                blendMode={blendMode}
                setBlendMode={setBlendMode}
            />
        </PropRowComp>
    );
}

/**
 * Put this session's overlay BEHIND the slide and the Bible text -- over the
 * background, under the words. See `ForegroundLayerDataType`.
 */
function BehindPropComp({
    isBehind,
    setIsBehind,
}: Readonly<{
    isBehind: boolean;
    setIsBehind: (value: boolean) => void;
}>) {
    const setIsBehindRef = useAppCurrentRef(setIsBehind);
    const handleToggle = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setIsBehindRef.current(event.target.checked);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const label = tran('Behind Slide');
    const title = tran(
        'Show behind the slide and the Bible text, over the background',
    );
    return (
        <PropRowComp
            iconClassName="bi bi-layer-backward"
            label={label}
            title={title}
            isEngaged={isBehind}
        >
            <input
                className="form-check-input mt-0"
                type="checkbox"
                checked={isBehind}
                title={title}
                aria-label={label}
                onChange={handleToggle}
            />
        </PropRowComp>
    );
}

function AlwaysOnTopPropComp({
    isAlwaysOnTop,
    setIsAlwaysOnTop,
    zIndex,
    setZIndex,
    isBehind,
}: Readonly<{
    isAlwaysOnTop: boolean;
    setIsAlwaysOnTop: (value: boolean) => void;
    zIndex: number;
    setZIndex: (value: number) => void;
    /**
     * Behind the slide, Always on Top is not applied at all -- see
     * `genForegroundExtraStyle` -- so its controls say so rather than taking
     * a number that does nothing.
     */
    isBehind: boolean;
}>) {
    const setIsAlwaysOnTopRef = useAppCurrentRef(setIsAlwaysOnTop);
    const handleToggle = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setIsAlwaysOnTopRef.current(event.target.checked);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setZIndexRef = useAppCurrentRef(setZIndex);
    const handleZIndexChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setZIndexRef.current(Number.parseInt(event.target.value) || 0);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const label = tran('Always on Top');
    const zIndexLabel = tran('Z-Index');
    const disabledTitle = isBehind
        ? tran('Always on Top does not apply while it is behind the slide')
        : undefined;
    return (
        <PropRowComp
            iconClassName="bi bi-layers"
            label={label}
            title={disabledTitle}
            isEngaged={isAlwaysOnTop && !isBehind}
        >
            <input
                className="form-check-input mt-0"
                type="checkbox"
                checked={isAlwaysOnTop}
                title={disabledTitle ?? label}
                aria-label={label}
                disabled={isBehind}
                onChange={handleToggle}
            />
            <input
                // The name has to sit on the INPUT. It used to be a `title` on
                // the wrapping input-group, which left the field itself
                // nameless: nothing could reach it by its words -- not a
                // screen reader, not the assistant -- and this is the one
                // control that decides which of two overlays wins.
                className="fg-num"
                type="number"
                title={zIndexLabel}
                aria-label={zIndexLabel}
                value={zIndex}
                disabled={!isAlwaysOnTop || isBehind}
                onChange={handleZIndexChange}
            />
        </PropRowComp>
    );
}

type PropertiesSettingBodyPropsType = Readonly<{
    prefix: string;
    onChange: () => void;
    isFontSize: boolean;
    isGeometry: boolean;
    isCommonStyle: boolean;
    isBlendMode: boolean;
    /**
     * Which component this is (`countdown`, `marquee-top`): a session's own
     * transition falls back to its component's.
     */
    widgetKey: string;
    extraControls?: ReactNode;
    fontFamily: string;
    setFontFamily: (value: string) => void;
    fontWeight: string;
    setFontWeight: (value: string) => void;
    /** A preset was written: read every setting of this block again. */
    onPresetApplied?: () => void;
    /** Margins in place of Width (Quick Text). */
    isMargin?: boolean;
}>;

/**
 * Every control's state, and therefore every one of its setting reads, lives
 * here rather than in `useForegroundPropsSetting` -- and this is mounted only
 * while the panel is OPEN. `appLocalStorage.getItem` reads a FILE per key, and
 * a media widget draws one of these cards per file in a folder.
 */
function PropertiesSettingBodyComp({
    prefix,
    onChange,
    isFontSize,
    isGeometry,
    isCommonStyle,
    isBlendMode,
    widgetKey,
    extraControls,
    fontFamily,
    setFontFamily,
    fontWeight,
    setFontWeight,
    onPresetApplied,
    isMargin = false,
}: PropertiesSettingBodyPropsType) {
    const names = genPropsSettingNames(prefix);
    const commonNames = genCommonStyleSettingNames(prefix);
    const [widgetOffsetX, setWidgetOffsetX] = useStateSettingNumber(
        names.offsetX,
        DEFAULT_WIDGET_OFFSET_X,
    );
    const [widgetOffsetY, setWidgetOffsetY] = useStateSettingNumber(
        names.offsetY,
        DEFAULT_WIDGET_OFFSET_Y,
    );
    const [roundPercentage, setRoundPercentage] = useStateSettingNumber(
        names.roundPercentage,
        genDefaultRoundPercentage(isGeometry),
    );
    const [widgetWidthPercentage, setWidgetWidthPercentage] =
        useStateSettingNumber(
            names.widthPercentage,
            DEFAULT_WIDGET_WIDTH_PERCENTAGE,
        );
    const [widgetScale, setWidgetScale] = useStateSettingNumber(
        names.scale,
        DEFAULT_WIDGET_SCALE,
    );
    // Quick Text's Margin row; read while this block is open, like every
    // other row here.
    const [marginVerticalPercentage, setMarginVerticalPercentage] =
        useStateSettingNumber(names.marginVerticalPercentage, 0);
    const [isMarginLinked, setIsMarginLinked] = useStateSettingBoolean(
        names.isMarginLinked,
        false,
    );
    const [opacityPercentage, setOpacityPercentage] = useStateSettingNumber(
        names.opacityPercentage,
        DEFAULT_WIDGET_OPACITY_PERCENTAGE,
    );
    const [alignmentData, setAlignmentData] = useStateSettingString(
        names.alignment,
        JSON.stringify({
            horizontalAlignment: 'center',
            verticalAlignment: 'center',
        }),
    );
    const [fontSize, setFontSize] = useStateSettingNumber(
        names.fontSize,
        DEFAULT_FONT_SIZE,
    );
    const [roundSizePixel, setRoundSizePixel] = useStateSettingNumber(
        names.roundSizePixel,
        genDefaultRoundSizePixel(isGeometry),
    );
    const [blendMode, setBlendMode] = useStateSettingString(
        names.blendMode,
        DEFAULT_BLEND_MODE,
    );
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useStateSettingBoolean(
        names.isAlwaysOnTop,
        false,
    );
    const [zIndex, setZIndex] = useStateSettingNumber(
        names.zIndex,
        DEFAULT_Z_INDEX,
    );
    const [isBehind, setIsBehind] = useStateSettingBoolean(
        names.isBehind,
        false,
    );
    // Unset, the colours are the app theme's side of the defaults.
    const [defaultColors] = useState(() => {
        return isCommonStyle
            ? getForegroundDefaultColors()
            : {
                  color: DEFAULT_TEXT_COLOR,
                  backgroundColor: DEFAULT_BACKGROUND_COLOR,
              };
    });
    const [textColor, setTextColor] = useStateSettingString(
        commonNames.color,
        defaultColors.color as AppColorType,
    );
    const [backgroundColor, setBackgroundColor] = useStateSettingString(
        commonNames.backgroundColor,
        defaultColors.backgroundColor as AppColorType,
    );
    const [backdropFilter, setBackdropFilter] = useStateSettingNumber(
        commonNames.backdropFilter,
        DEFAULT_BACKDROP_FILTER,
    );
    const setFontSizeRef = useAppCurrentRef(wrapSetter(setFontSize, onChange));
    const handleFontSizeChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setFontSizeRef.current(
                Number.parseInt(event.target.value) || DEFAULT_FONT_SIZE,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // The old test was `roundSizePixel > 0`, and the default IS 5, so the row
    // was lit for every widget that had never been touched.
    const isRoundEngaged =
        roundSizePixel !== genDefaultRoundSizePixel(isGeometry) ||
        roundPercentage !== genDefaultRoundPercentage(isGeometry);
    const handleAlignmentData = (data: any) => {
        const oldData = JSON.parse(alignmentData);
        wrapSetter(
            setAlignmentData,
            onChange,
        )(JSON.stringify({ ...oldData, ...data }));
    };
    return (
        <div className="app-inner-shadow fg-props">
            <ForegroundPresetsComp
                widgetKey={widgetKey}
                prefix={prefix}
                flags={{ isFontSize, isGeometry, isCommonStyle, isMargin }}
                colors={
                    isCommonStyle
                        ? {
                              color: textColor,
                              backgroundColor,
                              onChange: (colors) => {
                                  setTextColor(colors.color);
                                  setBackgroundColor(colors.backgroundColor);
                                  onChange();
                              },
                          }
                        : undefined
                }
                onChange={onChange}
                onApplied={onPresetApplied ?? (() => {})}
            />
            {isGeometry ? (
                <ForegroundPositionPadComp
                    data={JSON.parse(alignmentData)}
                    onData={handleAlignmentData}
                    offsetX={widgetOffsetX}
                    setOffsetX={wrapSetter(setWidgetOffsetX, onChange)}
                    offsetY={widgetOffsetY}
                    setOffsetY={wrapSetter(setWidgetOffsetY, onChange)}
                />
            ) : null}
            <div className="fg-props-rows">
                {isGeometry ? (
                    <>
                        {isMargin ? (
                            <MarginPropComp
                                widthPercentage={widgetWidthPercentage}
                                setWidthPercentage={wrapSetter(
                                    setWidgetWidthPercentage,
                                    onChange,
                                )}
                                marginVerticalPercentage={
                                    marginVerticalPercentage
                                }
                                setMarginVerticalPercentage={wrapSetter(
                                    setMarginVerticalPercentage,
                                    onChange,
                                )}
                                isMarginLinked={isMarginLinked}
                                setIsMarginLinked={setIsMarginLinked}
                            />
                        ) : (
                            <PropRowComp
                                iconClassName="bi bi-arrows"
                                label={tran('Width (%)')}
                                isEngaged={
                                    widgetWidthPercentage !==
                                    DEFAULT_WIDGET_WIDTH_PERCENTAGE
                                }
                            >
                                <AppRangeComp
                                    value={widgetWidthPercentage}
                                    title={tran('Width (%)')}
                                    setValue={wrapSetter(
                                        setWidgetWidthPercentage,
                                        onChange,
                                    )}
                                    defaultSize={{
                                        size: widgetWidthPercentage,
                                        min: 1,
                                        max: 100,
                                        step: 1,
                                    }}
                                    isShowValue
                                    isCompact
                                />
                            </PropRowComp>
                        )}
                        <PropRowComp
                            iconClassName="bi bi-arrows-fullscreen"
                            label={tran('Scale')}
                            isEngaged={widgetScale !== DEFAULT_WIDGET_SCALE}
                        >
                            <AppRangeComp
                                value={widgetScale}
                                title={tran('Scale')}
                                setValue={wrapSetter(setWidgetScale, onChange)}
                                defaultSize={{
                                    size: widgetScale,
                                    min: 0.1,
                                    max: 3,
                                    step: 0.1,
                                }}
                                isShowValue
                                isCompact
                            />
                        </PropRowComp>
                        <PropRowComp
                            iconClassName="bi bi-circle-half"
                            label={tran('Opacity')}
                            isEngaged={
                                opacityPercentage !==
                                DEFAULT_WIDGET_OPACITY_PERCENTAGE
                            }
                        >
                            <AppRangeComp
                                value={opacityPercentage}
                                title={tran('Opacity (%)')}
                                setValue={wrapSetter(
                                    setOpacityPercentage,
                                    onChange,
                                )}
                                defaultSize={{
                                    size: opacityPercentage,
                                    min: 0,
                                    max: 100,
                                    step: 1,
                                }}
                                isShowValue
                                isCompact
                            />
                        </PropRowComp>
                    </>
                ) : null}
            </div>
            <div className="fg-props-tail">
                {/*
                 * What this PARTICULAR widget does comes first. A marquee's
                 * size and speed are the two controls its operator touches
                 * mid-service; they used to sit under the generic layering
                 * rows, four scroll-lengths down a panel that opens closed.
                 */}
                {extraControls}
                <BehindPropComp
                    isBehind={isBehind}
                    setIsBehind={wrapSetter(setIsBehind, onChange)}
                />
                <AlwaysOnTopPropComp
                    isAlwaysOnTop={isAlwaysOnTop}
                    setIsAlwaysOnTop={wrapSetter(setIsAlwaysOnTop, onChange)}
                    zIndex={zIndex}
                    setZIndex={wrapSetter(setZIndex, onChange)}
                    isBehind={isBehind}
                />
                {isBlendMode ? (
                    <BlendModePropComp
                        blendMode={blendMode}
                        setBlendMode={wrapSetter(setBlendMode, onChange)}
                    />
                ) : null}
                {/* Every widget, text and timers included: the session's
                    own transition, over its component's and the screen's.
                    Not wired to `onChange` -- an overlay already up keeps
                    the way it came in; this is how the NEXT one comes in. */}
                <ForegroundTransitionPropComp
                    prefix={prefix}
                    widgetKey={widgetKey}
                />
                {isFontSize ? (
                    <PropRowComp
                        iconClassName="bi bi-fonts"
                        label={tran('Font Size')}
                        title={tran('Font size in pixels')}
                        isEngaged={fontSize !== DEFAULT_FONT_SIZE}
                    >
                        <input
                            className="fg-num fg-num-wide"
                            type="number"
                            aria-label={tran('Font size in pixels')}
                            value={fontSize}
                            onChange={handleFontSizeChange}
                        />
                        <span className="fg-unit-static">px</span>
                    </PropRowComp>
                ) : null}
                {/*
                 * Inside the SAME grid, not under it. These are rows like any
                 * other, so letting them pack into the tail's columns is what
                 * turns three more lines into no more lines at all once the
                 * panel is wide enough to hold two.
                 */}
                {isCommonStyle ? (
                    <CommonStyleControlsComp
                        fontFamily={fontFamily}
                        setFontFamily={wrapSetter(setFontFamily, onChange)}
                        fontWeight={fontWeight}
                        setFontWeight={wrapSetter(setFontWeight, onChange)}
                        color={textColor}
                        setColor={wrapSetter(setTextColor, onChange)}
                        backgroundColor={backgroundColor}
                        setBackgroundColor={wrapSetter(
                            setBackgroundColor,
                            onChange,
                        )}
                        backdropFilter={backdropFilter}
                        setBackdropFilter={wrapSetter(
                            setBackdropFilter,
                            onChange,
                        )}
                    />
                ) : null}
            </div>
            {/*
             * The corner radius leads the dressing rows rather than sitting up
             * among Width / Scale / Opacity, because it is the same question as
             * the border drawn right under it: what shape is this box? It keeps
             * its own two settings, so a radius set before this moved is still
             * the radius.
             */}
            <DecorationControlsComp
                prefix={prefix}
                isText={isCommonStyle}
                onChange={onChange}
                isLeadingEngaged={isRoundEngaged}
                leadingRows={
                    <RoundPropComp
                        roundPercentage={roundPercentage}
                        setRoundPercentage={wrapSetter(
                            setRoundPercentage,
                            onChange,
                        )}
                        roundSizePixel={roundSizePixel}
                        setRoundSizePixel={wrapSetter(
                            setRoundSizePixel,
                            onChange,
                        )}
                        isEngaged={isRoundEngaged}
                    />
                }
            />
        </div>
    );
}

function PropertiesSettingComp(props: PropertiesSettingBodyPropsType) {
    const { prefix } = props;
    const [isOpened, setIsOpened] = useStateSettingBoolean(
        `foreground-${prefix}-show-properties-setting`,
        false,
    );
    // Bumped by a preset, for a block with no floating panel round it to
    // remount (the panels themselves remount on `notifyForegroundPanel`).
    const [presetRevision, setPresetRevision] = useState(0);
    const handlePresetApplied = useCallback(() => {
        setPresetRevision((old) => {
            return old + 1;
        });
    }, []);
    const setIsOpenedRef = useAppCurrentRef(setIsOpened);
    const handleToggle = useCallback(() => {
        setIsOpenedRef.current((old) => !old);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const toggleButton = (
        <button
            type="button"
            // No leading icon: the chevron already says "this opens", and a
            // second glyph saying the same thing is 20px the file grid could
            // have had.
            className={
                'fg-props-toggle' + (isOpened ? ' fg-props-toggle-on' : '')
            }
            aria-expanded={isOpened}
            onClick={handleToggle}
            title={tran('Properties')}
        >
            <span>{tran('Properties')}</span>
            <i className="bi bi-chevron-down" />
        </button>
    );
    if (!isOpened) {
        return toggleButton;
    }
    return (
        <div>
            <div className="mb-1">{toggleButton}</div>
            <PropertiesSettingBodyComp
                key={presetRevision}
                {...props}
                onPresetApplied={handlePresetApplied}
            />
        </div>
    );
}

export function useForegroundPropsSetting({
    prefix,
    onChange,
    isFontSize = false,
    isGeometry = true,
    isCommonStyle = true,
    isBlendMode = false,
    isMargin = false,
    widgetKey,
    extraControls,
}: Readonly<{
    prefix: string;
    /**
     * The widget's key -- `countdown`, `marquee-top`, `video` -- which names
     * the component a session's transition falls back to.
     */
    widgetKey: string;
    /**
     * A control changed. `isBehind` comes beside the style rather than inside
     * it: it picks the overlay's LAYER, so a refresh writes it onto the datum
     * (`withForegroundLayer`) and the screen moves the overlay to that root.
     */
    onChange: (style: CSSProperties, isBehind: boolean) => void;
    isFontSize?: boolean;
    isGeometry?: boolean;
    isCommonStyle?: boolean;
    /**
     * Adds the blend-mode picker. On for the widgets that put a PICTURE on the
     * screen -- video, image, web and camera -- where blending it with the
     * slide underneath is the point; off for the text widgets, which have
     * their own colours.
     */
    isBlendMode?: boolean;
    /** Margins in place of Width -- Quick Text alone. */
    isMargin?: boolean;
    extraControls?: ReactNode;
}>) {
    const commonNames = genCommonStyleSettingNames(prefix);
    const genStyle: () => CSSProperties = () => {
        return genForegroundExtraStyle(prefix, {
            isFontSize,
            isGeometry,
            isCommonStyle,
            isBlendMode,
            isMargin,
        });
    };
    const getTransition = () => {
        // The session's own, else the component's, else `undefined`: the
        // datum then carries no key at all and the screen uses its own
        // `Foreground:` effect.
        return resolveForegroundTransition(widgetKey, prefix);
    };
    const getIsBehind = () => {
        return getForegroundIsBehind(prefix);
    };
    const onChange1 = () => {
        onChange(genStyle(), getIsBehind());
    };
    // These two alone stay OUT of the panel body: the marquee and the quick
    // text draw their own preview with them, so a change has to re-render the
    // widget itself. Everything else is read by `genStyle` straight from the
    // settings, which is what lets the form stay unmounted while it is closed.
    const [fontFamily, setFontFamily] = useStateSettingString(
        commonNames.fontFamily,
        '',
    );
    const [fontWeight, setFontWeight] = useStateSettingString(
        commonNames.fontWeight,
        '',
    );
    return {
        genStyle,
        getTransition,
        getIsBehind,
        fontFamily,
        fontWeight,
        getWidthScale: () => {
            return getWidgetWidthScale(
                genPropsSettingNames(prefix).widthPercentage,
            );
        },
        element: (
            <PropertiesSettingComp
                // Every control below reads its setting ONCE, when it mounts.
                // A widget that swaps its prefix -- the media widgets do, one
                // prefix per session -- would otherwise keep showing the
                // PREVIOUS session's values while writing to the new one's
                // keys. Keying by the prefix remounts the panel, so it reads
                // the session it is actually on.
                key={prefix}
                prefix={prefix}
                onChange={onChange1}
                isFontSize={isFontSize}
                isGeometry={isGeometry}
                isCommonStyle={isCommonStyle}
                isBlendMode={isBlendMode}
                isMargin={isMargin}
                widgetKey={widgetKey}
                extraControls={extraControls}
                fontFamily={fontFamily}
                setFontFamily={setFontFamily}
                fontWeight={fontWeight}
                setFontWeight={setFontWeight}
            />
        ),
    };
}
