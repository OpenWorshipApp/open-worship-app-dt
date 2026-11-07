import { describe, expect, test, vi } from 'vitest';

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async () => false,
    pathBasename: (filePath: string) => filePath.split('/').pop() ?? filePath,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

import {
    sanitizeFileNamePart,
    toArchiveFileName,
    toArchiveFileNameFromUrl,
} from './archiveNameHelpers';

describe('the name an exported archive is given', () => {
    test('turns every character a file system refuses into one underscore', () => {
        expect(sanitizeFileNamePart('Sunday: "Hymns" <AM>/PM?')).toBe(
            'Sunday_ _Hymns_ _AM_PM',
        );
        expect(sanitizeFileNamePart('a\\b|c*d')).toBe('a_b_c_d');
        // Control characters too, a tab among them.
        expect(sanitizeFileNamePart('Tab\there\u0007bell')).toBe(
            'Tab_here_bell',
        );
        // Whatever is past ASCII, a sign or an emoji, is kept whole.
        expect(sanitizeFileNamePart('✝ ① ♪ 🎵')).toBe('✝ ① ♪ 🎵');
    });

    test('falls back when nothing usable is left, and stays short', () => {
        expect(toArchiveFileName('  ...  ', '.owadoc.tar.gz', 'document')).toBe(
            'document.owadoc.tar.gz',
        );
        expect(toArchiveFileName('???', '.owapf.tar.gz', 'flow')).toBe(
            'flow.owapf.tar.gz',
        );
        expect(
            toArchiveFileName('x'.repeat(200), '.owapf.tar.gz', 'flow'),
        ).toBe(`${'x'.repeat(120)}.owapf.tar.gz`);
    });

    test('cleans the name a download URL carries', () => {
        expect(
            toArchiveFileNameFromUrl(
                'https://example.com/files/Easter%3A%20Choir.owapf.tar.gz',
                '.owapf.tar.gz',
                'presenting-flow',
            ),
        ).toBe('Easter_ Choir.owapf.tar.gz');
    });
});
