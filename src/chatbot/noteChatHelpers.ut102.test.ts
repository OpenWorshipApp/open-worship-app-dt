/**
 * The note chat's checks at the edges no other test reaches (UT-102): a read
 * of verses in a shape the checks do not take, a book the KJV's names lack,
 * the same quotation twice, more misplaced lines than are named, and calls
 * that are not the kind a check reads.
 */
import { describe, expect, it } from 'vitest';

import {
    findCitedMisattributions,
    findFinishOwnWordsLoss,
    findNoteTranslateLeft,
    findPointQuoteMisplacements,
    findRewriteLineLoss,
    readPassageVerseWords,
    withLongPointPassagesNamed,
} from './noteChatHelpers';

describe('the passage as read, from a read in another shape', () => {
    it('passes over a read whose verses are no list', () => {
        const odd = JSON.stringify({
            verses: { ref: 'Psalm 46:2', text: 'though the earth be removed' },
        });
        const read = JSON.stringify({
            verses: [{ ref: 'Psalm 46:1', text: '(1): God is our refuge' }],
        });
        expect(readPassageVerseWords([odd, read], 'Psalm 46:1-11')).toBe(
            '(1): God is our refuge',
        );
    });
});

const REVELATION_TEXT =
    '(5): And he that sat upon the throne said, Behold, I make all things ' +
    'new. (6): And he said unto me, It is done. I will give unto him that ' +
    'is athirst of the fountain of the water of life freely.';
const JOHN_TEXT =
    '(14): But whosoever drinketh of the water that I shall give him shall ' +
    'never thirst.';
const CITED = { quote: 'the water of life freely', ref: 'John 4:14' };

describe('a quotation named for another verse, the rest (UT-102)', () => {
    it('names no verse for words read under a book the KJV does not name', () => {
        const read = JSON.stringify({
            verses: [{ key: 'XYZ 21:1-7', text: REVELATION_TEXT }],
        });
        expect(
            findCitedMisattributions(
                [CITED],
                new Map([['John 4:14', JOHN_TEXT]]),
                [read],
            ),
        ).toEqual([]);
    });

    it('names a quotation given twice once', () => {
        const read = JSON.stringify({
            verses: [{ key: 'REV 21:1-7', text: REVELATION_TEXT }],
        });
        expect(
            findCitedMisattributions(
                [CITED, { ...CITED }],
                new Map([['John 4:14', JOHN_TEXT]]),
                [read],
            ),
        ).toEqual([{ ...CITED, source: 'Revelation 21:6' }]);
    });
});

const NOAH_WORDS = 'Noah did according unto all that the LORD commanded him';

describe('a point quoting a verse that is not its own, the rest (UT-102)', () => {
    it('names a one-verse read by its key, and no verse of a book it cannot name', () => {
        // The first read's book is no book of the KJV's: it names no verse,
        // and the one after it is the verse named.
        const read = JSON.stringify({
            verses: [
                { key: 'XYZ 7:1-24', text: `And ${NOAH_WORDS}.` },
                { key: 'GEN 7:5', text: `And ${NOAH_WORDS}.` },
            ],
        });
        const lesson =
            '## 1. Obeying God\n[^(KJV) Genesis 6:22]\n' +
            `"${NOAH_WORDS}" means Noah did not argue.`;
        const found = findPointQuoteMisplacements(lesson, [read]);
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain(
            "is Genesis 7:5's words, not the point's own Genesis 6:22",
        );
        expect(found[0].text).toContain('name [^Genesis 7:5] right after');
    });

    it('names five lines at most', () => {
        const read = JSON.stringify({
            verses: [{ key: 'GEN 7:5', text: `And ${NOAH_WORDS}.` }],
        });
        const lines = Array.from({ length: 7 }, (_, index) => {
            return `Line ${index + 1}: "${NOAH_WORDS}" again.`;
        });
        const lesson = ['## 1. Obeying God', '[^Genesis 6:22]', ...lines].join(
            '\n',
        );
        const found = findPointQuoteMisplacements(lesson, [read]);
        expect(found.map((item) => item.sentence)).toEqual(lines.slice(0, 5));
    });
});

describe('a finish or a rewrite that is not the edit a check reads', () => {
    it('lets a change to a block that is not one of their own be', () => {
        const own = [{ n: 5, words: 'Told to stop asking?' }];
        expect(
            findFinishOwnWordsLoss(
                { action: 'edit', changes: [{ block: 99, remove: true }] },
                own,
            ),
        ).toBeNull();
        // Their own block taken out is still refused.
        expect(
            findFinishOwnWordsLoss(
                { action: 'edit', changes: [{ block: 5, remove: true }] },
                own,
            ),
        ).toContain('block 5, "Told to stop asking?"');
    });

    it('reads no line lost from a call that is no edit', () => {
        const rewrite = {
            lines: ['peace be still'],
            lineBlocks: [3],
            blockCount: 3,
        };
        const changes = [{ block: 3, remove: true }];
        expect(findRewriteLineLoss({ action: 'read', changes }, rewrite)).toBe(
            null,
        );
        expect(findRewriteLineLoss({ action: 'edit' }, rewrite)).toBe(null);
        // The same change in an edit is refused.
        expect(
            findRewriteLineLoss({ action: 'edit', changes }, rewrite),
        ).toContain('peace be still');
    });

    it('hands back a call with no changes as it came', () => {
        const args = { action: 'edit' };
        expect(withLongPointPassagesNamed(args)).toBe(args);
        expect(withLongPointPassagesNamed(null)).toBe(null);
    });
});

describe('a translation, the letters of a third script in a block it adds', () => {
    it('names them, the added block by no number', () => {
        // The language's own letters, and two of another script slipped in.
        const own = String.fromCodePoint(0x1000, 0x1001, 0x1002);
        const stray = String.fromCodePoint(0x3b1, 0x3b2);
        const text = `${own} ${own}${stray}`;
        expect(
            findNoteTranslateLeft(
                { action: 'edit', changes: [{ after: 0, text }] },
                [],
                /\p{Script=Myanmar}/u,
            ),
        ).toEqual({
            english: [],
            stray: [{ n: null, text, letters: [...stray] }],
        });
        // The same block in the language's letters alone: nothing left.
        expect(
            findNoteTranslateLeft(
                { action: 'edit', changes: [{ after: 0, text: own }] },
                [],
                /\p{Script=Myanmar}/u,
            ),
        ).toBeNull();
    });
});
