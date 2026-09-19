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

const PRESENTING_FLOW = '.owapf.tar.gz';
const DATA = '.owadata.tar';

describe('the name a protected archive takes', () => {
    test('swaps the compression tail for `.enc`', () => {
        expect(toEncryptedDotExtension(PRESENTING_FLOW)).toBe('.owapf.enc');
        expect(toEncryptedDotExtension(DATA)).toBe('.owadata.enc');
        expect(toEncryptedDotExtension('.owadoc.tar.gz')).toBe('.owadoc.enc');
        expect(toEncryptedDotExtension('.owbible.tar.gz')).toBe('.owbible.enc');
        expect(toEncryptedDotExtension('.owabn.tar.gz')).toBe('.owabn.enc');
    });

    // The kind stays in the name so every drop gate keeps routing by name
    // alone, with no need to open the file to learn where it belongs.
    test('keeps the kind in the extension', () => {
        expect(toEncryptedDotExtension(PRESENTING_FLOW)).toContain('owapf');
    });

    test('is only used when there is a password', () => {
        expect(toArchiveDotExtension(PRESENTING_FLOW, null)).toBe(
            PRESENTING_FLOW,
        );
        expect(toArchiveDotExtension(PRESENTING_FLOW, '')).toBe(
            PRESENTING_FLOW,
        );
        expect(toArchiveDotExtension(PRESENTING_FLOW, 'secret')).toBe(
            '.owapf.enc',
        );
    });
});

describe('recognising an archive by name', () => {
    test.each([
        'Service.owapf.tar.gz',
        'Service (1).owapf.tar.gz',
        // What older builds wrote for a second export.
        'Service.owapf.tar (1).gz',
        'Service.owapf.enc',
        'Service (1).owapf.enc',
        'Service.owapf (2).enc',
    ])('takes %s', (fileFullName) => {
        expect(checkIsArchiveFileFullName(fileFullName, PRESENTING_FLOW)).toBe(
            true,
        );
    });

    test.each([
        'holiday-photos.gz',
        'Service.owadoc.tar.gz',
        'Service.owadoc.enc',
        'Service.owpf',
        'Service.enc',
    ])('refuses %s', (fileFullName) => {
        expect(checkIsArchiveFileFullName(fileFullName, PRESENTING_FLOW)).toBe(
            false,
        );
    });

    test('tells a protected one from a plain one', () => {
        expect(
            checkIsEncryptedArchiveFileFullName(
                'Service.owapf.enc',
                PRESENTING_FLOW,
            ),
        ).toBe(true);
        expect(
            checkIsEncryptedArchiveFileFullName(
                'Service.owapf.tar.gz',
                PRESENTING_FLOW,
            ),
        ).toBe(false);
    });

    // The imported presenting flow is named after the archive, so the extension has to
    // come off in every shape — including the protected one.
    test.each([
        ['Service.owapf.tar.gz', 'Service'],
        ['Service (1).owapf.tar.gz', 'Service (1)'],
        ['Service.owapf.tar (3).gz', 'Service'],
        ['Service.owapf.enc', 'Service'],
        ['Service (2).owapf.enc', 'Service (2)'],
    ])('strips %s down to %s', (fileFullName, expected) => {
        expect(toArchiveBaseName(fileFullName, PRESENTING_FLOW)).toBe(expected);
    });
});

describe('naming a downloaded archive', () => {
    test('keeps a protected URL name protected', () => {
        // Renaming it to `.owapf.tar.gz` would put a tar's name on a file that
        // is not one, and send the operator to a tool that cannot read it.
        expect(
            toArchiveFileNameFromUrl(
                'https://example.com/service.owapf.enc',
                PRESENTING_FLOW,
                'PresentingFlow',
            ),
        ).toBe('service.owapf.enc');
    });

    test('keeps a plain URL name plain', () => {
        expect(
            toArchiveFileNameFromUrl(
                'https://example.com/service.owapf.tar.gz',
                PRESENTING_FLOW,
                'PresentingFlow',
            ),
        ).toBe('service.owapf.tar.gz');
    });

    test('falls back to the plain extension for anything else', () => {
        expect(
            toArchiveFileNameFromUrl(
                'https://example.com/download.bin',
                PRESENTING_FLOW,
                'PresentingFlow',
            ),
        ).toBe('download.owapf.tar.gz');
    });
});

describe('finding a free path', () => {
    beforeEach(() => {
        fsCheckFileExistMock.mockResolvedValue(false);
    });

    test('keeps the whole extension when it counts up', async () => {
        const taken = new Set([
            '/downloads/Service.owapf.enc',
            '/downloads/Service (1).owapf.enc',
        ]);
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return taken.has(filePath);
        });

        expect(
            await genNextArchiveFilePath(
                '/downloads',
                'Service.owapf.enc',
                '.owapf.enc',
            ),
        ).toBe('/downloads/Service (2).owapf.enc');
    });

    // A folder that answers "taken" to everything used to spin here forever,
    // building a longer string each turn until the process ran out of memory.
    test('gives up rather than looping forever', async () => {
        fsCheckFileExistMock.mockResolvedValue(true);

        await expect(
            genNextArchiveFilePath(
                '/downloads',
                'Service.owapf.enc',
                '.owapf.enc',
            ),
        ).rejects.toThrow('Unable to find a free name');
    });
});
