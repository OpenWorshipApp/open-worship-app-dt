import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => h.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        h.settings.set(name, value);
    },
}));

import { subscribeSavedPresets } from '../others/savedPresetHelpers';
import { MAX_SAVED_PRESET_COUNT } from '../others/savedPresetListHelpers';
import { listAnimationCategorySrcs } from './animationBuiltInHelpers';
import {
    ANIMATION_PIN_SETTING_NAME,
    checkIsAnimationPinListFull,
    checkIsAnimationPinned,
    readAnimationPinSrcList,
    readAnimationPins,
    toggleAnimationPin,
} from './animationPinHelpers';

const SRC_LIST = [
    ...listAnimationCategorySrcs('christmas', 'css'),
    ...listAnimationCategorySrcs('christmas', 'glsl'),
];

beforeEach(() => {
    h.settings.clear();
});

describe('the pinned animations', () => {
    it('pin and unpin by the animation, kept in the order pinned', () => {
        expect(readAnimationPins()).toEqual([]);
        expect(toggleAnimationPin(SRC_LIST[2], 'Christmas - Bokeh')).toBe(
            'pinned',
        );
        expect(toggleAnimationPin(SRC_LIST[0], 'Christmas - Snowfall')).toBe(
            'pinned',
        );
        expect(readAnimationPinSrcList()).toEqual([SRC_LIST[2], SRC_LIST[0]]);
        // The same animation written in another order of its parts is the
        // same pin: pressed again, it comes out.
        const [path, query] = SRC_LIST[2].split('?');
        const reordered = `${path}?${query.split('&').reverse().join('&')}`;
        expect(checkIsAnimationPinned(readAnimationPins(), reordered)).toBe(
            true,
        );
        expect(toggleAnimationPin(reordered, 'x')).toBe('unpinned');
        expect(readAnimationPinSrcList()).toEqual([SRC_LIST[0]]);
        expect(JSON.parse(h.settings.get(ANIMATION_PIN_SETTING_NAME)!)).toEqual(
            [
                expect.objectContaining({
                    name: 'Christmas - Snowfall',
                    src: SRC_LIST[0],
                }),
            ],
        );
    });

    it('stop at the limit, and say so without changing the list', () => {
        for (let index = 0; index < MAX_SAVED_PRESET_COUNT; index++) {
            expect(toggleAnimationPin(SRC_LIST[index], `Pin ${index}`)).toBe(
                'pinned',
            );
        }
        const pins = readAnimationPins();
        expect(checkIsAnimationPinListFull(pins)).toBe(true);
        expect(toggleAnimationPin(SRC_LIST[MAX_SAVED_PRESET_COUNT], 'x')).toBe(
            'full',
        );
        expect(readAnimationPins()).toEqual(pins);
        // One out, one in.
        expect(toggleAnimationPin(SRC_LIST[0], 'x')).toBe('unpinned');
        expect(checkIsAnimationPinListFull(readAnimationPins())).toBe(false);
        expect(toggleAnimationPin(SRC_LIST[MAX_SAVED_PRESET_COUNT], 'x')).toBe(
            'pinned',
        );
    });

    it('tell every mounted picker at once', () => {
        const heard: number[] = [];
        const unsubscribe = subscribeSavedPresets(
            ANIMATION_PIN_SETTING_NAME,
            (list) => {
                heard.push(list.length);
            },
        );
        toggleAnimationPin(SRC_LIST[0], 'One');
        toggleAnimationPin(SRC_LIST[1], 'Two');
        unsubscribe();
        toggleAnimationPin(SRC_LIST[0], 'One');
        expect(heard).toEqual([1, 2]);
    });

    it('drop an entry that is not an animation, and keep the rest', () => {
        h.settings.set(
            ANIMATION_PIN_SETTING_NAME,
            JSON.stringify([
                { id: 'a', name: 'Broken', src: 'not an animation' },
                { id: 'b', name: 'Snow', src: SRC_LIST[0] },
                { id: '', name: 'No id', src: SRC_LIST[1] },
            ]),
        );
        expect(readAnimationPinSrcList()).toEqual([SRC_LIST[0]]);
        h.settings.set(ANIMATION_PIN_SETTING_NAME, '{not json');
        expect(readAnimationPins()).toEqual([]);
        // Nothing that is not an animation is ever pinned.
        expect(toggleAnimationPin('not an animation', 'x')).toBe('full');
        expect(h.settings.get(ANIMATION_PIN_SETTING_NAME)).toBe('{not json');
    });

    it('keep a nameless pin by its animation', () => {
        expect(toggleAnimationPin(SRC_LIST[0], '   ')).toBe('pinned');
        expect(readAnimationPins()[0].name).toBe(SRC_LIST[0].slice(0, 40));
    });
});
