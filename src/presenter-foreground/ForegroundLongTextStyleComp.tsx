import './foregroundProperties.scss';

import { type ChangeEvent, useState } from 'react';

import type { LongTextColumnStyleType } from '../_screen/screenLongTextTypeHelpers';
import {
    MAX_LONG_TEXT_FONT_SIZE_SCALE,
    MIN_LONG_TEXT_FONT_SIZE_SCALE,
    readLongTextColumnStyle,
} from '../_screen/screenLongTextTypeHelpers';
import { tran } from '../lang/langHelpers';
import FontFamilyControlComp from '../others/FontFamilyControlComp';
import PropRowComp, { PropChipsComp } from './ForegroundPropRowComp';

const SIZE_PERCENT_PRESET_LIST = [60, 80, 100, 120, 150] as const;
const MIN_SIZE_PERCENT = MIN_LONG_TEXT_FONT_SIZE_SCALE * 100;
const MAX_SIZE_PERCENT = MAX_LONG_TEXT_FONT_SIZE_SCALE * 100;

/**
 * ONE language's own font and its size beside the others -- the two things a
 * language may need of its own, since two faces at the same size are not the
 * same size on the wall. Both are unset until chosen here, and unset they
 * follow the screen's: everything else (colour, weight, alignment, shadow, the
 * selection band) is Bible/LongText Properties', for every language at once
 * (its button is at the top of the panel, beside Add Language).
 *
 * Mounted only while its card's Properties are open: the font list behind the
 * picker is asked of the system (a PowerShell start on Windows) the first
 * time one is drawn, and a panel of four languages must not pay that to be
 * opened.
 */
export default function ForegroundLongTextStyleComp({
    style,
    onChange,
}: Readonly<{
    style: LongTextColumnStyleType | undefined;
    onChange: (style: LongTextColumnStyleType | undefined) => void;
}>) {
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
    const sizeLabel = tran('Text Size (%)');
    return (
        <div className="fg-props-tail fg-props-tail-plain">
            <PropRowComp
                iconClassName="bi bi-fonts"
                label={tran('Font')}
                title={fontLabel}
                isEngaged={style?.fontFamily !== undefined}
            >
                {/* The family alone: a weight here would stand against Bold
                    in Bible/LongText Properties. `--` is the screen's own. */}
                <FontFamilyControlComp
                    fontFamily={style?.fontFamily ?? ''}
                    setFontFamily={(fontFamily) => {
                        applyPatch({ fontFamily });
                    }}
                    isShowingLabel={false}
                />
            </PropRowComp>
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
        </div>
    );
}
