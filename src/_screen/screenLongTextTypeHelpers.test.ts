import { describe, expect, test } from 'vitest';

import {
    checkIsLongTextData,
    checkIsValidLongTextData,
    genLongTextColumnCss,
    genLongTextFontFamilyCss,
    getBibleItemData,
    readLongTextColumnStyle,
    toLongTextColumns,
    toLongTextSectionKey,
    withLongTextColumnStyles,
} from './screenLongTextTypeHelpers';
import type { LocaleType } from '../lang/langHelpers';
import type {
    BibleItemDataType,
    LongTextItemDataType,
} from './screenTypeHelpers';

function genLongTextData(): LongTextItemDataType {
    return {
        type: 'long-text',
        locale: 'xx-XX',
        scroll: 0.4,
        selectedKJVVerseKey: 'lt-2',
        longTextData: {
            sourceId: 'long-text',
            renderedList: [
                {
                    locale: 'xx-XX' as LocaleType,
                    code: 'XX',
                    title: '♪ ✝',
                    sections: [
                        { num: '①', text: 'Line ①', key: 'lt-1' },
                        { num: '②', text: 'Line ②', key: 'lt-2' },
                    ],
                },
                {
                    locale: 'en-US',
                    code: 'EN',
                    title: 'Song',
                    sections: [
                        { num: '1', text: 'Line 1', key: 'lt-1' },
                        { num: '2', text: 'Line 2', key: 'lt-2' },
                    ],
                    style: { fontSizeScale: 0.8 },
                },
            ],
        },
    };
}

function genBibleData(): BibleItemDataType {
    return {
        type: 'bible-item',
        locale: 'en-US',
        scroll: 0,
        selectedKJVVerseKey: null,
        bibleItemData: {
            bibleItem: {
                id: 1,
                bibleKey: 'KJV',
                target: {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 1,
                    verseEnd: 1,
                },
                metadata: {},
            },
            renderedList: [
                {
                    locale: 'en-US',
                    bibleKey: 'KJV',
                    title: 'Genesis 1:1',
                    verses: [
                        {
                            num: '1',
                            text: 'In the beginning',
                            verseKey: '(KJV) GEN 1:1',
                            kjvVerseKey: 'GEN 1:1',
                        },
                    ],
                },
            ],
        },
    };
}

describe('a long-text column style', () => {
    test('keeps only its family and its size, each while it holds a usable value', () => {
        expect(
            readLongTextColumnStyle({
                fontFamily: '  Noto   Sans  ',
                fontSizeScale: 0.8,
            }),
        ).toEqual({
            fontFamily: 'Noto Sans',
            fontSizeScale: 0.8,
        });
    });

    test('a column saved with a colour, a weight or a side of its own is read without them', () => {
        // Everything else is Bible/LongText Properties', for every language.
        expect(
            readLongTextColumnStyle({
                fontFamily: 'Georgia',
                fontWeight: '700',
                color: '#AABBCC',
                textAlign: 'center',
            }),
        ).toEqual({ fontFamily: 'Georgia' });
        expect(
            readLongTextColumnStyle({ color: '#ffffff', textAlign: 'right' }),
        ).toBeUndefined();
    });

    test('drops what could not be drawn, and is undefined when nothing is left', () => {
        expect(
            readLongTextColumnStyle({
                fontFamily: 'a /* b',
                fontSizeScale: Number.NaN,
            }),
        ).toBeUndefined();
        expect(readLongTextColumnStyle(null)).toBeUndefined();
        expect(readLongTextColumnStyle('bold')).toBeUndefined();
        // The size the screen already has is not a size of the column's own.
        expect(readLongTextColumnStyle({ fontSizeScale: 1 })).toBeUndefined();
    });

    test('never writes a key holding undefined', () => {
        const style = readLongTextColumnStyle({
            fontSizeScale: 0.6,
            fontFamily: undefined,
        });
        expect(Object.keys(style ?? {})).toEqual(['fontSizeScale']);
    });

    test('takes what could close a CSS string out of a family, and clamps the size', () => {
        expect(
            readLongTextColumnStyle({ fontFamily: 'A"; color: red; "B' }),
        ).toEqual({ fontFamily: 'A color: red B' });
        expect(readLongTextColumnStyle({ fontSizeScale: 9 })).toEqual({
            fontSizeScale: 2,
        });
        expect(readLongTextColumnStyle({ fontSizeScale: 0.1 })).toEqual({
            fontSizeScale: 0.5,
        });
        expect(readLongTextColumnStyle({ fontSizeScale: 0.8349 })).toEqual({
            fontSizeScale: 0.83,
        });
    });
});

