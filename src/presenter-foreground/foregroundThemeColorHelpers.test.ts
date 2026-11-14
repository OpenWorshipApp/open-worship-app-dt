// @vitest-environment jsdom

import { afterEach, describe, expect, test } from 'vitest';

import {
    checkIsAppDarkTheme,
    getForegroundDefaultColors,
} from './foregroundThemeColorHelpers';

afterEach(() => {
    document.body.innerHTML = '';
});

describe("a foreground's default colours follow the app theme", () => {
    test('read off the page root, dark where there is none', () => {
        expect(checkIsAppDarkTheme()).toBe(true);
        document.body.innerHTML =
            '<div id="app" class="app" data-bs-theme="light"></div>';
        expect(checkIsAppDarkTheme()).toBe(false);
        expect(getForegroundDefaultColors().color).toBe('#000000');
        document.getElementById('app')!.setAttribute('data-bs-theme', 'dark');
        expect(getForegroundDefaultColors()).toEqual({
            color: '#FFFFFF',
            backgroundColor: '#000080AA',
        });
    });
});
