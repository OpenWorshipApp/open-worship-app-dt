import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { extractDictionary } from '../../../tools/owa-devtools-mcp/tran.mjs';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        folders: [] as any[],
        manifest: { kind: 'app-data', folders: [] as any[] },
        readable: { filePath: '/tmp/plain.tar' } as { filePath: string } | null,
        dictionaries: [] as Record<string, string>[],
    },
    mocks: {
        input: vi.fn(),
        selectFiles: vi.fn(),
        export: vi.fn(),
        import: vi.fn(),
        readManifest: vi.fn(),
        open: vi.fn(),
        bibleImport: vi.fn(),
        progress: vi.fn(),
        hideProgress: vi.fn(),
        toast: vi.fn(),
        report: vi.fn(),
        cleanup: vi.fn(),
    },
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined)
                throw new Error(`Missing translation: ${key}`);
        }
        return key;
    },
}));
vi.mock('../../helper/appArchiveHelpers', () => ({
    BIBLE_XML_ARCHIVE_ITEM_KIND: 'bible-xml',
    createWorkDir: async () => '/tmp/import',
    safeDeleteDir: mocks.cleanup,
}));
vi.mock('../../helper/archivePasswordHelpers', () => ({
    openArchiveForReading: mocks.open,
}));
vi.mock('../../popup-widget/ArchiveItemSelectorComp', () => ({
    default: () => null,
}));
vi.mock('../../popup-widget/ArchivePasswordComp', () => ({
    ArchivePasswordComp: () => null,
    MAX_PASSWORD_ATTEMPTS: 3,
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: mocks.input,
}));
vi.mock('../../progress-bar/progressBarHelpers', () => ({
    showProgressBar: mocks.progress,
    hideProgressBar: mocks.hideProgress,
}));
vi.mock('../../server/fileHelpers', () => ({ selectFiles: mocks.selectFiles }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('../directory-setting/dataDirectories', () => ({
    getDataDirectoryBySettingName: (name: string) =>
        name === 'documents-dir'
            ? {
                  settingName: name,
                  title: 'Documents',
                  iconClassName: 'bi-file',
              }
            : null,
}));
vi.mock('../bible-setting/bibleXMLArchiveMenuHelpers', () => ({
    handleBibleXMLImporting: mocks.bibleImport,
}));
vi.mock('./dataArchiveHelpers', () => ({
    EXPORT_TITLE: 'Export Data',
    IMPORT_TITLE: 'Import Data',
    exportData: mocks.export,
    getExportableDataFolders: async () => state.folders,
    importDataArchive: mocks.import,
    readDataArchiveManifest: mocks.readManifest,
    reportDataArchiveError: mocks.report,
}));

import { handleExporting, handleImporting } from './dataArchiveMenuHelpers';

const dictionaries = ['km', 'fr'].map((code) =>
    extractDictionary(readFileSync(`src/lang/data/${code}/index.ts`, 'utf8')),
);
const documents = {
    dataDirectory: {
        settingName: 'documents-dir',
        title: 'Documents',
        iconClassName: 'bi-file',
    },
    dirPath: '/data/documents',
};
const bibles = {
    dataDirectory: {
        settingName: 'bible-dir',
        title: 'Bible Data',
        iconClassName: 'bi-book',
    },
    dirPath: '/data/bibles',
};

beforeEach(() => {
    state.dictionaries = dictionaries;
    state.folders = [];
    state.manifest = { kind: 'app-data', folders: [] };
    state.readable = { filePath: '/tmp/plain.tar' };
    mocks.input.mockResolvedValue(true);
    mocks.selectFiles.mockResolvedValue(['/downloads/data.owadata.tar']);
    mocks.export.mockResolvedValue('/downloads/data.owadata.tar');
    mocks.import.mockResolvedValue({ copied: 2, reused: 1 });
    mocks.readManifest.mockImplementation(async () => state.manifest);
    mocks.open.mockImplementation(async () => state.readable);
    mocks.bibleImport.mockResolvedValue(undefined);
    mocks.cleanup.mockResolvedValue(undefined);
    mocks.report.mockImplementation(
        (_title: string, error: Error) => error.message,
    );
});

describe('whole-data archive menu flows', () => {
    test('explains that no folder is ready without opening an export picker', async () => {
        await handleExporting();
        expect(mocks.input).not.toHaveBeenCalled();
        expect(mocks.toast).toHaveBeenCalledWith(
            'Export Data',
            expect.stringContaining('No data folder is set up'),
        );
    });

    test('exports only checked folders with a confirmed password', async () => {
        state.folders = [documents, bibles];
        mocks.input.mockImplementation(async (_title: string, content: any) => {
            const [selector, passwordContainer] = content.props.children;
            selector.props.onChange(['documents-dir']);
            passwordContainer.props.children.props.onChange('secret', 'secret');
            return true;
        });
        await handleExporting();
        expect(mocks.export).toHaveBeenCalledWith([documents], 'secret');
        expect(mocks.toast).toHaveBeenCalledWith(
            'Export Data',
            'Exported to /downloads/data.owadata.tar',
        );
    });

    test('re-asks mismatched passwords and never exports the first answer', async () => {
        state.folders = [documents, bibles];
        let count = 0;
        mocks.input.mockImplementation(async (_title: string, content: any) => {
            const [selector, passwordContainer] = content.props.children;
            selector.props.onChange(['documents-dir']);
            passwordContainer.props.children.props.onChange(
                'secret',
                count++ === 0 ? 'wrong' : 'secret',
            );
            return true;
        });
        await handleExporting();
        expect(mocks.input).toHaveBeenCalledTimes(2);
        expect(mocks.export).toHaveBeenCalledOnce();
        expect(mocks.export).toHaveBeenCalledWith([documents], 'secret');
    });

    test('passes a decrypted Bible Data archive to the Bible importer once', async () => {
        state.manifest = { kind: 'bible-xml', folders: [] };
        await handleImporting('/downloads/encrypted.owadata.enc');
        expect(mocks.open).toHaveBeenCalledOnce();
        expect(mocks.bibleImport).toHaveBeenCalledWith('/tmp/plain.tar');
        expect(mocks.readManifest).toHaveBeenCalledWith('/tmp/plain.tar');
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/import');
    });

    test('imports selected folders and reports copied and reused files', async () => {
        state.manifest = {
            kind: 'app-data',
            folders: [{ settingName: 'documents-dir', entry: 'documents' }],
        };
        await handleImporting('/downloads/data.owadata.tar');
        expect(mocks.import).toHaveBeenCalledWith(
            '/tmp/plain.tar',
            state.manifest.folders,
        );
        expect(mocks.toast).toHaveBeenCalledWith(
            'Import Data',
            'Imported 2 file(s); 1 already up to date',
        );
        expect(mocks.progress).toHaveBeenCalledWith('Import Data');
        expect(mocks.hideProgress).toHaveBeenCalledWith('Import Data');
    });

    test('cancelled decryption returns without a toast and still cleans up', async () => {
        state.readable = null;
        await handleImporting('/downloads/data.owadata.enc');
        expect(mocks.readManifest).not.toHaveBeenCalled();
        expect(mocks.toast).not.toHaveBeenCalled();
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/import');
    });

    test('a failed restore reports the error and cleans the decrypted copy', async () => {
        state.manifest = {
            kind: 'app-data',
            folders: [{ settingName: 'documents-dir', entry: 'documents' }],
        };
        mocks.import.mockRejectedValue(new Error('disk full'));
        await handleImporting();
        expect(mocks.selectFiles).toHaveBeenCalledOnce();
        expect(mocks.report).toHaveBeenCalledWith(
            'Import Data',
            expect.any(Error),
        );
        expect(mocks.toast).toHaveBeenCalledWith('Import Data', 'disk full');
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/import');
    });
});
