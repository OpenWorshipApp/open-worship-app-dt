import './foregroundProperties.scss';

import { type ChangeEvent, useState } from 'react';

import type {
    LongTextColumnStyleType,
    LongTextTextAlignType,
} from '../_screen/screenLongTextTypeHelpers';
import {
    MAX_LONG_TEXT_FONT_SIZE_SCALE,
    MIN_LONG_TEXT_FONT_SIZE_SCALE,
    readLongTextColumnStyle,
} from '../_screen/screenLongTextTypeHelpers';
import { tran } from '../lang/langHelpers';
import FontFamilyControlComp from '../others/FontFamilyControlComp';
import ColorPickerComp from '../others/color/ColorPicker';
import type { AppColorType } from '../others/color/colorValueHelpers';
import PropRowComp, {
    PropChipsComp,
    PropOptionsComp,
    PropSwatchComp,
} from './ForegroundPropRowComp';

type AlignChoiceType = 'default' | LongTextTextAlignType;

const SIZE_PERCENT_PRESET_LIST = [60, 80, 100, 120, 150] as const;
const MIN_SIZE_PERCENT = MIN_LONG_TEXT_FONT_SIZE_SCALE * 100;
const MAX_SIZE_PERCENT = MAX_LONG_TEXT_FONT_SIZE_SCALE * 100;

/**
 * ONE language's own look: its font, its colour, its size beside the others
 * and which side it is set to. Everything it leaves alone stays the screen's
 * own Bible text style, which is what the whole text is drawn in.
 *
 * Mounted only while its card's Properties are open: the font list behind the
 * picker is asked of the system (a PowerShell start on Windows) the first
 * time one is drawn, and a panel of four languages must not pay that to be
 * opened.
 */
export default function ForegroundLongTextStyleComp({
    style,
    screenColor,
    onChange,
}: Readonly<{
    style: LongTextColumnStyleType | undefined;
    // The colour the screen's text is in, shown while the column has none.
    screenColor: string;
    onChange: (style: LongTextColumnStyleType | undefined) => void;
}>) {
    const [isColorOpened, setIsColorOpened] = useState(false);
    const sizePercent = Math.round((style?.fontSizeScale ?? 1) * 100);
    // What is being typed, which is not a size until it is one: `8` on the
    // way to `80` is below the smallest, and clamping it at once would turn
    // the box into `50` under the second digit.
    const [sizeText, setSizeText] = useState<string | null>(null);
    // The one way a change leaves: through the same reader the screen uses,
    // so a key at its default is dropped and none ever holds `undefined`.
    const applyPatch = (patch: { [key: string]: unknown }) => {
        onChange(readLongTextColumnStyle({ ...style, ...patch }));
    };
    const applySizePercent = (percent: number) => {
        applyPatch({ fontSizeScale: percent / 100 });
    };
    const handleSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
        const text = event.target.value;
        setSizeText(text);
        const percent = Number.parseInt(text, 10);
        if (percent >= MIN_SIZE_PERCENT && percent <= MAX_SIZE_PERCENT) {
            applySizePercent(percent);
        }
    };
    const fontLabel = tran('Font Family');
    const colorLabel = tran('Text Color');
    const sizeLabel = tran('Text Size (%)');
    const alignLabel = tran('Text Align');
    const color = (style?.color ?? screenColor) as AppColorType;
    return (
        <div className="fg-props-tail fg-props-tail-plain">
            <PropRowComp
                iconClassName="bi bi-fonts"
                label={tran('Font')}
                title={fontLabel}
                isEngaged={style?.fontFamily !== undefined}
            >
                <FontFamilyControlComp
                    fontFamily={style?.fontFamily ?? ''}
                    setFontFamily={(fontFamily) => {
                        // Another family's weights are not this one's.
                        applyPatch({ fontFamily, fontWeight: '' });
                    }}
                    fontWeight={style?.fontWeight ?? ''}
                    setFontWeight={(fontWeight) => {
                        applyPatch({ fontWeight });
                    }}
                    isShowingLabel={false}
                />
            </PropRowComp>
            <PropRowComp
                iconClassName="bi bi-palette"
                label={colorLabel}
                isEngaged={style?.color !== undefined}
            >
                <PropSwatchComp
                    label={colorLabel}
                    color={color}
                    isText
                    isOpened={isColorOpened}
                    onToggle={() => {
                        setIsColorOpened((old) => {
                            return !old;
                        });
                    }}
                />
            </PropRowComp>
            {isColorOpened ? (
                <div className="fg-prop-expand" aria-label={colorLabel}>
                    <ColorPickerComp
                        color={color}
                        defaultColor={screenColor as AppColorType}
                        // "No colour" is the screen's own again, not black.
                        onNoColor={() => {
                            applyPatch({ color: '' });
                        }}
                        onColorChange={(newColor) => {
                            applyPatch({ color: newColor });
                        }}
                    />
                </div>
            ) : null}
            <PropRowComp
                iconClassName="bi bi-type"
                label={sizeLabel}
                isEngaged={style?.fontSizeScale !== undefined}
            >
                <PropChipsComp
                    label={sizeLabel}
                    values={SIZE_PERCENT_PRESET_LIST}
                    value={sizePercent}
                    setValue={(percent) => {
                        setSizeText(null);
                        applySizePercent(percent);
                    }}
                />
                <input
                    className="fg-num ms-2"
                    type="number"
                    min={MIN_SIZE_PERCENT}
                    max={MAX_SIZE_PERCENT}
                    aria-label={sizeLabel}
                    title={sizeLabel}
                    value={sizeText ?? sizePercent}
                    onChange={handleSizeChange}
                    onBlur={() => {
                        setSizeText(null);
                    }}
                />
                <span className="fg-unit-static">%</span>
            </PropRowComp>
            <PropRowComp
                iconClassName="bi bi-justify"
                label={alignLabel}
                isEngaged={style?.textAlign !== undefined}
            >
                <PropOptionsComp<AlignChoiceType>
                    label={alignLabel}
                    options={[
                        // The screen's own: Bible Properties, or the side
                        // the language is read from.
                        { value: 'default', label: tran('Default') },
                        {
                            value: 'left',
                            label: tran('Align left'),
                            iconClassName: 'bi bi-text-left',
                        },
                        {
                            value: 'center',
                            label: tran('Align center'),
                            iconClassName: 'bi bi-text-center',
                        },
                        {
                            value: 'right',
                            label: tran('Align right'),
                            iconClassName: 'bi bi-text-right',
                        },
                    ]}
                    value={style?.textAlign ?? 'default'}
                    setValue={(textAlign) => {
                        applyPatch({
                            textAlign: textAlign === 'default' ? '' : textAlign,
                        });
                    }}
                />
            </PropRowComp>
        </div>
    );
}
