import { beforeEach, describe, expect, test, vi } from 'vitest';

const { providerState } = vi.hoisted(() => ({
    providerState: { isPageScreen: false },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        get isPageScreen() {
            return providerState.isPageScreen;
        },
    },
}));

import {
    checkIsPresenterCopySilenced,
    checkIsSoundHere,
} from './screenSoundHelpers';

describe('screenSoundHelpers', () => {
    beforeEach(() => {
        providerState.isPageScreen = false;
    });

    // [window is the screen page, screen is on a virtual display,
    //  sound plays here, presenter copy silenced]
    test.each([
        [false, false, true, false],
        [false, true, false, true],
        [true, false, false, false],
        [true, true, true, false],
    ])(
        'isPageScreen=%s isOnVirtualDisplay=%s',
        (isPageScreen, isOnVirtualDisplay, isSoundHere, isSilenced) => {
            providerState.isPageScreen = isPageScreen;
            const screen = { isOnVirtualDisplay };
            expect(checkIsSoundHere(screen)).toBe(isSoundHere);
            expect(checkIsPresenterCopySilenced(screen)).toBe(isSilenced);
        },
    );

    test('exactly one window plays a screen, wherever it is', () => {
        for (const isOnVirtualDisplay of [false, true]) {
            const screen = { isOnVirtualDisplay };
            providerState.isPageScreen = false;
            const isPresenter = checkIsSoundHere(screen);
            providerState.isPageScreen = true;
            const isScreenPage = checkIsSoundHere(screen);
            expect(isPresenter).not.toBe(isScreenPage);
        }
    });

    test('the screen page never silences itself as a presenter copy', () => {
        providerState.isPageScreen = true;
        expect(checkIsPresenterCopySilenced({ isOnVirtualDisplay: true })).toBe(
            false,
        );
        expect(
            checkIsPresenterCopySilenced({ isOnVirtualDisplay: false }),
        ).toBe(false);
    });
});
