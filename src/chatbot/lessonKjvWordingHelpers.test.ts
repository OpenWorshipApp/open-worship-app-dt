import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    KJV_WORDING_LIST,
    genKjvWordingNote,
    withKjvWording,
} from './lessonKjvWordingHelpers';

// BN-137 (2026-11-11, the BN-130..132 read, both readers): Philippians 2:7
// quoted as "emptied himself", a modern translation's words, in a lesson
// whose verses are the KJV's.

const BIBLE_HELPER_DIR = join(__dirname, '..', 'helper', 'bible-helpers');

function readKjvVerse(ref: string) {
    const config = JSON.parse(
        readFileSync(join(BIBLE_HELPER_DIR, 'kjvBibleConfig.json'), 'utf8'),
    );
    const books = JSON.parse(
        readFileSync(
            join(BIBLE_HELPER_DIR, 'bible-data', 'kjvBibleBooks.json'),
            'utf8',
        ),
    );
    const match = /^((?:[1-3] )?[A-Za-z][A-Za-z ]*?) (\d+):(\d+)$/.exec(ref);
    if (match === null) {
        return null;
    }
    const keyMap = new Map(
        Object.entries(config.keyBookMap).map(([key, name]) => {
            return [String(name).toLowerCase(), key];
        }),
    );
    const bookName = match[1].toLowerCase();
    const bookKey = keyMap.get(bookName) ?? keyMap.get(`${bookName}s`);
    return books[bookKey as string]?.[match[2]]?.[match[3]] ?? null;
}

const toLetterKey = (text: string) => {
    return text.toLowerCase().replace(/[^a-z]/g, '');
};

describe('a verse quoted in a modern wording is given the KJV words', () => {
    test("every entry is the app's own KJV", () => {
        for (const entry of KJV_WORDING_LIST) {
            const verse = readKjvVerse(entry.ref);
            expect(verse, entry.ref).toBe(entry.verse);
            expect(toLetterKey(entry.verse), entry.kjv).toContain(
                toLetterKey(entry.kjv),
            );
            expect(toLetterKey(entry.verse), entry.modern).not.toContain(
                toLetterKey(entry.modern),
            );
        }
    });

    test('the phrase seen in a lesson is put back', () => {
        const result = withKjvWording(
            'Jesus showed contentment when He "emptied himself" and took ' +
                'the form of a servant.',
        );
        expect(result.text).toBe(
            'Jesus showed contentment when He "made himself of no ' +
                'reputation" and took the form of a servant.',
        );
        expect(result.fixes).toEqual([
            {
                modern: 'emptied himself',
                kjv: 'made himself of no reputation',
                ref: 'Philippians 2:7',
            },
        ]);
        expect(genKjvWordingNote(result.fixes)).toContain(
            '"emptied himself" -> "made himself of no reputation" ' +
                '(Philippians 2:7)',
        );
        // BN-177 (ab44, Opus): 1 Samuel 17:47 quoted in other words.
        expect(
            withKjvWording('David declared that "the battle is of the LORD."')
                .text,
        ).toBe('David declared that "the battle is the LORD\'s."');
        // BN-182 (ab46, Opus): Psalm 51:17's plural, and the KJV left alone.
        expect(
            withKjvWording('This humility is the "sacrifice of God" here.')
                .text,
        ).toBe('This humility is the "sacrifices of God" here.');
        const kept = '"The sacrifices of God are a broken spirit"';
        expect(withKjvWording(kept)).toEqual({ text: kept, fixes: [] });
    });

    test('a verse quoted with more of its own words, every wording in it', () => {
        expect(
            withKjvWording(
                'John says, "God so loved the world that he gave his one ' +
                    'and only Son, that whoever believes in him shall not ' +
                    'perish but have eternal life."',
            ).text,
        ).toBe(
            'John says, "God so loved the world that he gave his only ' +
                'begotten Son, that whosoever believeth in him should not ' +
                'perish, but have everlasting life."',
        );
        // A word of the translation's own beside it stays: "Even".
        expect(
            withKjvWording('"Even though I walk through the darkest valley"')
                .text,
        ).toBe(
            '"Even though I walk through the valley of the shadow of death"',
        );
        // The case of the words it stands for.
        expect(
            withKjvWording('Paul says "do not be anxious about anything" here')
                .text,
        ).toBe('Paul says "be careful for nothing" here');
    });

    test('a hymn, the KJV itself and words not quoted are left alone', () => {
        for (const text of [
            'We sing "emptied Himself of all but love" at Christmas.',
            'Paul writes, "I can do all things through Christ which ' +
                'strengtheneth me."',
            'He emptied himself, Paul says.',
            'No quotation here at all.',
        ]) {
            expect(withKjvWording(text), text).toEqual({ text, fixes: [] });
        }
    });

    // BN-274 (ab101, P-14, both readers): a communion message quoted
    // 1 Corinthians 11 from memory, in both batches, in these words.
    // BN-282 (ab105): a short quote before it had hidden the quotation.
    test('a quotation after a short quote is read too', () => {
        const result = withKjvWording(
            'He paid the "debt" in full: "For he himself bore our sins in ' +
                'his body on the tree".',
        );
        expect(result.text).toBe(
            'He paid the "debt" in full: "Who his own self bare our sins in ' +
                'his own body on the tree".',
        );
        expect(result.fixes.map((fix) => fix.ref)).toEqual(['1 Peter 2:24']);
    });

    test("the Lord's Supper's words as both batches wrote them", () => {
        const result = withKjvWording(
            'Paul emphasizes that he "received from the Lord" what he ' +
                'passed on. Each time we "proclaim the Lord\'s death until ' +
                'he comes." Jesus said, "do this in remembrance" of him, ' +
                'and the cup is "the new covenant in my blood".',
        );
        expect(result.text).toBe(
            'Paul emphasizes that he "received of the Lord" what he ' +
                'passed on. Each time we "shew the Lord\'s death till he ' +
                'come." Jesus said, "this do in remembrance" of him, and ' +
                'the cup is "the new testament in my blood".',
        );
        // The shorter wording inside the longer one is said once.
        expect(result.fixes.map((fix) => fix.ref)).toEqual([
            '1 Corinthians 11:23',
            '1 Corinthians 11:26',
            '1 Corinthians 11:24',
            '1 Corinthians 11:25',
        ]);
        expect(
            withKjvWording('we "proclaim the Lord\'s death" at His table').text,
        ).toBe('we "shew the Lord\'s death" at His table');
        // Hebrews 8:8's KJV "a new covenant" is left as it reads.
        const hebrews = 'God says, "I will make a new covenant with them."';
        expect(withKjvWording(hebrews)).toEqual({ text: hebrews, fixes: [] });
    });
});
