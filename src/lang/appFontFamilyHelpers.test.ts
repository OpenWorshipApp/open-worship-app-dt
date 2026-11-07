// @vitest-environment jsdom

import { afterEach, describe, expect, test } from 'vitest';

import {
    APP_FONT_FAMILY_VARIABLE,
    applyAppFontFamily,
    genAppFontFamilyList,
} from './appFontFamilyHelpers';

const DEFAULT_FACE = { fontFamily: 'app-Default-Face' };
const LANG_FACE = { fontFamily: 'app-Lang-Face' };

afterEach(() => {
    document.documentElement.style.removeProperty(APP_FONT_FAMILY_VARIABLE);
    document.body.style.fontFamily = '';
});

describe('the app font list', () => {
    test("puts the selected language's face in front of the default one", () => {
        expect(genAppFontFamilyList(LANG_FACE, DEFAULT_FACE)).toBe(
            'app-Lang-Face, app-Default-Face',
        );
    });

    test('names a face once when the language is the default one', () => {
        expect(genAppFontFamilyList(DEFAULT_FACE, DEFAULT_FACE)).toBe(
            'app-Default-Face',
        );
    });

    test('a language with no face of its own is drawn in the default one', () => {
        expect(genAppFontFamilyList({ fontFamily: '' }, DEFAULT_FACE)).toBe(
            'app-Default-Face',
        );
        expect(genAppFontFamilyList({}, DEFAULT_FACE)).toBe('app-Default-Face');
    });

    test('is empty when neither language has loaded', () => {
        expect(genAppFontFamilyList(null, null)).toBe('');
    });
});

describe('applying the app font', () => {
    test('sets the variable on the page and the stack on its body', () => {
        applyAppFontFamily('app-Lang-Face, app-Default-Face');

        expect(
            document.documentElement.style.getPropertyValue(
                APP_FONT_FAMILY_VARIABLE,
            ),
        ).toBe('app-Lang-Face, app-Default-Face');
        expect(document.body.style.fontFamily).toBe(
            'var(--app-font-family), var(--bs-body-font-family, system-ui, sans-serif)',
        );
    });

    test('an empty list clears what an earlier call set', () => {
        applyAppFontFamily('app-Default-Face');
        applyAppFontFamily('');

        expect(
            document.documentElement.style.getPropertyValue(
                APP_FONT_FAMILY_VARIABLE,
            ),
        ).toBe('');
        expect(document.body.style.fontFamily).toBe('');
    });
});
