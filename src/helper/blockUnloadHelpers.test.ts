// @vitest-environment jsdom

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    type Mock,
    test,
    vi,
} from 'vitest';

import { genBlockUnload } from './blockUnloadHelpers';

let showWarning: Mock<() => void>;
let blockUnload: (event: BeforeUnloadEvent) => void;

// One attempt to close the window: true when the guard held it open.
function tryToLeave() {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
}

function guard(checkShouldBlock?: () => boolean) {
    blockUnload = genBlockUnload(showWarning, checkShouldBlock);
    window.addEventListener('beforeunload', blockUnload);
}

beforeEach(() => {
    vi.useFakeTimers();
    showWarning = vi.fn();
});

afterEach(() => {
    window.removeEventListener('beforeunload', blockUnload);
    vi.useRealTimers();
});

describe('genBlockUnload', () => {
    test('holds three attempts with a warning, then lets the fourth leave', () => {
        guard();
        expect([tryToLeave(), tryToLeave(), tryToLeave()]).toEqual([
            true,
            true,
            true,
        ]);
        expect(showWarning).toHaveBeenCalledTimes(3);

        expect(tryToLeave()).toBe(false);
        expect(showWarning).toHaveBeenCalledTimes(3);

        // It let itself go: even after the count has started over, nothing
        // holds the window any more.
        vi.advanceTimersByTime(3000);
        expect(tryToLeave()).toBe(false);
        expect(showWarning).toHaveBeenCalledTimes(3);
    });

    test('three quiet seconds start the count over', () => {
        guard();
        tryToLeave();
        tryToLeave();
        vi.advanceTimersByTime(3000);
        expect([tryToLeave(), tryToLeave(), tryToLeave()]).toEqual([
            true,
            true,
            true,
        ]);
        expect(showWarning).toHaveBeenCalledTimes(5);
    });

    test('each attempt restarts the quiet time, so steady attempts add up', () => {
        guard();
        const held = [tryToLeave()];
        for (let index = 0; index < 3; index++) {
            vi.advanceTimersByTime(2999);
            held.push(tryToLeave());
        }
        expect(held).toEqual([true, true, true, false]);
    });

    test('with nothing to protect it lets go at once, without a warning', () => {
        let isBusy = false;
        guard(() => isBusy);
        expect(tryToLeave()).toBe(false);
        expect(showWarning).not.toHaveBeenCalled();

        // It removed itself: becoming busy later is not guarded until the
        // caller adds it again, as the media guard does on the next play.
        isBusy = true;
        expect(tryToLeave()).toBe(false);
        window.addEventListener('beforeunload', blockUnload);
        expect(tryToLeave()).toBe(true);
        expect(showWarning).toHaveBeenCalledOnce();
    });
});
