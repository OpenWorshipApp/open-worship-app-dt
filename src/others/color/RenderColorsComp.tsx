import { useCallback, useState } from 'react';

import type { AppColorType } from './colorHelpers';
import { compareColor } from './colorHelpers';
import SelectCustomColorComp from './SelectCustomColorComp';
import RenderColorComp from './RenderColorComp';
import RenderNoColorComp from './RenderNoColorComp';
import ColorModeSwitchComp from '../ColorModeSwitchComp';
import type { ColorModeType } from './colorContrastHelpers';
import {
    COLOR_TONE_MAP,
    findColorTone,
    toInitialColorTone,
} from './colorToneHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';
import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';
import { copyToClipboard } from '../../server/appHelpers';
import { tran } from '../../lang/langHelpers';

// The held color's code, written out where it can be read and pressed to copy:
// before, it was only in a right-click menu, and with the open picker showing
// nothing but swatches, nobody could tell which code they had picked.
function CopyColorCodeComp({ color }: Readonly<{ color: AppColorType }>) {
    const label = `${tran('Copy Color')}: ${color}`;
    return (
        <button
            type="button"
            className="btn btn-sm btn-outline-secondary color-picker-code"
            title={label}
            aria-label={label}
            onClick={() => {
                copyToClipboard(color, tran('Copy Color'));
            }}
        >
            <i className="bi bi-clipboard" />
            <span className="font-monospace">{color}</span>
        </button>
    );
}

/**
 * The Dark / Light tones under the basic swatches: which side shows is the
 * picker's own, opened on the held colour's side (`toInitialColorTone`) and
 * moved to the other only when the held colour becomes one of ITS tones --
 * a press on the switch is never undone by the next re-render. A picker
 * that is part of a bigger one (the Background panel's Fills) is handed the
 * side instead, and the owner draws the one switch for everything it lists.
 */
function RenderColorTonesComp({
    selectedColor,
    onColorChange,
    tone: givenTone,
}: Readonly<{
    selectedColor: AppColorType | null | undefined;
    onColorChange: (event: any, color: AppColorType) => void;
    tone?: ColorModeType;
}>) {
    const [ownTone, setOwnTone] = useState<ColorModeType>(() => {
        return toInitialColorTone(selectedColor);
    });
    const heldTone = findColorTone(selectedColor);
    useAppEffect(() => {
        if (heldTone !== null) {
            setOwnTone(heldTone);
        }
    }, [heldTone]);
    const tone = givenTone ?? ownTone;
    return (
        <div className="color-picker-tones">
            {givenTone === undefined ? (
                <ColorModeSwitchComp
                    mode={tone}
                    onChange={setOwnTone}
                    groupLabel={tran('Colors')}
                    darkTitle={tran('Dark')}
                    lightTitle={tran('Light')}
                />
            ) : null}
            <div className="color-picker-grid">
                {COLOR_TONE_MAP[tone].map((color) => {
                    return (
                        <RenderColorComp
                            key={color}
                            name={color}
                            color={color}
                            isSelected={
                                !!selectedColor &&
                                compareColor(selectedColor, color)
                            }
                            onClick={onColorChange}
                        />
                    );
                })}
            </div>
        </div>
    );
}

export default function RenderColorsComp({
    colors,
    selectedColor,
    onColorChange,
    isNoImmediate = false,
    canNoColor = true,
    tone,
    isOtherValueHeld = false,
}: Readonly<{
    colors: AnyObjectType;
    selectedColor: AppColorType | null | undefined;
    onColorChange: (color: AppColorType | null, event: MouseEvent) => void;
    isNoImmediate?: boolean;
    /** The side of the tones, when the picker's owner keeps the switch. */
    tone?: ColorModeType;
    /**
     * Something that is not a colour is held (a gradient on a screen): no
     * swatch is lit, and neither is No Color, which would say nothing is.
     */
    isOtherValueHeld?: boolean;
    // Whether this picker can actually clear. A picker with nothing to clear
    // -- the Background Colors tab before any screen has a colour -- used to
    // draw the red "x" tile anyway, fully enabled-looking, wired to a handler
    // its owner never supplied: pressing it did nothing at all. An offered
    // control that cannot act is worse than no control.
    canNoColor?: boolean;
}>) {
    const onColorChangeRef = useAppCurrentRef(onColorChange);
    const handleNoColoring = useCallback((event: any) => {
        onColorChangeRef.current(null, event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleColorChanging = useCallback(
        (event: any, color: AppColorType) => {
            onColorChangeRef.current(color, event);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleColorSelecting = useCallback(
        (color: AppColorType, event: any) => {
            onColorChangeRef.current(color, event);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // The basic swatches are eight to a row, and No Color -- when the
    // picker can clear -- a tall tile in a column of its own before them,
    // which the tones below leave empty so their columns line up.
    return (
        <div
            className={
                'color-picker-palette' + (canNoColor ? ' has-no-color' : '')
            }
        >
            <div className="color-picker-grid color-picker-main">
                {canNoColor ? (
                    <RenderNoColorComp
                        isSelected={!selectedColor && !isOtherValueHeld}
                        onClick={handleNoColoring}
                    />
                ) : null}
                {Object.entries(colors).map(
                    ([name, color]: [string, AppColorType]) => {
                        return (
                            <RenderColorComp
                                key={color}
                                name={name}
                                color={color}
                                isSelected={
                                    !!selectedColor &&
                                    compareColor(selectedColor, color)
                                }
                                onClick={handleColorChanging}
                            />
                        );
                    },
                )}
            </div>
            <RenderColorTonesComp
                selectedColor={selectedColor}
                onColorChange={handleColorChanging}
                tone={tone}
            />
            <div className="color-picker-mix-row">
                <SelectCustomColorComp
                    color={selectedColor}
                    onColorSelected={handleColorSelecting}
                    isNoImmediate={isNoImmediate}
                />
                {selectedColor ? (
                    <CopyColorCodeComp color={selectedColor} />
                ) : null}
            </div>
        </div>
    );
}
