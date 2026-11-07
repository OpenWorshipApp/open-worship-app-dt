import { describe, expect, it } from 'vitest';

import { toValidResourceReading } from './resourceReadingAskHelpers';

// A setting and a saved conversation are both files a person can edit:
// only the listed fields, each checked, come back.
describe('what the Reader is on when a Resources file is handed over', () => {
    it('keeps the book, the chapter, a forward verse range, the title and the Bible', () => {
        expect(
            toValidResourceReading({
                bookKey: 'MAT',
                chapter: 18,
                verseStart: 15,
                verseEnd: 17,
                // A title past ASCII is kept as written, its spaces collapsed.
                title: '  ✝   １８:１５-１７ ',
                bibleKey: 'KJV',
                dataUrl: 'data:text/plain;base64,AAAA',
            }),
        ).toEqual({
            bookKey: 'MAT',
            chapter: 18,
            verseStart: 15,
            verseEnd: 17,
            title: '✝ １８:１５-１７',
            bibleKey: 'KJV',
        });
    });

    it('drops a verse range that does not read forwards, and keeps the chapter', () => {
        const base = { bookKey: '1CH', chapter: 3, title: '1 Chronicles 3' };
        expect(
            toValidResourceReading({ ...base, verseStart: 9, verseEnd: 2 }),
        ).toEqual(base);
        expect(
            toValidResourceReading({ ...base, verseStart: 0, verseEnd: 2 }),
        ).toEqual(base);
        expect(
            toValidResourceReading({ ...base, verseStart: 1, verseEnd: 201 }),
        ).toEqual(base);
        expect(
            toValidResourceReading({ ...base, verseStart: 1.5, verseEnd: 2 }),
        ).toEqual(base);
    });

    it('drops a Bible key that is not a short name', () => {
        expect(
            toValidResourceReading({
                bookKey: 'JHN',
                chapter: 3,
                title: 'John 3',
                bibleKey: 'two words',
            }),
        ).toEqual({ bookKey: 'JHN', chapter: 3, title: 'John 3' });
    });

    it('refuses what is not a reading', () => {
        expect(toValidResourceReading(null)).toBeNull();
        expect(
            toValidResourceReading({ bookKey: 'mat', chapter: 1, title: 'x' }),
        ).toBeNull();
        expect(
            toValidResourceReading({
                bookKey: 'MAT',
                chapter: 201,
                title: 'x',
            }),
        ).toBeNull();
        expect(
            toValidResourceReading({
                bookKey: 'MAT',
                chapter: '18',
                title: 'x',
            }),
        ).toBeNull();
        expect(
            toValidResourceReading({ bookKey: 'MAT', chapter: 18 }),
        ).toBeNull();
        // A title of nothing but spaces names nothing.
        expect(
            toValidResourceReading({
                bookKey: 'MAT',
                chapter: 18,
                title: ' \n ',
            }),
        ).toBeNull();
    });

    it('cuts a long title to one line of 120', () => {
        const reading = toValidResourceReading({
            bookKey: 'PSA',
            chapter: 119,
            title: 'Psalm 119 '.repeat(30),
        });
        expect(reading?.title).toHaveLength(120);
        expect(reading?.title).not.toContain('\n');
    });
});
