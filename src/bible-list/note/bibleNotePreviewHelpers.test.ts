import { describe, expect, test } from 'vitest';

import {
    BIBLE_NOTE_PREVIEW_FILE_PARAM_NAME,
    checkIsBibleNoteFileName,
    getBibleNotePreviewFilePath,
} from './bibleNotePreviewHelpers';

function genUrl(filePath: string) {
    const url = new URL('https://localhost:3000/bibleNote.html?id=3');
    url.searchParams.set(BIBLE_NOTE_PREVIEW_FILE_PARAM_NAME, filePath);
    return url.toString();
}

describe('bibleNotePreviewHelpers', () => {
    test('a note file is a .own, whatever the case', () => {
        expect(checkIsBibleNoteFileName('GEN.1.own')).toBe(true);
        expect(checkIsBibleNoteFileName('Default.OWN')).toBe(true);
        expect(checkIsBibleNoteFileName('GEN.1.own.json')).toBe(false);
    });

    test('reads the previewed file back out of the window URL', () => {
        const filePath = 'C:\\Users\\me\\resources\\Document\\GEN.1.own';
        expect(getBibleNotePreviewFilePath(genUrl(filePath))).toBe(filePath);
    });

    test('an ordinary note window is not a preview', () => {
        expect(
            getBibleNotePreviewFilePath(
                'https://localhost:3000/bibleNote.html?file=Default.own&id=3',
            ),
        ).toBeNull();
    });

    test('refuses a path that is not a note file', () => {
        expect(getBibleNotePreviewFilePath(genUrl('/etc/passwd'))).toBeNull();
    });
});
