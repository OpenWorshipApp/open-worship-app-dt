import { tran } from '../../lang/langHelpers';
import PresetsRowComp from '../../others/PresetsRowComp';
import type { SpotlightLookType } from '../managers/screenOverlayHelpers';
import { handleKeepOverlayFocus } from './miniScreenOverlayControlComps';
import {
    BRUSH_PRESET_LIST,
    BRUSH_SAVED_PRESETS_SETTING_NAME,
    SPOTLIGHT_PRESET_LIST,
    SPOTLIGHT_SAVED_PRESETS_SETTING_NAME,
    toBrushSavedPreset,
    toSpotlightSavedPreset,
    type BrushLookType,
    type BrushPresetIdType,
    type BrushSavedPresetType,
    type SpotlightPresetIdType,
    type SpotlightSavedPresetType,
} from './overlayPresetHelpers';

// One literal per look so the key coverage test can read every one of them.
function toBrushPresetLabel(id: BrushPresetIdType) {
    switch (id) {
        case 'highlight':
            return tran('Highlight');
        case 'underline':
            return tran('Underline');
        case 'bold':
            return tran('Bold');
    }
}

function toSpotlightPresetLabel(id: SpotlightPresetIdType) {
    switch (id) {
        case 'haze':
            return tran('Haze');
        case 'strong':
            return tran('Strong');
        case 'halo':
            return tran('Halo');
    }
}

/**
 * The brush's Presets, first in a Mini Screen's Draw strip and in Presenting
 * Control's brush strip: one line, and no button here takes the focus off
 * the canvas that holds the drawing keys (`handleKeepOverlayFocus`).
 */
export function BrushPresetsComp({
    readCurrent,
    onApply,
}: Readonly<{
    readCurrent: () => BrushLookType;
    onApply: (look: BrushLookType) => void;
}>) {
    return (
        <PresetsRowComp<BrushSavedPresetType>
            savedSettingName={BRUSH_SAVED_PRESETS_SETTING_NAME}
            toSavedPreset={toBrushSavedPreset}
            builtIns={BRUSH_PRESET_LIST.map((preset) => {
                return {
                    id: preset.id,
                    iconName: preset.iconName,
                    label: toBrushPresetLabel(preset.id),
                    chipColors: {
                        color: preset.look.color,
                        backgroundColor: 'transparent',
                    },
                    onPick: () => {
                        onApply(preset.look);
                    },
                };
            })}
            readCurrent={() => {
                return { values: readCurrent() };
            }}
            onSavedPick={(preset) => {
                onApply(preset.values);
            }}
            genSavedChipColors={(preset) => {
                return {
                    color: preset.values.color,
                    backgroundColor: 'transparent',
                };
            }}
            isCompact
            onButtonMouseDown={handleKeepOverlayFocus}
        />
    );
}

/** The spotlight's Presets, first in a Mini Screen's Focus strip and in
 * Presenting Control's spotlight strip. */
export function SpotlightPresetsComp({
    readCurrent,
    onApply,
}: Readonly<{
    readCurrent: () => SpotlightLookType;
    onApply: (look: SpotlightLookType) => void;
}>) {
    return (
        <PresetsRowComp<SpotlightSavedPresetType>
            savedSettingName={SPOTLIGHT_SAVED_PRESETS_SETTING_NAME}
            toSavedPreset={toSpotlightSavedPreset}
            builtIns={SPOTLIGHT_PRESET_LIST.map((preset) => {
                return {
                    id: preset.id,
                    iconName: preset.iconName,
                    label: toSpotlightPresetLabel(preset.id),
                    onPick: () => {
                        onApply(preset.look);
                    },
                };
            })}
            readCurrent={() => {
                return { values: readCurrent() };
            }}
            onSavedPick={(preset) => {
                onApply(preset.values);
            }}
            isCompact
            onButtonMouseDown={handleKeepOverlayFocus}
        />
    );
}
