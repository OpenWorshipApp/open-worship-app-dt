import { type ChangeEvent, useState } from 'react';

import { tran } from '../lang/langHelpers';
import FontFamilyControlComp from '../others/FontFamilyControlComp';
import { getSetting } from '../helper/settingHelpers';
import ColorPickerComp from '../others/color/ColorPicker';
import type { AppColorType } from '../others/color/colorHelpers';
import PropRowComp, { PropSwatchComp } from './ForegroundPropRowComp';
import { getForegroundDefaultColors } from './foregroundThemeColorHelpers';
import {
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_TEXT_COLOR,
    genCommonStyleSettingNames,
} from './foregroundStyleSettingNames';

export const DEFAULT_BACKDROP_FILTER = 5;

// The key names and the two colours' defaults live in a module of their
// own, free of this one's pickers; re-exported here for the callers that
// always found them here.
export {
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_TEXT_COLOR,
    genCommonStyleSettingNames,
};

export function getForegroundCommonProperties(prefix: string) {
    const names = genCommonStyleSettingNames(prefix);
    const backdropFilterSetting =
        getSetting(names.backdropFilter) ?? DEFAULT_BACKDROP_FILTER;
    const color = getSetting(names.color);
    const backgroundColor = getSetting(names.backgroundColor);
    // An unset colour is drawn on the app theme's side; read only then.
    const defaultColors =
        color === null || backgroundColor === null
            ? getForegroundDefaultColors()
            : null;
    return {
        fontFamily: getSetting(names.fontFamily) ?? '',
        fontWeight: getSetting(names.fontWeight) ?? '',
        color: color ?? defaultColors!.color,
        backgroundColor: backgroundColor ?? defaultColors!.backgroundColor,
        backdropFilter: `blur(${backdropFilterSetting}px)`,
    };
}

type OpenedColorType = 'text' | 'background' | null;

/**
 * How the overlay's own text looks, as three rows of the control strip.
 *
 * It was four bordered cards in two fixed columns -- `Font Family` at a
 * 260px minimum, `Backdrop Filter` spending a whole card and its own heading
 * on one number, and two collapsibles that named a colour without ever
 * showing it. About 300px of a floating panel, in a different visual language
 * from the nine rows directly above it.
 *
 * These are rows like any other, so they join the same `auto-fit` grid and
 * pack into its columns. Three changes carry the UX rather than the CSS:
 * the colours share ONE row as two swatches, only one picker opens at a time
 * (two expanded pickers was the old panel's worst height), and the blur is a
 * number with its unit attached instead of a card with a heading.
 */
export default function CommonStyleControlsComp({
    fontFamily,
    setFontFamily,
    fontWeight,
    setFontWeight,
    color,
    setColor,
    backgroundColor,
    setBackgroundColor,
    backdropFilter,
    setBackdropFilter,
}: Readonly<{
    fontFamily: string;
    setFontFamily: (value: string) => void;
    fontWeight: string;
    setFontWeight: (value: string) => void;
    color: AppColorType;
    setColor: (value: AppColorType) => void;
    backgroundColor: AppColorType;
    setBackgroundColor: (value: AppColorType) => void;
    backdropFilter: number;
    setBackdropFilter: (value: number) => void;
}>) {
    const [openedColor, setOpenedColor] = useState<OpenedColorType>(null);
    const handleBackdropFilterChange = (
        event: ChangeEvent<HTMLInputElement>,
    ) => {
        setBackdropFilter(
            Math.max(0, Number.parseInt(event.target.value) || 0),
        );
    };
    const genColorToggle = (which: Exclude<OpenedColorType, null>) => {
        return () => {
            setOpenedColor((old) => {
                return old === which ? null : which;
            });
        };
    };
    const textColorLabel = tran('Text Color');
    const backgroundColorLabel = tran('Background Color');
    const blurLabel = tran('Blur');
    // The app theme's side of the defaults: what "no colour" puts back.
    const defaultColors = getForegroundDefaultColors();
    const defaultTextColor = defaultColors.color as AppColorType;
    const defaultBackgroundColor =
        defaultColors.backgroundColor as AppColorType;
    return (
        <>
            <PropRowComp
                iconClassName="bi bi-fonts"
                label={tran('Font')}
                title={tran('Font Family')}
                isEngaged={fontFamily !== ''}
            >
                <FontFamilyControlComp
                    fontFamily={fontFamily}
                    setFontFamily={setFontFamily}
                    fontWeight={fontWeight}
                    setFontWeight={setFontWeight}
                    isShowingLabel={false}
                />
            </PropRowComp>
            <PropRowComp
                iconClassName="bi bi-droplet-half"
                label={blurLabel}
                title={tran('Backdrop Filter')}
                isEngaged={backdropFilter !== DEFAULT_BACKDROP_FILTER}
            >
                <input
                    className="fg-num"
                    type="number"
                    min={0}
                    aria-label={blurLabel}
                    value={backdropFilter}
                    onChange={handleBackdropFilterChange}
                />
                <span className="fg-unit-static">px</span>
            </PropRowComp>
            <PropRowComp
                iconClassName="bi bi-palette"
                label={tran('Colors')}
                isEngaged={
                    color !== defaultTextColor ||
                    backgroundColor !== defaultBackgroundColor
                }
            >
                <PropSwatchComp
                    label={textColorLabel}
                    color={color}
                    isText
                    isOpened={openedColor === 'text'}
                    onToggle={genColorToggle('text')}
                />
                <PropSwatchComp
                    label={backgroundColorLabel}
                    color={backgroundColor}
                    isOpened={openedColor === 'background'}
                    onToggle={genColorToggle('background')}
                />
            </PropRowComp>
            {openedColor === null ? null : (
                // Spans every column of the grid rather than sitting in the
                // swatch's own cell: a picker squeezed into half a 440px
                // panel puts its saturation square below its own hue slider,
                // which is where the old cards were losing their height.
                <div
                    className="fg-prop-expand"
                    aria-label={
                        openedColor === 'text'
                            ? textColorLabel
                            : backgroundColorLabel
                    }
                >
                    {openedColor === 'text' ? (
                        <ColorPickerComp
                            color={color}
                            defaultColor={defaultTextColor}
                            onNoColor={() => {
                                setColor(defaultTextColor);
                            }}
                            onColorChange={setColor}
                        />
                    ) : (
                        <ColorPickerComp
                            color={backgroundColor}
                            defaultColor={defaultBackgroundColor}
                            onNoColor={() => {
                                setBackgroundColor(defaultBackgroundColor);
                            }}
                            onColorChange={setBackgroundColor}
                        />
                    )}
                </div>
            )}
        </>
    );
}
