// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

type FakePurifierType = {
    isSupported: boolean;
    removed: unknown[];
    setConfig: (config: unknown) => void;
    addHook: () => void;
    sanitize: (dirty: string) => string;
};

// A stand-in DOMPurify: whether the next purifier it builds can work, how
// many it has built, and the last one, so a test can look at what was left
// on it after a sanitize.
const { purifiers } = vi.hoisted(() => ({
    purifiers: {
        isSupported: true,
        created: 0,
        last: null as FakePurifierType | null,
    },
}));

vi.mock('dompurify', () => ({
    default: () => {
        purifiers.created += 1;
        const purifier: FakePurifierType = {
            isSupported: purifiers.isSupported,
            removed: [],
            setConfig: () => {},
            addHook: () => {},
            sanitize: (dirty: string) => {
                if (dirty === 'parser breaks') {
                    throw new Error('parser broke');
                }
                purifier.removed.push({ element: 'script' });
                return `clean(${dirty})`;
            },
        };
        purifiers.last = purifier;
        return purifier;
    },
}));

import {
    sanitizeCssValue,
    sanitizeHtml,
    sanitizeSlideHtml,
} from './sanitizeHelpers';

// The module keeps one purifier per kind for good once one is built, so the
// order below matters: nothing is built until the fourth test.
describe('sanitizeHtml without a working purifier', () => {
    beforeEach(() => {
        purifiers.isSupported = true;
    });

    test('empty HTML needs no purifier at all', () => {
        expect(sanitizeHtml('')).toBe('');
        expect(sanitizeSlideHtml('')).toBe('');
        expect(purifiers.created).toBe(0);
    });

    test('with no DOM at all it refuses before building anything', () => {
        vi.stubGlobal('window', undefined);
        try {
            expect(() => sanitizeSlideHtml('<b>grace</b>')).toThrow(
                'HTML sanitization requires a DOM',
            );
        } finally {
            vi.unstubAllGlobals();
        }
        expect(purifiers.created).toBe(0);
    });

    test('a DOM the purifier cannot work in refuses instead of passing HTML through', () => {
        purifiers.isSupported = false;
        expect(() => sanitizeHtml('<b>grace</b>')).toThrow(
            'HTML sanitization is unavailable',
        );
        expect(() => sanitizeSlideHtml('<b>grace</b>')).toThrow(
            'HTML sanitization is unavailable',
        );
        expect(purifiers.created).toBe(2);
    });

    test('the refusal is not remembered: the next call builds one again', () => {
        const createdBefore = purifiers.created;
        expect(sanitizeHtml('<i>mercy</i>')).toBe('clean(<i>mercy</i>)');
        expect(purifiers.created).toBe(createdBefore + 1);
        // ...and from then on that one purifier is reused.
        expect(sanitizeHtml('<i>peace</i>')).toBe('clean(<i>peace</i>)');
        expect(purifiers.created).toBe(createdBefore + 1);
    });

    test('what a sanitize removed is let go, even when it throws', () => {
        expect(sanitizeHtml('<p>hope</p>')).toBe('clean(<p>hope</p>)');
        const purifier = purifiers.last!;
        expect(purifier.removed).toEqual([]);

        purifier.removed = [{ element: 'iframe' }];
        expect(() => sanitizeHtml('parser breaks')).toThrow('parser broke');
        expect(purifier.removed).toEqual([]);
    });
});

describe('sanitizeCssValue', () => {
    test('strips what could end the value or the rule it sits in', () => {
        expect(sanitizeCssValue('#fff;}body{color:red')).toBe(
            '#fffbodycolor:red',
        );
        expect(sanitizeCssValue('"Made Up Sans", serif')).toBe(
            'Made Up Sans, serif',
        );
        expect(sanitizeCssValue(String.raw`url(\'x\')<style>`)).toBe(
            'url(x)style',
        );
    });
});
