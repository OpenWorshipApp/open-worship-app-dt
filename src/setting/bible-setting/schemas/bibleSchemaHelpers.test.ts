import { describe, expect, test } from 'vitest';
import type { SchemaNode } from 'json-schema-library';

import {
    bookChapterEditorSchemaHandler,
    extraEditorSchemaHandler,
    infoEditorSchemaHandler,
} from './bibleSchemaHelpers';

// The three Bible editors' schemas, compiled for real: what each lets through
// and what it stops before a Bible part is saved or read back from a backup.
function check(handler: SchemaNode, data: unknown) {
    const { valid, errors } = handler.validate(data);
    return {
        valid,
        errors: errors.map((error) => `${error.code} ${error.data.pointer}`),
    };
}

const digits = Object.fromEntries(
    [...'0123456789'].map((digit) => [digit, digit]),
);
const info = {
    title: 'King James Version',
    key: 'KJV',
    version: 1,
    locale: 'en-US',
    legalNote: 'Public domain',
    publisher: 'Crown',
    copyRights: 'None',
    numbersMap: digits,
    keyBookMap: { GEN: 'Genesis', EXO: 'Exodus' },
    booksAvailable: ['GEN', 'EXO'],
};
const chapter = {
    bibleKey: 'KJV',
    bookKey: 'GEN',
    chapter: 1,
    verses: { '1': 'In the beginning' },
    newLines: ['GEN 1:1'],
    newLinesTitleMap: { 'GEN 1:1': [{ content: 'The Creation' }] },
    customVersesMap: {},
};
const extra = {
    bibleKey: 'KJV',
    newLines: ['GEN 1:1'],
    newLinesTitleMap: {
        'GEN 1:1': [{ content: 'The Creation', cssStyle: 'color: red' }],
    },
    customVersesMap: {
        'GEN 1:2': [{ content: 'And the earth', isHtml: false }],
    },
};

// Found by UT-83 (2026-11-03): the book chapter schema carried the extra
// schema's `$id`. `BibleXMLDataPreviewComp` registers all three with Monaco
// under their `$id`, and a schema registered under a taken id replaces the
// one before it -- so the Extra editor was checked against the chapter's
// rules while it was typed in.
test('each schema names itself, so no editor is checked by another', () => {
    expect(
        [
            infoEditorSchemaHandler,
            extraEditorSchemaHandler,
            bookChapterEditorSchemaHandler,
        ].map((handler) => {
            return handler.schema.$id;
        }),
    ).toEqual([
        'https://wwww.openworship.app/schemas/bibleInfoSchema.json',
        'https://wwww.openworship.app/schemas/bibleExtraSchema.json',
        'https://wwww.openworship.app/schemas/bibleBookChapterSchema.json',
    ]);
});

describe('the Bible info schema', () => {
    test('a complete info passes', () => {
        expect(check(infoEditorSchemaHandler, info)).toEqual({
            valid: true,
            errors: [],
        });
    });

    test.each([
        [
            'a locale it does not know',
            { locale: 'xx-YY' },
            'enum-error #/locale',
        ],
        ['a version written as text', { version: '1' }, 'type-error #/version'],
        ['an empty title', { title: '' }, 'min-length-error #/title'],
        [
            'a property it does not know',
            { other: true },
            'no-additional-properties-error #/other',
        ],
        [
            'a book name under a lowercase key',
            { keyBookMap: { gen: 'Genesis' } },
            'no-additional-properties-error #/keyBookMap/gen',
        ],
    ])('stops %s', (_name, change, error) => {
        expect(check(infoEditorSchemaHandler, { ...info, ...change })).toEqual({
            valid: false,
            errors: [error],
        });
    });

    test('every digit and the key are required', () => {
        const { '9': _nine, ...nineDigits } = digits;
        const { key: _key, ...noKey } = info;
        const result = check(infoEditorSchemaHandler, {
            ...noKey,
            numbersMap: nineDigits,
        });
        expect(result.valid).toBe(false);
        expect(result.errors.sort()).toEqual([
            'required-property-error #',
            'required-property-error #/numbersMap',
        ]);
    });
});

