import { describe, expect, it } from 'vitest';

import {
    checkIsDeckFileName,
    checkIsDocumentSongAsk,
    DECK_SONG_REPLY,
    DECK_SONG_TOOL_NAME,
    genDeckSongListAnswer,
    MAX_DECK_BUTTON_COUNT,
    pickDeckFiles,
    pickOpenSongDocuments,
    readDeckSongArgs,
    readDeckSongAsk,
    SONG_DOCUMENT_KIND_LIST,
    toDeckFilePath,
} from './deckSongAskHelpers';

// EC-590: the user's two lines, answered "The app cannot turn a PowerPoint
// file into a lyric file" by the shared server.
describe('readDeckSongAsk', () => {
    it('reads the asks a volunteer types for a song out of a deck', () => {
        for (const asked of [
            'turn powerpoint to lyric',
            'new lyric from powerpoint',
            'Can you turn a PowerPoint song into a lyric file?',
            'convert pptx to song',
            'make songs from my Word documents',
            'Create a lyric file from the PowerPoint',
            'import a powerpoint song',
            'powerpoint to lyric',
            'I want to change my hymn slide deck into lyrics',
            // The other kinds (the user: _after powerpoint to lyric then
            // appdocument to lyric_, _also add other support like docx pdf_).
            'make a song from my PDF',
            'turn my slide document into a lyric',
            'create lyrics from the Word file',
            'new lyric from my document',
            'turn the document into a song',
        ]) {
            expect(readDeckSongAsk(asked), asked).not.toBeNull();
        }
    });

    it('keeps the words that may name the song, and only those', () => {
        expect(
            readDeckSongAsk('turn the Amazing Grace powerpoint into a lyric'),
        ).toEqual({ nameWords: ['amazing', 'grace'], kinds: ['pptx'] });
        // A quoted title is read alone, and its little words tell no file
        // apart: "How" goes as it does from any ask.
        expect(
            readDeckSongAsk('make a song from "How Great Thou Art.pptx"'),
        ).toEqual({ nameWords: ['great', 'thou', 'art'], kinds: ['pptx'] });
        expect(readDeckSongAsk('turn powerpoint to lyric')).toEqual({
            nameWords: [],
            kinds: ['pptx'],
        });
    });

    it('keeps the kinds of file the ask named, every kind when none', () => {
        expect(readDeckSongAsk('make a song from my PDF')?.kinds).toEqual([
            'pdf',
        ]);
        expect(
            readDeckSongAsk('turn my slide document into a lyric')?.kinds,
        ).toEqual(['ows']);
        expect(
            readDeckSongAsk('make songs from my Word documents')?.kinds,
        ).toEqual(['docx']);
        expect(readDeckSongAsk('new lyric from my document')?.kinds).toEqual([
            ...SONG_DOCUMENT_KIND_LIST,
        ]);
    });

    it('is no such ask the other way round, or about something else', () => {
        for (const asked of [
            '',
            'lyric',
            'powerpoint',
            'How do I add a PowerPoint?',
            'How do I make a new song?',
            'export the song to PowerPoint',
            'Can I export a lyric as a PowerPoint?',
            'turn this song into a powerpoint',
            'make a powerpoint from my song',
            'create a new PowerPoint for the hymn',
            'show the powerpoint song on the screen',
            '/lyric powerpoint song',
            'turn powerpoint to lyric https://example.com/a.pptx',
            'turn powerpoint\nto lyric',
            `turn ${'very '.repeat(30)}long powerpoint into a song`,
            // A bare "document" is a song's own file, and a PDF made OF a
            // song is exporting.
            'How do I make a new song document?',
            'make a pdf of the song',
            'export the song as a PDF',
            'print the lyrics to PDF',
        ]) {
            expect(readDeckSongAsk(asked), asked).toBeNull();
        }
    });
});

describe('checkIsDeckFileName', () => {
    it('takes the documents whose words are read: slides, decks, Word, PDF', () => {
        expect(checkIsDeckFileName('Amazing Grace.pptx')).toBe(true);
        expect(checkIsDeckFileName('hymn.DOCX')).toBe(true);
        expect(checkIsDeckFileName('Sunday.ows')).toBe(true);
        expect(checkIsDeckFileName('notes.pdf')).toBe(true);
        expect(checkIsDeckFileName('old.ppt')).toBe(false);
        expect(checkIsDeckFileName('song.owl')).toBe(false);
    });
});

