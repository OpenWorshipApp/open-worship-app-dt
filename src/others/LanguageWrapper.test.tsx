// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    getBibleLocale: vi.fn(),
    checkIsValidLocale: vi.fn(),
    getFontFamilyByLocale: vi.fn(),
}));

vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: state.getBibleLocale,
}));
vi.mock('../lang/langHelpers', () => ({
    checkIsValidLocale: state.checkIsValidLocale,
    getFontFamilyByLocale: state.getFontFamilyByLocale,
}));

import { applyFontFamily } from './LanguageWrapper';

const FONTS: Record<string, string> = {
    'xx-XX': 'Made Up Sans',
    'en-US': 'Arial',
};

beforeEach(() => {
    state.checkIsValidLocale.mockImplementation((locale: string) =>
        ['xx-XX', 'en-US', 'yy-YY'].includes(locale),
    );
    state.getFontFamilyByLocale.mockImplementation(
        async (locale: string) => FONTS[locale],
    );
    state.getBibleLocale.mockImplementation(async (bibleKey: string) =>
        bibleKey === 'XXV' ? 'xx-XX' : 'en-US',
    );
});

async function flush() {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}

function genElement(html: string) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    return wrapper.firstElementChild as HTMLElement;
}

describe('applyFontFamily', () => {
    test('an element with its own locale gets that locale font', async () => {
        const element = genElement('<p data-locale-ff="xx-XX">✝✝</p>');
        await applyFontFamily(element, 'attr-modified');
        expect(element.style.fontFamily).toBe('Made Up Sans');
        expect(state.getBibleLocale).not.toHaveBeenCalled();
    });

    test('an element naming a bible gets the bible locale font', async () => {
        const element = genElement('<p data-bible-key-ff="XXV">✝✝</p>');
        await applyFontFamily(element, 'attr-modified');
        expect(state.getBibleLocale).toHaveBeenCalledExactlyOnceWith('XXV');
        expect(element.style.fontFamily).toBe('Made Up Sans');
    });

    test('an unknown locale changes nothing', async () => {
        const element = genElement('<p data-locale-ff="zz-ZZ">?</p>');
        await applyFontFamily(element, 'attr-modified');
        expect(state.getFontFamilyByLocale).not.toHaveBeenCalled();
        expect(element.style.fontFamily).toBe('');
    });

    test('a locale with no font of its own changes nothing', async () => {
        const element = genElement('<p data-locale-ff="yy-YY">word</p>');
        await applyFontFamily(element, 'attr-modified');
        expect(state.getFontFamilyByLocale).toHaveBeenCalledWith('yy-YY');
        expect(element.style.fontFamily).toBe('');
    });

    test('an element with neither attribute is left alone', async () => {
        const element = genElement('<p>plain</p>');
        await applyFontFamily(element, 'attr-modified');
        expect(state.checkIsValidLocale).not.toHaveBeenCalled();
        expect(element.style.fontFamily).toBe('');
    });

    test('an added subtree is walked, a modified element is not', async () => {
        const html =
            '<div><span data-locale-ff="xx-XX">✝♪</span>' +
            '<em><b data-bible-key-ff="KJV">b</b></em></div>';
        const modified = genElement(html);
        await applyFontFamily(modified, 'attr-modified');
        await flush();
        expect(
            modified.querySelector<HTMLElement>('span')!.style.fontFamily,
        ).toBe('');

        const added = genElement(html);
        await applyFontFamily(added, 'added');
        await flush();
        expect(added.querySelector<HTMLElement>('span')!.style.fontFamily).toBe(
            'Made Up Sans',
        );
        expect(added.querySelector<HTMLElement>('b')!.style.fontFamily).toBe(
            'Arial',
        );
    });

    test('a node that is not an element is ignored', async () => {
        await applyFontFamily(document.createTextNode('text'), 'added');
        expect(state.checkIsValidLocale).not.toHaveBeenCalled();
    });
});
