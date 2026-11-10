import { describe, expect, test } from 'vitest';

import {
    QUICK_TEXT_DEFAULT_MARKDOWN,
    fitQuickTextFontSize,
    formatQuickTextMarkdown,
    stripLineMarks,
} from './quickTextFormatHelpers';

describe('a Quick Text preset sets the words, every one kept', () => {
    test('a title loses the marks it had, whichever they were', () => {
        expect(stripLineMarks('## Pastor John')).toBe('Pastor John');
        expect(stripLineMarks('**Pastor John**')).toBe('Pastor John');
        expect(stripLineMarks('*Pastor John*')).toBe('Pastor John');
        expect(stripLineMarks('__Pastor John__')).toBe('Pastor John');
        // Bold inside italics is not one pair, and is left alone.
        expect(stripLineMarks('***both***')).toBe('***both***');
        expect(stripLineMarks('plain')).toBe('plain');
    });

    test('the first line is the title in the format, the rest the body', () => {
        const text = 'Pastor John\nSenior Pastor\n\nGrace Church';
        expect(
            formatQuickTextMarkdown(text, { title: 'h3', isBodyItalic: false }),
        ).toBe('### Pastor John\n\nSenior Pastor\n\nGrace Church');
        expect(
            formatQuickTextMarkdown(text, {
                title: 'bold',
                isBodyItalic: true,
            }),
        ).toBe('**Pastor John**\n\n*Senior Pastor*\n\n*Grace Church*');
    });

    test('pressed twice, or one format after another, it is the same', () => {
        const once = formatQuickTextMarkdown(QUICK_TEXT_DEFAULT_MARKDOWN, {
            title: 'h2',
            isBodyItalic: true,
        });
        expect(
            formatQuickTextMarkdown(once, { title: 'h2', isBodyItalic: true }),
        ).toBe(once);
        expect(
            formatQuickTextMarkdown(once, {
                title: 'bold',
                isBodyItalic: false,
            }),
        ).toBe(
            // The body's italics stay: a format without them leaves the
            // body as it is.
            '**This is Title**\n\ntext **bold** and *italic*.',
        );
    });

    test('an upright format takes back the italics an italic one put on', () => {
        const sermon = formatQuickTextMarkdown(
            'John 3:16\n\nFor God so loved the world\nthat he gave',
            { title: 'h2', isBodyItalic: true },
        );
        expect(sermon).toBe(
            '## John 3:16\n\n*For God so loved the world*\n*that he gave*',
        );
        expect(
            formatQuickTextMarkdown(sermon, {
                title: 'bold',
                isBodyItalic: false,
            }),
        ).toBe('**John 3:16**\n\nFor God so loved the world\nthat he gave');
        // A bold line of the body is the person's, and stays bold.
        expect(
            formatQuickTextMarkdown('Title\n\n**Kept bold**', {
                title: 'h3',
                isBodyItalic: false,
            }),
        ).toBe('### Title\n\n**Kept bold**');
    });

    test('a body line with emphasis of its own is not wrapped again', () => {
        expect(
            formatQuickTextMarkdown('Title\n\ntext **bold** and more', {
                title: 'bold',
                isBodyItalic: true,
            }),
        ).toBe('**Title**\n\ntext **bold** and more');
    });

    test('an empty box stays empty, and leading blank lines are dropped', () => {
        expect(
            formatQuickTextMarkdown('', { title: 'h2', isBodyItalic: false }),
        ).toBe('');
        expect(
            formatQuickTextMarkdown('\r\n\r\nHello\r\nWorld', {
                title: 'h2',
                isBodyItalic: false,
            }),
        ).toBe('## Hello\n\nWorld');
    });
});

describe('a Bible Verse look fits a long passage', () => {
    test('one verse keeps the full size; a long passage shrinks, not below the floor', () => {
        const verse =
            '**(KJV) John 3:16**\n\nFor God so loved the world, that he gave ' +
            'his only begotten Son, that whosoever believeth in him should ' +
            'not perish.';
        expect(fitQuickTextFontSize(verse, 44, 28)).toBe(44);
        // Three verses or so keep the full size; twice that is set smaller.
        expect(fitQuickTextFontSize('word '.repeat(64), 44, 28)).toBe(44);
        expect(fitQuickTextFontSize('word '.repeat(200), 44, 28)).toBe(30);
        expect(fitQuickTextFontSize('word '.repeat(400), 44, 28)).toBe(28);
        // Marks and doubled spaces do not count as words.
        expect(fitQuickTextFontSize(`**${'a'.repeat(158)}**   `, 44, 28)).toBe(
            44,
        );
    });
});