// EC-590: an ask made over the documents in front of the person -- the
// card's own button, or words typed under the file.
describe('checkIsDocumentSongAsk', () => {
    it('reads a song made from the documents, or them turned into one', () => {
        for (const asked of [
            DECK_SONG_REPLY,
            'make a song from this',
            'Create lyric files from these',
            'make songs from the attached files',
            'extract the lyrics from this PDF',
            'make a hymn of it',
            'turn this into a lyric',
            'convert it to a song',
            'Turn this PowerPoint into lyrics.',
            'turn the slides into a song please',
            'turn it into lyrics for Sunday',
            'Can you make a song from it?',
            'Could you please turn this into a song file?',
        ]) {
            expect(checkIsDocumentSongAsk(asked), asked).toBe(true);
        }
    });

    it('is no such ask for a change to the slides or a question', () => {
        for (const asked of [
            '',
            'Make a song',
            // A slide document's own conversation: changes to its slides.
            'add the song title to slide 1',
            'change the title to the song name',
            "change slide 2 to the song's chorus",
            'make the song title bigger',
            // A Resources file's: questions about it.
            'write a summary of the song',
            'What is this song about?',
            'How do I make a song from a PowerPoint?',
            'export it as a song',
            '/lyric make a song from it',
            'make a song from https://example.com/song',
            'make a song\nfrom it',
            `make a song from ${'this very '.repeat(10)}long file`,
        ]) {
            expect(checkIsDocumentSongAsk(asked), asked).toBe(false);
        }
    });
});

describe('pickOpenSongDocuments', () => {
    const SLIDES = { filePath: '/docs/Sunday.ows', name: 'Sunday.ows' };
    const DECK = {
        filePath: '/docs/Amazing Grace.pptx',
        name: 'Amazing Grace.pptx',
    };

    it('the open documents, when the ask names none of its own', () => {
        expect(pickOpenSongDocuments([SLIDES], DECK_SONG_REPLY)).toEqual([
            SLIDES,
        ]);
        expect(
            pickOpenSongDocuments(
                [SLIDES],
                'turn this slide document into a song',
            ),
        ).toEqual([SLIDES]);
        // A deck said with a slide document open is that document.
        expect(
            pickOpenSongDocuments([SLIDES], 'turn this deck into a song'),
        ).toEqual([SLIDES]);
        expect(
            pickOpenSongDocuments(
                [DECK],
                'make a song from the Amazing Grace PowerPoint',
            ),
        ).toEqual([DECK]);
    });

    it('none when the ask names a kind or a name they are not', () => {
        expect(
            pickOpenSongDocuments([SLIDES], 'make a song from my PDF'),
        ).toBeNull();
        expect(
            pickOpenSongDocuments(
                [SLIDES],
                'make a song from the Amazing Grace PowerPoint',
            ),
        ).toBeNull();
        expect(
            pickOpenSongDocuments(
                [DECK],
                'make a song from the How Great Thou Art PowerPoint',
            ),
        ).toBeNull();
        expect(pickOpenSongDocuments([], DECK_SONG_REPLY)).toBeNull();
        expect(pickOpenSongDocuments(null, DECK_SONG_REPLY)).toBeNull();
    });
});

describe('pickDeckFiles', () => {
    const NAME_LIST = [
        'Sunday.ows',
        'Amazing Grace.pptx',
        'Amazing Love.pptx',
        'How Great Thou Art.docx',
        'Bulletin.pdf',
        'Amazing Grace.owl',
    ];

    it('lists every document, in the list order, with no name', () => {
        expect(pickDeckFiles(NAME_LIST, [])).toEqual({
            files: [
                'Sunday.ows',
                'Amazing Grace.pptx',
                'Amazing Love.pptx',
                'How Great Thou Art.docx',
                'Bulletin.pdf',
            ],
            isNamed: false,
        });
    });

    it('the kind the ask named first, every kind when the list has none', () => {
        expect(pickDeckFiles(NAME_LIST, [], ['pptx'])).toEqual({
            files: ['Amazing Grace.pptx', 'Amazing Love.pptx'],
            isNamed: false,
        });
        expect(pickDeckFiles(NAME_LIST, [], ['pdf', 'ows'])).toEqual({
            files: ['Sunday.ows', 'Bulletin.pdf'],
            isNamed: false,
        });
        expect(pickDeckFiles(['Hymn.docx'], [], ['pptx'])).toEqual({
            files: ['Hymn.docx'],
            isNamed: false,
        });
    });

    it('a name that fits no file of the kind named fits one of another', () => {
        // _the How Great Thou Art PowerPoint_ may well be a Word file.
        expect(pickDeckFiles(NAME_LIST, ['great'], ['pptx'])).toEqual({
            files: ['How Great Thou Art.docx'],
            isNamed: true,
        });
    });

    it('a name that fits one file settles it', () => {
        expect(pickDeckFiles(NAME_LIST, ['amazing', 'grace'])).toEqual({
            files: ['Amazing Grace.pptx'],
            isNamed: true,
        });
        expect(pickDeckFiles(NAME_LIST, ['great'])).toEqual({
            files: ['How Great Thou Art.docx'],
            isNamed: true,
        });
    });

    it('a name several fit keeps them all, the best first', () => {
        expect(pickDeckFiles(NAME_LIST, ['amazing'])).toEqual({
            files: ['Amazing Grace.pptx', 'Amazing Love.pptx'],
            isNamed: true,
        });
        // Each holds one of the two words: both are as good.
        expect(pickDeckFiles(NAME_LIST, ['grace', 'love'])).toEqual({
            files: ['Amazing Grace.pptx', 'Amazing Love.pptx'],
            isNamed: true,
        });
    });

    it('a word matches the start of a word of the name, never its middle', () => {
        expect(pickDeckFiles(NAME_LIST, ['race']).isNamed).toBe(false);
        expect(pickDeckFiles(NAME_LIST, ['gra']).files).toEqual([
            'Amazing Grace.pptx',
        ]);
    });

    // A hymnal's decks named by number, as the user's were: the number in
    // the ask is the file's name.
    it('a numbered deck is picked by its number', () => {
        const numbered = Array.from({ length: 12 }, (_value, index) => {
            return `${index + 1} .)  # ${index + 1} new.pptx`;
        });
        const asked = readDeckSongAsk('turn powerpoint 7 into a lyric');
        expect(asked).toEqual({ nameWords: ['7'], kinds: ['pptx'] });
        expect(pickDeckFiles(numbered, asked!.nameWords)).toEqual({
            files: ['7 .)  # 7 new.pptx'],
            isNamed: true,
        });
        // "1" starts "1", "10", "11" and "12": all four are offered.
        expect(pickDeckFiles(numbered, ['1']).files).toHaveLength(4);
    });

    it('a name no file fits offers every one', () => {
        expect(pickDeckFiles(NAME_LIST, ['blessed'])).toEqual({
            files: [
                'Sunday.ows',
                'Amazing Grace.pptx',
                'Amazing Love.pptx',
                'How Great Thou Art.docx',
                'Bulletin.pdf',
            ],
            isNamed: false,
        });
        // A song is no document a song is made from.
        expect(pickDeckFiles(['Amazing Grace.owl'], ['amazing'])).toEqual({
            files: [],
            isNamed: false,
        });
    });
});

