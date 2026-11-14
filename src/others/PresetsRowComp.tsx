import './PresetsRowComp.scss';

// React's own hooks, not `appHooks`: this row sits inside a dozen panels in
// several windows, and a leaf they all share should not bring the app's hook
// module (which reads `appProvider` when it loads) along with it.
import {
    type MouseEvent,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from 'react';

import { tran } from '../lang/langHelpers';
import {
    mutateSavedPresets,
    readSavedPresets,
    subscribeSavedPresets,
} from './savedPresetHelpers';
import {
    MAX_SAVED_PRESET_COUNT,
    type SavedPresetBaseType,
    addSavedPreset,
    genSavedPresetName,
    removeSavedPreset,
    renameSavedPreset,
    replaceSavedPreset,
} from './savedPresetListHelpers';

// The popups and the menu are loaded on a press, not with the row: every
// open panel that keeps looks draws this row, and almost none is ever saved
// from.
async function askPresetName(title: string, suggestedName: string) {
    const { askPresetName: ask } =
        await import('../popup-widget/presetNameInputHelpers');
    return ask(title, suggestedName);
}

export type PresetChipColorsType = { color: string; backgroundColor: string };

/** One of the app's own looks: pressed, the panel puts it on. */
export type PresetsRowBuiltInType = {
    id: string;
    iconName: string;
    /** Already translated: the panel says what its looks are called. */
    label: string;
    /** Its words and box on the side the switch is on; null for none. */
    chipColors?: PresetChipColorsType | null;
    onPick: () => void;
};

function PresetButtonComp({
    iconName,
    label,
    title,
    chipColors,
    onPick,
    onMenuOpening,
    onButtonMouseDown,
}: Readonly<{
    iconName: string;
    label: string;
    title: string;
    chipColors: PresetChipColorsType | null;
    onPick: () => void;
    onMenuOpening?: (event: MouseEvent) => void;
    onButtonMouseDown?: (event: MouseEvent) => void;
}>) {
    return (
        <button
            type="button"
            className="app-preset"
            title={title}
            onMouseDown={onButtonMouseDown}
            onClick={onPick}
            onContextMenu={onMenuOpening}
        >
            <i
                className={
                    `bi bi-${iconName}` +
                    (chipColors === null ? '' : ' app-preset-chip')
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
 * A panel's Presets (2026-11-10, the user: _like foreground preset I want
 * setting everywhere provide preset_): the app's own looks, one press each,
 * then the looks somebody saved from a panel of this kind and the button that
 * saves another -- the panel's look as it is, put back exactly when pressed.
 * A saved one's menu (right-click) renames it, replaces it with the look in
 * front, or removes it.
 *
 * What a look IS stays the panel's: `readCurrent` says what Save keeps,
 * `onSavedPick` puts a saved one back, `toSavedPreset` checks one read off
 * disk. The list -- names, ids, the limit of 30 -- is `savedPresetListHelpers`'
 * and the setting it is kept in `savedPresetHelpers`', re-read before every
 * change, so two rows over one list (two selected slide boxes, two Mini
 * Screens) never write over each other; a change in one shows in the others.
 * A parent that points this row at another list remounts it (`key`).
 */
export default function PresetsRowComp<T extends SavedPresetBaseType>({
    savedSettingName,
    toSavedPreset,
    builtIns,
    readCurrent,
    onSavedPick,
    filterSaved,
    genSavedChipColors,
    headEnd,
    isCompact = false,
    onButtonMouseDown,
}: Readonly<{
    savedSettingName: string;
    toSavedPreset: (
        item: Record<string, unknown>,
        base: SavedPresetBaseType,
    ) => T | null;
    builtIns: PresetsRowBuiltInType[];
    /** What Save keeps: the look in front, read when the name is given. */
    readCurrent: () => Omit<T, 'id' | 'name'>;
    onSavedPick: (preset: T) => void;
    /** Which saved looks this panel can wear; all of them when absent. */
    filterSaved?: (preset: T) => boolean;
    genSavedChipColors?: (preset: T) => PresetChipColorsType | null;
    /** At the right of the name: Dark / Light, where the panel has one. */
    headEnd?: ReactNode;
    /** The name on the same line as the buttons, for a strip of tools. */
    isCompact?: boolean;
    /** A strip whose canvas keeps the keyboard passes its focus keeper. */
    onButtonMouseDown?: (event: MouseEvent) => void;
}>) {
    // Read once, when the row mounts; after that every write in this window
    // hands the new list to every row over it.
    const [savedPresets, setSavedPresets] = useState(() => {
        return readSavedPresets(savedSettingName, toSavedPreset);
    });
    useEffect(() => {
        return subscribeSavedPresets(savedSettingName, (presets) => {
            setSavedPresets(presets as T[]);
        });
    }, [savedSettingName]);
    // A name is asked for in a popup, and what comes back acts on the list
    // and the look as they are THEN, not as they were when it opened.
    const currentProps = {
        savedSettingName,
        toSavedPreset,
        readCurrent,
        onSavedPick,
    };
    const propsRef = useRef(currentProps);
    propsRef.current = currentProps;
    const mutate = (change: (presets: T[]) => T[] | null) => {
        const current = propsRef.current;
        mutateSavedPresets(
            current.savedSettingName,
            current.toSavedPreset,
            change,
        );
    };
    const groupLabel = tran('Presets');
    const saveLabel = tran('Save as Preset');
    const isFull = savedPresets.length >= MAX_SAVED_PRESET_COUNT;
    const handleSaving = async () => {
        const current = propsRef.current;
        const name = await askPresetName(
            saveLabel,
            genSavedPresetName(
                readSavedPresets(
                    current.savedSettingName,
                    current.toSavedPreset,
                ),
                tran('Preset'),
            ),
        );
        if (name === null) {
            return;
        }
        mutate((presets) => {
            return addSavedPreset(
                presets,
                name,
                propsRef.current.readCurrent(),
            );
        });
    };
    const handleMenuOpening = async (event: MouseEvent, preset: T) => {
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
                        mutate((presets) => {
                            return renameSavedPreset(presets, preset.id, name);
                        });
                    }
                },
            },
            {
                childBefore: genContextMenuItemIcon('arrow-repeat'),
                menuElement: tran('Replace with Current Look'),
                onSelect: () => {
                    mutate((presets) => {
                        return replaceSavedPreset(
                            presets,
                            preset.id,
                            propsRef.current.readCurrent(),
                        );
                    });
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
                        mutate((presets) => {
                            return removeSavedPreset(presets, preset.id);
                        });
                    }
                },
            },
        ]);
    };
    const visibleSavedPresets =
        filterSaved === undefined
            ? savedPresets
            : savedPresets.filter(filterSaved);
    return (
        <div
            className={
                'app-presets' + (isCompact ? ' app-presets-compact' : '')
            }
            role="group"
            aria-label={groupLabel}
        >
            <div className="app-presets-head">
                <span className="app-presets-name">
                    <i className="bi bi-palette" aria-hidden="true" />
                    {groupLabel}
                </span>
                {headEnd}
            </div>
            <div className="app-presets-list">
                {builtIns.map((preset) => {
                    return (
                        <PresetButtonComp
                            key={preset.id}
                            iconName={preset.iconName}
                            label={preset.label}
                            title={`${groupLabel}: ${preset.label}`}
                            chipColors={preset.chipColors ?? null}
                            onPick={preset.onPick}
                            onButtonMouseDown={onButtonMouseDown}
                        />
                    );
                })}
                {visibleSavedPresets.map((preset) => {
                    return (
                        <PresetButtonComp
                            key={preset.id}
                            iconName="bookmark-star"
                            label={preset.name}
                            title={`${groupLabel}: ${preset.name}`}
                            chipColors={genSavedChipColors?.(preset) ?? null}
                            onPick={() => {
                                propsRef.current.onSavedPick(preset);
                            }}
                            onMenuOpening={(event) => {
                                handleMenuOpening(event, preset);
                            }}
                            onButtonMouseDown={onButtonMouseDown}
                        />
                    );
                })}
                <button
                    type="button"
                    className="app-preset app-preset-add"
                    title={
                        isFull
                            ? tran('Remove a preset to save a new one')
                            : saveLabel
                    }
                    disabled={isFull}
                    onMouseDown={onButtonMouseDown}
                    onClick={handleSaving}
                >
                    <i className="bi bi-plus-lg" aria-hidden="true" />
                    <span>{saveLabel}</span>
                </button>
            </div>
        </div>
    );
}
