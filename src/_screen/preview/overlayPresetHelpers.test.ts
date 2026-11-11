import { describe, expect, test, vi } from 'vitest';

// The screen-delete path, run for real over an in-memory store: what it
// removes is the question, not how.
const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: (name: string) => h.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        h.settings.set(name, value);
    },
    removeSetting: (name: string) => {
        h.settings.delete(name);
    },
}));
vi.mock('../../helper/helpers', () => ({
    parseJsonSafely: (json: string) => {
        try {
            return json ? JSON.parse(json) : null;
        } catch {
            return null;
        }
    },
}));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => unknown) => {
        return await callback();
    },
}));
vi.mock('../managers/screenHelpers', () => ({
    SCREEN_MANAGER_SETTING_NAME: 'screen-manager',
}));

import { classifySettingKey } from '../../setting/setting-archive/settingArchiveCatalog';
import { deleteScreenPersistedData } from '../managers/screenManagerDeleteHelpers';
import { previewerSettingPrefixList } from '../managers/screenSettingKeyHelpers';
import {
    BRUSH_PRESET_LIST,
    BRUSH_SAVED_PRESETS_SETTING_NAME,
    SPOTLIGHT_PRESET_LIST,
    SPOTLIGHT_SAVED_PRESETS_SETTING_NAME,
    toBrushSavedPreset,
    toSpotlightSavedPreset,
} from './overlayPresetHelpers';

const BASE = { id: 'saved-1', name: 'Mine' };

const BRUSH_VALUES = {
    color: '#ffd60a',
    alpha: 35,
    size: 28,
    isStraight: true,
    is3D: false,
    isDots: true,
};

const SPOTLIGHT_VALUES = {
    size: 360,
    dimColor: '#000000',
    dimOpacity: 45,
    edgeBlur: 70,
    isContrast: true,
};

describe('a saved brush read off disk', () => {
    test('a good one comes back as it was, under its id and name', () => {
        expect(toBrushSavedPreset({ values: BRUSH_VALUES }, BASE)).toEqual({
            ...BASE,
            values: BRUSH_VALUES,
        });
    });

    test('numbers are rounded into what the sliders reach, the colour lowercased', () => {
        expect(
            toBrushSavedPreset(
                {
                    values: {
                        ...BRUSH_VALUES,
                        color: '#FFD60A',
                        alpha: 35.6,
                        size: 0,
                    },
                },
                BASE,
            )!.values,
        ).toEqual({ ...BRUSH_VALUES, alpha: 36, size: 1 });
        expect(
            toBrushSavedPreset(
                { values: { ...BRUSH_VALUES, alpha: 1, size: 999 } },
                BASE,
            )!.values,
        ).toMatchObject({ alpha: 5, size: 60 });
        expect(
            toBrushSavedPreset(
                { values: { ...BRUSH_VALUES, alpha: 400 } },
                BASE,
            )!.values.alpha,
        ).toBe(100);
    });

    test('a switch is on only when it is exactly true', () => {
        expect(
            toBrushSavedPreset(
                {
                    values: {
                        ...BRUSH_VALUES,
                        isStraight: 'true',
                        is3D: 1,
                        isDots: null,
                    },
                },
                BASE,
            )!.values,
        ).toMatchObject({ isStraight: false, is3D: false, isDots: false });
        expect(
            toBrushSavedPreset(
                { values: { color: '#000000', alpha: 50, size: 5 } },
                BASE,
            )!.values,
        ).toMatchObject({ isStraight: false, is3D: false, isDots: false });
    });

    test('one that is not a brush is no preset', () => {
        const badValuesList: unknown[] = [
            undefined,
            null,
            'values',
            [BRUSH_VALUES],
            { ...BRUSH_VALUES, color: '#fd0' },
            { ...BRUSH_VALUES, color: '#ffd60a80' },
            { ...BRUSH_VALUES, color: 'yellow' },
            { ...BRUSH_VALUES, color: 7 },
            { ...BRUSH_VALUES, alpha: Number.NaN },
            { ...BRUSH_VALUES, alpha: '35' },
            { ...BRUSH_VALUES, size: Number.POSITIVE_INFINITY },
            { color: '#ffd60a', alpha: 35 },
        ];
        for (const values of badValuesList) {
            expect(
                toBrushSavedPreset({ values }, BASE),
                JSON.stringify(values),
            ).toBe(null);
        }
    });
});

