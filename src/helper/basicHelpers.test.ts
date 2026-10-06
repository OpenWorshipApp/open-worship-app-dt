import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    sanitizeCssValue,
    escapeHtmlText,
    sanitizeHtml,
    sanitizeSlideHtml,
} from './sanitizeHelpers';
import { genTimeoutAttempt } from './timeoutHelpers';

describe('sanitizeHelpers', () => {
    test.each([sanitizeHtml, sanitizeSlideHtml])(
        'imports safely in Node but refuses HTML without a DOM: %s',
        (sanitize) => {
            expect(sanitize('')).toBe('');
            expect(() => sanitize('<img onerror="unsafe()">')).toThrow(
                'HTML sanitization requires a DOM',
            );
        },
    );

    test('escapes plain text before composing markup', () => {
        expect(escapeHtmlText('<b>"Text" & more</b>')).toBe(
            '&lt;b&gt;&quot;Text&quot; &amp; more&lt;/b&gt;',
        );
    });

    test('sanitizeCssValue strips CSS-breaking characters', () => {
        expect(sanitizeCssValue('10px; color:{red} "x" \\<tag>')).toBe(
            '10px color:red x tag',
        );
    });
});

describe('timeoutHelpers', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('runs the callback after the timeout when scheduled normally', () => {
        const callback = vi.fn();
        const attempt = genTimeoutAttempt(1000);

        attempt(callback);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(999);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('debounces older scheduled callbacks', () => {
        const first = vi.fn();
        const second = vi.fn();
        const attempt = genTimeoutAttempt(1000);

        attempt(first);
        vi.advanceTimersByTime(250);
        attempt(second);
        vi.advanceTimersByTime(1000);

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    test('runs immediately when requested', () => {
        const callback = vi.fn();
        const attempt = genTimeoutAttempt(1000);

        attempt(callback, true);

        expect(callback).toHaveBeenCalledTimes(1);
        vi.runAllTimers();
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('can bypass waiting when enough time has elapsed', () => {
        const immediate = vi.fn();
        const delayed = vi.fn();
        const attempt = genTimeoutAttempt(1000, false);

        attempt(immediate);
        expect(immediate).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(500);
        attempt(delayed);
        expect(delayed).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(delayed).toHaveBeenCalledTimes(1);
    });
});
