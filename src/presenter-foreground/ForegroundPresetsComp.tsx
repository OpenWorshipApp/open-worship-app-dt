import { type MouseEvent, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
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
    MAX_FOREGROUND_SAVED_PRESET_COUNT,
    type ForegroundSavedPresetType,
    addForegroundSavedPreset,
    applyForegroundSavedPreset,
    genForegroundSavedPresetName,
    getForegroundSavedPresets,
    readForegroundLookValues,
    removeForegroundSavedPreset,
    renameForegroundSavedPreset,
    replaceForegroundSavedPreset,
    setForegroundSavedPresets,
} from './foregroundSavedPresetHelpers';
import { toForegroundPresetLabel } from './foregroundPresetLabelHelpers';
import { notifyForegroundPanel } from './foregroundPanelRevisionHelpers';

// The popups and the menu are loaded on a press, not with the panel: every
// open Properties block draws this row, and almost none is ever saved from.
async function askPresetName(title: string, suggestedName: string) {
    const { askPresetName: ask } =
        await import('../popup-widget/presetNameInputHelpers');
    return ask(title, suggestedName);
}

export type ForegroundPresetColorsType = {
    color: string;
    backgroundColor: string;
    /** Both written at once, and what is up restyled once. */
    onChange: (colors: { color: string; backgroundColor: string }) => void;
};

function ColorModeButtonComp({
    isOn,
    iconClassName,
    label,
    title,
    onPick,
}: Readonly<{
    isOn: boolean;
    iconClassName: string;
    label: string;
    title: string;
    onPick: () => void;
}>) {
    return (
        <button
            type="button"
            className={isOn ? 'fg-presets-mode-on' : undefined}
            aria-pressed={isOn}
            title={title}
            onClick={onPick}
        >
            <i className={iconClassName} aria-hidden="true" />
            <span>{label}</span>
        </button>
    );
}

function PresetButtonComp({
    iconName,
    label,
    title,
    chipColors,
    onPick,
    onMenuOpening,
}: Readonly<{
    iconName: string;
    label: string;
    title: string;
    chipColors: { color: string; backgroundColor: string } | null;
    onPick: () => void;
    onMenuOpening?: (event: MouseEvent) => void;
}>) {
    return (
        <button
            type="button"
            className="fg-preset"
            title={title}
            onClick={onPick}
            onContextMenu={onMenuOpening}
        >
            <i
                className={
                    `bi bi-${iconName}` +
                    (chipColors === null ? '' : ' fg-preset-chip')
                }
                style={
                    chipColors === null
                        ? undefined
                        : {
                              color: chipColors.color,
                              background: chipColors.backgroundColor,
                          }
                }
                aria-hidden="true"
            />
            <span>{label}</span>
        </button>
    );
}

