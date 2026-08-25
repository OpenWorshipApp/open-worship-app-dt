// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import type { SongSelectLyricsType } from './songSelectApiHelpers';

// monaco-editor's clipboard contrib (pulled in by open-lyric) probes these at
// module-eval time and jsdom implements neither — so the helper must be
// imported dynamically after the patch.
(document as any).queryCommandSupported ??= () => false;
(document as any).execCommand ??= () => false;
const { checkOpenLyricMarkdown, sanitizeFileName, songSelectLyricsToMarkdown } =
    await import('./songSelectLyricHelpers');

function genLyricsData(
    lyricParts: SongSelectLyricsType['lyricParts'],
    overrides: Partial<SongSelectLyricsType> = {},
): SongSelectLyricsType {
    return {
        title: 'Amazing Grace',
        authors: ['John Newton', 'Chris Tomlin'],
        copyrights: ['Words: Public Domain', 'Music: Public Domain'],
        songNumber: '22025',
        lyricParts,
        ...overrides,
    };
}

function genPart(
    partType: string,
    partTypeNumber: number | undefined,
    lyrics: string,
    partLabel?: string,
) {
    return {
        partLabel:
            partLabel ??
            (partTypeNumber ? `${partType} ${partTypeNumber}` : partType),
        partType,
        partTypeNumber,
        lyrics,
    };
}

