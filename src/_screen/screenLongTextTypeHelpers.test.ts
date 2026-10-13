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
import type {
    BibleItemDataType,
    LongTextItemDataType,
} from './screenTypeHelpers';

function genLongTextData(): LongTextItemDataType {
    return {
        type: 'long-text',
        locale: 'km-KH',
        scroll: 0.4,
        selectedKJVVerseKey: 'lt-2',
        longTextData: {
            sourceId: 'long-text',
            renderedList: [
                {
                    locale: 'km-KH',
                    code: 'KM',
                    title: 'ចម្រៀង',
                    sections: [
                        { num: '១', text: 'បន្ទាត់ ១', key: 'lt-1' },
                        { num: '២', text: 'បន្ទាត់ ២', key: 'lt-2' },
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
                    style: { color: '#ff0000' },
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
    test('keeps only the keys that hold a usable value', () => {
        expect(
            readLongTextColumnStyle({
                fontFamily: '  Noto   Sans  ',
                fontWeight: '700',
                color: '#AABBCC',
                fontSizeScale: 0.8,
                textAlign: 'center',
            }),
        ).toEqual({
            fontFamily: 'Noto Sans',
            fontWeight: '700',
            color: '#AABBCC',
            fontSizeScale: 0.8,
            textAlign: 'center',
        });
    });

    test('drops what could not be drawn, and is undefined when nothing is left', () => {
        expect(
            readLongTextColumnStyle({
                fontFamily: 'a /* b',
                fontWeight: 'bold',
                color: 'red; } body { display: none',
                fontSizeScale: Number.NaN,
                textAlign: 'justify',
            }),
        ).toBeUndefined();
        expect(readLongTextColumnStyle(null)).toBeUndefined();
        expect(readLongTextColumnStyle('bold')).toBeUndefined();
        // The size the screen already has is not a size of the column's own.
        expect(readLongTextColumnStyle({ fontSizeScale: 1 })).toBeUndefined();
    });

    test('never writes a key holding undefined', () => {
        const style = readLongTextColumnStyle({
            color: '#000000',
            fontFamily: undefined,
            textAlign: undefined,
        });
        expect(Object.keys(style ?? {})).toEqual(['color']);
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
        const css = genLongTextFontFamilyCss('Georgia', 'app-Battambang');
        expect(css.startsWith('"Georgia", app-Battambang, ')).toBe(true);
        expect(css).not.toContain('var(');
        expect(
            genLongTextFontFamilyCss('Georgia').startsWith('"Georgia", '),
        ).toBe(true);
    });

    test('writes nothing for an unstyled column', () => {
        expect(genLongTextColumnCss(0, undefined, false)).toBe('');
    });

    test('puts colour and weight on cell and header, the size on the cell only', () => {
        const css = genLongTextColumnCss(
            1,
            { color: '#112233', fontWeight: '300', fontSizeScale: 0.8 },
            false,
        );
        expect(css).toContain(
            '#bible-screen-view td.screen-long-text-column-1, ' +
                '#bible-screen-view th.screen-long-text-column-1 ' +
                '{ color: #112233; font-weight: 300; }',
        );
        expect(css).toContain(
            '#bible-screen-view td.screen-long-text-column-1 ' +
                '{ font-size: 0.8em; }',
        );
        expect(css).not.toContain('th.screen-long-text-column-1 { font-size');
    });

    test('aligns by class and !important, the header following the reading direction', () => {
        const left = genLongTextColumnCss(0, { textAlign: 'left' }, false);
        expect(left).toContain(
            '#bible-screen-view td.screen-long-text-column-0 ' +
                '{ text-align: left !important; }',
        );
        expect(left).toContain('> div { justify-content: flex-start; }');
        // Right to left, the start of the header's row is its right edge.
        expect(genLongTextColumnCss(0, { textAlign: 'left' }, true)).toContain(
            '> div { justify-content: flex-end; }',
        );
        expect(
            genLongTextColumnCss(0, { textAlign: 'center' }, true),
        ).toContain('> div { justify-content: center; }');
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
            return locale === 'km-KH' || locale === 'en-US';
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
            KM: { fontFamily: 'Battambang', textAlign: 'center' },
            EN: undefined,
        });
        const [km, en] = restyled.longTextData.renderedList;
        expect(km.style).toEqual({
            fontFamily: 'Battambang',
            textAlign: 'center',
        });
        // EN is named with no style, so the colour it had is gone -- and the
        // key with it, not left behind holding `undefined`.
        expect('style' in en).toBe(false);
        expect(restyled.scroll).toBe(0.4);
        expect(restyled.selectedKJVVerseKey).toBe('lt-2');
        expect(restyled.longTextData.sourceId).toBe('long-text');
        expect(km.sections).toEqual(data.longTextData.renderedList[0].sections);
        // A column nobody names is left exactly as it is.
        expect(
            withLongTextColumnStyles(data, { KM: { color: '#000000' } })
                .longTextData.renderedList[1],
        ).toBe(data.longTextData.renderedList[1]);
        // The data on the screen is not written through.
        expect(data.longTextData.renderedList[0].style).toBeUndefined();
        expect(data.longTextData.renderedList[1].style).toEqual({
            color: '#ff0000',
        });
    });
});
