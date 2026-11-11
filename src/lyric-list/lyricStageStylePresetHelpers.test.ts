import { describe, expect, test, vi } from 'vitest';

// `lyricStageStyleHelpers` reads its record through `settingHelpers`, whose
// real module reaches `appProvider` (it touches `document` on load): mocked
// so this stays a node test. Nothing here reads or writes a setting.
vi.mock('../helper/settingHelpers', () => ({
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    removeSetting: vi.fn(),
}));

import { parseSavedPresetList } from '../others/savedPresetListHelpers';
import { classifySettingKey } from '../setting/setting-archive/settingArchiveCatalog';
import {
    LYRIC_STAGE_STYLE_DEFAULT,
    sanitizeLyricStageStyle,
    toLyricStageStyleSettingName,
    type LyricStageStyleType,
} from './lyricStageStyleHelpers';
import {
    genLyricStageStylePresetPatch,
    LYRIC_STAGE_STYLE_PRESET_LIST,
    LYRIC_STAGE_STYLE_SAVED_PRESETS_SETTING_NAME,
    toLyricStageStyleSavedPreset,
} from './lyricStageStylePresetHelpers';

const BASE = { id: 'p1', name: 'Mine' };

// A stage somebody styled by hand: a theme and rules of their own, and a
// layout none of the app's looks has.
const STYLED: LyricStageStyleType = {
    marginHorizontalPercentage: 12,
    marginVerticalPercentage: 30,
    isMarginLinked: false,
    boxVerticalAlignment: 'end',
    boxHorizontalAlignment: 'right',
    backgroundAlphaPercentage: 80,
    extraFontSize: 10,
    theme: 'dark',
    customCss: '.ol-preview-line { color: gold; }',
};

const LAYOUT_KEYS = Object.keys(LYRIC_STAGE_STYLE_DEFAULT)
    .filter((key) => {
        return key !== 'theme' && key !== 'customCss';
    })
    .sort();

function findPreset(id: string) {
    const preset = LYRIC_STAGE_STYLE_PRESET_LIST.find((item) => {
        return item.id === id;
    });
    if (preset === undefined) {
        throw new Error(`Missing preset: ${id}`);
    }
    return preset;
}

describe('the saved list', () => {
    test('is one list for every stage, carried with the lyrics', () => {
        expect(LYRIC_STAGE_STYLE_SAVED_PRESETS_SETTING_NAME).toBe(
            'lyric-stage-style-saved-presets',
        );
        // Not a stage's own record: no stage number can name it.
        for (const stage of [0, 1, 2, 3, 4, 5, 99]) {
            expect(toLyricStageStyleSettingName(stage)).not.toBe(
                LYRIC_STAGE_STYLE_SAVED_PRESETS_SETTING_NAME,
            );
        }
        // Export / Import Settings puts it beside the stage styles.
        expect(
            classifySettingKey(
                'local',
                LYRIC_STAGE_STYLE_SAVED_PRESETS_SETTING_NAME,
            ),
        ).toBe('documents.lyrics');
        expect(
            classifySettingKey('local', toLyricStageStyleSettingName(0)),
        ).toBe('documents.lyrics');
    });
});

describe('the app looks', () => {
    test('are the four layouts, in order', () => {
        expect(
            LYRIC_STAGE_STYLE_PRESET_LIST.map((preset) => preset.id),
        ).toEqual(['full-screen', 'center', 'top-banner', 'bottom-banner']);
        for (const preset of LYRIC_STAGE_STYLE_PRESET_LIST) {
            expect(preset.iconName).toMatch(/^[a-z0-9-]+$/);
        }
    });

    test('a look writes every layout field and never the theme or the css', () => {
        for (const preset of LYRIC_STAGE_STYLE_PRESET_LIST) {
            const patch = genLyricStageStylePresetPatch(preset);
            expect(Object.keys(patch).sort()).toEqual(LAYOUT_KEYS);
            expect(patch).not.toHaveProperty('theme');
            expect(patch).not.toHaveProperty('customCss');
        }
    });

    test('put on a styled stage, a look keeps its theme and its custom css', () => {
        for (const preset of LYRIC_STAGE_STYLE_PRESET_LIST) {
            const style = {
                ...STYLED,
                ...genLyricStageStylePresetPatch(preset),
            };
            expect(style.theme).toBe('dark');
            expect(style.customCss).toBe(STYLED.customCss);
            // A whole record the stage keeps exactly as written: what the
            // panel shows after a press is what the file holds.
            expect(sanitizeLyricStageStyle(style)).toEqual(style);
        }
        const lightStyle = {
            ...STYLED,
            theme: 'light' as const,
            ...genLyricStageStylePresetPatch(findPreset('top-banner')),
        };
        expect(lightStyle.theme).toBe('light');
    });

    test('each look is the layout it is named for', () => {
        expect(
            genLyricStageStylePresetPatch(findPreset('full-screen')),
        ).toEqual({
            marginHorizontalPercentage: 0,
            marginVerticalPercentage: 0,
            isMarginLinked: true,
            boxVerticalAlignment: 'center',
            boxHorizontalAlignment: 'center',
            backgroundAlphaPercentage:
                LYRIC_STAGE_STYLE_DEFAULT.backgroundAlphaPercentage,
            extraFontSize: LYRIC_STAGE_STYLE_DEFAULT.extraFontSize,
        });
        // Center is the stage as it comes: Reset's layout.
        const { theme, customCss, ...defaultLayout } =
            LYRIC_STAGE_STYLE_DEFAULT;
        expect(theme).toBe('light');
        expect(customCss).toBe('');
        expect(genLyricStageStylePresetPatch(findPreset('center'))).toEqual(
            defaultLayout,
        );
        const top = genLyricStageStylePresetPatch(findPreset('top-banner'));
        const bottom = genLyricStageStylePresetPatch(
            findPreset('bottom-banner'),
        );
        expect(top.boxVerticalAlignment).toBe('start');
        expect(bottom.boxVerticalAlignment).toBe('end');
        // The same band at either edge: across the width, short in height,
        // so the two margins cannot be linked.
        for (const banner of [top, bottom]) {
            expect(banner.isMarginLinked).toBe(false);
            expect(banner.boxHorizontalAlignment).toBe('center');
            expect(banner.marginVerticalPercentage).toBeGreaterThan(
                banner.marginHorizontalPercentage!,
            );
        }
        const { boxVerticalAlignment: _top, ...topRest } = top;
        const { boxVerticalAlignment: _bottom, ...bottomRest } = bottom;
        expect(topRest).toEqual(bottomRest);
    });

    test('a patch is a copy: changing one never changes the look', () => {
        const before = genLyricStageStylePresetPatch(findPreset('center'));
        before.marginHorizontalPercentage = 77;
        before.boxVerticalAlignment = 'end';
        const after = genLyricStageStylePresetPatch(findPreset('center'));
        expect(after.marginHorizontalPercentage).toBe(
            LYRIC_STAGE_STYLE_DEFAULT.marginHorizontalPercentage,
        );
        expect(after.boxVerticalAlignment).toBe('center');
        expect(findPreset('center').layout.marginHorizontalPercentage).toBe(
            LYRIC_STAGE_STYLE_DEFAULT.marginHorizontalPercentage,
        );
        // Nor the stage's defaults the Center look is made of.
        expect(LYRIC_STAGE_STYLE_DEFAULT.marginHorizontalPercentage).toBe(2);
    });
});

