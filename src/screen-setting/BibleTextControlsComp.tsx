import '../presenter-foreground/foregroundProperties.scss';

import { useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppEffect } from '../helper/appHooks';
import { sanitizeCssValue } from '../helper/sanitizeHelpers';
import type { AnyObjectType } from '../helper/typeHelpers';
import AppRangeComp from '../others/AppRangeComp';
import FontFamilyControlComp from '../others/FontFamilyControlComp';
import ColorPickerComp from '../others/color/ColorPicker';
import {
    HEX_COLOR_WHITE,
    toHexColorString,
    type AppColorType,
} from '../others/color/colorValueHelpers';
import PropRowComp, {
    PropOptionsComp,
    PropSwatchComp,
    PropTogglesComp,
} from '../presenter-foreground/ForegroundPropRowComp';
import {
    DEFAULT_BIBLE_TEXT_LINE_HEIGHT,
    MAX_BIBLE_TEXT_FONT_SIZE,
    MAX_BIBLE_TEXT_GLOW_SIZE,
    MAX_BIBLE_TEXT_LETTER_SPACING,
    MAX_BIBLE_TEXT_LINE_HEIGHT,
    MAX_BIBLE_TEXT_OUTLINE_WIDTH,
    MAX_BIBLE_TEXT_SHADOW_BLUR,
    MAX_BIBLE_TEXT_SHADOW_OFFSET,
    MIN_BIBLE_TEXT_LETTER_SPACING,
    MIN_BIBLE_TEXT_LINE_HEIGHT,
    checkIsBibleTextShadowOn,
    type BibleTextAlignType,
    type BibleTextEffectType,
    type BibleTextStyleViewType,
} from '../_screen/bibleTextStyleHelpers';
import {
    genBibleBackdropPatch,
    genBibleTextEffectPatch,
    genBibleTextResetPatch,
    toBibleBackdrop,
    toBibleTextPanelEffect,
    type BibleBackdropType,
} from './bibleTextLookHelpers';

// Module-level, so a fresh literal per render does not re-run `AppRangeComp`'s
// `[value, defaultSize, fixedSize]` effect on every change elsewhere in the
// panel. `size` is unused by the compact shape; the live value is `value`.
const FONT_SIZE_RANGE = {
    size: 0,
    min: 1,
    max: MAX_BIBLE_TEXT_FONT_SIZE,
    step: 1,
};
const LINE_HEIGHT_RANGE = {
    size: 0,
    min: MIN_BIBLE_TEXT_LINE_HEIGHT,
    max: MAX_BIBLE_TEXT_LINE_HEIGHT,
    step: 0.05,
};
const LETTER_SPACING_RANGE = {
    size: 0,
    min: MIN_BIBLE_TEXT_LETTER_SPACING,
    max: MAX_BIBLE_TEXT_LETTER_SPACING,
    step: 0.005,
};
const OUTLINE_WIDTH_RANGE = {
    size: 0,
    min: 0,
    max: MAX_BIBLE_TEXT_OUTLINE_WIDTH,
    step: 0.005,
};
const SHADOW_OFFSET_RANGE = {
    size: 0,
    min: -MAX_BIBLE_TEXT_SHADOW_OFFSET,
    max: MAX_BIBLE_TEXT_SHADOW_OFFSET,
    step: 0.005,
};
const SHADOW_BLUR_RANGE = {
    size: 0,
    min: 0,
    max: MAX_BIBLE_TEXT_SHADOW_BLUR,
    step: 0.01,
};
const GLOW_SIZE_RANGE = {
    size: 0,
    min: 0,
    max: MAX_BIBLE_TEXT_GLOW_SIZE,
    step: 0.01,
};

// What a layer comes on at when its COLOUR is the first thing chosen: a colour
// picked for an outline of no width would change nothing anyone could see.
const STARTER_OUTLINE_WIDTH = 0.03;
const STARTER_SHADOW = { shadowY: 0.04, shadowBlur: 0.1 };
const STARTER_GLOW_SIZE = 0.2;

type OpenedColorType = 'text' | 'outline' | 'shadow' | 'glow' | null;

function toPickerColor(color: string) {
    return (toHexColorString(color) ?? HEX_COLOR_WHITE) as AppColorType;
}

/**
 * The `text-shadow` itself, to read or to write by hand.
 *
 * It is the one value every control above ends up as, so it doubles as the
 * way in for anything they cannot say -- and as the honest account of a look
 * saved before those controls existed, which no slider describes.
 */
