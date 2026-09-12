// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import type { PublicDomainSongType } from './publicDomainSongsData';
import { publicDomainSongCatalog } from './publicDomainSongsData';
import {
    filterPublicDomainSongs,
    genPublicDomainSongAttachmentLines,
    genPublicDomainSongParts,
    publicDomainSongToMarkdown,
    sanitizeFileName,
} from './publicDomainSongsHelpers';

// monaco-editor's clipboard contrib (pulled in by open-lyric) probes these at
// module-eval time and jsdom implements neither — so open-lyric must be
// imported dynamically after the patch.
(document as any).queryCommandSupported ??= () => false;
(document as any).execCommand ??= () => false;
const { EditorOpenLyricPlugin, OpenLyric } = await import('open-lyric');
const openLyricApi = new EditorOpenLyricPlugin().getOpenLyricApi();
function checkMarkdown(text: string): boolean {
    return openLyricApi.document.checkMarkdown(text) === true;
}

// The same two lines `initOpenLyric` runs, so the attachments asserted here are
// literally the records `LyricAppDocumentStageAbstract` turns into slides.
function readAttachments(markdown: string) {
    const openLyricPreviewer = new OpenLyric();
    openLyricPreviewer.value = markdown;
    return openLyricPreviewer.getAttachments();
}

function genSong(
    overrides: Partial<PublicDomainSongType> = {},
): PublicDomainSongType {
    return {
        id: 'test-song',
        title: 'Test Song',
        authors: ['Test Author'],
        year: '1800',
        sources: [
            { title: 'Hymnary.org', url: 'https://hymnary.org/text/test_song' },
        ],
        verses: ['first verse line one\nfirst verse line two'],
        refrain: null,
        ...overrides,
    };
}

describe('publicDomainSongCatalog', () => {
    test('carries a full catalog with unique ids and non-empty texts', () => {
        // Guards against ever shipping the empty placeholder catalog.
        expect(publicDomainSongCatalog.length).toBeGreaterThanOrEqual(30);
        const ids = new Set<string>();
        for (const song of publicDomainSongCatalog) {
            expect(ids.has(song.id), song.id).toBe(false);
            ids.add(song.id);
            expect(song.title.trim(), song.id).not.toBe('');
            expect(song.authors.length, song.id).toBeGreaterThan(0);
            expect(song.verses.length, song.id).toBeGreaterThan(0);
            for (const verse of song.verses) {
                expect(verse.trim(), song.id).not.toBe('');
            }
            // A song with no usable source link would import with no
            // attachment at all - the link back to the transcription is part
            // of the record, not a nicety.
            expect(song.sources.length, song.id).toBeGreaterThan(0);
            for (const { title, url } of song.sources) {
                expect(title.trim(), song.id).not.toBe('');
                expect(url, song.id).toMatch(/^https?:\/\/\S+$/);
            }
            expect(
                genPublicDomainSongAttachmentLines(song.sources).length,
                song.id,
            ).toBe(song.sources.length);
        }
    });

    test('every catalog song maps onto valid open-lyric markdown', () => {
        for (const song of publicDomainSongCatalog) {
            const markdown = publicDomainSongToMarkdown(song);
            expect(markdown, song.id).not.toBeNull();
            expect(checkMarkdown(markdown as string), song.id).toBe(true);
        }
    });
});

describe('genPublicDomainSongParts', () => {
    test('a refrain hymn sings the chorus after every verse', () => {
        const { parts, structure } = genPublicDomainSongParts(
            genSong({
                verses: ['one', 'two', 'three'],
                refrain: 'the refrain',
            }),
        );
        expect(structure).toBe('V1CV2CV3C');
        expect(parts.map(({ name }) => name)).toEqual([
            'Verse 1',
            'Chorus',
            'Verse 2',
            'Verse 3',
        ]);
    });

    test('verses without a refrain keep plain encounter order', () => {
        const { parts, structure } = genPublicDomainSongParts(
            genSong({ verses: ['one', 'two'] }),
        );
        expect(structure).toBe('V1V2');
        expect(parts).toHaveLength(2);
    });

    test('a single verse stays unnumbered', () => {
        const { parts, structure } = genPublicDomainSongParts(genSong());
        expect(structure).toBe('V');
        expect(parts[0].name).toBe('Verse');
    });
});

describe('publicDomainSongToMarkdown', () => {
    test('builds a complete document the validator accepts', () => {
        const markdown = publicDomainSongToMarkdown(
            genSong({
                title: 'Amazing Test',
                authors: ['John Newton'],
                year: '1779',
                verses: ['verse one', 'verse two'],
                refrain: 'sing it again',
            }),
        );
        expect(markdown).toContain('# Amazing Test');
        expect(markdown).toContain('- Title: Amazing Test');
        expect(markdown).toContain('- Artist: John Newton');
        expect(markdown).toContain('- Copyright: Public Domain (1779)');
        expect(markdown).toContain('- Structure: V1CV2C');
        expect(markdown).toContain(
            '- Attachments: [Hymnary.org](https://hymnary.org/text/test_song)',
        );
        expect(markdown).toContain('```ol:Chorus\nsing it again\n```');
        expect(checkMarkdown(markdown as string)).toBe(true);
    });

    test('sanitizes brackets and fence-like lines from fetched text', () => {
        const markdown = publicDomainSongToMarkdown(
            genSong({
                verses: ['line [with] brackets\r\n``` fence like\r\nlast'],
            }),
        );
        expect(markdown).toContain('line (with) brackets');
        expect(markdown).not.toContain('[with]');
        expect(checkMarkdown(markdown as string)).toBe(true);
    });

    test('returns null when every verse is blank', () => {
        expect(
            publicDomainSongToMarkdown(genSong({ verses: ['   ', ''] })),
        ).toBeNull();
    });
});

