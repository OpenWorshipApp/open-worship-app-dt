import { describe, expect, it } from 'vitest';

import {
    checkIsNoteWindowUrl,
    findNoteWindow,
    toNoteFileFullName,
    toNoteWindowTarget,
} from './noteWindowMatchHelpers';

const TARGET = { fileFullName: 'Sermons.own', noteId: 3 };

describe('noteWindowMatchHelpers', () => {
    it('names a note by its file name and id', () => {
        expect(toNoteFileFullName('C:\\data\\notes\\Sermons.own')).toBe(
            'Sermons.own',
        );
        expect(toNoteFileFullName('/data/notes/Sermons.own')).toBe(
            'Sermons.own',
        );
        expect(toNoteWindowTarget('/data/notes/Sermons.own', 3)).toEqual(
            TARGET,
        );
        expect(toNoteWindowTarget('/data/notes/Sermons.own', null)).toBeNull();
        expect(toNoteWindowTarget('/data/notes/Sermons.own', -1)).toBeNull();
        expect(toNoteWindowTarget('/data/notes/Sermons.own', 1.5)).toBeNull();
        expect(toNoteWindowTarget('', 3)).toBeNull();
    });

    it('knows the note window by its page, file and id', () => {
        expect(
            checkIsNoteWindowUrl(
                'https://localhost:3000/bibleNote.html?file=Sermons.own&id=3&uuid=abc',
                TARGET,
            ),
        ).toBe(true);
        expect(
            checkIsNoteWindowUrl(
                'owa://local/bibleNote.html?id=3&file=Sermons.own&session=s1',
                TARGET,
            ),
        ).toBe(true);
        // Another note of the same file, another file, another page.
        expect(
            checkIsNoteWindowUrl(
                'https://localhost:3000/bibleNote.html?file=Sermons.own&id=4',
                TARGET,
            ),
        ).toBe(false);
        expect(
            checkIsNoteWindowUrl(
                'https://localhost:3000/bibleNote.html?file=Other.own&id=3',
                TARGET,
            ),
        ).toBe(false);
        expect(
            checkIsNoteWindowUrl(
                'https://localhost:3000/reader.html?file=Sermons.own&id=3',
                TARGET,
            ),
        ).toBe(false);
        expect(checkIsNoteWindowUrl('not a url at all ::', TARGET)).toBe(false);
    });

    it('a file name with spaces and signs is read decoded', () => {
        const target = { fileFullName: 'Sunday June 28.own', noteId: 0 };
        const url = new URL('https://localhost:3000/bibleNote.html');
        url.searchParams.set('file', target.fileFullName);
        url.searchParams.set('id', '0');
        expect(checkIsNoteWindowUrl(url.toString(), target)).toBe(true);
    });

    it('finds the note window among the app windows', () => {
        const windowList = [
            { id: 'main', url: 'https://localhost:3000/reader.html' },
            {
                id: 'other',
                url: 'https://localhost:3000/bibleNote.html?file=Sermons.own&id=1',
            },
            {
                id: 'mine',
                url: 'https://localhost:3000/bibleNote.html?file=Sermons.own&id=3',
            },
        ];
        expect(findNoteWindow(windowList, TARGET)?.id).toBe('mine');
        expect(findNoteWindow(windowList, { ...TARGET, noteId: 9 })).toBeNull();
    });
});
