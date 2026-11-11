import { useAppCurrentRef } from '../helper/appHooks';
import ColorModeSwitchComp from '../others/ColorModeSwitchComp';
import PresetsRowComp from '../others/PresetsRowComp';
import {
    type ForegroundColorModeType,
    genForegroundContrastColors,
    toForegroundColorMode,
} from './foregroundContrastHelpers';
import {
    type ForegroundPresetFlagsType,
    type ForegroundPresetType,
    applyForegroundPreset,
    genForegroundPresetColors,
    getForegroundPresetList,
} from './foregroundPresetHelpers';
import {
    type ForegroundSavedPresetType,
    applyForegroundSavedPreset,
    genSavedPresetSettingName,
    readForegroundLookValues,
    toForegroundSavedPreset,
} from './foregroundSavedPresetHelpers';
import { toForegroundPresetLabel } from './foregroundPresetLabelHelpers';
import { notifyForegroundPanel } from './foregroundPanelRevisionHelpers';

export type ForegroundPresetColorsType = {
    color: string;
    backgroundColor: string;
    /** Both written at once, and what is up restyled once. */
    onChange: (colors: { color: string; backgroundColor: string }) => void;
};

/**
 * The first group of a component's Properties block: one press puts a whole
 * look made for one job on the session in front (`foregroundPresetHelpers`),
 * then the looks somebody saved from this block (`foregroundSavedPresetHelpers`)
 * and the button that saves another -- the session's whole Properties as
 * they are, put back exactly when pressed. A saved one's menu (right-click)
 * renames it, replaces it with the look in front, or removes it. The row
 * itself is the app's one Presets row (`PresetsRowComp`).
 *
 * Beside its name, where the component has words and a box, is Dark /
 * Light: the side is read off the words' colour, never stored, and pressing
 * the other one makes the box darker or lighter and the words the other
 * way -- each its own colour still -- until they contrast
 * (`foregroundContrastHelpers`). One of the app's presets goes on in the
 * side the switch is on, so a Light box stays Light from one to the next;
 * the colour on each icon is that side's (a saved one shows its own).
 *
 * After a preset is written, the component's own `onChange` restyles what
 * that session has on a screen -- the same refresh a slider moved by hand
 * runs -- and the panel is mounted again: every field of it reads its
 * setting once, when it mounts, so without that it would show the old values
 * and write them back over the preset the first time a control was touched.
 * The switch needs none of that: it writes through the block's own colour
 * fields.
 */
export default function ForegroundPresetsComp({
    widgetKey,
    prefix,
    flags,
    colors,
    onChange,
    onApplied,
}: Readonly<{
    widgetKey: string;
    prefix: string;
    flags: ForegroundPresetFlagsType;
    /** The block's words' and box's colours; absent for a picture. */
    colors?: ForegroundPresetColorsType;
    onChange: () => void;
    /** Remounts this Properties block when no floating panel is around it. */
    onApplied: () => void;
}>) {
    const presetList = getForegroundPresetList(widgetKey);
    const mode: ForegroundColorModeType | null =
        colors === undefined ? null : toForegroundColorMode(colors.color);
    // A name is asked for in a popup, and what comes back acts on the session
    // as it is THEN, not as it was when it opened.
    const propsRef = useAppCurrentRef({
        widgetKey,
        prefix,
        flags,
        colors,
        onChange,
        onApplied,
        mode,
    });
    if (presetList.length === 0) {
        return null;
    }
    const handleRestyled = () => {
        const current = propsRef.current;
        current.onChange();
        current.onApplied();
        notifyForegroundPanel(current.widgetKey);
    };
    const handleApplying = (preset: ForegroundPresetType) => {
        const current = propsRef.current;
        applyForegroundPreset({
            widgetKey: current.widgetKey,
            prefix: current.prefix,
            flags: current.flags,
            preset,
            mode: current.mode ?? undefined,
        });
        handleRestyled();
    };
    const handleSavedApplying = (preset: ForegroundSavedPresetType) => {
        const current = propsRef.current;
        applyForegroundSavedPreset(current.widgetKey, current.prefix, preset);
        handleRestyled();
    };
    const handleModeChange = (newMode: ForegroundColorModeType) => {
        const current = propsRef.current;
        if (current.colors === undefined) {
            return;
        }
        const next = genForegroundContrastColors(
            {
                color: current.colors.color,
                backgroundColor: current.colors.backgroundColor,
            },
            newMode,
        );
        if (
            next.color === current.colors.color &&
            next.backgroundColor === current.colors.backgroundColor
        ) {
            return;
        }
        current.colors.onChange(next);
    };
    return (
        <PresetsRowComp<ForegroundSavedPresetType>
            savedSettingName={genSavedPresetSettingName(widgetKey)}
            toSavedPreset={toForegroundSavedPreset}
            builtIns={presetList.map((preset) => {
                return {
                    id: preset.id,
                    iconName: preset.iconName,
                    label: toForegroundPresetLabel(preset.id),
                    chipColors:
                        mode === null
                            ? null
                            : genForegroundPresetColors(preset, mode),
                    onPick: () => {
                        handleApplying(preset);
                    },
                };
            })}
            readCurrent={() => {
                const current = propsRef.current;
                return {
                    values: readForegroundLookValues(
                        current.widgetKey,
                        current.prefix,
                    ),
                };
            }}
            onSavedPick={handleSavedApplying}
            genSavedChipColors={(preset) => {
                const color = preset.values['common.color'];
                const backgroundColor = preset.values['common.backgroundColor'];
                return mode !== null &&
                    color !== undefined &&
                    backgroundColor !== undefined
                    ? { color, backgroundColor }
                    : null;
            }}
            headEnd={
                mode === null ? null : (
                    <ColorModeSwitchComp
                        mode={mode}
                        onChange={handleModeChange}
                    />
                )
            }
        />
    );
}
