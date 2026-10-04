import { beforeEach, describe, expect, test, vi } from 'vitest';

const { settings, addPropEventMock } = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    addPropEventMock: vi.fn(),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settings.set(key, value);
    },
    removeSetting: (key: string) => {
        settings.delete(key);
    },
}));
vi.mock('../event/EventHandler', () => ({
    default: { addPropEvent: addPropEventMock },
}));

import {
    BACKGROUND_ITEM_TRANSITION_SETTING_NAME,
    BACKGROUND_TAB_TRANSITION_SETTING_NAME,
    BACKGROUND_TRANSITION_CHANGED_EVENT,
    resolveBackgroundTransition,
    setBackgroundItemTransition,
    setBackgroundTabTransition,
    stampBackgroundTransition,
} from './backgroundTransitionHelpers';

describe('background transitions', () => {
    beforeEach(() => {
        settings.clear();
        addPropEventMock.mockClear();
    });

    test('a background follows the screen until its tab or itself overrides', () => {
        const image = { type: 'image' as const, src: 'file:///a.png' };
        expect(resolveBackgroundTransition(image)).toBeUndefined();
        setBackgroundTabTransition('image', 'zoom');
        expect(resolveBackgroundTransition(image)).toBe('zoom');
        setBackgroundItemTransition(image.src, 'none');
        expect(resolveBackgroundTransition(image)).toBe('none');
        // Another tab is untouched by the Images tab's choice.
        expect(
            resolveBackgroundTransition({ type: 'video', src: 'v.mp4' }),
        ).toBeUndefined();
        expect(addPropEventMock).toHaveBeenCalledWith(
            BACKGROUND_TRANSITION_CHANGED_EVENT,
        );
    });

    test('stamping writes the key only when there is an override', () => {
        const color = { type: 'color' as const, src: '#000000' };
        expect('transitionEffect' in stampBackgroundTransition(color)).toBe(
            false,
        );
        setBackgroundItemTransition('#000000', 'fade');
        expect(stampBackgroundTransition(color)).toEqual({
            ...color,
            transitionEffect: 'fade',
        });
        // An override taken away leaves no stale key on a re-stamp.
        setBackgroundItemTransition('#000000', undefined);
        expect(
            'transitionEffect' in
                stampBackgroundTransition({
                    ...color,
                    transitionEffect: 'fade',
                }),
        ).toBe(false);
    });

    test('unticking the last entry removes the setting, and junk is ignored', () => {
        setBackgroundTabTransition('web', 'move');
        expect(settings.has(BACKGROUND_TAB_TRANSITION_SETTING_NAME)).toBe(true);
        setBackgroundTabTransition('web', undefined);
        expect(settings.has(BACKGROUND_TAB_TRANSITION_SETTING_NAME)).toBe(
            false,
        );
        settings.set(BACKGROUND_ITEM_TRANSITION_SETTING_NAME, '{not json');
        expect(
            resolveBackgroundTransition({ type: 'web', src: 'x' }),
        ).toBeUndefined();
        settings.set(
            BACKGROUND_ITEM_TRANSITION_SETTING_NAME,
            JSON.stringify({ x: 'sparkle' }),
        );
        expect(
            resolveBackgroundTransition({ type: 'web', src: 'x' }),
        ).toBeUndefined();
    });
});