describe('toDeckFilePath', () => {
    it('joins with the separator the folder is written with', () => {
        expect(toDeckFilePath('/Users/a/Documents', 'x.pptx')).toBe(
            '/Users/a/Documents/x.pptx',
        );
        expect(toDeckFilePath('/Users/a/Documents/', 'x.pptx')).toBe(
            '/Users/a/Documents/x.pptx',
        );
        expect(toDeckFilePath('C:\\Users\\a\\Documents', 'x.pptx')).toBe(
            'C:\\Users\\a\\Documents\\x.pptx',
        );
    });
});

describe('genDeckSongListAnswer', () => {
    it('with none in the list, says how to attach one and offers nothing', () => {
        const answer = genDeckSongListAnswer('/docs', []);
        expect(answer.actions).toEqual([]);
        expect(answer.text).toContain(
            'no slide document, PowerPoint, Word file or PDF',
        );
        expect(answer.text).toContain('Attach a file');
    });

    it('offers each file as a button that drafts it', () => {
        const answer = genDeckSongListAnswer('/docs', [
            'Amazing Grace.pptx',
            'Hymn.docx',
        ]);
        expect(answer.text).toContain('make a song out of the words');
        expect(answer.text).not.toContain('These are');
        expect(answer.actions).toEqual([
            {
                label: 'Make a song from "Amazing Grace.pptx"',
                toolName: DECK_SONG_TOOL_NAME,
                args: {
                    filePath: '/docs/Amazing Grace.pptx',
                    name: 'Amazing Grace.pptx',
                },
            },
            {
                label: 'Make a song from "Hymn.docx"',
                toolName: DECK_SONG_TOOL_NAME,
                args: { filePath: '/docs/Hymn.docx', name: 'Hymn.docx' },
            },
        ]);
    });

    it('past the button cap, says how many more there are', () => {
        const names = Array.from({ length: 9 }, (_value, index) => {
            return `Hymn ${index + 1}.pptx`;
        });
        const answer = genDeckSongListAnswer('/docs', names);
        expect(answer.actions).toHaveLength(MAX_DECK_BUTTON_COUNT);
        expect(answer.text).toContain(
            `These are ${MAX_DECK_BUTTON_COUNT} of the 9 in your Documents list.`,
        );
    });
});

describe('readDeckSongArgs', () => {
    it('reads a button back, and refuses anything but a deck', () => {
        expect(
            readDeckSongArgs({ filePath: '/docs/a.pptx', name: 'a.pptx' }),
        ).toEqual({ filePath: '/docs/a.pptx', name: 'a.pptx' });
        expect(readDeckSongArgs({ filePath: 'C:\\docs\\b.docx' })).toEqual({
            filePath: 'C:\\docs\\b.docx',
            name: 'b.docx',
        });
        expect(readDeckSongArgs({ filePath: '/docs/setting.json' })).toBeNull();
        expect(readDeckSongArgs({ name: 'a.pptx' })).toBeNull();
        expect(readDeckSongArgs(null)).toBeNull();
    });
});
