import { describe, expect, test } from 'vitest';

import titleMap from '../helper/bible-helpers/bible-data/kjvPsalmTitles.json';
import {
    genPreviousPsalmReadNote,
    genPsalmOwnSettingNote,
    genPsalmTitleNote,
    loadPsalmTitles,
    readPsalmChapters,
} from './lessonPsalmTitleHelpers';

// BN-147 (closing BN-122, 2026-11-11): psalm backgrounds told from memory
// -- the KJV's titles were in no Bible the app reads.

describe("a psalm's title, read with the psalm", () => {
    test('reads the psalms a passage names', () => {
        expect(readPsalmChapters('Psalm 46')).toEqual([46]);
        expect(readPsalmChapters('Psalms 46:1-11')).toEqual([46]);
        expect(readPsalmChapters('PSA 23')).toEqual([23]);
        // Two whole chapters.
        expect(readPsalmChapters('Ps 42-43')).toEqual([42, 43]);
        expect(readPsalmChapters('John 3:16')).toEqual([]);
        expect(readPsalmChapters('Psalm 151')).toEqual([]);
    });

    test("holds the KJV's 116 titles, as words", () => {
        const titles = Object.values(titleMap as Record<string, string>);
        expect(titles).toHaveLength(116);
        for (const title of titles) {
            // No USFM mark left in a title.
            expect(title, title).not.toMatch(/[\\|*]/);
            // Psalm 18's runs into its first verse ("And he said,"), and
            // Psalm 54's asks ("Doth not David hide himself with us?").
            expect(title, title).toMatch(/^[A-Z].*[.,?]$/);
        }
        expect((titleMap as Record<string, string>)['51']).toContain(
            'when Nathan the prophet came unto him',
        );
    });

    test('names each title found, Scripture never remembered', async () => {
        const found = await loadPsalmTitles([46, 119, 51]);
        expect(found.map((item) => item.chapter)).toEqual([46, 51]);
        expect(found[0].title).toBe(
            'To the chief Musician for the sons of Korah, A Song upon Alamoth.',
        );
        const note = genPsalmTitleNote(found);
        expect(note).toContain(
            'Psalm 46: "To the chief Musician for the sons of Korah',
        );
        expect(note).toContain('never from memory');
        expect(genPsalmTitleNote([])).toBe(null);
        expect(await loadPsalmTitles([])).toEqual([]);
    });
});

// BN-279 (2026-11-14, ab101..ab103): every Psalm 40 lesson told Psalm 39:13
// as its setting, Psalm 23's told Psalm 22:28-31 so.
describe('a psalm opened at its first verse has no verses before it', () => {
    test('the passage read says the psalm before is another psalm', () => {
        for (const passage of ['Psalm 40:1-5', 'Psalm 23', 'Psalms 91:1-6']) {
            const note = genPsalmOwnSettingNote(passage);
            expect(note, passage).toContain(
                'is another psalm, never its setting',
            );
        }
        expect(genPsalmOwnSettingNote('Psalm 40:1-5')).toContain(
            'Psalm 39 before it',
        );
        for (const passage of [
            'Psalm 40:6-10',
            'Psalm 1:1-6',
            'Luke 15:1-7',
            '',
        ]) {
            expect(genPsalmOwnSettingNote(passage), passage).toBe(null);
        }
        expect(genPsalmOwnSettingNote(null)).toBe(null);
    });

    test('a read of the psalm before is told it is not the setting', () => {
        expect(genPreviousPsalmReadNote('Psalm 39:13', 'Psalm 40:1-5')).toBe(
            '(Psalm 39 is another psalm, not the setting of Psalm 40: tell ' +
                'none of the Background from it.)',
        );
        expect(
            genPreviousPsalmReadNote('Psalm 22:28-31', 'Psalm 23'),
        ).toContain('Psalm 22 is another psalm');
        for (const [reads, passage] of [
            ['Hebrews 10:5-7', 'Psalm 40:1-5'],
            ['Psalm 39:13; Hebrews 10:5', 'Psalm 40:1-5'],
            ['Psalm 39:13', 'Psalm 40:6-10'],
            ['Luke 14:25-35', 'Luke 15:1-7'],
        ]) {
            expect(genPreviousPsalmReadNote(reads, passage), reads).toBe(null);
        }
    });
});
