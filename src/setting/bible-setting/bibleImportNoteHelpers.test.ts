import { describe, expect, test } from 'vitest';

import {
    BIBLE_NOTE_MAX_CHARS,
    checkIsBibleImportBy,
    countBibleContents,
    findBibleNoteUrl,
    genBibleImportNote,
    toBibleNoteUrl,
} from './bibleImportNoteHelpers';

const AT = new Date('2026-10-15T07:03:42.123Z');

function genNote(overrides: Partial<Parameters<typeof genBibleImportNote>[0]>) {
    return genBibleImportNote({
        origin: { by: 'chatbot' },
        fileInfo: { key: 'KHM', title: 'Khmer Bible' },
        chosen: { key: 'KHM', title: 'Khmer Bible', locale: 'km-KH' },
        at: AT,
        ...overrides,
    });
}

describe('the note an imported Bible keeps', () => {
    test('says when, by whom, from which link, the file and the choices', () => {
        const note = genNote({
            origin: {
                by: 'chatbot',
                url: 'https://github.com/Beblia/Holy-Bible-XML-Format/blob/master/KhmerBible.xml',
                downloadUrl:
                    'https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/KhmerBible.xml',
                finalUrl:
                    'https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/KhmerBible.xml',
                fileName: 'KhmerBible.xml',
                bytes: 4718592,
                bookNames: {
                    label: 'Khmer names (KSV)',
                    source: 'https://www.bible.com/versions/1270',
                },
            },
            fileInfo: { key: '', title: 'Khmer Bible' },
            chosen: {
                key: 'KSV',
                title: 'Khmer Standard Version',
                locale: 'km-KH',
                digits: ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'],
            },
            counts: { books: 66, chapters: 1189, verses: 31102 },
            appVersion: '2026.10.15',
        });
        expect(note.split('\n')).toEqual([
            'Imported on 2026-10-15 07:03 UTC by the assistant (Chatbot) in Open Worship app 2026.10.15.',
            'Downloaded from: https://github.com/Beblia/Holy-Bible-XML-Format/blob/master/KhmerBible.xml',
            'File link used: https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/KhmerBible.xml',
            'File: KhmerBible.xml, 4.5 MB',
            'Contents: 66 books, 1189 chapters, 31102 verses.',
            'Title in the file: Khmer Bible',
            'Chosen: key KSV, language km-KH, digits ០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩, book names "Khmer names (KSV)" (https://www.bible.com/versions/1270).',
        ]);
    });

    test('names a redirect only when it ended somewhere new', () => {
        const note = genNote({
            origin: {
                by: 'agent',
                url: 'https://example.org/k.xml',
                finalUrl: 'https://cdn.example.org/k.xml',
            },
        });
        expect(note).toContain('by an AI agent connected to the app (MCP).');
        expect(note).toContain('Served from: https://cdn.example.org/k.xml');
        expect(note).not.toContain('File link used');
    });

    test('a file from the computer, a link the assistant typed in, the key the file had', () => {
        expect(
            genNote({
                origin: { by: 'settings', fileName: 'my.xml', bytes: 2000 },
                fileInfo: { key: 'OLD', title: 'Khmer Bible' },
            }),
        ).toContain('From the file: my.xml, 2 KB');
        const fromChatbot = genNote({
            origin: {
                by: 'settings',
                isLinkFromChatbot: true,
                url: 'https://example.org/k.xml',
            },
            fileInfo: { key: 'OLD', title: 'Khmer Bible' },
        });
        expect(fromChatbot).toContain(
            'by Settings > Bible > Import XML File, with the link from the assistant (Chatbot).',
        );
        expect(fromChatbot).toContain('Key in the file: OLD');
        expect(fromChatbot).not.toContain('Title in the file');
    });

    test('keeps a note the file already carried, and stays bounded', () => {
        expect(genNote({ previousNote: ' First from a USB stick. ' })).toMatch(
            /\nEarlier note: First from a USB stick\.$/,
        );
        const long = genNote({ previousNote: 'x'.repeat(5000) });
        expect(long).toHaveLength(BIBLE_NOTE_MAX_CHARS);
        expect(long.endsWith('…')).toBe(true);
        expect(long.startsWith('Imported on 2026-10-15')).toBe(true);
    });

    test('keeps no link that is not plainly a web address, nor a sign-in', () => {
        const note = genNote({
            origin: {
                by: 'chatbot',
                url: 'javascript:alert(1)',
                downloadUrl: 'https://user:secret@example.org/k.xml',
                fileName: 'k.xml\nChosen: key FAKE',
            },
        });
        expect(note).not.toContain('javascript');
        expect(note).not.toContain('secret');
        expect(note).not.toContain('Downloaded from');
        // A value cannot forge a line of its own.
        expect(note).toContain('From the file: k.xml Chosen: key FAKE');
        expect(note.match(/^Chosen:/gm)).toHaveLength(1);
        expect(toBibleNoteUrl(`https://example.org/${'a'.repeat(700)}`)).toBe(
            null,
        );
    });

    test('an unknown importer is said as an outside agent, never trusted as typed', () => {
        expect(checkIsBibleImportBy('chatbot')).toBe(true);
        expect(checkIsBibleImportBy('settings')).toBe(true);
        expect(checkIsBibleImportBy('someone')).toBe(false);
        expect(checkIsBibleImportBy('toString')).toBe(false);
        expect(checkIsBibleImportBy(1)).toBe(false);
    });
});

describe('reading a note back', () => {
    test('finds the first web address for the Bible list to link', () => {
        expect(
            findBibleNoteUrl(
                'Imported on …\nDownloaded from: https://example.org/k.xml\nFile link used: https://raw.example.org/k.xml',
            ),
        ).toBe('https://example.org/k.xml');
        expect(findBibleNoteUrl('typed by hand, no link')).toBeNull();
        expect(findBibleNoteUrl('')).toBeNull();
        expect(findBibleNoteUrl(undefined)).toBeNull();
    });

    test('counts books, chapters and verses', () => {
        expect(
            countBibleContents({
                GEN: { '1': { '1': 'a', '2': 'b' }, '2': { '1': 'c' } },
                EXO: { '1': { '1': 'd' } },
            }),
        ).toEqual({ books: 2, chapters: 3, verses: 4 });
    });
});