function TextShadowInputComp({
    textShadow,
    label,
    onTextShadowChange,
}: Readonly<{
    textShadow: string;
    label: string;
    onTextShadowChange: (textShadow: string) => void;
}>) {
    const [draft, setDraft] = useState(textShadow);
    useAppEffect(() => {
        setDraft(textShadow);
    }, [textShadow]);
    const applyDraft = () => {
        const typed = draft.trim() || 'none';
        // Refused whole rather than repaired: a value the screen would draw
        // differently from what was typed is worse than the old one.
        if (
            sanitizeCssValue(typed) !== typed ||
            !CSS.supports('text-shadow', typed)
        ) {
            setDraft(textShadow);
            return;
        }
        setDraft(typed);
        if (typed !== textShadow) {
            onTextShadowChange(typed);
        }
    };
    return (
        <input
            type="text"
            className="bible-style-css"
            aria-label={label}
            title={tran('A CSS text-shadow of your own')}
            placeholder="0.03em 0.04em 0.1em #000000"
            value={draft}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
                setDraft(event.currentTarget.value);
            }}
            onBlur={applyDraft}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    applyDraft();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setDraft(textShadow);
                }
            }}
        />
    );
}

function ColorExpandComp({
    label,
    color,
    onColorChange,
    onNoColor,
}: Readonly<{
    label: string;
    color: string;
    onColorChange: (color: string) => void;
    onNoColor?: () => void;
}>) {
    const pickerColor = toPickerColor(color);
    return (
        // Opened under the row it belongs to, across every column: at the
        // end of twelve rows the picker would open out of sight.
        <div className="fg-prop-expand" aria-label={label}>
            <ColorPickerComp
                color={pickerColor}
                defaultColor={pickerColor}
                onColorChange={onColorChange}
                onNoColor={onNoColor}
            />
        </div>
    );
}

/**
 * Every value of the look, one row each: the same control strip the
 * Foreground panel's Effects uses, so an operator who has set a message's
 * shadow already knows how to set a verse's.
 *
 * The outline, shadow and glow rows edit ONE effect, and what they write is
 * the effect and the `text-shadow` it comes out as. A layer that is off comes
 * on in a colour that shows against the words (`toBibleTextPanelEffect`).
 */
