import { describe, expect, test } from 'vitest';

import { genStickyAutoHideChecker } from './stickyAutoHideHelpers';

describe('genStickyAutoHideChecker', () => {
    test('should hide after scrolling down past the jitter threshold', () => {
        const check = genStickyAutoHideChecker(0, 0);
        expect(check(2, 16)).toBe(false); // still at the top
        expect(check(60, 32)).toBe(true);
    });

    test('should ignore tiny movements', () => {
        const check = genStickyAutoHideChecker(100, 0);
        expect(check(105, 16)).toBe(null);
        expect(check(105, 32)).toBe(null);
    });

    test('should show again on a fast scroll up', () => {
        const check = genStickyAutoHideChecker(0, 0);
        expect(check(300, 16)).toBe(true);
        expect(check(200, 32)).toBe(false);
    });

    test('should stay hidden on a slow scroll up', () => {
        const check = genStickyAutoHideChecker(0, 0);
        expect(check(300, 16)).toBe(true);
        let timestamp = 16;
        let scrollTop = 300;
        for (let i = 0; i < 10; i++) {
            scrollTop -= 5;
            timestamp += 100;
            expect(check(scrollTop, timestamp)).toBe(null);
        }
    });

    test('should always show when the content is back at the top', () => {
        const check = genStickyAutoHideChecker(0, 0);
        expect(check(300, 16)).toBe(true);
        expect(check(0, 5e3)).toBe(false);
    });
});
