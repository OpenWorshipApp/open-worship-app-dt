import { beforeEach, describe, expect, test, vi } from 'vitest';

const { settingStore } = vi.hoisted(() => ({
    settingStore: new Map<string, string>(),
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: (key: string) => settingStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
            settingStore.set(key, value);
        },
    },
}));

// The real module is the whole on-screen Bible renderer; only its prefix is
// wanted here.
vi.mock('../_screen/screenBibleHelpers', () => ({
    SCREEN_BIBLE_SETTING_PREFIX: 'screen-bible-',
}));

import {
    genBibleTextStylePatch,
    toBibleTextStyleView,
} from '../_screen/bibleTextStyleHelpers';
import {
    MAX_BIBLE_TEXT_PRESET_COUNT,
    addBibleTextPreset,
    genBibleTextPresetName,
    getBibleTextPresets,
    removeBibleTextPreset,
    renameBibleTextPreset,
    replaceBibleTextPresetStyle,
    setBibleTextPresets,
    toBibleTextPresetView,
    type BibleTextPresetType,
} from './bibleTextPresetHelpers';

const SETTING_NAME = 'screen-bible--style-presets';

const goldView = toBibleTextStyleView({
    fontSize: 80,
    color: '#FFD24A',
    isBold: true,
    textAlign: 'center',
});

describe('the saved presets setting', () => {
    beforeEach(() => {
        settingStore.clear();
    });

    test('is kept beside the style, under the same prefix', () => {
        setBibleTextPresets([{ id: 'a', name: 'Gold', style: {} }]);
        // `settingArchiveCatalog` files `screen-bible-*` under one section, so
        // Export / Import Settings carries the presets with the style.
        expect([...settingStore.keys()]).toEqual([SETTING_NAME]);
    });

    test('nothing saved yet is an empty list', () => {
        expect(getBibleTextPresets()).toEqual([]);
    });

    test('a setting that is not a list is an empty list, not a crash', () => {
        settingStore.set(SETTING_NAME, '{"id":"a"}');
        expect(getBibleTextPresets()).toEqual([]);
        settingStore.set(SETTING_NAME, '{not json');
        expect(getBibleTextPresets()).toEqual([]);
    });

    test('one bad entry is dropped, not the list it sits in', () => {
        settingStore.set(
            SETTING_NAME,
            JSON.stringify([
                { id: 'a', name: '  Gold  ', style: { color: '#FFD24A' } },
                { id: '', name: 'no id', style: {} },
                { id: 'b', name: '   ', style: {} },
                { id: 'c', name: 'no style' },
                'not an object',
                null,
                // The same id twice would give two tiles one React key.
                { id: 'a', name: 'twin', style: {} },
                { id: 'd', name: 'Plain', style: {} },
            ]),
        );
        expect(getBibleTextPresets()).toEqual([
            { id: 'a', name: 'Gold', style: { color: '#FFD24A' } },
            { id: 'd', name: 'Plain', style: {} },
        ]);
    });

    test('reads no more than the gallery holds', () => {
        settingStore.set(
            SETTING_NAME,
            JSON.stringify(
                Array.from({ length: MAX_BIBLE_TEXT_PRESET_COUNT + 5 }).map(
                    (_, i) => ({ id: `id-${i}`, name: `Look ${i}`, style: {} }),
                ),
            ),
        );
        expect(getBibleTextPresets()).toHaveLength(MAX_BIBLE_TEXT_PRESET_COUNT);
    });
});

describe('editing the list', () => {
    const presets: BibleTextPresetType[] = [
        { id: 'a', name: 'Preset 1', style: { color: '#FFFFFF' } },
        { id: 'b', name: 'Preset 3', style: { color: '#000000' } },
    ];

    test('a suggested name is the first number not taken', () => {
        expect(genBibleTextPresetName([], 'Preset')).toBe('Preset 1');
        expect(genBibleTextPresetName(presets, 'Preset')).toBe('Preset 2');
    });

    test('adding keeps the whole style, size and colour included', () => {
        const newPresets = addBibleTextPreset(presets, '  Gold  ', goldView);
        expect(newPresets).toHaveLength(3);
        const added = newPresets?.[2];
        expect(added?.name).toBe('Gold');
        expect(added?.id).not.toBe('');
        expect(added?.style).toEqual(genBibleTextStylePatch(goldView));
        // What is read back draws exactly what was saved.
        expect(
            toBibleTextPresetView(
                JSON.parse(JSON.stringify(added)) as BibleTextPresetType,
            ),
        ).toEqual(goldView);
        // The list handed in is not the one changed.
        expect(presets).toHaveLength(2);
    });

    test('adding needs a name and room', () => {
        expect(addBibleTextPreset(presets, '   ', goldView)).toBeNull();
        const full = Array.from({ length: MAX_BIBLE_TEXT_PRESET_COUNT }).map(
            (_, i) => ({ id: `id-${i}`, name: `Look ${i}`, style: {} }),
        );
        expect(addBibleTextPreset(full, 'One more', goldView)).toBeNull();
    });

    test('two saves in a row get two ids', () => {
        const once = addBibleTextPreset([], 'A', goldView) ?? [];
        const twice = addBibleTextPreset(once, 'B', goldView) ?? [];
        expect(new Set(twice.map((preset) => preset.id)).size).toBe(2);
    });

    test('renaming changes one name and ignores an empty one', () => {
        expect(
            renameBibleTextPreset(presets, 'b', ' Evening ').map(
                (preset) => preset.name,
            ),
        ).toEqual(['Preset 1', 'Evening']);
        expect(renameBibleTextPreset(presets, 'b', '  ')).toEqual(presets);
    });

    test('replacing puts the current look under the same name and id', () => {
        expect(replaceBibleTextPresetStyle(presets, 'a', goldView)).toEqual([
            {
                id: 'a',
                name: 'Preset 1',
                style: genBibleTextStylePatch(goldView),
            },
            presets[1],
        ]);
    });

    test('removing takes out that one only', () => {
        expect(removeBibleTextPreset(presets, 'a')).toEqual([presets[1]]);
        expect(removeBibleTextPreset(presets, 'nobody')).toEqual(presets);
    });
});

describe('putting a preset back', () => {
    test('clears what the style on the screen had and the preset does not', () => {
        const plainView = toBibleTextStyleView({ color: '#000000' });
        const patch = genBibleTextStylePatch(plainView);
        // Every key is named, so applying it over a bold, centred, spaced
        // style leaves none of that behind.
        expect(Object.keys(patch).sort()).toEqual(
            [
                'color',
                'effect',
                'fontFamily',
                'fontSize',
                'isBold',
                'isItalic',
                'letterSpacing',
                'lineHeight',
                'textAlign',
                'textShadow',
            ].sort(),
        );
        const applied = {
            fontFamily: 'Georgia',
            fontSize: 120,
            isBold: true,
            isItalic: true,
            letterSpacing: 0.1,
            lineHeight: 2,
            textAlign: 'center',
            ...patch,
        };
        expect(toBibleTextStyleView(applied)).toEqual(plainView);
    });
});
