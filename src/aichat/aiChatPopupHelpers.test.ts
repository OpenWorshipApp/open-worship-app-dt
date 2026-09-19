import { describe, expect, test } from 'vitest';

import {
    checkIsPopupRefusedInFront,
    genPopupRefusedText,
    toPopupRefused,
} from './aiChatPopupHelpers';

describe('toPopupRefused', () => {
    test('reads the notice the main process sends', () => {
        expect(toPopupRefused({ guestId: 7, hostname: 'example.com' })).toEqual(
            { guestId: 7, hostname: 'example.com' },
        );
    });

    test('keeps only the two fields it knows', () => {
        expect(
            toPopupRefused({
                guestId: 7,
                hostname: 'example.com',
                url: 'https://example.com/anything',
            }),
        ).toEqual({ guestId: 7, hostname: 'example.com' });
    });

    test('refuses what is not a notice', () => {
        expect(toPopupRefused(null)).toBeNull();
        expect(toPopupRefused('example.com')).toBeNull();
        expect(
            toPopupRefused({ guestId: '7', hostname: 'example.com' }),
        ).toBeNull();
        expect(
            toPopupRefused({ guestId: 1.5, hostname: 'example.com' }),
        ).toBeNull();
        expect(toPopupRefused({ guestId: 7, hostname: '' })).toBeNull();
        expect(
            toPopupRefused({ guestId: 7, hostname: 'a'.repeat(254) }),
        ).toBeNull();
    });
});

describe('checkIsPopupRefusedInFront', () => {
    test('only the guest in front gets a line', () => {
        const refusal = { guestId: 7, hostname: 'example.com' };
        expect(checkIsPopupRefusedInFront(refusal, 7)).toBe(true);
        expect(checkIsPopupRefusedInFront(refusal, 8)).toBe(false);
        expect(checkIsPopupRefusedInFront(refusal, null)).toBe(false);
    });
});

describe('genPopupRefusedText', () => {
    test('names where the page wanted to go and what to do instead', () => {
        const text = genPopupRefusedText('example.com');
        expect(text).toContain('example.com');
        expect(text).toContain('was not opened');
        expect(text).toContain('Press the link again');
    });
});
