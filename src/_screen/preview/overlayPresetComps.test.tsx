import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    rows: [] as any[],
    keepOverlayFocus: (event: { preventDefault(): void }) => {
        event.preventDefault();
    },
}));

// The row itself has its own suite: here, what each tool hands it.
vi.mock('../../others/PresetsRowComp', () => ({
    default: (props: any) => {
        h.rows.push(props);
        return null;
    },
}));
vi.mock('./miniScreenOverlayControlComps', () => ({
    handleKeepOverlayFocus: h.keepOverlayFocus,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));

import { BrushPresetsComp, SpotlightPresetsComp } from './overlayPresetComps';
import {
    BRUSH_PRESET_LIST,
    BRUSH_SAVED_PRESETS_SETTING_NAME,
    SPOTLIGHT_PRESET_LIST,
    SPOTLIGHT_SAVED_PRESETS_SETTING_NAME,
    toBrushSavedPreset,
    toSpotlightSavedPreset,
    type BrushLookType,
} from './overlayPresetHelpers';
import type { SpotlightLookType } from '../managers/screenOverlayHelpers';

const BRUSH: BrushLookType = {
    color: '#123456',
    alpha: 80,
    size: 12,
    isStraight: false,
    is3D: true,
    isDots: false,
};

const SPOTLIGHT: SpotlightLookType = {
    size: 420,
    dimColor: '#102030',
    dimOpacity: 55,
    edgeBlur: 25,
    isContrast: true,
};

function renderRow(element: React.ReactElement) {
    h.rows = [];
    expect(renderToStaticMarkup(element)).toBe('');
    expect(h.rows).toHaveLength(1);
    return h.rows[0];
}

beforeEach(() => {
    h.rows = [];
});

describe("the brush's Presets", () => {
    test('one line over the shared brush list, keeping the canvas focused', () => {
        const row = renderRow(
            <BrushPresetsComp
                readCurrent={() => {
                    return BRUSH;
                }}
                onApply={vi.fn()}
            />,
        );
        expect(row.savedSettingName).toBe(BRUSH_SAVED_PRESETS_SETTING_NAME);
        expect(row.toSavedPreset).toBe(toBrushSavedPreset);
        expect(row.isCompact).toBe(true);
        expect(row.onButtonMouseDown).toBe(h.keepOverlayFocus);
        expect(row.headEnd).toBeUndefined();
        expect(row.filterSaved).toBeUndefined();
    });

    test('Highlight, Underline, Bold: each a chip of its colour that puts its brush on', () => {
        const onApply = vi.fn();
        const row = renderRow(
            <BrushPresetsComp
                readCurrent={() => {
                    return BRUSH;
                }}
                onApply={onApply}
            />,
        );
        expect(
            row.builtIns.map((preset: any) => {
                return [preset.id, preset.iconName, preset.label];
            }),
        ).toEqual([
            ['highlight', 'highlighter', 'Highlight'],
            ['underline', 'type-underline', 'Underline'],
            ['bold', 'type-bold', 'Bold'],
        ]);
        row.builtIns.forEach((builtIn: any, index: number) => {
            const { look } = BRUSH_PRESET_LIST[index];
            expect(builtIn.chipColors).toEqual({
                color: look.color,
                backgroundColor: 'transparent',
            });
            builtIn.onPick();
            expect(onApply).toHaveBeenLastCalledWith(look);
        });
        expect(onApply).toHaveBeenCalledTimes(3);
    });

    test('Save keeps the brush in front; a saved one is put back whole', () => {
        const onApply = vi.fn();
        const row = renderRow(
            <BrushPresetsComp
                readCurrent={() => {
                    return BRUSH;
                }}
                onApply={onApply}
            />,
        );
        expect(row.readCurrent()).toEqual({ values: BRUSH });
        const saved = { id: 'saved', name: 'Mine', values: BRUSH };
        row.onSavedPick(saved);
        expect(onApply).toHaveBeenCalledExactlyOnceWith(BRUSH);
        expect(row.genSavedChipColors(saved)).toEqual({
            color: BRUSH.color,
            backgroundColor: 'transparent',
        });
    });
});

describe("the spotlight's Presets", () => {
    test('one line over the shared spotlight list, keeping the canvas focused', () => {
        const row = renderRow(
            <SpotlightPresetsComp
                readCurrent={() => {
                    return SPOTLIGHT;
                }}
                onApply={vi.fn()}
            />,
        );
        expect(row.savedSettingName).toBe(SPOTLIGHT_SAVED_PRESETS_SETTING_NAME);
        expect(row.toSavedPreset).toBe(toSpotlightSavedPreset);
        expect(row.isCompact).toBe(true);
        expect(row.onButtonMouseDown).toBe(h.keepOverlayFocus);
        // A spotlight is no colour of words: no chips.
        expect(row.genSavedChipColors).toBeUndefined();
    });

    test('Haze, Strong, Halo: each puts its spotlight on', () => {
        const onApply = vi.fn();
        const row = renderRow(
            <SpotlightPresetsComp
                readCurrent={() => {
                    return SPOTLIGHT;
                }}
                onApply={onApply}
            />,
        );
        expect(
            row.builtIns.map((preset: any) => {
                return [preset.id, preset.iconName, preset.label];
            }),
        ).toEqual([
            ['haze', 'cloud-haze2', 'Haze'],
            ['strong', 'record-circle', 'Strong'],
            ['halo', 'brightness-high', 'Halo'],
        ]);
        row.builtIns.forEach((builtIn: any, index: number) => {
            expect(builtIn.chipColors ?? null).toBe(null);
            builtIn.onPick();
            expect(onApply).toHaveBeenLastCalledWith(
                SPOTLIGHT_PRESET_LIST[index].look,
            );
        });
        expect(onApply).toHaveBeenCalledTimes(3);
    });

    test('Save keeps the spotlight in front; a saved one is put back whole', () => {
        const onApply = vi.fn();
        const row = renderRow(
            <SpotlightPresetsComp
                readCurrent={() => {
                    return SPOTLIGHT;
                }}
                onApply={onApply}
            />,
        );
        expect(row.readCurrent()).toEqual({ values: SPOTLIGHT });
        row.onSavedPick({ id: 'saved', name: 'Mine', values: SPOTLIGHT });
        expect(onApply).toHaveBeenCalledExactlyOnceWith(SPOTLIGHT);
    });
});
