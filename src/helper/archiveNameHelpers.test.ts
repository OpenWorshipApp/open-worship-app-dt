import { beforeEach, describe, expect, test, vi } from 'vitest';

const { fsCheckFileExistMock } = vi.hoisted(() => ({
    fsCheckFileExistMock: vi.fn(),
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: fsCheckFileExistMock,
    pathBasename: (filePath: string) => {
        return filePath.split('/').pop() ?? filePath;
    },
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

import {
    checkIsArchiveFileFullName,
    checkIsEncryptedArchiveFileFullName,
    genNextArchiveFilePath,
    toArchiveBaseName,
    toArchiveDotExtension,
    toArchiveFileNameFromUrl,
    toEncryptedDotExtension,
} from './archiveNameHelpers';

const PLAYLIST = '.owapl.tar.gz';
const DATA = '.owadata.tar';

describe('the name a protected archive takes', () => {
    test('swaps the compression tail for `.enc`', () => {
        expect(toEncryptedDotExtension(PLAYLIST)).toBe('.owapl.enc');
        expect(toEncryptedDotExtension(DATA)).toBe('.owadata.enc');
        expect(toEncryptedDotExtension('.owadoc.tar.gz')).toBe('.owadoc.enc');
        expect(toEncryptedDotExtension('.owbible.tar.gz')).toBe('.owbible.enc');
        expect(toEncryptedDotExtension('.owabn.tar.gz')).toBe('.owabn.enc');
    });

    // The kind stays in the name so every drop gate keeps routing by name
    // alone, with no need to open the file to learn where it belongs.
    test('keeps the kind in the extension', () => {
        expect(toEncryptedDotExtension(PLAYLIST)).toContain('owapl');
    });

    test('is only used when there is a password', () => {
        expect(toArchiveDotExtension(PLAYLIST, null)).toBe(PLAYLIST);
        expect(toArchiveDotExtension(PLAYLIST, '')).toBe(PLAYLIST);
        expect(toArchiveDotExtension(PLAYLIST, 'secret')).toBe('.owapl.enc');
    });
});

describe('recognising an archive by name', () => {
    test.each([
        'Service.owapl.tar.gz',
        'Service (1).owapl.tar.gz',
        // What older builds wrote for a second export.
        'Service.owapl.tar (1).gz',
        'Service.owapl.enc',
        'Service (1).owapl.enc',
        'Service.owapl (2).enc',
    ])('takes %s', (fileFullName) => {
        expect(checkIsArchiveFileFullName(fileFullName, PLAYLIST)).toBe(true);
    });

    test.each([
        'holiday-photos.gz',
        'Service.owadoc.tar.gz',
        'Service.owadoc.enc',
        'Service.owp',
        'Service.enc',
    ])('refuses %s', (fileFullName) => {
        expect(checkIsArchiveFileFullName(fileFullName, PLAYLIST)).toBe(false);
    });

    test('tells a protected one from a plain one', () => {
        expect(
            checkIsEncryptedArchiveFileFullName('Service.owapl.enc', PLAYLIST),
        ).toBe(true);
        expect(
            checkIsEncryptedArchiveFileFullName(
                'Service.owapl.tar.gz',
                PLAYLIST,
            ),
        ).toBe(false);
    });

    // The imported playlist is named after the archive, so the extension has to
    // come off in every shape — including the protected one.
    test.each([
        ['Service.owapl.tar.gz', 'Service'],
        ['Service (1).owapl.tar.gz', 'Service (1)'],
        ['Service.owapl.tar (3).gz', 'Service'],
        ['Service.owapl.enc', 'Service'],
        ['Service (2).owapl.enc', 'Service (2)'],
    ])('strips %s down to %s', (fileFullName, expected) => {
        expect(toArchiveBaseName(fileFullName, PLAYLIST)).toBe(expected);
    });
});

describe('naming a downloaded archive', () => {
    test('keeps a protected URL name protected', () => {
        // Renaming it to `.owapl.tar.gz` would put a tar's name on a file that
        // is not one, and send the operator to a tool that cannot read it.
        expect(
            toArchiveFileNameFromUrl(
                'https://example.com/service.owapl.enc',
                PLAYLIST,
                'Playlist',
            ),
        ).toBe('service.owapl.enc');
    });

    test('keeps a plain URL name plain', () => {
        expect(
            toArchiveFileNameFromUrl(
                'https://example.com/service.owapl.tar.gz',
                PLAYLIST,
                'Playlist',
            ),
        ).toBe('service.owapl.tar.gz');
    });

    test('falls back to the plain extension for anything else', () => {
        expect(
            toArchiveFileNameFromUrl(
                'https://example.com/download.bin',
                PLAYLIST,
                'Playlist',
            ),
        ).toBe('download.owapl.tar.gz');
    });
});

describe('finding a free path', () => {
    beforeEach(() => {
        fsCheckFileExistMock.mockResolvedValue(false);
    });

    test('keeps the whole extension when it counts up', async () => {
        const taken = new Set([
            '/downloads/Service.owapl.enc',
            '/downloads/Service (1).owapl.enc',
        ]);
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return taken.has(filePath);
        });

        expect(
            await genNextArchiveFilePath(
                '/downloads',
                'Service.owapl.enc',
                '.owapl.enc',
            ),
        ).toBe('/downloads/Service (2).owapl.enc');
    });

    // A folder that answers "taken" to everything used to spin here forever,
    // building a longer string each turn until the process ran out of memory.
    test('gives up rather than looping forever', async () => {
        fsCheckFileExistMock.mockResolvedValue(true);

        await expect(
            genNextArchiveFilePath(
                '/downloads',
                'Service.owapl.enc',
                '.owapl.enc',
            ),
        ).rejects.toThrow('Unable to find a free name');
    });
});
