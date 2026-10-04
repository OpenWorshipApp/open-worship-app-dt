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
    FOREGROUND_TRANSITION_CHANGED_EVENT,
    genForegroundComponentTransitionSettingName,
    genForegroundSessionTransitionSettingName,
    resolveForegroundTransition,
    setForegroundComponentTransition,
    setForegroundSessionTransition,
} from './foregroundTransitionHelpers';

describe('foreground transitions', () => {
    beforeEach(() => {
        settings.clear();
        addPropEventMock.mockClear();
    });

    test('a session wins over its component, which wins over the screen', () => {
        expect(resolveForegroundTransition('countdown', 'countdown')).toBe(
            undefined,
        );
        setForegroundComponentTransition('countdown', 'zoom');
        expect(resolveForegroundTransition('countdown', 'countdown-s2')).toBe(
            'zoom',
        );
        setForegroundSessionTransition('countdown-s2', 'none');
        expect(resolveForegroundTransition('countdown', 'countdown-s2')).toBe(
            'none',
        );
        // The other session still follows the component.
        expect(resolveForegroundTransition('countdown', 'countdown')).toBe(
            'zoom',
        );
        expect(addPropEventMock).toHaveBeenCalledWith(
            FOREGROUND_TRANSITION_CHANGED_EVENT,
        );
    });

    test('a choice the old media picker saved counts as ticked', () => {
        settings.set('video-show-setting-show-widget-transition', 'move');
        expect(resolveForegroundTransition('video', 'video-show')).toBe('move');
    });

    test('unticking removes the setting instead of writing a default', () => {
        setForegroundSessionTransition('stopwatch', 'fade');
        setForegroundComponentTransition('stopwatch', 'fade');
        setForegroundSessionTransition('stopwatch', undefined);
        setForegroundComponentTransition('stopwatch', undefined);
        expect(
            settings.has(
                genForegroundSessionTransitionSettingName('stopwatch'),
            ),
        ).toBe(false);
        expect(
            settings.has(
                genForegroundComponentTransitionSettingName('stopwatch'),
            ),
        ).toBe(false);
        // Not the session list's namespace (`foreground-<key>-sessions`).
        expect(genForegroundComponentTransitionSettingName('time')).toBe(
            'foreground-component-transition-time',
        );
    });
});
