import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The app's own KJV, held to the KJV's words where a copy of it slipped and
// a blind reader of a lesson printed from it caught the slip: Jonah 1:15's
// "took up" (BN-71, 2026-11-10), and the LORD in small capitals opening
// Psalms 38, 88 and 139 (BN-228, 2026-11-13, the held-out read ab72: a
// women's devotion on Psalm 139 printed "O lord, thou hast searched me").
const books = JSON.parse(
    readFileSync(join(__dirname, 'bible-data', 'kjvBibleBooks.json'), 'utf8'),
);

describe("the app's own KJV", () => {
    it('reads as the KJV where a copy of it slipped', () => {
        expect(books.JON['1']['15']).toMatch(/^So they took up Jonah/);
        expect(books.PSA['38']['1']).toMatch(/^O LORD, rebuke me not/);
        expect(books.PSA['88']['1']).toMatch(/^O LORD God of my salvation/);
        expect(books.PSA['139']['1']).toBe(
            'O LORD, thou hast searched me, and known me.',
        );
    });

    // BN-257 (2026-11-13, the held-out read ab90: both Psalm 32 lessons
    // printed "I acknowledge my sin unto thee"): the app's KJV read against
    // eBible.org's public-domain KJV, word for word, and 100 typos set right
    // -- a word changed, dropped or added -- with the edition's own
    // spellings (honor, show, Bethel) left as they are.
    it('reads as the KJV where a typo had slipped in', () => {
        expect(books.PSA['32']['5']).toMatch(
            /^I acknowledged my sin unto thee/,
        );
        expect(books.PSA['119']['97']).toMatch(/^O how love I thy law!/);
        expect(books.EXO['23']['17']).toMatch(/^Three times in the year/);
        expect(books.MAT['5']['21']).toContain(
            'it was said by them of old time',
        );
        expect(books.GAL['2']['20']).toContain('nevertheless I live');
        expect(books.ACT['2']['20']).toContain(
            'before that great and notable day',
        );
        expect(books.JON['4']['11']).toContain('more than sixscore thousand');
        expect(books.HEB['12']['24']).toContain(
            'better things than that of Abel',
        );
        expect(books.ROM['11']['6']).toContain('then is it no more grace');
        expect(books['1JN']['2']['2']).toContain('not for ours only');
        expect(books['1JN']['2']['23']).toContain('but he that acknowledgeth');
        expect(books.GEN['27']['43']).toContain('obey my voice; and arise');
    });

    // BN-275 (2026-11-14, the held-out read ab101: Isaiah's call printed "I
    // saw also the LORD" in both batches, and Opus marked both lessons down):
    // the divine names' case read against the same KJV -- LORD and GOD where
    // the Hebrew is the name, Lord and God where it is not -- and 115 verses
    // set right, the one word at its place.
    it('writes LORD where the KJV does, and Lord where it does not', () => {
        expect(books.ISA['6']['1']).toMatch(
            /^In the year that king Uzziah died I saw also the Lord sitting/,
        );
        expect(books.ISA['6']['3']).toContain('is the LORD of hosts');
        expect(books.GEN['15']['2']).toMatch(/^And Abram said, Lord GOD,/);
        expect(books.GEN['18']['27']).toContain('to speak unto the Lord');
        expect(books.EXO['4']['10']).toMatch(
            /^And Moses said unto the LORD, O my Lord/,
        );
        expect(books.PSA['3']['1']).toMatch(/^LORD, how are they increased/);
        expect(books.ACT['2']['34']).toContain('The LORD said unto my Lord');
        expect(books.JOS['5']['14']).toContain('What saith my lord');
        expect(books.DAN['4']['8']).toContain(
            'according to the name of my god',
        );
    });

    it("writes no possessive pronoun with an apostrophe (your's)", () => {
        const found: string[] = [];
        for (const [book, chapters] of Object.entries<any>(books)) {
            for (const [chapter, verses] of Object.entries<any>(chapters)) {
                for (const [verse, text] of Object.entries<any>(verses)) {
                    if (/\b(?:your|their|our|her)'s\b/i.test(String(text))) {
                        found.push(`${book} ${chapter}:${verse}`);
                    }
                }
            }
        }
        expect(found).toEqual([]);
    });

    it('opens no verse addressing God as "O lord"', () => {
        const found: string[] = [];
        for (const [book, chapters] of Object.entries<any>(books)) {
            for (const [chapter, verses] of Object.entries<any>(chapters)) {
                for (const [verse, text] of Object.entries<any>(verses)) {
                    if (/^O lord\b/.test(String(text))) {
                        found.push(`${book} ${chapter}:${verse}`);
                    }
                }
            }
        }
        expect(found).toEqual([]);
    });
});
