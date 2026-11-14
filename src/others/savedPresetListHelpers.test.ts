import { describe, expect, test, vi } from 'vitest';

import {
    MAX_SAVED_PRESET_COUNT,
    addSavedPreset,
    findSavedPresetByName,
    genSavedPresetId,
    genSavedPresetName,
    parseSavedPresetList,
    removeSavedPreset,
    renameSavedPreset,
    replaceSavedPreset,
    toSavedPresetName,
    type SavedPresetBaseType,
} from './savedPresetListHelpers';

// A panel's own payload, as a foreground's `values` or a Bible tile's `style`.
type ColorPresetType = SavedPresetBaseType & { color: string };

function toColorPreset(
    item: Record<string, unknown>,
    base: SavedPresetBaseType,
): ColorPresetType | null {
    return typeof item.color === 'string'
        ? { ...base, color: item.color }
        : null;
}

function genPresets(count: number): ColorPresetType[] {
    return Array.from({ length: count }, (_, index) => {
        return { id: `id-${index}`, name: `Look ${index}`, color: '#000000' };
    });
}

describe('toSavedPresetName', () => {
    test('trims, keeps 40 characters, and reads anything else as empty', () => {
        expect(toSavedPresetName('  Sunday  ')).toBe('Sunday');
        expect(toSavedPresetName('x'.repeat(55))).toBe('x'.repeat(40));
        // Trimmed BEFORE it is cut, so leading spaces cost no characters.
        expect(toSavedPresetName(`   ${'y'.repeat(45)}`)).toBe('y'.repeat(40));
        expect(toSavedPresetName('   ')).toBe('');
        for (const name of [undefined, null, 7, true, {}, ['Name']]) {
            expect(toSavedPresetName(name)).toBe('');
        }
    });
});

describe('genSavedPresetName', () => {
    test('the first number no preset is called yet', () => {
        expect(genSavedPresetName([], 'Preset')).toBe('Preset 1');
        expect(
            genSavedPresetName(
                [
                    { id: 'a', name: 'Preset 1' },
                    { id: 'b', name: 'Preset 3' },
                ],
                'Preset',
            ),
        ).toBe('Preset 2');
        expect(
            genSavedPresetName(
                [
                    { id: 'a', name: 'Preset 2' },
                    { id: 'b', name: 'Preset 1' },
                ],
                'Preset',
            ),
        ).toBe('Preset 3');
        // Another base word is another count.
        expect(
            genSavedPresetName([{ id: 'a', name: 'Preset 1' }], 'Look'),
        ).toBe('Look 1');
    });
});

describe('genSavedPresetId', () => {
    test('ids differ even within one millisecond', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
        const ids = Array.from({ length: 100 }, () => {
            return genSavedPresetId();
        });
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) {
            expect(id).toMatch(/^[0-9a-z]+$/);
        }
    });
});

describe('parseSavedPresetList', () => {
    test('anything but an array is no list', () => {
        for (const parsed of [undefined, null, 'text', 3, { id: 'a' }]) {
            expect(parseSavedPresetList(parsed, toColorPreset)).toEqual([]);
        }
    });

    test('one bad entry is dropped, not the list it sits in', () => {
        const parsed = [
            { id: 'a', name: '  First  ', color: '#111111' },
            null,
            'text',
            7,
            ['a', 'Array'],
            { id: '', name: 'Empty id', color: '#222222' },
            { id: 9, name: 'Number id', color: '#222222' },
            { name: 'No id', color: '#222222' },
            { id: 'b', name: '   ', color: '#222222' },
            { id: 'c', name: 5, color: '#222222' },
            { id: 'd', name: 'No payload' },
            { id: 'a', name: 'Same id again', color: '#333333' },
            { id: 'e', name: 'Second', color: '#444444' },
        ];
        expect(parseSavedPresetList(parsed, toColorPreset)).toEqual([
            { id: 'a', name: 'First', color: '#111111' },
            { id: 'e', name: 'Second', color: '#444444' },
        ]);
    });

    test('the payload check gets the record and the id and name checked', () => {
        const toPreset = vi.fn(
            (
                item: Record<string, unknown>,
                base: SavedPresetBaseType,
            ): ColorPresetType | null => {
                return toColorPreset(item, base);
            },
        );
        const record = { id: 'x', name: '  Named  ', color: '#000000' };
        parseSavedPresetList([record], toPreset);
        expect(toPreset).toHaveBeenCalledExactlyOnceWith(record, {
            id: 'x',
            name: 'Named',
        });
    });

    test('an entry its payload check refuses does not take its id', () => {
        expect(
            parseSavedPresetList(
                [
                    { id: 'a', name: 'Refused', color: 3 },
                    { id: 'a', name: 'Kept', color: '#111111' },
                ],
                toColorPreset,
            ),
        ).toEqual([{ id: 'a', name: 'Kept', color: '#111111' }]);
    });

    test('at most 30 are kept, the first ones', () => {
        expect(MAX_SAVED_PRESET_COUNT).toBe(30);
        const presets = parseSavedPresetList(
            genPresets(MAX_SAVED_PRESET_COUNT + 4),
            toColorPreset,
        );
        expect(presets).toHaveLength(MAX_SAVED_PRESET_COUNT);
        expect(presets[0].id).toBe('id-0');
        expect(presets.at(-1)!.id).toBe(`id-${MAX_SAVED_PRESET_COUNT - 1}`);
    });
});

