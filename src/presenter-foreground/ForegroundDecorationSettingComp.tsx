import { type ChangeEvent, type ReactNode, useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { setSetting, useStateSettingBoolean } from '../helper/settingHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import AppRangeComp from '../others/AppRangeComp';
import ColorPickerComp from '../others/color/ColorPicker';
import type { AppColorType } from '../others/color/colorHelpers';
import PropRowComp, {
    type PropOptionType,
    PropOptionsComp,
    PropSwatchComp,
    PropTogglesComp,
} from './ForegroundPropRowComp';
import {
    checkIsDecorationEngaged,
    genDecorationDefault,
    type ForegroundBorderStyleType,
    type ForegroundDecorationType,
    type ForegroundShadowType,
    type ForegroundTextAlignType,
    type ForegroundTextShadowType,
    genDecorationSettingName,
    getForegroundDecoration,
    MAX_FOREGROUND_BORDER_WIDTH,
    MAX_FOREGROUND_LETTER_SPACING,
    MAX_FOREGROUND_LINE_HEIGHT,
    MAX_FOREGROUND_PADDING,
    MIN_FOREGROUND_LETTER_SPACING,
} from './foregroundDecorationHelpers';

/**
 * What the words and the number on each preset button say, written as literals
 * so `tranKeyCoverage.test.ts` can read them. A dynamic `tran(someVariable)`
 * is invisible to that gate and a missing Khmer key THROWS in dev.
 */
const BORDER_STYLE_LABEL_MAP: Record<ForegroundBorderStyleType, string> = {
    none: 'None',
    solid: 'Solid',
    dashed: 'Dashed',
    dotted: 'Dotted',
    double: 'Double',
};
const SHADOW_LABEL_MAP: Record<ForegroundShadowType, string> = {
    none: 'None',
    soft: 'Soft',
    medium: 'Medium',
    strong: 'Strong',
    glow: 'Glow',
};
const TEXT_SHADOW_LABEL_MAP: Record<ForegroundTextShadowType, string> = {
    none: 'None',
    soft: 'Soft',
    glow: 'Glow',
    outline: 'Outline',
};
const TEXT_ALIGN_LABEL_MAP: Record<ForegroundTextAlignType, string> = {
    left: 'Align left',
    center: 'Align center',
    right: 'Align right',
};
const TEXT_ALIGN_ICON_MAP: Record<ForegroundTextAlignType, string> = {
    left: 'bi bi-text-left',
    center: 'bi bi-text-center',
    right: 'bi bi-text-right',
};

type OpenedColorType = 'border' | 'shadow' | 'text-shadow' | null;

/**
 * A border style drawn as the line it makes. `none` is the one that cannot be:
 * an empty button reads as a broken one, so it keeps the crossed circle.
 */
function genBorderStyleOptions(): PropOptionType<ForegroundBorderStyleType>[] {
    return (
        Object.keys(BORDER_STYLE_LABEL_MAP) as ForegroundBorderStyleType[]
    ).map((style) => {
        return {
            value: style,
            label: tran(BORDER_STYLE_LABEL_MAP[style]),
            ...(style === 'none'
                ? { iconClassName: 'bi bi-slash-circle' }
                : {
                      previewStyle: {
                          borderTop: `3px ${style} currentColor`,
                      },
                  }),
        };
    });
}

/**
 * Dressing: the frame, the fall of shadow, the room the words sit in and how
 * they are set.
 *
 * It is a section of its own, folded away, for the same reason the Properties
 * panel is: this floats over the file grid an operator also needs, and the
 * nine rows below answer questions that get asked mid-service while these
 * answer questions asked once, when the look is being decided. Closed, it
 * costs one line and mounts none of its controls; a widget whose dressing has
 * been touched says so on the fold, so a set-up nobody can find is never the
 * reason a message looks wrong.
 *
 * Every value is written into ONE setting -- see `foregroundDecorationHelpers`
 * -- so opening this reads one file and changing anything writes one.
 */
export default function DecorationControlsComp({
    prefix,
    isText,
    onChange,
    leadingRows,
    isLeadingEngaged = false,
}: Readonly<{
    prefix: string;
    /** Off for the media widgets: a clip has no words to set. */
    isText: boolean;
    onChange: () => void;
    /**
     * Rows that belong to this fold but whose settings are kept by the panel
     * around it -- the corner radius, which has its own two keys and had them
     * before this fold existed.
     */
    leadingRows?: ReactNode;
    /** ...and whether THOSE are doing anything, for the dot on the fold. */
    isLeadingEngaged?: boolean;
}>) {
    const [isOpened, setIsOpened] = useStateSettingBoolean(
        `foreground-${prefix}-show-decoration-setting`,
        false,
    );
    const setIsOpenedRef = useAppCurrentRef(setIsOpened);
    const handleToggle = useCallback(() => {
        setIsOpenedRef.current((old) => {
            return !old;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const defaultDecoration = genDecorationDefault(isText);
    // Read ONCE, on mount, exactly like every control in the panel around it.
    // The panel is keyed by prefix, so a widget that swaps session reads the
    // session it is actually on.
    const [decoration, setDecoration] = useState(() => {
        return getForegroundDecoration(prefix, isText);
    });
    const decorationRef = useAppCurrentRef(decoration);
    const prefixRef = useAppCurrentRef(prefix);
    const onChangeRef = useAppCurrentRef(onChange);
    const applyChange = useCallback(
        (patch: Partial<ForegroundDecorationType>) => {
            const newDecoration = { ...decorationRef.current, ...patch };
            setDecoration(newDecoration);
            setSetting(
                genDecorationSettingName(prefixRef.current),
                JSON.stringify(newDecoration),
            );
            onChangeRef.current();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const [openedColor, setOpenedColor] = useState<OpenedColorType>(null);
    const genColorToggle = (which: Exclude<OpenedColorType, null>) => {
        return () => {
            setOpenedColor((old) => {
                return old === which ? null : which;
            });
        };
    };
    const label = tran('Effects');
    const isEngaged =
        isLeadingEngaged ||
        checkIsDecorationEngaged(decoration, defaultDecoration);
    if (!isOpened) {
        return (
            <div className="fg-props-deco">
                <DecorationToggleComp
                    label={label}
                    isOpened={false}
                    isEngaged={isEngaged}
                    onToggle={handleToggle}
                />
            </div>
        );
    }
    const borderLabel = tran('Border');
    const borderWidthLabel = tran('Border Width');
    const borderColorLabel = tran('Border Color');
    const shadowLabel = tran('Shadow');
    const shadowColorLabel = tran('Shadow Color');
    const paddingLabel = tran('Padding');
    const alignLabel = tran('Text Align');
    const lineHeightLabel = tran('Line Height');
    const letterSpacingLabel = tran('Letter Spacing');
    const textShadowLabel = tran('Text Shadow');
    const textShadowColorLabel = tran('Text Shadow Color');
    const textStyleLabel = tran('Text Style');
    const openedColorLabel =
        openedColor === 'border'
            ? borderColorLabel
            : openedColor === 'shadow'
              ? shadowColorLabel
              : textShadowColorLabel;
    const openedColorValue: AppColorType =
        openedColor === 'border'
            ? decoration.borderColor
            : openedColor === 'shadow'
              ? decoration.shadowColor
              : decoration.textShadowColor;
    const openedDefaultColor: AppColorType =
        openedColor === 'border'
            ? defaultDecoration.borderColor
            : openedColor === 'shadow'
              ? defaultDecoration.shadowColor
              : defaultDecoration.textShadowColor;
    const handleOpenedColorChange = (color: AppColorType) => {
        if (openedColor === 'border') {
            applyChange({ borderColor: color });
        } else if (openedColor === 'shadow') {
            applyChange({ shadowColor: color });
        } else {
            applyChange({ textShadowColor: color });
        }
    };
    const handleBorderWidthChange = (event: ChangeEvent<HTMLInputElement>) => {
        applyChange({
            borderWidth: Math.max(
                0,
                Math.min(
                    MAX_FOREGROUND_BORDER_WIDTH,
                    Number.parseInt(event.target.value) || 0,
                ),
            ),
        });
    };
    return (
        <div className="fg-props-deco">
            <DecorationToggleComp
                label={label}
                isOpened
                isEngaged={isEngaged}
                onToggle={handleToggle}
            />
            <div className="fg-props-deco-rows">
                {leadingRows}
                <PropRowComp
                    iconClassName="bi bi-bounding-box"
                    label={borderLabel}
                    isEngaged={
                        decoration.borderStyle !== defaultDecoration.borderStyle
                    }
                >
                    <PropOptionsComp
                        label={borderLabel}
                        options={genBorderStyleOptions()}
                        value={decoration.borderStyle}
                        setValue={(borderStyle) => {
                            applyChange({ borderStyle });
                        }}
                    />
                    <input
                        className="fg-num"
                        type="number"
                        min={0}
                        max={MAX_FOREGROUND_BORDER_WIDTH}
                        title={borderWidthLabel}
                        aria-label={borderWidthLabel}
                        value={decoration.borderWidth}
                        disabled={decoration.borderStyle === 'none'}
                        onChange={handleBorderWidthChange}
                    />
                    <span className="fg-unit-static">px</span>
                    <PropSwatchComp
                        label={borderColorLabel}
                        color={decoration.borderColor}
                        isOpened={openedColor === 'border'}
                        onToggle={genColorToggle('border')}
                    />
                </PropRowComp>
                <PropRowComp
                    iconClassName="bi bi-back"
                    label={shadowLabel}
                    isEngaged={
                        decoration.shadow !== defaultDecoration.shadow ||
                        decoration.shadowColor !== defaultDecoration.shadowColor
                    }
                >
                    <PropOptionsComp
                        label={shadowLabel}
                        options={(
                            Object.keys(
                                SHADOW_LABEL_MAP,
                            ) as ForegroundShadowType[]
                        ).map((value) => {
                            return {
                                value,
                                label: tran(SHADOW_LABEL_MAP[value]),
                            };
                        })}
                        value={decoration.shadow}
                        setValue={(shadow) => {
                            applyChange({ shadow });
                        }}
                    />
                    <PropSwatchComp
                        label={shadowColorLabel}
                        color={decoration.shadowColor}
                        isOpened={openedColor === 'shadow'}
                        onToggle={genColorToggle('shadow')}
                    />
                </PropRowComp>
                <PropRowComp
                    iconClassName="bi bi-arrows-angle-expand"
                    label={paddingLabel}
                    title={tran('Space inside the box, in text sizes')}
                    isEngaged={decoration.padding !== defaultDecoration.padding}
                >
                    <AppRangeComp
                        value={decoration.padding}
                        title={paddingLabel}
                        setValue={(padding) => {
                            applyChange({ padding });
                        }}
                        defaultSize={{
                            size: decoration.padding,
                            min: 0,
                            max: MAX_FOREGROUND_PADDING,
                            step: 0.05,
                        }}
                        isShowValue
                        isCompact
                    />
                    <span className="fg-unit-static">em</span>
                </PropRowComp>
                {isText ? (
                    <>
                        <PropRowComp
                            iconClassName="bi bi-text-center"
                            label={alignLabel}
                            isEngaged={
                                decoration.textAlign !==
                                defaultDecoration.textAlign
                            }
                        >
                            <PropOptionsComp
                                label={alignLabel}
                                options={(
                                    Object.keys(
                                        TEXT_ALIGN_LABEL_MAP,
                                    ) as ForegroundTextAlignType[]
                                ).map((value) => {
                                    return {
                                        value,
                                        label: tran(
                                            TEXT_ALIGN_LABEL_MAP[value],
                                        ),
                                        iconClassName:
                                            TEXT_ALIGN_ICON_MAP[value],
                                    };
                                })}
                                value={decoration.textAlign}
                                setValue={(textAlign) => {
                                    applyChange({ textAlign });
                                }}
                            />
                        </PropRowComp>
                        <PropRowComp
                            iconClassName="bi bi-distribute-vertical"
                            label={lineHeightLabel}
                            title={tran('0 keeps the screen line spacing')}
                            isEngaged={decoration.lineHeight > 0}
                        >
                            <AppRangeComp
                                value={decoration.lineHeight}
                                title={lineHeightLabel}
                                setValue={(lineHeight) => {
                                    applyChange({ lineHeight });
                                }}
                                defaultSize={{
                                    size: decoration.lineHeight,
                                    min: 0,
                                    max: MAX_FOREGROUND_LINE_HEIGHT,
                                    step: 0.05,
                                }}
                                isShowValue
                                isCompact
                            />
                        </PropRowComp>
                        <PropRowComp
                            iconClassName="bi bi-distribute-horizontal"
                            label={letterSpacingLabel}
                            isEngaged={decoration.letterSpacing !== 0}
                        >
                            <AppRangeComp
                                value={decoration.letterSpacing}
                                title={letterSpacingLabel}
                                setValue={(letterSpacing) => {
                                    applyChange({ letterSpacing });
                                }}
                                defaultSize={{
                                    size: decoration.letterSpacing,
                                    min: MIN_FOREGROUND_LETTER_SPACING,
                                    max: MAX_FOREGROUND_LETTER_SPACING,
                                    step: 0.01,
                                }}
                                isShowValue
                                isCompact
                            />
                            <span className="fg-unit-static">em</span>
                        </PropRowComp>
                        <PropRowComp
                            iconClassName="bi bi-type"
                            label={textShadowLabel}
                            title={tran(
                                'Makes words readable over a picture or a video',
                            )}
                            isEngaged={decoration.textShadow !== 'none'}
                        >
                            <PropOptionsComp
                                label={textShadowLabel}
                                options={(
                                    Object.keys(
                                        TEXT_SHADOW_LABEL_MAP,
                                    ) as ForegroundTextShadowType[]
                                ).map((value) => {
                                    return {
                                        value,
                                        label: tran(
                                            TEXT_SHADOW_LABEL_MAP[value],
                                        ),
                                    };
                                })}
                                value={decoration.textShadow}
                                setValue={(textShadow) => {
                                    applyChange({ textShadow });
                                }}
                            />
                            <PropSwatchComp
                                label={textShadowColorLabel}
                                color={decoration.textShadowColor}
                                isOpened={openedColor === 'text-shadow'}
                                onToggle={genColorToggle('text-shadow')}
                            />
                        </PropRowComp>
                        <PropRowComp
                            iconClassName="bi bi-fonts"
                            label={textStyleLabel}
                            isEngaged={
                                decoration.isItalic ||
                                decoration.isUnderline ||
                                decoration.isUppercase
                            }
                        >
                            <PropTogglesComp
                                label={textStyleLabel}
                                items={[
                                    {
                                        key: 'italic',
                                        label: tran('Italic'),
                                        iconClassName: 'bi bi-type-italic',
                                        isOn: decoration.isItalic,
                                        onToggle: () => {
                                            applyChange({
                                                isItalic: !decoration.isItalic,
                                            });
                                        },
                                    },
                                    {
                                        key: 'underline',
                                        label: tran('Underline'),
                                        iconClassName: 'bi bi-type-underline',
                                        isOn: decoration.isUnderline,
                                        onToggle: () => {
                                            applyChange({
                                                isUnderline:
                                                    !decoration.isUnderline,
                                            });
                                        },
                                    },
                                    {
                                        key: 'uppercase',
                                        label: tran('Uppercase'),
                                        // No icon set ships one, and `AA` is
                                        // the thing itself rather than a word
                                        // about it -- which is what this row
                                        // needs in a Khmer window.
                                        text: 'AA',
                                        isOn: decoration.isUppercase,
                                        onToggle: () => {
                                            applyChange({
                                                isUppercase:
                                                    !decoration.isUppercase,
                                            });
                                        },
                                    },
                                ]}
                            />
                        </PropRowComp>
                    </>
                ) : null}
                {openedColor === null ? null : (
                    // Spans every column, like the common-style pickers: a
                    // picker squeezed into half a 440px panel puts its
                    // saturation square under its own hue slider.
                    <div
                        className="fg-prop-expand"
                        aria-label={openedColorLabel}
                    >
                        <ColorPickerComp
                            key={openedColor}
                            color={openedColorValue}
                            defaultColor={openedDefaultColor}
                            onNoColor={() => {
                                handleOpenedColorChange(openedDefaultColor);
                            }}
                            onColorChange={handleOpenedColorChange}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function DecorationToggleComp({
    label,
    isOpened,
    isEngaged,
    onToggle,
}: Readonly<{
    label: string;
    isOpened: boolean;
    isEngaged: boolean;
    onToggle: () => void;
}>) {
    return (
        <button
            type="button"
            className={
                'fg-props-toggle fg-deco-toggle' +
                (isOpened ? ' fg-props-toggle-on' : '') +
                (isEngaged ? ' fg-deco-toggle-engaged' : '')
            }
            aria-expanded={isOpened}
            title={label}
            onClick={onToggle}
        >
            <i className="bi bi-magic" />
            <span>{label}</span>
            {isEngaged ? (
                <span className="fg-deco-dot" aria-hidden="true" />
            ) : null}
            <i className="bi bi-chevron-down" />
        </button>
    );
}
