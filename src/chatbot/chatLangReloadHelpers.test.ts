import { describe, expect, test } from 'vitest';

import {
    checkIsLangReloadDue,
    toEnabledLangKey,
} from './chatLangReloadHelpers';

describe('the languages the help window loaded with', () => {
    test('a key of the turned-on languages, in one order', () => {
        expect(
            toEnabledLangKey([
                { langCode: 'xx', version: '0.0.2', isEnabled: true },
                { langCode: 'aa', version: '1.0.0', isEnabled: true },
                { langCode: 'yy', version: '0.0.9', isEnabled: false },
            ]),
        ).toBe('aa@1.0.0,xx@0.0.2');
        expect(toEnabledLangKey([])).toBe('');
    });

    test('a language installed, updated or turned off changes it', () => {
        const before = toEnabledLangKey([
            { langCode: 'xx', version: '0.0.2', isEnabled: true },
        ]);
        expect(
            toEnabledLangKey([
                { langCode: 'xx', version: '0.0.2', isEnabled: true },
                { langCode: 'zz', version: '0.0.1', isEnabled: true },
            ]),
        ).not.toBe(before);
        expect(
            toEnabledLangKey([
                { langCode: 'xx', version: '0.0.3', isEnabled: true },
            ]),
        ).not.toBe(before);
        expect(
            toEnabledLangKey([
                { langCode: 'xx', version: '0.0.2', isEnabled: false },
            ]),
        ).not.toBe(before);
    });
});

describe('when the window loads again', () => {
    test('only for different languages, and only with nothing on its way', () => {
        expect(
            checkIsLangReloadDue({
                loadedKey: 'xx@1',
                currentKey: 'xx@1,zz@1',
                pendingCount: 0,
            }),
        ).toBe(true);
        expect(
            checkIsLangReloadDue({
                loadedKey: 'xx@1',
                currentKey: 'xx@1',
                pendingCount: 0,
            }),
        ).toBe(false);
        expect(
            checkIsLangReloadDue({
                loadedKey: 'xx@1',
                currentKey: 'xx@1,zz@1',
                pendingCount: 1,
            }),
        ).toBe(false);
    });
});
