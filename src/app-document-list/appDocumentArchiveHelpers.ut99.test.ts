import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
    listLangPackageCodes,
    toLangPackageDir,
} from '../test-setup/langPackageDirs';

// The documents list's configuration of the generic single-item bundle: every
// export is that bundle's function, handed the document config. The generic
// machinery is mocked whole, so nothing here reaches the app provider.

const { mocks } = vi.hoisted(() => ({
    mocks: {
        askFromUrl: vi.fn(),
        checkName: vi.fn(),
        create: vi.fn(),
        exportItem: vi.fn(),
        importDropped: vi.fn(),
        importArchive: vi.fn(),
        selectAndImport: vi.fn(),
    },
}));

vi.mock('../helper/singleItemArchiveHelpers', () => ({
    askAndImportSingleItemArchiveFromUrl: mocks.askFromUrl,
    checkIsSingleItemArchiveFileFullName: mocks.checkName,
    createSingleItemArchive: mocks.create,
    exportSingleItem: mocks.exportItem,
    importDroppedSingleItemArchive: mocks.importDropped,
    importSingleItemArchive: mocks.importArchive,
    selectAndImportSingleItemArchive: mocks.selectAndImport,
}));

import {
    APP_DOCUMENT_ARCHIVE_DOT_EXTENSION,
    askAndImportAppDocumentArchiveFromUrl,
    checkIsAppDocumentArchiveFileFullName,
    createAppDocumentArchive,
    exportAppDocument,
    importAppDocumentArchive,
    importDroppedAppDocumentArchive,
    selectAndImportAppDocumentArchive,
} from './appDocumentArchiveHelpers';

const documentConfig = {
    itemKind: 'document',
    dotExtension: '.owadoc.tar.gz',
    fallbackName: 'Document',
    workDirPrefix: 'owadoc',
    exportTitle: 'Export Document',
    importTitle: 'Import Document',
    urlLabel: 'Document Archive URL:',
    itemLabel: 'document',
};

beforeEach(() => {
    for (const [name, mock] of Object.entries(mocks)) {
        mock.mockReturnValue(`result of ${name}`);
    }
});

describe('appDocumentArchiveHelpers', () => {
    test('a document bundle is a .owadoc.tar.gz', () => {
        expect(APP_DOCUMENT_ARCHIVE_DOT_EXTENSION).toBe('.owadoc.tar.gz');
    });

    test.each([
        [
            'names an archive file',
            () => checkIsAppDocumentArchiveFileFullName('Sunday.owadoc.tar.gz'),
            mocks.checkName,
            ['Sunday.owadoc.tar.gz'],
            'checkName',
        ],
        [
            'exports a document',
            () => exportAppDocument('/docs/Sunday.ows'),
            mocks.exportItem,
            ['/docs/Sunday.ows'],
            'exportItem',
        ],
        [
            'imports an archive from disk',
            () => importAppDocumentArchive('/downloads/Sunday.owadoc.tar.gz'),
            mocks.importArchive,
            ['/downloads/Sunday.owadoc.tar.gz'],
            'importArchive',
        ],
        [
            'imports a dropped archive',
            () =>
                importDroppedAppDocumentArchive({
                    name: 'Sunday.owadoc.tar.gz',
                } as any),
            mocks.importDropped,
            [{ name: 'Sunday.owadoc.tar.gz' }],
            'importDropped',
        ],
        [
            'asks for an archive to import',
            () => selectAndImportAppDocumentArchive(),
            mocks.selectAndImport,
            [],
            'selectAndImport',
        ],
        [
            'asks for an archive URL to import',
            () => askAndImportAppDocumentArchiveFromUrl(),
            mocks.askFromUrl,
            [],
            'askFromUrl',
        ],
    ] as const)(
        '%s through the bundle, with the document config',
        (_name, call, mock, args, mockName) => {
            expect(call()).toBe(`result of ${mockName}`);
            expect(mock).toHaveBeenCalledExactlyOnceWith(
                ...args,
                documentConfig,
            );
        },
    );

    test('creates an archive unprotected unless a password is given', () => {
        expect(createAppDocumentArchive('/docs/Sunday.ows')).toBe(
            'result of create',
        );
        expect(mocks.create).toHaveBeenLastCalledWith(
            '/docs/Sunday.ows',
            documentConfig,
            null,
        );
        createAppDocumentArchive('/docs/Sunday.ows', 'secret');
        expect(mocks.create).toHaveBeenLastCalledWith(
            '/docs/Sunday.ows',
            documentConfig,
            'secret',
        );
    });

    // The bundle passes these titles to `tran` as values, which the static
    // key coverage gate cannot see; a missing one throws in dev.
    // Every package found on disk (none when only English is there).
    test.each(listLangPackageCodes({ isEnglishIncluded: false }))(
        'the titles the bundle translates are in the %s dictionary',
        (langCode) => {
            const dictionary = JSON.parse(
                readFileSync(
                    path.join(toLangPackageDir(langCode), 'dictionary.json'),
                    'utf-8',
                ),
            );
            for (const key of [
                documentConfig.exportTitle,
                documentConfig.importTitle,
            ]) {
                expect(Object.hasOwn(dictionary, key)).toBe(true);
            }
        },
    );
});