describe('a saved look read off disk', () => {
    test('is the whole record, theme and css included', () => {
        const preset = toLyricStageStyleSavedPreset({ values: STYLED }, BASE);
        expect(preset).toEqual({ id: 'p1', name: 'Mine', values: STYLED });
        // A copy, so a later change to the panel cannot reach the list.
        expect(preset!.values).not.toBe(STYLED);
    });

    test('is checked field by field, exactly as a stage record is', () => {
        const junk = {
            marginHorizontalPercentage: 500,
            marginVerticalPercentage: -3,
            isMarginLinked: 'no',
            boxVerticalAlignment: 'middle',
            boxHorizontalAlignment: 'left',
            backgroundAlphaPercentage: 'x',
            extraFontSize: 12.6,
            theme: 'blue',
            customCss: 42,
            top: 10,
        };
        const preset = toLyricStageStyleSavedPreset({ values: junk }, BASE);
        expect(preset!.values).toEqual(sanitizeLyricStageStyle(junk));
        expect(preset!.values).toEqual({
            marginHorizontalPercentage: 99,
            marginVerticalPercentage: 0,
            // Only an explicit `false` unlinks.
            isMarginLinked: true,
            // Half a place is no cell of the pad: Middle center.
            boxVerticalAlignment: 'center',
            boxHorizontalAlignment: 'center',
            backgroundAlphaPercentage: 50,
            extraFontSize: 13,
            theme: 'light',
            customCss: '',
        });
        expect(preset!.values).not.toHaveProperty('top');
    });

    test('a record from before the margin split reads back linked', () => {
        const preset = toLyricStageStyleSavedPreset(
            { values: { paddingPercentage: 4 } },
            BASE,
        );
        expect(preset!.values.marginHorizontalPercentage).toBe(8);
        expect(preset!.values.marginVerticalPercentage).toBe(8);
        expect(preset!.values.isMarginLinked).toBe(true);
    });

    test('anything but an object of values is no look', () => {
        for (const values of [undefined, null, 'dark', 5, true, [], [STYLED]]) {
            expect(toLyricStageStyleSavedPreset({ values }, BASE)).toBeNull();
        }
        expect(toLyricStageStyleSavedPreset({}, BASE)).toBeNull();
    });

    test('takes only its id, its name and its values from the entry', () => {
        const preset = toLyricStageStyleSavedPreset(
            { id: 'other', name: 'Other', values: STYLED, kind: 'text' },
            BASE,
        );
        expect(Object.keys(preset!).sort()).toEqual(['id', 'name', 'values']);
        expect(preset!.id).toBe('p1');
        expect(preset!.name).toBe('Mine');
    });

    test('a bad entry costs only itself when the list is read', () => {
        const presets = parseSavedPresetList(
            [
                { id: 'a', name: 'Kept', values: STYLED },
                { id: 'b', name: 'Broken', values: [] },
                { id: 'c', name: 'Also kept', values: { theme: 'dark' } },
            ],
            toLyricStageStyleSavedPreset,
        );
        expect(presets.map((preset) => preset.name)).toEqual([
            'Kept',
            'Also kept',
        ]);
        expect(presets[1].values).toEqual({
            ...LYRIC_STAGE_STYLE_DEFAULT,
            theme: 'dark',
        });
    });
});