/**
 * The first group of a component's Properties block: one press puts a whole
 * look made for one job on the session in front (`foregroundPresetHelpers`),
 * then the looks somebody saved from this block (`foregroundSavedPresetHelpers`)
 * and the button that saves another -- the session's whole Properties as
 * they are, put back exactly when pressed. A saved one's menu (right-click)
 * renames it, replaces it with the look in front, or removes it.
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
    // Read once, when the block mounts: this row is the only writer.
    const [savedPresets, setSavedPresets] = useState(() => {
        return getForegroundSavedPresets(widgetKey);
    });
    const mode: ForegroundColorModeType | null =
        colors === undefined ? null : toForegroundColorMode(colors.color);
    // A name is asked for in a popup, and what comes back acts on the list
    // and the session as they are THEN, not as they were when it opened.
    const propsRef = useAppCurrentRef({
        widgetKey,
        prefix,
        flags,
        colors,
        onChange,
        onApplied,
        mode,
        savedPresets,
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
    const saveSavedPresets = (newPresets: ForegroundSavedPresetType[]) => {
        propsRef.current.savedPresets = newPresets;
        setSavedPresets(newPresets);
        setForegroundSavedPresets(propsRef.current.widgetKey, newPresets);
    };
    const readCurrentValues = () => {
        const current = propsRef.current;
        return readForegroundLookValues(current.widgetKey, current.prefix);
    };
    const groupLabel = tran('Presets');
    const saveLabel = tran('Save as Preset');
    const isFull = savedPresets.length >= MAX_FOREGROUND_SAVED_PRESET_COUNT;
    const handleSaving = async () => {
        const name = await askPresetName(
            saveLabel,
            genForegroundSavedPresetName(
                propsRef.current.savedPresets,
                tran('Preset'),
            ),
        );
        if (name === null) {
            return;
        }
        const newPresets = addForegroundSavedPreset(
            propsRef.current.savedPresets,
            name,
            readCurrentValues(),
        );
        if (newPresets !== null) {
            saveSavedPresets(newPresets);
        }
    };
    const handleMenuOpening = async (
        event: MouseEvent,
        preset: ForegroundSavedPresetType,
    ) => {
        event.preventDefault();
        const nativeEvent = event.nativeEvent;
        const [
            { showAppContextMenu },
            { genContextMenuItemIcon },
            { showAppConfirm },
        ] = await Promise.all([
            import('../context-menu/appContextMenuHelpers'),
            import('../context-menu/contextMenuIconHelpers'),
            import('../popup-widget/popupWidgetHelpers'),
        ]);
        showAppContextMenu(nativeEvent, [
            {
                childBefore: genContextMenuItemIcon('pencil-square'),
                menuElement: tran('Rename Preset'),
                onSelect: async () => {
                    const name = await askPresetName(
                        tran('Rename Preset'),
                        preset.name,
                    );
                    if (name !== null) {
                        saveSavedPresets(
                            renameForegroundSavedPreset(
                                propsRef.current.savedPresets,
                                preset.id,
                                name,
                            ),
                        );
                    }
                },
            },
            {
                childBefore: genContextMenuItemIcon('arrow-repeat'),
                menuElement: tran('Replace with Current Look'),
                onSelect: () => {
                    saveSavedPresets(
                        replaceForegroundSavedPreset(
                            propsRef.current.savedPresets,
                            preset.id,
                            readCurrentValues(),
                        ),
                    );
                },
            },
            {
                childBefore: genContextMenuItemIcon('x-circle'),
                menuElement: tran('Remove Preset'),
                onSelect: async () => {
                    const isOk = await showAppConfirm(
                        tran('Remove Preset'),
                        `${tran('Remove')} "${preset.name}"?`,
                    );
                    if (isOk) {
                        saveSavedPresets(
                            removeForegroundSavedPreset(
                                propsRef.current.savedPresets,
                                preset.id,
                            ),
                        );
                    }
                },
            },
        ]);
    };
    return (
        <div className="fg-presets" role="group" aria-label={groupLabel}>
            <div className="fg-presets-head">
                <span className="fg-group-name">
                    <i className="bi bi-palette" aria-hidden="true" />
                    {groupLabel}
                </span>
                {mode === null ? null : (
                    <div
                        className="fg-presets-mode"
                        role="group"
                        aria-label={tran('Background')}
                    >
                        <ColorModeButtonComp
                            isOn={mode === 'dark'}
                            iconClassName="bi bi-moon-stars-fill"
                            label={tran('Dark')}
                            title={tran('Light words for a dark background')}
                            onPick={() => {
                                handleModeChange('dark');
                            }}
                        />
                        <ColorModeButtonComp
                            isOn={mode === 'light'}
                            iconClassName="bi bi-sun-fill"
                            label={tran('Light')}
                            title={tran('Dark words for a light background')}
                            onPick={() => {
                                handleModeChange('light');
                            }}
                        />
                    </div>
                )}
            </div>
            <div className="fg-presets-list">
                {presetList.map((preset) => {
                    const label = toForegroundPresetLabel(preset.id);
                    return (
                        <PresetButtonComp
                            key={preset.id}
                            iconName={preset.iconName}
                            label={label}
                            title={`${groupLabel}: ${label}`}
                            chipColors={
                                mode === null
                                    ? null
                                    : genForegroundPresetColors(preset, mode)
                            }
                            onPick={() => {
                                handleApplying(preset);
                            }}
                        />
                    );
                })}
                {savedPresets.map((preset) => {
                    const color = preset.values['common.color'];
                    const backgroundColor =
                        preset.values['common.backgroundColor'];
                    return (
                        <PresetButtonComp
                            key={preset.id}
                            iconName="bookmark-star"
                            label={preset.name}
                            title={`${groupLabel}: ${preset.name}`}
                            chipColors={
                                mode !== null &&
                                color !== undefined &&
                                backgroundColor !== undefined
                                    ? { color, backgroundColor }
                                    : null
                            }
                            onPick={() => {
                                handleSavedApplying(preset);
                            }}
                            onMenuOpening={(event) => {
                                handleMenuOpening(event, preset);
                            }}
                        />
                    );
                })}
                <button
                    type="button"
                    className="fg-preset fg-preset-add"
                    title={
                        isFull
                            ? tran('Remove a preset to save a new one')
                            : saveLabel
                    }
                    disabled={isFull}
                    onClick={handleSaving}
                >
                    <i className="bi bi-plus-lg" aria-hidden="true" />
                    <span>{saveLabel}</span>
                </button>
            </div>
        </div>
    );
}