describe('songSelectLyricsToMarkdown', () => {
    test('maps a typical song onto valid open-lyric markdown', () => {
        const markdown = songSelectLyricsToMarkdown(
            genLyricsData([
                genPart(
                    'Verse',
                    1,
                    'Amazing grace how sweet the sound\nThat saved a wretch like me',
                ),
                genPart('Chorus', 1, 'Praise God praise God'),
                genPart('Verse', 2, 'Twas grace that taught my heart to fear'),
                genPart('Bridge', 1, 'My chains are gone'),
                genPart('Ending', 1, 'Amen amen'),
            ]),
        );
        expect(markdown).not.toBeNull();
        expect(markdown).toContain('# Amazing Grace');
        expect(markdown).toContain('- Title: Amazing Grace');
        expect(markdown).toContain('- Artist: John Newton, Chris Tomlin');
        expect(markdown).toContain(
            '- Copyright: Words: Public Domain Music: Public Domain' +
                ' CCLI Song #22025',
        );
        expect(markdown).toContain('- Tempo: 120bpm');
        // Two verses are numbered; the single chorus and bridge stay bare;
        // "Ending" maps onto the (unnumbered) Outro.
        expect(markdown).toContain('- Structure: V1CV2BO');
        expect(markdown).toContain('```ol:Verse 1\n');
        expect(markdown).toContain('```ol:Chorus\n');
        expect(markdown).toContain('```ol:Verse 2\n');
        expect(markdown).toContain('```ol:Bridge\n');
        expect(markdown).toContain('```ol:Outro\n');
        expect(checkOpenLyricMarkdown(markdown as string)).toBe(true);
    });

    test('routes unknown part types into Breakdown fences with a comment', () => {
        const markdown = songSelectLyricsToMarkdown(
            genLyricsData([
                genPart('Verse', 1, 'line one'),
                genPart('Misc', 1, 'spoken words here', 'Misc 1'),
            ]),
        );
        expect(markdown).toContain('```ol:Breakdown 1\n// Misc 1\n');
        // A single verse stays unnumbered.
        expect(markdown).toContain('- Structure: VD1');
        expect(checkOpenLyricMarkdown(markdown as string)).toBe(true);
    });

    test('second Ending cannot repeat the Outro and falls back', () => {
        const markdown = songSelectLyricsToMarkdown(
            genLyricsData([
                genPart('Ending', 1, 'first ending'),
                genPart('Ending', 2, 'second ending'),
            ]),
        );
        expect(markdown).toContain('```ol:Outro\n');
        expect(markdown).toContain('```ol:Breakdown 1\n// Ending 2\n');
        expect(markdown).toContain('- Structure: OD1');
        expect(checkOpenLyricMarkdown(markdown as string)).toBe(true);
    });

    test('slides a colliding numbered part to the next free number', () => {
        const markdown = songSelectLyricsToMarkdown(
            genLyricsData([
                genPart('Verse', 1, 'first'),
                genPart('Verse', 1, 'second with same number'),
            ]),
        );
        expect(markdown).toContain('```ol:Verse 1\n');
        expect(markdown).toContain('```ol:Verse 2\n');
        expect(markdown).toContain('- Structure: V1V2');
        expect(checkOpenLyricMarkdown(markdown as string)).toBe(true);
    });

    test('maps the whole part-type table onto canonical fences', () => {
        const markdown = songSelectLyricsToMarkdown(
            genLyricsData([
                genPart('Intro', 1, 'intro line'),
                genPart('Pre-Chorus', 1, 'pre chorus line'),
                genPart('Post-Chorus', 1, 'post chorus line'),
                genPart('Refrain', 1, 'refrain line'),
                genPart('Interlude', 1, 'interlude line'),
                genPart('Instrumental', 1, 'instrumental line'),
                genPart('Tag', 1, 'tag line'),
                genPart('Vamp', 1, 'vamp line'),
                genPart('Final Chorus', 1, 'final chorus line'),
            ]),
        );
        expect(markdown).toContain('```ol:Intro\n');
        expect(markdown).toContain('```ol:Pre-Chorus\n');
        expect(markdown).toContain('```ol:Post-Chorus\n');
        expect(markdown).toContain('```ol:Refrain\n');
        // Interlude/Instrumental fences only take chord bars, so text for
        // them lands in Breakdown fences with the label as a comment.
        expect(markdown).toContain('```ol:Breakdown 1\n// Interlude 1\n');
        expect(markdown).toContain('```ol:Breakdown 2\n// Instrumental 1\n');
        expect(markdown).toContain('```ol:Tag\n');
        expect(markdown).toContain('```ol:Vamp\n');
        expect(markdown).toContain('```ol:Final-Chorus\n');
        expect(markdown).toContain('- Structure: IPXRD1D2TAF');
        expect(checkOpenLyricMarkdown(markdown as string)).toBe(true);
    });

    test('sanitizes CRLF, brackets and fence-like lines', () => {
        const markdown = songSelectLyricsToMarkdown(
            genLyricsData([
                genPart(
                    'Verse',
                    1,
                    'line [with] brackets\r\n``` fence like\r\n\r\nlast line',
                ),
            ]),
        );
        expect(markdown).toContain('line (with) brackets');
        expect(markdown).toContain("''' fence like");
        expect(markdown).not.toContain('[with]');
        expect(checkOpenLyricMarkdown(markdown as string)).toBe(true);
    });

    test('drops blank parts and returns null when all parts are blank', () => {
        expect(
            songSelectLyricsToMarkdown(
                genLyricsData([
                    genPart('Verse', 1, '   \n  '),
                    genPart('Chorus', 1, ''),
                ]),
            ),
        ).toBeNull();
        expect(songSelectLyricsToMarkdown(genLyricsData([]))).toBeNull();
        const markdown = songSelectLyricsToMarkdown(
            genLyricsData([
                genPart('Verse', 1, 'kept'),
                genPart('Chorus', 1, '   '),
            ]),
        );
        // With the blank chorus dropped, one verse remains — unnumbered.
        expect(markdown).toContain('```ol:Verse\n');
        expect(markdown).not.toContain('```ol:Chorus');
        expect(checkOpenLyricMarkdown(markdown as string)).toBe(true);
    });

    test('degenerate metadata still produces valid markdown', () => {
        const markdown = songSelectLyricsToMarkdown(
            genLyricsData([genPart('Verse', 1, 'only line')], {
                title: '',
                authors: [],
                copyrights: [],
                songNumber: '',
            }),
        );
        expect(markdown).toContain('- Title: Untitled Song');
        expect(markdown).toContain('- Artist: Unknown Artist');
        expect(markdown).toContain('- Copyright: Unknown');
        expect(checkOpenLyricMarkdown(markdown as string)).toBe(true);
    });

    test('hostile lyric content still validates', () => {
        const markdown = songSelectLyricsToMarkdown(
            genLyricsData([
                genPart('Verse', 1, '{p: #broken directive\n|| [unclosed'),
                genPart('Weird Part', undefined, '```\n```ol:Config\n- haha'),
            ]),
        );
        expect(markdown).not.toBeNull();
        expect(checkOpenLyricMarkdown(markdown as string)).toBe(true);
    });

    test('every downloadable dev-mock catalog song maps validly', async () => {
        const { devMockSongCatalog } = await import('./songSelectDevMockData');
        for (const song of devMockSongCatalog) {
            if (!song.hasLyrics || !song.isAuthorized) {
                continue;
            }
            const markdown = songSelectLyricsToMarkdown({
                title: song.title,
                authors: song.authors,
                copyrights: song.isPublicDomain ? ['Public Domain'] : [],
                songNumber: song.songNumber,
                lyricParts: song.lyricParts,
            });
            expect(markdown, song.title).not.toBeNull();
            expect(checkOpenLyricMarkdown(markdown as string), song.title).toBe(
                true,
            );
        }
    });
});

describe('sanitizeFileName', () => {
    test('strips Windows-illegal characters and trailing dots', () => {
        expect(sanitizeFileName('Amazing Grace: My Chains / Gone?')).toBe(
            'Amazing Grace My Chains Gone',
        );
        expect(sanitizeFileName('What <A> "Day"...')).toBe('What A Day');
        expect(sanitizeFileName('  spaced   out  ')).toBe('spaced out');
    });

    test('falls back on an empty result and caps the length', () => {
        expect(sanitizeFileName('***')).toBe('SongSelect Song');
        expect(sanitizeFileName('')).toBe('SongSelect Song');
        expect(sanitizeFileName('a'.repeat(300))).toHaveLength(120);
    });
});
