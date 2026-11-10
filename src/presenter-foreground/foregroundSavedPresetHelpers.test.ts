import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
    state: { settings: new Map<string, string>() },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => state.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        state.settings.set(name, value);
    },
    removeSetting: (name: string) => {
        state.settings.delete(name);
    },
}));

import {
    MAX_FOREGROUND_SAVED_PRESET_COUNT,
    addForegroundSavedPreset,
    applyForegroundSavedPreset,
    findForegroundSavedPreset,
    genForegroundSavedPresetName,
    getForegroundSavedPresets,
    readForegroundLookValues,
    removeForegroundSavedPreset,
    renameForegroundSavedPreset,
    replaceForegroundSavedPreset,
    setForegroundSavedPresets,
} from './foregroundSavedPresetHelpers';

beforeEach(() => {
    state.settings.clear();
});

describe('saved foreground presets', () => {
    test("a session's look is saved whole and put back exactly on another", () => {
        state.settings.set('quick-text-s1-setting-show-widget-font-size', '52');
        state.settings.set('quick-text-s1-common-color', '#111827');
        state.settings.set('quick-text-s1-common-font-family', 'Made Up Sans');
        state.settings.set(
            'quick-text-s1-setting-show-widget-decoration',
            '{"padding":1}',
        );
        // Not the look: the words stay out of it.
        state.settings.set('foreground-quick-text-setting-s1', 'Hello');
        const values = readForegroundLookValues('quick-text', 'quick-text-s1');
        expect(values).toEqual({
            'props.fontSize': '52',
            'common.color': '#111827',
            'common.fontFamily': 'Made Up Sans',
            decoration: '{"padding":1}',
        });
        const presets = addForegroundSavedPreset([], '  Youth Night ', values)!;
        expect(presets[0].name).toBe('Youth Night');
        // The other session had a place and a colour of its own.
        state.settings.set('quick-text-s2-setting-show-widget-offset-x', '60');
        state.settings.set('quick-text-s2-common-color', '#FFFFFF');
        applyForegroundSavedPreset('quick-text', 'quick-text-s2', presets[0]);
        expect(readForegroundLookValues('quick-text', 'quick-text-s2')).toEqual(
            values,
        );
        // Its own place, not in the saved look, is the default again.
        expect(
            state.settings.has('quick-text-s2-setting-show-widget-offset-x'),
        ).toBe(false);
    });

    test("a marquee's own size and speed travel with its look", () => {
        state.settings.set('foreground-marquee-top-font-size-s2', '70');
        state.settings.set('foreground-marquee-top-speed-percentage-s2', '130');
        const values = readForegroundLookValues(
            'marquee-top',
            'marquee-top-s2',
        );
        expect(values).toEqual({
            'own.font-size': '70',
            'own.speed-percentage': '130',
        });
        applyForegroundSavedPreset('marquee-top', 'marquee-top', {
            id: 'a',
            name: 'Fast',
            values,
        });
        expect(
            state.settings.get('foreground-marquee-top-speed-percentage'),
        ).toBe('130');
    });

    test('kept per component, a bad entry dropped and not the list', () => {
        setForegroundSavedPresets('countdown', [
            { id: 'a', name: 'Big', values: { 'props.scale': '2' } },
        ]);
        expect(getForegroundSavedPresets('countdown')).toHaveLength(1);
        expect(getForegroundSavedPresets('stopwatch')).toEqual([]);
        state.settings.set(
            'foreground-countdown-saved-presets',
            JSON.stringify([
                { id: 'a', name: 'Big', values: { 'props.scale': '2', x: 1 } },
                { id: 'a', name: 'Twin', values: {} },
                { id: 'b', name: '', values: {} },
                'junk',
                { id: 'c', name: 'Small', values: [] },
            ]),
        );
        expect(getForegroundSavedPresets('countdown')).toEqual([
            { id: 'a', name: 'Big', values: { 'props.scale': '2' } },
        ]);
        state.settings.set('foreground-countdown-saved-presets', '{not json');
        expect(getForegroundSavedPresets('countdown')).toEqual([]);
        expect(findForegroundSavedPreset('countdown', 'big')).toBeNull();
    });

    test('named, renamed, replaced, removed, and full at its limit', () => {
        let presets = addForegroundSavedPreset([], 'Preset 1', { a: '1' })!;
        expect(genForegroundSavedPresetName(presets, 'Preset')).toBe(
            'Preset 2',
        );
        expect(addForegroundSavedPreset(presets, '   ', {})).toBeNull();
        const { id } = presets[0];
        presets = renameForegroundSavedPreset(presets, id, 'Sunday');
        presets = renameForegroundSavedPreset(presets, id, '  ');
        expect(presets[0].name).toBe('Sunday');
        presets = replaceForegroundSavedPreset(presets, id, { b: '2' });
        expect(presets[0].values).toEqual({ b: '2' });
        setForegroundSavedPresets('message', presets);
        expect(findForegroundSavedPreset('message', ' SUNDAY ')?.id).toBe(id);
        expect(removeForegroundSavedPreset(presets, id)).toEqual([]);
        const full = Array.from(
            { length: MAX_FOREGROUND_SAVED_PRESET_COUNT },
            (_, index) => {
                return { id: `${index}`, name: `P ${index}`, values: {} };
            },
        );
        expect(addForegroundSavedPreset(full, 'One more', {})).toBeNull();
    });
});