describe('the book chapter schema', () => {
    test('a chapter with its new lines and titles passes', () => {
        expect(check(bookChapterEditorSchemaHandler, chapter)).toEqual({
            valid: true,
            errors: [],
        });
    });

    test.each([
        ['a lowercase book key', { bookKey: 'gen' }, 'pattern-error #/bookKey'],
        ['a chapter below 0', { chapter: -1 }, 'minimum-error #/chapter'],
        [
            'a chapter that is no whole number',
            { chapter: 1.5 },
            'type-error #/chapter',
        ],
        [
            'a verse 0',
            { verses: { '0': 'Before' } },
            'no-additional-properties-error #/verses/0',
        ],
        [
            'an empty title',
            { newLinesTitleMap: { 'GEN 1:1': [{ content: '' }] } },
            'min-length-error #/newLinesTitleMap/GEN 1:1/0/content',
        ],
        [
            'a title under a key that is no verse',
            {
                newLinesTitleMap: {
                    'Genesis 1': [{ content: 'The Creation' }],
                },
            },
            'no-additional-properties-error #/newLinesTitleMap/Genesis 1',
        ],
        [
            'a custom verse marked HTML with text',
            {
                customVersesMap: {
                    'GEN 1:1': [{ content: 'x', isHtml: 'yes' }],
                },
            },
            'type-error #/customVersesMap/GEN 1:1/0/isHtml',
        ],
    ])('stops %s', (_name, change, error) => {
        expect(
            check(bookChapterEditorSchemaHandler, { ...chapter, ...change }),
        ).toEqual({ valid: false, errors: [error] });
    });

    test('the three maps are required, the Bible key is not', () => {
        const { newLines: _newLines, bibleKey: _bibleKey, ...rest } = chapter;
        expect(check(bookChapterEditorSchemaHandler, rest)).toEqual({
            valid: false,
            errors: ['required-property-error #'],
        });
    });
});

describe('the extra schema', () => {
    test('new lines, titles and custom verses pass', () => {
        expect(check(extraEditorSchemaHandler, extra)).toEqual({
            valid: true,
            errors: [],
        });
    });

    test.each([
        [
            'the same new line twice',
            { newLines: ['GEN 1:1', 'GEN 1:1'] },
            'unique-items-error #/newLines/1',
        ],
        [
            'a new line that is no verse key',
            { newLines: ['Genesis 1:1'] },
            'pattern-error #/newLines/0',
        ],
        [
            'a title with a property it does not know',
            {
                newLinesTitleMap: {
                    'GEN 1:1': [{ content: 'x', bold: true }],
                },
            },
            'no-additional-properties-error #/newLinesTitleMap/GEN 1:1/0/bold',
        ],
        [
            'an empty custom verse',
            { customVersesMap: { 'GEN 1:1': [{ content: '' }] } },
            'min-length-error #/customVersesMap/GEN 1:1/0/content',
        ],
    ])('stops %s', (_name, change, error) => {
        expect(
            check(extraEditorSchemaHandler, { ...extra, ...change }),
        ).toEqual({ valid: false, errors: [error] });
    });

    test('needs the Bible key and takes no chapter text', () => {
        const { bibleKey: _bibleKey, ...noKey } = extra;
        expect(check(extraEditorSchemaHandler, noKey).errors).toEqual([
            'required-property-error #',
        ]);
        // A chapter's own fields belong to the chapter editor alone.
        expect(check(extraEditorSchemaHandler, chapter).errors).toEqual([
            'no-additional-properties-error #/bookKey',
            'no-additional-properties-error #/chapter',
            'no-additional-properties-error #/verses',
        ]);
    });
});
