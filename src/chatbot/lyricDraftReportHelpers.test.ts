import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, test } from 'vitest';

import { draftOpenLyricText } from '../../tools/owa-devtools-mcp/openLyricDraft.mjs';
import { extractDictionary } from '../../tools/owa-devtools-mcp/tran.mjs';
import { setChatTranslator } from './chatTranHelpers';
import { readDraftReport } from './lyricDraftHelpers';
import {
    translateDraftGuess,
    translateDraftReport,
} from './lyricDraftReportHelpers';

afterEach(() =>
    setChatTranslator(
        (text) => text,
        (text) => text,
    ),
);

function useLanguage(lang: string) {
    const dictionary = extractDictionary(
        readFileSync(
            new URL(`../lang/data/${lang}/index.ts`, import.meta.url),
            'utf8',
        ),
    );
    const translate = (key: string) => {
        const value = dictionary[key.trim().toLowerCase()];
        if (value === undefined) throw new Error(`Missing ${lang} key: ${key}`);
        return value;
    };
    setChatTranslator(translate, translate);
}

describe.each(['km', 'fr'])('song draft wording in %s', (lang) => {
    test('translates summary labels without changing title, author, parts or musical data', () => {
        useLanguage(lang);
        const translated = translateDraftReport({
            song: 'Song: "River Lantern" by Test Author — key C, 120bpm, 4/4',
            sections: 'Sections (2): Verse 1 (4 lines), Chorus (1 line)',
            playOrder: 'Play order: Verse 1 → Chorus',
            guessed: [],
        });
        expect(translated.song).toContain('"River Lantern"');
        expect(translated.song).toContain('Test Author');
        expect(translated.song).toContain('C');
        expect(translated.song).toContain('120');
        expect(translated.song).toContain('4/4');
        expect(translated.song).not.toMatch(/Song:| by |key |bpm/);
        expect(translated.sections).toContain('Verse 1');
        expect(translated.sections).toContain('Chorus');
        expect(translated.sections).not.toMatch(/Sections \(| lines?\)/);
        expect(translated.playOrder).toContain('Verse 1 → Chorus');
        expect(translated.playOrder).not.toContain('Play order:');
    });

    test('translates the actual drafter’s uncertainty notes and preserves the source region', () => {
        useLanguage(lang);
        const page =
            'Read https://songs.example/river\n--- BEGIN WEBSITE TEXT ---\n' +
            'A lantern on the water\nA light across the bay\nThe quiet shore is waiting\nUntil the break of day\n--- END WEBSITE TEXT ---';
        const report = readDraftReport(draftOpenLyricText(page));
        expect(report.guessed.length).toBeGreaterThan(3);
        const translated = translateDraftReport(report);
        for (let i = 0; i < report.guessed.length; i++) {
            expect(translated.guessed[i]).not.toBe(report.guessed[i]);
        }
        const region = translated.guessed.find((line) =>
            line.includes('A lantern on the water'),
        );
        expect(region).toContain('Until the break of day');
    });

    test('translates counts and exceptional extraction notes without hiding them', () => {
        useLanguage(lang);
        const notes = [
            'the key, time the text gave is not one open-lyric has a name for, so it was left out -- worth setting by hand',
            '2 lines above the first numbered verse read as a heading, not as words to sing, and were left out',
            '2 lines were in a second language under the line they translate, and were kept as translations of it',
            'left out above the song, as the page\'s own buttons rather than words to sing: "Transpose"',
            'left out of the song, as a credit rather than words to sing: "© Test Author"',
            'Instrumental could not be a section of its own, so it was kept as free text',
            'that was a page rather than plain words, so the song was taken from the part running "First" to "Last", leaving out 5 lines of menus, chord charts and links',
            'a block that came round again word for word was written once and played each time it appeared -- check that is really the chorus',
            'the sections could not be worked out, so every block was kept as free text with its own label above it -- the words are all there, and the section names may want setting by hand',
        ];
        for (const note of notes)
            expect(translateDraftGuess(note)).not.toBe(note);
        expect(translateDraftGuess(notes[3])).toContain('"Transpose"');
        expect(translateDraftGuess(notes[4])).toContain('© Test Author');
        expect(translateDraftGuess(notes[6])).toContain('5');
        expect(translateDraftGuess('An unfamiliar tool warning')).toBe(
            'An unfamiliar tool warning',
        );
    });
});