export default function BibleTextControlsComp({
    view,
    backdrop,
    applyStyle,
}: Readonly<{
    view: BibleTextStyleViewType;
    backdrop: BibleBackdropType;
    applyStyle: (patch: AnyObjectType) => void;
}>) {
    const [openedColor, setOpenedColor] = useState<OpenedColorType>(null);
    const genColorToggle = (which: Exclude<OpenedColorType, null>) => {
        return () => {
            setOpenedColor((old) => {
                return old === which ? null : which;
            });
        };
    };
    const effect = toBibleTextPanelEffect(view.effect, backdrop);
    const applyEffect = (patch: Partial<BibleTextEffectType>) => {
        applyStyle(genBibleTextEffectPatch({ ...effect, ...patch }));
    };
    const handleTextColorChange = (color: string) => {
        // A colour from the other side of the scale is the other kind of
        // background: the edge crosses over with the words it is edging.
        const newBackdrop = toBibleBackdrop(color);
        applyStyle({
            ...(newBackdrop === backdrop
                ? {}
                : genBibleBackdropPatch(view, newBackdrop)),
            color,
        });
    };
    const isShadowOn = checkIsBibleTextShadowOn(effect);
    const fontFamilyLabel = tran('Font Family');
    const fontSizeLabel = tran('Font Size');
    const textColorLabel = tran('Text Color');
    const textStyleLabel = tran('Text Style');
    const alignLabel = tran('Text Align');
    const lineHeightLabel = tran('Line Height');
    const letterSpacingLabel = tran('Letter Spacing');
    const outlineLabel = tran('Outline');
    const outlineColorLabel = tran('Outline Color');
    const shadowBlurLabel = tran('Shadow Blur');
    const shadowColorLabel = tran('Shadow Color');
    const shadowOffsetXLabel = tran('Shadow Offset X');
    const shadowOffsetYLabel = tran('Shadow Offset Y');
    const glowLabel = tran('Glow');
    const glowColorLabel = tran('Glow Color');
    const textShadowLabel = tran('Text Shadow');
    return (
        <>
            <div className="bible-style-rows">
                <PropRowComp
                    iconClassName="bi bi-alphabet-uppercase"
                    label={fontFamilyLabel}
                    isEngaged={view.fontFamily !== ''}
                >
                    {/* No weight beside it: Bold on the next row is the
                        weight here, and two controls would be answering it. */}
                    <FontFamilyControlComp
                        fontFamily={view.fontFamily}
                        setFontFamily={(fontFamily) => {
                            applyStyle({
                                fontFamily: fontFamily || undefined,
                            });
                        }}
                    />
                </PropRowComp>
                <PropRowComp iconClassName="bi bi-fonts" label={fontSizeLabel}>
                    <AppRangeComp
                        value={view.fontSize}
                        title={fontSizeLabel}
                        setValue={(fontSize) => {
                            applyStyle({ fontSize });
                        }}
                        defaultSize={FONT_SIZE_RANGE}
                        isShowValue
                        isCompact
                    />
                    <span className="fg-unit-static">px</span>
                </PropRowComp>
                <PropRowComp
                    iconClassName="bi bi-type"
                    label={textStyleLabel}
                    isEngaged={view.isBold || view.isItalic}
                >
                    <PropTogglesComp
                        label={textStyleLabel}
                        items={[
                            {
                                key: 'bold',
                                label: tran('Bold'),
                                iconClassName: 'bi bi-type-bold',
                                isOn: view.isBold,
                                onToggle: () => {
                                    applyStyle({ isBold: !view.isBold });
                                },
                            },
                            {
                                key: 'italic',
                                label: tran('Italic'),
                                iconClassName: 'bi bi-type-italic',
                                isOn: view.isItalic,
                                onToggle: () => {
                                    applyStyle({ isItalic: !view.isItalic });
                                },
                            },
                        ]}
                    />
                </PropRowComp>
                {/* After Text Style, so it still ends its line where the
                    panel is two columns wide and the picker opens under it
                    with no empty cell beside the swatch. */}
                <PropRowComp
                    iconClassName="bi bi-palette"
                    label={textColorLabel}
                >
                    <PropSwatchComp
                        label={textColorLabel}
                        color={view.color}
                        isOpened={openedColor === 'text'}
                        isText
                        onToggle={genColorToggle('text')}
                    />
                </PropRowComp>
                {openedColor === 'text' ? (
                    <ColorExpandComp
                        label={textColorLabel}
                        color={view.color}
                        onColorChange={handleTextColorChange}
                    />
                ) : null}
                <PropRowComp
                    iconClassName="bi bi-text-center"
                    label={alignLabel}
                    isEngaged={view.textAlign !== 'start'}
                >
                    <PropOptionsComp<BibleTextAlignType>
                        label={alignLabel}
                        options={[
                            {
                                value: 'start',
                                label: tran('Align left'),
                                iconClassName: 'bi bi-text-left',
                            },
                            {
                                value: 'center',
                                label: tran('Align center'),
                                iconClassName: 'bi bi-text-center',
                            },
                            {
                                value: 'end',
                                label: tran('Align right'),
                                iconClassName: 'bi bi-text-right',
                            },
                            {
                                value: 'justify',
                                label: tran('Justify'),
                                iconClassName: 'bi bi-justify',
                            },
                        ]}
                        value={view.textAlign}
                        setValue={(textAlign) => {
                            applyStyle({ textAlign });
                        }}
                    />
                </PropRowComp>
                <PropRowComp
                    iconClassName="bi bi-distribute-vertical"
                    label={lineHeightLabel}
                    isEngaged={
                        view.lineHeight !== DEFAULT_BIBLE_TEXT_LINE_HEIGHT
                    }
                >
                    <AppRangeComp
                        value={view.lineHeight}
                        title={lineHeightLabel}
                        setValue={(lineHeight) => {
                            applyStyle({ lineHeight });
                        }}
                        defaultSize={LINE_HEIGHT_RANGE}
                        isShowValue
                        isCompact
                    />
                </PropRowComp>
                <PropRowComp
                    iconClassName="bi bi-distribute-horizontal"
                    label={letterSpacingLabel}
                    isEngaged={view.letterSpacing !== 0}
                >
                    <AppRangeComp
                        value={view.letterSpacing}
                        title={letterSpacingLabel}
                        setValue={(letterSpacing) => {
                            applyStyle({ letterSpacing });
                        }}
                        defaultSize={LETTER_SPACING_RANGE}
                        isShowValue
                        isCompact
                    />
                    <span className="fg-unit-static">em</span>
                </PropRowComp>
            </div>
            <div className="bible-style-rows">
                <PropRowComp
                    iconClassName="bi bi-bounding-box"
                    label={outlineLabel}
                    isEngaged={effect.outlineWidth > 0}
                >
                    <AppRangeComp
                        value={effect.outlineWidth}
                        title={outlineLabel}
                        setValue={(outlineWidth) => {
                            applyEffect({ outlineWidth });
                        }}
                        defaultSize={OUTLINE_WIDTH_RANGE}
                        isShowValue
                        isCompact
                    />
                    <span className="fg-unit-static">em</span>
                    <PropSwatchComp
                        label={outlineColorLabel}
                        color={effect.outlineColor}
                        isOpened={openedColor === 'outline'}
                        onToggle={genColorToggle('outline')}
                    />
                </PropRowComp>
                {openedColor === 'outline' ? (
                    <ColorExpandComp
                        label={outlineColorLabel}
                        color={effect.outlineColor}
                        onColorChange={(outlineColor) => {
                            applyEffect({
                                outlineColor,
                                outlineWidth:
                                    effect.outlineWidth ||
                                    STARTER_OUTLINE_WIDTH,
                            });
                        }}
                        onNoColor={() => {
                            applyEffect({ outlineWidth: 0 });
                        }}
                    />
                ) : null}
                <PropRowComp
                    iconClassName="bi bi-back"
                    label={shadowBlurLabel}
                    isEngaged={isShadowOn}
                >
                    <AppRangeComp
                        value={effect.shadowBlur}
                        title={shadowBlurLabel}
                        setValue={(shadowBlur) => {
                            applyEffect({ shadowBlur });
                        }}
                        defaultSize={SHADOW_BLUR_RANGE}
                        isShowValue
                        isCompact
                    />
                    <span className="fg-unit-static">em</span>
                    <PropSwatchComp
                        label={shadowColorLabel}
                        color={effect.shadowColor}
                        isOpened={openedColor === 'shadow'}
                        onToggle={genColorToggle('shadow')}
                    />
                </PropRowComp>
                {openedColor === 'shadow' ? (
                    <ColorExpandComp
                        label={shadowColorLabel}
                        color={effect.shadowColor}
                        onColorChange={(shadowColor) => {
                            applyEffect({
                                ...(isShadowOn ? {} : STARTER_SHADOW),
                                shadowColor,
                            });
                        }}
                        onNoColor={() => {
                            applyEffect({
                                shadowX: 0,
                                shadowY: 0,
                                shadowBlur: 0,
                            });
                        }}
                    />
                ) : null}
                <PropRowComp
                    iconClassName="bi bi-arrow-left-right"
                    label={shadowOffsetXLabel}
                    isEngaged={effect.shadowX !== 0}
                >
                    <AppRangeComp
                        value={effect.shadowX}
                        title={shadowOffsetXLabel}
                        setValue={(shadowX) => {
                            applyEffect({ shadowX });
                        }}
                        defaultSize={SHADOW_OFFSET_RANGE}
                        isShowValue
                        isCompact
                    />
                    <span className="fg-unit-static">em</span>
                </PropRowComp>
                <PropRowComp
                    iconClassName="bi bi-arrow-down-up"
                    label={shadowOffsetYLabel}
                    isEngaged={effect.shadowY !== 0}
                >
                    <AppRangeComp
                        value={effect.shadowY}
                        title={shadowOffsetYLabel}
                        setValue={(shadowY) => {
                            applyEffect({ shadowY });
                        }}
                        defaultSize={SHADOW_OFFSET_RANGE}
                        isShowValue
                        isCompact
                    />
                    <span className="fg-unit-static">em</span>
                </PropRowComp>
                <PropRowComp
                    iconClassName="bi bi-brightness-high"
                    label={glowLabel}
                    isEngaged={effect.glowSize > 0}
                >
                    <AppRangeComp
                        value={effect.glowSize}
                        title={glowLabel}
                        setValue={(glowSize) => {
                            applyEffect({ glowSize });
                        }}
                        defaultSize={GLOW_SIZE_RANGE}
                        isShowValue
                        isCompact
                    />
                    <span className="fg-unit-static">em</span>
                    <PropSwatchComp
                        label={glowColorLabel}
                        color={effect.glowColor}
                        isOpened={openedColor === 'glow'}
                        onToggle={genColorToggle('glow')}
                    />
                </PropRowComp>
                {openedColor === 'glow' ? (
                    <ColorExpandComp
                        label={glowColorLabel}
                        color={effect.glowColor}
                        onColorChange={(glowColor) => {
                            applyEffect({
                                glowColor,
                                glowSize: effect.glowSize || STARTER_GLOW_SIZE,
                            });
                        }}
                        onNoColor={() => {
                            applyEffect({ glowSize: 0 });
                        }}
                    />
                ) : null}
                <PropRowComp
                    iconClassName="bi bi-code-slash"
                    label={textShadowLabel}
                    // Lit only for CSS no control above made.
                    isEngaged={view.effect === null}
                >
                    <TextShadowInputComp
                        textShadow={view.textShadow}
                        label={textShadowLabel}
                        onTextShadowChange={(textShadow) => {
                            applyStyle({ textShadow, effect: undefined });
                        }}
                    />
                </PropRowComp>
            </div>
            <div className="bible-style-foot">
                <button
                    type="button"
                    className="bible-style-reset"
                    title={tran('Plain words again; the size stays')}
                    onClick={() => {
                        setOpenedColor(null);
                        applyStyle(genBibleTextResetPatch(backdrop));
                    }}
                >
                    <i
                        className="bi bi-arrow-counterclockwise"
                        aria-hidden="true"
                    />
                    <span>{tran('Reset')}</span>
                </button>
            </div>
        </>
    );
}
