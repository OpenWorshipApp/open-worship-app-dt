import { describe, expect, test } from 'vitest';

import {
    genResourceFolderLabels,
    resolveResourceBookKeyFromMaps,
    resolveResourceFileName,
    splitResourceFileName,
    toPageSpanText,
    toResourceBookKey,
    toResourceFileKind,
    toResourceFileName,
} from './agentResourceNameHelpers';

// As `path.basename` names a folder: a trailing separator is not a name.
function toBaseName(dirPath: string) {
    return (
        dirPath
            .replace(/[\\/]+$/, '')
            .split(/[\\/]/)
            .pop() ?? ''
    );
}

const WINDOWS_RULES = {
    toBaseName,
    toCompareKey: (path: string) => path.toLowerCase(),
    separator: '\\',
};

describe('a Resources file as the tool names it', () => {
    test('is its folder and the path inside it, never the whole path', () => {
        const dirPaths = [
            'D:\\owa\\resources\\pdf',
            'C:\\Users\\Somebody\\shelf',
        ];
        expect(
            toResourceFileName(
                'D:\\owa\\resources\\pdf\\LUK.7.pdf',
                dirPaths,
                WINDOWS_RULES,
            ),
        ).toBe('pdf/LUK.7.pdf');
        // A folder's name, not the account it sits under.
        expect(
            toResourceFileName(
                'c:\\users\\somebody\\SHELF\\notes\\LUK.own',
                dirPaths,
                WINDOWS_RULES,
            ),
        ).toBe('shelf/notes/LUK.own');
        // Outside every folder, or only a folder's namesake: not Resources.
        expect(
            toResourceFileName('D:\\other\\LUK.7.pdf', dirPaths, WINDOWS_RULES),
        ).toBeNull();
        expect(
            toResourceFileName(
                'D:\\owa\\resources\\pdf-old\\LUK.7.pdf',
                dirPaths,
                WINDOWS_RULES,
            ),
        ).toBeNull();
    });

    test('makes two folders of one name tell apart', () => {
        expect(
            genResourceFolderLabels(
                ['/a/pdf', '/b/PDF', '/c/notes', '/d/pdf'],
                toBaseName,
            ),
        ).toEqual(['pdf', 'PDF#2', 'notes', 'pdf#3']);
    });

    test('is read back only when it stays inside its folder', () => {
        expect(splitResourceFileName('pdf/LUK.7.pdf')).toEqual({
            folder: 'pdf',
            innerParts: ['LUK.7.pdf'],
        });
        expect(splitResourceFileName('shelf\\notes\\LUK.own')).toEqual({
            folder: 'shelf',
            innerParts: ['notes', 'LUK.own'],
        });
        for (const name of [
            'LUK.7.pdf',
            'pdf/../../secret.txt',
            'pdf/./LUK.7.pdf',
            'C:/Windows/win.ini',
            'pdf/C:/x.txt',
            '',
        ]) {
            expect(splitResourceFileName(name), name).toBeNull();
        }
    });
});

describe('what the tool reads a file as', () => {
    test('is decided by its name', () => {
        expect(toResourceFileKind('LUK.7.PDF')).toBe('pdf');
        expect(toResourceFileKind('LUK.own')).toBe('note');
        expect(toResourceFileKind('map.JPEG')).toBe('picture');
        expect(toResourceFileKind('LUK.0.links.json')).toBe('text');
        expect(toResourceFileKind('notes.markdown')).toBe('text');
        expect(toResourceFileKind('sermon.docx')).toBeNull();
        expect(toResourceFileKind('song.mp4')).toBeNull();
    });
});

describe('a book as Resources file names write it', () => {
    test('comes from its code or its English name, in any case', () => {
        expect(toResourceBookKey('LUK')).toBe('LUK');
        expect(toResourceBookKey('luke')).toBe('LUK');
        expect(toResourceBookKey('1 John')).toBe('1JN');
        expect(toResourceBookKey(' Song of Solomon ')).toBe('SNG');
        expect(toResourceBookKey('Lukas')).toBeNull();
        expect(toResourceBookKey('')).toBeNull();
        expect(toResourceBookKey(undefined)).toBeNull();
    });

    test('pages read are said as a span', () => {
        expect(toPageSpanText(1, 8)).toBe('1-8');
        expect(toPageSpanText(9, 1)).toBe('9');
    });
});

describe('a name a button carries, back to the file', () => {
    const dirPaths = ['D:\\owa\\resources\\pdf', 'D:\\owa\\notes\\'];
    const rules = { toBaseName, separator: '\\' };

    test('is the file inside the folder the name says', () => {
        expect(resolveResourceFileName('pdf/LUK.7.pdf', dirPaths, rules)).toBe(
            'D:\\owa\\resources\\pdf\\LUK.7.pdf',
        );
        expect(
            resolveResourceFileName('NOTES/luke/LUK.own', dirPaths, rules),
        ).toBe('D:\\owa\\notes\\luke\\LUK.own');
    });

    test('is nothing for a folder the panel does not list, or a way out', () => {
        for (const name of [
            'music/LUK.7.pdf',
            'pdf/../secret.txt',
            'pdf/C:/Windows/win.ini',
            'LUK.7.pdf',
        ]) {
            expect(resolveResourceFileName(name, dirPaths, rules), name).toBe(
                null,
            );
        }
    });
});

describe('a book named in the Bible’s own language', () => {
    const KEY_BOOK_MAP_LIST = [{ GEN: 'លោកុប្បត្តិ', JHN: 'យ៉ូហាន' }];

    test('is its key, after the code and the English name', () => {
        expect(
            resolveResourceBookKeyFromMaps('យ៉ូហាន', KEY_BOOK_MAP_LIST),
        ).toBe('JHN');
        expect(resolveResourceBookKeyFromMaps('John', KEY_BOOK_MAP_LIST)).toBe(
            'JHN',
        );
        expect(resolveResourceBookKeyFromMaps('JHN', KEY_BOOK_MAP_LIST)).toBe(
            'JHN',
        );
        expect(
            resolveResourceBookKeyFromMaps('unknown', KEY_BOOK_MAP_LIST),
        ).toBeNull();
    });
});