describe('a saved spotlight read off disk', () => {
    test('a good one comes back as it was, under its id and name', () => {
        expect(
            toSpotlightSavedPreset({ values: SPOTLIGHT_VALUES }, BASE),
        ).toEqual({ ...BASE, values: SPOTLIGHT_VALUES });
    });

    test('numbers are rounded into what the sliders reach, the colour lowercased', () => {
        expect(
            toSpotlightSavedPreset(
                {
                    values: {
                        ...SPOTLIGHT_VALUES,
                        size: 10,
                        dimColor: '#1E3A8A',
                        dimOpacity: 0,
                        edgeBlur: -4,
                    },
                },
                BASE,
            )!.values,
        ).toEqual({
            ...SPOTLIGHT_VALUES,
            size: 40,
            dimColor: '#1e3a8a',
            dimOpacity: 10,
            edgeBlur: 0,
        });
        expect(
            toSpotlightSavedPreset(
                {
                    values: {
                        ...SPOTLIGHT_VALUES,
                        size: 5000.4,
                        dimOpacity: 140,
                        edgeBlur: 70.5,
                    },
                },
                BASE,
            )!.values,
        ).toMatchObject({ size: 1200, dimOpacity: 100, edgeBlur: 71 });
    });

    test('contrast is on only when it is exactly true', () => {
        expect(
            toSpotlightSavedPreset(
                { values: { ...SPOTLIGHT_VALUES, isContrast: 'true' } },
                BASE,
            )!.values.isContrast,
        ).toBe(false);
    });

    test('one that is not a spotlight is no preset', () => {
        const badValuesList: unknown[] = [
            undefined,
            null,
            [SPOTLIGHT_VALUES],
            { ...SPOTLIGHT_VALUES, dimColor: 'black' },
            { ...SPOTLIGHT_VALUES, dimColor: '#000' },
            { ...SPOTLIGHT_VALUES, dimColor: undefined },
            { ...SPOTLIGHT_VALUES, size: Number.NaN },
            { ...SPOTLIGHT_VALUES, dimOpacity: '45' },
            { ...SPOTLIGHT_VALUES, edgeBlur: Number.NEGATIVE_INFINITY },
            { size: 360, dimColor: '#000000', dimOpacity: 45 },
        ];
        for (const values of badValuesList) {
            expect(
                toSpotlightSavedPreset({ values }, BASE),
                JSON.stringify(values),
            ).toBe(null);
        }
    });
});

describe('the built-in looks', () => {
    test("each brush is one the panel's own controls can make", () => {
        expect(
            BRUSH_PRESET_LIST.map((preset) => {
                return preset.id;
            }),
        ).toEqual(['highlight', 'underline', 'bold']);
        for (const preset of BRUSH_PRESET_LIST) {
            expect(
                toBrushSavedPreset({ values: preset.look }, BASE)?.values,
                preset.id,
            ).toEqual(preset.look);
        }
    });

    test("each spotlight is one the panel's own controls can make", () => {
        expect(
            SPOTLIGHT_PRESET_LIST.map((preset) => {
                return preset.id;
            }),
        ).toEqual(['haze', 'strong', 'halo']);
        for (const preset of SPOTLIGHT_PRESET_LIST) {
            expect(
                toSpotlightSavedPreset({ values: preset.look }, BASE)?.values,
                preset.id,
            ).toEqual(preset.look);
        }
    });

    test('no two built-ins of a tool look the same', () => {
        for (const list of [BRUSH_PRESET_LIST, SPOTLIGHT_PRESET_LIST]) {
            const looks = list.map((preset) => {
                return JSON.stringify(preset.look);
            });
            expect(new Set(looks).size).toBe(looks.length);
        }
    });
});

describe('where the saved lists are kept', () => {
    const settingNames = [
        BRUSH_SAVED_PRESETS_SETTING_NAME,
        SPOTLIGHT_SAVED_PRESETS_SETTING_NAME,
    ];

    test("under each tool's own prefix, so Export / Import carries them with the drawing", () => {
        expect(BRUSH_SAVED_PRESETS_SETTING_NAME.startsWith('draw-paint-')).toBe(
            true,
        );
        expect(
            SPOTLIGHT_SAVED_PRESETS_SETTING_NAME.startsWith('screen-focus-'),
        ).toBe(true);
        for (const settingName of settingNames) {
            expect(classifySettingKey('local', settingName)).toBe(
                'screens.drawing',
            );
        }
    });

    test('never in the shape of a per-screen key, which ends in the screen id', () => {
        for (const settingName of settingNames) {
            expect(settingName).not.toMatch(/\d$/);
            for (const prefix of previewerSettingPrefixList) {
                expect(settingName.startsWith(prefix), prefix).toBe(false);
            }
        }
    });

    test('deleting a screen leaves them', async () => {
        for (const settingName of settingNames) {
            h.settings.set(settingName, '[]');
        }
        h.settings.set('draw-paint-color-0', '#ff0000');
        h.settings.set('draw-paint-size-1', '12');
        for (const screenId of [0, 1, 2, 10]) {
            await deleteScreenPersistedData(screenId);
        }
        // The path did run...
        expect(h.settings.has('draw-paint-color-0')).toBe(false);
        expect(h.settings.has('draw-paint-size-1')).toBe(false);
        // ...and the lists every screen shares are still there.
        for (const settingName of settingNames) {
            expect(h.settings.get(settingName)).toBe('[]');
        }
    });
});