describe('a long-text column in CSS', () => {
    test('says its own family ahead of the language font, without the screen variable', () => {
        const css = genLongTextFontFamilyCss('Georgia', 'app-Xx-Face');
        expect(css.startsWith('"Georgia", app-Xx-Face, ')).toBe(true);
        expect(css).not.toContain('var(');
        expect(
            genLongTextFontFamilyCss('Georgia').startsWith('"Georgia", '),
        ).toBe(true);
    });

    test('writes nothing for a column that follows the screen size', () => {
        expect(genLongTextColumnCss(0, undefined)).toBe('');
        // A family is said inline, not here.
        expect(genLongTextColumnCss(0, { fontFamily: 'Georgia' })).toBe('');
    });

    test('its size is in em of the screen size, on what carries the column class', () => {
        // A cell, or -- stacked -- that language's lines in the one cell.
        expect(genLongTextColumnCss(1, { fontSizeScale: 0.8 })).toBe(
            '#bible-screen-view .screen-long-text-column-1 ' +
                '{ font-size: 0.8em; }',
        );
    });
});

describe('the data of the long-text layer', () => {
    test('a section key is short, ASCII and what a virtual display lets through', () => {
        expect(toLongTextSectionKey(0)).toBe('lt-1');
        // `electron/virtualDisplayProtocol.ts` accepts a selected key only
        // when it matches this.
        expect(toLongTextSectionKey(11)).toMatch(/^[\w .:-]{1,64}$/);
    });

    test('tells a long text from a Bible passage', () => {
        expect(checkIsLongTextData(genLongTextData())).toBe(true);
        expect(checkIsLongTextData(genBibleData())).toBe(false);
        expect(checkIsLongTextData(null)).toBe(false);
        expect(getBibleItemData(genLongTextData())).toBeUndefined();
        expect(getBibleItemData(null)).toBeUndefined();
        expect(getBibleItemData(genBibleData())?.bibleItem.bibleKey).toBe(
            'KJV',
        );
    });

    test('reads either source as columns', () => {
        const longText = genLongTextData();
        expect(toLongTextColumns(longText)).toBe(
            longText.longTextData.renderedList,
        );
        expect(toLongTextColumns(genBibleData())).toEqual([
            {
                locale: 'en-US',
                code: 'KJV',
                title: 'Genesis 1:1',
                sections: [
                    {
                        num: '1',
                        text: 'In the beginning',
                        key: 'GEN 1:1',
                        verseKey: '(KJV) GEN 1:1',
                    },
                ],
            },
        ]);
    });

    test('validates a persisted long text by its shape and its locales', () => {
        const { longTextData } = genLongTextData();
        const checkIsValidLocale = (locale: string) => {
            return locale === 'xx-XX' || locale === 'en-US';
        };
        expect(checkIsValidLongTextData(longTextData, checkIsValidLocale)).toBe(
            true,
        );
        expect(
            checkIsValidLongTextData(longTextData, () => {
                return false;
            }),
        ).toBe(false);
        expect(
            checkIsValidLongTextData(
                { ...longTextData, sourceId: undefined },
                checkIsValidLocale,
            ),
        ).toBe(false);
        expect(
            checkIsValidLongTextData(
                {
                    ...longTextData,
                    renderedList: [
                        {
                            ...longTextData.renderedList[0],
                            sections: [{ num: 1, text: 'x', key: 'lt-1' }],
                        },
                    ],
                },
                checkIsValidLocale,
            ),
        ).toBe(false);
        expect(checkIsValidLongTextData(undefined, checkIsValidLocale)).toBe(
            false,
        );
    });

    test('restyles the columns by code and keeps the words, the position and the selection', () => {
        const data = genLongTextData();
        const restyled = withLongTextColumnStyles(data, {
            XX: { fontFamily: 'Made Up Sans', fontSizeScale: 1.2 },
            EN: undefined,
        });
        const [xx, en] = restyled.longTextData.renderedList;
        expect(xx.style).toEqual({
            fontFamily: 'Made Up Sans',
            fontSizeScale: 1.2,
        });
        // EN is named with no style, so the size it had is gone -- and the
        // key with it, not left behind holding `undefined`.
        expect('style' in en).toBe(false);
        expect(restyled.scroll).toBe(0.4);
        expect(restyled.selectedKJVVerseKey).toBe('lt-2');
        expect(restyled.longTextData.sourceId).toBe('long-text');
        expect(xx.sections).toEqual(data.longTextData.renderedList[0].sections);
        // A column nobody names is left exactly as it is.
        expect(
            withLongTextColumnStyles(data, { XX: { fontFamily: 'Georgia' } })
                .longTextData.renderedList[1],
        ).toBe(data.longTextData.renderedList[1]);
        // The data on the screen is not written through.
        expect(data.longTextData.renderedList[0].style).toBeUndefined();
        expect(data.longTextData.renderedList[1].style).toEqual({
            fontSizeScale: 0.8,
        });
    });
});