describe('addSavedPreset', () => {
    test('appends one under a new id and its checked name', () => {
        const presets = genPresets(2);
        const newPresets = addSavedPreset(presets, '  Bright  ', {
            color: '#FFFFFF',
        });
        expect(newPresets).toHaveLength(3);
        expect(newPresets!.slice(0, 2)).toEqual(presets);
        expect(newPresets![2]).toEqual({
            id: expect.any(String),
            name: 'Bright',
            color: '#FFFFFF',
        });
        expect(['id-0', 'id-1']).not.toContain(newPresets![2].id);
        // The list handed in is left as it was.
        expect(presets).toEqual(genPresets(2));
    });

    test('an empty name or a full list adds nothing', () => {
        expect(addSavedPreset(genPresets(1), '   ', { color: '#FFFFFF' })).toBe(
            null,
        );
        expect(
            addSavedPreset(genPresets(MAX_SAVED_PRESET_COUNT), 'One more', {
                color: '#FFFFFF',
            }),
        ).toBe(null);
        expect(
            addSavedPreset(genPresets(MAX_SAVED_PRESET_COUNT - 1), 'Last', {
                color: '#FFFFFF',
            }),
        ).toHaveLength(MAX_SAVED_PRESET_COUNT);
    });
});

describe('renameSavedPreset, replaceSavedPreset, removeSavedPreset', () => {
    test('each touches only the preset with that id', () => {
        const presets = genPresets(3);
        expect(renameSavedPreset(presets, 'id-1', '  Renamed  ')).toEqual([
            presets[0],
            { id: 'id-1', name: 'Renamed', color: '#000000' },
            presets[2],
        ]);
        // Its look replaced, its id and name kept.
        expect(
            replaceSavedPreset(presets, 'id-2', { color: '#ABCDEF' }),
        ).toEqual([
            presets[0],
            presets[1],
            { id: 'id-2', name: 'Look 2', color: '#ABCDEF' },
        ]);
        expect(removeSavedPreset(presets, 'id-0')).toEqual([
            presets[1],
            presets[2],
        ]);
        // None of them changes the list it was handed.
        expect(presets).toEqual(genPresets(3));
    });

    test('a rename to nothing keeps the name', () => {
        const presets = genPresets(2);
        expect(renameSavedPreset(presets, 'id-0', '   ')).toEqual(presets);
    });

    test('an id no preset has leaves the list as it was', () => {
        const presets = genPresets(2);
        expect(renameSavedPreset(presets, 'gone', 'Name')).toEqual(presets);
        expect(
            replaceSavedPreset(presets, 'gone', { color: '#ABCDEF' }),
        ).toEqual(presets);
        expect(removeSavedPreset(presets, 'gone')).toEqual(presets);
    });
});

describe('findSavedPresetByName', () => {
    test('a name in words finds its preset, case and spaces aside', () => {
        const presets = genPresets(3);
        expect(findSavedPresetByName(presets, '  look 1 ')).toBe(presets[1]);
        expect(findSavedPresetByName(presets, 'LOOK 2')).toBe(presets[2]);
        expect(findSavedPresetByName(presets, 'Look 9')).toBe(null);
        expect(findSavedPresetByName(presets, '   ')).toBe(null);
    });
});
