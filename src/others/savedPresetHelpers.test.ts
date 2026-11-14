import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => h.settings.get(name) ?? null,
    setSetting: vi.fn((name: string, value: string) => {
        h.settings.set(name, value);
    }),
}));

import { setSetting } from '../helper/settingHelpers';
import {
    mutateSavedPresets,
    readSavedPresets,
    subscribeSavedPresets,
    writeSavedPresets,
} from './savedPresetHelpers';
import {
    addSavedPreset,
    type SavedPresetBaseType,
} from './savedPresetListHelpers';

type ColorPresetType = SavedPresetBaseType & { color: string };

function toColorPreset(
    item: Record<string, unknown>,
    base: SavedPresetBaseType,
): ColorPresetType | null {
    return typeof item.color === 'string'
        ? { ...base, color: item.color }
        : null;
}

const SETTING_NAME = 'test-look-saved-presets';
const ONE = { id: 'one', name: 'One', color: '#111111' };
const TWO = { id: 'two', name: 'Two', color: '#222222' };

function readStored() {
    return JSON.parse(h.settings.get(SETTING_NAME)!);
}

beforeEach(() => {
    h.settings.clear();
});

describe('readSavedPresets', () => {
    test('a list never saved, empty, or no longer JSON is no list', () => {
        expect(readSavedPresets(SETTING_NAME, toColorPreset)).toEqual([]);
        for (const text of ['', '[{"id":"one",', '{"id":"one"}', 'null']) {
            h.settings.set(SETTING_NAME, text);
            expect(readSavedPresets(SETTING_NAME, toColorPreset)).toEqual([]);
        }
    });

    test('a bad entry is dropped and the others kept', () => {
        h.settings.set(
            SETTING_NAME,
            JSON.stringify([ONE, { id: 'bad', name: 'No colour' }, TWO]),
        );
        expect(readSavedPresets(SETTING_NAME, toColorPreset)).toEqual([
            ONE,
            TWO,
        ]);
    });
});

describe('writeSavedPresets', () => {
    test('writes the list as JSON and tells only the rows over it', () => {
        const listener = vi.fn();
        const otherListener = vi.fn();
        const unsubscribe = subscribeSavedPresets(SETTING_NAME, listener);
        const unsubscribeOther = subscribeSavedPresets(
            'other-saved-presets',
            otherListener,
        );
        const presets = [ONE, TWO];

        writeSavedPresets(SETTING_NAME, presets);
        expect(setSetting).toHaveBeenCalledExactlyOnceWith(
            SETTING_NAME,
            JSON.stringify(presets),
        );
        expect(readStored()).toEqual(presets);
        // Handed the list as written, so no row has to read it again.
        expect(listener).toHaveBeenCalledExactlyOnceWith(presets);
        expect(otherListener).not.toHaveBeenCalled();
        unsubscribe();
        unsubscribeOther();
    });

    test('a row that left hears nothing more, and the others still do', () => {
        const leaving = vi.fn();
        const staying = vi.fn();
        const unsubscribeLeaving = subscribeSavedPresets(SETTING_NAME, leaving);
        const unsubscribeStaying = subscribeSavedPresets(SETTING_NAME, staying);
        unsubscribeLeaving();
        writeSavedPresets(SETTING_NAME, [ONE]);
        expect(leaving).not.toHaveBeenCalled();
        expect(staying).toHaveBeenCalledOnce();

        unsubscribeStaying();
        // Leaving twice is harmless, and the last one out leaves no one.
        unsubscribeStaying();
        unsubscribeLeaving();
        writeSavedPresets(SETTING_NAME, [TWO]);
        expect(staying).toHaveBeenCalledOnce();
        expect(readStored()).toEqual([TWO]);
    });
});

describe('mutateSavedPresets', () => {
    test('changes the list as it is NOW, not as a row last read it', () => {
        // One row read the list while it was empty...
        expect(readSavedPresets(SETTING_NAME, toColorPreset)).toEqual([]);
        // ...then another row saved one.
        writeSavedPresets(SETTING_NAME, [ONE]);

        const mutate = vi.fn((presets: ColorPresetType[]) => {
            return [...presets, TWO];
        });
        const newPresets = mutateSavedPresets(
            SETTING_NAME,
            toColorPreset,
            mutate,
        );
        expect(mutate).toHaveBeenCalledExactlyOnceWith([ONE]);
        expect(newPresets).toEqual([ONE, TWO]);
        expect(readStored()).toEqual([ONE, TWO]);
    });

    test('writes the new list once and tells the rows over it', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeSavedPresets(SETTING_NAME, listener);
        const newPresets = mutateSavedPresets(
            SETTING_NAME,
            toColorPreset,
            (presets) => {
                return addSavedPreset(presets, 'Fresh', { color: '#123456' });
            },
        );
        expect(newPresets).toEqual([
            { id: expect.any(String), name: 'Fresh', color: '#123456' },
        ]);
        expect(setSetting).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledExactlyOnceWith(newPresets);
        unsubscribe();
    });

    test('a change that made none writes nothing and tells no one', () => {
        h.settings.set(SETTING_NAME, JSON.stringify([ONE]));
        const listener = vi.fn();
        const unsubscribe = subscribeSavedPresets(SETTING_NAME, listener);
        expect(
            mutateSavedPresets(SETTING_NAME, toColorPreset, () => {
                return null;
            }),
        ).toBe(null);
        expect(setSetting).not.toHaveBeenCalled();
        expect(listener).not.toHaveBeenCalled();
        expect(readStored()).toEqual([ONE]);
        unsubscribe();
    });

    test('a list that is no longer JSON is written over with a good one', () => {
        h.settings.set(SETTING_NAME, 'not json');
        const newPresets = mutateSavedPresets(
            SETTING_NAME,
            toColorPreset,
            (presets) => {
                return [...presets, ONE];
            },
        );
        expect(newPresets).toEqual([ONE]);
        expect(readStored()).toEqual([ONE]);
    });
});