describe('genPublicDomainSongAttachmentLines', () => {
    test('labels each link and keeps the URL verbatim', () => {
        expect(
            genPublicDomainSongAttachmentLines([
                { title: 'Hymnary.org', url: 'https://hymnary.org/text/x' },
            ]),
        ).toEqual(['[Hymnary.org](https://hymnary.org/text/x)']);
    });

    test('drops a source open-lyric would reject', () => {
        expect(
            genPublicDomainSongAttachmentLines([
                { title: 'Relative', url: '/text/x' },
                { title: 'Bare word', url: 'hymnary.org/text/x' },
                { title: 'Empty', url: '   ' },
            ]),
        ).toEqual([]);
    });

    test('a label that cannot be written falls back to the bare URL', () => {
        expect(
            genPublicDomainSongAttachmentLines([
                { title: '[]()', url: 'https://example.com/a.mp3' },
                { title: 'A [b] (c)', url: 'https://example.com/b.mp3' },
            ]),
        ).toEqual([
            'https://example.com/a.mp3',
            '[A b c](https://example.com/b.mp3)',
        ]);
    });

    test('every link of a multi-source song survives into the document', () => {
        const markdown = publicDomainSongToMarkdown(
            genSong({
                sources: [
                    { title: 'Hymnary.org', url: 'https://hymnary.org/text/x' },
                    { title: 'Wikisource', url: 'https://example.org/y' },
                ],
            }),
        ) as string;
        // The first link rides the field line, the rest are indented
        // continuations - unindented, they would read as new Config fields.
        expect(markdown).toContain(
            [
                '- Attachments: [Hymnary.org](https://hymnary.org/text/x)',
                '\t[Wikisource](https://example.org/y)',
            ].join('\n'),
        );
        expect(checkMarkdown(markdown)).toBe(true);
    });

    test('open-lyric reads the links back as attachment records', () => {
        const markdown = publicDomainSongToMarkdown(
            genSong({
                sources: [
                    {
                        title: 'Hymnary.org',
                        url: 'https://hymnary.org/text/amazing_grace',
                    },
                    { title: 'Demo', url: 'https://example.com/demo.mp3' },
                ],
            }),
        ) as string;
        expect(readAttachments(markdown)).toEqual([
            {
                title: 'Hymnary.org',
                type: 'other',
                link: 'https://hymnary.org/text/amazing_grace',
            },
            {
                title: 'Demo',
                type: 'audio',
                link: 'https://example.com/demo.mp3',
            },
        ]);
    });

    test('every catalog song hands open-lyric its source link', () => {
        for (const song of publicDomainSongCatalog) {
            const markdown = publicDomainSongToMarkdown(song) as string;
            expect(
                readAttachments(markdown).map(({ link }) => link),
                song.id,
            ).toEqual(song.sources.map(({ url }) => url));
        }
    });

    test('a song with no source still builds a valid document', () => {
        const markdown = publicDomainSongToMarkdown(
            genSong({ sources: [] }),
        ) as string;
        expect(markdown).not.toContain('- Attachments:');
        expect(checkMarkdown(markdown)).toBe(true);
    });
});

describe('filterPublicDomainSongs', () => {
    const songs = [
        genSong({ id: 'a', title: 'Amazing Grace', authors: ['John Newton'] }),
        genSong({ id: 'b', title: 'Rock of Ages', authors: ['Toplady'] }),
    ];

    test('an empty query lists everything for browsing', () => {
        expect(filterPublicDomainSongs(songs, '')).toHaveLength(2);
        expect(filterPublicDomainSongs(songs, '   ')).toHaveLength(2);
    });

    test('tokens all have to match title or authors', () => {
        expect(filterPublicDomainSongs(songs, 'grace')).toHaveLength(1);
        expect(filterPublicDomainSongs(songs, 'newton grace')).toHaveLength(1);
        expect(filterPublicDomainSongs(songs, 'grace toplady')).toHaveLength(0);
        expect(filterPublicDomainSongs(songs, 'zzz')).toHaveLength(0);
    });
});

describe('sanitizeFileName', () => {
    test('strips Windows-illegal characters and falls back', () => {
        expect(sanitizeFileName('Rock of Ages: Cleft / for Me?')).toBe(
            'Rock of Ages Cleft for Me',
        );
        expect(sanitizeFileName('***')).toBe('Public Domain Song');
    });
});
