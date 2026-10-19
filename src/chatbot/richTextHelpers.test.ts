import { describe, expect, test } from 'vitest';

import {
    checkIsCodeSpan,
    joinWrappedBoldText,
    splitRichTextParts,
    toCodeSpanText,
} from './richTextHelpers';

describe('splitRichTextParts', () => {
    test('bold, code and italics are cut out of the line', () => {
        expect(
            splitRichTextParts(
                'Press **Save**, type `ol:Verse 1` and _go_ now',
            ),
        ).toEqual([
            'Press ',
            '**Save**',
            ', type ',
            '`ol:Verse 1`',
            ' and ',
            '_go_',
            ' now',
        ]);
    });

    test('bold text wrapped in the manual stays one emphasized phrase', () => {
        const text =
            'After an **OpenAI API\n   Key** is saved, turn on **Auto Play Audio AI when\n   available**.\nNext paragraph.';
        const joined = joinWrappedBoldText(text);

        expect(joined).toBe(
            'After an **OpenAI API Key** is saved, turn on **Auto Play Audio AI when available**.\nNext paragraph.',
        );
        expect(joined.split('\n').map(splitRichTextParts)).toEqual([
            [
                'After an ',
                '**OpenAI API Key**',
                ' is saved, turn on ',
                '**Auto Play Audio AI when available**',
                '.',
            ],
            ['Next paragraph.'],
        ]);
    });

    // The whole list asked in Khmer (2026-10-18): "a line of three backticks
    // (```)" was drawn with a code span from the third backtick to the next
    // group's first.
    test('a run of backticks is words, not the edge of a code span', () => {
        const line =
            'a line of three backticks (```) then ol:Verse, then (```)';
        expect(splitRichTextParts(line)).toEqual([line]);
        expect(splitRichTextParts('(```) and `ol:Chorus`')).toEqual([
            '(```) and ',
            '`ol:Chorus`',
            '',
        ]);
    });

    test('rendering an Open Lyric example preserves all fence characters', () => {
        const example = '```ol:Verse 1\n[G]Hello\n```';
        const rendered = example
            .split('\n')
            .map((line) => {
                return splitRichTextParts(line)
                    .map((part) => {
                        return checkIsCodeSpan(part)
                            ? toCodeSpanText(part)
                            : part;
                    })
                    .join('');
            })
            .join('\n');
        expect(rendered).toBe(example);
        expect(checkIsCodeSpan('`ol:Verse 1`')).toBe(true);
        expect(checkIsCodeSpan('`` ``` ``')).toBe(true);
        expect(checkIsCodeSpan('```')).toBe(false);
    });

    test('an underscore inside a name is no emphasis', () => {
        expect(splitRichTextParts('amazing_grace_how_sweet')).toEqual([
            'amazing_grace_how_sweet',
        ]);
    });

    // The Khmer manual writes the fence as `` ``` ``, and an answer copies it
    // (pass 13, 2026-10-18): drawn raw, the reader saw five backticks more.
    test('a double-backtick span is code holding its backticks', () => {
        expect(
            splitRichTextParts('three backticks (`` ``` ``) and `ol:Verse 1`'),
        ).toEqual([
            'three backticks (',
            '`` ``` ``',
            ') and ',
            '`ol:Verse 1`',
            '',
        ]);
        expect(toCodeSpanText('`` ``` ``')).toBe('```');
        expect(toCodeSpanText('`ol:Verse 1`')).toBe('ol:Verse 1');
    });
});
