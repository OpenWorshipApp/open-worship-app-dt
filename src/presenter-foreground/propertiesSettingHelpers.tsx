import './foregroundProperties.scss';

import {
    type ChangeEvent,
    type ReactNode,
    useCallback,
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
import {
    transitionEffect,
    type TransitionEffectType,
} from '../_screen/transitionEffectHelpers';
import CommonStyleControlsComp, {
    DEFAULT_BACKDROP_FILTER,
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_TEXT_COLOR,
    genCommonStyleSettingNames,
    getForegroundCommonProperties,
} from './ForegroundCommonPropertiesSettingComp';
import { useAppCurrentRef } from '../helper/appHooks';
import PropRowComp from './ForegroundPropRowComp';
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

const DEFAULT_FONT_SIZE = 100;
const DEFAULT_WIDGET_WIDTH_PERCENTAGE = 50;
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

export const DEFAULT_TRANSITION_EFFECT = 'fade';

/**
 * The screen's own transition menu shows these as bare identifiers because it
 * is a developer-facing row; a volunteer's panel says what each one DOES.
 * Written as literals so `tranKeyCoverage.test.ts` can read them.
 */
const TRANSITION_LABEL_MAP: Record<string, string> = {
    none: 'No Transition',
    fade: 'Fade',
    move: 'Slide In',
    zoom: 'Zoom',
};

/**
 * The Width (%) a prefix is on, read straight from the setting so a slide show
 * running for a session nobody is looking at can still size its item.
 */
export function getForegroundWidthScale(prefix: string) {
    return getWidgetWidthScale(genPropsSettingNames(prefix).widthPercentage);
}

/**
 * Which transition this session's overlay uses. Read the same way the style
 * is -- straight from the setting, so a caller that is not rendering the
 * panel (the tile click, the slide show's next step) gets the current answer.
 */
export function getForegroundTransition(prefix: string) {
    const stored = getSetting(genPropsSettingNames(prefix).transitionEffect);
    return (
        stored !== null && stored in transitionEffect
            ? stored
            : DEFAULT_TRANSITION_EFFECT
    ) as TransitionEffectType;
}

export function genPropsSettingNames(prefix: string) {
    return {
        roundPercentage: `${prefix}-setting-show-widget-round-percentage`,
        widthPercentage: `${prefix}-setting-show-widget-width-percentage`,
        scale: `${prefix}-setting-show-widget-scale`,
        opacityPercentage: `${prefix}-setting-show-widget-opacity-percentage`,
        alignment: `${prefix}-setting-show-widget-alignment-data`,
        offsetX: `${prefix}-setting-show-widget-offset-x`,
        offsetY: `${prefix}-setting-show-widget-offset-y`,
        fontSize: `${prefix}-setting-show-widget-font-size`,
        roundSizePixel: `${prefix}-setting-show-widget-round-size-px`,
        blendMode: `${prefix}-setting-show-widget-blend-mode`,
        isAlwaysOnTop: `${prefix}-setting-show-widget-always-on-top`,
        zIndex: `${prefix}-setting-show-widget-z-index`,
        transitionEffect: `${prefix}-setting-show-widget-transition`,
    };
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
    if (horizontalAlignment === 'left') {
        style.left = `${widgetOffsetX}px`;
    } else if (horizontalAlignment === 'right') {
        style.right = `${widgetOffsetX}px`;
    }
    if (verticalAlignment === 'start') {
        style.top = `${widgetOffsetY}px`;
    } else if (verticalAlignment === 'end') {
        style.bottom = `${widgetOffsetY}px`;
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
};

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
            ),
        });
    }
    if (isFontSize) {
        Object.assign(style, getFontSizeStyle(names.fontSize));
    }
    // Every foreground widget can be pinned on top, geometry or not.
    Object.assign(
        style,
        genZIndexExtraStyle(names.isAlwaysOnTop, names.zIndex),
    );
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
    const isPixel = roundSizePixel > 0;
    const roundSizePixelRef = useAppCurrentRef(roundSizePixel);
    const setRoundSizePixelRef = useAppCurrentRef(setRoundSizePixel);
    // Switching to px with nothing set would leave the corner unchanged and
    // the control looking broken, so it starts at the default it always had.
    const handleUsePixel = useCallback(() => {
        setRoundSizePixelRef.current(
            roundSizePixelRef.current > 0
                ? roundSizePixelRef.current
                : DEFAULT_ROUND_SIZE_PIXEL,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Zero IS how the app says "use the percentage"; the toggle just stops
    // that being something the user has to know.
    const handleUsePercentage = useCallback(() => {
        setRoundSizePixelRef.current(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handlePixelChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setRoundSizePixelRef.current(
                Math.max(0, Number.parseInt(event.target.value) || 0),
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
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
                    value={roundSizePixel}
                    onChange={handlePixelChange}
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
 * How this session's overlay comes in and goes out.
 *
 * The screen's own `Tr:` row carries one for the whole Slide layer and one for
 * the whole Background, which is right where a layer holds one thing at a
 * time. The foreground routinely holds several at once -- a logo that should
 * never move and a snow clip that should fade -- so the choice belongs to the
 * session, beside the blend it is already choosing.
 */
function TransitionPropComp({
    transitionEffect: chosen,
    setTransitionEffect,
}: Readonly<{
    transitionEffect: string;
    setTransitionEffect: (value: string) => void;
}>) {
    const setTransitionEffectRef = useAppCurrentRef(setTransitionEffect);
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            setTransitionEffectRef.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const label = tran('Transition');
    return (
        <PropRowComp
            iconClassName={
                'bi ' +
                (
                    transitionEffect[chosen as TransitionEffectType]?.[0] ??
                    transitionEffect[DEFAULT_TRANSITION_EFFECT][0]
                ).replace('bi ', '')
            }
            label={label}
            isEngaged={chosen !== DEFAULT_TRANSITION_EFFECT}
        >
            <select
                className="fg-select"
                aria-label={label}
                value={chosen}
                onChange={handleChange}
            >
                {Object.keys(transitionEffect).map((effect) => {
                    return (
                        <option key={effect} value={effect}>
                            {tran(TRANSITION_LABEL_MAP[effect])}
                        </option>
                    );
                })}
            </select>
        </PropRowComp>
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

function AlwaysOnTopPropComp({
    isAlwaysOnTop,
    setIsAlwaysOnTop,
    zIndex,
    setZIndex,
}: Readonly<{
    isAlwaysOnTop: boolean;
    setIsAlwaysOnTop: (value: boolean) => void;
    zIndex: number;
    setZIndex: (value: number) => void;
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
    return (
        <PropRowComp
            iconClassName="bi bi-layers"
            label={label}
            isEngaged={isAlwaysOnTop}
        >
            <input
                className="form-check-input mt-0"
                type="checkbox"
                checked={isAlwaysOnTop}
                title={label}
                aria-label={label}
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
                disabled={!isAlwaysOnTop}
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
    isTransition: boolean;
    extraControls?: ReactNode;
    fontFamily: string;
    setFontFamily: (value: string) => void;
    fontWeight: string;
    setFontWeight: (value: string) => void;
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
    isTransition,
    extraControls,
    fontFamily,
    setFontFamily,
    fontWeight,
    setFontWeight,
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
    const [transitionEffectValue, setTransitionEffectValue] =
        useStateSettingString(
            names.transitionEffect,
            DEFAULT_TRANSITION_EFFECT,
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
    const [textColor, setTextColor] = useStateSettingString(
        commonNames.color,
        DEFAULT_TEXT_COLOR,
    );
    const [backgroundColor, setBackgroundColor] = useStateSettingString(
        commonNames.backgroundColor,
        DEFAULT_BACKGROUND_COLOR,
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
                <AlwaysOnTopPropComp
                    isAlwaysOnTop={isAlwaysOnTop}
                    setIsAlwaysOnTop={wrapSetter(setIsAlwaysOnTop, onChange)}
                    zIndex={zIndex}
                    setZIndex={wrapSetter(setZIndex, onChange)}
                />
                {isBlendMode ? (
                    <BlendModePropComp
                        blendMode={blendMode}
                        setBlendMode={wrapSetter(setBlendMode, onChange)}
                    />
                ) : null}
                {isTransition ? (
                    <TransitionPropComp
                        transitionEffect={transitionEffectValue}
                        setTransitionEffect={wrapSetter(
                            setTransitionEffectValue,
                            onChange,
                        )}
                    />
                ) : null}
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
            <PropertiesSettingBodyComp {...props} />
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
    isTransition = false,
    extraControls,
}: Readonly<{
    prefix: string;
    onChange: (style: CSSProperties) => void;
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
    /** Offer a per-session transition, the way `isBlendMode` offers a blend. */
    isTransition?: boolean;
    extraControls?: ReactNode;
}>) {
    const commonNames = genCommonStyleSettingNames(prefix);
    const genStyle: () => CSSProperties = () => {
        return genForegroundExtraStyle(prefix, {
            isFontSize,
            isGeometry,
            isCommonStyle,
            isBlendMode,
        });
    };
    const getTransition = () => {
        // Only where the widget offers the control -- a text widget that
        // never shows one must not start carrying a choice on its datum.
        return isTransition ? getForegroundTransition(prefix) : undefined;
    };
    const onChange1 = () => {
        onChange(genStyle());
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
                isTransition={isTransition}
                extraControls={extraControls}
                fontFamily={fontFamily}
                setFontFamily={setFontFamily}
                fontWeight={fontWeight}
                setFontWeight={setFontWeight}
            />
        ),
    };
}
